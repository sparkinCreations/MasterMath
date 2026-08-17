// Functions/Graphing solver — Wave 2 rebuild (July 2026).
//
// The previous implementation guessed features from 0.5-step samples: it fell
// back to the MIDPOINT sample as a "vertex" for monotonic functions and called
// any |y| < 0.1 sample an "intercept", inventing intercepts at the window edge
// for functions like 1/(x-2). It scored 2/10 in the July 2026 evaluation.
//
// This rebuild computes features honestly and NEVER fabricates one:
//   - extrema:     f'(x) = 0 solved symbolically (Algebrite), numeric
//                  sign-change fallback — both verified, no midpoint fallback
//   - intercepts:  roots of f (symbolic first, bisection-refined sign changes
//                  second), each VERIFIED with |f(root)| ≈ 0
//   - domain:      fine sampling → undefined regions reported, boundaries
//                  refined by bisection
//   - asymptotes:  denominator roots + divergence check; horizontal via
//                  large-|x| settling
//   - inflection:  f''(x) = 0 with concavity-change verification
//   - quadratics:  exact vertex, axis of symmetry, opening direction
// When a feature can't be established, the honest answer is to say nothing
// (or "none found in the analyzed window") — not to invent one.

import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
  rewriteReciprocalTrig,
  parsesAsMath,
  findUndefinedRegions,
  formatRestriction,
  realOddRoots,
} from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';

const WINDOW = { min: -10, max: 10 };
const FINE_STEP = 0.05;
const BIG = 1e6;

export async function solveFunctions(expression) {
  try {
    const variable = extractVariable(expression);

    let func = expression;
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
    }

    // Unreadable input must fail here, loudly — sampling would otherwise
    // "analyze" a function that doesn't exist and echo it back as a success.
    if (!parsesAsMath(func)) {
      return parseError({
        input: expression,
        hint: 'This could not be read as a function of one variable.',
        tips: ['Write the function in terms of x, e.g. x^2 - 4*x + 3 or 1/(x-2).'],
      });
    }

    let Algebrite = null;
    try {
      Algebrite = await loadAlgebrite();
    } catch {
      Algebrite = null;
    }

    const features = analyzeFunction(func, variable, Algebrite);
    const steps = buildSteps(func, variable, features);
    // Plot over a wider window than the ±10 analysis so panning has room;
    // the viewer starts at ±10 and clamps to this extent.
    const points = sampleFunction(func, variable, { min: -40, max: 40, step: 0.25 });

    return {
      steps,
      answer: summarizeAnalysis(func, variable, features),
      tips: buildTips(features),
      common_mistakes: [
        'Assuming every function has a vertex — only some (like parabolas) do.',
        'Reading a graph where the function is undefined (holes and asymptotes).',
        'Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).',
      ],
      graph: points.length > 0 ? {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: describeGraph(features, variable),
        // Computed features rendered as markers by GraphViewer.
        annotations: {
          extrema: [
            ...features.extrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
            // Endpoint extrema are drawn like the others; the step text carries
            // the distinction, the marker just shows where the value is.
            ...features.endpointExtrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind, endpoint: true, absolute: e.absolute })),
          ],
          intercepts: features.xIntercepts.list.map((r) => ({ x: r.numeric, y: 0 })),
          yIntercept: features.yIntercept,
          verticalAsymptotes: features.verticalAsymptotes,
          holes: features.holes.map((h) => ({ x: h.x, y: h.y })),
        },
      } : null,
      features,
    };
  } catch (error) {
    console.error('Functions solver error:', error);
    if (parsesAsMath(expression)) {
      return unsupported({
        input: expression,
        reason: 'Analyzing this function is beyond what this engine can do.',
      });
    }
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Write the function in terms of x, e.g. x^2 - 4*x + 3 or 1/(x-2).'],
    });
  }
}

// --- numeric primitives ------------------------------------------------------

