import { isEquation, extractVariable, parseMathExpression, matchingParen } from '../mathParser.js';
import { solveLinearEquation } from './linearEquationSolver.js';
import { parseError, unsupported, undefinedValue } from '../solutionEnvelope.js';
import { readPolynomial, allRoots, valueAtDecimal, factorByRationalRoots, MAX_POLYNOMIAL_DEGREE } from './polynomialRoots.js';
import { getSettings } from '../settings.js';
import {
  math,
  neverZeroSide,
  loadAlgebrite,
  isAlgebriteFailure,
  beautify,
  formatNumber,
  hasVariable,
  sampleFunction,
  expressionsNumericallyEqual,
  findUndefinedRegions,
  formatRestriction,
  splitTerms,
  splitTopLevel,
  trigUndefinedPoints,
  stripMathMarkers,
  mark,
  linearCoefficients,
  stripOuterParens,
  realOddRoots,
  gcd,
  absBars,
} from './solverUtils.js';

const TIPS = [
  'Combine like terms by adding or subtracting their coefficients.',
  'Keep the equation balanced: whatever you do to one side, do to the other.',
  'Look for common factors, and check your answer by substituting it back in.',
];

// A known function name that is NOT followed by an argument list — "sin^2*x",
// "ln + 3". Always a mis-read, never mathematics a solver should act on.
const BARE_FUNCTION_NAME = /(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp)(?![a-z])\s*(?!\()/i;

const SIMPLIFY_TIPS = [
  'Distribute first, then collect like terms — terms with exactly the same variable part.',
  `Like terms combine by adding their coefficients: ${mark('3x − 6 + 4 → 3x − 2')}.`,
  'Check by substituting a value for the variable into both the original and the simplified form.',
];

// A fraction simplified by cancelling a factor: the advice is about
// factoring and cancelling, not like terms ((x^2-1)/(x-1) was told to
// distribute and collect like terms; October 2026 review).
const CANCEL_TIPS = [
  'Factor the numerator and the denominator completely, then cancel the factors they share.',
  `Cancel factors, never terms: in ${mark('(x^2 − 1)/(x − 1)')} the ${mark('x − 1')} cancels only after ${mark('x^2 − 1 = (x − 1)(x + 1)')}.`,
  `A cancelled factor still counts: the original is undefined where it is zero, so the simplified form comes with that restriction (${mark('x ≠ 1')}).`,
];

const CANCEL_MISTAKES = [
  `Cancelling a term across the fraction bar: ${mark('(x + 2)/2')} is ${mark('x/2 + 1')}, not ${mark('x + 1')}.`,
  'Dropping the restriction after cancelling: the simplified form is equal to the original only where the original is defined.',
  'Cancelling before factoring completely, and missing a factor the numerator and denominator share.',
];

const SIMPLIFY_MISTAKES = [
  `Combining unlike terms (adding ${mark('x')} and ${mark('x²')}).`,
  'Forgetting to distribute a factor across every term in the parentheses.',
  'Losing a sign when distributing a negative.',
];

// Tips and mistakes for a solved equation, chosen from the method the steps
// actually used — the same three lines about combining like terms used to
// close an absolute-value, a radical, and a logarithmic equation alike
// (September 2026 review, 1.38.1).
function equationGuidance(steps, expression) {
  const text = stripMathMarkers(steps.join('\n'));
  const variableInDenominator = /\/\s*\(?[0-9.]*[a-z]/i.test(expression);
  // The methods that used to inherit the linear list (October 2026 tips
  // audit): a fractional power undone, a root located numerically, a proof
  // that there is no solution, an identity or contradiction, an LCD.
  if (/Isolate the power|Raise both sides to the power/.test(text)) {
    return {
      tips: [
        `Isolate the power, then raise both sides to the reciprocal exponent: ${mark('x^(2/3) = 4')} becomes ${mark('x = ±4^(3/2)')}.`,
        `An even numerator means two solutions, ${mark('±')}: ${mark('x^(2/3) = (∛x)²')} is the same for ${mark('x')} and ${mark('−x')}. An odd numerator gives one.`,
        `An even root is never negative: ${mark('x^(2/3) = −4')} has no real solution before any algebra; an odd root of a negative number is real (${mark('∛(−8) = −2')}).`,
      ],
      common_mistakes: [
        `Taking only the positive solution when the numerator of the exponent is even.`,
        `Raising to the wrong power: the inverse of ${mark('^(2/3)')} is ${mark('^(3/2)')}, not ${mark('^(−2/3)')}.`,
        'Skipping the check: a raised power can introduce a value that fails in the original.',
      ],
    };
  }
  // e^x + e^(−x) = 1: the substitution closed and the polynomial in u has
  // no real (or no positive) root — say why in terms of u, not of 1/x.
  if (/no real solution/i.test(text) && /Let u = (?:e|\d+(?:\.\d+)?)\^/.test(text)) {
    return {
      tips: [
        `${mark('u = a^x')} is always positive, so after the substitution only a positive root of the polynomial in ${mark('u')} gives a real ${mark('x')}; none, and the equation has no real solution.`,
        `A negative exponent is a reciprocal: ${mark('a^(−x) = 1/u')}. Multiply through by ${mark('u')} (safe, since ${mark('u > 0')}) and the equation is a polynomial in ${mark('u')}.`,
        `A negative discriminant settles it: no real ${mark('u')} means no real ${mark('x')}, however far a search looks. (${mark('e^x + e^(−x)')} is never below ${mark('2')}, so it cannot equal ${mark('1')}.)`,
      ],
      common_mistakes: [
        `Keeping a negative or complex ${mark('u')} and "solving" ${mark('a^x = u')} anyway: there is no logarithm of a negative number.`,
        `Writing ${mark('e^(−x)')} as ${mark('−e^x')} or ${mark('−u')} instead of ${mark('1/u')}.`,
        `Forgetting to multiply every term by ${mark('u')}, the constant included.`,
      ],
    };
  }
  if (/no real solution/i.test(text) && !/Isolate the radical/.test(text) && !(variableInDenominator && /Multiply both sides|extraneous|denominator/i.test(text))) {
    return {
      tips: [
        `An equation has no solution when one side can never take the other's value: ${mark('1/x')} is never ${mark('0')}, ${mark('e^x')} is always positive, an even power or root is never negative.`,
        'Say why: name the value the expression cannot reach, or the contradiction left after the algebra — that is the answer.',
        '"No real solution" is a result, not a failure: the check is that no number could satisfy the equation, not that none was found.',
      ],
      common_mistakes: [
        `Writing ${mark('x = 0')} for ${mark('1/x = 0')} because the fraction gets small — it never reaches ${mark('0')}.`,
        `Taking a logarithm of a negative number to "solve" ${mark('e^x = −2')}: there is no such logarithm.`,
        'Keeping a candidate that makes a denominator zero.',
      ],
    };
  }
  if (/crosses zero, then verify|located numerically|numeric search/.test(text)) {
    return {
      tips: [
        `When the unknown sits both inside and outside a function (${mark('x·e^x = 1')}), no algebraic step isolates it; the root is located where the two sides cross and narrowed down.`,
        `${mark('≈')} means the root is known to the decimals shown, not exactly; substitute it back and the two sides agree to those decimals.`,
        'Sketch both sides: each crossing is a solution, and the picture says how many to expect.',
      ],
      common_mistakes: [
        'Treating a located root as exact — its next digits are not zeros.',
        `Taking logarithms to isolate ${mark('x')}: ${mark('ln(x·e^x)')} is ${mark('ln x + x')}, which still has ${mark('x')} in two places.`,
        'Stopping at one root when the graphs cross more than once.',
      ],
    };
  }
  if (/terms cancel/.test(text)) {
    const identity = /identity/.test(text);
    return {
      tips: [
        `When the variable terms cancel, what is left is about the constants alone: ${mark('5x − 7 = 5x + 2')} leaves ${mark('−7 = 2')}, false, so no solution; ${mark('2(x + 3) = 2x + 6')} leaves ${mark('6 = 6')}, true for every ${mark('x')}.`,
        identity
          ? 'An identity holds for every real number — the two sides are the same expression written differently.'
          : 'A contradiction has no solution — the two sides differ by a fixed amount whatever x is.',
        `Check with any value: substitute ${mark('x = 0')} and ${mark('x = 1')} — an identity holds both times, a contradiction fails both times.`,
      ],
      common_mistakes: [
        `Dividing by ${mark('0')} (the coefficient left after the terms cancel) and reporting a number.`,
        identity
          ? `Writing ${mark('x = 0')} for an identity: every number works, not just ${mark('0')}.`
          : `Writing ${mark('x = 0')} or ${mark('0 = 0')} for a contradiction: there is no solution at all.`,
      ],
    };
  }
  if (/least common denominator/.test(text)) {
    return {
      tips: [
        'Clear the fractions first: multiply every term on both sides by the least common denominator, then solve the whole-number equation that remains.',
        `Every term is multiplied, including the ones that are not fractions: ${mark('x/3 + 1/2 = 5/6')} times ${mark('6')} is ${mark('2x + 3 = 5')}.`,
        'Check by substituting into the original equation, fractions and all.',
      ],
      common_mistakes: [
        'Multiplying only the fractional terms by the LCD and leaving the others as they were.',
        `Using the product of the denominators when a smaller common denominator exists (${mark('6')}, not ${mark('36')}, for thirds, halves and sixths).`,
        'Adding the denominators instead of finding a common one.',
      ],
    };
  }
  if (/absolute-value equation/.test(text)) {
    return {
      tips: [
        `${mark('|A| = b')} splits into two equations, ${mark('A = b')} or ${mark('A = −b')} — two candidate solutions.`,
        `If ${mark('b < 0')} there is no solution at all (an absolute value is never negative); if ${mark('b = 0')} there is exactly one case, ${mark('A = 0')}.`,
        `Isolate the absolute value first: ${mark('2|x − 1| + 1 = 7')} becomes ${mark('|x − 1| = 3')} before the cases are written.`,
      ],
      common_mistakes: [
        'Solving only the positive case and missing the second solution.',
        `Dropping the bars as if ${mark('|A| = b')} meant ${mark('A = b')}.`,
        'Splitting into cases before the absolute value is isolated, or not checking both answers in the original.',
      ],
    };
  }
  if (/Isolate the radical/.test(text)) {
    return {
      tips: [
        'Isolate the root, then square both sides. Squaring can create extraneous solutions, so every candidate must be checked in the original.',
        `The radicand must be ${mark('≥ 0')}, and ${mark('√(…)')} itself is ${mark('≥ 0')}: ${mark('√(x + 1) = −3')} has no solution before any algebra.`,
        'If a root remains after squaring once, isolate it and square again.',
      ],
      common_mistakes: [
        `Squaring term by term: ${mark('(√x + 1)²')} is not ${mark('x + 1')}.`,
        'Keeping a candidate that fails the check in the original equation.',
        'Forgetting that the radicand cannot be negative.',
      ],
    };
  }
  if (/Let u = ln|Let u = log|ln\(a\) = u|exponential form/.test(text)) {
    return {
      tips: [
        `${mark('ln(x) = c')} means ${mark('x = e^c')}: undo a logarithm by exponentiating with its base.`,
        `Combine several logs with the log rules first (${mark('ln a + ln b = ln(ab)')}, ${mark('ln a − ln b = ln(a/b)')}), then rewrite in exponential form.`,
        'Every solution must keep every log argument positive — check each one.',
      ],
      common_mistakes: [
        `Reading ${mark('ln(x) = c')} as ${mark('x = c')}, forgetting the exponential.`,
        'Keeping a candidate that makes a log argument zero or negative.',
        `Splitting ${mark('ln(a + b)')} into ${mark('ln a + ln b')} — there is no such rule.`,
      ],
    };
  }
  if (/take the logarithm of both sides|then take logarithms|Let u = \d+\^|Let u = e\^|Let u = \w+\^/.test(text)) {
    return {
      tips: [
        `${mark('a^x = b')} is solved by taking a logarithm of both sides: ${mark('x = ln(b)/ln(a) = log_a(b)')}.`,
        'Any log base works as long as it is the same on both sides; ln is the usual choice.',
        `A polynomial in ${mark('a^x')} (${mark('e^(2x) − 3e^x + 2')}) is a quadratic in ${mark('u = a^x')} — solve for ${mark('u')} first, then for ${mark('x')}.`,
      ],
      common_mistakes: [
        `Dividing instead of taking a log: ${mark('2^x = 10')} does not give ${mark('x = 5')}.`,
        `Writing ${mark('ln(10)/ln(2)')} as ${mark('ln(10/2)')}.`,
        `Losing a solution of the quadratic in ${mark('u')}, or keeping a negative ${mark('u')} (${mark('a^x')} is always positive).`,
        ...(/clear the negative powers/.test(text) ? [`Writing ${mark('a^(−x)')} as ${mark('−u')}: a negative exponent is the reciprocal, ${mark('1/u')}.`] : []),
      ],
    };
  }
  if (variableInDenominator && /Multiply both sides|extraneous|denominator/.test(text)) {
    return {
      tips: [
        'Clear the denominators by multiplying both sides by them, then solve the polynomial equation that remains.',
        'Any value that makes a denominator zero is excluded from the start — it can never be a solution.',
        'Check every candidate in the original equation, not the cleared one.',
      ],
      common_mistakes: [
        'Multiplying only one side by the denominator.',
        'Keeping a "solution" that makes a denominator zero (an extraneous root).',
        'Cancelling a factor that could be zero.',
      ],
    };
  }
  if (/Rational Root Theorem/.test(text)) {
    // A cubic or higher solved by the rational-root test and synthetic
    // division: the advice is about that method, not about quadratics (the
    // quadratic lines used to match on the final factoring step).
    return {
      tips: [
        'Rational Root Theorem: every rational root is ±(a factor of the constant term)/(a factor of the leading coefficient) — a finite list to test, so test it before anything else.',
        `Once ${mark('p(r) = 0')}, divide by ${mark('(x − r)')}: synthetic division must leave remainder ${mark('0')}, and the quotient has degree one less. Repeat until a quadratic remains, then factor or use the formula.`,
        `A degree-${mark('n')} polynomial has at most ${mark('n')} real roots; count them (with multiplicity) and stop when the degree is used up.`,
      ],
      common_mistakes: [
        'Testing only positive candidates — the negatives are on the list too.',
        `An arithmetic slip in synthetic division: a non-zero remainder means ${mark('r')} was not a root (or the division went wrong), not that the method failed.`,
        'Stopping after one root: the quotient still has to be solved, and a root can repeat.',
      ],
    };
  }
  // Square roots, the formula, or factoring: advice for the method used, in
  // general letters, never another equation's numbers (the (x − 2)(x − 3)
  // example on x² + 1 = 0 read as advice about a different problem;
  // October 2026 test list).
  if (/Take the square root of both sides/.test(text)) {
    const complex = /√\(−1\)|\bi\b/.test(text);
    return {
      tips: [
        `${mark('x^2 = c')} is solved by square roots: ${mark('x = ±√c')} — two solutions when ${mark('c > 0')}, one when ${mark('c = 0')}.`,
        complex
          ? `When ${mark('c < 0')} there is no real solution; over the complex numbers ${mark('√(−c)·i')} and its negative are the two roots (${mark('i = √(−1)')}, ${mark('i^2 = −1')}).`
          : `Isolate ${mark('x^2')} first: move the constant across, then divide by the coefficient.`,
        'Check by substituting each root into the original equation.',
      ],
      common_mistakes: [
        `Taking only the positive square root and losing ${mark('x = −√c')}.`,
        complex
          ? `Writing ${mark('√(−1)')} as ${mark('−1')}, or stopping at "no solution" without saying it means no REAL solution.`
          : `Taking the root of each term separately: in ${mark('x^2 + 7 = 16')}, isolate ${mark('x^2')} before the root.`,
      ],
    };
  }
  if (/discriminant|quadratic formula/i.test(text) && !/sum-product|zero-product|Factor out the common|Factor using|difference of squares|perfect square/i.test(text)) {
    return {
      tips: [
        `For ${mark('ax^2 + bx + c = 0')}: ${mark('x = (−b ± √(b^2 − 4ac))/(2a)')}.`,
        `The discriminant ${mark('b^2 − 4ac')} decides the count: positive gives two real roots, zero one (repeated), negative none real (a complex pair).`,
        'Check by substituting each root into the original equation.',
      ],
      common_mistakes: [
        `Dropping the sign of ${mark('b')}: the formula starts with ${mark('−b')}.`,
        `Dividing only the square root by ${mark('2a')} instead of the whole numerator ${mark('−b ± √(b^2 − 4ac)')}.`,
      ],
    };
  }
  if (/sum-product|zero-product|Factor out the common|Set the factor to zero|discriminant|quadratic formula|Factor using|difference of squares|perfect square|Find the roots/i.test(text)) {
    return {
      tips: [
        `A quadratic has up to two solutions: factor, take square roots, or use ${mark('x = (−b ± √(b² − 4ac))/(2a)')}.`,
        `Set the equation to ${mark('0')} before factoring: ${mark('(x − a)(x − b) = 0')} gives ${mark('x = a')} or ${mark('x = b')}; ${mark('(x − a)(x − b) = k')} with ${mark('k ≠ 0')} does not.`,
        'Check by substituting each root into the original equation.',
      ],
      common_mistakes: [
        /Factor out the common/.test(text)
          ? `Dividing both sides by ${mark('x')} and losing the ${mark('x = 0')} solution.`
          : 'Stopping at the factored form without setting each factor to zero.',
        `Reading ${mark('(x − a)(x − b) = 0')} as ${mark('x = −a')} or ${mark('x = −b')}: each factor is zero at ${mark('x = a')} and ${mark('x = b')}.`,
      ],
    };
  }
  return {
    tips: [
      'Undo the operations in reverse order: add or subtract to isolate the variable term first, then multiply or divide.',
      'Whatever you do to one side, do to the other — the equation stays balanced.',
      'Check by substituting the solution into the original equation.',
    ],
    common_mistakes: [
      'Sign errors when moving a term across the equals sign.',
      'Dividing only one term by the coefficient instead of the whole side.',
      /\(/.test(expression)
        ? 'Forgetting to distribute a factor across every term in the parentheses.'
        : 'Subtracting a number from one side only — both sides change together.',
    ],
  };
}

const COMMON_MISTAKES = [
  'Forgetting to distribute a factor across every term in the parentheses.',
  `Combining unlike terms (e.g., adding ${mark('x')} and ${mark('x²')}).`,
  'Sign errors when moving a term across the equals sign.',
];

// A monic quadratic with integer coefficients that factors over the integers
// is solved the way it is taught first: factor out x when c = 0, otherwise
// list the factor pairs of c, find the pair that sums to b, check by
// expanding, and apply the zero-product property. Null when it does not
// factor that way — the caller shows the quadratic formula instead, never a
// fabricated search.
function factoringLines(B, C, v, expanded) {
  if (![B, C].every(Number.isInteger)) return null;
  const sign = (n) => (n < 0 ? `(${n})` : String(n));
  const factor = (n) => (n === 0 ? v : n < 0 ? `${v} - ${-n}` : `${v} + ${n}`);
  if (C === 0) {
    if (B === 0) return null;
    return [
      `Factor out the common ${v}: ${expanded} = 0 becomes ${v}(${factor(B)}) = 0.`,
      `Set each factor to zero: ${v} = 0 or ${factor(B)} = 0, so ${v} = 0 or ${v} = ${-B}.`,
    ];
  }
  const pairs = [];
  for (let p = 1; p * p <= Math.abs(C); p += 1) {
    if (C % p !== 0) continue;
    pairs.push([p, C / p]);
    pairs.push([-p, -C / p]);
  }
  if (pairs.length > 12) return null;
  const hit = pairs.find(([p, q]) => p + q === B);
  if (!hit) return null;
  const [p, q] = hit;
  const factored = p === q ? `(${factor(p)})^2` : `(${factor(p)})(${factor(q)})`;
  return [
    `To factor ${mark(expanded)}, look for two numbers whose product is ${mark(C)} (the constant term) and whose sum is ${mark(B)} (the coefficient of ${mark(v)}).`,
    `Factor pairs of ${mark(C)}: ${mark(pairs.map(([m, n]) => `${sign(m)}·${sign(n)}`).join(', '))}. Their sums: ${mark(pairs.map(([m, n]) => m + n).join(', '))} — the pair ${mark(p)} and ${mark(q)} sums to ${mark(B)}.`,
    `So ${mark(`${expanded} = ${factored}`)}. Check by expanding: ${mark(`${v}·${v} + ${sign(q)}${v} + ${sign(p)}${v} + ${sign(p)}·${sign(q)} = ${expanded}`)}. ✓`,
    p === q
      ? `Set the factor to zero: ${factor(p)} = 0, so ${v} = ${-p} (a repeated root).`
      : `Set each factor to zero (zero-product property): ${factor(p)} = 0 or ${factor(q)} = 0, so ${v} = ${-p} or ${v} = ${-q}.`,
  ];
}

// A division whose denominator is the constant 0 (x/0, (x + 1)/(2 − 2)):
// undefined at every point, so the equation has no solution. Returns the
// offending term as text, or null. Without this, x/0 = 1 was "beyond what
// this solver can compute".
function divisionByZeroInEquation(expression) {
  let found = null;
  try {
    const tree = math.parse(parseMathExpression(expression).replace(/(?<![<>!=])=(?!=)/, '=='));
    tree.traverse((node) => {
      if (found || node.type !== 'OperatorNode' || node.op !== '/') return;
      const denominator = node.args[1];
      if (denominator.filter((n) => n.type === 'SymbolNode' && !['pi', 'e'].includes(n.name)).length) return;
      try {
        if (math.evaluate(denominator.toString()) === 0) found = beautify(node.toString()).replace(/\s*\/\s*/g, '/');
      } catch { /* not a number: leave it to the solver */ }
    });
  } catch {
    return null;
  }
  return found;
}

export async function solveAlgebra(expression, options = {}) {
  try {
    // Two-equation systems are handled upstream (api.js routes them to the
    // systems solver from the raw text). If a multi-equation string still
    // reaches here — e.g. a stray separator the router didn't count as a
    // system — refuse clearly rather than mangling it into one expression.
    // A trailing separator ("x^2 = 4;") is a typing habit, not a second
    // equation: drop it rather than refusing a perfectly good equation.
    // (September 2026 audit row A25.)
    expression = expression.replace(/[;\n\s]+$/, '');
    const equalsCount = (expression.match(/(?<![><!=])=(?!=)/g) || []).length;
    if (/[;\n]/.test(expression) || equalsCount >= 2) {
      // A refusal must carry a refusal status. This used to be a bare object,
      // which finalizeResult's legacy shim stamped "solved".
      return parseError({
        input: expression,
        hint: 'This looks like more than one equation.',
        steps: [
          'This looks like more than one equation.',
          'For a 2×2 system, use two equations separated by a semicolon, e.g. 2x + 3y = 6; x − y = 4.',
          'For a single equation, enter just one, e.g. 2x + 5 = 11.',
        ],
        answer: 'Please enter either one equation, or a 2×2 system as "eq1; eq2"',
        tips: ['A 2×2 system needs exactly two equations in two variables.'],
        common_mistakes: ['A stray semicolon or extra “=” in a single-equation entry.'],
      });
    }

    // "factor x^2 - 9": the expression extractor strips the verb, so the
    // intent arrives separately from the API layer. Without it, factoring
    // requests fell into the simplify path — and x^2 - 9 is already "simple",
    // so the input was just echoed back.
    if (options.intent === 'factor' && !isEquation(expression)) {
      const factored = await factorExpression(expression);
      if (factored) return factored;
    }
    if (options.intent === 'expand' && !isEquation(expression)) {
      const expanded = await expandExpression(expression);
      if (expanded) return expanded;
    }

    if (isEquation(expression)) {
      const zero = divisionByZeroInEquation(expression);
      if (zero) {
        // Undefined, as 1/0 is: the equation is not false at some x, it
        // has no meaning at any.
        const result = undefinedValue({
          input: expression,
          steps: [
            `Solve the equation: ${mark(beautify(expression).replace(/\s*=\s*/, ' = '))}`,
            `The term ${mark(zero)} divides by ${mark('0')}, and division by zero is undefined for every value of the variable.`,
            'An equation with an undefined side cannot be true, so no value satisfies it.',
          ],
          tips: [`Check the denominator: a ${mark('0')} there usually means a typing slip, such as ${mark('x/0')} for ${mark('x/10')}.`],
          common_mistakes: [`Multiplying both sides by ${mark('0')} to clear the fraction: that turns ${mark('x/0 = 1')} into ${mark('x = 0')}, a step that is not allowed.`],
        });
        result.answer = `Undefined — ${zero} divides by zero, so no value satisfies the equation`;
        return result;
      }
      return await solveEquation(expression, options);
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
      tips: ['Use "*" for multiplication (e.g., "2*x")', 'Use "^" for exponents (e.g., "x^2")'],
      common_mistakes: ['Using incorrect notation', 'Missing operators'],
      graph: isEquation(expression) ? null : generateAlgebraGraph(expression),
    };
  }
}

async function solveEquation(expression, options = {}) {
  const variable = extractVariable(expression);
  let steps = [];
  let answer = '';
  let solutions = [];

  // An "=" with nothing on one side is not an equation ("=", "x =", "= 5"):
  // say so, rather than "No real solution found" from scanning () - () = 0.
  const [lhsRaw = '', rhsRaw = ''] = expression.split('=');
  if (!lhsRaw.trim() || !rhsRaw.trim()) {
    return parseError({
      input: expression,
      hint: 'An equation needs an expression on both sides of "=".',
      tips: [`For example: ${mark('2x + 5 = 11')}, or ${mark('x^2 - 4 = 0')}.`],
    });
  }

  // One equation in two (or more) unknowns — "2x + 3y = 6", "y - 3 = 2x
  // (solve for y)" — describes a relationship, not a number. Solve for the
  // requested unknown (or the first one) IN TERMS OF the others, and say so.
  // The old path took the first letter as "the" variable and, via the y=…
  // extractor, once answered "6".
  const letters = new Set(
    (expression.replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|nthRoot|nthroot|abs|log|log10|log2|ln|exp|pi|e)\b/gi, '')
      .match(/[a-z]/gi) || []).map((c) => c.toLowerCase())
  );
  if (letters.size >= 2) {
    // With no "solve for", an equation in x and y is solved for y, as a
    // textbook does: 2x + 3y = 6 reads as the line y = −2x/3 + 2, not
    // x = −3y/2 + 3. When y cannot be isolated, x is tried instead.
    const asked = options.solveFor && letters.has(options.solveFor) ? options.solveFor : null;
    const xy = letters.size === 2 && letters.has('x') && letters.has('y');
    let requested = asked || (xy ? 'y' : letters.has('y') && !letters.has('x') ? 'y' : variable);
    let solved = await solveForVariable(expression, requested);
    if (!solved?.relation && !asked && requested !== variable) {
      requested = variable;
      solved = await solveForVariable(expression, requested);
    }
    const others = [...letters].filter((v) => v !== requested).sort();
    const rel = solved?.relation;
    if (rel) {
      const vars = (list) => list.map((v) => mark(v)).join(' and ');
      return {
        steps: [
          `This is one equation in ${letters.size} unknowns (${[...letters].sort().map((v) => mark(v)).join(', ')}) — it has infinitely many solutions, one for every value of ${vars(others)}. So we solve for ${mark(requested)} in terms of ${vars(others)}.`,
          `Rewrite as an equation set to zero: ${mark(`${beautify(`(${lhsRaw.trim()}) - (${rhsRaw.trim()})`)} = 0`)}`,
          ...(solved.droppedComplex ? [`Over the real numbers, keep the real roots (the others involve ${mark('i')}, the imaginary unit).`] : []),
          `Isolate ${mark(requested)}: ${mark(rel)}`,
          `Check: substituting each root back into ${mark(beautify(expression))} balances both sides wherever the root is a real number ✓`,
        ],
        answer: rel,
        tips: [
          `To pin down a single value you need a second equation — enter both as a system, e.g. "${expression.trim()}; ${requested} - ${others[0]} = 1".`,
          'An equation in two unknowns is a curve (here a line if it is linear); solving for one variable gives the rule for that curve.',
        ],
        common_mistakes: ['Expecting a single number from an equation with more unknowns than equations.'],
        graph: null,
      };
    }
    return unsupported({
      input: expression,
      reason: `This is one equation in ${letters.size} unknowns (${[...letters].sort().join(', ')}) and it could not be rearranged for ${requested} symbolically.`,
      answer: `Infinitely many solutions — one equation cannot fix ${letters.size} unknowns`,
      tips: [`Add a second equation and enter both as a system: "${expression.trim()}; ${[...letters].sort()[0]} - ${[...letters].sort()[1]} = 1".`],
    });
  }

  // 0. |g(x)| = c: the two-case rule. The numeric root scan found x = −1 and
  // x = 4 for |2x − 3| = 5 but explained it as "search for where the
  // expression crosses zero" — the answer without the governing idea
  // (September 2026 review, batch 2).
  const viaAbs = await solveAbsoluteValueEquation(expression, variable);
  if (viaAbs) {
    ({ steps, answer, solutions } = viaAbs);
  }

  // 1. Linear equations: the textbook inverse-operations walkthrough in exact
  // fractions (clear fractions or distribute, collect, isolate, divide).
  // Quadratics go to the Algebrite path below, which shows the factoring or
  // the discriminant and formula.
  if (!answer) {
    const viaLinear = solveLinearEquation(expression, variable);
    if (viaLinear) {
      ({ steps, answer, solutions } = viaLinear);
    }
  }

  // 1a. One exponential with a linear exponent — e^(2x) = 7, 3·2^(x+1) − 4
  // = 20 — is isolated and both sides are logged: x = ln(7)/2, not ln(√7)
  // from the substitution below, nor 0.5365 from the numeric scan for
  // e^(3x) = 5 (October 2026 test list).
  if (!answer) {
    const viaLog = solveSingleExponential(expression, variable);
    if (viaLog) {
      ({ steps, answer, solutions } = viaLog);
    }
  }

  // 1b. A polynomial in e^x — e^(2x) − 3e^x + 2 = 0 — is solved by the
  // substitution u = e^x, so the answer is ln 2, not 0.6931 from the numeric
  // scan. (September 2026 audit row G09.)
  if (!answer) {
    const viaU = await solveViaExpSubstitution(expression, variable);
    if (viaU) {
      ({ steps, answer, solutions } = viaU);
    }
  }

  // 1c. An equation in logarithms — ln(x) = 1, ln(x)² = 4, log(x) + log(x − 3)
  // = 1 — is solved exactly by substituting u for the logarithm (one
  // argument) or combining the logarithms into one (several arguments), so
  // the answer is e, not 2.7183 from the numeric scan.
  if (!answer) {
    const viaLog = await solveViaLogSubstitution(expression, variable);
    if (viaLog) {
      ({ steps, answer, solutions } = viaLog);
    }
  }

  // 1d. One square root of the variable — sqrt(x + 2) = x — is isolated,
  // the domain stated, both sides squared, the polynomial solved, and every
  // candidate checked in the original so the extraneous root is rejected
  // with the reason shown (the numeric scan gave the answer with none of it).
  if (!answer) {
    const viaRadical = await solveViaRadicalIsolation(expression, variable);
    if (viaRadical) {
      ({ steps, answer, solutions } = viaRadical);
    }
  }

  // 1e. One power with a fractional exponent — x^(1/3) = −2, x^(2/3) = 4 —
  // isolated and raised to the reciprocal power, exactly. The zero-crossing
  // scan answered x^(1/3) = 0 and x^(1/3) = −2 "No real solution found"
  // (mathjs's cube root of a negative number is complex) and x^(2/3) = 4
  // with x = 8 alone (October 26).
  if (!answer) {
    const viaPower = solvePowerEquation(expression, variable);
    if (viaPower) {
      ({ steps, answer, solutions } = viaPower);
    }
  }

  // 2. Algebrite roots — exact solutions (integers, fractions, radicals, complex)
  // for anything the linear path did not take, e.g. x^2 = 9.
  if (!answer) {
    const viaAlgebrite = await solveWithAlgebriteRoots(expression, variable);
    if (viaAlgebrite?.envelope) return viaAlgebrite.envelope;
    if (viaAlgebrite) {
      ({ steps, answer, solutions } = viaAlgebrite);
    }
  }

  // 2b. A polynomial is never left to the zero-crossing scan, which can miss
  // roots lying close together: every root comes from the exact path.
  if (!answer && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    const viaExact = rootsViaPolynomialRoot(null, `(${lhs.trim()}) - (${rhs.trim()})`, variable);
    if (viaExact?.envelope) return viaExact.envelope;
    if (viaExact) ({ steps, answer, solutions } = viaExact);
  }

  // 2c. x/(x − 1) = 1: clearing the denominators leaves 1 = 0, a
  // contradiction — no solution, with the reason. It reached the numeric
  // scan and was answered "No real solution found", which proves nothing.
  // (Last before the scan: x/(x − 2) = 2/(x − 2) is taught above, its
  // candidate x = 2 rejected as extraneous; 1/x = 0 is "never 0" below.)
  if (!answer && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    if (new RegExp(`/\\s*\\(?[^()]*\\b${variable}\\b`).test(expression) && !neverZeroSide(lhs.trim(), rhs.trim(), variable)) {
      const Algebrite = await loadAlgebrite();
      let numerator = '';
      let difference = '';
      try {
        difference = String(Algebrite.run(`simplify((${lhs.trim()}) - (${rhs.trim()}))`)).trim();
        numerator = String(Algebrite.run(`numerator(rationalize((${lhs.trim()}) - (${rhs.trim()})))`)).trim();
      } catch { numerator = ''; }
      // A difference that is itself a constant (x/(x − 2) = 2/(x − 2)) has
      // its own wording below: the sides differ by 1 everywhere.
      const constantDifference = !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(difference);
      if (!constantDifference && /^-?\d+(?:\/\d+)?$/.test(numerator) && numerator !== '0') {
        steps = [`Multiply through by the denominators to clear the fractions: ${mark(`${beautify(numerator)} = 0`)}, which is false for every ${mark(variable)}.`, 'Solution: no real solution'];
        answer = `No real solution (clearing the denominators leaves ${beautify(numerator)} = 0)`;
        solutions = [];
      }
    }
  }

  // 3. Numeric root-finding — last resort.
  if (!answer) {
    const numeric = solveNumerically(expression, variable);
    // An expression that could not be evaluated anywhere is a refusal, not a
    // result; it is returned as its own envelope rather than an answer.
    if (numeric.envelope) return numeric.envelope;
    steps = numeric.steps;
    answer = numeric.answer;
    solutions = numeric.solutions;
  }

  // Extraneous roots. Clearing a denominator symbolically (Algebrite roots)
  // can manufacture a "solution" at which the ORIGINAL equation is undefined: x²/(x−1) = 1/(x−1) + 1
  // yields x = 0 or x = 1, and x = 1 makes both denominators zero. Every
  // real solution is substituted into the original sides; any that leaves a
  // side undefined is dropped, and the step says why.
  if (solutions.length > 0 && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    const definedAt = (side, x) => {
      try {
        // (−8)^(2/3) is 4: the real odd root, not mathjs's complex one.
        const v = math.evaluate(realOddRoots(side), { [variable]: x });
        return typeof v === 'number' && Number.isFinite(v);
      } catch {
        return false;
      }
    };
    const extraneous = solutions.filter((x) => Number.isFinite(x) && (!definedAt(lhs, x) || !definedAt(rhs, x)));
    if (extraneous.length > 0) {
      const keep = solutions.filter((x) => !extraneous.includes(x));
      const kept = keep.map((x) => `${variable} = ${formatNumber(x)}`);
      steps = [
        ...steps,
        `Check each candidate in the ORIGINAL equation: ${extraneous.map((x) => `${variable} = ${formatNumber(x)}`).join(', ')} make${extraneous.length === 1 ? 's' : ''} a denominator zero, so ${extraneous.length === 1 ? 'it is' : 'they are'} extraneous — introduced when the equation was multiplied through — and ${extraneous.length === 1 ? 'is' : 'are'} rejected.`,
        keep.length > 0 ? `Solution: ${kept.join('  or  ')}` : 'No solution: every candidate is extraneous.',
      ];
      answer = keep.length > 0 ? kept.join('  or  ') : 'No solution (every candidate makes the original equation undefined)';
      solutions = keep;
    }
  }

  // Verify by substitution, and show it: the check a student is expected to
  // do, and the proof that the listed solutions are solutions.
  if (solutions.length > 0 && solutions.length <= 4 && isEquation(expression) && !steps.some((st) => /^Check /.test(st))) {
    const [lhs, rhs] = expression.split('=');
    const at = (side, x) => {
      try {
        const y = math.evaluate(side, { [variable]: x });
        return typeof y === 'number' && Number.isFinite(y) ? y : null;
      } catch {
        return null;
      }
    };
    const checks = solutions
      .filter(Number.isFinite)
      .map((x) => ({ x, l: at(lhs, x), r: at(rhs, x) }))
      .filter((c) => c.l !== null && c.r !== null && Math.abs(c.l - c.r) <= 1e-6 * (1 + Math.abs(c.l)));
    if (checks.length === solutions.filter(Number.isFinite).length && checks.length > 0) {
      steps = [
        ...steps,
        `Check in the original equation: ${checks.map((c) => `${variable} = ${formatNumber(c.x)} gives ${absBars(beautify(lhs.trim()))} = ${formatNumber(c.l)} and ${absBars(beautify(rhs.trim()))} = ${formatNumber(c.r)}`).join('; ')} ✓`,
      ];
    }
  }

  const guidance = equationGuidance(steps, expression);
  return {
    steps: steps.length > 0 ? steps : [`Solve ${beautify(expression)}`, `Result: ${answer}`],
    answer,
    tips: guidance.tips,
    common_mistakes: guidance.common_mistakes,
    graph: solutions.length > 0 ? generateEquationGraph(expression, solutions) : null,
  };
}

// |g(x)| = c, possibly as k·|g(x)| + b = c (or with the sides swapped).
// c < 0: no real solution; c = 0: solve g = 0; c > 0: solve g = c and
// g = −c. A linear g is solved by hand in exact arithmetic; anything else
// takes the exact-roots path per case. Every candidate is substituted into
// the ORIGINAL equation before it is listed. Returns null when the equation
// is not of this shape.
async function solveAbsoluteValueEquation(equation, variable) {
  const v = variable;
  const [lhsRaw, rhsRaw] = equation.split('=').map((t) => t.replace(/\s+/g, ''));
  if (!lhsRaw || rhsRaw === undefined) return null;
  const isConst = (t) => t !== '' && !/[a-z]/i.test(t.replace(/\b(?:pi|sqrt|e)\b/gi, ''));
  const parseSide = (side) => {
    const m = side.match(/^(-?(?:\d+(?:\.\d+)?|\d+\/\d+)\*)?abs\(/i);
    if (!m) return null;
    const open = side.indexOf('(');
    const close = matchingParen(side, open);
    if (close < 0) return null;
    const g = side.slice(open + 1, close);
    const rest = side.slice(close + 1);
    const b = rest.match(/^([+-](?:\d+(?:\.\d+)?|\d+\/\d+))?$/);
    if (!b) return null;
    if (!hasVariable(g, v)) return null;
    return { k: m[1] ? m[1].slice(0, -1) : '1', g, b: b[1] || '0' };
  };
  let abs = parseSide(lhsRaw);
  let other = rhsRaw;
  if (!abs) {
    abs = parseSide(rhsRaw);
    other = lhsRaw;
  }
  if (!abs || !isConst(other)) return null;
  const Algebrite = await loadAlgebrite();
  const exactOf = (code) => {
    try {
      const out = String(Algebrite.run(`simplify(${code})`)).trim();
      return isAlgebriteFailure(out) ? null : out;
    } catch { return null; }
  };
  const kNum = Number(math.evaluate(abs.k));
  if (!Number.isFinite(kNum) || kNum === 0) return null;
  const cRaw = exactOf(`((${other}) - (${abs.b}))/(${abs.k})`);
  if (cRaw === null) return null;
  const c = Number(math.evaluate(cRaw));
  if (!Number.isFinite(c)) return null;
  const gShown = beautify(abs.g);
  const shownC = beautify(cRaw);
  const bars = (t) => absBars(beautify(t)).replace(/\s*=\s*/, ' = ');
  const steps = [`This is an absolute-value equation: ${bars(equation)}.`];
  if (abs.k !== '1' || abs.b !== '0') {
    steps.push(`First isolate the absolute value${abs.b !== '0' ? `: move the constant ${beautify(abs.b)} across` : ''}${abs.k !== '1' ? `${abs.b !== '0' ? ' and' : ':'} divide by ${beautify(abs.k)}` : ''}: |${gShown}| = ${shownC}.`);
  }

  if (c < 0) {
    steps.push(`An absolute value is never negative — |${gShown}| ≥ 0 for every ${v} — so it can never equal ${shownC}.`);
    steps.push('No real solution.');
    return { steps, answer: 'No real solution — an absolute value is never negative', solutions: [] };
  }

  // Solve one case g = value, by hand when g is linear.
  const solveCase = async (value, label) => {
    const a = exactOf(`coeff(${abs.g}, ${v}, 1)`);
    const b0 = exactOf(`coeff(${abs.g}, ${v}, 0)`);
    const degree = exactOf(`deg(${abs.g}, ${v})`);
    const lines = [];
    if (degree === '1' && a && b0 && !hasVariable(a, v) && !hasVariable(b0, v)) {
      const aNum = Number(math.evaluate(a));
      const moved = exactOf(`(${value}) - (${b0})`);
      const x = exactOf(`((${value}) - (${b0}))/(${a})`);
      lines.push(`${label}: ${gShown} = ${beautify(value)}`);
      if (b0 !== '0') lines.push(`  ${b0.startsWith('-') ? 'Add' : 'Subtract'} ${beautify(b0.replace(/^-/, ''))} ${b0.startsWith('-') ? 'to' : 'from'} both sides: ${beautify(`${a === '1' ? '' : a === '-1' ? '-' : `${a}*`}${v}`)} = ${beautify(moved)}`);
      if (aNum !== 1) lines.push(`  Divide both sides by ${beautify(a)}: ${v} = ${beautify(x)}`);
      else if (b0 === '0') lines.push(`  So ${v} = ${beautify(x)}`);
      return { lines, roots: [Number(math.evaluate(x))], exact: { [Number(math.evaluate(x))]: x } };
    }
    const viaRoots = await solveWithAlgebriteRoots(`${abs.g} = ${value}`, v);
    if (!viaRoots) return null;
    lines.push(`${label}: ${gShown} = ${beautify(value)}`);
    for (const st of viaRoots.steps) lines.push(`  ${st}`);
    if (!viaRoots.solutions.some(Number.isFinite)) lines.push('  This case gives no real solution, so it contributes nothing.');
    return { lines, roots: viaRoots.solutions, exact: {} };
  };

  const cases = c === 0
    ? [{ value: '0', label: 'Since |g| = 0 only when g = 0, solve' }]
    : [{ value: cRaw, label: 'Case 1 (the inside is positive)' }, { value: exactOf(`-(${cRaw})`) || `-(${cRaw})`, label: 'Case 2 (the inside is negative)' }];
  if (c === 0) steps.push(`|${gShown}| = 0 only when the expression inside is 0.`);
  else steps.push(`|${gShown}| = ${shownC} means the expression inside is either ${shownC} or −${shownC}, so there are two cases to solve.`);

  const solutions = [];
  const exactOfRoot = {};
  for (const cs of cases) {
    const solved = await solveCase(cs.value, cs.label);
    if (!solved) return null;
    steps.push(...solved.lines);
    Object.assign(exactOfRoot, solved.exact);
    for (const r of solved.roots) if (Number.isFinite(r) && !solutions.some((x) => Math.abs(x - r) < 1e-9)) solutions.push(r);
  }
  const verified = solutions.filter((x) => satisfiesEquation(equation, v, x));
  if (verified.length !== solutions.length) return null; // never list an unverified candidate
  verified.sort((p, q) => p - q);
  const shownRoots = verified.map((x) => `${v} = ${exactOfRoot[x] ? beautify(exactOfRoot[x]) : formatNumber(x)}`);
  steps.push(verified.length ? `Solution: ${shownRoots.join('  or  ')}` : 'No real solution.');
  return { steps, answer: verified.length ? shownRoots.join('  or  ') : 'No real solution', solutions: verified };
}

async function solveWithAlgebriteRoots(equation, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const [left, right] = equation.split('=');
    if (right === undefined) return null;

    // Move everything to one side: (left) - (right) = 0.
    const polynomial = `(${left.trim()}) - (${right.trim()})`;

    // A function name with no argument list is not something Algebrite can be
    // trusted with: a bare name there is applied to its PREVIOUS result, so
    // the "roots" of a mis-parsed `sin^2*x - 1/2` came back as
    // `1/(2*sin([-2,2])^2)` — the last problem's answer, embedded, nesting one
    // level deeper per solve. Nothing well-formed reaches here in that shape
    // (the parser rewrites sin^2(x) to (sin(x))^2), so refuse rather than
    // hand a leaked value to the formatter.
    if (BARE_FUNCTION_NAME.test(polynomial)) return null;

    // A rational equation — the variable in a denominator, as in
    // 1/(x−1) + 1/(x+1) = 1 — used to skip straight to the numeric scan and
    // print −0.4142 for 1 − √2. Clear the denominators first and find the
    // roots of the numerator; solveEquation's extraneous-root check then
    // drops any root that makes an original denominator zero.
    // (September 2026 audit row G06.)
    let target = polynomial;
    const clearingSteps = [];
    if (new RegExp(`/\\s*\\(?[^()]*\\b${variable}\\b`).test(polynomial)) {
      const numerator = String(Algebrite.run(`numerator(rationalize(${polynomial}))`)).trim();
      if (numerator && !/stop|error|nil/i.test(numerator) && new RegExp(`\\b${variable}\\b`).test(numerator)) {
        target = numerator;
        clearingSteps.push(`Multiply through by the denominators to clear the fractions: ${beautify(numerator)} = 0`);
      }
    }

    // Above degree 12 Algebrite's exact forms are not readable (x^50 = 2 came
    // back as 2^(1/50)·cos(π/50)… and was evaluated numerically anyway), and
    // a dense polynomial makes it grind for seconds before it fails
    // (x^41 − x − 1: ten seconds). Go straight to the exact root finder,
    // which also refuses at once above its own limit.
    const read = readPolynomial(target, variable);
    if (read && (read.tooHigh || read.degree > ALGEBRITE_DEGREE_LIMIT)) {
      const exact = rootsViaPolynomialRoot(Algebrite, target, variable, clearingSteps);
      if (exact) return exact;
    }

    // A cubic or higher is worked the way a course does it: the Rational
    // Root Theorem, synthetic division by each root found, then the
    // quadratic that remains — and whatever has no rational root goes to
    // the exact root finder without a call to Algebrite, whose roots() ground
    // for three seconds on an irreducible quintic before giving up.
    if (read && !read.tooHigh && read.degree >= 3) {
      const leading = [
        ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
        ...clearingSteps,
      ];
      const viaRational = solveByRationalRoots(Algebrite, target, variable, read, leading);
      if (viaRational) return viaRational;
    }

    // Algebrite throws "not factorable" for x^5 − x + 1: every root is
    // still found numerically rather than left to the zero-crossing scan.
    let rootsRaw;
    try {
      rootsRaw = Algebrite.roots(target, variable).toString();
    } catch {
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    // Algebrite mangles many cubics: rather than a clean real root like x = 2
    // for x^3 - 8, it emits terms like "-2*(-1)^(1/3)", the *principal complex*
    // cube root, which is both unreadable and numerically wrong for the real
    // solution. Detect that signature and recompute the roots numerically from
    // the polynomial's coefficients, which yields clean, correct values.
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) {
      const numericRoots = rootsViaPolynomialRoot(Algebrite, target, variable);
      if (numericRoots && !numericRoots.envelope) return numericRoots;
      // Past the exact reader's degree limit, Algebrite's own list is still
      // usable when it is complete (x^50 = 2): evaluate it below.
      if (numericRoots?.envelope && !rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) return numericRoots;
      // polynomialRoot caps at cubics. For higher degrees (x^4 - 16), evaluate
      // each symbolic root numerically instead — mathjs handles the complex
      // arithmetic — so students see ±2, ±2i, not (-1)^(1/4) soup.
      const evaluated = rootsViaComplexEvaluate(rootsRaw, target, variable);
      if (evaluated) return evaluated;
    }

    // Algebrite can return only the roots it could factor out and say nothing
    // about the rest: for x(x − 1)(x − 2)(x + 3)(7x − 1)(3x − 5) + x it
    // answers [0] and drops the quintic. A degree-n polynomial has n roots
    // counted with multiplicity; if the listed ones fall short, the list is
    // partial and the numeric scan below must answer instead (October 2026).
    if (!rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) {
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;

    let answer = formatSolutions(roots, variable);
    // Algebrite lists a double root once; a quadratic with a single root has
    // it twice, and the answer says so.
    if (roots.length === 1 && !/multiplicity/.test(answer) && String(Algebrite.run(`deg(${target}, ${variable})`)).trim() === '2') {
      answer += ' (repeated root, multiplicity 2)';
    }
    const numericSolutions = roots
      .map((r) => r.numeric)
      .filter((n) => Number.isFinite(n));

    const derivation = quadraticDerivation(Algebrite, target, variable);
    const steps = [
      // Already "… = 0": no rewrite to show.
      ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
      ...clearingSteps,
      ...(derivation || [`Solve for ${variable} by finding the roots.`]),
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: numericSolutions };
  } catch (e) {
    return null;
  }
}


// A·(ax + b)^(p/q) + C = D, the variable inside one fractional power:
// isolate the power, then undo it. With q odd the power is real for every
// base (the real q-th root, raised to p): an odd p undoes to one value of
// either sign, an even p to ±. With q even the base must be ≥ 0 and the
// power is never negative. Returns { steps, answer, solutions } or null.
function solvePowerEquation(equation, variable) {
  const v = variable;
  const sides = equation.split('=');
  if (sides.length !== 2) return null;
  let tree;
  try {
    tree = math.parse(`(${sides[0].trim()}) - (${sides[1].trim()})`);
  } catch {
    return null;
  }
  const has = (n) => n.filter((c) => c.type === 'SymbolNode' && c.name === v).length > 0;
  const constant = (n) => {
    try {
      const x = n.evaluate({});
      return typeof x === 'number' && Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  };
  // The terms of the difference, each with its sign.
  const terms = [];
  const collect = (n, sign) => {
    if (n.type === 'ParenthesisNode') return collect(n.content, sign);
    if (n.type === 'OperatorNode' && n.fn === 'add') { collect(n.args[0], sign); collect(n.args[1], sign); return; }
    if (n.type === 'OperatorNode' && n.fn === 'subtract') { collect(n.args[0], sign); collect(n.args[1], -sign); return; }
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { collect(n.args[0], -sign); return; }
    terms.push({ n, sign });
  };
  collect(tree, 1);
  const withVar = terms.filter((t) => has(t.n));
  if (withVar.length !== 1) return null;
  let C = 0;
  for (const t of terms) {
    if (t === withVar[0]) continue;
    const c = constant(t.n);
    if (c === null) return null;
    C += t.sign * c;
  }
  // k·power or power/k.
  let k = withVar[0].sign;
  let node = withVar[0].n;
  while (node.type === 'ParenthesisNode') node = node.content;
  if (node.type === 'OperatorNode' && node.fn === 'multiply') {
    const [x, y] = node.args;
    if (constant(x) !== null && has(y)) { k *= constant(x); node = y; } else if (constant(y) !== null && has(x)) { k *= constant(y); node = x; } else return null;
  } else if (node.type === 'OperatorNode' && node.fn === 'divide' && constant(node.args[1])) {
    k /= constant(node.args[1]);
    node = node.args[0];
  }
  while (node.type === 'ParenthesisNode') node = node.content;
  let base;
  let r;
  if (node.type === 'OperatorNode' && node.fn === 'pow' && constant(node.args[1]) !== null) {
    [base] = node.args;
    r = constant(node.args[1]);
  } else if (node.type === 'FunctionNode' && node.fn.name === 'sqrt') {
    [base] = node.args;
    r = 1 / 2;
  } else if (node.type === 'FunctionNode' && node.fn.name === 'cbrt') {
    [base] = node.args;
    r = 1 / 3;
  } else if (node.type === 'FunctionNode' && ['nthRoot', 'nthroot'].includes(node.fn.name) && node.args.length === 2 && constant(node.args[1])) {
    [base] = node.args;
    r = 1 / constant(node.args[1]);
  } else {
    return null;
  }
  if (Number.isInteger(r) || k === 0) return null;
  // r = p/q in lowest terms, q ≤ 12.
  let p = null;
  let q = null;
  for (let d = 2; d <= 12 && p === null; d += 1) {
    const n = Math.round(r * d);
    if (Math.abs(r * d - n) < 1e-12) { p = n; q = d; }
  }
  if (p === null) return null;
  const lin = linearCoefficients(base.toString(), v);
  if (!lin || lin.k === 0) return null;
  const m = -C / k;
  const baseShown = beautify(base.toString());
  const rText = `${p}/${q}`;
  const powerShown = `${/^[\w.]+$/.test(baseShown) ? baseShown : `(${baseShown})`}^(${rText})`;
  const fmt = (x) => {
    const rounded = Math.round(x);
    if (Math.abs(x - rounded) < 1e-9) return String(rounded);
    for (let d = 2; d <= 64; d += 1) {
      const n = Math.round(x * d);
      if (Math.abs(x * d - n) < 1e-9) return `${n}/${d}`;
    }
    return null;
  };
  const mText = fmt(m) ?? formatNumber(m);
  const steps = [`Isolate the power: ${mark(`${powerShown} = ${mText}`)}.`];
  const evenRoot = q % 2 === 0;
  const evenPower = p % 2 === 0;
  const none = (why) => ({ steps: [...steps, why, 'Solution: no real solution'], answer: `No real solution (${why.replace(/\.$/, '').replace(/⟦|⟧/g, '')})`, solutions: [] });
  if (m === 0 && p < 0) return none(`A negative power is ${mark('1')} over a power, never ${mark('0')}.`);
  if (m < 0 && (evenRoot || evenPower)) {
    return none(evenRoot ? `${mark(`${powerShown}`)} is a power of a square root, which is never negative.` : `${mark(`${powerShown}`)} is an even power of a real root, which is never negative.`);
  }
  // The values of the base: (base)^(p/q) = m ⇔ base = ±m^(q/p).
  const magnitude = Math.abs(m) ** (q / p);
  const values = [];
  if (m === 0) values.push(0);
  else if (evenPower && !evenRoot) values.push(-magnitude, magnitude);
  else values.push(m < 0 ? -magnitude : magnitude);
  const magText = fmt(magnitude);
  if (m === 0) steps.push(`A power is ${mark('0')} only when its base is: ${mark(`${baseShown} = 0`)}.`);
  else if (evenPower && !evenRoot) steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}. The numerator ${mark(String(p))} is even, so both signs: ${mark(`${baseShown} = ±${mText}^(${q}/${p}) = ±${magText ?? formatNumber(magnitude)}`)}.`);
  else if (!evenRoot && m < 0) steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}: the ${mark(String(q))}-th root is real for a negative number, so the sign carries through: ${mark(`${baseShown} = −${formatNumber(Math.abs(m))}^(${q}/${p}) = ${fmt(-magnitude) ?? formatNumber(-magnitude)}`)}.`);
  else steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}${evenRoot ? ` (the base of a square root is ${mark('≥ 0')}, and ${mark(mText)} is)` : ''}: ${mark(`${baseShown} = ${mText}^(${q}/${p}) = ${magText ?? formatNumber(magnitude)}`)}.`);
  // Solve the linear base for each value, and check each in the original.
  const evalOriginal = (x) => {
    try {
      const value = math.evaluate(realOddRoots(`(${sides[0].trim()}) - (${sides[1].trim()})`), { [v]: x });
      return typeof value === 'number' ? value : NaN;
    } catch {
      return NaN;
    }
  };
  const found = [];
  for (const value of values) {
    const x = (value - lin.d) / lin.k;
    const residual = evalOriginal(x);
    if (!(Math.abs(residual) <= 1e-9 * (1 + Math.abs(m)))) continue;
    found.push({ x, text: fmt(x) });
  }
  if (found.length !== values.length) return null;
  if (lin.k !== 1 || lin.d !== 0) {
    steps.push(`Solve for ${mark(v)}: ${found.map((f) => mark(`${v} = ${f.text ?? `≈ ${formatNumber(f.x)}`}`)).join(' or ')}.`);
  }
  steps.push(`Check in the original equation: ${found.map((f) => mark(`${v} = ${f.text ?? formatNumber(f.x)}`)).join(', ')} ${found.length === 1 ? 'satisfies' : 'each satisfy'} it ✓`);
  found.sort((x, y) => x.x - y.x);
  const answer = found.map((f) => (f.text ? `${v} = ${f.text}` : `${v} ≈ ${formatNumber(f.x)}`)).join('  or  ');
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: found.map((f) => f.x) };
}

function solveSingleExponential(equation, variable) {
  const v = variable;
  const [lhsText, rhsText] = equation.split('=');
  if (rhsText === undefined || equation.split('=').length !== 2) return null;
  let lhs;
  let rhs;
  try {
    lhs = math.parse(lhsText.trim());
    rhs = math.parse(rhsText.trim());
  } catch {
    return null;
  }
  const has = (n) => n.filter((c) => c.type === 'SymbolNode' && c.name === v).length > 0;
  const constant = (n) => {
    try {
      const x = n.evaluate({});
      return typeof x === 'number' && Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  };
  if (has(lhs) === has(rhs)) return null;
  let node = has(lhs) ? lhs : rhs;
  let value = has(lhs) ? rhs : lhs;
  if (constant(value) === null) return null;
  const exact = (n) => {
    try {
      return beautify(math.simplify(n, {}, { exactFractions: true }).toString());
    } catch {
      return beautify(n.toString());
    }
  };
  const txt = (n) => beautify(n.toString().replace(/\s*([*/])\s*/g, '$1'));
  const op = (o, fn, a, b) => new math.OperatorNode(o, fn, [a, b]);
  const lines = [];
  let base = null;
  let exponent = null;
  for (let guard = 0; guard < 20 && !base; guard += 1) {
    if (node.type === 'ParenthesisNode') { node = node.content; continue; }
    if (node.type === 'FunctionNode' && node.fn?.name === 'exp' && node.args.length === 1) {
      base = 'e'; exponent = node.args[0]; break;
    }
    if (node.type !== 'OperatorNode') return null;
    if (node.args.length === 1) {
      if (node.op !== '-') return null;
      node = node.args[0];
      value = new math.OperatorNode('-', 'unaryMinus', [value]);
      lines.push(['Multiply both sides by −1', node, value]);
      continue;
    }
    const [a, b] = node.args;
    if (node.op === '^') {
      if (has(a) || !has(b)) return null;
      const bv = constant(a);
      if (bv === null || !(bv > 0) || bv === 1) return null;
      // A fraction base keeps its brackets: (1/2)^x, not 1/2^x.
      const shownBase = exact(a).replace(/\s*\/\s*/g, '/');
      base = a.type === 'SymbolNode' && a.name === 'e' ? 'e' : /^(?:\d+(?:\.\d+)?|pi)$/.test(shownBase) ? shownBase : `(${shownBase})`;
      exponent = b;
      break;
    }
    if (has(a) && has(b)) return null;
    const inA = has(a);
    const other = inA ? b : a;
    const k = exact(other);
    if (node.op === '+') {
      value = op('-', 'subtract', value, other);
      node = inA ? a : b;
      lines.push([`Subtract ${mark(k)} from both sides`, node, value]);
    } else if (node.op === '-') {
      if (inA) {
        value = op('+', 'add', value, other);
        node = a;
        lines.push([`Add ${mark(k)} to both sides`, node, value]);
      } else {
        value = op('-', 'subtract', other, value);
        node = b;
        lines.push([`Subtract ${mark(k)} from both sides, then multiply by ${mark('−1')}`, node, value]);
      }
    } else if (node.op === '*') {
      if (constant(other) === 0) return null;
      value = op('/', 'divide', value, other);
      node = inA ? a : b;
      lines.push([`Divide both sides by ${mark(k)}`, node, value]);
    } else if (node.op === '/') {
      if (inA) {
        value = op('*', 'multiply', value, other);
        node = a;
        lines.push([`Multiply both sides by ${mark(k)}`, node, value]);
      } else {
        if (constant(value) === 0) return null;
        value = op('/', 'divide', other, value);
        node = b;
        lines.push([`Take the reciprocal of both sides, then multiply by ${mark(k)}`, node, value]);
      }
    } else {
      return null;
    }
  }
  if (!base) return null;
  while (exponent.type === 'ParenthesisNode') exponent = exponent.content;
  const lin = linearCoefficients(exponent.toString(), v);
  if (!lin || lin.k === 0) return null;
  const K = constant(value);
  if (K === null) return null;
  const b = base === 'e' ? Math.E : constant(math.parse(base));
  const linear = txt(exponent);
  const power = /^(?:[a-z]|\d+(?:\.\d+)?)$/i.test(linear) ? `${base}^${linear}` : `${base}^(${linear})`;
  const steps = [`The variable appears once, in the exponent of ${mark(power)}: isolate that power, then take logarithms.`];
  for (const [text, n, val] of lines) steps.push(`${text}: ${mark(`${txt(n)} = ${exact(val)}`)}`);
  const Ktext = exact(value);
  if (K <= 0) {
    steps.push(`${mark(`${base}^u`)} is positive for every real ${mark('u')}, and ${mark(`${Ktext} ≤ 0`)}, so ${mark(`${power} = ${Ktext}`)} has no real solution.`);
    return { steps: [...steps, 'Solution: no real solution'], answer: `No real solution (${power} is always positive)`, solutions: [] };
  }
  const L = Math.log(K) / Math.log(b);
  if (!Number.isFinite(L)) return null;
  const frac = (x) => {
    try {
      const f = math.fraction(x);
      return Math.abs(Number(f.s) * Number(f.n) / Number(f.d) - x) < 1e-12 && Number(f.d) <= 1000 ? f : null;
    } catch {
      return null;
    }
  };
  const fracText = (f) => {
    const n = Number(f.s) * Number(f.n);
    return Number(f.d) === 1 ? `${n}` : `${n}/${Number(f.d)}`;
  };
  const p = frac(lin.k);
  const q = frac(lin.d);
  if (!p || !q) return null;
  // log_b(K) exactly when it is a simple fraction: 4^x = 2 → x = 1/2, not
  // ln(2)/ln(4).
  const Lfrac = (() => {
    const f = frac(L);
    if (!f || Number(f.d) > 12) return null;
    const value = Number(f.s) * Number(f.n) / Number(f.d);
    return Math.abs(b ** value - K) <= 1e-12 * Math.abs(K) ? f : null;
  })();
  const Lint = Lfrac ? fracText(Lfrac) : null;
  const lnBase = base.startsWith('(') ? `ln${base}` : `ln(${base})`;
  const logOf = base === 'e' ? `ln(${Ktext})` : `ln(${Ktext})/${lnBase}`;
  steps.push(base === 'e'
    ? `Take ${mark('ln')} of both sides (${mark('ln(e^u) = u')}): ${mark(`${linear} = ${Lint !== null ? Lint : logOf}`)}`
    : `Take ${mark('ln')} of both sides (${mark(`ln(${base}^u) = u·${lnBase}`)}), then divide by ${mark(`${lnBase}`)}: ${mark(`${linear} = ${Lint !== null ? Lint : logOf}`)}`);
  const x = (L - lin.d) / lin.k;
  let xText;
  if (Lint !== null) {
    const r = Lfrac.sub(q).div(p);
    xText = fracText(r);
  } else if (base !== 'e' && lin.d === 0) {
    // ln(K)/ln(b) over p: one fraction, ln(7)/(2ln(2)), not (ln(7)/ln(2))/2.
    const c = math.fraction(1).div(p);
    const cn = Number(c.s) * Number(c.n);
    const cd = Number(c.d);
    const top = `${cn === -1 ? '-' : cn === 1 ? '' : cn}ln(${Ktext})`;
    xText = `${top}/${cd === 1 ? `${lnBase}` : `(${cd}${lnBase})`} (≈ ${formatNumber(x)})`;
  } else {
    const qn = Number(q.s) * Number(q.n);
    const T = qn === 0 ? logOf : `${logOf} ${qn > 0 ? '-' : '+'} ${fracText(math.fraction(Math.abs(lin.d)))}`;
    const compound = qn !== 0 || base !== 'e';
    const c = math.fraction(1).div(p);
    const cn = Number(c.s) * Number(c.n);
    const cd = Number(c.d);
    const wrapped = compound ? `(${T})` : T;
    if (cd === 1) xText = cn === 1 ? T : cn === -1 ? `-${wrapped}` : `${cn}${wrapped}`;
    else if (Math.abs(cn) === 1) xText = `${cn < 0 ? '-' : ''}${wrapped}/${cd}`;
    else xText = `${cn}${wrapped}/${cd}`;
    xText = `${xText} (≈ ${formatNumber(x)})`;
  }
  if (!(lin.k === 1 && lin.d === 0)) steps.push(`Solve the linear equation for ${mark(v)}: ${mark(`${v} = ${xText.replace(/ \(≈ .*\)$/, '')}`)}`);
  // The candidate must satisfy the original equation.
  try {
    const l = lhs.evaluate({ [v]: x });
    const r = rhs.evaluate({ [v]: x });
    if (!(Math.abs(l - r) <= 1e-9 * (1 + Math.abs(l)))) return null;
  } catch {
    return null;
  }
  const answer = `${v} = ${xText}`;
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: [x] };
}

// e^(2x) − 3e^x + 2 = 0: substitute u = e^x, solve the polynomial in u, and
// back-substitute x = ln u for each positive u. A negative exponent is 1/u^k
// (e^(−x) = 1/u, e^(−2x) = 1/u²): the equation is then multiplied through by
// the highest such power — allowed because u > 0 — before the polynomial is
// solved, so e^x + e^(−x) = 3 gives x = ln((3 ± √5)/2) and e^x + e^(−x) = 1
// is shown to have no real solution (u² − u + 1 has no real root). Returns
// null unless the whole equation is a polynomial in e^x and e^(−x) (any
// other appearance of the variable, or a transcendental function of it,
// means the substitution does not close).
async function solveViaExpSubstitution(equation, variable) {
  const v = variable;
  // The base: e (e^x, exp(x)) or a positive number other than 1 (2^x,
  // 10^(2x)). Every exponential term must share it — 4^x − 5·2^x + 4 = 0
  // leaves a 2^x behind after the substitution and is declined below.
  const numericBase = equation.match(new RegExp(`(?<![\\w.])(\\d+(?:\\.\\d+)?)\\s*\\^\\s*(?:\\(\\s*-?\\s*\\d*\\s*\\*?\\s*${v}\\s*\\)|${v}\\b)`));
  const base = numericBase ? numericBase[1] : 'e';
  if (base !== 'e' && !(Number(base) > 0 && Number(base) !== 1)) return null;
  const baseRe = base === 'e' ? 'e' : base.replace('.', '\\.');
  const expPower = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\)|exp\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\)`, 'g');
  const expPlain = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*${v}\\b|e\\s*\\^\\s*\\(\\s*${v}\\s*\\)|exp\\(\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*(?:${v}\\b|\\(\\s*${v}\\s*\\))`, 'g');
  // e^(-x), e^(-2x), exp(-x), 2^(-x): the parser writes every negative
  // exponent in parentheses, so one shape per base covers them.
  const expNegative = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\)|exp\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\)`, 'g');
  if (!expPower.test(equation) && !expPlain.test(equation) && !expNegative.test(equation)) return null;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zeroForm = `(${lhs.trim()}) - (${rhs.trim()})`;
  let highestNegative = 0;
  const powersUsed = [];
  const inU = zeroForm
    .replace(expNegative, (m, ...rest) => {
      // The e-form has two groups (e^(−kx) | exp(−kx)), the numeric form one;
      // the captured k is whichever group matched, and an empty one is 1.
      const k = Number(rest.slice(0, -2).find((g) => g) || 1);
      highestNegative = Math.max(highestNegative, k);
      powersUsed.push(-k);
      return k === 1 ? 'u^(-1)' : `u^(-${k})`;
    })
    .replace(expPower, (m, k1, k2) => { powersUsed.push(Number(k1 || k2)); return `u^${k1 || k2}`; })
    .replace(expPlain, () => { powersUsed.push(1); return 'u'; });
  if (new RegExp(`\\b${v}\\b`).test(inU)) return null;
  if (/\b(?:sin|cos|tan|log|ln|sqrt|abs)\b/.test(inU)) return null;
  try {
    const Algebrite = await loadAlgebrite();
    // Clear the negative powers: multiply through by u^k (u > 0, so no
    // solution is gained or lost) and expand to the polynomial Algebrite
    // solves. A decimal coefficient (e^x + e^(−x) = 2.5) is written as a
    // fraction first: Algebrite's root finder refuses a float.
    const polynomial = highestNegative > 0
      ? Algebrite.run(`expand((${decimalsAsFractions(inU)}) * u^${highestNegative})`)
      : decimalsAsFractions(inU);
    if (highestNegative > 0 && (/\bu\^\(?-|nil|stop|error/i.test(polynomial) || !/^[-+*^()/\d.\su]+$/.test(polynomial))) return null;
    const rootsRaw = Algebrite.roots(polynomial, 'u').toString();
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    // Algebrite can list only the roots it factored out (see
    // solveWithAlgebriteRoots): a partial list would miss a solution, or
    // claim "no real solution" unproved — decline rather than guess.
    if (!rootsAccountForDegree(Algebrite, polynomial, 'u', rootsRaw)) return null;
    const degree = readPolynomial(polynomial, 'u')?.degree ?? 0;

    const b = base === 'e' ? Math.E : Number(base);
    const lines = [];
    const shown = [];
    const numeric = [];
    for (const r of roots) {
      const uText = formatSolutions([r], 'u').replace(/^u\s*=\s*/, '');
      if (!Number.isFinite(r.numeric)) {
        lines.push(`u = ${uText} is not real, so it gives no real ${v}`);
        continue;
      }
      if (r.numeric <= 0) {
        lines.push(`u = ${uText}: ${base}^${v} is always positive, so this gives no real ${v}`);
        continue;
      }
      const value = Math.log(r.numeric) / Math.log(b);
      let xText;
      if (Math.abs(value - Math.round(value)) < 1e-9) xText = String(Math.round(value)); // u is an exact power of the base
      else if (base === 'e') xText = `ln(${uText}) (≈ ${formatNumber(value)})`;
      else xText = `ln(${uText})/ln(${base}) (≈ ${formatNumber(value)})`;
      lines.push(`${base}^${v} = ${uText} → ${v} = ${xText}`);
      shown.push(`${v} = ${xText}`);
      numeric.push(value);
    }
    const realRoots = roots.filter((r) => Number.isFinite(r.numeric));
    const noneReal = realRoots.length === 0;
    // "No real solution" is claimed only when every listed root visibly has
    // an imaginary part: a root mathjs could not evaluate is not thereby
    // non-real, so such a list proves nothing and the path declines.
    if (noneReal && !roots.every((r) => /(?<![a-z])i(?![a-z])/.test(r.display))) return null;
    const answer = shown.length > 0
      ? shown.join('  or  ')
      : noneReal
        ? `No real solution (no real ${mark('u')} solves ${mark(`${beautify(polynomial)} = 0`)}, so no real ${mark(v)})`
        : `No real solution (${base}^${v} is always positive, so no listed u is reachable)`;
    const takeLog = base === 'e' ? `take ${mark('ln')} of both sides` : `take the logarithm of both sides, ${mark(`${v} = ln(u)/ln(${base}) = log_${base}(u)`)}`;
    // The powers the substitution turns into: e^(2x) = u², e^(−x) = 1/u, …
    const powerNotes = [...new Set(powersUsed)].sort((a, b) => a - b)
      .filter((k) => k !== 1)
      .map((k) => (k < 0 ? `${base}^(${k === -1 ? '-' : k}${v}) = 1/u${k < -1 ? `^${-k}` : ''}` : `${base}^(${k}${v}) = u^${k}`));
    const substitutionNote = mark(powerNotes.length ? powerNotes.join(', ') : `${base}^(2${v}) = u², ${base}^(3${v}) = u³`);
    const steps = [
      `Rewrite as an equation set to zero: ${beautify(zeroForm)} = 0`,
      `Let ${mark(`u = ${base}^${v}`)} (so ${substitutionNote}): ${mark(`${beautify(inU)} = 0`)}`,
    ];
    if (highestNegative > 0) {
      const multiplier = highestNegative === 1 ? 'u' : `u^${highestNegative}`;
      steps.push(`Multiply both sides by ${mark(multiplier)} to clear the negative powers (${mark(`u = ${base}^${v} > 0`)}, so no solution is gained or lost): ${mark(`${beautify(polynomial)} = 0`)}`);
    }
    const uSolutions = formatSolutions(roots, 'u').split('  or  ').map(mark).join('  or  ');
    if (noneReal && degree === 2) {
      const [c2, c1, c0] = quadraticCoefficients(polynomial);
      if (c2 !== null) {
        const disc = c1 * c1 - 4 * c2 * c0;
        const signed = (n) => (n < 0 ? `(${formatNumber(n)})` : formatNumber(n));
        steps.push(`The discriminant is ${mark(`${signed(c1)}² − 4(${signed(c2)})(${signed(c0)}) = ${formatNumber(disc)}`)}, which is negative, so no real ${mark('u')} solves it: ${uSolutions}, neither of which is real`);
      } else {
        steps.push(`Solve for ${mark('u')}: ${uSolutions}, none of which is real`);
      }
    } else if (noneReal) {
      steps.push(`Solve for ${mark('u')}: ${uSolutions}, none of which is real`);
    } else {
      steps.push(`Solve for u: ${formatSolutions(roots, 'u')}`);
    }
    if (!noneReal) steps.push(`Back-substitute ${mark(`u = ${base}^${v}`)} and ${takeLog}: ${lines.map(mark).join('; ')}`);
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: numeric };
  } catch {
    return null;
  }
}

