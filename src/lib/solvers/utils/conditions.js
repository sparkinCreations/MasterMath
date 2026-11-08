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

const NUMBERS = new Set(['e', 'pi', 'E', 'PI']);
const hasVar = (node, x) => node.filter((n) => n.type === 'SymbolNode' && n.name === x).length > 0;
const letters = (node, x) => [...new Set(node.filter((n) => n.type === 'SymbolNode' && n.name !== x && !NUMBERS.has(n.name) && /^[a-z]$/i.test(n.name)).map((n) => n.name))];
const parse = (expr) => { try { return math.parse(String(expr).replace(/(?<![a-z])ln\(/gi, 'log(')); } catch { return null; } };
// mathjs text as a student reads it: 2 a → 2a, log → ln.
const show = (node) => (node.type === 'ParenthesisNode' ? node.content : node).toString({ implicit: 'hide' }).replace(/\s*\*\s*(?=[a-z(])/gi, '').replace(/\blog\(/g, 'ln(').replace(/ ?\^ ?/g, '^');

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
