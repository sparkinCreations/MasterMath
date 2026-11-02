// The zeros of an expression that is not a polynomial (e^x − 2,
// x − ln(x) − 2, x·e^x − 1), found together with a proof that the list is
// complete, or not at all.
//
// On an interval where f′ has no zero, f is strictly monotone, so it has
// one zero there exactly when its values at the two ends have opposite
// signs, and none otherwise. At an end outside the domain (a pole, the edge
// of a logarithm's domain, ±∞) the value is the one-sided limit, read off
// the terms' growth rates (an exponential outgrows a power, a power a
// logarithm), never estimated from samples. Where no limit is proved, a
// point of the opposite sign still proves a root, but not finding one never
// proves there is none. The zeros of f′ come from the exact
// root finder (f′ a polynomial, or one once an exponential factor, which is
// never 0, is divided out), or from the same argument one derivative down
// (six at most: x⁵ against eˣ needs every one); when none of these applies
// the proof fails and the caller refuses.
//
// A·sin(kx + c) + d − (mx + b) has a periodic derivative, so infinitely
// many turning points: it is counted by convexity instead
// (trigonometry/rootCount.js).
//
// 1.66.0. The scan this replaces stepped by 0.25 over −50 ≤ x ≤ 50: it
// missed x − ln(x) > 2 on 0 < x < 0.1586 (the root next to the domain's
// edge) and e^(x/20) > x past x ≈ 89.995 (outside the window).

import { math, structuralPeriod, neverZeroSide, linearCoefficients } from '../solverUtils.js';
import { growthLimitAtInfinity, growthLimitAtZeroRight } from '../limits/growth.js';
import { readPolynomial } from '../polynomialRoots.js';
import { countWaveLineRoots, waveLineBound } from '../trigonometry/rootCount.js';
import { realRoots, safeRun, inAppNotation, labelKey, exactDecimals } from './roots.js';

const MAX_DEPTH = 6;
const NEAR_ZERO = 1e-9;

const evaluator = (expr, v) => (x) => {
  try {
    const y = math.evaluate(String(expr), { [v]: x });
    return typeof y === 'number' ? y : NaN;
  } catch {
    return NaN;
  }
};
const hasVariable = (expr, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(String(expr));

// Exactly 0 at x = n/d, by substitution in exact arithmetic.
function exactlyZeroAt(Algebrite, expr, v, n, d) {
  const out = safeRun(Algebrite, `simplify(subst((${n})/(${d}), ${v}, ${expr}))`);
  return out === '0';
}
// A located value that is a simple fraction (0, 1, −1/2, …) at which expr
// is exactly 0, as that fraction: e^x − 1 is 0 at 0, not at −5·10^(−16).
function snap(Algebrite, expr, v, x) {
  const f = evaluator(expr, v);
  for (let d = 1; d <= 12; d += 1) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) >= 1e-9) continue;
    if (exactlyZeroAt(Algebrite, expr, v, n, d)) return n / d;
    // log(100)/log(10) − 2: Algebrite leaves the logarithms as they are,
    // but the value is 0 exactly, not merely small, in floating point.
    if (f(n / d) === 0) return n / d;
  }
  return x;
}
// expr at a turning point x: exactly 0 when substitution proves it.
function valueAt(Algebrite, expr, v, x, f) {
  const y = f(x);
  if (y === 0 || Math.abs(y) > NEAR_ZERO) return y;
  for (let d = 1; d <= 12; d += 1) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-12 && exactlyZeroAt(Algebrite, expr, v, n, d)) return 0;
  }
  return y;
}

