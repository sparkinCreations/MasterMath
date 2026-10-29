// Tips and mistakes for the arithmetic solver, chosen by the operations the
// working used, and for complex-number arithmetic.

import { math, stripMathMarkers, mark } from '../solverUtils.js';

// Tips and mistakes for a plain arithmetic evaluation, chosen by what the
// expression actually used — a negative exponent, a factorial, a percent, a
// root or function — instead of the PEMDAS list for everything.
export function arithmeticGuidance(steps, expr) {
  const text = stripMathMarkers(steps.join('\n'));
  if (/negative exponent means a reciprocal/.test(text)) {
    return {
      tips: [
        `${mark('a^(−n) = 1/a^n')}: a negative exponent moves the power to the denominator — it does not make the result negative.`,
        `The base cannot be ${mark('0')} (${mark('0^(−n)')} would be ${mark('1/0')}), and the sign of the result comes from the base: ${mark('(−2)^(−3) = 1/(−8) = −1/8')}.`,
        `A negative exponent on a fraction flips it: ${mark('(1/2)^(−2) = 2² = 4')}.`,
      ],
      common_mistakes: [
        `Writing ${mark('2^(−3)')} as ${mark('−8')} or as ${mark('−2³')}.`,
        'Making the result negative — the minus sign is in the exponent, not in the value.',
        `Forgetting that ${mark('−2^(−2)')} applies the minus after the power: ${mark('−(1/4)')}.`,
      ],
    };
  }
  if (/!/.test(expr)) {
    return {
      tips: [
        `${mark('n! = n × (n − 1) × … × 2 × 1')} — the product of every whole number from ${mark('n')} down to ${mark('1')}.`,
        `${mark('0! = 1')} by definition, so that formulas for combinations and permutations work at the edges.`,
        `Factorials grow very fast: ${mark('10!')} is already 3,628,800.`,
      ],
      common_mistakes: [
        `Reading ${mark('7!')} as ${mark('7 × 1')}, or as ${mark('7 + 6 + … + 1')}.`,
        `Treating ${mark('(n − 1)!')} as ${mark('n! − 1')}.`,
        'Applying ! to a fraction or a negative number.',
      ],
    };
  }
  if (/%/.test(expr) || /Percent means/.test(text)) {
    return {
      tips: [
        `"Per cent" means per hundred: ${mark('50% = 50/100 = 1/2')}, and "of" means multiply.`,
        `To find ${mark('p%')} of a number, multiply by ${mark('p/100')} (or move the decimal point two places).`,
        `A percent of a percent multiplies: ${mark('50%')} of ${mark('50%')} is ${mark('25%')}, not ${mark('100%')}.`,
      ],
      common_mistakes: [
        `Multiplying by ${mark('50')} instead of by ${mark('0.5')}.`,
        'Adding the percentage instead of multiplying by it.',
        `Mixing up "${mark('50%')} of ${mark('80')}" with "${mark('50')} is what percent of ${mark('80')}".`,
      ],
    };
  }
  // A logarithm: what it asks, which base each name means, and the change of
  // base. (ln(8) and log(8) were given the PEMDAS list; October 2026 review.)
  if (/(?<![a-z_])(?:log|ln)\(/i.test(expr)) {
    return {
      tips: [
        `${mark('log_b(a)')} asks for the power of ${mark('b')} that gives ${mark('a')}: ${mark('log_b(a) = k')} means ${mark('b^k = a')}, so ${mark('log_2(8) = 3')} because ${mark('2^3 = 8')}.`,
        `${mark('ln')} is the natural logarithm, base ${mark('e')}. For a base other than ${mark('10')} or ${mark('e')}, change base: ${mark('log_b(a) = ln(a)/ln(b)')}.`,
        `The rules: ${mark('log(xy) = log(x) + log(y)')}, ${mark('log(x/y) = log(x) − log(y)')}, ${mark('log(x^n) = n·log(x)')}.`,
      ],
      common_mistakes: [
        `Mixing up ${mark('log')} and ${mark('ln')}: ${mark('log(8) ≈ 0.9031')} but ${mark('ln(8) ≈ 2.0794')}.`,
        `Splitting ${mark('log(a + b)')} into ${mark('log(a) + log(b)')}: the product rule is for ${mark('log(ab)')}.`,
        `Taking the logarithm of ${mark('0')} or a negative number: it is defined only for positive numbers.`,
      ],
    };
  }
  // (Each branch below is for one operation typed alone, where the PEMDAS
  // list taught nothing about the problem on screen; October 2026 audit.)
  if (/(?<![a-z])(?:gcd|lcm)\s*\(/i.test(expr)) {
    const lcm = /(?<![a-z])lcm\s*\(/i.test(expr);
    return {
      tips: [
        lcm
          ? `The lcm is the smallest number both divide into: take every prime from either factorization, each to its higher power — for 4 and 6, ${mark('2² × 3 = 12')}.`
          : `The gcd is the largest number dividing both: take the primes they share, each to its lower power — for 12 and 18, ${mark('2 × 3 = 6')}.`,
        'Euclid\'s algorithm is quicker: replace the larger number by its remainder on division by the smaller, until a remainder is 0 — 18 and 12, then 12 and 6, then 6 and 0: the gcd is 6.',
        `The gcd times the lcm is the product of the two numbers (${mark('6 × 36 = 12 × 18')}), so one gives the other: the lcm of 12 and 18 is ${mark('12 × 18 / 6 = 36')}.`,
      ],
      common_mistakes: [
        lcm
          ? `Multiplying the numbers: the lcm of 12 and 18 is ${mark('36')}, not ${mark('216')}.`
          : `Taking the smaller number: the gcd of 12 and 18 is ${mark('6')}, not ${mark('12')}.`,
        'Stopping Euclid\'s algorithm one step early, at a non-zero remainder.',
        'Mixing the two up: the gcd is never larger than either number, the lcm never smaller.',
      ],
    };
  }
  if (/(?<![a-z])mod(?![a-z])/i.test(expr)) {
    return {
      tips: [
        `${mark('a mod b')} is the remainder when ${mark('a')} is divided by ${mark('b')}: ${mark('17 = 3 × 5 + 2')}, so ${mark('17 mod 5 = 2')}.`,
        `The result is always between ${mark('0')} and ${mark('b − 1')}; a result of ${mark('0')} means ${mark('b')} divides ${mark('a')} exactly.`,
        `Clock arithmetic: 17 o'clock on a 5-hour clock reads 2 — the multiples of ${mark('5')} wrap around.`,
      ],
      common_mistakes: [
        `Giving the quotient (${mark('3')}) instead of the remainder (${mark('2')}).`,
        'Reporting a remainder as large as the divisor: it is always smaller.',
        `A negative dividend: ${mark('−7 mod 5')} is ${mark('3')} (the remainder is kept non-negative), not ${mark('−2')}.`,
      ],
    };
  }
  if (/^\s*-\s*\(?\d+(?:\.\d+)?\)?\s*\^\s*\(?\d+\)?\s*$/.test(expr) && !/^\s*-\s*\(/.test(expr)) {
    return {
      tips: [
        `The exponent binds before the minus sign: ${mark('−3^2')} is ${mark('−(3^2) = −9')}. The square of ${mark('−3')} is written ${mark('(−3)^2 = 9')}.`,
        `An even power of a negative number is positive, an odd power negative: ${mark('(−3)^2 = 9')}, ${mark('(−3)^3 = −27')}.`,
        'Use parentheses whenever the base is negative, so the reader (and the calculator) sees what is being raised.',
      ],
      common_mistakes: [
        `Reading ${mark('−3^2')} as ${mark('(−3)^2 = 9')}.`,
        `Reading ${mark('(−3)^2')} as ${mark('−9')}: inside parentheses, the whole ${mark('−3')} is squared.`,
      ],
    };
  }
  if (/^\s*\(?-?\d+(?:\.\d+)?(?:\/\d+)?\)?\s*\^\s*\(?-?\d+\)?\s*$/.test(expr)) {
    const fractionBase = /\//.test(expr);
    return {
      tips: [
        fractionBase
          ? `A power of a fraction raises top and bottom: ${mark('(1/2)^3 = 1^3/2^3 = 1/8')}.`
          : `${mark('a^n')} is ${mark('a')} multiplied by itself ${mark('n')} times: ${mark('2^10 = 2 × 2 × … × 2')} (ten factors) ${mark('= 1024')}.`,
        `The rules: ${mark('a^m · a^n = a^(m+n)')}, ${mark('(a^m)^n = a^(mn)')}, ${mark('a^0 = 1')}, and ${mark('a^(−n) = 1/a^n')}.`,
        fractionBase
          ? `A fraction between ${mark('0')} and ${mark('1')} gets smaller when raised to a power: ${mark('(1/2)^3 < 1/2')}.`
          : `Powers grow fast: doubling ten times is ${mark('1024')}, twenty times is over a million.`,
      ],
      common_mistakes: [
        fractionBase
          ? `Raising only the numerator: ${mark('(1/2)^3')} is ${mark('1/8')}, not ${mark('1/2')}.`
          : `Multiplying the base by the exponent: ${mark('2^10')} is ${mark('1024')}, not ${mark('20')}.`,
        `Swapping base and exponent: ${mark('2^10 = 1024')} but ${mark('10^2 = 100')}.`,
      ],
    };
  }
  if (/^\s*-?\d+(?:\.\d+)?\s*[-+]\s*-?\d+(?:\.\d+)?\s*$/.test(expr)) {
    const decimals = /\./.test(expr);
    const subtraction = /\d\s*-/.test(expr);
    return {
      tips: [
        decimals
          ? `Line up the decimal points and add column by column: ${mark('0.1 + 0.2 = 0.3')} exactly. (A calculator working in binary shows ${mark('0.30000000000000004')}; the fraction ${mark('3/10')} is the true value.)`
          : subtraction
            ? `When the number subtracted is the larger one, the result is negative: ${mark('5 − 8 = −(8 − 5) = −3')} — the distance is the same, the sign flips.`
            : `Add column by column from the right, carrying when a column reaches ${mark('10')}: ${mark('1000000 + 2 = 1000002')}.`,
        subtraction
          ? `On a number line, subtracting moves left: start at the first number and step back by the second; past ${mark('0')} the answer is negative.`
          : 'Check with an estimate: round each number and add the rounded values; the exact answer should be close.',
      ],
      common_mistakes: [
        decimals
          ? `Adding the digits without lining up the places: ${mark('0.1 + 0.02')} is ${mark('0.12')}, not ${mark('0.3')}.`
          : subtraction
            ? `Subtracting the smaller number from the larger and keeping the sign positive: ${mark('5 − 8')} is ${mark('−3')}, not ${mark('3')}.`
            : 'Misaligning the places when one number has more digits than the other.',
        subtraction
          ? 'Dropping the minus sign when the second number is larger.'
          : `Forgetting a carry when a column adds to ${mark('10')} or more.`,
      ],
    };
  }
  if (/^\s*-?\d+(?:\.\d+)?\s*[*/×÷]\s*-?\d+(?:\.\d+)?\s*$/.test(expr)) {
    const division = /[/÷]/.test(expr);
    return {
      tips: [
        division
          ? `A division is a fraction: ${mark('100/8 = 25/2')} after cancelling the common factor ${mark('4')}; as a decimal, ${mark('12.5')}.`
          : 'Multiply, then check with an estimate: round each factor and multiply the rounded values.',
        division
          ? 'A division that does not come out even is a fraction or a repeating decimal, both exact; a rounded decimal is an approximation.'
          : `The sign rule: two negatives make a positive, one negative makes a negative.`,
      ],
      common_mistakes: [
        division
          ? `Dividing in the wrong order: ${mark('100/8')} is ${mark('100 ÷ 8')}, not ${mark('8 ÷ 100')}.`
          : 'Losing a zero (or gaining one) when a factor ends in zeros.',
        division
          ? `Rounding ${mark('12.5')} to ${mark('12')} or ${mark('13')} when the exact value is asked for.`
          : 'A sign slip when one factor is negative.',
      ],
    };
  }
  // Roots: perfect squares, odd roots of negatives, a half power.
  const perfectSquares = [...String(expr).matchAll(/sqrt\(\s*(\d+)\s*\)/gi)].map((m) => Number(m[1]));
  if (perfectSquares.length > 0 && perfectSquares.every((n) => Number.isInteger(Math.sqrt(n))) && !/cbrt|nthRoot|\^/i.test(expr)) {
    const [n] = perfectSquares;
    const r = Math.sqrt(n);
    return {
      tips: [
        `${mark(`√${n} = ${r}`)} because ${mark(`${r}² = ${n}`)}: a perfect square has a whole-number root.`,
        perfectSquares.length > 1
          ? `Roots of different numbers do not combine: ${mark('√16 + √9 = 4 + 3 = 7')}, not ${mark('√25 = 5')}.`
          : `The radical symbol means the non-negative root: ${mark(`√${n}`)} is ${mark(String(r))}, and ${mark(`−${r}`)} is the other solution of ${mark(`x² = ${n}`)}, not part of ${mark(`√${n}`)}.`,
      ],
      common_mistakes: [
        `${mark('√(a + b)')} is not ${mark('√a + √b')}: ${mark('√(16 + 9) = 5')}, but ${mark('√16 + √9 = 7')}.`,
        `Reporting ${mark(`±${r}`)} for ${mark(`√${n}`)} — the symbol means the non-negative root.`,
      ],
    };
  }
  // ((−8)^(1/3) was rewritten as −(8^(1/3)) by the time the guidance runs;
  // the step that did so is the signal.)
  if (/the base is negative and the root is odd/.test(text) || /cbrt\(\s*-|nthRoot\(\s*-/i.test(expr)) {
    return {
      tips: [
        `An odd root of a negative number is real: ${mark('∛(−8) = −2')} because ${mark('(−2)³ = −8')}.`,
        `An even root of a negative number is not real: ${mark('√(−4)')} has no real value (it is ${mark('2i')}).`,
        `${mark('a^(1/3)')} means ${mark('∛a')}, the number whose cube is ${mark('a')}; the sign of the root matches the sign of ${mark('a')}.`,
      ],
      common_mistakes: [
        `Giving ${mark('2')} for ${mark('∛(−8)')}: ${mark('2³ = 8')}, not ${mark('−8')}.`,
        'Saying "no real solution" as if it were a square root.',
      ],
    };
  }
  // √(−4) = 2i: the lesson is the imaginary unit, not irrational decimals
  // (the general root tips below mentioned √2 under an answer of 2i).
  if (/the result is a complex number/.test(text)) {
    return {
      tips: [
        `The imaginary unit is ${mark('i = √(−1)')}, so ${mark('i² = −1')}. A square root of a negative number is a multiple of ${mark('i')}.`,
        `Take out the ${mark('−1')} first: ${mark('√(−4) = √4·√(−1) = 2i')}, and ${mark('√(−8) = √8·i = 2√2·i')}.`,
        `Check it by squaring: ${mark('(2i)² = 4i² = −4')}.`,
      ],
      common_mistakes: [
        `Answering ${mark('√(−4) = −2')}: ${mark('(−2)² = 4')}, not ${mark('−4')}. No real number squares to a negative.`,
        `Using ${mark('√a·√b = √(ab)')} with two negatives: ${mark('√(−4)·√(−9) = 2i·3i = −6')}, not ${mark('√36 = 6')}.`,
      ],
    };
  }
  if (/\b(?:sqrt|cbrt|nthRoot)\b|√|\^\s*\(?\d+\/\d+\)?|\^\s*0?\.\d+/i.test(expr)) {
    const halfPower = /\^\s*\(?\s*(?:0?\.5|1\s*\/\s*2)\s*\)?(?![0-9.])/.test(expr) && !/sqrt|√/.test(expr);
    return {
      tips: [
        halfPower
          ? `A power of ${mark('0.5')} is a square root: ${mark('a^0.5 = a^(1/2) = √a')}, so ${mark('2^0.5 = √2 ≈ 1.4142')}.`
          : `${mark('√a')} is the non-negative number whose square is ${mark('a')}; ${mark('√2')} is irrational, so its decimal never ends or repeats.`,
        `Rewrite roots as powers when combining them: ${mark('√a = a^(1/2)')}, ${mark('∛a = a^(1/3)')}.`,
        `Simplify by pulling out perfect squares: ${mark('√8 = √4·√2 = 2√2')}.`,
      ],
      common_mistakes: [
        `${mark('√(a + b)')} is not ${mark('√a + √b')}.`,
        `Reporting ${mark('±√a')} for a plain root — the radical symbol means the positive root.`,
        'Rounding too early in a longer calculation.',
      ],
    };
  }
  return {
    tips: [
      'PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).',
      'Multiplication and division share a tier — resolve them left to right, not multiplication first.',
      'Use parentheses to force a different order of operations.',
    ],
    common_mistakes: [
      'Adding or subtracting before multiplying or dividing.',
      'Evaluating left to right while ignoring precedence.',
      'Sign errors when subtracting a negative number.',
    ],
  };
}

// 'modulus' | 'division' | 'power' | 'multiplication' | 'sum', from the top
// of the parse tree; a bare 3*i (one number times i) is not a product.
function complexOperation(text) {
  try {
    let node = math.parse(text);
    while (node.type === 'ParenthesisNode') node = node.content;
    if (node.type === 'FunctionNode' && node.fn?.name === 'abs') return 'modulus';
    if (node.type !== 'OperatorNode') return 'sum';
    if (node.fn === 'divide') return 'division';
    if (node.fn === 'pow') return 'power';
    if (node.fn === 'multiply') {
      const imaginaryUnit = (n) => n.type === 'SymbolNode' && n.name === 'i';
      const plain = node.args.some((a) => a.type === 'ConstantNode') && node.args.some(imaginaryUnit);
      return plain ? 'sum' : 'multiplication';
    }
    return 'sum';
  } catch {
    return /\//.test(text) ? 'division' : /\^/.test(text) ? 'power' : 'sum';
  }
}

// By the operation the input actually uses (one list served a sum, a
// modulus and a division alike; October 2026 tips audit).
export function complexGuidance(expr) {
  const t = String(expr).replace(/\s+/g, '');
  // The operation at the top of the parse tree (the text has "*" inserted
  // for every 3i, so the operators cannot be read off the string).
  const kind = complexOperation(t);
  if (kind === 'modulus') {
    return {
      tips: [
        `The modulus ${mark('|a + bi| = √(a² + b²)')} is the distance from ${mark('0')} to the point ${mark('(a, b)')} in the complex plane — Pythagoras.`,
        `${mark('|3 + 4i| = 5')}: the 3-4-5 triangle. A real number's modulus is its absolute value.`,
        `${mark('|zw| = |z|·|w|')} and ${mark('|z/w| = |z|/|w|')}: the modulus multiplies and divides along with the numbers.`,
      ],
      common_mistakes: [
        `Writing ${mark('|a + bi|')} as ${mark('a + b')} or ${mark('|a| + |b|')}: it is the square root of the sum of the squares.`,
        `Keeping the ${mark('i')}: ${mark('|3 + 4i|')} is the real number ${mark('5')}, not ${mark('5i')}.`,
      ],
    };
  }
  if (kind === 'division') {
    return {
      tips: [
        `To divide, multiply the top and the bottom by the conjugate of the bottom (${mark('c + di → c − di')}): ${mark('(c + di)(c − di) = c^2 + d^2')} is real.`,
        `${mark('i')} is defined by ${mark('i^2 = −1')}: multiply complex numbers like binomials, then replace ${mark('i^2')} with ${mark('−1')}.`,
        `${mark('1/i = −i')}: multiplying top and bottom by ${mark('i')} gives ${mark('i/i² = i/(−1)')}.`,
      ],
      common_mistakes: [
        `Dividing the real and imaginary parts separately by a complex number: ${mark('(3 + 4i)/(1 − 2i)')} is not ${mark('3/1 + 4i/(−2i)')}.`,
        `Using the conjugate on the bottom only: both top and bottom are multiplied by it, or the value changes.`,
      ],
    };
  }
  if (kind === 'power') {
    return {
      tips: [
        `Powers of ${mark('i')} cycle every 4: ${mark('i, −1, −i, 1')} — divide the exponent by 4 and keep the remainder: ${mark('i^10 = i^2 = −1')}.`,
        `${mark('(a + bi)^2 = a² − b² + 2·a·b·i')}: expand like a binomial and replace ${mark('i^2')} with ${mark('−1')}; a higher power is repeated multiplication.`,
        `${mark('i')} is defined by ${mark('i^2 = −1')}, so ${mark('i^3 = i^2·i = −i')} and ${mark('i^4 = 1')}.`,
      ],
      common_mistakes: [
        `Leaving ${mark('i^2')} in the answer instead of replacing it with ${mark('−1')}.`,
        `Squaring term by term: ${mark('(1 + i)^2')} is ${mark('2i')}, not ${mark('1 + i^2 = 0')}.`,
      ],
    };
  }
  if (kind === 'multiplication') {
    return {
      tips: [
        `${mark('i')} is defined by ${mark('i^2 = −1')}: multiply complex numbers like binomials (FOIL), then replace ${mark('i^2')} with ${mark('−1')}.`,
        `${mark('(a + bi)(c + di) = (ac − bd) + (ad + bc)i')}: the ${mark('−bd')} is the ${mark('i^2')} term with its sign flipped.`,
        `A real factor scales both parts: ${mark('2(3 + 4i) = 6 + 8i')}.`,
      ],
      common_mistakes: [
        `Leaving ${mark('i^2')} in the answer instead of replacing it with ${mark('−1')}.`,
        `Multiplying real parts together and imaginary parts together: ${mark('(2 + 3i)(1 − i)')} is not ${mark('2 − 3i')}.`,
      ],
    };
  }
  return {
    tips: [
      'Add or subtract complex numbers part by part: real with real, imaginary with imaginary.',
      `${mark('√(−4) = 2i')}: a square root of a negative number is ${mark('i')} times the root of the positive number, and then it adds like any other imaginary term.`,
      `A real number is ${mark('a + 0i')} and an imaginary one ${mark('0 + bi')}: both fit the same form.`,
    ],
    common_mistakes: [
      `Adding a real part to an imaginary one: ${mark('3 + 2i')} does not simplify to ${mark('5')} or ${mark('5i')}.`,
      `Writing ${mark('√(−4)')} as ${mark('−2')}: it is ${mark('2i')}.`,
    ],
  };
}
