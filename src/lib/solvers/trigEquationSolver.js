// Trigonometric equations of the form  A·f(k·x) + B = C  for f ∈ {sin, cos, tan}.
//
// This is deliberately a small, honest solver. It handles the family students
// actually meet first — sin(x) = 1/2, 2cos(x) - 1 = 0, tan(2x) = 1, √3 = 2sin(x)
// — with exact special angles, the full general solution, and the solutions
// on [0, 2π). Anything outside that family (two different trig functions,
// squared functions, non-linear arguments) is refused with an explicit
// "not supported yet", never mis-solved.
//
// Why a dedicated solver at all: an equation handed to the expression
// evaluator is a hazard. mathjs reads "sin(x) = 1/2" as a *definition* of a
// function called sin and hands back the function object; the previous code
// stringified it and displayed minified JavaScript as the final answer.

import { math, formatNumber, beautify } from './solverUtils.js';
import { parseMathExpression } from '../mathParser.js';
import { unsupported, undefinedValue } from '../solutionEnvelope.js';
import { getSettings } from '../settings.js';

const TWO_PI = 2 * Math.PI;

// Display unit for angles. Solving is always done in radians; when the
// Settings angle unit is degrees, every angle shown — reference angle,
// general solution, the one-period listing, the graph's x-axis — is
// converted on the way out. Set per call by solveTrigEquation (the solver
// is synchronous, so a module flag is safe).
let DEGREES = false;
const PERIOD_FULL = () => (DEGREES ? '360°' : '2π');
const PERIOD_HALF = () => (DEGREES ? '180°' : 'π');
const RANGE_TEXT = () => (DEGREES ? '[0°, 360°)' : '[0, 2π)');

// Special values, exact strings first. Matched by tolerance so that both
// "1/2" and "0.5" and "sqrt(3)/2" resolve to the same angle.
const SPECIAL = {
  sin: [
    { value: 0, angle: '0', rad: 0 },
    { value: 1 / 2, angle: 'π/6', rad: Math.PI / 6 },
    { value: Math.SQRT1_2, angle: 'π/4', rad: Math.PI / 4 },
    { value: Math.sqrt(3) / 2, angle: 'π/3', rad: Math.PI / 3 },
    { value: 1, angle: 'π/2', rad: Math.PI / 2 },
  ],
  cos: [
    { value: 1, angle: '0', rad: 0 },
    { value: Math.sqrt(3) / 2, angle: 'π/6', rad: Math.PI / 6 },
    { value: Math.SQRT1_2, angle: 'π/4', rad: Math.PI / 4 },
    { value: 1 / 2, angle: 'π/3', rad: Math.PI / 3 },
    { value: 0, angle: 'π/2', rad: Math.PI / 2 },
  ],
  tan: [
    { value: 0, angle: '0', rad: 0 },
    { value: 1 / Math.sqrt(3), angle: 'π/6', rad: Math.PI / 6 },
    { value: 1, angle: 'π/4', rad: Math.PI / 4 },
    { value: Math.sqrt(3), angle: 'π/3', rad: Math.PI / 3 },
  ],
};

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Exact display for the isolated value c when it is a special constant, so
// the steps read "sin(x) = √3/2" rather than "sin(x) = 0.866".
const EXACT_VALUES = [
  { value: 0, text: '0' },
  { value: 1 / 2, text: '1/2' },
  { value: Math.SQRT1_2, text: '√2/2' },
  { value: Math.sqrt(3) / 2, text: '√3/2' },
  { value: 1, text: '1' },
  { value: 1 / Math.sqrt(3), text: '√3/3' },
  { value: Math.sqrt(3), text: '√3' },
];
function fmtValue(c) {
  const hit = EXACT_VALUES.find((e) => near(e.value, Math.abs(c)));
  if (hit) return c < 0 && hit.value !== 0 ? `-${hit.text}` : hit.text;
  return formatNumber(c);
}

