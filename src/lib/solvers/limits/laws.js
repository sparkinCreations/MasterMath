// Limits at +∞ by the limit laws, read off the parse tree (1.68.6). Three
// families reached sampling and were answered wrongly (outside review,
// November 2026): √(x + 1) − √x, √x/(x + 1) and sin(1/√x) as "0.0001",
// 1/ln(x) and 1/ln(ln(x)) as "does not exist". Each is a fact about the
// expression, proved here:
//   - leading powers: a sum, product, quotient or root of x^p and constants
//     behaves like c·x^p (√(x + 1) like √x, x + 1 like x), so a quotient is
//     decided by dividing top and bottom by the larger power;
//   - the conjugate of two roots: √A − √B = (A − B)/(√A + √B), read the same
//     way, when the leading powers cancel (∞ − ∞);
//   - the limit laws, inside out: limits of sums, products and quotients; a
//     bounded value over something that grows without bound → 0; ln, √, eˣ
//     and positive powers of something that grows grow; a function
//     continuous at L passes the limit through (sin(1/√x) → sin(0) = 0).
// Only x → +∞, and only an exact answer (0, ±∞ or a small rational); anything
// else declines, and the older rungs, then sampling, decide.

import { math, beautify, mark, absBars, isAlgebriteFailure } from '../solverUtils.js';
import { evalAt } from './numeric.js';
import { tryGrowthRates } from './growth.js';

const unwrap = (n) => (n && n.type === 'ParenthesisNode' ? unwrap(n.content) : n);
const show = (n) => absBars(beautify(unwrap(n).toString().replace(/ ([/^]) /g, '$1')));
// In brackets when it is more than one term: (x + 1) − x, 1/(…).
const group = (n) => {
  const u = unwrap(n);
  return u.type === 'OperatorNode' && ['+', '-'].includes(u.op) && u.args.length === 2 ? `(${show(u)})` : show(u);
};
const LOGS = new Set(['ln', 'log', 'log10', 'log2']);
const ARC = { arctan: 'atan', arcsin: 'asin', arccos: 'acos' };
// Continuous wherever the value is finite (tan at π/2 is not finite; the
// inverse sine and cosine only inside (−1, 1), checked where used).
const CONTINUOUS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'atan', 'asin', 'acos', 'sinh', 'cosh', 'tanh', 'abs']);

// A small rational as text, or null: the only finite answers given.
function rational(value) {
  if (Object.is(value, -0) || value === 0) return '0';
  for (let b = 1; b <= 100; b += 1) {
    const a = Math.round(value * b);
    if (a !== 0 && Math.abs(value - a / b) < 1e-12 * Math.max(1, Math.abs(value))) return b === 1 ? String(a) : `${a}/${b}`;
  }
  return null;
}

