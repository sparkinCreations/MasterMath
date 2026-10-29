// One term integrated by the first method that applies, and the form
// substitutions u = eˣ and x = u², which integrate the new integrand term by
// term in turn.

import {
  beautify,
  splitTerms,
  runAlgebrite,
  rewriteReciprocalTrig,
  isUnevaluatedOperator,
  lnify,
  mark,
} from '../solverUtils.js';
import { integrateByParts, needsByParts } from '../byPartsSolver.js';
import {
  integrateBySubstitution,
  integrateAbsLinear,
  derivativeMatchesNumerically,
} from '../substitutionSolver.js';
import {
  integrateByTrigSubstitution,
  integrateByTriangleSubstitution,
} from '../trigSubstitutionSolver.js';
import { integrateTrigPower } from '../trigPowerSolver.js';
import { integrateBySurdPartialFractions } from '../surdPartialFractions.js';
import { positiveArgumentNote, safeRunLocal, polishLogArguments, simplifyRun } from './display.js';
import {
  integrateInverseTrig,
  isLogDerivativeShape,
  halfAngleSteps,
  trigQuotientSteps,
  classifyIntegralRule,
} from './rules.js';
import {
  splitTopLevelSlash,
  integrateQuarticSum,
  integrateByPartialFractions,
  integrateByGeneralPartialFractions,
  integrateImproperRational,
} from './partialFractions.js';

/**
 * Integrate one additive term. A by-parts term returns its full walkthrough;
 * everything else is integrated directly by Algebrite. Returns
 * { antideriv, steps, method, term } or null when the term can't be integrated.
 */
