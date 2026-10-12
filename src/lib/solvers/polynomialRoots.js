/**
 * Every root of a polynomial with rational coefficients, with a guarantee
 * that none is missed.
 *
 * - The polynomial is read exactly: the parse tree bounds its degree d
 *   (`degreeBound`), and its coefficients are interpolated from d + 1 exact
 *   evaluations in mathjs Fraction arithmetic — no floating point, and no
 *   reliance on Algebrite's deg()/coeff().
 * - Real roots are COUNTED exactly by Sturm's theorem on each square-free
 *   factor from Yun's factorisation (so multiplicities are exact too), then
 *   isolated and narrowed by bisection on exact rationals. Close or
 *   ill-conditioned roots — x(x − 1)⋯(x − 20) + x — cannot slip between
 *   samples, because nothing is sampled.
 * - Non-real roots come from Durand–Kerner iteration and are reported only
 *   if there are exactly as many as the degree leaves over and each passes a
 *   backward-error check; otherwise the answer says how many there are
 *   instead of listing unreliable values.
 *
 * Written after two outside reviews found partial root lists: a sextic whose
 * remaining quintic Algebrite silently dropped (1.39.1), and a degree-21
 * polynomial past the old degree-20 scan (1.39.2).
 */

import { createMath } from '../mathInstance.js';

const exact = createMath({ number: 'Fraction' });
const F = (v) => exact.fraction(v);
const ZERO = F(0);

// Above this degree the exact machinery gets slow; such input is refused
// honestly rather than answered with a partial list.
export const MAX_POLYNOMIAL_DEGREE = 40;

// An upper bound on the degree of a mathjs node as a polynomial in
// `variable`, or Infinity when it is not a polynomial (the variable in a
// denominator, an exponent or a function argument). Cancellation can make
// the true degree lower — (x + 1)^2 − x^2 is linear.
export function degreeBound(node, variable) {
  const deg = (n) => degreeBound(n, variable);
  switch (node.type) {
    case 'ConstantNode':
      return 0;
    case 'SymbolNode':
      return node.name === variable ? 1 : 0;
    case 'ParenthesisNode':
      return deg(node.content);
    case 'FunctionNode':
      return node.args.every((arg) => deg(arg) === 0) ? 0 : Infinity;
    case 'OperatorNode': {
      const [a, b] = node.args;
      switch (node.fn) {
        case 'unaryMinus':
        case 'unaryPlus':
          return deg(a);
        case 'add':
        case 'subtract':
          return Math.max(...node.args.map(deg));
        case 'multiply':
          return node.args.reduce((sum, arg) => sum + deg(arg), 0);
        case 'divide':
          return deg(b) === 0 ? deg(a) : Infinity;
        case 'pow': {
          if (deg(b) !== 0) return Infinity;
          const base = deg(a);
          if (base === 0) return 0;
          try {
            const n = b.compile().evaluate({});
            if (exact.typeOf(n) !== 'Fraction' || !exact.isInteger(n) || exact.isNegative(n)) return Infinity;
            return base * Number(n.valueOf());
          } catch {
            return Infinity;
          }
        }
        default:
          return Infinity;
      }
    }
    default:
      return Infinity;
  }
}

// --- integer polynomials: arrays of BigInt, lowest order first -------------
//
// Rationals are cleared to integers once; every later step (pseudo-division,
// Sturm chains, sign evaluation at dyadic points m/2^k) is plain BigInt
// arithmetic. Fraction arithmetic re-reduces by a gcd after every operation
// and took 33 s on a degree-21 polynomial; this takes well under a second.

const abs = (n) => (n < 0n ? -n : n);
const sgn = (n) => (n > 0n ? 1 : n < 0n ? -1 : 0);
const bgcd = (a, b) => { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; };

const trim = (p) => {
  const q = p.slice();
  while (q.length > 1 && q[q.length - 1] === 0n) q.pop();
  return q;
};
const degreeOf = (p) => trim(p).length - 1;
const lead = (p) => p[p.length - 1];
const isZeroPoly = (p) => p.length === 1 && p[0] === 0n;

