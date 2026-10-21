import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import { solveProblem } from '../src/lib/api.js';
import { segmentMathText, toLatex } from '../src/lib/latex.js';

// October 2026 roadmap P1, first increment (1.50.0): the derivative,
// implicit, limit, integral, algebra and Functions solvers mark their math
// with ⟦…⟧. Measured on these problems before the change, 96 of 331 steps
// left math in a plain-text run ("Let u = 3x^2 (the inside)…", "write the
// coefficients 1, (-6), 11, (-6)…"). Systems, inequalities, trigonometry
// and arithmetic are the next increment and are not checked here yet.
const CONVERTED = [
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
];

// Math left in a text run: an equation, a power, a function call, a
// derivative operator, an operator between short operands.
const LEAK = /[a-z0-9)²³]\s*[=^]\s*[-a-z0-9(√]|[√∫]|\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|exp|arcsin|arctan)\(|\bd\/d[a-z]\b|(?<![a-z])[a-z0-9)]{1,3}\s*[·*/]\s*[0-9a-z(]{1,3}(?![a-z])|[a-z]\^/i;

test('the converted solvers leave no math in a plain-text run, and every math run typesets', async () => {
  const leaks = [];
  const broken = [];
  for (const [topic, problem] of CONVERTED) {
    const r = await solveProblem(problem, topic);
    for (const step of r.steps) {
      for (const seg of segmentMathText(step)) {
        if (seg.type === 'text' && LEAK.test(seg.value)) leaks.push(`${problem}: ${JSON.stringify(seg.value)}`);
        if (seg.type === 'math') {
          try {
            katex.renderToString(toLatex(seg.value), { throwOnError: true, output: 'htmlAndMathml', trust: false });
          } catch (e) {
            broken.push(`${problem}: ${seg.value} (${e.message.slice(0, 60)})`);
          }
        }
      }
    }
  }
  assert.deepEqual(leaks, [], `math left as plain text:\n${leaks.join('\n')}`);
  assert.deepEqual(broken, [], `math runs KaTeX rejects (they would fall back to plain text):\n${broken.join('\n')}`);
});

const mathRuns = (step) => segmentMathText(step).filter((s) => s.type === 'math').map((s) => s.value);

test('the roadmap\'s mixed steps typeset as whole runs', async () => {
  // "write the coefficients 1, (−6), 11, (−6); bring down 1" — the example
  // no heuristic could split.
  const cubic = await solveProblem('x^3 - 6x^2 + 11x - 6 = 0', 'algebra');
  const division = cubic.steps.find((s) => /^Synthetic division/.test(s));
  assert.ok(mathRuns(division).includes('1, (-6), 11, (-6)'), division);
  assert.ok(mathRuns(division).includes('x^2 - 5x + 6'), division);

  // The chain rule: u and the outer function, each typeset whole.
  const chain = await solveProblem('sin(3x^2)', 'derivatives');
  const letU = chain.steps.find((s) => /\(the inside\)/.test(s));
  assert.deepEqual(mathRuns(letU), ['u = 3x^2', 'sin(u)']);

  // The trig substitution: sin and cos in the same typeface throughout.
  const trig = await solveProblem('sqrt(1 - x^2)', 'integrals');
  const sub = trig.steps.find((s) => /^The integrand has the form/.test(s));
  assert.ok(mathRuns(sub).includes('x = sin θ'), sub);
  assert.ok(mathRuns(sub).some((m) => /^√\(1 - x\^2\) = √\(1 − sin²θ\) = cos θ$/.test(m)), sub);

  // An integration label stays prose beside a typeset formula.
  const power = await solveProblem('2*x + 1', 'integrals');
  assert.deepEqual(segmentMathText(power.steps.find((s) => /Power rule/.test(s) && /∫\(2x\)/.test(s))).map((s) => s.type), ['math', 'text']);

  // "Evaluate lim (x→0) …": the limit is one run, the verb prose.
  const lim = await solveProblem('lim x->0 (sin(x)/x)', 'limits');
  assert.deepEqual(segmentMathText(lim.steps[0]), [{ type: 'text', value: 'Evaluate ' }, { type: 'math', value: 'lim (x→0) (sin(x)/x)' }]);
});
