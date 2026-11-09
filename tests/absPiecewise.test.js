// Several absolute values of linear insides (1.76.0): the number line split
// where each inside is 0, the equation solved on each piece, a root kept only
// in its own piece, and a piece true for every x kept whole. |x| + |x − 2| = 4
// fell to the numeric search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('|x| + |x − 2| = 4 and its family, piece by piece', async () => {
  for (const [p, answer] of [
    ['abs(x) + abs(x-2) = 4', 'x = -1  or  x = 3'],
    ['abs(x) + abs(x-2) = 2', '0 ≤ x ≤ 2'],
    ['abs(x) + abs(x-2) = 1', 'No real solution'],
    ['abs(x) - abs(x-2) = 2', 'x ≥ 2'],
    ['abs(x-1) - abs(2x+3) = x', 'x = -1/2'],
    ['abs(x+1) + abs(x-1) = x^2', 'x = -2  or  x = 2'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(!r.steps.some((s) => /found numerically|crosses zero/.test(s)), `${p}: still the numeric search`);
  }
  const r = await solvePlain('abs(x) + abs(x-2) = 4', 'auto');
  assert.ok(r.steps.includes('For x < 0: |x| = −x, |x - 2| = −(x - 2), so the equation is -2x + 2 = 4. It gives x = -1, in this piece ✓'), r.steps.join('\n'));
  assert.ok(r.steps.includes('For 0 ≤ x < 2: |x| = x, |x - 2| = −(x - 2), so the equation is 2 = 4. That is false, so there is no solution here.'), r.steps.join('\n'));
  const out = await solvePlain('abs(x+1) + abs(x-1) = x^2', 'auto');
  assert.ok(out.steps.some((s) => /x = 0, not in this piece, so rejected/.test(s)), out.steps.join('\n'));
});

test('|A| = |B| and |g| = S keep their own methods', async () => {
  assert.equal((await solvePlain('abs(x+2) = abs(2x-1)', 'auto')).answer, 'x = -1/3  or  x = 3');
  assert.equal((await solvePlain('abs(2x-3) = x+1', 'auto')).answer, 'x = 2/3  or  x = 4');
});