// 2.5 → (5/2), 0.75 → (3/4): decimals as the fractions Algebrite can factor.
function decimalsAsFractions(text) {
  return text.replace(/(?<![\w.])(\d+)\.(\d+)(?![\w.])/g, (m, whole, places) => {
    const denominator = 10 ** places.length;
    const numerator = Number(whole) * denominator + Number(places);
    const g = gcd(numerator, denominator);
    return `(${numerator / g}/${denominator / g})`;
  });
}

// The coefficients [a, b, c] of a quadratic in u as Algebrite prints it
// (1-u+u^2, 2*u^2-3*u+1, …); [null] when the text is not of that shape.
function quadraticCoefficients(polynomial) {
  const coeffs = [0, 0, 0];
  const terms = polynomial.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  for (const term of terms) {
    const m = term.match(/^([+-]?)(\d+(?:\.\d+)?)?(?:\*?u(?:\^(\d+))?)?$/);
    if (!m) return [null];
    const sign = m[1] === '-' ? -1 : 1;
    const coefficient = sign * (m[2] === undefined ? 1 : Number(m[2]));
    const power = term.includes('u') ? Number(m[3] || 1) : 0;
    if (power > 2) return [null];
    coeffs[2 - power] += coefficient;
  }
  return coeffs;
}

