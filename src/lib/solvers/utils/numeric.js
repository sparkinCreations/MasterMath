// Numeric checks and sampling: real odd roots, where an expression is
// undefined, two expressions compared at sample points, and a function
// sampled for its graph.

import { math } from './engines.js';
import { formatNumber } from './text.js';

/**
 * Rewrite odd roots so they evaluate as REAL functions: x^(1/3) → nthRoot(x, 3),
 * x^(2/3) → nthRoot(x, 3)^2.
 *
 * mathjs's pow takes the principal (complex) value for a negative base and a
 * fractional exponent, so x^(1/3) "was undefined for x < 0" and its graph
 * stopped at the origin. Students mean the real cube root. Applied only to
 * numeric evaluation for graphs and analysis — Algebrite (derivatives,
 * integrals) keeps the power form it understands. Bases handled: a bare
 * variable, a number, or one parenthesised group; odd n up to 9.
 */
export function realOddRoots(expression) {
  // A rational exponent is read in lowest terms: x^(4/6) is x^(2/3), real
  // for x < 0 (an outside review, 1.62.0: the unreduced form lost x = −8).
  const lowest = String(expression).replace(/\^\((\d+)\/(\d+)\)/g, (_, a, b) => {
    let x = Number(a);
    let y = Number(b);
    while (y) [x, y] = [y, x % y];
    return x > 1 ? `^(${Number(a) / x}/${Number(b) / x})` : `^(${a}/${b})`;
  });
  return lowest.replace(
    /(\([^()]*\)|\b[a-z]\b|\d+(?:\.\d+)?)\^\((\d+)\/([3579])\)/g,
    (_, base, k, n) => (k === '1' ? `nthRoot(${base}, ${n})` : `nthRoot(${base}, ${n})^${k}`)
  );
}

/**
 * Where is an expression undefined over the reals?
 *
 * Numeric: sample a grid, find the runs where evaluation fails or is
 * non-real, and bisect each run's edges. Each region reports whether its
 * edges are themselves undefined (closed) — sqrt(x-2) is defined AT 2 so
 * its restriction is "x < 2", while ln(x) is undefined AT 0 so its
 * restriction is "x ≤ 0". Zero-width regions are isolated points (1/(x-1)
 * at 1). Also snaps edges to clean values (0.9999999 → 1).
 *
 * Used by the algebra solver to carry a domain onto identity answers and by
 * the functions solver for its domain step.
 */
export function findUndefinedRegions(expression, variable, options = {}) {
  const { min = -20, max = 20, step = 0.05 } = options;
  const realExpr = realOddRoots(expression);
  const definedAt = (x) => {
    try {
      const v = math.evaluate(realExpr, { [variable]: x });
      return typeof v === 'number' && Number.isFinite(v);
    } catch {
      return false;
    }
  };
  const snap = (x) => {
    for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
      const n = x * d;
      if (Math.abs(n - Math.round(n)) < 1e-6) return Math.round(n) / d;
    }
    return Math.round(x * 1e6) / 1e6;
  };
  const refine = (definedX, undefinedX) => {
    let lo = definedX;
    let hi = undefinedX;
    for (let i = 0; i < 50; i += 1) {
      const mid = (lo + hi) / 2;
      if (definedAt(mid)) lo = mid; else hi = mid;
    }
    return snap((lo + hi) / 2);
  };

  const n = Math.round((max - min) / step);
  const grid = [];
  for (let i = 0; i <= n; i += 1) {
    const x = Math.round((min + i * step) * 1e6) / 1e6;
    grid.push({ x, ok: definedAt(x) });
  }

  const regions = [];
  let runStart = null;
  const close = (endIdx) => {
    // run is grid[runStart .. endIdx-1] undefined; endIdx defined (or past end)
    const from = runStart === 0 ? -Infinity : refine(grid[runStart - 1].x, grid[runStart].x);
    const to = endIdx >= grid.length ? Infinity : refine(grid[endIdx].x, grid[endIdx - 1].x);
    regions.push({
      from,
      to,
      fromClosed: Number.isFinite(from) ? !definedAt(from) : false,
      toClosed: Number.isFinite(to) ? !definedAt(to) : false,
    });
    runStart = null;
  };
  for (let i = 0; i < grid.length; i += 1) {
    if (!grid[i].ok && runStart === null) runStart = i;
    if (grid[i].ok && runStart !== null) close(i);
  }
  if (runStart !== null) close(grid.length);

  // x^x for x < 0 is defined only at isolated points (the integers), so the
  // scan sees a chain of gaps separated by single defined points. Three or
  // more such gaps in a row are one region with isolated exceptions — "x ≥ 0
  // (plus isolated points)" — not "not -10 < x < -9 and not -9 < x < -8 …".
  const merged = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && Number.isFinite(last.to) && Number.isFinite(r.from) && Math.abs(r.from - last.to) < 1e-6 && !last.toClosed && !r.fromClosed) {
      last.isolated = [...(last.isolated || []), last.to];
      last.to = r.to;
      last.toClosed = r.toClosed;
      last.chained = (last.chained || 1) + 1;
    } else {
      merged.push({ ...r });
    }
  }
  const out = [];
  for (const m of merged) {
    if ((m.chained || 1) >= 3) {
      // A chain reaching the edge of the scan window is, as far as we can
      // see, unbounded on that side.
      const from = m.from <= min + step * 1.5 ? -Infinity : m.from;
      const to = m.to >= max - step * 1.5 ? Infinity : m.to;
      out.push({ from, to, fromClosed: Number.isFinite(from) && m.fromClosed, toClosed: Number.isFinite(to) && m.toClosed, isolated: m.isolated });
    } else {
      // Fewer than three: keep the original gaps as they were.
      const start = regions.findIndex((r) => r.from === m.from);
      for (let i = 0; i < (m.chained || 1); i += 1) out.push(regions[start + i]);
    }
  }
  // Grid points are exact multiples of `step` (rounded), so isolated poles at
  // clean values (1/(x-1) at 1) are hit directly. A pole at an off-grid value
  // (1/(3x-1) at 1/3) can be stepped over; callers with Algebrite to hand
  // supplement this with the denominator's roots.
  return out;
}

