// Trig expressions on the unit circle, in exact arithmetic: sin and cos of
// multiples of θ written in S = sin θ and C = cos θ (trigInSC), and with
// t = tan(θ/2), S = 2t/(1 + t²) and C = (1 − t²)/(1 + t²), so a polynomial in
// S and C becomes a rational function of t whose numerator's degree is read
// off the parse tree (degreeInT). That proves identities (proveTrigIdentity,
// 1.65.0) and finds every zero of a trig polynomial on one turn
// (circleZeros, 1.66.0: the periodic inequalities). Moved out of
// trigonometrySolver.js so the inequality solver can use it.

import { math, rewriteReciprocalTrig } from '../solverUtils.js';
import { createMath } from '../../mathInstance.js';

// sin(mθ), cos(mθ) (|m| ≤ 4) and sin/cos(θ + kπ/2) in S = sin θ, C = cos θ.
export function trigInSC(expression, variable) {
  const S = 'S';
  const C = 'C';
  const multiple = { 1: [S, C] };
  for (let m = 2; m <= 4; m += 1) {
    const [sp, cp] = multiple[m - 1];
    multiple[m] = [`((${sp})*${C} + (${cp})*${S})`, `((${cp})*${C} - (${sp})*${S})`];
  }
  const sinCos = (arg) => {
    const at = (x) => { try { return Number(arg.evaluate({ [variable]: x })); } catch { return NaN; } };
    const m = at(1) - at(0);
    const shift = at(0);
    if (!(Number.isInteger(m) && m !== 0 && Math.abs(m) <= 4 && Math.abs(at(2) - at(0) - 2 * m) < 1e-12)) return null;
    const q = shift / (Math.PI / 2);
    if (Math.abs(q - Math.round(q)) > 1e-12) return null;
    let [sn, cs] = multiple[Math.abs(m)];
    if (m < 0) sn = `(-(${sn}))`;
    // sin(u + kπ/2), cos(u + kπ/2): a quarter turn rotates (sin, cos).
    for (let k = ((Math.round(q) % 4) + 4) % 4; k > 0; k -= 1) [sn, cs] = [cs, `(-(${sn}))`];
    return [sn, cs];
  };
  let tree;
  try { tree = math.parse(rewriteReciprocalTrig(String(expression))); } catch { return null; }
  let ok = true;
  const out = tree.transform((n) => {
    if (n.type === 'FunctionNode' && ['sin', 'cos', 'tan'].includes(n.fn?.name) && n.args.length === 1) {
      const sc = sinCos(n.args[0]);
      if (!sc) { ok = false; return n; }
      const text = n.fn.name === 'sin' ? sc[0] : n.fn.name === 'cos' ? sc[1] : `((${sc[0]})/(${sc[1]}))`;
      return math.parse(text);
    }
    return n;
  });
  if (!ok || out.filter((n) => n.type === 'SymbolNode' && n.name === variable).length) return null;
  return out.toString();
}