// The logarithm terms in `text`, each with its base and argument: ln(g) is
// base e; (log(g)/log(b)) — the parser's form for a bare log (b = 10) and for
// log_b(g) — is base b. Returns null if a log appears in any other shape.
function logTermsOf(text) {
  const terms = [];
  const re = /(?<![a-z])(ln|log)\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close === -1) return null;
    const arg = text.slice(open + 1, close).trim();
    if (m[1].toLowerCase() === 'ln') {
      terms.push({ start: m.index, end: close + 1, base: 'e', arg });
      continue;
    }
    const quotient = text.slice(close + 1).match(/^\s*\/\s*log\s*\(/i);
    if (!quotient || text[m.index - 1] !== '(') return null;
    const baseOpen = close + 1 + quotient[0].length - 1;
    const baseClose = matchingParen(text, baseOpen);
    if (baseClose === -1 || text[baseClose + 1] !== ')') return null;
    const base = text.slice(baseOpen + 1, baseClose).trim();
    if (!/^\d+(?:\.\d+)?$/.test(base) || !(Number(base) > 0) || Number(base) === 1) return null;
    terms.push({ start: m.index - 1, end: baseClose + 2, base, arg });
    re.lastIndex = baseClose + 2;
  }
  return terms;
}

// Algebrite writes e^k as exp(k); show the textbook form.
function prettyExp(display) {
  return String(display)
    .replace(/\bexp\(1\)/g, 'e')
    .replace(/\bexp\(\s*-\s*(\d+)\s*\)/g, (_, k) => (k === '1' ? '1/e' : `1/e^${k}`))
    .replace(/\bexp\(([\w.]+)\)/g, 'e^$1')
    .replace(/\bexp\(([^()]+)\)/g, 'e^($1)')
    .replace(/\b1\/(\d+)\*(e(?:\^[\w.]+|\^\([^()]+\))?)/g, '$2/$1')
    .replace(/\b(\d+)\*(e(?:\^[\w.]+|\^\([^()]+\))?)/g, '$1$2');
}

