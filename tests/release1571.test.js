// 1.57.1: rational functions without Algebrite's factor() and roots() —
// the exact root finder factors the denominator in milliseconds (Algebrite
// ground for 1–4 s on x⁴ + 1, x⁴ + 4, x⁶ + 1 and 250 s on (x² + x + 1)²),
// the partial-fraction coefficients are solved exactly, repeated irreducible
// quadratics go through the reduction formula, and the textbook working with
// integer coefficients is kept wherever it was shown before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { stripMathMarkers } from '../src/lib/mathMarkers.js';

const solve = (p) => solveProblem(p, 'integrals');
const plain = (r) => r.steps.map(stripMathMarkers).join('\n');

test('the reviewer\'s (x² + 1)/(x⁴ + 1) solves well inside the budget', async () => {
  const t0 = performance.now();
  const r = await solve('(x^2 + 1)/(x^4 + 1)');
  const ms = performance.now() - t0;
  assert.equal(r.status, 'solved');
  assert.equal(r.answer, '∫((x^2 + 1)/(x^4 + 1)) dx = 1/√2·arctan((2x + √2)/√2) + 1/√2·arctan((2x − √2)/√2) + C');
  assert.ok(ms < 4000, `took ${Math.round(ms)} ms (was 46 s on 1.56.4, 2.4 s on 1.57.0)`);
  for (const p of ['1/(x^6 + 1)', '1/(x^8 + 1)', '1/(x^3 + x + 1)', '1/(x^4 - 2)']) {
    const t1 = performance.now();
    assert.equal((await solve(p)).status, 'solved', p);
    assert.ok(performance.now() - t1 < 4000, `${p} too slow`);
  }
});

test('the working with rational coefficients is kept, factors in the same order as before', async () => {
  const quartic = await solve('1/(x^4 + 4)');
  assert.equal(quartic.answer, '∫(1/(x^4 + 4)) dx = -1/16*ln|x^2 - 2x + 2| + 1/8*arctan(x - 1) + 1/16*ln|x^2 + 2x + 2| + 1/8*arctan(x + 1) + C');
  assert.match(plain(quartic), /Factor the denominator: x\^4 \+ 4 = \(x\^2 - 2x \+ 2\)\(x\^2 \+ 2x \+ 2\)/);
  assert.match(plain(quartic), /complete the square, \(x\^2 - 2\*x \+ 2\) = \(x - 1\)\^2 \+ 1/);
  const pair = await solve('1/(x^4 + 3*x^2 + 2)');
  assert.match(plain(pair), /x\^4 \+ 3x\^2 \+ 2 = \(x\^2 \+ 1\)\(x\^2 \+ 2\)/);
  assert.equal(pair.answer, '∫(1/(x^4 + 3x^2 + 2)) dx = arctan(x) - 1/2*√2*arctan((x)/√2) + C');
  const diff = await solve('1/(x^4 - 16)');
  assert.match(plain(diff), /x\^4 - 16 = \(x - 2\)\(x \+ 2\)\(x\^2 \+ 4\)/);
  assert.equal(diff.answer, '∫(1/(x^4 - 16)) dx = 1/32*ln|x - 2| - 1/32*ln|x + 2| - 1/16*arctan(x/2) + C');
  const squared = await solve('1/((x-1)^2*(x^2+1))');
  assert.equal(squared.answer, '∫(1/((x - 1)^2*(x^2 + 1))) dx = -1/2*ln|x - 1| - 1/(2(x - 1)) + 1/4*ln(x^2 + 1) + C');
});

