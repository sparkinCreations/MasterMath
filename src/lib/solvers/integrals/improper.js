// Improper integrals: an infinite bound taken as a limit, a singular
// endpoint, and an asymptote inside the interval (split there, with the
// principal value noted when the halves diverge).

import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  rewriteReciprocalTrig,
  isAlgebriteFailure,
  lnify,
  mark,
} from '../solverUtils.js';
import { unsupported, diverges } from '../../solutionEnvelope.js';
import { antiderivativeViaTerms } from './terms.js';
import {
  evalAntiderivNumeric,
  isInfiniteBound,
  finiteBoundValue,
  nameConstant,
  generateDefiniteGraph,
  boundSign,
  evalAntiderivAt,
  rawSubst,
  constantRaw,
  formatExactValue,
  eqOrApprox,
  numericIntegral,
  refuseDefinite,
  exactValueToRaw,
} from './evaluate.js';

// lim F(t) as t → ±∞, by sampling. Returns { value } (finite limit),
// { diverges: '∞' | '-∞' } or { undefined: true } (oscillates / unreadable).
function limitAtInfinity(F, variable, sign) {
  const samples = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((m) => evalAntiderivNumeric(F, variable, sign * m));
  const finite = samples.filter(Number.isFinite);
  if (finite.length === 0) return { unreadable: true, samples };
  if (finite.length < 3) {
    const last = finite[finite.length - 1];
    return { diverges: last > 0 ? '∞' : '-∞', samples };
  }
  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  const diffs = finite.slice(1).map((v, i) => Math.abs(v - finite[i]));
  const shrinking = diffs.slice(-3).every((d, i, arr) => i === 0 || d <= arr[i - 1] * 1.01);
  if (Math.abs(last - prev) < 1e-6 * (1 + Math.abs(last)) || (shrinking && Math.abs(last - prev) < 1e-4 * (1 + Math.abs(last)))) {
    return { value: last, samples };
  }
  if (Math.abs(last) > Math.abs(prev) * 2 && Math.abs(last) > 1e3) return { diverges: last > 0 ? '∞' : '-∞', samples };
  // Slow but steady growth (ln t, √t): every step in the same direction and
  // the steps not shrinking away — that is divergence, not oscillation.
  const signedDiffs = finite.slice(1).map((v, i) => v - finite[i]);
  const sameDir = signedDiffs.every((d) => d > 0) || signedDiffs.every((d) => d < 0);
  const notShrinking = Math.abs(signedDiffs[signedDiffs.length - 1]) >= 0.5 * Math.abs(signedDiffs[0]);
  if (sameDir && notShrinking) return { diverges: last > 0 ? '∞' : '-∞', slow: true, samples };
  return { undefined: true, samples };
}

// A numerical estimate of ∫_a^b f with a = −∞ and/or b = ∞, reported only
// when three things agree: the integrals to growing finite bounds settle,
// and a mapped quadrature of the whole range (x = c + t/(1 − t) on [0, 1))
// at two step sizes gives the same number as those and as each other. Null
// otherwise — a slow tail (1/x^1.1) or a divergent one fails here, and the
// caller refuses.
function numericImproper(integrand, v, a, b) {
  const fx = (x) => {
    try {
      const y = math.evaluate(integrand, { [v]: x });
      return typeof y === 'number' && Number.isFinite(y) ? y : NaN;
    } catch {
      return NaN;
    }
  };
  // Simpson on [0, 1) of the mapped integrand; the end t = 1 is the point at
  // infinity, where a convergent integrand's weight is 0.
  // The same mapping serves the truncated integrals (t up to T/(1 + T)):
  // the mesh stays dense where the integrand lives, near the finite end,
  // where a uniform mesh over [a, 10000] would have steps of 2.5.
  const mapped = (c, sign, N, tMax = 1) => {
    const g = (t) => {
      if (t >= 1) return 0;
      const x = c + sign * (t / (1 - t));
      const y = fx(x);
      return Number.isFinite(y) ? y / ((1 - t) * (1 - t)) : NaN;
    };
    const h = tMax / N;
    let sum = 0;
    for (let i = 0; i <= N; i += 1) {
      const y = g(i * h);
      if (!Number.isFinite(y)) return NaN;
      sum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * y;
    }
    return (sum * h) / 3;
  };
  const tail = (c, sign) => {
    const coarse = mapped(c, sign, 4000);
    const fine = mapped(c, sign, 8000);
    if (!Number.isFinite(coarse) || !Number.isFinite(fine) || Math.abs(fine - coarse) > 1e-7 * (1 + Math.abs(fine))) return null;
    return fine;
  };
  const bothInfinite = a === -Infinity && b === Infinity;
  const c = bothInfinite ? 0 : (a === -Infinity ? b : a);
  const sides = [];
  if (b === Infinity) sides.push(1);
  if (a === -Infinity) sides.push(-1);
  const parts = sides.map((sign) => tail(c, sign));
  if (parts.some((p) => p === null)) return null;
  const value = parts.reduce((acc, p) => acc + p, 0);
  // The truncated integrals must settle toward the same value.
  const Ts = [100, 1000, 10000];
  const truncated = Ts.map((T) => {
    const val = sides.reduce((acc, sign) => acc + mapped(c, sign, 4000, T / (1 + T)), 0);
    return [T, val];
  });
  if (truncated.some(([, val]) => !Number.isFinite(val))) return null;
  const last = truncated[truncated.length - 1][1];
  const prev = truncated[truncated.length - 2][1];
  if (Math.abs(last - value) > 1e-3 * (1 + Math.abs(value))) return null;
  if (Math.abs(last - prev) > Math.abs(prev - truncated[0][1]) + 1e-9 && Math.abs(last - prev) > 1e-6) return null;
  return { value, truncated };
}

