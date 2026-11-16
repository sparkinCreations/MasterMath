// A limit at ±∞, proved or not claimed (1.76.4). Shared by the improper
// integral (lim F(t) as t → ∞) and the horizontal asymptotes of a function:
// both decided it from samples at powers of ten, and a function with a
// whole-number period is the same at every one of them — ∫₀^∞ cos(πx) dx was
// "= 0" and sin(πx) had the "horizontal asymptote y = 0". Samples may refute
// a claim, never establish one.
//
// Routes, in order:
//   1. growth rates of c·t^p·e^(kt)·ln(t)^m terms (limits/growth.js), on the
//      expression and on it with products distributed;
//   2. the limit laws from the parse tree (limits/laws.js): arctan → π/2,
//      ln(ln t) → ∞, √(t + 1) → ∞, erf → 1;
//   3. f = Q + R: Q the sum of the terms that are themselves periodic
//      (structuralPeriod of the term; e^(−t)·sin(t) is not, it is a term of
//      R), R the rest, whose limit is proved term by term — its growth
//      form, the limit laws, logarithms of polynomials together, or the
//      squeeze theorem for a decaying factor times a bounded periodic one
//      (e^(−t)·sin(t) → 0). Then: a non-constant periodic Q added to an R
//      with a proved finite limit has no limit (a periodic function has one
//      only if it is constant; Q is shown not constant by two different
//      values, a refutation, which a sample can give); a bounded periodic Q
//      added to an R → ±∞ goes to ±∞. Nothing else is claimed.

import { math, lnify, splitTerms, structuralPeriod, definedEverywhere } from '../solverUtils.js';
import { growthLimitAtInfinity } from './growth.js';
import { tryLimitLaws, leadingPower } from './laws.js';
import { longLiteral } from './steps.js';

// The notation growthForm reads: √u as sqrt(u), |u| as (u) (it is positive
// far out on the right; at −∞ a logarithm is refused anyway).
export function growthReadable(F) {
  return lnify(String(F))
    .replace(/π/g, 'pi')
    .replace(/(?<![a-z])ln\(/g, 'log(')
    .replace(/\|([^|]+)\|/g, '($1)')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√([a-z0-9]+)/gi, 'sqrt($1)');
}

// A periodic expression defined everywhere is continuous, so bounded.
const boundedPeriodic = (text, v) => {
  const p = structuralPeriod(text, v);
  return Boolean(p && p > 0 && definedEverywhere(text, v));
};

// A factor bounded for every real value: a bounded periodic expression, or
// sin, cos, arctan, tanh or erf of anything defined everywhere (sin(x²) is
// not periodic, but |sin| ≤ 1 all the same).
const BOUNDED = new Set(['sin', 'cos', 'atan', 'arctan', 'tanh', 'erf']);
function boundedFactor(text, v) {
  if (boundedPeriodic(text, v)) return true;
  let n;
  try { n = math.parse(String(text)); } catch { return false; }
  while (n.type === 'ParenthesisNode') n = n.content;
  return n.type === 'FunctionNode' && BOUNDED.has(n.fn.name) && n.args.length === 1 && definedEverywhere(n.args[0].toString(), v);
}

const DISTRIBUTE = ['n1*(n2+n3) -> n1*n2 + n1*n3', '(n1+n2)*n3 -> n1*n3 + n2*n3', 'n1*(n2-n3) -> n1*n2 - n1*n3', '(n1-n2)*n3 -> n1*n3 - n2*n3', '-(n1+n2) -> -n1 - n2', '(n1+n2)/n3 -> n1/n3 + n2/n3', '(n1-n2)/n3 -> n1/n3 - n2/n3'];

const valueAt = (text, v, x) => {
  try {
    const y = math.evaluate(text, { [v]: x });
    return typeof y === 'number' ? y : NaN;
  } catch {
    return NaN;
  }
};