// The zeros of `expr` (Algebrite notation) on the real line: an array of
// numbers, or null when they cannot be proved complete. A polynomial goes to
// the exact root finder (labels get its exact forms).
export async function provedZeros(Algebrite, raw, v, { labels = new Map(), lhs, rhs } = {}) {
  const expr = exactDecimals(raw);
  if (!hasVariable(expr, v)) return [];
  if (readPolynomial(String(expr), v)) return realRoots(Algebrite, expr, v, labels);
  if (lhs !== undefined && rhs !== undefined) {
    const wave = waveZeros(lhs, rhs, v);
    if (wave) return wave;
  }
  if (/(?<![a-z])abs\(/.test(expr)) return absoluteZeros(Algebrite, expr, v, labels);
  const exponential = await exponentialZeros(Algebrite, expr, v, labels);
  if (exponential) return exponential;
  return monotoneZeros(Algebrite, expr, v, 0);
}

// Through an absolute value: every zero of f lies where the inside u is
// ≥ 0 or ≤ 0, so it is a zero of f with |u| written as u or as −u; a zero of
// either branch counts when u has that branch's sign there (|x| = x + 1 at
// x = −1/2 only).
async function absoluteZeros(Algebrite, expr, v, labels) {
  let tree;
  try { tree = math.parse(String(expr)); } catch { return null; }
  // The outermost absolute values; one inside another (||x| − 1|) is
  // branched on when its branch is proved, one level down.
  const all = tree.filter((n) => n.type === 'FunctionNode' && n.fn?.name === 'abs');
  const absNodes = all.filter((n) => !all.some((m) => m !== n && m.filter((c) => c === n).length));
  if (absNodes.length > 3) return null;
  const f = evaluator(expr, v);
  const zeros = [];
  for (let mask = 0; mask < 2 ** absNodes.length; mask += 1) {
    const signs = absNodes.map((_, i) => ((mask >> i) & 1 ? -1 : 1));
    const branch = tree.transform((n) => {
      const i = absNodes.indexOf(n);
      return i === -1 ? n : math.parse(`${signs[i] < 0 ? '-' : ''}(${n.args[0].toString()})`);
    });
    const text = safeRun(Algebrite, `simplify(${branch.toString()})`) || branch.toString();
    // A branch that is 0 everywhere (|x| − x for x ≥ 0): f is 0 on the
    // whole region where it applies, which the sign chart reads as "zero";
    // the region's edge is a zero of the other branch.
    if (text === '0') continue;
    const found = await provedZeros(Algebrite, text, v, { labels });
    if (!found) return null;
    for (const x of found) {
      const fits = absNodes.every((n, i) => {
        const y = evaluator(n.args[0].toString(), v)(x);
        return Math.abs(y) < 1e-12 || Math.sign(y) === signs[i];
      });
      if (fits && Math.abs(f(x)) < 1e-9 && !zeros.some((z) => Math.abs(z - x) < 1e-9)) zeros.push(x);
    }
  }
  return zeros.sort((a, b) => a - b);
}

// Bounds of expr on the open stretch a < x < b of its domain, read off the
// parse tree by interval arithmetic: { lo, hi, loOpen, hiOpen }, or null.
// 2 + sin(x) lies in [1, 3]; √x + √(x − 1) is positive wherever both are
// defined (the zeros of a root's argument are the stretch's ends). A bound
// that excludes 0 proves the expression is never 0 there.
export function boundsOn(expr, v, a, b) {
  let tree;
  try { tree = math.parse(String(expr)); } catch { return null; }
  const I = (lo, hi, loOpen = false, hiOpen = false) => ({ lo, hi, loOpen, hiOpen });
  const ALL = I(-Infinity, Infinity, true, true);
  const POS = I(0, Infinity, true, true);
  const add = (p, q) => I(p.lo + q.lo, p.hi + q.hi, p.loOpen || q.loOpen, p.hiOpen || q.hiOpen);
  const neg = (p) => I(-p.hi, -p.lo, p.hiOpen, p.loOpen);
  const positive = (p) => p.lo > 0 || (p.lo === 0 && p.loOpen);
  const mul = (p, q) => {
    if (p.lo === p.hi && q.lo === q.hi) return I(p.lo * q.lo, p.lo * q.lo);
    if (p.lo === p.hi) return p.lo === 0 ? I(0, 0) : p.lo > 0 ? I(p.lo * q.lo, p.lo * q.hi, q.loOpen, q.hiOpen) : neg(mul(I(-p.lo, -p.lo), q));
    if (q.lo === q.hi) return mul(q, p);
    if (positive(p) && positive(q)) return I(p.lo * q.lo, p.hi * q.hi, true, p.hiOpen || q.hiOpen);
    if (positive(p) && positive(neg(q))) return neg(mul(p, neg(q)));
    if (positive(neg(p)) && positive(q)) return neg(mul(neg(p), q));
    if (positive(neg(p)) && positive(neg(q))) return mul(neg(p), neg(q));
    const products = [p.lo * q.lo, p.lo * q.hi, p.hi * q.lo, p.hi * q.hi].filter((y) => !Number.isNaN(y));
    return products.length === 4 ? I(Math.min(...products), Math.max(...products)) : ALL;
  };
  const power = (p, k) => {
    if (k === 0) return I(1, 1);
    if (k % 2 === 1) return I(p.lo ** k, p.hi ** k, p.loOpen, p.hiOpen);
    if (positive(p)) return I(p.lo ** k, p.hi ** k, true, p.hiOpen);
    if (positive(neg(p))) return I(p.hi ** k, p.lo ** k, true, p.loOpen);
    return I(0, Math.max(p.lo ** k, p.hi ** k), false, true);
  };
  const recip = (q) => {
    if (positive(q)) return I(q.hi === Infinity ? 0 : 1 / q.hi, q.lo === 0 ? Infinity : 1 / q.lo, true, q.lo === 0 || q.loOpen);
    if (positive(neg(q))) return neg(recip(neg(q)));
    return null;
  };
  const constant = (n) => {
    try {
      const y = n.evaluate({});
      return typeof y === 'number' && Number.isFinite(y) ? y : null;
    } catch {
      return null;
    }
  };
  const walk = (n) => {
    if (n.type === 'ParenthesisNode') return walk(n.content);
    const c = n.filter((m) => m.type === 'SymbolNode' && m.name === v).length ? null : constant(n);
    if (c !== null) return I(c, c);
    if (n.type === 'SymbolNode') return n.name === v ? I(a, b, true, true) : null;
    if (n.type === 'OperatorNode') {
      if (n.fn === 'unaryMinus') { const p = walk(n.args[0]); return p && neg(p); }
      if (n.fn === 'unaryPlus') return walk(n.args[0]);
      const [p, q] = n.args.map(walk);
      if (!p || !q) {
        // b^(anything) with a positive constant base is positive.
        if (n.op === '^' && p && positive(p)) return POS;
        return null;
      }
      if (n.op === '+') return add(p, q);
      if (n.op === '-') return add(p, neg(q));
      if (n.op === '*') return mul(p, q);
      if (n.op === '/') { const r = recip(q); return r ? mul(p, r) : ALL; }
      if (n.op === '^') {
        const k = q.lo === q.hi ? q.lo : null;
        if (positive(p) && p.lo === p.hi) return POS; // 2^x
        if (k === null) return positive(p) ? POS : null;
        if (Number.isInteger(k) && k >= 0) return power(p, k);
        // x^(−k) = 1/x^k.
        if (Number.isInteger(k)) return recip(power(p, -k)) || ALL;
        // A fractional power is a root: positive inside its domain.
        return POS;
      }
      return null;
    }
    if (n.type === 'FunctionNode') {
      const name = n.fn?.name;
      const p = n.args[0] ? walk(n.args[0]) : null;
      if (name === 'sin' || name === 'cos') return I(-1, 1);
      if (name === 'exp' || name === 'sqrt') return POS;
      if (name === 'cosh') return I(1, Infinity, false, true);
      if (name === 'atan' || name === 'arctan') return I(-Math.PI / 2, Math.PI / 2, true, true);
      if (name === 'tanh') return I(-1, 1, true, true);
      if (name === 'abs') return p && (positive(p) || positive(neg(p))) ? POS : I(0, Infinity, false, true);
      if (name === 'sinh' && p) return I(Math.sinh(p.lo), Math.sinh(p.hi), p.loOpen, p.hiOpen);
      if ((name === 'log' || name === 'ln') && p && positive(p)) return I(p.lo === 0 ? -Infinity : Math.log(p.lo), Math.log(p.hi), true, p.hiOpen);
      return ALL;
    }
    return null;
  };
  try { return walk(tree); } catch { return null; }
}
const excludesZero = (B) => Boolean(B) && (B.lo > 0 || (B.lo === 0 && B.loOpen) || B.hi < 0 || (B.hi === 0 && B.hiOpen));

// Exponentials of one rate (e^(2x) − 3eˣ + 2, 4^x − 2^x, sinh(x) − 1): with
// t = e^(u·x), always positive, the expression is a rational function of t,
// and its zeros are the positive real roots of the numerator, each giving
// x = ln(t)/u. Null when x appears outside such exponentials, or two rates
// are not whole multiples of one.
async function exponentialZeros(Algebrite, expr, v, labels) {
  let tree;
  try { tree = math.parse(String(expr)); } catch { return null; }
  // sinh, cosh and tanh in terms of e^u.
  tree = tree.transform((n) => {
    if (n.type !== 'FunctionNode' || !['sinh', 'cosh', 'tanh'].includes(n.fn?.name)) return n;
    const u = n.args[0].toString();
    const [p, m] = [`exp(${u})`, `exp(-(${u}))`];
    return math.parse(n.fn.name === 'sinh' ? `((${p}) - (${m}))/2` : n.fn.name === 'cosh' ? `((${p}) + (${m}))/2` : `((${p}) - (${m}))/((${p}) + (${m}))`);
  });
  const rates = [];
  const nodes = [];
  let other = false;
  const rateOf = (n) => {
    if (n.type === 'FunctionNode' && n.fn?.name === 'exp') return { base: 1, arg: n.args[0] };
    if (n.type === 'OperatorNode' && n.op === '^') {
      let base = n.args[0];
      while (base.type === 'ParenthesisNode') base = base.content;
      let b = null;
      try { b = base.type === 'SymbolNode' && base.name === 'e' ? Math.E : Number(base.evaluate({})); } catch { b = null; }
      if (b !== null && Number.isFinite(b) && b > 0 && b !== 1 && base.filter((m) => m.type === 'SymbolNode' && m.name === v).length === 0) return { base: Math.log(b), arg: n.args[1] };
    }
    return null;
  };
  tree.traverse((n, path, parent) => {
    if (other) return;
    const r = rateOf(n);
    if (r && r.arg.filter((m) => m.type === 'SymbolNode' && m.name === v).length) {
      const line = linearCoefficients(r.arg.toString(), v);
      if (!line || line.k === 0) { other = true; return; }
      nodes.push({ n, k: line.k * r.base, c: line.d * r.base });
      rates.push(line.k * r.base);
    }
  });
  if (!nodes.length) return null;
  // Any x outside the exponentials' arguments rules the substitution out.
  const strip = tree.transform((n) => (nodes.some((e) => e.n === n) ? math.parse('1') : n));
  if (other || strip.filter((m) => m.type === 'SymbolNode' && m.name === v).length) return null;
  const ref = rates[0];
  const ratios = rates.map((k) => {
    const r = k / ref;
    for (let q = 1; q <= 12; q += 1) if (Math.abs(Math.round(r * q) - r * q) < 1e-9) return [Math.round(r * q), q];
    return null;
  });
  if (ratios.some((r) => !r)) return null;
  const gcdInt = (x, y) => (y ? gcdInt(y, x % y) : Math.abs(x));
  const L = ratios.reduce((acc, [, q]) => (acc * q) / gcdInt(acc, q), 1);
  const G = ratios.map(([p, q]) => (p * L) / q).reduce((acc, m) => gcdInt(acc, m), 0);
  const unit = (ref / L) * G;
  const inT = tree.transform((n) => {
    const e = nodes.find((x) => x.n === n);
    if (!e) return n;
    const m = Math.round(e.k / unit);
    return math.parse(`${e.c === 0 ? '' : `exp(${e.c})*`}t^(${m})`);
  });
  const rational = safeRun(Algebrite, `simplify(${inT.toString()})`);
  if (!rational) return null;
  let top = safeRun(Algebrite, `numerator(${rational})`) || rational;
  // 1/2·t² − t − 1/2 as t² − 2t − 1: the fractions cleared.
  const P = readPolynomial(String(top), 't');
  if (P && !P.tooHigh) {
    const g = (x, y) => (y ? g(y, x % y) : x);
    const L = P.coefficients.reduce((acc, c) => (acc * c.d) / g(acc, c.d), 1n);
    if (L !== 1n) top = safeRun(Algebrite, `expand(${L}*(${top}))`) || top;
  }
  const bottom = safeRun(Algebrite, `denominator(${rational})`) || '1';
  if (!hasVariable(top, 't')) return top === '0' ? null : Object.assign([], { proof: { kind: 'exp', t: null, polynomial: null, tRoots: [] } });
  const tLabels = new Map();
  const roots = await provedZeros(Algebrite, top, 't', { labels: tLabels });
  if (!roots) return null;
  const den = evaluator(bottom, 't');
  const kept = roots.filter((t) => t > 0 && den(t) !== 0 && Number.isFinite(den(t)));
  // ln(2)/ln(2) is 1: a whole number is snapped to, and needs no label.
  const zeros = kept.map((t) => snap(Algebrite, expr, v, Math.log(t) / unit));
  const f = evaluator(expr, v);
  if (zeros.some((x) => !(Math.abs(f(x)) < 1e-9))) return null;
  // An exact root t = 1 + √2 is x = ln(1 + √2) for t = e^x, x = ln(t)/2 for
  // t = e^(2x), x = ln(t)/ln(2) for t = 2^x.
  const unitText = Math.abs(unit - 1) < 1e-12 ? '' : unitFraction(unit);
  kept.forEach((t, i) => {
    const label = tLabels.get(labelKey(t)) ?? (Number.isInteger(t) ? String(t) : null);
    if (label === null || Number.isInteger(zeros[i]) || unitText === null) return;
    labels.set(labelKey(zeros[i]), `ln(${label})${unitText ? `/${unitText}` : ''}`);
  });
  zeros.sort((p, q) => p - q);
  const tText = unitText === '' ? 'e^x' : unitText?.startsWith('ln(') ? `${unitText.slice(3, -1)}^x` : unitText ? `e^(${unitText.replace(/^\((.*)\)$/, '$1')}x)` : null;
  zeros.proof = { kind: 'exp', t: tText, polynomial: top, whole: bottom === '1', tRoots: kept.map((t) => tLabels.get(labelKey(t)) ?? (Number.isInteger(t) ? String(t) : null)) };
  return zeros;
}

// The rate of t = e^(u·x) as a divisor: 2, (1/2), or ln(2) for t = 2^x;
// null when it is none of those.
function unitFraction(u) {
  for (let q = 1; q <= 12; q += 1) {
    const p = Math.round(u * q);
    if (Math.abs(p - u * q) < 1e-9 && p > 0) return q === 1 ? String(p) : `(${p}/${q})`;
  }
  for (let b = 2; b <= 20; b += 1) if (Math.abs(u / Math.log(b) - 1) < 1e-12) return `ln(${b})`;
  return null;
}

// A·sin(kx + c) + d against a line: every zero, counted by convexity.
function waveZeros(lhs, rhs, v) {
  const bound = waveLineBound(`${lhs}=${rhs}`, v);
  if (!bound?.wave?.linearArg) return null;
  const counted = countWaveLineRoots({ ...bound.wave, lo: bound.lo, hi: bound.hi });
  if (!counted?.decided) return null;
  const zeros = counted.roots.map((r) => r.x);
  // How they were found, for the step and the worked insight.
  zeros.proof = { kind: 'wave', fn: bound.wave.fn, arg: bound.wave.arg, lo: bound.lo, hi: bound.hi, count: counted.count };
  return zeros;
}

// The points where the expression can stop being defined: the zeros of
// every denominator and of every logarithm's or even root's argument. Each
// must be a polynomial (its zeros exact); otherwise null.
function breakPoints(Algebrite, expr, v, labels) {
  const parts = [];
  try {
    math.parse(String(expr)).traverse((node) => {
      if (node.isFunctionNode && ['log', 'ln', 'log10', 'log2', 'sqrt'].includes(node.fn?.name) && node.args[0]) parts.push(node.args[0].toString());
      if (node.isOperatorNode && node.op === '/' && node.args[1]) parts.push(node.args[1].toString());
      if (node.isOperatorNode && node.op === '^' && node.args[1]) {
        try {
          const p = node.args[1].evaluate();
          if (typeof p === 'number' && (p < 0 || !Number.isInteger(p))) parts.push(node.args[0].toString());
        } catch { /* a symbolic exponent: the base must stay positive, read below */ }
      }
    });
  } catch {
    return null;
  }
  const points = [];
  for (const part of parts) {
    if (!hasVariable(part, v)) continue;
    if (!readPolynomial(part, v)) return null;
    for (const r of realRoots(Algebrite, part, v, labels)) if (!points.some((q) => Math.abs(q - r) < 1e-9)) points.push(r);
  }
  return points.sort((a, b) => a - b);
}

// Where the expression's domain ends: the zeros of every logarithm's and
// square root's argument (an even root's, generally). Each is a boundary of
// the sign chart; whether a side is in the domain is then tested, not
// assumed. Null when an argument's zeros cannot be proved.
export async function domainEdges(Algebrite, fExpr, v, labels) {
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
    if (!hasVariable(a, v)) continue;
    const zeros = await provedZeros(Algebrite, a, v, { labels });
    if (!zeros) return null;
    for (const e of zeros) if (!edges.some((q) => Math.abs(q - e) < 1e-9)) edges.push(e);
  }
  return edges;
}