// Two solution families {base, period} that are really one — the same
// angle mod period, or offset by exactly half a period — collapse to a single
// family, so sin(x) = 0 reads "x = πn" rather than "x = 0 + 2πn or x = π + 2πn".
function mergeFamilies(families) {
  if (families.length !== 2) return families;
  const [f, g] = families;
  if (!near(f.period, g.period)) return families;
  const diff = ((g.base - f.base) % f.period + f.period) % f.period;
  if (near(diff, 0) || near(diff, f.period)) return [f];
  if (near(diff, f.period / 2)) return [{ base: f.base, period: f.period / 2 }];
  return families;
}

// "base + period·n" as text, with the trivial cases tidied.
function familyText(variable, base, period) {
  const per = near(period, TWO_PI) ? PERIOD_FULL() : near(period, Math.PI) ? PERIOD_HALF() : fmtRad(period);
  const b = fmtRad(base);
  if (b === '0') return `${variable} = ${per}n`;
  return `${variable} = ${b} + ${per}n`;
}

// Exact display of a special angle, or a rounded decimal (radians).
function principalAngle(fn, c) {
  const abs = Math.abs(c);
  const hit = SPECIAL[fn].find((s) => near(s.value, abs));
  if (fn === 'sin' || fn === 'tan') {
    // odd functions: negative value → negative angle
    if (hit) return { exact: fmtRad(c < 0 ? -hit.rad : hit.rad), rad: c < 0 ? -hit.rad : hit.rad, isExact: true };
    const rad = fn === 'sin' ? Math.asin(c) : Math.atan(c);
    return { exact: fmtRad(rad), rad, isExact: false };
  }
  // cos: arccos(-v) = π - arccos(v)
  if (hit) {
    if (c >= 0 || hit.rad === Math.PI / 2) return { exact: fmtRad(hit.rad), rad: hit.rad, isExact: true };
    const rad = Math.PI - hit.rad;
    return { exact: fmtRad(rad), rad, isExact: true };
  }
  const rad = Math.acos(c);
  return { exact: fmtRad(rad), rad, isExact: false };
}

// Format an angle (held in radians) for display: in degrees mode as N°; in
// radians mode as an exact multiple of π when it is one, else a decimal.
function fmtRad(rad) {
  if (DEGREES) {
    const deg = rad * 180 / Math.PI;
    // Snap the special angles so π/6 reads 30°, not 29.9999°.
    const snapped = Math.abs(deg - Math.round(deg)) < 1e-6 ? Math.round(deg) : deg;
    return `${formatNumber(snapped)}°`;
  }
  const ratio = rad / Math.PI;
  // Denominators that arise from halving/thirding standard angles: tan(2x)=1
  // has solutions at π/8; sin(3x)=½ at π/18. Ordered so the simplest form wins.
  const dens = [1, 2, 3, 4, 6, 8, 12, 5, 10, 9, 18, 16, 24];
  for (const d of dens) {
    const n = ratio * d;
    if (near(n, Math.round(n))) {
      const k = Math.round(n);
      if (k === 0) return '0';
      const num = Math.abs(k) === 1 ? '' : Math.abs(k);
      const sign = k < 0 ? '-' : '';
      return d === 1 ? `${sign}${num}π` : `${sign}${num}π/${d}`;
    }
  }
  return formatNumber(rad);
}

