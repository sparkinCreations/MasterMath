// A periodic inequality (sin(x) > 1/2): solved on one period, then stated for
// every period.

import { math, beautify, formatNumber, piForm, mark } from '../solverUtils.js';
import { shown, exactDecimals } from './roots.js';
import { coalesce, distinctDigits } from './intervals.js';
import { circleZeros } from '../trigonometry/circle.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';
import { buildGraph, movedText } from './presentation.js';

// --- periodic inequalities -----------------------------------------------------
//
// f with a period T proved from its structure (structuralPeriod) and defined
// everywhere: find every zero on one period [0, T) (circleZeros, exact),
// test the sign between them, and state the solution on that period plus
// every multiple of T. An
// endpoint is written as a multiple of π only when Algebrite confirms f is
// exactly 0 there; otherwise it is a decimal, marked ≈. The general answer is
// cross-checked at points across −50 ≤ x ≤ 50 before it is returned.
export function solvePeriodic({ Algebrite, lhs, rhs, op, variable, fExpr, simplified, period }) {
  const v = variable;
  const T = period;
  const f = (x) => {
    try {
      const y = math.evaluate(fExpr, { [v]: x });
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  };
  const roots = [];
  const addRoot = (r) => {
    const x = ((r % T) + T) % T;
    const xr = Math.abs(x - T) < 1e-9 ? 0 : x;
    if (!roots.some((q) => Math.abs(q - xr) < 1e-9)) roots.push(xr);
  };
  // Every zero on one turn, proved: the exact root finder on the
  // expression as a polynomial in tan(θ/2) (trigonometry/circle.js). A
  // grid of 1440 points a period stood in for that.
  const found = periodicZeros(fExpr, v);
  if (!found) return null;
  for (const r of found) addRoot(r);
  if (roots.length > 24) return null;
  roots.sort((a, b) => a - b);

  // Exact endpoints: a multiple of π, confirmed by Algebrite.
  const exact = (x) => {
    const pf = piMultiple(x);
    if (pf === null) return null;
    const alg = pf.replace(/(\d)π/g, '$1*pi').replace(/π/g, 'pi');
    try {
      const out = String(Algebrite.run(`simplify(subst(${alg}, ${v}, ${exactDecimals(fExpr)}))`)).trim();
      return out === '0' ? pf : null;
    } catch {
      return null;
    }
  };
  let inexact = false;
  // Decimals that tell the zeros apart: 1.5708 and 1.5708 are not two
  // endpoints a reader can use.
  const digits = distinctDigits(roots);
  const decimal = (x) => (digits === null ? formatNumber(x) : x.toFixed(digits));
  // A zero located numerically is named, α, β, …, in the answer, its decimal
  // said once (Round 34): a rounded decimal is not the boundary.
  const NAMES = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'κ'];
  const numeric = roots.filter((x) => exact(x) === null);
  const nameOf = (x) => (numeric.length <= NAMES.length ? NAMES[numeric.indexOf(x)] : null);
  const show = (x) => {
    const e = exact(x);
    if (e !== null) return e;
    inexact = true;
    return decimal(x);
  };
  const named = (x) => (exact(x) === null && nameOf(x) ? nameOf(x) : show(x));

  const nonStrict = op === '<=' || op === '>=';
  const wantPositive = op === '>' || op === '>=';
  const holds = (y) => (wantPositive ? (nonStrict ? y >= -1e-12 : y > 1e-12) : (nonStrict ? y <= 1e-12 : y < -1e-12));
  const signWord = (y) => (y > 0 ? 'positive' : 'negative');

  // Sign chart on one period.
  const cuts = [0, ...roots.filter((r) => r > 1e-9), T];
  const rows = [];
  const pieces = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const y = f((a + b) / 2);
    rows.push({ a, b, y });
    if (holds(y)) pieces.push({ lo: a, hi: b, loC: false, hiC: false });
  }
  if (nonStrict) for (const r of roots) pieces.push({ lo: r, hi: r, loC: true, hiC: true });
  let onePeriod = coalesce(pieces);
  let wrapped = false;
  // A piece that runs into T continues into the next period's start.
  if (onePeriod.length > 1) {
    const first = onePeriod[0];
    const last = onePeriod[onePeriod.length - 1];
    if (Math.abs(first.lo) < 1e-9 && Math.abs(last.hi - T) < 1e-9 && (first.loC || last.hiC || !roots.some((r) => Math.abs(r) < 1e-9))) {
      onePeriod = [{ lo: last.lo - T, hi: first.hi, loC: last.loC, hiC: first.hiC }, ...onePeriod.slice(1, -1)];
      wrapped = true;
    }
  }

  const Tshown = piMultiple(T) ?? formatNumber(T);
  // n multiples of the period: 2πn, πn/5 (not π/5n, which reads as π/(5n)).
  const fractional = Tshown.match(/^(-?\d*)π\/(\d+)$/);
  const Tn = fractional ? `${fractional[1]}πn/${fractional[2]}` : `${Tshown}n`;
  const plusT = Tshown === '0' ? '' : ` + ${Tn}`;
  const endpoint = (x) => {
    const t = named(x);
    return t === '0' ? Tn : `${t}${plusT}`;
  };
  const whole = onePeriod.length === 1 && Math.abs(onePeriod[0].hi - onePeriod[0].lo - T) < 1e-9;

  let answer;
  let pieceTexts = [];
  if (onePeriod.length === 0) {
    answer = 'No solution — no value satisfies the inequality';
  } else if (whole && !(roots.length && !nonStrict)) {
    answer = 'All real numbers satisfy the inequality';
  } else {
    pieceTexts = onePeriod.map((p) => (Math.abs(p.hi - p.lo) < 1e-12
      ? `${v} = ${endpoint(p.lo)}`
      : `${endpoint(p.lo)} ${p.loC ? '≤' : '<'} ${v} ${p.hiC ? '≤' : '<'} ${endpoint(p.hi)}`));
    const used = numeric.filter((x) => pieceTexts.some((t) => t.includes(nameOf(x) || '\u0000')));
    const where = used.length && nameOf(used[0])
      ? `, where ${used.map((x) => `${nameOf(x)} ≈ ${decimal(x)}`).join(used.length > 2 ? ', ' : ' and ')} ${used.length > 1 ? 'are zeros' : 'is a zero'} of ${movedText(lhs, rhs, simplified)} in [0, ${Tshown})`
      : '';
    answer = `${pieceTexts.join('  or  ')}, for every integer n${where}`;
  }

  // Cross-check the general answer away from the period it was found on.
  const inSolution = (x) => onePeriod.some((p) => {
    const k = Math.floor((x - p.lo) / T);
    const xr = x - k * T;
    const inside = xr > p.lo + 1e-9 && xr < p.hi - 1e-9;
    const onEdge = (Math.abs(xr - p.lo) < 1e-9 && p.loC) || (Math.abs(xr - p.hi) < 1e-9 && p.hiC);
    return inside || onEdge;
  });
  for (let x = -50.123; x <= 50; x += 0.731) {
    const y = f(x);
    if (Math.abs(y) < 1e-6) continue; // too close to a root to judge
    if (holds(y) !== inSolution(x)) return null;
  }

  const opShown = op.replace('<=', '≤').replace('>=', '≥');
  // The ends of the period are 0 and T themselves, not zeros of f.
  const cut = (x) => (Math.abs(x) < 1e-12 ? '0' : Math.abs(x - T) < 1e-9 ? Tshown : named(x));
  const steps = [
    `Solve the inequality ${mark(`${beautify(lhs)} ${opShown} ${beautify(rhs)}`)}.`,
    // cos(x) ≤ 0 is on one side already.
    ...(beautify(rhs) === '0' ? [] : [`Move everything to one side: ${mark(`${movedText(lhs, rhs, simplified)} ${opShown} 0`)}.`]),
    `The left side is periodic with period ${mark(Tshown)}: its trig functions repeat every ${mark(Tshown)}. So solve on one period, ${mark(`0 ≤ ${v} < ${Tshown}`)}, and the solution repeats.`,
    roots.length
      ? `On that period it is ${mark('0')} at ${mark(`${v} = ${roots.map((x) => (exact(x) === null && nameOf(x) ? `${nameOf(x)} ≈ ${decimal(x)}` : show(x))).join(', ')}`)}${inexact ? ' (located numerically, to the decimals shown)' : ''}, and nowhere else: written in the tangent of the half-angle it becomes a polynomial, whose real roots give every zero except at the half-turn, where that tangent is undefined; that one angle is checked on its own.`
      : `It is never ${mark('0')}: written in the tangent of the half-angle it becomes a polynomial with no real root, and at the half-turn, where that tangent is undefined, it is not ${mark('0')} either. So it keeps one sign throughout.`,
    `Test the sign between them: ${rows.map((r) => `${mark(`(${cut(r.a)}, ${cut(r.b)})`)} ${signWord(r.y)}`).join('; ')}.`,
  ];
  if (pieceTexts.length) {
    steps.push(`Keep the ${wantPositive ? 'positive' : 'negative'} parts${nonStrict ? ' and the zeros' : ''}${wrapped ? ' (the part at the end of the period runs on into the start of the next, so the two join into one interval)' : ''}, then add any whole number of periods: ${mark(pieceTexts.join('  or  '))}, for every integer ${mark('n')}.`);
  } else {
    steps.push(answer.startsWith('No') ? 'No part of the period satisfies it, so no value does.' : 'Every part of the period satisfies it, so every value does.');
  }

  // Shade the solution over a few periods for the graph.
  const shaded = [];
  for (let k = -3; k <= 3; k += 1) for (const p of onePeriod) shaded.push({ lo: p.lo + k * T, hi: p.hi + k * T, loC: p.loC, hiC: p.hiC });
  const zerosShown = [];
  for (let k = -3; k <= 3; k += 1) for (const r of roots) zerosShown.push(r + k * T);
  const graph = buildGraph(fExpr, v, [-T, 2 * T], zerosShown, [], shaded);
  if (graph) graph.initialWindow = { xMin: -T, xMax: 2 * T };

  return {
    steps,
    answer,
    verified: true,
    verificationMethod: 'sign chart on one period + numeric check across many periods',
    tips: [
      `A periodic inequality has infinitely many solution intervals: solve on one period, then add every multiple of the period (here ${mark(Tshown)}).`,
      `Find where the expression equals ${mark('0')} on that period first; the sign can only change there.`,
    ],
    common_mistakes: [
      'Giving only the solutions in one period and leaving out "+ a multiple of the period".',
      roots.length >= 2
        ? `Finding one zero in the period and stopping: on one period the expression is ${mark('0')} at ${mark(roots.map(show).join(' and at '))}, and the sign can change at each.`
        : 'Forgetting that the sign can change at every zero in the period, not only at the first one found.',
    ],
    graph,
    periodic: true,
    variable,
    guide: {
      method: 'periodic',
      fn: /(?<![a-z])sin\(/.test(fExpr) && !/(?<![a-z])(?:cos|tan)\(/.test(fExpr) ? 'sin' : /(?<![a-z])cos\(/.test(fExpr) && !/(?<![a-z])(?:sin|tan)\(/.test(fExpr) ? 'cos' : 'other',
      variable: v,
      period: Tshown,
      zeros: roots.map((x) => (exact(x) === null && nameOf(x) ? `${nameOf(x)} ≈ ${decimal(x)}` : show(x))),
      rows: rows.map((r) => ({ interval: `(${cut(r.a)}, ${cut(r.b)})`, sign: signWord(r.y) })),
      pieces: pieceTexts.join('  or  '),
      answer,
    },
  };
}

// x as a fraction of π (π/5, 2π/15): piForm's denominators, and the others
// up to 60 that a multiple angle brings (sin(10x) has period π/5).
function piMultiple(x) {
  const known = piForm(x);
  if (known !== null) return known;
  const ratio = x / Math.PI;
  for (let d = 5; d <= 60; d += 1) {
    const n = ratio * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const k = Math.round(n);
      if (k === 0) return '0';
      return `${k < 0 ? '-' : ''}${Math.abs(k) === 1 ? '' : Math.abs(k)}π/${d}`;
    }
  }
  return null;
}

// circleZeros, and through an absolute value: every zero of f lies where
// the inside u is ≥ 0 or ≤ 0, so it is a zero of f with |u| written as u or
// as −u; a zero of either branch counts when u has that branch's sign there
// (|sin(x)| > 1/2 is sin(x) = ±1/2).
function periodicZeros(fExpr, v) {
  let tree;
  try { tree = math.parse(String(fExpr)); } catch { return null; }
  const absNodes = tree.filter((n) => n.type === 'FunctionNode' && n.fn?.name === 'abs');
  if (!absNodes.length) return circleZeros(fExpr, v, { readPolynomial, allRoots });
  if (absNodes.length > 3 || absNodes.some((n) => n.filter((c) => c !== n && c.type === 'FunctionNode' && c.fn?.name === 'abs').length)) return null;
  const inside = absNodes.map((n) => n.args[0]);
  const f = (x) => { try { return Number(tree.evaluate({ [v]: x })); } catch { return NaN; } };
  const zeros = [];
  for (let mask = 0; mask < 2 ** absNodes.length; mask += 1) {
    const signs = absNodes.map((_, i) => ((mask >> i) & 1 ? -1 : 1));
    const branch = tree.transform((n) => {
      const i = absNodes.indexOf(n);
      return i === -1 ? n : math.parse(`${signs[i] < 0 ? '-' : ''}(${n.args[0].toString()})`);
    });
    const found = circleZeros(branch.toString(), v, { readPolynomial, allRoots });
    if (!found) return null;
    for (const x of found) {
      const fits = inside.every((u, i) => {
        const y = Number(u.evaluate({ [v]: x }));
        return Math.abs(y) < 1e-12 || Math.sign(y) === signs[i];
      });
      if (fits && Math.abs(f(x)) < 1e-9 && !zeros.some((z) => Math.abs(z - x) < 1e-9)) zeros.push(x);
    }
  }
  return zeros.sort((a, b) => a - b);
}
