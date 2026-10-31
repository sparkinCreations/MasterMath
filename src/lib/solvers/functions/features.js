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
  mark,
} from '../solverUtils.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';

export const WINDOW = { min: -10, max: 10 };
export const FINE_STEP = 0.05;
const BIG = 1e6;

// A number as a fraction when it is one (1/2, -5/4), else formatted: a
// quadratic's vertex and range were 0.5 and -1.25 (1.64.0).
export function exactNumber(x) {
  for (let q = 1; q <= 100; q += 1) {
    const p = Math.round(x * q);
    if (Math.abs(x - p / q) < 1e-12 * (1 + Math.abs(x))) return q === 1 ? String(p) : `${p}/${q}`;
  }
  return formatNumber(x);
}

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

// A root as a textbook writes it: √6/2, not 1/2*√2*√3; 1/√3, not −1/(√3);
// 1/∜5 for 5^(−1/4).
const ROOT_SIGN = { 3: '∛', 4: '∜', 5: '⁵√' };
export function tidyRoot(text) {
  let t = String(text);
  for (let i = 0; i < 3; i += 1) t = t.replace(/√(\d+)\*√(\d+)/g, (_, a, b) => `√${Number(a) * Number(b)}`);
  return t
    .replace(/(?<![\w.)])1\/(\d+)\*√(\d+)/g, '√$2/$1')
    .replace(/(?<![\w.)])(\d+)\/(\d+)\*√(\d+)/g, '$1√$3/$2')
    .replace(/\/\((√\d+)\)/g, '/$1')
    .replace(/(?<![\w.])(\d+)\^\(-1\/([345])\)/g, (_, b, n) => `1/${ROOT_SIGN[n]}${b}`)
    .replace(/(?<![\w.])(\d+)\^\(1\/([45])\)/g, (_, b, n) => `${ROOT_SIGN[n]}${b}`)
    .replace(/(?<![\w.])(\d+)\^\(2\/3\)/g, (_, b) => `∛${Number(b) ** 2}`)
    .replace(/(\d)\*([√∛∜⁵])/g, '$1$2')
    .replace(/\/\(([√∛∜]\d+)\)/g, '/$1');
}

