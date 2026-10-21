import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { integrateByTrigSubstitution } from '../src/lib/solvers/trigSubstitutionSolver.js';
import { lnify, expressionsNumericallyEqual } from '../src/lib/solvers/solverUtils.js';
import { niceTicks } from '../src/lib/graphSampling.js';

// Fourth outside review (October 2026).

test('∫√(1 − x²) dx is worked as a trigonometric substitution and written with a root', async () => {
  const r = await solveProblem('∫√(1−x²) dx', 'integrals');
  assert.equal(r.answer, '∫(sqrt(1 - x^2)) dx = 1/2*arcsin(x) + 1/2*x*√(1 - x^2) + C');
  const text = r.steps.join('\n');
  assert.match(text, /substitute x = sin θ \(−π\/2 ≤ θ ≤ π\/2\), so dx = cos θ dθ/);
  assert.match(text, /∫cos²θ dθ/);
  assert.match(text, /Half-angle identity/);
  assert.match(text, /right triangle \(opposite x, hypotenuse 1\)/);
  assert.doesNotMatch(text, /u-substitution|\^\(1\/2\)|\/1\b/);
  assert.match(r.tips[0], /^Trigonometric substitution/);
});

test('trig substitution handles a² and b²x² with exact coefficients, and declines other shapes', () => {
  const four = integrateByTrigSubstitution('sqrt(4 - x^2)', 'x');
  assert.equal(four.antiderivative, '2*arcsin(x/2) + 1/2*x*sqrt(4 - x^2)');
  assert.ok(expressionsNumericallyEqual('2*asin(x/2) + 1/2*x*sqrt(4 - x^2)', '2*asin(x/2) + x/2*sqrt(4-x^2)', 'x'));
  const mixed = integrateByTrigSubstitution('3*sqrt(9 - 4*x^2)', 'x');
  assert.equal(mixed.antiderivative, '27/4*arcsin(2*x/3) + 3/2*x*sqrt(9 - 4*x^2)');
  assert.match(mixed.steps[0], /a = 3 and b = 2: substitute x = \(3\/2\)·sin θ/);
  assert.equal(integrateByTrigSubstitution('sqrt(x^2 - 1)', 'x'), null);
  assert.equal(integrateByTrigSubstitution('sqrt(1 + x^2)', 'x'), null);
  assert.equal(integrateByTrigSubstitution('x*sqrt(1 - x^2)', 'x'), null);
});

test('the trig-substitution antiderivative passes the differentiate-back gate for several radicands', async () => {
  for (const p of ['sqrt(4 - x^2)', '3*sqrt(9 - 4x^2)', 'sqrt(1-x^2) + x']) {
    const r = await solveProblem(p, 'integrals');
    assert.equal(r.status, 'solved', p);
    assert.match(r.steps.join('\n'), /trigonometric substitution|substitute x = /);
  }
});

test('lnify writes roots as roots and 1 − x² the way a person would', () => {
  assert.equal(lnify('1/2*arcsin(x) + 1/2*x*(-x^2 + 1)^(1/2)'), '1/2*arcsin(x) + 1/2*x*√(1 - x^2)');
  assert.equal(lnify('(x^2+1)^(1/2)'), '√(x^2 + 1)');
  assert.equal(lnify('log(x)'), 'ln|x|');
});

test('niceTicks gives round, evenly spaced ticks', () => {
  assert.deepEqual(niceTicks(-9.63, 4.41).ticks, [-10, -5, 0, 5]);
  assert.deepEqual(niceTicks(-0.42, 9.4).ticks, [-2.5, 0, 2.5, 5, 7.5, 10]);
  assert.deepEqual(niceTicks(-2.6, 2.5, { count: 7, extend: false }).ticks, [-2, -1, 0, 1, 2]);
  assert.deepEqual(niceTicks(-0.37, 0.71).ticks, [-0.5, 0, 0.5, 1]);
  assert.equal(niceTicks(-0.42, 9.4).decimals, 1);
  assert.equal(niceTicks(3, 3), null);
  assert.equal(niceTicks(NaN, 1), null);
  for (const { ticks } of [niceTicks(-9.63, 4.41), niceTicks(-124248, 124248), niceTicks(0.001, 0.0123)]) {
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), `uneven: ${ticks}`);
  }
});