// Divide out the content, keeping the sign (scaling by a positive constant
// never changes a sign, which the Sturm chain depends on).
function primitive(p) {
  const g = p.reduce((acc, c) => bgcd(acc, c), 0n);
  return g > 1n ? p.map((c) => c / g) : p;
}

function derivative(p) {
  if (p.length <= 1) return [0n];
  return p.slice(1).map((c, k) => c * BigInt(k + 1));
}

// Pseudo-division by b with multiplier |lc(b)|^(deg a − deg b + 1) > 0:
// |lc(b)|^δ·a = q·b + r. Signs of a and r are therefore meaningful.
function pdivmod(a, b) {
  let r = trim(a);
  const d = degreeOf(b);
  const lb = lead(b);
  const alb = abs(lb);
  const slb = lb < 0n ? -1n : 1n;
  const q = [];
  let steps = Math.max(degreeOf(r) - d + 1, 0);
  for (let i = 0; i <= Math.max(degreeOf(r) - d, 0); i += 1) q.push(0n);
  while (!isZeroPoly(r) && degreeOf(r) >= d) {
    const shift = degreeOf(r) - d;
    const lr = lead(r);
    // alb·r − sign(lb)·lr·x^shift·b
    for (let k = 0; k < q.length; k += 1) q[k] *= alb;
    q[shift] += slb * lr;
    const next = r.map((c) => c * alb);
    b.forEach((c, k) => { next[k + shift] -= slb * lr * c; });
    r = trim(next);
    steps -= 1;
  }
  // Bring r to the full multiplier so q·b + r = |lc(b)|^δ·a holds uniformly.
  if (steps > 0) { const f = alb ** BigInt(steps); r = r.map((c) => c * f); for (let k = 0; k < q.length; k += 1) q[k] *= f; }
  return { q: trim(q), r };
}

function gcd(a, b) {
  let x = primitive(trim(a));
  let y = primitive(trim(b));
  while (!isZeroPoly(y)) {
    const { r } = pdivmod(x, y);
    [x, y] = [y, isZeroPoly(r) ? [0n] : primitive(r)];
  }
  return x;
}

// Exact quotient a / b over Q, as a primitive integer polynomial (a constant
// factor does not move a root).
const quotient = (a, b) => primitive(pdivmod(a, b).q);

function sub(p, q) {
  const n = Math.max(p.length, q.length);
  return trim(Array.from({ length: n }, (_, k) => (p[k] || 0n) - (q[k] || 0n)));
}

// Square-free factorisation p = c · Π f_k^k, by gcds of successive
// derivatives: g_k = gcd(p, p′, …, p⁽ᵏ⁾) holds each root of multiplicity m
// with multiplicity max(m − k, 0), so h_k = g_(k−1)/g_k is the product of the
// distinct roots of multiplicity ≥ k, and f_k = h_k/h_(k+1). Only gcds and
// exact quotients — no rational arithmetic. Returns [{ factor, multiplicity }].
function squareFree(p) {
  const g = [primitive(trim(p))];
  let deriv = g[0];
  while (degreeOf(g[g.length - 1]) > 0) {
    deriv = derivative(deriv);
    g.push(gcd(g[g.length - 1], deriv));
  }
  const h = [];
  for (let k = 1; k < g.length; k += 1) h.push(quotient(g[k - 1], g[k]));
  const out = [];
  h.forEach((hk, i) => {
    const factor = i + 1 < h.length ? quotient(hk, h[i + 1]) : hk;
    if (degreeOf(factor) > 0) out.push({ factor, multiplicity: i + 1 });
  });
  return out;
}

// Sign of p at the dyadic point m/2^k: sign of Σ a_i·m^i·2^(k(n−i)).
function signAt(p, x) {
  const n = p.length - 1;
  let acc = 0n;
  let pow2 = 1n;
  const step = 1n << BigInt(x.k);
  // Horner on the homogenised form: acc = acc·m + a_i·2^(k(n−i))
  for (let i = n; i >= 0; i -= 1) {
    acc = acc * x.m + p[i] * pow2;
    pow2 *= step;
  }
  return sgn(acc);
}