export async function solveImproperInfinite(parsed, notation) {
  const { integrand, variable: v, lowerRaw, upperRaw, lowerLabel, upperLabel } = parsed;
  const Algebrite = await loadAlgebrite();
  const lowerInf = isInfiniteBound(lowerRaw);
  const upperInf = isInfiniteBound(upperRaw);
  const steps = [`Evaluate the improper integral ${mark(notation)}.`];
  const which = lowerInf && upperInf ? 'both limits are infinite' : `the ${upperInf ? 'upper' : 'lower'} limit is ${upperInf ? upperLabel : lowerLabel}`;
  steps.push(`This is an improper integral — ${which}. It is defined as a limit of proper integrals: ${mark(lowerInf && upperInf ? `∫_{-∞}^{∞} f d${v} = lim_{s→-∞} ∫_s^0 f d${v} + lim_{t→∞} ∫_0^t f d${v}` : upperInf ? `∫_${lowerLabel}^∞ f d${v} = lim_{t→∞} ∫_${lowerLabel}^t f d${v}` : `∫_{-∞}^${upperLabel} f d${v} = lim_{s→-∞} ∫_s^${upperLabel} f d${v}`)}.`);

  const F = await antiderivativeViaTerms(integrand, v, Algebrite);
  if (!F) {
    // No antiderivative: the limit is estimated numerically when the
    // truncated integrals settle (1.57.0); otherwise the honest refusal.
    const estimate = numericImproper(integrand, v, lowerInf ? -Infinity : finiteBoundValue(lowerRaw), upperInf ? Infinity : finiteBoundValue(upperRaw));
    if (estimate) {
      const approx = formatNumber(estimate.value);
      const named = nameConstant(estimate.value);
      const truncated = estimate.truncated.map(([T, val]) => `${mark(`${formatNumber(T)}`)} gives ${mark(`≈ ${formatNumber(val, 6)}`)}`).join(', ');
      const rangeWord = lowerInf && upperInf ? 'from −t to t' : upperInf ? `from ${lowerLabel} to t` : `from −t to ${upperLabel}`;
      steps.push(`No antiderivative of ${mark(beautify(integrand))} was found by this solver's methods, so the limit is estimated numerically. Integrating ${rangeWord}: ${mark('t')} = ${truncated}; the values settle as the bound grows.`);
      steps.push(`A change of variable that maps the infinite range onto ${mark('[0, 1)')} gives the limit directly: ${mark(`≈ ${formatNumber(estimate.value, 8)}`)}, agreeing with the truncated values${named && named !== approx ? `, and with ${mark(named)} to the digits shown (a numerical estimate cannot prove the exact form)` : ''}.`);
      steps.push(`The limit is finite, so the integral converges: ${mark(`≈ ${approx}`)} (numerical).`);
      return {
        steps,
        answer: `${notation} ≈ ${approx} (numerical)`,
        tips: [
          `An improper integral is a limit: replace the infinite bound by ${mark('t')}, integrate, then let ${mark('t → ∞')}. Here the integral to ${mark('t')} was computed numerically for growing ${mark('t')} and seen to settle.`,
          `A numerical value gives the digits two estimates agree on, not an antiderivative; a trigonometric identity, a substitution or partial fractions by hand may give the exact form.`,
          `It converges only when the integrand dies away fast enough: ${mark('∫₁^∞ 1/x^p dx')} converges exactly when ${mark('p > 1')}.`,
        ],
        common_mistakes: [
          `Writing the estimate as an exact value: ${mark(`≈ ${approx}`)} is correct to the digits shown.`,
          `Plugging ${mark('∞')} into a formula as if it were a number — the integral is a limit.`,
          `Assuming a function that tends to ${mark('0')} has a convergent integral (${mark('1/x → 0')} but ${mark('∫₁^∞ 1/x dx = ∞')}).`,
        ],
        graph: generateDefiniteGraph(integrand, v, lowerInf ? -10 : finiteBoundValue(lowerRaw), upperInf ? 10 : finiteBoundValue(upperRaw), lowerLabel, upperLabel, estimate.value),
      };
    }
    const reason = 'The antiderivative could not be found, and the numerical estimates of this improper integral do not settle (the integral to a growing bound keeps changing, as it does for a slow tail or an oscillating integrand), so no value is reported.';
    return unsupported({
      input: notation,
      reason,
      answer: 'This improper integral is beyond what this solver can compute',
      steps: [...steps, reason],
    });
  }
  const showF = (t) => lnify(t).replace(/\bexp\(([^()]+)\)/g, 'e^($1)');
  steps.push(`Antiderivative: ${mark(`F(${v}) = ${showF(F)}`)}.`);

  // Each infinite end contributes lim F; each finite end contributes F(bound).
  const ends = [];
  const finiteBoundVal = (raw) => Number(math.evaluate(String(raw).replace(/π/g, 'pi')));
  const describeLimit = (sign, res) => {
    const arrow = sign > 0 ? 't → ∞' : 's → -∞';
    const shown = (res.samples || []).slice(0, 4).map((x) => (Number.isFinite(x) ? formatNumber(x) : '±∞')).join(', ');
    const at = sign > 0 ? '10², 10³, 10⁴, 10⁵' : '-10², -10³, -10⁴, -10⁵';
    if (res.value !== undefined) steps.push(`As ${mark(arrow)}, ${mark(`F(${sign > 0 ? 't' : 's'}) → ${nameConstant(res.value) ?? formatNumber(res.value)}`)} (samples at ${at}: ${shown}).`);
    else if (res.diverges) steps.push(`As ${mark(arrow)}, ${mark(`F(${sign > 0 ? 't' : 's'}) → ${res.diverges}`)}${res.slow ? ' — slowly, but steadily' : ''} (samples: ${shown}): the limit is not a finite number.`);
    else steps.push(`As ${mark(arrow)}, ${mark(`F(${sign > 0 ? 't' : 's'})`)} does not settle (samples: ${shown}).`);
  };

  let upperPart;
  let lowerPart;
  if (upperInf) {
    const res = limitAtInfinity(F, v, boundSign(upperRaw));
    describeLimit(boundSign(upperRaw), res);
    upperPart = res;
  } else {
    const val = finiteBoundVal(upperRaw);
    const exact = evalAntiderivAt(Algebrite, F, v, upperRaw);
    const num = evalAntiderivNumeric(F, v, val);
    upperPart = { value: num, exact, raw: rawSubst(Algebrite, F, v, upperRaw) };
    steps.push(`${mark(`F(${upperLabel}) = ${exact ?? formatNumber(num)}`)}.`);
  }
  if (lowerInf) {
    const res = limitAtInfinity(F, v, boundSign(lowerRaw));
    describeLimit(boundSign(lowerRaw), res);
    lowerPart = res;
  } else {
    const val = finiteBoundVal(lowerRaw);
    const exact = evalAntiderivAt(Algebrite, F, v, lowerRaw);
    const num = evalAntiderivNumeric(F, v, val);
    lowerPart = { value: num, exact, raw: rawSubst(Algebrite, F, v, lowerRaw) };
    steps.push(`${mark(`F(${lowerLabel}) = ${exact ?? formatNumber(num)}`)}.`);
  }

  if ([upperPart, lowerPart].some((p) => p.unreadable)) {
    const reason = 'The antiderivative could not be evaluated numerically far out, so the limit defining this improper integral cannot be checked here.';
    return unsupported({
      input: notation,
      reason,
      answer: 'This improper integral is beyond what this solver can compute',
      steps: [...steps, reason],
    });
  }
  const divergent = [upperPart, lowerPart].find((p) => p.diverges || p.undefined);
  if (divergent) {
    if (upperPart.diverges && lowerPart.diverges && upperPart.diverges !== lowerPart.diverges) {
      steps.push('Both ends run off to infinity in the same direction of F, so the difference is ∞ − ∞ — the integral does not converge.');
    } else if (divergent.diverges) {
      steps.push('The limit is infinite, so the integral diverges.');
    } else {
      steps.push('The limit does not exist, so the integral does not converge.');
    }
    return {
      steps,
      answer: `${notation} diverges`,
      status: 'diverges',
      tips: ['An improper integral converges only if the limit defining it is a finite number.', `Compare with ${mark('∫₁^∞ 1/x^p dx')}: it converges for ${mark('p > 1')} and diverges for ${mark('p ≤ 1')}.`],
      common_mistakes: [`Treating ${mark('∞')} as a number and "plugging it in" — the integral is a limit, and it can fail to exist.`, `Assuming a function that tends to ${mark('0')} has a convergent integral (${mark('1/x → 0')} but ${mark('∫₁^∞ 1/x dx = ∞')}).`],
      graph: generateDefiniteGraph(integrand, v, lowerInf ? -10 : finiteBoundVal(lowerRaw), upperInf ? 10 : finiteBoundVal(upperRaw), lowerLabel, upperLabel, NaN),
    };
  }

  const value = upperPart.value - lowerPart.value;
  // Exact form when the infinite ends contribute a nameable constant.
  const partText = (p, isUpper) => (p.exact !== undefined && p.exact !== null ? p.exact : (nameConstant(p.value) ?? formatNumber(p.value)));
  const upText = partText(upperPart, true);
  const lowText = partText(lowerPart, false);
  let exactText = null;
  try {
    // Ask Algebrite to simplify "upper − lower" when both are exact-able.
    const upRaw = upperPart.raw ?? constantRaw(upperPart.value);
    const lowRaw = lowerPart.raw ?? constantRaw(lowerPart.value);
    if (upRaw !== null && lowRaw !== null) {
      const toAlg = (t) => t.replace(/√π/g, 'sqrt(pi)').replace(/√(\d+)/g, 'sqrt($1)').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
      // real(): the ln|·| convention — log of a negative at a finite bound
      // contributes an i·π that the absolute value removes.
      const raw = String(Algebrite.run(`simplify(real((${toAlg(upRaw)}) - (${toAlg(lowRaw)})))`)).trim();
      if (!isAlgebriteFailure(raw) && !/nil|Stop|\bi\b/.test(raw)) {
        exactText = formatExactValue(raw)
          .replace(/^1\/(\d+)\*(π|e|√π|sqrt\(π\))$/, '$2/$1')
          .replace(/^1\/(\d+)\*π\^\(1\/2\)$/, '√π/$1')
          .replace(/π\^\(1\/2\)/g, '√π');
      }
    }
  } catch { exactText = null; }
  const approx = formatNumber(value);
  const valueText = exactText && exactText !== approx ? `${exactText} (≈ ${approx})` : (exactText || `≈ ${approx}`);
  steps.push(`Subtract: ${mark(`${upText} − (${lowText}) ${eqOrApprox(valueText)}`)}. The limit is finite, so the integral converges.`);

  // Cross-check by quadrature over a long finite stretch.
  const lo = lowerInf ? -200 : finiteBoundVal(lowerRaw);
  const hi = upperInf ? 200 : finiteBoundVal(upperRaw);
  const check = numericIntegral(integrand, v, lo, hi, 4000);
  const agrees = typeof check === 'number' && Number.isFinite(check) && Math.abs(check - value) < Math.max(0.05, Math.abs(value) * 0.05);
  if (typeof check === 'number' && Number.isFinite(check) && !agrees) {
    // A slowly-decaying tail can make the finite check fall short; only refuse when
    // the mismatch is gross.
    if (Math.abs(check - value) > Math.max(0.5, Math.abs(value) * 0.5)) {
      return refuseDefinite('The limit value and a numeric check disagree, so no value is reported.', notation);
    }
  }
  steps.push(`Check: integrating numerically over a long finite stretch gives ${mark(`≈ ${typeof check === 'number' ? formatNumber(check) : '—'}`)}, consistent with the limit.`);

  return {
    steps,
    answer: `${notation} ${eqOrApprox(valueText)}`,
    tips: [
      `An improper integral is a limit: replace the infinite bound by ${mark('t')}, integrate, then let ${mark('t → ∞')}.`,
      `It converges when that limit is finite; ${mark('∫₁^∞ 1/x^p dx')} converges exactly when ${mark('p > 1')}.`,
      `Comparison decides many tails without integrating: if ${mark('0 ≤ f(x) ≤ 1/x²')} for large ${mark('x')}, then ${mark('∫^∞ f dx')} converges too.`,
      `An exponential decays faster than any power, so ${mark('∫_0^∞ e^(−x) dx = 1')} and ${mark('∫_0^∞ x^n·e^(−x) dx = n!')} all converge.`,
    ],
    common_mistakes: [`Plugging ${mark('∞')} into ${mark('F')} as if it were a number.`, `Forgetting that a limit can fail to exist even when the integrand tends to ${mark('0')}.`],
    graph: generateDefiniteGraph(integrand, v, lowerInf ? Math.min(-10, hi - 10) : finiteBoundVal(lowerRaw), upperInf ? Math.max(10, lo + 10) : finiteBoundVal(upperRaw), lowerLabel, upperLabel, value),
  };
}

