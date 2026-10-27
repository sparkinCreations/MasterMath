// 1.56.2: the u = a^x substitution takes negative exponents, so
// e^x + e^(−x) = c is solved exactly (or shown to have no real solution).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { stripMathMarkers } from '../src/lib/mathMarkers.js';

const solve = (p, topic = 'algebra') => solveProblem(p, topic);
const plain = (r) => r.steps.map(stripMathMarkers).join('\n');

test('e^x + e^(-x) = 1 is proved to have no real solution', async () => {
  const r = await solve('e^x + e^(-x) = 1');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /^No real solution/);
  const text = plain(r);
  assert.match(text, /Let u = e\^x \(so e\^\(-x\) = 1\/u\)/);
  assert.match(text, /Multiply both sides by u to clear the negative powers \(u = e\^x > 0/);
  assert.match(text, /discriminant is \(-1\)² − 4\(1\)\(1\) = -3, which is negative/);
  assert.doesNotMatch(text, /Search for values|cannot show there is none/);
  // The guidance is about u, not about 1/x.
  assert.match(stripMathMarkers(r.tips.join('\n')), /only a positive root of the polynomial in u/);
  assert.doesNotMatch(stripMathMarkers(r.tips.join('\n')), /1\/x is never 0/);
});

test('e^x + e^(-x) = 3 and e^x − 2e^(-x) = 1 are exact, not ≈', async () => {
  assert.equal((await solve('e^x + e^(-x) = 3')).answer, 'x = ln((3 - √5)/2) (≈ -0.9624)  or  x = ln((3 + √5)/2) (≈ 0.9624)');
  assert.equal((await solve('e^x + e^-x = 3', 'auto')).answer, 'x = ln((3 - √5)/2) (≈ -0.9624)  or  x = ln((3 + √5)/2) (≈ 0.9624)');
  const r = await solve('e^x - 2e^(-x) = 1');
  assert.equal(r.answer, 'x = ln(2) (≈ 0.6931)');
  assert.match(plain(r), /u = -1: e\^x is always positive, so this gives no real x/);
  assert.equal((await solve('exp(x) - 2exp(-x) = 1')).answer, 'x = ln(2) (≈ 0.6931)');
  assert.equal((await solve('e^x - e^(-x) = 2')).answer, 'x = ln(1 + √2) (≈ 0.8814)');
  assert.equal((await solve('e^x - e^(-x) = 0')).answer, 'x = 0');
  assert.equal((await solve('e^x + e^(-x) = 2')).answer, 'x = 0');
});

test('higher negative powers and numeric bases', async () => {
  const r = await solve('e^(-2x) - e^(-x) = 6');
  assert.equal(r.answer, 'x = ln(1/3) (≈ -1.0986)');
  assert.match(plain(r), /Let u = e\^x \(so e\^\(-2x\) = 1\/u\^2, e\^\(-x\) = 1\/u\)/);
  assert.match(plain(r), /Multiply both sides by u\^2/);
  assert.equal((await solve('e^(2x) + e^(-2x) = 2')).answer, 'x = 0');
  assert.equal((await solve('2^x + 2^(-x) = 3')).answer, 'x = ln((3 - √5)/2)/ln(2) (≈ -1.3885)  or  x = ln((3 + √5)/2)/ln(2) (≈ 1.3885)');
  assert.equal((await solve('2^x + 2^(-x) = 2')).answer, 'x = 0');
  assert.equal((await solve('10^(-2x) - 10^(-x) = 6')).answer, 'x = ln(1/3)/ln(10) (≈ -0.4771)');
  assert.match((await solve('e^(3x) + e^(-x) = 0')).answer, /^No real solution/);
  assert.match((await solve('e^x + 3e^(-x) = 0')).answer, /^No real solution/);
});

test('a decimal coefficient is read as a fraction (Algebrite refuses a float)', async () => {
  assert.equal((await solve('e^x + e^(-x) = 2.5')).answer, 'x = ln(1/2) (≈ -0.6931)  or  x = ln(2) (≈ 0.6931)');
  assert.equal((await solve('e^x - 0.5e^(-x) = 0.5')).answer, 'x = 0');
  assert.equal((await solve('e^(2x) - 2.5e^x + 1 = 0')).answer, 'x = ln(1/2) (≈ -0.6931)  or  x = ln(2) (≈ 0.6931)');
});

test('the positive-exponent path and the single-exponential path are unchanged', async () => {
  const r = await solve('e^(2x) - 3e^x + 2 = 0');
  assert.equal(r.answer, 'x = 0  or  x = ln(2) (≈ 0.6931)');
  assert.match(plain(r), /Let u = e\^x \(so e\^\(2x\) = u\^2\)/);
  assert.doesNotMatch(plain(r), /Multiply both sides by u/);
  assert.equal((await solve('e^(-x) = 4')).answer, 'x = -ln(4) (≈ -1.3863)');
  assert.equal((await solve('4^x - 5*2^x + 4 = 0')).answer, 'x = 0  or  x = 2');
});