// ln(x) = 1, ln(x)² = 4, ln(2x) = 3, log(x) + log(x − 3) = 1, ln(x) − ln(x − 1)
// = ln(2): an equation whose only use of the variable is inside logarithms of
// one base. One distinct argument g: substitute u = log(g), solve the
// polynomial in u, and back-substitute g = b^u. Several arguments: the
// equation must be linear in the logarithms with integer coefficients, so
// the product/quotient rules combine them into one — Σ kᵢ·log(gᵢ) = c →
// Π gᵢ^kᵢ = b^c — and that polynomial is solved. Every candidate is checked
// against the domain (each argument positive) and substituted into the
// original equation before it is reported, so log(x) + log(x − 3) = 1 gives
// x = 5 and says why x = −2 is rejected. Returns null when the shape does
// not fit; the caller falls through to the numeric scan.
async function solveViaLogSubstitution(equation, variable) {
  const v = variable;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zeroForm = `(${lhs.trim()}) - (${rhs.trim()})`;
  const terms = logTermsOf(zeroForm);
  if (!terms || terms.length === 0) return null;
  const base = terms[0].base;
  if (!terms.every((t) => t.base === base)) return null;
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  // Arguments must be polynomial in the variable (no nested transcendental,
  // no variable exponent) for the combined equation to be a polynomial.
  if (terms.some((t) => /[a-df-wyz]{2,}/i.test(t.arg) || /\^\s*\(?[^()]*[a-z]/i.test(t.arg))) return null;

  // Distinct arguments → u1, u2, …
  const args = [];
  const keyOf = (a) => a.replace(/\s+/g, '');
  for (const t of terms) {
    let idx = args.findIndex((a) => keyOf(a) === keyOf(t.arg));
    if (idx === -1) { args.push(t.arg); idx = args.length - 1; }
    t.sym = `u${idx + 1}`;
  }
  let inU = zeroForm;
  for (const t of [...terms].sort((a, b) => b.start - a.start)) {
    inU = `${inU.slice(0, t.start)}${t.sym}${inU.slice(t.end)}`;
  }
  if (hasVar.test(inU)) return null; // the variable outside a log: the substitution does not close
  if (/\b(?:sin|cos|tan|sqrt|abs|ln|log)\b/.test(inU)) return null;

  const logName = base === 'e' ? 'ln' : base === '10' ? 'log' : `log_${base}`;
  const powText = (u) => (base === 'e' ? `exp(${u})` : `${base}^(${u})`);
  const argumentPositive = (x) => args.every((a) => {
    try {
      const val = math.evaluate(a, { [v]: x });
      return typeof val === 'number' && val > 0;
    } catch {
      return false;
    }
  });

  try {
    const Algebrite = await loadAlgebrite();
    const steps = [`Rewrite as an equation set to zero: ${beautify(zeroForm)} = 0`];
    let candidates = []; // { display, numeric }

    if (args.length === 1) {
      const g = args[0];
      const inOneU = inU.replace(/\bu1\b/g, 'u');
      const rootsRaw = Algebrite.roots(inOneU, 'u').toString();
      if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
      const uRoots = parseRootsList(rootsRaw);
      if (uRoots.length === 0) return null;
      steps.push(`Let ${mark(`u = ${logName}(${beautify(g)})`)}: ${mark(`${beautify(inOneU)} = 0`)}`);
      steps.push(`Solve for u: ${formatSolutions(uRoots, 'u')}`);
      const lines = [];
      for (const r of uRoots) {
        const uText = formatSolutions([r], 'u').replace(/^u\s*=\s*/, '');
        if (!Number.isFinite(r.numeric)) {
          lines.push(`${mark(`u = ${uText}`)} is not real, so it gives no real ${mark(v)}`);
          continue;
        }
        // g = xⁿ: x = ±b^(u/n) (n even) or b^(u/n) (n odd), exactly.
        // Algebrite writes the real roots of x² = e⁴ as ±i·(−e⁴)^(1/2), and
        // the numeric scan gave ±7.3891 for what is ±e².
        const power = String(g).replace(/\s+/g, '').match(new RegExp(`^\\(?${v}\\^\\(?(\\d+)\\)?\\)?$`));
        let xs;
        if (power && Number(power[1]) >= 2) {
          const n = Number(power[1]);
          let ex;
          try {
            const f = math.fraction(String(r.display).replace(/\s+/g, '')).div(n);
            ex = Number(f.d) === 1 ? `${Number(f.s) * Number(f.n)}` : `${Number(f.s) * Number(f.n)}/${Number(f.d)}`;
          } catch {
            ex = `(${r.display})/${n}`;
          }
          const one = ex === '1' ? (base === 'e' ? 'exp(1)' : base) : base === 'e' ? `exp(${ex})` : `${base}^(${ex})`;
          const value = (base === 'e' ? Math.E : Number(base)) ** (r.numeric / n);
          xs = n % 2 === 0
            ? [{ display: `-${one}`, numeric: -value }, { display: one, numeric: value }]
            : [{ display: one, numeric: value }];
        } else {
          const raw = String(Algebrite.run(`roots((${g}) - ${powText(r.display)}, ${v})`)).trim();
          if (!raw || /stop|error|nil/i.test(raw)) return null;
          // Any other g with that complex form: decline; the numeric scan takes it.
          if (/\(-.*\)\^\(1\/\d+\)/.test(raw)) return null;
          xs = parseRootsList(raw);
        }
        if (xs.length === 0) return null;
        lines.push(`${mark(`u = ${uText}`)} means ${mark(`${logName}(${beautify(g)}) = ${uText}`)}, so ${mark(`${beautify(g)} = ${base}^${/^[\w.]+$/.test(uText) ? uText : `(${uText})`} → ${xs.map((x) => `${v} = ${prettyExp(prettyRadicals(x.display))}`).join(' or ')}`)}`);
        candidates.push(...xs);
      }
      steps.push(`Back-substitute (${mark(`${logName}(a) = u`)} means ${mark(`a = ${base}^u`)}): ${lines.join('; ')}`);
    } else {
      // Linear in the logarithms with integer coefficients?
      const coeffs = [];
      for (let i = 0; i < args.length; i += 1) {
        const c = String(Algebrite.run(`coeff(${inU}, u${i + 1}, 1)`)).trim();
        if (!/^-?\d+$/.test(c)) return null;
        coeffs.push(Number(c));
      }
      let constantExpr = inU;
      for (let i = 0; i < args.length; i += 1) constantExpr = `subst(0, u${i + 1}, ${constantExpr})`;
      const constant = String(Algebrite.run(constantExpr)).trim();
      if (/\bu\d+\b|stop|error|nil/i.test(constant) || hasVar.test(constant)) return null;
      const linear = coeffs.map((c, i) => `(${c})*u${i + 1}`).join(' + ');
      if (String(Algebrite.run(`simplify((${inU}) - (${linear} + (${constant})))`)).trim() !== '0') return null;

      // Σ kᵢ·log(gᵢ) = −constant → Π gᵢ^kᵢ = b^(−constant)
      const rhsExp = String(Algebrite.run(`simplify(-(${constant}))`)).trim();
      const numerator = args.map((a, i) => ({ a, k: coeffs[i] })).filter((t) => t.k > 0).map((t) => (t.k === 1 ? `(${t.a})` : `(${t.a})^${t.k}`));
      const denominator = args.map((a, i) => ({ a, k: coeffs[i] })).filter((t) => t.k < 0).map((t) => (t.k === -1 ? `(${t.a})` : `(${t.a})^${-t.k}`));
      if (numerator.length === 0 && denominator.length === 0) return null;
      const numText = numerator.length ? numerator.join('*') : '1';
      const denText = denominator.length ? denominator.join('*') : '';
      const combined = denText ? `(${numText})/(${denText})` : numText;
      const rhsValue = String(Algebrite.run(`simplify(${powText(rhsExp)})`)).trim();
      steps.push(`Every term is a logarithm with the same base, so combine them with the log rules (${mark(`k·${logName}(a) = ${logName}(a^k)`)}, ${mark(`${logName}(a) + ${logName}(b) = ${logName}(ab)`)}, ${mark(`${logName}(a) − ${logName}(b) = ${logName}(a/b)`)}): ${mark(`${logName}(${beautify(combined)}) = ${beautify(rhsExp)}`)}`);
      steps.push(`Rewrite in exponential form: ${beautify(combined)} = ${base}^${/^[\w.]+$/.test(rhsExp) ? rhsExp : `(${rhsExp})`}${prettyExp(rhsValue) !== beautify(rhsExp) && !/^\d+(?:\.\d+)?$/.test(rhsExp) ? ` = ${prettyExp(beautify(rhsValue))}` : ''}`);
      const poly = denText ? `(${numText}) - (${rhsValue})*(${denText})` : `(${numText}) - (${rhsValue})`;
      const rootsRaw = String(Algebrite.run(`roots(${poly}, ${v})`)).trim();
      if (!rootsRaw || /stop|error|nil/i.test(rootsRaw)) return null;
      if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
      candidates = parseRootsList(rootsRaw);
      if (candidates.length === 0) return null;
      steps.push(`Solve ${mark(`${beautify(poly)} = 0`)}: ${mark(candidates.map((x) => `${v} = ${prettyExp(prettyRadicals(x.display))}`).join(' or '))}`);
    }

    // Domain and verification: every argument positive, and the original
    // equation balanced, before a candidate is reported.
    const kept = [];
    const rejected = [];
    for (const c of candidates) {
      const show = prettyExp(prettyRadicals(c.display));
      if (!Number.isFinite(c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} is not real`); continue; }
      if (!argumentPositive(c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} makes a logarithm's argument zero or negative`); continue; }
      if (!satisfiesEquation(equation, v, c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} does not balance the original equation`); continue; }
      if (kept.some((k) => Math.abs(k.numeric - c.numeric) < 1e-9)) continue;
      kept.push({ display: show, numeric: c.numeric });
    }
    if (rejected.length > 0) {
      steps.push(`A logarithm is defined only for a positive argument, so check each candidate in the original equation: ${rejected.join('; ')} — rejected.`);
    }
    const answer = kept.length > 0
      ? kept.map((k) => `${v} = ${k.display}${/^-?\d+(?:\.\d+)?$/.test(k.display) ? '' : ` (≈ ${formatNumber(k.numeric)})`}`).join('  or  ')
      : 'No solution (every candidate makes a logarithm argument zero or negative)';
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: kept.map((k) => k.numeric) };
  } catch {
    return null;
  }
}

/**
 * Every root of a polynomial, for when Algebrite's symbolic output is
 * malformed, partial or missing. polynomialRoots.js reads the polynomial
 * exactly, counts its real roots by Sturm's theorem (so none can be missed,
 * however close together), locates each by exact bisection, and lists the
 * non-real ones only if they verify. Returns { steps, answer, solutions },
 * { envelope } (an honest refusal) past the supported degree, or null when
 * the input is not a polynomial with rational coefficients.
 */
// Past this degree a polynomial equation skips Algebrite (see solveWithAlgebriteRoots).
const ALGEBRITE_DEGREE_LIMIT = 12;

// Highest-first coefficient strings → "x^3 - 6x^2 + 11x - 6".
function polynomialText(coeffs, v) {
  const n = coeffs.length - 1;
  const parts = [];
  coeffs.forEach((c, i) => {
    const text = String(c);
    if (text === '0') return;
    const power = n - i;
    const neg = text.startsWith('-');
    const mag = neg ? text.slice(1) : text;
    const coef = mag === '1' && power > 0 ? '' : mag;
    const term = power === 0 ? mag : `${coef}${v}${power > 1 ? `^${power}` : ''}`;
    parts.push(parts.length === 0 ? `${neg ? '-' : ''}${term}` : `${neg ? '- ' : '+ '}${term}`);
  });
  return parts.length ? parts.join(' ') : '0';
}
const signedList = (items) => items.map((t) => (String(t).startsWith('-') ? `(${t})` : String(t)));

// x³ − 6x² + 11x − 6 = 0, worked: factor out x if the constant term is 0,
// list the Rational Root Theorem candidates, test them by substitution,
// divide synthetically by each root found, and solve what remains — a
// quadratic by the formula (exactly, surds and complex pairs kept), or a
// factor with no rational root by the exact numeric finder. Returns
// { steps, answer, solutions } or null when the shape is not suitable.
function solveByRationalRoots(Algebrite, target, v, read, leadingSteps) {
  const fac = factorByRationalRoots(read);
  if (!fac) return null;
  const steps = [...leadingSteps];
  const shown = []; // { display, numeric, sign }
  const pow = (k) => (k === 1 ? v : `${v}^${k}`);
  const afterX = polynomialText(fac.coefficients, v);
  if (fac.xPower > 0) {
    steps.push(`Every term has a factor of ${pow(fac.xPower)}: factor it out — ${pow(fac.xPower)}·(${afterX}) = 0 — so ${v} = 0 is a root${fac.xPower > 1 ? ` (multiplicity ${fac.xPower})` : ''}, and the other factor is solved on its own.`);
    shown.push({ display: '0', numeric: 0, sign: '=', multiplicity: fac.xPower });
  }
  if (fac.degree >= 3) {
    const name = fac.degree === 3 ? 'a cubic' : fac.degree === 4 ? 'a quartic' : `degree ${fac.degree}`;
    const list = fac.candidates.length > 16 ? `${fac.candidates.slice(0, 16).join(', ')}, …` : fac.candidates.join(', ');
    steps.push(`${mark(`${afterX} = 0`)} is ${name}. Rational Root Theorem: any rational root ${mark('p/q')} has ${mark('p')} dividing the constant term ${mark(fac.constant)} and ${mark('q')} dividing the leading coefficient ${mark(fac.leading)}, so the only possible rational roots are ${mark(list)}.`);
    let currentText = afterX;
    for (const round of fac.rounds) {
      const failed = round.trials.filter((t) => !t.isRoot);
      const shownFailed = failed.slice(0, 5).map((t) => `p(${t.text}) = ${t.value}`);
      const more = failed.length > 5 ? `, … (${failed.length - 5} more fail)` : '';
      const r = round.root.text;
      // (x − r) reads as (x + 3) for r = −3.
      const factorText = r.startsWith('-') ? `(${v} + ${r.slice(1)})` : `(${v} − ${r})`;
      steps.push(`Test the candidates in ${mark(`p(${v}) = ${currentText}`)}: ${shownFailed.length ? `${shownFailed.map(mark).join(', ')}${more}; ` : ''}${mark(`p(${r}) = 0`)} ✓ — so ${mark(`${v} = ${r}`)} is a root and ${mark(factorText)} is a factor.`);
      const work = round.products.map((prod, i) => `${mark(`${signedList([r])[0]}·${signedList([round.bottom[i]])[0]} = ${prod}`)}, then ${mark(`${signedList([round.top[i + 1]])[0]} + ${signedList([prod])[0]} = ${round.bottom[i + 1]}`)}`);
      const quotientText = polynomialText(round.quotient, v);
      steps.push(`Synthetic division by ${mark(factorText)}, using ${mark(`r = ${r}`)}: write the coefficients ${mark(signedList(round.top).join(', '))}; bring down ${mark(round.top[0])}; ${work.join('; ')}. The last number is the remainder, ${mark('0')} ✓, and the rest are the quotient: ${mark(quotientText)}.`);
      shown.push({ display: round.root.text, numeric: Number(round.root.m) / Number(round.root.d), sign: '=' });
      currentText = quotientText;
    }
  }
  // What is left after x^k and the rational roots: solved whatever its
  // degree. Only a remainder of degree 3 or more was solved before, so
  // x^3 - 4x = 0 (x·(x² − 4)) was answered x = 0 alone (October 26).
  const remDegree = fac.remaining.length - 1;
  const remText = polynomialText(fac.remaining.map((f) => (f.d === 1n ? String(f.s * f.n) : `${f.s < 0 ? '-' : ''}${f.n}/${f.d}`)), v);
  if (remDegree === 2) {
    steps.push(`The remaining factor is a quadratic: ${mark(`${remText} = 0`)}.`);
    let rootsRaw = '';
    try { rootsRaw = Algebrite.roots(remText, v).toString(); } catch { rootsRaw = ''; }
    const derivation = quadraticDerivation(Algebrite, remText, v);
    if (derivation) steps.push(...derivation);
    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    // i*√3 reads as i√3.
    const tidy = (d) => prettyRadicals(d).replace(/i\*√/g, 'i√');
    // A double root (zero discriminant) is reported once: it counts twice.
    for (const root of roots) shown.push({ display: tidy(root.display), numeric: root.numeric, sign: '=', multiplicity: roots.length === 1 ? 2 : 1 });
    const names = roots.map((root) => `${v} = ${tidy(root.display)}`).join(' or ');
    steps.push(`So the quadratic gives ${names}.`);
  } else if (remDegree === 1) {
    const [b, c] = fac.remaining;
    const root = c.neg().div(b);
    const rootText = root.d === 1n ? String(root.s * root.n) : `${root.s < 0 ? '-' : ''}${root.n}/${root.d}`;
    steps.push(`The remaining factor is linear: ${remText} = 0, so ${v} = ${rootText}.`);
    shown.push({ display: rootText, numeric: Number(root.valueOf()), sign: '=' });
  } else if (remDegree >= 3) {
    steps.push(`No rational root remains: every candidate fails for ${remText}. Its roots cannot be written in a closed form here, so they are found numerically.`);
    const numeric = rootsViaPolynomialRoot(Algebrite, `(${remText}) - (0)`, v);
    if (!numeric || numeric.envelope) return null;
    // Its own "degree-n polynomial … Sturm …" steps, minus the solution line.
    steps.push(...numeric.steps.filter((line) => !/^Solution:/.test(line)));
    // The finder's own answer may open with "no real solutions;" when
    // every remaining root is complex — the rational ones already listed
    // are the real solutions, so only its count clause is kept.
    const rest = numeric.answer.replace(/^no real solutions;\s*/, '');
    const sortedShown = mergeRepeated(shown).sort((a, b) => a.numeric - b.numeric);
    const answer = /^plus \d+ complex/.test(rest)
      ? `${sortedShown.map(line).join('  or  ')};  ${rest}`
      : [...sortedShown.map(line), rest].join('  or  ');
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: [...shown.map((r) => r.numeric).filter(Number.isFinite), ...(numeric.solutions || [])] };
  }
  if (shown.length === 0) return null;
  // Real roots in ascending order, then the complex pair(s); a root found
  // twice (x = 2 from two rounds of division) is one root of multiplicity 2.
  const merged = mergeRepeated(shown);
  const reals = merged.filter((r) => Number.isFinite(r.numeric)).sort((a, b) => a.numeric - b.numeric);
  const others = merged.filter((r) => !Number.isFinite(r.numeric));
  const answer = [...reals, ...others].map(line).join('  or  ');
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: reals.map((r) => r.numeric) };

  function line(r) {
    return `${v} ${r.sign} ${r.display}${r.multiplicity > 1 ? ` (multiplicity ${r.multiplicity})` : ''}`;
  }
}

// The same root listed more than once — "x = 2 or x = 2" — is one root with
// its multiplicities added.
function mergeRepeated(shown) {
  const out = [];
  for (const r of shown) {
    const same = out.find((o) => o.display === r.display || (Number.isFinite(o.numeric) && Number.isFinite(r.numeric) && Math.abs(o.numeric - r.numeric) < 1e-12 && o.sign === '=' && r.sign === '='));
    if (same) same.multiplicity = (same.multiplicity || 1) + (r.multiplicity || 1);
    else out.push({ ...r });
  }
  return out;
}

function rootsViaPolynomialRoot(Algebrite, polynomial, variable, extraSteps = []) {
  const poly = readPolynomial(polynomial, variable);
  if (!poly) return null;
  if (poly.tooHigh) {
    return {
      envelope: unsupported({
        input: polynomial,
        reason: `This polynomial has degree ${poly.degree}. MasterMath finds every root of polynomials up to degree ${MAX_POLYNOMIAL_DEGREE}; past that it cannot guarantee a complete list, so it gives none rather than a partial one.`,
        answer: `Degree ${poly.degree} is above the supported limit (${MAX_POLYNOMIAL_DEGREE}) for a guaranteed-complete list of roots`,
        tips: ['Factor out any common factor first, or check whether the equation simplifies to a lower degree.'],
      }),
    };
  }
  if (poly.degree < 1) return null;
  const { real, complex, complexCount, degree } = allRoots(poly);
  const multiplicity = (m) => (m > 1 ? ` (multiplicity ${m})` : '');
  // A root that is exactly a rational is shown as one ("x = 1/3"); a root
  // only located numerically is marked ≈ — x(x−1)⋯(x−20) + x has a root at
  // 20 − 7×10⁻¹², and "x = 20" would be false (outside review, October 2026).
  const rational = ({ m, d }) => (d === 1n ? String(m) : `${m}/${d}`);
  const realShown = real.map((r) => (r.exact
    ? { display: rational(r.exact), sign: '=', multiplicity: r.multiplicity, numeric: r.value }
    : { display: formatNumber(r.value), sign: '≈', multiplicity: r.multiplicity, numeric: r.value }));
  const gaussian = ({ re, im }) => {
    const rePart = re.m === 0n ? '' : rational(re);
    const imAbs = { m: im.m < 0n ? -im.m : im.m, d: im.d };
    const imPart = `${imAbs.m === 1n && imAbs.d === 1n ? '' : rational(imAbs)}i`;
    return rePart ? `${rePart} ${im.m < 0n ? '-' : '+'} ${imPart}` : `${im.m < 0n ? '-' : ''}${imPart}`;
  };
  const complexShown = (complex || []).map((z) => (z.exact
    ? { display: gaussian(z.exact), sign: '=', multiplicity: z.multiplicity }
    : { ...formatComplexRoot(z), sign: '≈', multiplicity: z.multiplicity }));
  const line = (r) => `${variable} ${r.sign} ${r.display}${multiplicity(r.multiplicity)}`;
  // As formatSolutions: past a handful of complex roots, list the real ones
  // and count the rest — 98 decimal pairs is not an answer anyone can read.
  const listComplex = complex !== null && complexShown.length <= 4 && realShown.length + complexShown.length <= 8;
  let answer;
  if (complexCount === 0 || listComplex) {
    const parts = [...realShown, ...complexShown].map(line);
    if (parts.length === 0) return null;
    answer = parts.join('  or  ');
  } else {
    const realText = realShown.length ? realShown.map(line).join('  or  ') : 'no real solutions';
    answer = `${realText};  plus ${complexCount} complex solutions (not listed)`;
  }
  const realCount = real.reduce((n, r) => n + r.multiplicity, 0);
  const counted = `${real.length === 0 ? 'no' : real.length} distinct real root${real.length === 1 ? '' : 's'}${realCount > real.length ? ` (${realCount} counting multiplicity)` : ''}`;
  // The first approximate root whose decimal display reads as a simple
  // number: say what that number actually gives, so ≈ is not read as =.
  const approxNote = (() => {
    const shown = realShown.find((r) => r.sign === '≈' && /^-?\d+(?:\.\d+)?$/.test(r.display));
    if (!shown) return [];
    const at = valueAtDecimal(poly, shown.display);
    if (!at || at.equals(0)) return [];
    const v = Number(at.valueOf());
    // Small values in scientific notation, so "0.00000012" never rounds to "0".
    const sup = (t) => String(t).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
    const shownValue = Math.abs(v) >= 1e-3 && Math.abs(v) < 1e6
      ? (at.d === 1n ? String(at.s * at.n) : formatNumber(v))
      : v.toExponential(2).replace(/e([+-]?\d+)/, (_, e) => `×10${sup(Number(e))}`);
    return [`Roots marked ≈ were located numerically and are not exactly the number shown: substituting ${variable} = ${shown.display} gives ${shownValue}, not 0. The number shown is rounded to ${getSettings().decimalPlaces} decimals; MasterMath located the root itself to within 10⁻¹².`];
  })();
  const steps = [
    ...(/\)\s*-\s*\(0\)$/.test(polynomial) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
    ...extraSteps,
    `This is a degree-${degree} polynomial, so it has exactly ${degree} roots counted with multiplicity. MasterMath cannot write them in exact form, so they are found numerically.`,
    `Real roots: Sturm's theorem counts them exactly — ${counted} — and each is located by bisection to 12 significant digits, so none is missed even when roots lie very close together.${real.some((r) => r.exact) ? ' A root shown with = was confirmed exact by substitution.' : ''}`,
    ...approxNote,
    ...(complexCount === 0 ? [] : [complex === null
      ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real; ${complexCount === 1 ? 'it' : 'they'} could not be computed to a value MasterMath can verify, so only the count is given.`
      : listComplex
        ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real, found by Durand–Kerner iteration and each checked by substitution.`
        : `The remaining ${complexCount} roots are non-real (found by Durand–Kerner iteration and each checked by substitution); that many decimal pairs would not be a readable answer, so they are counted rather than listed.`]),
    `Solution: ${answer}`,
  ];
  return { steps, answer, solutions: real.map((r) => cleanNumber(r.value)) };
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
export function splitRootsList(raw) {
  const trimmed = String(raw).trim().replace(/^\[|\]$/g, '');
  return trimmed ? splitTopLevel(trimmed, ',').filter(Boolean) : [];
}

// Do the listed roots, with their multiplicities, add up to the polynomial's
// degree? A root's multiplicity is the number of successive derivatives that
// vanish there, checked exactly by Algebrite; the degree comes from an exact
// read of the polynomial (polynomialRoots.js), with no cap that silently
// passes a higher degree. Degree ≤ 2 is not checked (Algebrite's quadratic
// roots are complete), nor is anything that is not a polynomial (the other
// paths verify their own answers). A shortfall sends the polynomial to
// rootsViaPolynomialRoot, which finds every root; a multiplicity Algebrite
// cannot simplify to zero is undercounted, which errs the same safe way.
function rootsAccountForDegree(Algebrite, poly, variable, rootsRaw) {
  const read = readPolynomial(poly, variable);
  if (!read) return true;
  // Past the exact reader's limit the degree is the parse-tree bound — an
  // upper bound, so a list that reaches it is certainly complete
  // (x^100 = 1: all 100 roots of unity).
  const { degree } = read;
  if (degree <= 2) return true;
  const roots = [...new Set(splitRootsList(rootsRaw).map((r) => r.trim()))];
  // As many distinct roots as the degree: complete by counting alone, with no
  // multiplicity to check (a polynomial cannot have more roots than that).
  if (roots.length >= degree) return true;
  let counted = 0;
  for (const r of roots) {
    let multiplicity = 0;
    let derivative = poly;
    while (multiplicity < degree) {
      let value;
      try { value = String(Algebrite.run(`simplify(subst((${r}), ${variable}, ${derivative}))`)).trim(); } catch { break; }
      if (value !== '0') break;
      multiplicity += 1;
      derivative = `d(${derivative}, ${variable})`;
    }
    counted += Math.max(multiplicity, 1);
  }
  return counted >= degree;
}

export function parseRootsList(raw) {
  return splitRootsList(raw).map((part) => {
    const display = beautify(part.trim());
    let numeric = NaN;
    try {
      const value = math.evaluate(part.trim());
      // A real root Algebrite wrote in complex form (the ±1 among the roots
      // of x^100 = 1 come back as cos·cos − i·(…) with the i-terms cancelling).
      numeric = typeof value === 'number' ? value
        : (value && typeof value === 'object' && Number.isFinite(value.re) && Math.abs(value.im) < 1e-9) ? value.re : NaN;
    } catch {
      numeric = NaN;
    }
    return { display, numeric };
  });
}

// Does x balance the equation? A side that cannot be evaluated at x is not a
// disproof (the extraneous-root check deals with undefined sides); only a
// finite, clearly unequal pair of sides says "wrong".
function satisfiesEquation(equation, variable, x) {
  const [lhs, rhs = '0'] = equation.split('=');
  try {
    const l = math.evaluate(lhs, { [variable]: x });
    const r = math.evaluate(rhs, { [variable]: x });
    if (typeof l !== 'number' || typeof r !== 'number' || !Number.isFinite(l) || !Number.isFinite(r)) return true;
    return Math.abs(l - r) <= 1e-6 * (1 + Math.abs(l) + Math.abs(r));
  } catch {
    return true;
  }
}

// Algebrite writes √2 as 2^(1/2) and (3 − √5)/2 as 3/2 - 1/2*5^(1/2). Show the
// textbook form; the value is untouched.
export function prettyRadicals(display) {
  let s = String(display);
  s = s.replace(/(\d+)\^\(1\/2\)/g, '√$1');
  s = s.replace(/\b1\/(\d+)\*√(\d+)/g, '√$2/$1');
  s = s.replace(/\b(\d+)\/(\d+)\*√(\d+)/g, '$1√$3/$2');
  s = s.replace(/\b(\d+)\*√(\d+)/g, '$1√$2');
  s = s.replace(/^(-?\d+)\/(\d+) ([+-]) √(\d+)\/\2$/, '($1 $3 √$4)/$2');
  s = s.replace(/^(-?\d+)\/(\d+) ([+-]) (\d+)√(\d+)\/\2$/, '($1 $3 $4√$5)/$2');
  return prettyComplex(s.replace(/i\*√/g, 'i√'));
}

// a/b ± (c/e)·i·√n over one denominator: -3/4 - 1/4*i√31 → (-3 - i√31)/4,
// -1/2 + 1/2*i√3 → (-1 + i√3)/2, 1 + 2*i → 1 + 2i (October 2026: complex
// quadratic roots read "-3/4 - 1/4*i*√31").
function prettyComplex(display) {
  const m = String(display).match(/^(-?\d+)(?:\/(\d+))? ([+-]) (?:(\d+)(?:\/(\d+))?\*)?i(?:√(\d+))?$/);
  if (!m) return display;
  const [, a, b = '1', sign, c = '1', e = '1', n] = m;
  const den = (Number(b) * Number(e)) / (gcdInt(Number(b), Number(e)) || 1);
  const re = (Number(a) * den) / Number(b);
  const im = (Number(c) * den) / Number(e);
  const imText = `${im === 1 ? '' : im}i${n ? `√${n}` : ''}`;
  return den === 1 ? `${re} ${sign} ${imText}` : `(${re} ${sign} ${imText})/${den}`;
}
const gcdInt = (x, y) => (y === 0 ? Math.abs(x) : gcdInt(y, x % y));

function formatSolutions(roots, variable) {
  const displays = roots.map((r) => {
    // A plain integer/decimal root: show the clean numeric form.
    // Anything symbolic (radicals like 2^(1/2), complex like i) is kept exact.
    if (/^-?\d+(?:\.\d+)?$/.test(r.display)) {
      return formatNumber(r.numeric);
    }
    return prettyRadicals(r.display);
  });
  // A repeated root (x² = 0 → [0, 0]) is one solution, not two. Say once,
  // and note the multiplicity so the information isn't lost.
  const counts = new Map();
  for (const d of displays) counts.set(d, (counts.get(d) || 0) + 1);
  const unique = [...counts.keys()];
  const line = (d) => `${variable} = ${d}${counts.get(d) > 1 ? ` (repeated root, multiplicity ${counts.get(d)})` : ''}`;
  // x^100 = 1 has 2 real roots and 98 complex ones; listing all 100 as
  // trigonometric expressions is not an answer anyone can read. Past a
  // handful of complex roots, give the real ones and count the rest.
  const isComplex = (d) => /(?<![a-z])i(?![a-z])/.test(d);
  const complexOnes = unique.filter(isComplex);
  if (complexOnes.length > 4 || unique.length > 8) {
    // Real roots by value (Algebrite writes cos(π/50)… for the roots of
    // x^100 = 1; the two real ones are ±1), the rest counted.
    const reals = [];
    for (const r of roots) {
      if (Number.isFinite(r.numeric) && !reals.some((v) => Math.abs(v - r.numeric) < 1e-9)) reals.push(r.numeric);
    }
    const complexCount = roots.length - reals.length;
    const realText = reals.length ? reals.sort((a, b) => a - b).map((v) => `${variable} = ${formatNumber(v)}`).join('  or  ') : 'no real solutions';
    return `${realText};  plus ${complexCount} complex solutions (not listed)`;
  }
  return unique.map(line).join('  or  ');
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

// Factor an expression over the integers with Algebrite. The result is only
// claimed after two independent checks: a numeric equivalence sweep and a
// symbolic re-expansion (which doubles as the "check your work" step). If
// anything fails, return null so the caller falls back to the simplify path.
// Solve an equation for one variable in terms of the others: Algebrite's
// roots() accepts symbolic coefficients, so roots(y - 3 - 2x, y) → [2x+3].
// Returns "y = 2x + 3" (or "y = a  or  y = b"), or null.
async function solveForVariable(equation, target) {
  try {
    const Algebrite = await loadAlgebrite();
    const [l, r] = equation.split('=');
    const raw = String(Algebrite.roots(`(${l.trim()}) - (${r.trim()})`, target)).trim();
    if (!raw || /stop|error|nil|roots/i.test(raw)) return null;
    let parts = parseRootsList(raw).map((rt) => rt.display).filter(Boolean);
    if (parts.length === 0) return null;
    // Algebrite writes x² + y² = 25 as x = ±i·(y² − 25)^(1/2). Over the reals
    // that is ±(25 − y²)^(1/2): rewrite i·(A)^(1/2) → (−A)^(1/2), simplifying
    // the negated radicand, so the answer reads as real algebra.
    parts = parts.map((d) => d.replace(/i\*\(([^()]*)\)\^\(1\/2\)/g, (m, inner) => {
      try {
        const neg = String(Algebrite.run(`simplify(-(${inner}))`)).trim();
        return neg && !/stop|error|nil/i.test(neg) ? `(${neg})^(1/2)` : m;
      } catch { return m; }
    }));
    const real = realRelation(parts, equation, target, Algebrite) || evenPowerRelation(equation, target, Algebrite);
    if (!real) return null;
    return { relation: real.roots.map((d) => `${target} = ${d}`).join('  or  '), droppedComplex: real.droppedComplex };
  } catch {
    return null;
  }
}

// Over the reals, in textbook form: x = ±√(25 − y²), not Algebrite's
// "x = -(-y^2+25)^(1/2)  or  x = (-y^2+25)^(1/2)", and a cubic's two
// complex roots are dropped (x and y are real): x³ + y³ = 1 gives
// x = ∛(1 − y³) alone. Every root shown is substituted back into the
// equation at sample values of the other unknowns; one that fails anywhere
// it is real, or is real nowhere, is not shown. Null when none survives.
const IMAGINARY = /(?<![a-z])i(?![a-z])/;
function positiveFirst(expr) {
  const terms = splitTerms(expr);
  const k = terms.findIndex((t) => !t.signed.startsWith('-'));
  if (k <= 0) return beautify(expr);
  const ordered = [terms[k], ...terms.filter((_, i) => i !== k)];
  return beautify(ordered.map((t, i) => (i === 0 ? t.term : t.signed.startsWith('-') ? ` - ${t.signed.slice(1)}` : ` + ${t.term}`)).join(''));
}
// A radicand reads positive-first and with a plain divisor: "-y+7" → "7 - y",
// "1/3*(-y+7)" → "(7 - y)/3".
function tidyRadicand(inner) {
  const scaled = String(inner).replace(/\s+/g, '').match(/^1\/(\d+)\*\((.*)\)$/);
  if (scaled && matchingParen(`(${scaled[2]})`, 0) === scaled[2].length + 1) return `(${positiveFirst(scaled[2])})/${scaled[1]}`;
  return positiveFirst(inner);
}
const radical = (n, radicand) => {
  const plain = /^[a-z0-9]+$/i.test(radicand);
  if (String(n) === '2' || String(n) === '3') return `${String(n) === '2' ? '√' : '∛'}${plain ? radicand : `(${radicand})`}`;
  return `${plain ? radicand : `(${radicand})`}^(1/${n})`;
};
function textbookRoot(display, Algebrite) {
  const d = String(display).replace(/\s+/g, '');
  // The whole root is one radical, possibly negated: ±√A, and −∛A = ∛(−A).
  // An odd root carries its sign inside: −∛A = ∛(−A), −(A)^(1/5) = (−A)^(1/5).
  const whole = d.match(/^(-)?\((.*)\)\^\(1\/(\d+)\)$/);
  if (whole && matchingParen(d, whole[1] ? 1 : 0) === d.length - (5 + whole[3].length) - 1) {
    let [, neg, inner, n] = whole;
    if (Number(n) % 2 === 1 && neg) {
      const negated = String(Algebrite.run(`simplify(-(${inner}))`)).trim();
      if (negated && !/stop|error|nil/i.test(negated)) { inner = negated; neg = ''; }
    }
    if (!(Number(n) % 2 === 1 && neg)) return { sign: neg ? '-' : '', body: radical(n, tidyRadicand(inner)) };
  }
  // A radical inside a sum or product: "-1/2*y + 1/2*(4+y^2)^(1/2)".
  let out = String(display);
  let guard = 0;
  let m;
  while ((m = out.match(/\(([^()]*)\)\^\(1\/(2|3)\)/)) && guard++ < 6) {
    out = out.replace(m[0], radical(m[2], tidyRadicand(m[1])));
  }
  return { sign: '', body: beautify(out) };
}
// Two roots that differ only in the sign before their radical are one ± root.
const plusMinusKey = (root) => root.replace(/ [+-] (?=(?:[\d/]+\*?)?[√∛])/, ' ± ');
const toMathjs = (s) => String(s).replace(/√\(/g, 'sqrt(').replace(/∛\(/g, 'cbrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)').replace(/∛([a-z0-9]+)/gi, 'cbrt($1)');
function rootHolds(root, equation, target) {
  const [l, r] = equation.split('=');
  const others = [...new Set((equation.replace(/\b(?:sin|cos|tan|sec|csc|cot|sqrt|abs|log|ln|exp|pi|e)\b/gi, '').match(/[a-z]/gi) || []).map((c) => c.toLowerCase()))].filter((v) => v !== target);
  const samples = [-2.3, -0.7, 0.4, 1.3, 2.9, 4.1];
  let held = 0;
  for (const v of samples) {
    const scope = Object.fromEntries(others.map((o, i) => [o, v + 0.37 * i]));
    let t;
    // A throw (nthRoot of a negative, an even root) means not real here.
    try { t = math.evaluate(toMathjs(root), scope); } catch { continue; }
    if (typeof t !== 'number' || !Number.isFinite(t)) continue; // not real here
    let residual;
    try { residual = math.evaluate(`(${l}) - (${r})`, { ...scope, [target]: t }); } catch { return false; }
    if (typeof residual !== 'number' || !Number.isFinite(residual)) continue;
    if (Math.abs(residual) > 1e-7 * (1 + Math.abs(t) ** 3)) return false;
    held += 1;
  }
  return held > 0;
}
// x appears only as x^k ("x^4 + y^2 = 16"): solve for u = x^k, then
// x = ±(u)^(1/k) for even k, (u)^(1/k) for odd k. Algebrite writes every
// root of the quartic with an i, real or not.
function evenPowerRelation(equation, target, Algebrite) {
  const powers = [...equation.matchAll(new RegExp(`(?<![a-z])${target}(?![a-z(])(\\^(\\d+))?`, 'gi'))].map((m) => Number(m[2] || 1));
  const k = powers[0];
  if (!powers.length || k < 2 || powers.some((p) => p !== k)) return null;
  const [l, r] = equation.split('=');
  const inU = `(${l.trim()}) - (${r.trim()})`.replace(new RegExp(`(?<![a-z])${target}\\^${k}`, 'gi'), '(u)');
  const raw = String(Algebrite.roots(inU, 'u')).trim();
  if (!raw || /stop|error|nil|roots/i.test(raw)) return null;
  const roots = [];
  for (const u of parseRootsList(raw).map((rt) => rt.display)) {
    if (IMAGINARY.test(u)) continue;
    const base = tidyRadicand(u);
    const body = radical(k, base);
    const signed = k % 2 === 0 ? `±${body}` : body;
    const halves = k % 2 === 0 ? [body, `-${body}`] : [body];
    const toCheck = (h) => h.replace(/\((.*)\)\^\(1\/(\d+)\)$/, 'nthRoot($1, $2)').replace(/^(-?)([a-z0-9]+)\^\(1\/(\d+)\)$/i, '$1nthRoot($2, $3)');
    if (halves.every((h) => rootHolds(toCheck(h), equation, target))) roots.push(signed);
  }
  return roots.length ? { roots, droppedComplex: false } : null;
}
function realRelation(parts, equation, target, Algebrite) {
  const realForm = parts.filter((d) => !IMAGINARY.test(d));
  const droppedComplex = realForm.length < parts.length;
  const shaped = realForm.map((d) => textbookRoot(d, Algebrite));
  // "−√A or √A" → "±√A"; "a − b·√A or a + b·√A" → "a ± b·√A".
  const roots = [];
  const halves = new Map(); // ± root → its two signed forms, each checked
  for (const r of shaped) {
    const twin = shaped.find((o) => o !== r && o.body === r.body && o.sign !== r.sign);
    const own = `${r.sign}${r.body}`;
    const pair = !twin && shaped.find((o) => o !== r && !o.sign && !r.sign && o.body !== r.body && plusMinusKey(o.body) === plusMinusKey(r.body) && plusMinusKey(r.body).includes('±'));
    if (twin) {
      const pm = `±${r.body}`;
      if (!roots.includes(pm)) { roots.push(pm); halves.set(pm, [r.body, `-${r.body}`]); }
    } else if (pair) {
      const pm = plusMinusKey(r.body);
      if (!roots.includes(pm)) { roots.push(pm); halves.set(pm, [r.body, pair.body]); }
    } else {
      roots.push(own);
    }
  }
  const checked = roots.filter((root) => (halves.has(root)
    ? halves.get(root).every((half) => rootHolds(half, equation, target))
    : rootHolds(root, equation, target)));
  return checked.length ? { roots: checked, droppedComplex } : null;
}

// "expand (x+1)^2" → x^2 + 2x + 1. Algebrite's expand, verified numerically.
async function expandExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const expanded = String(Algebrite.run(`expand(${expression})`)).trim();
    if (!expanded || /stop|error|nil/i.test(expanded)) return null;
    if (!expressionsNumericallyEqual(expression, expanded, extractVariable(expression))) return null;
    return {
      steps: [
        `Expand: ${beautify(expression)}`,
        'Multiply out every product of sums, then collect like terms.',
        `Result: ${beautify(expanded)} (confirmed numerically at several values).`,
      ],
      answer: beautify(expanded),
      tips: ['Expanding is the reverse of factoring; each term of one bracket multiplies each term of the other.', `${mark('(a + b)² = a² + 2ab + b²')} — the middle term is the one students drop.`],
      common_mistakes: [`Writing ${mark('(a + b)²')} as ${mark('a² + b²')}.`, 'Losing a sign when a bracket is subtracted.'],
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

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
      `${mark('a² − b² = (a − b)(a + b)')} — the difference-of-squares pattern.`,
      'Check a factorization by expanding it back out.',
    ];
    const commonMistakes = [
      'Stopping before the expression is fully factored.',
      'Sign errors inside the factors — expand to verify.',
      `Treating a sum of squares like a difference: ${mark('a² + b²')} does not factor over the reals.`,
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

// Where cancelling changed the domain: (x^2 - 1)/(x - 1) = x + 1 only for
// x ≠ 1. The points where a denominator of the original is zero but the
// simplified form is defined, exactly (Algebrite roots, each confirmed by
// evaluating the denominator there). Empty when nothing was cancelled away.
async function cancelledPoints(original, simplified, variable) {
  if (!/\//.test(original)) return [];
  const denominators = [];
  try {
    math.parse(original).traverse((node) => {
      if (node.isOperatorNode && node.op === '/' && node.args[1]) denominators.push(node.args[1].toString());
    });
  } catch {
    return [];
  }
  const Algebrite = await loadAlgebrite();
  const points = [];
  for (const den of denominators) {
    if (!new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(den)) continue;
    let raw;
    try { raw = String(Algebrite.roots(den, variable)).trim(); } catch { continue; }
    if (!raw || /stop|error|nil|roots/i.test(raw)) continue;
    for (const { display, numeric } of parseRootsList(raw)) {
      if (!Number.isFinite(numeric) || IMAGINARY.test(display)) continue;
      let d;
      let v;
      try {
        d = math.evaluate(den, { [variable]: numeric });
        v = math.evaluate(simplified, { [variable]: numeric });
      } catch { continue; }
      if (typeof d !== 'number' || Math.abs(d) > 1e-9) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (!points.some((q) => Math.abs(q.numeric - numeric) < 1e-9)) points.push({ display, numeric });
    }
  }
  return points.sort((p1, p2) => p1.numeric - p2.numeric);
}

async function simplifyExpression(expression) {
  // Exact-radical rung: a constant expression containing a radical should
  // answer in exact simplified form (sqrt(50) → 5√2), not a decimal.
  const exact = await exactRadicalForm(expression);
  if (exact) return exact;

  const variable = extractVariable(expression);
  const inputLen = complexity(expression);

  // A constant expression that nothing above could simplify (sqrt(-4),
  // (-8)^(1/3)) is still worth a value: evaluate it as arithmetic rather
  // than echoing the input back as the "simplified" answer.
  if (!hasVariable(expression, variable)) {
    try {
      const { solveArithmetic } = await import('./arithmeticSolver.js');
      const arith = solveArithmetic(parseMathExpression(expression));
      if (arith && arith.answer && String(arith.answer).replace(/\s/g, '') !== String(expression).replace(/\s/g, '')) {
        return arith;
      }
    } catch { /* fall through to the symbolic candidates */ }
  }

  // Gather candidate simplifications and keep only those that are genuinely
  // equal to the input. An engine can "simplify" (x^2-9)/(x+3) into the
  // LONGER split form x^2/(x+3) - 9/(x+3) where Algebrite cancels it to x-3,
  // so we pick the SHORTEST verified-equivalent candidate and a result is
  // never longer than what the student typed. A polynomial's expanded form
  // wins ties: "simplify 2(x + 3) + 4x" means 6x + 6, not 6(x + 1).
  const candidates = [];
  const polynomial = await expandPolynomial(expression, variable);
  if (polynomial) candidates.push({ source: 'expand', answer: polynomial.answer, steps: polynomial.steps });
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

  // No engine produced anything. If the input does not even parse, that is a
  // syntax problem and must be reported as one — echoing "x^2 + *3 is already
  // in simplest form" under a solved status was the July F1 class surviving in
  // this one path (September 2026 audit row A02).
  if (candidates.length === 0) {
    try {
      math.parse(expression);
    } catch (err) {
      const detail = String(err?.message || '').replace(/\s*\(char \d+\)\s*$/, '');
      return parseError({
        input: expression,
        hint: detail ? `${detail}.` : 'The expression contains an operator sequence that cannot be read.',
      });
    }
  }

  // Best = shortest; on a tie prefer the expanded polynomial and its steps.
  candidates.sort((a, b) => {
    const d = complexity(a.answer) - complexity(b.answer);
    if (d !== 0) return d;
    return (a.source === 'expand' ? -1 : 0) - (b.source === 'expand' ? -1 : 0);
  });
  const best = candidates[0];

  let steps;
  let answer;
  let cancelled = false;
  if (best && complexity(best.answer) < inputLen) {
    // A real simplification. A polynomial shows its expansion and combining;
    // anything else gets a clean three-line derivation.
    answer = best.answer;
    // A fraction whose denominator has the variable is simplified by
    // cancelling, whichever engine found the answer ((x^3 - x)/(x^2 - 1) was
    // "Multiply out the parentheses: x").
    const factoring = /\/\s*\(?[^)]*[a-z]/i.test(expression) ? await fractionFactoring(expression, variable) : null;
    if (factoring) cancelled = true;
    if (best.steps && !factoring) {
      steps = best.steps;
    } else {
      steps = [
        `Original expression: ${mark(beautify(expression))}`,
        ...(factoring || [/\//.test(expression)
          ? 'Factor and cancel the common factor(s).'
          : 'Combine like terms and simplify.']),
        `Simplified form: ${mark(answer)}`,
      ];
    }
    // A cancelled factor was zero somewhere: the original is undefined
    // there and the simplified form is not, so they are equal only away
    // from those points, as a textbook says.
    const excluded = await cancelledPoints(expression, answer, variable);
    if (excluded.length) {
      cancelled = true;
      const list = excluded.map((q) => `${variable} ≠ ${q.display}`).join(', ');
      steps.push(`The original divides by zero at ${excluded.map((q) => mark(`${variable} = ${q.display}`)).join(' and ')}, where the simplified form does not, so the two are equal only for ${excluded.map((q) => mark(`${variable} ≠ ${q.display}`)).join(' and ')}.`);
      answer = `${answer}, for ${list}`;
    }
  } else {
    // A polynomial that is already expanded may still factor, and that is
    // usually what a student typing x^2 - 5x + 6 under Algebra wants: it
    // was echoed back unchanged (October 2026 review). Both forms are given.
    const polynomial = !/[a-z]{2,}/i.test(expression) && !/\/\s*(?:\([^)]*[a-z]|[a-z])/i.test(expression) && /[a-z]\s*\^\s*\d/i.test(expression);
    const factored = polynomial ? await factorExpression(expression) : null;
    if (factored && !/no simpler factors/.test(factored.answer)) {
      return {
        ...factored,
        steps: [
          `${mark(beautify(expression))} is already simplified: expanded, with like terms combined. It does factor, though:`,
          ...factored.steps.slice(1),
        ],
        answer: `${beautify(expression)} = ${factored.answer}`,
      };
    }
    answer = beautify(expression);
    steps = [`The expression ${beautify(expression)} is already in simplest form.`];
  }

  return {
    steps,
    answer,
    tips: cancelled ? CANCEL_TIPS : SIMPLIFY_TIPS,
    common_mistakes: cancelled ? CANCEL_MISTAKES : SIMPLIFY_MISTAKES,
    graph: generateAlgebraGraph(expression),
  };
}

// N/D with polynomial N and D: each factored (Algebrite, degree ≤ 6), and the
// factors they share named, as the cancellation is taught. Null when the
// expression is not one such fraction, nothing is shared, or factoring fails.
async function fractionFactoring(expression, variable) {
  const parts = splitTopLevel(String(expression), '/');
  if (parts.length !== 2) return null;
  const [num, den] = parts.map((t) => stripOuterParens(t.trim()));
  const isPoly = (t) => /^[\d\s+\-*^().a-z]*$/i.test(t) && !/[a-z]{2,}/i.test(t);
  if (!isPoly(num) || !isPoly(den)) return null;
  try {
    const Algebrite = await loadAlgebrite();
    const degree = (t) => Number(String(Algebrite.run(`deg(${t}, ${variable})`)).trim());
    if (!(degree(num) <= 6 && degree(den) <= 6)) return null;
    const factorText = (t) => beautify(String(Algebrite.run(`factor(${t}, ${variable})`)).trim()).replace(/\)\*\(/g, ')(').replace(/(^|[^\w)])(\w+)\*\(/g, '$1$2(');
    const fn = factorText(num);
    const fd = factorText(den);
    const common = beautify(String(Algebrite.run(`gcd(${num}, ${den})`)).trim());
    if (isAlgebriteFailure(fn) || isAlgebriteFailure(fd) || !common || /^-?\d+$/.test(common)) return null;
    const show = (t) => (/[+\-]/.test(t.replace(/^-/, '')) && !/^\(.*\)$/.test(t) ? `(${t})` : t);
    return [
      `Factor the numerator: ${mark(`${beautify(num)} = ${fn}`)}.`,
      beautify(den) === fd ? `The denominator ${mark(fd)} is already factored.` : `Factor the denominator: ${mark(`${beautify(den)} = ${fd}`)}.`,
      `Cancel the common factor${/\)\s*\(|\)\^/.test(factorText(common)) ? 's' : ''} ${mark(show(factorText(common)))} from the top and the bottom.`,
    ];
  } catch {
    return null;
  }
}

// A polynomial in the variable (nothing but numbers in any denominator),
// expanded by Algebrite, with the working: each top-level term multiplied out,
// then like terms combined. Null for anything that is not a polynomial.
async function expandPolynomial(expression, variable) {
  if (/[a-z]{2,}/i.test(expression)) return null; // function calls
  if (/[a-z]/i.test(expression.replace(new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'gi'), ''))) return null; // other letters
  try {
    const Algebrite = await loadAlgebrite();
    const denominator = String(Algebrite.run(`denominator(${expression})`)).trim();
    if (hasVariable(denominator, variable) || /nil|error|stop/i.test(denominator)) return null;
    const expand = (e) => {
      const out = String(Algebrite.run(`expand(${e})`)).trim();
      if (!out || /nil|error|stop/i.test(out)) throw new Error('expand failed');
      return out;
    };
    const answer = beautify(expand(expression));
    if (!equivalentOrConstant(expression, answer, variable)) return null;
    const terms = splitTerms(expression);
    const multiplied = beautify(terms.map((t) => `(${t.signed.includes('(') ? expand(t.signed) : t.signed})`).join(' + ')
      .replace(/\(([^()]*)\)/g, '$1'));
    const steps = [];
    if (expression.includes('(')) {
      steps.push(`Multiply out the parentheses: ${multiplied}`);
      if (complexity(multiplied) !== complexity(answer)) steps.push(`Combine like terms: ${answer}`);
    } else {
      steps.push(`${terms.length > 1 ? 'Combine like terms' : 'Simplify'}: ${answer}`);
    }
    return { answer, steps };
  } catch {
    return null;
  }
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
    // Algebrite writes x/2 as 1/2*x; show it the textbook way.
    const pretty = beautify(out)
      .replace(/(?<![\w^/.)])1\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$2/$1')
      .replace(/(?<![\w^/.)])(\d+)\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$1$3/$2');
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
  `Factor out the largest perfect square: ${mark('√50 = √25 · √2 = 5√2')}.`,
  'A radical is in simplest form when nothing under it has a square factor left.',
  `${mark('√(a·b) = √a · √b')}, but ${mark('√(a + b)')} is NOT ${mark('√a + √b')}.`,
];

const RADICAL_MISTAKES = [
  `Splitting a radical across addition: ${mark('√(a + b) ≠ √a + √b')}.`,
  `Missing the largest square factor (${mark('√72 = 6√2')}, not ${mark('2√18')}).`,
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

const numericText = (t) => /^-?\d+(?:\/\d+)?(?:\.\d+)?$/.test(String(t).trim());
const asNumber = (t) => {
  try {
    const v = math.evaluate(String(t));
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

// The working for a quadratic with numeric coefficients: x² = c and the
// square root of both sides (with √(−1) = i named when c < 0), or a, b, c,
// the discriminant and the quadratic formula. "Solve for x by finding the
// roots" told a student nothing. Null when the polynomial is not a plain
// quadratic; the roots themselves come from Algebrite either way.
function quadraticDerivation(Algebrite, poly, v) {
  try {
    if (/[a-wyz]{2,}/i.test(String(poly).replace(new RegExp(v, 'g'), ''))) return null; // function names: not a plain polynomial
    if (String(Algebrite.run(`deg(${poly}, ${v})`)).trim() !== '2') return null;
    const [a, b, c] = [2, 1, 0].map((k) => String(Algebrite.run(`coeff(${poly}, ${v}, ${k})`)).trim());
    if (![a, b, c].every(numericText)) return null;
    const A = asNumber(a);
    const B = asNumber(b);
    const C = asNumber(c);
    const expanded = beautify(String(Algebrite.run(`expand(${poly})`)));
    const lines = [];
    if (B === 0) {
      const rhs = String(Algebrite.run(`simplify(-(${c})/(${a}))`)).trim();
      const R = asNumber(rhs);
      lines.push(`Isolate ${mark(`${v}^2`)}: ${mark(`${expanded} = 0`)} gives ${mark(`${v}^2 = ${beautify(rhs)}`)}.`);
      if (R < 0) {
        const mag = String(Algebrite.run(`simplify(${-R === Math.round(-R) ? Math.round(-R) : `(${rhs})*(-1)`}^(1/2))`)).trim();
        const magShown = prettyRadicals(beautify(mag));
        lines.push(`Take the square root of both sides: ${mark(`${v} = ±√(${beautify(rhs)})`)}. A negative number has no real square root; with ${mark('i = √(−1)')}, ${mark(`√(${beautify(rhs)}) = √${-R === Math.round(-R) ? Math.round(-R) : `(${-R})`}·√(−1) = ${magShown === '1' ? '' : magShown}i`)}.`);
      } else if (R === 0) {
        lines.push(`Take the square root of both sides: ${mark(`${v} = 0`)} (a repeated root).`);
      } else {
        const rootShown = prettyRadicals(beautify(String(Algebrite.run(`simplify((${rhs})^(1/2))`)).trim()));
        lines.push(`Take the square root of both sides — remembering both signs: ${mark(`${v} = ±√(${beautify(rhs)}) = ±${rootShown}`)}.`);
      }
      return lines;
    }
    if (A === 1) {
      const factoring = factoringLines(B, C, v, expanded);
      if (factoring) return factoring;
    }
    const D = String(Algebrite.run(`(${b})^2 - 4*(${a})*(${c})`)).trim();
    const Dn = asNumber(D);
    lines.push(`This is a quadratic in ${mark(v)}: ${mark(`${expanded} = 0`)}, with ${mark(`a = ${beautify(a)}, b = ${beautify(b)}, c = ${beautify(c)}`)}.`);
    lines.push(`Discriminant: ${mark(`b² − 4ac = (${beautify(b)})² − 4(${beautify(a)})(${beautify(c)}) = ${beautify(D)}`)}${Dn < 0 ? ' — negative, so the two roots are a complex conjugate pair' : Dn === 0 ? ' — zero, so there is one repeated root' : ''}.`);
    const sqrtD = prettyRadicals(beautify(String(Algebrite.run(`simplify((${D})^(1/2))`)).trim()));
    const negB = beautify(String(Algebrite.run(`-(${b})`)).trim());
    const twoA = beautify(String(Algebrite.run(`2*(${a})`)).trim());
    lines.push(`Quadratic formula: ${mark(`${v} = (−b ± √(b² − 4ac))/(2a) = (${negB} ± √(${beautify(D)}))/${twoA}${sqrtD !== `√${beautify(D)}` && sqrtD !== `√(${beautify(D)})` ? ` = (${negB} ± ${sqrtD})/${twoA}` : ''}`)}.`);
    return lines;
  } catch {
    return null;
  }
}

// sqrt(R) = S: isolate the radical, state the domain (R ≥ 0, and S ≥ 0
// because a square root is never negative), square both sides, solve the
// polynomial, and check every candidate in the original — squaring can
// manufacture a solution of sqrt(R) = −S. Only one square root, whose
// argument contains the variable, is handled; anything else returns null.
async function solveViaRadicalIsolation(equation, variable) {
  const v = variable;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zero = `(${lhs.trim()}) - (${rhs.trim()})`;
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  const re = /(?<![a-z])sqrt\s*\(/gi;
  const radicals = [];
  let m;
  while ((m = re.exec(zero)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(zero, open);
    if (close === -1) return null;
    radicals.push({ start: m.index, end: close + 1, arg: zero.slice(open + 1, close).trim() });
    re.lastIndex = close + 1;
  }
  if (radicals.length !== 1 || !hasVar.test(radicals[0].arg)) return null;
  const R = radicals[0].arg;
  const inS = `${zero.slice(0, radicals[0].start)}s${zero.slice(radicals[0].end)}`;
  if (/\^\s*\(\s*1\s*\/\s*2\s*\)|\b(?:sin|cos|tan|ln|log|abs|exp|sqrt)\b/i.test(inS)) return null;
  if (/[a-wyz]{2,}/i.test(R.replace(new RegExp(v, 'g'), ''))) return null; // functions inside the radicand
  try {
    const Algebrite = await loadAlgebrite();
    const k = String(Algebrite.run(`coeff(${inS}, s, 1)`)).trim();
    if (!numericText(k) || asNumber(k) === 0) return null;
    const rest = String(Algebrite.run(`subst(0, s, ${inS})`)).trim();
    if (/\bs\b|stop|error|nil/i.test(rest)) return null;
    if (String(Algebrite.run(`simplify((${inS}) - ((${k})*s + (${rest})))`)).trim() !== '0') return null;
    const S = String(Algebrite.run(`simplify(-(${rest})/(${k}))`)).trim();
    // A constant right side: negative means no solution at all, before any
    // squaring; non-negative needs no sign check of its own.
    const constantS = !hasVar.test(S) ? asNumber(S) : NaN;
    if (Number.isFinite(constantS) && constantS < 0) {
      return {
        steps: [
          `Isolate the radical: ${mark(`${beautify(zero)} = 0`)} rearranges to ${mark(`√(${beautify(R)}) = ${beautify(S)}`)}.`,
          `A square root is never negative, so √(${beautify(R)}) = ${beautify(S)} has no solution. (Squaring both sides would give ${beautify(R)} = ${formatNumber(constantS * constantS)}, but that candidate solves √(${beautify(R)}) = ${formatNumber(-constantS)}, not the original equation.)`,
          'Solution: No solution (a square root cannot equal a negative number)',
        ],
        answer: 'No solution (a square root cannot equal a negative number)',
        solutions: [],
      };
    }
    const squared = String(Algebrite.run(`expand((${S})^2)`)).trim();
    const poly = `(${R}) - (${squared})`;
    const rootsRaw = String(Algebrite.roots(poly, v)).trim();
    if (!rootsRaw || /stop|error|nil/i.test(rootsRaw) || /\(-.*\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
    const candidates = parseRootsList(rootsRaw);
    if (candidates.length === 0) return null;

    const steps = [
      `Isolate the radical: ${mark(`${beautify(zero)} = 0`)} rearranges to ${mark(`√(${beautify(R)}) = ${beautify(S)}`)}.`,
      Number.isFinite(constantS)
        ? `Domain: the radicand must be non-negative, so ${mark(`${beautify(R)} ≥ 0`)}. Any candidate breaking this is extraneous.`
        : `Domain: the radicand must be non-negative, so ${mark(`${beautify(R)} ≥ 0`)}; and a square root is never negative, so the other side must also satisfy ${mark(`${beautify(S)} ≥ 0`)}. Any candidate breaking either is extraneous.`,
      `Square both sides: ${mark(`${beautify(R)} = (${beautify(S)})² = ${beautify(squared)}`)}.`,
      `Solve the polynomial equation ${mark(`${beautify(poly)} = 0`)}: ${mark(candidates.map((c) => `${v} = ${prettyRadicals(c.display)}`).join(' or '))}.`,
    ];
    const kept = [];
    const checks = [];
    for (const c of candidates) {
      const show = prettyRadicals(c.display);
      if (!Number.isFinite(c.numeric)) { checks.push(`${mark(`${v} = ${show}`)} is not real — rejected`); continue; }
      const rVal = asNumber(R.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), `(${c.numeric})`));
      const sVal = asNumber(S.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), `(${c.numeric})`));
      if (!(rVal >= -1e-9)) { checks.push(`${mark(`${v} = ${show}`)}: ${mark(`${beautify(R)} = ${formatNumber(rVal)} < 0`)}, outside the domain — rejected`); continue; }
      if (!(sVal >= -1e-9)) { checks.push(`${mark(`${v} = ${show}`)}: the right side ${mark(`${beautify(S)} = ${formatNumber(sVal)}`)} is negative, but a square root cannot be — extraneous (it solves ${mark(`√(${beautify(R)}) = −(${beautify(S)})`)} instead) — rejected`); continue; }
      if (!satisfiesEquation(equation, v, c.numeric)) { checks.push(`${mark(`${v} = ${show}`)} does not balance the original equation — rejected`); continue; }
      checks.push(Number.isFinite(constantS)
        ? `${mark(`${v} = ${show}`)}: ${mark(`√(${formatNumber(rVal)}) = ${formatNumber(Math.sqrt(Math.max(rVal, 0)))}`)} — balances ✓`
        : `${mark(`${v} = ${show}`)}: ${mark(`√(${formatNumber(rVal)}) = ${formatNumber(Math.sqrt(Math.max(rVal, 0)))}`)} and ${mark(`${beautify(S)} = ${formatNumber(sVal)}`)} — balances ✓`);
      kept.push({ display: show, numeric: c.numeric });
    }
    steps.push(`Check each candidate in the original equation: ${checks.join('; ')}.`);
    const answer = kept.length > 0
      ? kept.map((c) => `${v} = ${c.display}`).join('  or  ')
      : 'No solution (every candidate is extraneous — introduced by squaring)';
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: kept.map((c) => c.numeric) };
  } catch {
    return null;
  }
}

function generateAlgebraGraph(expression) {
  try {
    if (isEquation(expression)) return null;
    const variable = extractVariable(expression);
    const points = sampleFunction(expression, variable);

    if (points.length > 0) {
      return {
        points,
        expression,
        variable,
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
      expression: left.trim(),
      variable,
      solutions,
      title: `Graph of ${beautify(left.trim())}`,
      description: `${solutionText} (where the curve crosses y = ${beautify(right.trim())})`,
    };
  } catch (error) {
    console.error('Equation graph generation error:', error);
    return null;
  }
}
