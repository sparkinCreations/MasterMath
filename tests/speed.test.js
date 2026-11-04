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

test('speed: a series limit\'s exact value is read off its leading terms', async () => {
  // simplify on the substituted quotient of two degree-7 polynomials took 32 s.
  const { r, ms } = await timed('lim x->0 sin(3x)/sin(2x)', 'limits');
  assert.equal(r.answer, 'lim (x→0) sin(3x)/sin(2x) = 3/2');
  assert.ok(ms < LIMIT_MS, `${ms} ms`);
  // The method each limit is worked by is unchanged: L'Hôpital's rule where
  // it was (the series display at x = a is not in powers of x − a).
  assert.match((await timed('lim x->1 ln(x)/(x^2-1)', 'limits')).r.tips[1], /^Here: after one round the bottom is 2x/);
});

test('Taylor limits lost to rounding were "does not exist"; they are worked by series', async () => {
  for (const [p, answer] of [
    ['lim x->0 (e^x - 1 - x - x^2/2)/x^3', '1/6'],
    ['lim x->0 (sin(x) - x + x^3/6)/x^5', '1/120'],
    ['lim x->0 (cos(x) - 1 + x^2/2)/x^4', '1/24'],
  ]) {
    const { r } = await timed(p, 'limits');
    assert.match(r.answer, new RegExp(`= ${answer.replace('/', '\\/')}$`), p);
    assert.ok(r.steps.some((s) => /Taylor series/.test(s)), p);
  }
  // Swinging samples near a point decide nothing; sin(1/x) is still proved.
  assert.equal((await timed('lim x->0 sin(1/x^2)', 'limits')).r.status, 'unsupported');
  assert.match((await timed('lim x->0 sin(1/x)', 'limits')).r.answer, /does not exist$/);
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
  // The reason fits the degree: x^4 − x ran 41 s and then "could not be solved".
  assert.match(r.steps.join('\n'), /needs the general cubic formula/);
  const quartic = await timed('inverse of x^4 - x', 'auto');
  assert.equal(quartic.r.answer, 'No inverse: the function is not one-to-one');
  assert.ok(quartic.ms < LIMIT_MS, `x^4 - x: ${quartic.ms} ms`);
  assert.match((await timed('inverse of x^5 + x', 'auto')).r.steps.join('\n'), /degree 5, which has no general formula in radicals/);
});

test('a series is shown to its last exact coefficient, then "+ …"', async () => {
  const { r } = await timed('lim x->0 (sin(x) - x + x^3/6)/x^5', 'limits');
  assert.ok(r.steps.includes('Numerator ≈ x^5/120 + …; denominator ≈ x^5.'), r.steps.join('\n'));
});
