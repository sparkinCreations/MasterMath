// A polynomial in a power of x (1.75.0): x^(2/3) − 5x^(1/3) + 6 = 0 is
// u² − 5u + 6 = 0 with u = x^(1/3); x^(−2) − x^(−1) − 2 = 0 is u² − u − 2
// with u = 1/x; (x² − 1)² − 5(x² − 1) + 4 = 0 expands to x⁴ − 7x² + 10,
// u² − 7u + 10 with u = x². The first two fell to the numeric scan, the third
// gave ±1.4142 and ±2.2361 for ±√2 and ±√5. Every power of x must be a whole
// multiple of one power p; u is solved exactly, and x recovered from each u
// (x = u³, x = 1/u, x = ±√u for u ≥ 0), each checked in the original.

import { math, beautify, mark, loadAlgebrite, splitTerms } from '../solverUtils.js';
import { solveWithAlgebriteRoots } from './polynomial.js';

const gcdInt = (a, b) => (b === 0 ? Math.abs(a) : gcdInt(b, a % b));
// A rational r as [num, den], den > 0, from a decimal or "a/b".
function ratio(text) {
  const t = String(text).replace(/[()\s]/g, '');
  const m = t.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2] || 1);
  const g = gcdInt(n, d);
  return [n / g, d / g];
}