export async function integrateTerm(term, variable, Algebrite) {
  if (needsByParts(term, variable)) {
    // A product can be a substitution in disguise — x·e^(x²) is g′·h(g), not
    // a by-parts problem (by parts drags in erf(ix) and only recovers by
    // luck). Try substitution first for products; it is verified, so a wrong
    // guess simply declines and by parts proceeds as before.
    const sub = integrateBySubstitution(rewriteReciprocalTrig(term), variable, Algebrite);
    if (sub) {
      return { antideriv: sub.antiderivative, steps: sub.steps, method: 'substitution', term };
    }
    const bp = await integrateByParts(term, variable);
    if (bp) {
      return { antideriv: bp.antiderivative, steps: bp.steps, method: 'byparts', term, cyclic: bp.cyclic };
    }
    // fall through to a direct attempt if by-parts declined
  }

  // Method chosen from the integrand's STRUCTURE, before the engine answers:
  // Algebrite integrates 1/(x²+1) and x/(x²+1) directly, and the direct
  // path used to attach the classifier's fallback label — "Power rule" — to
  // arctan(x) and ½ln(x²+1) (September 2026 review, batch 1).
  const inverseTrig = integrateInverseTrig(term, variable, Algebrite);
  if (inverseTrig) {
    return { antideriv: inverseTrig.antiderivative, steps: inverseTrig.steps, method: 'inverse trig', term };
  }
  if (isLogDerivativeShape(term, variable, Algebrite)) {
    const sub = integrateBySubstitution(rewriteReciprocalTrig(term), variable, Algebrite);
    if (sub) {
      return { antideriv: sub.antiderivative, steps: [...sub.steps, ...positiveArgumentNote(sub.antiderivative, variable)], method: 'substitution', term };
    }
  }

  // sin²x·cos³x, sin³x, sec³x, sec⁴x, tan³x·sec x: powers and products of
  // trig functions, worked by the odd-power split, u = tan, or the
  // reduction formula (trigPowerSolver.js). Before the direct attempt:
  // Algebrite answers sin³x in one line, and refuses the rest.
  const trigPower = integrateTrigPower(term, variable, Algebrite);
  if (trigPower) {
    return { antideriv: trigPower.antiderivative, steps: trigPower.steps, method: trigPower.method, term };
  }

  // √(A − B·x²): Algebrite answers it, but as (−x²+1)^(1/2) with no working
  // and the "u-substitution" label; show the trigonometric substitution.
  const trig = integrateByTrigSubstitution(term, variable);
  if (trig) {
    return { antideriv: trig.antiderivative, steps: trig.steps, method: 'trig substitution', term };
  }
  // x^m·(x² ± a²)^(k/2), x^m·(a² − x²)^(k/2): x = a·tan θ, a·sec θ, a·sin θ,
  // worked in θ and turned back with the triangle.
  const triangle = integrateByTriangleSubstitution(term, variable, Algebrite);
  if (triangle) {
    return { antideriv: triangle.antiderivative, steps: triangle.steps, method: 'trig substitution', term };
  }

  // A rational function over a factorable quadratic-or-higher denominator:
  // show the partial-fraction working. Algebrite integrates 1/(x² − 1)
  // itself, as a one-line table formula, so this must come before it. The
  // general decomposition (repeated linear factors, irreducible quadratics)
  // comes before it too: Algebrite's integral() ran past 60 s on
  // (x + 1)/((x − 1)²(x² + 1)), so the 10-second budget stopped every such
  // solve, while the decomposition takes well under a second (1.53.1).
  {
    const parts = splitTopLevelSlash(term);
    const den = parts ? parts[1] : '';
    const varRe = new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'g');
    if (parts && ((den.match(varRe) || []).length >= 2 || /\^/.test(den))) {
      // c/(x⁴ + d) with d not a perfect square of an integer's double:
      // factors only over a surd, which the rational factoring below
      // cannot see, and Algebrite grinds for seconds before giving up.
      const quartic = integrateQuarticSum(term, variable);
      if (quartic) return { antideriv: quartic.antiderivative, steps: quartic.steps, method: 'partial fractions', term };
      const pfFirst = integrateByPartialFractions(term, variable, Algebrite) || integrateByGeneralPartialFractions(term, variable, Algebrite);
      if (pfFirst) return { antideriv: pfFirst.antiderivative, steps: pfFirst.steps, method: 'partial fractions', term };
      // A denominator that factors over the reals but not the rationals
      // (x⁵ + 1, x³ − 2): the factors from its roots, coefficients as surds.
      const surd = integrateBySurdPartialFractions(term, variable);
      if (surd) return { antideriv: surd.antiderivative, steps: surd.steps, method: 'partial fractions', term, shown: surd.shown, numericCheck: true, approximate: surd.approximate };
    }
    // Any improper polynomial fraction, whatever its denominator: divide
    // first (x^2/(x − 1) = x + 1 + 1/(x − 1)), as it is taught.
    if (parts) {
      const improper = integrateImproperRational(term, variable, Algebrite);
      if (improper) return { antideriv: improper.antiderivative, steps: improper.steps, method: 'partial fractions', term };
    }
  }

  let anti = safeRunLocal(Algebrite, `integral(${rewriteReciprocalTrig(term)}, ${variable})`);
  if (anti !== null && !isUnevaluatedOperator(anti)) {
    anti = polishLogArguments(Algebrite, anti);
    const halfAngle = halfAngleSteps(term, variable, anti);
    if (halfAngle) return { antideriv: anti, steps: halfAngle, method: 'direct', term, label: 'Half-angle identity' };
    const quotient = trigQuotientSteps(term, variable, anti);
    if (quotient) return { antideriv: quotient.antiderivative, steps: quotient.steps, method: 'direct', term, label: 'Trig quotient' };
    const { label, hint } = classifyIntegralRule(term, variable);
    // A table line names its rule; the two trig labels explain it, since the
    // answer arrived in one jump (October 2026 review: "three steps that
    // don't name a method").
    const explained = label === 'Trigonometric substitution' || label === 'Trigonometric identity';
    const steps = [`${mark(`∫(${beautify(term)}) d${variable} = ${lnify(anti)}`)}${hint ? ` (${label}${explained ? `: ${hint}` : ''})` : ''}.`];
    return { antideriv: anti, steps, method: 'direct', term, label };
  }

  // Algebrite has no substitution step: it gives up on x·cos(x²). Try the
  // g′(x)·h(g(x)) pattern ourselves (verified by differentiation).
  const sub = integrateBySubstitution(rewriteReciprocalTrig(term), variable, Algebrite);
  if (sub) {
    return { antideriv: sub.antiderivative, steps: sub.steps, method: 'substitution', term };
  }

  // Rational functions Algebrite gives up on (1/(x²+x)): partial fractions
  // over distinct real linear factors, verified by differentiation.
  const pf = integrateByPartialFractions(term, variable, Algebrite) || integrateByGeneralPartialFractions(term, variable, Algebrite) || integrateBySurdPartialFractions(term, variable);
  if (pf) {
    return { antideriv: pf.antiderivative, steps: pf.steps, method: 'partial fractions', term };
  }

  // Algebrite has no abs either: |a·x + b| and constant multiples of it.
  const abs = integrateAbsLinear(term, variable);
  if (abs) {
    return { antideriv: abs.antiderivative, steps: abs.steps, method: 'abs', term };
  }

  // 1/(1 + eˣ), √x/(1 + x): a substitution that changes the form of the
  // problem (u = eˣ with dx = du/u; x = u² with dx = 2u du) turns the
  // integrand into a rational function the methods above handle (1.57.0).
  const formSub = await integrateByFormSubstitution(term, variable, Algebrite);
  if (formSub) {
    return { antideriv: formSub.antiderivative, steps: formSub.steps, method: 'form substitution', term };
  }

  return null;
}

