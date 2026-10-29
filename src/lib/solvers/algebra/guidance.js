// Tips and mistakes for the algebra solver, chosen by the method the steps
// used (equations, simplify, cancel, radicals).

import { stripMathMarkers, mark, beautify } from '../solverUtils.js';

const TIPS = [
  'Combine like terms by adding or subtracting their coefficients.',
  'Keep the equation balanced: whatever you do to one side, do to the other.',
  'Look for common factors, and check your answer by substituting it back in.',
];

export const SIMPLIFY_TIPS = [
  'Distribute first, then collect like terms — terms with exactly the same variable part.',
  `Like terms combine by adding their coefficients: ${mark('3x − 6 + 4 → 3x − 2')}.`,
  'Check by substituting a value for the variable into both the original and the simplified form.',
];

// A fraction simplified by cancelling a factor: the advice is about
// factoring and cancelling, not like terms ((x^2-1)/(x-1) was told to
// distribute and collect like terms; October 2026 review).
export const CANCEL_TIPS = [
  'Factor the numerator and the denominator completely, then cancel the factors they share.',
  `Cancel factors, never terms: in ${mark('(x^2 − 1)/(x − 1)')} the ${mark('x − 1')} cancels only after ${mark('x^2 − 1 = (x − 1)(x + 1)')}.`,
  `A cancelled factor still counts: the original is undefined where it is zero, so the simplified form comes with that restriction (${mark('x ≠ 1')}).`,
];

export const CANCEL_MISTAKES = [
  `Cancelling a term across the fraction bar: ${mark('(x + 2)/2')} is ${mark('x/2 + 1')}, not ${mark('x + 1')}.`,
  'Dropping the restriction after cancelling: the simplified form is equal to the original only where the original is defined.',
  'Cancelling before factoring completely, and missing a factor the numerator and denominator share.',
];

export const SIMPLIFY_MISTAKES = [
  `Combining unlike terms (adding ${mark('x')} and ${mark('x²')}).`,
  'Forgetting to distribute a factor across every term in the parentheses.',
  'Losing a sign when distributing a negative.',
];