// Algebrite reads ln as an unknown function; log is its natural logarithm.
export const toAlgebrite = (s) => rewriteReciprocalTrig(String(s)).replace(/(?<![a-z])ln\(/g, 'log(');

// The insides of every abs(…) in f, where its corners can be.
function absArguments(func) {
  try {
    return math.parse(String(func)).filter((n) => n.type === 'FunctionNode' && n.fn?.name === 'abs').map((n) => n.args[0].toString());
  } catch {
    return [];
  }
}

// The exact number a numeric root x of g stands for, or null: a rational, a
// multiple of π, (a ± √m)/q, ln of a rational, ±(p/q)^(1/n). A candidate is
// accepted only when Algebrite substitutes it into g and gets exactly 0, so a
// near miss is never printed as exact (e^x − 2 = 0 at "x = 0.6931" is ln 2;
// 1.64.0).
export function recognizeExact(Algebrite, g, variable, x) {
  if (!Algebrite || !g || !Number.isFinite(x)) return null;
  const close = (a, b) => Math.abs(a - b) < 1e-7 * (1 + Math.abs(b));
  const cands = [];
  const ratio = (value, max = 12) => {
    for (let q = 1; q <= max; q += 1) {
      const p = Math.round(value * q);
      if (close(value, p / q)) return { p, q };
    }
    return null;
  };
  const r = ratio(x);
  if (r) cands.push(r.q === 1 ? String(r.p) : `${r.p}/${r.q}`);
  const pi = ratio(x / Math.PI);
  if (pi && pi.p !== 0) cands.push(`${pi.p}*pi/${pi.q}`);
  for (let q = 1; q <= 4; q += 1) {
    for (let a = -12; a <= 12; a += 1) {
      const d = x * q - a;
      const m = Math.round(d * d);
      if (m > 1 && m <= 300 && !Number.isInteger(Math.sqrt(m)) && close(Math.abs(d), Math.sqrt(m))) {
        // Shown as written: 1 + √6/2, (1 + √5)/2, 3 − √2.
        const sign = d < 0 ? '−' : '+';
        const surd = q === 1 ? `√${m}` : `√${m}/${q}`;
        const display = a === 0 ? `${d < 0 ? '-' : ''}${surd}`
          : q === 1 || a % q === 0 ? `${a / q} ${sign} ${surd}`
            : `(${a} ${sign} √${m})/${q}`;
        cands.push({ cand: `(${a}${d < 0 ? '-' : '+'}${m}^(1/2))/${q}`, display: display.replace(/ − /g, ' - ') });
      }
    }
  }
  if (x > 0) {
    const lg = ratio(Math.log(x));
    if (lg && lg.p !== 0) cands.push(`exp(${lg.p}/${lg.q})`);
  }
  const ex = ratio(Math.exp(x));
  if (ex && ex.p > 0 && ex.p !== ex.q) cands.push(`log(${ex.p}/${ex.q})`);
  for (const n of [3, 4, 5]) {
    const pw = ratio(Math.abs(x) ** n);
    if (pw && pw.p > 0) cands.push(`${x < 0 ? '-' : ''}(${pw.p}/${pw.q})^(1/${n})`);
  }
  const target = toAlgebrite(g);
  // A cheap numeric screen first: the candidate's value must match x and
  // make g vanish to near double precision before Algebrite is asked (each
  // exact substitution into a transcendental g can take a second).
  const screen = (cand) => {
    try {
      const value = Number(math.evaluate(cand.replace(/(?<![a-z])log\(/g, 'log(')));
      if (!Number.isFinite(value) || !close(value, x)) return false;
      const y = evalAt(String(g).replace(/(?<![a-z])log\(/g, 'log('), variable, value);
      // The size of g nearby, from whichever side it is defined on (√(x − 2)
      // is undefined left of its root).
      const scale = [1e-3, -1e-3].map((h) => Math.abs(evalAt(String(g).replace(/(?<![a-z])log\(/g, 'log('), variable, value + h))).filter(Number.isFinite).reduce((a, b) => a + b, 0);
      return Number.isFinite(y) && Math.abs(y) < 1e-9 * Math.max(1, scale);
    } catch {
      return false;
    }
  };
  for (const entry of cands.map((c) => (typeof c === 'string' ? { cand: c } : c)).filter((c) => screen(c.cand)).slice(0, 4)) {
    try {
      if (String(Algebrite.run(`simplify(subst(${entry.cand}, ${variable}, ${target}))`)).trim() !== '0') continue;
      const raw = String(Algebrite.run(`simplify(${entry.cand})`)).trim();
      const check = math.evaluate(raw.replace(/(?<![a-z])log\(/g, 'log(').replace(/\bpi\b/g, 'pi'));
      if (typeof check !== 'number' || !close(check, x)) continue;
      return { raw: entry.cand, display: entry.display ?? tidyRoot(exactForm(raw)) };
    } catch { /* next candidate */ }
  }
  return null;
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
    return { raw: p.trim(), display: tidyRoot(beautify(p.trim()).replace(/(\d+)\^\(1\/2\)/g, '√$1').replace(/(\d+)\^\(1\/3\)/g, '∛$1')), numeric };
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
    // Its height exactly, from the simplified form: (−1, −3/2), not −1.5.
    let yText = null;
    if (Algebrite && simplified) {
      try {
        const at = String(Algebrite.run(`simplify(subst(${snap(c)}, ${variable}, ${simplified}))`)).trim();
        if (/^-?\d+(?:\/\d+)?$/.test(at) && Math.abs(Number(math.evaluate(at)) - y) < 1e-6) yText = at;
      } catch { /* the decimal stays */ }
    }
    // P/Q with P(c) = Q(c) = 0: the height is P′(c)/Q′(c) when Q′(c) ≠ 0.
    if (Algebrite && !yText) {
      try {
        let top = math.parse(String(func));
        while (top.type === 'ParenthesisNode') top = top.content;
        if (top.type === 'OperatorNode' && top.op === '/') {
          const [p, q] = top.args.map((n) => toAlgebrite(n.toString()));
          const at = String(Algebrite.run(`simplify(subst(${snap(c)}, ${variable}, d(${p}, ${variable})/d(${q}, ${variable})))`)).trim();
          if (/^-?\d+(?:\/\d+)?$/.test(at) && Math.abs(Number(math.evaluate(at)) - y) < 1e-6) yText = at;
        }
      } catch { /* the decimal stays */ }
    }
    holes.push({ x: snap(c), y, simplified, yText });
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
    if (display) { found.push({ numeric: snap(numeric), display }); return; }
    // A root located numerically is exact only when proved so; else ≈.
    const exact = recognizeExact(Algebrite, func, variable, numeric);
    found.push(exact ? { numeric: snap(numeric), display: exact.display } : { numeric: snap(numeric), display: formatNumber(snap(numeric)), approx: true });
  };

  // A polynomial: every real root, from the exact root finder (Sturm
  // counting), so a repeated root is never missed: (x² − 3)² touches at ±√3
  // and was given "no x-intercepts", beside minima at (±√3, 0) (1.64.0).
  const poly = readPolynomial(String(func), variable);
  if (poly && !poly.tooHigh && poly.degree >= 1) {
    for (const r of allRoots(poly).real) {
      if (r.value < WINDOW.min || r.value > WINDOW.max) continue;
      const display = r.exact ? (r.exact.d === 1n ? String(r.exact.m) : `${r.exact.m}/${r.exact.d}`) : recognizeExact(Algebrite, func, variable, r.value)?.display;
      if (display) push(r.value, display);
      else push(r.value);
    }
  }

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

  // The roots of an absolute value's inside: |x² − 2| touches the axis at
  // ±√2 without changing sign, between grid points, and was given "no
  // x-intercepts" (1.64.0).
  if (Algebrite) {
    for (const g of absArguments(func)) {
      try {
        for (const r of parseRoots(Algebrite.roots(toAlgebrite(g), variable).toString())) {
          if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) push(r.numeric, r.display);
        }
      } catch { /* not a polynomial inside */ }
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
    // Otherwise a numeric critical point is exact only when proved a root of
    // f′ (x·ln(x) has its minimum at 1/e; it was 0.3679).
    // A corner or cusp is a root of an absolute value's inside, or of 1/f′
    // (x^(2/3): 1/f′ = (3/2)x^(1/3) is 0 at 0).
    const origin = extremumOrigin(func, variable, x);
    const recognised = root || piRaw || !derivativeStr ? null : origin === 'cusp'
      ? [...absArguments(func), `1/(${derivativeStr})`].reduce((hit, g) => hit ?? recognizeExact(Algebrite, g, variable, x), null)
      : recognizeExact(Algebrite, derivativeStr, variable, x);
    const raw = root?.raw ?? piRaw ?? recognised?.raw ?? null;
    const exact = raw ? exactValueAt(Algebrite, func, variable, raw, y) : null;
    const exactY = exact ?? (raw && Number.isInteger(snap(y) * 4) && Math.abs(snap(y) - y) < 1e-12 ? formatNumber(snap(y)) : null);
    extrema.push({
      x: sx,
      y: snap(y),
      kind,
      origin,
      xText: root?.display ?? (piRaw ? inPi : recognised?.display ?? formatNumber(sx)),
      yText: exactY ?? formatNumber(snap(y)),
      approx: !raw,
    });
  };

  let derivativeStr = null;
  const stationary = [];
  if (Algebrite) {
    try {
      derivativeStr = Algebrite.derivative(toAlgebrite(func), variable).toString();
    } catch { derivativeStr = null; }
    try {
      // Symbolic critical points when f' is polynomial-rootable.
      // A rational f′ has the roots of its numerator: (x² + 1)/(x − 1) has
      // f′ = (x² − 2x − 1)/(x − 1)², so x = 1 ± √2 exactly (it was ±0.4142).
      const numerator = String(Algebrite.run(`numerator(${derivativeStr})`)).trim();
      for (const r of parseRoots(Algebrite.roots(numerator || derivativeStr, variable).toString())) {
        // A root of the numerator is a zero of f′ only where f′ is defined:
        // (x² − 1)/(x − 1) has f′ = (x − 1)²/(x − 1)², and "1 = 0 at x = 1".
        const slope = evalAt(derivativeStr, variable, r.numeric);
        if (!Number.isFinite(slope) || Math.abs(slope) > 1e-6) continue;
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
  // Shown simplified: (x² − 2x − 1)/(x − 1)², not three fractions.
  let derivativeShown = derivativeStr;
  try {
    const simpler = derivativeStr ? String(Algebrite.run(`simplify(${derivativeStr})`)).trim() : null;
    if (simpler && !/nil|Stop/.test(simpler) && simpler.length < derivativeStr.length) derivativeShown = simpler;
  } catch { /* keep it as differentiated */ }
  const derivative = derivativeShown ? exactForm(derivativeShown).replace(/\(\(([^()]+)\)\^(\d+|\([^()]+\))\)/g, '($1)^$2') : null;
  // "f′ is never 0" is a claim about every x: proved from the structure of
  // f′ (a fraction with a nonzero numerator, a positive base to a power) or
  // not made at all. Also the lone extremum message for 1/(x − 2), which
  // used to be "No local extrema found in the analyzed window".
  let derivativeNeverZero = null;
  if (derivativeStr && extrema.length === 0 && stationary.length === 0) {
    // The simplified f′ ((x² − 1)/(x − 1) has f′ = 1, a constant).
    const constant = (() => { try { const c = Number(math.evaluate(derivativeShown)); return Number.isFinite(c) && c !== 0 ? c : null; } catch { return null; } })();
    if (constant !== null) derivativeNeverZero = { why: `it is the constant ${formatNumber(constant)}` };
    else
    try { derivativeNeverZero = neverZeroSide(derivativeShown.replace(/(?<![a-z])log\(/g, 'log('), '0', variable) ?? neverZeroSide(derivativeStr.replace(/(?<![a-z])log\(/g, 'log('), '0', variable); } catch { derivativeNeverZero = null; }
  }
  // f′ factored, for the line that says why a zero of f′ is no extremum:
  // 3(x − 1)^2, not 3x^2 − 6x + 3.
  let derivativeFactored = null;
  try {
    if (derivativeShown && readPolynomial(derivativeShown, variable)) {
      const fac = String(Algebrite.run(`factor(${derivativeShown})`)).trim();
      if (fac && !/nil|Stop/.test(fac) && /\(/.test(fac)) derivativeFactored = exactForm(fac).replace(/\*/g, '');
    }
  } catch { derivativeFactored = null; }
  return { extrema: extrema.slice(0, keep).sort((a, b) => a.x - b.x), monotonic, derivative, derivativeFactored, stationary: stationary.slice(0, keep), derivativeNeverZero };
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
    const shown = tidyRoot(exactForm(value));
    // A plain decimal is no better than the formatted number.
    return /^-?\d+(?:\.\d+)?$/.test(shown) ? null : shown;
  } catch {
    return null;
  }
}

export function findInflections(func, variable, Algebrite) {
  if (!Algebrite) return [];
  try {
    const f1 = Algebrite.derivative(toAlgebrite(func), variable).toString();
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

// --- whole-line patterns and proofs (1.64.0) -----------------------------------

// A rational multiple of π as text (π/18, -2π/3), or null.
function piText(x) {
  if (Math.abs(x) < 1e-12) return '0';
  for (let q = 1; q <= 72; q += 1) {
    const p = Math.round((x / Math.PI) * q);
    if (p !== 0 && Math.abs(x - (p * Math.PI) / q) < 1e-10) {
      const g = (a, b) => (b ? g(b, a % b) : a);
      const r = g(Math.abs(p), q);
      const [pp, qq] = [p / r, q / r];
      return `${pp < 0 ? '-' : ''}${Math.abs(pp) === 1 ? '' : Math.abs(pp)}π${qq === 1 ? '' : `/${qq}`}`;
    }
  }
  return null;
}

// The step n·(step/k) of a family of solutions: "2πn", "nπ", "2nπ/3".
function stepOf(step, k) {
  const t = piText(step / k);
  if (!t) return `${formatNumber(step / k)}n`;
  const m = t.match(/^(\d*)π(?:\/(\d+))?$/);
  if (!m) return `${t}·n`;
  if (!m[2]) return m[1] ? `${m[1]}πn` : 'nπ';
  return `${m[1]}nπ/${m[2]}`;
}

// "x = π/4 + nπ": the family θ/k + n·(step/k). θ is a number, or a symbol
// ("±arccos(-1/3)") when it is not a rational multiple of π.
function family(theta, k, step = 2 * Math.PI) {
  const stepText = stepOf(step, k);
  if (typeof theta === 'string') return k === 1 ? `${theta} + ${stepText}` : `(${theta} + ${stepOf(step, 1)})/${formatNumber(k)}`;
  const base = piText(theta / k);
  if (base === null) return null;
  return base === '0' ? stepText : `${base} + ${stepText}`;
}

// A·sin(kx) + d or A·cos(kx) + d: every intercept and extremum as a pattern
// in n. 3cos(x) + 1 listed six window decimals as "the" x-intercepts, while
// its own tips called that a common mistake (1.64.0).
export function wavePattern(func, v) {
  const t = String(func).replace(/\s+/g, '');
  const m = t.match(/^(-?(?:\d+(?:\.\d+)?|\d+\/\d+)?\*?|-)?(sin|cos)\(([^()]+)\)([+-](?:\d+(?:\.\d+)?|\d+\/\d+))?$/);
  if (!m) return null;
  const typedCoef = m[1] === undefined || m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(math.evaluate(m[1].replace(/\*$/, '')));
  let coef = typedCoef;
  const d = m[4] ? Number(math.evaluate(m[4])) : 0;
  let k;
  const fn = m[2];
  try {
    const at = (x) => Number(math.evaluate(m[3], { [v]: x }));
    k = at(1);
    if (!(Number.isFinite(k) && k !== 0 && at(0) === 0 && Math.abs(at(2) - 2 * k) < 1e-12)) return null;
  } catch { return null; }
  // sin(−2x) = −sin(2x), cos(−2x) = cos(2x): worked with |k| (sin(−2x) fell
  // back to a window list; 1.64.0 review).
  if (k < 0) { k = -k; if (fn === 'sin') coef = -coef; }
  if (!Number.isFinite(coef) || coef === 0) return null;
  const c = -d / coef;
  const top = { sin: Math.PI / 2, cos: 0 }[fn];
  const bottom = { sin: -Math.PI / 2, cos: Math.PI }[fn];
  const [maxAt, minAt] = coef > 0 ? [top, bottom] : [bottom, top];
  const out = {
    fn, coef, k, d, typedCoef, arg: beautify(m[3]),
    period: piForm(2 * Math.PI / k) ?? formatNumber(2 * Math.PI / k),
    maxima: { x: family(maxAt, k), y: formatNumber(d + Math.abs(coef)) },
    minima: { x: family(minAt, k), y: formatNumber(d - Math.abs(coef)) },
  };
  const exactC = (() => { for (let q = 1; q <= 12; q += 1) { const p = Math.round(c * q); if (Math.abs(c - p / q) < 1e-12) return q === 1 ? String(p) : `${p}/${q}`; } return formatNumber(c); })();
  out.equation = `${fn}(${beautify(m[3])}) = ${exactC}`;
  if (Math.abs(c) > 1 + 1e-12) out.intercepts = { none: true };
  else if (Math.abs(c) < 1e-12) out.intercepts = { text: family(fn === 'sin' ? 0 : Math.PI / 2, k, Math.PI) };
  else if (Math.abs(Math.abs(c) - 1) < 1e-12) out.intercepts = { text: family(c > 0 ? top : bottom, k), touches: true };
  else {
    const inv = fn === 'sin' ? Math.asin(c) : Math.acos(c);
    const named = piText(inv);
    if (fn === 'cos') {
      out.intercepts = named
        ? { text: `±${family(inv, k)}` }
        : { text: family(`±arccos(${exactC})`, k), approxText: `±${formatNumber(inv / k)} + ${stepOf(2 * Math.PI, k)}` };
    } else {
      const second = Math.PI - inv;
      out.intercepts = named
        ? { text: `${family(inv, k)} or ${family(second, k)}` }
        : { text: `${family(`arcsin(${exactC})`, k)} or ${family(`π − arcsin(${exactC})`, k)}` };
    }
  }
  if (!out.maxima.x || !out.minima.x || (out.intercepts.text === null)) return null;
  return out;
}

// A quotient of polynomials P/Q: no real root of Q proves the domain is all
// real numbers (x/(x² + 1) said "no restrictions found"), and deg P = deg Q
// + 1 gives a slant asymptote, the quotient of the division (1.64.0).
export function rationalFacts(func, variable, Algebrite) {
  if (!Algebrite || !/\//.test(String(func))) return null;
  try {
    const run = (cmd) => { const out = String(Algebrite.run(cmd)).trim(); return /nil|Stop|error/i.test(out) ? null : out; };
    const target = toAlgebrite(func);
    // Numerator and denominator as typed (Algebrite's numerator() cancels
    // first, and (x³ − x)/(x² − 1) came back as x over 1).
    let top;
    try { top = math.parse(String(func)); } catch { return null; }
    while (top.type === 'ParenthesisNode') top = top.content;
    if (!(top.type === 'OperatorNode' && top.op === '/')) return null;
    const bare = (n) => (n.type === 'ParenthesisNode' ? bare(n.content) : n);
    const num = bare(top.args[0]).toString();
    const den = bare(top.args[1]).toString();
    if (!num || !den || !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(den)) return null;
    const P = readPolynomial(num, variable);
    const Q = readPolynomial(den, variable);
    if (!P || !Q || P.tooHigh || Q.tooHigh || Q.degree < 1) return null;
    const facts = { num, den };
    // No real root of the original denominator: nothing is excluded.
    if (allRoots(Q).real.length === 0) facts.noRealPoles = true;
    // The slant asymptote of the reduced form: (x² − 1)/(x − 1) is the line
    // x + 1 with a hole, and has no asymptote at all.
    const reduced = run(`simplify(${target})`);
    // The cancelled form, when a factor cancels without leaving a hole
    // (x/x² = 1/x): said so in the worked line.
    if (reduced && beautify(reduced).replace(/\s+/g, '') !== beautify(func).replace(/\s+/g, '')) facts.reduced = beautify(reduced);
    const rNum = reduced && run(`numerator(${reduced})`);
    const rDen = reduced && run(`denominator(${reduced})`);
    const RP = rNum && readPolynomial(rNum, variable);
    const RQ = rDen && readPolynomial(rDen, variable);
    if (RP && RQ && !RP.tooHigh && !RQ.tooHigh && RQ.degree >= 1 && RP.degree === RQ.degree + 1) {
      const q = run(`quotient(${rNum}, ${rDen}, ${variable})`);
      const r = q && run(`simplify((${rNum}) - (${rDen})*(${q}))`);
      if (q && r && r !== '0') facts.slant = { line: beautify(q), remainder: beautify(r), den: beautify(rDen) };
    }
    return facts;
  } catch {
    return null;
  }
}

// The range of a polynomial of degree 3 or more, proved: an odd degree takes
// every value; an even degree reaches its least (or greatest) value at a
// critical point, and every real root of f′ is found exactly, or nothing is
// said (1.64.0).
export function polynomialRange(func, variable, Algebrite) {
  const P = readPolynomial(String(func), variable);
  if (!P || P.tooHigh || P.degree < 3) return null;
  if (P.degree % 2 === 1) {
    return { text: 'all real numbers', why: `an odd-degree polynomial goes to ${mark('−∞')} at one end and ${mark('+∞')} at the other, and it is continuous, so it takes every value in between.` };
  }
  const lead = Number(P.coefficients[P.degree]);
  const dP = { coefficients: P.coefficients.slice(1).map((c, i) => c.mul(i + 1)), degree: P.degree - 1 };
  const roots = allRoots(dP).real;
  if (!roots.length) return null;
  // An irrational critical point counts when its exact form is proved (x⁴ −
  // x² has its minima at ±√2/2, value −1/4).
  let derivative = null;
  try { derivative = Algebrite ? String(Algebrite.run(`d(${func}, ${variable})`)).trim() : null; } catch { derivative = null; }
  const raws = roots.map((r) => (r.exact ? `${r.exact.m}/${r.exact.d}` : recognizeExact(Algebrite, derivative, variable, r.value)?.raw ?? null));
  if (raws.some((raw) => raw === null)) return null;
  const values = roots.map((r, i) => {
    const raw = raws[i];
    const y = evalAt(func, variable, r.value);
    let plain = null;
    try {
      const at = String(Algebrite.run(`simplify(subst(${raw}, ${variable}, ${toAlgebrite(func)}))`)).trim();
      if (/^-?\d+(?:\/\d+)?$/.test(at)) plain = at;
    } catch { plain = null; }
    return { y, text: plain ?? exactValueAt(Algebrite, func, variable, raw, y) };
  });
  if (values.some((v) => v.text === null || !Number.isFinite(v.y))) return null;
  const best = values.reduce((a, b) => (lead > 0 ? (b.y < a.y ? b : a) : (b.y > a.y ? b : a)));
  return lead > 0
    ? { text: `y ≥ ${best.text}`, why: `an even-degree polynomial with a positive leading coefficient rises at both ends, so its least value is at a critical point; the real roots of ${mark('f′')} are all found, and the lowest value there is ${mark(best.text)}.` }
    : { text: `y ≤ ${best.text}`, why: `an even-degree polynomial with a negative leading coefficient falls at both ends, so its greatest value is at a critical point; the real roots of ${mark('f′')} are all found, and the highest value there is ${mark(best.text)}.` };
}

// |A·sin(kx)| and |A·cos(kx)|: the zeros of the inside, as a pattern, are the
// minima (corners on the axis); the maxima are where the inside is ±A, every
// half period. |sin(x)| listed only x = 0 as an intercept (1.64.0 review).
export function absWavePattern(func, v) {
  const t = String(func).replace(/\s+/g, '');
  const m = t.match(/^abs\((.+)\)$/);
  if (!m) return null;
  const w = wavePattern(m[1], v);
  if (!w || w.d !== 0) return null;
  const top = { sin: Math.PI / 2, cos: 0 }[w.fn];
  const zero = { sin: 0, cos: Math.PI / 2 }[w.fn];
  const A = formatNumber(Math.abs(w.coef));
  return {
    inside: beautify(m[1]),
    period: piText(Math.PI / w.k) ?? formatNumber(Math.PI / w.k),
    zeros: family(zero, w.k, Math.PI),
    maxima: { x: family(top, w.k, Math.PI), y: A },
    range: { text: `0 ≤ y ≤ ${A}`, why: `${mark(`|${beautify(m[1])}|`)} is ${mark('0')} where the inside is ${mark('0')} and at most ${mark(A)}, where ${w.fn} is ${mark('±1')}.` },
  };
}

// sin(kx)/D(x) with D a polynomial: the zeros are the sine's, except where D
// is 0 too. sin(x)/x listed six window values; its zeros are nπ, n ≠ 0.
export function quotientWaveZeros(func, v) {
  let top;
  try { top = math.parse(String(func)); } catch { return null; }
  while (top.type === 'ParenthesisNode') top = top.content;
  if (!(top.type === 'OperatorNode' && top.op === '/')) return null;
  const bare = (n) => (n.type === 'ParenthesisNode' ? bare(n.content) : n);
  const w = wavePattern(bare(top.args[0]).toString(), v);
  const D = readPolynomial(bare(top.args[1]).toString(), v);
  if (!w || w.d !== 0 || w.fn !== 'sin' || !D || D.tooHigh || D.degree < 1) return null;
  const roots = allRoots(D).real;
  // A root of D that is also a zero of sin(kx) (x = nπ/k) is excluded; the
  // others (x = ±1 for sin(2x)/(x² − 1)) are poles, not on the pattern.
  const n = roots.map((r) => (r.value * w.k) / Math.PI).filter((q) => Math.abs(q - Math.round(q)) < 1e-12);
  const excluded = [...new Set(n.map((q) => Math.round(q)))].sort((a, b) => a - b);
  const pattern = family(0, w.k, Math.PI);
  if (!excluded.length) return { text: pattern };
  const which = excluded.length === 1 && excluded[0] === 0 ? 'any nonzero integer' : `any integer except ${excluded.join(', ')}`;
  return { text: pattern, which };
}