// Is a = b as functions of θ, wherever both are defined? In S and C both are
// rational, and on the circle S = 2t/(1 + t²), C = (1 − t²)/(1 + t²), so a − b
// is a rational function R(t) whose numerator has degree at most d, read off
// the parse tree. If R is exactly 0 (fractions, not floats) at d + 1 rational
// t, its numerator is the zero polynomial: the identity holds (1.65.0; it
// was "confirmed numerically at several values").
export const exactMath = createMath({ number: 'Fraction' });
export function degreeInT(node) {
  let n = node;
  while (n.type === 'ParenthesisNode') n = n.content;
  if (n.type === 'ConstantNode') return [0, 0];
  if (n.type === 'SymbolNode') return n.name === 'S' || n.name === 'C' ? [2, 2] : null;
  if (n.type === 'OperatorNode') {
    if (n.fn === 'unaryMinus' || n.fn === 'unaryPlus') return degreeInT(n.args[0]);
    const [a, b] = n.args.map(degreeInT);
    if (!a || (n.args.length > 1 && !b)) return null;
    if (n.op === '+' || n.op === '-') return [Math.max(a[0] + b[1], b[0] + a[1]), a[1] + b[1]];
    if (n.op === '*') return [a[0] + b[0], a[1] + b[1]];
    if (n.op === '/') return [a[0] + b[1], a[1] + b[0]];
    if (n.op === '^') {
      const k = Number(n.args[1].toString());
      if (!Number.isInteger(k)) return null;
      return k >= 0 ? [k * a[0], k * a[1]] : [-k * a[1], -k * a[0]];
    }
  }
  return null;
}
export function proveTrigIdentity(Algebrite, a, b, variable) {
  const A = trigInSC(a, variable);
  const B = trigInSC(b, variable);
  if (!A || !B) return false;
  try {
    const diff = `(${A}) - (${B})`;
    const bound = degreeInT(math.parse(diff));
    if (!bound || bound[0] > 200) return false;
    const code = exactMath.parse(diff).compile();
    let zeros = 0;
    for (let i = 1; i < 4 * bound[0] + 40 && zeros <= bound[0]; i += 1) {
      const t = exactMath.fraction(i, 7);
      const one = exactMath.fraction(1);
      const den = one.add(t.mul(t));
      const scope = { S: t.mul(2).div(den), C: one.sub(t.mul(t)).div(den) };
      let value;
      try { value = code.evaluate(scope); } catch { continue; } // a pole of a or b
      if (exactMath.typeOf(value) !== 'Fraction') return false;
      if (!value.equals(0)) return false;
      zeros += 1;
    }
    if (zeros <= bound[0]) return false;
    // t = tan(x/2) misses x = π + 2πn, the point (S, C) = (0, −1): there the
    // two sides are compared directly, when both are defined (1.65.0 review).
    try {
      const at = code.evaluate({ S: exactMath.fraction(0), C: exactMath.fraction(-1) });
      if (exactMath.typeOf(at) === 'Fraction' && !at.equals(0)) return false;
    } catch { /* one side is undefined at x = π: nothing to compare there */ }
    return true;
  } catch {
    return false;
  }
}

// Where the original is undefined but the simplified form is not, read off
// exactly: on the circle, cos(x) = 0 is (S, C) = (±1, 0) and sin(x) = 0 is
// (0, ±1), so evaluating both in exact fractions there decides it.
// tan(x)·cos(x) = sin(x) only where cos(x) ≠ 0; tan(x) + cot(x) = 2/sin(2x)
// loses nothing (1.65.0).
export function lostDomain(original, simplified, variable) {
  const A = trigInSC(original, variable);
  const B = trigInSC(simplified, variable);
  if (!A || !B) return null;
  const defined = (text, S, C) => {
    try {
      const v = exactMath.evaluate(text, { S: exactMath.fraction(S), C: exactMath.fraction(C) });
      return exactMath.typeOf(v) === 'Fraction';
    } catch {
      return false;
    }
  };
  const loses = (points) => points.some(([S, C]) => !defined(A, S, C) && defined(B, S, C));
  if (loses([[1, 0], [-1, 0]])) return `cos(${variable}) = 0`;
  if (loses([[0, 1], [0, -1]])) return `sin(${variable}) = 0`;
  return null;
}

