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

// The roots of x(x−1)⋯(x−20) + x near 1…20 are NOT 1…20 (substituting k
// gives k): 20 − 7×10⁻¹² was printed as "x = 20" (outside review, October
// 2026). A root is shown with = only when it is exactly the rational shown,
// tested in exact arithmetic; otherwise ≈, with a step saying what the
// displayed number actually gives.
test('= only for roots that are exactly the number shown; ≈ otherwise, with the substitution spelled out', async () => {
  const r = await solveProblem(`${WILKINSON_PLUS_X} = 0`, 'algebra');
  assert.match(r.answer, /^x = 0  or  x ≈ 1  or  x ≈ 2  or /);
  assert.doesNotMatch(r.answer, /x = 20\b/);
  assert.match(r.answer, /x ≈ 20$/);
  assert.match(r.steps.join('\n'), /substituting x = 1 gives 1, not 0/);
  const finder = allRoots(readPolynomial(WILKINSON_PLUS_X, 'x'));
  assert.deepEqual(finder.real[0].exact, { m: 0n, d: 1n });
  assert.equal(finder.real[20].exact, null);

  // Exact rational roots keep =, fractions included, and their multiplicity.
  assert.match((await solveProblem('(3x-1)*(x^12+1) = 0', 'algebra')).answer, /^x = 1\/3;/);
  assert.match((await solveProblem('(x-2)^3*(x^14+1) = 0', 'algebra')).answer, /^x = 2 \(multiplicity 3\);/);
  // A rounded decimal is ≈, and the note substitutes the decimal shown.
  const quintic = await solveProblem('x^41 - x = 1', 'algebra');
  assert.match(quintic.answer, /^x ≈ 1\.0173;/);
  assert.match(quintic.steps.join('\n'), /substituting x = 1\.0173 gives -?\d[^;]*, not 0/);
});

test('high degrees skip Algebrite: every real root, the complex ones counted past a handful', async () => {
  // x^41 − x − 1 made Algebrite grind for ten seconds before it gave up (and
  // the exact finder then refused it as above degree 40). One real root.
  const started = Date.now();
  const r = await solveProblem('x^41 - x = 1', 'algebra');
  assert.ok(Date.now() - started < 3000, 'must not wait for Algebrite');
  assert.match(r.answer, /^x ≈ 1\.0173;  plus 40 complex solutions \(not listed\)$/, r.answer);
  assert.match((await solveProblem('x^100 = 1', 'algebra')).answer, /^x = -1  or  x = 1;  plus 98 complex solutions/);
  assert.match((await solveProblem('x^50 = 2', 'algebra')).answer, /^x ≈ -1\.014  or  x ≈ 1\.014;  plus 48 complex solutions/);
  // A handful of complex roots is still listed; exact ones keep =, rounded ones get ≈.
  assert.equal((await solveProblem('x^4 = 16', 'algebra')).answer, 'x = -2  or  x = 2  or  x = -2i  or  x = 2i');
  assert.match((await solveProblem('x^3 = 8', 'algebra')).answer, /^x = 2  or  x ≈ -1 - 1\.7321i/);
  assert.equal((await solveProblem('x^5 - x + 1 = 0', 'algebra')).answer.split('  or  ').length, 5);
  // Above the exact finder's limit: an honest refusal, at once.
  const above = await solveProblem(`x^${MAX_POLYNOMIAL_DEGREE + 1} = 1`, 'algebra');
  assert.equal(above.status, 'unsupported');
  assert.match(above.answer, /above the supported limit/);
});
