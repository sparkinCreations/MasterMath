// Definite integrals: the bounds read from the problem, the Fundamental
// Theorem with the antiderivative checked, a cross-check by quadrature, and
// a numerical estimate (said to be one) when no antiderivative is found.

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
import { parseMathExpression } from '../../mathParser.js';
import { antiderivativeViaTerms } from './terms.js';
import {
  refuseDefinite,
  isInfiniteBound,
  numericIntegral,
  refuseImproper,
  evalAntiderivNumeric,
  refuseImproperAt,
  exactValueToRaw,
  formatExactValue,
  evalAntiderivAt,
  eqOrApprox,
  generateDefiniteGraph,
  nameConstant,
} from './evaluate.js';
import {
  solveImproperInfinite,
  integrateAtSingularEndpoint,
  integrateAcrossSingularity,
} from './improper.js';

// ---------------------------------------------------------------------------
// Definite integrals — ∫_a^b f dx via the Fundamental Theorem of Calculus.
//
// Built after the July 2026 audit noted the honest refusal was the last thing
// standing between the app and this capability. The exact value comes from
// Algebrite's defint; a Simpson cross-check independently confirms it and, in
// the process, refuses improper integrals (a discontinuity between the bounds)
// rather than shipping Algebrite's occasional complex/garbage value for them.
// ---------------------------------------------------------------------------

/**
 * Recognize a definite integral in the raw problem text and pull out its
 * pieces. Returns { integrand, variable, lowerRaw, upperRaw, lowerLabel,
 * upperLabel }, a { error: true } marker when it clearly looks definite but
 * the bounds can't be read, or null when it isn't a definite integral at all.
 */
