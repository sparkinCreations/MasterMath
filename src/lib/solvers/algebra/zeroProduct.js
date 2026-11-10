// A product equal to zero (1.75.0): (x − 2)·√x = 0, x·eˣ = 0,
// (2x − 1)·ln(x) = 0, and a common factor taken out first, x·ln(x) = x is
// x·(ln(x) − 1) = 0. A product is 0 exactly when one of its factors is 0 and
// every factor is defined there, so each factor is solved on its own (by the
// equation solver, `solveSub`) and a root where some factor is undefined is
// rejected, with the reason. These fell to the numeric scan, which looks for
// sign changes: it missed x = 0 in (x − 2)·√x = 0, where √x touches 0 at the
// edge of its domain without crossing.

import { math, beautify, mark, neverZeroSide } from '../solverUtils.js';

const hasVar = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(String(t));
const unwrap = (n) => (n.type === 'ParenthesisNode' ? unwrap(n.content) : n);

// The terms of a sum, each with its sign.
function termsOf(node, sign = 1, out = []) {
  const n = unwrap(node);
  if (n.type === 'OperatorNode' && n.op === '+' && n.args.length === 2) {
    termsOf(n.args[0], sign, out); termsOf(n.args[1], sign, out);
  } else if (n.type === 'OperatorNode' && n.op === '-' && n.args.length === 2) {
    termsOf(n.args[0], sign, out); termsOf(n.args[1], -sign, out);
  } else if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') {
    termsOf(n.args[0], -sign, out);
  } else {
    out.push({ sign, node: n });
  }
  return out;
}

// The factors of a product: numbers apart, the rest as text.
function factorsOf(node) {
  const n = unwrap(node);
  if (n.type === 'OperatorNode' && n.op === '*') return n.args.flatMap(factorsOf);
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return [{ number: -1 }, ...factorsOf(n.args[0])];
  if (n.type === 'ConstantNode') return [{ number: Number(n.value) }];
  return [{ text: n.toString({ implicit: 'show' }) }];
}

// D = L − R as factors with the variable: the typed product when R is 0,
// else a factor common to every term taken out. Null when there are fewer
// than two such factors.
function productFactors(lhs, rhs, v) {
  let L;
  let R;
  try { L = math.parse(lhs); R = math.parse(rhs); } catch { return null; }
  const rIsZero = unwrap(R).type === 'ConstantNode' && Number(unwrap(R).value) === 0;
  const terms = [...termsOf(L), ...termsOf(R, -1)].filter((t) => !(t.node.type === 'ConstantNode' && Number(t.node.value) === 0));
  if (terms.length === 0) return null;
  if (terms.length === 1 || rIsZero && termsOf(L).length === 1) {
    const fs = factorsOf(terms[0].node).filter((f) => f.text && hasVar(f.text, v)).map((f) => f.text);
    return fs.length >= 2 ? { factors: fs, factored: null } : null;
  }
  const per = terms.map((t) => factorsOf(t.node));
  const common = per[0].filter((f) => f.text && hasVar(f.text, v)).map((f) => f.text)
    .filter((txt, i, all) => all.indexOf(txt) === i && per.every((fs) => fs.some((g) => g.text === txt)));
  if (!common.length) return null;
  const rest = terms.map((t, k) => {
    const left = [...per[k]];
    for (const c of common) left.splice(left.findIndex((g) => g.text === c), 1);
    const num = left.filter((g) => g.number !== undefined).reduce((p, g) => p * g.number, t.sign);
    const others = left.filter((g) => g.text).map((g) => g.text);
    const body = others.length ? `${Math.abs(num) === 1 ? '' : `${Math.abs(num)}*`}${others.join('*')}` : `${Math.abs(num)}`;
    return { negative: num < 0, body };
  });
  const sum = rest.map((r, k) => (k === 0 ? `${r.negative ? '-' : ''}${r.body}` : ` ${r.negative ? '-' : '+'} ${r.body}`)).join('');
  // The two sides are the same product: (1 − 1) is 0 for every x, so this is
  // an identity on its domain, not an equation in its factors.
  try { if (!hasVar(sum, v) && Math.abs(math.evaluate(sum)) < 1e-12) return null; } catch { return null; }
  const factors = [...common, sum];
  if (factors.filter((f) => hasVar(f, v)).length < 2) return null;
  return { factors, factored: `${common.map((c) => (/[+-]/.test(c) ? `(${c})` : c)).join('*')}*(${sum})` };
}

