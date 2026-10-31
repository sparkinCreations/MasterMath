// Limits by sampling: one-sided limits, the numeric estimate when no named
// technique applies (stated as one), oscillation detected, and the constants
// an estimate is recognised as.

import { math, formatNumber, gcd, mark } from '../solverUtils.js';
// A limit at a trig asymptote (tan x at π/2) is recognised by the trig code.
import { EXPLODED_MAGNITUDE } from '../trigonometrySolver.js';

// ln(u) and √u need u ≥ 0 (ln(0) stays −∞), checked on the argument itself:
// x²·ln(x) at x = −10⁻⁸ is complex with an imaginary part (π·10⁻¹⁶) small
// enough that mathjs rounds it away, so the left side of 0 read as defined
// (1.63.0). Parsed once per expression.
const GUARDS = new Map();
function guardsFor(func) {
  if (GUARDS.has(func)) return GUARDS.get(func);
  const guards = [];
  try {
    math.parse(func).traverse((node) => {
      if (node.type !== 'FunctionNode' || node.args.length !== 1) return;
      const name = node.fn?.name;
      if (name === 'ln' || name === 'log' || name === 'sqrt') guards.push(node.args[0].compile());
    });
  } catch { /* evaluate will fail on its own */ }
  if (GUARDS.size > 500) GUARDS.clear();
  GUARDS.set(func, guards);
  return guards;
}

export function evalAt(func, variable, x) {
  try {
    const scope = { [variable]: x };
    for (const g of guardsFor(func)) {
      const u = g.evaluate(scope);
      if (typeof u === 'number' && u < 0) return NaN;
    }
    const y = math.evaluate(func, scope);
    return typeof y === 'number' ? y : Number(y);
  } catch {
    return NaN;
  }
}

// 0^0 hides inside a direct substitution: mathjs evaluates it as 1, so x^x at
// 0 read "the function is defined and equals 1". A power whose base and
// exponent are both 0 at the point is the indeterminate form 0⁰ (1.63.0).
export function zeroToZero(func, variable, x) {
  let found = false;
  try {
    const at = (n) => { try { return Number(n.evaluate({ [variable]: x })); } catch { return NaN; } };
    math.parse(func).traverse((node) => {
      const pow = (node.type === 'OperatorNode' && node.op === '^') || (node.type === 'FunctionNode' && node.fn?.name === 'pow');
      if (!found && pow && at(node.args[0]) === 0 && at(node.args[1]) === 0) found = true;
    });
  } catch {
    return false;
  }
  return found;
}

// The function's value at a point for direct substitution: NaN at a 0⁰.
export function valueAt(func, variable, x) {
  return zeroToZero(func, variable, x) ? NaN : evalAt(func, variable, x);
}

