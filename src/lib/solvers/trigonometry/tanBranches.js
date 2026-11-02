// The roots of f(x) = c·tan(kx + d) + g(x) (or cot), g defined everywhere:
// infinitely many, and where they are.
//
// Between consecutive poles of tan(kx + d), tan runs through every real
// value while g stays finite, so f does too: at least one root on every
// branch, and so infinitely many. How many on each:
//
//   f′(x) = s·W(u) + g′(x), u = kx + d, W = sec² (tan) or csc² (cot) ≥ 1,
//   s = c·k (tan) or −c·k (cot).
//
// For a line g = mx + b, g′ = m. With r = −m/s ≤ 1, f′ keeps the sign of s
// and is 0 only at single points, so f is strictly monotone on each branch:
// exactly one root there (tan(x) = x). With r > 1, f′ = 0 where W(u) = r,
// twice on each branch, and the signs of f at those turning points say
// whether the branch holds one root or three (tan(x) = 2x + 1). Any other g
// still gives at least one root per branch; the roots are then listed as
// some of them, not as the nearest.
//
// sec and csc do not run through every value: between two poles sec(u)
// keeps one sign and runs off to that infinity at both ends. For a line g
// (m ≠ 0), f″ = c·k²·sec(u)·(sec²(u) + tan²(u)) keeps that sign too, so f
// is strictly convex (or concave) on the branch with exactly one turning
// point, and the sign of f there says two roots or none. Every other branch
// has c·sec of one sign, and far out where the line has the opposite sign
// those branches hold two each: infinitely many (sec(x) = x). Any other g,
// or a turning value too close to 0 to tell, is not decided here.
//
// 1.67.2. The numeric scan stepped over the roots next to the poles:
// tan(x) = x answered three roots, ±4.4934 and 0, of infinitely many, and
// sec(x) = x listed −33.017 before the roots nearer 0.

import { math, beautify, formatNumber, mark, linearCoefficients, definedEverywhere } from '../solverUtils.js';

const ZERO = 1e-9;
const MAX_BRANCHES = 60;

const hasVariable = (node, v) => node.filter((m) => m.type === 'SymbolNode' && m.name === v).length > 0;
const unwrap = (n) => (n.type === 'ParenthesisNode' ? unwrap(n.content) : n);
const constantOf = (n) => {
  try {
    const y = n.evaluate({});
    return typeof y === 'number' && Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
};

// The signed terms of a sum, through brackets and minus signs.
function signedTerms(node, sign = 1, out = []) {
  const n = unwrap(node);
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return signedTerms(n.args[0], -sign, out);
  if (n.type === 'OperatorNode' && n.fn === 'unaryPlus') return signedTerms(n.args[0], sign, out);
  if (n.type === 'OperatorNode' && n.op === '+' && n.args.length === 2) {
    signedTerms(n.args[0], sign, out);
    return signedTerms(n.args[1], sign, out);
  }
  if (n.type === 'OperatorNode' && n.op === '-' && n.args.length === 2) {
    signedTerms(n.args[0], sign, out);
    return signedTerms(n.args[1], -sign, out);
  }
  out.push({ sign, node: n });
  return out;
}

// c·tan(u), tan(u)/c, −tan(u) or tan(u) itself (or cot, sec, csc):
// { fn, arg, c }, or null.
function tanTerm(node, v) {
  const n = unwrap(node);
  if (n.type === 'FunctionNode' && ['tan', 'cot', 'sec', 'csc'].includes(n.fn?.name) && n.args[0] && hasVariable(n.args[0], v)) return { fn: n.fn.name, arg: n.args[0], c: 1 };
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') {
    const t = tanTerm(n.args[0], v);
    return t && { ...t, c: -t.c };
  }
  if (n.type === 'OperatorNode' && n.op === '*' && n.args.length === 2) {
    for (const [a, b] of [[n.args[0], n.args[1]], [n.args[1], n.args[0]]]) {
      const t = tanTerm(a, v);
      const c = hasVariable(b, v) ? null : constantOf(b);
      if (t && c !== null && c !== 0) return { ...t, c: t.c * c };
    }
  }
  if (n.type === 'OperatorNode' && n.op === '/' && n.args.length === 2) {
    const t = tanTerm(n.args[0], v);
    const c = hasVariable(n.args[1], v) ? null : constantOf(n.args[1]);
    if (t && c) return { ...t, c: t.c / c };
  }
  return null;
}

