// Arithmetic with complex numbers (a + bi), worked as a textbook does.

import { math, formatNumber, mark } from '../solverUtils.js';
import { formatArithmeticResult } from './exactNumbers.js';

// ---------------------------------------------------------------------------
// Complex numbers (October 25 review): (2+3i)*(1-i), (3+4i)/(1-2i), i^3.
// Worked the textbook way, one operation at a time: like parts collected,
// FOIL with i² = −1, division by the conjugate, the cycle of powers of i.
// The parentheses walk above cannot show them: it wrote (2+3i)*(1-i) as
// 2 + 3i*(1-i).
// ---------------------------------------------------------------------------

const isComplex = (z) => z && typeof z === 'object' && 'im' in z;
const parts = (z) => (isComplex(z) ? { re: z.re, im: z.im } : { re: Number(z), im: 0 });
const complexText = (z) => {
  const { re, im } = parts(z);
  return Math.abs(im) < 1e-12 ? formatNumber(re) : formatArithmeticResult(math.complex(re, im), '');
};
// In an expression: brackets around a two-part number or a negative.
const operand = (z) => {
  const t = complexText(z);
  return / [+-] /.test(t) || /^-/.test(t) ? `(${t})` : t;
};
const signed = (v, unit = '') => `${v < 0 ? '−' : '+'} ${unit && Math.abs(v) === 1 ? '' : formatNumber(Math.abs(v))}${unit}`;
// The leading term of a sum: no "+", and a zero term left out.
const first = (v, unit = '') => (unit && Math.abs(v) === 1 ? `${v < 0 ? '−' : ''}${unit}` : `${formatNumber(v)}${unit}`);
const terms = (list) => {
  const kept = list.filter(([v]) => Math.abs(v) > 1e-12);
  if (kept.length === 0) return '0';
  return kept.map(([v, unit], i) => (i === 0 ? first(v, unit) : signed(v, unit))).join(' ');
};

export function complexWorking(expr) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return null;
  }
  const lines = [];
  const value = (n) => {
    if (n.type === 'ParenthesisNode') return value(n.content);
    if (n.type === 'ConstantNode' && typeof n.value === 'number') return n.value;
    if (n.type === 'SymbolNode' && n.name === 'i') return math.complex(0, 1);
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return math.unaryMinus(value(n.args[0]));
    // A plain number written with i, 3*i or 3i: nothing to work out yet.
    const plain = (z) => !isComplex(z) || Math.abs(z.re) < 1e-12 || Math.abs(z.im) < 1e-12;
    if (n.type === 'FunctionNode' && n.args.length === 1) {
      const z = value(n.args[0]);
      const { re, im } = parts(z);
      if (n.fn.name === 'abs') {
        const out = Math.hypot(re, im);
        lines.push(`The modulus is the distance from ${mark('0')}: ${mark(`|${complexText(z)}| = √(${operand(re)}^2 + ${operand(im)}^2) = √${formatNumber(re * re + im * im)} = ${formatNumber(out)}`)}.`);
        return out;
      }
      if (n.fn.name === 'sqrt' && Math.abs(im) < 1e-12 && re < 0) {
        const out = math.sqrt(z);
        lines.push(`A square root of a negative number: ${mark(`√(${formatNumber(re)}) = √${formatNumber(-re)}·√(−1) = ${complexText(out)}`)}.`);
        return out;
      }
      throw new Error('function');
    }
    if (n.type !== 'OperatorNode' || n.args.length !== 2) throw new Error('operation');
    const [z, w] = n.args.map(value);
    const { re: a, im: b } = parts(z);
    const { re: c, im: d } = parts(w);
    let out;
    if (n.fn === 'add' || n.fn === 'subtract') {
      out = n.fn === 'add' ? math.add(z, w) : math.subtract(z, w);
      // Only when like parts combine: 2 + 3i is a number being written.
      if ((a !== 0 && c !== 0) || (b !== 0 && d !== 0)) {
        const op = n.fn === 'add' ? '+' : '−';
        lines.push(`${n.fn === 'add' ? 'Add' : 'Subtract'} the real parts and the imaginary parts: ${mark(`${operand(z)} ${op} ${operand(w)} = (${formatNumber(a)} ${op} ${operand(c)}) + (${formatNumber(b)} ${op} ${operand(d)})i = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'multiply') {
      out = math.multiply(z, w);
      if (!plain(z) && !plain(w)) {
        lines.push(`Multiply out (FOIL), then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}${operand(w)} = ${terms([[a * c, ''], [a * d, 'i'], [b * c, 'i'], [b * d, 'i^2']])} = ${terms([[a * c, ''], [-b * d, ''], [a * d + b * c, 'i']])} = ${complexText(out)}`)}.`);
      } else if (isComplex(z) && isComplex(w) && Math.abs(b) > 1e-12 && Math.abs(d) > 1e-12) {
        // 3i·2i: the coefficients multiply and i·i is i², which is −1.
        lines.push(`Multiply, then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}·${operand(w)} = ${first(b * d, 'i^2')} = ${complexText(out)}`)}.`);
      } else if ((Math.abs(b) > 1e-12 && Math.abs(a) > 1e-12) || (Math.abs(d) > 1e-12 && Math.abs(c) > 1e-12)) {
        lines.push(`Multiply each part: ${mark(`${operand(z)}·${operand(w)} = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'divide') {
      out = math.divide(z, w);
      if (Math.abs(d) > 1e-12) {
        const conj = math.complex(c, -d);
        const top = math.multiply(z, conj);
        const bottom = c * c + d * d;
        lines.push(`Divide by multiplying the top and the bottom by the conjugate ${mark(complexText(conj))}, which makes the bottom real: ${mark(`${operand(z)}/${operand(w)} = (${complexText(z)})(${complexText(conj)})/((${complexText(w)})(${complexText(conj)})) = (${complexText(top)})/${formatNumber(bottom)} = ${complexText(out)}`)}.`);
      } else {
        lines.push(`Divide each part by ${mark(formatNumber(c))}: ${mark(`${operand(z)}/${formatNumber(c)} = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'pow' && !isComplex(w) && Number.isInteger(w) && Math.abs(w) <= 12) {
      out = math.pow(z, w);
      if (Math.abs(a) < 1e-12 && Math.abs(b - 1) < 1e-12 && w >= 0) {
        const r = w % 4;
        const cycle = `Powers of ${mark('i')} repeat every 4: ${mark('i^1 = i')}, ${mark('i^2 = −1')}, ${mark('i^3 = −i')}, ${mark('i^4 = 1')}.`;
        lines.push(w < 4 ? `${cycle} So ${mark(`i^${w} = ${complexText(out)}`)}.` : `${cycle} ${mark(`${w} = 4·${Math.floor(w / 4)} + ${r}`)}, so ${mark(`i^${w} = i^${r} = ${complexText(out)}`)}.`);
      } else if (w === 2 && Math.abs(b) > 1e-12) {
        lines.push(`Square it, then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}^2 = ${terms([[a * a, ''], [2 * a * b, 'i'], [b * b, 'i^2']])} = ${complexText(out)}`)}.`);
      } else if (Math.abs(b) > 1e-12) {
        lines.push(`Multiply ${mark(operand(z))} by itself ${mark(String(w))} times, using ${mark('i^2 = −1')}: ${mark(`${operand(z)}^${w} = ${complexText(out)}`)}.`);
      }
    } else {
      throw new Error('operation');
    }
    return out;
  };
  try {
    value(tree);
    return lines;
  } catch {
    return null;
  }
}
