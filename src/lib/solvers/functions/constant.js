// A function that is constant on its domain, written so it does not look it:
// sin²(x) + cos²(x), tan(x)·cot(x), cosh²(x) − sinh²(x), (x² − 1)/(x − 1) − x
// (November 2026 review). The general analysis searched them for turning
// points numerically, and rounding (1 ± 2e−16) was reported as six maxima
// and minima, beside "f′(x) = 0"; (x + 1)² − (x − 1)² − 4x, which is 0, got
// a list of six x-intercepts.
//
// Values at a few points only propose the constant; it is then proved
// exactly, or the function is left to the general analysis:
// - Algebrite simplifies f, with tan, cot, sec and csc written in sin and
//   cos and everything in exponentials (circexp), to a constant;
// - or, for sin and cos of multiples of x, proveTrigIdentity shows f = c on
//   the unit circle in exact fractions.
// The domain is the original function's, never the simplified one's: the
// points excluded by tan, cot, sec, csc (read off the parse tree), the real
// zeros of a polynomial denominator (the exact root finder), and the
// intervals the domain finder measures (a logarithm, a square root).

import { math, beautify, formatNumber, exactForm, piForm, mark, rewriteReciprocalTrig, trigUndefinedPoints } from '../solverUtils.js';
import { domainConditions } from '../algebra/restrictions.js';
import { proveTrigIdentity } from '../trigonometry/circle.js';
import { evalAt, exactNumber, WINDOW } from './features.js';

const SAMPLES = [0.3719, 1.2347, -2.7183, 4.1231, -0.6180, 7.389];

// sin and cos only: tan(u) is sin(u)/cos(u), after the reciprocals.
function inSinCos(func) {
  let s = rewriteReciprocalTrig(String(func));
  for (let guard = 0; guard < 20; guard += 1) {
    const m = s.match(/\btan\s*\(/);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let i = open; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') { depth -= 1; if (depth === 0) { close = i; break; } }
    }
    if (close < 0) return null;
    const arg = s.slice(open + 1, close);
    s = `${s.slice(0, m.index)}(sin(${arg})/cos(${arg}))${s.slice(close + 1)}`;
  }
  return s;
}

