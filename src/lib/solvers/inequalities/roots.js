// The boundary points of an inequality: the real zeros of each side's
// difference and the edges of its domain, exact where a method proves them,
// located numerically (and said to be) otherwise.

import { math, beautify, isAlgebriteFailure, absBars, exactDecimals } from '../solverUtils.js';
import { parseMathExpression } from '../../mathParser.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';

// --- roots -------------------------------------------------------------------

// Real roots of a polynomial string, cleaned and de-duplicated, each with
// its exact form in `labels` where one is known. A polynomial goes to
// polynomialRoots (Sturm counting, verified roots): Algebrite writes the
// real root of x³ − 2 with i and (−1)^(1/3) in it, the old filter dropped
// every root containing i, and x³ − 2 > 0 was answered "No solution".
// Exact forms: a rational root as a fraction; Algebrite's own form when it
// is real and short (√2, 1/2 + 1/2·√5), matched to the root numerically;
// ⁿ√c for a binomial a·xⁿ + b. Anything else stays a decimal.
export const labelKey = (x) => Number(x).toFixed(9);

// Algebrite's notation in the app's: its log is the natural log (a bare log
// here means base 10), exp(u) is e^u, and (u)^(1/2) is a square root. For
// the steps a reader sees and for the exact lookup by the algebra solver.
export function inAppNotation(expr) {
  let out = String(expr).replace(/(?<![a-z])log\(/g, 'ln(');
  let m;
  let guard = 0;
  while ((m = out.match(/\(([^()]*)\)\^\(1\/2\)/)) && guard++ < 8) out = out.replace(m[0], `sqrt(${m[1]})`);
  return out.replace(/(?<![a-z])exp\(([^()]*)\)/g, (all, u) => (/^[a-z0-9]+$/i.test(u) ? `e^${u}` : `e^(${u})`));
}
// 0.3 as (3/10), for Algebrite: shared (solverUtils.js).
export { exactDecimals };

// abs(u) is typed and computed; |u| is what a textbook writes.
export const bars = absBars;
export const shown = (expr) => bars(beautify(inAppNotation(expr)));

// e^x − 2 = 0, ln(x) − 1 = 0: the algebra solver solves the equation
// exactly (x = ln(2), x = e); each exact solution that equals a zero found
// numerically labels it. A solution it could only locate numerically
// ("x ≈ 0.7391") labels nothing.
export async function labelTranscendentalZeros(numerator, variable, zeros, labels) {
  const missing = zeros.filter((z) => !labels.has(labelKey(z)) && !Number.isInteger(z));
  if (!missing.length || readPolynomial(String(numerator), variable)) return;
  try {
    const { solveAlgebra } = await import('../algebraSolver.js');
    // Algebrite writes the natural log as log; the solvers read a bare log
    // as base 10 (rewriteCommonLog), so hand it back as ln.
    const r = await solveAlgebra(`${inAppNotation(numerator)} = 0`);
    if (!r || r.status && r.status !== 'solved') return;
    for (const part of String(r.answer).split(/\s+or\s+/)) {
      const m = part.match(new RegExp(`^\\s*${variable}\\s*=\\s*([^≈]+?)\\s*(?:\\(≈[^)]*\\))?\\s*$`));
      if (!m) continue;
      let value;
      try { value = Number(math.evaluate(parseMathExpression(m[1]))); } catch { continue; }
      const z = missing.find((q) => Math.abs(q - value) < 1e-6);
      // A real zero is never labelled by a form with i in it (x² = 6 + e
      // came back as i·(−6 − e)^(1/2)).
      if (z !== undefined && !/^-?\d+(?:\.\d+)?$/.test(m[1].trim()) && !/(?<![a-z])i(?![a-z])/.test(m[1])) labels.set(labelKey(z), radicalForm(m[1].trim()));
    }
  } catch {
    // no exact form: the decimal stands
  }
}
export function realRoots(Algebrite, poly, variable, labels = new Map()) {
  if (!new RegExp(`\\b${variable}\\b`).test(String(poly))) return [];
  const P = readPolynomial(String(poly), variable);
  if (P) {
    let found;
    try { found = allRoots(P).real; } catch { found = null; }
    if (found) {
      const values = found.map((r) => clean(r.value));
      const raw = safeRun(Algebrite, `roots(${poly})`);
      const candidates = isAlgebriteFailure(raw) ? [] : String(raw).replace(/^\[|\]$/g, '').split(/,(?![^(]*\))/)
        .map((t) => t.trim())
        .filter((t) => t && !/(?<![a-z])i(?![a-z])|\(-1\)\^/.test(t) && t.length <= 40);
      const nonzero = P.coefficients.map((c, i) => ({ c, i })).filter(({ c }) => c.n !== 0n);
      found.forEach((r, idx) => {
        // Matched on the root as found, filed under the value the rest of
        // the solve uses (a whole number snapped by clean()).
        const v = values[idx];
        const exactValue = r.value;
        if (r.exact) {
          const { m, d } = r.exact;
          labels.set(labelKey(v), d === 1n ? `${m}` : `${m}/${d}`);
          return;
        }
        const match = candidates.find((t) => {
          try { return Math.abs(Number(math.evaluate(t)) - exactValue) < 1e-7; } catch { return false; }
        });
        if (match) { labels.set(labelKey(v), prettyRoot(beautify(match))); return; }
        // a·xⁿ + b = 0: x = ⁿ√(−b/a), sign carried for odd n; a·xⁿ⁺ᵐ + b·xᵐ
        // the same, once xᵐ is factored out (x⁵ − 4x at ±√2).
        if (nonzero.length === 2 && v !== 0) {
          const n = nonzero[1].i - nonzero[0].i;
          const c = Math.abs(exactValue) ** n;
          const whole = Math.round(c);
          if (Math.abs(c - whole) < 1e-9 * Math.max(1, whole)) labels.set(labelKey(v), `${v < 0 ? '-' : ''}${nthRoot(whole, n)}`);
        }
      });
      return values;
    }
  }
  // Not a polynomial: the caller proves its zeros (zeros.js); a scan
  // here missed roots (1.66.0).
  return null;
}

// The n-th root of a whole number c, reduced: ⁴√4 is √2 (4 = 2²), ⁶√8 is √2.
function nthRoot(c, n) {
  for (let d = n; d >= 1; d -= 1) {
    if (n % d) continue;
    const r = Math.round(c ** (1 / d));
    if (r ** d !== c) continue;
    const m = n / d;
    return m === 1 ? String(r) : m === 2 ? `√${r}` : m === 3 ? `∛${r}` : `${r}^(1/${m})`;
  }
  return `${c}^(1/${n})`;
}

// Algebrite's radical form, as a reader writes it: 2^(1/2) → √2.
function prettyRoot(t) {
  // 1/2 - 1/2·√5 → (1 - √5)/2: the quadratic formula's shape.
  const q = String(t).replace(/\s+/g, ' ').match(/^(-?\d+)\/(\d+) ([+-]) (\d+)\/\2\*?(\d+)\^\(1\/2\)$/);
  if (q) {
    const [, a, b, op, c, n] = q;
    return `(${a} ${op} ${c === '1' ? '' : c}√${n})/${b}`;
  }
  // √3/√2 → √6/2: no radical in a denominator.
  const r = String(t).replace(/\s+/g, '').match(/^(-?)(\d+)\^\(1\/2\)\/\(?(\d+)\^\(1\/2\)\)?$/);
  if (r) return `${r[1]}√${Number(r[2]) * Number(r[3])}/${r[3]}`;
  // √3·√666667 → √2000001: one radical.
  const merged = String(t).replace(/(\d+)\^\(1\/2\)\s*[*·]?\s*(\d+)\^\(1\/2\)/g, (m, a, b) => `${BigInt(a) * BigInt(b)}^(1/2)`);
  return radicalForm(merged
    .replace(/\(([^()]*)\)\^\(1\/2\)/g, '√($1)')
    .replace(/(\d+)\^\(1\/2\)/g, '√$1')
    .replace(/\(([^()]*)\)\^\(1\/3\)/g, '∛($1)')
    .replace(/(\d+)\^\(1\/3\)/g, '∛$1')
    .replace(/\*(?=[√∛])/g, '·'));
}

// A radical as a textbook writes it: √3·√666667 → √2000001, and
// 1/1000·√2000001 → √2000001/1000.
export function radicalForm(text) {
  return String(text)
    .replace(/√(\d+)\s*[·*]?\s*√(\d+)/g, (m, a, b) => `√${BigInt(a) * BigInt(b)}`)
    .replace(/^(-?)1\/(\d+)\s*[·*]\s*([√∛]\d+)$/, '$1$3/$2');
}

// --- interval algebra --------------------------------------------------------

export function uniqueSorted(arr) {
  const out = [];
  for (const v of arr.slice().sort((a, b) => a - b)) {
    if (!out.some((u) => Math.abs(u - v) < 1e-9)) out.push(v);
  }
  return out;
}

// --- misc --------------------------------------------------------------------

export function safeRun(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

// A whole number when the root is one to within rounding error; otherwise
// the root as found. It was rounded to six decimals, which moved the edge
// −√2 of √(x² − 2) − 0.001 < 0 out of the stretch where the solutions lie
// (1.66.0).
function clean(n) {
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-9 ? r : n;
}