// The integrand is unbounded at one (or both) endpoints of [a, b]: the
// integral is improper there and is DEFINED as a one-sided limit,
// ∫_a^b = lim (t→a⁺) ∫_t^b. F(b) − F(a) with F evaluated at the singular
// endpoint is not valid reasoning — ∫₀¹ 1/√x used to show "F(0) = 0" and
// ∫₀¹ ln x "F(0) = 0" as if the Fundamental Theorem applied there. Now the
// limit of F toward the endpoint is taken explicitly: finite → converges
// (value shown as the limit), unbounded → diverges. Returns null when no
// endpoint is singular, so the ordinary path runs. (September 2026 review.)
export async function integrateAtSingularEndpoint({ integrand, v, a, b, lowerRaw, upperRaw, lowerLabel, upperLabel, notation, Algebrite }) {
  try {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo === hi) return null;
    const L = hi - lo;
    const f = (x) => evalAntiderivNumeric(integrand, v, x);

    // Unbounded at the edge: undefined (or astronomically large) AT the
    // endpoint, finite just inside, and growing in magnitude as the probes
    // approach it. sin(x)/x at 0 (undefined but bounded) is not singular.
    const unboundedAt = (edge, dir) => {
      const y0 = f(edge);
      const probes = [1e-4, 1e-6, 1e-8].map((eps) => f(edge + dir * eps * Math.max(L, 1)));
      if (!probes.every(Number.isFinite)) return 0;
      const growing = Math.abs(probes[1]) > Math.abs(probes[0]) + 1 && Math.abs(probes[2]) > Math.abs(probes[1]) + 1;
      return (!Number.isFinite(y0) || Math.abs(y0) > 1e12) && growing ? Math.sign(probes[2]) : 0;
    };
    const loSign = unboundedAt(lo, 1);
    const hiSign = unboundedAt(hi, -1);
    const singularLo = loSign !== 0;
    const singularHi = hiSign !== 0;
    const infinity = (sign) => (sign < 0 ? '−∞' : '+∞');
    if (!singularLo && !singularHi) return null;

    let F = await antiderivativeViaTerms(integrand, v, Algebrite);
    if (!F) {
      try { F = Algebrite.integral(rewriteReciprocalTrig(integrand), v).toString(); } catch { F = null; }
    }
    if (!F || isAlgebriteFailure(F) || /integral/i.test(F)) {
      return refuseDefinite('The integrand is unbounded at an endpoint (an improper integral), and MasterMath could not find an antiderivative to take the limit with.', notation);
    }
    const Fat = (x) => evalAntiderivNumeric(F, v, x);

    // One-sided limit of F at a singular endpoint along a shrinking ladder:
    // the finite value it settles to, or NaN when it keeps growing.
    const limitToward = (edge, dir) => {
      const vals = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10].map((eps) => Fat(edge + dir * eps * Math.max(L, 1)));
      if (vals.some((y) => !Number.isFinite(y))) return { value: NaN, samples: vals };
      const [p, q, r] = vals.slice(-3);
      const settling = Math.abs(r - q) <= Math.abs(q - p) + 1e-12 && Math.abs(r - q) < 1e-3 * (1 + Math.abs(r));
      return { value: settling ? r : NaN, samples: vals };
    };
    // Exact value of the limit when Algebrite can take F at the endpoint
    // symbolically and it agrees with the numeric ladder (2√x → 0 at 0).
    const exactLimit = (raw, numeric) => {
      try {
        const out = String(Algebrite.run(`simplify(real(subst(${raw}, ${v}, ${F})))`)).trim();
        if (isAlgebriteFailure(out) || /\bi\b|nan|inf/i.test(out) || new RegExp(`\\b${v}\\b`).test(out)) return null;
        const n = Number(math.evaluate(out));
        return Number.isFinite(n) && Math.abs(n - numeric) < 1e-3 * (1 + Math.abs(n)) ? out : null;
      } catch { return null; }
    };
    const rawOf = (edge) => (edge === a ? lowerRaw : upperRaw);
    const labelOf = (edge) => (edge === a ? lowerLabel : upperLabel);

    const ends = [
      { edge: lo, dir: 1, side: '⁺', singular: singularLo, symbol: 's', integrandSign: loSign },
      { edge: hi, dir: -1, side: '⁻', singular: singularHi, symbol: 't', integrandSign: hiSign },
    ];
    for (const end of ends) {
      end.label = labelOf(end.edge);
      end.raw = rawOf(end.edge);
      if (end.singular) {
        const lim = limitToward(end.edge, end.dir);
        end.numeric = lim.value;
        end.samples = lim.samples;
        end.exact = Number.isFinite(lim.value) ? (exactLimit(end.raw, lim.value) || exactValueToRaw(Math.abs(lim.value) < 1e-6 ? 0 : lim.value)) : null;
      } else {
        end.numeric = Fat(end.edge);
        end.exact = evalAntiderivAt(Algebrite, F, v, end.raw);
        if (!Number.isFinite(end.numeric)) return null;
      }
    }
    const [loEnd, hiEnd] = ends;
    const singularEnds = ends.filter((e) => e.singular);
    const FofT = (sym) => lnify(F.replace(new RegExp(`\\b${v}\\b`, 'g'), sym));

    const limitNotation = singularEnds
      .map((e) => `lim (${e.symbol}→${e.label}${e.side})`)
      .join(' ');
    const reversed = b < a;
    const ordered = `∫_${loEnd.label}^${hiEnd.label}`;
    const innerBounds = `∫_${singularLo ? 's' : loEnd.label}^${singularHi ? 't' : hiEnd.label}`;
    const why = singularEnds.map((e) => `${mark(`${v} = ${e.label}`)} (the integrand → ${mark(infinity(e.integrandSign))} as ${mark(`${v} → ${e.label}${e.side}`)})`).join(' and at ');
    const steps = [
      `Evaluate the definite integral ${mark(notation)}.`,
      `The integrand ${mark(beautify(integrand))} is undefined at the endpoint ${why}, so this is an improper integral. The Fundamental Theorem cannot be applied at that point; instead the integral is defined as a limit: ${mark(`${ordered} = ${limitNotation} ${innerBounds} (${beautify(integrand)}) d${v}`)}.${reversed ? ` (The bounds are written in reverse order: ${mark(`${notation.replace(/ \(.*$/, '')} = −${ordered}`)}.)` : ''}`,
      `Find the antiderivative: ${mark(`F(${v}) = ${lnify(F)}`)}.`,
      `Inside the interval the Fundamental Theorem applies: ${mark(`${innerBounds} = F(${singularHi ? 't' : hiEnd.label}) − F(${singularLo ? 's' : loEnd.label}) = ${singularHi ? FofT('t') : (hiEnd.exact ? formatExactValue(hiEnd.exact) : formatNumber(hiEnd.numeric))} − (${singularLo ? FofT('s') : (loEnd.exact ? formatExactValue(loEnd.exact) : formatNumber(loEnd.numeric))})`)}.`,
    ];

    const shownSamples = (e) => e.samples.slice(0, 4).map((y) => formatNumber(y)).join(', ');
    const divergent = singularEnds.find((e) => !Number.isFinite(e.numeric));
    if (divergent) {
      const finiteSamples = divergent.samples.filter(Number.isFinite);
      const direction = finiteSamples.length >= 2 ? infinity(Math.sign(finiteSamples[finiteSamples.length - 1] - finiteSamples[finiteSamples.length - 2])) : 'infinity';
      steps.push(`Take the limit: as ${mark(`${divergent.symbol} → ${divergent.label}${divergent.side}`)}, ${mark(`F(${divergent.symbol}) → ${direction}`)} (samples: ${mark(`${shownSamples(divergent)}, …`)}), so the limit is not a finite number.`);
      steps.push('The integral diverges — the area under the curve near that endpoint is infinite.');
      return diverges({
        input: notation,
        answer: `Diverges — the integral has no finite value (unbounded at ${v} = ${divergent.label})`,
        steps,
        tips: [
          `An improper integral converges only if the limit toward the singular endpoint is finite: ${mark(`∫₀¹ 1/√${v} d${v} = 2`)} converges, ${mark(`∫₀¹ 1/${v} d${v}`)} diverges.`,
          `Compare with a p-integral: ${mark(`∫₀¹ 1/${v}ᵖ d${v}`)} converges for ${mark('p < 1')} and diverges for ${mark('p ≥ 1')}.`,
        ],
        common_mistakes: [`Applying ${mark('F(b) − F(a)')} at a point where ${mark('F')} is not defined.`, 'Assuming an integral is finite because the interval is.'],
        graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, NaN),
      });
    }

    // Convergent: value = F(hi end) − F(lo end), each a limit where singular.
    const valueNumeric = hiEnd.numeric - loEnd.numeric;
    let exactRaw = null;
    if (hiEnd.exact && loEnd.exact) {
      try {
        const out = String(Algebrite.run(`simplify((${hiEnd.exact}) - (${loEnd.exact}))`)).trim();
        if (!isAlgebriteFailure(out) && !/\bi\b/.test(out)) {
          const n = Number(math.evaluate(out));
          if (Number.isFinite(n) && Math.abs(n - valueNumeric) < 1e-3 * (1 + Math.abs(n))) exactRaw = out;
        }
      } catch { /* numeric form below */ }
    }
    if (!exactRaw) exactRaw = exactValueToRaw(valueNumeric);
    const exactValue = Number(math.evaluate(exactRaw));

    // Independent check: quadrature with a mesh graded toward the singular
    // endpoint (numericIntegral handles exactly one singular endpoint); when
    // both ends are singular, check a shrinking sequence of inner intervals.
    let check;
    if (singularLo !== singularHi) {
      check = numericIntegral(integrand, v, lo, hi);
    } else {
      // Split at the midpoint so each half has one singular end for the
      // graded mesh to handle.
      const mid = (lo + hi) / 2;
      const halves = [numericIntegral(integrand, v, lo, mid), numericIntegral(integrand, v, mid, hi)];
      check = halves.every(Number.isFinite) ? halves[0] + halves[1] : NaN;
    }
    if (!Number.isFinite(check) || Math.abs(check - exactValue) > Math.max(1e-2, Math.abs(exactValue) * 1e-2)) {
      return refuseDefinite('The integrand is unbounded at an endpoint (an improper integral), and the limit of the antiderivative could not be confirmed numerically, so no value is reported.', notation);
    }

    for (const e of singularEnds) {
      steps.push(`Take the limit: as ${mark(`${e.symbol} → ${e.label}${e.side}`)}, ${mark(`F(${e.symbol}) → ${formatExactValue(e.exact)}`)} (samples: ${mark(`${shownSamples(e)}, …`)}). The limit is finite, so the integral converges.`);
    }
    const display = (raw, value) => {
      const shown = formatExactValue(raw);
      const approx = formatNumber(value);
      return /^-?\d+$/.test(raw.replace(/\s/g, '')) || shown === approx ? shown : `${shown} (≈ ${approx})`;
    };
    const pieces = `${hiEnd.exact ? formatExactValue(hiEnd.exact) : formatNumber(hiEnd.numeric)} − (${loEnd.exact ? formatExactValue(loEnd.exact) : formatNumber(loEnd.numeric)})`;
    steps.push(`So ${mark(`${ordered} = ${pieces} = ${display(exactRaw, exactValue)}`)}.`);
    let signed = exactValue;
    let valueText = display(exactRaw, exactValue);
    if (reversed) {
      signed = -exactValue;
      let negRaw = null;
      try {
        const out = String(Algebrite.run(`simplify(-(${exactRaw}))`)).trim();
        if (!isAlgebriteFailure(out)) negRaw = out;
      } catch { /* numeric */ }
      valueText = display(negRaw || exactValueToRaw(signed), signed);
      steps.push(`Reversing the bounds changes the sign: ${mark(`${notation.replace(/ \(.*$/, '')} = −${ordered} = ${valueText}`)}.`);
    }
    steps.push(`Checked numerically with a mesh graded toward the singular endpoint: ${mark(`≈ ${formatNumber(reversed ? -check : check)}`)}.`);

    return {
      steps,
      answer: `${notation} ${eqOrApprox(valueText)}`,
      verified: true,
      verificationMethod: 'one-sided limit of the antiderivative + graded numeric quadrature',
      tips: [
        'An integral whose integrand blows up at an endpoint is improper: replace that endpoint with a variable, integrate, then take the one-sided limit.',
        `It converges only if that limit is a finite number — the area can be finite even though the curve is unbounded (${mark('1/√x')} on ${mark('(0, 1]')}).`,
        `Compare with a p-integral: ${mark(`∫₀¹ 1/${v}ᵖ d${v}`)} converges for ${mark('p < 1')} and diverges for ${mark('p ≥ 1')}.`,
      ],
      common_mistakes: [
        `Substituting the singular endpoint straight into ${mark('F')} as if the Fundamental Theorem applied there.`,
        'Assuming an unbounded integrand always gives an infinite area.',
      ],
      graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, signed),
    };
  } catch {
    return null;
  }
}

