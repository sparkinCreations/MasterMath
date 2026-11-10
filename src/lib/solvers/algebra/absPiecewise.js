// Several absolute values of linear expressions (1.76.0): |x| + |x − 2| = 4,
// |x − 1| − |2x + 3| = x. Each absolute value changes form where its inside
// is 0, so the number line is split at those points; on each piece every
// |…| is ± its inside, the equation is solved there, and a root counts only
// if it lies in its piece. A piece where the equation holds for every x
// gives that whole stretch (|x| + |x − 2| = 2 is 0 ≤ x ≤ 2). Every root is
// checked in the original. This fell to the numeric search.

import { matchingParen } from '../../mathParser.js';
import { math, exactForm, decimalsAsFractions, mark, loadAlgebrite } from '../solverUtils.js';
import { prettyRadicals, IMAGINARY } from './rootsFormat.js';

const hasVar = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(String(t));

// Every abs(…) in the text, with its inside.
function absCalls(text) {
  const out = [];
  const re = /(?<![a-z])abs\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close < 0) return null;
    out.push({ start: m.index, end: close + 1, arg: text.slice(open + 1, close) });
    re.lastIndex = close + 1;
  }
  return out;
}

// The text with each abs(arg) replaced by (arg) or (−(arg)).
function withSigns(text, calls, signs) {
  let out = '';
  let at = 0;
  calls.forEach((c, i) => {
    out += text.slice(at, c.start) + (signs[i] > 0 ? `(${c.arg})` : `(-(${c.arg}))`);
    at = c.end;
  });
  return out + text.slice(at);
}

// Polynomials and absolute values only. Expanding a piece cancels 1/x against
// 1/x and x/x to 1, so a variable under a division, or a power that is not a
// whole number, would lose the values where the equation is undefined.
function polynomialWithAbs(node, v) {
  const check = (n) => polynomialWithAbs(n, v);
  const mentions = (n) => n.filter((t) => t.isSymbolNode && t.name === v).length > 0;
  // A part without the variable made of roots (√5, 3·√2, 2^(1/2)) is a
  // number: kept when it is a real one, so the roots stay exact instead of
  // going to the search. Logarithms stay out: Algebrite leaves log(100) as
  // ln(100)/ln(10), not 2.
  if (!mentions(node) && node.type !== 'ConstantNode' && node.type !== 'SymbolNode') {
    if (node.filter((t) => t.isFunctionNode && t.name !== 'sqrt').length) return false;
    try {
      const value = node.evaluate();
      return typeof value === 'number' && Number.isFinite(value);
    } catch { return false; }
  }
  switch (node.type) {
    case 'ConstantNode': return true;
    case 'SymbolNode': return node.name === v || node.name === 'pi' || node.name === 'e';
    case 'ParenthesisNode': return check(node.content);
    case 'FunctionNode': return node.name === 'abs' && node.args.length === 1 && check(node.args[0]);
    case 'OperatorNode':
      if (['+', '-', '*'].includes(node.op)) return node.args.every(check);
      if (node.op === '/') return !mentions(node.args[1]) && node.args.every(check);
      if (node.op === '^') {
        if (!check(node.args[0])) return false;
        try {
          const power = node.args[1].evaluate();
          return Number.isInteger(power) && power >= 0;
        } catch { return false; }
      }
      return false;
    default: return false;
  }
}

// A root as a textbook writes it: √6 − 1, (√17 − 1)/2. The value is computed
// from Algebrite's own text, never from this.
// √2·√5 is √10, and 3*√2 is 3√2.
function radicalText(t) {
  let out = prettyRadicals(exactForm(t));
  while (/√\d+\*?√\d+/.test(out)) out = out.replace(/√(\d+)\*?√(\d+)/, (m, a, b) => `√${a * b}`);
  return out.replace(/(\d)\*√/g, '$1√');
}

function rootText(root) {
  const out = radicalText(root);
  const over = out.match(/^(-?√\d+)\/(\d+) ([+-]) (\d+)\/\2$/);
  return over ? `(${over[1]} ${over[3]} ${over[4]})/${over[2]}` : out;
}

