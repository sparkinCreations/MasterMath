// The numeric search for equations outside every exact method: roots located
// by sign changes and refined, domain restrictions, and a constant difference
// recognised (an identity or a contradiction).

import { unsupported } from '../../solutionEnvelope.js';
import {
  math,
  neverZeroSide,
  beautify,
  formatNumber,
  findUndefinedRegions,
  formatRestriction,
  trigUndefinedPoints,
  mark,
  realOddRoots,
  piForm,
  structuralPeriod,
  absBars,
  stripOuterParens,
  linearCoefficients,
} from '../solverUtils.js';
import { infiniteSignChanges } from '../inequalities/zeros.js';
import { tanBranchRoots } from '../trigonometry/tanBranches.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';

// Brute-force numeric root finding, used only when symbolic methods fail.
//
// Hardened after the July 2026 production audit, which caught this path
// confidently reporting scan artifacts as solutions (sqrt(x) = 5 → five
// values near -100). Three rules keep it honest now:
//   1. Non-real values (Complex from sqrt/log of negatives) are out-of-domain
//      points, never operands of a sign comparison — NaN sign-"changes" were
//      the artifact factory.
//   2. A constant difference is recognized before scanning: identically 0 is
//      an identity (all real numbers), a nonzero constant is a contradiction
//      (no solution) — not five grid points / not "none found in range".
//   3. Every candidate root must survive back-substitution (|f(root)| small)
//      or it is silently dropped; if none survive, refuse honestly.
export function solveNumerically(equation, variable) {
  const [left, right = '0'] = equation.split('=');
  const expression = right.trim() === '0' ? left.trim() : `(${left.trim()}) - (${right.trim()})`;

  // Real-valued evaluation: Complex results (sqrt of a negative) count as
  // "not defined here", exactly like a thrown evaluation error.
  // A real odd root, (−8)^(1/3) = −2: mathjs's principal root is complex.
  const realExpression = realOddRoots(expression);
  const evalReal = (x) => {
    try {
      const v = math.evaluate(realExpression, { [variable]: x });
      // ±Infinity (1/0 at a pole) is "not defined here", same as NaN/Complex.
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };

  const constant = detectConstantDifference(evalReal);
  if (constant !== null) {
    if (Math.abs(constant) < 1e-9) {
      // An identity holds wherever BOTH sides are defined. Simplifying
      // 1/(x-1) = 1/(x-1) to 0 = 0 loses that x = 1 was never allowed, so the
      // domain is read off the original sides, not the simplified difference.
      const domain = domainRestrictionsOf([left, right], variable);
      if (!domain.proved) {
        return {
          envelope: unsupported({
            input: `${beautify(left.trim())} = ${beautify(right.trim())}`,
            reason: DOMAIN_NOT_PROVED,
            answer: DOMAIN_NOT_PROVED,
          }),
        };
      }
      // tan, sec, cot, csc and divisions by sin or cos are undefined on a
      // lattice of points the grid never lands on exactly (tan(π/2) is a
      // huge finite number in floating point), so read those off the
      // structure: tan(x) = sin(x)/cos(x) holds except at x = π/2 + nπ.
      const poles = [...trigUndefinedPoints(`${left} = ${right}`, variable), ...domain.lattices]
        .filter((pole, i, all) => all.findIndex((q) => q.text === pole.text && q.because === pole.because) === i);
      // A point the scan hit on a lattice is the lattice's: 1/sin(x) at 0.
      const onLattice = (x) => poles.some((p) => Math.abs((x - p.offset) / p.step - Math.round((x - p.offset) / p.step)) < 1e-9);
      const restrictions = domain.regions.filter((r) => !(r.from === r.to && !r.whole && onLattice(r.from)));
      if (restrictions.length === 0 && poles.length > 0) {
        const where = [...new Set(poles.map((p) => p.text))].join(' and ');
        const because = [...new Set(poles.map((p) => p.because))].join(', ');
        return {
          steps: [
            `Before simplifying, note where the original equation is defined: ${markBecause(because)} ${poles.length > 1 ? 'are' : 'is'} undefined at ${markConditions(where)} (${mark('n')} any integer), so those values are excluded from the start.`,
            `Rewrite as ${mark(`${beautify(expression)} = 0`)}`,
            `The ${mark(variable)} terms cancel — the two sides are identical wherever they are both defined.`,
            `This is an identity on its domain: every real number except ${markConditions(where)} is a solution. The excluded points are not solutions, even though the simplified form ${mark('0 = 0')} would allow them.`,
          ],
          answer: `All real numbers except ${where}, n any integer (identity on its domain — ${because} ${poles.length > 1 ? 'are' : 'is'} undefined there)`,
          solutions: [],
        };
      }
      if (restrictions.length === 0) {
        return {
          steps: [
            `Rewrite as ${mark(`${beautify(expression)} = 0`)}`,
            `The ${mark(variable)} terms cancel — the two sides are identical for every value of ${mark(variable)}.`,
            'This is an identity: every real number is a solution.',
          ],
          answer: `All real numbers (identity — true for every ${variable})`,
          solutions: [],
        };
      }
      // Other exclusions and a lattice together: 1/x + tan(x).
      const periodic = poles.length > 0;
      const shownEnd = (r) => r.undefinedText ?? formatRestriction(r, variable, { fmt: exactEndpoint });
      const shownAllowed = (r) => r.allowedText ?? formatRestriction(r, variable, { allowed: true, fmt: exactEndpoint });
      const latticeTexts = [...new Set(poles.map((p) => p.text))];
      const undefinedFor = [...restrictions.map(shownEnd), ...latticeTexts].join(' and for ');
      const allowed = [...restrictions.map(shownAllowed), ...latticeTexts.map((t) => t.replace(' = ', ' ≠ '))].join(' and ');
      return {
        steps: [
          `Before simplifying, note where the original equation is defined: it is undefined for ${markConditions(undefinedFor)}.`,
          `Rewrite as ${mark(`${beautify(expression)} = 0`)}`,
          `The ${mark(variable)} terms cancel — the two sides are identical wherever they are both defined.`,
          `This is an identity on its domain: every real number with ${markConditions(allowed)} is a solution${periodic ? `, with ${mark('n')} any integer` : ''}. Values where the original expression is undefined are not solutions, even though the simplified form ${mark('0 = 0')} would allow them.`,
        ],
        answer: `All real numbers with ${allowed}${periodic ? ', n any integer' : ''} (identity on its domain)`,
        solutions: [],
      };
    }
    return {
      steps: [
        `Rewrite as ${mark(`${beautify(expression)} = 0`)}`,
        `The ${mark(variable)} terms cancel — the difference between the sides is always ${mark(formatNumber(constant))}, never ${mark('0')}.`,
        'The two sides can never be equal, so this equation has no solution.',
      ],
      answer: 'No solution (the two sides are never equal)',
      solutions: [],
    };
  }

  const roots = [];
  const seen = (root) => roots.some((r) => Math.abs(r - root) < 0.01);

  // A value that is merely small is not a root. e^x = 0 has none, yet e^-9 is
  // 1.2e-4 and a loose "|f| < 1e-3" test called -9, -8.5, … solutions. A
  // candidate that does NOT come from a sign change must be a genuine touch
  // root: |f| tiny AND a local minimum of |f| (a decaying tail keeps getting
  // smaller, so it never is).
  // STRICT on both sides: e^(-x²) underflows to exactly 0 for |x| ≳ 27, and
  // "0 ≤ 0 ≤ 0" would call every point out there a root. A genuine touch
  // root rises on both sides.
  const isTouchRoot = (x) => {
    const v = evalReal(x);
    if (!Number.isFinite(v) || Math.abs(v) > 1e-9) return false;
    const l = Math.abs(evalReal(x - 1e-3));
    const r = Math.abs(evalReal(x + 1e-3));
    return Number.isFinite(l) && Number.isFinite(r) && l > Math.abs(v) && r > Math.abs(v);
  };

  // Sign changes are located on a coarse grid, then refined. A gap that
  // contains an undefined point (a pole) is re-scanned finely so a root that
  // sits between the pole and the next grid point — 1/x + 1/(x+1) = 1 has one
  // at -0.618, between the poles at -1 and 0 — is not stepped over: the
  // coarse step saw only ∞ on one side and lost the bracket.
  const considerBracket = (a, b) => {
    const fa = evalReal(a);
    const fb = evalReal(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return;
    if (Math.sign(fa) !== Math.sign(fb) && fa !== 0 && fb !== 0) {
      const root = refineRoot(expression, variable, a, b);
      if (root !== null && !seen(root)) roots.push(root);
      return;
    }
    // Same sign at both ends: a touch root (a squared factor — sin(3x)^2 = 0
    // at πn/3) can still sit strictly between two grid points, where |f|
    // dips to 0 and comes back up without a sign change. If |f| is falling
    // at a and rising at b there is a local minimum of |f| inside; locate it
    // by ternary search and keep it only if it really reaches zero.
    const h = (b - a) * 1e-3;
    const ga = Math.abs(evalReal(a + h));
    const gb = Math.abs(evalReal(b - h));
    if (!Number.isFinite(ga) || !Number.isFinite(gb)) return;
    if (!(ga < Math.abs(fa) && gb < Math.abs(fb))) return;
    let lo = a;
    let hi = b;
    for (let i = 0; i < 60; i += 1) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const f1 = Math.abs(evalReal(m1));
      const f2 = Math.abs(evalReal(m2));
      if (!Number.isFinite(f1) || !Number.isFinite(f2)) return;
      if (f1 < f2) hi = m2; else lo = m1;
    }
    const x = (lo + hi) / 2;
    if (Math.abs(evalReal(x)) < 1e-9 && !seen(x)) roots.push(x);
  };
  const fineScan = (a, b) => {
    const step = (b - a) / 50;
    let px = a;
    for (let x = a + step; x <= b + 1e-12; x += step) {
      considerBracket(px, x);
      px = x;
    }
  };

  let prevX = null;
  let prevDefined = false;
  let lastDefinedX = null;
  let definedCount = 0;
  for (let x = -100; x <= 100; x += 0.5) {
    const value = evalReal(x);
    const defined = Number.isFinite(value);
    if (defined) {
      definedCount += 1;
      if (prevDefined) considerBracket(prevX, x);
      else if (lastDefinedX !== null) fineScan(lastDefinedX, x); // gap held a pole
      // First defined point after an undefined stretch (ln(x) at x = 0.5,
      // after x ≤ 0): the root of ln(x) = -1 is at 0.37, between the last
      // undefined grid point and this one — scan that gap too, or it is lost.
      else if (prevX !== null) fineScan(prevX, x);
      if (isTouchRoot(x) && !seen(x)) roots.push(x);
      lastDefinedX = x;
    } else if (prevDefined && prevX !== null) {
      // Entering a pole from the left: look for a root just before it.
      fineScan(prevX, x);
    }
    prevDefined = defined;
    prevX = x;
  }

  // Nothing was defined anywhere in the scan — the equation was never
  // actually tested, so "no real solution" would be a claim about maths when
  // the truth is that this solver could not read the expression. `sin^2(x)`
  // used to arrive here mis-parsed and be answered "No real solution found",
  // which is flatly wrong: it has infinitely many.
  if (definedCount === 0) {
    return {
      envelope: unsupported({
        input: expression,
        reason: `${beautify(expression)} could not be evaluated at any real value of ${variable}, so its solutions cannot be determined here.`,
        answer: 'This equation is beyond what this solver can compute',
        tips: [
          'Check the notation: powers use "^" ("x^2"), multiplication uses "*" ("2*x"), and every function call needs parentheses — "sin(x)", not "sin x".',
          'This is a limitation of the solver, not necessarily of the equation — it may well have solutions.',
        ],
      }),
    };
  }

  // Back-substitution gate: a candidate only counts if it actually satisfies
  // the equation. This is what turns a scanner bug into "no answer" instead
  // of a wrong answer. Tight tolerance: bisection lands within 1e-6 easily,
  // and anything looser lets asymptotic tails through.
  const verified = roots.filter((r) => {
    const residual = evalReal(r);
    return Number.isFinite(residual) && Math.abs(residual) <= 1e-6;
  });

  // None found is not none: a search over −100…100 proves nothing about
  // the rest of the line, or a root it stepped over. It was answered "No
  // real solution found", marked Solved (October 26). Only a side that is
  // provably never 0 — a nonzero constant times exponentials, or over
  // anything (e^x = 0, 1/(x − 2)² = 0) — makes "no real solution" a fact.
  // e^x = cos(x) has a root in every period as x → −∞: proved, it is said
  // so in the answer, not left as five roots that read like all of them.
  const endless = expression.includes('=') ? null : infiniteSignChanges(expression, variable);
  // f(x + T) = f(x): every root found repeats every period.
  const period = endless || expression.includes('=') ? null : structuralPeriod(expression, variable);
  // tan(x) = x: a root between every two poles, located branch by branch;
  // the scan stepped over the ones next to the poles.
  const branch = endless || period > 0 || expression.includes('=') ? null : tanBranchRoots(expression, variable);

  if (verified.length === 0 && !branch) {
    const never = neverZeroSide(left, right, variable);
    if (never) {
      return {
        steps: [`Rewrite as ${mark(`${beautify(expression)} = 0`)}`, `${mark(beautify(never.side))} is never ${mark('0')}: ${never.why}.`, 'Solution: no real solution'],
        answer: `No real solution (${beautify(never.side)} is never 0)`,
        solutions: [],
      };
    }
    return {
      envelope: unsupported({
        input: equation,
        reason: `No solution of ${beautify(equation)} turned up in a numeric search from ${variable} = −100 to 100, but a search cannot show there is none, and no exact method applies to this equation.`,
        answer: 'No solution was found, but this solver cannot show there is none',
        tips: ['This is a limitation of the solver, not proof that the equation has no solution.'],
      }),
    };
  }

  // Show at most five roots, preferring the ones nearest zero (a periodic
  // equation can have dozens in range; x = 0, ±π beats x = -100, -99.5, …).
  const solutions = branch
    ? branch.roots
    : verified
      .sort((a, b) => Math.abs(a) - Math.abs(b))
      .slice(0, 5)
      .sort((a, b) => a - b);

  // Say what this is (1.75.0): a numeric answer, not a method a student is
  // meant to copy, with the hand method for the shape when there is one.
  const shown = absBars(beautify(expression)).replace(/(?<![a-z])sqrt\(/g, '√(').replace(/√\(([a-z0-9]+)\)/gi, '√$1');
  const steps = [
    `MasterMath has no step-by-step method for this equation, so its solutions were found numerically: values of ${mark(variable)} were tried until the two sides balanced, and each one was checked by substituting it back.`,
    ...(handMethod(equation, variable) ? [handMethod(equation, variable)] : []),
    `Rewrite as ${mark(`${shown} = 0`)}`,
    ...(branch ? branch.steps : ['Search for values where the expression crosses zero, then verify each candidate by substituting it back.']),
  ];
  if (branch) {
    // Said in the branch's own steps.
  } else if (period > 0) {
    const T = piForm(period) ?? formatNumber(period);
    steps.push(`Every term repeats every ${mark(T)}, so the equation is unchanged when ${mark(variable)} is replaced by ${mark(`${variable} + ${T}`)}: each solution comes back once a period, and there are infinitely many. Showing the ${solutions.length} closest to zero.`);
  } else if (endless) {
    const every = piForm(endless.period) ?? formatNumber(endless.period);
    steps.push(`As ${mark(`${variable} → ${endless.dir < 0 ? '−∞' : '∞'}`)}, ${mark(beautify(endless.settling))} approaches ${mark(formatNumber(endless.limit))} while ${mark(beautify(endless.periodic))} repeats every ${mark(every)} and crosses ${mark(formatNumber(-endless.limit))}, so the expression changes sign in every period from some point on: there are infinitely many solutions. Showing the ${solutions.length} closest to zero.`);
  } else if (verified.length > solutions.length) {
    steps.push(`The equation has more solutions in range; showing the ${solutions.length} closest to zero.`);
  }
  // A root located numerically is written with ≈, and with = only when the
  // number shown satisfies the equation exactly (x = 2, not x = 0.5671 for
  // x·e^x = 1).
  const [lhsText, rhsText] = expression.split('=');
  const exactAt = (shown) => {
    try {
      const x = Number(shown);
      const l = math.evaluate(lhsText, { [variable]: x });
      const r = rhsText === undefined ? 0 : math.evaluate(rhsText, { [variable]: x });
      return typeof l === 'number' && typeof r === 'number' && Math.abs(l - r) <= 1e-12 * (1 + Math.abs(l));
    } catch {
      return false;
    }
  };
  // The number shown must also be the root located, not merely a point where
  // f is tiny: at the triple root 2π of tan(x) = sin(x), f(6.2832) ≈ 10^(−17).
  const isShown = (s) => Math.abs(Number(formatNumber(s)) - s) <= 1e-12 * (1 + Math.abs(s));
  // 0.6667 that is exactly 2/3 is shown as 2/3: a fraction with a small
  // denominator is kept only when it satisfies the equation exactly.
  const fraction = (s) => {
    for (let q = 2; q <= 12; q += 1) {
      const p = Math.round(s * q);
      if (Math.abs(p / q - s) < 1e-9 && exactAt(String(p / q)) && Number.isInteger(p) && p % q !== 0) {
        const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
        const d = g(p, q);
        return `${p / d}/${q / d}`;
      }
    }
    return null;
  };
  const items = solutions.map((s) => {
    const f = fraction(s);
    if (f) return `${variable} = ${f}`;
    return `${variable} ${isShown(s) && exactAt(formatNumber(s)) ? '=' : '≈'} ${formatNumber(s)}`;
  });
  const listed = items.join('  or  ');
  // A list cut to five says so in the answer itself, which is what is read
  // (and exported) on its own.
  const between = branch && { one: 'exactly one', counted: 'one or three', some: 'at least one', convex: 'two or none' }[branch.kind];
  const answer = branch
    ? `Infinitely many solutions, ${between} between each pair of consecutive poles of ${mark(branch.fnText)}; ${branch.kind === 'some' ? 'among them' : `the ${solutions.length} nearest ${mark('0')} are`} ${items.map((t) => mark(t)).join('  or  ')}`
    : period > 0
    ? `Infinitely many solutions, repeating every ${piForm(period) ?? formatNumber(period)}; the ${solutions.length} nearest 0 are ${listed}`
    : endless
    ? `Infinitely many solutions; the ${solutions.length} nearest 0 are ${listed}`
    : verified.length > solutions.length
      ? `${listed} (the ${solutions.length} solutions nearest 0; there are more)`
      // sec(x) = x: the scan steps over roots next to poles, and nothing
      // proves the list complete.
      : trigUndefinedPoints(expression, variable).length
        ? `${listed} (found by a numeric search, which can miss solutions next to the poles; there may be more)`
        : listed;
  steps.push(`Solution: ${answer}`);
  // Which roots are exact and which are numerical (review of 1.75.0):
  // x² = 2ˣ has x = 2 and x = 4 exactly, and only x ≈ −0.7667 numerically.
  const exactItems = items.filter((t) => / = /.test(t));
  const approxItems = items.filter((t) => / ≈ /.test(t));
  if (!branch && !period && !endless && exactItems.length && approxItems.length) {
    steps.push(`${exactItems.map((t) => mark(t)).join(' and ')} ${exactItems.length === 1 ? 'is' : 'are'} exact: substituted back, ${exactItems.length === 1 ? 'it makes' : 'each makes'} the two sides exactly equal. ${approxItems.map((t) => mark(t)).join(' and ')} ${approxItems.length === 1 ? 'is' : 'are'} numerical: located to high precision and rounded, with no simple exact form found.`);
  } else if (!branch && !period && !endless && exactItems.length && !approxItems.length) {
    steps.push(`${exactItems.length === 1 ? 'This root is' : 'These roots are'} exact: substituted back, ${exactItems.length === 1 ? 'it makes' : 'each makes'} the two sides exactly equal.`);
  }

  return { steps, answer, solutions };
}

// Probe the rewritten expression at spread-out points. If it is defined at
// most of them and takes the same value everywhere, the equation's two sides
// differ by a constant. Returns that constant, or null when not constant.
const CONSTANT_PROBE_POINTS = [-9.7, -4.3, -1.1, 0.6, 2.9, 7.4, 23.7];

// Where either side of an equation is undefined over the reals — poles,
// negative radicands, non-positive log arguments — merged and de-duplicated.
// The identity branch above needs this so the domain isn't lost in the
// simplification; both sides are checked because x = 1 must be excluded from
// "x = 1/(x-1)·(x-1)" whichever side the trouble sits on.
// Conditions joined in words ("x ≠ 0 and x ≠ 1"): each one marked, the
// words left as words.
export function markConditions(conditions) {
  return conditions.split(/\s+and(?:\s+for)?\s+/)
    .map((c) => (c.startsWith('not ') ? `not ${mark(c.slice(4))}` : mark(c)))
    .join(' and ');
}

// "tan(x), division by cos(x)": the functions marked, the words not.
function markBecause(because) {
  return because.split(', ')
    .map((part) => (part.startsWith('division by ') ? `division by ${mark(part.slice(12))}` : mark(part)))
    .join(', ');
}

const DOMAIN_NOT_PROVED = 'The two sides appear to be identical, but MasterMath cannot yet determine every value where they are defined.';

// A scan's edge is shown only when it is a simple fraction: anything else is
// a rounded stand-in for a value the scan did not prove.
const SIMPLE_DENOMINATORS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const simpleDenominator = (x) => SIMPLE_DENOMINATORS.find((d) => Math.abs(x * d - Math.round(x * d)) < 1e-9);
function exactEndpoint(x) {
  const d = simpleDenominator(x);
  return d === undefined || d === 1 ? formatNumber(x) : `${Math.round(x * d)}/${d}`;
}

function domainRestrictionsOf(sides, variable) {
  const found = [];
  const lattices = [];
  let proved = true;
  for (const side of sides) {
    found.push(...findUndefinedRegions(side.trim(), variable));
    const structural = structuralRestrictions(side.trim(), variable);
    found.push(...structural.regions);
    lattices.push(...structural.lattices);
    proved = proved && structural.proved;
  }
  const regions = mergeRestrictions(found).sort((a, b) => (a.from ?? -Infinity) - (b.from ?? -Infinity));
  const edgeShown = (r) => r.allowedText || [r.from, r.to].every((x) => !Number.isFinite(x) || simpleDenominator(x) !== undefined);
  return { regions, lattices, proved: proved && regions.every(edgeShown) };
}

const unwrap = (node) => {
  let n = node;
  while (n.isParenthesisNode) n = n.content;
  return n;
};
const dependsOn = (node, variable) => node.filter((c) => c.isSymbolNode && c.name === variable).length > 0;
const constantValue = (node) => {
  try {
    const v = node.evaluate();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
};
const pointRegion = (value, variable, text) => ({
  from: value,
  to: value,
  fromClosed: true,
  toClosed: true,
  ...(text ? { allowedText: `${variable} ≠ ${text}`, undefinedText: `${variable} = ${text}` } : {}),
});

// (−b ± s√r)/(2a) for a quadratic with integer coefficients, as text.
function surdZeros(coefficients) {
  const lcm = coefficients.reduce((acc, c) => (acc * c.d) / gcdBig(acc, c.d), 1n);
  let [c, b, a] = coefficients.map((f) => Number(f.s * f.n * (lcm / f.d)));
  if (a < 0) [a, b, c] = [-a, -b, -c];
  const discriminant = b * b - 4 * a * c;
  if (!Number.isSafeInteger(discriminant) || discriminant <= 0) return null;
  let outside = 1;
  let inside = discriminant;
  for (let k = Math.floor(Math.sqrt(inside)); k > 1; k -= 1) {
    if (inside % (k * k) === 0) {
      outside = k;
      inside /= k * k;
      break;
    }
  }
  if (inside === 1) return null;
  const divide = (x, y) => (y === 0 ? Math.abs(x) : divide(y, x % y));
  const common = divide(divide(Math.abs(b), outside), 2 * a);
  const p = -b / common;
  const q = outside / common;
  const den = (2 * a) / common;
  const surd = `${q === 1 ? '' : q}√${inside}`;
  const texts = p === 0
    ? [`-${surd}`, surd]
    : [`${p} - ${surd}`, `${p} + ${surd}`];
  const shown = texts.map((t) => (den === 1 ? t : p === 0 ? `${t}/${den}` : `(${t})/${den}`));
  const values = [-1, 1].map((sign) => (-b + sign * Math.sqrt(discriminant)) / (2 * a));
  return values.map((value, i) => ({ value, text: shown[i] }));
}
const gcdBig = (a, b) => (b === 0n ? a : gcdBig(b, a % b));

function polynomialZeros(polynomial, node, variable) {
  const roots = allRoots(polynomial).real;
  const rational = (root) => (root.exact.d === 1n ? String(root.exact.m) : `${root.exact.m}/${root.exact.d}`);
  if (roots.every((root) => root.exact)) return roots.map((root) => pointRegion(root.value, variable, rational(root)));
  if (polynomial.degree === 2) {
    const zeros = surdZeros(polynomial.coefficients);
    if (zeros) return zeros.map(({ value, text }) => pointRegion(value, variable, text));
  }
  // No tidy form (a cubic's irrational root): the condition itself is exact.
  const shown = beautify(stripOuterParens(node.toString()));
  return [{ ...pointRegion(roots[0].value, variable), allowedText: `${shown} ≠ 0`, undefinedText: `${shown} = 0`, whole: true }];
}

// k·b^(ax + c) + d: at most one zero, ln-exact, and none when −d/k ≤ 0.
function exponentialZeros(n, variable) {
  if (!n.isOperatorNode || !['add', 'subtract'].includes(n.fn) || n.args.length !== 2) return null;
  const readPower = (node) => {
    const t = unwrap(node);
    if (t.isOperatorNode && t.fn === 'unaryMinus') {
      const r = readPower(t.args[0]);
      return r && { ...r, k: -r.k };
    }
    if (t.isOperatorNode && t.fn === 'multiply' && t.args.length === 2) {
      const [a, b] = t.args;
      const k = dependsOn(a, variable) ? constantValue(b) : constantValue(a);
      const r = readPower(dependsOn(a, variable) ? a : b);
      return r && k !== null ? { ...r, k: r.k * k } : null;
    }
    if (t.isFunctionNode && t.fn.name === 'exp') return { k: 1, base: Math.E, exponent: t.args[0] };
    if (t.isOperatorNode && t.fn === 'pow') {
      const base = constantValue(t.args[0]);
      return base !== null && base > 0 && base !== 1 && dependsOn(t.args[1], variable) ? { k: 1, base, exponent: t.args[1] } : null;
    }
    return null;
  };
  const [first, second] = n.args;
  const firstHasVariable = dependsOn(first, variable);
  if (firstHasVariable === dependsOn(second, variable)) return null;
  const power = readPower(firstHasVariable ? first : second);
  const constant = constantValue(firstHasVariable ? second : first);
  if (!power || constant === null) return null;
  const k = firstHasVariable || n.fn === 'add' ? power.k : -power.k;
  const d = !firstHasVariable || n.fn === 'add' ? constant : -constant;
  const target = -d / k;
  if (target <= 0) return [];
  const line = linearCoefficients(stripOuterParens(power.exponent.toString()), variable);
  if (!line || line.k === 0 || line.k < 0 || !Number.isInteger(line.k) || !Number.isInteger(line.d) || !Number.isInteger(target)) return null;
  const logarithm = power.base === Math.E ? `ln(${target})` : `ln(${target})/ln(${power.base})`;
  const value = (Math.log(target) / Math.log(power.base) - line.d) / line.k;
  if (target === 1) {
    const whole = -line.d / line.k;
    return Number.isInteger(whole) ? [pointRegion(whole, variable, String(whole))] : null;
  }
  const top = line.d === 0 ? logarithm : `${line.k === 1 ? '' : '('}${logarithm} ${line.d > 0 ? '-' : '+'} ${Math.abs(line.d)}${line.k === 1 ? '' : ')'}`;
  return [pointRegion(value, variable, line.k === 1 ? top : `${top}/${line.k}`)];
}

// k·sin(u) + c or k·cos(u) + c with |c| > |k| cannot reach 0.
function waveNeverZero(n, variable) {
  if (!['add', 'subtract'].includes(n.fn) || n.args.length !== 2) return false;
  const amplitude = (node) => {
    const t = unwrap(node);
    if (t.isFunctionNode && ['sin', 'cos'].includes(t.fn.name)) return 1;
    if (t.isOperatorNode && t.fn === 'unaryMinus') return amplitude(t.args[0]);
    if (t.isOperatorNode && t.fn === 'multiply' && t.args.length === 2) {
      const [a, b] = t.args;
      const k = dependsOn(a, variable) ? constantValue(b) : constantValue(a);
      const inner = amplitude(dependsOn(a, variable) ? a : b);
      return k !== null && inner !== null ? Math.abs(k) * inner : null;
    }
    return null;
  };
  const [first, second] = n.args;
  if (dependsOn(first, variable) === dependsOn(second, variable)) return false;
  const k = amplitude(dependsOn(first, variable) ? first : second);
  const c = constantValue(dependsOn(first, variable) ? second : first);
  return k !== null && c !== null && Math.abs(c) > k;
}

// Every zero of an expression, proved from its form, or null when no proof
// is at hand. Never from samples: a zero between the scan's points is exactly
// what a scan misses.
function zerosOf(node, variable) {
  const n = unwrap(node);
  const none = { points: [], lattices: [] };
  if (!dependsOn(n, variable)) return none;
  const polynomial = readPolynomial(n.toString(), variable);
  if (polynomial?.tooHigh) return null;
  if (polynomial && polynomial.degree >= 1) return { points: polynomialZeros(polynomial, n, variable), lattices: [] };
  const union = (a, b) => (a && b ? { points: [...a.points, ...b.points], lattices: [...a.lattices, ...b.lattices] } : null);
  if (n.isOperatorNode) {
    if (n.fn === 'unaryMinus') return zerosOf(n.args[0], variable);
    if (n.fn === 'multiply') return n.args.reduce((acc, a) => union(acc, zerosOf(a, variable)), none);
    // The denominator has its own turn: it is a divisor too.
    if (n.fn === 'divide') return zerosOf(n.args[0], variable);
    if (n.fn === 'pow') {
      const power = constantValue(n.args[1]);
      if (power !== null) return zerosOf(n.args[0], variable);
      const base = constantValue(n.args[0]);
      if (base !== null && base > 0) return none;
      return null;
    }
    if (waveNeverZero(n, variable)) return none;
    const exponential = exponentialZeros(n, variable);
    return exponential ? { points: exponential, lattices: [] } : null;
  }
  if (n.isFunctionNode) {
    const name = n.fn.name;
    const argument = n.args[0];
    if (name === 'exp') return none;
    if (name === 'abs' || name === 'sqrt') return zerosOf(argument, variable);
    if (name === 'ln' || (name === 'log' && n.args.length === 1) || name === 'log10' || name === 'log2') {
      const minusOne = readPolynomial(`(${argument.toString()}) - 1`, variable);
      if (!minusOne || minusOne.tooHigh || minusOne.degree < 1) return null;
      return { points: polynomialZeros(minusOne, argument, variable).filter((r) => !r.whole), lattices: [] };
    }
    if (name === 'sin' || name === 'cos') {
      const lattice = trigUndefinedPoints(`${name === 'cos' ? 'tan' : 'cot'}(${argument.toString()})`, variable);
      if (lattice.length === 0) return null;
      const because = `division by ${name}(${beautify(argument.toString())})`;
      return { points: [], lattices: lattice.map((l) => ({ ...l, because })) };
    }
  }
  return null;
}

// Where a side has no value, read off the parse tree: every divisor's zeros
// ((3x − 1)/(3x − 1) at 1/3, between the scan's points), a base raised to
// the power 0 (mathjs says 0^0 = 1; here it has no value, as in limits), and
// a logarithm's zero argument hidden by what surrounds it (e^ln(x) is 0 at
// 0). proved is false when a divisor's zeros cannot be established.
function structuralRestrictions(side, variable) {
  let tree;
  try {
    tree = math.parse(side);
  } catch {
    return { regions: [], lattices: [], proved: false };
  }
  const nonzero = [];
  const logArguments = [];
  let proved = true;
  tree.traverse((node) => {
    if (node.isOperatorNode && node.op === '/') nonzero.push(node.args[1]);
    if (node.isOperatorNode && node.op === '^') {
      const power = constantValue(node.args[1]);
      if (power !== null && power <= 0) nonzero.push(node.args[0]);
      // 0^x at x = 0 is the same 0^0.
      if (constantValue(node.args[0]) === 0) nonzero.push(node.args[1]);
    }
    if (node.isFunctionNode && ['ln', 'log', 'log10', 'log2'].includes(node.fn.name)) logArguments.push(node.args[0]);
    if (node.isFunctionNode && ['tan', 'sec', 'cot', 'csc'].includes(node.fn.name)
      && dependsOn(node, variable) && trigUndefinedPoints(`${node.fn.name}(${node.args[0].toString()})`, variable).length === 0) proved = false;
  });
  const regions = [];
  const lattices = [];
  for (const node of nonzero) {
    const zeros = zerosOf(node, variable);
    if (!zeros) {
      proved = false;
      continue;
    }
    regions.push(...zeros.points);
    lattices.push(...zeros.lattices);
  }
  for (const node of logArguments) {
    const polynomial = readPolynomial(node.toString(), variable);
    if (polynomial && !polynomial.tooHigh && polynomial.degree >= 1) {
      regions.push(...polynomialZeros(polynomial, node, variable).filter((r) => !r.whole));
    }
  }
  return { regions, lattices, proved };
}

// One entry per restriction: a repeated value once (the exact wording kept),
// a point inside an interval dropped, a point at an interval's end closing it.
function mergeRestrictions(regions) {
  const near = (a, b) => a === b || Math.abs(a - b) < 1e-6;
  const isPoint = (r) => Number.isFinite(r.from) && Number.isFinite(r.to) && near(r.from, r.to);
  const intervals = [];
  for (const r of regions.filter((q) => !isPoint(q))) {
    if (!intervals.some((q) => near(q.from, r.from) && near(q.to, r.to))) intervals.push({ ...r });
  }
  const points = [];
  for (const r of regions.filter(isPoint)) {
    const end = !r.whole && intervals.find((q) => near(q.from, r.from) || near(q.to, r.from));
    if (end) {
      if (near(end.from, r.from)) end.fromClosed = true;
      else end.toClosed = true;
      continue;
    }
    if (!r.whole && intervals.some((q) => q.from < r.from && r.from < q.to)) continue;
    const same = points.findIndex((q) => (q.whole && r.whole ? q.allowedText === r.allowedText : !q.whole && !r.whole && near(q.from, r.from)));
    if (same === -1) points.push(r);
    else if (r.allowedText) points[same] = r;
  }
  return [...intervals, ...points];
}

function detectConstantDifference(evalReal) {
  let values = CONSTANT_PROBE_POINTS.map(evalReal).filter(Number.isFinite);
  // A restricted domain (sqrt, ln) can leave too few of the fixed probes
  // defined. Before giving up, probe a denser sweep so an identity that
  // holds on, say, x ≥ 2 is still recognised as constant where it exists —
  // otherwise the scan below reports five grid points as "solutions".
  if (values.length < 5) {
    values = [];
    for (let x = -50; x <= 50; x += 0.37) {
      const v = evalReal(x);
      if (Number.isFinite(v)) values.push(v);
    }
    if (values.length < 5) return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > 1e-9 * (1 + Math.abs(max))) return null;
  return (min + max) / 2;
}

// Bisection on the sign alone, to the width floating point allows. It used
// to stop once |f| < 10^(−6), which at a flat root is far from the root:
// tan(x) = sin(x) has a triple root at 2π, where |f| ≈ (x − 2π)³/2, and was
// answered x ≈ 6.2813 (1.67.2).
function refineRoot(expression, variable, a, b) {
  let left = a;
  let right = b;
  for (let i = 0; i < 200 && right - left > 1e-15 * (1 + Math.abs(left)); i++) {
    const mid = (left + right) / 2;
    let value;
    let leftValue;
    try {
      value = math.evaluate(expression, { [variable]: mid });
      leftValue = math.evaluate(expression, { [variable]: left });
    } catch {
      return null;
    }
    // A Complex or non-finite value means the bracket left the real domain —
    // bisecting on NaN comparisons would converge to a meaningless endpoint.
    if (typeof value !== 'number' || typeof leftValue !== 'number') return null;
    if (!Number.isFinite(value) || !Number.isFinite(leftValue)) return null;
    if (value === 0) return mid;
    if (Math.sign(leftValue) === Math.sign(value)) left = mid;
    else right = mid;
  }
  return (left + right) / 2;
}

// The method a student would use by hand for this shape, or that there is
// none: said beside a numeric answer, so the search is not taken for the
// lesson (1.75.0).
function handMethod(equation, v) {
  const t = String(equation);
  const x = `(?<![a-z])${v}(?![a-z(])`;
  const transcendental = /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|ln|log|exp)\(|e\s*\^|\d\s*\^\s*\(?[^)]*[a-z]/i.test(t);
  // x itself outside every function and power, beside a function of x.
  const bare = t.replace(/(?<![a-z])[a-z]+\((?:[^()]|\([^()]*\))*\)/gi, '').replace(/\^\s*\((?:[^()]|\([^()]*\))*\)/g, '').replace(/\^\s*[a-z0-9]+/gi, '');
  if (transcendental && new RegExp(x).test(bare)) {
    return `By hand: an equation that mixes ${mark(v)} itself with an exponential, a logarithm or a trig function of ${mark(v)} has no general algebraic method. A root that is a simple number can still be spotted and checked exactly (shown with ${mark('=')}); the others are located numerically, by graphing or Newton's method (shown with ${mark('≈')}).`;
  }
  if (/(?<![a-z])abs\(/.test(t)) return 'By hand: split each absolute value into cases, where its inside is positive and where it is negative, and solve each case.';
  if (/(?<![a-z])sqrt\(|\^\s*\(\s*1\s*\/\s*2\s*\)/.test(t)) return 'By hand: isolate a square root, square both sides, and check every answer in the original equation (squaring can add false ones).';
  if (/(?<![a-z])(?:ln|log)\(/.test(t)) return 'By hand: combine the logarithms into one, rewrite it in exponential form, and check that every logarithm is defined at the answer.';
  if (transcendental) return 'By hand: isolate the exponential or trig function, then undo it (take logarithms, or use the inverse function and every period).';
  return null;
}
