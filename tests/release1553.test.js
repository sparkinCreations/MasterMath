import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';
import { isMathFragment, toLatex } from '../src/lib/latex.js';

// 1.55.3: polish found while shipping 1.55.2.

test('a number too small or too large for a float is kept as an exact fraction', async () => {
  for (const [p, answer] of [
    ['2^-60', '1/1152921504606846976 (≈ 8.6736 × 10^-19)'], // was ≈ 8.6736 × 10^-19 only (1.55.2), 0 before
    ['1/3^30', '1/205891132094649 (≈ 4.8569 × 10^-15)'],
    ['0.000001*3', '3/1000000 (≈ 3 × 10^-6)'],
    ['0.5^70', '1/1180591620717411303424 (≈ 8.4703 × 10^-22)'],
    ['2^100/3', '1267650600228229401496703205376/3 (≈ 4.2255 × 10^29)'],
    ['123456789*987654321', '121932631112635269 (≈ 1.2193 × 10^17)'],
  ]) {
    assert.equal((await solveProblem(p, 'other')).answer, answer, p);
  }
  const r = await solvePlain('2^-60', 'other');
  assert.ok(r.steps.includes('Work out the power (a negative exponent means a reciprocal, a^(-n) = 1/a^n): 2^(-60) = 1/2^60 = 1/1152921504606846976'), r.steps.join(' | '));
  // A fraction too long to read, or a result past 100 digits, gives its size.
  assert.equal((await solveProblem('1.5^100', 'other')).answer, '≈ 4.0656 × 10^17');
  assert.equal((await solveProblem('1/2^1000', 'other')).answer, '≈ 9.3326 × 10^-302');
  // Ordinary results are unchanged.
  assert.equal((await solveProblem('3/4 + 5/6', 'other')).answer, '19/12 (= 1.5833)');
  assert.equal((await solveProblem('0.1+0.2', 'other')).answer, '3/10 (= 0.3)');
});

test('a product of imaginary numbers says how i·i becomes −1', async () => {
  const r = await solvePlain('3i*2i', 'other');
  assert.equal(r.answer, '-6');
  assert.ok(r.steps.includes('Multiply, then use i^2 = −1: 6i·i = 6i^2 = -6.'), r.steps.join(' | '));
});

test('a complex answer is typeset, and "(≈ …)" keeps its space', () => {
  for (const t of ['-1 + 2i', '5 + i', '-i', '2i']) assert.ok(isMathFragment(t), t);
  assert.ok(!isMathFragment('Write it in a + bi form'));
  // A power in the denominator belongs to the denominator: not (3/2)².
  assert.equal(toLatex('3/2^2'), '3/2^{2}');
  assert.equal(toLatex('1/3 + 1/6'), String.raw`\frac{1}{3} + \frac{1}{6}`);
  assert.equal(toLatex('3/10 (= 0.3)'), String.raw`\frac{3}{10}\;(= 0.3)`);
  assert.equal(toLatex('e^2 (≈ 7.3891)'), String.raw`e^{2}\;( \approx 7.3891)`);
});
