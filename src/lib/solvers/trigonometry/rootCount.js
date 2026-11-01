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