// Rewrite every e^(k·v), exp(k·v), e^v, e^(−v) as a power of u. Returns the
// text and whether any exponential was found; k is an integer.
function exponentialsAsU(term, v) {
  const num = '(-?\\d+)';
  let found = false;
  const text = String(term)
    .replace(new RegExp(`\\b(?:e\\^\\(\\s*${num}\\s*\\*?\\s*${v}\\s*\\)|exp\\(\\s*${num}\\s*\\*?\\s*${v}\\s*\\))`, 'g'), (m, k1, k2) => { found = true; const k = k1 ?? k2; return k === '1' ? 'u' : `u^(${k})`; })
    .replace(new RegExp(`\\b(?:e\\^\\(\\s*-\\s*${v}\\s*\\)|exp\\(\\s*-\\s*${v}\\s*\\))`, 'g'), () => { found = true; return 'u^(-1)'; })
    .replace(new RegExp(`\\b(?:e\\^${v}\\b|e\\^\\(\\s*${v}\\s*\\)|exp\\(\\s*${v}\\s*\\))`, 'g'), () => { found = true; return 'u'; });
  return { text, found };
}

// The per-term machinery on an integrand in u, with its steps; null when a
// term is not integrable here.
async function integrateInU(inU, Algebrite) {
  const terms = splitTerms(inU);
  const antiderivs = [];
  const steps = [];
  for (const { signed } of terms) {
    const res = await integrateTerm(signed, 'u', Algebrite);
    if (!res) return null;
    antiderivs.push(res.antideriv);
    steps.push(...res.steps);
  }
  if (antiderivs.length === 0) return null;
  const joined = (antiderivs.length === 1 ? antiderivs[0] : antiderivs.map((a) => `(${a})`).join(' + ')).replace(/\+\s*-/g, '- ');
  return { antiderivative: joined, steps };
}

