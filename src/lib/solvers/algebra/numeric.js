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
} from '../solverUtils.js';

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
      const restrictions = domainRestrictionsOf([left, right], variable);
      // tan, sec, cot, csc and divisions by sin or cos are undefined on a
      // lattice of points the grid never lands on exactly (tan(π/2) is a
      // huge finite number in floating point), so read those off the
      // structure: tan(x) = sin(x)/cos(x) holds except at x = π/2 + nπ.
      const poles = trigUndefinedPoints(`${left} = ${right}`, variable);
      if (restrictions.length === 0 && poles.length > 0) {
        const where = [...new Set(poles.map((p) => p.text))].join(' and ');
        const because = [...new Set(poles.map((p) => p.because))].join(', ');
        return {
          steps: [
            `Before simplifying, note where the original equation is defined: ${because} ${poles.length > 1 ? 'are' : 'is'} undefined at ${where} (n any integer), so those values are excluded from the start.`,
            `Rewrite as ${beautify(expression)} = 0`,
            `The ${variable} terms cancel — the two sides are identical wherever they are both defined.`,
            `This is an identity on its domain: every real number except ${where} is a solution. The excluded points are not solutions, even though the simplified form 0 = 0 would allow them.`,
          ],
          answer: `All real numbers except ${where}, n any integer (identity on its domain — ${because} ${poles.length > 1 ? 'are' : 'is'} undefined there)`,
          solutions: [],
        };
      }
      if (restrictions.length === 0) {
        return {
          steps: [
            `Rewrite as ${beautify(expression)} = 0`,
            `The ${variable} terms cancel — the two sides are identical for every value of ${variable}.`,
            'This is an identity: every real number is a solution.',
          ],
          answer: `All real numbers (identity — true for every ${variable})`,
          solutions: [],
        };
      }
      const undefinedFor = restrictions.map((r) => formatRestriction(r, variable)).join(' and for ');
      const allowed = restrictions.map((r) => formatRestriction(r, variable, { allowed: true })).join(' and ');
      return {
        steps: [
          `Before simplifying, note where the original equation is defined: it is undefined for ${undefinedFor}.`,
          `Rewrite as ${beautify(expression)} = 0`,
          `The ${variable} terms cancel — the two sides are identical wherever they are both defined.`,
          `This is an identity on its domain: every real number with ${allowed} is a solution. Values where the original expression is undefined are not solutions, even though the simplified form 0 = 0 would allow them.`,
        ],
        answer: `All real numbers with ${allowed} (identity on its domain)`,
        solutions: [],
      };
    }
    return {
      steps: [
        `Rewrite as ${beautify(expression)} = 0`,
        `The ${variable} terms cancel — the difference between the sides is always ${formatNumber(constant)}, never 0.`,
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
  if (verified.length === 0) {
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
  const solutions = verified
    .sort((a, b) => Math.abs(a) - Math.abs(b))
    .slice(0, 5)
    .sort((a, b) => a - b);

  const steps = [
    `Rewrite as ${beautify(expression)} = 0`,
    'Search for values where the expression crosses zero, then verify each candidate by substituting it back.',
  ];
  if (verified.length > solutions.length) {
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
  const answer = solutions.map((s) => `${variable} ${exactAt(formatNumber(s)) ? '=' : '≈'} ${formatNumber(s)}`).join('  or  ');
  steps.push(`Solution: ${answer}`);

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
function domainRestrictionsOf(sides, variable) {
  const regions = [];
  for (const side of sides) {
    for (const r of findUndefinedRegions(side.trim(), variable)) {
      // Same edge means equal infinities or values within tolerance —
      // (-∞) − (-∞) is NaN, so a plain difference test would never dedupe.
      const sameEdge = (a, b) => a === b || Math.abs(a - b) < 1e-6;
      const dup = regions.some((q) => sameEdge(q.from, r.from) && sameEdge(q.to, r.to));
      if (!dup) regions.push(r);
    }
  }
  return regions.sort((a, b) => (a.from ?? -Infinity) - (b.from ?? -Infinity));
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

function refineRoot(expression, variable, a, b) {
  let left = a;
  let right = b;
  for (let i = 0; i < 40; i++) {
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
    if (Math.abs(value) < 1e-6) return mid;
    if (Math.sign(leftValue) === Math.sign(value)) left = mid;
    else right = mid;
  }
  return (left + right) / 2;
}