const toMathjs = (t) => String(t).replace(/√\(/g, 'sqrt(').replace(/√([a-z0-9.]+)/gi, 'sqrt($1)').replace(/π/g, 'pi')
  .replace(/(?<![a-z])ln\(/g, 'log(').replace(/(\d)\s*(?=[a-z(])/gi, '$1*');
const valueOf = (display) => {
  try { const v = math.evaluate(toMathjs(display)); return typeof v === 'number' ? v : NaN; } catch { return NaN; }
};

export async function solveZeroProduct(expression, v, solveSub) {
  const [lhs, rhs] = String(expression).split('=');
  if (rhs === undefined) return null;
  const found = productFactors(lhs.trim(), rhs.trim(), v);
  if (!found) return null;
  const steps = [];
  const pretty = (t) => beautify(t).replace(/\bsqrt\(/g, '√(').replace(/√\(([a-z0-9]+)\)/gi, '√$1');
  const shownFactors = found.factors.map((f) => pretty(f));
  if (found.factored) steps.push(`Move everything to one side and take out the common factor: ${mark(`${pretty(found.factored).replace(/\*\(/g, '(')} = 0`)}`);
  steps.push(`A product is ${mark('0')} exactly when one of its factors is ${mark('0')} and every factor is defined there, so solve each factor on its own.`);
  const candidates = [];
  for (const [i, f] of found.factors.entries()) {
    if (!hasVar(f, v)) continue;
    if (neverZeroSide(f, '0', v)) {
      steps.push(`${mark(`${shownFactors[i]} = 0`)}: never, since ${mark(shownFactors[i])} is never ${mark('0')}.`);
      continue;
    }
    const sub = await solveSub(`${f} = 0`);
    const text = String(sub?.answer ?? '');
    if (!sub || (sub.status && !['solved', 'undefined'].includes(sub.status))) return null;
    if (/^No (real )?solution/i.test(text)) {
      steps.push(`${mark(`${shownFactors[i]} = 0`)}: no real solution.`);
      continue;
    }
    const parts = text.split(/\s+or\s+/).map((p) => p.replace(new RegExp(`^\\s*${v}\\s*=\\s*`), '').replace(/\s*\((?:repeated root, )?multiplicity \d+\)/, '').trim());
    const roots = [];
    for (const part of parts) {
      const approx = /≈/.test(part.replace(/\s*\((?:≈|=)[^)]*\)\s*$/, ''));
      const exact = part.replace(/\s*\((?:≈|=)[^)]*\)\s*$/, '').replace(/^≈\s*/, '');
      const value = valueOf(exact);
      if (!Number.isFinite(value)) return null; // a root not read: leave to the other methods
      roots.push({ shown: approx ? `≈ ${exact}` : exact, value, approx });
    }
    // "x = 0" is its own answer; anything else says what it gives.
    const own = roots.length === 1 && shownFactors[i] === v && roots[0].value === 0;
    steps.push(own ? `${mark(`${v} = 0`)}.` : `${mark(`${shownFactors[i]} = 0`)}: ${roots.map((r) => mark(`${v} ${r.approx ? '≈' : '='} ${r.shown.replace(/^≈\s*/, '')}`)).join(' or ')}.`);
    candidates.push(...roots);
  }
  // Every factor must be defined at a root: x·ln(x) = 0 does not have x = 0.
  const definedAt = (t, x) => {
    try { const y = math.evaluate(String(t), { [v]: x }); return typeof y === 'number' && Number.isFinite(y); } catch { return false; }
  };
  const kept = [];
  for (const c of candidates) {
    if (kept.some((k) => Math.abs(k.value - c.value) < 1e-9)) continue;
    const bad = found.factors.find((f) => hasVar(f, v) && !definedAt(f, c.value));
    if (bad || !definedAt(lhs, c.value) || !definedAt(rhs, c.value)) {
      steps.push(`Reject ${mark(`${v} = ${c.shown.replace(/^≈\s*/, '')}`)}: there ${mark(pretty(bad || lhs))} is undefined.`);
      continue;
    }
    const diff = Number(math.evaluate(`(${lhs}) - (${rhs})`, { [v]: c.value }));
    if (!(Math.abs(diff) <= 1e-7 * (1 + Math.abs(Number(math.evaluate(lhs, { [v]: c.value })))))) return null;
    kept.push(c);
  }
  kept.sort((p, q) => p.value - q.value);
  const shown = kept.map((c) => `${v} ${c.approx ? '≈' : '='} ${c.shown.replace(/^≈\s*/, '')}`);
  steps.push(shown.length ? `Solution: ${shown.map((s) => mark(s)).join(' or ')}` : 'No real solution.');
  return {
    steps,
    answer: shown.length ? shown.join('  or  ') : 'No real solution',
    solutions: kept.map((c) => c.value),
  };
}
