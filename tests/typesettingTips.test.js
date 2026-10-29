import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import { solveProblem } from '../src/lib/api.js';
import { segmentMathText, toLatex, MATH_WORDS } from '../src/lib/latex.js';
import { CONVERTED, LEAK } from './helpers/typesetProblems.js';

// 1.53.0: tips and mistakes are typeset, by their ⟦…⟧ markers only ('marked'
// mode: unmarked text stays prose). The clause heuristics the steps fall
// back on were tried first and measured: of 276 distinct tips and mistakes,
// 75 left a formula in plain text and several typeset half a phrase
// ("Reading (x − 2)(x − 3) = 0 as ⟦x = −2⟧ or −3"), so every solver marks
// its own.

// Paths whose tips the step list does not reach: refusals and parse
// errors (api.js), the nudge-free Auto-detect wrapper, the log convention.
const EXTRA = [
  ['algebra', 'sin()'], ['algebra', '2 3'], ['algebra', 'hello'], ['algebra', "y'' + y = 0"], ['algebra', 'determinant of [[1,2],[3,4]]'],
  ['algebra', 'log(x) = 2'], ['other', '8/2(2+2)'], ['other', '2/0'], ['other', '0/0'], ['trigonometry', 'sin x'],
  ['auto', 'derivative of x^3'], ['auto', 'two plus one'], ['functions', '2/0'], ['limits', '5'],
  // Derivatives, implicit differentiation and limits.
  ['derivatives', 'x^3 at x = a'], ['derivatives', '1/x^2'], ['derivatives', 'e^x'], ['derivatives', 'ln(x)'], ['derivatives', 'sin(x)'],
  ['derivatives', 'x*y + y^2 = 5'], ['derivatives', 'x^2 + y^2 = 25 at x = 3'], ['derivatives', 'x^2 + y^2 = 25 at (1, 1)'],
  ['derivatives', 'x^2 + y^2 = 25 at (5, 0)'], ['derivatives', 'foo(x)'], ['derivatives', 'x^2 +* 3'],
  ['limits', 'lim x->0 1/x'], ['limits', 'lim x->0 tan(pi/2)'], ['limits', 'lim x->0 1/0'], ['limits', 'lim h->0 ((x+h)^2 - x^2)/h'],
  ['limits', 'lim h->0 abs(x+h)/h'], ['limits', 'lim sin(x)/x'], ['limits', 'lim'], ['limits', 'lim x->0 (x+'],
  // Integrals and functions.
  ['integrals', 'cos(x)'], ['integrals', 'e^x'], ['integrals', '1/x'], ['integrals', '1/(2x+1)'], ['integrals', 'x!'],
  ['integrals', '∫_1^∞ 1/x dx'], ['integrals', '∫_0^1 1/x^2 dx'], ['integrals', '∫_-1^2 1/x^(1/3) dx'], ['integrals', '∫_a^b x dx'],
  ['integrals', '∫'], ['integrals', 'sin(x'], ['integrals', 'x^x'], ['integrals', 'sin(x)/x'], ['functions', '5'], ['functions', 'x +* 2'],
  // Every differentiation rule's whole list (1.61.0).
  ['derivatives', '(2x+1)^5'], ['derivatives', 'arctan(2x)'], ['derivatives', 'e^(3x)'], ['derivatives', 'ln(x^2+1)'], ['derivatives', 'sec(x)'],
  ['derivatives', '2^x'], ['derivatives', 'sinh(x)'], ['derivatives', 'erf(x)'], ['derivatives', 'arcsin(x)'], ['derivatives', 'x*y = 1'],
  ['derivatives', '3x^4 - 2x + 7'], ['derivatives', 'x^2*e^(3x)'], ['derivatives', 'ln(x) at x = -1'], ['derivatives', 'third derivative of sin(2x)'],
  ['derivatives', 'fourth derivative of x^5'], ['derivatives', 'x^(1/3) at x = -8'], ['derivatives', 'x^x'], ['derivatives', 'second derivative of x*e^x'],
  // Every equation method's whole list, with its worked line (1.62.0).
  ['algebra', 'x^2 - 3x = 0'], ['algebra', 'x^2 - 6x + 9 = 0'], ['algebra', 'x^2 = 9'], ['algebra', 'x^2 = -4'], ['algebra', 'ln(x) + ln(x+1) = ln(6)'],
  ['algebra', '2^x = 10'], ['algebra', 'x^(2/3) = 4'], ['algebra', 'x/(x-1) = 2'], ['algebra', '2(x+3) = 2x+6'], ['algebra', '5x - 7 = 5x + 2'],
  ['algebra', 'log(x) + log(x - 3) = 1'], ['algebra', 'sqrt(2x+1) = x - 1'], ['algebra', '1/x + 1/(x+1) = 1'], ['algebra', 'x^2 + x + 1 = 0'],
  ['algebra', 'x^(4/6) = 4'], ['algebra', 'x^3 = 2'], ['algebra', 'x^4 + 1 = 0'], ['algebra', 'x^4 = 5'], ['algebra', 'abs(x-1) = -3'], ['algebra', 'e^x = -2'],
  ['algebra', '1/(x-1) = 0'], ['algebra', 'x*e^x = 1'], ['algebra', 'factor x^2 - 9'], ['algebra', 'sqrt(72)'], ['algebra', 'expand (x+1)^2'], ['algebra', '(x^2-1)/(x-1)'],
  // Every integration method's whole list (1.60.0: more insights behind "Show more").
  ['integrals', '2^x'], ['integrals', 'sinh(x)'], ['integrals', 'tan(x)^2'], ['integrals', 'sec(x)^3'], ['integrals', 'ln(x)'],
  ['integrals', 'e^x*sin(x)'], ['integrals', 'x^2*sin(x)'], ['integrals', 'sin(x)^3'], ['integrals', 'sin(x)^2*cos(x)^2'], ['integrals', '(x^3+1)/(x-1)'],
  ['integrals', '(2x+3)/(x^2+1)'], ['integrals', '1/(1+e^x)'], ['integrals', 'e^(-x^2)'], ['integrals', '1/sqrt(x^2+4)'], ['integrals', 'tan(x)'],
  ['integrals', '1/(1+x^2)'], ['integrals', '∫_0^∞ e^(-x) dx'], ['integrals', '∫_0^1 sqrt(1+x^4) dx'], ['integrals', '∫_0^1 1/sqrt(x) dx'],
  ['integrals', '1/(x^3 - 2)'], ['integrals', 'sqrt(x^2-9)/x'], ['integrals', '1/(x^2*sqrt(x^2+9))'], ['integrals', 'x*e^x'], ['integrals', '∫_0^1 ln(x) dx'],
  // Algebra, systems and inequalities.
  ['algebra', '|2x - 3| = 5'], ['algebra', 'x/(x-2) = 3'], ['algebra', '3x - 6 + 4'], ['algebra', 'expand (x+1)^2'], ['algebra', 'factor x^2 - 9'],
  ['algebra', 'sqrt(72)'], ['algebra', '= 5'], ['algebra', 'x^101 - 1 = 0'], ['algebra', '2x + 3y = 6'], ['algebra', 'sin(x*y) = x + y'],
  ['algebra', 'x + y = 2; x + y = 5'], ['algebra', 'y = x + 1; x^2 + y^2 = 25'], ['algebra', 'x + y + z = 6; x - y + z = 2; 2x + y - z = 1'],
  ['algebra', 'x + y + z = 1; x + y + z = 2; x - y = 0'], ['algebra', 'x + y + z = 1; 2x + 2y + 2z = 2; x - y = 0'],
  ['algebra', 'x^2 + y^2 = 1; x^2 + y^2 = 4'], ['algebra', '-1 < 2x + 1 < 5'], ['algebra', '3 > 2'], ['algebra', '2x + 3 > 7'],
  ['algebra', 'x + 1 >= x + 1'], ['algebra', 'x + y > 1'], ['algebra', 'x*y = 1'], ['algebra', 'x^5 + y^5 + x*y = 1'],
  // Trigonometry and arithmetic.
  ['trigonometry', 'arcsin(2)'], ['trigonometry', 'cot(pi/4)'], ['trigonometry', '30°'], ['trigonometry', 'tan(x) = sin(x)/cos(x)'],
  ['trigonometry', 'sin(x) = sin(2x)'], ['trigonometry', 'sin(15)'], ['trigonometry', 'sin(+)'], ['trigonometry', 'sin(2x) = sin(2x)'],
  ['trigonometry', 'sin(x) = sin(x + 2*pi)'], ['trigonometry', 'tan(x)^2 - 1 = 0'], ['trigonometry', 'sin(x) = sin(y)'], ['trigonometry', 'sin(x^2) = 0'],
  ['other', 'Infinity - Infinity'], ['other', 'Infinity + 1'], ['other', '5 mod 0'], ['other', 'ln(0)'], ['other', '2^(-3)'], ['other', '1/2 / 3/4'], ['other', '2 +* 3'],
];

