// Two square roots (1.75.0): √x + √(x − 5) = 5, √(x + 7) − √x = 1,
// √(3x + 1) = √x + 1. One root is isolated and both sides squared, which
// leaves one square root; that equation is solved by the one-root method
// (`solveSub`), and every candidate is checked in the ORIGINAL equation,
// since squaring can bring in a root of √A = −(the rest). They fell to the
// numeric scan.

import { math, beautify, mark, loadAlgebrite, splitTerms } from '../solverUtils.js';
import { matchingParen } from '../../mathParser.js';

const sqrtCalls = (text) => {
  const out = [];
  const re = /(?<![a-z])sqrt\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close < 0) return null;
    out.push({ text: text.slice(m.index, close + 1), arg: text.slice(open + 1, close) });
    re.lastIndex = close + 1;
  }
  return out;
};

const toSqrt = (t) => String(t).replace(/\(([^()]+)\)\^\(1\/2\)/g, 'sqrt($1)').replace(/(?<![\w)])([a-z])\^\(1\/2\)/gi, 'sqrt($1)');
const pretty = (t) => beautify(t).replace(/(?<![a-z])sqrt\(/g, '√(').replace(/√\(([a-z0-9]+)\)/gi, '√$1');

export async function solveTwoRadicals(expression, v, solveSub) {
  const [lhs, rhs] = String(expression).split('=').map((s) => s.trim());
  if (rhs === undefined) return null;
  const all = sqrtCalls(`${lhs} ${rhs}`);
  if (!all || all.length !== 2 || !all.every((r) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(r.arg))) return null;
  if (/(?<![a-z])(?:sin|cos|tan|ln|log|exp|abs)\(/.test(`${lhs}${rhs}`)) return null;
  // Isolate the first root that stands alone as a term (coefficient +1).
  let side = null;
  let other = null;
  let root = null;
  for (const [s, o] of [[lhs, rhs], [rhs, lhs]]) {
    const terms = splitTerms(s.replace(/\s+/g, ''));
    const alone = terms.find((t) => sqrtCalls(t.signed)?.length === 1 && t.signed.replace(/^\+/, '') === sqrtCalls(t.signed)[0].text.replace(/\s+/g, ''));
    if (alone) { side = terms; other = o; root = alone; break; }
  }
  if (!root) return null;
  const rest = side.filter((t) => t !== root).map((t) => (t.signed.startsWith('-') ? `+${t.signed.slice(1)}` : `-${t.signed.replace(/^\+/, '')}`)).join('');
  const isolated = `${other}${rest}`;
  const A = sqrtCalls(root.signed)[0].arg;
  const Algebrite = await loadAlgebrite();
  let squared;
  try { squared = toSqrt(String(Algebrite.run(`expand((${isolated})^2)`)).trim()); } catch { return null; }
  if (!squared || /nil|stop|error/i.test(squared) || sqrtCalls(squared)?.length !== 1) return null;
  const next = `${A} = ${squared}`;
  const sub = await solveSub(next);
  const text = String(sub?.answer ?? '');
  if (!sub || (sub.status && sub.status !== 'solved')) return null;
  const steps = [
    `Two square roots: isolate one, ${mark(`${pretty(root.signed.replace(/^\+/, ''))} = ${pretty(isolated)}`)}, and square both sides: ${mark(`${pretty(A)} = ${pretty(squared)}`)}.`,
    `One square root is left; solve that equation:`,
    ...(sub.steps || []).filter((s) => !/^Detected as|^Check in the original|^Solution:/.test(String(s).replace(/⟦|⟧/g, ''))).map((s) => `  ${s}`),
  ];
  const parts = /^No (real )?solution/i.test(text) ? [] : text.split(/\s+or\s+/).map((p) => p.replace(new RegExp(`^\\s*${v}\\s*=\\s*`), '').trim());
  const kept = [];
  for (const part of parts) {
    if (/≈/.test(part)) return null;
    const exact = part.replace(/\s*\((?:≈|=)[^)]*\)\s*$/, '');
    let value;
    try { value = Number(math.evaluate(exact.replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)'))); } catch { return null; }
    let L;
    let R;
    try { L = Number(math.evaluate(lhs, { [v]: value })); R = Number(math.evaluate(rhs, { [v]: value })); } catch { L = NaN; R = NaN; }
    if (Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= 1e-8 * (1 + Math.abs(L))) {
      kept.push({ exact, value });
    } else {
      steps.push(`Check ${mark(`${v} = ${exact}`)} in the original: ${Number.isFinite(L) && Number.isFinite(R) ? `${mark(pretty(lhs))} is ${mark(String(Math.round(L * 1e4) / 1e4))} but ${mark(pretty(rhs))} is ${mark(String(Math.round(R * 1e4) / 1e4))}` : 'a square root there is of a negative number'}, so it is extraneous (squaring brought it in) and is rejected.`);
    }
  }
  kept.sort((a, b) => a.value - b.value);
  const shown = kept.map((k) => `${v} = ${k.exact}`);
  if (kept.length) steps.push(`Check in the original: ${kept.map((k) => `${mark(`${v} = ${k.exact}`)} gives ${mark(String(Math.round(Number(math.evaluate(lhs, { [v]: k.value })) * 1e4) / 1e4))} on both sides`).join('; ')} ✓`);
  steps.push(shown.length ? `Solution: ${shown.map((s) => mark(s)).join(' or ')}` : 'No real solution: every candidate is extraneous.');
  return { steps, answer: shown.length ? shown.join('  or  ') : 'No real solution', solutions: kept.map((k) => k.value) };
}
