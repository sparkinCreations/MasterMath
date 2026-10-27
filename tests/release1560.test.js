import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';
import { implicitCurve, implicitWindow } from '../src/lib/graphSampling.js';
import { describeGraphFeatures } from '../src/lib/graphDescription.js';

// 1.56.0: the last wordy requests on the October roadmap (average value,
// maximum and minimum on an interval, primes, rounding) and the implicit
// curve plot.

test('the average value of a function on an interval', async () => {
  for (const [p, answer] of [
    ['find the average value of x^2 on [0, 3]', 'The average value is 3'],
    ['average value of sin(x) from 0 to pi', 'The average value is 2/π (≈ 0.6366)'],
    ['the average value of 1/x on [1, e]', 'The average value is 1/(e - 1) (≈ 0.582)'],
    ['average value of sqrt(x) on [0, 4]', 'The average value is 4/3 (≈ 1.3333)'],
    ['average value of 1/(1 + x^2) over the interval [0, 1]', 'The average value is π/4 (≈ 0.7854)'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'integrals', p);
  }
  const r = await solvePlain('average value of x^2 on [0, 3]', 'integrals');
  assert.ok(r.steps.includes('Divide by the width b − a = 3: the average value is (9)/3 = 3.'), r.steps.join(' | '));
  assert.ok(r.graph?.annotations?.shaded && r.graph.secondaryExpression === '3', 'the average is drawn over the shaded interval');
  // An improper integral that diverges has no average.
  assert.equal((await solveProblem('average value of 1/x on [-1, 1]', 'auto')).answer, 'No average value: the integral diverges');
});

test('the absolute maximum and minimum on a closed interval, by the closed interval method', async () => {
  for (const [p, answer] of [
    ['find the maximum of x^3 - 3x on [0, 2]', 'Absolute maximum 2 at x = 2'],
    ['max and min of x^3 - 3x on [-2, 3]', 'Absolute maximum 18 at x = 3; absolute minimum -2 at x = -2 and x = 1'],
    ['minimum of x^2 - 4x + 5 on [0, 5]', 'Absolute minimum 1 at x = 2'],
    ['extreme values of sin(x) on [0, 2pi]', 'Absolute maximum 1 at x = π/2; absolute minimum -1 at x = 3π/2'],
    ['maximum of x*e^(-x) on [0, 4]', 'Absolute maximum 1/e (≈ 0.3679) at x = 1'],
    ['minimum of abs(x - 1) on [0, 3]', 'Absolute minimum 0 at x = 1'], // a corner, where f′ does not exist
    ['min of x^(2/3) on [-1, 8]', 'Absolute minimum 0 at x = 0'], // a cusp
    ['maximum of cos(x) + sin(x) on [0, pi]', 'Absolute maximum √2 (≈ 1.4142) at x = π/4'],
    ['max and min of 2cos(x) + x on [0, pi]', 'Absolute maximum π/6 + √3 (≈ 2.2556) at x = π/6; absolute minimum 5π/6 - √3 (≈ 0.8859) at x = 5π/6'],
    ['maximum of x^2 for -1 <= x <= 2', 'Absolute maximum 4 at x = 2'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'functions', p);
  }
  const r = await solvePlain('max and min of x^3 - 3x on [-2, 3]', 'functions');
  assert.ok(r.steps.includes('Evaluate f at the endpoints and the critical points: f(-2) = -2, f(-1) = 2, f(1) = -2, f(3) = 18.'), r.steps.join(' | '));
  // Not continuous on the interval: no guaranteed extreme, said why.
  const pole = await solvePlain('maximum of 1/x on [-1, 1]', 'auto');
  assert.equal(pole.answer, 'No guaranteed maximum: f is not continuous on [-1, 1]');
  assert.match(pole.steps.join(' '), /x = 0 at x = 0|undefined there/);
  // A constant function.
  assert.match((await solveProblem('maximum of 5 on [0, 1]', 'auto')).answer, /^5 everywhere: f is constant/);
});

test('is a number prime, and its prime factorization', async () => {
  for (const [p, answer] of [
    ['is 97 prime', '97 is prime'],
    ['is 91 a prime number?', '91 is not prime: 91 = 7 × 13'],
    ['is 1 prime', '1 is not prime'],
    ['is 2 prime', '2 is prime'],
    ['is 1000003 prime', '1000003 is prime'],
    ['prime factorization of 360', '360 = 2^3 × 3^2 × 5'],
    ['what are the prime factors of 84', '84 = 2^2 × 3 × 7'],
    ['factor 360', '360 = 2^3 × 3^2 × 5'],
    ['factor 97', '97 = 97 (97 is prime)'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'other', p);
  }
  const r = await solvePlain('is 97 prime', 'other');
  assert.ok(r.steps.includes('Divide by each: 97 = 2·48 + 1, 97 = 3·32 + 1, 97 = 5·19 + 2, 97 = 7·13 + 6. Every remainder is non-zero.'), r.steps.join(' | '));
  // A polynomial is still factored as one.
  assert.match((await solveProblem('factor x^2 - 9', 'auto')).answer, /\(x - 3\)\(x \+ 3\)|\(x \+ 3\)\(x - 3\)/);
});

test('rounding: decimal places, significant figures, a place; half away from zero, on the digits as typed', async () => {
  for (const [p, answer] of [
    ['round 3.14159 to 2 decimal places', '3.14'],
    ['round 3.14159 to two decimal places', '3.14'],
    ['round 2.675 to 2 dp', '2.68'], // 2.675 is 2.67499… as a float
    ['round 2.996 to 2 decimal places', '3.00'],
    ['round 1250 to the nearest hundred', '1300'],
    ['round 45 to the nearest ten', '50'],
    ['round 3.456 to the nearest tenth', '3.5'],
    ['round 0.004567 to 2 significant figures', '0.0046'],
    ['round 123456 to 3 sig figs', '123000'],
    ['round -2.5 to the nearest whole number', '-3'],
    ['round sqrt(2) to 3 decimal places', '1.414'],
    ['round 5 to 2 decimal places', '5.00'],
    ['2.675 rounded to 2 dp', '2.68'],
  ]) {
    assert.equal((await solveProblem(p, 'auto')).answer, answer, p);
  }
  const r = await solvePlain('round 2.996 to 2 decimal places', 'other');
  assert.match(r.steps.join(' '), /the 9 becomes 0, carrying 1/);
});

test('an implicit curve is traced as connected pieces, framed to scale', async () => {
  const circle = implicitCurve('x^2 + y^2 - 25', 'x', 'y', { xMin: -6, xMax: 6, yMin: -6, yMax: 6 });
  assert.equal(circle.length, 1, 'one closed loop');
  for (const p of circle[0]) assert.ok(Math.abs(Math.hypot(p.x, p.y) - 5) < 0.05, `(${p.x}, ${p.y}) on the circle`);
  assert.equal(implicitCurve('x*y - 1', 'x', 'y', { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }).length, 2, 'two branches, no line across the pole');
  assert.equal(implicitCurve('y - 1/x', 'x', 'y', { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }).length, 2, 'a pole in F is not a crossing');
  const w = implicitWindow('x^2 + y^2 - 25', 'x', 'y');
  assert.ok(w.xMin < -5 && w.xMax > 5 && w.yMin < -5 && w.yMax > 5, 'the window holds the whole circle');
});

test('an implicit derivative is graphed: the curve, and the tangent at the point', async () => {
  const r = await solveProblem('x^2 + y^2 = 25 at (3, 4)', 'derivatives');
  assert.equal(r.answer, 'dy/dx at (3, 4) = -3/4 ≈ -0.75');
  assert.equal(r.graph.implicit.expression.replace(/\s+/g, ''), '(x^2+y^2)-(25)');
  assert.equal(r.graph.secondaryLabel, 'tangent: y = -3x/4 + 25/4');
  assert.deepEqual(r.graph.annotations.tangentPoint, { x: 3, y: 4, label: '(3, 4)' });
  assert.match(describeGraphFeatures(r.graph).join(' '), /The curve x\^2 \+ y\^2 = 25 is plotted/);
  // A vertical tangent is drawn as a vertical line.
  const v = await solveProblem('x^2 + y^2 = 25 at (5, 0)', 'derivatives');
  assert.deepEqual(v.graph.solutions, [5]);
  // Without a point: the curve alone.
  const c = await solveProblem('xy = 1', 'derivatives');
  assert.ok(c.graph.implicit && !c.graph.secondaryExpression);
});