const dyadic = (m, k = 0) => ({ m: BigInt(m), k });
function midpoint(a, b) {
  const k = Math.max(a.k, b.k);
  const ma = a.m << BigInt(k - a.k);
  const mb = b.m << BigInt(k - b.k);
  return { m: ma + mb, k: k + 1 };
}
const toNumber = (x) => Number(x.m) / 2 ** x.k;
const width = (a, b) => toNumber(b) - toNumber(a);

// Sturm chain of a square-free polynomial: p, p′, −rem, … (positive scalings only).
function sturmChain(p) {
  const chain = [primitive(p), primitive(derivative(p))];
  while (degreeOf(chain[chain.length - 1]) > 0) {
    const r = pdivmod(chain[chain.length - 2], chain[chain.length - 1]).r;
    if (isZeroPoly(r)) break;
    chain.push(primitive(r.map((c) => -c)));
  }
  return chain;
}

function variations(chain, x) {
  let count = 0;
  let prev = 0;
  for (const q of chain) {
    const s = signAt(q, x);
    if (s === 0) continue;
    if (prev !== 0 && s !== prev) count += 1;
    prev = s;
  }
  return count;
}

// Every real root of a square-free integer polynomial, each to within 2^−40.
function realRootsSquareFree(p) {
  if (degreeOf(p) < 1) return [];
  // Cauchy bound, rounded up to a power of two: every root lies in (−2^e, 2^e).
  const l = abs(lead(p));
  let ratio = 1n;
  for (const c of p.slice(0, -1)) { const r = (abs(c) + l - 1n) / l; if (r > ratio) ratio = r; }
  const e = (ratio + 1n).toString(2).length;
  const chain = sturmChain(p);
  const roots = [];
  const stack = [[dyadic(-(1n << BigInt(e))), dyadic(1n << BigInt(e))]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    const count = variations(chain, lo) - variations(chain, hi); // roots in (lo, hi]
    if (count === 0) continue;
    if (count === 1) { roots.push(refine(p, lo, hi)); continue; }
    const mid = midpoint(lo, hi);
    stack.push([lo, mid], [mid, hi]);
  }
  return roots.sort((a, b) => a - b);
}

// Narrow the single root of square-free p in (lo, hi] by bisection.
function refine(p, lo, hi) {
  if (signAt(p, hi) === 0) return toNumber(hi);
  let a = lo;
  let b = hi;
  // lo is outside (lo, hi]; if it is a root of p, the sign just right of it
  // is the opposite of the sign at hi.
  const sa = signAt(p, a) || -signAt(p, b);
  while (width(a, b) > 2 ** -40 * Math.max(1, Math.abs(toNumber(b)))) {
    const m = midpoint(a, b);
    const sm = signAt(p, m);
    if (sm === 0) return toNumber(m);
    if (sm === sa) a = m; else b = m;
  }
  return toNumber(midpoint(a, b));
}

// Durand–Kerner on float coefficients (lowest order first).
function durandKerner(c) {
  const n = c.length - 1;
  const a = c.map((v) => v / c[n]);
  const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const subC = (p, q) => ({ re: p.re - q.re, im: p.im - q.im });
  const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
  const evalC = (z) => { let r = { re: 1, im: 0 }; for (let k = n - 1; k >= 0; k -= 1) r = { re: r.re * z.re - r.im * z.im + a[k], im: r.re * z.im + r.im * z.re }; return r; };
  const radius = 1 + Math.max(...a.slice(0, n).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => ({ re: radius * Math.cos(2 * Math.PI * k / n + 0.4), im: radius * Math.sin(2 * Math.PI * k / n + 0.4) }));
  for (let iter = 0; iter < 3000; iter += 1) {
    let moved = 0;
    z = z.map((zk, k) => {
      let denom = { re: 1, im: 0 };
      z.forEach((zj, j) => { if (j !== k) denom = mul(denom, subC(zk, zj)); });
      const step = div(evalC(zk), denom);
      moved = Math.max(moved, Math.hypot(step.re, step.im));
      return subC(zk, step);
    });
    if (!z.every((w) => Number.isFinite(w.re) && Number.isFinite(w.im))) return null;
    if (moved < 1e-14 * radius) break;
  }
  return z;
}

