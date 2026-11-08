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
  assert.equal((await solvePlain('d/dx ln(a*x) at x = 1.3', 'auto')).answer, "f'(1.3) = 10/13 ≈ 0.7692");
});