// The points where the typed expression is undefined because a denominator
// is 0, before any simplification: x/x is 1 everywhere except x = 0, and
// (x² − 1)/(x − 1) is x + 1 everywhere except x = 1. Null when a
// denominator's zeros cannot be proved.
export async function denominatorZeros(Algebrite, expr, v) {
  const denominators = [];
  try {
    math.parse(String(expr)).traverse((node) => {
      if (node.isOperatorNode && node.op === '/' && node.args[1]) denominators.push(node.args[1].toString());
      if (node.isOperatorNode && node.op === '^' && node.args[1]) {
        try {
          const p = node.args[1].evaluate();
          if (typeof p === 'number' && p < 0) denominators.push(node.args[0].toString());
        } catch { /* a symbolic exponent */ }
      }
    });
  } catch {
    return [];
  }
  const points = [];
  for (const d of denominators) {
    if (!hasVariable(d, v)) continue;
    const zeros = await provedZeros(Algebrite, d, v);
    if (!zeros) return null;
    for (const z of zeros) if (!points.some((q) => Math.abs(q - z) < 1e-9)) points.push(z);
  }
  return points.sort((a, b) => a - b);
}

// The value of expr at x, by substitution of x's exact form (√2, 3/2) in
// exact arithmetic: √(x² − 2) is 0 at √2, where at the rounded 1.414214 it
// is 0.0012. Null when x has no exact form or the value is not real.
export function exactValueAt(Algebrite, expr, v, x, labels) {
  const label = labels?.get(labelKey(x));
  if (!label) return null;
  const alg = label
    .replace(/√\(([^()]*)\)/g, 'sqrt($1)').replace(/√(\d+)/g, 'sqrt($1)')
    .replace(/∛\(([^()]*)\)/g, '($1)^(1/3)').replace(/∛(\d+)/g, '($1)^(1/3)')
    .replace(/·/g, '*');
  const out = safeRun(Algebrite, `simplify(subst((${alg}), ${v}, ${expr}))`);
  if (out === null) return null;
  if (out === '0') return 0;
  if (/(?<![a-z])i(?![a-z])|infinity|nan|log\(0\)/i.test(out)) return null;
  try {
    const y = Number(math.evaluate(out));
    return Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

// The one-sided limit of expr at x (±Infinity allowed) from `side` (+1 from
// the right, −1 from the left): a number, ±Infinity, or null when it is not
// proved. Each term of the sum is c·x^p·e^(kx)·ln(x)^m (growthForm, read off
// the parse tree), and the term that dominates decides: at +∞ the largest
// (k, p, m) in that order, at 0⁺ the smallest p, then the largest m. An end
// at a ≠ 0 is moved to 0 by x = a ± t (a must be a fraction).
function limitAt(Algebrite, expr, v, x, side, labels) {
  const f = evaluator(expr, v);
  // At an end with an exact form the exact value is the limit when it is
  // real: in floating point x² − 2 at −√2 is −4·10^(−16), and √ of it is
  // undefined.
  const exact = Number.isFinite(x) ? exactValueAt(Algebrite, expr, v, x, labels) : null;
  if (exact !== null) return exact;
  if (Number.isFinite(x) && Number.isFinite(f(x))) return f(x);
  if (!Number.isFinite(x)) return growthLimitAtInfinity(inAppNotation(expr), v, x > 0 ? 1 : -1);
  const frac = fractionOf(x);
  if (!frac) return null;
  const shifted = safeRun(Algebrite, `simplify(subst((${frac}) ${side > 0 ? '+' : '-'} t, ${v}, ${expr}))`);
  return shifted ? growthLimitAtZeroRight(inAppNotation(shifted), 't') : null;
}

function fractionOf(x) {
  for (let d = 1; d <= 1000; d += 1) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-12) return `${n}/${d}`;
  }
  return null;
}