// Backward-error test: |p(z)| small relative to Σ|a_k||z|^k.
function passesResidual(c, z) {
  let re = 0; let im = 0; let size = 0;
  const r = Math.hypot(z.re, z.im);
  for (let k = c.length - 1; k >= 0; k -= 1) {
    [re, im] = [re * z.re - im * z.im + c[k], re * z.im + im * z.re];
    size = size * r + Math.abs(c[k]);
  }
  return Math.hypot(re, im) <= 1e-8 * size;
}

/**
 * Read `expression` (mathjs syntax) as a polynomial in `variable`.
 * Returns { coefficients (Fractions, lowest first), degree },
 * { tooHigh: true, degree } past MAX_POLYNOMIAL_DEGREE, or null when it is not
 * a polynomial with rational coefficients.
 */
export function readPolynomial(expression, variable) {
  try {
    const node = exact.parse(expression);
    const bound = degreeBound(node, variable);
    if (!Number.isFinite(bound)) return null;
    if (bound > MAX_POLYNOMIAL_DEGREE) return { tooHigh: true, degree: bound };
    const code = node.compile();
    const values = [];
    for (let k = 0; k <= bound; k += 1) {
      const v = code.evaluate({ [variable]: F(k) });
      if (exact.typeOf(v) !== 'Fraction') return null;
      values.push(v);
    }
    // Newton divided differences at 0, 1, …, bound, expanded to monomials.
    const dd = values.slice();
    for (let j = 1; j <= bound; j += 1) {
      for (let i = bound; i >= j; i -= 1) dd[i] = dd[i].sub(dd[i - 1]).div(j);
    }
    let poly = [dd[bound]];
    for (let i = bound - 1; i >= 0; i -= 1) {
      // poly = poly·(x − i) + dd[i]
      const shifted = [ZERO, ...poly];
      poly = shifted.map((c, k) => c.sub((poly[k] || ZERO).mul(i)));
      poly[0] = poly[0].add(dd[i]);
    }
    while (poly.length > 1 && poly[poly.length - 1].equals(0)) poly.pop();
    return { coefficients: poly, degree: poly.length - 1 };
  } catch {
    return null;
  }
}

/**
 * All roots of a polynomial read by readPolynomial.
 * Returns {
 *   real: [{ value (number), multiplicity }],   // complete, ascending
 *   complex: [{ re, im }] | null,                // null: could not be computed reliably
 *   complexCount,                                // non-real roots, with multiplicity
 *   degree,
 * }
 */
export function allRoots(poly) {
  const { coefficients, degree } = poly;
  // Clear denominators once: an integer multiple has the same roots.
  const lcmD = coefficients.reduce((acc, c) => acc / bgcd(acc, c.d) * c.d, 1n);
  const ints = coefficients.map((c) => c.s * c.n * (lcmD / c.d));
  const real = [];
  const complex = [];
  let reliable = true;
  for (const { factor, multiplicity } of squareFree(ints)) {
    const roots = realRootsSquareFree(factor);
    roots.forEach((value) => real.push({ value, multiplicity }));
    const nonRealCount = degreeOf(factor) - roots.length;
    if (nonRealCount === 0) continue;
    // Non-real roots of each square-free factor: Durand–Kerner, accepted only
    // if it finds exactly as many as Sturm leaves over and each passes the
    // backward-error check.
    const floats = factor.map((c) => Number(c));
    const z = durandKerner(floats);
    const nonReal = z ? z.filter((w) => Math.abs(w.im) > 1e-7 * (1 + Math.abs(w.re))) : [];
    if (z && nonReal.length === nonRealCount && nonReal.every((w) => passesResidual(floats, w))) {
      nonReal.forEach((w) => complex.push({ ...w, multiplicity }));
    } else {
      reliable = false;
    }
  }
  real.sort((a, b) => a.value - b.value);
  const realCount = real.reduce((n, r) => n + r.multiplicity, 0);
  return {
    real,
    complex: reliable ? complex.sort((a, b) => a.re - b.re || a.im - b.im) : null,
    complexCount: degree - realCount,
    degree,
  };
}
