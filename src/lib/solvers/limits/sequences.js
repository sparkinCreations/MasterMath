// Two sequences: a limit has to be the same along every sequence that
// approaches the point, so two sequences with different results prove there
// is none. sin(x) and x·sin(x) as x → ∞, sin(1/x) as x → 0: these were
// concluded from samples (1.63.0 review). Along u = π/2 + 2πn, sin u = 1;
// along u = 3π/2 + 2πn, sin u = −1 (cos: 2πn and π + 2πn).

import { math, beautify, mark, absBars } from '../solverUtils.js';
import { growthForm, grows } from './growth.js';
import { evalAt } from './numeric.js';

const unwrap = (n) => (n && n.type === 'ParenthesisNode' ? unwrap(n.content) : n);

// The factors of a product, with any leading minus folded into a sign.
function factors(node, out = { sign: 1, list: [] }) {
  const n = unwrap(node);
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { out.sign *= -1; return factors(n.args[0], out); }
  if (n.type === 'OperatorNode' && n.op === '*') { n.args.forEach((a) => factors(a, out)); return out; }
  out.list.push(n);
  return out;
}

export function tryTwoSequences(func, variable, target) {
  const v = variable;
  if (!(target === Infinity || target === 0)) return null;
  let tree;
  try { tree = math.parse(func); } catch { return null; }
  const { sign, list } = factors(tree);
  const trig = list.filter((n) => n.type === 'FunctionNode' && (n.fn?.name === 'sin' || n.fn?.name === 'cos') && n.args.length === 1);
  if (trig.length !== 1) return null;
  const fn = trig[0].fn.name;
  const arg = unwrap(trig[0].args[0]);
  const rest = list.filter((n) => n !== trig[0]).map((n) => n.toString());
  const restText = rest.length ? rest.join(' * ') : '1';
  const g = growthForm(restText, v);
  if (!g) return null;
  const constant = g.p === 0 && g.k === 0 && g.m === 0;
  const c = g.c * sign;
  // The argument: k·x^p with k > 0, p > 0 at ∞ and p < 0 at 0 (k·x, k/x,
  // and since 1.68.8 x^2, √x, 1/x^2: sin(x^2) and sin(√x) at ∞ and
  // sin(1/x^2) at 0 were left to samples). Then x_n = (u_n/k)^(1/p).
  const form = growthForm(arg.toString(), v);
  if (!form || form.k !== 0 || form.m !== 0 || !(form.c > 0) || form.p === 0) return null;
  const k = form.c;
  const p = form.p;
  if (target === Infinity ? p < 0 : p > 0) return null;
  if (target === Infinity && !constant && !(grows(g) && g.c > 0)) return null;
  if (target === 0 && !constant) return null;
  const kText = Number.isInteger(k) ? String(k) : null;
  const q = 1 / Math.abs(p);
  const qText = Number.isInteger(q) ? String(q) : Number.isInteger(1 / q) ? `1/${1 / q}` : null;
  if (!kText || !qText) return null;
  const [u1, u2] = fn === 'sin' ? ['π/2 + 2πn', '3π/2 + 2πn'] : ['2πn', 'π + 2πn'];
  // u/k at ∞, k/u at 0, before the root or power.
  const base = (u) => {
    if (target === 0) return k === 1 ? `1/(${u})` : `${kText}/(${u})`;
    if (k === 1) return u;
    if (u === '2πn') return k === 2 ? 'πn' : `2πn/${kText}`;
    return `(${u})/${kText}`;
  };
  const rootOf = (b) => {
    if (q === 1) return b;
    const inner = /^[\w/π]+$/.test(b) && !b.includes('/') ? b : `(${b})`;
    if (qText === '1/2') return `√${/^\(/.test(inner) ? inner : `(${inner})`}`;
    if (qText === '1/3') return `∛${/^\(/.test(inner) ? inner : `(${inner})`}`;
    return Number.isInteger(q) ? `${inner}^${qText}` : `${inner}^(${qText})`;
  };
  // 1/√(u) reads better than √(1/(u)) at 0.
  const point = (u) => (target === 0 && q !== 1 && k === 1 && (qText === '1/2' || qText === '1/3')
    ? `1/${qText === '1/2' ? '√' : '∛'}(${u})`
    : rootOf(base(u)));
  const tidy = (t) => beautify(String(t).replace(/\s+/g, ''));
  const at_ = (text, name) => text.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), name);
  const trigText = `${fn}(${tidy(arg.toString())})`;
  const f = absBars(beautify(func));
  // f(x_n) = (the rest at x_n)·(±1), with the sign of a leading minus.
  const valueAlong = (name, s) => {
    if (constant) return { text: String(c * s), limit: String(c * s) };
    const r = at_(tidy(restText), name);
    return { text: s * sign > 0 ? r : `-${/^[\w^]+$/.test(r) ? r : `(${r})`}`, limit: s * Math.sign(c) > 0 ? '∞' : '-∞' };
  };
  const bare = rest.length === 0 && sign === 1; // sin(x) itself: nothing to multiply
  const along1 = valueAlong('x_n', 1);
  const along2 = valueAlong('y_n', -1);
  const toward = target === Infinity ? '∞' : '0⁺';
  const steps = [
    `${mark(trigText)} oscillates, swinging between ${mark('−1')} and ${mark('1')} as ${mark(`${v} → ${target === Infinity ? '∞' : '0'}`)}${constant ? '' : `, while ${mark(tidy(restText))} grows without bound`}. A limit would have to be the same along every sequence that approaches ${mark(target === Infinity ? '∞' : '0')}, so follow two of them.`,
    `Along ${mark(`x_n = ${point(u1)}`)} (${mark(`x_n → ${toward}`)} as ${mark('n → ∞')}), ${mark(`${fn}(${at_(tidy(arg.toString()), 'x_n')}) = 1`)}${bare ? '' : `, so ${mark(`${at_(f, 'x_n')} = ${along1.text}`)}`}${constant ? '' : ` ${mark(`→ ${along1.limit}`)}`}.`,
    `Along ${mark(`y_n = ${point(u2)}`)}, ${mark(`${fn}(${at_(tidy(arg.toString()), 'y_n')}) = −1`)}${bare ? '' : `, so ${mark(`${at_(f, 'y_n')} = ${along2.text}`)}`}${constant ? '' : ` ${mark(`→ ${along2.limit}`)}`}.`,
    constant
      ? `The two sequences give different values, ${mark(along1.limit)} and ${mark(along2.limit)}, so the limit does not exist.`
      : `One sequence gives ${mark(along1.limit)}, the other ${mark(along2.limit)}, so the limit does not exist: not as a number, and not as ${mark('∞')} or ${mark('−∞')} either.`,
  ];
  // Check: the function along each sequence, for two values of n.
  const xs = (u, n) => {
    const angle = (fn === 'sin' ? (u === 1 ? Math.PI / 2 : 1.5 * Math.PI) : (u === 1 ? 0 : Math.PI)) + 2 * Math.PI * n;
    return (angle / k) ** (1 / p);
  };
  const check = (u, s) => [10, 1000].map((n) => evalAt(func, v, xs(u, n))).every((y, i, ys) => (constant
    ? Math.abs(y - c * s) < 1e-6
    : Math.sign(y) === s * Math.sign(c) && (i === 0 || Math.abs(y) > Math.abs(ys[0]))));
  return {
    steps,
    answer: 'Does not exist',
    verified: check(1, 1) && check(2, -1),
    verificationMethod: 'two sequences + numeric check',
    sequences: { x: point(u1), y: point(u2), along1: along1.limit, along2: along2.limit, toward },
  };
}
