// Ranges proved from the structure, for families the analysis can settle
// completely (1.64.0 review): the range of a function continuous on an
// interval runs between its least and greatest values, which are at a
// critical point or approached at an end. So when every critical point is
// found exactly and the end behaviour is known, the range follows by the
// intermediate value theorem. Never read off the graph window.
//
//   a·|P| + k          P a polynomial with a real root: y ≥ k (or ≤)
//   √Q                 Q quadratic: from its vertex and roots
//   P/Q                no real poles: critical points + the ends
//   P·e^(kx)           critical points of P′ + kP + the ends
//   c·x^p·ln(x)        p > 0: one critical point, x = e^(−1/p)

import { math, beautify, formatNumber, mark, exactForm } from '../solverUtils.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';
import { recognizeExact, toAlgebrite, tidyRoot, exactNumber } from './features.js';
import { growthForm } from '../limits/growth.js';

const bareNode = (n) => (n && n.type === 'ParenthesisNode' ? bareNode(n.content) : n);

// An exact value of f at an exact x (raw, Algebrite syntax), with its number.
function valueAt(Algebrite, func, variable, raw) {
  try {
    const out = String(Algebrite.run(`simplify(subst(${raw}, ${variable}, ${toAlgebrite(func)}))`)).trim();
    if (/nil|Stop|\bi\b/.test(out)) return null;
    const y = Number(math.evaluate(out.replace(/(?<![a-z])log\(/g, 'log(')));
    if (!Number.isFinite(y)) return null;
    return { y, text: tidyRoot(exactForm(out)) };
  } catch {
    return null;
  }
}

// The exact critical points of f among the real roots of the polynomial Q.
function criticalValues(Algebrite, func, variable, Q, qText) {
  const roots = allRoots(Q).real;
  const out = [];
  for (const r of roots) {
    const raw = r.exact ? `${r.exact.m}/${r.exact.d}` : recognizeExact(Algebrite, qText, variable, r.value)?.raw;
    if (!raw) return null;
    const v = valueAt(Algebrite, func, variable, raw);
    if (!v) return null;
    out.push({ x: r.value, ...v });
  }
  return out;
}

// The range from the critical values and what f does at the two ends: an
// end is { finite: y, text } (approached, not reached) or { infinite: ±1 }.
function rangeFrom(crit, left, right, why) {
  const ends = [left, right];
  const hiInf = ends.some((e) => e.infinite === 1);
  const loInf = ends.some((e) => e.infinite === -1);
  const pick = (dir) => {
    const best = crit.reduce((a, b) => (a === null || dir * (b.y - a.y) > 0 ? b : a), null);
    const endBest = ends.filter((e) => 'finite' in e).reduce((a, b) => (a === null || dir * (b.finite - a.finite) > 0 ? b : a), null);
    if (best && (!endBest || dir * (best.y - endBest.finite) >= -1e-12)) return { text: best.text, strict: false };
    return endBest ? { text: endBest.text, strict: true } : null;
  };
  const hi = hiInf ? null : pick(1);
  const lo = loInf ? null : pick(-1);
  if ((!hiInf && !hi) || (!loInf && !lo)) return null;
  let text;
  if (lo && hi) text = `${lo.text} ${lo.strict ? '<' : '≤'} y ${hi.strict ? '<' : '≤'} ${hi.text}`;
  else if (lo) text = `y ${lo.strict ? '>' : '≥'} ${lo.text}`;
  else if (hi) text = `y ${hi.strict ? '<' : '≤'} ${hi.text}`;
  else text = 'all real numbers';
  return { text, why };
}

const endsText = (left, right, v, leftAt = '−∞') => {
  const one = (e) => ('finite' in e ? mark(`→ ${e.text}`) : mark(e.infinite > 0 ? '→ ∞' : '→ −∞'));
  return `${one(left)} as ${mark(`${v} → ${leftAt}`)} and ${one(right)} as ${mark(`${v} → ∞`)}`;
};
const critText = (crit, v) => (crit.length
  ? `its critical points are ${mark(`${v} = ${crit.map((c) => formatNumber(c.x)).join(', ')}`)}, with values ${mark(crit.map((c) => c.text).join(', '))}`
  : 'it has no critical points');

// a·|P| + k with P a polynomial that has a real root: |P| reaches 0 and grows
// without bound, so k is the least value (a > 0) and there is no greatest.
function absPolynomial(func, v) {
  const t = String(func).replace(/\s+/g, '');
  const m = t.match(/^(-?(?:\d+(?:\.\d+)?|\d+\/\d+)?\*?|-)?abs\((.+)\)([+-](?:\d+(?:\.\d+)?|\d+\/\d+))?$/);
  if (!m) return null;
  const P = readPolynomial(m[2], v);
  if (!P || P.tooHigh || P.degree < 1 || allRoots(P).real.length === 0) return null;
  const a = m[1] === undefined || m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(math.evaluate(m[1].replace(/\*$/, '')));
  const k = m[3] ? exactNumber(Number(math.evaluate(m[3]))) : '0';
  if (!Number.isFinite(a) || a === 0) return null;
  const inside = mark(`|${beautify(m[2])}|`);
  return a > 0
    ? { text: `y ≥ ${k}`, why: `${inside} is ${mark('0')} where ${mark(`${beautify(m[2])} = 0`)} and grows without bound, so the least value is ${mark(k)} and there is no greatest.` }
    : { text: `y ≤ ${k}`, why: `${inside} is ${mark('0')} where ${mark(`${beautify(m[2])} = 0`)} and grows without bound, so with a negative coefficient the greatest value is ${mark(k)} and there is no least.` };
}

// √Q, Q quadratic: Q's vertex value m and its roots decide it.
function sqrtQuadratic(Algebrite, func, v) {
  const t = String(func).replace(/\s+/g, '');
  const m = t.match(/^sqrt\((.+)\)$/);
  if (!m) return null;
  const Q = readPolynomial(m[1], v);
  if (!Q || Q.tooHigh || Q.degree !== 2) return null;
  const [c, b, a] = Q.coefficients.map(Number);
  const h = -b / (2 * a);
  const peak = c - (b * b) / (4 * a);
  const peakText = exactNumber(peak);
  const root = (() => { try { return tidyRoot(exactForm(String(Algebrite.run(`simplify(sqrt(${peakText}))`)).trim())); } catch { return null; } })();
  if (!root) return null;
  if (a < 0) {
    if (peak < 0) return null;
    return { text: `0 ≤ y ≤ ${root}`, why: `${mark(beautify(m[1]))} is largest at ${mark(`${v} = ${exactNumber(h)}`)}, where it is ${mark(peakText)}, and ${mark('0')} at the ends of the domain, so ${mark(`√(${beautify(m[1])})`)} runs from ${mark('0')} to ${mark(`√${peakText} = ${root}`)}.` };
  }
  return peak <= 0
    ? { text: 'y ≥ 0', why: `${mark(beautify(m[1]))} reaches ${mark('0')} and grows without bound, so its square root takes every value ${mark('≥ 0')}.` }
    : { text: `y ≥ ${root}`, why: `${mark(beautify(m[1]))} is never below ${mark(peakText)} (at ${mark(`${v} = ${exactNumber(h)}`)}) and grows without bound.` };
}

// P/Q with no real poles: continuous on every real number.
function rationalRange(Algebrite, func, v) {
  let top;
  try { top = bareNode(math.parse(String(func))); } catch { return null; }
  if (!(top.type === 'OperatorNode' && top.op === '/')) return null;
  const P = readPolynomial(bareNode(top.args[0]).toString(), v);
  const Q = readPolynomial(bareNode(top.args[1]).toString(), v);
  if (!P || !Q || P.tooHigh || Q.tooHigh || Q.degree < 1 || allRoots(Q).real.length) return null;
  let dNum;
  try { dNum = String(Algebrite.run(`numerator(simplify(d(${toAlgebrite(func)}, ${v})))`)).trim(); } catch { return null; }
  const D = readPolynomial(dNum, v);
  if (!D || D.tooHigh) return null;
  const crit = D.degree >= 1 ? criticalValues(Algebrite, func, v, D, dNum) : [];
  if (!crit) return null;
  const leadP = Number(P.coefficients[P.degree]);
  const leadQ = Number(Q.coefficients[Q.degree]);
  let left;
  let right;
  if (P.degree < Q.degree) { left = { finite: 0, text: '0' }; right = { finite: 0, text: '0' }; }
  else if (P.degree === Q.degree) { const L = leadP / leadQ; left = { finite: L, text: exactNumber(L) }; right = left; }
  else {
    const s = Math.sign(leadP / leadQ);
    right = { infinite: s };
    left = { infinite: s * ((P.degree - Q.degree) % 2 ? -1 : 1) };
  }
  return rangeFrom(crit, left, right, `the denominator is never ${mark('0')}, so ${mark('f')} is continuous on every real number; ${critText(crit, v)}; and ${mark('f')} ${endsText(left, right, v)}. So ${mark('f')} takes every value between its least and greatest.`);
}

// P(x)·e^(kx): f′ = e^(kx)(P′ + kP), and e^(kx) is never 0.
function expProductRange(Algebrite, func, v) {
  let top;
  try { top = bareNode(math.parse(String(func))); } catch { return null; }
  const factors = [];
  const flatten = (n) => { n = bareNode(n); if (n.type === 'OperatorNode' && n.op === '*') n.args.forEach(flatten); else factors.push(n); };
  flatten(top);
  const isExp = (n) => (n.type === 'FunctionNode' && n.fn?.name === 'exp') || (n.type === 'OperatorNode' && n.op === '^' && bareNode(n.args[0]).type === 'SymbolNode' && bareNode(n.args[0]).name === 'e');
  const exps = factors.filter(isExp);
  if (exps.length !== 1) return null;
  const expNode = exps[0];
  const exponent = expNode.type === 'FunctionNode' ? expNode.args[0] : expNode.args[1];
  const at = (x) => { try { return Number(exponent.evaluate({ [v]: x })); } catch { return NaN; } };
  const k = at(1);
  if (!(Number.isFinite(k) && k !== 0 && at(0) === 0 && Math.abs(at(2) - 2 * k) < 1e-12)) return null;
  const rest = factors.filter((n) => n !== expNode).map((n) => n.toString()).join(' * ') || '1';
  const P = readPolynomial(rest, v);
  if (!P || P.tooHigh || P.degree < 1) return null;
  const kText = exactNumber(k);
  let qText;
  try { qText = String(Algebrite.run(`expand(d(${rest}, ${v}) + (${kText})*(${rest}))`)).trim(); } catch { return null; }
  const Qp = readPolynomial(qText, v);
  if (!Qp || Qp.tooHigh) return null;
  const crit = Qp.degree >= 1 ? criticalValues(Algebrite, func, v, Qp, qText) : [];
  if (!crit) return null;
  const lead = Number(P.coefficients[P.degree]);
  const toInf = { infinite: Math.sign(lead) };
  const toMinusInf = { infinite: Math.sign(lead) * (P.degree % 2 ? -1 : 1) };
  const zero = { finite: 0, text: '0' };
  const [left, right] = k < 0 ? [toMinusInf, zero] : [zero, toInf];
  return rangeFrom(crit, left, right, `${mark('f')} is continuous on every real number; ${mark(`f′ = e^(${kText}${v})·(${beautify(qText)})`)} and ${mark('e^(…)')} is never ${mark('0')}, so ${critText(crit, v)}; and ${mark('f')} ${endsText(left, right, v)} (the exponential outgrows every power). So ${mark('f')} takes every value between its least and greatest.`);
}

// c·x^p·ln(x), p > 0: f′ = x^(p−1)·(p·ln(x) + 1), 0 only at x = e^(−1/p).
function logPowerRange(Algebrite, func, v) {
  const g = growthForm(String(func), v);
  if (!g || g.k !== 0 || g.m !== 1 || !(g.p > 0)) return null;
  const pText = exactNumber(g.p);
  const raw = `exp(-1/(${pText}))`;
  const crit = valueAt(Algebrite, func, v, raw);
  if (!crit) return null;
  const xText = tidyRoot(exactForm(String(Algebrite.run(`simplify(${raw})`)).trim()));
  const left = { finite: 0, text: '0' };
  const right = { infinite: Math.sign(g.c) };
  return rangeFrom([{ x: Math.exp(-1 / g.p), ...crit }], left, right, `${mark('f')} is continuous for ${mark(`${v} > 0`)}; ${mark(`f′ = 0`)} only where ${mark(`${pText === '1' ? '' : pText}ln(${v}) + 1 = 0`)}, at ${mark(`${v} = ${xText}`)}, where ${mark(`f = ${crit.text}`)}; and ${mark('f')} ${mark('→ 0')} as ${mark(`${v} → 0⁺`)} (the power wins) and ${mark(g.c > 0 ? '→ ∞' : '→ −∞')} as ${mark(`${v} → ∞`)}.`);
}

export function provedRange(Algebrite, func, variable) {
  if (!Algebrite) return absPolynomial(func, variable);
  for (const attempt of [absPolynomial, sqrtQuadratic, rationalRange, expProductRange, logPowerRange]) {
    try {
      const r = attempt.length === 2 ? attempt(func, variable) : attempt(Algebrite, func, variable);
      if (r) return r;
    } catch { /* next family */ }
  }
  return null;
}
