// r/mathematics, November 2026: a limit with an imaginary number inside or
// outside it got an incorrect solution. MasterMath works limits of real
// functions; a complex-valued limit is refused, never "does not exist", and
// text outside the limit is refused, never dropped (1.73.1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test("the commenter's two limits are refused as complex-valued, not \"does not exist\"", async () => {
  for (const p of ['lim x->2 (x√(-1))', 'lim x->∞ (3^(x)) - e^(π√(-1))']) {
    for (const topic of ['auto', 'limits']) {
      const r = await solvePlain(p, topic);
      assert.equal(r.status, 'unsupported', `${p} (${topic}): ${r.answer}`);
      assert.equal(r.answer, "Complex-valued limits aren't supported", p);
      assert.doesNotMatch(r.steps.join(' '), /does not exist/, p);
    }
  }
});

test('i, or an even root of a negative number, anywhere in a limit is refused', async () => {
  for (const p of ['lim x->2 x*i', 'lim x->0 sin(i*x)/x', 'lim x->0 (e^(i*x) - 1)/x', 'lim x->0 x + sqrt(-4)', 'lim x->0 x*(-9)^(1/2)', 'lim x->i x^2']) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, "Complex-valued limits aren't supported", `${p}: ${r.answer}`);
  }
});

test('text in front of a limit is refused, not ignored', async () => {
  const r = await solvePlain('i * lim x->0 (sin(x)/x)', 'auto');
  assert.equal(r.status, 'unsupported');
  assert.match(r.answer, /^Only a single limit can be worked: "i \*" before it would be ignored$/);
  const two = await solvePlain('2 + lim x->0 (sin(x)/x)', 'auto');
  assert.equal(two.status, 'unsupported');
});

test('real limits and their instruction words are unchanged', async () => {
  for (const [p, answer] of [
    ['lim x->0 (sin(x)/x)', 'lim (x→0) (sin(x)/x) = 1'],
    ['what is lim x->0 sin(x)/x', 'lim (x→0) sin(x)/x = 1'],
    ['evaluate: lim x->1 x^2', 'lim (x→1) x^2 = 1'],
    ['find the limit of sin(x)/x as x->0', 'lim (x→0) sin(x)/x = 1'],
    ['lim x->inf (1+1/x)^x', 'lim (x→∞) (1 + 1/x)^x = e (≈ 2.7183)'],
  ]) {
    assert.equal((await solvePlain(p, 'auto')).answer, answer, p);
  }
  // A root of a negative expression in x is a real-domain question, as before.
  assert.equal((await solvePlain('lim x->0 sqrt(x - 4)', 'auto')).status, 'solved');
});
