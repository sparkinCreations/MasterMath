// Integrals: the entry point (solveIntegral) and indefinite integrals worked
// term by term. The methods live in ./integrals/ (and in the technique files
// beside this one: substitution, by parts, trig substitution, trig powers,
// surd partial fractions):
//
// - guidance.js: tips and mistakes, and the non-elementary notes
// - display.js: Algebrite runs tidied for display (logs, bars, erf)
// - rules.js: the rule each term uses, and its worked steps
// - partialFractions.js: every partial-fraction path, coefficients exact
// - terms.js: one term integrated, and the form substitutions u = eˣ, x = u²
// - evaluate.js: an antiderivative evaluated at a bound, quadrature, refusals
// - improper.js: infinite bounds, singular endpoints, interior asymptotes
// - definite.js: reading the bounds, and definite integrals

import {
  loadAlgebrite,
  beautify,
  splitTerms,
  runAlgebrite,
  sampleFunction,
  rewriteReciprocalTrig,
  expressionsNumericallyEqual,
  numericAgreement,
  parsesAsMath,
  isUnevaluatedOperator,
  lnify,
  stripOuterParens,
  mark,
  bareFunctionName,
  bareFunctionRefusal,
  readAsText,
} from './solverUtils.js';
import { extractVariable, extractFunctionFromProblem, parseMathExpression } from '../mathParser.js';
import { derivativeMatchesNumerically } from './substitutionSolver.js';
import { parseError, unsupported } from '../solutionEnvelope.js';
import { stripMathMarkers } from '../mathMarkers.js';
import { directTip, directMistake, nonElementaryNote } from './integrals/guidance.js';
import {
  simplifyRun,
  polishLogArguments,
  safeRunLocal,
  bindOtherLetters,
  buildErfSteps,
  prettyErf,
  dropBarsOnPositiveArguments,
  dropBarsOnIntegrandLogs,
} from './integrals/display.js';
import { buildPerTermSteps, generateIntegralSteps } from './integrals/rules.js';
import { integrateTerm } from './integrals/terms.js';
import { parseDefiniteIntegral, solveDefiniteIntegral } from './integrals/definite.js';

// The integral solver receives the RAW problem text (see api.js), because a
// definite integral's bounds live in the notation and must be read before
// parseMathExpression collapses the spacing.
export async function solveIntegral(rawInput) {
  const definite = parseDefiniteIntegral(rawInput);
  if (definite) {
    const bare = definite.integrand && bareFunctionName(parseMathExpression(definite.integrand));
    if (bare) return parseError({ input: rawInput, ...bareFunctionRefusal(bare) });
    const result = await solveDefiniteIntegral(definite);
    if (!definite.error && result.status !== 'parse_error') {
      result.readAs = `∫_${definite.lowerLabel}^${definite.upperLabel} ${readAsText(definite.integrand)} d${definite.variable}`;
    }
    return result;
  }

  // A bare integral sign with no bounds — "∫x dx", "∫ sin(x) dx" — is the
  // most natural notation there is; strip the sign and the trailing d<var>
  // before the expression extractor sees it, or "∫xdx" is a parse error.
  // The trailing d<var> names the variable of integration: "∫ x^2 dy" is
  // x^2·y + C, not x^3/3 + C.
  const dvar = String(rawInput).match(/\s*\bd([a-z])\s*$/i);
  const bare = String(rawInput)
    .replace(/^\s*∫\s*/, '')
    .replace(/\s*\bd([a-z])\s*$/i, '');
  // "integrate", "the integral of": the instruction with no integrand is an
  // empty integral, not the integral of a function called "of".
  const instructionOnly = /^\s*(?:(?:find|evaluate|compute|calculate)\s+)?(?:the\s+)?(?:integral|antiderivative|integrate)(?:\s+of)?\s*$/i.test(bare);
  const expression = instructionOnly ? '' : extractFunctionFromProblem(bare);
  if (!expression || !expression.trim()) {
    // "∫ dx" is ∫ 1 dx.
    if (dvar) return solveIndefiniteIntegral('1', dvar[1].toLowerCase());
    return parseError({
      input: rawInput,
      hint: 'There is nothing to integrate — the integrand is empty.',
      tips: [`Write the function after the integral sign, e.g. ${mark('∫ x^2 dx')}, or just ${mark('x^2')}.`],
    });
  }
  // "∫ sec dx": a function with no argument. Checked on the integrand alone —
  // in the whole problem the name fuses with "dx" — or the engines read it
  // as a symbol and answer sec·x + C.
  const bareName = bareFunctionName(parseMathExpression(expression));
  if (bareName) return parseError({ input: rawInput, ...bareFunctionRefusal(bareName) });
  // ∫(x^2) and "integral of (x^2)": the brackets group the integrand, and
  // were shown doubled, ∫((x^2)) dx.
  const integrand = stripOuterParens(expression);
  const variable = dvar ? dvar[1].toLowerCase() : undefined;
  const result = await solveIndefiniteIntegral(integrand, variable);
  // What was integrated, shown above the steps: a misread is visible at once.
  if (result.status !== 'parse_error') result.readAs = `∫ ${readAsText(integrand)} d${variable || extractVariable(integrand)}`;
  return result;
}