const mentions = (text, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`, 'i').test(String(text));

// { value, text, how } when f is proved constant on its domain, else null.
export function provedConstant(func, variable, Algebrite) {
  if (!Algebrite) return null;
  const values = SAMPLES.map((x) => evalAt(func, variable, x)).filter(Number.isFinite);
  if (values.length < 3) return null;
  const c = values[0];
  if (!values.every((v) => Math.abs(v - c) <= 1e-9 * Math.max(1, Math.abs(c)))) return null;
  const run = (e) => {
    const out = String(Algebrite.run(e)).trim();
    if (!out || /nil|stop|error/i.test(out)) throw new Error(out);
    return out;
  };
  // 1. Exact algebra.
  try {
    const sc = inSinCos(func);
    if (sc) {
      const simplified = run(`simplify(circexp(${sc}))`);
      if (!mentions(simplified, variable) && !/\bi\b/.test(simplified)) {
        const v = Number(math.evaluate(simplified.replace(/\bexp\(/g, 'exp(')));
        if (Number.isFinite(v) && Math.abs(v - c) <= 1e-9 * Math.max(1, Math.abs(c))) {
          return { value: v, text: exactForm(simplified), how: 'algebra' };
        }
      }
    }
  } catch { /* try the trig proof */ }
  // 2. sin and cos on the unit circle, exactly.
  const text = exactNumber(c);
  if (/^-?\d+(?:\/\d+)?$/.test(text)) {
    try {
      if (proveTrigIdentity(Algebrite, func, text, variable)) return { value: c, text, how: 'trig' };
    } catch { /* not proved */ }
  }
  return null;
}

// A multiple of π as a textbook writes it, for any denominator: piForm
// covers 1, 2, 3, 4, 6 and 12 only (π/8 came back null, and tan(4x)·cot(4x)
// fell over — CodeRabbit on PR #80).
function piText(x) {
  const f = piForm(x);
  if (f) return f;
  for (let q = 1; q <= 96; q += 1) {
    const p = Math.round((x * q) / Math.PI);
    if (Math.abs((p * Math.PI) / q - x) < 1e-9) {
      const num = p === 1 ? 'π' : p === -1 ? '-π' : `${p}π`;
      return q === 1 ? num : `${num}/${q}`;
    }
  }
  return formatNumber(x);
}

// v = offset + n·step, in the function's own variable.
function latticeText(variable, offset, step) {
  const s = piText(step);
  const k = s.match(/^π\/(\d+)$/);
  const off = Math.abs(offset) < 1e-12 ? '' : `${piText(offset)} + `;
  return `${variable} = ${off}${s === 'π' ? 'nπ' : k ? `nπ/${k[1]}` : `n·${s}`}`;
}

// Two lattices a step apart by half a step are one: tan's π/2 + nπ and
// cot's nπ are nπ/2.
function mergeLattices(lattices, variable) {
  const out = [];
  for (const l of lattices) {
    const same = out.find((o) => Math.abs(o.step - l.step) < 1e-9);
    if (same) {
      const gap = (((l.offset - same.offset) % same.step) + same.step) % same.step;
      if (gap < 1e-9 || Math.abs(gap - same.step) < 1e-9) continue;
      if (Math.abs(gap - same.step / 2) < 1e-9) {
        same.step /= 2;
        same.offset = (((same.offset % same.step) + same.step) % same.step);
        continue;
      }
    }
    out.push({ ...l });
  }
  return out.map((l) => ({ ...l, text: latticeText(variable, l.offset, l.step) }));
}

export function constantFunction(func, variable, proof, Algebrite = null) {
  const c = proof.text;
  const own = trigUndefinedPoints(func, variable).map((l) => ({ ...l, text: latticeText(variable, l.offset, l.step) }));
  const lattices = mergeLattices(own, variable);
  const onLattice = (x) => lattices.some((l) => Math.abs(((x - l.offset) / l.step) - Math.round((x - l.offset) / l.step)) < 1e-9);
  // The rest of the domain read off the expression itself (denominators,
  // logarithms, square roots), never off the ±10 window: ln(100 − x) −
  // ln(100 − x) is 0 for x < 100 only, and the window saw no restriction.
  const found = domainConditions(func, variable, { Algebrite, skipTrig: true });
  if (found?.empty) return null;
  const inside = (x) => !found || found.holds(x);
  const points = (found?.points || []).filter((p) => !onLattice(p.value));
  // Its bounds and anything stated as written; the excluded points are
  // listed again below, without those already on a trig lattice.
  const bounds = found ? found.conditions.filter((t) => !t.startsWith(`${variable} ≠ `)) : [];

  const conditions = [
    ...bounds,
    ...(points.length ? [`${variable} ≠ ${points.map((p) => p.text).join(', ')}`] : []),
    ...lattices.map((l) => l.text.replace(new RegExp(`^${variable} = `), `${variable} ≠ `)),
  ];
  const everywhere = conditions.length === 0;
  const latticeNote = lattices.length ? ', n any integer' : '';
  const domainText = everywhere ? 'all real numbers' : `${conditions.join(' and ')}${latticeNote}`;
  const domainMarked = everywhere ? 'all real numbers' : `${conditions.map((t) => mark(t)).join(' and ')}${latticeNote}`;
  const defined0 = Number.isFinite(evalAt(func, variable, 0)) && inside(0) && !onLattice(0);

  const why = [
    ...own.map((l) => `${/^division/.test(l.because) ? l.because.replace(/by (.+)$/, (m, g) => `by ${mark(g)}`) : mark(l.because)} is undefined at ${mark(l.text)}`),
    ...(found?.reasons?.length ? [`it needs ${found.reasons.map((r) => r.text).join(' and ')}`] : []),
  ];
  const holes = [
    ...points.map((p) => p.value),
    ...lattices.flatMap((l) => {
      const out = [];
      for (let n = Math.ceil((WINDOW.min - l.offset) / l.step); l.offset + n * l.step <= WINDOW.max; n += 1) out.push(l.offset + n * l.step);
      return out;
    }),
  ].filter((x) => x >= WINDOW.min && x <= WINDOW.max && (!found || (found.lower ? x > found.lower.value || (!found.lower.strict && x === found.lower.value) : true) && (found.upper ? x < found.upper.value || (!found.upper.strict && x === found.upper.value) : true)));

  // How it simplifies, in the words a textbook uses for that kind.
  const text = String(func);
  const trig = /\b(?:sin|cos|tan|sec|csc|cot)\s*\(/.test(text);
  const hyperbolic = /\b(?:sinh|cosh|tanh)\s*\(/.test(text);
  // Named only for sin and cos of x itself: cos²(x) − sin²(x) − cos(2x) is
  // the double-angle identity, not this one.
  const trigArgs = [...text.matchAll(/\b(?:sin|cos|tan|sec|csc|cot)\s*\(([^()]*)\)/g)].map((m) => m[1].trim());
  const pythagorean = /\bsin\s*\(/.test(text) && /\bcos\s*\(/.test(text) && /\^\s*2/.test(text) && trigArgs.every((a) => a === variable);
  const how = proof.how === 'trig'
    ? `written in ${mark(`sin(${variable})`)} and ${mark(`cos(${variable})`)}, it equals ${mark(c)} (proved exactly: with ${mark(`t = tan(${variable}/2)`)} both sides become the same rational function of ${mark('t')})`
    : hyperbolic && !trig
      ? `written with ${mark(`e^${variable}`)} and ${mark(`e^(-${variable})`)}, every ${mark(variable)} cancels`
      : trig
        ? `written in ${mark(`sin(${variable})`)} and ${mark(`cos(${variable})`)}, it simplifies exactly${pythagorean ? ` (the Pythagorean identity ${mark('sin²(θ) + cos²(θ) = 1')})` : ''}`
        : `the ${mark(variable)} terms cancel exactly`;
  const proofStep = `Simplify: ${mark(`${beautify(func)} = ${c}`)} wherever it is defined — ${how}.`;
  const steps = [
    `Analyze the function: ${mark(`f(${variable}) = ${beautify(func)}`)}`,
    proofStep,
    everywhere
      ? 'Domain: all real numbers — the original expression is defined for every real input.'
      : `Domain: simplifying does not change where the original is defined: ${why.join('; ')}. So the domain is ${domainMarked}.`,
    `So ${mark(`f′(${variable}) = 0`)} at every point of the domain: ${mark('f')} is constant, ${mark(`f(${variable}) = ${c}`)}. Its graph is the horizontal line ${mark(`y = ${c}`)}${holes.length ? ', with a gap at each excluded point' : ''}.`,
    `Range: the single value ${mark(`y = ${c}`)}.`,
    `Extrema: every point of the domain is a non-strict local maximum and a non-strict local minimum (${mark('f')} is never above or below ${mark(c)}), but there are no isolated turning points: no peaks or valleys.`,
    defined0 ? `y-intercept: ${mark(`(0, ${c})`)}.` : `y-intercept: none — ${mark(`${variable} = 0`)} is not in the domain.`,
    proof.value === 0
      ? 'x-intercepts: every point of the domain — the graph lies on the x-axis.'
      : `x-intercepts: none — the line ${mark(`y = ${c}`)} never meets the x-axis.`,
  ];
  const domainShort = everywhere ? 'domain: all real numbers' : `domain: ${domainText}`;
  return {
    steps,
    answer: `f(${variable}) = ${beautify(func)}: constant, f(${variable}) = ${c} on its domain (${domainShort}); every point is a non-strict local maximum and minimum, with no isolated turning points.`,
    tips: [
      `When ${mark(`f′(${variable}) = 0`)} at every point of an interval, ${mark('f')} is constant there: simplify first, before looking for turning points.`,
      `Here ${mark(`${beautify(func)} = ${c}`)}${everywhere ? '' : ` for ${domainMarked}`}, so the graph is the line ${mark(`y = ${c}`)}.`,
      `A constant function has no isolated peaks or valleys, yet every point is a non-strict local maximum and minimum: no nearby value is higher or lower.`,
      `Simplifying keeps the original domain: ${mark('tan(x)·cot(x) = 1')} only where both are defined, so ${mark('x ≠ nπ/2')}.`,
    ],
    common_mistakes: [
      'Reading turning points off a table or a calculator when the function is constant: rounding differences are not peaks or valleys.',
      `Dropping the domain after simplifying: ${mark('x/x')} is ${mark('1')} only for ${mark('x ≠ 0')}.`,
    ],
    holes,
    defined0,
    domainText,
  };
}