// The form of expr as c·tan(kx + d) + g, or null.
export function readTanBranches(expr, v) {
  let tree;
  try { tree = math.parse(String(expr)); } catch { return null; }
  const terms = signedTerms(tree).map((t) => ({ ...t, tan: tanTerm(t.node, v) }));
  const tans = terms.filter((t) => t.tan);
  if (tans.length !== 1) return null;
  const [{ sign, tan }] = tans;
  const line = linearCoefficients(tan.arg.toString(), v);
  if (!line || line.k === 0) return null;
  const rest = terms.filter((t) => !t.tan);
  const g = rest.length ? rest.map((t) => `${t.sign < 0 ? '-' : '+'}(${t.node.toString()})`).join(' ').replace(/^\+/, '') : '0';
  // Every other term defined everywhere and free of tan, cot, sec and csc.
  if (!definedEverywhere(g, v) || /(?<![a-z])(?:tan|cot|sec|csc)\(/.test(g)) return null;
  const c = sign * tan.c;
  const gLine = linearCoefficients(g, v);
  return { fn: tan.fn, arg: tan.arg.toString(), k: line.k, d: line.d, c, g, gLine };
}

// The branches nearest 0 in x, as [lo, hi] between consecutive poles, with
// u at the branch's centre.
function branchesNear0(form, count) {
  const { fn, k, d } = form;
  const offset = fn === 'tan' || fn === 'sec' ? Math.PI / 2 : 0;
  // Poles at u = offset + nπ, u = kx + d.
  const poleX = (n) => (offset + n * Math.PI - d) / k;
  const n0 = Math.floor((d - offset) / Math.PI); // a pole near x = 0
  const out = [];
  for (let j = -count; j <= count; j += 1) {
    const [a, b] = [poleX(n0 + j), poleX(n0 + j + 1)];
    const [lo, hi] = a < b ? [a, b] : [b, a];
    out.push({ lo, hi, centreU: offset + (n0 + j) * Math.PI + Math.PI / 2, dist: lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi)) });
  }
  return out.sort((p, q) => p.dist - q.dist);
}

// A simple fraction n/q (q ≤ 12) strictly inside (a, b) where f is exactly
// 0, or null.
function exactIn(f, a, b) {
  for (let q = 1; q <= 12; q += 1) {
    for (let n = Math.floor(a * q) + 1; n / q < b; n += 1) {
      if (n / q > a && f(n / q) === 0) return n === 0 ? 0 : n / q;
    }
  }
  return null;
}