export function parseDefiniteIntegral(raw) {
  const s = String(raw || '').trim().replace(/−/g, '-');
  const looksDefinite = /∫\s*_|_\s*\{?\s*[-\d]|\bfrom\b[\s\S]*\bto\b|\bdefinite\b/i.test(s);
  if (!looksDefinite) return null;

  let lowerRaw;
  let upperRaw;
  let body;

  // Form A — sub/superscript bounds: ∫_a^b <integrand> d<var>
  //   ∫_0^1 x dx · ∫_{0}^{pi} sin(x) dx · definite ∫_0^1 x^2 dx
  let m = s.match(/∫?\s*_\s*\{?\s*([^{}^]+?)\s*\}?\s*\^\s*\{?\s*([^{}\s]+?)\s*\}?\s+(.+)/i);
  if (m) {
    [, lowerRaw, upperRaw, body] = m;
  } else {
    // Form B — "<integrand> from a to b"
    m = s.match(/(.+?)\s+from\s+(\S+)\s+to\s+(.+)/i);
    if (m) {
      [, body, lowerRaw, upperRaw] = m;
    } else {
      // Form C — "from a to b <integrand>"
      m = s.match(/from\s+(\S+)\s+to\s+(\S+)\s+(?:of\s+)?(.+)/i);
      if (m) {
        [, lowerRaw, upperRaw, body] = m;
      } else {
        return { error: true };
      }
    }
  }

  // Identify the variable from a trailing d<var>; default to x.
  let variable = 'x';
  const dm = body.match(/\bd\s*([a-z])\b/i);
  if (dm) variable = dm[1].toLowerCase();

  // Strip decoration from the integrand: ∫, "definite", the verb, d<var>.
  const integrand = body
    .replace(/∫/g, ' ')
    .replace(/\bdefinite\b/gi, ' ')
    .replace(/\b(?:find|take)\s+the\s+integral\s+of\b/gi, ' ')
    .replace(/\b(?:the\s+)?integral\s+of\b/gi, ' ')
    .replace(/\bantiderivative\s+of\b/gi, ' ')
    .replace(/\bintegrate\b/gi, ' ')
    .replace(new RegExp(`\\bd\\s*${variable}\\b`, 'i'), ' ')
    .trim();

  // "∫_0^1 dx": nothing between the bounds and dx is the integrand 1.
  const integrandOrOne = integrand || (dm ? '1' : '');
  if (!integrandOrOne) return { error: true };

  return {
    integrand: parseMathExpression(integrandOrOne),
    variable,
    lowerRaw: parseMathExpression(lowerRaw.trim()),
    upperRaw: parseMathExpression(upperRaw.trim()),
    lowerLabel: prettifyBound(lowerRaw.trim()),
    upperLabel: prettifyBound(upperRaw.trim()),
  };
}

function prettifyBound(label) {
  return String(label).replace(/\bpi\b/gi, 'π').replace(/\*/g, '').replace(/^(-?)\s*(?:inf(?:inity)?|oo)$/i, '$1∞');
}

export async function solveDefiniteIntegral(parsed) {
  if (parsed.error) {
    return refuseDefinite(
      'This looks like a definite integral, but its bounds could not be read.',
      'Try the form ∫_0^1 x^2 dx, or "x^2 from 0 to 1".',
      'parse',
    );
  }

  const { integrand, variable: v, lowerRaw, upperRaw, lowerLabel, upperLabel } = parsed;
  const intgDisp = beautify(integrand);
  const notation = `∫_${lowerLabel}^${upperLabel} (${intgDisp}) d${v}`;

  try {
    // Improper integrals to ±∞: defined as a limit of proper ones.
    if (isInfiniteBound(lowerRaw) || isInfiniteBound(upperRaw)) {
      return solveImproperInfinite(parsed, notation);
    }

    const a = Number(math.evaluate(lowerRaw));
    const b = Number(math.evaluate(upperRaw));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return refuseDefinite('The integration bounds could not be read as numbers.', notation, 'parse');
    }

    const Algebrite = await loadAlgebrite();
    const forAlgebrite = rewriteReciprocalTrig(integrand);

    // An integrand unbounded at an endpoint (1/√x at 0, ln x at 0) makes the
    // integral improper: it is a one-sided limit, and F(b) − F(a) with F
    // evaluated AT the singular endpoint is not valid reasoning even when it
    // happens to give the right number. Handled first, as a limit.
    const endpoint = await integrateAtSingularEndpoint({ integrand, v, a, b, lowerRaw, upperRaw, lowerLabel, upperLabel, notation, Algebrite });
    if (endpoint) return endpoint;

    // Authoritative exact value.
    let exactRaw;
    try {
      exactRaw = String(Algebrite.run(`defint(${forAlgebrite}, ${v}, ${lowerRaw}, ${upperRaw})`)).trim();
    } catch {
      exactRaw = null;
    }

    // Reject unresolved, non-real, or still-symbolic results.
    const badExact =
      !exactRaw ||
      isAlgebriteFailure(exactRaw) || /defint/i.test(exactRaw) ||
      /\bi\b/.test(exactRaw) ||
      new RegExp(`\\b${v}\\b`).test(exactRaw);

    let exactValue = NaN;
    if (!badExact) {
      try {
        const evaluated = math.evaluate(exactRaw);
        exactValue = typeof evaluated === 'number' ? evaluated : NaN;
      } catch {
        exactValue = NaN;
      }
    }

    // Independent numeric confirmation (Simpson's rule). Also the improper-
    // integral detector: a discontinuity inside [a,b] returns IMPROPER.
    const numeric = numericIntegral(integrand, v, a, b);
    if (numeric === 'IMPROPER') {
      const split = await integrateAcrossSingularity(integrand, v, a, b, notation, lowerLabel, upperLabel, Algebrite);
      return split || refuseImproper(notation, v);
    }

    // Algebrite's defint has no abs and no substitution step. When it fails,
    // the per-term antiderivative machinery the indefinite path uses (which
    // has both) supplies F, and the FTC — F(b) − F(a) — supplies the value.
    // Still cross-checked against Simpson below, and still refused if the two
    // disagree.
    let ftcF = null;
    let decimalOnly = false;
    if (badExact || !Number.isFinite(exactValue)) {
      ftcF = await antiderivativeViaTerms(integrand, v, Algebrite);
      if (ftcF) {
        const Fb = evalAntiderivNumeric(ftcF, v, b);
        const Fa = evalAntiderivNumeric(ftcF, v, a);
        // F unbounded at an endpoint (∫₀¹ 1/x: F = ln|x| → −∞ at 0) means the
        // integral DIVERGES there — say so, instead of "could not compute".
        // An integrable endpoint singularity (1/√x: F = 2√x, finite at 0)
        // passes straight through.
        if (!Number.isFinite(Fb) || !Number.isFinite(Fa)) {
          const at = !Number.isFinite(Fa) ? lowerLabel : upperLabel;
          const bigNear = (x0) => { const y = evalAntiderivNumeric(integrand, v, x0); return !Number.isFinite(y) || Math.abs(y) > 1e6; };
          const edge = !Number.isFinite(Fa) ? a : b;
          if (bigNear(edge) || bigNear(edge + (edge === a ? 1e-9 : -1e-9))) {
            return refuseImproperAt(notation, v, at, integrand);
          }
          ftcF = null;
        }
        if (Number.isFinite(Fb) && Number.isFinite(Fa)) {
          exactValue = Fb - Fa;
          // Prefer an exact symbolic value when Algebrite can form one from F
          // (½·sin(1) rather than 0.4207); it must agree with the numeric FTC.
          let symbolic = null;
          try {
            const out = String(Algebrite.run(`simplify(subst(${upperRaw}, ${v}, ${ftcF}) - subst(${lowerRaw}, ${v}, ${ftcF}))`)).trim();
            if (!isAlgebriteFailure(out) && !/\bi\b/.test(out) && !new RegExp(`\\b${v}\\b`).test(out)) {
              const n = Number(math.evaluate(out));
              if (Number.isFinite(n) && Math.abs(n - exactValue) < 1e-9 * (1 + Math.abs(n))) symbolic = out;
            }
          } catch { /* fall back to the numeric form */ }
          exactRaw = symbolic || exactValueToRaw(exactValue);
          decimalOnly = !symbolic && !/^-?\d+(?:\/\d+)?$/.test(exactRaw);
        } else {
          ftcF = null;
        }
      }
    }
    const exactUsable = Number.isFinite(exactValue) && (!badExact || ftcF);

    // No antiderivative from any method: the integral is still a number, and
    // a student is owed it. Two Simpson step sizes must agree (to the digits
    // shown) before it is reported, and it is reported as an estimate —
    // "≈ … (numerical)" — never as an exact value. Until 1.57.0 this was a
    // refusal, while the indefinite path's tip promised "a definite version
    // can still be computed numerically" (October 2026 review).
    if (!exactUsable && Number.isFinite(numeric)) {
      const estimate = numericEstimate(integrand, v, a, b);
      if (estimate) return numericOnlyDefinite({ notation, integrand, v, a, b, lowerLabel, upperLabel, estimate });
      return refuseDefinite(
        'The antiderivative was not found, and two numerical estimates of this definite integral do not agree closely enough to report one.',
        notation,
      );
    }
    // The exact value and the numeric check disagree: refuse rather than
    // present a number we don't trust.
    const tol = Math.max(1e-2, Math.abs(Number.isFinite(exactValue) ? exactValue : numeric) * 1e-2);
    if (!exactUsable || !Number.isFinite(numeric) || Math.abs(numeric - exactValue) > tol) {
      return refuseDefinite(
        'The exact value and a numerical check of this definite integral disagree, so no value is reported.',
        notation,
      );
    }

    // Antiderivative for the worked FTC steps.
    let F = ftcF;
    if (!F) {
      try {
        F = Algebrite.integral(forAlgebrite, v).toString();
      } catch {
        F = null;
      }
    }
    const hasAntideriv = F && !isAlgebriteFailure(F) && !/integral/i.test(F);

    const exactDisplay = formatExactValue(exactRaw);
    const isCleanValue = /^-?\d+$/.test(exactRaw.replace(/\s/g, ''));
    const approx = formatNumber(exactValue);
    // A value that is only a decimal (the antiderivative has no exact form
    // Algebrite can evaluate at the bounds) is an approximation, and says so.
    const valueText = decimalOnly ? `≈ ${approx}` : isCleanValue || exactDisplay === approx ? exactDisplay : `${exactDisplay} (≈ ${approx})`;

    const steps = [`Evaluate the definite integral ${mark(notation)}.`];
    if (hasAntideriv) {
      steps.push(`First find the antiderivative: ${mark(`F(${v}) = ${lnify(F)}`)}.`);
      steps.push(`Apply the Fundamental Theorem of Calculus: ${mark(`∫_a^b f d${v} = F(b) − F(a)`)}.`);
      const Fb = evalAntiderivAt(Algebrite, F, v, upperRaw);
      const Fa = evalAntiderivAt(Algebrite, F, v, lowerRaw);
      if (Fb !== null && Fa !== null) {
        steps.push(`Evaluate at the bounds: ${mark(`F(${upperLabel}) = ${Fb}`)} and ${mark(`F(${lowerLabel}) = ${Fa}`)}.`);
        steps.push(`Subtract: ${mark(`F(${upperLabel}) − F(${lowerLabel}) ${eqOrApprox(valueText)}`)}.`);
      } else {
        steps.push(`Evaluate ${mark('F')} at the two bounds and subtract to get ${mark(valueText)}.`);
      }
    } else {
      steps.push('Find the antiderivative, then subtract its values at the two bounds.');
      steps.push(`The definite integral equals ${mark(valueText)}.`);
    }
    steps.push(`Verified numerically (Simpson's rule): ${mark(`≈ ${formatNumber(numeric)}`)}.`);

    return {
      steps,
      answer: `${notation} ${eqOrApprox(valueText)}`,
      verified: true,
      verificationMethod: 'Fundamental Theorem of Calculus + numeric quadrature',
      tips: [
        `The Fundamental Theorem of Calculus: ${mark(`∫_a^b f d${v} = F(b) − F(a)`)}, where ${mark('F')} is any antiderivative.`,
        ...(hasAntideriv ? [`Here ${mark(`F(${v}) = ${lnify(F)}`)}, so ${mark(`${notation} ${eqOrApprox(valueText)}`)}.`] : []),
        `No “${mark('+C')}” for a definite integral — the constant cancels in the subtraction.`,
        `A definite integral is the signed area between the curve and the x-axis over ${mark('[a, b]')}.`,
        `Area below the axis counts as negative: ${mark('∫_0^{2π} sin(x) dx = 0')}, although the curve encloses area on both sides. For the total area, integrate ${mark('|f(x)|')}.`,
        `With a substitution, change the bounds to values of ${mark('u')} and finish in ${mark('u')}; there is no need to substitute back.`,
        'A rough sketch checks the answer: its sign and size should match the area you can see.',
      ],
      common_mistakes: [
        `Keeping the ${mark('+C')} — it cancels when you subtract ${mark('F(a)')} from ${mark('F(b)')}.`,
        `Swapping the bounds: ${mark('∫_a^b = −∫_b^a')}.`,
        `Integrating across a discontinuity (e.g. ${mark('1/x')} on ${mark('[−1, 1]')}) as if the integral were proper.`,
        `Changing to ${mark('u')} but keeping the ${mark(v)}-bounds.`,
      ],
      graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, exactValue),
    };
  } catch (error) {
    console.error('Definite integral solver error:', error);
    return refuseDefinite('This definite integral could not be computed.', notation);
  }
}