// A word typeset as math (KaTeX sets it as italic letters): a letter run of
// three or more that is not a math name.
const wordInMath = (run) => (run.match(/[A-Za-z]{3,}/g) || []).find((w) => !MATH_WORDS.has(w) && !MATH_WORDS.has(w.toLowerCase()));

test('every tip and mistake typesets its formulas, and only its formulas', async () => {
  const seen = new Map();
  for (const [topic, problem] of [...CONVERTED, ...EXTRA]) {
    const r = await solveProblem(problem, topic);
    for (const t of [...(r.tips || []), ...(r.common_mistakes || [])]) if (!seen.has(t)) seen.set(t, `${topic}: ${problem}`);
  }
  const leaks = [];
  const words = [];
  const broken = [];
  for (const [t, where] of seen) {
    for (const seg of segmentMathText(t, { mode: 'marked' })) {
      // Quoted text is literal input, what to type: "Use * for
      // multiplication: "2*3"" keeps its * (typeset, it would show ·).
      if (seg.type === 'text' && LEAK.test(seg.value.replace(/"[^"]*"|“[^”]*”/g, '""'))) leaks.push(`[${where}] ${t}`);
      if (seg.type !== 'math') continue;
      const w = wordInMath(seg.value);
      if (w) words.push(`[${where}] "${w}" in ⟦${seg.value}⟧`);
      try {
        katex.renderToString(toLatex(seg.value), { throwOnError: true, output: 'htmlAndMathml', trust: false });
      } catch (e) {
        broken.push(`[${where}] ⟦${seg.value}⟧ (${e.message.slice(0, 60)})`);
      }
    }
  }
  assert.ok(seen.size > 350, `only ${seen.size} tips and mistakes reached`);
  assert.deepEqual([...new Set(leaks)], [], `math left as plain text in a tip or mistake:\n${[...new Set(leaks)].join('\n')}`);
  assert.deepEqual(words, [], `a word typeset as math:\n${words.join('\n')}`);
  assert.deepEqual(broken, [], `math runs KaTeX rejects:\n${broken.join('\n')}`);
});