// A pole strictly inside [a, b]. Split there and test each side as a one-sided
// limit of the antiderivative F: if either limit is unbounded the integral
// diverges — and says so ("not supported" used to hide that ∫₋₁¹ 1/x² dx has
// no value at all); if both are finite the two pieces add to the value,
// cross-checked by quadrature on each side. Returns null to fall back to the
// generic refusal when the pole cannot be located or F is not trustworthy.
// (September 2026 audit.)
export async function integrateAcrossSingularity(integrand, v, a, b, notation, lowerLabel, upperLabel, Algebrite) {
  try {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const f = (x) => evalAntiderivNumeric(integrand, v, x);

    // Locate the pole: the interior grid point where |f| is largest or undefined.
    const N = 4000;
    const h = (hi - lo) / N;
    let c = null;
    let worst = 0;
    for (let i = 1; i < N; i += 1) {
      const x = lo + i * h;
      const y = f(x);
      const size = Number.isFinite(y) ? Math.abs(y) : Infinity;
      if (size > worst) {
        worst = size;
        c = x;
      }
    }
    if (c === null || worst < 1e6) return null;
    const snapped = Number(c.toFixed(6));
    const atSnapped = f(snapped);
    if (!Number.isFinite(atSnapped) || Math.abs(atSnapped) > 1e6) c = snapped;
    if (Math.abs(c - lo) < 1e-9 || Math.abs(c - hi) < 1e-9) return null;

    let F = await antiderivativeViaTerms(integrand, v, Algebrite);
    if (!F) {
      try { F = Algebrite.integral(integrand, v).toString(); } catch { F = null; }
    }
    if (!F || isAlgebriteFailure(F) || /integral/i.test(F)) return null;

    const Fat = (x) => evalAntiderivNumeric(F, v, x);
    const Fa = Fat(lo);
    const Fb = Fat(hi);
    // Trouble at an endpoint as well is the existing endpoint paths' business.
    if (!Number.isFinite(Fa) || !Number.isFinite(Fb)) return null;

    // One-sided limit of F at c along a shrinking ladder; NaN if it does not settle.
    const ladder = {};
    const limitFrom = (side) => {
      const vals = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6].map((eps) => Fat(c + side * eps));
      ladder[side] = vals;
      if (vals.some((y) => !Number.isFinite(y))) return NaN;
      const [p, q, r] = vals.slice(-3);
      const settling = Math.abs(r - q) <= Math.abs(q - p) + 1e-9 && Math.abs(r - q) < 1e-3 * (1 + Math.abs(r));
      return settling ? r : NaN;
    };
    const Lminus = limitFrom(-1);
    const Lplus = limitFrom(1);
    // Where a one-sided limit of F fails, say which infinity it runs to.
    const runsTo = (side) => {
      const vals = (ladder[side] || []).filter(Number.isFinite);
      if (vals.length < 2) return 'infinity';
      return vals[vals.length - 1] > vals[vals.length - 2] ? '+∞' : '−∞';
    };
    const shownLadder = (side) => (ladder[side] || []).slice(0, 4).map((y) => (Number.isFinite(y) ? formatNumber(y) : '±∞')).join(', ');
    const cShown = formatNumber(c);
    const splitText = `∫_{${lowerLabel}}^{${cShown}} + ∫_{${cShown}}^{${upperLabel}}`;

    if (!Number.isFinite(Lminus) || !Number.isFinite(Lplus)) {
      const side = !Number.isFinite(Lminus) ? '⁻' : '⁺';
      return diverges({
        input: notation,
        reason: `The integrand ${beautify(integrand)} is unbounded at ${v} = ${cShown}, inside the interval, and its antiderivative has no finite one-sided limit there — this improper integral diverges (it has no finite value).`,
        answer: `Diverges — the integral has no finite value (unbounded at ${v} = ${cShown} inside the interval)`,
        steps: [
          `Evaluate the definite integral ${mark(notation)}.`,
          `The integrand has a vertical asymptote at ${mark(`${v} = ${cShown}`)}, strictly between the bounds, so this is an improper integral. Split it there, each piece taken as a one-sided limit: ${mark(splitText)}.`,
          `Antiderivative: ${mark(`F(${v}) = ${lnify(F)}`)}.`,
          `Left piece, ${mark(`∫_{${lowerLabel}}^{${cShown}} = lim (s→${cShown}⁻) [F(s) − F(${lowerLabel})]`)}: as ${mark(`s → ${cShown}⁻`)}, ${mark(`F(s) → ${Number.isFinite(Lminus) ? formatNumber(Lminus) : runsTo(-1)}`)} (samples: ${mark(shownLadder(-1))}), so this piece ${Number.isFinite(Lminus) ? 'converges' : 'has no finite value'}.`,
          `Right piece, ${mark(`∫_{${cShown}}^{${upperLabel}} = lim (t→${cShown}⁺) [F(${upperLabel}) − F(t)]`)}: as ${mark(`t → ${cShown}⁺`)}, ${mark(`F(t) → ${Number.isFinite(Lplus) ? formatNumber(Lplus) : runsTo(1)}`)} (samples: ${mark(shownLadder(1))}), so this piece ${Number.isFinite(Lplus) ? 'converges' : 'has no finite value'}.`,
          'The one-sided improper integrals do not both converge, so the integral diverges.',
          ...(principalValueNote(integrand, v, c, lo, hi)),
        ],
        tips: [
          'An integral across a vertical asymptote is a sum of two one-sided limits; if either fails to exist, the integral diverges.',
          `Do not apply ${mark('F(b) − F(a)')} across the asymptote: for ${mark('1/x²')} on ${mark('[−1, 1]')} that gives ${mark('−2')} for a positive integrand.`,
        ],
        common_mistakes: [`Applying ${mark('F(b) − F(a)')} straight across the asymptote and reporting the (meaningless) number.`],
      });
    }

    const value = (Lminus - Fa) + (Fb - Lplus);
    const left = numericIntegral(integrand, v, lo, c);
    const right = numericIntegral(integrand, v, c, hi);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    const check = left + right;
    if (Math.abs(check - value) > Math.max(1e-2, Math.abs(value) * 1e-2)) return null;
    const signed = b < a ? -value : value;
    const valueText = formatNumber(signed);
    return {
      steps: [
        `Evaluate the definite integral ${mark(notation)}.`,
        `The integrand has a vertical asymptote at ${mark(`${v} = ${cShown}`)}, strictly between the bounds, so this is an improper integral. Split it there and take one-sided limits: ${mark(splitText)}.`,
        `Antiderivative: ${mark(`F(${v}) = ${lnify(F)}`)}.`,
        `Both one-sided limits of ${mark('F')} exist: ${mark(`F(${v}) → ${formatNumber(Lminus)}`)} as ${mark(`${v} → ${cShown}⁻`)} and ${mark(`→ ${formatNumber(Lplus)}`)} as ${mark(`${v} → ${cShown}⁺`)}, so each piece converges.`,
        `Add the pieces: ${mark(`(${formatNumber(Lminus)} − ${formatNumber(Fa)}) + (${formatNumber(Fb)} − ${formatNumber(Lplus)}) = ${valueText}`)}.`,
        `Verified numerically (Simpson's rule on each side): ${mark(`≈ ${formatNumber(check)}`)}.`,
      ],
      answer: `${notation} ${eqOrApprox(valueText)}`,
      verified: true,
      verificationMethod: 'one-sided limits of F + numeric quadrature on each side',
      tips: [
        'An improper integral across an interior asymptote converges only if both one-sided pieces converge.',
        `Compare with a p-integral: near the asymptote, ${mark('|x − c|^(−p)')} is integrable only for ${mark('p < 1')}.`,
      ],
      common_mistakes: [`Applying ${mark('F(b) − F(a)')} across the asymptote without checking the one-sided limits.`],
      graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, signed),
    };
  } catch {
    return null;
  }
}

// ∫₋₁¹ 1/x: the two infinite pieces cancel symmetrically, and students meet
// "= 0" for it. Say what that 0 is — the Cauchy principal value — and that
// it is not the value of the improper integral. Only when the integrand is
// odd about the pole and the interval is symmetric around it.
function principalValueNote(integrand, v, c, lo, hi) {
  if (Math.abs((c - lo) - (hi - c)) > 1e-9) return [];
  const f = (x) => evalAntiderivNumeric(integrand, v, x);
  const odd = [0.1, 0.25, 0.5].every((h) => {
    const l = f(c - h * (hi - c));
    const r = f(c + h * (hi - c));
    return Number.isFinite(l) && Number.isFinite(r) && Math.abs(l + r) < 1e-9 * (1 + Math.abs(r));
  });
  if (!odd) return [];
  return [`(Because the integrand is odd about ${mark(`${v} = ${formatNumber(c)}`)} and the interval is symmetric, the two pieces cancel if they are cut off at the same distance ${mark('ε')} on each side: that symmetric limit, the Cauchy principal value, is ${mark('0')}. It is not the value of the improper integral, which does not exist.)`];
}
