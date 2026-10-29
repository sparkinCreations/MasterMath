// The boundary points of an inequality: the real zeros of each side's
// difference and the edges of its domain, exact where a method proves them,
// located numerically (and said to be) otherwise.

import { math, beautify, isAlgebriteFailure, absBars } from '../solverUtils.js';
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
function inAppNotation(expr) {
  let out = String(expr).replace(/(?<![a-z])log\(/g, 'ln(');
  let m;
  let guard = 0;
  while ((m = out.match(/\(([^()]*)\)\^\(1\/2\)/)) && guard++ < 8) out = out.replace(m[0], `sqrt(${m[1]})`);
  return out.replace(/(?<![a-z])exp\(([^()]*)\)/g, (all, u) => (/^[a-z0-9]+$/i.test(u) ? `e^${u}` : `e^(${u})`));
}
// abs(u) is typed and computed; |u| is what a textbook writes.
export const bars = absBars;
export const shown = (expr) => bars(beautify(inAppNotation(expr)));

// Where the expression's domain ends: the zeros of every logarithm's and
// square root's argument (an even root's, generally). Each is a boundary of
// the sign chart; whether a side is in the domain is then tested, not
// assumed.
export function domainEdges(Algebrite, fExpr, variable, labels) {
  const args = [];
  try {
    math.parse(fExpr).traverse((node) => {
      if (node.isFunctionNode && ['log', 'ln', 'log10', 'log2', 'sqrt'].includes(node.fn?.name) && node.args[0]) args.push(node.args[0].toString());
      if (node.isOperatorNode && node.op === '^' && node.args[1]) {
        try {
          const p = node.args[1].evaluate();
          if (typeof p === 'number' && !Number.isInteger(p) && Number.isInteger(1 / p) && (1 / p) % 2 === 0) args.push(node.args[0].toString());
        } catch { /* a symbolic exponent is not a root */ }
      }
    });
  } catch {
    return [];
  }
  const edges = [];
  for (const a of args) {
    if (!new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(a)) continue;
    for (const e of realRoots(Algebrite, a, variable, labels)) if (!edges.some((q) => Math.abs(q - e) < 1e-9)) edges.push(e);
  }
  return edges;
}

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
      // The zeros are rounded to six decimals (clean()).
      const z = missing.find((q) => Math.abs(q - value) < 1e-6);
      if (z !== undefined && !/^-?\d+(?:\.\d+)?$/.test(m[1].trim())) labels.set(labelKey(z), m[1].trim());
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
      const degree = P.coefficients.length - 1;
      const nonzero = P.coefficients.map((c, i) => ({ c, i })).filter(({ c }) => c.n !== 0n);
      found.forEach((r, idx) => {
        // Matched on the unrounded root (clean() rounds to six decimals),
        // filed under the rounded one the rest of the solve uses.
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
        // a·xⁿ + b = 0: x = ⁿ√(−b/a), sign carried for odd n.
        if (nonzero.length === 2 && nonzero.some(({ i }) => i === 0)) {
          const n = degree;
          const c = Math.abs(exactValue) ** n;
          const cText = Number.isInteger(Math.round(c)) && Math.abs(c - Math.round(c)) < 1e-9 ? String(Math.round(c)) : null;
          if (cText) labels.set(labelKey(v), `${v < 0 ? '-' : ''}${n === 2 ? '√' : n === 3 ? '∛' : ''}${n > 3 ? `${cText}^(1/${n})` : cText}`);
        }
      });
      return values;
    }
  }
  const raw = safeRun(Algebrite, `roots(${poly})`);
  if (isAlgebriteFailure(raw)) return numericRoots(poly, variable);

  const parts = String(raw).replace(/^\[|\]$/g, '').split(/,(?![^(]*\))/);
  const out = [];
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    try {
      // A real root written in complex form keeps its real value.
      const value = math.evaluate(p);
      const v = typeof value === 'number' ? value
        : value && Number.isFinite(value.re) && Math.abs(value.im) < 1e-9 ? value.re : NaN;
      if (Number.isFinite(v)) out.push(clean(v));
    } catch {
      // ignore unparseable root
    }
  }
  return out;
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
  return String(t)
    .replace(/\(([^()]*)\)\^\(1\/2\)/g, '√($1)')
    .replace(/(\d+)\^\(1\/2\)/g, '√$1')
    .replace(/\(([^()]*)\)\^\(1\/3\)/g, '∛($1)')
    .replace(/(\d+)\^\(1\/3\)/g, '∛$1')
    .replace(/\*(?=[√∛])/g, '·');
}

// Fallback: scan for sign changes when Algebrite can't factor the polynomial.
function numericRoots(expr, variable) {
  const roots = [];
  let prev = null;
  for (let x = -50; x <= 50; x += 0.25) {
    let y;
    try {
      y = math.evaluate(expr, { [variable]: x });
    } catch {
      prev = null;
      continue;
    }
    if (typeof y !== 'number' || !Number.isFinite(y)) { prev = null; continue; }
    if (prev !== null && Math.sign(prev) !== Math.sign(y) && prev !== 0) {
      roots.push(clean(bisect(expr, variable, x - 0.25, x)));
    }
    prev = y;
  }
  return roots;
}

function bisect(expr, variable, a, b) {
  let lo = a;
  let hi = b;
  const f = (x) => Number(math.evaluate(expr, { [variable]: x }));
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(lo)) === Math.sign(f(mid))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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

function clean(n) {
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-7) return r;
  return Math.round(n * 1e6) / 1e6;
}
