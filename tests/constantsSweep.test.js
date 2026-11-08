// From the systematic stress test with constants (November 2026; 1.72.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('a derivative with constants at a decimal point is its value, never "undefined"', async () => {
  for (const [p, answer] of [
    // Was "f'(1.3) is undefined": Algebrite in floating point left it unsimplified.
    ['d/dx e^(a*x)*sin(b*x) at x = 1.3', "f'(1.3) = e^(1.3a)*(a*sin(1.3b) + b*cos(1.3b))"],
    ['d/dx a*x^3 at x = 1.3', "f'(1.3) = 5.07a"],
    ['d/dx e^(a*x)*sin(b*x) at x = 1', "f'(1) = e^a*(a*sin(b) + b*cos(b))"],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  // A decimal point is substituted exactly: 1/1.3 is 10/13.
  assert.equal((await solvePlain('d/dx ln(a*x) at x = 1.3', 'auto')).answer, "f'(1.3) = 10/13 ≈ 0.7692, for a > 0");
});

// 1.73.0: what the sweep found besides the wrong answer.
test('integrals with a constant say when they hold, and work the excluded case', async () => {
  for (const [g, answer, zeroStep] of [
    ['sin(a*x)', '∫(sin(a*x)) dx = -cos(a*x)/a + C, for a ≠ 0', 'If a = 0, the integrand is 0, and its integral is C instead.'],
    ['e^(k*x)', '∫(e^(k*x)) dx = e^(k*x)/k + C, for k ≠ 0', 'If k = 0, the integrand is 1, and its integral is x + C instead.'],
    ['a^x', '∫(a^x) dx = a^x/ln(a) + C, for a > 0 and a ≠ 1', null],
  ]) {
    const r = await solvePlain(`integral of ${g} dx`, 'auto');
    assert.equal(r.answer, answer, g);
    if (zeroStep) assert.ok(r.steps.includes(zeroStep), r.steps.join('\n'));
  }
  // No constant, no condition.
  assert.equal((await solvePlain('integral of x^2 dx', 'auto')).answer, '∫(x^2) dx = 1/3*x^3 + C');
});

test('a derivative with a constant base or logarithm says so', async () => {
  assert.equal((await solvePlain('d/dx a^x', 'auto')).answer, "f'(x) = a^x*ln(a), for a > 0");
  assert.equal((await solvePlain('d/dx x/a', 'auto')).answer, "f'(x) = 1/a, for a ≠ 0");

  assert.equal((await solvePlain('d/dx 2^x', 'auto')).answer, "f'(x) = 2^x*ln(2)");
});

test('the quadratic formula in letters, as a textbook writes it', async () => {
  for (const [p, answer] of [
    // Was -1/2*(b^2/(a^2) - 4c/a)^(1/2) - b/(2a), for a^2 ≠ 0 and a ≠ 0 and 2a ≠ 0.
    ['a*x^2 + b*x + c = 0', 'x = (-b ± √(b^2 - 4a*c))/(2a), for a ≠ 0 and b^2 - 4a*c ≥ 0'],
    ['x^2 + b*x + c = 0', 'x = (-b ± √(b^2 - 4c))/2, for b^2 - 4c ≥ 0'],
    // Always true: 8 + k² ≥ 0 is not stated.
    ['2x^2 + k*x - 1 = 0', 'x = (-k ± √(8 + k^2))/4'],
    ['x^4 = a', 'x = ±a^(1/4), for a ≥ 0'],
    // Roots that come out clean keep their form.
    ['x^2 - (a + b)*x + a*b = 0', 'x = a  or  x = b'],
  ]) {
    assert.equal((await solvePlain(p, 'auto')).answer, answer, p);
  }
  const q = await solvePlain('a*x^2 + b*x + c = 0', 'auto');
  assert.ok(q.steps.includes('If a = 0, the equation is b*x + c = 0 instead, which is solved on its own.'), q.steps.join('\n'));
});

test('a definite integral with constants is worked, or refused saying why', async () => {
  for (const [p, answer] of [
    // Was "Improper integral — MasterMath could not evaluate the one-sided limits at the singularity".
    ['integral of a*x dx from 0 to 1', '∫_0^1 (a*x) dx = a/2'],
    ['integral of e^(k*x) dx from 0 to 1', '∫_0^1 (e^(k*x)) dx = (e^k - 1)/k, for k ≠ 0'],
    ['integral of a*x^2 + b dx from 0 to 3', '∫_0^3 (a*x^2 + b) dx = 3(3a + b)'],
    ['integral of a^x dx from 0 to 1', '∫_0^1 (a^x) dx = (a - 1)/ln(a), for a > 0 and a ≠ 1'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  const e = await solvePlain('integral of e^(k*x) dx from 0 to 1', 'auto');
  assert.ok(e.steps.includes('If k = 0, the integrand is 1, and the integral is 1 instead.'), e.steps.join('\n'));
  // A constant that could put a pole in [0, 1]: refused, and not called a singularity.
  for (const p of ['integral of 1/(x + a) dx from 0 to 1', 'integral of sqrt(a*x) dx from 0 to 1']) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'unsupported', p);
    assert.match(r.answer, /worked only when the integrand is defined everywhere/, p);
  }
});

// Review of 1.73.0: ln(a·x) is defined wherever a·x > 0, for a < 0 and x < 0
// too. Algebrite splits it into ln(a) + ln(x), which holds only for a > 0 and
// x > 0, and the answer said "for x > 0 and a > 0"; at x = −2 it gave a
// complex number. The logarithm is kept whole and its own condition stated.
test('ln(a*x) keeps its whole domain, a·x > 0: both signs checked by value', async () => {
  const r = await solvePlain('d/dx x^2*ln(a*x)', 'auto');
  assert.equal(r.answer, "f'(x) = x + 2x*ln(a*x), for ax > 0");
  const fp = (a, x) => x + 2 * x * Math.log(a * x);
  for (const [a, x] of [[1.5, 2], [-1, -2], [-0.7, -3.1]]) {
    const h = 1e-6;
    const f = (t) => t * t * Math.log(a * t);
    const numeric = (f(x + h) - f(x - h)) / (2 * h);
    assert.ok(Math.abs(fp(a, x) - numeric) < 1e-5, `a = ${a}, x = ${x}`);
  }
  // At a negative point: real, and only for a < 0 (was 2(−1 − 2ln(2) − 2ln(a) − 2iπ), for a > 0).
  assert.equal((await solvePlain('d/dx x^2*ln(a*x) at x = -2', 'auto')).answer, "f'(-2) = 2(-1 - 2ln(-2a)), for a < 0");
  for (const [p, answer] of [
    ['d/dx x*ln(k*x)', "f'(x) = 1 + ln(k*x), for kx > 0"],
    ['d/dx ln(a*x)', "f'(x) = 1/x, for ax > 0"],
    ['integral of ln(a*x) dx', '∫(ln(a*x)) dx = -x + x*ln(a*x) + C, for ax > 0'],
  ]) {
    assert.equal((await solvePlain(p, 'auto')).answer, answer, p);
  }
});