// Tips and mistakes for a solved equation, chosen from the method the steps
// actually used — the same three lines about combining like terms used to
// close an absolute-value, a radical, and a logarithmic equation alike
// (September 2026 review, 1.38.1).
function methodGuidance(steps, expression) {
  const text = stripMathMarkers(steps.join('\n'));
  const variableInDenominator = /\/\s*\(?[0-9.]*[a-z]/i.test(expression);
  // The methods that used to inherit the linear list (October 2026 tips
  // audit): a fractional power undone, a root located numerically, a proof
  // that there is no solution, an identity or contradiction, an LCD.
  // xⁿ = c by an n-th root (∛2, not ≈ 1.2599; 1.62.0).
  if (/real cube root|real fourth roots|fourth power is never negative/.test(text)) {
    return {
      method: 'pure power',
      tips: [
        `${mark('x^n = c')} is solved by an ${mark('n')}-th root: an odd ${mark('n')} gives one real root (${mark('x³ = 2')} gives ${mark('x = ∛2')}); an even ${mark('n')} gives ${mark('x = ±ⁿ√c')} when ${mark('c > 0')} and no real root when ${mark('c < 0')}.`,
        `A polynomial of degree ${mark('n')} has ${mark('n')} roots counted with multiplicity, so the others are complex: for a cube, ${mark('∛c·(−1 ± i√3)/2')}.`,
        `Keep the root exact (${mark('∛2')}) and show the decimal beside it (${mark('≈ 1.2599')}): the decimal is not the answer, only its size.`,
      ],
      common_mistakes: [
        `Taking only the positive root of an even power: ${mark('x⁴ = 5')} also has ${mark('x = −∜5')}.`,
        `Dividing instead of taking a root: ${mark('x³ = 2')} does not give ${mark('x = 2/3')}.`,
        'Stopping at the real root when the question asks for every root: the complex ones count too.',
      ],
    };
  }
  if (/Isolate the power|Raise both sides to the power/.test(text)) {
    return {
      method: 'power',
      tips: [
        `Read ${mark('x^(p/q)')} as a root, then a power, with ${mark('p/q')} in lowest terms: ${mark('x^(2/3) = (∛x)²')}. Undo the power, then the root: ${mark('(∛x)² = 4')} gives ${mark('∛x = ±2')}, so ${mark('x = ±8')}.`,
        `The denominator ${mark('q')} decides the domain: an odd root is real for every ${mark('x')} (${mark('∛(−8) = −2')}), an even root only for ${mark('x ≥ 0')}, and it is never negative (${mark('x^(1/2) = −3')} has no real solution).`,
        `The numerator ${mark('p')} decides the signs: undoing an even power gives ${mark('±')} (when the right side is positive), an odd power one value.`,
      ],
      common_mistakes: [
        `Taking only the positive solution when the numerator of the exponent is even.`,
        `Reading an unreduced exponent literally: ${mark('x^(4/6)')} is ${mark('x^(2/3)')}, real for negative ${mark('x')} too.`,
        'Skipping the check: a raised power can introduce a value that fails in the original.',
      ],
    };
  }
  // e^x + e^(−x) = 1: the substitution closed and the polynomial in u has
  // no real (or no positive) root — say why in terms of u, not of 1/x.
  if (/no real solution/i.test(text) && /Let u = (?:e|\d+(?:\.\d+)?)\^/.test(text)) {
    return {
      method: 'exp no solution',
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
    // Why there is none decides what to say first (an outside review,
    // 1.62.0: |x − 1| = −3 was told about 1/x and logarithms).
    const cause = /absolute value is never negative/i.test(text) ? 'abs' : /square root|even power|root, which is never negative/i.test(text) ? 'root' : /always positive|positive for every real/i.test(text) ? 'exp' : /is never 0|never 0/i.test(text) ? 'zero' : null;
    const lead = {
      abs: [`An absolute value is never negative, so ${mark('|A| = b')} with ${mark('b < 0')} has no solution: there is no need to split into cases.`, `Splitting ${mark('|x − 1| = −3')} into cases anyway gives ${mark('x = −2')} and ${mark('x = 4')}, and neither works: each makes ${mark('|x − 1| = 3')}.`],
      root: [`An even root, and an even power of a real root, is never negative, so it cannot equal a negative number.`, `Squaring both sides anyway gives a candidate that fails the check in the original equation.`],
      exp: [`${mark('a^x')} with ${mark('a > 0')} is always positive, so it cannot equal ${mark('0')} or a negative number.`, `Taking a logarithm of a negative number to "solve" it: there is no such logarithm.`],
      zero: [`A fraction is ${mark('0')} only when its numerator is; ${mark('1/(x − 1)')} has numerator ${mark('1')}, so it is never ${mark('0')}.`, `Writing a value where the fraction is "nearly" ${mark('0')}: it gets small but never reaches ${mark('0')}.`],
    }[cause];
    if (lead) {
      return {
        method: 'no solution',
        tips: [
          lead[0],
          'Say why: name the value the expression cannot reach — that is the answer.',
          '"No real solution" is a result, not a failure: the check is that no number could satisfy the equation, not that none was found.',
        ],
        common_mistakes: [
          lead[1],
          ...(cause === 'abs' ? [`Dropping the bars and solving ${mark('x − 1 = −3')} as if it were the equation.`] : []),
          'Reporting a number anyway because the algebra produced one.',
        ],
      };
    }
    return {
      method: 'no solution',
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
      method: 'numeric',
      tips: [
        `When the unknown sits both inside and outside a function (${mark('x·e^x = 1')}), no algebraic step isolates it; the root is located where the two sides cross and narrowed down.`,
        `${mark('≈')} means the root is known to the decimals shown, not exactly; substitute it back and the two sides agree to those decimals.`,
        'Sketch both sides: each crossing is a solution, and the picture says how many to expect.',
        ...(/^\s*x\s*\*\s*e\s*\^\s*\(?x\)?\s*=\s*\d+(?:\.\d+)?\s*$/.test(expression)
          ? [`This one has a name: ${mark('x·e^x = c')} with ${mark('c > 0')} is solved by ${mark('x = W(c)')}, the Lambert W function (the inverse of ${mark('x·e^x')}). Most calculators do not have it, so a numerical value is the usual answer.`]
          : []),
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
      method: 'cancel',
      tips: [
        `When the variable terms cancel, what is left is about the constants alone: ${mark('5x − 7 = 5x + 2')} leaves ${mark('−7 = 2')}, false, so no solution; ${mark('2(x + 3) = 2x + 6')} leaves ${mark('6 = 6')}, true for every ${mark('x')}.`,
        identity
          ? 'An identity holds for every real number — the two sides are the same expression written differently.'
          : 'A contradiction has no solution — the two sides differ by a fixed amount whatever x is.',
        `For a linear equation two values settle it: substitute ${mark('x = 0')} and ${mark('x = 1')}, and an identity holds both times, a contradiction fails both times.`,
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
      method: 'lcd',
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
      method: 'absolute value',
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
      method: 'radical',
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
    // Common logs (log typed bare is base 10) are taught in base 10.
    if (/(?<![a-z])log\(/i.test(expression) && !/\bln\(/i.test(expression)) {
      return {
        method: 'log',
        tips: [
          `${mark('log(x) = c')} means ${mark('x = 10^c')}: undo a base-10 logarithm with a power of ${mark('10')}.`,
          `Combine several logs with the log rules first (${mark('log a + log b = log(ab)')}, ${mark('log a − log b = log(a/b)')}, for ${mark('a, b > 0')}), then rewrite in exponential form.`,
          'Every solution must keep every log argument positive — check each one.',
        ],
        common_mistakes: [
          `Reading ${mark('log(x) = c')} as ${mark('x = c')}, or as ${mark('x = e^c')}: the base is ${mark('10')}.`,
          'Keeping a candidate that makes a log argument zero or negative.',
          `Splitting ${mark('log(a + b)')} into ${mark('log a + log b')} — there is no such rule.`,
        ],
      };
    }
    return {
      method: 'log',
      tips: [
        `${mark('ln(x) = c')} means ${mark('x = e^c')}: undo a logarithm by exponentiating with its base.`,
        `Combine several logs with the log rules first (${mark('ln a + ln b = ln(ab)')}, ${mark('ln a − ln b = ln(a/b)')}, for ${mark('a, b > 0')}), then rewrite in exponential form.`,
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
      method: 'exponential',
      tips: [
        `${mark('a^x = b')} (with ${mark('a > 0')}, ${mark('a ≠ 1')} and ${mark('b > 0')}) is solved by taking a logarithm of both sides: ${mark('x = ln(b)/ln(a) = log_a(b)')}.`,
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
      method: 'rational',
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
      method: 'rational roots',
      tips: [
        'Rational Root Theorem: for a polynomial with integer coefficients, every rational root is ±(a factor of the constant term)/(a factor of the leading coefficient) — a finite list to test, so test it before anything else.',
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
      method: 'square roots',
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
      method: 'formula',
      tips: [
        `For ${mark('ax^2 + bx + c = 0')}: ${mark('x = (−b ± √(b^2 − 4ac))/(2a)')}.`,
        `With real coefficients, the discriminant ${mark('b^2 − 4ac')} decides the count: positive gives two real roots, zero one (repeated), negative none real (a complex pair).`,
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
      method: 'factoring',
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
    method: 'linear',
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

// More of each method, after the first three insights and mistakes (1.62.0,
// "Show more"): what a student meets next, then the general check.
const MORE = {
  linear: {
    tips: [
      `With the variable on both sides, collect it on one side first: ${mark('3(x − 2) = 2x + 4')} becomes ${mark('3x − 6 = 2x + 4')}, then ${mark('x = 10')}.`,
      'Fractions or decimals can be cleared first, by multiplying every term on both sides by the same number.',
    ],
    mistakes: [`Moving a term without changing its sign: ${mark('x + 5 = 11')} gives ${mark('x = 6')}, not ${mark('x = 16')}.`],
  },
  lcd: {
    tips: [`The LCD is the smallest number every denominator divides: for ${mark('3')}, ${mark('2')} and ${mark('6')} it is ${mark('6')}.`],
    mistakes: [],
  },
  cancel: {
    tips: ['Simplify both sides fully before deciding: distribute, collect like terms, then compare what is left.'],
    mistakes: [],
  },
  factoring: {
    tips: [
      `Take out a common factor first: ${mark('x² − 3x = 0')} is ${mark('x(x − 3) = 0')}, so ${mark('x = 0')} or ${mark('x = 3')}.`,
      'A quadratic that does not factor over the integers can still be solved by the formula.',
    ],
    mistakes: [`Factoring when the equation is not set to ${mark('0')}: ${mark('(x − 1)(x − 2) = 6')} does not give ${mark('x − 1 = 6')} or ${mark('x − 2 = 6')}.`],
  },
  formula: {
    tips: [
      `Set the equation to ${mark('0')} first, then read ${mark('a')}, ${mark('b')} and ${mark('c')} with their signs.`,
      `When ${mark('b² − 4ac')} is a perfect square (and the coefficients are integers), the roots are rational and the quadratic also factors.`,
    ],
    mistakes: [`Reading ${mark('a')}, ${mark('b')}, ${mark('c')} before the equation is set to ${mark('0')}.`],
  },
  'square roots': {
    tips: [`With no ${mark('x')} term (${mark('ax² + c = 0')}) square roots are quickest; with an ${mark('x')} term, factor or use the formula.`],
    mistakes: [],
  },
  'absolute value': {
    tips: [`${mark('|x − a| = b')} says ${mark('x')} is at distance ${mark('b')} from ${mark('a')}, so ${mark('x = a ± b')} when ${mark('b ≥ 0')}.`],
    mistakes: [],
  },
  radical: {
    tips: [`${mark('√')} means the principal (non-negative) root, which is why a candidate that makes the other side negative is extraneous.`],
    mistakes: [],
  },
  log: {
    tips: [`In exponential form, ${mark('log_b(x) = c')} means ${mark('x = b^c')} (for ${mark('b > 0')}, ${mark('b ≠ 1')}); ${mark('log(x)')} typed bare is base ${mark('10')}, so ${mark('log(x) = c')} means ${mark('x = 10^c')}.`],
    mistakes: ['Combining logs whose arguments are not all positive: the combined equation can have a candidate the original does not, and the check removes it.'],
  },
  exponential: {
    tips: [`If both sides are powers of the same base, compare the exponents: ${mark('2^x = 8 = 2³')} gives ${mark('x = 3')}.`],
    mistakes: [],
  },
  rational: {
    tips: [`One fraction equal to one fraction can be cross-multiplied: ${mark('a/b = c/d')} gives ${mark('ad = bc')}, with ${mark('b, d ≠ 0')}.`],
    mistakes: [],
  },
  'rational roots': {
    tips: ['If no candidate on the list is a root, there is no rational root: the roots are irrational or complex, and another method is needed.'],
    mistakes: [],
  },
  power: {
    tips: [
      `Isolate the power before undoing it: ${mark('2x^(2/3) + 1 = 9')} becomes ${mark('x^(2/3) = 4')} first.`,
      `Raising both sides to the reciprocal power (${mark('x = ±4^(3/2)')}) gives the same answer here, but only through the root does the domain and the ${mark('±')} show.`,
    ],
    mistakes: [],
  },
};

// "Here: …": this equation's own working, read back from its steps, and the
// answer. Null when the steps do not name the pieces (the answer is shown).
function workedEquation(method, text, expression, answer) {
  const pick = (re) => (text.match(re) || [])[1]?.trim();
  // The answer as math only: no "(≈ …)", no worded note such as "(repeated root)".
  const shown = String(answer).replace(/\s{2,}/g, ' ').replace(/\s*\(≈[^)]*\)/g, '').replace(/\s*\([^()]*[a-z]{3,}[^()]*\)/gi, '');
  // "No real solution" and "All real numbers" are words, not math.
  const result = /^(?:No|All)\b/.test(shown) ? shown.charAt(0).toLowerCase() + shown.slice(1).replace(/\s*[—(].*$/, '') : mark(shown);
  switch (method) {
    case 'linear':
    case 'lcd': {
      const chain = [...text.matchAll(/^(?:Subtract|Add|Divide|Multiply|Distribute|Expand|Collect|Combine|Move|Simplify)[^:\n]*: (.+)$/gm)].map((m) => m[1].trim());
      const start = expression.split('=').map((side) => beautify(side.trim())).join(' = ');
      return chain.length ? `Here: ${mark([start, ...chain].join(' → '))}.` : null;
    }
    case 'cancel': {
      if (/two sides are identical/.test(text)) return `Here the ${mark('x')} terms cancel and the two sides are the same expression: every ${mark('x')} is a solution.`;
      const diff = pick(/difference between the sides is always (-?[\d./]+)/);
      if (diff === undefined) return null;
      return Number(eval_(diff)) === 0
        ? `Here the ${mark('x')} terms cancel and the two sides always differ by ${mark('0')}: every ${mark('x')} is a solution.`
        : `Here the ${mark('x')} terms cancel and the two sides always differ by ${mark(diff)}, never ${mark('0')}: no ${mark('x')} is a solution.`;
    }
    case 'factoring': {
      const f = pick(/So (.+? = .+?)\. Check by/);
      if (f) return `Here: ${mark(`${f} = 0`)}, so ${result}.`;
      const common = pick(/Factor out the common [^:\n]*: .+? becomes (.+? = 0)\./);
      return common ? `Here: ${mark(common)}, so ${result}.` : null;
    }
    case 'formula': {
      const num = '(-?\\d+(?:[./]\\d+)?)';
      const abc = text.match(new RegExp(`with a = ${num}, b = ${num}, c = ${num}`));
      const disc = pick(/Discriminant: .*?= (-?\d+(?:[./]\d+)?)(?=\.?\s*$| —)/m);
      if (!abc || disc === undefined) return null;
      const dv = Number(eval_(disc));
      const count = dv > 0 ? 'positive, so two real roots' : dv === 0 ? 'zero, so one repeated root' : 'negative, so a complex pair';
      return `Here ${mark(`a = ${abc[1]}`)}, ${mark(`b = ${abc[2]}`)}, ${mark(`c = ${abc[3]}`)} and ${mark(`b² − 4ac = ${disc}`)}, ${count}: ${result}.`;
    }
    case 'square roots': {
      const r = pick(/Take the square root of both sides[^:]*: (.+?)\.\s*$/m)?.split(/\.\s/)[0];
      return r ? `Here: ${mark(r)}, so ${result}.` : null;
    }
    case 'absolute value': {
      const c1 = pick(/^Case 1[^:\n]*: (.+)$/m);
      const c2 = pick(/^Case 2[^:\n]*: (.+)$/m);
      return c1 && c2 ? `Here: ${mark(c1)} or ${mark(c2)}, so ${result}.` : null;
    }
    case 'radical': {
      const sq = pick(/Square both sides: (.+?)\.\s*$/m);
      const cand = pick(/Solve the polynomial equation[^:\n]*: (.+?)\.\s*$/m);
      const bad = pick(/([a-z] = -?[\d./√]+): [^\n]*extraneous/);
      if (!sq) return null;
      return `Here squaring gives ${mark(sq)}${cand ? `, with candidates ${mark(cand)}` : ''}${bad ? `; ${mark(bad)} is extraneous` : ''}, so ${result}.`;
    }
    case 'log': {
      const form = pick(/Rewrite in exponential form: (.+)$/m);
      if (form) {
        const [l, r] = form.replace(/\(([a-z0-9]+)\)\*\(/gi, '$1(').replace(/\(\((\w+)\)\)/g, '$1').split(' = ');
        const cand = pick(/^Solve [^\n]*?: ([a-z] = .+)$/m);
        const bad = pick(/([a-z] = -?[\d./]+) makes a logarithm's argument/);
        return `Here, combined and in exponential form: ${mark(`${beautify(l)} = ${r}`)}${cand ? `, with candidates ${mark(cand)}` : ''}${bad ? `; ${mark(bad)} is rejected (a logarithm's argument would not be positive)` : ''}, so ${result}.`;
      }
      const back = pick(/so ([a-z] = (?:e|10|\d+)\^[^\s,→]+)/);
      return back ? `Here: ${mark(back)}, so ${result}.` : null;
    }
    case 'exponential': {
      const u = pick(/Let (u = [^\s(:]+)/);
      const poly = pick(/clear the negative powers[^:\n]*: (.+? = 0)\s*$/m) || pick(/^Let u = [^:\n]*: (.+? = 0)\s*$/m);
      const us = pick(/^Solve for u: (.+)$/m);
      if (u && poly) return `Here ${mark(u)} turns it into ${mark(poly)}${us ? `, so ${mark(us.replace(/\s{2,}/g, ' '))}` : ''}, and each positive ${mark('u')} gives ${mark('x = ln(u)')}: ${result}.`;
      if (/Take (?:ln|log) of both sides/.test(text)) return `Here, taking a logarithm of both sides: ${mark(String(answer).replace(/\s{2,}/g, ' ').replace(/\s*\(≈\s*/, ' ≈ ').replace(/\)$/, ''))}.`;
      return null;
    }
    case 'rational': {
      const cleared = pick(/Multiply through by the denominators[^:\n]*: (.+)$/m)?.split(/,\s|\.\s|\.$/)[0];
      return cleared ? `Here: clearing the denominators gives ${mark(cleared)}, so ${result}.` : null;
    }
    case 'rational roots': {
      const root = pick(/(p\(-?[\d/]+\) = 0)/);
      const quad = pick(/remaining factor is a quadratic: (.+? = 0)\./);
      return root ? `Here ${mark(root)}${quad ? `, and dividing leaves ${mark(quad)}` : ''}: ${result}.` : null;
    }
    case 'power': {
      const through = text.match(/Write the power through its root: (.+?)\. The power \d+ is even, so both signs: (.+?), and so (.+?)\.\s*$/m);
      if (through) return `Here: ${mark(through[1])}, so ${mark(through[2])} and ${mark(through[3])}.`;
      const x = pick(/Raise both sides to the power [^:\n]*: ([a-z] = .+?)\.\s*$/m);
      return x ? `Here: ${mark(x)}.` : null;
    }
    default:
      return null;
  }
}

// A rational number written as a/b, as a number.
const eval_ = (t) => (/^-?\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(t) ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t));

// Tips and mistakes for a solved equation: the method's own list (above),
// then (1.62.0) this equation's working second, then more of the method.
export function equationGuidance(steps, expression, answer = null) {
  const base = methodGuidance(steps, expression);
  const text = stripMathMarkers(steps.join('\n'));
  const more = MORE[base.method] || { tips: [], mistakes: [] };
  const worked = answer ? workedEquation(base.method, text, expression, answer) : null;
  const tips = [base.tips[0], ...(worked ? [worked] : []), ...base.tips.slice(1), ...more.tips];
  const common_mistakes = [...base.common_mistakes, ...more.mistakes];
  return { method: base.method, tips: [...new Set(tips)], common_mistakes: [...new Set(common_mistakes)] };
}

const COMMON_MISTAKES = [
  'Forgetting to distribute a factor across every term in the parentheses.',
  `Combining unlike terms (e.g., adding ${mark('x')} and ${mark('x²')}).`,
  'Sign errors when moving a term across the equals sign.',
];

export const RADICAL_TIPS = [
  `Factor out the largest perfect square: ${mark('√50 = √25 · √2 = 5√2')}.`,
  'A radical is in simplest form when nothing under it has a square factor left.',
  `${mark('√(a·b) = √a · √b')} for ${mark('a, b ≥ 0')}, but ${mark('√(a + b)')} is NOT ${mark('√a + √b')}.`,
];

export const RADICAL_MISTAKES = [
  `Splitting a radical across addition: ${mark('√(a + b) ≠ √a + √b')}.`,
  `Missing the largest square factor (${mark('√72 = 6√2')}, not ${mark('2√18')}).`,
  'Stopping at a decimal when the exact simplified radical was the point.',
];
