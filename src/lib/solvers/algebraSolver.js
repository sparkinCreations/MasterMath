import mathsteps from 'mathsteps';
import { isEquation, extractVariable } from '../mathParser.js';
import { stepsFromMathstepsResult } from '../mathstepsUtils.js';
import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
  expressionsNumericallyEqual,
} from './solverUtils.js';

const TIPS = [
  'Combine like terms by adding or subtracting their coefficients.',
  'Keep the equation balanced: whatever you do to one side, do to the other.',
  'Look for common factors, and check your answer by substituting it back in.',
];

const COMMON_MISTAKES = [
  'Forgetting to distribute a factor across every term in the parentheses.',
  'Combining unlike terms (e.g., adding x and x²).',
  'Sign errors when moving a term across the equals sign.',
];

export async function solveAlgebra(expression, options = {}) {
  try {
    // Systems of equations aren't supported yet. A semicolon/newline separator
    // or two '=' signs means multiple equations; refuse clearly rather than
    // mangling them into one expression and returning an unrelated number.
    const equalsCount = (expression.match(/(?<![><!=])=(?!=)/g) || []).length;
    if (/[;\n]/.test(expression) || equalsCount >= 2) {
      return {
        steps: [
          'This looks like a system of equations (more than one equation).',
          'MasterMath solves one equation at a time right now.',
          'Tip: solve each equation for a variable and substitute by hand, or enter them individually.',
        ],
        answer: 'Systems of equations are not supported yet',
        tips: ['Enter a single equation, e.g., 2*x + 5 = 11.'],
        common_mistakes: ['Entering two equations at once — only the first would be read.'],
        graph: null,
      };
    }

    // "factor x^2 - 9": the expression extractor strips the verb, so the
    // intent arrives separately from the API layer. Without it, factoring
    // requests fell into the simplify path — and x^2 - 9 is already "simple",
    // so the input was just echoed back.
    if (options.intent === 'factor' && !isEquation(expression)) {
      const factored = await factorExpression(expression);
      if (factored) return factored;
    }

    if (isEquation(expression)) {
      return await solveEquation(expression);
    }
    return await simplifyExpression(expression);
  } catch (error) {
    console.error('Algebra solver error:', error);
    return {
      steps: [
        `Identify the expression: ${beautify(expression)}`,
        'Apply algebraic rules to simplify',
      ],
      answer: beautify(expression),
      tips: ['Use * for multiplication (e.g., 2*x)', 'Use ^ for exponents (e.g., x^2)'],
      common_mistakes: ['Using incorrect notation', 'Missing operators'],
      graph: isEquation(expression) ? null : generateAlgebraGraph(expression),
    };
  }
}

async function solveEquation(expression) {
  const variable = extractVariable(expression);
  let steps = [];
  let answer = '';
  let solutions = [];

  // 1. mathsteps — gives the nicest linear/simple-quadratic walkthroughs.
  // Only accept it if it actually isolated the variable; mathsteps sometimes
  // stops early (e.g. x^2 = -1), which we hand off to Algebrite below.
  try {
    const parsed = stepsFromMathstepsResult(mathsteps.solveEquation(expression));
    if (parsed && parsed.steps.length > 0 && isSolved(parsed.answer, variable)) {
      const normalized = normalizeSolutionAnswer(parsed.answer, variable);
      steps = parsed.steps;
      answer = normalized.answer;
      solutions = normalized.numericSolutions;
      // mathsteps can hand back a raw roots array on the last step; make the
      // final line a clean, readable statement of the solution.
      if (normalized.rewritten) {
        steps = [...steps, `Solution: ${answer}`];
      }
    }
  } catch (e) {
    // fall through to Algebrite
  }

  // 2. Algebrite roots — exact solutions (integers, fractions, radicals, complex)
  // for anything mathsteps could not finish, e.g. x^2 = 9.
  if (!answer) {
    const viaAlgebrite = await solveWithAlgebriteRoots(expression, variable);
    if (viaAlgebrite) {
      ({ steps, answer, solutions } = viaAlgebrite);
    }
  }

  // 3. Numeric root-finding — last resort.
  if (!answer) {
    const numeric = solveNumerically(expression, variable);
    steps = numeric.steps;
    answer = numeric.answer;
    solutions = numeric.solutions;
  }

  return {
    steps: steps.length > 0 ? steps : [`Solve ${beautify(expression)}`, `Result: ${answer}`],
    answer,
    tips: TIPS,
    common_mistakes: COMMON_MISTAKES,
    graph: solutions.length > 0 ? generateEquationGraph(expression, solutions) : null,
  };
}