// c·ln|P| for a power-like P (a polynomial, a root of one), read off P's
// leading term c₀·t^p: P/(c₀·t^p) → 1, so c·ln|P| = c·p·ln(t) + c·ln|c₀| +
// o(1). Returns { lnCoef: c·p, constant: c·ln|c₀| } or null. A sum of these
// (a partial-fraction antiderivative, ½ln|t − 1| − ½ln|t + 1|) is ∞ − ∞
// term by term; together it is (Σ c·p)·ln(t) + a constant (1.76.4).
function logOfPowerLike(term, v, sign) {
  let node;
  try { node = math.parse(String(term).replace(/π/g, 'pi')); } catch { return null; }
  const factors = [];
  const flatten = (n, inv) => {
    while (n.type === 'ParenthesisNode') n = n.content;
    if (n.type === 'OperatorNode' && n.op === '*') n.args.forEach((a) => flatten(a, inv));
    else if (n.type === 'OperatorNode' && n.op === '/') { flatten(n.args[0], inv); flatten(n.args[1], !inv); }
    else if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { factors.push({ node: math.parse('-1'), inv: false }); flatten(n.args[0], inv); }
    else factors.push({ node: n, inv });
  };
  flatten(node, false);
  const mentions = (n) => n.filter((x) => x.type === 'SymbolNode' && x.name === v).length > 0;
  const logs = factors.filter((f) => mentions(f.node));
  if (logs.length !== 1 || logs[0].inv) return null;
  const L = logs[0].node;
  if (L.type !== 'FunctionNode' || !['log', 'ln'].includes(L.fn.name) || L.args.length !== 1) return null;
  let arg = L.args[0];
  while (arg.type === 'ParenthesisNode') arg = arg.content;
  const absolute = arg.type === 'FunctionNode' && arg.fn.name === 'abs';
  if (absolute) arg = arg.args[0];
  let c = 1;
  const cParts = [];
  for (const f of factors) {
    if (f === logs[0]) continue;
    let k;
    try { k = Number(f.node.evaluate({})); } catch { return null; }
    if (!Number.isFinite(k)) return null;
    c *= f.inv ? 1 / k : k;
    cParts.push(f.inv ? `1/(${f.node.toString()})` : `(${f.node.toString()})`);
  }
  // At −∞ by t = −x: P(−t) ~ c₀·(−1)^p·t^p.
  let probe = arg;
  if (sign < 0) probe = arg.transform((n) => (n.type === 'SymbolNode' && n.name === v ? math.parse(`(-${v})`) : n));
  // The exact power, computed without rounding. Every exponent and root in
  // the argument must be a whole number or a fraction whose denominator is
  // a power of two (x², √x, x^(3/4)), and the products of their numerators
  // and of their denominators at most 2²⁰ each. The leading power is built
  // from these by sums and products alone, so every value along the way is
  // n/2^k with n far below 2⁵³: a double holds each one exactly, and the
  // computed power is the true one, not a rounding of it. Anything else —
  // x^(1 + 10⁻¹⁶), x·x^(1/10¹⁶), a cube root, (((x^1000)^1000)^1000)^1000 —
  // is not cancelled on.
  const LIMIT = 2 ** 20;
  const powerOfTwo = (d) => Number.isInteger(d) && d >= 1 && (d & (d - 1)) === 0;
  const intNode = (x) => x.type === 'ConstantNode' && Number.isInteger(Number(x.value)) && Math.abs(Number(x.value)) <= LIMIT;
  const dyadicOf = (n) => {
    while (n.type === 'ParenthesisNode') n = n.content;
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return dyadicOf(n.args[0]);
    if (intNode(n)) return { num: Math.max(1, Math.abs(Number(n.value))), den: 1 };
    if (n.type === 'OperatorNode' && n.op === '/' && n.args.every(intNode) && powerOfTwo(Math.abs(Number(n.args[1].value)))) {
      return { num: Math.max(1, Math.abs(Number(n.args[0].value))), den: Math.abs(Number(n.args[1].value)) };
    }
    return null;
  };
  let N = 1;
  let D = 1;
  for (const n of arg.filter((x) => (x.type === 'OperatorNode' && x.op === '^') || x.type === 'FunctionNode')) {
    let q = { num: 1, den: 1 };
    if (n.type === 'OperatorNode') q = dyadicOf(n.args[1]);
    else if (n.fn.name === 'sqrt') q = { num: 1, den: 2 };
    else if (['cbrt', 'nthRoot', 'pow', 'exp'].includes(n.fn.name)) q = null;
    if (!q) return null;
    N *= q.num;
    D *= q.den;
    if (N > LIMIT || D > LIMIT) return null;
  }
  // The coefficients are combined as doubles too, so they must be exact
  // as well: whole-number literals up to 2²⁰, a division only by a power of
  // two, and no arithmetic between constants. ((1 + 10⁻¹⁶) − 1)·x² would
  // lose its x² term, and x/10 + x/10 + x/10 − 3x/10 its rounding.
  // The product of every literal's size and every divisor is capped at 2⁴⁰
  // as well, so no coefficient underflows or loses a bit (x²/2²⁰/2²⁰/… is
  // 0 in a double after 54 divisions).
  const hasV = (n) => n.filter((x) => x.type === 'SymbolNode' && x.name === v).length > 0;
  let budget = 1;
  const spend = (k) => { budget *= Math.max(1, Math.abs(k)); return budget <= 2 ** 40; };
  const exactCoefficients = (n) => {
    while (n.type === 'ParenthesisNode') n = n.content;
    if (n.type === 'ConstantNode') return intNode(n) && spend(Number(n.value));
    if (n.type === 'SymbolNode') return true;
    if (n.type === 'FunctionNode') return n.args.every(exactCoefficients);
    if (n.type !== 'OperatorNode') return false;
    if (n.op === '^') return exactCoefficients(n.args[0]);
    if (n.fn === 'unaryMinus' || n.fn === 'unaryPlus') return exactCoefficients(n.args[0]);
    if (!hasV(n)) return false;
    if (n.op === '/' && !hasV(n.args[1])) {
      let d = n.args[1];
      while (d.type === 'ParenthesisNode') d = d.content;
      return exactCoefficients(n.args[0]) && intNode(d) && powerOfTwo(Math.abs(Number(d.value))) && spend(Number(d.value));
    }
    return n.args.every(exactCoefficients);
  };
  if (!exactCoefficients(arg)) return null;
  const lead = leadingPower(probe, v);
  if (!lead || lead.c === 0 || !Number.isFinite(lead.p)) return null;
  // ln needs P > 0 far out, unless it is ln|P|.
  if (!absolute && lead.c < 0) return null;
  let pText;
  try {
    const f = math.fraction(lead.p);
    const q = Number(f.d);
    if (D % q !== 0 || Number(f.s) * Number(f.n) / q !== lead.p) return null;
    pText = `${Number(f.s) < 0 ? '-' : ''}${f.n}/${f.d}`;
  } catch { return null; }
  // The exact coefficient of ln(t), c·p, for proving that the sum cancels.
  return { lnCoef: c * lead.p, constant: c * Math.log(Math.abs(lead.c)), exact: `(${cParts.length ? cParts.join('*') : '1'})*(${pText})` };
}