function bisect(f, a, b) {
  let [lo, hi] = [a, b];
  const s = Math.sign(f(lo));
  for (let i = 0; i < 300 && Math.abs(hi - lo) > 1e-15 * (1 + Math.abs(lo)); i += 1) {
    const m = (lo + hi) / 2;
    if (Math.sign(f(m)) === s) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// The roots of the equation expr = 0, read as c·tan(kx + d) + g:
// { kind: 'one' | 'counted' | 'some', roots, steps, fnText }, or null when
// expr is not of that form. 'one' and 'counted' list the five roots nearest
// 0 (proved); 'some' lists five of them.
export function tanBranchRoots(expr, v) {
  const form = readTanBranches(expr, v);
  if (!form) return null;
  const f = (x) => {
    try {
      const y = math.evaluate(String(expr), { [v]: x });
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  };
  if (form.fn === 'sec' || form.fn === 'csc') return secBranchRoots(form, f);
  const { fn, k, c, gLine } = form;
  const s = fn === 'tan' ? c * k : -c * k;
  const r = gLine ? -gLine.k / s : null;
  let kind = gLine ? (r <= 1 ? 'one' : 'counted') : 'some';
  const branches = branchesNear0(form, MAX_BRANCHES);
  const roots = [];
  const width = Math.PI / Math.abs(k);
  const delta = width * 1e-9;
  for (const branch of branches) {
    if (kind !== 'some' && roots.length >= 5) {
      const fifth = roots.map(Math.abs).sort((p, q) => p - q)[4];
      if (branch.dist > fifth) break;
    }
    if (kind === 'some' && roots.length >= 5) break;
    const ends = [branch.lo + delta, branch.hi - delta];
    let points = ends;
    if (kind === 'counted') {
      // W(u) = r: sec²(u) = r at u = centre ± arccos(1/√r) for tan (the
      // centre is a zero of tan); csc²(u) = r likewise about cot's zero.
      const shift = Math.acos(1 / Math.sqrt(r));
      const turns = [branch.centreU - shift, branch.centreU + shift].map((u) => (u - form.d) / k).sort((p, q) => p - q);
      if (turns.some((t) => Math.abs(f(t)) <= ZERO)) { kind = 'some'; } else points = [ends[0], ...turns, ends[1]];
    }
    if (kind === 'some') {
      points = Array.from({ length: 2001 }, (_, i) => ends[0] + ((ends[1] - ends[0]) * i) / 2000);
    }
    // On a stretch proved to hold exactly one root ('one', 'counted'), a
    // simple fraction where f is exactly 0 is that root: tan(x) = x at 0,
    // where bisection stops at −1.35·10^(−8) (f ≈ x³/3, below rounding).
    // Never across stretches, so two roots cannot merge (tan(x) = x + 10^(−7)
    // has no exact zero to move onto).
    const monotone = kind !== 'some';
    for (let i = 0; i + 1 < points.length; i += 1) {
      const [p, q] = [points[i], points[i + 1]];
      const [fp, fq] = [f(p), f(q)];
      if (fp === 0) roots.push(p);
      else if (Number.isFinite(fp) && Number.isFinite(fq) && Math.sign(fp) !== Math.sign(fq) && fq !== 0) {
        roots.push((monotone ? exactIn(f, p, q) : null) ?? bisect(f, p, q));
      }
    }
  }
  const nearest = [...new Set(roots.map((x) => (x === 0 ? 0 : x)))].sort((p, q) => Math.abs(p) - Math.abs(q)).slice(0, 5).sort((p, q) => p - q);
  const fnText = `${fn}(${beautify(form.arg)})`;
  const poles = `${beautify(form.arg)} = ${fn === 'tan' ? 'π/2 + nπ' : 'nπ'}`;
  const steps = [
    `Between consecutive poles of ${mark(fnText)} (where ${mark(poles)}), ${mark(fnText)} runs through every real value while the other terms stay finite, so the difference of the two sides does too: there is at least one solution between each pair of poles, and so infinitely many.`,
  ];
  const W = fn === 'tan' ? 'sec' : 'csc';
  const lead = s === 1 ? '' : s === -1 ? '-' : `${formatNumber(s)}·`;
  const slope = gLine ? `${lead}${W}^2(${beautify(form.arg)})${gLine.k === 0 ? '' : ` ${gLine.k < 0 ? '-' : '+'} ${formatNumber(Math.abs(gLine.k))}`}` : null;
  if (kind === 'one') {
    steps.push(`The difference has derivative ${mark(`${slope}`)}, and ${mark(`${W}^2 ≥ 1`)}, so the derivative keeps one sign and is 0 at single points at most: between two poles the difference is strictly monotone, so there is exactly one solution there.`);
  } else if (kind === 'counted') {
    steps.push(`The difference has derivative ${mark(`${slope}`)}, which is 0 where ${mark(`${W}^2(${beautify(form.arg)}) = ${formatNumber(r)}`)}: twice between each pair of poles. The signs at those two turning points say whether that stretch holds one solution or three.`);
  }
  steps.push(kind === 'some'
    ? `Each solution is located by bisection on its stretch between poles; ${nearest.length} of them are listed.`
    : `Each solution is located by bisection on its stretch between poles; the ${nearest.length} nearest ${mark('0')} are listed.`);
  return { kind, roots: nearest, steps, fnText };
}

// sec or csc against a line: two roots or none on each branch, decided at
// its one turning point. Null when g is not a line with m ≠ 0, or a turning
// value cannot be told from 0.
function secBranchRoots(form, f) {
  const { fn, k, d, c, gLine } = form;
  if (!gLine || gLine.k === 0) return null;
  const m = gLine.k;
  // f′(x) = c·k·sec(u)·tan(u) + m, or −c·k·csc(u)·cot(u) + m.
  const slopeAt = (x) => {
    const u = k * x + d;
    return fn === 'sec' ? (c * k * Math.tan(u)) / Math.cos(u) + m : (-c * k) / (Math.sin(u) * Math.tan(u)) + m;
  };
  const width = Math.PI / Math.abs(k);
  const delta = width * 1e-9;
  const roots = [];
  for (const branch of branchesNear0(form, MAX_BRANCHES)) {
    if (roots.length >= 5) {
      const fifth = roots.map(Math.abs).sort((p, q) => p - q)[4];
      if (branch.dist > fifth) break;
    }
    const [lo, hi] = [branch.lo + delta, branch.hi - delta];
    // f′ is strictly monotone on the branch and runs between infinities of
    // opposite signs: one zero, the turning point.
    if (!(Math.sign(slopeAt(lo)) !== Math.sign(slopeAt(hi)))) return null;
    const t = bisect(slopeAt, lo, hi);
    const ft = f(t);
    if (!Number.isFinite(ft) || Math.abs(ft) <= ZERO) return null;
    // The ends run off to the infinity with the sign of c·sec on the branch.
    const endSign = Math.sign(f(lo));
    if (Math.sign(ft) === endSign) continue; // no root on this branch
    for (const [p, q] of [[lo, t], [t, hi]]) roots.push(exactIn(f, p, q) ?? bisect(f, p, q));
  }
  const nearest = [...new Set(roots)].sort((p, q) => Math.abs(p) - Math.abs(q)).slice(0, 5).sort((p, q) => p - q);
  if (!nearest.length) return null;
  const fnText = `${fn}(${beautify(form.arg)})`;
  const arg = beautify(form.arg);
  const poles = `${arg} = ${fn === 'sec' ? 'π/2 + nπ' : 'nπ'}`;
  const pair = fn === 'sec' ? `${fn}(${arg})·(${fn}^2(${arg}) + tan^2(${arg}))` : `${fn}(${arg})·(${fn}^2(${arg}) + cot^2(${arg}))`;
  const steps = [
    `Between consecutive poles of ${mark(fnText)} (where ${mark(poles)}), ${mark(fnText)} keeps one sign and runs off to infinity at both ends, while the other terms form a line. The difference of the two sides has second derivative ${mark(`${c * k * k === 1 ? '' : c * k * k === -1 ? '-' : `${formatNumber(c * k * k)}·`}${pair}`)}, which keeps that same sign, so between two poles it is convex (or concave) with exactly one turning point: its sign there says two solutions on that stretch, or none.`,
    `On every other stretch ${mark(fnText)} has the sign that the line takes far out on one side, so out there each of those stretches holds two solutions: there are infinitely many.`,
    `Each solution is located by bisection on its side of the turning point; the ${nearest.length} nearest ${mark('0')} are listed.`,
  ];
  return { kind: 'convex', roots: nearest, steps, fnText };
}