// Format an undefined region either as the set where the expression is
// UNDEFINED ("x = 1", "x ≤ 0", "x < 2", "2 ≤ x < 3") or, with
// { allowed: true }, as the restriction a student writes on the domain
// ("x ≠ 1", "x > 0", "x ≥ 2").
export function formatRestriction(region, variable, options = {}) {
  const { allowed = false, fmt = formatNumber } = options;
  const { from, to, fromClosed, toClosed } = region;
  const point = Number.isFinite(from) && Number.isFinite(to) && Math.abs(to - from) < 1e-9;
  if (point) return `${variable} ${allowed ? '≠' : '='} ${fmt(from)}`;
  if (!Number.isFinite(from) && !Number.isFinite(to)) return allowed ? 'no real numbers' : 'all real numbers';
  if (!Number.isFinite(from)) {
    // undefined on (-∞, to) or (-∞, to]
    return allowed
      ? `${variable} ${toClosed ? '>' : '≥'} ${fmt(to)}`
      : `${variable} ${toClosed ? '≤' : '<'} ${fmt(to)}`;
  }
  if (!Number.isFinite(to)) {
    return allowed
      ? `${variable} ${fromClosed ? '<' : '≤'} ${fmt(from)}`
      : `${variable} ${fromClosed ? '≥' : '>'} ${fmt(from)}`;
  }
  // A bounded gap: the allowed form is a union, which reads worse than the
  // gap itself, so both modes name the gap.
  const gap = `${fmt(from)} ${fromClosed ? '≤' : '<'} ${variable} ${toClosed ? '≤' : '<'} ${fmt(to)}`;
  return allowed ? `not ${gap}` : gap;
}


/**
 * Are two expressions numerically equal? Samples both at several points and
 * requires agreement everywhere both are defined (at least 3 usable points).
 * This is the verification gate for symbolic results — a factorization or
 * identity simplification is only *claimed* after it passes this check, so a
 * symbolic-engine bug degrades to "no answer" rather than a wrong answer.
 */
const EQUIVALENCE_SAMPLE_POINTS = [-2.31, -1.17, -0.43, 0.29, 0.87, 1.61, 2.53];

export function expressionsNumericallyEqual(exprA, exprB, variable = 'x') {
  const { seen, agree } = numericAgreement(exprA, exprB, variable);
  return seen >= 3 && agree === seen;
}

// How many sample points both expressions are real at, and agree at: lets a
// caller tell "they differ" from "too few real points to say".
export function numericAgreement(exprA, exprB, variable = 'x') {
  let seen = 0;
  let agree = 0;
  for (const x of EQUIVALENCE_SAMPLE_POINTS) {
    let a;
    let b;
    try {
      a = Number(math.evaluate(String(exprA), { [variable]: x }));
      b = Number(math.evaluate(String(exprB), { [variable]: x }));
    } catch {
      continue;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    seen += 1;
    if (Math.abs(a - b) <= 1e-6 * (1 + Math.abs(a))) agree += 1;
  }
  return { seen, agree };
}

/**
 * Sample a single-variable expression over a range, returning `{x, y}` points
 * suitable for the graph components. Points where the function is undefined,
 * non-finite, or explodes beyond `cap` are skipped.
 */
export function sampleFunction(expression, variable, options = {}) {
  // Default window is ±40 so the graph viewer can pan beyond the initial
  // ±10 view "to a reasonable extent" without hitting empty space; the
  // viewer clamps panning to the sampled data. The cap only excludes true
  // blow-ups (asymptotes, exponential explosion) — the viewer windows the
  // y-axis itself, so ordinary polynomial growth must NOT be dropped or the
  // pannable extent collapses.
  const { min = -40, max = 40, step = 0.5, cap = 1e5 } = options;
  const points = [];

  const realExpr = realOddRoots(expression);
  for (let x = min; x <= max + 1e-9; x += step) {
    const scope = { [variable]: x };
    try {
      const y = math.evaluate(realExpr, scope);
      if (Number.isFinite(y) && Math.abs(y) <= cap) {
        // Round x to avoid floating-point drift in labels (…, 0.4999999).
        points.push({ x: Math.round(x * 1e6) / 1e6, y });
      }
    } catch {
      // Undefined at this point — skip it.
    }
  }

  return points;
}
