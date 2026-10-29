// Absolute-value equations (split into cases) and radical equations (the
// radical isolated, both sides raised, extraneous roots rejected).

import { matchingParen } from '../../mathParser.js';
import {
  math,
  loadAlgebrite,
  isAlgebriteFailure,
  beautify,
  formatNumber,
  hasVariable,
  mark,
  absBars,
} from '../solverUtils.js';
import { satisfiesEquation, parseRootsList, prettyRadicals } from './rootsFormat.js';
import { numericText, asNumber } from './radicals.js';
import { solveWithAlgebriteRoots } from './polynomial.js';

// |g(x)| = c, possibly as k·|g(x)| + b = c (or with the sides swapped).
// c < 0: no real solution; c = 0: solve g = 0; c > 0: solve g = c and
// g = −c. A linear g is solved by hand in exact arithmetic; anything else
// takes the exact-roots path per case. Every candidate is substituted into
// the ORIGINAL equation before it is listed. Returns null when the equation
// is not of this shape.
export async function solveAbsoluteValueEquation(equation, variable) {
  const v = variable;
  const [lhsRaw, rhsRaw] = equation.split('=').map((t) => t.replace(/\s+/g, ''));
  if (!lhsRaw || rhsRaw === undefined) return null;
  const isConst = (t) => t !== '' && !/[a-z]/i.test(t.replace(/\b(?:pi|sqrt|e)\b/gi, ''));
  const parseSide = (side) => {
    const m = side.match(/^(-?(?:\d+(?:\.\d+)?|\d+\/\d+)\*)?abs\(/i);
    if (!m) return null;
    const open = side.indexOf('(');
    const close = matchingParen(side, open);
    if (close < 0) return null;
    const g = side.slice(open + 1, close);
    const rest = side.slice(close + 1);
    const b = rest.match(/^([+-](?:\d+(?:\.\d+)?|\d+\/\d+))?$/);
    if (!b) return null;
    if (!hasVariable(g, v)) return null;
    return { k: m[1] ? m[1].slice(0, -1) : '1', g, b: b[1] || '0' };
  };
  let abs = parseSide(lhsRaw);
  let other = rhsRaw;
  if (!abs) {
    abs = parseSide(rhsRaw);
    other = lhsRaw;
  }
  if (!abs || !isConst(other)) return null;
  const Algebrite = await loadAlgebrite();
  const exactOf = (code) => {
    try {
      const out = String(Algebrite.run(`simplify(${code})`)).trim();
      return isAlgebriteFailure(out) ? null : out;
    } catch { return null; }
  };
  const kNum = Number(math.evaluate(abs.k));
  if (!Number.isFinite(kNum) || kNum === 0) return null;
  const cRaw = exactOf(`((${other}) - (${abs.b}))/(${abs.k})`);
  if (cRaw === null) return null;
  const c = Number(math.evaluate(cRaw));
  if (!Number.isFinite(c)) return null;
  const gShown = beautify(abs.g);
  const shownC = beautify(cRaw);
  const bars = (t) => absBars(beautify(t)).replace(/\s*=\s*/, ' = ');
  const steps = [`This is an absolute-value equation: ${bars(equation)}.`];
  if (abs.k !== '1' || abs.b !== '0') {
    steps.push(`First isolate the absolute value${abs.b !== '0' ? `: move the constant ${beautify(abs.b)} across` : ''}${abs.k !== '1' ? `${abs.b !== '0' ? ' and' : ':'} divide by ${beautify(abs.k)}` : ''}: |${gShown}| = ${shownC}.`);
  }

  if (c < 0) {
    steps.push(`An absolute value is never negative — |${gShown}| ≥ 0 for every ${v} — so it can never equal ${shownC}.`);
    steps.push('No real solution.');
    return { steps, answer: 'No real solution — an absolute value is never negative', solutions: [] };
  }

  // Solve one case g = value, by hand when g is linear.
  const solveCase = async (value, label) => {
    const a = exactOf(`coeff(${abs.g}, ${v}, 1)`);
    const b0 = exactOf(`coeff(${abs.g}, ${v}, 0)`);
    const degree = exactOf(`deg(${abs.g}, ${v})`);
    const lines = [];
    if (degree === '1' && a && b0 && !hasVariable(a, v) && !hasVariable(b0, v)) {
      const aNum = Number(math.evaluate(a));
      const moved = exactOf(`(${value}) - (${b0})`);
      const x = exactOf(`((${value}) - (${b0}))/(${a})`);
      lines.push(`${label}: ${gShown} = ${beautify(value)}`);
      if (b0 !== '0') lines.push(`  ${b0.startsWith('-') ? 'Add' : 'Subtract'} ${beautify(b0.replace(/^-/, ''))} ${b0.startsWith('-') ? 'to' : 'from'} both sides: ${beautify(`${a === '1' ? '' : a === '-1' ? '-' : `${a}*`}${v}`)} = ${beautify(moved)}`);
      if (aNum !== 1) lines.push(`  Divide both sides by ${beautify(a)}: ${v} = ${beautify(x)}`);
      else if (b0 === '0') lines.push(`  So ${v} = ${beautify(x)}`);
      return { lines, roots: [Number(math.evaluate(x))], exact: { [Number(math.evaluate(x))]: x } };
    }
    const viaRoots = await solveWithAlgebriteRoots(`${abs.g} = ${value}`, v);
    if (!viaRoots) return null;
    lines.push(`${label}: ${gShown} = ${beautify(value)}`);
    for (const st of viaRoots.steps) lines.push(`  ${st}`);
    if (!viaRoots.solutions.some(Number.isFinite)) lines.push('  This case gives no real solution, so it contributes nothing.');
    return { lines, roots: viaRoots.solutions, exact: {} };
  };

  const cases = c === 0
    ? [{ value: '0', label: 'Since |g| = 0 only when g = 0, solve' }]
    : [{ value: cRaw, label: 'Case 1 (the inside is positive)' }, { value: exactOf(`-(${cRaw})`) || `-(${cRaw})`, label: 'Case 2 (the inside is negative)' }];
  if (c === 0) steps.push(`|${gShown}| = 0 only when the expression inside is 0.`);
  else steps.push(`|${gShown}| = ${shownC} means the expression inside is either ${shownC} or −${shownC}, so there are two cases to solve.`);

  const solutions = [];
  const exactOfRoot = {};
  for (const cs of cases) {
    const solved = await solveCase(cs.value, cs.label);
    if (!solved) return null;
    steps.push(...solved.lines);
    Object.assign(exactOfRoot, solved.exact);
    for (const r of solved.roots) if (Number.isFinite(r) && !solutions.some((x) => Math.abs(x - r) < 1e-9)) solutions.push(r);
  }
  const verified = solutions.filter((x) => satisfiesEquation(equation, v, x));
  if (verified.length !== solutions.length) return null; // never list an unverified candidate
  verified.sort((p, q) => p - q);
  const shownRoots = verified.map((x) => `${v} = ${exactOfRoot[x] ? beautify(exactOfRoot[x]) : formatNumber(x)}`);
  steps.push(verified.length ? `Solution: ${shownRoots.join('  or  ')}` : 'No real solution.');
  return { steps, answer: verified.length ? shownRoots.join('  or  ') : 'No real solution', solutions: verified };
}

// sqrt(R) = S: isolate the radical, state the domain (R ≥ 0, and S ≥ 0
// because a square root is never negative), square both sides, solve the
// polynomial, and check every candidate in the original — squaring can
// manufacture a solution of sqrt(R) = −S. Only one square root, whose
// argument contains the variable, is handled; anything else returns null.
export async function solveViaRadicalIsolation(equation, variable) {
  const v = variable;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zero = `(${lhs.trim()}) - (${rhs.trim()})`;
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  const re = /(?<![a-z])sqrt\s*\(/gi;
  const radicals = [];
  let m;
  while ((m = re.exec(zero)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(zero, open);
    if (close === -1) return null;
    radicals.push({ start: m.index, end: close + 1, arg: zero.slice(open + 1, close).trim() });
    re.lastIndex = close + 1;
  }
  if (radicals.length !== 1 || !hasVar.test(radicals[0].arg)) return null;
  const R = radicals[0].arg;
  const inS = `${zero.slice(0, radicals[0].start)}s${zero.slice(radicals[0].end)}`;
  if (/\^\s*\(\s*1\s*\/\s*2\s*\)|\b(?:sin|cos|tan|ln|log|abs|exp|sqrt)\b/i.test(inS)) return null;
  if (/[a-wyz]{2,}/i.test(R.replace(new RegExp(v, 'g'), ''))) return null; // functions inside the radicand
  try {
    const Algebrite = await loadAlgebrite();
    const k = String(Algebrite.run(`coeff(${inS}, s, 1)`)).trim();
    if (!numericText(k) || asNumber(k) === 0) return null;
    const rest = String(Algebrite.run(`subst(0, s, ${inS})`)).trim();
    if (/\bs\b|stop|error|nil/i.test(rest)) return null;
    if (String(Algebrite.run(`simplify((${inS}) - ((${k})*s + (${rest})))`)).trim() !== '0') return null;
    const S = String(Algebrite.run(`simplify(-(${rest})/(${k}))`)).trim();
    // A constant right side: negative means no solution at all, before any
    // squaring; non-negative needs no sign check of its own.
    const constantS = !hasVar.test(S) ? asNumber(S) : NaN;
    if (Number.isFinite(constantS) && constantS < 0) {
      return {
        steps: [
          `Isolate the radical: ${mark(`${beautify(zero)} = 0`)} rearranges to ${mark(`√(${beautify(R)}) = ${beautify(S)}`)}.`,
          `A square root is never negative, so √(${beautify(R)}) = ${beautify(S)} has no solution. (Squaring both sides would give ${beautify(R)} = ${formatNumber(constantS * constantS)}, but that candidate solves √(${beautify(R)}) = ${formatNumber(-constantS)}, not the original equation.)`,
          'Solution: No solution (a square root cannot equal a negative number)',
        ],
        answer: 'No solution (a square root cannot equal a negative number)',
        solutions: [],
      };
    }
    const squared = String(Algebrite.run(`expand((${S})^2)`)).trim();
    const poly = `(${R}) - (${squared})`;
    const rootsRaw = String(Algebrite.roots(poly, v)).trim();
    if (!rootsRaw || /stop|error|nil/i.test(rootsRaw) || /\(-.*\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
    const candidates = parseRootsList(rootsRaw);
    if (candidates.length === 0) return null;

    const steps = [
      `Isolate the radical: ${mark(`${beautify(zero)} = 0`)} rearranges to ${mark(`√(${beautify(R)}) = ${beautify(S)}`)}.`,
      Number.isFinite(constantS)
        ? `Domain: the radicand must be non-negative, so ${mark(`${beautify(R)} ≥ 0`)}. Any candidate breaking this is extraneous.`
        : `Domain: the radicand must be non-negative, so ${mark(`${beautify(R)} ≥ 0`)}; and a square root is never negative, so the other side must also satisfy ${mark(`${beautify(S)} ≥ 0`)}. Any candidate breaking either is extraneous.`,
      `Square both sides: ${mark(`${beautify(R)} = (${beautify(S)})² = ${beautify(squared)}`)}.`,
      `Solve the polynomial equation ${mark(`${beautify(poly)} = 0`)}: ${mark(candidates.map((c) => `${v} = ${prettyRadicals(c.display)}`).join(' or '))}.`,
    ];
    const kept = [];
    const checks = [];
    for (const c of candidates) {
      const show = prettyRadicals(c.display);
      if (!Number.isFinite(c.numeric)) { checks.push(`${mark(`${v} = ${show}`)} is not real — rejected`); continue; }
      const rVal = asNumber(R.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), `(${c.numeric})`));
      const sVal = asNumber(S.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), `(${c.numeric})`));
      if (!(rVal >= -1e-9)) { checks.push(`${mark(`${v} = ${show}`)}: ${mark(`${beautify(R)} = ${formatNumber(rVal)} < 0`)}, outside the domain — rejected`); continue; }
      if (!(sVal >= -1e-9)) { checks.push(`${mark(`${v} = ${show}`)}: the right side ${mark(`${beautify(S)} = ${formatNumber(sVal)}`)} is negative, but a square root cannot be — extraneous (it solves ${mark(`√(${beautify(R)}) = −(${beautify(S)})`)} instead) — rejected`); continue; }
      if (!satisfiesEquation(equation, v, c.numeric)) { checks.push(`${mark(`${v} = ${show}`)} does not balance the original equation — rejected`); continue; }
      checks.push(Number.isFinite(constantS)
        ? `${mark(`${v} = ${show}`)}: ${mark(`√(${formatNumber(rVal)}) = ${formatNumber(Math.sqrt(Math.max(rVal, 0)))}`)} — balances ✓`
        : `${mark(`${v} = ${show}`)}: ${mark(`√(${formatNumber(rVal)}) = ${formatNumber(Math.sqrt(Math.max(rVal, 0)))}`)} and ${mark(`${beautify(S)} = ${formatNumber(sVal)}`)} — balances ✓`);
      kept.push({ display: show, numeric: c.numeric });
    }
    steps.push(`Check each candidate in the original equation: ${checks.join('; ')}.`);
    const answer = kept.length > 0
      ? kept.map((c) => `${v} = ${c.display}`).join('  or  ')
      : 'No solution (every candidate is extraneous — introduced by squaring)';
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: kept.map((c) => c.numeric) };
  } catch {
    return null;
  }
}
