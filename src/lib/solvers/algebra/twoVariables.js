// One equation in two unknowns solved for one of them, with the real roots in
// textbook form and each checked in the equation.

import { matchingParen } from '../../mathParser.js';
import { math, loadAlgebrite, beautify, splitTerms } from '../solverUtils.js';
import { parseRootsList, IMAGINARY } from './rootsFormat.js';

// Factor an expression over the integers with Algebrite. The result is only
// claimed after two independent checks: a numeric equivalence sweep and a
// symbolic re-expansion (which doubles as the "check your work" step). If
// anything fails, return null so the caller falls back to the simplify path.
// Solve an equation for one variable in terms of the others: Algebrite's
// roots() accepts symbolic coefficients, so roots(y - 3 - 2x, y) → [2x+3].
// Returns "y = 2x + 3" (or "y = a  or  y = b"), or null.
export async function solveForVariable(equation, target) {
  try {
    const Algebrite = await loadAlgebrite();
    const [l, r] = equation.split('=');
    const raw = String(Algebrite.roots(`(${l.trim()}) - (${r.trim()})`, target)).trim();
    if (!raw || /stop|error|nil|roots/i.test(raw)) return null;
    let parts = parseRootsList(raw).map((rt) => rt.display).filter(Boolean);
    if (parts.length === 0) return null;
    // Algebrite writes x² + y² = 25 as x = ±i·(y² − 25)^(1/2). Over the reals
    // that is ±(25 − y²)^(1/2): rewrite i·(A)^(1/2) → (−A)^(1/2), simplifying
    // the negated radicand, so the answer reads as real algebra.
    parts = parts.map((d) => d.replace(/i\*\(([^()]*)\)\^\(1\/2\)/g, (m, inner) => {
      try {
        const neg = String(Algebrite.run(`simplify(-(${inner}))`)).trim();
        return neg && !/stop|error|nil/i.test(neg) ? `(${neg})^(1/2)` : m;
      } catch { return m; }
    }));
    const real = realRelation(parts, equation, target, Algebrite) || evenPowerRelation(equation, target, Algebrite);
    if (!real) return null;
    return { relation: real.roots.map((d) => `${target} = ${d}`).join('  or  '), droppedComplex: real.droppedComplex };
  } catch {
    return null;
  }
}
function positiveFirst(expr) {
  const terms = splitTerms(expr);
  const k = terms.findIndex((t) => !t.signed.startsWith('-'));
  if (k <= 0) return beautify(expr);
  const ordered = [terms[k], ...terms.filter((_, i) => i !== k)];
  return beautify(ordered.map((t, i) => (i === 0 ? t.term : t.signed.startsWith('-') ? ` - ${t.signed.slice(1)}` : ` + ${t.term}`)).join(''));
}
// A radicand reads positive-first and with a plain divisor: "-y+7" → "7 - y",
// "1/3*(-y+7)" → "(7 - y)/3".
function tidyRadicand(inner) {
  const scaled = String(inner).replace(/\s+/g, '').match(/^1\/(\d+)\*\((.*)\)$/);
  if (scaled && matchingParen(`(${scaled[2]})`, 0) === scaled[2].length + 1) return `(${positiveFirst(scaled[2])})/${scaled[1]}`;
  return positiveFirst(inner);
}
const radical = (n, radicand) => {
  const plain = /^[a-z0-9]+$/i.test(radicand);
  if (String(n) === '2' || String(n) === '3') return `${String(n) === '2' ? '√' : '∛'}${plain ? radicand : `(${radicand})`}`;
  return `${plain ? radicand : `(${radicand})`}^(1/${n})`;
};
function textbookRoot(display, Algebrite) {
  const d = String(display).replace(/\s+/g, '');
  // The whole root is one radical, possibly negated: ±√A, and −∛A = ∛(−A).
  // An odd root carries its sign inside: −∛A = ∛(−A), −(A)^(1/5) = (−A)^(1/5).
  const whole = d.match(/^(-)?\((.*)\)\^\(1\/(\d+)\)$/);
  if (whole && matchingParen(d, whole[1] ? 1 : 0) === d.length - (5 + whole[3].length) - 1) {
    let [, neg, inner, n] = whole;
    if (Number(n) % 2 === 1 && neg) {
      const negated = String(Algebrite.run(`simplify(-(${inner}))`)).trim();
      if (negated && !/stop|error|nil/i.test(negated)) { inner = negated; neg = ''; }
    }
    if (!(Number(n) % 2 === 1 && neg)) return { sign: neg ? '-' : '', body: radical(n, tidyRadicand(inner)) };
  }
  // A radical inside a sum or product: "-1/2*y + 1/2*(4+y^2)^(1/2)".
  let out = String(display);
  let guard = 0;
  let m;
  while ((m = out.match(/\(([^()]*)\)\^\(1\/(2|3)\)/)) && guard++ < 6) {
    out = out.replace(m[0], radical(m[2], tidyRadicand(m[1])));
  }
  return { sign: '', body: beautify(out) };
}
// Two roots that differ only in the sign before their radical are one ± root.
const plusMinusKey = (root) => root.replace(/ [+-] (?=(?:[\d/]+\*?)?[√∛])/, ' ± ');
const toMathjs = (s) => String(s).replace(/√\(/g, 'sqrt(').replace(/∛\(/g, 'cbrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)').replace(/∛([a-z0-9]+)/gi, 'cbrt($1)');
function rootHolds(root, equation, target) {
  const [l, r] = equation.split('=');
  const others = [...new Set((equation.replace(/\b(?:sin|cos|tan|sec|csc|cot|sqrt|abs|log|ln|exp|pi|e)\b/gi, '').match(/[a-z]/gi) || []).map((c) => c.toLowerCase()))].filter((v) => v !== target);
  const samples = [-2.3, -0.7, 0.4, 1.3, 2.9, 4.1];
  let held = 0;
  for (const v of samples) {
    const scope = Object.fromEntries(others.map((o, i) => [o, v + 0.37 * i]));
    let t;
    // A throw (nthRoot of a negative, an even root) means not real here.
    try { t = math.evaluate(toMathjs(root), scope); } catch { continue; }
    if (typeof t !== 'number' || !Number.isFinite(t)) continue; // not real here
    let residual;
    try { residual = math.evaluate(`(${l}) - (${r})`, { ...scope, [target]: t }); } catch { return false; }
    if (typeof residual !== 'number' || !Number.isFinite(residual)) continue;
    if (Math.abs(residual) > 1e-7 * (1 + Math.abs(t) ** 3)) return false;
    held += 1;
  }
  return held > 0;
}
// x appears only as x^k ("x^4 + y^2 = 16"): solve for u = x^k, then
// x = ±(u)^(1/k) for even k, (u)^(1/k) for odd k. Algebrite writes every
// root of the quartic with an i, real or not.
function evenPowerRelation(equation, target, Algebrite) {
  const powers = [...equation.matchAll(new RegExp(`(?<![a-z])${target}(?![a-z(])(\\^(\\d+))?`, 'gi'))].map((m) => Number(m[2] || 1));
  const k = powers[0];
  if (!powers.length || k < 2 || powers.some((p) => p !== k)) return null;
  const [l, r] = equation.split('=');
  const inU = `(${l.trim()}) - (${r.trim()})`.replace(new RegExp(`(?<![a-z])${target}\\^${k}`, 'gi'), '(u)');
  const raw = String(Algebrite.roots(inU, 'u')).trim();
  if (!raw || /stop|error|nil|roots/i.test(raw)) return null;
  const roots = [];
  for (const u of parseRootsList(raw).map((rt) => rt.display)) {
    if (IMAGINARY.test(u)) continue;
    const base = tidyRadicand(u);
    const body = radical(k, base);
    const signed = k % 2 === 0 ? `±${body}` : body;
    const halves = k % 2 === 0 ? [body, `-${body}`] : [body];
    const toCheck = (h) => h.replace(/\((.*)\)\^\(1\/(\d+)\)$/, 'nthRoot($1, $2)').replace(/^(-?)([a-z0-9]+)\^\(1\/(\d+)\)$/i, '$1nthRoot($2, $3)');
    if (halves.every((h) => rootHolds(toCheck(h), equation, target))) roots.push(signed);
  }
  return roots.length ? { roots, droppedComplex: false } : null;
}
function realRelation(parts, equation, target, Algebrite) {
  const realForm = parts.filter((d) => !IMAGINARY.test(d));
  const droppedComplex = realForm.length < parts.length;
  const shaped = realForm.map((d) => textbookRoot(d, Algebrite));
  // "−√A or √A" → "±√A"; "a − b·√A or a + b·√A" → "a ± b·√A".
  const roots = [];
  const halves = new Map(); // ± root → its two signed forms, each checked
  for (const r of shaped) {
    const twin = shaped.find((o) => o !== r && o.body === r.body && o.sign !== r.sign);
    const own = `${r.sign}${r.body}`;
    const pair = !twin && shaped.find((o) => o !== r && !o.sign && !r.sign && o.body !== r.body && plusMinusKey(o.body) === plusMinusKey(r.body) && plusMinusKey(r.body).includes('±'));
    if (twin) {
      const pm = `±${r.body}`;
      if (!roots.includes(pm)) { roots.push(pm); halves.set(pm, [r.body, `-${r.body}`]); }
    } else if (pair) {
      const pm = plusMinusKey(r.body);
      if (!roots.includes(pm)) { roots.push(pm); halves.set(pm, [r.body, pair.body]); }
    } else {
      roots.push(own);
    }
  }
  const checked = roots.filter((root) => (halves.has(root)
    ? halves.get(root).every((half) => rootHolds(half, equation, target))
    : rootHolds(root, equation, target)));
  return checked.length ? { roots: checked, droppedComplex } : null;
}
