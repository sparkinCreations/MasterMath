// What the constants in an expression must satisfy (1.73.0), read off the
// parse tree: never from sample values. x is the variable; every other
// single letter is a constant (a, b, k), e and pi are numbers.
//
//   constantRequirements(expr, x)  "a ≠ 0" for a constant divisor, "a > 0"
//                                  for a constant base under a power in x
//                                  (a^x) and for a logarithm of a constant,
//                                  "a ≥ 0" for a square root of one.
//   entireInX(expr, x)             true when the expression is defined at
//                                  every real x for every value of the
//                                  constants those requirements allow:
//                                  +, −, ×, whole-number powers, sin, cos,
//                                  e^(…), constant bases, constant divisors.
import { math } from './engines.js';
import { mark } from '../../mathMarkers.js';
import { splitTerms } from './text.js';

const NUMBERS = new Set(['e', 'pi', 'E', 'PI']);
const hasVar = (node, x) => node.filter((n) => n.type === 'SymbolNode' && n.name === x).length > 0;
const letters = (node, x) => [...new Set(node.filter((n) => n.type === 'SymbolNode' && n.name !== x && !NUMBERS.has(n.name) && /^[a-z]$/i.test(n.name)).map((n) => n.name))];
const parse = (expr) => { try { return math.parse(String(expr).replace(/(?<![a-z])ln\(/gi, 'log(')); } catch { return null; } };
// mathjs text as a student reads it: 2 a → 2a, log → ln.
const show = (node) => (node.type === 'ParenthesisNode' ? node.content : node).toString({ implicit: 'hide' }).replace(/\s*\*\s*(?=[a-z(])/gi, '').replace(/\s*\/\s*/g, '/').replace(/(\d)\s+(?=[a-z(])/gi, '$1').replace(/\blog\(/g, 'ln(').replace(/ ?\^ ?/g, '^');

export function constantLetters(expr, x) {
  const node = parse(expr);
  return node ? letters(node, x) : [];
}

export function constantRequirements(expr, x) {
  const node = parse(expr);
  if (!node) return [];
  const out = [];
  const add = (t) => { if (!out.includes(t)) out.push(t); };
  // A divisor of constants only: each letter of a product (2a·b), else the whole.
  const nonzero = (d) => {
    const factors = [];
    const split = (n) => {
      const m = n.type === 'ParenthesisNode' ? n.content : n;
      if (m.type === 'OperatorNode' && m.op === '*') m.args.forEach(split);
      else if (m.type === 'OperatorNode' && m.op === '^' && m.args[1].type === 'ConstantNode' && Number(m.args[1].value) > 0) split(m.args[0]);
      else factors.push(m);
    };
    split(d);
    for (const f of factors) {
      if (f.type === 'ConstantNode') continue;
      if (f.type === 'SymbolNode' && NUMBERS.has(f.name)) continue;
      if (f.type === 'FunctionNode' && f.fn.name === 'log' && letters(f, x).length === 1 && f.args.length === 1) {
        const arg = f.args[0].type === 'FunctionNode' && f.args[0].fn.name === 'abs' ? f.args[0].args[0] : f.args[0];
        add(`${show(arg)} ≠ 1`);
        continue;
      }
      if (letters(f, x).length) add(`${show(f)} ≠ 0`);
    }
  };
  node.traverse((n) => {
    if (n.type === 'OperatorNode' && n.op === '/' && n.args.length === 2) {
      const d = n.args[1];
      if (!hasVar(d, x) && letters(d, x).length) nonzero(d);
    }
    if (n.type === 'OperatorNode' && n.op === '^') {
      const base = n.args[0];
      const exp = n.args[1].type === 'ParenthesisNode' ? n.args[1].content : n.args[1];
      if (hasVar(exp, x) && !hasVar(base, x) && letters(base, x).length) add(`${show(base)} > 0`);
      // A root of constants: (b^2 − 4ac)^(1/2), a^(1/4).
      const evenRoot = exp.type === 'OperatorNode' && exp.op === '/' && exp.args[0].type === 'ConstantNode' && exp.args[1].type === 'ConstantNode' && Number(exp.args[1].value) % 2 === 0;
      const half = exp.type === 'ConstantNode' && Number(exp.value) === 0.5;
      if ((evenRoot || half) && !hasVar(base, x) && letters(base, x).length) add(`${show(base)} ≥ 0`);
    }
    // ln(a·x): its argument's condition, never a > 0 and x > 0 apart.
    if (n.type === 'FunctionNode' && n.fn.name === 'log' && n.args.length === 1 && hasVar(n.args[0], x) && letters(n.args[0], x).length
      && !(n.args[0].type === 'FunctionNode' && n.args[0].fn.name === 'abs')) add(`${show(n.args[0])} > 0`);
    if (n.type === 'FunctionNode' && n.args.length === 1 && !hasVar(n.args[0], x) && letters(n.args[0], x).length) {
      const arg = n.args[0];
      if (n.fn.name === 'log' && !(arg.type === 'FunctionNode' && arg.fn.name === 'abs')) add(`${show(arg)} > 0`);
      if (n.fn.name === 'sqrt') add(`${show(arg)} ≥ 0`);
    }
  });
  // "a > 0" before "a ≠ 1": the sign first, then the value it must avoid.
  return out.sort((p, q) => Number(/≠ 1$/.test(p)) - Number(/≠ 1$/.test(q)));
}

export function entireInX(expr, x) {
  const node = parse(expr);
  if (!node) return false;
  const ok = (n) => {
    if (n.type === 'ConstantNode') return typeof n.value === 'number' || /^\d/.test(String(n.value));
    if (n.type === 'SymbolNode') return true;
    if (n.type === 'ParenthesisNode') return ok(n.content);
    if (n.type === 'OperatorNode') {
      if (['+', '-', '*'].includes(n.op)) return n.args.every(ok);
      if (n.op === '/') return ok(n.args[0]) && !hasVar(n.args[1], x) && ok(n.args[1]);
      if (n.op === '^') {
        const [base, exp] = n.args;
        if (!hasVar(base, x)) return ok(base) && ok(exp);
        return exp.type === 'ConstantNode' && Number.isInteger(Number(exp.value)) && Number(exp.value) >= 0 && ok(base);
      }
      return false;
    }
    if (n.type === 'FunctionNode') return ['sin', 'cos', 'exp', 'sinh', 'cosh'].includes(n.fn.name) && n.args.every(ok);
    return false;
  };
  return ok(node);
}

// Why the conditions hold, in words, for the step that states them.
export function conditionsReason(reqs) {
  const why = [];
  if (reqs.some((r) => / ≠ 0$/.test(r) || /^[a-z] ≠ [a-z]$/i.test(r))) why.push('a number cannot be divided by 0');
  if (reqs.some((r) => / > 0$/.test(r))) why.push('a power with the variable in its exponent needs a positive base, and a logarithm a positive argument');
  if (reqs.some((r) => / ≠ 1$/.test(r))) why.push(`${mark('ln 1 = 0')}, and that would be a division by 0`);
  if (reqs.some((r) => / ≥ 0$/.test(r))) why.push('a square root of a negative number is not real');
  return why.join(', and ');
}

// ln(a·x): a logarithm whose argument holds the variable and a constant.
// Its domain is a·x > 0 — x > 0 when a > 0, x < 0 when a < 0 — and writing it
// ln(a) + ln(x) keeps only the first half (review of 1.73.0). Algebrite always
// splits such a logarithm, so the pieces are put back (keepLogArguments):
// rebuilt from the original logarithm, compared with the split form where
// that form holds (every letter positive), and verified by the solver on the
// other branch; the argument's own condition is stated.
export function mixedLogArguments(expr, x) {
  const node = parse(expr);
  if (!node) return [];
  const out = [];
  node.traverse((n) => {
    if (n.type === 'FunctionNode' && n.fn.name === 'log' && n.args.length === 1) {
      const arg = n.args[0].type === 'ParenthesisNode' ? n.args[0].content : n.args[0];
      if (hasVar(arg, x) && letters(arg, x).length) {
        const text = arg.toString({ implicit: 'show' }).replace(/\s+/g, '');
        if (!out.includes(text)) out.push(text);
      }
    }
  });
  return out;
}

// Points on the other branch of a·x > 0: x < 0 with the constants negative
// too, kept only where every such logarithm's argument is positive. Empty
// when there is no such branch to check.
export function otherBranchScopes(original, x) {
  const args = mixedLogArguments(original, x);
  if (!args.length) return [];
  const names = [...new Set(args.flatMap((arg) => letters(math.parse(arg), x)))];
  return [[-1.3, -0.8], [-2.1, -1.7], [-0.6, -2.4]]
    .map(([xv, cv]) => Object.fromEntries([[x, xv], ...names.map((n, j) => [n, cv * (1 + 0.13 * j)])]))
    .filter((scope) => args.every((arg) => { try { const v = math.evaluate(arg, scope); return typeof v === 'number' && v > 0; } catch { return false; } }));
}

// `verify(candidate)` is the solver's own check of the rebuilt form on the
// other branch (a < 0, x < 0), where Algebrite's split form says nothing:
// a derivative against a numerical derivative of f, an antiderivative
// differentiated back. Without it passing, the split form stays.
export function keepLogArguments(result, original, x, Algebrite, verify = null) {
  let out = String(result);
  const run = (cmd) => { try { const r = String(Algebrite.run(cmd)).trim(); return /stop|error|nil/i.test(r) ? null : r; } catch { return null; } };
  for (const arg of mixedLogArguments(original, x)) {
    const split = run(`expand(log(${arg}))`);
    const L = split && letters(math.parse(arg), x).find((l) => split.includes(`log(${l})`));
    if (!L) continue;
    const R1 = run(`subst(qlog, log(${L}), ${out})`);
    const S1 = run(`subst(qlog, log(${L}), ${split})`);
    const K = R1 && run(`coeff(${R1}, qlog, 1)`);
    const c = S1 && run(`coeff(${S1}, qlog, 1)`);
    if (!K || !c || K === '0' || c === '0') continue;
    const R2 = run(`simplify((${R1}) - (${K})/(${c})*(${S1}) + (${K})/(${c})*wlog)`);
    if (!R2 || /qlog/.test(R2)) continue;
    // Multiplied out, as a textbook writes it: x + 2x·ln(a·x), not
    // (1 + 2·ln(a·x))·x. Algebrite's expand leaves that product alone, so a
    // single factor outside one bracket is distributed here.
    const product = R2.match(/^\((.+)\)\*([a-z](?:\^\d+)?)$/i) || R2.match(/^([a-z](?:\^\d+)?)\*\((.+)\)$/i);
    const [inner, factor] = product ? (product[0].startsWith('(') ? [product[1], product[2]] : [product[2], product[1]]) : [null, null];
    const distributed = inner && splitTerms(inner).map(({ signed }) => {
      const t = signed.replace(/^\+/, '');
      const neg = t.startsWith('-');
      const body = neg ? t.slice(1) : t;
      const num = body.match(/^(\d+(?:\/\d+)?)\*(.+)$/);
      return `${neg ? '-' : '+'}${body === '1' ? factor : num ? `${num[1]}*${factor}*${num[2]}` : `${factor}*${body}`}`;
    }).join('').replace(/^\+/, '');
    const candidate = (distributed || R2).replace(/\bwlog\b/g, `log(${arg})`);
    // The same function where every part is defined (all letters positive).
    const names = [...new Set([x, ...letters(math.parse(`${arg}+(${out})`), x)])];
    const same = [0.7, 1.3, 2.2].every((v, i) => {
      const scope = Object.fromEntries(names.map((n2, j) => [n2, v + 0.37 * j + 0.11 * i]));
      try {
        const p = math.evaluate(candidate, scope);
        const q = math.evaluate(out, scope);
        return typeof p === 'number' && typeof q === 'number' && Math.abs(p - q) <= 1e-9 * Math.max(1, Math.abs(q));
      } catch { return false; }
    });
    if (same && (!verify || verify(candidate))) out = candidate;
  }
  return out;
}

// f′ at a point with ln(a·x) kept whole: each logarithm stands in as a
// symbol while Algebrite simplifies, its argument simplified on its own
// (ln(a·(−2)) is ln(−2a), never ln(2) + ln(a) + iπ).
export function atPointKeepingLogs(expr, x, valueText, Algebrite) {
  const run = (cmd) => { try { const r = String(Algebrite.run(cmd)).trim(); return /stop|error|nil/i.test(r) ? null : r; } catch { return null; } };
  const args = mixedLogArguments(expr, x);
  let body = String(expr);
  const point = String(valueText).replace(/π/g, 'pi');
  args.forEach((arg, i) => {
    body = body.split(`log(${arg})`).join(`wlog${i}`);
  });
  if (args.some((arg, i) => !body.includes(`wlog${i}`))) return null;
  let out = run(`simplify(subst((${point}), ${x}, ${body}))`);
  if (!out || new RegExp(`(?<![a-z])${x}(?![a-z])`).test(out)) return null;
  for (const [i, arg] of args.entries()) {
    const inner = run(`simplify(subst((${point}), ${x}, ${arg}))`);
    if (!inner) return null;
    out = out.split(`wlog${i}`).join(`log(${inner})`);
  }
  return out;
}

// A condition in x at a point: a·x > 0 at x = −2 is a < 0. The value of the
// left side at the point, when it is c·L for one constant L, gives L's sign.
export function conditionAtPoint(req, x, valueText) {
  const m = String(req).match(/^(.*?)\s*(>|≥|≠)\s*0$/);
  if (!m) return req;
  const starred = m[1].replace(/(\d)([a-z(])/gi, '$1*$2').replace(/([a-z])(?=[a-z(])/gi, (c, l, off, str) => (/[a-z]/i.test(str[off + 1] || '') ? `${l}*` : c));
  // With or without x: −2a > 0 (read off an answer's ln(−2a)) is a < 0 too.
  const at = starred.replace(new RegExp(`(?<![a-z])${x}(?![a-z])`, 'g'), `(${String(valueText).replace(/π/g, 'pi')})`);
  let node;
  try { node = math.parse(at); } catch { return req; }
  const ls = letters(node, x);
  if (ls.length !== 1) return req;
  const f = (v) => { try { return node.evaluate({ [ls[0]]: v }); } catch { return NaN; } };
  const [f0, f1, f2] = [f(0), f(1), f(2)];
  if ([f0, f1, f2].every(Number.isFinite) && Math.abs(f0) < 1e-12 && Math.abs(f2 - 2 * f1) < 1e-12 && f1 !== 0) {
    if (m[2] === '≠') return `${ls[0]} ≠ 0`;
    const flip = { '>': '<', '≥': '≤' };
    return `${ls[0]} ${f1 > 0 ? m[2] : flip[m[2]]} 0`;
  }
  return req;
}
