// The problems the typesetting tests solve: one or more per solver path, so
// every step template (tests/typesetting.test.js) and every tip and mistake
// (tests/typesettingTips.test.js) is rendered at least once.
export const CONVERTED = [
  ['derivatives', 'x^2 + 3*x'], ['derivatives', 'sin(3x^2)'], ['derivatives', 'x^2*sin(x)'], ['derivatives', '(x+1)/(x-1)'],
  ['derivatives', 'ln(x^2 + 1)'], ['derivatives', 'second derivative of x*e^x'], ['derivatives', 'x^x'], ['derivatives', 'abs(2x-4)'],
  ['derivatives', 'x^2 + y^2 = 25 at (3, 4)'], ['derivatives', 'x^3 at x = 2'], ['derivatives', 'sqrt(x-3)'],
  ['integrals', '2*x + 1'], ['integrals', 'x*cos(x^2)'], ['integrals', 'x*e^x'], ['integrals', 'sqrt(1 - x^2)'], ['integrals', '1/(x^2 - 1)'],
  ['integrals', '∫_0^1 x^2 dx'], ['integrals', '∫_1^∞ 1/x^2 dx'], ['integrals', 'sin(x)^2'], ['integrals', '1/(1+4x^2)'], ['integrals', 'abs(x)'],
  ['limits', 'lim x->0 (sin(x)/x)'], ['limits', 'lim x->1 (x^2-1)/(x-1)'], ['limits', 'lim x->0 (sqrt(x+1)-1)/x'], ['limits', 'lim x->infinity (3x^2+1)/(2x^2-5)'],
  ['limits', 'lim x->inf (1 + 1/x)^(2x + 3)'], ['limits', 'lim x->0 (1-cos(x))/x^2'], ['limits', 'lim x->0+ 1/x'], ['limits', 'lim x->0 x*sin(1/x)'],
  ['functions', 'x^2 - 4*x + 3'], ['functions', '1/(x-2)'], ['functions', 'x^3 - x'], ['functions', 'ln(x)'], ['functions', 'sqrt(x-2)'],
  ['algebra', 'x^2 - 5x + 6 = 0'], ['algebra', 'x^2 + x + 1 = 0'], ['algebra', 'x^3 - 6x^2 + 11x - 6 = 0'], ['algebra', 'sqrt(x+2) = x'],
  ['algebra', '2^x = 8'], ['algebra', 'log(x) + log(x - 3) = 1'], ['algebra', 'ln(2x) = 3'],
  // systems
  ['algebra', '2x + 3y = 6; x - y = 4'], ['algebra', 'x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2'], ['algebra', 'x + y = 2; 2x + 2y = 4'],
  ['algebra', 'x + y = 2; x + y = 3'], ['algebra', 'y = x^2; y = x + 2'], ['algebra', 'x^2 + y^2 = 25; x + y = 7'],
  // linear
  ['algebra', '2*x + 5 = 11'], ['algebra', 'x/3 + 1/2 = 5/6'], ['algebra', '3(x - 2) = 2x + 4'], ['algebra', '5x - 7 = 5x + 2'], ['algebra', '2(x+3) = 2x+6'],
  // inequalities
  ['algebra', '2x + 3 <= 7'], ['algebra', '-2x > 4'], ['algebra', 'x^2 - 4 > 0'], ['algebra', '(x-1)/(x+2) <= 0'], ['algebra', 'x^3 - x >= 0'],
  ['algebra', '-1 < 2x + 1 <= 5'], ['algebra', 'x < -1 or x > 3'], ['algebra', 'sin(x) > 1/2'], ['algebra', 'cos(x) > 0'], ['algebra', 'x^2 + 1 > 0'], ['algebra', '|x - 2| < 3'],
  // trig values / identities
  ['trigonometry', 'sin(pi/4)'], ['trigonometry', 'cos(2*pi/3)'], ['trigonometry', 'tan(pi/3)'], ['trigonometry', 'tan(pi/2)'], ['trigonometry', 'sec(pi/3)'],
  ['trigonometry', 'sin(x)^2 + cos(x)^2'], ['trigonometry', 'tan(x) - sin(x)/cos(x)'], ['trigonometry', 'sin(2x) - 2*sin(x)*cos(x)'], ['trigonometry', 'arcsin(1/2)'], ['trigonometry', 'sin(30)'],
  // trig equations
  ['trigonometry', 'sin(x) = 1/2'], ['trigonometry', '2cos(x) - 1 = 0'], ['trigonometry', 'tan(x) = 1'], ['trigonometry', 'sin(2x) = 1'], ['trigonometry', '2sin(x)^2 - 1 = 0'],
  ['trigonometry', '2sin(x)^2 - sin(x) - 1 = 0'], ['trigonometry', 'sin(x) = 2'], ['trigonometry', 'cos(x) = -1'], ['algebra', 'sin(x) + cos(x) = 1'],
  // arithmetic
  ['other', '(5 + 3) * 4 - 2^3'], ['other', '3/4 + 5/6'], ['other', '15% of 80'], ['other', '2^10'], ['other', '7!'], ['other', 'sqrt(50)'], ['other', '8/2(2+2)'], ['other', '17 mod 5'], ['other', '1/3 * 3/4'], ['other', '-3^2'],
  // rare integral paths
  // 1.52.4: a bare polynomial under Algebra shows its factored form; like terms combine in an antiderivative.
  ['algebra', 'x^2-5x+6'], ['algebra', 'x^3 - x'], ['integrals', 'x + 2x'], ['integrals', '2 + 3'],
  ['integrals', 'e^(-x^2)'], ['integrals', '∫_0^1 1/sqrt(x) dx'], ['integrals', '∫_0^1 1/x dx'], ['integrals', '∫_-1^1 1/x dx'], ['integrals', '∫_-1^1 1/x^2 dx'],
  ['integrals', '1/(x^3 + x)'], ['integrals', '∫_0^∞ e^(-x^2) dx'],
];

// Math left in a text run: an equation, a power, a function call, a
// derivative operator, an operator between short operands.
export const LEAK = /[a-z0-9)²³]\s*[=^]\s*[-a-z0-9(√]|[√∫]|\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|exp|arcsin|arctan)\(|\bd\/d[a-z]\b|(?<![a-z])[a-z0-9)]{1,3}\s*[·*/]\s*[0-9a-z(]{1,3}(?![a-z])|[a-z]\^/i;
