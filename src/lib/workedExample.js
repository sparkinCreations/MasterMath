// The landing page's worked example.
// The solver's own output for this problem (tests/reviewTwo.test.js checks
// it still matches), so the landing page never shows steps the app would
// not produce.
export const WORKED_EXAMPLE = {
  problem: 'x^2 - 5x + 6 = 0',
  topic: 'algebra',
  steps: [
    'To factor x^2 - 5x + 6, look for two numbers whose product is 6 (the constant term) and whose sum is -5 (the coefficient of x).',
    'Factor pairs of 6: 1·6, (-1)·(-6), 2·3, (-2)·(-3). Their sums: 7, -7, 5, -5 — the pair -2 and -3 sums to -5.',
    'So x^2 - 5x + 6 = (x - 2)(x - 3). Check by expanding: x·x + (-3)x + (-2)x + (-2)·(-3) = x^2 - 5x + 6. ✓',
    'Set each factor to zero (zero-product property): x - 2 = 0 or x - 3 = 0, so x = 2 or x = 3.',
    'Solution: x = 2  or  x = 3',
    'Check in the original equation: x = 2 gives x^2 - 5x + 6 = 0 and 0 = 0; x = 3 gives x^2 - 5x + 6 = 0 and 0 = 0 ✓',
  ],
  answer: 'x = 2  or  x = 3',
  tip: 'A quadratic has up to two solutions: factor, take square roots, or use x = (−b ± √(b² − 4ac))/(2a).',
};

