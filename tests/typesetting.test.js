import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import { solveProblem } from '../src/lib/api.js';
import { segmentMathText, toLatex } from '../src/lib/latex.js';
import { CONVERTED, LEAK } from './helpers/typesetProblems.js';

// October 2026 roadmap P1: every solver marks its math with ⟦…⟧. The
// first increment (1.50.0) converted the derivative, implicit, limit,
// integral, algebra and Functions solvers — 96 of 331 steps had left math in
// a plain-text run ("Let u = 3x^2 (the inside)…", "write the coefficients
// 1, (-6), 11, (-6)…"). The second (1.51.0) converted linear equations,
// systems, inequalities, trigonometry, trig equations, arithmetic and the
// rare integral paths (erf, general partial fractions, improper integrals):
// 80 of 342 steps leaked before it.

test('the converted solvers leave no math in a plain-text run, and every math run typesets', async () => {
  const leaks = [];
  const broken = [];
  for (const [topic, problem] of CONVERTED) {
    const r = await solveProblem(problem, topic);
    for (const step of r.steps) {
      for (const seg of segmentMathText(step)) {
        // A parse error's step quotes the typed input, which is prose by
        // design: it may not be maths at all ("2+*"), so it is never typeset.
        if (seg.type === 'text' && LEAK.test(seg.value) && !(r.status === 'parse_error' && /^Could not read "/.test(step))) leaks.push(`${problem}: ${JSON.stringify(seg.value)}`);
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
