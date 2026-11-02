// The exact number of roots of f(x) = A·g(kx + c) + d − (m·x + b), g = sin
// or cos, on the interval [lo, hi] that |g| ≤ 1 confines them to.
//
// f″(x) = −A·k²·g(kx + c), so f″ keeps one sign between consecutive zeros of
// g(kx + c). On each such piece f is strictly concave or strictly convex: f′
// is monotone, f rises then falls (or falls then rises) about at most one
// turning point, so the piece holds at most two roots, and the signs of f at
// the two ends and at the turning point say exactly how many. Added up over
// the pieces, that is the number of solutions; when it matches the roots the
// scan found, the list is complete (1.65.0; the fourth outside review, Round
// 32: sin(x) = x/2 has exactly three).
//
// A value within ZERO of 0 at a turning point that is not exactly 0 cannot
// be told from a touch, so that piece, and the whole count, is undecided.
//
// waveLineBound reads the equation as wave and line and bounds the roots;
// it lives here, not in the entry file, so the inequality solver can count
// A·sin(kx + c) + d > mx + b the same way (1.66.0).

import { math, beautify, formatNumber, mark } from '../solverUtils.js';
import { readPolynomial } from '../polynomialRoots.js';

const ZERO = 1e-12;
const MAX_PIECES = 400;

export function countWaveLineRoots({ A, fn, k, c, d, m, b, lo, hi }) {
  if (![A, k, c, d, m, b, lo, hi].every(Number.isFinite) || A === 0 || k === 0 || !(hi > lo)) return null;
  const g = fn === 'sin' ? Math.sin : Math.cos;
  const gPrime = fn === 'sin' ? Math.cos : (u) => -Math.sin(u);
  const f = (x) => A * g(k * x + c) + d - (m * x + b);
  const fp = (x) => A * k * gPrime(k * x + c) - m;
  // The zeros of g(kx + c) in (lo, hi): sin at jπ, cos at π/2 + jπ.
  const offset = fn === 'sin' ? 0 : Math.PI / 2;
  const cuts = [];
  const a1 = (k * lo + c - offset) / Math.PI;
  const a2 = (k * hi + c - offset) / Math.PI;
  const [j1, j2] = [Math.ceil(Math.min(a1, a2)), Math.floor(Math.max(a1, a2))];
  if (j2 - j1 > MAX_PIECES) return null;
  for (let j = j1; j <= j2; j += 1) {
    const x = (j * Math.PI + offset - c) / k;
    if (x > lo && x < hi) cuts.push(x);
  }
  cuts.sort((x, y) => x - y);
  const edges = [lo, ...cuts, hi];
  // Root locations: an exact point (an end where f is 0) or an open
  // monotone stretch where f changes sign. Points are kept once.
  const points = [];
  const stretches = [];
  const addPoint = (x) => { if (!points.some((p) => Math.abs(p - x) < 1e-9)) points.push(x); };
  const isZero = (v) => Math.abs(v) <= ZERO;
  // One monotone stretch [u, v]: a root at an end that is 0, else one inside
  // exactly when f changes sign.
  const monotone = (u, v) => {
    const fu = f(u);
    const fv = f(v);
    if (isZero(fu)) addPoint(u);
    if (isZero(fv)) addPoint(v);
    if (!isZero(fu) && !isZero(fv) && Math.sign(fu) !== Math.sign(fv)) stretches.push([u, v]);
  };
  // The one root of a monotone stretch, by bisection to double precision.
  const locate = ([u, v]) => {
    let a = u;
    let z = v;
    const sa = Math.sign(f(a));
    for (let n = 0; n < 200 && z - a > 1e-15 * (1 + Math.abs(a)); n += 1) {
      const mid = (a + z) / 2;
      if (Math.sign(f(mid)) === sa) a = mid; else z = mid;
    }
    return (a + z) / 2;
  };
  for (let i = 0; i + 1 < edges.length; i += 1) {
    const p = edges[i];
    const q = edges[i + 1];
    const dp = fp(p);
    const dq = fp(q);
    // f′ monotone on [p, q]: a turning point inside exactly when f′ changes sign.
    if (Math.sign(dp) === Math.sign(dq) || dp === 0 || dq === 0) {
      monotone(p, q);
      continue;
    }
    let a = p;
    let z = q;
    for (let n = 0; n < 200 && z - a > 1e-15 * (1 + Math.abs(a)); n += 1) {
      const mid = (a + z) / 2;
      if (Math.sign(fp(mid)) === Math.sign(dp)) a = mid; else z = mid;
    }
    const t = (a + z) / 2;
    const ft = f(t);
    // A turning value next to 0: a touch or two close roots, undecidable here.
    if (Math.abs(ft) <= 1e-9 && !(ft === 0)) return { decided: false };
    monotone(p, t);
    monotone(t, q);
  }
  // Every root, in order: the exact points (f is 0 there, as at x = 0 for
  // sin(x) = x/2) and one per sign-changing stretch.
  const roots = [...points.map((x) => ({ x, exact: true })), ...stretches.map((st) => ({ x: locate(st), exact: false }))].sort((a, z) => a.x - z.x);
  return { decided: true, count: roots.length, pieces: edges.length - 1, cuts, roots };
}

