// The quotient rule's answer for a rational function N/D, written as a
// textbook writes it: (N′D − ND′)/D², the top expanded, the bottom left
// squared. Algebrite's simplify took 14 s on the derivative of
// (x^2 + 1)/(x^3 − 1), and on x/(x^3 − 1) it returned
// (−2x^6 + x^3 + 1)/(x^3 − 1)^3 uncancelled (outside review, November 2026;
// 1.68.7). Only when the top shares no factor with D, so nothing cancels;
// otherwise null, and the caller simplifies as before.

import { math } from '../solverUtils.js';
import { readPolynomial, sharedFactorDegree } from '../polynomialRoots.js';

const unwrap = (n) => (n && n.type === 'ParenthesisNode' ? unwrap(n.content) : n);

export function quotientRuleForm(Algebrite, expression, variable) {
  let tree;
  try { tree = unwrap(math.parse(expression)); } catch { return null; }
  // −N/D, as a term of a sum is written: the same form with the sign outside.
  if (tree.type === 'OperatorNode' && tree.fn === 'unaryMinus') {
    const inner = quotientRuleForm(Algebrite, unwrap(tree.args[0]).toString(), variable);
    return inner && `-${inner}`;
  }
  if (tree.type !== 'OperatorNode' || tree.op !== '/') return null;
  const [N, D] = tree.args.map((a) => unwrap(a).toString());
  const n = readPolynomial(N, variable);
  const d = readPolynomial(D, variable);
  // A linear bottom is quick for simplify, and its form is unchanged.
  if (!n || !d || n.tooHigh || d.tooHigh || d.degree < 2 || n.degree > 30 || d.degree > 30) return null;
  const run = (cmd) => String(Algebrite.run(cmd)).trim();
  const top = run(`expand((${run(`d(${N}, ${variable})`)})*(${D})-(${N})*(${run(`d(${D}, ${variable})`)}))`);
  const bottom = run(`${D}`);
  if (!top || /Stop|nil/.test(top) || top === '0') return null;
  if (sharedFactorDegree(top, bottom, variable) !== 0) return null;
  const single = !/[+-]/.test(top.replace(/^-/, ''));
  return `${single ? top : `(${top})`}/((${bottom})^2)`;
}