export function estimateFiniteLimitNumeric(func, variable, target) {
  // This is the sampling rung itself, so it deliberately does not set
  // `verified`: cross-checking a numeric estimate with more numeric sampling
  // would be circular. Answers from here surface as unverified, which honestly
  // signals "numerical estimate" rather than "proven symbolically".
  const direct = valueAt(func, variable, target);
  const steps = [];

  // A huge magnitude means the point sits on a vertical asymptote and the
  // float value is rounding noise, not a real function value.
  if (Number.isFinite(direct) && Math.abs(direct) < EXPLODED_MAGNITUDE) {
    steps.push(`Substitute directly: at ${mark(`${variable} = ${formatNumber(target)}`)}, the function is defined and equals ${mark(formatNumber(direct))}.`);
    return { steps, answer: formatNumber(direct) };
  }

  if (zeroToZero(func, variable, target)) {
    steps.push(`Direct substitution at ${mark(`${variable} = ${formatNumber(target)}`)} gives ${mark('0^0')}: an indeterminate form, not ${mark('1')}. So approach the point instead.`);
  } else if (Number.isNaN(direct)) {
    steps.push(`Direct substitution at ${mark(`${variable} = ${formatNumber(target)}`)} is undefined (an indeterminate form), so approach from both sides.`);
  } else {
    steps.push(`Direct substitution at ${mark(`${variable} = ${formatNumber(target)}`)} blows up instead of settling on a value, so approach from both sides.`);
  }

  // Oscillation: if a side never settles — the values keep swinging across a
  // wide range no matter how close we get — the limit fails to exist *because
  // the function oscillates*, which is a different reason than two one-sided
  // values disagreeing. Say so specifically (sin(1/x) is the classic case).
  if (sideOscillates(func, variable, target, 1) || sideOscillates(func, variable, target, -1)) {
    steps.push(`Sampling ever closer to ${mark(`${variable} = ${formatNumber(target)}`)}, the values keep swinging between roughly the same high and low values instead of settling toward any number.`);
    steps.push('The function oscillates infinitely often near this point, so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const left = sampleSide(func, variable, target, -1);
  const right = sampleSide(func, variable, target, 1);
  // Defined on one side only (ln(x) at 0): the limit is taken over the
  // domain, from that side. Reported as "the one-sided limits disagree",
  // with −18.42 read off as the right-hand value of ln(x) (1.63.0).
  if (left.outOfDomain !== right.outOfDomain) {
    const side = left.outOfDomain ? 1 : -1;
    const one = evaluateOneSidedLimit(func, variable, target, side);
    steps.push(domainEdgeStep(variable, target, side));
    steps.push(...one.steps.slice(1));
    return { ...one, steps, domainEdge: side };
  }
  if (left.outOfDomain && right.outOfDomain) {
    steps.push(`The function is not defined on either side of ${mark(`${variable} = ${formatNumber(target)}`)}, so there is nothing to approach: the limit does not exist.`);
    return { steps, answer: 'Does not exist' };
  }
  steps.push(`From the left (${mark(`${variable} → ${formatNumber(target)}⁻`)}): ${sideText(left)}`);
  steps.push(`From the right (${mark(`${variable} → ${formatNumber(target)}⁺`)}): ${sideText(right)}`);

  if (left.diverges && right.diverges) {
    if (left.sign === right.sign) {
      const answer = left.sign > 0 ? '∞' : '-∞';
      steps.push(`Both sides grow without bound in the same direction, so the limit diverges to ${mark(answer)}.`);
      return { steps, answer };
    }
    steps.push('The two sides run off to opposite infinities (a vertical asymptote), so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const bothConverge = left.value !== undefined && right.value !== undefined;
  if (bothConverge && Math.abs(left.value - right.value) < 1e-4) {
    const value = formatLimitConstant((left.value + right.value) / 2);
    steps.push(`Both sides approach ${mark(value)}, so the limit is ${mark(value)}, as estimated from these samples (an estimate, not a proof).`);
    return { steps, answer: value };
  }

  steps.push('The one-sided limits disagree, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

// The step that says a limit is taken from the one side the function lives on.
export function domainEdgeStep(variable, target, side) {
  const point = formatNumber(target);
  return side > 0
    ? `The function is not defined just to the left of ${mark(`${variable} = ${point}`)}, so ${mark(variable)} can only approach ${mark(point)} from the right: the limit is the right-hand limit, ${mark(`${variable} → ${point}⁺`)}.`
    : `The function is not defined just to the right of ${mark(`${variable} = ${point}`)}, so ${mark(variable)} can only approach ${mark(point)} from the left: the limit is the left-hand limit, ${mark(`${variable} → ${point}⁻`)}.`;
}

// Does the function oscillate as it approaches the point from one side?
// Sample a geometric ladder of shrinking offsets; the tell-tale of oscillation
// (vs. convergence or a plain jump) is that the *innermost* samples still span
// a wide range and the sequence keeps reversing direction. A converging side
// collapses to a point; a jump side settles too — only oscillation stays wide.
function sideOscillates(func, variable, target, direction) {
  const offsets = [1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 3e-6, 1e-6, 3e-7, 1e-7, 3e-8, 1e-8];
  const values = [];
  for (const o of offsets) {
    const y = evalAt(func, variable, target + direction * o);
    if (Number.isFinite(y)) values.push(y);
  }
  if (values.length < 8) return false;

  const inner = values.slice(Math.floor(values.length / 2));
  const innerSpread = Math.max(...inner) - Math.min(...inner);

  let reversals = 0;
  for (let i = 2; i < values.length; i += 1) {
    const d1 = values[i - 1] - values[i - 2];
    const d2 = values[i] - values[i - 1];
    if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) reversals += 1;
  }

  // Wide, still-swinging behaviour close in — not settling to a value.
  return innerSpread > 0.3 && reversals >= 3;
}

// Probe one side of a limit at two distances from the point. A closer sample
// that is an order of magnitude larger means the side is diverging toward an
// asymptote rather than settling on a value.
function sampleSide(func, variable, target, direction) {
  const far = evalAt(func, variable, target + direction * 1e-6);
  const near = evalAt(func, variable, target + direction * 1e-8);

  if (Number.isNaN(near)) return { outOfDomain: true };
  if (!Number.isFinite(near) || (Math.abs(near) > 1e5 && Math.abs(near) > 10 * Math.abs(far))) {
    return { diverges: true, sign: near > 0 ? 1 : -1 };
  }
  return { value: near };
}

function describeSide(side) {
  if (side.diverges) return side.sign > 0 ? 'diverges to ∞' : 'diverges to -∞';
  if (side.outOfDomain) return 'not defined on this side';
  return formatNumber(side.value);
}

// describeSide for a step: the value or the infinity typeset, the words not.
function sideText(side) {
  if (side.diverges) return `diverges to ${mark(side.sign > 0 ? '∞' : '-∞')}`;
  if (side.outOfDomain) return 'not defined on this side';
  return mark(formatNumber(side.value));
}

// Evaluate a one-sided limit (side: 1 = from the right, -1 = from the left)
// by sampling a log-spaced ladder of offsets shrinking toward the point.
// Numeric by nature — like estimateFiniteLimitNumeric, it does not fabricate
// a "verified" flag — with one exactness upgrade: when the function is defined
// at the point and the samples settle onto that value, the limit is reported
// as the exact value and marked verified by direct substitution.
export function evaluateOneSidedLimit(func, variable, target, side) {
  const dirWord = side > 0 ? 'right' : 'left';
  const sideMark = side > 0 ? '⁺' : '⁻';
  const steps = [
    `This is a one-sided limit: only the ${dirWord}-hand behaviour (${mark(`${variable} → ${formatNumber(target)}${sideMark}`)}) matters.`,
  ];

  const offsets = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9];
  const samples = offsets
    .map((o) => evalAt(func, variable, target + side * o))
    .filter((y) => !Number.isNaN(y));
  const values = samples.filter((y) => Number.isFinite(y));

  if (values.length < 3) {
    // Mostly undefined or infinite on that side. Distinguish the two.
    const infinities = samples.filter((y) => !Number.isFinite(y));
    if (infinities.length >= 2) {
      const answer = infinities[infinities.length - 1] > 0 ? '∞' : '-∞';
      steps.push(`Approaching from the ${dirWord}, the values grow without bound — the limit is ${mark(answer)}.`);
      return { steps, answer };
    }
    steps.push(`The function is not defined on the ${dirWord} side of ${mark(`${variable} = ${formatNumber(target)}`)}, so this one-sided limit does not exist.`);
    return { steps, answer: 'Does not exist' };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const preview = [values[0], values[Math.floor(values.length / 2)], last]
    .map((v) => formatNumber(v));
  steps.push(`Sample ever closer on the ${dirWord} side: the values run ${mark(preview.join(' → '))}.`);

  // Explosive growth: magnitudes climbing steadily to something huge.
  if (Math.abs(last) > 1e4 && Math.abs(last) > 5 * Math.abs(first)) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the one-sided limit is ${mark(answer)}.`);
    return { steps, answer };
  }

  const deltas = [];
  for (let i = 1; i < values.length; i += 1) deltas.push(values[i] - values[i - 1]);
  const lastDelta = Math.abs(deltas[deltas.length - 1]);

  // Convergence: consecutive samples settle within a tight tolerance.
  if (lastDelta <= 1e-4 * (1 + Math.abs(last))) {
    const direct = valueAt(func, variable, target);
    if (
      Number.isFinite(direct) &&
      Math.abs(direct) < EXPLODED_MAGNITUDE &&
      Math.abs(direct - last) < 1e-3 * (1 + Math.abs(direct))
    ) {
      steps.push(`The values settle onto the function's own value there: ${mark(`f(${formatNumber(target)}) = ${formatNumber(direct)}`)}.`);
      return { steps, answer: formatNumber(direct), verified: true, verificationMethod: 'direct substitution' };
    }
    steps.push(`The values settle toward ${mark(formatLimitConstant(last))}: the one-sided limit, as estimated from these samples (an estimate, not a proof).`);
    return { steps, answer: formatLimitConstant(last) };
  }

  // Slow, steady divergence (e.g. ln(x) as x → 0⁺): each step keeps the same
  // sign and never decays, so the values are marching off to ±∞ even though
  // the magnitudes still look tame at these offsets.
  const sameSign = deltas.every((d) => d !== 0 && Math.sign(d) === Math.sign(deltas[0]));
  if (sameSign && lastDelta >= 0.5 * Math.abs(deltas[0])) {
    const answer = deltas[0] > 0 ? '∞' : '-∞';
    steps.push(`The values keep marching in the same direction without settling — a slow divergence to ${mark(answer)}.`);
    return { steps, answer };
  }

  steps.push('The values do not settle on that side, so the one-sided limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

// A numeric limit that is a familiar constant is named: e, e², π, π/2.
function formatLimitConstant(v) {
  const dec = formatNumber(v);
  const named = [
    [Math.E, 'e'], [Math.E ** 2, 'e^2'], [1 / Math.E, '1/e'], [Math.sqrt(Math.E), '√e'],
    [Math.PI, 'π'], [Math.PI / 2, 'π/2'], [Math.PI / 4, 'π/4'], [2 * Math.PI, '2π'], [Math.SQRT2, '√2'], [Math.LN2, 'ln(2)'],
  ];
  const hit = named.find(([c]) => Math.abs(v - c) < 1e-6 * Math.max(1, Math.abs(c)));
  if (hit) return `${hit[1]} (≈ ${dec})`;
  // Beyond the table: any integer power of e ((1 + 3/x)^x → e^3), then a small
  // rational (2/5 rather than 0.4). Only claim a name when the sampled value
  // is unambiguously close — a limit estimate is accurate to ~1e-6 at best.
  const close = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  if (v > 0) {
    const n = Math.round(Math.log(v));
    if (n !== 0 && Math.abs(n) <= 12 && close(v, Math.exp(n))) {
      return `${n > 0 ? `e^${n}` : `e^(${n})`} (≈ ${dec})`;
    }
  }
  if (!Number.isInteger(v)) {
    for (let q = 2; q <= 12; q += 1) {
      const p = Math.round(v * q);
      if (p !== 0 && Math.abs(p) <= 200 && close(v, p / q) && gcd(Math.abs(p), q) === 1) {
        return `${p}/${q} (≈ ${dec})`;
      }
    }
  }
  return dec;
}

export function estimateInfiniteLimit(func, variable, target) {
  const sign = target === Infinity ? 1 : -1;
  const samples = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((m) => evalAt(func, variable, sign * m));
  const finite = samples.filter((v) => Number.isFinite(v));

  const steps = [`Evaluate the function at increasingly large ${sign > 0 ? 'positive' : 'negative'} values of ${variable}.`];
  // Not defined out there at all (ln(x) as x → −∞): there is nothing to
  // approach. Undefined samples were shown as "±∞" and the limit given as −∞
  // (1.63.0, second review sweep).
  if (samples.slice(-3).every(Number.isNaN)) {
    steps.push(`The function is not defined for large ${sign > 0 ? 'positive' : 'negative'} ${mark(variable)} (it is outside the domain), so there is nothing to approach: the limit does not exist.`);
    return { steps, answer: 'Does not exist', outOfDomain: true };
  }
  // A value the display precision would round to 0 is shown in scientific
  // notation instead: "0, 0, 0, 0" hid the convergence of x/e^x (3.7e-42,
  // then values too small for double precision) and looked like a bug.
  const shown = samples.map((v) => {
    if (Number.isNaN(v)) return 'undefined';
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    const text = formatNumber(v);
    return v !== 0 && /^-?0(?:\.0+)?$/.test(text) ? v.toExponential(2) : text;
  });
  // A 0 that is really an underflow: the one before it was tiny, or every
  // sample is 0 although the function is not 0 nearer in (x·e^(−x²) is
  // 3.7e-43 at x = 10, and 0 from x = 100 on).
  const nearer = evalAt(func, variable, sign * 10);
  const underflowed = samples.some((v, i) => v === 0 && i > 0 && samples[i - 1] !== 0 && Math.abs(samples[i - 1]) < 1e-30)
    || (samples[0] === 0 && Number.isFinite(nearer) && nearer !== 0 && Math.abs(nearer) < 1e-30);
  steps.push(`Samples: ${mark(shown.join(', '))}${underflowed ? ' (a value smaller than about 1e-308 cannot be represented in double precision and is computed as exactly 0)' : ''}`);

  if (finite.length < 2) {
    // Growing without bound — base the sign on the last value we could evaluate.
    const reference = finite.length ? finite[finite.length - 1] : samples[samples.length - 1];
    const answer = reference > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the limit is ${mark(answer)}.`);
    return { steps, answer };
  }

  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  // Converging: the successive differences shrink and the last is small
  // relative to the value. (1 + 2/x)^x still moves in the third decimal at
  // x = 10⁴ (7.3876 → 7.3890) yet is plainly settling on e².
  const diffs = finite.slice(1).map((v, i) => Math.abs(v - finite[i]));
  const shrinking = diffs.length >= 3 && diffs.slice(-3).every((d, i, arr) => i === 0 || d <= arr[i - 1] * 1.01);
  if (Math.abs(last - prev) < 1e-3 || (shrinking && Math.abs(last - prev) < 1e-4 * (1 + Math.abs(last)))) {
    const value = formatLimitConstant(last);
    steps.push(`The values settle toward ${mark(value)}: the limit, as estimated from these samples (an estimate, not a proof).`);
    return { steps, answer: value };
  }

  // Growing in size but changing sign (x·sin(x)) is no limit at all: it was
  // answered ∞ from the last sample's sign (1.63.0).
  const tail = finite.slice(-4);
  if (Math.abs(last) > Math.abs(prev) * 5 && tail.some((v) => Math.sign(v) !== Math.sign(last))) {
    steps.push('The values swing between positive and negative and keep growing in size, so they approach no number and no single infinity: the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }
  if (Math.abs(last) > Math.abs(prev) * 5) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values keep growing, so the limit is ${mark(answer)}.`);
    return { steps, answer };
  }

  // Slow, steady growth (ln(x): +2.3 for every factor of 10) never settles
  // either; it was reported as "does not exist" (1.63.0).
  if (diffs.length >= 3) {
    const signed = finite.slice(1).map((v, i) => v - finite[i]);
    const steady = signed.every((d) => d !== 0 && Math.sign(d) === Math.sign(signed[0]));
    if (steady && Math.abs(signed[signed.length - 1]) >= 0.5 * Math.abs(signed[0])) {
      const answer = signed[0] > 0 ? '∞' : '-∞';
      steps.push(`The values keep moving the same way by steady amounts without settling — a slow divergence to ${mark(answer)}.`);
      return { steps, answer };
    }
  }

  steps.push('The values do not settle, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}