// Every zero of f(x), a polynomial in sin and cos of rational multiples of
// x (no division by them), on one turn: θ = g·x for the largest g that makes
// every multiple a whole number of θ, N(t) = f·(1 + t²)^k is a polynomial of
// degree at most d in t = tan(θ/2), found exactly from its values at d + 1
// rational t, and its real roots come from the exact root finder (Sturm
// counting, so none is missed); θ = π, which no t reaches, is checked on its
// own. Returns the zeros as x in (−π/g, π/g], or null when f is not of that
// form. The grid this replaces sampled 1440 points a period (1.66.0).
export function circleZeros(expression, variable, { readPolynomial, allRoots }) {
  let tree;
  try { tree = math.parse(rewriteReciprocalTrig(String(expression))); } catch { return null; }
  const slopes = [];
  let linear = true;
  tree.traverse((n) => {
    if (n.type !== 'FunctionNode' || !['sin', 'cos', 'tan'].includes(n.fn?.name)) return;
    const at = (x) => { try { return Number(n.args[0].evaluate({ [variable]: x })); } catch { return NaN; } };
    const m = at(1) - at(0);
    if (!Number.isFinite(m) || Math.abs(at(2) - at(0) - 2 * m) > 1e-12) linear = false;
    else slopes.push(m);
  });
  if (!linear || !slopes.length) return null;
  const asFraction = (m) => {
    for (let q = 1; q <= 12; q += 1) if (Math.abs(Math.round(m * q) - m * q) < 1e-12) return [Math.abs(Math.round(m * q)), q];
    return null;
  };
  const fracs = slopes.map(asFraction);
  if (fracs.some((f) => !f || f[0] === 0)) return null;
  const gcdInt = (a, b) => (b ? gcdInt(b, a % b) : a);
  const lcmInt = (a, b) => (a / gcdInt(a, b)) * b;
  const g = fracs.reduce((acc, [p]) => gcdInt(acc, p), 0) / fracs.reduce((acc, [, q]) => lcmInt(acc, q), 1);
  // x = θ/g, so every argument is a whole multiple of θ.
  const inTheta = tree.transform((n) => (n.type === 'SymbolNode' && n.name === variable ? math.parse(`(u / ${g})`) : n));
  const A = trigInSC(inTheta.toString(), 'u');
  if (!A) return null;
  let node;
  try { node = math.parse(A); } catch { return null; }
  // A polynomial in S and C only: a division by them could vanish.
  const dividesByTrig = node.filter((n) => n.type === 'OperatorNode' && (
    (n.op === '/' && n.args[1].filter((c) => c.type === 'SymbolNode' && (c.name === 'S' || c.name === 'C')).length)
    || (n.op === '^' && Number(n.args[1].toString()) < 0)
  )).length > 0;
  if (dividesByTrig) return null;
  const bound = degreeInT(node);
  if (!bound || bound[0] > 60) return null;
  const [d, k] = [bound[0], bound[1] / 2];
  const code = exactMath.parse(A).compile();
  const one = exactMath.fraction(1);
  const valueAt = (t) => {
    const den = one.add(t.mul(t));
    const v = code.evaluate({ S: t.mul(2).div(den), C: one.sub(t.mul(t)).div(den) });
    if (exactMath.typeOf(v) !== 'Fraction') throw new Error('not exact');
    return v.mul(den.pow(k));
  };
  // N(t) from d + 1 values (Lagrange), then checked at one more.
  const ts = Array.from({ length: d + 1 }, (_, i) => exactMath.fraction(i, 7));
  let ys;
  try { ys = ts.map(valueAt); } catch { return null; }
  let coeffs = Array.from({ length: d + 1 }, () => exactMath.fraction(0));
  for (let i = 0; i <= d; i += 1) {
    let basis = [one];
    let scale = one;
    for (let j = 0; j <= d; j += 1) {
      if (j === i) continue;
      const next = Array.from({ length: basis.length + 1 }, () => exactMath.fraction(0));
      basis.forEach((c, n) => { next[n + 1] = next[n + 1].add(c); next[n] = next[n].sub(c.mul(ts[j])); });
      basis = next;
      scale = scale.mul(ts[i].sub(ts[j]));
    }
    const w = ys[i].div(scale);
    basis.forEach((c, n) => { coeffs[n] = coeffs[n].add(c.mul(w)); });
  }
  const check = exactMath.fraction(d + 3, 5);
  const fromCoeffs = coeffs.reduceRight((acc, c) => acc.mul(check).add(c), exactMath.fraction(0));
  try { if (!fromCoeffs.equals(valueAt(check))) return null; } catch { return null; }
  while (coeffs.length > 1 && coeffs[coeffs.length - 1].equals(0)) coeffs = coeffs.slice(0, -1);
  if (coeffs.every((c) => c.equals(0))) return null; // f is 0 everywhere
  const zeros = [];
  if (coeffs.length > 1) {
    const text = coeffs.map((c, n) => `(${c.toFraction()})*t^${n}`).join(' + ');
    const P = readPolynomial(text, 't');
    if (!P || P.tooHigh) return null;
    let real;
    try { real = allRoots(P).real; } catch { return null; }
    for (const r of real) zeros.push((2 * Math.atan(r.value)) / g);
  }
  // θ = π: (S, C) = (0, −1).
  try {
    const atPi = code.evaluate({ S: exactMath.fraction(0), C: exactMath.fraction(-1) });
    if (exactMath.typeOf(atPi) === 'Fraction' && atPi.equals(0)) zeros.push(Math.PI / g);
  } catch { /* undefined at θ = π */ }
  return zeros.sort((a, b) => a - b);
}