// The zeros of f′ on the open interval (a, b), complete, or null.
async function turningPoints(Algebrite, expr, v, a, b, depth) {
  const d = safeRun(Algebrite, `simplify(d(${expr}, ${v}))`);
  if (d === null) return null;
  if (!hasVariable(d, v)) return Number(math.evaluate(d)) === 0 ? null : [];
  const numerator = safeRun(Algebrite, `numerator(${d})`) || d;
  const inside = (xs) => xs.filter((x) => x > a + 1e-12 && x < b - 1e-12);
  if (neverZeroSide(inAppNotation(numerator), '0', v)) return [];
  if (excludesZero(boundsOn(numerator, v, a, b))) return [];
  if (readPolynomial(numerator, v)) return inside(realRoots(Algebrite, numerator, v));
  // x·e^x + e^x: divide out the exponential (never 0) and what is left is
  // a polynomial.
  const factors = [...new Set(String(numerator).match(/exp\([^()]*\)|\d+\^\([^()]*\)|\d+\^[a-z]/g) || [])];
  for (const factor of factors) {
    const q = safeRun(Algebrite, `numerator(simplify((${numerator})/(${factor})))`);
    if (q && !q.includes(factor) && readPolynomial(q, v)) return inside(realRoots(Algebrite, q, v));
  }
  if (structuralPeriod(inAppNotation(numerator), v)) return null;
  if (depth >= MAX_DEPTH) return null;
  const deeper = await monotoneZeros(Algebrite, numerator, v, depth + 1);
  return deeper ? inside(deeper) : null;
}

