// Curve sampling for the graph viewer.
//
// Solvers used to hand the viewer a fixed grid of points (0.25 or 0.5 apart
// over ±40) and the viewer merely filtered that grid to the visible window.
// Zoomed in three times, a window two units wide held eight points drawn with
// straight segments: the cubic looked polygonal, exact feature markers sat
// visibly off the polyline, and the tangent curve joined its branches across
// every asymptote with a near-vertical line. A graph that carries its
// `expression` is now re-sampled here for whatever window is on screen, at a
// fixed number of samples per window, with an explicit gap at every break.

import { math, realOddRoots } from './solvers/solverUtils.js';

export const SAMPLES_PER_WINDOW = 400;

const round = (x) => Math.round(x * 1e9) / 1e9;

// Sample `expression` in `variable` over [xMin, xMax]. Returns points sorted
// by x; y is null where the function is undefined, blows up past `cap`, or
// at a break, and the viewer draws nothing across a null (connectNulls off).
//   breaks   — x values where this curve is undefined (vertical asymptotes,
//              a cusp of a derivative): a null point is inserted exactly there,
//              with real samples just either side so the branches run right
//              up to the gap.
//   extraXs  — x values that must appear as samples (the other curve's
//              breaks, so two curves share one x grid and neither shows a
//              spurious gap where the other has a real one).
// A pole the caller did not name is still caught: when neighbouring samples
// change sign and the value at the midpoint is larger than both, the curve
// is diverging between them, not crossing zero, so a gap goes there too.
export function sampleCurve(expression, variable, { xMin, xMax, count = SAMPLES_PER_WINDOW, breaks = [], extraXs = [], cap = 1e6 } = {}) {
  const span = xMax - xMin;
  if (!(span > 0) || !expression) return [];
  let compiled;
  try {
    // The trimmed mathjs instance has parse() but no top-level compile().
    compiled = math.parse(realOddRoots(String(expression))).compile();
  } catch {
    return [];
  }
  const valueAt = (x) => {
    try {
      const y = compiled.evaluate({ [variable]: x });
      return typeof y === 'number' && Number.isFinite(y) && Math.abs(y) <= cap ? y : null;
    } catch {
      return null;
    }
  };

  const step = span / count;
  const eps = step * 1e-3;
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const x = round(xMin + i * step);
    points.push({ x, y: valueAt(x) });
  }
  const inside = (x) => Number.isFinite(x) && x > xMin && x < xMax;
  for (const b of breaks.filter(inside)) {
    points.push({ x: round(b - eps), y: valueAt(b - eps) }, { x: round(b), y: null }, { x: round(b + eps), y: valueAt(b + eps) });
  }
  const named = new Set(breaks.map(round));
  for (const x of extraXs.filter(inside)) {
    if (!named.has(round(x))) points.push({ x: round(x), y: valueAt(x) });
  }
  points.sort((a, b) => a.x - b.x);

  // Dedupe identical x (a break that coincides with a grid point).
  const deduped = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (last && last.x === p.x) {
      if (p.y === null) last.y = null;
      continue;
    }
    deduped.push(p);
  }

  // Unnamed poles: a sign change where the function is diverging, not crossing.
  const out = [];
  for (let i = 0; i < deduped.length; i += 1) {
    const p = deduped[i];
    const prev = out[out.length - 1];
    if (prev && prev.y !== null && p.y !== null && Math.sign(prev.y) !== Math.sign(p.y) && prev.y !== 0 && p.y !== 0) {
      const mid = (prev.x + p.x) / 2;
      const ym = valueAt(mid);
      const diverging = ym === null || Math.abs(ym) > Math.max(Math.abs(prev.y), Math.abs(p.y));
      if (diverging && Math.min(Math.abs(prev.y), Math.abs(p.y)) > 4 * step) {
        out.push({ x: round(mid), y: null });
      }
    }
    out.push(p);
  }
  return out;
}

// The x-window that shows a set of feature x-values with room around them:
// padded by half the span on each side (at least `minPad`), never narrower
// than `minWidth`, and kept within ±`limit`. Null when there is nothing to
// fit, so the caller falls back to its default.
export function featureWindow(xs, { minWidth = 4, minPad = 1.5, maxPad = 3, padRatio = 0.5, limit = 40 } = {}) {
  const finite = (xs || []).filter((x) => Number.isFinite(x));
  if (finite.length === 0) return null;
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  const pad = Math.min(maxPad, Math.max(minPad, (hi - lo) * padRatio));
  lo -= pad;
  hi += pad;
  if (hi - lo < minWidth) {
    const c = (lo + hi) / 2;
    lo = c - minWidth / 2;
    hi = c + minWidth / 2;
  }
  lo = Math.max(-limit, lo);
  hi = Math.min(limit, hi);
  // Clamping can squeeze the window: keep the minimum width inside the limits.
  if (hi - lo < minWidth) {
    if (hi >= limit) lo = Math.max(-limit, hi - minWidth);
    else hi = Math.min(limit, lo + minWidth);
  }
  if (!(hi > lo)) return null;
  return { xMin: round(lo), xMax: round(hi) };
}

