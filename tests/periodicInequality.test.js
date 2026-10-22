import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';

// October 2026 release review: sin(x) > 1/2 listed the intervals between
// −50 and 50 as if they were the whole answer. A periodic inequality is now
// solved on one period and stated for every period.

const solve = (p, topic = 'algebra') => solveProblem(p, topic);

test('sin(x) > 1/2 is solved on one period and repeated, with exact endpoints', async () => {
  const r = await solve('sin(x) > 1/2');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, 'π/6 + 2πn < x < 5π/6 + 2πn, for every integer n');
  const text = r.steps.join('\n');
  assert.match(text, /periodic with period 2π/);
  assert.match(text, /0 at x = π\/6, 5π\/6/);
  assert.match(text, /\(5π\/6, 2π\) negative/);
  assert.doesNotMatch(r.answer, /49|50/); // never a window
  // Routed from Trigonometry the same way.
  assert.equal((await solve('sin(x) > 1/2', 'trigonometry')).answer, r.answer);
});

test('the shapes a period can take: a wrap, a touch, nothing, everything, a shorter period', async () => {
  const cases = [
    ['cos(x) > 0', '-π/2 + 2πn < x < π/2 + 2πn, for every integer n'],
    ['2cos(x) - 1 <= 0', 'π/3 + 2πn ≤ x ≤ 5π/3 + 2πn, for every integer n'],
    ['sin(x) >= 1', 'x = π/2 + 2πn, for every integer n'],
    ['sin(x) >= 0', '2πn ≤ x ≤ π + 2πn, for every integer n'],
    ['sin(2x) > 0', 'πn < x < π/2 + πn, for every integer n'],
    ['sin(x) > 1', 'No solution — no value satisfies the inequality'],
    ['sin(x) < 2', 'All real numbers satisfy the inequality'],
  ];
  for (const [p, answer] of cases) {
    const r = await solve(p);
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  assert.match((await solve('cos(x) > 0')).steps.join('\n'), /join into one interval/);
});

test('an endpoint that is not a multiple of π is a decimal, marked ≈', async () => {
  const r = await solve('sin(x) > 0.3');
  assert.equal(r.answer, '0.3047 + 2πn < x < 2.8369 + 2πn, for every integer n (endpoints ≈)');
});

test('a periodic inequality with breaks, or inside a compound, is refused, not truncated', async () => {
  const tan = await solve('tan(x) > 1');
  assert.equal(tan.status, 'unsupported');
  assert.match(tan.answer, /periodic and has breaks/);
  const compound = await solve('-1 < sin(x) < 1/2');
  assert.equal(compound.status, 'unsupported');
  assert.match(compound.answer, /periodic/);
  // Non-periodic inequalities are untouched.
  assert.equal((await solve('x^2 - 4 > 0')).answer, 'x < -2  or  x > 2');
});