// Two Simpson estimates at different step sizes; the value is reported only
// when they agree to about eight significant digits (then the digits shown,
// four places, are safe). Null when they do not, or when the integrand
// cannot be sampled.
function numericEstimate(integrand, v, a, b) {
  const coarse = numericIntegral(integrand, v, a, b, 2000);
  const fine = numericIntegral(integrand, v, a, b, 4000);
  if (typeof coarse !== 'number' || typeof fine !== 'number' || !Number.isFinite(coarse) || !Number.isFinite(fine)) return null;
  if (Math.abs(fine - coarse) > 1e-8 * (1 + Math.abs(fine))) return null;
  return { value: fine, coarse, fine };
}

// The result for a definite integral whose antiderivative no method found:
// the numerical estimate, said to be one.
function numericOnlyDefinite({ notation, integrand, v, a, b, lowerLabel, upperLabel, estimate }) {
  const approx = formatNumber(estimate.value);
  const named = nameConstant(estimate.value);
  const steps = [
    `Evaluate the definite integral ${mark(notation)}.`,
    `No antiderivative of ${mark(beautify(integrand))} was found by this solver's methods (direct rules, u-substitution, integration by parts, partial fractions, trigonometric substitution), so the Fundamental Theorem of Calculus cannot be applied here.`,
    `The integral is still a definite number — the signed area under the curve from ${mark(`${v} = ${lowerLabel}`)} to ${mark(`${v} = ${upperLabel}`)} — so it is estimated numerically with Simpson's rule: with 2000 subintervals ${mark(`≈ ${formatNumber(estimate.coarse, 8)}`)}, with 4000 ${mark(`≈ ${formatNumber(estimate.fine, 8)}`)}. The two agree, so the digits shown are reliable.`,
    `Numerical value: ${mark(`≈ ${approx}`)}${named && named !== approx ? ` (this agrees with ${mark(named)} to the digits shown; a numerical estimate cannot prove the exact form)` : ''}.`,
  ];
  return {
    steps,
    answer: `${notation} ≈ ${approx} (numerical)`,
    tips: [
      `A numerical integral gives the value, not a formula: it samples the curve and adds up slices (Simpson's rule fits parabolas through triples of points), and the digits shown are those two step sizes agree on, a check on the accuracy rather than a proof of it.`,
      `A function continuous on an interval has an antiderivative there, but it may have no formula in elementary functions (${mark('√(1 + x⁴)')} is one such); this solver found none here, and a numerical value is the practical answer.`,
      `Try a method by hand: the solver's list stops at the techniques named in the steps; a trigonometric identity, a different substitution or a reduction formula may give the exact form.`,
      `A definite integral is the signed area between the curve and the ${mark(v)}-axis over ${mark(`[${lowerLabel}, ${upperLabel}]`)}; a numerical estimate is a fine way to check an exact answer found by hand.`,
    ],
    common_mistakes: [
      `Writing the estimate as an exact value: ${mark(`≈ ${approx}`)} is correct to the digits shown, ${mark(`= ${approx}`)} is a different claim.`,
      `Trusting a numerical value across a vertical asymptote — the slices there are meaningless (this solver checks for one first).`,
      `Assuming no antiderivative exists because a solver did not find one: the methods tried are listed in the steps.`,
    ],
    graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, estimate.value),
  };
}