function evalAt(func, variable, x) {
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
function snap(x) {
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
    return { display: beautify(p.trim()), numeric };
  }).filter((r) => Number.isFinite(r.numeric)); // real roots only
}

// --- feature extraction -------------------------------------------------------

function analyzeFunction(func, variable, Algebrite) {
  const isPeriodic = /\b(?:sin|cos|tan|sec|csc|cot)\s*\(/i.test(func);

  // Fine-grained sample of definedness across the window. Built by index with
  // rounding so grid points land EXACTLY on values like 0 — accumulating
  // x += 0.05 drifts (≈1e-13 off), which silently skips isolated undefined
  // points such as log(x^2) at x = 0.
  const grid = [];
  const steps = Math.round((WINDOW.max - WINDOW.min) / FINE_STEP);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round((WINDOW.min + i * FINE_STEP) * 100) / 100;
    grid.push({ x, y: evalAt(func, variable, x) });
  }

  const domain = findDomain(func, variable);
  const verticalAsymptotes = findVerticalAsymptotes(func, variable, grid, Algebrite);
  const holes = findHoles(func, variable, domain, verticalAsymptotes, Algebrite);
  const xIntercepts = findXIntercepts(func, variable, grid, Algebrite, isPeriodic);
  const yIntercept = Number.isFinite(evalAt(func, variable, 0))
    ? { x: 0, y: snap(evalAt(func, variable, 0)) }
    : null;
  let { extrema, monotonic } = findExtrema(func, variable, grid, Algebrite, isPeriodic);
  // Monotonic on the part of the window where f is defined — kept for the
  // endpoint reasoning below even when the global claim has to be dropped.
  const monotonicOnDomain = monotonic;
  // A global monotonicity claim is only honest on an unbroken domain — 1/(x-2)
  // decreases on each side of its asymptote but is not "decreasing on ℝ".
  if (domain.length > 0 || verticalAsymptotes.length > 0) monotonic = null;
  const endpointExtrema = findEndpointExtrema(func, variable, domain, extrema, monotonicOnDomain);
  const inflections = findInflections(func, variable, Algebrite);
  const horizontalAsymptote = findHorizontalAsymptote(func, variable);
  const quadratic = analyzeQuadratic(func, variable, Algebrite);

  return {
    domain,
    holes,
    xIntercepts,
    yIntercept,
    extrema,
    endpointExtrema,
    monotonic,
    inflections,
    verticalAsymptotes,
    horizontalAsymptote,
    isPeriodic,
    quadratic,
  };
}

