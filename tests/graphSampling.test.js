import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCurve, featureWindow, annotationFeatureXs, annotationFeatureYs, interestingXs, robustYWindow, SAMPLES_PER_WINDOW } from '../src/lib/graphSampling.js';

// The viewer re-samples a graph that carries its expression for the window on
// screen, so a zoomed-in cubic is a smooth curve through its exact markers,
// not eight straight segments; and it inserts a gap at every break so the
// tangent curve never joins its branches across an asymptote.

test('sampleCurve: a fixed number of samples per window, whatever the zoom', () => {
  const wide = sampleCurve('x^3 - 3*x', 'x', { xMin: -10, xMax: 10 });
  const narrow = sampleCurve('x^3 - 3*x', 'x', { xMin: -1.5, xMax: -0.5 });
  assert.equal(wide.length, SAMPLES_PER_WINDOW + 1);
  assert.equal(narrow.length, SAMPLES_PER_WINDOW + 1);
  // The curve passes through the exact maximum (-1, 2).
  const near = narrow.find((p) => Math.abs(p.x + 1) < 1e-9);
  assert.ok(near && Math.abs(near.y - 2) < 1e-9);
});

test('sampleCurve: a named break becomes a null point with real samples either side', () => {
  const pts = sampleCurve('tan(x)', 'x', { xMin: -4, xMax: 4, count: 40, breaks: [-Math.PI / 2, Math.PI / 2] });
  const nulls = pts.filter((p) => p.y === null).map((p) => p.x);
  assert.equal(nulls.length, 2);
  assert.ok(Math.abs(nulls[0] + Math.PI / 2) < 1e-6 && Math.abs(nulls[1] - Math.PI / 2) < 1e-6);
  const i = pts.findIndex((p) => p.y === null);
  assert.ok(pts[i - 1].y > 100 && pts[i + 1].y < -100, 'branches run up to the gap on both sides');
});

test('sampleCurve: an unnamed pole is detected; a steep crossing is not', () => {
  const inv = sampleCurve('1/x', 'x', { xMin: -2, xMax: 2, count: 40 });
  assert.deepEqual(inv.filter((p) => p.y === null).map((p) => p.x), [0]);
  const line = sampleCurve('100*x', 'x', { xMin: -2, xMax: 2, count: 40 });
  assert.equal(line.filter((p) => p.y === null).length, 0);
});

test('sampleCurve: undefined values are gaps, not skipped points', () => {
  const sq = sampleCurve('sqrt(x)', 'x', { xMin: -2, xMax: 2, count: 8 });
  assert.equal(sq.length, 9);
  assert.ok(sq.slice(0, 4).every((p) => p.y === null));
  assert.equal(sq[4].y, 0);
});

test('sampleCurve: the two-curve grid — a secondary break is a plain sample on the primary', () => {
  const primary = sampleCurve('abs(x)', 'x', { xMin: -2, xMax: 2, count: 40, extraXs: [0.123] });
  assert.ok(primary.some((p) => p.x === 0.123 && p.y === 0.123));
  const secondary = sampleCurve('sgn(x)', 'x', { xMin: -2, xMax: 2, count: 40, breaks: [0] });
  const at0 = secondary.find((p) => p.x === 0);
  assert.equal(at0.y, null);
});

test('sampleCurve: bad input yields no points rather than throwing', () => {
  assert.deepEqual(sampleCurve('sin(', 'x', { xMin: 0, xMax: 1 }), []);
  assert.deepEqual(sampleCurve('x', 'x', { xMin: 1, xMax: 1 }), []);
  assert.deepEqual(sampleCurve('', 'x', { xMin: 0, xMax: 1 }), []);
});

test('featureWindow frames the features with room around them', () => {
  assert.deepEqual(featureWindow([-1.732, -1, 0, 1, 1.732]), { xMin: -3.464, xMax: 3.464 });
  assert.deepEqual(featureWindow([0]), { xMin: -2, xMax: 2 }); // never narrower than 4
  assert.deepEqual(featureWindow([100]), { xMin: 40 - 4, xMax: 40 }); // clamped to ±40, width kept
  assert.equal(featureWindow([]), null);
  assert.equal(featureWindow([NaN, Infinity]), null);
  // Padding is capped, so widely spread features do not blow the window up.
  const w = featureWindow([-9, 9]);
  assert.deepEqual(w, { xMin: -12, xMax: 12 });
});

test('annotationFeatureXs gathers every marked x', () => {
  const xs = annotationFeatureXs({
    solutions: [7],
    annotations: {
      extrema: [{ x: -1, y: 2 }], intercepts: [{ x: 2, y: 0 }], yIntercept: { x: 0, y: 1 }, holes: [{ x: 3, y: 1 }],
      verticalAsymptotes: [4], openPoints: [{ x: 5, y: 1 }], intersection: { x: 6, y: 6 }, shaded: { from: 8, to: 9 },
    },
  });
  assert.deepEqual([...xs].sort((a, b) => a - b), [-1, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(annotationFeatureXs(null), []);
});

test('interestingXs finds zeros, turning points and inflections, and nothing for e^x', () => {
  const xs = interestingXs('x^3 - 3*x', 'x');
  const has = (v) => xs.some((x) => Math.abs(x - v) < 0.05);
  assert.ok(has(-1.732) && has(0) && has(1.732), 'roots');
  assert.ok(has(-1) && has(1), 'extrema');
  assert.deepEqual(interestingXs('exp(x)', 'x'), []);
  // A line's curvature is rounding noise around zero, not a pile of inflections.
  assert.ok(interestingXs('abs(x)', 'x').length <= 2);
});

test('robustYWindow: min/max for a smooth curve, capped near a gap, features kept inside', () => {
  const cubic = sampleCurve('x^3 - 3*x', 'x', { xMin: -3.46, xMax: 3.46 });
  const w = robustYWindow(cubic);
  assert.ok(w.yMin < -31 && w.yMax > 31, JSON.stringify(w)); // nothing clipped
  const tan = sampleCurve('tan(x)', 'x', { xMin: -2 * Math.PI, xMax: 2 * Math.PI, breaks: [-3 * Math.PI / 2, -Math.PI / 2, Math.PI / 2, 3 * Math.PI / 2] });
  const t = robustYWindow(tan);
  assert.ok(t.yMax < 40 && t.yMax > 5, JSON.stringify(t)); // the spikes are cut off, the shape is not
  const f = robustYWindow([{ x: 0, y: 1 }, { x: 1, y: 2 }], ['y'], [50]);
  assert.ok(f.yMax >= 50);
  assert.equal(robustYWindow([], ['y']), null);
  // A gap in the secondary series counts; undefined (absent) does not.
  const two = robustYWindow([{ x: 0, y: 1, y2: null }, { x: 1, y: 2 }], ['y', 'y2']);
  assert.ok(two && two.yMin < 1 && two.yMax > 2);
});

test('annotationFeatureYs splits primary and secondary features', () => {
  const data = { annotations: { extrema: [{ x: 1, y: 5 }], openPoints: [{ x: 0, y: -1, series: 'secondary' }, { x: 0, y: 1, series: 'secondary' }], intercepts: [{ x: 2, y: 0 }] } };
  assert.deepEqual(annotationFeatureYs(data, 'primary').sort(), [0, 5]);
  assert.deepEqual(annotationFeatureYs(data, 'secondary').sort(), [-1, 1]);
});