// Every x the annotations mark: extrema, intercepts, holes, asymptotes, a
// solution, an intersection, a limit point, a shaded region's ends.
export function annotationFeatureXs(functionData) {
  if (!functionData) return [];
  const ann = functionData.annotations || {};
  const xs = [];
  const push = (v) => { if (Number.isFinite(v)) xs.push(v); };
  for (const e of ann.extrema || []) push(e?.x);
  for (const p of ann.intercepts || []) push(p?.x);
  if (ann.yIntercept) push(0);
  for (const h of ann.holes || []) push(h?.x);
  for (const a of ann.verticalAsymptotes || []) push(a);
  for (const o of ann.openPoints || []) push(o?.x);
  if (ann.intersection) push(ann.intersection.x);
  if (ann.limitPoint) push(ann.limitPoint.x);
  if (ann.guideline) push(ann.guideline.x);
  if (ann.shaded) { push(ann.shaded.from); push(ann.shaded.to); }
  for (const r of ann.shadedRegions || []) { push(r?.from); push(r?.to); }
  for (const s of functionData.solutions || []) push(s);
  return xs;
}

// Where a function "does something": its zeros, its turning points and its
// inflection points, found numerically on a fine grid over ±10. Used by
// solvers that have no exact feature list (the derivative graph) to choose
// a starting window that shows the interesting part of the curve.
export function interestingXs(expression, variable, { min = -10, max = 10, step = 0.02 } = {}) {
  let compiled;
  try {
    compiled = math.parse(realOddRoots(String(expression))).compile();
  } catch {
    return [];
  }
  const f = (x) => {
    try {
      const y = compiled.evaluate({ [variable]: x });
      return typeof y === 'number' && Number.isFinite(y) && Math.abs(y) < 1e6 ? y : NaN;
    } catch {
      return NaN;
    }
  };
  const xs = [];
  const ys = [];
  for (let x = min; x <= max + 1e-9; x += step) {
    xs.push(x);
    ys.push(f(x));
  }
  const slopes = ys.map((y, i) => (i === 0 || i === ys.length - 1 ? NaN : (ys[i + 1] - ys[i - 1]) / (2 * step)));
  const curvatures = ys.map((y, i) => (i === 0 || i === ys.length - 1 ? NaN : (ys[i + 1] - 2 * y + ys[i - 1]) / (step * step)));
  const found = [];
  const signChanges = (series, tolerance) => {
    for (let i = 1; i < series.length; i += 1) {
      const a = series[i - 1];
      const b = series[i];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
        // A genuine crossing, not a pole (the values must be small-ish) and
        // not rounding noise around zero (a line's curvature is 0 ± 1e-13).
        if (Math.abs(a) < tolerance && Math.abs(b) < tolerance && Math.max(Math.abs(a), Math.abs(b)) > 1e-6) found.push((xs[i - 1] + xs[i]) / 2);
      }
    }
  };
  signChanges(ys, 1e4);
  signChanges(slopes, 1e4);
  signChanges(curvatures, 1e5);
  return found;
}

// The y-window for an automatic fit of the visible samples. Plain min/max
// is right for a smooth curve, but re-sampling runs right up to every
// asymptote, so tan(x) over two turns has values near ±40 000 that turn the
// curve into vertical spikes on a min/max axis. When the visible data has a
// gap (a pole or asymptote) the window is capped at three times the 90th
// percentile of |y| — the branches run off the top and bottom, as on any
// graphing calculator. Marked features (`featureYs`) are always inside.
export function robustYWindow(points, keys = ['y'], featureYs = []) {
  const ys = [];
  let hasGap = false;
  for (const p of points || []) {
    for (const k of keys) {
      const v = p[k];
      if (v === null) hasGap = true;
      else if (Number.isFinite(v)) ys.push(v);
    }
  }
  if (ys.length === 0) return null;
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (hasGap) {
    const magnitudes = ys.map(Math.abs).sort((a, b) => a - b);
    const p90 = magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * 0.9))];
    const cap = Math.max(3 * p90, 1);
    lo = Math.max(lo, -cap);
    hi = Math.min(hi, cap);
  }
  for (const y of featureYs || []) {
    if (Number.isFinite(y)) {
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  if (!(hi > lo)) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.05;
  return { yMin: lo - pad, yMax: hi + pad };
}

// Every y the annotations mark, for keeping features inside the y-window.
export function annotationFeatureYs(functionData, series = 'primary') {
  const ann = functionData?.annotations || {};
  const ys = [];
  const push = (v) => { if (Number.isFinite(v)) ys.push(v); };
  if (series === 'primary') {
    for (const e of ann.extrema || []) push(e?.y);
    if (ann.yIntercept) push(ann.yIntercept.y);
    if ((ann.intercepts || []).length) push(0);
    for (const h of ann.holes || []) push(h?.y);
    if (ann.intersection) push(ann.intersection.y);
    if (ann.limitPoint) push(ann.limitPoint.y);
  }
  for (const o of ann.openPoints || []) {
    if ((o?.series === 'secondary') === (series === 'secondary')) push(o?.y);
  }
  return ys;
}
