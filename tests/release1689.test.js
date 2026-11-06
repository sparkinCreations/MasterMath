import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';
import { describeGraph } from '../src/lib/graphDescription.js';
import { intersectionPoints, annotationFeatureXs } from '../src/lib/graphSampling.js';

// 1.68.9 (live check of 1.68.8, November 2026): the graph of x·y = 6,
// x + y = 5 marked (2, 3) and not (3, 2), and its description counted "1 key
// feature". Every system with two solutions did the same.

test('a system\'s graph marks every solution, and its description counts them', async () => {
  for (const [p, points] of [
    ['xy = 6; x + y = 5', [[2, 3], [3, 2]]],
    ['y = x^2; y = x + 2', [[-1, 1], [2, 4]]],
    ['x^2 + y^2 = 25; x + y = 7', [[3, 4], [4, 3]]],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.deepEqual(intersectionPoints(r.graph.annotations).map((q) => [q.x, q.y]), points, p);
    const text = describeGraph(r.graph);
    for (const [x, y] of points) assert.match(text, new RegExp(`the graphs meet at \\(${x}, ${y}\\)`), p);
    assert.match(text, /Intersection 2 of 2/, p);
    // Fit key features frames both points.
    for (const [x] of points) assert.ok(annotationFeatureXs(r.graph).includes(x), p);
  }
});

test('a linear system still reads as two lines crossing once', async () => {
  const r = await solvePlain('2x + 3y = 6; x - y = 4', 'algebra');
  assert.match(describeGraph(r.graph), /The two lines intersect at \(3\.6, -0\.4\)\./);
  // A history entry saved with the single field before 1.68.9 still draws.
  assert.deepEqual(intersectionPoints({ intersection: { x: 1, y: 2, label: '(1, 2)' } }), [{ x: 1, y: 2, label: '(1, 2)' }]);
});
