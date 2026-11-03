import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';

// 1.68.6 (outside review, November 2026): limits that reached sampling were
// answered from the last sample or from samples that had not settled. Each
// of these is now proved from the expression, refused, or said to be an
// estimate; none is a number read off samples as if it were exact.
const lim = (p) => solvePlain(p, 'limits');

test('limits review: the six wrong limits are proved', async () => {
  for (const [p, method] of [
    ['lim x->inf (sqrt(x+1) - sqrt(x))', 'conjugate of two roots'], // was 0.0001
    ['lim x->inf sqrt(x)/(x+1)', 'leading powers'], // was 0.0001
    ['lim x->inf sin(1/sqrt(x))', 'limit laws'], // was 0.0001
    ['lim x->inf 1/ln(x)', 'limit laws'], // was "does not exist"
    ['lim x->inf 1/ln(ln(x))', 'limit laws'], // was "does not exist"
    ['lim x->-inf sqrt(-x)/(1-x)', 'leading powers'], // was 0.0001, at −∞
  ]) {
    const r = await lim(p);
    assert.equal(r.status, 'solved', p);
    assert.match(r.answer, /= 0$/, p);
    assert.equal(r.verificationMethod, method, p);
    assert.ok(!r.steps.some((s) => /Samples:|estimated/.test(s)), `${p}: no sampling`);
  }
});

test('limits review: the conjugate of two roots is worked, and the difference is not always 0', async () => {
  const r = await lim('lim x->inf (sqrt(x+1) - sqrt(x))');
  assert.ok(r.steps.includes('(sqrt(x + 1) − sqrt(x))(sqrt(x + 1) + sqrt(x)) = x + 1 − x = 1, so sqrt(x + 1) - sqrt(x) = 1/(sqrt(x + 1) + sqrt(x)).'));
  assert.equal(r.tips[1], 'Here: sqrt(x + 1) - sqrt(x) = 1/(sqrt(x + 1) + sqrt(x)), and that quotient → 0.');
  assert.match((await lim('lim x->inf sqrt(x^2+x) - sqrt(x^2-x)')).answer, /= 1$/);
});

test('limits review: the limit laws are worked from the inside out', async () => {
  const r = await lim('lim x->inf 1/ln(ln(x))');
  assert.deepEqual(r.steps.slice(1), [
    'A logarithm of something that grows without bound grows without bound (slowly, but without limit): ln(x) → ∞.',
    'In the same way, ln(ln(x)) → ∞.',
    'A quantity that stays bounded, divided by one that grows without bound, → 0: 1/ln(ln(x)) → 0.',
  ]);
  assert.equal(r.tips[1], 'Here, from the inside out: ln(x) → ∞, then ln(ln(x)) → ∞, then 1/ln(ln(x)) → 0.');
  assert.match((await lim('lim x->inf sin(1/sqrt(x))')).steps.join('\n'), /sin is continuous at 0, so the limit passes inside: sin\(1\/sqrt\(x\)\) → sin\(0\) = 0\./);
  assert.match((await lim('lim x->inf atan(x)')).answer, /= π\/2$/);
});

test('limits review, swept: powers whose base and exponent both vary', async () => {
  const xx = await lim('lim x->inf x^(1/x)'); // ∞⁰, by the exponent ln(x)/x
  assert.match(xx.answer, /= 1$/);
  assert.match(xx.steps.join('\n'), /This is the form ∞\^0, which is indeterminate\./);
  assert.match((await lim('lim x->inf (2+1/x)^x')).answer, /= ∞$/);
  // 1^∞ is still the logarithm technique's.
  assert.match((await lim('lim x->inf (1+1/x)^x')).answer, /= e \(≈ 2\.7183\)$/);
});

test('limits review, swept: sampled only at powers of 10, tan(x) and (−1)^x were answered', async () => {
  // tan(x) was −∞ and (−1)^x was 1; samples between the powers of 10 disagree,
  // and (−1)^x is not defined there.
  for (const p of ['lim x->inf tan(x)', 'lim x->inf (-1)^x']) {
    const r = await lim(p);
    assert.equal(r.status, 'unsupported', p);
    assert.equal(r.answer, 'This limit could not be determined', p);
  }
});

test('limits review: samples that have not settled decide nothing', async () => {
  // Not "does not exist" (that was 1/ln(x)): refused, saying why.
  const r = await lim('lim x->inf sin(x^2)');
  assert.equal(r.status, 'unsupported');
  assert.match(r.steps.join('\n'), /samples alone cannot tell a limit approached very slowly from no limit at all/);
  // What a proof already settles is unchanged.
  assert.match((await lim('lim x->inf sin(x)')).answer, /does not exist$/);
  assert.match((await lim('lim x->inf sin(x)/x')).answer, /= 0$/);
});

test('limits review: an estimate is said to be one, on the answer line', async () => {
  const r = await lim('lim x->infinity x/1.5^x');
  assert.equal(r.answer, 'lim (x→∞) x/1.5^x ≈ 0 (an estimate from samples, not a proof)');
  assert.doesNotMatch(r.answer, /=/);
});
