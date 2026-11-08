// A definite integral with constants in it (1.73.0): ∫₀¹ a·x dx = a/2.
// Every such integral was refused as "Improper integral — could not evaluate
// the one-sided limits at the singularity": the numeric check samples the
// integrand, and with a letter in it every sample is not a number.
//
// Worked only when the integrand is defined at every x for every value of
// the constants its conditions allow (entireInX: +, −, ×, whole powers,
// sin, cos, e^(…), constant divisors and bases), so no value of a constant
// can put a singularity in [a, b]; anything else is refused, saying why.
// The antiderivative is checked by differentiating it back in every letter,
// the value by quadrature at several values of the constants, and the answer
// carries its conditions, with the case a constant excludes worked apart.
import {
  math,
  lnify,
  mark,
  rewriteReciprocalTrig,
  constantLetters,
  constantRequirements,
  entireInX,
  conditionsReason,
  expressionsEqualInAllLetters,
  isAlgebriteFailure,
} from '../solverUtils.js';
import { unsupported } from '../../solutionEnvelope.js';

const eForm = (t) => String(t).replace(/\bexp\(((?:[^()]|\([^()]*\))*)\)/g, (m, arg) => (/^[a-z0-9]+$/i.test(arg) ? `e^${arg}` : `e^(${arg})`));
const run = (Algebrite, cmd) => {
  try {
    const out = String(Algebrite.run(cmd)).trim();
    return !out || isAlgebriteFailure(out) || /stop|nil|integral\(|defint/i.test(out) ? null : out;
  } catch { return null; }
};
const holds = (req, scope) => {
  try {
    const v = math.evaluate(req.replace(/≠/g, '!=').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/(?<![a-z])ln\(/g, 'log('), scope);
    return v === true;
  } catch { return false; }
};
const simpson = (expr, v, a, b, scope) => {
  const N = 2000;
  let sum = 0;
  for (let i = 0; i <= N; i += 1) {
    const x = a + ((b - a) * i) / N;
    const y = math.evaluate(expr, { ...scope, [v]: x });
    if (typeof y !== 'number' || !Number.isFinite(y)) return NaN;
    sum += y * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2);
  }
  return (sum * (b - a)) / N / 3;
};

