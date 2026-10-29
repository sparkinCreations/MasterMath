// Each feature of a function found and proved: the domain, vertical
// asymptotes and holes, intercepts, extrema (interior and at the endpoints),
// inflection points and the horizontal asymptote. Nothing is reported that
// was not found.

import {
  math,
  beautify,
  formatNumber,
  rewriteReciprocalTrig,
  findUndefinedRegions,
  realOddRoots,
  piForm,
  neverZeroSide,
  exactForm,
} from '../solverUtils.js';

export const WINDOW = { min: -10, max: 10 };
export const FINE_STEP = 0.05;
const BIG = 1e6;

// --- numeric primitives ------------------------------------------------------

export function evalAt(func, variable, x) {
  try {
    const y = math.evaluate(realOddRoots(func), { [variable]: x });
    const n = typeof y === 'number' ? y : Number(y);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

// Bisection: refine a root of g inside [a, b] where sign(g(a)) != sign(g(b)).
function bisect(g, a, b) {
  let lo = a;
  let hi = b;
  let glo = g(lo);
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const gm = g(mid);
    if (!Number.isFinite(gm)) return null;
    if (Math.abs(gm) < 1e-12) return mid;
    if (Math.sign(gm) === Math.sign(glo)) { lo = mid; glo = gm; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

// Snap near-integers / near-halves produced by numeric refinement.
export function snap(x) {
  for (const q of [1, 2, 4]) {
    const r = Math.round(x * q) / q;
    if (Math.abs(x - r) < 1e-7) return r;
  }
  return x;
}

// Parse an Algebrite bracketed root list into {display, numeric} pairs.
function parseRoots(raw) {
  const inner = String(raw).trim().replace(/^\[|\]$/g, '');
  if (!inner) return [];
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((p) => {
    let numeric = NaN;
    try {
      const v = math.evaluate(p.trim().replace(/\bi\b/, 'NaN'));
      numeric = typeof v === 'number' ? v : NaN;
    } catch { numeric = NaN; }
    // Algebrite's 3^(1/2) is shown as √3 (x-intercepts at x = -√3, 0, √3).
    return { raw: p.trim(), display: beautify(p.trim()).replace(/(\d+)\^\(1\/2\)/g, '√$1').replace(/(\d+)\^\(1\/3\)/g, '∛$1'), numeric };
  }).filter((r) => Number.isFinite(r.numeric)); // real roots only
}

// An extremum sitting on the edge of the domain. sqrt(x-2) has no stationary
// point, but (2, 0) is where the function starts and it is the lowest value
// f ever takes — a student who answers "no extrema" has missed the minimum.
// These are NOT local extrema in the strict two-sided sense (there is no
// left neighbourhood), so they are reported separately and named for what
// they are: minimum/maximum at the domain endpoint. When f is monotonic on
// its domain the endpoint value is also the absolute extremum, and we say so;
// otherwise we don't claim it.
export function findEndpointExtrema(func, variable, domain, extrema, monotonicOnDomain) {
  const found = [];
  for (const r of domain) {
    // Each finite edge of an undefined region is a domain endpoint. The
    // function must be defined AT the edge (sqrt(x-2) at 2 — yes; ln(x) at 0
    // — no, that's an asymptote, not an endpoint value).
    for (const [edge, side] of [[r.to, +1], [r.from, -1]]) {
      if (!Number.isFinite(edge)) continue;
      const y = evalAt(func, variable, edge);
      if (!Number.isFinite(y)) continue;
      // Compare with the interior: side = +1 means the domain continues to
      // the right of `edge` (undefined region ends here), -1 to the left.
      const inner = evalAt(func, variable, edge + side * 1e-3);
      const inner2 = evalAt(func, variable, edge + side * 1e-2);
      if (!Number.isFinite(inner) || !Number.isFinite(inner2)) continue;
      let kind = null;
      if (inner > y && inner2 > y) kind = 'min';
      if (inner < y && inner2 < y) kind = 'max';
      if (!kind) continue;
      if (extrema.some((e) => Math.abs(e.x - edge) < 1e-6)) continue;
      const absolute =
        (kind === 'min' && monotonicOnDomain === 'increasing' && side === +1) ||
        (kind === 'max' && monotonicOnDomain === 'decreasing' && side === +1) ||
        (kind === 'min' && monotonicOnDomain === 'decreasing' && side === -1) ||
        (kind === 'max' && monotonicOnDomain === 'increasing' && side === -1);
      found.push({ x: snap(edge), y: snap(y), kind, absolute, side });
    }
  }
  return found;
}

// A removable discontinuity: an isolated undefined point where f does not
// blow up — both one-sided limits exist and agree. (x^2-1)/(x-1) at x = 1 is
// the classic: the factor (x-1) cancels, so f is x+1 everywhere except that
// one point, and the graph has a hole at (1, 2). Reported with the
// simplified form when Algebrite can produce one, so the "why" is visible.
export function findHoles(func, variable, domain, verticalAsymptotes, Algebrite) {
  const holes = [];
  for (const r of domain) {
    if (!Number.isFinite(r.from) || !Number.isFinite(r.to)) continue;
    if (Math.abs(r.to - r.from) > 1e-6) continue; // not an isolated point
    const c = r.from;
    if (verticalAsymptotes.some((a) => Math.abs(a - c) < 1e-6)) continue;
    const l = evalAt(func, variable, c - 1e-6);
    const rr = evalAt(func, variable, c + 1e-6);
    if (!Number.isFinite(l) || !Number.isFinite(rr)) continue;
    if (Math.abs(l - rr) > 1e-4 * (1 + Math.abs(l))) continue; // a jump, not a hole
    const y = snap((l + rr) / 2);
    let simplified = null;
    if (Algebrite) {
      try {
        const s = String(Algebrite.run(`simplify(${rewriteReciprocalTrig(func)})`)).trim();
        if (s && !/nil|stop|error/i.test(s) && s.replace(/\s/g, '') !== func.replace(/\s/g, '')) simplified = s;
      } catch { /* optional */ }
    }
    holes.push({ x: snap(c), y, simplified });
  }
  return holes;
}

// Undefined intervals across the analysis window, edges bisection-refined,
// each edge flagged closed (undefined at the edge itself: ln(x) at 0) or open
// (defined at the edge: sqrt(x-2) at 2). Shared with the algebra solver.
export function findDomain(func, variable) {
  return findUndefinedRegions(func, variable, { min: WINDOW.min, max: WINDOW.max, step: FINE_STEP });
}

export function findVerticalAsymptotes(func, variable, grid, Algebrite) {
  const candidates = new Set();

  // Symbolic: roots of the denominator, when there is one.
  if (Algebrite) {
    try {
      const den = String(Algebrite.run(`denominator(${rewriteReciprocalTrig(func)})`)).trim();
      if (den && den !== '1' && !/nil|stop/i.test(den)) {
        for (const r of parseRoots(Algebrite.roots(den, variable).toString())) {
          candidates.add(r.numeric);
        }
      }
    } catch { /* not rational — fall through to numeric */ }
  }

  // Numeric: domain-restriction boundaries and isolated undefined points.
  for (const r of findDomain(func, variable)) {
    if (Number.isFinite(r.from)) candidates.add(r.from);
    if (Number.isFinite(r.to)) candidates.add(r.to);
  }

  // Poles the grid steps over. tan(x) blows up at π/2, which no 0.05 grid
  // point hits — every sample is finite, so there is no undefined region and
  // no denominator root to find. The signature is a sign change between
  // adjacent samples with |f| large on BOTH sides; the pole is where 1/f
  // crosses zero, so bisect on 1/f.
  for (let i = 1; i < grid.length; i += 1) {
    const a = grid[i - 1];
    const b = grid[i];
    if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) continue;
    if (Math.sign(a.y) !== Math.sign(b.y) && Math.min(Math.abs(a.y), Math.abs(b.y)) > 5) {
      const pole = bisect((x) => 1 / evalAt(func, variable, x), a.x, b.x);
      if (pole !== null) candidates.add(pole);
    }
  }

  // Verify divergence: |f| must keep GROWING as we approach the candidate.
  // A plain magnitude threshold misses slow divergence — log(x^2) at 0 only
  // reaches |f| ≈ 28 at a 1e-6 offset — so require monotone growth across
  // shrinking offsets (or an outright blow-up past BIG).
  const divergesOnSide = (c, sign) => {
    const mags = [1e-2, 1e-4, 1e-6, 1e-8].map((off) => Math.abs(evalAt(func, variable, c + sign * off)));
    if (mags.some((m) => !Number.isFinite(m))) return false;
    if (mags[3] > BIG) return true;
    const growing = mags[1] > mags[0] + 1 && mags[2] > mags[1] + 1 && mags[3] > mags[2] + 1;
    return growing && mags[3] > 10;
  };

  const asymptotes = [];
  for (const c of candidates) {
    if (c < WINDOW.min || c > WINDOW.max) continue;
    if (!(divergesOnSide(c, -1) || divergesOnSide(c, +1))) continue;
    // The same pole can arrive from two sources (denominator root 1/3 and
    // the numeric 1/f bisection at 0.33333…): dedupe by tolerance, keeping
    // the first (symbolic candidates are added first, and are exact).
    if (asymptotes.some((a) => Math.abs(a - c) < 1e-6)) continue;
    asymptotes.push(snap(c));
  }
  return asymptotes.sort((a, b) => a - b);
}

export function findXIntercepts(func, variable, grid, Algebrite, isPeriodic) {
  const found = [];
  const push = (numeric, display) => {
    // Verify: it must actually be a root, not a small-value sample.
    const y = evalAt(func, variable, numeric);
    if (!Number.isFinite(y) || Math.abs(y) > 1e-6) return;
    // A root has the curve rising away from the axis on at least one side.
    // An isolated defined point with a tiny value (x^x at x = -10 is 1e-10,
    // undefined on both sides) is not an intercept.
    const l = evalAt(func, variable, numeric - 1e-3);
    const r = evalAt(func, variable, numeric + 1e-3);
    if (!(Number.isFinite(l) && Math.abs(l) > Math.abs(y)) && !(Number.isFinite(r) && Math.abs(r) > Math.abs(y))) return;
    if (found.some((r2) => Math.abs(r2.numeric - numeric) < 1e-6)) return;
    found.push({ numeric: snap(numeric), display: display ?? formatNumber(snap(numeric)) });
  };

  // Symbolic roots first (exact displays like 1/3^(1/2)).
  if (Algebrite) {
    try {
      for (const r of parseRoots(Algebrite.roots(rewriteReciprocalTrig(func), variable).toString())) {
        if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) push(r.numeric, r.display);
      }
    } catch { /* not a polynomial — numeric below */ }
  }

  // Numeric: sign changes on the fine grid, bisection-refined. Touch-roots
  // (even multiplicity, like abs(x) at 0) never change sign, so near-zero
  // samples are considered too — but only when they are a local minimum of
  // |f|. A decaying tail (e^(-x²) is 4e-44 at x = 10) is tiny at every point
  // and would otherwise be reported as an intercept at every grid step; it is
  // never a local minimum of |f|, so this test rejects it. push() still
  // verifies |f(root)| ≈ 0 either way.
  for (let i = 1; i < grid.length; i += 1) {
    const a = grid[i - 1];
    const b = grid[i];
    if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) continue;
    if (Math.abs(a.y) < 1e-9 && i >= 2) {
      const before = grid[i - 2];
      // Strictly below both neighbours: an underflowed-to-zero tail is 0 on
      // every side and must not count.
      if (Number.isFinite(before.y) && Math.abs(before.y) > Math.abs(a.y) && Math.abs(b.y) > Math.abs(a.y)) {
        push(a.x);
      }
    }
    // A sample that is exactly 0 is the root itself (handled above / by
    // push's own verification); treating it as a sign change against both
    // neighbours would bisect twice into the flat region around it and report
    // x³'s single root as -0.0001, 0, 0.0001.
    if (a.y === 0 || b.y === 0) continue;
    if (Math.sign(a.y) !== Math.sign(b.y)) {
      const root = bisect((x) => evalAt(func, variable, x), a.x, b.x);
      if (root !== null) push(root);
    }
  }

  // Domain-boundary roots: a function can start exactly ON the axis, like
  // sqrt(x-3) at (3, 0) — invisible to sign changes (no left neighbor) and to
  // polynomial root-finding. Check each finite domain edge directly.
  for (const r of findDomain(func, variable)) {
    for (const edge of [r.from, r.to]) {
      if (Number.isFinite(edge)) push(edge);
    }
  }

  // Keep the ones nearest the origin (listed left to right): the first six
  // from x = −10 of sin(x²)·eˣ are a cluster of near-identical decimals.
  const keep = isPeriodic ? 8 : 6;
  found.sort((p, q) => Math.abs(p.numeric) - Math.abs(q.numeric) || p.numeric - q.numeric);
  const list = found.slice(0, keep).sort((p, q) => p.numeric - q.numeric);
  return { list, truncated: found.length > keep };
}

// How an extremum arises. The step text used to say "(from f′(x) = 0)" for
// every extremum, which is false at a corner: abs(x) has its minimum at 0
// where f′ does not exist. So each extremum records its origin:
//   'stationary' — f′(x) = 0 there (the textbook critical point);
//   'cusp'       — f is not differentiable there (a corner or cusp), yet it
//                  is still an extremum; also a critical point, but not from
//                  f′ = 0.
// Domain-endpoint extrema are found separately (findEndpointExtrema) and
// carry origin 'endpoint'.
function extremumOrigin(func, variable, x) {
  const slopes = (h) => {
    const y = evalAt(func, variable, x);
    return [(y - evalAt(func, variable, x - h)) / h, (evalAt(func, variable, x + h) - y) / h];
  };
  const [l1, r1] = slopes(1e-4);
  const [l2, r2] = slopes(1e-6);
  if (![l1, r1, l2, r2].every(Number.isFinite)) return 'stationary';
  // Both one-sided slopes vanish: a genuine stationary point.
  if (Math.abs(l2) < 1e-3 && Math.abs(r2) < 1e-3) return 'stationary';
  // Slopes that disagree at one h but SHRINK as h → 0 are converging to a
  // common 0 — x^(4/3) at 0 has f′ = (4/3)x^(1/3), zero but slowly. A corner
  // (|x|: ±1 forever) or cusp (x^(2/3): slopes grow) does not shrink.
  const mag1 = Math.max(Math.abs(l1), Math.abs(r1));
  const mag2 = Math.max(Math.abs(l2), Math.abs(r2));
  if (mag2 < mag1 * 0.5) return 'stationary';
  // One-sided slopes disagree by a clear margin: a corner/cusp.
  if (Math.abs(l2 - r2) > 1e-2) return 'cusp';
  return 'stationary';
}

// f′ and its zeros are kept for the steps (1.56.0): the analysis used to say
// "Local maximum at (−1, 2) (from f′(x) = 0)" without ever showing f′(x) =
// 3x² − 3 or solving it. `stationary` holds the zeros of f′ Algebrite found
// (exact); an extremum from the numeric scan carries no exact x unless it
// snapped to one. Each extremum's value is shown exactly where Algebrite can
// (1/e at x = 1 for x·e^(−x)), else to the decimal setting.
export function findExtrema(func, variable, grid, Algebrite, isPeriodic) {
  const extrema = [];
  const classify = (x, root) => {
    const y = evalAt(func, variable, x);
    if (!Number.isFinite(y)) return;
    const l = evalAt(func, variable, x - 1e-4);
    const r = evalAt(func, variable, x + 1e-4);
    if (!Number.isFinite(l) || !Number.isFinite(r)) return;
    let kind = null;
    if (y >= l && y >= r && (y > l || y > r)) kind = 'max';
    if (y <= l && y <= r && (y < l || y < r)) kind = 'min';
    if (!kind) return; // saddle / not an extremum — do not report
    if (extrema.some((e) => Math.abs(e.x - x) < 1e-5)) return;
    const sx = snap(x);
    // An exact x: Algebrite's root, a scan result that snapped to a quarter
    // (1, −2, 1/2), or a multiple of π on a periodic curve (π/2, not
    // 1.5708). Its exact value follows by substitution.
    // (The scan's bisection lands within 1e-6 of π/2, not within piForm's 1e-9.)
    const nearPi = Math.round((sx * 12) / Math.PI) * (Math.PI / 12);
    const inPi = !root && isPeriodic && Math.abs(sx - nearPi) < 1e-6 ? piForm(nearPi) : null;
    const piRaw = inPi && /π/.test(inPi) ? inPi.replace(/(\d)π/g, '$1*pi').replace(/π/g, 'pi') : null;
    const raw = root?.raw ?? piRaw ?? (Number.isInteger(sx * 4) ? String(sx) : null);
    const exact = raw ? exactValueAt(Algebrite, func, variable, raw, y) : null;
    extrema.push({
      x: sx,
      y: snap(y),
      kind,
      origin: extremumOrigin(func, variable, x),
      xText: root?.display ?? (piRaw ? inPi : formatNumber(sx)),
      yText: exact ?? formatNumber(snap(y)),
    });
  };

  let derivativeStr = null;
  const stationary = [];
  if (Algebrite) {
    try {
      derivativeStr = Algebrite.derivative(rewriteReciprocalTrig(func), variable).toString();
    } catch { derivativeStr = null; }
    try {
      // Symbolic critical points when f' is polynomial-rootable.
      for (const r of parseRoots(Algebrite.roots(derivativeStr, variable).toString())) {
        if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) {
          stationary.push(r);
          classify(r.numeric, r);
        }
      }
    } catch { /* fall through to numeric */ }
  }

  // Numeric: slope sign changes from finite differences on the fine grid.
  if (extrema.length === 0) {
    for (let i = 2; i < grid.length; i += 1) {
      const s1 = grid[i - 1].y - grid[i - 2].y;
      const s2 = grid[i].y - grid[i - 1].y;
      if (!Number.isFinite(s1) || !Number.isFinite(s2)) continue;
      if (Math.sign(s1) !== Math.sign(s2) && s1 !== 0) {
        // Refine the critical point via slope bisection.
        const slope = (x) => (evalAt(func, variable, x + 1e-6) - evalAt(func, variable, x - 1e-6));
        const cp = bisect(slope, grid[i - 2].x, grid[i].x);
        if (cp !== null) classify(cp);
      }
    }
  }

  // Monotonicity: only claimed when there are no extrema and the slope keeps
  // one sign across the defined samples.
  let monotonic = null;
  if (extrema.length === 0) {
    let pos = 0;
    let neg = 0;
    for (let i = 1; i < grid.length; i += 1) {
      const d = grid[i].y - grid[i - 1].y;
      if (!Number.isFinite(d)) continue;
      if (d > 1e-12) pos += 1;
      if (d < -1e-12) neg += 1;
    }
    if (pos > 0 && neg === 0) monotonic = 'increasing';
    if (neg > 0 && pos === 0) monotonic = 'decreasing';
  }

  const keep = isPeriodic ? 6 : 4;
  extrema.sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
  // f′ as the page shows it: ln, e^x and √ for Algebrite's log, exp and
  // ^(1/2), and (x − 2)^2 without its extra brackets.
  const derivative = derivativeStr ? exactForm(derivativeStr).replace(/\(\(([^()]+)\)\^(\d+|\([^()]+\))\)/g, '($1)^$2') : null;
  // "f′ is never 0" is a claim about every x: proved from the structure of
  // f′ (a fraction with a nonzero numerator, a positive base to a power) or
  // not made at all. Also the lone extremum message for 1/(x − 2), which
  // used to be "No local extrema found in the analyzed window".
  let derivativeNeverZero = null;
  if (derivativeStr && extrema.length === 0 && stationary.length === 0) {
    try { derivativeNeverZero = neverZeroSide(derivativeStr.replace(/(?<![a-z])log\(/g, 'log('), '0', variable); } catch { derivativeNeverZero = null; }
  }
  return { extrema: extrema.slice(0, keep).sort((a, b) => a.x - b.x), monotonic, derivative, stationary: stationary.slice(0, keep), derivativeNeverZero };
}

// f(x) at an exact x, by substitution, shown as a textbook writes it (1/e,
// √2, π/6) — only when it agrees with the numeric value.
export function exactValueAt(Algebrite, func, variable, raw, numericY) {
  if (!Algebrite) return null;
  try {
    const value = Algebrite.run(`simplify(subst(${raw}, ${variable}, ${rewriteReciprocalTrig(func)}))`).toString();
    if (!value || /nil|Stop|\bi\b|\(-1\)\^/.test(value)) return null;
    const check = math.evaluate(value.replace(/(?<![a-z])log\(/g, 'log(').replace(/\bexp\(/g, 'exp('));
    if (typeof check !== 'number' || !Number.isFinite(check) || Math.abs(check - numericY) > 1e-6 * (1 + Math.abs(numericY))) return null;
    const shown = exactForm(value);
    // A plain decimal is no better than the formatted number.
    return /^-?\d+(?:\.\d+)?$/.test(shown) ? null : shown;
  } catch {
    return null;
  }
}

export function findInflections(func, variable, Algebrite) {
  if (!Algebrite) return [];
  try {
    const f1 = Algebrite.derivative(rewriteReciprocalTrig(func), variable).toString();
    const f2 = Algebrite.derivative(f1, variable).toString();
    const out = [];
    for (const r of parseRoots(Algebrite.roots(f2, variable).toString())) {
      if (r.numeric < WINDOW.min || r.numeric > WINDOW.max) continue;
      // Verify concavity actually changes sign.
      const l = evalAt(f2, variable, r.numeric - 1e-3);
      const rt = evalAt(f2, variable, r.numeric + 1e-3);
      if (Number.isFinite(l) && Number.isFinite(rt) && Math.sign(l) !== Math.sign(rt)) {
        out.push({ x: snap(r.numeric), display: r.display });
      }
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
}

export function findHorizontalAsymptote(func, variable) {
  const settle = (sign) => {
    const a = evalAt(func, variable, sign * 1e6);
    const b = evalAt(func, variable, sign * 1e8);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6 * (1 + Math.abs(b))) {
      return snap(b);
    }
    return null;
  };
  const right = settle(1);
  const left = settle(-1);
  if (right !== null && left !== null && Math.abs(right - left) < 1e-9) return right;
  if (right !== null || left !== null) return { left, right };
  return null;
}