// Parse  A·f(k·x) + B = C  by treating f(kx) as an unknown u and checking the
// equation is linear in u. Returns null if it isn't in the family.
function parseTrigEquation(equation, variable) {
  const [lhs, rhs] = equation.split('=').map((s) => s.trim());
  if (!lhs || !rhs) return null;

  const expr = `(${lhs}) - (${rhs})`;
  const calls = [...expr.matchAll(/\b(sin|cos|tan)\s*\(([^()]*)\)/g)];
  if (calls.length === 0) return null;
  const fn = calls[0][1];
  const arg = calls[0][2].trim();
  // Every trig call must be the same function of the same argument.
  if (!calls.every((c) => c[1] === fn && c[2].trim() === arg)) return null;
  // Any other trig function present (sec, arcsin, ...) → out of family.
  if (/\b(sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh)\b/.test(expr)) return null;

  // Argument must be k·x (k numeric, possibly a fraction) or bare x.
  let k = 1;
  if (arg !== variable) {
    const m = arg.match(new RegExp(`^\\(?\\s*([0-9.]+(?:\\s*/\\s*[0-9.]+)?)\\s*\\*?\\s*${variable}\\s*\\)?$`))
      || arg.match(new RegExp(`^${variable}\\s*/\\s*([0-9.]+)$`));
    if (!m) return null;
    k = arg.startsWith(variable) ? 1 / Number(m[1]) : math.evaluate(m[1]);
    if (!Number.isFinite(k) || k === 0) return null;
  }

  // Replace f(arg) with u and test linearity in u.
  const inU = expr.replace(new RegExp(`\\b${fn}\\s*\\(\\s*${arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`, 'g'), '(u)');
  // The variable must not appear outside the trig call.
  if (new RegExp(`\\b${variable}\\b`).test(inU)) return null;
  let g0, g1, g2;
  try {
    g0 = math.evaluate(inU, { u: 0 });
    g1 = math.evaluate(inU, { u: 1 });
    g2 = math.evaluate(inU, { u: 2 });
  } catch {
    return null;
  }
  if (![g0, g1, g2].every(Number.isFinite)) return null;
  const a = g1 - g0;
  if (!near(g2 - g1, a)) return null; // not linear in u (e.g. sin²x)
  if (Math.abs(a) < EPS) return null;  // trig term cancels
  const c = -g0 / a;                    // f(kx) = c
  return { fn, arg, k, c, a, b: g0 };
}

