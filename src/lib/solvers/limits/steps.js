// Limits through a step function, proved one side at a time (1.76.4).
// Substituting the point is a proof only where the function is continuous
// there, and floor, ceil, round, sign and mod are not: lim x→0 floor(x) was
// "= 0" (it is −1 from the left), and lim x→0 sign(x)² was "= 0" (it is 1
// from both sides; the value at 0 does not enter a limit).
//
// The jump set of each, where it is not continuous:
//   floor(u), ceil(u)  u an integer
//   round(u)           u a half-integer (n + ½). mathjs rounds a half away
//                      from zero, round(−2.5) = −3 and round(2.5) = 3; that
//                      is the value at the jump, which no limit uses: just
//                      below n + ½ it is n, just above, n + 1. round(u, n),
//                      to n places, is refused.
//   fix(u)             u a nonzero integer (fix truncates toward 0)
//   sign(u)            u = 0
//   mod(u, m)          u a multiple of m (a rational constant m > 0)
// Elsewhere each is constant near the point, so it is replaced by its value.
//
// Nothing here is decided by a sample or a tolerance:
//   - whether u(a) is ON a jump is proved exactly (Algebrite: u(a) − J
//     simplifies to 0); within rounding of one but not proved on it is
//     refused (floor(x + 10⁻¹³) at 0);
//   - which side u comes from is the sign of u′(a); u′(a) = 0 is refused,
//     not because the limit cannot be found (⌊x²⌋ at 0 has limit 0), only
//     because this does not prove it;
//   - continuity of u, and of each side once its step functions are
//     replaced, is read off the expression's structure: every function
//     continuous where it is used (a denominator not 0, a logarithm's or
//     root's argument positive, tan and sec away from their poles, …), and
//     every value finite. atan(1/x) at 0 fails it (1/x has a 0
//     denominator); a sampled check passed it;
//   - the two sides are equal only when their difference simplifies to 0
//     exactly (10¹² + ⌊x⌋ at 0 has sides 10¹² − 1 and 10¹²).

import { math, mark, formatNumber, beautify, exactForm } from '../solverUtils.js';

const JUMPS = {
  floor: { set: 'the integers', at: (c) => Math.round(c), below: (J) => J - 1, above: (J) => J },
  ceil: { set: 'the integers', at: (c) => Math.round(c), below: (J) => J, above: (J) => J + 1 },
  round: { set: 'the half-integers', at: (c) => Math.floor(c) + 0.5, below: (J) => J - 0.5, above: (J) => J + 0.5 },
  fix: { set: 'the nonzero integers', at: (c) => (Math.round(c) === 0 ? null : Math.round(c)), below: (J) => (J > 0 ? J - 1 : J), above: (J) => (J > 0 ? J : J + 1) },
  sign: { set: '0', at: () => 0, below: () => -1, above: () => 1 },
};

const isStep = (n) => n.type === 'FunctionNode' && (JUMPS[n.fn.name] || n.fn.name === 'mod');

const evalNode = (node, v, x) => {
  try {
    const y = node.evaluate({ [v]: x });
    return typeof y === 'number' ? y : NaN;
  } catch {
    return NaN;
  }
};

// A number as an exact rational text, or null (0.5 → 1/2).
function rationalText(x) {
  if (!Number.isFinite(x)) return null;
  try {
    const f = math.fraction(x);
    if (Number(f.d) > 1e6) return null;
    const text = `${Number(f.s) < 0 ? '-' : ''}${f.n}${String(f.d) === '1' ? '' : `/${f.d}`}`;
    // Exactly this double, or nothing: 10⁻¹⁶ is not 0.
    return Number(f.s) * Number(f.n) / Number(f.d) === x ? text : null;
  } catch {
    return null;
  }
}

// A point typed as a plain decimal, read exactly from its digits:
// "0.0000000000000001" is 1/10¹⁶, which a double may not hold (as a double,
// 0.99999999999999999 is 1).
function decimalText(t) {
  const m = /^\s*([-−]?)(\d+)(?:\.(\d+))?\s*$/.exec(String(t ?? ''));
  if (!m) return null;
  const places = (m[3] || '').length;
  const digits = `${m[2]}${m[3] || ''}`.replace(/^0+(?=\d)/, '');
  return `${m[1] ? '-' : ''}${digits}${places ? `/1${'0'.repeat(places)}` : ''}`;
}