async function monotoneZeros(Algebrite, expr, v, depth) {
  const f = evaluator(expr, v);
  const labels = new Map();
  const breaks = breakPoints(Algebrite, expr, v, labels);
  if (!breaks) return null;
  const bounds = [-Infinity, ...breaks, Infinity];
  const zeros = [];
  const allTurns = [];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const [a, b] = [bounds[i], bounds[i + 1]];
    const mid = !Number.isFinite(a) && !Number.isFinite(b) ? 0 : !Number.isFinite(a) ? b - 1 : !Number.isFinite(b) ? a + 1 : (a + b) / 2;
    if (!Number.isFinite(f(mid))) continue; // not in the domain
    if (excludesZero(boundsOn(expr, v, a, b))) continue; // never 0 on this stretch
    const turns = await turningPoints(Algebrite, expr, v, a, b, depth);
    if (!turns) return null;
    const slope = evaluator(safeRun(Algebrite, `simplify(d(${expr}, ${v}))`) || 'NaN', v);
    allTurns.push(...turns);
    const points = [a, ...turns.sort((p, q) => p - q), b];
    const last = points.length - 1;
    const values = points.map((x, j) => (j === 0 ? limitAt(Algebrite, expr, v, x, 1, labels) : j === last ? limitAt(Algebrite, expr, v, x, -1, labels) : valueAt(Algebrite, expr, v, x, f)));
    for (let j = 0; j <= last; j += 1) {
      const y = values[j];
      if (y === null || Number.isNaN(y)) {
        if (j > 0 && j < last) return null;
        values[j] = null; // an end whose limit is not proved: probed below
        continue;
      }
      // A turning value next to 0 that is not 0 cannot be told from a touch.
      if (y !== 0 && Math.abs(y) <= NEAR_ZERO) return null;
    }
    for (let j = 1; j < last; j += 1) if (values[j] === 0) zeros.push(points[j]);
    for (let j = 0; j < last; j += 1) {
      const root = stretchZero(f, points[j], points[j + 1], values[j], values[j + 1], slope);
      if (root === undefined) return null;
      if (root !== null) zeros.push(snap(Algebrite, expr, v, root));
    }
  }
  zeros.sort((p, q) => p - q);
  if (depth === 0) zeros.proof = { kind: 'monotone', turns: allTurns.sort((p, q) => p - q) };
  return zeros;
}