// One term, proved or null: its growth form, the limit laws, or a decaying
// growth form times bounded periodic factors (squeezed to 0).
function termLimit(term, v, sign, Algebrite = null, depth = 0) {
  const direct = growthLimitAtInfinity(growthReadable(term), v, sign);
  if (direct !== null && !Number.isNaN(direct)) return { value: direct };
  if (Algebrite) {
    let laws = null;
    try { laws = tryLimitLaws(Algebrite, growthReadable(term), v, sign * Infinity, { valueOnly: true }); } catch { laws = null; }
    if (laws && typeof laws.value === 'number' && !Number.isNaN(laws.value)) return { value: laws.value };
  }
  let node;
  try { node = math.parse(String(term).replace(/π/g, 'pi')); } catch { return null; }
  const factors = [];
  // The sign of each unary minus is kept: −1/(2 + sin(x)/x) → −1/2.
  let sign1 = 1;
  const flatten = (n, inv) => {
    while (n.type === 'ParenthesisNode') n = n.content;
    if (n.type === 'OperatorNode' && n.op === '*') n.args.forEach((a) => flatten(a, inv));
    else if (n.type === 'OperatorNode' && n.op === '/') { flatten(n.args[0], inv); flatten(n.args[1], !inv); }
    else if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { sign1 = -sign1; flatten(n.args[0], inv); }
    else factors.push({ text: n.toString(), inv });
  };
  flatten(node, false);
  const bounded = factors.filter((f) => !f.inv && boundedFactor(f.text, v));
  if (bounded.length) {
    const rest = factors.filter((f) => !bounded.includes(f)).map((f) => (f.inv ? `1/(${f.text})` : `(${f.text})`));
    const restText = rest.length ? rest.join('*') : '1';
    let g = growthLimitAtInfinity(growthReadable(restText), v, sign);
    if ((g === null || Number.isNaN(g)) && depth < 2) {
      const r = provedLimitAtInfinity(restText, v, sign, Algebrite, depth + 1);
      g = r && Number.isFinite(r.value) ? r.value : null;
    }
    if (g === 0) return { value: 0, squeeze: true };
  }
  // A quotient whose parts have proved limits: something settling (or
  // bounded) over something growing without bound → 0; finite over a
  // nonzero finite limit → their ratio (1/(x² + sin(x) + 2) → 0).
  const inverted = factors.filter((f) => f.inv);
  if (!inverted.length || depth >= 2) return null;
  const top = factors.filter((f) => !f.inv);
  const topText = top.length ? top.map((f) => `(${f.text})`).join('*') : '1';
  const bottomText = inverted.map((f) => `(${f.text})`).join('*');
  const B = provedLimitAtInfinity(bottomText, v, sign, Algebrite, depth + 1);
  if (!B) return null;
  const topBounded = top.every((f) => boundedFactor(f.text, v) || !f.text.includes(v));
  const T = provedLimitAtInfinity(topText, v, sign, Algebrite, depth + 1);
  if (B.inf) {
    if ((T && Number.isFinite(T.value)) || topBounded) return { value: 0, squeeze: !(T && Number.isFinite(T.value)) };
    return null;
  }
  if (!Number.isFinite(B.value) || Math.abs(B.value) < 1e-300 || !T) return null;
  if (Number.isFinite(T.value)) return { value: sign1 * (T.value / B.value) };
  if (T.inf) return { value: sign1 * T.inf * Math.sign(B.value) * Infinity };
  return null;
}