// The terms of the expanded difference as { coef, exp: [num, den] }.
function termsIn(expanded, v) {
  const out = [];
  for (const { signed } of splitTerms(expanded.replace(/\s+/g, ''))) {
    const body = signed.replace(/^\+/, '');
    const re = new RegExp(`(?<![a-z])${v}(?:\\^(\\((?:[^()]+)\\)|-?\\d+))?(?![a-z(])`);
    const m = body.match(re);
    if (!m) {
      if (/[a-z]/i.test(body)) return null;
      out.push({ coef: body, exp: [0, 1] });
      continue;
    }
    if ((body.match(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g')) || []).length !== 1) return null;
    const exp = m[1] ? ratio(m[1]) : [1, 1];
    if (!exp) return null;
    let coef = body.replace(m[0], '1').replace(/\*1(?![\d.])/g, '').replace(/^1\*/, '').replace(/\/1$/, '');
    if (coef === '' || coef === '1') coef = '1';
    if (coef === '-' || coef === '-1') coef = '-1';
    if (/[a-z]/i.test(coef)) return null;
    out.push({ coef, exp });
  }
  return out;
}

export async function solvePolynomialInPower(equation, v) {
  const [lhs, rhs] = String(equation).split('=');
  if (rhs === undefined) return null;
  if (/[a-z]{2,}/i.test(`${lhs}${rhs}`.replace(/\bsqrt\b/g, ''))) return null;
  const Algebrite = await loadAlgebrite();
  let expanded;
  try {
    expanded = String(Algebrite.run(`expand((${lhs}) - (${rhs}))`)).trim();
  } catch { return null; }
  // Algebrite writes x^(−2) as 1/(x^2) and x^(−1) as 1/x: back to powers.
  expanded = expanded.replace(new RegExp(`(\\d+)?\\/\\(?${v}(?:\\^(\\d+))?\\)?(?![\\w^(])`, 'g'), (m, c, k) => `${c || 1}*${v}^(-${k || 1})`);
  if (!expanded || /nil|stop|error/i.test(expanded) || /\//.test(expanded.replace(/\^\(-?\d+\/\d+\)/g, '').replace(/\d+\/\d+/g, ''))) return null;
  const terms = termsIn(expanded, v);
  if (!terms) return null;
  const powers = terms.filter((t) => t.exp[0] !== 0).map((t) => t.exp);
  if (powers.length < 2) return null;
  // p = the largest power every exponent is a whole multiple of.
  const den = powers.reduce((m, [, d]) => (m * d) / gcdInt(m, d), 1);
  const nums = powers.map(([n, d]) => (n * den) / d);
  const g = nums.reduce((a, b) => gcdInt(a, b));
  // Sign of p follows the exponents: all negative gives u = x^(−k).
  const negative = nums.every((n) => n < 0);
  const p = [negative ? -g : g, den];
  const k = nums.map((n) => n / p[0]);
  if (k.some((e) => !Number.isInteger(e) || e < 0) || Math.max(...k) > 4 || Math.max(...k) < 2) return null;
  if (p[0] === 1 && p[1] === 1) return null; // already a polynomial in x
  const pText = p[1] === 1 ? String(p[0]) : `${p[0]}/${p[1]}`;
  const uOf = p[0] === -1 && p[1] === 1 ? `1/${v}` : p[1] === 1 ? `${v}^${p[0]}` : `${v}^(${pText})`;
  const inU = terms.map((t) => {
    const e = t.exp[0] === 0 ? 0 : ((t.exp[0] * den) / t.exp[1]) / p[0];
    return `(${t.coef})${e === 0 ? '' : e === 1 ? '*u' : `*u^${e}`}`;
  }).join(' + ');
  // Highest power of u first: u^2 − u − 2, not −2 − u + u^2.
  const deg = (t) => { const m = t.match(/u(?:\^(\d+))?/); return m ? Number(m[1] || 1) : 0; };
  const polyU = splitTerms(String(Algebrite.run(`expand(${inU})`)).trim())
    .sort((a, b) => deg(b.signed) - deg(a.signed))
    .map((t, i) => (i === 0 ? t.signed.replace(/^\+/, '') : t.signed.startsWith('-') ? ` - ${t.signed.slice(1)}` : ` + ${t.signed.replace(/^\+/, '')}`))
    .join('');
  const solvedU = await solveWithAlgebriteRoots(`${polyU} = 0`, 'u');
  if (!solvedU) return null;
  const forms = String(solvedU.answer || '').split(/\s+or\s+/).map((t) => t.replace(/^\s*u\s*=\s*/, '').trim());
  const steps = [
    `Every power of ${mark(v)} here is a whole multiple of ${mark(uOf)}: let ${mark(`u = ${uOf}`)}. Then ${mark(`${beautify(polyU)} = 0`)}, a polynomial in ${mark('u')}.`,
    ...solvedU.steps.map((s) => `  ${s}`),
  ];
  const roots = [];
  const back = [];
  for (const u of solvedU.solutions) {
    if (!Number.isFinite(u)) continue;
    const form = forms.find((f) => { try { return Math.abs(Number(math.evaluate(f.replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)'))) - u) < 1e-9; } catch { return false; } });
    if (!form || /≈|i/.test(form)) return null;
    const uAlg = form.replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)');
    // x from u = x^p: x = u^(1/p); an even root needs u ≥ 0 and gives ±.
    const inv = p[1] === 1 ? [1, p[0]] : [p[1], p[0]]; // 1/p as [num, den]
    const evenRoot = Math.abs(inv[1]) % 2 === 0;
    if (evenRoot && u < 0) { back.push(`${mark(`${uOf} = ${beautify(form)}`)}: no real ${mark(v)}, since ${mark(uOf)} is never negative.`); continue; }
    if (inv[0] < 0 || inv[1] < 0) { if (u === 0) { back.push(`${mark(`${uOf} = 0`)}: no ${mark(v)}.`); continue; } }
    const powText = inv[1] === 1 || inv[1] === -1 ? `(${uAlg})^(${inv[0] * Math.sign(inv[1])})` : `(${uAlg})^(${inv[0]}/${inv[1]})`;
    let exact;
    try { exact = String(Algebrite.run(`simplify(${powText})`)).trim(); } catch { return null; }
    if (!exact || /nil|stop|error|i\b/.test(exact)) return null;
    const values = evenRoot ? [-1, 1] : [1];
    const shownX = [];
    for (const s of values) {
      const ex = s < 0 ? `-(${exact})` : exact;
      let val;
      try { val = Number(math.evaluate(ex)); } catch { return null; }
      if (!Number.isFinite(val)) return null;
      const disp = beautify(String(Algebrite.run(`simplify(${ex})`)).trim()).replace(/(\d+)\^\(1\/2\)/g, '√$1').replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)');
      if (!roots.some((r) => Math.abs(r.value - val) < 1e-9)) roots.push({ value: val, shown: disp });
      shownX.push(disp);
    }
    back.push(`${mark(`${uOf} = ${beautify(form)}`)} gives ${shownX.map((d) => mark(`${v} = ${d}`)).join(' or ')}.`);
  }
  steps.push(`Back-substitute ${mark(`u = ${uOf}`)}:`, ...back.map((b) => `  ${b}`));
  // Every root in the original.
  const [L, R] = [lhs, rhs];
  for (const r of roots) {
    let d;
    try { d = Number(math.evaluate(`(${L}) - (${R})`, { [v]: r.value })); } catch { return null; }
    if (!(Math.abs(d) <= 1e-7 * (1 + Math.abs(r.value) ** 4))) return null;
  }
  roots.sort((a, b) => a.value - b.value);
  const shown = roots.map((r) => `${v} = ${r.shown}`);
  steps.push(shown.length ? `Solution: ${shown.map((s) => mark(s)).join(' or ')}` : 'No real solution.');
  return { steps, answer: shown.length ? shown.join('  or  ') : 'No real solution', solutions: roots.map((r) => r.value) };
}
