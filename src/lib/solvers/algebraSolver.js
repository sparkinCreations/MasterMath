import mathsteps from 'mathsteps';
import { isEquation, extractVariable } from '../mathParser.js';
import { stepsFromMathstepsResult } from '../mathstepsUtils.js';
import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
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

export async function solveAlgebra(expression) {
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

    if (isEquation(expression)) {
      return await solveEquation(expression);
    }
    return simplifyExpression(expression);
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


function parseRootsList(raw) {
  const trimmed = String(raw).trim().replace(/^\[|\]$/g, '');
  if (!trimmed) return [];

  // Split on commas that are not inside parentheses.
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

  return parts.map((part) => {
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
function solveNumerically(equation, variable) {
  const [left, right = '0'] = equation.split('=');
  const expression = right.trim() === '0' ? left.trim() : `(${left.trim()}) - (${right.trim()})`;

  const roots = [];
  let prev = null;
  for (let x = -100; x <= 100; x += 0.5) {
    let value;
    try {
      value = math.evaluate(expression, { [variable]: x });
    } catch {
      prev = null;
      continue;
    }
    if (prev !== null && Math.sign(prev) !== Math.sign(value)) {
      const root = refineRoot(expression, variable, x - 0.5, x);
      if (root !== null && !roots.some((r) => Math.abs(r - root) < 0.01)) roots.push(root);
    }
    if (Math.abs(value) < 1e-3 && !roots.some((r) => Math.abs(r - x) < 0.01)) roots.push(x);
    prev = value;
  }

  const solutions = roots.slice(0, 5);
  if (solutions.length === 0) {
    return {
      steps: [`Solve ${beautify(expression)} = 0`, 'No real solution was found in the searched range.'],
      answer: 'No real solution found',
      solutions: [],
    };
  }

  const answer = solutions.map((s) => `${variable} = ${formatNumber(s)}`).join('  or  ');
  return {
    steps: [
      `Rewrite as ${beautify(expression)} = 0`,
      'Search for values where the expression crosses zero.',
      `Solution: ${answer}`,
    ],
    answer,
    solutions,
  };
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
    if (Math.abs(value) < 1e-6) return mid;
    if (Math.sign(leftValue) === Math.sign(value)) left = mid;
    else right = mid;
  }
  return (left + right) / 2;
}

function simplifyExpression(expression) {
  let steps = [];
  let answer = '';

  try {
    const parsed = stepsFromMathstepsResult(mathsteps.simplifyExpression(expression));
    if (parsed && parsed.steps.length > 0) {
      steps = parsed.steps;
      answer = beautify(parsed.answer || expression);
    }
  } catch (e) {
    // fall through
  }

  if (!answer) {
    try {
      const simplified = beautify(math.simplify(expression).toString());
      if (simplified !== beautify(expression)) {
        steps = [
          `Original expression: ${beautify(expression)}`,
          'Combine like terms and simplify.',
          `Simplified form: ${simplified}`,
        ];
      } else {
        steps = [`The expression ${beautify(expression)} is already in simplest form.`];
      }
      answer = simplified;
    } catch {
      steps = [`Expression: ${beautify(expression)}`];
      answer = beautify(expression);
    }
  }

  return {
    steps,
    answer,
    tips: TIPS,
    common_mistakes: COMMON_MISTAKES,
    graph: generateAlgebraGraph(expression),
  };
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