async function solveIndefiniteIntegral(expression, variableOverride) {
  try {
    if (!expression || !expression.trim()) {
      throw new Error('empty integrand');
    }

    const Algebrite = await loadAlgebrite();
    const variable = variableOverride || extractVariable(expression);

    // Integrate term by term so an integration-by-parts term can get its own
    // worked walkthrough (and so a single hard term doesn't sink the whole
    // integral the way Algebrite.integral of the full expression would).
    const terms = splitTerms(expression);
    const perTerm = [];
    let anyByParts = false;
    let anySubstitution = false;
    let anyAbs = false;
    let anyInverseTrig = false;
    let anyTrigSub = false;
    let anyTrigPower = false;
    let anyReduction = false;
    let anyFormSub = false;
    const directLabels = new Set();
    for (const { signed } of terms) {
      const res = await integrateTerm(signed, variable, Algebrite);
      if (!res) { perTerm.length = 0; break; }
      if (res.method === 'byparts') anyByParts = true;
      if (res.method === 'substitution') anySubstitution = true;
      if (res.method === 'abs') anyAbs = true;
      if (res.method === 'inverse trig') anyInverseTrig = true;
      if (res.method === 'trig substitution') anyTrigSub = true;
      if (res.method === 'trig power') anyTrigPower = true;
      if (res.method === 'reduction') anyReduction = true;
      if (res.method === 'form substitution') anyFormSub = true;
      if (res.label) directLabels.add(res.label);
      perTerm.push(res);
    }

    let integral;
    let steps;
    if (perTerm.length === terms.length && perTerm.length > 0) {
      // A partial-fraction result is already in its teaching form; Algebrite's
      // simplify would refactor it (1/3·(…)) and hide the pieces.
      // Likewise a trig-substitution result: simplify would turn its √ back
      // into (…)^(1/2).
      // A polynomial integrand keeps its expanded antiderivative (x^2 + x):
      // simplify factored ∫(2x + 1) dx into x·(x + 1), which nobody wants.
      const polynomial = perTerm.every((r) => r.method === 'direct' && /^(?:Power rule|Constant rule)$/.test(r.label || ''));
      // A by-parts result with a logarithm is already expanded (x·ln(x) − x);
      // simplify factored it back into x·(−1 + ln(x)).
      const byPartsLog = perTerm.some((r) => r.method === 'byparts' && /(?<![a-z])log\(/.test(r.antideriv));
      integral = perTerm.some((r) => ['partial fractions', 'trig substitution', 'trig power', 'reduction', 'form substitution'].includes(r.method)) || polynomial || byPartsLog
        ? perTerm.map((r) => r.antideriv.trim()).join(' + ').replace(/\+\s*-\s*/g, '- ')
        : (simplifyRun(Algebrite, perTerm.map((r) => `(${r.antideriv})`).join(' + ')) || perTerm.map((r) => r.antideriv).join(' + '));
      // Like terms from separate pieces are combined: ∫(2 + 3) dx was
      // "2x + 3x + C", ∫(x + 2x) dx "1/2x^2 + x^2 + C" (October 2026
      // review). Algebrite's plain evaluation collects them without the
      // factoring simplify does; taken only when it leaves fewer terms.
      let combinedFrom = null;
      if (polynomial && terms.length > 1) {
        const collected = runAlgebrite(Algebrite, integral);
        if (collected && splitTerms(collected).length < splitTerms(integral).length && expressionsNumericallyEqual(collected, integral, variable)) {
          combinedFrom = integral;
          integral = collected;
        }
      }
      // Algebrite's simplify re-expands log arguments into partial fractions;
      // polish after combining, not before.
      integral = polishLogArguments(Algebrite, integral);
      steps = buildPerTermSteps(expression, terms, perTerm, variable, integral, combinedFrom);
    } else {
      // Fallback: authoritative antiderivative for the whole expression.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = polishLogArguments(Algebrite, Algebrite.integral(forAlgebrite, variable).toString());
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
    }

    // Trust gate: the derivative of the antiderivative must equal the integrand.
    // Algebrite differentiates the result when it can; when it can't (it has
    // no abs), a numeric derivative check decides instead of failing closed.
    // A result built with full-precision decimals or nested radicals (the
    // surd partial fractions) is checked numerically: Algebrite's derivative
    // of a 17-digit float is not something mathjs reads back reliably.
    const numericOnly = perTerm.some((r) => r.numericCheck);
    const dRaw = numericOnly ? null : safeRunLocal(Algebrite, `d(${integral}, ${variable})`);
    // An unevaluated d(...) inside the derivative (Algebrite met abs) is not
    // a derivative it could take — fall through to the numeric check.
    const dCheck = dRaw && !isUnevaluatedOperator(dRaw) ? dRaw : null;
    // The symbolic comparison samples near 0, where √(x² − 9) is not real:
    // with too few real points to say, the numeric derivative check (which
    // reaches further out) decides. A disagreement is never overruled.
    const symbolic = dCheck ? numericAgreement(dCheck, rewriteReciprocalTrig(expression), variable) : null;
    const trusted = symbolic && symbolic.seen >= 3
      ? symbolic.agree === symbolic.seen
      : derivativeMatchesNumerically(integral, expression, variable);
    if (!trusted) {
      // The per-term path failed verification — fall back to whole-Algebrite.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = polishLogArguments(Algebrite, Algebrite.integral(forAlgebrite, variable).toString());
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
      // The fallback is checked the same way, and an answer that does not
      // differentiate back to the integrand is never shown. In 1.57.3 it was
      // shown unchecked: ∫ sec³x dx (which mathjs could not read, so nothing
      // could pass) came back as sec·x + C, "verified by differentiating".
      // Other letters are constants here (∫ x^2 dy = x^2·y): give each a
      // fixed sample value so the check can evaluate at all.
      const bind = (e) => bindOtherLetters(e, variable);
      const dFallback = safeRunLocal(Algebrite, `d(${integral}, ${variable})`);
      const fallbackCheck = dFallback && !isUnevaluatedOperator(dFallback) ? numericAgreement(bind(dFallback), bind(forAlgebrite), variable) : null;
      const fallbackTrusted = fallbackCheck && fallbackCheck.seen >= 3
        ? fallbackCheck.agree === fallbackCheck.seen
        : derivativeMatchesNumerically(bind(integral), bind(expression), variable);
      if (!fallbackTrusted) throw new Error('The antiderivative did not differentiate back to the integrand');
    }

    // Algebrite doesn't always throw when it can't integrate — it can return
    // `integral(f, x)` unevaluated. The derivative trust gate above does not
    // catch that (d(integral(f,x),x) simplifies straight back to f), so check
    // for the operator directly. Same honest refusal as the throw path.
    if (isUnevaluatedOperator(integral)) {
      throw new Error('Algebrite returned the integral unevaluated');
    }
    // A complex-valued antiderivative for a real integrand — Algebrite writes
    // ∫e^(x²) as -½·i·√π·erf(i·x) — is technically right (it is erfi) but not
    // a real-calculus answer. Refuse it the same way; the non-elementary note
    // for e^(x²) explains why.
    if (/\bi\b/.test(integral)) {
      throw new Error('Algebrite returned a complex-valued antiderivative');
    }

    // The error function. Algebrite answers ∫e^(−x²) dx with erf, which is
    // right — but the per-term path labelled it "Exponential rule" and the
    // tips talked about the power rule. A student meets a function they have
    // never seen with no explanation. Say what erf is and why it appears.
    const usesErf = /\berf\(/.test(integral);
    if (usesErf) steps = buildErfSteps(expression, integral, variable);

    const anyPartial = perTerm.some((r) => r.method === 'partial fractions');
    const stepText = stripMathMarkers(steps.join('\n'));
    // One irreducible quadratic and nothing to decompose: the lesson is the
    // ln + arctan split, not partial fractions.
    const singleQuadratic = /Factor the denominator: ([^\n=]+?) = \(\1\)\./.test(stepText);
    const tips = usesErf ? [
      `erf is a "special function": a named antiderivative, the way ln is the name for ${mark('∫1/x dx')}. It is not a trick or a shortcut — it is the honest answer, and tables and calculators have it.`,
      `Whole-line and half-line definite versions do have closed forms: ${mark('∫_{−∞}^∞ e^(−x²) dx = √π')}, and ${mark('∫₀^∞ e^(−x²) dx = √π/2')}.`,
      `Always add the constant of integration (${mark('+C')}) for an indefinite integral.`,
    ] : [
      anyFormSub
        ? `When the awkward piece is a function of ${mark(variable)} — ${mark(`e^${variable}`)}, ${mark(`√${variable}`)} — substitute for that piece and change ${mark(`d${variable}`)} with it: ${mark(`u = e^${variable}`)} gives ${mark(`d${variable} = du/u`)}; ${mark(`${variable} = u²`)} gives ${mark(`d${variable} = 2u du`)}. The new integral is rational, and partial fractions or a direct rule finish it.`
        : anyReduction
        ? `A reduction formula lowers a power by two: ${mark('∫sec^n(θ) dθ = sec^(n−2)(θ)·tan(θ)/(n − 1) + ((n − 2)/(n − 1))·∫sec^(n−2)(θ) dθ')}. It comes from integration by parts in which the original integral reappears and is solved for, as with ${mark('∫e^x·sin(x) dx')}.`
        : anyTrigPower
          ? `Products of powers of ${mark('sin')} and ${mark('cos')}: with an odd power, keep one factor for ${mark('du')} and convert the rest with ${mark('sin²θ + cos²θ = 1')} (odd ${mark('cos')} → ${mark('u = sin θ')}; odd ${mark('sin')} → ${mark('u = cos θ')}). Both even: the half-angle identities. For ${mark('tan')} and ${mark('sec')}: an even ${mark('sec')} power → ${mark('u = tan θ')}; an odd ${mark('tan')} power → ${mark('u = sec θ')}.`
        : anyByParts
        ? `Integration by parts: ${mark('∫u dv = uv − ∫v du')}. Pick ${mark('u')} by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential).`
        : anyTrigSub
          ? `Trigonometric substitution: ${mark(`√(a² − ${variable}²)`)} calls for ${mark(`${variable} = a·sin θ`)} (${mark(`√(a² + ${variable}²)`)} for ${mark(`${variable} = a·tan θ`)}, ${mark(`√(${variable}² − a²)`)} for ${mark(`${variable} = a·sec θ`)}); the root becomes ${mark('a·cos θ')} and the integral is one in ${mark('θ')}. Convert back with a right triangle.`
        : anyInverseTrig
          ? `Inverse-trig antiderivatives come from derivatives you know: ${mark(`d/d${variable} arctan(${variable}) = 1/(1 + ${variable}²)`)} and ${mark(`d/d${variable} arcsin(${variable}) = 1/√(1 − ${variable}²)`)}. A constant ${mark('a²')} in the pattern is factored out first.`
        : anyPartial
          ? (/divide first/.test(stepText)
            ? 'When the numerator\'s degree is not lower than the denominator\'s, divide first: the quotient integrates term by term, and only the remainder over the denominator needs partial fractions.'
            : singleQuadratic
              ? `A numerator over an irreducible quadratic splits in two: the part that is the denominator's derivative integrates to a logarithm, the constant part to an arctan (${mark('∫1/(x² + a²) dx = (1/a)·arctan(x/a)')}).`
              : 'Partial fractions: factor the denominator, write the fraction as a sum of simpler ones (one per factor), find each constant (cover-up or comparing coefficients), then integrate each piece — a linear factor gives a logarithm, an irreducible quadratic a logarithm and an arctan, a repeated factor a power.')
        : anySubstitution
          ? `u-substitution: look for an inner function whose derivative appears as a factor — ${mark('∫g′(x)·h(g(x)) dx = ∫h(u) du')} with ${mark('u = g(x)')}.`
          : anyAbs
            ? `${mark('∫|ax + b| dx = (ax + b)·|ax + b| / (2a) + C')} — split at the corner, integrate each piece, and the two pieces match up into one formula.`
            : directTip(directLabels, variable),
      `Always add the constant of integration (${mark('+C')}) for an indefinite integral.`,
      `Constant factors pull out front: ${mark('∫c·f dx = c·∫f dx')}.`,
    ];

    const common_mistakes = usesErf ? [
      `Trying ${mark('u = −x²')}: then ${mark('du = −2x dx')}, and there is no ${mark('x')} factor in the integrand to absorb it — the substitution does not close.`,
      `Reading ${mark('e^(−x²)')} as ${mark('(e^(−x))²')} — the square is on ${mark('x')}, not on ${mark('e^(−x)')}. ${mark('(e^(−x))² = e^(−2x)')}, which IS elementary.`,
      `Forgetting the constant of integration (${mark('+C')}).`,
    ] : [
      `Forgetting the constant of integration (${mark('+C')}).`,
      anyFormSub
        ? `Substituting ${mark(`u = e^${variable}`)} but leaving ${mark(`d${variable}`)} alone — ${mark(`d${variable} = du/u`)}, and that extra ${mark('1/u')} is what makes the new integrand rational.`
        : anyReduction
        ? `Trying ${mark('u = sec θ')} on ${mark('sec³θ')}: ${mark('du = sec θ tan θ dθ')} is not a factor of the integrand, so the substitution does not close — the reduction formula is the way.`
        : anyTrigPower
          ? `Splitting off the factor from the EVEN power: the leftover must be convertible with ${mark('sin²θ + cos²θ = 1')}, which needs an even power left behind.`
        : anyByParts
        ? `Choosing ${mark('u')} and ${mark('dv')} the wrong way round — LIATE picks the ${mark('u')} that gets simpler when differentiated.`
        : anyTrigSub
          ? `Forgetting to change ${mark(`d${variable}`)} as well as the integrand (${mark('dx = a·cos θ dθ')}), or leaving the answer in ${mark('θ')} instead of converting back to ${mark(variable)}.`
        : anyInverseTrig
          ? `Reading ${mark(`1/(1 + ${variable}²)`)} as a power of ${mark(variable)} — it is not ${mark(`${variable}^(−2)`)}, and the power rule does not apply.`
        : anyPartial
          ? (/divide first/.test(stepText)
            ? 'Decomposing an improper fraction without dividing first: partial fractions need the numerator\'s degree below the denominator\'s.'
            : singleQuadratic
              ? `Integrating ${mark('1/(x² + 1)')} as a logarithm: ${mark('ln(x² + 1)')} differentiates to ${mark('2x/(x² + 1)')}, which has an ${mark('x')} on top. The constant part is an arctan.`
              : `Splitting ${mark('1/(a·b)')} into ${mark('1/a + 1/b')} — the decomposition needs constants found from the factors, not a guess.`)
        : anySubstitution
          ? `Forgetting to divide by ${mark('g′(x)')} when changing to ${mark('du')} — the constant from ${mark('du = g′(x) dx')} must be carried.`
          : anyAbs
            ? `Integrating ${mark('|x|')} as if it were ${mark('x')}, giving ${mark('x²/2')} — that is only right for ${mark('x ≥ 0')}.`
            : directMistake(directLabels, variable),
      directLabels.has('Power rule') || (!anyByParts && !anySubstitution && !anyAbs && !anyInverseTrig && !anyTrigPower && !anyReduction && !anyFormSub && directLabels.size === 0)
        ? `Applying the power rule to ${mark('1/x')} — that integrates to ${mark('ln|x|')}, not ${mark('x⁰/0')}.`
        : 'Skipping the check: differentiate the result and compare it with the integrand.',
    ];

    // A term that brings its own display (surd partial fractions: nested
    // radicals and ≈ coefficients that lnify would not tidy) is shown as it
    // wrote itself, when every term has one.
    const ownDisplay = perTerm.length > 0 && perTerm.length === terms.length && perTerm.every((r) => r.shown);
    let shownIntegral = usesErf ? prettyErf(integral) : ownDisplay ? perTerm.map((r) => r.shown).join(' + ').replace(/\+ −/g, '− ') : dropBarsOnPositiveArguments(lnify(integral), integral, variable);
    if (ownDisplay && steps.length) {
      const approx = perTerm.some((r) => r.approximate);
      steps[steps.length - 1] = `Add the constant of integration: ${mark(`∫(${beautify(expression)}) d${variable} ${approx ? '≈' : '='} ${shownIntegral} + C`)}.`;
    }
    // ∫ ln(x) dx lives where x > 0, so its answer is x·ln(x) − x: the bars
    // of ln|x| say nothing there, and "u = ln|x|" misquoted the integrand.
    const unbar = (text) => dropBarsOnIntegrandLogs(text, expression);
    steps = steps.map(unbar);
    shownIntegral = unbar(shownIntegral);
    return {
      steps,
      // ∫(x − x) dx: the antiderivative is the constant alone, not "0 + C".
      answer: `∫(${beautify(expression)}) d${variable} ${perTerm.some((r) => r.approximate) ? '≈' : '='} ${shownIntegral.trim() === '0' ? 'C' : `${shownIntegral} + C`}`,
      tips: [...new Set(tips)],
      common_mistakes: [...new Set(common_mistakes)],
      graph: generateIntegralGraph(expression, integral, variable, shownIntegral),
    };
  } catch (error) {
    console.error('Integral solver error:', error);
    if (parsesAsMath(expression)) {
      // Two different claims, kept apart: "non-elementary" is asserted only
      // for the integrands in the known list; everything else is an engine
      // limitation, and is said to be — never dressed up as a theorem.
      const note = nonElementaryNote(expression);
      return unsupported({
        input: `∫(${expression}) dx`,
        reason: note
          ? `This integral is non-elementary — ${note}.`
          : 'MasterMath could not find this antiderivative symbolically. The input is valid; the integral may well have an elementary answer that this engine\'s methods (direct rules, u-substitution, integration by parts, partial fractions, trigonometric substitution, trig powers and reduction formulas) do not reach.',
        answer: note ? undefined : 'MasterMath could not solve this integral symbolically',
        tips: note
          ? [
              'The input is valid — not every elementary function has an elementary antiderivative.',
              `A definite version is estimated numerically: give the bounds, e.g. ${mark('∫_0^1')} of the same integrand.`,
            ]
          : [
              'This is a limitation of the solver, not a statement about the mathematics.',
              `A definite version is estimated numerically: give the bounds, e.g. ${mark('∫_0^1')} of the same integrand.`,
              'Try rewriting the integrand (expand, split a fraction, use an identity) — a different form may be one the engine handles.',
            ],
      });
    }
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use "^" for powers and "*" for products (e.g., "x^2 * sin(x)").'],
    });
  }
}

function generateIntegralGraph(original, integral, variable, shown = null) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(integral, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        expression: original,
        secondaryExpression: integral,
        variable,
        secondaryLabel: `F(${variable}) = ${shown || lnify(integral)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: F(${variable}) = ${shown || lnify(integral)} (antiderivative)`,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
