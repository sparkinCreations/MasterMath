import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { beautify } from '../src/lib/solvers/solverUtils.js';

// Sixth outside review (October 2026), two rounds.

test('a differential equation is refused, never "solved" as 0', async () => {
  for (const [t, p] of [['algebra', "y'' + y = 0"], ['derivatives', "y' = 2x"], ['derivatives', 'dy/dx = 2x'], ['algebra', "y′ + 2y = 0"]]) {
    const r = await solveProblem(p, t);
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /Differential equations are not supported/);
    assert.match(r.steps.join('\n'), /differential equation/i);
  }
  // f'(x) = 2x and y'(x) = 3x^2 give a derivative, not the function: also
  // ODEs (1.53.2), as is f''(x) + f(x) = 0, which answered "f''(f) = 0".
  for (const p of ["f'(x) = 2x", "y'(x) = 3x^2", "f''(x) + f(x) = 0"]) {
    assert.equal((await solveProblem(p, 'derivatives')).answer, 'Differential equations are not supported', p);
  }
});

test('matrices are refused with a message that says so', async () => {
  for (const p of ['determinant of [[1,2],[3,4]]', '[[1,2],[3,4]] * [[1],[0]]', 'eigenvalues of [[2,0],[0,3]]', 'inverse of the matrix [[1,2],[3,4]]']) {
    const r = await solveProblem(p, 'other');
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /Matrices are not supported yet/);
    assert.doesNotMatch(r.steps.join('\n'), /determinantof/);
  }
});

test('a polynomial integrand keeps its expanded antiderivative', async () => {
  assert.equal((await solveProblem('2x + 1', 'integrals')).answer, '∫(2x + 1) dx = x^2 + x + C');
  assert.equal((await solveProblem('x^2 - 3x + 2', 'integrals')).answer, '∫(x^2 - 3x + 2) dx = 1/3*x^3 - 3/2*x^2 + 2x + C');
});

test('log base 2 is shown as log_2(x), not log(x)/log(2)', async () => {
  assert.equal(beautify('(log(x)/log(2))'), 'log_2(x)');
  assert.equal(beautify('3*log(x+1)/log(10)'), '3log(x + 1)'); // base 10 is the common log, written plainly
  const r = await solveProblem('log2(x)', 'derivatives');
  assert.match(r.steps[0], /f\(x\) = log_2\(x\)/);
  assert.doesNotMatch(r.steps.join('\n'), /log\(x\)\/log\(2\)/);
  assert.equal(r.answer, "f'(x) = 1/(x*ln(2)), x > 0");
});

test('∫1/(x² − 1) dx shows the partial-fraction working instead of a table formula', async () => {
  const r = await solveProblem('1/(x^2 - 1)', 'integrals');
  const text = r.steps.join('\n');
  assert.match(text, /partial fraction/i);
  assert.match(text, /\(x - 1\)\(x \+ 1\)|\(x \+ 1\)\(x - 1\)/);
  assert.doesNotMatch(text, /Table antiderivative/);
  assert.match(r.answer, /ln\|/);
  // 1/(x + 1) is a plain substitution, not partial fractions.
  assert.doesNotMatch((await solveProblem('1/(x+1)', 'integrals')).steps.join('\n'), /partial fraction/i);
});