export async function solveAbsPiecewise(equation, v) {
  const sides = String(equation).split('=');
  if (sides.length !== 2) return null;
  const [lhs, rhs] = sides.map(decimalsAsFractions);
  const text = `(${lhs.trim()}) - (${rhs.trim()})`;
  const calls = absCalls(text);
  if (!calls || calls.length < 2) return null;
  if (calls.some((c) => /abs\s*\(/i.test(c.arg) || !hasVar(c.arg, v))) return null;
  try { if (!polynomialWithAbs(math.parse(text), v)) return null; } catch { return null; }
  const Algebrite = await loadAlgebrite();
  const run = (e) => { const o = String(Algebrite.run(e)).trim(); if (!o || /nil|stop|error/i.test(o)) throw new Error(o); return o; };
  // Where each inside is 0: linear insides only.
  const points = [];
  try {
    for (const c of calls) {
      if (run(`deg(${c.arg}, ${v})`) !== '1') return null;
      const a = run(`coeff(${c.arg}, ${v}, 1)`);
      const b = run(`coeff(${c.arg}, ${v}, 0)`);
      const r = run(`simplify(-(${b})/(${a}))`);
      const value = Number(math.evaluate(r));
      if (!Number.isFinite(value)) return null;
      if (!points.some((p) => Math.abs(p.value - value) < 1e-12)) points.push({ text: rootText(r), value });
    }
  } catch { return null; }
  points.sort((p, q) => p.value - q.value);
  // The pieces: (−∞, c1), [c1, c2), …, [ck, ∞).
  const pieces = [];
  for (let i = 0; i <= points.length; i += 1) {
    const lo = i === 0 ? null : points[i - 1];
    const hi = i === points.length ? null : points[i];
    pieces.push({ lo, hi });
  }
  const label = (p) => (p.lo && p.hi ? `${p.lo.text} ≤ ${v} < ${p.hi.text}` : p.lo ? `${v} ≥ ${p.lo.text}` : `${v} < ${p.hi.text}`);
  const inside = (p, x) => (p.lo ? x >= p.lo.value - 1e-12 : true) && (p.hi ? x <= p.hi.value + 1e-12 : true);
  const shownAbs = calls.map((c) => `|${exactForm(c.arg)}|`);
  const steps = [
    `Each absolute value changes form where its inside is ${mark('0')}: ${points.map((p) => mark(`${v} = ${p.text}`)).join(' and ')}. Split the number line at ${points.length === 1 ? 'that point' : 'those points'} and solve on each piece, where every ${mark('|…|')} is its inside or minus its inside.`,
  ];
  const roots = [];
  const stretches = [];
  for (const p of pieces) {
    const test = p.lo && p.hi ? (p.lo.value + p.hi.value) / 2 : p.lo ? p.lo.value + 1 : p.hi.value - 1;
    let signs;
    try { signs = calls.map((c) => (Number(math.evaluate(c.arg, { [v]: test })) >= 0 ? 1 : -1)); } catch { return null; }
    const piece = withSigns(text, calls, signs);
    let expanded;
    try { expanded = run(`expand(${piece})`); } catch { return null; }
    // −x for a plain inside, −(x − 2) otherwise.
    const neg = (arg) => (/^[a-z0-9.]+$/i.test(arg.trim()) ? `−${exactForm(arg)}` : `−(${exactForm(arg)})`);
    const forms = calls.map((c, i) => `${shownAbs[i]} = ${signs[i] > 0 ? exactForm(c.arg) : neg(c.arg)}`);
    // The equation on this piece as typed, each side simplified.
    const side = (t) => {
      const own = absCalls(t) || [];
      const sg = own.map((c) => (Number(math.evaluate(c.arg, { [v]: test })) >= 0 ? 1 : -1));
      return radicalText(run(`expand(${withSigns(t, own, sg)})`));
    };
    let pieceEq;
    try { pieceEq = `${side(lhs.trim())} = ${side(rhs.trim())}`; } catch { pieceEq = `${radicalText(expanded)} = 0`; }
    const head = `For ${mark(label(p))}: ${forms.map((f) => mark(f)).join(', ')}, so the equation is ${mark(pieceEq)}.`;
    let degree;
    try { degree = Number(run(`deg(${expanded}, ${v})`)); } catch { return null; }
    // A coefficient that is 0 in value but not in Algebrite's text, as in
    // √(3 + 2√2) − √2 − 1: read as a number, a piece true for every x looks false.
    try {
      for (const k of [0, 1, 2]) {
        const c = run(`coeff(${expanded}, ${v}, ${k})`);
        if (c !== '0' && !(Math.abs(Number(math.evaluate(c))) > 1e-9)) return null;
      }
    } catch { return null; }
    if (!hasVar(expanded, v)) {
      if (expanded === '0') {
        // True for every x on this piece.
        steps.push(`${head} It holds for every ${mark(v)} here, so the whole piece ${mark(label(p))} is a solution.`);
        stretches.push(p);
      } else {
        steps.push(`${head} That is false, so there is no solution here.`);
      }
      continue;
    }
    if (degree > 2) return null;
    let raw;
    try { raw = run(`roots(${expanded}, ${v})`); } catch { return null; }
    const list = raw.replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
    const found = [];
    const notes = [];
    for (const r of list) {
      if (IMAGINARY.test(r)) continue;
      let value;
      try { value = Number(math.evaluate(r)); } catch { return null; }
      if (!Number.isFinite(value)) return null;
      const shown = rootText(r);
      // Exact only when it can be read: a nested root or a quotient of sums
      // goes to the other methods, which round it.
      if (/√\(|\/\(/.test(shown)) return null;
      const atEdge = p.hi && Math.abs(value - p.hi.value) < 1e-12;
      if (inside(p, value)) {
        found.push({ shown, value });
        notes.push(`${mark(`${v} = ${shown}`)}${atEdge ? ', at the edge of this piece, where both forms agree ✓' : ', in this piece ✓'}`);
      } else {
        notes.push(`${mark(`${v} = ${shown}`)}, not in this piece, so rejected`);
      }
    }
    if (notes.length) steps.push(`${head} It gives ${notes.join('; ')}.`.replace(/✓\.$/, '✓'));
    else steps.push(`${head} It has no real solution.`);
    for (const f of found) if (!roots.some((q) => Math.abs(q.value - f.value) < 1e-12)) roots.push(f);
  }
  // A root inside a stretch is already listed by the stretch.
  const kept = roots.filter((r) => !stretches.some((p) => inside(p, r.value)));
  // Every root in the original.
  for (const r of kept) {
    let d;
    try { d = Number(math.evaluate(text, { [v]: r.value })); } catch { return null; }
    if (!(Math.abs(d) <= 1e-9 * (1 + Math.abs(r.value)))) return null;
  }
  // Join neighbouring stretches into one interval ([0, 2) and [2, ∞) → x ≥ 0).
  const intervals = [];
  for (const p of stretches) {
    const last = intervals[intervals.length - 1];
    if (last && last.hi && p.lo && Math.abs(last.hi.value - p.lo.value) < 1e-12) last.hi = p.hi;
    else intervals.push({ lo: p.lo, hi: p.hi });
  }
  // A stretch's right end is included when it is a solution there.
  const closedLabel = (p) => (p.lo && p.hi ? `${p.lo.text} ≤ ${v} ≤ ${p.hi.text}` : p.lo ? `${v} ≥ ${p.lo.text}` : `${v} ≤ ${p.hi.text}`);
  for (const p of intervals) {
    for (const x of [p.lo?.value, p.hi?.value].filter((t) => t !== undefined)) {
      if (!(Math.abs(Number(math.evaluate(text, { [v]: x }))) <= 1e-9)) return null;
    }
  }
  // Every piece true for every x: the whole line.
  if (intervals.length === 1 && !intervals[0].lo && !intervals[0].hi) {
    steps.push('The equation holds on every piece, so all real numbers are solutions.');
    return { steps, answer: `All real numbers (identity — true for every ${v})`, solutions: [] };
  }
  kept.sort((a, b) => a.value - b.value);
  const parts = [...intervals.map((p) => closedLabel(p)), ...kept.filter((r) => !intervals.some((p) => (p.lo ? r.value >= p.lo.value - 1e-12 : true) && (p.hi ? r.value <= p.hi.value + 1e-12 : true))).map((r) => `${v} = ${r.shown}`)];
  if (kept.length) steps.push(`Check in the original: ${kept.map((r) => `${mark(`${v} = ${r.shown}`)} makes the two sides equal`).join('; ')} ✓`);
  steps.push(parts.length ? `Solution: ${parts.map((t) => mark(t)).join(' or ')}` : 'No real solution.');
  return { steps, answer: parts.length ? parts.join('  or  ') : 'No real solution', solutions: kept.map((r) => r.value) };
}