// lim f as v → sign·∞. Returns
//   { value, how, text? }      a proved finite limit (text: exact, π/2);
//   { inf: ±1, how }           proved to grow without bound;
//   { none: true, periodic }   proved to have no limit (it keeps oscillating);
//   null                       not proved — nothing may be claimed.
// `periodic` is { Q, period } when a periodic part decided it.
export function provedLimitAtInfinity(f, v, sign, Algebrite = null, depth = 0) {
  // A number with more digits than a double keeps was rounded when parsed
  // (x^1.0000000000000001 is x): nothing is proved from it.
  if (depth === 0 && longLiteral(f)) return null;
  const text = String(f);
  let distributed = null;
  try { distributed = math.simplify(text.replace(/π/g, 'pi'), DISTRIBUTE).toString(); } catch { distributed = null; }
  if (distributed === text) distributed = null;
  for (const form of [text, distributed].filter(Boolean)) {
    const g = growthLimitAtInfinity(growthReadable(form), v, sign);
    if (g !== null && !Number.isNaN(g)) return Number.isFinite(g) ? { value: g, how: 'growth' } : { inf: Math.sign(g), how: 'growth' };
  }
  if (Algebrite) {
    let laws = null;
    try { laws = tryLimitLaws(Algebrite, growthReadable(text), v, sign * Infinity, { valueOnly: true }); } catch { laws = null; }
    if (laws && typeof laws.value === 'number' && !Number.isNaN(laws.value)) {
      if (!Number.isFinite(laws.value)) return { inf: Math.sign(laws.value), how: 'laws' };
      const exact = typeof laws.answer === 'string' ? laws.answer.replace(/\s*\(≈.*$/, '') : null;
      return { value: laws.value, how: 'laws', ...(exact ? { text: exact } : {}) };
    }
  }
  const terms = splitTerms((distributed ?? text).replace(/π/g, 'pi')).map((t) => t.signed);
  const periodic = [];
  let limit = 0;
  let squeeze = false;
  let lnCoef = 0;
  let lnScale = 0;
  let lnConstant = 0;
  let logs = 0;
  const lnExact = [];
  for (const t of terms) {
    const period = structuralPeriod(t, v);
    if (period && period > 0) { periodic.push(t); continue; }
    const log = logOfPowerLike(t, v, sign);
    if (log) { lnCoef += log.lnCoef; lnScale += Math.abs(log.lnCoef); lnConstant += log.constant; lnExact.push(log.exact); logs += 1; continue; }
    const found = termLimit(t, v, sign, Algebrite, depth);
    if (!found || Number.isNaN(found.value)) return null;
    if (found.squeeze) squeeze = true;
    const L = found.value;
    if (!Number.isFinite(L)) {
      if (Number.isFinite(limit)) limit = L;
      else if (L !== limit) return null; // ∞ − ∞
    } else if (Number.isFinite(limit)) limit += L;
  }
  // The logarithms together: (Σ c·p)·ln(t) + Σ c·ln|c₀|. Σ c·p clearly
  // away from 0 (far beyond rounding) decides ±∞; otherwise it must be
  // shown exactly 0 — 10⁻¹³·ln(t) still grows without bound.
  if (logs) {
    if (Math.abs(lnCoef) > 1e-9 * (1 + lnScale)) {
      const L = Math.sign(lnCoef) * Infinity;
      if (Number.isFinite(limit)) limit = L;
      else if (L !== limit) return null; // ∞ − ∞
    } else {
      let zero = false;
      try { zero = Boolean(Algebrite) && String(Algebrite.run(`simplify(${lnExact.join(' + ').replace(/(\d+(?:\.\d+)?)e([+-]?\d+)/gi, '($1*10^($2))').replace(/(?<![a-z_\d.])e(?![a-z(_])/g, 'exp(1)')})`)).trim() === '0'; } catch { zero = false; }
      if (!zero) return null;
      if (Number.isFinite(limit)) limit += lnConstant;
    }
  }
  if (!periodic.length) {
    if (Number.isFinite(limit)) return { value: limit, how: squeeze ? 'squeeze' : logs ? 'logs' : 'growth' };
    return { inf: Math.sign(limit), how: 'growth' };
  }
  const Q = periodic.join(' + ').replace(/\+ -/g, '- ');
  const period = structuralPeriod(Q, v);
  if (!period) return null;
  if (!Number.isFinite(limit)) {
    if (!boundedPeriodic(Q, v)) return null;
    return { inf: Math.sign(limit), how: 'periodic', periodic: { Q, period, alone: terms.length === periodic.length } };
  }
  const values = [0.1, 0.23, 0.37, 0.52, 0.71, 0.89].map((k) => valueAt(Q, v, k * period)).filter(Number.isFinite);
  const spread = values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0;
  if (spread > 1e-9 * (1 + Math.max(...values.map(Math.abs)))) return { none: true, how: 'periodic', periodic: { Q, period, alone: terms.length === periodic.length } };
  return null;
}
