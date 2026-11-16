// Limits through a step function, proved one side at a time (1.76.4).
// Substituting the point is a proof only where the function is continuous
// there, and floor, ceil, round, fix, sign and mod are not: lim x→0 floor(x)
// was "= 0" (it is −1 from the left), and lim x→0 sign(x)² was "= 0" (it is
// 1 from both sides; the value at 0 does not enter a limit).
//
// The jump set of each, where it is not continuous:
//   floor(u), ceil(u)  u an integer
//   round(u)           u a half-integer (n + ½). mathjs rounds a half away
//                      from zero, round(−2.5) = −3 and round(2.5) = 3; that
//                      is the value at the jump, which no limit uses: just
//                      below n + ½ it is n, just above, n + 1.
//   fix(u)             u a nonzero integer (fix truncates toward 0, so it is
//                      0 on (−1, 1) and continuous at 0)
//   sign(u)            u = 0
//   mod(u, m)          u a multiple of m (a constant m > 0)
// Elsewhere each is constant near the point, so it is replaced by its value.
//
// At a jump, the argument u = g(x) must cross it from a known side: g′(a) ≠
// 0 decides it (g′(a) > 0: g is below the jump just left of a). g′(a) = 0 is
// refused — not because the limit cannot be found (⌊x²⌋ at 0 has limit 0),
// only because this does not prove it. With every step function replaced by
// its value on each side, what is left must be continuous at a from that
// side (defined there, finite, no step function inside another), and its
// value there is that side's limit.

import { math, mark, formatNumber, beautify } from '../solverUtils.js';

const JUMPS = {
  floor: { set: 'the integers', at: (c) => Math.round(c), below: (J) => J - 1, above: (J) => J },
  ceil: { set: 'the integers', at: (c) => Math.round(c), below: (J) => J, above: (J) => J + 1 },
  round: { set: 'the half-integers', at: (c) => Math.floor(c) + 0.5, below: (J) => J - 0.5, above: (J) => J + 0.5 },
  fix: { set: 'the nonzero integers', at: (c) => (Math.round(c) === 0 ? null : Math.round(c)), below: (J) => (J > 0 ? J - 1 : J), above: (J) => (J > 0 ? J : J + 1) },
  sign: { set: '0', at: () => 0, below: () => -1, above: () => 1 },
};

const evalNode = (node, v, x) => {
  try {
    const y = node.evaluate({ [v]: x });
    return typeof y === 'number' ? y : NaN;
  } catch {
    return NaN;
  }
};

const isStep = (n) => n.type === 'FunctionNode' && (JUMPS[n.fn.name] || n.fn.name === 'mod');

// Null when the expression has no step function; else { left, right, steps }
// with the one-sided limits (numbers), or { refuse, steps } when they are not
// proved here. `continuousAt(text, a)` is the caller's check that an
// expression with no step function is continuous at a from both sides.
export async function stepFunctionLimit(func, v, a, { Algebrite, continuousAt }) {
  let tree;
  try { tree = math.parse(String(func)); } catch { return null; }
  const nodes = tree.filter(isStep);
  if (!nodes.length) return null;
  const refuse = (why) => ({ refuse: true, steps: [why] });
  if (nodes.some((n) => n.args.some((arg) => arg.filter(isStep).length))) {
    return refuse('A step function inside another one is not worked here, so the limit is not claimed.');
  }
  const steps = [];
  const replacement = new Map();
  for (const n of nodes) {
    const name = n.fn.name;
    const g = n.args[0];
    let rule = JUMPS[name];
    let m = null;
    if (name === 'mod') {
      if (n.args.length !== 2 || n.args[1].filter((x) => x.type === 'SymbolNode' && x.name === v).length) return refuse(`${mark(beautify(n.toString()))} is not worked here, so the limit is not claimed.`);
      m = evalNode(n.args[1], v, a);
      if (!(m > 0)) return refuse(`${mark(beautify(n.toString()))} is not worked here, so the limit is not claimed.`);
      rule = { set: `the multiples of ${formatNumber(m)}`, at: (c) => Math.round(c / m) * m, below: () => m, above: () => 0 };
    }
    const shown = beautify(n.toString());
    const gText = beautify(g.toString());
    if (!continuousAt(g.toString(), a)) return refuse(`The inside of ${mark(shown)}, ${mark(gText)}, is not continuous at ${mark(`${v} = ${formatNumber(a)}`)}, so the limit is not claimed.`);
    const c = evalNode(g, v, a);
    const J = rule.at(c);
    const gap = J === null ? Infinity : Math.abs(c - J);
    const tiny = 1e-12 * (1 + Math.abs(c));
    if (gap > tiny && gap < 1e-9) return refuse(`${mark(gText)} is within rounding of a jump of ${mark(shown)} at ${mark(`${v} = ${formatNumber(a)}`)}, so the limit is not claimed.`);
    if (gap > tiny) {
      // Not at a jump: constant near the point.
      const value = name === 'mod' ? ((c % m) + m) % m : evalNode(n, v, a);
      replacement.set(n, { left: value, right: value });
      steps.push(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(c)}`)}, which is not one of ${rule.set} where ${mark(shown)} jumps, so ${mark(`${shown} = ${formatNumber(value)}`)} on both sides near ${mark(formatNumber(a))}.`);
      continue;
    }
    // At a jump: the side g comes from decides the value.
    let slope = NaN;
    try {
      const d = String(Algebrite.run(`d(${g.toString()}, ${v})`)).trim();
      slope = evalNode(math.parse(d), v, a);
    } catch { slope = NaN; }
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) {
      return refuse(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(J)}`)}, a jump of ${mark(shown)}, and its derivative there is ${mark('0')} (or not found), so which side it reaches the jump from is not settled here: the limit is not claimed.`);
    }
    const fromBelowOnLeft = slope > 0;
    const left = fromBelowOnLeft ? rule.below(J) : rule.above(J);
    const right = fromBelowOnLeft ? rule.above(J) : rule.below(J);
    replacement.set(n, { left, right });
    steps.push(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(J)}`)}, one of ${rule.set} where ${mark(shown)} jumps. ${mark(gText)} is ${slope > 0 ? 'increasing' : 'decreasing'} there (its derivative is ${mark(formatNumber(slope))}), so just left of ${mark(formatNumber(a))} it is just ${fromBelowOnLeft ? 'below' : 'above'} ${mark(formatNumber(J))} and ${mark(`${shown} = ${formatNumber(left)}`)}; just right, ${mark(`${shown} = ${formatNumber(right)}`)}.`);
  }
  const sideValue = (side) => {
    const swapped = tree.transform((n) => (replacement.has(n) ? new math.ConstantNode(replacement.get(n)[side]) : n));
    const text = swapped.toString();
    if (!continuousAt(text, a)) return { text, value: null };
    return { text, value: evalNode(swapped, v, a) };
  };
  const L = sideValue('left');
  const R = sideValue('right');
  for (const [s, side] of [[L, 'left'], [R, 'right']]) {
    if (s.value === null || !Number.isFinite(s.value)) {
      return refuse(`From the ${side}, ${mark(beautify(func))} is ${mark(beautify(s.text))} near ${mark(formatNumber(a))}, which is not continuous there, so the limit is not claimed.`);
    }
  }
  steps.push(`From the left, ${mark(beautify(func))} is ${mark(beautify(L.text))} near ${mark(formatNumber(a))}, continuous there, so it → ${mark(formatNumber(L.value))}; from the right it is ${mark(beautify(R.text))}, so it → ${mark(formatNumber(R.value))}.`);
  return { left: L.value, right: R.value, steps };
}