async function solveWithAlgebriteRoots(equation, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const [left, right] = equation.split('=');
    if (right === undefined) return null;

    // Move everything to one side: (left) - (right) = 0.
    const polynomial = `(${left.trim()}) - (${right.trim()})`;
    const rootsRaw = Algebrite.roots(polynomial, variable).toString();

    // Algebrite mangles many cubics: rather than a clean real root like x = 2
    // for x^3 - 8, it emits terms like "-2*(-1)^(1/3)", the *principal complex*
    // cube root, which is both unreadable and numerically wrong for the real
    // solution. Detect that signature and recompute the roots numerically from
    // the polynomial's coefficients, which yields clean, correct values.
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) {
      const numericRoots = rootsViaPolynomialRoot(Algebrite, polynomial, variable);
      if (numericRoots) return numericRoots;
      // polynomialRoot caps at cubics. For higher degrees (x^4 - 16), evaluate
      // each symbolic root numerically instead — mathjs handles the complex
      // arithmetic — so students see ±2, ±2i, not (-1)^(1/4) soup.
      const evaluated = rootsViaComplexEvaluate(rootsRaw, polynomial, variable);
      if (evaluated) return evaluated;
    }

    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;

    const answer = formatSolutions(roots, variable);
    const numericSolutions = roots
      .map((r) => r.numeric)
      .filter((n) => Number.isFinite(n));

    const steps = [
      `Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`,
      `Solve for ${variable} by finding the roots.`,
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: numericSolutions };
  } catch (e) {
    return null;
  }
}

/**
 * Recompute polynomial roots numerically when Algebrite's symbolic output is
 * malformed. Extracts integer/rational coefficients with Algebrite's coeff(),
 * hands them to mathjs's polynomialRoot (which returns correct real and complex
 * roots), then formats each cleanly: real roots as numbers, complex roots as
 * "a + bi", with floating-point noise snapped away.
 */
function rootsViaPolynomialRoot(Algebrite, polynomial, variable) {
  try {
    // Algebrite's degree() is unreliable in this build (returns unevaluated),
    // so find the degree by scanning coefficients from high order down to the
    // first nonzero one. coeff() is dependable.
    const MAX_DEGREE = 6;
    let degree = -1;
    const rawCoeffs = [];
    for (let n = MAX_DEGREE; n >= 0; n -= 1) {
      const cRaw = String(Algebrite.run(`coeff(${polynomial}, ${variable}, ${n})`)).trim();
      rawCoeffs[n] = cRaw;
      if (degree === -1 && cRaw !== '0' && cRaw !== '') degree = n;
    }
    if (degree < 1) return null;

    const coeffs = [];
    for (let n = 0; n <= degree; n += 1) {
      const c = math.evaluate(rawCoeffs[n]);
      const num = typeof c === 'number' ? c : Number(c);
      if (!Number.isFinite(num)) return null;
      coeffs.push(num);
    }

    // mathjs wants coefficients low-order first: polynomialRoot(c0, c1, ..., cN).
    const rawRoots = math.polynomialRoot(...coeffs);
    if (!Array.isArray(rawRoots) || rawRoots.length === 0) return null;

    const roots = rawRoots.map(formatComplexRoot);

    // Present real roots first, each group ascending, for a stable readable order.
    roots.sort((a, b) => {
      if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
      return a.numeric - b.numeric || a.im - b.im;
    });

    const answer = roots.map((r) => `${variable} = ${r.display}`).join('  or  ');
    const numericSolutions = roots.filter((r) => r.isReal).map((r) => r.numeric);

    const steps = [
      `Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`,
      `This is a degree-${degree} polynomial; find all ${degree} roots.`,
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: numericSolutions };
  } catch {
    return null;
  }
}

