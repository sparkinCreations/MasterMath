// A limit's graph (user report, November 2026; 1.73.2): the PDF of
// lim x→0 (1 − cos x)/x² showed the curve diving to 0 at x = 0 and no
// marker at the limit. The sample "at 0" was 1e-14, where the quotient is 0
// by cancellation; and the marker read Number(answer), never a number for
// an exact form such as 1/2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem } from '../src/lib/api.js';
import { sampleFunction } from '../src/lib/solvers/solverUtils.js';

test('a finite limit is marked at (point, value), labelled with its exact value', async () => {
  for (const [p, x, y, label] of [
    ['lim x->0 (1 - cos x)/x^2', 0, 0.5, '1/2'],
    ['lim x->0 sin(x)/x', 0, 1, '1'],
    ['lim x->1 (x^2-1)/(x-1)', 1, 2, '2'],
    ['lim x->0 x*sin(1/x)', 0, 0, '0'],
  ]) {
    const lp = (await solveProblem(p, 'auto')).graph?.annotations?.limitPoint;
    assert.ok(lp, p);
    assert.equal(lp.x, x, p);
    assert.ok(Math.abs(lp.y - y) < 1e-12, p);
    assert.equal(lp.label, label, p);
  }
  // No value, no marker.
  assert.equal((await solveProblem('lim x->0 1/x', 'auto')).graph?.annotations?.limitPoint ?? null, null);
});

test('the graph leaves a gap where the function is undefined, never a value from cancellation', async () => {
  const pts = (await solveProblem('lim x->0 (1 - cos x)/x^2', 'auto')).graph.points;
  assert.ok(!pts.some((p) => Math.abs(p.x) < 1e-9), 'no sample at x = 0');
  assert.ok(pts.filter((p) => Math.abs(p.x) <= 0.4).every((p) => p.y > 0.49), 'the curve stays near 1/2 beside 0');
});

test('samples lie exactly on the grid', () => {
  const xs = sampleFunction('x', 'x', { min: -30, max: 30, step: 0.2 }).map((p) => p.x);
  assert.ok(xs.includes(0));
  assert.equal(xs.length, 301);
  assert.ok(xs.every((x) => Math.abs(x * 5 - Math.round(x * 5)) < 1e-9));
});