// mathjs text to Algebrite's: e is exp(1) there.
const forAlgebrite = (text) => String(text).replace(/(?<![a-z_])e(?![a-z(_])/g, 'exp(1)');

// The exact value of an expression at v = a (Algebrite), or null.
function exactAt(Algebrite, text, v, aText) {
  try {
    const out = String(Algebrite.run(`simplify(subst(${aText}, ${v}, ${forAlgebrite(text)}))`)).trim();
    return out && !/stop|error|nil|undefined/i.test(out) ? out : null;
  } catch {
    return null;
  }
}

// Continuity at a, read off the structure (never off samples).
const EVERYWHERE = new Set(['sin', 'cos', 'exp', 'atan', 'arctan', 'sinh', 'cosh', 'tanh', 'abs', 'erf', 'cbrt']);
const POSITIVE = new Set(['log', 'ln', 'log10', 'log2', 'sqrt']);
const TINY = 1e-9;
const HUGE = 1e15;
export function continuousAt(node, v, a) {
  let ok = true;
  const mentionsV = (n) => n.filter((x) => x.type === 'SymbolNode' && x.name === v).length > 0;
  node.traverse((n, path) => {
    if (!ok || path === 'fn') return; // a function's name, not a variable
    if (n.type === 'ParenthesisNode' || n.type === 'SymbolNode' || n.type === 'ConstantNode') {
      if (n.type === 'SymbolNode' && n.name !== v && !['pi', 'e'].includes(n.name)) ok = false;
      return;
    }
    const y = evalNode(n, v, a);
    if (!Number.isFinite(y) || Math.abs(y) >= HUGE) { ok = false; return; }
    // A part with no variable is a constant: continuous, whatever it is
    // (√0 once floor(x) is replaced by 0 near x = 1).
    if (!mentionsV(n)) return;
    if (n.type === 'OperatorNode') {
      if (n.op === '/') { if (!(Math.abs(evalNode(n.args[1], v, a)) > TINY)) ok = false; return; }
      if (n.op === '^') {
        const base = evalNode(n.args[0], v, a);
        const expMentions = n.args[1].filter((x) => x.type === 'SymbolNode' && x.name === v).length > 0;
        const ex = evalNode(n.args[1], v, a);
        if (expMentions || !Number.isInteger(ex)) { if (!(base > TINY)) ok = false; return; }
        if (ex < 0 && !(Math.abs(base) > TINY)) ok = false;
        return;
      }
      if (['+', '-', '*'].includes(n.op) || n.fn === 'unaryMinus' || n.fn === 'unaryPlus') return;
      ok = false;
      return;
    }
    if (n.type === 'FunctionNode') {
      const name = n.fn.name;
      const arg = n.args.length === 1 ? evalNode(n.args[0], v, a) : NaN;
      if (EVERYWHERE.has(name) && n.args.length === 1) return;
      if (POSITIVE.has(name) && n.args.length === 1) { if (!(arg > TINY)) ok = false; return; }
      if ((name === 'tan' || name === 'sec') && n.args.length === 1) { if (!(Math.abs(Math.cos(arg)) > TINY)) ok = false; return; }
      if ((name === 'cot' || name === 'csc') && n.args.length === 1) { if (!(Math.abs(Math.sin(arg)) > TINY)) ok = false; return; }
      if (['asin', 'acos', 'arcsin', 'arccos'].includes(name) && n.args.length === 1) { if (!(Math.abs(arg) < 1 - TINY)) ok = false; return; }
      ok = false;
      return;
    }
    ok = false;
  });
  return ok;
}

// Null when the expression has no step function; else { left, right, steps }
// — each side { value, exact } — or { refuse, steps } when not proved here.
export function stepFunctionLimit(func, v, a, { Algebrite, pointText = null }) {
  let tree;
  try { tree = math.parse(String(func)); } catch { return null; }
  const nodes = tree.filter(isStep);
  if (!nodes.length) return null;
  const refuse = (why) => ({ refuse: true, steps: [why] });
  if (!Algebrite) return refuse('The tools to work this step function exactly did not load, so the limit is not claimed.');
  if (nodes.some((n) => n.args.some((arg) => arg.filter(isStep).length))) {
    return refuse('A step function inside another one is not worked here, so the limit is not claimed.');
  }
  // The point exactly: from its typed digits when it is a decimal (a point
  // within rounding of a jump is then refused below, never put on it).
  const aText = decimalText(pointText) ?? rationalText(a);
  if (aText === null) return refuse(`The point ${mark(formatNumber(a))} is not a simple fraction, so it cannot be compared with a jump exactly: the limit is not claimed.`);
  const steps = [];
  const replacement = new Map();
  for (const n of nodes) {
    const name = n.fn.name;
    const shown = beautify(n.toString());
    let rule = JUMPS[name];
    let m = null;
    if (name === 'mod') {
      const mNode = n.args[1];
      m = n.args.length === 2 && !mNode.filter((x) => x.type === 'SymbolNode' && x.name === v).length ? evalNode(mNode, v, a) : NaN;
      const mText = rationalText(m);
      if (!(m > 0) || mText === null) return refuse(`${mark(shown)} is not worked here, so the limit is not claimed.`);
      rule = { set: `the multiples of ${formatNumber(m)}`, at: (c) => Math.round(c / m) * m, below: () => m, above: () => 0 };
    } else if (n.args.length !== 1) {
      // round(x, n) rounds to n places: other jumps, not worked here.
      return refuse(`${mark(shown)} is not worked here, so the limit is not claimed.`);
    }
    const g = n.args[0];
    const gText = beautify(g.toString());
    if (!continuousAt(g, v, a)) return refuse(`The inside of ${mark(shown)}, ${mark(gText)}, is not shown continuous at ${mark(`${v} = ${formatNumber(a)}`)}, so the limit is not claimed.`);
    const c = evalNode(g, v, a);
    const J = rule.at(c);
    const near = J !== null && Math.abs(c - J) <= TINY * (1 + Math.abs(c));
    let onJump = false;
    if (near) {
      // On the jump only if u(a) − J is exactly 0.
      const JText = rationalText(J);
      const diff = JText === null ? null : exactAt(Algebrite, `(${g.toString()}) - (${JText})`, v, aText);
      if (diff === '0') onJump = true;
      else return refuse(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(gText)} is within rounding of ${mark(formatNumber(J))}, a jump of ${mark(shown)}, but it is not shown to be exactly that, so the limit is not claimed.`);
    }
    if (!onJump) {
      const value = name === 'mod' ? ((c % m) + m) % m : evalNode(n, v, a);
      const vText = rationalText(value);
      if (vText === null) return refuse(`${mark(shown)} is not worked here, so the limit is not claimed.`);
      replacement.set(n, { left: vText, right: vText });
      steps.push(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(c)}`)}, which is not one of ${rule.set} where ${mark(shown)} jumps, so ${mark(`${shown} = ${formatNumber(value)}`)} on both sides near ${mark(formatNumber(a))}.`);
      continue;
    }
    // At a jump: the side g comes from decides the value.
    let slope = NaN;
    try {
      const d = String(Algebrite.run(`d(${forAlgebrite(g.toString())}, ${v})`)).trim();
      slope = evalNode(math.parse(d.replace(/(?<![a-z])exp\(1\)/g, 'e')), v, a);
    } catch { slope = NaN; }
    if (!Number.isFinite(slope) || Math.abs(slope) <= TINY) {
      return refuse(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(J)}`)}, a jump of ${mark(shown)}, and its derivative there is ${mark('0')} (or not found), so which side it reaches the jump from is not settled here: the limit is not claimed.`);
    }
    const fromBelowOnLeft = slope > 0;
    const left = fromBelowOnLeft ? rule.below(J) : rule.above(J);
    const right = fromBelowOnLeft ? rule.above(J) : rule.below(J);
    replacement.set(n, { left: rationalText(left), right: rationalText(right) });
    steps.push(`At ${mark(`${v} = ${formatNumber(a)}`)}, ${mark(`${gText} = ${formatNumber(J)}`)}, one of ${rule.set} where ${mark(shown)} jumps. ${mark(gText)} is ${slope > 0 ? 'increasing' : 'decreasing'} there (its derivative is ${mark(formatNumber(slope))}), so just left of ${mark(formatNumber(a))} it is just ${fromBelowOnLeft ? 'below' : 'above'} ${mark(formatNumber(J))} and ${mark(`${shown} = ${formatNumber(left)}`)}; just right, ${mark(`${shown} = ${formatNumber(right)}`)}.`);
  }
  const side = (which) => {
    const swapped = tree.transform((n) => (replacement.has(n) ? math.parse(`(${replacement.get(n)[which]})`) : n));
    const text = swapped.toString();
    if (!continuousAt(swapped, v, a)) return { text, value: null };
    const exact = exactAt(Algebrite, text, v, aText);
    return { text, value: evalNode(swapped, v, a), exact };
  };
  const L = side('left');
  const R = side('right');
  for (const [s, name] of [[L, 'left'], [R, 'right']]) {
    if (s.value === null || !Number.isFinite(s.value)) {
      return refuse(`From the ${name}, ${mark(beautify(func))} is ${mark(beautify(s.text))} near ${mark(formatNumber(a))}, which is not shown continuous there, so the limit is not claimed.`);
    }
  }
  // Equal sides only when their difference is exactly 0.
  const diff = exactAt(Algebrite, `(${L.text}) - (${R.text})`, v, aText);
  let same = null;
  if (diff === '0') same = true;
  else if (diff !== null) {
    let d = NaN;
    try { d = Number(math.evaluate(diff.replace(/(?<![a-z])exp\(1\)/g, 'e'))); } catch { d = NaN; }
    if (Number.isFinite(d) && d !== 0) same = false;
  }
  if (same === null) return refuse('Whether the two sides agree is not shown exactly here, so the limit is not claimed.');
  // Exact when Algebrite gave the side's value; otherwise the decimal is
  // only an approximation and says so.
  const shownValue = (s) => {
    const exact = s.exact ? exactForm(s.exact) : null;
    if (!exact) return `≈ ${formatNumber(s.value)}`;
    return exact !== formatNumber(s.value) ? `${exact} (≈ ${formatNumber(s.value)})` : exact;
  };
  steps.push(`From the left, ${mark(beautify(func))} is ${mark(beautify(L.text))} near ${mark(formatNumber(a))}, continuous there, so it → ${mark(shownValue(L))}; from the right it is ${mark(beautify(R.text))}, so it → ${mark(shownValue(R))}.`);
  return { left: { value: L.value, shown: shownValue(L) }, right: { value: R.value, shown: shownValue(R) }, same, steps };
}
