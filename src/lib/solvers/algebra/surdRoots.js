// Exact roots of a polynomial with one square root in its coefficients, worked
// in numbers of the form a + b√n with a, b exact fractions (1.76.1). Algebrite
// wrote the roots of x² = 3 + 2√2 as i·(−3 − 2√2)^(1/2) and a double root of a
// cubic as −24/(22 − 12√2) + 22√2/(22 − 12√2). Here:
// - a quadratic by the formula, its square root undone when it has one in the
//   field: √(u + v√n) = √p + √q with p, q = (u ± s)/2, s² = u² − v²n;
// - a cubic with a repeated root by the factor it shares with its derivative.
// Every root is substituted back in exact arithmetic before it is returned.
// Anything else is null: the caller keeps its own answer.

import { math, mark } from '../solverUtils.js';

const gcd = (a, b) => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const rat = (m, d = 1n) => {
  const g = gcd(m, d) || 1n;
  const s = d < 0n ? -1n : 1n;
  return { m: (s * m) / g, d: (s * d) / g };
};
const ZERO = rat(0n);
const ONE = rat(1n);
const add = (p, q) => rat(p.m * q.d + q.m * p.d, p.d * q.d);
const neg = (p) => rat(-p.m, p.d);
const sub = (p, q) => add(p, neg(q));
const mul = (p, q) => rat(p.m * q.m, p.d * q.d);
const div = (p, q) => rat(p.m * q.d, p.d * q.m);
const isZero = (p) => p.m === 0n;
const toNumber = (p) => Number(p.m) / Number(p.d);

// The whole-number square root, by Newton's method in integers: a floating
// point seed is off by more than 1 past 2^53.
export function isqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

// n = s²·t with t square-free, or null past what trial division can settle.
function squareFree(n) {
  let [s, t, rest] = [1n, 1n, n];
  for (let p = 2n; p * p <= rest && p < 100000n; p += 1n) {
    let k = 0;
    while (rest % p === 0n) { rest /= p; k += 1; }
    s *= p ** BigInt(k >> 1);
    if (k % 2) t *= p;
  }
  if (rest > 1n) {
    if (rest >= 10000000000n) {
      const r = isqrt(rest);
      if (r * r === rest) return { s: s * r, t };
      return null;
    }
    t *= rest;
  }
  return { s, t };
}

// The square root of a rational: { c } when rational, { c, t } for c√t.
function rootOf(r) {
  if (r.m < 0n) return null;
  if (r.m === 0n) return { c: ZERO, t: 1n };
  const f = squareFree(r.m * r.d);
  return f && { c: rat(f.s, r.d), t: f.t };
}

const makeField = (n) => {
  const E = (a, b = ZERO) => ({ a, b });
  const F = {
    n, E,
    add: (p, q) => E(add(p.a, q.a), add(p.b, q.b)),
    sub: (p, q) => E(sub(p.a, q.a), sub(p.b, q.b)),
    neg: (p) => E(neg(p.a), neg(p.b)),
    mul: (p, q) => E(add(mul(p.a, q.a), mul(mul(p.b, q.b), rat(n))), add(mul(p.a, q.b), mul(p.b, q.a))),
    div: (p, q) => {
      const norm = sub(mul(q.a, q.a), mul(mul(q.b, q.b), rat(n)));
      return F.mul(p, E(div(q.a, norm), neg(div(q.b, norm))));
    },
    isZero: (p) => isZero(p.a) && isZero(p.b),
    value: (p) => toNumber(p.a) + toNumber(p.b) * Math.sqrt(Number(n)),
  };
  return F;
};

