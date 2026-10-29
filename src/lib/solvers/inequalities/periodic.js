// A periodic inequality (sin(x) > 1/2): solved on one period, then stated for
// every period.

import { math, beautify, formatNumber, piForm, mark } from '../solverUtils.js';
import { shown } from './roots.js';
import { coalesce } from './intervals.js';
import { buildGraph } from './presentation.js';

// --- periodic inequalities -----------------------------------------------------
//
// f with a period T proved from its structure (structuralPeriod) and defined
// everywhere: locate the zeros on one period [0, T) — sign changes, and
// touching zeros as minima of |f| that reach 0 — test the sign between them,
// and state the solution on that period plus every multiple of T. An
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
  const N = 1440;
  const xs = Array.from({ length: N + 1 }, (_, i) => (T * i) / N);
  const ys = xs.map(f);
  if (!ys.every(Number.isFinite)) return null;
  const scale = Math.max(1, ...ys.map(Math.abs));
  const roots = [];
  const addRoot = (r) => {
    const x = ((r % T) + T) % T;
    const xr = Math.abs(x - T) < 1e-9 ? 0 : x;
    if (!roots.some((q) => Math.abs(q - xr) < 1e-7)) roots.push(xr);
  };
  for (let i = 0; i < N; i += 1) {
    const [a, b] = [xs[i], xs[i + 1]];
    const [fa, fb] = [ys[i], ys[i + 1]];
    if (fa === 0) addRoot(a);
    if ((fa < 0) !== (fb < 0) && fa !== 0 && fb !== 0) {
      let lo = a;
      let hi = b;
      let flo = fa;
      for (let k = 0; k < 80; k += 1) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      addRoot((lo + hi) / 2);
    }
  }
  // Touching zeros (sin(x) ≥ 1 at π/2): |f| has a local minimum that reaches 0.
  for (let i = 1; i < N; i += 1) {
    const [l, m, r] = [Math.abs(ys[i - 1]), Math.abs(ys[i]), Math.abs(ys[i + 1])];
    if (!(m <= l && m <= r && m < 1e-2 * scale)) continue;
    if ((ys[i - 1] < 0) !== (ys[i + 1] < 0)) continue; // a crossing, found above
    let lo = xs[i - 1];
    let hi = xs[i + 1];
    for (let k = 0; k < 120; k += 1) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1;
    }
    const x = (lo + hi) / 2;
    if (Math.abs(f(x)) < 1e-10 * scale) addRoot(x);
  }
  if (roots.length > 24) return null;
  roots.sort((a, b) => a - b);

  // Exact endpoints: a multiple of π, confirmed by Algebrite.
  const exact = (x) => {
    const pf = piForm(x);
    if (pf === null) return null;
    const alg = pf.replace(/(\d)π/g, '$1*pi').replace(/π/g, 'pi');
    try {
      const out = String(Algebrite.run(`simplify(subst(${alg}, ${v}, ${fExpr}))`)).trim();
      return out === '0' ? pf : null;
    } catch {
      return null;
    }
  };
  let inexact = false;
  const show = (x) => {
    const e = exact(x);
    if (e !== null) return e;
    inexact = true;
    return formatNumber(x);
  };

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

  const Tshown = piForm(T) ?? formatNumber(T);
  const plusT = Tshown === '0' ? '' : ` + ${Tshown === 'π' ? 'π' : Tshown}n`;
  const endpoint = (x) => {
    const t = show(x);
    return t === '0' ? `${Tshown}n` : `${t}${plusT}`;
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
    answer = `${pieceTexts.join('  or  ')}, for every integer n${inexact ? ' (endpoints ≈)' : ''}`;
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
  const cut = (x) => (Math.abs(x) < 1e-12 ? '0' : Math.abs(x - T) < 1e-9 ? Tshown : show(x));
  const steps = [
    `Solve the inequality ${mark(`${beautify(lhs)} ${opShown} ${beautify(rhs)}`)}.`,
    `Move everything to one side: ${mark(`${shown(simplified)} ${opShown} 0`)}.`,
    `The left side is periodic with period ${mark(Tshown)}: its trig functions repeat every ${mark(Tshown)}. So solve on one period, ${mark(`0 ≤ ${v} < ${Tshown}`)}, and the solution repeats.`,
    roots.length
      ? `On that period it is ${mark('0')} at ${mark(`${v} = ${roots.map(show).join(', ')}`)}${inexact ? ' (located numerically, to the decimals shown)' : ''}.`
      : `It is never ${mark('0')}, so it keeps one sign throughout.`,
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
  };
}
