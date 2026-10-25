// Requests typed in words that ask for one thing about a function or an
// angle (October 2026 roadmap P3): its period, its amplitude, the equation of
// its tangent line at a point, its inverse, and an angle converted between
// degrees and radians. Each was refused as unreadable words.
//
// - Period: a sum of trig terms A·f(kx + c) with linear arguments. Each
//   term's period is 2π/|k| (π/|k| for tan and cot), and the sum repeats at
//   their least common multiple, found exactly as a multiple of π. Anything
//   else (sin(x)^2, sin(x²)) is refused: a smallest period is not decided
//   from sample values.
// - Amplitude: one sine or cosine wave A·sin(kx + c) + d is |A|; a·sin(kx) +
//   b·cos(kx) is one wave of amplitude √(a² + b²). tan has none.
// - Tangent line: y = f(a) + f′(a)(x − a), exact through Algebrite, the slope
//   checked against a difference quotient.
// - Inverse: y = f(x) solved for x by the algebra solver, the letters
//   swapped; refused when the solution has more than one branch (not
//   one-to-one). f(f⁻¹(x)) = x is checked at sample points.
// - Degrees ↔ radians: × π/180 or × 180/π, exact as a multiple of π when it
//   is one.
import { math, beautify, formatNumber, mark, linearCoefficients, loadAlgebrite, isAlgebriteFailure, sampleFunction } from './solverUtils.js';
import { unsupported as refusal } from '../solutionEnvelope.js';

// A refusal says why in its one step, with the maths marked (the envelope's
// default first step quotes the input as plain text).
const unsupported = (fields) => refusal({ ...fields, steps: [fields.reason] });

const TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot']);