// The polynomial as coefficients in the field, lowest power first, or null.
function readPoly(node, v, state) {
  const F = () => state.field;
  const trim = (p) => { const out = [...p]; while (out.length > 1 && F().isZero(out[out.length - 1])) out.pop(); return out; };
  const constant = (c) => [c];
  const padd = (p, q, f = 'add') => {
    const out = [];
    const Z = F().E(ZERO);
    for (let i = 0; i < Math.max(p.length, q.length); i += 1) out.push(F()[f](p[i] ?? Z, q[i] ?? Z));
    return trim(out);
  };
  const pmul = (p, q) => {
    const out = Array.from({ length: p.length + q.length - 1 }, () => F().E(ZERO));
    p.forEach((u, i) => q.forEach((w, j) => { out[i + j] = F().add(out[i + j], F().mul(u, w)); }));
    return trim(out);
  };
  const surd = (r) => {
    const root = rootOf(r);
    if (!root) return null;
    if (root.t === 1n) return constant(F().E(root.c));
    if (state.n !== null && state.n !== root.t) return null;
    if (state.n === null) { state.n = root.t; state.field = makeField(root.t); }
    return constant(F().E(ZERO, root.c));
  };
  const rational = (n) => {
    const p = walk(n);
    return p && p.length === 1 && isZero(p[0].b) ? p[0].a : null;
  };
  const walk = (n) => {
    switch (n.type) {
      case 'ParenthesisNode': return walk(n.content);
      case 'ConstantNode': {
        const value = Number(n.value);
        if (!Number.isSafeInteger(value)) return null;
        return constant(F().E(rat(BigInt(value))));
      }
      case 'SymbolNode': return n.name === v ? [F().E(ZERO), F().E(ONE)] : null;
      case 'FunctionNode': {
        if (n.name !== 'sqrt' || n.args.length !== 1) return null;
        const r = rational(n.args[0]);
        return r && surd(r);
      }
      case 'OperatorNode': {
        const [l, r] = n.args;
        if (n.args.length === 1) {
          const p = walk(l);
          return n.op === '-' && p ? p.map(F().neg) : n.op === '+' ? p : null;
        }
        if (n.op === '^') {
          const half = r.type === 'ParenthesisNode' ? r.content : r;
          if (half.type === 'OperatorNode' && half.op === '/' && Number(half.args[0].value) === 1 && Number(half.args[1].value) === 2) {
            const base = rational(l);
            return base && surd(base);
          }
          const k = Number(half.value);
          if (half.type !== 'ConstantNode' || !Number.isInteger(k) || k < 0 || k > 12) return null;
          const base = walk(l);
          if (!base) return null;
          let out = constant(F().E(ONE));
          for (let i = 0; i < k; i += 1) out = pmul(out, base);
          return out;
        }
        const p = walk(l);
        const q = walk(r);
        if (!p || !q) return null;
        if (n.op === '+') return padd(p, q);
        if (n.op === '-') return padd(p, q, 'sub');
        if (n.op === '*') return pmul(p, q);
        if (n.op === '/') {
          if (q.length !== 1 || F().isZero(q[0])) return null;
          return p.map((c) => F().div(c, q[0]));
        }
        return null;
      }
      default: return null;
    }
  };
  // The radical is met on the way, so the field is settled in a first pass.
  if (!walk(node) || state.n === null) return null;
  return walk(node);
}

// The square root of a field element, inside the field, or null.
function sqrtInField(F, x) {
  if (F.value(x) < 0) return null;
  if (isZero(x.b)) {
    const r = rootOf(x.a);
    if (!r) return null;
    if (r.t === 1n) return F.E(r.c);
    if (r.t === F.n) return F.E(ZERO, r.c);
    return null;
  }
  // √(u + v√n) = √p ± √q, with p, q = (u ± s)/2 and s² = u² − v²n.
  const norm = rootOf(sub(mul(x.a, x.a), mul(mul(x.b, x.b), rat(F.n))));
  if (!norm || norm.t !== 1n) return null;
  const halve = (r) => div(r, rat(2n));
  const inField = (r) => {
    if (r.m < 0n) return null;
    return sqrtInField(F, F.E(r));
  };
  const p = inField(halve(add(x.a, norm.c)));
  const q = inField(halve(sub(x.a, norm.c)));
  if (!p || !q) return null;
  for (const c of [F.add(p, q), F.sub(p, q), F.sub(q, p)]) {
    if (F.value(c) >= 0 && F.isZero(F.sub(F.mul(c, c), x))) return c;
  }
  return null;
}

// a + b√n as a textbook writes it.
function textOf(F, x) {
  const n = F.n;
  if (isZero(x.b)) return x.a.d === 1n ? String(x.a.m) : `${x.a.m}/${x.a.d}`;
  const d = (x.a.d * x.b.d) / gcd(x.a.d, x.b.d);
  const a = (x.a.m * d) / x.a.d;
  const b = (x.b.m * d) / x.b.d;
  const abs = b < 0n ? -b : b;
  const coefficient = abs === 1n ? `√${n}` : `${abs}√${n}`;
  if (a === 0n) {
    const body = `${b < 0n ? '-' : ''}${coefficient}`;
    return d === 1n ? body : `${body}/${d}`;
  }
  const body = `${a} ${b < 0n ? '-' : '+'} ${coefficient}`;
  return d === 1n ? body : `(${body})/${d}`;
}

const evalAt = (F, poly, x) => poly.reduceRight((sum, c) => F.add(F.mul(sum, x), c), F.E(ZERO));

