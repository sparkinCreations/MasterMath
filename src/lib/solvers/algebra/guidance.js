// Tips and mistakes for the algebra solver, chosen by the method the steps
// used (equations, simplify, cancel, radicals).

import { stripMathMarkers, mark } from '../solverUtils.js';

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
export function equationGuidance(steps, expression) {
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

export const RADICAL_TIPS = [
  `Factor out the largest perfect square: ${mark('√50 = √25 · √2 = 5√2')}.`,
  'A radical is in simplest form when nothing under it has a square factor left.',
  `${mark('√(a·b) = √a · √b')}, but ${mark('√(a + b)')} is NOT ${mark('√a + √b')}.`,
];

export const RADICAL_MISTAKES = [
  `Splitting a radical across addition: ${mark('√(a + b) ≠ √a + √b')}.`,
  `Missing the largest square factor (${mark('√72 = 6√2')}, not ${mark('2√18')}).`,
  'Stopping at a decimal when the exact simplified radical was the point.',
];
