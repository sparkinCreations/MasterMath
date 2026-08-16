import test from 'node:test';
import assert from 'node:assert/strict';

import { describeGraph, describeGraphFeatures } from '../src/lib/graphDescription.js';

const base = { title: 'Graph of f(x) = x^2 - 4', points: [{ x: 0, y: -4 }] };

test('describeGraph returns empty for missing or non-graph data', () => {
  assert.equal(describeGraph(null), '');
  assert.equal(describeGraph({}), '');
  assert.equal(describeGraph({ title: 'x' }), '');
});

test('a graph with no annotations says so rather than inventing features', () => {
  assert.deepEqual(describeGraphFeatures(base), []);
  const s = describeGraph(base);
  assert.match(s, /^Graph of f\(x\) = x\^2 - 4\./);
  assert.match(s, /No key features are marked/);
});

test('functions: extrema, intercepts, y-intercept and asymptotes read in order', () => {
  const data = {
    ...base,
    annotations: {
      extrema: [{ x: 0, y: -4, kind: 'min' }],
      intercepts: [{ x: -2, y: 0 }, { x: 2, y: 0 }],
      yIntercept: { x: 0, y: -4 },
      verticalAsymptotes: [1.5],
    },
  };
  const f = describeGraphFeatures(data);
  assert.equal(f.length, 4);
  assert.equal(f[0], 'Local minimum at (0, -4).');
  assert.equal(f[1], 'Crosses the x-axis at x = -2 and x = 2.');
  assert.equal(f[2], 'Crosses the y-axis at y = -4.');
  assert.equal(f[3], 'Vertical asymptote at x = 1.5.');
  assert.match(describeGraph(data), /Line chart with 4 key features marked:/);
});

test('plurals and three-item lists use an Oxford comma', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: {
      extrema: [
        { x: -1, y: 2, kind: 'max' },
        { x: 3, y: 5, kind: 'max' },
      ],
      intercepts: [{ x: 1 }, { x: 2 }, { x: 3 }],
    },
  });
  assert.equal(f[0], 'Local maxima at (-1, 2) and (3, 5).');
  assert.equal(f[1], 'Crosses the x-axis at x = 1, x = 2, and x = 3.');
});

test('numbers are rounded to four significant figures, integers left alone', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: { extrema: [{ x: 1 / 3, y: -2.718281828, kind: 'min' }] },
  });
  assert.equal(f[0], 'Local minimum at (0.3333, -2.718).');
});

test('limits: guideline and hollow limit marker', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: {
      guideline: { x: 0, label: 'x → 0' },
      limitPoint: { x: 0, y: 1 },
    },
  });
  assert.equal(f[0], 'A dashed guideline marks the approach point x = 0 (x → 0).');
  assert.match(f[1], /hollow marker at \(0, 1\).*L = 1/);
});

test('definite integrals prefer the solver-provided bound labels', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: { shaded: { from: 0, to: 3.14159, fromLabel: '0', toLabel: 'π' } },
  });
  assert.equal(f[0], 'The area between the curve and the x-axis is shaded from x = 0 to x = π.');
});

test('systems: intersection point; secondary curve is announced', () => {
  const f = describeGraphFeatures({
    ...base,
    secondaryLabel: 'x - y = 4',
    annotations: { intersection: { x: 3.6, y: -0.4, label: '(18/5, -2/5)' } },
  });
  assert.equal(f[0], 'Two curves are plotted: f(x), and x - y = 4 as a dashed line.');
  assert.equal(f[1], 'The two lines intersect at (3.6, -0.4).');
});

test('inequalities: infinite bounds are spelled out', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: {
      shadedRegions: [
        { from: -Infinity, to: -2 },
        { from: 2, to: Infinity },
      ],
    },
  });
  assert.equal(
    f[0],
    'The inequality holds on the shaded intervals from negative infinity to -2 and from 2 to positive infinity.'
  );
});

test('algebra: equation solutions', () => {
  const f = describeGraphFeatures({ ...base, solutions: [3] });
  assert.equal(f[0], 'Solution marked at x = 3.');
});

test('malformed annotation entries are skipped, not described', () => {
  const f = describeGraphFeatures({
    ...base,
    annotations: {
      extrema: [{ x: NaN, y: 1, kind: 'max' }, { x: 1, y: 1, kind: 'max' }],
      intercepts: [{}, { x: 5 }],
      verticalAsymptotes: [Infinity, 2],
    },
  });
  assert.equal(f[0], 'Local maximum at (1, 1).');
  assert.equal(f[1], 'Crosses the x-axis at x = 5.');
  assert.equal(f[2], 'Vertical asymptote at x = 2.');
});