function gcdPoly(F, p, q) {
  const trim = (u) => { const out = [...u]; while (out.length > 1 && F.isZero(out[out.length - 1])) out.pop(); return out; };
  let [a, b] = [trim(p), trim(q)];
  while (b.length > 1 || !F.isZero(b[0])) {
    const r = [...a];
    while (r.length >= b.length && !(r.length === 1 && F.isZero(r[0]))) {
      const lead = F.div(r[r.length - 1], b[b.length - 1]);
      const shift = r.length - b.length;
      b.forEach((c, i) => { r[i + shift] = F.sub(r[i + shift], F.mul(lead, c)); });
      r.pop();
      if (r.length === 0) { r.push(F.E(ZERO)); break; }
    }
    [a, b] = [b, trim(r)];
  }
  return a.map((c) => F.div(c, a[a.length - 1]));
}

const derivativeOf = (F, p) => (p.length === 1 ? [F.E(ZERO)] : p.slice(1).map((c, i) => F.mul(F.E(rat(BigInt(i + 1))), c)));

// p ÷ d, where d is known to divide p.
function quotient(F, p, d) {
  const r = [...p];
  const out = [];
  while (r.length >= d.length) {
    const lead = F.div(r[r.length - 1], d[d.length - 1]);
    out.unshift(lead);
    const shift = r.length - d.length;
    d.forEach((c, i) => { r[i + shift] = F.sub(r[i + shift], F.mul(lead, c)); });
    r.pop();
  }
  return out;
}

// The roots of a polynomial of degree 1 or 2 with no repeated root, or null.
function simpleRoots(F, p) {
  if (p.length === 2) return [F.div(F.neg(p[0]), p[1])];
  if (p.length !== 3) return null;
  const [c, b, a] = p;
  const root = sqrtInField(F, F.sub(F.mul(b, b), F.mul(F.mul(F.E(rat(4n)), a), c)));
  if (!root) return null;
  const two = F.mul(F.E(rat(2n)), a);
  return [F.div(F.sub(F.neg(b), root), two), F.div(F.add(F.neg(b), root), two)];
}

// { roots: [{ text, value, multiplicity }], steps } or null.
export function exactSurdRoots(target, v) {
  let tree;
  try { tree = math.parse(target); } catch { return null; }
  const state = { n: null, field: makeField(1n) };
  let poly;
  try { poly = readPoly(tree, v, state); } catch { return null; }
  if (!poly || state.n === null) return null;
  const F = state.field;
  const degree = poly.length - 1;
  if (degree < 2 || degree > 4) return null;
  const field = `a + b√${F.n}`;
  const found = [];
  const steps = [];
  if (degree === 2) {
    const [c, b, a] = poly;
    const D = F.sub(F.mul(b, b), F.mul(F.mul(F.E(rat(4n)), a), c));
    const two = F.mul(F.E(rat(2n)), a);
    steps.push(`Work exactly in numbers of the form ${mark(field)}: the discriminant is ${mark(textOf(F, D))}.`);
    if (F.isZero(D)) found.push({ x: F.div(F.neg(b), two), multiplicity: 2 });
    else {
      const root = sqrtInField(F, D);
      if (!root) return null;
      if (!isZero(D.b)) steps.push(`It has an exact square root: ${mark(`√(${textOf(F, D)}) = ${textOf(F, root)}`)}, as squaring ${mark(textOf(F, root))} shows.`);
      found.push({ x: F.div(F.sub(F.neg(b), root), two), multiplicity: 1 }, { x: F.div(F.add(F.neg(b), root), two), multiplicity: 1 });
    }
  } else {
    const shared = gcdPoly(F, poly, derivativeOf(F, poly));
    if (shared.length === 1) return null;
    // Dividing out what the polynomial shares with its derivative leaves each
    // root once; how often it repeats is read off the derivatives there.
    const simple = quotient(F, poly, shared);
    const roots = simpleRoots(F, simple);
    if (!roots) return null;
    for (const x of roots) {
      let multiplicity = 0;
      let d = poly;
      while (d.length > 1 && F.isZero(evalAt(F, d, x))) { multiplicity += 1; d = derivativeOf(F, d); }
      found.push({ x, multiplicity });
    }
    steps.push(`Work exactly in numbers of the form ${mark(field)}: the polynomial shares a factor with its derivative, so it has a repeated root.`);
  }
  // Proved by substitution in exact arithmetic, not by rounding.
  if (!found.every(({ x }) => F.isZero(evalAt(F, poly, x)))) return null;
  if (found.reduce((sum, r) => sum + r.multiplicity, 0) !== degree) return null;
  const roots = found
    .map(({ x, multiplicity }) => ({ text: textOf(F, x), value: F.value(x), multiplicity }))
    .sort((p, q) => p.value - q.value);
  return { roots, steps };
}