export function definiteWithConstants({ integrand, v, a, b, lowerRaw, upperRaw, lowerLabel, upperLabel, notation, Algebrite }) {
  const letters = constantLetters(integrand, v);
  if (letters.length === 0) return null;
  const named = letters.length === 1 ? `the constant ${letters[0]}` : `the constants ${letters.join(', ')}`;
  const refuse = (reason, answer) => unsupported({
    input: notation,
    steps: [`Evaluate the definite integral ${mark(notation)}.`, reason],
    reason,
    answer,
    tips: [`Give ${letters.map((l) => mark(l)).join(' and ')} ${letters.length === 1 ? 'a number' : 'numbers'} to find the integral for that case.`],
  });
  if (!entireInX(integrand, v)) {
    return refuse(
      `The integrand has ${named} as well as ${mark(v)}, and for some ${letters.length === 1 ? 'value' : 'values'} of ${letters.map((l) => mark(l)).join(' or ')} it may not be defined somewhere in ${mark(`[${lowerLabel}, ${upperLabel}]`)}, which would make the integral improper. MasterMath works a definite integral with constants only when the integrand is defined at every ${mark(v)}.`,
      `Definite integrals with ${named} are worked only when the integrand is defined everywhere; this one may not be`,
    );
  }
  const forAlgebrite = rewriteReciprocalTrig(integrand);
  const F = run(Algebrite, `simplify(integral(${forAlgebrite}, ${v}))`);
  const dF = F && run(Algebrite, `d(${F}, ${v})`);
  if (!F || !dF || !expressionsEqualInAllLetters(dF, forAlgebrite)) {
    return refuse(`MasterMath could not find an antiderivative of ${mark(integrand)} with ${named} left as ${letters.length === 1 ? 'a letter' : 'letters'}.`, `This definite integral with ${named} could not be worked`);
  }
  const atBound = (bound) => F.replace(new RegExp(`(?<![a-z])${v}(?![a-z])`, 'g'), `(${bound})`);
  const value = run(Algebrite, `simplify((${atBound(upperRaw)}) - (${atBound(lowerRaw)}))`);
  if (!value || new RegExp(`(?<![a-z])${v}(?![a-z])`).test(value)) {
    return refuse(`MasterMath could not evaluate the antiderivative at the bounds with ${named} left as ${letters.length === 1 ? 'a letter' : 'letters'}.`, `This definite integral with ${named} could not be worked`);
  }
  const reqs = [...new Set([...constantRequirements(integrand, v), ...constantRequirements(F, v), ...constantRequirements(value, v)])];
  // The value against quadrature, at values of the constants the conditions allow.
  const samples = [1.3, -0.7, 2.1, 0.45, -1.9, 0.8];
  let checked = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const scope = Object.fromEntries(letters.map((l, j) => [l, samples[(i + j * 2) % samples.length]]));
    if (!reqs.every((r) => holds(r, scope))) continue;
    const want = simpson(forAlgebrite, v, a, b, scope);
    let got;
    try { got = math.evaluate(value, scope); } catch { got = NaN; }
    if (!Number.isFinite(want)) continue;
    if (typeof got !== 'number' || !(Math.abs(got - want) <= 1e-6 * Math.max(1, Math.abs(want)))) {
      return refuse(`The value MasterMath found for ${mark(notation)} did not agree with numerical integration, so it is not reported.`, `This definite integral with ${named} could not be worked`);
    }
    checked += 1;
  }
  if (checked < 2) return refuse(`MasterMath could not check its value for ${mark(notation)} numerically.`, `This definite integral with ${named} could not be worked`);

  // As a textbook writes it: a/2 (not 1/2·a), e^k − 1 (not −1 + e^k), ln(a)
  // where a > 0 is already required.
  const tidy = (t) => {
    let out = lnify(eForm(t))
      .replace(/(?<![\w.)])1\/(\d+)\*([a-z])(?![\w(])/g, '$2/$1')
      .replace(/\(-(\d+(?:\.\d+)?) \+ ([^()]+?)\)/g, '($2 - $1)');
    for (const r of reqs) {
      const pos = r.match(/^([a-z]) > 0$/i);
      if (pos) out = out.replace(new RegExp(`ln\\|${pos[1]}\\|`, 'g'), `ln(${pos[1]})`);
    }
    return out;
  };
  const shown = tidy(value);
  const at = (bound) => tidy(run(Algebrite, `simplify(${atBound(bound)})`) || '?');
  const steps = [
    `Evaluate the definite integral ${mark(notation)}. The ${letters.length === 1 ? 'constant' : 'constants'} ${letters.map((l) => mark(l)).join(' and ')} ${letters.length === 1 ? 'stays a letter' : 'stay letters'} throughout.`,
    `First find the antiderivative: ${mark(`F(${v}) = ${tidy(F)}`)}.`,
    `Apply the Fundamental Theorem of Calculus: ${mark(`∫_a^b f d${v} = F(b) − F(a)`)}.`,
    `Evaluate at the bounds: ${mark(`F(${upperLabel}) = ${at(upperRaw)}`)} and ${mark(`F(${lowerLabel}) = ${at(lowerRaw)}`)}.`,
    `Subtract: ${mark(`F(${upperLabel}) − F(${lowerLabel}) = ${shown}`)}.`,
  ];
  if (reqs.length) {
    steps.push(`This holds for ${reqs.map((r) => mark(r)).join(' and ')}: ${conditionsReason(reqs)}.`);
    for (const r of reqs) {
      const zero = r.match(/^([a-z]) ≠ 0$/i);
      if (!zero) continue;
      const g0 = math.simplify(String(integrand).replace(new RegExp(`(?<![a-z])${zero[1]}(?![a-z])`, 'g'), '0')).toString().replace(/\s*([*/])\s*/g, '$1');
      const v0 = run(Algebrite, `simplify(defint(${rewriteReciprocalTrig(g0)}, ${v}, ${lowerRaw}, ${upperRaw}))`);
      if (v0 && !new RegExp(`(?<![a-z])${zero[1]}(?![a-z])`).test(v0)) steps.push(`If ${mark(`${zero[1]} = 0`)}, the integrand is ${mark(g0)}, and the integral is ${mark(lnify(eForm(v0)))} instead.`);
    }
  }
  steps.push(`Checked by numerical integration at ${checked} values of ${letters.map((l) => mark(l)).join(' and ')}.`);
  return {
    steps,
    answer: `${notation} = ${shown}${reqs.length ? `, for ${reqs.join(' and ')}` : ''}`,
    tips: [
      `The Fundamental Theorem of Calculus: ${mark(`∫_a^b f d${v} = F(b) − F(a)`)}, where ${mark('F')} is any antiderivative.`,
      `A constant stays a letter through the working: integrate in ${mark(v)}, then put the bounds in for ${mark(v)} only.`,
      `No “${mark('+C')}” for a definite integral — the constant cancels in the subtraction.`,
    ],
    common_mistakes: [`Putting the bounds in for the constant as well as for ${mark(v)}.`, `Keeping the ${mark('+C')} — it cancels when you subtract ${mark('F(a)')} from ${mark('F(b)')}.`],
    graph: null,
  };
}
