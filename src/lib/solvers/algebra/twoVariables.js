// One equation in two unknowns solved for one of them, with the real roots in
// textbook form and each checked in the equation.

import { matchingParen } from '../../mathParser.js';
import { math, loadAlgebrite, beautify, splitTerms, gcd, expressionsEqualInAllLetters, stripOuterParens } from '../solverUtils.js';
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
    // e^(L) = R with the unknown only in L: roots() cannot undo the
    // exponential, and "e^(a*x) = b" was refused as "one equation cannot fix
    // 3 unknowns" (1.71.1). Take logarithms and solve L = ln(R).
    const undone = undoExponential(l, r, target, Algebrite);
    if (undone) {
      const solved = await solveForVariable(undone.equation, target);
      if (!solved) return null;
      const relation = solved.relation.replace(new RegExp(`(?<![a-z])${undone.symbol}(?![a-z])`, 'g'), undone.log);
      return logRootsCheck(relation, equation, target) ? { ...solved, relation, logStep: `${undone.arg} = ${undone.log}` } : null;
    }
    // A cubic or higher with more than one term in the unknown has only a
    // Cardano-style answer, which is never shown: roots() spent 19 s on
    // y = x^3 + x before the inverse was refused (1.68.7). A pure power
    // (y = x^3, so x = ∛y) is quick and still solved.
    const expanded = String(Algebrite.run(`expand((${l.trim()}) - (${r.trim()}))`)).trim();
    const degree = Number(String(Algebrite.run(`deg(${expanded}, ${target})`)).trim());
    const withTarget = splitTerms(expanded).filter(({ signed }) => new RegExp(`(?<![a-z])${target}(?![a-z])`).test(signed)).length;
    if (degree >= 3 && withTarget >= 2) return null;
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
    // roots() can leave a root unsimplified: 2xy + y = 3 came out as
    // y = 3/((2x + 1)(1/(2x + 1) + 2x/(2x + 1))). The simplified form is
    // kept when it is much shorter, at most 60% of the length (1.70.6), so
    // a form other code reads, such as ±√y, is left alone.
    parts = parts.map((d) => {
      try {
        const simpler = String(Algebrite.run(`simplify(${d})`)).trim();
        return simpler && !/stop|error|nil/i.test(simpler) && simpler.length <= 0.6 * d.length ? simpler : d;
      } catch { return d; }
    });
    parts = parts.map((d) => wholeCoefficients(d, Algebrite));
    const real = realRelation(parts, equation, target, Algebrite) || evenPowerRelation(equation, target, Algebrite);
    if (!real) return null;
    // exp(x) as a textbook writes it: e^x, e^(x + 1).
    const eForm = (d) => d.replace(/\bexp(\((?:[^()]|\([^()]*\))*\))/g, (m, arg) => (/^\([a-z0-9]+\)$/i.test(arg) ? `e^${arg.slice(1, -1)}` : `e^${arg}`));
    return { relation: real.roots.map((d) => `${target} = ${eForm(d)}`).join('  or  '), droppedComplex: real.droppedComplex };
  } catch {
    return null;
  }
}
// c·e^(L) + (terms without the unknown) = R: the equation L = w, w a fresh
// letter standing for ln((R − the other terms)/c), so roots() keeps the
// logarithm whole (ln(c/3)/k, not −ln(3)/k + ln(c)/k). Written ln: a bare
// log is base 10 in MasterMath.
const hasLetter = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(t);
function undoExponential(l, r, target, Algebrite) {
  const terms = (side) => splitTerms(String(side).replace(/\s+/g, ''));
  for (const [a, b] of [[l, r], [r, l]]) {
    const own = terms(a);
    const withTarget = own.filter((t) => hasLetter(t.signed, target));
    if (withTarget.length !== 1 || hasLetter(String(b), target)) continue;
    const m = withTarget[0].signed.match(/^(-)?(?:(.+?)\*)?(?:e\^|exp)(\(.*\)|[a-z0-9]+)$/i);
    if (!m) continue;
    const [, neg, coefRaw = '1', arg] = m;
    if (arg.startsWith('(') && matchingParen(arg, 0) !== arg.length - 1) continue;
    const coef = neg ? `-(${coefRaw})` : coefRaw;
    if (hasLetter(coef, target) || !hasLetter(arg, target)) continue;
    const rest = own.filter((t) => t !== withTarget[0]).map((t) => t.signed).join('+').replace(/\+-/g, '-');
    const symbol = ['w', 'q', 'u', 'v'].find((v) => !hasLetter(`${l}=${r}`, v));
    if (!symbol) return null;
    // R minus the other terms, written as typed: "c - b", then over c.
    const moved = [String(b).trim(), ...splitTerms(rest || '0').filter((t) => t.signed !== '0')
      .map((t) => (t.signed.startsWith('-') ? `+${t.signed.slice(1)}` : `-${t.signed}`))].join('');
    const top = positiveFirst(moved);
    const wrap = (t) => (splitTerms(t).length > 1 || /^-/.test(t) || /[*/]/.test(t) ? `(${t})` : t);
    const inside = coef === '1' ? top : coef === '-(1)' ? `-${wrap(top)}` : `${wrap(top)}/${wrap(beautify(coef))}`;
    return { equation: `${arg} = ${symbol}`, symbol, arg: beautify(stripOuterParens(arg)), log: `ln(${inside})` };
  }
  return null;
}
// Each root of the logged equation, put back into the original wherever
// every letter is positive and the logarithm is real.
function logRootsCheck(relation, equation, target) {
  const [l, r] = equation.split('=');
  const roots = relation.split(/\s+or\s+/).map((part) => part.replace(new RegExp(`^\\s*${target}\\s*=\\s*`), ''));
  const letters = [...new Set((equation.replace(/\b(?:e|exp|ln|log)\b/g, '').match(/[a-z]/gi) || []))].filter((v) => v !== target);
  let checked = 0;
  for (let k = 0; k < 12; k += 1) {
    const scope = Object.fromEntries(letters.map((v, i) => [v, 0.7 + ((k * 7 + i * 3) % 11) * 0.23]));
    for (const root of roots) {
      let value;
      try { value = math.evaluate(root.replace(/√/g, 'sqrt').replace(/·/g, '*').replace(/\bln\(/g, 'log('), scope); } catch { return false; }
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const at = { ...scope, [target]: value, e: Math.E };
      const diff = math.evaluate(`(${l}) - (${r})`.replace(/\bexp\(/g, 'e^('), at);
      const size = Math.abs(math.evaluate(l, at)) + 1;
      if (typeof diff !== 'number' || Math.abs(diff) > 1e-8 * size) return false;
      checked += 1;
    }
  }
  return checked >= 3;
}
// A fraction with fractions inside it, as a textbook clears them: roots()
// wrote 3xy + y = 6 as y = 2/(x + 1/3) and 6xy = 3y + 2 as 1/(3(x − 1/2));
// top and bottom times the common denominator give 6/(3x + 1) and
// 2/(6x − 3) (1.71.1). Kept only when equal to the root in every letter.
function wholeCoefficients(display, Algebrite) {
  const d = String(display);
  if (!d.includes('/') || /\^\(1\//.test(d)) return d;
  try {
    const num = String(Algebrite.run(`expand(numerator(${d}))`)).trim();
    const den = String(Algebrite.run(`expand(denominator(${d}))`)).trim();
    if (!num || !den || den === '1' || /stop|error|nil/i.test(num + den)) return d;
    const denominators = [...`${num} ${den}`.matchAll(/\/(\d+)/g)].map((m) => Number(m[1]));
    if (denominators.length === 0) return d;
    const lcd = denominators.reduce((a, b) => (a * b) / gcd(a, b), 1);
    const top = String(Algebrite.run(`expand(${lcd}*(${num}))`)).trim();
    const bottom = String(Algebrite.run(`expand(${lcd}*(${den}))`)).trim();
    if (/\//.test(top + bottom)) return d;
    const wrap = (t) => (splitTerms(t).length > 1 || /^-/.test(t) ? `(${t})` : t);
    const tidy = `${wrap(top)}/${wrap(bottom)}`;
    return expressionsEqualInAllLetters(tidy, d) ? tidy : d;
  } catch {
    return d;
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