/**
 * Clean up mangled symbolic roots beyond polynomialRoot's cubic ceiling by
 * evaluating each root expression numerically (mathjs handles the complex
 * arithmetic: (-1)^(1/4) → 0.7071 + 0.7071i). Every root must back-substitute
 * into the polynomial with a tiny residual, or the whole cleanup is rejected
 * and the caller falls through — never a prettier-but-unverified answer.
 */
function rootsViaComplexEvaluate(rootsRaw, polynomial, variable) {
  try {
    const parts = splitRootsList(rootsRaw);
    if (parts.length === 0) return null;

    const roots = [];
    for (const part of parts) {
      let value;
      try {
        value = math.evaluate(part.trim());
      } catch {
        return null;
      }
      const isComplex = value && typeof value === 'object' && Number.isFinite(value.re);
      if (typeof value !== 'number' && !isComplex) return null;

      const residual = math.abs(math.evaluate(polynomial, { [variable]: value }));
      if (!(residual < 1e-6)) return null;

      roots.push(formatComplexRoot(typeof value === 'number' ? value : { re: value.re, im: value.im }));
    }

    roots.sort((a, b) => {
      if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
      return a.numeric - b.numeric || a.im - b.im;
    });

    const answer = roots.map((r) => `${variable} = ${r.display}`).join('  or  ');
    const steps = [
      `Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`,
      `Find all ${roots.length} roots and verify each by substituting it back.`,
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: roots.filter((r) => r.isReal).map((r) => r.numeric) };
  } catch {
    return null;
  }
}

// Snap a number to the nearest integer when within rounding noise, else round
// to 4 decimals. Keeps 2.0000000004 -> 2 and 1.7320508 -> 1.7321.
function cleanNumber(n) {
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return rounded;
  return parseFloat(n.toFixed(4));
}

// Format a mathjs root (number or {re, im} Complex) as a display string plus
// metadata, treating a negligible imaginary part as a real root.
function formatComplexRoot(root) {
  const re = typeof root === 'number' ? root : (root.re ?? 0);
  const im = typeof root === 'number' ? 0 : (root.im ?? 0);

  const cleanRe = cleanNumber(re);
  const cleanIm = cleanNumber(im);

  if (Math.abs(cleanIm) < 1e-9) {
    return { display: formatNumber(cleanRe), numeric: cleanRe, im: 0, isReal: true };
  }

  const sign = cleanIm < 0 ? '-' : '+';
  const absIm = Math.abs(cleanIm);
  const imPart = absIm === 1 ? 'i' : `${formatNumber(absIm)}i`;
  const rePart = cleanRe === 0 ? '' : `${formatNumber(cleanRe)} `;
  const display = rePart
    ? `${rePart}${sign} ${imPart}`
    : `${cleanIm < 0 ? '-' : ''}${imPart}`;

  return { display, numeric: cleanRe, im: cleanIm, isReal: false };
}


// Split an Algebrite roots list ("[a, b, c]") into its entries, respecting
// commas inside parentheses.
function splitRootsList(raw) {
  const trimmed = String(raw).trim().replace(/^\[|\]$/g, '');
  if (!trimmed) return [];

  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of trimmed) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function parseRootsList(raw) {
  return splitRootsList(raw).map((part) => {
    const display = beautify(part.trim());
    let numeric = NaN;
    try {
      const value = math.evaluate(part.trim());
      numeric = typeof value === 'number' ? value : NaN;
    } catch {
      numeric = NaN;
    }
    return { display, numeric };
  });
}

/**
 * True when an answer has actually isolated the variable: the left side is the
 * bare variable and the right side no longer contains it. A raw roots array
 * ("x = [2, 3]") also counts as solved.
 */
function isSolved(answer, variable) {
  if (!answer) return false;
  const eqIndex = answer.indexOf('=');
  if (eqIndex === -1) return false;
  const lhs = answer.slice(0, eqIndex).trim();
  const rhs = answer.slice(eqIndex + 1).trim();
  if (lhs !== variable) return false;
  return !new RegExp(`\\b${variable}\\b`, 'i').test(rhs);
}

/**
 * Detect a raw roots array in a mathsteps answer ("x = [2, 3]") and rewrite it
 * as a readable "x = 2 or x = 3". Returns numeric solutions for graphing.
 */