// A·f(u) + d on one side (f = sin or cos) and a line m·x + b on the other:
// since |f| ≤ 1, a solution needs |m·x + b − d| ≤ |A|, an interval of x.
export function waveLineBound(equation, variable) {
  const sides = String(equation).replace(/\s+/g, '').split('=');
  if (sides.length !== 2) return null;
  const wave = /^(-?(?:\d+(?:\.\d+)?|\d+\/\d+)?\*?|-)?(sin|cos)\(([^()]+)\)([+-](?:\d+(?:\.\d+)?|\d+\/\d+))?$/;
  for (const [w, l] of [[sides[0], sides[1]], [sides[1], sides[0]]]) {
    const m = w.match(wave);
    if (!m) continue;
    const line = readPolynomial(l, variable);
    if (!line || line.tooHigh || line.degree !== 1) continue;
    const A = m[1] === undefined || m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(math.evaluate(m[1].replace(/\*$/, '')));
    const d = m[4] ? Number(math.evaluate(m[4])) : 0;
    const [b, slope] = line.coefficients.map(Number);
    if (!Number.isFinite(A) || A === 0 || slope === 0) continue;
    const R = Math.abs(A);
    const ends = [(d - R - b) / slope, (d + R - b) / slope].sort((x, y) => x - y);
    const fmt = (x) => (Number.isInteger(x) ? String(x) : formatNumber(x));
    const fn = m[2];
    const lineShown = beautify(l);
    // The argument k·x + c, for the root count.
    const at = (x) => { try { return Number(math.evaluate(m[3], { [variable]: x })); } catch { return NaN; } };
    const [c0, c1, c2] = [at(0), at(1), at(2)];
    const linearArg = [c0, c1, c2].every(Number.isFinite) && Math.abs(c2 - 2 * c1 + c0) < 1e-12;
    return {
      fn,
      lo: ends[0],
      hi: ends[1],
      wave: { A, fn, d, k: c1 - c0, c: c0, m: slope, b, waveText: beautify(w), lineText: lineShown, arg: beautify(m[3]), linearArg },
      boundText: `Every solution is in ${mark(`${fmt(ends[0])} ≤ ${variable} ≤ ${fmt(ends[1])}`)}: ${mark(`|${fn}(${beautify(m[3])})| ≤ 1`)}, so ${mark(lineShown)} must lie between ${mark(fmt(d - R))} and ${mark(fmt(d + R))}.`,
      step: `Every solution is in ${mark(`${fmt(ends[0])} ≤ ${variable} ≤ ${fmt(ends[1])}`)}: ${mark(`|${fn}(${beautify(m[3])})| ≤ 1`)}, so ${mark(lineShown)} must lie between ${mark(fmt(d - R))} and ${mark(fmt(d + R))}. The search covers that interval, but a scan can still miss a root that only touches the axis or two roots closer than its step, so this bounds the solutions without proving the list complete.`,
    };
  }
  return null;
}