// Escape a string for use inside a RegExp.
const rx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Beyond the linear family, three shapes reduce to it:
//   quadratic in one function   2sin²x − sin x − 1 = 0   → u = 1 or u = −1/2
//   a·sin + b·cos = 0           sin x = cos x           → tan x = 1
//   Pythagorean rewrite         sin²x + cos x = 1       → 1 − cos²x + cos x = 1
// Each returns a solved envelope or null (fall through to "unsupported").
// A clean, parseable spelling of a value for a sub-equation: √2/2 → sqrt(2)/2.
const PARSEABLE = { '0': '0', '1': '1', '1/2': '1/2', '√2/2': 'sqrt(2)/2', '√3/2': 'sqrt(3)/2', '√3/3': 'sqrt(3)/3', '√3': 'sqrt(3)' };
function parseableValue(c) {
  const t = fmtValue(c);
  const key = t.replace(/^-/, '');
  if (PARSEABLE[key]) return (t.startsWith('-') ? '-' : '') + PARSEABLE[key];
  return String(c);
}
// "a·u² + b·u + c" with the usual tidying (no 1·, no 0 terms, exact values).
function niceNumber(v) {
  const t = fmtValue(v);
  if (!/^-?\d+\.\d+$/.test(t)) return t;
  for (let d = 2; d <= 12; d += 1) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`;
  }
  return t;
}
function quadraticText(a, b, c, U) {
  const coef = (v, tail) => { const t = niceNumber(Math.abs(v)); return `${t === '1' && tail ? '' : t}${tail}`; };
  let out = `${a < 0 ? '−' : ''}${coef(a, `${U}²`)}`;
  if (Math.abs(b) > 1e-9) out += ` ${b < 0 ? '−' : '+'} ${coef(b, U)}`;
  if (Math.abs(c) > 1e-9) out += ` ${c < 0 ? '−' : '+'} ${coef(c, '')}`;
  return out;
}

function solveReducibleTrig(rawEquation, equation, variable, shown, allowRewrite = true) {
  const [lhs, rhs] = equation.split('=').map((t) => t.trim());
  if (!lhs || !rhs) return null;
  const expr = `(${lhs}) - (${rhs})`;
  const calls = [...expr.matchAll(/\b(sin|cos|tan)\s*\(([^()]*)\)/g)];
  if (calls.length === 0) return null;
  if (/\b(sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh)\b/.test(expr)) return null;
  const arg = calls[0][2].trim();
  if (!calls.every((c) => c[2].trim() === arg)) return null;
  const fns = [...new Set(calls.map((c) => c[1]))];
  const argShown = arg.replace(/\*/g, '');
  const outerSteps = [`Solve the equation: ${shown}`];
  if (DEGREES) outerSteps.push('Angle unit is set to degrees (Settings): angles are reported in degrees.');

  // Evaluate the expression with each trig call replaced by a symbol.
  const withSymbols = (map) => {
    let e = expr;
    for (const [fn, sym] of Object.entries(map)) e = e.replace(new RegExp(`\\b${fn}\\s*\\(\\s*${rx(arg)}\\s*\\)`, 'g'), `(${sym})`);
    return e;
  };
  const evalAt = (e, scope) => { try { const v = math.evaluate(e, scope); return typeof v === 'number' && Number.isFinite(v) ? v : NaN; } catch { return NaN; } };

  // ── Pythagorean rewrite: sin² alongside a linear cos (or cos² with sin).
  if (fns.length === 2 && fns.includes('sin') && fns.includes('cos') && allowRewrite) {
    const e = withSymbols({ sin: 'S', cos: 'C' });
    if (new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(e)) return null;
    const f = (S, C) => evalAt(e, { S, C });
    // Is it linear in C and at most quadratic in S (or vice versa), with S appearing only squared?
    const isQuadIn = (name) => { const g = name === 'S' ? (t) => f(t, 0.3) : (t) => f(0.3, t); const d1 = g(1) - g(0), d2 = g(2) - g(1), d3 = g(3) - g(2); return Math.abs((d2 - d1) - (d3 - d2)) < 1e-9 && Math.abs(d2 - d1) > 1e-9; };
    const isLinIn = (name) => { const g = name === 'S' ? (t) => f(t, 0.3) : (t) => f(0.3, t); const d1 = g(1) - g(0), d2 = g(2) - g(1); return Math.abs(d2 - d1) < 1e-9; };
    const onlySquared = (name) => { const g = name === 'S' ? (t) => f(t, 0.3) : (t) => f(0.3, t); return Math.abs(g(1) - g(-1)) < 1e-9; };
    let rewritten = null;
    if (isQuadIn('S') && onlySquared('S') && isLinIn('C')) {
      rewritten = expr.replace(new RegExp(`(?:\\(\\s*sin\\s*\\(\\s*${rx(arg)}\\s*\\)\\s*\\)|\\bsin\\s*\\(\\s*${rx(arg)}\\s*\\))\\s*\\^\\s*2`, 'g'), `(1 - cos(${arg})^2)`);
      outerSteps.push(`Use sin²(θ) = 1 − cos²(θ) so only cosine remains: ${beautify(rewritten)} = 0`);
    } else if (isQuadIn('C') && onlySquared('C') && isLinIn('S')) {
      rewritten = expr.replace(new RegExp(`(?:\\(\\s*cos\\s*\\(\\s*${rx(arg)}\\s*\\)\\s*\\)|\\bcos\\s*\\(\\s*${rx(arg)}\\s*\\))\\s*\\^\\s*2`, 'g'), `(1 - sin(${arg})^2)`);
      outerSteps.push(`Use cos²(θ) = 1 − sin²(θ) so only sine remains: ${beautify(rewritten)} = 0`);
    }
    if (rewritten && !new RegExp(`\\b(?:sin|cos)\\s*\\(\\s*${rx(arg)}\\s*\\)`).test(rewritten.replace(new RegExp(`\\b(?:${isQuadIn('S') && onlySquared('S') ? 'cos' : 'sin'})\\s*\\(\\s*${rx(arg)}\\s*\\)`, 'g'), 'Q'))) {
      const inner = solveTrigEquation(`${rewritten} = 0`, variable, undefined, true);
      if (inner && inner.status !== 'unsupported' && Array.isArray(inner.steps)) {
        return { ...inner, steps: [...outerSteps, ...inner.steps.filter((t) => !/^Solve the equation:/.test(t))] };
      }
      return null;
    }
    // ── a·sin + b·cos = 0 → tan = −a/b.
    const isLinBoth = isLinIn('S') && isLinIn('C');
    if (isLinBoth && Math.abs(f(0, 0)) < 1e-9) {
      const a = f(1, 0) - f(0, 0);
      const b = f(0, 1) - f(0, 0);
      if (Math.abs(b) > 1e-9 && Math.abs(a) > 1e-9) {
        const ratio = -a / b;
        const cf = (v) => (Math.abs(Math.abs(v) - 1) < 1e-9 ? (v < 0 ? '−' : '') : `${fmtValue(v)}·`);
        outerSteps.push(`Both sine and cosine appear, each to the first power and with no constant term: ${cf(a)}sin(${argShown}) ${b < 0 ? '−' : '+'} ${cf(Math.abs(b))}cos(${argShown}) = 0.`);
        outerSteps.push(`cos(${argShown}) = 0 would force sin(${argShown}) = 0 too, which is impossible — so divide through by cos(${argShown}): ${Math.abs(Math.abs(a) - 1) < 1e-9 ? '' : `${cf(a)}tan(${argShown}) = ${fmtValue(-b)}, i.e. `}tan(${argShown}) = ${fmtValue(ratio)}.`);
        const inner = solveTrigEquation(`tan(${arg}) = ${parseableValue(ratio)}`, variable, undefined, true);
        if (inner && inner.status !== 'unsupported' && Array.isArray(inner.steps)) {
          return { ...inner, steps: [...outerSteps, ...inner.steps.filter((t) => !/^Solve the equation:/.test(t)).map((t) => t.replace(String(ratio), fmtValue(ratio)))] };
        }
      }
    }
    return null;
  }

  // ── Quadratic in a single function: a·u² + b·u + c = 0 with u = f(arg).
  if (fns.length !== 1) return null;
  const fn = fns[0];
  const e = withSymbols({ [fn]: 'U' });
  if (new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(e)) return null;
  const g = (u) => evalAt(e, { U: u });
  const [g0, g1, g2, g3] = [g(0), g(1), g(2), g(3)];
  if (![g0, g1, g2, g3].every(Number.isFinite)) return null;
  const d1 = g1 - g0, d2 = g2 - g1, d3 = g3 - g2;
  const second = d2 - d1;
  if (Math.abs((d3 - d2) - second) > 1e-9 || Math.abs(second) < 1e-9) return null; // not quadratic
  const a = second / 2;
  const b = d1 - a;
  const c = g0;
  const disc = b * b - 4 * a * c;
  const U = variable === 'u' ? 'v' : 'u';
  outerSteps.push(`The equation is quadratic in ${fn}(${argShown}). Let ${U} = ${fn}(${argShown}): ${quadraticText(a, b, c, U)} = 0.`);
  if (disc < -1e-9) {
    outerSteps.push(`The discriminant b² − 4ac = ${formatNumber(disc)} is negative, so there is no real value of ${U} — and no solution.`);
    const result = undefinedValue({ input: rawEquation, reason: `No real value of ${fn}(${argShown}) satisfies the quadratic, so the equation has no real solution.`, steps: outerSteps });
    result.answer = 'No real solution';
    return result;
  }
  const r1 = (-b - Math.sqrt(Math.max(0, disc))) / (2 * a);
  const r2 = (-b + Math.sqrt(Math.max(0, disc))) / (2 * a);
  const rootsU = Math.abs(r1 - r2) < 1e-9 ? [r1] : [r1, r2].sort((x, y) => x - y);
  outerSteps.push(`Solve the quadratic (factor or use the quadratic formula): ${rootsU.map((r) => `${U} = ${fmtValue(r)}`).join('  or  ')}.`);
  const parts = [];
  const allSolutions = [];
  const familyTexts = [];
  for (const r of rootsU) {
    if ((fn === 'sin' || fn === 'cos') && Math.abs(r) > 1 + 1e-9) {
      outerSteps.push(`${fn}(${argShown}) = ${fmtValue(r)} is impossible — ${fn} never leaves [−1, 1] — so this value gives nothing.`);
      continue;
    }
    const inner = solveTrigEquation(`${fn}(${arg}) = ${parseableValue(r)}`, variable, undefined, true);
    if (!inner || inner.status === 'unsupported' || !Array.isArray(inner.steps)) return null;
    if (inner.status === 'undefined') { outerSteps.push(...inner.steps.filter((t) => !/^Solve the equation:/.test(t))); continue; }
    outerSteps.push(`Case ${fn}(${argShown}) = ${fmtValue(r)}:`);
    outerSteps.push(...inner.steps.filter((t) => !/^Solve the equation:/.test(t) && !/^Angle unit/.test(t)).map((t) => `  ${t.replace(String(r), fmtValue(r))}`));
    parts.push(inner);
    familyTexts.push(inner.answer.split(' (n ∈ ℤ)')[0]);
    for (const x of inner.graph?.solutions ?? []) allSolutions.push(x);
  }
  if (parts.length === 0) {
    const result = undefinedValue({ input: rawEquation, reason: `No value of ${fn}(${argShown}) from the quadratic lies in its range, so the equation has no real solution.`, steps: outerSteps });
    result.answer = 'No real solution';
    return result;
  }
  const merged = [...new Set(allSolutions.map((x) => Math.round(x * 1e8) / 1e8))].sort((x, y) => x - y);
  const toRad = (x) => (DEGREES ? x * Math.PI / 180 : x);
  const listText = merged.map((x) => fmtRad(toRad(x))).join(', ');
  outerSteps.push(`Combine the cases. On ${RANGE_TEXT()}: ${merged.map((x) => `${variable} = ${fmtRad(toRad(x))}`).join(',  ')}`);
  const base = parts[0];
  const graph = base.graph ? {
    ...base.graph,
    secondaryPoints: rootsU.length === 1 ? base.graph.secondaryPoints : undefined,
    secondaryLabel: rootsU.length === 1 ? base.graph.secondaryLabel : undefined,
    title: `Graph of y = ${fn}(${argShown}) with the solutions of ${shown} marked`,
    description: `The solutions on ${RANGE_TEXT()} are marked: where ${fn}(${argShown}) equals ${rootsU.map(fmtValue).join(' or ')}.`,
    solutions: merged,
  } : null;
  return {
    steps: outerSteps,
    answer: `${familyTexts.join('  or  ')} (n ∈ ℤ);  on ${RANGE_TEXT()}: ${listText}`,
    tips: [
      `A quadratic in ${fn} is solved like any quadratic — substitute ${U} = ${fn}(${argShown}), solve for ${U}, then solve each ${fn}(${argShown}) = value separately.`,
      `Discard any ${U} outside [−1, 1] for sine and cosine before looking for angles.`,
    ],
    common_mistakes: [
      `Dividing both sides by ${fn}(${argShown}) and losing the ${fn}(${argShown}) = 0 solutions.`,
      'Solving for u and reporting u as the answer — the angle still has to be found.',
    ],
    graph,
  };
}

export function solveTrigEquation(rawEquation, variable = 'x', settingsOverride, nested = false) {
  if (!nested) DEGREES = (settingsOverride?.angleUnit ?? getSettings().angleUnit) === 'degrees';
  const equation = parseMathExpression(rawEquation);
  const parsed = parseTrigEquation(equation, variable);
  const shown = beautify(rawEquation).replace(/\s*=\s*/, ' = ');

  if (!parsed) {
    try {
      const reduced = solveReducibleTrig(rawEquation, equation, variable, shown, !nested);
      if (reduced) return reduced;
    } catch { /* fall through to unsupported */ }
    return unsupported({
      input: rawEquation,
      reason: 'Trigonometric equations are supported in the form A·sin(kx) + B = C (likewise cos and tan). Equations with two different trig functions, squared trig terms, or non-linear arguments are not solved yet.',
      answer: 'This trig equation is not supported yet',
      tips: [
        'Supported: sin(x) = 1/2, 2cos(x) − 1 = 0, tan(2x) = 1, √3 = 2sin(x); quadratics like 2sin²(x) − sin(x) − 1 = 0; sin(x) = cos(x); sin²(x) + cos(x) = 1.',
        'Not yet: sin(x) + cos(x) = 1, sin(x²) = 0, sin(x) = sin(2x).',
      ],
    });
  }

  const { fn, arg, k, c } = parsed;
  const cShown = fmtValue(c);
  const argShown = arg.replace(/\*/g, '');
  const steps = [];
  steps.push(`Solve the equation: ${shown}`);
  if (DEGREES) steps.push('Angle unit is set to degrees (Settings): angles are reported in degrees.');
  // Only narrate isolation when there was something to isolate: a coefficient
  // other than 1, a constant term, or the trig term on the right-hand side.
  const [lhsRaw] = equation.split('=');
  const alreadyIsolated = Math.abs(parsed.a - 1) < EPS && new RegExp(`^\\s*${fn}\\s*\\(`).test(lhsRaw);
  if (!alreadyIsolated) {
    steps.push(`Isolate the trig function: ${fn}(${argShown}) = ${cShown}`);
  }

  // Range check for sin/cos.
  if ((fn === 'sin' || fn === 'cos') && Math.abs(c) > 1 + EPS) {
    steps.push(`${fn}(θ) always lies between −1 and 1, but here it would have to equal ${cShown}.`);
    const result = undefinedValue({
      input: rawEquation,
      reason: `${fn}(θ) = ${cShown} has no real solution — the ${fn === 'sin' ? 'sine' : 'cosine'} of a real angle is never outside [−1, 1].`,
      steps,
      tips: ['Check the equation for a sign or coefficient slip; values beyond ±1 usually mean the trig term wasn\'t isolated correctly.'],
      common_mistakes: ['Applying arcsin/arccos to a number outside [−1, 1] and reading the calculator error as a value.'],
    });
    result.answer = 'No real solution';
    return result;
  }

  const p = principalAngle(fn, c);
  const theta = k === 1 ? variable : 'θ';
  const nSym = 'n';

  // General solution, first for θ = kx (or directly for x when k = 1).
  let general; // [{ base (rad), period (rad) }] for θ
  if (fn === 'sin') {
    steps.push(`Take the inverse sine: the reference angle is arcsin(${cShown}) = ${p.exact}${p.isExact || DEGREES ? '' : ' rad'}.`);
    const second = fmtRad(Math.PI - p.rad);
    steps.push(`Sine takes each value twice per period (quadrants I and II for positive values, III and IV for negative), so within one period: ${theta} = ${p.exact} and ${theta} = ${PERIOD_HALF()} − (${p.exact}) = ${second}.`);
    general = [
      { base: p.rad, period: TWO_PI },
      { base: Math.PI - p.rad, period: TWO_PI },
    ];
  } else if (fn === 'cos') {
    steps.push(`Take the inverse cosine: the reference angle is arccos(${cShown}) = ${p.exact}${p.isExact || DEGREES ? '' : ' rad'}.`);
    steps.push(`Cosine is even, so ${theta} = ±${p.exact} both work within one period.`);
    general = [
      { base: p.rad, period: TWO_PI },
      { base: -p.rad, period: TWO_PI },
    ];
  } else {
    steps.push(`Take the inverse tangent: the reference angle is arctan(${cShown}) = ${p.exact}${p.isExact || DEGREES ? '' : ' rad'}.`);
    steps.push(`Tangent repeats every ${PERIOD_HALF()} (not ${PERIOD_FULL()}), so one solution per period suffices.`);
    general = [{ base: p.rad, period: Math.PI }];
  }
  general = mergeFamilies(general);

  // Normalise bases into [0, period) for a clean listing, then render.
  general = general.map((g) => ({ base: ((g.base % g.period) + g.period) % g.period, period: g.period }))
    .sort((a, b) => a.base - b.base);
  const thetaText = general.map((g) => familyText(theta, g.base, g.period)).join('  or  ');

  // If the argument was kx, convert θ-solutions to x by dividing by k.
  let generalText = thetaText;
  if (k !== 1) {
    steps.push(`Let θ = ${argShown}. General solution for θ (${nSym} any integer): ${thetaText}`);
    // θ = kx ⇒ x = θ/k. When k is a reciprocal (x/2 ⇒ k = 1/2), say
    // "multiply by 2" and write 2(...) — that is how the step is taught.
    const inv = 1 / k;
    const isReciprocal = Math.abs(k) < 1 && near(inv, Math.round(inv));
    const kShown = formatNumber(k);
    generalText = general
      .map((g) => {
        const inner = familyText(theta, g.base, g.period).replace(/^θ = /, '');
        return isReciprocal ? `${variable} = ${Math.round(inv)}(${inner})` : `${variable} = (${inner})/${kShown}`;
      })
      .join('  or  ');
    steps.push(isReciprocal
      ? `Multiply by ${Math.round(inv)} to get ${variable}: ${generalText}`
      : `Divide by ${kShown} to get ${variable}: ${generalText}`);
  } else {
    steps.push(`General solution (${nSym} any integer): ${generalText}`);
  }

  // Solutions for x on [0, 2π): θ = kx, so x = θ/k; enumerate.
  const sols = new Set();
  const list = [];
  for (const g of general) {
    // range of n such that x = (base + period·n)/k lies in [0, 2π)
    const nMin = Math.floor((-g.base) / g.period) - Math.ceil(Math.abs(k)) - 2;
    const nMax = Math.ceil((TWO_PI * Math.abs(k) - g.base) / g.period) + Math.ceil(Math.abs(k)) + 2;
    for (let n = nMin; n <= nMax; n++) {
      const x = (g.base + g.period * n) / k;
      if (x >= -EPS && x < TWO_PI - EPS) {
        const key = Math.round(x * 1e8);
        if (!sols.has(key)) {
          sols.add(key);
          list.push(x);
        }
      }
    }
  }
  list.sort((a, b) => a - b);
  const listed = list.map((x) => `${variable} = ${fmtRad(x)}`);
  steps.push(`On ${RANGE_TEXT()}: ${listed.join(',  ')}`);

  // Verify each listed solution against the original equation.
  const scopeCheck = (x) => {
    try {
      const [l, r] = equation.split('=');
      return Math.abs(math.evaluate(l, { [variable]: x }) - math.evaluate(r, { [variable]: x })) < 1e-6;
    } catch { return false; }
  };
  const allCheck = list.every(scopeCheck);
  if (!allCheck) {
    return unsupported({
      input: rawEquation,
      reason: 'The solutions found did not all verify against the original equation, so nothing is being reported.',
      answer: 'This trig equation is not supported yet',
    });
  }
  steps.push(`Check: substituting each value back into ${shown} balances both sides.`);

  // Graph: y = f(kx) with y = c and the [0, 2π) solutions marked.
  let graph = null;
  try {
    const curve = `${fn}(${k === 1 ? variable : `${formatNumber(k)}*${variable}`})`;
    // In degrees mode the x-axis is in degrees: sample in radians, plot in degrees.
    const toShown = (x) => (DEGREES ? x * 180 / Math.PI : x);
    const pts = [];
    for (let x = -TWO_PI; x <= TWO_PI + 1e-9; x += 0.05) {
      let y;
      try { y = math.evaluate(curve, { [variable]: x }); } catch { y = NaN; }
      if (Number.isFinite(y) && Math.abs(y) <= 6) pts.push({ x: Math.round(toShown(x) * 1e6) / 1e6, y });
    }
    const line = pts.map((pt) => ({ x: pt.x, y: c }));
    graph = {
      points: pts,
      secondaryPoints: line,
      secondaryLabel: `y = ${cShown}`,
      title: `Graph of y = ${curve} and y = ${cShown}${DEGREES ? ` (${variable} in degrees)` : ''}`,
      description: `Solutions are where the curve meets the horizontal line y = ${cShown}. Marked: the solutions on ${RANGE_TEXT()}.`,
      solutions: list.map(toShown),
      initialWindow: { xMin: toShown(-TWO_PI), xMax: toShown(TWO_PI) },
    };
  } catch { /* graph is optional */ }

  return {
    steps,
    answer: `${generalText} (${nSym} ∈ ℤ);  on ${RANGE_TEXT()}: ${list.map(fmtRad).join(', ')}`,
    tips: [
      `A trig equation has infinitely many solutions because the functions repeat — the general solution captures all of them; the ${RANGE_TEXT()} list is one period's worth.`,
      fn === 'tan' ? `tan has period ${PERIOD_HALF()}, so its general solution steps by ${PERIOD_HALF()}n rather than ${PERIOD_FULL()}n.` : `Remember both quadrants where ${fn} takes the value ${cShown} — a calculator\'s inverse function only returns one of them.`,
    ],
    common_mistakes: [
      'Reporting only the calculator\'s principal value (e.g. arcsin(1/2) = π/6) and missing the second solution in the period.',
      'Forgetting to divide by k when the argument is kx — sin(2x) = 1/2 has twice as many solutions in [0, 2π) as sin(x) = 1/2.',
    ],
    graph,
  };
}