function normalizeSolutionAnswer(answer, variable) {
  const bracket = answer.match(/\[([^\]]*)\]/);
  if (bracket) {
    const roots = parseRootsList(`[${bracket[1]}]`);
    if (roots.length > 0) {
      return {
        answer: formatSolutions(roots, variable),
        numericSolutions: roots.map((r) => r.numeric).filter((n) => Number.isFinite(n)),
        rewritten: true,
      };
    }
  }

  const cleaned = beautify(answer);
  const numericSolutions = extractNumbers(cleaned);
  return { answer: cleaned, numericSolutions, rewritten: cleaned !== answer };
}

function formatSolutions(roots, variable) {
  const displays = roots.map((r) => {
    // A plain integer/decimal root: show the clean numeric form.
    // Anything symbolic (radicals like 2^(1/2), complex like i) is kept exact.
    if (/^-?\d+(?:\.\d+)?$/.test(r.display)) {
      return formatNumber(r.numeric);
    }
    return r.display;
  });
  return displays.map((d) => `${variable} = ${d}`).join('  or  ');
}

function extractNumbers(str) {
  const matches = String(str).match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number).filter((n) => !Number.isNaN(n)) : [];
}

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
function solveNumerically(equation, variable) {
  const [left, right = '0'] = equation.split('=');
  const expression = right.trim() === '0' ? left.trim() : `(${left.trim()}) - (${right.trim()})`;

  // Real-valued evaluation: Complex results (sqrt of a negative) count as
  // "not defined here", exactly like a thrown evaluation error.
  const evalReal = (x) => {
    try {
      const v = math.evaluate(expression, { [variable]: x });
      return typeof v === 'number' ? v : NaN;
    } catch {
      return NaN;
    }
  };

  const constant = detectConstantDifference(evalReal);
  if (constant !== null) {
    if (Math.abs(constant) < 1e-9) {
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
  let prev = null;
  let prevX = null;
  for (let x = -100; x <= 100; x += 0.5) {
    const value = evalReal(x);
    if (Number.isNaN(value)) {
      prev = null;
      continue;
    }
    if (prev !== null && Math.sign(prev) !== Math.sign(value) && prev !== 0 && value !== 0) {
      const root = refineRoot(expression, variable, prevX, x);
      if (root !== null && !seen(root)) roots.push(root);
    }
    if (Math.abs(value) < 1e-3 && !seen(x)) roots.push(x);
    prev = value;
    prevX = x;
  }

  // Back-substitution gate: a candidate only counts if it actually satisfies
  // the equation. This is what turns a scanner bug into "no answer" instead
  // of a wrong answer.
  const verified = roots.filter((r) => {
    const residual = evalReal(r);
    return Number.isFinite(residual) && Math.abs(residual) <= 1e-3;
  });

  if (verified.length === 0) {
    return {
      steps: [
        `Rewrite as ${beautify(expression)} = 0`,
        `No real value of ${variable} in the searched range (-100 to 100) satisfies the equation.`,
      ],
      answer: 'No real solution found',
      solutions: [],
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
  const answer = solutions.map((s) => `${variable} = ${formatNumber(s)}`).join('  or  ');
  steps.push(`Solution: ${answer}`);

  return { steps, answer, solutions };
}

// Probe the rewritten expression at spread-out points. If it is defined at
// most of them and takes the same value everywhere, the equation's two sides
// differ by a constant. Returns that constant, or null when not constant.
const CONSTANT_PROBE_POINTS = [-9.7, -4.3, -1.1, 0.6, 2.9, 7.4, 23.7];

function detectConstantDifference(evalReal) {
  const values = CONSTANT_PROBE_POINTS.map(evalReal).filter(Number.isFinite);
  if (values.length < 5) return null;
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

// Factor an expression over the integers with Algebrite. The result is only
// claimed after two independent checks: a numeric equivalence sweep and a
// symbolic re-expansion (which doubles as the "check your work" step). If
// anything fails, return null so the caller falls back to the simplify path.
async function factorExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = extractVariable(expression);
    const factored = String(Algebrite.run(`factor(${expression})`)).trim();
    if (!factored || /nil|error|stop/i.test(factored)) return null;
    if (!expressionsNumericallyEqual(expression, factored, variable)) return null;

    const changed = factored.replace(/[\s*]/g, '') !== String(expression).replace(/[\s*]/g, '');

    const tips = [
      'Always pull out the greatest common factor first.',
      'a² − b² = (a − b)(a + b) — the difference-of-squares pattern.',
      'Check a factorization by expanding it back out.',
    ];
    const commonMistakes = [
      'Stopping before the expression is fully factored.',
      'Sign errors inside the factors — expand to verify.',
      'Treating a sum of squares like a difference: a² + b² does not factor over the reals.',
    ];

    if (!changed) {
      return {
        steps: [
          `Factor the expression: ${beautify(expression)}`,
          'No factorization over the integers exists — the expression is already fully factored.',
        ],
        answer: `${beautify(expression)} (no simpler factors over the integers)`,
        tips,
        common_mistakes: commonMistakes,
        graph: generateAlgebraGraph(expression),
      };
    }

    const display = formatFactoredForm(factored);
    const steps = [`Factor the expression: ${beautify(expression)}`];

    const squares = diffOfSquares(expression);
    if (squares) {
      steps.push(`Recognize a difference of squares: ${squares}`);
    } else {
      steps.push('Pull out common factors and match factoring patterns (difference of squares, trinomials).');
    }
    steps.push(`Factored form: ${display}`);

    // Genuinely recompute the expansion for the verification step.
    try {
      const expanded = String(Algebrite.run(`expand(${factored})`)).trim();
      if (expanded && !/nil|error|stop/i.test(expanded)) {
        steps.push(`Check by expanding: ${display} = ${beautify(expanded)}.`);
      }
    } catch {
      // The check step is optional; the numeric gate above already passed.
    }

    return {
      steps,
      answer: display,
      tips,
      common_mistakes: commonMistakes,
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

// Drop the explicit '*' between factors for display: (x-3)*(x+3) reads as
// (x - 3)(x + 3). beautify() already handles digit coefficients like 2*(…).
function formatFactoredForm(factored) {
  return beautify(factored).replace(/([a-z0-9)])\s*\*\s*\(/gi, '$1(');
}

// Textbook narration for the x^2 - N (perfect square N) shape.
function diffOfSquares(expression) {
  const m = String(expression).replace(/\s+/g, '').match(/^([a-z])\^2-(\d+)$/i);
  if (!m) return null;
  const n = Number(m[2]);
  const root = Math.round(Math.sqrt(n));
  if (root * root !== n) return null;
  const v = m[1];
  return `${v}² − ${n} = ${v}² − ${root}², so it factors as (${v} − ${root})(${v} + ${root}).`;
}

async function simplifyExpression(expression) {
  // Exact-radical rung: a constant expression containing a radical should
  // answer in exact simplified form (sqrt(50) → 5√2), not a decimal.
  const exact = await exactRadicalForm(expression);
  if (exact) return exact;

  const variable = extractVariable(expression);
  const inputLen = complexity(expression);

  // Gather candidate simplifications and keep only those that are genuinely
  // equal to the input. mathsteps carries nice steps but sometimes "simplifies"
  // (x^2-9)/(x+3) into the LONGER split form x^2/(x+3) - 9/(x+3); Algebrite
  // cancels it to x-3. We pick the SHORTEST verified-equivalent candidate, so a
  // result is never longer than what the student typed.
  let mathstepsResult = null;
  try {
    const parsed = stepsFromMathstepsResult(mathsteps.simplifyExpression(expression));
    if (parsed && parsed.steps.length > 0 && parsed.answer) {
      mathstepsResult = { answer: beautify(parsed.answer), steps: parsed.steps };
    }
  } catch {
    // fall through
  }

  const candidates = [];
  if (mathstepsResult && equivalentOrConstant(expression, mathstepsResult.answer, variable)) {
    candidates.push({ source: 'mathsteps', answer: mathstepsResult.answer });
  }
  const algebrite = await algebriteSimplify(expression, variable);
  if (algebrite) candidates.push({ source: 'algebrite', answer: algebrite });
  try {
    const mjs = beautify(math.simplify(expression).toString());
    if (mjs && equivalentOrConstant(expression, mjs, variable)) {
      candidates.push({ source: 'mathjs', answer: mjs });
    }
  } catch {
    // fall through
  }

  // Best = shortest; on a tie prefer mathsteps for its worked steps.
  candidates.sort((a, b) => {
    const d = complexity(a.answer) - complexity(b.answer);
    if (d !== 0) return d;
    return (a.source === 'mathsteps' ? -1 : 0) - (b.source === 'mathsteps' ? -1 : 0);
  });
  const best = candidates[0];

  let steps;
  let answer;
  if (best && complexity(best.answer) < inputLen) {
    // A real simplification. Keep mathsteps' steps only when they actually lead
    // to the chosen (best) form; otherwise present a clean three-line derivation.
    answer = best.answer;
    if (best.source === 'mathsteps' && mathstepsResult) {
      steps = mathstepsResult.steps;
    } else {
      steps = [
        `Original expression: ${beautify(expression)}`,
        /\//.test(expression)
          ? 'Factor and cancel the common factor(s).'
          : 'Combine like terms and simplify.',
        `Simplified form: ${answer}`,
      ];
    }
  } else {
    answer = beautify(expression);
    steps = [`The expression ${beautify(expression)} is already in simplest form.`];
  }

  return {
    steps,
    answer,
    tips: TIPS,
    common_mistakes: COMMON_MISTAKES,
    graph: generateAlgebraGraph(expression),
  };
}

// Normalized size of an expression for "is this actually simpler?" comparisons.
// Strips spaces and explicit '*' so 2*(x+2) and 2(x+2) compare equal.
function complexity(expr) {
  return String(expr).replace(/[\s*]/g, '').length;
}

// Algebrite simplify, beautified, or null if it errors / doesn't change / no
// longer matches the input numerically.
async function algebriteSimplify(expression, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const out = String(Algebrite.run(`simplify(${expression})`)).trim();
    if (!out || /nil|error|stop/i.test(out)) return null;
    const pretty = beautify(out);
    if (!equivalentOrConstant(expression, pretty, variable)) return null;
    return pretty;
  } catch {
    return null;
  }
}

// expressionsNumericallyEqual, but tolerant of constant (variable-free)
// expressions, where the sampler has nothing to vary.
function equivalentOrConstant(a, b, variable) {
  if (expressionsNumericallyEqual(a, b, variable)) return true;
  try {
    const va = Number(math.evaluate(String(a)));
    const vb = Number(math.evaluate(String(b)));
    return Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-9 * (1 + Math.abs(va));
  } catch {
    return false;
  }
}

const RADICAL_TIPS = [
  'Factor out the largest perfect square: √50 = √25 · √2 = 5√2.',
  'A radical is in simplest form when nothing under it has a square factor left.',
  '√(a·b) = √a · √b, but √(a + b) is NOT √a + √b.',
];

const RADICAL_MISTAKES = [
  'Splitting a radical across addition: √(a + b) ≠ √a + √b.',
  'Missing the largest square factor (√72 = 6√2, not 2√18).',
  'Stopping at a decimal when the exact simplified radical was the point.',
];

// Constant expressions with radicals should simplify exactly: sqrt(50) → 5√2,
// not 7.0711. Pure sqrt(N) gets the textbook perfect-square walkthrough in
// plain JS; other constant radical expressions go through Algebrite simplify,
// verified numerically before being claimed. Returns null when the input has
// a variable or no radical, so the regular simplify path runs instead.
async function exactRadicalForm(expression) {
  const expr = String(expression).trim();
  if (!/sqrt|√|\^\(1\/\d+\)/.test(expr)) return null;

  // Constant check: no letters may remain once function/constant names go.
  const residue = expr
    .replace(/\b(?:sqrt|abs|sin|cos|tan|sec|csc|cot|ln|log|exp|pi)\b/gi, '')
    .replace(/\be\b/gi, '');
  if (/[a-z]/i.test(residue)) return null;

  let decimal;
  try {
    decimal = Number(math.evaluate(expr));
  } catch {
    return null;
  }
  if (!Number.isFinite(decimal)) return null;

  // Pure sqrt(N): factor out the largest perfect square by hand.
  const pure = expr.replace(/\s+/g, '').match(/^sqrt\((\d+)\)$/);
  if (pure) {
    const n = Number(pure[1]);
    let k = 1;
    for (let i = Math.floor(Math.sqrt(n)); i >= 2; i -= 1) {
      if (n % (i * i) === 0) { k = i; break; }
    }
    const m = n / (k * k);

    if (m === 1) {
      return radicalResult([
        `Simplify the radical: √${n}`,
        `${n} is a perfect square: ${k}² = ${n}.`,
        `√${n} = ${k}.`,
      ], String(k));
    }
    if (k === 1) {
      return radicalResult([
        `Simplify the radical: √${n}`,
        `${n} has no perfect-square factor larger than 1, so √${n} is already in simplest form.`,
        `Decimal value: √${n} ≈ ${formatNumber(decimal)}.`,
      ], `√${n} (≈ ${formatNumber(decimal)})`);
    }
    return radicalResult([
      `Simplify the radical: √${n}`,
      `Find the largest perfect square that divides ${n}: ${n} = ${k * k} × ${m}.`,
      `Split the radical: √${n} = √${k * k} · √${m} = ${k}√${m}.`,
      `Decimal value: ${k}√${m} ≈ ${formatNumber(decimal)}.`,
    ], `${k}√${m} (≈ ${formatNumber(decimal)})`);
  }

  // General constant radical (sqrt(8) + sqrt(2), 2*sqrt(12), …): Algebrite
  // finds the exact form; a numeric cross-check gates it before display.
  try {
    const Algebrite = await loadAlgebrite();
    const simplified = String(Algebrite.run(`simplify(${expr})`)).trim();
    if (!simplified || /nil|error|stop/i.test(simplified)) return null;

    const value = Number(math.evaluate(simplified));
    if (!Number.isFinite(value) || Math.abs(value - decimal) > 1e-9 * (1 + Math.abs(decimal))) return null;

    if (!/\^\(1\/\d+\)/.test(simplified)) {
      // Collapsed all the way to a plain number or fraction.
      const display = beautify(simplified);
      if (display.replace(/\s/g, '') === expr.replace(/\s/g, '')) return null;
      return radicalResult([
        `Simplify the radical expression: ${beautify(expr)}`,
        `The radicals combine exactly: ${display}.`,
      ], display);
    }

    const exact = prettifyRadicals(simplified);
    return radicalResult([
      `Simplify the radical expression: ${beautify(expr)}`,
      `Combine into exact simplified form: ${exact}.`,
      `Decimal value: ${exact} ≈ ${formatNumber(decimal)}.`,
    ], `${exact} (≈ ${formatNumber(decimal)})`);
  } catch {
    return null;
  }
}

function radicalResult(steps, answer) {
  return {
    steps,
    answer,
    tips: RADICAL_TIPS,
    common_mistakes: RADICAL_MISTAKES,
    graph: null, // a constant has no curve worth drawing
  };
}

// Algebrite writes radicals as fractional powers: 5*2^(1/2). Convert to the
// familiar 5√2 for display (value untouched — presentation only).
function prettifyRadicals(s) {
  let out = String(s)
    .replace(/(\d+)\^\(1\/2\)/g, '√$1')
    .replace(/(\d+)\^\(1\/3\)/g, '∛$1');
  out = beautify(out);
  return out.replace(/(\d+)\s*\*\s*([√∛])/g, '$1$2');
}

function generateAlgebraGraph(expression) {
  try {
    if (isEquation(expression)) return null;
    const variable = extractVariable(expression);
    const points = sampleFunction(expression, variable);

    if (points.length > 0) {
      return {
        points,
        title: `Graph of ${beautify(expression)}`,
        description: 'Visual representation of the expression',
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }
  return null;
}

function generateEquationGraph(equation, solutions) {
  try {
    const [left, right = '0'] = equation.split('=');
    const variable = extractVariable(equation);
    const points = sampleFunction(left.trim(), variable);
    if (points.length === 0) return null;

    const solutionText =
      solutions.length === 1
        ? `Solution at ${variable} = ${formatNumber(solutions[0])}`
        : `Solutions at ${variable} = ${solutions.map((s) => formatNumber(s)).join(', ')}`;

    return {
      points,
      solutions,
      title: `Graph of ${beautify(left.trim())}`,
      description: `${solutionText} (where the curve crosses y = ${beautify(right.trim())})`,
    };
  } catch (error) {
    console.error('Equation graph generation error:', error);
    return null;
  }
}