async function integrateByFormSubstitution(term, v, Algebrite) {
  const varRe = new RegExp(`\\b${v}\\b`);
  // u = eˣ: every appearance of the variable is inside an exponential.
  const exp = exponentialsAsU(term, v);
  if (exp.found && !varRe.test(exp.text)) {
    const inU = simplifyRun(Algebrite, `(${exp.text})/u`);
    if (inU && !varRe.test(inU) && !/exp|\be\^/.test(inU)) {
      const inner = await integrateInU(inU, Algebrite);
      if (inner) {
        const back = runAlgebrite(Algebrite, `subst(exp(${v}), u, ${inner.antiderivative})`);
        if (back && !/\bu\b/.test(back) && derivativeMatchesNumerically(back, term, v)) {
          const shownBack = lnify(back);
          const steps = [
            `Every ${mark(v)} in ${mark(beautify(term))} sits inside an exponential: substitute ${mark(`u = e^${v}`)}, so ${mark(`du = e^${v} d${v}`)} and ${mark(`d${v} = du/u`)}${/u\^/.test(exp.text) ? ` (and ${mark(`e^(k${v}) = u^k`)})` : ''}.`,
            `In ${mark('u')} the integral is rational: ${mark(`∫(${beautify(term)}) d${v} = ∫(${beautify(inU)}) du`)}.`,
            ...inner.steps.map((t) => `  ${t}`),
            `Back-substitute ${mark(`u = e^${v}`)}: ${mark(shownBack)}.`,
            `Check by differentiating: ${mark(`d/d${v}[${shownBack}] = ${beautify(term)}`)} ✓`,
          ];
          return { antiderivative: back, steps };
        }
      }
    }
  }
  // x = u²: the integrand mixes √x with x (and nothing else in x).
  const rootRe = new RegExp(`sqrt\\(${v}\\)|\\b${v}\\^\\(1/2\\)`, 'g');
  if (rootRe.test(term)) {
    const withU = String(term).replace(rootRe, 'u');
    if (!/sqrt|\^\(1\/|\^0\.5/.test(withU)) {
      const inU = simplifyRun(Algebrite, `subst(u^2, ${v}, ${withU})*2*u`);
      if (inU && !varRe.test(inU)) {
        const inner = await integrateInU(inU, Algebrite);
        if (inner) {
          const back = runAlgebrite(Algebrite, `subst(${v}^(1/2), u, ${inner.antiderivative})`);
          if (back && !/\bu\b/.test(back) && derivativeMatchesNumerically(back, term, v)) {
            const shownBack = lnify(back).replace(new RegExp(`${v}\\^\\(1/2\\)`, 'g'), `√${v}`);
            const steps = [
              `The integrand mixes ${mark(`√${v}`)} with ${mark(v)}: substitute ${mark(`${v} = u²`)} (so ${mark(`u = √${v} ≥ 0`)}), then ${mark(`d${v} = 2u du`)} and ${mark(`√${v} = u`)}.`,
              `In ${mark('u')} the integral is rational: ${mark(`∫(${beautify(term)}) d${v} = ∫(${beautify(inU)}) du`)}.`,
              ...inner.steps.map((t) => `  ${t}`),
              `Back-substitute ${mark(`u = √${v}`)}: ${mark(shownBack)}.`,
              `Check by differentiating: ${mark(`d/d${v}[${shownBack}] = ${beautify(term)}`)} ✓`,
            ];
            return { antiderivative: back, steps };
          }
        }
      }
    }
  }
  return null;
}

// The indefinite path's per-term antiderivative (direct / substitution /
// by-parts / abs), verified by differentiation. Returns F or null.
export async function antiderivativeViaTerms(expression, variable, Algebrite) {
  try {
    const terms = splitTerms(expression);
    const parts = [];
    for (const { signed } of terms) {
      const res = await integrateTerm(signed, variable, Algebrite);
      if (!res) return null;
      parts.push(res.antideriv);
    }
    if (parts.length === 0) return null;
    const F = simplifyRun(Algebrite, parts.map((p) => `(${p})`).join(' + ')) || parts.join(' + ');
    if (isUnevaluatedOperator(F) || /\bi\b/.test(F)) return null;
    return derivativeMatchesNumerically(F, expression, variable) ? F : null;
  } catch {
    return null;
  }
}
