// Shared by definite and improper integrals: an antiderivative evaluated at
// a bound (exactly, or numerically), quadrature, named constants, the graph
// of the area, and the refusals.

import {
  math,
  beautify,
  formatNumber,
  sampleFunction,
  rewriteReciprocalTrig,
  isAlgebriteFailure,
  mark,
} from '../solverUtils.js';
import { parseError, unsupported, diverges } from '../../solutionEnvelope.js';

export const isInfiniteBound = (t) => /^-?\s*(?:∞|inf(?:inity)?|oo|Infinity)\s*$/i.test(String(t).trim());
export const boundSign = (t) => (/^-/.test(String(t).trim()) ? -1 : 1);

// Name a limit value when it is a familiar constant.
const NAMED_CONSTANTS = [[Math.PI, 'π', 'pi'], [Math.PI / 2, 'π/2', 'pi/2'], [Math.PI / 4, 'π/4', 'pi/4'], [Math.PI / (2 * Math.SQRT2), 'π/(2√2)', 'pi/(2*sqrt(2))'], [Math.PI / Math.SQRT2, 'π/√2', 'pi/sqrt(2)'], [Math.PI / 3, 'π/3', 'pi/3'], [Math.PI / 6, 'π/6', 'pi/6'], [Math.E, 'e', 'exp(1)'], [1 / Math.E, '1/e', 'exp(-1)'], [Math.sqrt(Math.PI), '√π', 'sqrt(pi)'], [Math.sqrt(Math.PI) / 2, '√π/2', 'sqrt(pi)/2'], [Math.LN2, 'ln(2)', 'log(2)']];
export function nameConstant(v) {
  if (Math.abs(v) < 1e-9) return '0';
  for (const [c, t] of NAMED_CONSTANTS) {
    if (Math.abs(v - c) < 1e-6) return t;
    if (Math.abs(v + c) < 1e-6) return `-${t}`;
  }
  return null;
}
// The same, spelled for Algebrite; also small rationals.
export function constantRaw(v) {
  if (Math.abs(v) < 1e-9) return '0';
  for (const [c, , raw] of NAMED_CONSTANTS) {
    if (Math.abs(v - c) < 1e-6) return raw;
    if (Math.abs(v + c) < 1e-6) return `-(${raw})`;
  }
  const r = exactValueToRaw(v);
  return /^-?\d+(?:\/\d+)?$/.test(r) ? r : null;
}
// Algebrite's exact F(bound), unformatted, or null.
export function rawSubst(Algebrite, F, variable, at) {
  try {
    const out = String(Algebrite.run(`simplify(real(subst(${at}, ${variable}, ${F})))`)).trim();
    return isAlgebriteFailure(out) || /nil|Stop/.test(out) ? null : out;
  } catch { return null; }
}

// ∫_a^∞, ∫_-∞^b, ∫_-∞^∞ — as lim_{t→∞} ∫_a^t f, via the antiderivative.
// "= 1/3 (≈ 0.3333)" or "≈ 0.8883": a value that is only a decimal is not
// introduced by "=".
export function eqOrApprox(valueText) {
  return valueText.startsWith('≈') ? valueText : `= ${valueText}`;
}

export function finiteBoundValue(raw) {
  return Number(math.evaluate(String(raw).replace(/π/g, 'pi')));
}

// A numeric FTC value as display text: a small exact fraction when it is one
// (1, 1/2, 3/4), otherwise the decimal.
export function exactValueToRaw(value) {
  if (Number.isInteger(value)) return String(value);
  for (let den = 2; den <= 64; den += 1) {
    const num = value * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) return `${Math.round(num)}/${den}`;
  }
  return formatNumber(value);
}