// The zero of f on a strictly monotone stretch (p, q), whose ends have the
// values vp and vq (a limit at an end outside the domain; null when that
// limit is not proved): the root, null for none, undefined when it cannot
// be decided. A point where f has the opposite sign proves a root (the
// intermediate value theorem). That there is none needs both ends known,
// or one end where f is nearest 0: √(x² − 2) falls toward √2 from the
// left, so it stays above its value there on all of (−∞, −√2).
function stretchZero(f, p, q, vp, vq, slope) {
  if (vp === 0 || vq === 0) return null; // strictly monotone away from a zero
  const sp = vp === null ? null : Math.sign(vp);
  const sq = vq === null ? null : Math.sign(vq);
  if (sp !== null && sq !== null && sp === sq) return null;
  const ref = Number.isFinite(p) && Number.isFinite(q) ? (p + q) / 2 : Number.isFinite(p) ? p + 1 : Number.isFinite(q) ? q - 1 : 0;
  // f′ keeps one sign on the stretch: rising, the values lie above f(p)
  // and below f(q); falling, the other way round.
  const rising = Math.sign(slope(ref));
  if (rising !== 0 && Number.isFinite(rising)) {
    if (sp !== null && sq === null && sp === rising) return null;
    if (sq !== null && sp === null && sq === -rising) return null;
  }
  // A point toward `end` where f has sign `want`: the end itself when f is
  // defined there.
  const probe = (end, want) => {
    const ok = (y) => Number.isFinite(y) && Math.sign(y) === want;
    if (Number.isFinite(end) && ok(f(end))) return end;
    for (let k = 0; k < 200; k += 1) {
      const t = Number.isFinite(end) ? end + (ref - end) * 2 ** (-k) : ref + Math.sign(end) * 2 ** (k - 10);
      if (t <= Math.min(p, q) || t >= Math.max(p, q)) continue;
      if (ok(f(t))) return t;
    }
    return null;
  };
  let u;
  let w;
  if (sp !== null) {
    u = probe(p, sp);
    w = probe(q, -sp);
  } else if (sq !== null) {
    w = probe(q, sq);
    u = probe(p, -sq);
  } else {
    // Neither end known: one sign near p and the other near q, either way.
    for (const sign of [1, -1]) {
      u = probe(p, sign);
      w = u === null ? null : probe(q, -sign);
      if (u !== null && w !== null) break;
    }
  }
  if (u === null || w === null) return undefined;
  const s = Math.sign(f(u));
  let [lo, hi] = [u, w];
  for (let n = 0; n < 400 && Math.abs(hi - lo) > 1e-15 * (1 + Math.abs(lo)); n += 1) {
    const m = (lo + hi) / 2;
    if (Math.sign(f(m)) === s) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
