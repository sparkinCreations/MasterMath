import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { growthWindow } from '../src/lib/graphSampling.js';
import { factorByRationalRoots, readPolynomial } from '../src/lib/solvers/polynomialRoots.js';
import { WORKED_EXAMPLE } from '../src/lib/workedExample.js';
import { solvePlain } from './helpers/solvePlain.js';

// October 2026 student review: cubics jumped to the answer; exploding
// functions were unreadable; the landing page shows a worked example.

// Wording is checked on the text a reader sees, without the ⟦…⟧ math markers.
const solve = (p) => solvePlain(p, 'algebra');

test('a cubic is worked by the Rational Root Theorem and synthetic division', async () => {
  const r = await solve('x^3 - 6x^2 + 11x - 6 = 0');
  assert.equal(r.answer, 'x = 1  or  x = 2  or  x = 3');
  assert.ok(r.steps.some((s) => /Rational Root Theorem: any rational root p\/q has p dividing the constant term -6 and q dividing the leading coefficient 1/.test(s)), r.steps.join('\n'));
  assert.ok(r.steps.some((s) => /p\(1\) = 0 ✓/.test(s)));
  assert.ok(r.steps.some((s) => /Synthetic division by \(x − 1\), using r = 1: write the coefficients 1, \(-6\), 11, \(-6\); bring down 1; 1·1 = 1, then \(-6\) \+ 1 = -5/.test(s)));
  assert.ok(r.steps.some((s) => /quotient: x\^2 - 5x \+ 6/.test(s)));
  assert.ok(r.steps.some((s) => /The remaining factor is a quadratic: x\^2 - 5x \+ 6 = 0/.test(s)));
  assert.ok(!r.steps.some((s) => /Solve for x by finding the roots/.test(s)));
});

test('x³ = 8: one real root and an exact complex pair from the remaining quadratic', async () => {
  const r = await solve('x^3 = 8');
  assert.match(r.answer, /^x = 2  or  x = -1 - i√3  or  x = -1 \+ i√3$/);
  assert.ok(r.steps.some((s) => /Discriminant: b² − 4ac = \(2\)² − 4\(1\)\(4\) = -12 — negative/.test(s)));
});

test('a fractional root and a factored-out x are handled', async () => {
  const r = await solve('2x^3 + 3x^2 - 8x + 3 = 0');
  assert.equal(r.answer, 'x = -3  or  x = 1/2  or  x = 1');
  assert.ok(r.steps.some((s) => /Synthetic division by \(x − 1\/2\), using r = 1\/2/.test(s)));
  const n = await solve('x^3 + 3x^2 - 4 = 0');
  assert.ok(n.steps.some((s) => /so x = -2 is a root and \(x \+ 2\) is a factor/.test(s)) || n.steps.some((s) => /\(x \+ 2\)/.test(s)), n.steps.join('\n'));
  const z = await solve('x^4 - x = 0');
  assert.ok(z.steps.some((s) => /Every term has a factor of x: factor it out — x·\(x\^3 - 1\) = 0 — so x = 0 is a root/.test(s)));
  assert.match(z.answer, /^x = 0  or  x = 1  or  x = /);
});

test('a quintic with no rational root goes straight to the exact finder, fast', async () => {
  const t0 = Date.now();
  const r = await solve('x^5 - x + 1 = 0');
  const ms = Date.now() - t0;
  assert.ok(ms < 1500, `took ${ms} ms`);
  assert.match(r.answer, /^x ≈ -1\.1673  or  x ≈ /);
  assert.ok(r.steps.some((s) => /only possible rational roots are 1, -1\./.test(s)));
  assert.ok(r.steps.some((s) => /No rational root remains: every candidate fails for x\^5 - x \+ 1/.test(s)));
  assert.ok(r.steps.some((s) => /Sturm's theorem/.test(s)));
});

test('a cubic with no rational root still gets all three real roots', async () => {
  const r = await solve('x^3 - 3x + 1 = 0');
  const nums = [...r.answer.matchAll(/-?\d+\.\d+/g)].map((m) => Number(m[0])).sort((a, b) => a - b);
  assert.equal(nums.length, 3);
  assert.ok(Math.abs(nums[0] + 1.8794) < 1e-3 && Math.abs(nums[1] - 0.3473) < 1e-3 && Math.abs(nums[2] - 1.5321) < 1e-3, r.answer);
});

test('factorByRationalRoots: exact records, and null when there are too many candidates', () => {
  const fac = factorByRationalRoots(readPolynomial('x^3 - 2*x + 1', 'x'));
  assert.equal(fac.rounds.length, 1);
  assert.deepEqual(fac.rounds[0].quotient, ['1', '1', '-1']);
  assert.equal(fac.rounds[0].root.text, '1');
  assert.equal(factorByRationalRoots(readPolynomial('x^2 - 1', 'x')), null);
  // 720720 has 240 divisors: 480 candidates is not a list a student tests.
  assert.equal(factorByRationalRoots(readPolynomial('720720*x^3 + 1', 'x')), null);
  // A common factor is divided out first, so this is just x^3 - 1.
  assert.equal(factorByRationalRoots(readPolynomial('720720*x^3 - 720720', 'x')).rounds[0].root.text, '1');
});

test('growthWindow shrinks the window for e^x and keeps ±10 for a bounded or polynomial curve', () => {
  const e = growthWindow('exp(x)', 'x');
  assert.ok(e.xMax <= 4 && e.xMax >= 2, JSON.stringify(e));
  assert.deepEqual(growthWindow('sin(x)', 'x'), { xMin: -10, xMax: 10 });
  assert.deepEqual(growthWindow('5', 'x'), { xMin: -10, xMax: 10 });
  assert.deepEqual(growthWindow('x^3', 'x'), { xMin: -10, xMax: 10 });
  assert.equal(growthWindow('sin(', 'x'), null);
});

test('the landing page example is exactly what the solver produces', async () => {
  const r = await solvePlain(WORKED_EXAMPLE.problem, WORKED_EXAMPLE.topic);
  assert.deepEqual(r.steps, WORKED_EXAMPLE.steps);
  assert.equal(r.answer, WORKED_EXAMPLE.answer);
  assert.equal(r.tips[0], WORKED_EXAMPLE.tip);
});