// Evaluate an antiderivative at a bound, returning a clean exact string or null.
// Numeric F(at) via mathjs (which, unlike Algebrite, evaluates abs and sgn).
export function evalAntiderivNumeric(F, variable, at) {
  try {
    // Antiderivatives are shown as ln|·| and must be evaluated that way:
    // ½·log((x−1)/(x+1)) is real for x > 1 only if log means ln|·|. Without
    // this, ∫₂^∞ 1/(x²−1) dx sampled F as complex everywhere and was reported
    // divergent (it converges to ½ ln 3).
    const v = math.evaluate(F, { [variable]: at, log: (z) => (typeof z === 'number' ? Math.log(Math.abs(z)) : math.log(z)) });
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function evalAntiderivAt(Algebrite, F, variable, at) {
  try {
    // Algebrite has no sec/csc/cot: F(0) for ½(ln|sec x + tan x| + sec x tan x)
    // came back as ½·ln(sec(0)). Try the reciprocal-free form first and keep
    // it when it reduces to a plain constant (0); otherwise the original
    // form, which reads as written.
    const rewritten = rewriteReciprocalTrig(F);
    if (rewritten !== F) {
      const viaRewrite = String(Algebrite.run(`simplify(real(subst(${at}, ${variable}, ${rewritten})))`)).trim();
      if (!isAlgebriteFailure(viaRewrite) && !/[a-z]\(/i.test(viaRewrite)) return formatExactValue(viaRewrite);
    }
    const out = String(Algebrite.run(`simplify(real(subst(${at}, ${variable}, ${F})))`)).trim();
    if (isAlgebriteFailure(out)) return null;
    return formatExactValue(out);
  } catch {
    return null;
  }
}

// Simpson's rule with singularity detection. Returns the numeric value, or the
// string 'IMPROPER' when the integrand has a pole strictly inside [a, b]
// (endpoint singularities, which are often integrable, are nudged and kept).
export function numericIntegral(integrand, variable, a, b, N = 2000) {
  if (a === b) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const h = (hi - lo) / N;

  const fx = (x) => {
    try {
      const y = math.evaluate(integrand, { [variable]: x });
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  };

  // An integrable singularity AT an endpoint (1/√x at 0) makes uniform
  // Simpson converge too slowly to pass the exact-vs-numeric cross-check.
  // Substitute x = lo + (hi−lo)·t³ (or the mirror image at hi): the mesh is
  // graded toward the singular end and the transformed integrand,
  // f(x(t))·3(hi−lo)t², is tame. Interior poles are still reported IMPROPER.
  const singularLo = !Number.isFinite(fx(lo)) && Number.isFinite(fx(lo + h / 997));
  const singularHi = !Number.isFinite(fx(hi)) && Number.isFinite(fx(hi - h / 997));
  if (singularLo !== singularHi) {
    const L = hi - lo;
    const g = (t) => {
      const x = singularLo ? lo + L * t * t * t : hi - L * t * t * t;
      const y = fx(x);
      return Number.isFinite(y) ? y * 3 * L * t * t : NaN;
    };
    let tsum = 0;
    const th = 1 / N;
    for (let i = 0; i <= N; i += 1) {
      let y = g(i * th);
      if (!Number.isFinite(y)) {
        if (i !== 0 && i !== N) return 'IMPROPER';
        y = 0; // t = 0 maps to the singular endpoint; the weight t² kills it
      }
      if (i !== 0 && i !== N && Math.abs(y) > 1e9) return 'IMPROPER';
      tsum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * y;
    }
    const value = (tsum * th) / 3;
    return b < a ? -value : value;
  }

  let sum = 0;
  for (let i = 0; i <= N; i += 1) {
    const interior = i !== 0 && i !== N;
    const x = lo + i * h;
    let y = fx(x);
    if (!Number.isFinite(y)) {
      // A non-finite value strictly inside the interval is a pole — the
      // integral is improper. Endpoints are often integrable singularities
      // (∫₀¹ ln x dx), so nudge inward and keep them.
      if (interior) return 'IMPROPER';
      y = fx(x + (i === N ? -1 : 1) * (h / 997));
      if (!Number.isFinite(y)) y = 0;
    }
    if (interior && Math.abs(y) > 1e9) return 'IMPROPER';
    sum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * y;
  }

  const value = (sum * h) / 3;
  return b < a ? -value : value;
}

// Algebrite exact strings use log/pi/exp; present them the textbook way.
export function formatExactValue(raw) {
  let s = beautify(String(raw));
  s = s
    .replace(/\bexp\(1\)/g, 'e')
    .replace(/\bexp\(([^()]+)\)/g, 'e^($1)')
    .replace(/\blog\(((?:[^()]|\([^()]*\))+)\)/g, 'ln($1)')
    .replace(/\bpi\b/g, 'π')
    .replace(/(?<![\w.])(\d+)\^\(1\/2\)/g, '√$1');
  return s;
}

// kind 'parse' = the bounds/notation couldn't be read; 'unsupported' = the
// notation was fine but the value couldn't be computed trustworthily.
export function refuseDefinite(reason, notation, kind = 'unsupported') {
  const steps = [];
  if (notation) steps.push(`Evaluate the definite integral ${mark(notation)}.`);
  steps.push(reason);
  steps.push('Tip: check the bounds and the integrand, or find the antiderivative F and compute F(upper) − F(lower).');
  const fields = {
    steps,
    answer: reason,
    tips: [`A definite integral needs a lower and an upper bound, e.g. ${mark('∫_0^1 x^2 dx')}.`],
    common_mistakes: ['Bounds that cannot be parsed as numbers.', 'An integrand with no elementary antiderivative.'],
  };
  return kind === 'parse' ? parseError(fields) : unsupported(fields);
}

// The integrand is unbounded at an endpoint and the antiderivative has no
// finite limit there: the improper integral diverges.
export function refuseImproperAt(notation, variable, at, integrand) {
  return diverges({
    input: notation,
    reason: `The integrand ${beautify(integrand)} is unbounded as ${variable} → ${at}, and its antiderivative has no finite value there — this improper integral diverges (it has no finite value).`,
    answer: `Diverges — the integral has no finite value (unbounded at ${variable} = ${at})`,
    steps: [
      `Evaluate the definite integral ${mark(notation)}.`,
      `The integrand blows up at the endpoint ${mark(`${variable} = ${at}`)}, so this is an improper integral: it means ${mark(`lim (t→${at})`)} of the integral over the rest of the interval.`,
      'That limit does not exist as a finite number — the area grows without bound — so the integral diverges.',
    ],
    tips: [
      `An improper integral converges only if the limit toward the singular endpoint is finite: ${mark('∫₀¹ 1/√x dx = 2')} converges, ${mark('∫₀¹ 1/x dx')} diverges.`,
      `Compare with a p-integral: ${mark('∫₀¹ 1/xᵖ dx')} converges for ${mark('p < 1')} and diverges for ${mark('p ≥ 1')}.`,
    ],
    common_mistakes: [`Applying ${mark('F(b) − F(a)')} at a point where ${mark('F')} is not defined.`],
  });
}

export function refuseImproper(notation, variable) {
  return unsupported({
    steps: [
      `Evaluate the definite integral ${mark(notation)}.`,
      'The integrand is unbounded somewhere in the interval, so this is an improper integral: it must be split at the singularity and each piece taken as a one-sided limit.',
      'MasterMath could not locate the singularity precisely or evaluate those one-sided limits reliably here, so it does not report a value rather than apply F(b) − F(a) across the break.',
    ],
    answer: 'Improper integral — MasterMath could not evaluate the one-sided limits at the singularity',
    tips: [
      `Split the integral at the discontinuity and take one-sided limits to test convergence.`,
      `For example, ${mark(`∫ 1/${variable}`)} over an interval containing ${mark('0')} diverges — it has no finite value.`,
    ],
    common_mistakes: [
      `Blindly applying ${mark('F(b) − F(a)')} across a vertical asymptote — that gives a confident but meaningless number.`,
    ],
  });
}

// Graph f(x) with the integration interval [a, b] shaded — the definite
// integral IS that signed area. Samples a padded window so the region sits in
// context and the viewer can pan out.
export function generateDefiniteGraph(integrand, variable, a, b, lowerLabel, upperLabel, value) {
  try {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const pad = Math.max((hi - lo) * 1.5, 4);
    const points = sampleFunction(integrand, variable, {
      min: lo - pad,
      max: hi + pad,
      step: Math.max((hi - lo + 2 * pad) / 400, 0.02),
      cap: 1e5,
    });
    if (points.length === 0) return null;

    return {
      points,
      title: `Area under f(${variable}) = ${beautify(integrand)}`,
      description: Number.isFinite(value)
        ? `The shaded region from ${variable} = ${lowerLabel} to ${variable} = ${upperLabel} has signed area ${formatNumber(value)}.`
        : `The integral from ${variable} = ${lowerLabel} to ${variable} = ${upperLabel} diverges — the shaded region has no finite area.`,
      annotations: {
        shaded: { from: a, to: b, fromLabel: lowerLabel, toLabel: upperLabel },
      },
      initialWindow: { xMin: lo - pad / 2, xMax: hi + pad / 2 },
    };
  } catch (error) {
    console.error('Definite integral graph error:', error);
    return null;
  }
}
