import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';

// 1.68.7 (outside review, November 2026): problems that took 16–150 s, past
// the page's 10 s budget, so a student got "beyond this solver" for a
// textbook exercise. Each is now under a second; the bound here is generous
// so a slow CI machine does not flake, and every case was over it before.
const LIMIT_MS = 5000;
async function timed(problem, topic) {
  const t0 = Date.now();
  const r = await solvePlain(problem, topic);
  return { r, ms: Date.now() - t0 };
}

test('speed: the chain rule on a power of a polynomial, in its own form', async () => {
  // factor() took 15 s on the expanded derivative and still missed (x^2 + 1)^9.
  for (const [p, answer] of [
    ['d/dx (x^2+1)^10', "f'(x) = 20x*(x^2 + 1)^9"], // was 21 s, expanded
    ['d/dx (3x^2+1)^4', "f'(x) = 24x*(3x^2 + 1)^3"], // was 6 s, 648x^7 + …
    ['(x^3+2x)^7', "f'(x) = 7(3x^2 + 2)*(x^3 + 2x)^6"], // was 18 s
    ['3(x^2-x)^2', "f'(x) = 6(2x - 1)*(x^2 - x)"],
  ]) {
    const { r, ms } = await timed(p, 'derivatives');
    assert.equal(r.answer, answer, p);
    assert.ok(ms < LIMIT_MS, `${p}: ${ms} ms`);
  }
  // The step that states the result agrees with the answer.
  const { r } = await timed('d/dx (x^2+1)^10', 'derivatives');
  assert.equal(r.steps.at(-1), 'd/dx((x^2 + 1)^10) = 20x*(x^2 + 1)^9');
});

test('speed: the quotient rule on a rational function, written directly', async () => {
  // simplify took 14 s a call; on x/(x^3 − 1) it also left a common factor.
  for (const [p, answer] of [
    ['(x^2+1)/(x^3-1)', "f'(x) = (-x^4 - 3x^2 - 2x)/((x^3 - 1)^2), x ≠ 1"], // was 46 s
    ['x/(x^3-1)', "f'(x) = (-2x^3 - 1)/((x^3 - 1)^2), x ≠ 1"],
    ['1/(x^4+1)', "f'(x) = -4x^3/((x^4 + 1)^2)"],
    ['x + (x^2+1)/(x^3-1)', "f'(x) = 1 + (-x^4 - 3x^2 - 2x)/((x^3 - 1)^2), x ≠ 1"], // was 148 s
  ]) {
    const { r, ms } = await timed(p, 'derivatives');
    assert.equal(r.answer, answer, p);
    assert.ok(ms < LIMIT_MS, `${p}: ${ms} ms`);
  }
});

test('the domain of f′ comes from the exact root finder: x³ − 1 is 0 only at 1', async () => {
  // Algebrite's roots() gave −1 as a root of (x^3 − 1)^2, so "x ≠ −1" was shown.
  const { r } = await timed('(x^2+1)/(x^3-1)', 'derivatives');
  assert.doesNotMatch(r.answer, /x ≠ -1/);
  assert.ok(r.steps.some((s) => /Domain of f'\(x\): x ≠ 1 — /.test(s)));
});

test('speed: a series limit reads the leading terms, and a natural log reads ln', async () => {
  // simplify on a quotient of two degree-7 polynomials took 32 s.
  for (const [p, answer] of [
    ['lim x->0 sin(3x)/sin(2x)', 'lim (x→0) sin(3x)/sin(2x) = 3/2'],
    ['lim x->0 (2^x - 1)/x', 'lim (x→0) (2^x - 1)/x = ln(2)'], // an estimate in 1.68.6
  ]) {
    const { r, ms } = await timed(p, 'limits');
    assert.equal(r.answer, answer, p);
    assert.ok(ms < LIMIT_MS, `${p}: ${ms} ms`);
  }
});

test('speed: no u-substitution with the whole integrand as u, and Gauss before exact complex roots', async () => {
  const integral = await timed('∫_0^1 sqrt(1+x^4) dx', 'integrals'); // was 16 s
  assert.match(integral.r.answer, /≈ 1\.0894 \(numerical\)$/);
  assert.ok(integral.ms < LIMIT_MS, `integral: ${integral.ms} ms`);
  const unity = await timed('x^100 = 1', 'algebra'); // was 18 s
  assert.match(unity.r.answer, /^x = -1 {2}or {2}x = 1;/);
  assert.ok(unity.ms < LIMIT_MS, `x^100 = 1: ${unity.ms} ms`);
  // Gaussian rational roots are still found exactly.
  assert.equal((await timed('2x^2 - 2x + 1 = 0', 'algebra')).r.answer, 'x = (1 - i)/2  or  x = (1 + i)/2');
});

test('speed: an inverse that needs the cubic formula is refused at once', async () => {
  const { r, ms } = await timed('inverse of x^3 + x', 'auto'); // was 21 s, then refused
  assert.equal(r.status, 'unsupported');
  assert.ok(ms < LIMIT_MS, `${ms} ms`);
  assert.equal((await timed('inverse of x^3 + 1', 'auto')).r.answer, 'f⁻¹(x) = ∛(x - 1)');
});