// An extremum sitting on the edge of the domain. sqrt(x-2) has no stationary
// point, but (2, 0) is where the function starts and it is the lowest value
// f ever takes — a student who answers "no extrema" has missed the minimum.
// These are NOT local extrema in the strict two-sided sense (there is no
// left neighbourhood), so they are reported separately and named for what
// they are: minimum/maximum at the domain endpoint. When f is monotonic on
// its domain the endpoint value is also the absolute extremum, and we say so;
// otherwise we don't claim it.
function findEndpointExtrema(func, variable, domain, extrema, monotonicOnDomain) {
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
function findHoles(func, variable, domain, verticalAsymptotes, Algebrite) {
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
function findDomain(func, variable) {
  return findUndefinedRegions(func, variable, { min: WINDOW.min, max: WINDOW.max, step: FINE_STEP });
}

function findVerticalAsymptotes(func, variable, grid, Algebrite) {
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

function findXIntercepts(func, variable, grid, Algebrite, isPeriodic) {
  const found = [];
  const push = (numeric, display) => {
    // Verify: it must actually be a root, not a small-value sample.
    const y = evalAt(func, variable, numeric);
    if (!Number.isFinite(y) || Math.abs(y) > 1e-6) return;
    if (found.some((r) => Math.abs(r.numeric - numeric) < 1e-6)) return;
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

  found.sort((p, q) => p.numeric - q.numeric);
  return { list: found.slice(0, isPeriodic ? 8 : 6), truncated: found.length > (isPeriodic ? 8 : 6) };
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

function findExtrema(func, variable, grid, Algebrite, isPeriodic) {
  const extrema = [];
  const classify = (x) => {
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
    extrema.push({ x: snap(x), y: snap(y), kind, origin: extremumOrigin(func, variable, x) });
  };

  let derivativeStr = null;
  if (Algebrite) {
    try {
      derivativeStr = Algebrite.derivative(rewriteReciprocalTrig(func), variable).toString();
      // Symbolic critical points when f' is polynomial-rootable.
      for (const r of parseRoots(Algebrite.roots(derivativeStr, variable).toString())) {
        if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) classify(r.numeric);
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

  extrema.sort((a, b) => a.x - b.x);
  return { extrema: extrema.slice(0, isPeriodic ? 6 : 4), monotonic };
}

function findInflections(func, variable, Algebrite) {
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

function findHorizontalAsymptote(func, variable) {
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

// Exact quadratic analysis: axis of symmetry, vertex, opening direction.
function analyzeQuadratic(func, variable, Algebrite) {
  if (!Algebrite) return null;
  try {
    const coeff = (n) => {
      const raw = String(Algebrite.run(`coeff(${func}, ${variable}, ${n})`)).trim();
      const v = math.evaluate(raw);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };
    const a = coeff(2);
    if (a === null || a === 0) return null;
    const c3 = coeff(3);
    const c4 = coeff(4);
    if ((c3 !== null && c3 !== 0) || (c4 !== null && c4 !== 0)) return null; // not degree 2
    const b = coeff(1) ?? 0;
    const axis = snap(-b / (2 * a));
    const vy = evalAt(func, variable, axis);
    return { a, axis, vertex: { x: axis, y: snap(vy) }, opensUpward: a > 0 };
  } catch {
    return null;
  }
}

// --- presentation -------------------------------------------------------------

function buildSteps(func, variable, f) {
  const steps = [];
  steps.push(`Analyze the function: f(${variable}) = ${beautify(func)}`);

  // Domain
  if (f.domain.length === 0 && f.verticalAsymptotes.length > 0) {
    // The grid never landed on the poles (tan at π/2), so no undefined
    // region was measured — but the asymptotes ARE excluded from the domain.
    steps.push(`Domain: all real numbers except where the function blows up — ${variable} ≠ ${f.verticalAsymptotes.map((a) => formatNumber(a)).join(', ')} (in the analyzed window ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}${f.isPeriodic ? '; the pattern repeats' : ''}).`);
  } else if (f.domain.length === 0) {
    steps.push(`Domain: all real numbers (defined everywhere in the analyzed window ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}).`);
  } else {
    // "undefined for x ≤ 0" (ln: the edge itself is undefined) vs
    // "undefined for x < 2" (sqrt: defined at the edge) — the closed/open
    // flag on each region is what makes that distinction honest. Poles the
    // grid stepped over (1/sin(x) at ±π) are excluded too, from the
    // asymptote finder, so the domain line and the asymptote line agree.
    const undefinedFor = f.domain.map((r) => formatRestriction(r, variable)).join(' and for ');
    const extraPoles = f.verticalAsymptotes.filter((a) => !f.domain.some((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.from - a) < 1e-6));
    const allowed = formatDomain(f.domain, variable, extraPoles);
    const undefinedAll = undefinedFor + (extraPoles.length ? ` and for ${extraPoles.map((a) => `${variable} = ${formatNumber(a)}`).join(', ')}` : '');
    steps.push(`Domain restriction: f is undefined for ${undefinedAll} — so the domain is ${allowed}.`);
  }

  // Holes (removable discontinuities) — explained, not just "undefined at".
  for (const h of f.holes) {
    const why = h.simplified
      ? ` Simplifying, f(${variable}) = ${beautify(h.simplified)} for every ${variable} ≠ ${formatNumber(h.x)}: a common factor cancels, but the original is still undefined at ${variable} = ${formatNumber(h.x)}.`
      : '';
    steps.push(`Hole (removable discontinuity) at (${formatNumber(h.x)}, ${formatNumber(h.y)}): the function is undefined at ${variable} = ${formatNumber(h.x)}, but it does not blow up there — the graph is a single point short of continuous.${why}`);
  }

  // Quadratic-specific insights (exact)
  if (f.quadratic) {
    steps.push(`This is a quadratic (parabola). Leading coefficient a = ${formatNumber(f.quadratic.a)}, so it opens ${f.quadratic.opensUpward ? 'upward' : 'downward'}.`);
    steps.push(`Axis of symmetry: ${variable} = −b/(2a) = ${formatNumber(f.quadratic.axis)}.`);
    steps.push(`Vertex: (${formatNumber(f.quadratic.vertex.x)}, ${formatNumber(f.quadratic.vertex.y)}) — the ${f.quadratic.opensUpward ? 'minimum' : 'maximum'} point.`);
  }

  // Intercepts
  if (f.yIntercept) {
    steps.push(`y-intercept: f(0) = ${formatNumber(f.yIntercept.y)}, so the graph crosses the y-axis at (0, ${formatNumber(f.yIntercept.y)}).`);
  }
  if (f.xIntercepts.list.length > 0) {
    const xs = f.xIntercepts.list.map((r) => r.display).join(', ');
    steps.push(`x-intercept${f.xIntercepts.list.length > 1 ? 's' : ''}: ${variable} = ${xs}${f.xIntercepts.truncated ? ' (and more outside/inside the window — pattern continues)' : ''}.`);
  } else {
    steps.push('x-intercepts: none — the graph never crosses the x-axis.');
  }

  // Extrema / monotonicity (skip generic extrema line for quadratics — vertex already stated)
  if (!f.quadratic) {
    if (f.extrema.length > 0) {
      for (const e of f.extrema) {
        const name = e.kind === 'max' ? 'maximum' : 'minimum';
        if (e.origin === 'cusp') {
          steps.push(`Local ${name} at (${formatNumber(e.x)}, ${formatNumber(e.y)}) — at a corner/cusp: f′(${variable}) does not exist there (the slopes on either side disagree), yet it is still a critical point and an extremum. Not a stationary point: this does NOT come from f′(${variable}) = 0.`);
        } else {
          steps.push(`Local ${name} at (${formatNumber(e.x)}, ${formatNumber(e.y)}) (from f′(${variable}) = 0).`);
        }
      }
    } else if (f.monotonic) {
      steps.push(`No local extrema — the function is strictly ${f.monotonic} across the window.`);
    } else if (f.endpointExtrema.length === 0 && !f.isPeriodic) {
      steps.push('No local extrema found in the analyzed window.');
    }
    // Endpoint extrema are reported in their own words: they are where the
    // function starts or stops, not two-sided local extrema.
    for (const e of f.endpointExtrema) {
      const name = e.kind === 'max' ? 'maximum' : 'minimum';
      const which = e.absolute ? `absolute ${name}` : name;
      const begins = e.side === +1;
      // min where the graph begins ⇒ f increases from it; max where it
      // begins ⇒ decreases from it; min where it ends ⇒ f decreases toward
      // it; max where it ends ⇒ increases toward it.
      const dir = (e.kind === 'min') === begins ? 'increasing' : 'decreasing';
      steps.push(`${which.charAt(0).toUpperCase() + which.slice(1)} at the domain endpoint (${formatNumber(e.x)}, ${formatNumber(e.y)}): f is undefined ${begins ? 'to the left' : 'to the right'}, so this is where the graph ${begins ? 'begins' : 'ends'}${e.absolute ? ` — and since f is ${dir} ${begins ? 'from' : 'toward'} there, no other value is ${e.kind === 'min' ? 'lower' : 'higher'}` : ''}. There is no stationary point here (f′ ≠ 0); the extremum comes from the edge of the domain.`);
    }
  }

  // Inflection points
  if (f.inflections.length > 0) {
    steps.push(`Inflection point${f.inflections.length > 1 ? 's' : ''} (concavity changes): ${variable} = ${f.inflections.map((i) => i.display).join(', ')}.`);
  }

  // Asymptotes
  if (f.verticalAsymptotes.length > 0) {
    steps.push(`Vertical asymptote${f.verticalAsymptotes.length > 1 ? 's' : ''}: ${f.verticalAsymptotes.map((a) => `${variable} = ${formatNumber(a)}`).join(', ')} — the function blows up there.`);
  }
  if (f.horizontalAsymptote !== null && typeof f.horizontalAsymptote === 'number') {
    steps.push(`Horizontal asymptote: y = ${formatNumber(f.horizontalAsymptote)} as ${variable} → ±∞.`);
  }

  if (f.isPeriodic) {
    steps.push('This is a periodic function — its pattern of zeros and extrema repeats forever.');
  }

  steps.push('Plot the points and sketch the graph using these features.');
  return steps;
}

function buildTips(f) {
  const tips = [];
  if (f.quadratic) {
    tips.push('For ax² + bx + c, the axis of symmetry is always x = −b/(2a).');
    tips.push('The sign of a tells you the opening: a > 0 opens upward, a < 0 downward.');
  } else {
    tips.push('Critical points come from solving f′(x) = 0 — not from eyeballing the graph.');
  }
  if (f.verticalAsymptotes.length > 0) {
    tips.push('A vertical asymptote is not part of the graph — the function is undefined there.');
  }
  if (f.domain.length > 0) {
    tips.push('Always state the domain first; every other feature lives inside it.');
  }
  if (tips.length < 3) tips.push('Check symmetry: even functions mirror across the y-axis, odd ones through the origin.');
  return tips.slice(0, 3);
}

// Allowed-set wording for a list of undefined regions. Two one-sided
// restrictions that bound an interval read as one: "-3 ≤ x ≤ 3", not
// "x ≥ -3 and x ≤ 3".
function formatDomain(domain, variable, extraPoints = []) {
  const isPoint = (r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.to - r.from) < 1e-9;
  const left = domain.find((r) => !Number.isFinite(r.from) && Number.isFinite(r.to));
  const right = domain.find((r) => Number.isFinite(r.from) && !Number.isFinite(r.to));
  const points = [...domain.filter(isPoint).map((r) => r.from), ...extraPoints]
    .filter((v, i, arr) => arr.findIndex((w) => Math.abs(w - v) < 1e-6) === i)
    .sort((a, b) => a - b);
  const others = domain.filter((r) => r !== left && r !== right && !isPoint(r));
  const parts = [];
  if (left && right && others.length === 0) {
    parts.push(`${formatNumber(left.to)} ${left.toClosed ? '<' : '≤'} ${variable} ${right.fromClosed ? '<' : '≤'} ${formatNumber(right.from)}`);
  } else {
    for (const r of domain) if (!isPoint(r)) parts.push(formatRestriction(r, variable, { allowed: true }));
  }
  // Excluded points read as one list: "x ≠ -π, 0, π", not a chain of "and".
  if (points.length) parts.push(`${variable} ≠ ${points.map((v) => formatNumber(v)).join(', ')}`);
  return parts.join(' and ');
}

// The "Final Answer" of a function analysis is the analysis, not the input
// echoed back. One line, the useful findings in reading order: domain, then
// intercepts, then the shape (vertex / extrema / holes / asymptotes). Only
// features that were actually established appear — nothing is padded in.
function summarizeAnalysis(func, variable, f) {
  const parts = [];
  const pt = (x, y) => `(${formatNumber(x)}, ${formatNumber(y)})`;

  if (f.domain.length === 0 && f.verticalAsymptotes.length > 0) parts.push(`domain: all real numbers except ${variable} = ${f.verticalAsymptotes.map((a) => formatNumber(a)).join(', ')}${f.isPeriodic ? ' (repeating)' : ''}`);
  else if (f.domain.length === 0) parts.push('domain: all real numbers');
  else {
    const extraPoles = f.verticalAsymptotes.filter((a) => !f.domain.some((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.from - a) < 1e-6));
    parts.push(`domain: ${formatDomain(f.domain, variable, extraPoles)}`);
  }

  if (f.yIntercept) parts.push(`y-intercept ${pt(0, f.yIntercept.y)}`);
  if (f.xIntercepts.list.length > 0) {
    const xs = f.xIntercepts.list.map((r) => r.display).join(', ');
    parts.push(`x-intercept${f.xIntercepts.list.length > 1 ? 's' : ''} at ${variable} = ${xs}${f.xIntercepts.truncated ? ', …' : ''}`);
  } else if (!f.isPeriodic) {
    parts.push('no x-intercepts');
  }

  if (f.quadratic) {
    parts.push(`vertex ${pt(f.quadratic.vertex.x, f.quadratic.vertex.y)} (${f.quadratic.opensUpward ? 'minimum' : 'maximum'}), axis ${variable} = ${formatNumber(f.quadratic.axis)}`);
  } else {
    for (const e of f.extrema) {
      parts.push(`local ${e.kind === 'max' ? 'maximum' : 'minimum'} ${pt(e.x, e.y)}${e.origin === 'cusp' ? ' (cusp)' : ''}`);
    }
    for (const e of f.endpointExtrema) {
      parts.push(`${e.absolute ? 'absolute ' : ''}${e.kind === 'max' ? 'maximum' : 'minimum'} ${pt(e.x, e.y)} at the domain endpoint`);
    }
    if (f.extrema.length === 0 && f.endpointExtrema.length === 0 && f.monotonic) parts.push(`strictly ${f.monotonic}, no extrema`);
  }

  for (const h of f.holes) parts.push(`hole at ${pt(h.x, h.y)}`);
  if (f.verticalAsymptotes.length > 0) parts.push(`vertical asymptote${f.verticalAsymptotes.length > 1 ? 's' : ''} ${f.verticalAsymptotes.map((a) => `${variable} = ${formatNumber(a)}`).join(', ')}`);
  if (typeof f.horizontalAsymptote === 'number') parts.push(`horizontal asymptote y = ${formatNumber(f.horizontalAsymptote)}`);
  if (f.inflections.length > 0) parts.push(`inflection at ${variable} = ${f.inflections.map((i) => i.display).join(', ')}`);
  if (f.isPeriodic) parts.push('periodic');

  return `f(${variable}) = ${beautify(func)}: ${parts.join('; ')}.`;
}

function describeGraph(f, variable) {
  // The marked features themselves are listed (and read aloud) from the
  // graph's own "Key features" panel, generated from the annotations. This
  // line is what that panel does NOT say: the overall shape, and where it
  // was analysed. Repeating the feature list here in different words made
  // the two panels contradict each other in wording.
  const shape = f.quadratic
    ? `A parabola opening ${f.quadratic.opensUpward ? 'upward' : 'downward'}.`
    : f.isPeriodic
      ? 'A periodic curve — the pattern repeats beyond the window.'
      : f.monotonic
        ? `Strictly ${f.monotonic} across the window.`
        : f.verticalAsymptotes.length > 0
          ? 'The curve breaks at its vertical asymptote' + (f.verticalAsymptotes.length > 1 ? 's' : '') + '.'
          : '';
  return `${shape ? shape + ' ' : ''}Analysed over ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}; use the pan and zoom controls to see more.`.trim();
}