// The value of a constant node, or null.
function constant(node) {
  try {
    const value = node.evaluate({});
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// The terms of a sum, each { sign, node }.
function sumTerms(node, sign = 1, out = []) {
  if (node.type === 'ParenthesisNode') return sumTerms(node.content, sign, out);
  if (node.type === 'OperatorNode' && node.fn === 'add') { sumTerms(node.args[0], sign, out); sumTerms(node.args[1], sign, out); return out; }
  if (node.type === 'OperatorNode' && node.fn === 'subtract') { sumTerms(node.args[0], sign, out); sumTerms(node.args[1], -sign, out); return out; }
  if (node.type === 'OperatorNode' && node.fn === 'unaryMinus') return sumTerms(node.args[0], -sign, out);
  out.push({ sign, node });
  return out;
}

// One term A·f(kx + c) (A a constant factor, f a trig function): { A, fn, k,
// c, arg }, or null. A constant term (no variable) is { constant }.
function trigTerm(node, variable, sign) {
  const value = constant(node);
  if (value !== null) return { constant: sign * value };
  let A = sign;
  let inner = node;
  while (inner.type === 'ParenthesisNode') inner = inner.content;
  if (inner.type === 'OperatorNode' && inner.fn === 'multiply') {
    const [a, b] = inner.args;
    const ca = constant(a);
    const cb = constant(b);
    if (ca !== null && cb === null) { A *= ca; inner = b; } else if (cb !== null && ca === null) { A *= cb; inner = a; } else return null;
  } else if (inner.type === 'OperatorNode' && inner.fn === 'divide') {
    const cb = constant(inner.args[1]);
    if (cb === null || cb === 0) return null;
    A /= cb;
    inner = inner.args[0];
  }
  while (inner.type === 'ParenthesisNode') inner = inner.content;
  if (inner.type !== 'FunctionNode' || !TRIG.has(inner.fn?.name) || inner.args.length !== 1) return null;
  const lin = linearCoefficients(inner.args[0].toString(), variable);
  if (!lin || lin.k === 0) return null;
  return { A, fn: inner.fn.name, k: lin.k, c: lin.d, arg: inner.args[0].toString() };
}

function trigTerms(expr, variable) {
  let node;
  try {
    node = math.parse(String(expr));
  } catch {
    return null;
  }
  const terms = sumTerms(node).map((t) => trigTerm(t.node, variable, t.sign));
  return terms.some((t) => t === null) ? null : terms;
}

// The least common multiple of the periods: each a rational multiple of the
// first (small denominators), else null (the sum never repeats).
function lcmOfPeriods(periods) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const ratios = [];
  for (const p of periods) {
    const r = p / periods[0];
    let found = null;
    for (let d = 1; d <= 60 && !found; d += 1) {
      const n = Math.round(r * d);
      if (n > 0 && Math.abs(r * d - n) < 1e-9) found = { n: n / gcd(n, d), d: d / gcd(n, d) };
    }
    if (!found) return null;
    ratios.push(found);
  }
  // lcm of n_i/d_i (each in lowest terms) = lcm(n_i)/gcd(d_i).
  const num = ratios.reduce((acc, f) => lcm(acc, f.n), 1);
  const den = ratios.reduce((acc, f) => gcd(acc, f.d), 0);
  return (periods[0] * num) / den;
}
// A number shown exactly: a rational multiple of π (2π/3), a fraction (1/2),
// else null.
function exactText(value) {
  const sign = value < 0 ? '-' : '';
  const r = fracText(Math.abs(value));
  if (/^\d+(?:\/\d+)?$/.test(r)) return `${sign}${r}`;
  const q = fracText(Math.abs(value) / Math.PI);
  if (/^\d+(?:\/\d+)?$/.test(q)) {
    const [n, d = '1'] = q.split('/');
    return `${sign}${piText(Number(n), Number(d))}`;
  }
  return null;
}
const lengthText = (value) => exactText(value) || `≈ ${formatNumber(value)}`;
const piText = (n, d) => `${n === 1 ? '' : n}π${d === 1 ? '' : `/${d}`}`;
const fnPeriodText = (fn) => (fn === 'tan' || fn === 'cot' ? 'π' : '2π');

export function periodOf(expr, variable) {
  const shown = show(expr);
  const terms = trigTerms(expr, variable);
  const waves = terms?.filter((t) => t.constant === undefined) || [];
  if (!terms || waves.length === 0) {
    return unsupported({
      input: `the period of ${shown}`,
      reason: `MasterMath states a period exactly for sums of sin, cos, tan, sec, csc and cot with linear arguments, such as ${mark('3sin(2x) + 1')} or ${mark('sin(x) + cos(3x)')}. The period of ${mark(shown)} is not one it can prove.`,
      answer: 'This period is beyond what this solver can state exactly',
      tips: [`A power of a trig function can have a smaller period than the function: ${mark('sin(x)^2 = (1 − cos(2x))/2')} repeats every ${mark('π')}. Rewrite it first.`],
    });
  }
  const steps = [];
  const periods = [];
  for (const t of waves) {
    const base = t.fn === 'tan' || t.fn === 'cot' ? Math.PI : 2 * Math.PI;
    const p = base / Math.abs(t.k);
    periods.push(p);
    const kText = exactText(Math.abs(t.k)) || formatNumber(Math.abs(t.k));
    const pText = lengthText(p);
    const division = Math.abs(t.k) === 1 ? pText : `${fnPeriodText(t.fn)}/${/[/π]/.test(kText) ? `(${kText})` : kText}${`${fnPeriodText(t.fn)}/${kText}` === pText ? '' : ` = ${pText}`}`;
    steps.push(`${mark(`${t.fn}(${show(t.arg)})`)}: ${mark(t.fn)} repeats every ${mark(fnPeriodText(t.fn))}, and the coefficient of ${mark(variable)} is ${mark(t.k < 0 ? `-${kText}` : kText)}, so its period is ${mark(division)}.`);
  }
  const period = lcmOfPeriods(periods);
  if (!period) {
    // Proven only when one period is a rational multiple of π and another
    // is rational: their ratio is then irrational, as π is.
    const kinds = periods.map((p) => exactText(p));
    const proven = kinds.every(Boolean) && kinds.some((k) => /π/.test(k)) && kinds.some((k) => !/π/.test(k));
    return unsupported({
      input: `the period of ${shown}`,
      reason: proven
        ? `The terms' periods, ${mark(kinds.join(' and '))}, have an irrational ratio (${mark('π')} is irrational): no length is a whole number of each, so ${mark(shown)} never repeats and is not periodic.`
        : `The terms' periods, ${mark(periods.map(lengthText).join(' and '))}, have no common multiple MasterMath can find exactly, so it cannot state a period.`,
      answer: proven ? 'Not periodic: the terms never line up again' : 'This period is beyond what this solver can state exactly',
    });
  }
  const periodText = lengthText(period);
  if (waves.length > 1) {
    steps.push(`A sum repeats when every term does: the least common multiple of the periods, ${mark(`lcm(${periods.map(lengthText).join(', ')}) = ${periodText}`)}.`);
  }
  if (terms.some((t) => t.constant !== undefined) || waves.some((t) => t.A !== 1 || t.c !== 0)) {
    steps.push('A constant added, a coefficient in front and a shift inside do not change the period.');
  }
  const answer = `The period is ${periodText}${/π/.test(periodText) ? ` (≈ ${formatNumber(period)})` : ''}`;
  steps.push(`So ${mark(shown)} repeats every ${mark(periodText)}.`);
  return {
    steps,
    answer,
    tips: [
      `${mark('sin(kx)')} and ${mark('cos(kx)')} repeat every ${mark('2π/k')}; ${mark('tan(kx)')} and ${mark('cot(kx)')} every ${mark('π/k')}.`,
      'Only the coefficient of x changes the period: the amplitude, a shift inside and a constant added do not.',
      'For a sum, find each period and take their least common multiple.',
    ],
    common_mistakes: [
      `Dividing by ${mark('k')} the wrong way: ${mark('sin(2x)')} repeats every ${mark('π')}, faster than ${mark('sin(x)')}, not every ${mark('4π')}.`,
      `Using ${mark('2π')} for tan: it repeats every ${mark('π')}.`,
      'Taking the largest period of a sum instead of the least common multiple.',
    ],
    graph: curveGraph(expr, variable, { initialWindow: { xMin: -period, xMax: 2 * period } }),
  };
}

export function amplitudeOf(expr, variable) {
  const shown = show(expr);
  const terms = trigTerms(expr, variable);
  const waves = terms?.filter((t) => t.constant === undefined) || [];
  const midline = (terms || []).filter((t) => t.constant !== undefined).reduce((s, t) => s + t.constant, 0);
  const refuse = (reason, answer) => unsupported({ input: `the amplitude of ${shown}`, reason, answer });
  if (!terms || waves.length === 0) return refuse(`Amplitude belongs to a sine or cosine wave, ${mark('A·sin(kx + c) + d')}; ${mark(shown)} is not one.`, 'This amplitude is beyond what this solver can state');
  if (waves.some((t) => !['sin', 'cos'].includes(t.fn))) return refuse(`${mark(waves.find((t) => !['sin', 'cos'].includes(t.fn)).fn)} grows without bound near its asymptotes, so it has no amplitude.`, 'No amplitude: the function is unbounded');
  const steps = [];
  let R;
  let Rtext;
  if (waves.length === 1) {
    const [t] = waves;
    R = Math.abs(t.A);
    Rtext = exactText(R) || formatNumber(R);
    steps.push(`${mark(shown)} is one ${t.fn === 'sin' ? 'sine' : 'cosine'} wave, ${mark(`A·${t.fn}(k${variable} + c) + d`)} with ${mark(`A = ${exactText(t.A) || formatNumber(t.A)}`)}.`);
    steps.push(`The amplitude is ${mark('|A|')}: the wave swings ${mark(Rtext)} above and below its midline ${mark(`y = ${exactText(midline) || formatNumber(midline)}`)}.`);
  } else if (waves.length === 2 && Math.abs(waves[0].k - waves[1].k) < 1e-12 && Math.abs(waves[0].c - waves[1].c) < 1e-12 && waves[0].fn !== waves[1].fn) {
    const a = waves.find((t) => t.fn === 'sin').A;
    const b = waves.find((t) => t.fn === 'cos').A;
    R = Math.hypot(a, b);
    const sq = a * a + b * b;
    const root = Math.round(Math.sqrt(sq));
    Rtext = root * root === sq ? String(root) : Number.isInteger(sq) ? `√${sq}` : formatNumber(R);
    steps.push(`${mark(`a·sin(θ) + b·cos(θ)`)} with the same ${mark('θ')} is one wave of amplitude ${mark('R = √(a^2 + b^2)')}.`);
    steps.push(`Here ${mark(`a = ${formatNumber(a)}`)} and ${mark(`b = ${formatNumber(b)}`)}, so ${mark(`R = √(${formatNumber(a * a)} + ${formatNumber(b * b)}) = ${Rtext}`)}.`);
  } else {
    return refuse(`${mark(shown)} adds waves of different frequencies; the result is not a single wave, so it has no single amplitude.`, 'No single amplitude: the waves have different frequencies');
  }
  return {
    steps,
    answer: `The amplitude is ${Rtext}${/√/.test(Rtext) ? ` (≈ ${formatNumber(R)})` : ''}`,
    tips: [
      `For ${mark('A·sin(kx + c) + d')}, the amplitude is ${mark('|A|')}, the period ${mark('2π/k')} and the midline ${mark('y = d')}.`,
      `The maximum is ${mark('d + |A|')} and the minimum ${mark('d − |A|')}.`,
      `${mark('a·sin(x) + b·cos(x)')} is one wave of amplitude ${mark('√(a^2 + b^2)')}.`,
    ],
    common_mistakes: [
      `Giving a negative amplitude: ${mark('−3sin(x)')} has amplitude ${mark('3')}, flipped.`,
      `Adding the constant: ${mark('2sin(x) + 5')} still has amplitude ${mark('2')}; the 5 moves the midline.`,
      `Adding the amplitudes of ${mark('3sin(x) + 4cos(x)')} to get 7: it is ${mark('5')}.`,
    ],
    graph: curveGraph(expr, variable),
  };
}

// A number as a fraction p/q (q ≤ 60) when it is one, else a decimal.
function fracText(value) {
  for (let q = 1; q <= 60; q += 1) {
    const p = Math.round(value * q);
    if (Math.abs(value * q - p) < 1e-9) return q === 1 ? String(p) : `${p}/${q}`;
  }
  return formatNumber(value);
}

// Engine syntax → what a student reads: √, ∛, π, ln, log_b, e^, x/4 for 1/4*x.
function show(text) {
  return beautify(String(text))
    .replace(/(?<![a-z])exp\(-1\)\*([a-z])(?![a-z(])/g, '$1/e')
    .replace(/(?<![a-z])exp\(-1\)/g, '1/e')
    .replace(/(?<![a-z])exp\(1\)/g, 'e')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s\*\s/g, '*')
    .replace(/(?<![a-z])([a-z])\^\(1\/2\)/g, '√$1')
    .replace(/(?<![a-z])log\(((?:[^(),]|\([^()]*\))+),\s*([\w.]+)\)/g, (m, arg, base) => (base === '10' ? `log(${arg})` : `log_${base}(${arg})`))
    .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
    .replace(/(?<![a-z])exp\(((?:[^()]|\([^()]*\))+)\)/g, 'e^($1)')
    .replace(/(?<![a-z])sqrt\(/g, '√(')
    .replace(/(?<![a-z])cbrt\(/g, '∛(')
    .replace(/√\(([a-z]|\d+)\)/g, '√$1')
    .replace(/(?<![a-z])pi(?![a-z])/g, 'π')
    .replace(/(?<![\w.^/])(\d+)\/(\d+)\*?([a-z])(?![a-z(^])/g, (m, p, q, v) => (p === '1' ? `${v}/${q}` : `${p}${v}/${q}`));
}

// Exact value of an Algebrite expression at variable = a.
function exactAt(Algebrite, expr, variable, a) {
  const raw = String(Algebrite.run(`simplify(subst((${a}), ${variable}, ${expr}))`)).trim();
  if (!raw || isAlgebriteFailure(raw) || /nil|stop/i.test(raw)) return null;
  return raw;
}
const fromAlgebrite = (t) => String(t).replace(/(?<![a-z])log\(/g, 'ln(');

// The function's own graph (and a second curve), re-sampled by the viewer.
function curveGraph(expr, variable, extra = {}) {
  const points = sampleFunction(String(expr), variable, { min: -20, max: 20, step: 0.25 });
  if (points.length === 0) return null;
  return { points, expression: String(expr), variable, title: `Graph of f(${variable}) = ${show(expr)}`, ...extra };
}

export async function tangentLine(expr, variable, pointText, givenY = null) {
  const shown = show(expr);
  const at = show(pointText);
  const f = (x) => math.evaluate(String(expr), { [variable]: x });
  let a;
  try {
    a = math.evaluate(String(pointText));
  } catch {
    a = NaN;
  }
  const refuse = (reason) => unsupported({ input: `the tangent line to ${shown} at ${variable} = ${at}`, reason, answer: 'This tangent line is beyond what this solver can compute' });
  if (typeof a !== 'number' || !Number.isFinite(a)) return refuse(`${mark(at)} is not a number.`);
  let y0;
  try {
    y0 = f(a);
  } catch {
    y0 = NaN;
  }
  if (typeof y0 !== 'number' || !Number.isFinite(y0)) return refuse(`${mark(`f(${at})`)} is not defined, so the curve has no point there.`);
  if (givenY !== null) {
    let b;
    try {
      b = math.evaluate(String(givenY));
    } catch {
      b = NaN;
    }
    if (!(Math.abs(b - y0) <= 1e-9 * (1 + Math.abs(y0)))) return refuse(`The point ${mark(`(${at}, ${show(givenY)})`)} is not on the curve: ${mark(`f(${at}) = ${formatNumber(y0)}`)}.`);
  }
  // Differentiable there: the slopes from the left and the right agree.
  const h = 1e-6;
  const left = (y0 - f(a - h)) / h;
  const right = (f(a + h) - y0) / h;
  if (![left, right].every(Number.isFinite) || Math.abs(left - right) > 1e-3 * (1 + Math.abs(left))) {
    return refuse(`The curve has no single slope at ${mark(`${variable} = ${at}`)}: the slope from the left (about ${mark(formatNumber(left))}) and from the right (about ${mark(formatNumber(right))}) differ, so there is no tangent line there.`);
  }
  const Algebrite = await loadAlgebrite();
  const algebriteExpr = String(expr).replace(/(?<![a-z])ln\(/g, 'log(');
  const derivative = String(Algebrite.run(`d(${algebriteExpr}, ${variable})`)).trim();
  const slopeRaw = exactAt(Algebrite, derivative, variable, pointText);
  const valueRaw = exactAt(Algebrite, algebriteExpr, variable, pointText);
  if (isAlgebriteFailure(derivative) || !slopeRaw || !valueRaw) return refuse('The derivative could not be evaluated exactly at that point.');
  let m;
  try {
    m = math.evaluate(fromAlgebrite(slopeRaw));
  } catch {
    m = NaN;
  }
  // The exact slope must agree with the difference quotient.
  if (typeof m !== 'number' || !Number.isFinite(m) || Math.abs(m - (left + right) / 2) > 1e-3 * (1 + Math.abs(m))) return refuse('The exact slope could not be confirmed numerically.');
  const line = String(Algebrite.run(`expand((${slopeRaw})*(${variable} - (${pointText})) + (${valueRaw}))`)).trim();
  const yv = show(fromAlgebrite(valueRaw));
  const mv = show(fromAlgebrite(slopeRaw));
  const lineShown = show(fromAlgebrite(line));
  const xa = /^-/.test(at) ? `${variable} + ${at.slice(1)}` : `${variable} − ${at}`;
  const ya = yv === '0' ? 'y' : /^-/.test(yv) ? `y + ${yv.slice(1)}` : `y − ${/[+-]/.test(yv) ? `(${yv})` : yv}`;
  const mFactor = mv === '1' ? '' : mv === '-1' ? '−' : /[+/-]/.test(mv.slice(1)) ? `(${mv})` : mv;
  return {
    steps: [
      `The point: ${mark(`f(${at}) = ${yv}`)}, so the line passes through ${mark(`(${at}, ${yv})`)}.`,
      `The slope is the derivative there: ${mark(`f′(${variable}) = ${show(fromAlgebrite(derivative))}`)}, so ${mark(`m = f′(${at}) = ${mv}`)}.`,
      `Point–slope form, ${mark('y − f(a) = f′(a)(x − a)')}: ${mark(`${ya} = ${mFactor}(${xa})`)}.`,
      `Solve for ${mark('y')}: ${mark(`y = ${lineShown}`)}.`,
    ],
    answer: `y = ${lineShown}`,
    tips: [
      `The tangent line at ${mark('x = a')} passes through ${mark('(a, f(a))')} with slope ${mark('f′(a)')}: ${mark('y − f(a) = f′(a)(x − a)')}.`,
      `Find the point first, then the slope; both use the same ${mark('a')}.`,
      `The normal line is perpendicular to it: its slope is ${mark('−1/f′(a)')}.`,
    ],
    common_mistakes: [
      `Using ${mark('f′(x)')} (a function) as the slope instead of the number ${mark('f′(a)')}.`,
      `Forgetting ${mark('f(a)')}: the line must pass through the point on the curve.`,
      `A sign slip in ${mark('(x − a)')} when ${mark('a')} is negative.`,
    ],
    graph: {
      // The viewer re-samples both curves; points is the first frame.
      points: sampleFunction(String(expr), variable, { min: a - 10, max: a + 10, step: 0.25 }),
      expression: String(expr),
      secondaryExpression: fromAlgebrite(line),
      variable,
      secondaryLabel: `y = ${lineShown}`,
      initialWindow: { xMin: a - 4, xMax: a + 4 },
      sharedAxis: true,
      title: `Graph of f(${variable}) = ${shown} and its tangent at ${variable} = ${at}`,
      description: `Indigo: f(${variable}) = ${shown}  |  Green: the tangent line y = ${lineShown}`,
      annotations: { tangentPoint: { x: a, y: y0, label: `(${at}, ${yv})` } },
    },
  };
}

// Undo the operations on the variable one at a time, the last one first
// (y = 2x + 3: subtract 3, then divide by 2). Works when the variable
// appears once; throws { reason } when a step has no inverse (an even
// power, a trig function, an absolute value).
const hasVar = (node, v) => node.filter((n) => n.type === 'SymbolNode' && n.name === v).length > 0;
const wrap = (t) => (/^[\w.]+$/.test(t) ? t : `(${t})`);
class NoInverse extends Error {}

function peel(node, target, v, y, steps, conditions) {
  while (node.type === 'ParenthesisNode') node = node.content;
  if (node.type === 'SymbolNode' && node.name === v) return target;
  const S = (n) => n.toString();
  let inner;
  let next;
  let verb;
  if (node.type === 'OperatorNode' && node.args.length === 1 && node.fn === 'unaryMinus') {
    [inner] = node.args;
    next = `-${wrap(target)}`;
    verb = `Multiply by ${mark('−1')}`;
  } else if (node.type === 'OperatorNode' && node.args.length === 2) {
    const [a, b] = node.args;
    const inA = hasVar(a, v);
    const inB = hasVar(b, v);
    if (inA && inB) throw new NoInverse('both');
    const c = inA ? b : a;
    inner = inA ? a : b;
    if (node.fn === 'add') {
      next = `${target} - ${wrap(S(c))}`;
      verb = `Subtract ${mark(show(S(c)))}`;
    } else if (node.fn === 'subtract') {
      next = inA ? `${target} + ${wrap(S(b))}` : `${wrap(S(a))} - ${wrap(target)}`;
      verb = inA ? `Add ${mark(show(S(b)))}` : `Rearrange (${mark(`a − u = ${y}`)} gives ${mark(`u = a − ${y}`)})`;
    } else if (node.fn === 'multiply') {
      next = `${wrap(target)}/${wrap(S(c))}`;
      verb = `Divide by ${mark(show(S(c)))}`;
    } else if (node.fn === 'divide' && inA) {
      // log(u)/log(b) is log base b of u (the parser's form of log_b and log).
      if (a.type === 'FunctionNode' && a.fn?.name === 'log' && a.args.length === 1 && b.type === 'FunctionNode' && b.fn?.name === 'log' && constant(b.args[0]) !== null) {
        const base = S(b.args[0]);
        [inner] = a.args;
        next = `${base}^${wrap(target)}`;
        verb = `Raise ${mark(base)} to each side (a logarithm base ${mark(base)} is undone by a power of ${mark(base)})`;
      } else {
        next = `${wrap(target)}*${wrap(S(b))}`;
        verb = `Multiply by ${mark(show(S(b)))}`;
      }
    } else if (node.fn === 'divide') {
      next = `${wrap(S(a))}/${wrap(target)}`;
      verb = `Take reciprocals (${mark(`a/u = ${y}`)} gives ${mark(`u = a/${y}`)})`;
    } else if (node.fn === 'pow' && inA) {
      const n = constant(b);
      if (n === null || n === 0) throw new NoInverse('power');
      if (Number.isInteger(n) && n % 2 === 0) throw new NoInverse(`an even power: ${mark(`(−2)^${n}`)} and ${mark(`2^${n}`)} are equal, so two inputs give one output`);
      if (n === 3) {
        next = `cbrt(${target})`;
        verb = 'Take the cube root';
      } else if (n === 0.5) {
        next = `${wrap(target)}^2`;
        verb = 'Square both sides';
        conditions.push(target);
      } else {
        next = `${wrap(target)}^(${fracText(1 / n)})`;
        verb = `Raise to the power ${mark(fracText(1 / n))}`;
        if (!Number.isInteger(n)) conditions.push(target);
      }
    } else if (node.fn === 'pow') {
      const base = constant(a);
      if (base === null || base <= 0 || base === 1) throw new NoInverse('power');
      if (a.type === 'SymbolNode' && a.name === 'e') {
        next = `ln(${target})`;
        verb = `Take ${mark('ln')} of both sides`;
      } else {
        next = `log(${target}, ${S(a)})`;
        verb = `Take ${mark(`log_${S(a)}`)} of both sides`;
      }
    } else {
      throw new NoInverse('operation');
    }
  } else if (node.type === 'FunctionNode' && node.args.length >= 1) {
    const name = node.fn?.name;
    [inner] = node.args;
    if (name === 'sqrt') {
      next = `${wrap(target)}^2`;
      verb = `Square both sides (a square root is never negative, so ${mark(`${show(target)} ≥ 0`)})`;
      conditions.push(target);
    } else if (name === 'cbrt') {
      next = `${wrap(target)}^3`;
      verb = 'Cube both sides';
    } else if (name === 'exp') {
      next = `ln(${target})`;
      verb = `Take ${mark('ln')} of both sides`;
    } else if ((name === 'ln' || name === 'log') && node.args.length === 1) {
      next = `e^${wrap(target)}`;
      verb = `Raise ${mark('e')} to each side (${mark('ln')} is undone by ${mark('e^')})`;
    } else if (name === 'log' && node.args.length === 2 && constant(node.args[1]) !== null) {
      const base = S(node.args[1]);
      next = `${base}^${wrap(target)}`;
      verb = `Raise ${mark(base)} to each side`;
    } else if (name === 'log10' || name === 'log2') {
      const base = name.slice(3);
      next = `${base}^${wrap(target)}`;
      verb = `Raise ${mark(base)} to each side`;
    } else if (TRIG.has(name)) {
      throw new NoInverse(`${mark(name)}, a periodic function that takes each of its values infinitely often. ${mark(`arc${name}`)} undoes it only on a restricted interval (${mark('arcsin')} undoes ${mark('sin')} on ${mark('[−π/2, π/2]')})`);
    } else if (name === 'abs') {
      throw new NoInverse(`an absolute value: ${mark('|−2| = |2|')}, so two inputs give one output`);
    } else {
      throw new NoInverse('operation');
    }
  } else {
    throw new NoInverse('operation');
  }
  while (inner.type === 'ParenthesisNode') inner = inner.content;
  steps.push(`${verb}: ${mark(`${show(S(inner))} = ${show(next)}`)}.`);
  return peel(inner, next, v, y, steps, conditions);
}

// y = (ax + b)/(cx + d) → x = (b − dy)/(cy − a), the variable appearing twice.
function invertMobius(node, v, y, steps) {
  while (node.type === 'ParenthesisNode') node = node.content;
  if (node.type !== 'OperatorNode' || node.fn !== 'divide') return null;
  const num = linearCoefficients(node.args[0].toString(), v);
  const den = linearCoefficients(node.args[1].toString(), v);
  if (!num || !den || den.k === 0) return null;
  const { k: a, d: b } = num;
  const { k: c, d } = den;
  if (Math.abs(a * d - b * c) < 1e-12) throw new NoInverse(`a constant (the ${mark(v)} cancels), so every input gives the same output`);
  const lin = (p, q, letter) => {
    const pText = p === 1 ? letter : p === -1 ? `-${letter}` : `${fracText(p)}*${letter}`;
    return q === 0 ? pText : `${pText} ${q < 0 ? '-' : '+'} ${fracText(Math.abs(q))}`;
  };
  const top = lin(-d, b, y);
  const bottom = lin(c, -a, y);
  const bare = (n) => show((n.type === 'ParenthesisNode' ? n.content : n).toString());
  steps.push(`Multiply both sides by ${mark(`(${bare(node.args[1])})`)}: ${mark(`${y}(${bare(node.args[1])}) = ${bare(node.args[0])}`)}.`);
  steps.push(`Collect the ${mark(v)} terms on one side: ${mark(`${v}(${show(bottom)}) = ${show(top)}`)}.`);
  const result = `(${top})/(${bottom})`;
  steps.push(`Divide: ${mark(`${v} = ${show(result)}`)}.`);
  return result;
}

// The condition target ≥ 0 a square root imposes, said about the inverse's
// input after the swap: "x ≥ 2" when it is linear, else as it stands.
function domainNote(conditions, v, y) {
  const swapLetters = (t) => t.replace(new RegExp(`(?<![a-z])${y}(?![a-z])`, 'g'), v);
  return conditions.map((t) => {
    const swapped = swapLetters(t);
    const lin = linearCoefficients(swapped, v);
    if (lin && lin.k !== 0) return `${v} ${lin.k > 0 ? '≥' : '≤'} ${show(fracText(-lin.d / lin.k))}`;
    return `${show(swapped)} ≥ 0`;
  })[0] || null;
}

export async function inverseOf(expr, variable, solveAlgebra) {
  const shown = show(expr);
  const refuse = (reason, answer = 'This inverse is beyond what this solver can find') => unsupported({ input: `the inverse of ${shown}`, reason, answer });
  const y = variable === 'y' ? 'u' : 'y';
  let node;
  try {
    node = math.parse(String(expr));
  } catch {
    return refuse(`${mark(shown)} could not be read.`);
  }
  if (!hasVar(node, variable)) return refuse(`${mark(shown)} is a constant: every input gives the same output, so it has no inverse.`, 'No inverse: the function is constant');
  const steps = [`Write ${mark(`${y} = ${shown}`)} and solve for ${mark(variable)}.`];
  const conditions = [];
  let solvedFor = null;
  let method = 'peel';
  try {
    const once = node.filter((n) => n.type === 'SymbolNode' && n.name === variable).length === 1;
    if (once) {
      steps.push(`${mark(variable)} appears once, so undo what is done to it, the last operation first.`);
      solvedFor = peel(node, y, variable, y, steps, conditions);
    } else {
      solvedFor = invertMobius(node, variable, y, steps);
      method = 'mobius';
    }
  } catch (error) {
    if (error instanceof NoInverse && !['both', 'operation', 'power'].includes(error.message)) {
      return refuse(`${mark(shown)} is not one-to-one: it contains ${error.message}. A function has an inverse only when each output comes from exactly one input.`, 'No inverse: the function is not one-to-one');
    }
    solvedFor = null;
  }
  if (!solvedFor) {
    // A polynomial in which the variable appears more than once: the
    // algebra solver's rearrangement, refused when it branches.
    const solved = await solveAlgebra(`${y} = ${expr}`, { solveFor: variable });
    const m = String(solved?.answer || '').match(new RegExp(`^${variable} = (.+)$`));
    if (!m) return refuse(`${mark(`${y} = ${shown}`)} could not be solved for ${mark(variable)}.`);
    if (/±|\bor\b/.test(m[1])) {
      return refuse(`${mark(shown)} is not one-to-one: solving ${mark(`${y} = ${shown}`)} gives ${mark(`${variable} = ${m[1]}`)}, more than one ${mark(variable)} for a ${mark(y)}. It has an inverse only on a restricted domain.`, 'No inverse: the function is not one-to-one');
    }
    if (/\^\(\d+\/\d+\)|∛\(.*[+-]/.test(m[1])) {
      return refuse(`Solving ${mark(`${y} = ${shown}`)} for ${mark(variable)} needs the general cubic formula, which gives no readable inverse. MasterMath inverts functions in which ${mark(variable)} appears once, such as ${mark('2x + 3')} or ${mark('e^(x - 1)')}, and ${mark('(ax + b)/(cx + d)')}.`);
    }
    solvedFor = m[1].replace(/√\(/g, 'sqrt(').replace(/∛\(/g, 'cbrt(').replace(/·/g, '*');
    steps.push(`Rearrange: ${mark(`${variable} = ${show(solvedFor)}`)}.`);
    method = 'rearrange';
  }
  const swap = (t) => t.replace(new RegExp(`(?<![a-z])${y}(?![a-z])`, 'g'), '\u0000').replace(new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'g'), y).replace(/\u0000/g, variable);
  const inverse = swap(solvedFor);
  const restriction = domainNote(conditions, variable, y);
  // f(f⁻¹(x)) = x at sample points: the inverse is checked, not trusted.
  let checked = 0;
  for (const x of [-2.7, -1.3, 0.4, 1.9, 3.3, 5.1, 8.6]) {
    let back;
    try {
      const gx = math.evaluate(inverse, { [variable]: x });
      back = typeof gx === 'number' && Number.isFinite(gx) ? math.evaluate(String(expr), { [variable]: gx }) : NaN;
    } catch {
      continue;
    }
    if (typeof back !== 'number' || !Number.isFinite(back)) continue;
    if (restriction && conditions.length && math.evaluate(swap(conditions[0]), { [variable]: x }) < 0) continue;
    if (Math.abs(back - x) > 1e-7 * (1 + Math.abs(x))) return refuse(`The candidate ${mark(show(inverse))} does not undo ${mark(shown)}.`);
    checked += 1;
  }
  if (checked < 2) return refuse(`The candidate ${mark(show(inverse))} could not be checked.`);
  const answerText = `f⁻¹(${variable}) = ${show(inverse)}${restriction ? `, for ${restriction}` : ''}`;
  steps.push(`Swap ${mark(variable)} and ${mark(y)}, so the inverse is a function of ${mark(variable)}: ${mark(`f⁻¹(${variable}) = ${show(inverse)}`)}${restriction ? `, for ${mark(restriction)} (the outputs of ${mark(shown)})` : ''}.`);
  steps.push(`Check: ${mark(`f(f⁻¹(${variable})) = ${variable}`)} at sample values ✓`);
  const tips = [
    `To invert: write ${mark('y = f(x)')}, solve for ${mark('x')}, then swap ${mark('x')} and ${mark('y')}.`,
    `The inverse undoes the function: ${mark('f(f⁻¹(x)) = x')} and ${mark('f⁻¹(f(x)) = x')}.`,
    `The graph of ${mark('f⁻¹')} is the graph of ${mark('f')} reflected in the line ${mark('y = x')}.`,
  ];
  if (method === 'mobius') tips.unshift(`When ${mark('x')} appears on top and bottom, multiply out the fraction and collect the ${mark('x')} terms before dividing.`);
  if (restriction) tips.unshift(`The domain of ${mark('f⁻¹')} is the range of ${mark('f')}: a square root never gives a negative output, so the inverse is defined only for ${mark(restriction)}.`);
  return {
    steps,
    answer: answerText,
    tips,
    common_mistakes: [
      `Reading ${mark('f⁻¹(x)')} as ${mark('1/f(x)')}: it is the inverse function, not the reciprocal.`,
      `Forgetting to swap ${mark('x')} and ${mark('y')} at the end.`,
      `Inverting a function that is not one-to-one, such as ${mark('x^2')}, without restricting its domain.`,
    ],
    // f and f⁻¹: mirror images in the line y = x.
    graph: curveGraph(expr, variable, {
      secondaryExpression: restriction && conditions.length ? `${inverse} + 0 * sqrt(${swap(conditions[0])})` : inverse,
      secondaryLabel: `f⁻¹(${variable}) = ${show(inverse)}`,
      initialWindow: { xMin: -8, xMax: 8 },
      sharedAxis: true,
      title: `Graph of f(${variable}) = ${shown} and its inverse`,
      description: `Indigo: f(${variable}) = ${shown}  |  Green: f⁻¹(${variable}) = ${show(inverse)}, its mirror image in the line y = ${variable}`,
    }),
  };
}

// An angle in radians as an exact multiple of π when the degrees are a
// fraction: 50° = 5π/18. Else null.
function piMultiple(degrees) {
  const q = fracText(Math.abs(degrees));
  const m = q.match(/^(\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  let n = Number(m[1]);
  let d = Number(m[2] || 1) * 180;
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return n === 0 ? '0' : `${degrees < 0 ? '-' : ''}${piText(n, d)}`;
}

export function convertAngle(valueText, from) {
  let value;
  try {
    value = math.evaluate(String(valueText).replace(/π/g, 'pi'));
  } catch {
    value = NaN;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return unsupported({ input: `${valueText} ${from}`, reason: `${mark(String(valueText))} is not a number.`, answer: 'This angle could not be read' });
  }
  const shownIn = show(String(valueText));
  if (from === 'degrees') {
    const rad = (value * Math.PI) / 180;
    const exact = piMultiple(value);
    const result = exact ? `${exact}${exact === '0' ? '' : ` (≈ ${formatNumber(rad)})`}` : `≈ ${formatNumber(rad)}`;
    return {
      steps: [
        `${mark('180° = π')} radians, so multiply by ${mark('π/180')}.`,
        exact ? `${mark(`${shownIn} × π/180 = ${exact}`)}${exact === '0' ? '' : ` (≈ ${formatNumber(rad)})`}.` : `${mark(`${shownIn} × π/180 ≈ ${formatNumber(rad)}`)}.`,
      ],
      answer: `${shownIn}° ${exact ? '=' : '≈'} ${exact ? result : formatNumber(rad)} radians`,
      tips: [`Degrees to radians: × ${mark('π/180')}. Radians to degrees: × ${mark('180/π')}.`, `Worth knowing: ${mark('30° = π/6')}, ${mark('45° = π/4')}, ${mark('60° = π/3')}, ${mark('90° = π/2')}.`],
      common_mistakes: [`Multiplying by ${mark('180/π')} instead: the result in radians should be smaller than the degrees.`],
      graph: null,
    };
  }
  const deg = (value * 180) / Math.PI;
  const exactDeg = /pi|π/.test(String(valueText)) ? exactText(deg) : null;
  const exact = exactDeg && !/π/.test(exactDeg) ? exactDeg : null;
  const unit = value === 1 ? 'radian' : 'radians';
  return {
    steps: [
      `${mark('π')} radians ${mark('= 180°')}, so multiply by ${mark('180/π')}.`,
      exact
        ? `${mark(`${shownIn} × 180/π = ${exact}°`)}: the ${mark('π')} cancels${/\//.test(exact) ? ` (≈ ${formatNumber(deg)}°)` : ''}.`
        : `${mark(`${shownIn} × 180/π ≈ ${formatNumber(deg)}°`)}: there is no ${mark('π')} to cancel, so the degrees are a decimal.`,
    ],
    answer: exact ? `${shownIn} ${unit} = ${/\//.test(exact) ? `(${exact})° (≈ ${formatNumber(deg)}°)` : `${exact}°`}` : `${shownIn} ${unit} ≈ ${formatNumber(deg)}°`,
    tips: [`Radians to degrees: × ${mark('180/π')}. Degrees to radians: × ${mark('π/180')}.`, `One radian is about ${mark('57.3°')}: the angle whose arc equals the radius.`],
    common_mistakes: [`Multiplying by ${mark('π/180')} instead: the result in degrees should be larger than the radians.`],
    graph: null,
  };
}
