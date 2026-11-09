// |g| = an expression in x (user report, November 2026; 1.73.3):
// |2x − 3| = x + 1 fell to the numeric scan, "x ≈ 0.6667 or x = 4" with no
// cases shown; |x| = x was "no solution was found" though every x ≥ 0 is one.
// Now two cases, each solved exactly, a root kept only where the right side
// is ≥ 0, and an identity case gives the interval where it holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('|g| = S: two exact cases, a root rejected where S < 0', async () => {
  for (const [p, answer] of [
    ['abs(2x-3) = x+1', 'x = 2/3  or  x = 4'],
    ['abs(x-1) = 2x+4', 'x = -1'],
    ['2abs(x+1) - 3 = x', 'x = -5/3  or  x = 1'],
    ['abs(x^2-4) = 3x', 'x = 1  or  x = 4'],
    ['abs(x) = x - 2', 'No real solution'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(!r.steps.some((s) => /crosses zero/.test(s)), `${p}: still the numeric scan`);
  }
  const r = await solvePlain('abs(2x-3) = x+1', 'auto');
  assert.ok(r.steps.includes('Case 2: 2x - 3 = −(x + 1)'), r.steps.join('\n'));
  assert.ok(r.steps.includes('  Collect the x terms: 3x = 2, so x = 2/3.'), r.steps.join('\n'));
  assert.ok(r.steps.some((s) => /x = 2\/3 gives 5\/3 on both sides/.test(s)), r.steps.join('\n'));
  const rej = await solvePlain('abs(x-1) = 2x+4', 'auto');
  assert.ok(rej.steps.includes('Reject x = -5: there 2x + 4 = -6, which is negative, and an absolute value cannot equal a negative number.'), rej.steps.join('\n'));
});

test('|g| = S true for every x on a stretch: the interval, not "no solution"', async () => {
  for (const [p, answer] of [
    ['abs(x) = x', 'x ≥ 0'],
    ['abs(x) = -x', 'x ≤ 0'],
    ['abs(x-2) = x - 2', 'x ≥ 2'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
});

test('|g| = a number is unchanged', async () => {
  assert.equal((await solvePlain('abs(2x-3) = 5', 'auto')).answer, 'x = -1  or  x = 4');
});