test('coefficients solved exactly: 1/(x⁶ − 1), six unknowns, used to be refused', async () => {
  const r = await solve('1/(x^6 - 1)');
  assert.equal(r.answer, '∫(1/(x^6 - 1)) dx = 1/6*ln|x - 1| - 1/6*ln|x + 1| + 1/12*ln|x^2 - x + 1| - 1/6*√3*arctan((2x - 1)/√3) - 1/12*ln|x^2 + x + 1| - 1/6*√3*arctan((2x + 1)/√3) + C');
  assert.match(plain(r), /x\^6 - 1 = \(x - 1\)\(x \+ 1\)\(x\^2 - x \+ 1\)\(x\^2 \+ x \+ 1\)/);
  assert.match(plain(r), /1\/\(x\^6 - 1\) = 1\/\(6\(x - 1\)\) − 1\/\(6\(x \+ 1\)\) \+ \(x\/6 − 1\/3\)\/\(x\^2 - x \+ 1\)/);
  const zeroTerm = await solve('(x^2+2)/(x^4+5*x^2+6)');
  assert.equal(zeroTerm.answer, '∫((x^2 + 2)/(x^4 + 5x^2 + 6)) dx = 1/3*√3*arctan((x)/√3) + C');
  assert.doesNotMatch(plain(zeroTerm), /\(0\)\//, 'a zero numerator is no term');
  assert.match(plain(zeroTerm), /the constant part gives 1\/3\*√3·arctan/);
});

test('a leading coefficient and a rational k: 1/(2x² + 2x + 1) = arctan(2x + 1)', async () => {
  const r = await solve('1/(2*x^2+2*x+1)');
  assert.equal(r.answer, '∫(1/(2x^2 + 2x + 1)) dx = arctan(2x + 1) + C');
  assert.match(plain(r), /2x\^2 \+ 2x \+ 1 = 2·\(x\^2 \+ x \+ 1\/2\)/);
  assert.match(plain(r), /complete the square, \(x\^2 \+ x \+ 1\/2\) = \(x \+ 1\/2\)\^2 \+ 1\/4/);
  assert.equal((await solve('1/(x*(2*x^2+2*x+1))')).answer, '∫(1/(x*(2x^2 + 2x + 1))) dx = ln|x| - 1/2*ln|x^2 + x + 1/2| - arctan(2x + 1) + C');
});

test('repeated irreducible quadratics by the reduction formula, any power, k rational or a surd', async () => {
  const cubed = await solve('1/((x^2+1)^3)');
  assert.equal(cubed.answer, '∫(1/((x^2 + 1)^3)) dx = x/(4(x^2 + 1)^2) + 3x/(8(x^2 + 1)) + 3/8*arctan(x) + C');
  const text = plain(cubed);
  assert.match(text, /with u = x and k = 1/);
  assert.match(text, /by the reduction formula ∫ du\/\(u² \+ k²\)\^n = u\/\(2k²\(n − 1\)\(u² \+ k²\)\^\(n−1\)\) \+ \(2n − 3\)\/\(2k²\(n − 1\)\)·∫ du\/\(u² \+ k²\)\^\(n−1\) applied 2 times, down to ∫ du\/\(u² \+ k²\) = \(1\/k\)·arctan\(u\/k\)/);
  const t0 = performance.now();
  const surdK = await solve('(2x+3)/(x^4+2*x^3+3*x^2+2*x+1)');
  assert.ok(performance.now() - t0 < 4000, 'was 250 s in Algebrite\'s integral()');
  assert.equal(surdK.answer, '∫((2x + 3)/(x^4 + 2x^3 + 3x^2 + 2x + 1)) dx = -1/(x^2 + x + 1) + 4(x + 1/2)/(3(x^2 + x + 1)) + 8/9*√3*arctan((2x + 1)/√3) + C');
  assert.match(plain(surdK), /x\^4 \+ 2x\^3 \+ 3x\^2 \+ 2x \+ 1 = \(x\^2 \+ x \+ 1\)\^2/);
  assert.match(plain(surdK), /with u = \(x \+ 1\/2\) and k = √3\/2, ∫ 2u\/\(u² \+ k²\)\^2 du = −1\/\(u² \+ k²\) \(w = u² \+ k²\)/);
  assert.equal((await solve('1/(4*x^4+4*x^2+1)')).answer, '∫(1/(4x^4 + 4x^2 + 1)) dx = x/(4(x^2 + 1/2)) + 1/4*√2*arctan((2x)/√2) + C');
  assert.equal((await solve('(x+1)/((x^2+4)^2)')).answer, '∫((x + 1)/((x^2 + 4)^2)) dx = -1/(2(x^2 + 4)) + x/(8(x^2 + 4)) + 1/16*arctan(x/2) + C');
  assert.equal((await solve('1/((x^2+2x+5)^2)')).answer, '∫(1/((x^2 + 2x + 5)^2)) dx = (x + 1)/(8(x^2 + 2x + 5)) + 1/16*arctan((x + 1)/2) + C');
  assert.equal((await solve('x^2/((x^2+1)^2)')).answer, '∫(x^2/((x^2 + 1)^2)) dx = arctan(x) - x/(2(x^2 + 1)) - 1/2*arctan(x) + C');
});