const isConstant = (n, v) => n.filter((x) => x.type === 'SymbolNode' && x.name === v).length === 0;
function constantValue(n) {
  try {
    const y = n.evaluate({});
    return typeof y === 'number' && Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

// c·x^p with c ≠ 0, the term a power-like expression behaves like as x → ∞
// (f/(c·x^p) → 1); { c: 0 } for the constant 0; null when the leading terms
// cancel (√(x + 1) − √x) or the expression is not built from x, constants,
// + − · ÷, constant powers and roots.
export function leadingPower(raw, v) {
  const n = unwrap(raw);
  if (isConstant(n, v)) {
    const c = constantValue(n);
    if (c === null) return null;
    return c === 0 ? { c: 0, p: -Infinity } : { c, p: 0 };
  }
  if (n.type === 'SymbolNode') return n.name === v ? { c: 1, p: 1 } : null;
  if (n.type === 'OperatorNode') {
    if (n.fn === 'unaryMinus') {
      const a = leadingPower(n.args[0], v);
      return a && { c: -a.c, p: a.p };
    }
    if (n.fn === 'unaryPlus') return leadingPower(n.args[0], v);
    const [a, b] = n.args.map((x) => leadingPower(x, v));
    if (!a || (n.op !== '^' && !b)) return null;
    if (n.op === '+' || n.op === '-') {
      const bc = n.op === '-' ? -b.c : b.c;
      if (a.p > b.p) return a;
      if (b.p > a.p) return { c: bc, p: b.p };
      const c = a.c + bc;
      // Equal powers that cancel: the next terms decide, which this does not see.
      if (Math.abs(c) <= 1e-12 * Math.max(Math.abs(a.c), Math.abs(bc))) return null;
      return { c, p: a.p };
    }
    if (n.op === '*') return a.c === 0 || b.c === 0 ? { c: 0, p: -Infinity } : { c: a.c * b.c, p: a.p + b.p };
    if (n.op === '/') {
      if (b.c === 0) return null;
      return a.c === 0 ? a : { c: a.c / b.c, p: a.p - b.p };
    }
    if (n.op === '^') {
      if (!isConstant(n.args[1], v)) return null;
      const r = constantValue(n.args[1]);
      if (r === null || a.c === 0 || (a.c < 0 && !Number.isInteger(r))) return null;
      return { c: a.c ** r, p: a.p * r };
    }
    return null;
  }
  if (n.type === 'FunctionNode' && n.args.length === 1) {
    const a = leadingPower(n.args[0], v);
    if (!a || a.c === 0) return null;
    if (n.fn.name === 'sqrt') return a.c > 0 ? { c: Math.sqrt(a.c), p: a.p / 2 } : null;
    if (n.fn.name === 'cbrt') return { c: Math.cbrt(a.c), p: a.p / 3 };
    if (n.fn.name === 'abs') return { c: Math.abs(a.c), p: a.p };
  }
  return null;
}

// c·x^p as text, or null when c is not a small rational.
function powerText({ c, p }, v) {
  const cText = rational(c);
  const pText = rational(p);
  if (cText === null || pText === null) return null;
  if (p === 0) return cText;
  const xp = p === 1 ? v : p === 0.5 ? `√${v}` : /\//.test(pText) || p < 0 ? `${v}^(${pText})` : `${v}^${pText}`;
  if (cText === '1') return xp;
  if (cText === '-1') return `-${xp}`;
  return `${/\//.test(cText) ? `(${cText})` : cText}${xp}`;
}

const INF = (sign) => ({ inf: sign });
const describe = (L) => (L.inf ? (L.inf > 0 ? '∞' : '-∞') : L.text ?? rational(L.value) ?? String(L.value));

// The limit of a power-like expression from its leading term, with the step.
function fromLeading(n, lead, v) {
  // x itself needs no step.
  if (n.type === 'SymbolNode') return { L: INF(1), steps: [] };
  const f = show(n);
  const leadText = powerText(lead, v);
  if (leadText === null) return null;
  let L;
  let why;
  if (lead.p > 0) {
    L = INF(Math.sign(lead.c));
    why = `a positive power of ${mark(v)} grows without bound`;
  } else if (lead.p < 0) {
    L = { value: 0 };
    why = `a negative power of ${mark(v)} → ${mark('0')}`;
  } else {
    L = { value: lead.c };
    why = 'a constant';
  }
  const top = unwrap(n);
  let step;
  if (top.type === 'OperatorNode' && top.op === '/') {
    const [num, den] = top.args.map((x) => leadingPower(x, v));
    const numText = num && powerText(num, v);
    const denText = den && powerText(den, v);
    if (!numText || !denText) return null;
    step = num.p === 0
      ? `As ${mark(`${v} → ∞`)}, the denominator behaves like its leading term ${mark(denText)}, so the quotient behaves like ${mark(leadText)}, and ${why}: ${mark(`${f} → ${describe(L)}`)}.`
      : `As ${mark(`${v} → ∞`)}, the numerator behaves like its leading term ${mark(numText)} and the denominator like ${mark(denText)}: divide both by ${mark(powerText({ c: 1, p: den.p }, v))}. The quotient behaves like ${mark(leadText)}, and ${why}, so ${mark(`${f} → ${describe(L)}`)}.`;
  } else if (leadText === f) {
    step = `As ${mark(`${v} → ∞`)}, ${why}: ${mark(`${f} → ${describe(L)}`)}.`;
  } else if (lead.p === 0) {
    step = `As ${mark(`${v} → ∞`)}, every term of ${mark(f)} but its constant leading term ${mark(leadText)} dies away: ${mark(`${f} → ${describe(L)}`)}.`;
  } else {
    step = `As ${mark(`${v} → ∞`)}, ${mark(f)} behaves like its leading term ${mark(leadText)}, and ${why}, so ${mark(`${f} → ${describe(L)}`)}.`;
  }
  return { L, steps: [step] };
}

// The limit laws, inside out. { L: { value } | { inf: ±1 }, steps } or null.
function limitOf(raw, v, alg) {
  const n = unwrap(raw);
  if (isConstant(n, v)) {
    const c = constantValue(n);
    return c === null ? null : { L: { value: c }, steps: [] };
  }
  const lead = leadingPower(n, v);
  if (lead && lead.c !== 0) return fromLeading(n, lead, v);
  const f = show(n);

  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') {
    const a = limitOf(n.args[0], v, alg);
    if (!a) return null;
    return { L: a.L.inf ? INF(-a.L.inf) : { value: -a.L.value }, steps: a.steps };
  }
  if (n.type === 'OperatorNode' && ['+', '-', '*', '/'].includes(n.op)) {
    const a = limitOf(n.args[0], v, alg);
    const b = a && limitOf(n.args[1], v, alg);
    if (!a || !b) return null;
    const steps = [...a.steps, ...b.steps];
    const A = a.L;
    const B = n.op === '-' ? (b.L.inf ? INF(-b.L.inf) : { value: -b.L.value }) : b.L;
    let L = null;
    let why = null;
    if (n.op === '+' || n.op === '-') {
      if (!A.inf && !B.inf) L = { value: A.value + B.value };
      else if (A.inf && B.inf && A.inf !== B.inf) return null; // ∞ − ∞
      else { L = INF(A.inf || B.inf); why = 'a sum with a term that grows without bound, and nothing pulling the other way, grows without bound'; }
    } else if (n.op === '*') {
      if (!A.inf && !B.inf) L = { value: A.value * B.value };
      else if ((A.inf && !B.inf && B.value === 0) || (B.inf && !A.inf && A.value === 0)) return null; // 0·∞
      else { L = INF((A.inf || Math.sign(A.value)) * (B.inf || Math.sign(B.value))); why = 'a product of something that grows without bound and something that does not go to 0 grows without bound'; }
    } else {
      if (!B.inf && B.value === 0) return null;
      if (A.inf && B.inf) return null; // ∞/∞
      if (!A.inf && B.inf) { L = { value: 0 }; why = 'a quantity that stays bounded, divided by one that grows without bound, → 0'; }
      else if (A.inf) { L = INF(A.inf * Math.sign(B.value)); why = 'something that grows without bound, divided by a nonzero constant, grows without bound'; }
      else L = { value: A.value / B.value };
    }
    if (why) steps.push(`${why[0].toUpperCase()}${why.slice(1)}: ${mark(`${f} → ${describe(L)}`)}.`);
    return { L, steps };
  }
  if (n.type === 'OperatorNode' && n.op === '^') {
    const [base, exp] = n.args.map(unwrap);
    if (isConstant(exp, v)) {
      const r = constantValue(exp);
      const a = limitOf(base, v, alg);
      if (r === null || !a) return null;
      if (a.L.inf > 0 && r !== 0) {
        const L = r > 0 ? INF(1) : { value: 0 };
        return { L, steps: [...a.steps, `${r > 0 ? 'A positive power of something that grows without bound grows without bound' : 'A negative power of something that grows without bound → 0'}: ${mark(`${f} → ${describe(L)}`)}.`] };
      }
      if (!a.L.inf && a.L.value > 0) return { L: { value: a.L.value ** r }, steps: a.steps };
      return null;
    }
    if (isConstant(base, v)) {
      const b = base.type === 'SymbolNode' && base.name === 'e' ? Math.E : constantValue(base);
      const a = limitOf(exp, v, alg);
      if (!a || b === null || b <= 0 || b === 1) return null;
      if (!a.L.inf) return { L: { value: b ** a.L.value }, steps: a.steps };
      const grows = (b > 1) === (a.L.inf > 0);
      const L = grows ? INF(1) : { value: 0 };
      return { L, steps: [...a.steps, `${grows ? 'An exponential whose exponent runs the growing way grows without bound' : 'An exponential whose exponent runs the shrinking way → 0'}: ${mark(`${f} → ${describe(L)}`)}.`] };
    }
    return powerOfBoth(n, base, exp, v, alg);
  }
  if (n.type === 'FunctionNode') {
    // The parser writes arctan, arcsin, arccos; mathjs evaluates atan, ….
    const shownName = n.fn.name;
    const name = ARC[shownName] ?? shownName;
    // log(x, b) with a constant base b > 1 grows like ln.
    if (name === 'log' && n.args.length === 2) {
      const b = isConstant(n.args[1], v) ? constantValue(n.args[1]) : null;
      if (b === null || b <= 1) return null;
    } else if (n.args.length !== 1) {
      return null;
    }
    const a = limitOf(n.args[0], v, alg);
    if (!a) return null;
    const inner = show(unwrap(n.args[0]));
    if (a.L.inf) {
      if (a.L.inf > 0 && (LOGS.has(name) || name === 'sqrt' || name === 'exp')) {
        const again = a.steps.length && a.steps[a.steps.length - 1].startsWith(LOGS.has(name) ? 'A logarithm' : '\u0000');
        if (again) return { L: INF(1), steps: [...a.steps, `In the same way, ${mark(`${f} → ∞`)}.`] };
        const what = LOGS.has(name) ? 'A logarithm of something that grows without bound grows without bound (slowly, but without limit)' : name === 'sqrt' ? 'The square root of something that grows without bound grows without bound' : 'An exponential of something that grows without bound grows without bound';
        return { L: INF(1), steps: [...a.steps, `${what}: ${mark(`${f} → ∞`)}.`] };
      }
      if (name === 'exp' && a.L.inf < 0) return { L: { value: 0 }, steps: [...a.steps, `An exponential of something that runs to ${mark('-∞')} → ${mark('0')}: ${mark(`${f} → 0`)}.`] };
      if (name === 'abs') return { L: INF(1), steps: a.steps };
      // arctan levels off at ±π/2: its horizontal asymptotes.
      if (name === 'atan') {
        const L = { value: (a.L.inf * Math.PI) / 2, text: a.L.inf > 0 ? 'π/2' : '-π/2' };
        return { L, steps: [...a.steps, `${mark(shownName)} levels off at its horizontal asymptote: ${mark(`${f} → ${L.text}`)}.`] };
      }
      return null;
    }
    // A finite inner limit L: continuity at L passes the limit through. Not at
    // a domain edge (ln and √ at 0, arcsin and arccos at ±1), where the inside
    // could approach from outside the domain.
    const L0 = a.L.value;
    if (LOGS.has(name) || name === 'sqrt') { if (!(L0 > 0)) return null; }
    else if (name === 'asin' || name === 'acos') { if (!(Math.abs(L0) < 1)) return null; }
    else if (name !== 'exp' && !CONTINUOUS.has(name)) return null;
    let value;
    try { value = Number(math.evaluate(`${name}(${L0}${n.args.length === 2 ? `, ${constantValue(n.args[1])}` : ''})`)); } catch { return null; }
    if (!Number.isFinite(value)) return null;
    const at = rational(L0) ?? String(L0);
    return {
      L: { value },
      steps: [...a.steps, `${mark(shownName)} is continuous at ${mark(at)}, so the limit passes inside: ${mark(`${f} → ${shownName}(${at}) = ${rational(value) ?? value}`)}.`],
    };
  }
  return null;
}

// f^g with both parts varying, as e^(g·ln f) for f > 0. The forms that are
// not indeterminate are read off the parts' limits; ∞⁰ (x^(1/x)) is decided
// by the exponent g·ln f, from the growth-rate proof; 1^∞ and 0⁰ are left to
// their own techniques.
function powerOfBoth(n, base, exp, v, alg) {
  const f = show(n);
  const a = limitOf(base, v, alg);
  const b = a && limitOf(exp, v, alg);
  if (!a || !b) return null;
  const steps = [...a.steps, ...b.steps];
  const A = a.L;
  const B = b.L;
  const done = (L, why) => ({ L, steps: [...steps, `${why}: ${mark(`${f} → ${describe(L)}`)}.`] });
  if (!A.inf && A.value > 0 && !B.inf) {
    return done({ value: A.value ** B.value }, `The base → ${mark(describe(A))} and the exponent → ${mark(describe(B))}, and a power is continuous there`);
  }
  if (!A.inf && A.value > 0 && A.value !== 1 && B.inf) {
    const grows = (A.value > 1) === (B.inf > 0);
    return done(grows ? INF(1) : { value: 0 }, `The base → ${mark(describe(A))}, ${A.value > 1 ? 'more' : 'less'} than ${mark('1')}, and the exponent → ${mark(describe(B))}`);
  }
  if (A.inf > 0 && (B.inf || B.value !== 0)) {
    const grows = B.inf ? B.inf > 0 : B.value > 0;
    return done(grows ? INF(1) : { value: 0 }, `The base grows without bound and the exponent → ${mark(describe(B))}`);
  }
  if (A.inf > 0 && !B.inf && B.value === 0 && alg) {
    // ∞⁰: the exponent of e^(g·ln f) decides.
    const g = unwrap(exp).toString();
    const product = `(${g})*ln(${unwrap(base).toString()})`;
    const growth = tryGrowthRates(alg, product, v, Infinity);
    if (!growth || !growth.verified) return null;
    const E = growth.answer;
    const L = E === '0' ? { value: 1 } : E === '∞' ? INF(1) : E === '-∞' ? { value: 0 } : null;
    if (!L) return null;
    const exponent = show(math.parse(product));
    return {
      L,
      steps: [
        ...steps,
        `This is the form ${mark('∞^0')}, which is indeterminate. Write ${mark(`${f} = e^(${exponent})`)}: the limit of the exponent decides.`,
        ...growth.steps,
        `So the exponent ${mark(`→ ${E}`)}, and ${mark(`${f} → ${E === '0' ? 'e^0 = 1' : E === '∞' ? '∞' : '0'}`)}.`,
      ],
    };
  }
  return null;
}

// √A − √B with leading terms that cancel: the conjugate.
function conjugateOfRoots(tree, v, Algebrite) {
  const n = unwrap(tree);
  if (!Algebrite || n.type !== 'OperatorNode' || n.op !== '-') return null;
  const [p, q] = n.args.map(unwrap);
  const isRoot = (x) => x.type === 'FunctionNode' && x.fn.name === 'sqrt' && x.args.length === 1;
  if (!isRoot(p) || !isRoot(q)) return null;
  const A = unwrap(p.args[0]);
  const B = unwrap(q.args[0]);
  const la = leadingPower(A, v);
  const lb = leadingPower(B, v);
  if (!la || !lb || !(la.c > 0) || !(lb.c > 0) || la.p <= 0 || la.p !== lb.p || Math.abs(la.c - lb.c) > 1e-12 * la.c) return null;
  const out = String(Algebrite.run(`expand((${A.toString()})-(${B.toString()}))`)).trim();
  if (isAlgebriteFailure(out)) return null;
  let diff;
  try { diff = math.parse(out); } catch { return null; }
  let rewritten;
  const top = diff.type === 'OperatorNode' && ['+', '-'].includes(diff.op) ? `(${out})` : out;
  try { rewritten = math.parse(`${top}/(${p.toString()} + ${q.toString()})`); } catch { return null; }
  const rest = limitOf(rewritten, v, Algebrite);
  if (!rest) return null;
  const conj = `${show(p)} + ${show(q)}`;
  return {
    L: rest.L,
    rewrite: `${group(diff)}/(${conj})`,
    steps: [
      `Both ${mark(show(p))} and ${mark(show(q))} grow without bound, at the same rate: this is ${mark('∞ − ∞')}, which is indeterminate. Multiply and divide by the conjugate ${mark(conj)}.`,
      `${mark(`(${show(p)} − ${show(q)})(${conj}) = ${show(A)} − ${group(B)} = ${show(diff)}`)}, so ${mark(`${show(n)} = ${group(diff)}/(${conj})`)}.`,
      ...rest.steps,
    ],
  };
}

// Not a proof of anything: a guard against a mistake in the rules above. The
// function must be defined far out, and its samples must move toward the
// answer (or grow, for ∞), never away from it.
function consistent(func, v, L) {
  const xs = [1e3, 1e6, 1e9, 1e12];
  const ys = xs.map((x) => evalAt(func, v, x));
  if (ys.some((y) => Number.isNaN(y))) return false;
  if (L.inf) return ys.every((y) => !Number.isFinite(y) || Math.sign(y) === L.inf) && Math.abs(ys[3]) >= Math.abs(ys[0]);
  const gap = ys.map((y) => Math.abs(y - L.value));
  return Number.isFinite(gap[3]) && gap[3] <= gap[0] + 1e-12;
}

export function tryLimitLaws(Algebrite, func, variable, target) {
  if (target === -Infinity) return atMinusInfinity(Algebrite, func, variable);
  if (target !== Infinity) return null;
  let tree;
  try { tree = math.parse(func); } catch { return null; }
  const v = variable;
  let found = conjugateOfRoots(tree, v, Algebrite);
  let method = 'conjugate of two roots';
  if (!found) {
    // A quotient of power-like parts is the leading-terms method; anything
    // else is the limit laws.
    const lead = leadingPower(tree, v);
    found = limitOf(tree, v, Algebrite);
    method = lead && lead.c !== 0 ? 'leading powers' : 'limit laws';
  }
  if (!found) return null;
  const answer = found.L.inf ? (found.L.inf > 0 ? '∞' : '-∞') : found.L.text ?? rational(found.L.value);
  if (answer === null || !consistent(func, v, found.L)) return null;
  // The insight applied to this limit, shown second (limits/guidance.js).
  const f = show(tree);
  let here;
  if (method === 'conjugate of two roots') {
    here = `Here: ${mark(`${f} = ${found.rewrite}`)}, and that quotient ${mark(`→ ${answer}`)}.`;
  } else if (method === 'leading powers') {
    here = `Here: ${mark(f)} behaves like ${mark(powerText(leadingPower(tree, v), v))}, so the limit is ${mark(answer)}.`;
  } else {
    // The arrows the steps established, inside out: "ln(x) → ∞, then …".
    const arrows = found.steps.map((s) => (s.match(/⟦([^⟦⟧]*→[^⟦⟧]*)⟧\.$/) || [])[1]).filter(Boolean);
    here = arrows.length ? `Here, from the inside out: ${arrows.map((a) => mark(a)).join(', then ')}.` : null;
  }
  return {
    steps: found.steps,
    answer,
    verified: true,
    verificationMethod: method,
    ...(here ? { here } : {}),
  };
}

// x → −∞ by t = −x, t → ∞: √(−x)/(1 − x) was sampled as "0.0001" too.
function atMinusInfinity(Algebrite, func, x) {
  let tree;
  try { tree = math.parse(func); } catch { return null; }
  const t = ['t', 'u', 's'].find((name) => name !== x && !tree.filter((n) => n.type === 'SymbolNode' && n.name === name).length);
  if (!t) return null;
  const swapped = tree.transform((n) => (n.type === 'SymbolNode' && n.name === x ? math.parse(`(-${t})`) : n));
  let g;
  try { g = math.simplify(swapped, [{ l: '-(-n)', r: 'n' }, { l: '--n', r: 'n' }]); } catch { g = swapped; }
  const result = tryLimitLaws(Algebrite, g.toString(), t, Infinity);
  if (!result) return null;
  const rewrite = `Let ${mark(`${t} = −${x}`)}: as ${mark(`${x} → −∞`)}, ${mark(`${t} → ∞`)}, and ${mark(`${show(tree)} = ${show(g)}`)}.`;
  return {
    ...result,
    steps: [rewrite, ...result.steps],
    here: result.here ? result.here.replace(/^Here(,)?:?/, (_, comma) => `Here, with ${mark(`${t} = −${x} → ∞`)}${comma ? ',' : ':'}`) : undefined,
  };
}
