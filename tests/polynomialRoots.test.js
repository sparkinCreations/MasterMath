// Complete root lists for polynomials (1.39.2). Two outside reviews found
// partial lists: a sextic whose quintic factor Algebrite silently dropped,
// then a degree-21 polynomial past the old degree-20 coefficient scan. Real
// roots are now counted exactly (Sturm) and located by exact bisection, so
// none can be missed between samples.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readPolynomial, allRoots, MAX_POLYNOMIAL_DEGREE } from '../src/lib/solvers/polynomialRoots.js';
import { solveProblem } from '../src/lib/api.js';

const WILKINSON_PLUS_X = `x*${Array.from({ length: 20 }, (_, k) => `(x-${k + 1})`).join('*')} + x`;

test('the exact reader finds the true degree and rational coefficients', () => {
  assert.equal(readPolynomial('(x+1)^2 - x^2', 'x').degree, 1);
  assert.equal(readPolynomial(WILKINSON_PLUS_X, 'x').degree, 21);
  assert.equal(readPolynomial('sin(x) + 1', 'x'), null);
  assert.equal(readPolynomial('1/x', 'x'), null);
  assert.deepEqual(readPolynomial(`x^${MAX_POLYNOMIAL_DEGREE + 1} - 1`, 'x'), { tooHigh: true, degree: MAX_POLYNOMIAL_DEGREE + 1 });
});

test('real roots are counted exactly, with multiplicities, however close together', () => {
  const r = allRoots(readPolynomial(WILKINSON_PLUS_X, 'x'));
  assert.equal(r.real.length, 21);
  assert.equal(r.complexCount, 0);
  r.real.forEach((root, k) => assert.ok(Math.abs(root.value - k) < 1e-6, `root ${k}: ${root.value}`));

  const repeated = allRoots(readPolynomial('(x-1)^3*(x+2)^2*(x^2+1)', 'x'));
  assert.deepEqual(repeated.real.map((z) => [Math.round(z.value), z.multiplicity]), [[-2, 2], [1, 3]]);
  assert.equal(repeated.complex.length, 2);
  assert.ok(repeated.complex.every((z) => Math.abs(z.re) < 1e-9 && Math.abs(Math.abs(z.im) - 1) < 1e-9));
});

test('the degree-21 equation from the review lists all 21 roots, not just x = 0', async () => {
  const r = await solveProblem(`${WILKINSON_PLUS_X} = 0`, 'algebra');
  assert.equal(r.status, 'solved');
  assert.equal(r.answer.split('  or  ').length, 21, r.answer);
  assert.match(r.steps.join('\n'), /Sturm's theorem counts them exactly — 21 distinct real roots/);
});

test('high degrees skip Algebrite: every real root, the complex ones counted past a handful', async () => {
  // x^41 − x − 1 made Algebrite grind for ten seconds before it gave up (and
  // the exact finder then refused it as above degree 40). One real root.
  const started = Date.now();
  const r = await solveProblem('x^41 - x = 1', 'algebra');
  assert.ok(Date.now() - started < 3000, 'must not wait for Algebrite');
  assert.match(r.answer, /^x = 1\.\d+;  plus 40 complex solutions \(not listed\)$/, r.answer);
  assert.match((await solveProblem('x^100 = 1', 'algebra')).answer, /^x = -1  or  x = 1;  plus 98 complex solutions/);
  assert.match((await solveProblem('x^50 = 2', 'algebra')).answer, /^x = -1\.014  or  x = 1\.014;  plus 48 complex solutions/);
  // A handful of complex roots is still listed.
  assert.equal((await solveProblem('x^5 - x + 1 = 0', 'algebra')).answer.split('  or  ').length, 5);
  // Above the exact finder's limit: an honest refusal, at once.
  const above = await solveProblem(`x^${MAX_POLYNOMIAL_DEGREE + 1} = 1`, 'algebra');
  assert.equal(above.status, 'unsupported');
  assert.match(above.answer, /above the supported limit/);
});
