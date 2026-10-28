import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  splitTerms,
  runAlgebrite,
  sampleFunction,
  hasVariable,
  rewriteReciprocalTrig,
  expressionsNumericallyEqual,
  numericAgreement,
  parsesAsMath,
  isUnevaluatedOperator,
  isAlgebriteFailure,
  lnify,
  splitTopLevel,
  stripOuterParens,
  gcd,
  mark,
  bareFunctionName,
  bareFunctionRefusal,
} from './solverUtils.js';
import { extractVariable, extractFunctionFromProblem, parseMathExpression } from '../mathParser.js';
import { integrateByParts, needsByParts } from './byPartsSolver.js';
import { integrateBySubstitution, integrateAbsLinear, derivativeMatchesNumerically } from './substitutionSolver.js';
import { integrateByTrigSubstitution, integrateByTriangleSubstitution } from './trigSubstitutionSolver.js';
import { integrateTrigPower } from './trigPowerSolver.js';
import { integrateBySurdPartialFractions } from './surdPartialFractions.js';
import { readPolynomial, allRoots } from './polynomialRoots.js';
import { createMath } from '../mathInstance.js';
import { parseError, unsupported, diverges } from '../solutionEnvelope.js';
import { stripMathMarkers } from '../mathMarkers.js';

// Famous non-elementary integrands, so "the engine can't do this" comes with
// the honest reason: the antiderivative exists but isn't elementary. The
// patterns are anchored to the WHOLE integrand — a substring match would
// wrongly flag elementary neighbors like x*sin(x^2) (plain u-substitution).
const NON_ELEMENTARY_NOTES = [
  [/^sin\([a-z]\^2\)$/i, 'its antiderivative is the Fresnel S function, which is not expressible in elementary functions'],
  [/^cos\([a-z]\^2\)$/i, 'its antiderivative is the Fresnel C function, which is not expressible in elementary functions'],
  [/^(?:e\^\(?-[a-z]\^2\)?|exp\(-[a-z]\^2\))$/i, 'its antiderivative is related to the error function erf(x), which is not elementary'],
  [/^(?:e\^\(?[a-z]\^2\)?|exp\([a-z]\^2\))$/i, 'its antiderivative is related to the imaginary error function erfi(x), which is not elementary'],
  [/^sin\([a-z]\)\/[a-z]$/i, 'its antiderivative is the sine integral Si(x), which is not elementary'],
  [/^cos\([a-z]\)\/[a-z]$/i, 'its antiderivative is the cosine integral Ci(x), which is not elementary'],
  [/^(?:e\^[a-z]|e\^\([a-z]\)|exp\([a-z]\))\/[a-z]$/i, 'its antiderivative is the exponential integral Ei(x), which is not elementary'],
  [/^(?:e\^\(?-[a-z]\)?|exp\(-[a-z]\))\/[a-z]$/i, 'its antiderivative is the exponential integral −Ei(−x), which is not elementary'],
  [/^1\/(?:ln|log)\([a-z]\)$/i, 'its antiderivative is the logarithmic integral li(x), which is not elementary'],
  [/^(?:ln|log)\([a-z]\)\/\([a-z][+-]1\)$/i, 'its antiderivative is a dilogarithm, which is not elementary'],
];

function nonElementaryNote(expression) {
  const normalized = String(expression).replace(/\s+/g, '');
  for (const [pattern, note] of NON_ELEMENTARY_NOTES) {
    if (pattern.test(normalized)) return note;
  }
  return null;
}

// The integral solver receives the RAW problem text (see api.js), because a
// definite integral's bounds live in the notation and must be read before
// parseMathExpression collapses the spacing.
export async function solveIntegral(rawInput) {
  const definite = parseDefiniteIntegral(rawInput);
  if (definite) {
    const bare = definite.integrand && bareFunctionName(parseMathExpression(definite.integrand));
    if (bare) return parseError({ input: rawInput, ...bareFunctionRefusal(bare) });
    return solveDefiniteIntegral(definite);
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
  return solveIndefiniteIntegral(stripOuterParens(expression), dvar ? dvar[1].toLowerCase() : undefined);
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

// The first tip and mistake for a directly-integrated expression follow the
// rule(s) its terms actually used; "Power rule" used to be served with
// sec²(x) → tan(x) and ln|2x + 1| alike.
function directTip(labels, v) {
  if (labels.has('Power rule') || labels.size === 0) return `Power rule: ${mark(`∫${v}^n d${v} = ${v}^(n+1)/(n+1) + C`)}  (${mark('n ≠ -1')})`;
  if (labels.has('Trig rule')) return `The trig antiderivatives are the trig derivatives read backwards: ${mark('∫cos = sin')}, ${mark('∫sin = −cos')}, ${mark('∫sec² = tan')}, ${mark('∫sec·tan = sec')}.`;
  if (labels.has('Exponential rule')) return `${mark(`∫e^${v} d${v} = e^${v}`)} — the exponential is its own antiderivative; ${mark(`∫a^${v} d${v} = a^${v}/ln(a)`)}.`;
  if (labels.has('Reciprocal rule')) return `${mark(`∫1/${v} d${v} = ln|${v}| + C`)} — the one power the power rule cannot do (${mark('n = −1')} would divide by ${mark('0')}).`;
  if (labels.has('Linear substitution')) return `For ${mark(`1/(a${v} + b)`)}, let ${mark(`u = a${v} + b`)}: the ${mark('1/a')} from ${mark(`du = a d${v}`)} is the only extra factor.`;
  // The three labels that used to fall through to the generic line (October
  // 2026 tips audit): sin², a linear inside, a table entry.
  if (labels.has('Half-angle identity')) return `${mark(`sin²(${v})`)} and ${mark(`cos²(${v})`)} integrate through the half-angle identities: ${mark(`sin²(${v}) = (1 − cos(2${v}))/2`)}, ${mark(`cos²(${v}) = (1 + cos(2${v}))/2`)} — a sum of a constant and a cosine, each easy.`;
  if (labels.has('u-substitution')) return `A linear inside, ${mark(`cos(a${v} + b)`)}: let ${mark(`u = a${v} + b`)}, so ${mark(`du = a d${v}`)} and a factor ${mark('1/a')} comes out — ${mark(`∫cos(2${v}) d${v} = (1/2)·sin(2${v}) + C`)}.`;
  if (labels.has('Trig quotient')) return `The table entries ${mark('∫tan = −ln|cos|')}, ${mark('∫cot = ln|sin|')}, ${mark('∫sec = ln|sec + tan|')}, ${mark('∫csc = ln|csc − cot|')} all come from one idea: write the integrand as (derivative of a function)/(that function), and ${mark('∫u′/u = ln|u|')}.`;
  if (labels.has('Trigonometric substitution')) return `Trigonometric substitution: ${mark(`√(a² + ${v}²)`)} calls for ${mark(`${v} = a·tan θ`)}, ${mark(`√(${v}² − a²)`)} for ${mark(`${v} = a·sec θ`)}, ${mark(`√(a² − ${v}²)`)} for ${mark(`${v} = a·sin θ`)}; the radical becomes a single trig function, and a right triangle converts the answer back to ${mark(v)}.`;
  if (labels.has('Trigonometric identity')) return `Even powers of ${mark('sin')} and ${mark('cos')} are lowered with the half-angle identities (${mark('sin²θ = (1 − cos 2θ)/2')}, ${mark('cos²θ = (1 + cos 2θ)/2')}); a product ${mark('sin θ cos θ')} is ${mark('(sin 2θ)/2')}. Repeat until only first powers of cosines remain.`;
  if (labels.has('Table antiderivative')) return `The table entries worth knowing: ${mark('∫tan = −ln|cos|')}, ${mark('∫cot = ln|sin|')}, ${mark('∫sec = ln|sec + tan|')} — each comes from writing the function with sin and cos and substituting ${mark('u')} = the denominator.`;
  return 'Every antiderivative can be checked by differentiating it — the derivative must give back the integrand exactly.';
}

function directMistake(labels, v) {
  if (labels.has('Power rule') || labels.size === 0) return `Mishandling the ${mark('(n+1)')} denominator in the power rule.`;
  if (labels.has('Trig rule')) return `Sign slips: ${mark(`∫sin(${v}) d${v} = −cos(${v})`)}, while ${mark(`∫cos(${v}) d${v} = +sin(${v})`)}.`;
  if (labels.has('Exponential rule')) return `Treating ${mark(`e^${v}`)} like a power and writing ${mark(`e^(${v}+1)/(${v}+1)`)}.`;
  if (labels.has('Reciprocal rule')) return `Writing ${mark(`∫1/${v} d${v}`)} as ${mark(`${v}⁰/0`)} — use ${mark(`ln|${v}|`)} instead, with the absolute value.`;
  if (labels.has('Linear substitution')) return `Forgetting the ${mark('1/a')} factor that comes from ${mark('du = a dx')}.`;
  if (labels.has('Half-angle identity')) return `Applying the power rule to ${mark(`sin²(${v})`)}: ${mark(`sin³(${v})/3`)} is not its antiderivative — differentiating that leaves a ${mark(`cos(${v})`)} behind.`;
  if (labels.has('u-substitution')) return `Forgetting the ${mark('1/a')}: ${mark(`∫cos(2${v}) d${v}`)} is ${mark(`(1/2)·sin(2${v})`)}, not ${mark(`sin(2${v})`)}.`;
  if (labels.has('Trig quotient')) return `Writing ${mark(`∫tan(${v}) d${v}`)} as ${mark(`sec²(${v})`)} — that is the derivative of tan, read the wrong way round — or dropping the minus sign from ${mark(`du = −sin(${v}) d${v}`)}.`;
  if (labels.has('Trigonometric substitution')) return `Forgetting to change ${mark(`d${v}`)} along with the integrand, or leaving the answer in ${mark('θ')} instead of converting back to ${mark(v)}.`;
  if (labels.has('Trigonometric identity')) return `Applying the power rule to ${mark(`sin²(${v})`)} or ${mark(`cos²(${v})`)}: ${mark(`sin³(${v})/3`)} is not an antiderivative of ${mark(`sin²(${v})`)} — differentiating it leaves a ${mark(`cos(${v})`)} behind.`;
  if (labels.has('Table antiderivative')) return `Writing ${mark(`∫tan(${v}) d${v}`)} as ${mark(`sec²(${v})`)} — that is the derivative of tan, read the wrong way round.`;
  return 'Skipping the check: differentiate the result and compare it with the integrand.';
}

// Algebrite writes √π as pi^(1/2) and the Gaussian antiderivative as
// 1/2*pi^(1/2)*erf(x). Present it the way a table does: (√π/2)·erf(x).
function prettyErf(integralResult) {
  return lnify(integralResult)
    .replace(/pi\^\(1\/2\)/g, '√π')
    .replace(/(\d+)\/(\d+)\*√π/g, '($1√π/$2)')
    .replace(/\(1√π\/(\d+)\)/g, '(√π/$1)')
    .replace(/\)\*erf/g, ')·erf');
}

// Steps for an antiderivative that involves the error function: say plainly
// that no elementary antiderivative exists, define erf, and show that the
// stated answer differentiates back to the integrand. The mathematics is
// Algebrite's; the explanation is the whole point.
function buildErfSteps(expression, integral, variable) {
  const v = variable;
  const shown = beautify(expression);
  return [
    `Identify the function to integrate: ∫(${shown}) d${v}.`,
    `This integrand has no elementary antiderivative: no finite combination of polynomials, roots, exponentials, logarithms and trig functions differentiates to a Gaussian ${mark(`e^(−k${v}²)`)} (Liouville's theorem). So no substitution or integration by parts will finish it — ${mark('u')} = the exponent would need a factor of ${mark(v)} that is not there.`,
    `Calculus handles this by NAMING the antiderivative. The error function is defined as ${mark(`erf(${v}) = (2/√π)·∫_0^${v} e^(−t²) dt`)}, so by the Fundamental Theorem of Calculus ${mark(`d/d${v} erf(${v}) = (2/√π)·e^(−${v}²)`)}.`,
    `Rearranging that derivative: ${mark(`e^(−${v}²) = (√π/2)·d/d${v} erf(${v})`)}, so ${mark(`∫e^(−${v}²) d${v} = (√π/2)·erf(${v}) + C`)}. Constant factors and a scaled argument (${mark(`e^(−k${v}²)`)}) carry through the same way.`,
    `For this integrand: ${mark(`∫(${shown}) d${v} = ${prettyErf(integral)}`)}.`,
    `Check by differentiating: ${mark(`d/d${v}[${prettyErf(integral)}] = ${shown}`)} ✓ (verified symbolically).`,
    `Add the constant of integration: ${mark(`∫(${shown}) d${v} = ${prettyErf(integral)} + C`)}.`,
  ];
}

// lnify (ln|…|, e^…) is the shared formatter in solverUtils.

function safeRunLocal(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

function simplifyRun(Algebrite, expr) {
  return safeRunLocal(Algebrite, `simplify(${expr})`);
}

// Tidy the argument of every log(...) in an antiderivative for display.
// Algebrite's partial fractions leave ∫1/(x²−1) as
// ½·log(−1/(−x−1) + x/(−x−1)); rationalized that is (x−1)/(−x−1), and since
// the result is shown as ln|…| a sign flip of the argument is exact, so the
// form with fewer minus signs is chosen: ½·ln|(x−1)/(x+1)|. Display only —
// the value is unchanged (checked below by numeric equality of |arg|).
function polishLogArguments(Algebrite, expr) {
  const src = String(expr);
  return src.replace(/\blog\(((?:[^()]|\([^()]*\))+)\)/g, (whole, arg) => {
    if (!/[+\-*/]/.test(arg)) return whole; // already a bare factor
    let best = arg;
    const candidates = [];
    const rat = safeRunLocal(Algebrite, `rationalize(${arg})`);
    if (rat) {
      candidates.push(rat);
      // For a quotient, also try flipping the signs of numerator and
      // denominator together: (x−1)/(−x−1) → (1−x)/(x+1) → shown as
      // (x−1)/(x+1) since it sits under |…|. Each is a candidate; the
      // numeric check below decides.
      const parts = splitTopLevel(rat, '/');
      if (parts.length === 2) {
        const num = safeRunLocal(Algebrite, `simplify(-(${parts[0]}))`);
        const den = safeRunLocal(Algebrite, `simplify(-(${parts[1]}))`);
        if (num && den) {
          const wrap = (t) => (/[+\-]/.test(t.replace(/^-/, '')) ? `(${t})` : t);
          candidates.push(`${wrap(num)}/${wrap(den)}`);
          candidates.push(`${wrap(parts[0].trim())}/${wrap(den)}`); // |A/−B| = |A/B|
          candidates.push(`${wrap(num)}/${wrap(parts[1].trim())}`);
        }
      }
    }
    const neg = safeRunLocal(Algebrite, `rationalize(-(${arg}))`);
    if (neg) candidates.push(neg);
    for (const c of candidates) {
      // |candidate| must equal |arg| numerically before it may replace it.
      const same = expressionsNumericallyEqual(`abs(${c})`, `abs(${arg})`, 'x');
      if (!same) continue;
      const minuses = (c.match(/-/g) || []).length;
      const bestMinuses = (best.match(/-/g) || []).length;
      if (minuses < bestMinuses || (minuses === bestMinuses && c.length < best.length)) best = c;
    }
    return `log(${best})`;
  });
}

/**
 * Integrate one additive term. A by-parts term returns its full walkthrough;
 * everything else is integrated directly by Algebrite. Returns
 * { antideriv, steps, method, term } or null when the term can't be integrated.
 */
async function integrateTerm(term, variable, Algebrite) {
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

// ∫ c/(x⁴ + d) dx for d > 0 with √d an integer s (d = 1, 9, 16, …):
//   x⁴ + d = (x² + r·x + s)(x² − r·x + s),  r = √(2s)
//   c/(x⁴ + d) = c·[(x/(2rs) + 1/(2s))/(x² + rx + s) + (−x/(2rs) + 1/(2s))/(x² − rx + s)]
// and each piece, after completing the square ((x ± r/2)² + s/2), is a
// logarithm plus an arctan (q = √(s/2)):
//   ∫ = c/(4rs)·ln((x² + rx + s)/(x² − rx + s)) + c/(4sq)·[arctan((x + r/2)/q) + arctan((x − r/2)/q)]
// (d = 4 has r = 2 and is already factored over the rationals above; this
// path serves the cases where r is a surd.) Verified by differentiation.
function integrateQuarticSum(term, v) {
  const t = String(term).replace(/\s+/g, '');
  const m = t.match(new RegExp(`^(-)?(\\d+(?:\\.\\d+)?)?/\\((?:${v}\\^4\\+(\\d+)|(\\d+)\\+${v}\\^4)\\)$`));
  if (!m) return null;
  const c = (m[1] ? -1 : 1) * (m[2] === undefined ? 1 : Number(m[2]));
  const d = Number(m[3] ?? m[4]);
  const s0 = Math.sqrt(d);
  if (!(d > 0) || !Number.isInteger(s0)) return null;
  const twoS = 2 * s0;
  if (Number.isInteger(Math.sqrt(twoS))) return null; // r rational: the rational factoring handles it
  const surd = exactSurd(twoS); // r = s·√t
  if (!surd) return null;
  const rText = `${surd.s === 1 ? '' : surd.s}√${surd.t}`;
  const rRaw = `${surd.s === 1 ? '' : `${surd.s}*`}sqrt(${surd.t})`;
  const halfR = `${rRaw}/2`;
  const q = exactSurd(s0 / 2); // q = √(s/2)
  if (!q) return null;
  const qRaw = q.rational ? `${q.s}/${q.b}` : `${q.s === 1 ? '' : `${q.s}*`}sqrt(${q.t})/${q.b}`;
  const qText = q.rational ? fmtNum(q.s / q.b) : `${q.s === 1 ? '' : q.s}√${q.t}${q.b === 1 ? '' : `/${q.b}`}`;
  const plus = `${v}^2 + ${rRaw}*${v} + ${s0}`;
  const minus = `${v}^2 - ${rRaw}*${v} + ${s0}`;
  const plusText = `${v}² + ${rText}${v} + ${s0}`;
  const minusText = `${v}² − ${rText}${v} + ${s0}`;
  // (x ± r/2)/q = (2x ± r)/r = (2/r)·x ± 1, since 2q = √(2s) = r.
  const twoOverR = exactSurd(4 / twoS); // 2/r as a·√t/b
  if (!twoOverR) return null;
  const slopeRaw = twoOverR.rational ? `${twoOverR.s}/${twoOverR.b}` : `${twoOverR.s === 1 ? '' : `${twoOverR.s}*`}sqrt(${twoOverR.t})${twoOverR.b === 1 ? '' : `/${twoOverR.b}`}`;
  const slopeText = twoOverR.rational ? fmtNum(twoOverR.s / twoOverR.b) : `${twoOverR.s === 1 ? '' : twoOverR.s}√${twoOverR.t}${twoOverR.b === 1 ? '' : `/${twoOverR.b}`}`;
  // c/(4·s·r) and c/(2·s·r) in lowest terms over the surd: 3/(12√6) is 1/(4√6).
  const reduced = (mult) => { const g = gcd(Math.abs(c), mult * s0) || 1; return [c / g, (mult * s0) / g]; };
  const [logN, logD] = reduced(4);
  const [atanN, atanD] = reduced(2);
  const logCoefRaw = `${logN}/(${logD}*${rRaw})`;
  const atanCoefRaw = `${atanN}/(${atanD}*${rRaw})`;
  const F = `${logCoefRaw}*(log(${plus}) - log(${minus})) + ${atanCoefRaw}*(arctan(${slopeRaw}*${v} + 1) + arctan(${slopeRaw}*${v} - 1))`;
  if (!derivativeMatchesNumerically(F, term, v)) return null;
  const cT = c === 1 ? '' : c === -1 ? '−' : `${c}·`;
  const coefText = (mult) => { const [n, dd] = reduced(mult); return `${n}/(${dd === 1 ? '' : dd}${rText})`; };
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — the denominator has no real roots and does not factor over the rationals, but it does over a square root: ${mark(`${v}⁴ + ${d} = (${plusText})(${minusText})`)} (check: the ${mark(`${v}²`)} terms give ${mark(`2·${s0} − (${rText})² = 0`)}).`,
    `Partial fractions with those two irreducible quadratics: ${mark(`${beautify(term)} = ${cT}[(${v}/(2·${rText}${s0 === 1 ? '' : `·${s0}`}) + 1/${s0 === 1 ? '2' : `(2·${s0})`})/(${plusText}) + (−${v}/(2·${rText}${s0 === 1 ? '' : `·${s0}`}) + 1/${s0 === 1 ? '2' : `(2·${s0})`})/(${minusText})]`)}.`,
    `Each piece splits into the derivative of its denominator (a logarithm) and a constant over a completed square (an arctan): ${mark(`${plusText} = (${v} + ${rText}/2)² + ${s0}/2`)}, and the same for the other with ${mark('−')}; the arctan arguments simplify to ${mark(`${slopeText}${v} ± 1`)}.`,
    `So ${mark(`∫(${beautify(term)}) d${v} = ${coefText(4)}·ln((${plusText})/(${minusText})) + ${coefText(2)}·[arctan(${slopeText}${v} + 1) + arctan(${slopeText}${v} − 1)]`)}.`,
  ];
  return { antiderivative: F, steps };
}

// N(x)/D(x) with deg N < deg D and D having distinct real roots r₁…rₖ:
//   N/D = Σ Aᵢ/(x − rᵢ),  Aᵢ = N(rᵢ)/D′(rᵢ)   (Heaviside cover-up)
// so ∫ = Σ Aᵢ·ln|x − rᵢ|. Repeated or complex roots are left to the caller
// (null). Everything is checked: the decomposition numerically, the
// antiderivative by differentiation.
// An improper rational function — the numerator's degree is not below the
// denominator's: (x³ + 2)/((x − 1)(x + 1)²) — is divided first, N/D = Q + R/D
// (Algebrite's quotient, checked numerically), then ∫Q by the power rule and
// R/D by partial fractions. The total is checked by differentiation. Before
// 1.53.1 Algebrite's integral() ground on these for about a minute and gave up.
function integrateImproperRational(term, v, Algebrite) {
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  const N = readPolynomial(stripOuterParens(num), v);
  const D = readPolynomial(stripOuterParens(den), v);
  if (!N || !D) return null;
  const degree = (P) => { const c = P.coefficients.map((q) => q.n); let d = c.length - 1; while (d > 0 && c[d] === 0n) d -= 1; return d; };
  const degN = degree(N);
  const degD = degree(D);
  if (degD < 1 || degN < degD) return null;
  const run = (e) => { try { const r = String(Algebrite.run(e)).trim(); return r && !isAlgebriteFailure(r) ? r : null; } catch { return null; } };
  const Q = run(`quotient(${num}, ${den}, ${v})`);
  if (!Q) return null;
  const R = run(`expand((${num}) - (${Q})*(${den}))`);
  if (R === null) return null;
  for (const x of [0.31, 1.73, -2.41, 3.37]) {
    let l; let r;
    try { l = math.evaluate(`(${num})/(${den})`, { [v]: x }); r = math.evaluate(`(${Q}) + (${R})/(${den})`, { [v]: x }); } catch { return null; }
    if (Number.isFinite(l) && Number.isFinite(r) && Math.abs(l - r) > 1e-8 * (1 + Math.abs(l))) return null;
  }
  const antiQ = run(`integral(${Q}, ${v})`);
  if (!antiQ) return null;
  const rest = R === '0' ? null : `(${R})/(${den})`;
  let pf = rest ? (integrateByPartialFractions(rest, v, Algebrite) || integrateByGeneralPartialFractions(rest, v, Algebrite) || integrateBySurdPartialFractions(rest, v)) : null;
  // A remainder over a linear denominator (x³/(x − 1) leaves 1/(x − 1)) is
  // one logarithm, no decomposition needed.
  if (rest && !pf && degD === 1) {
    const direct = run(`integral(${rest}, ${v})`);
    if (direct && !/integral\(/.test(direct)) {
      pf = { antiderivative: direct, steps: [`${mark(`∫${beautify(rest)} d${v} = ${lnify(direct)}`)} (${mark('∫1/(a' + v + ' + b) d' + v + ' = (1/a)·ln|a' + v + ' + b|')}).`], linear: true };
    }
  }
  if (rest && !pf) return null;
  const anti = pf ? `${antiQ} + ${pf.antiderivative}` : antiQ;
  // Differentiate back at points where the integrand and the logarithms are real.
  const dnum = (x) => { try { const hh = 1e-5; return (math.evaluate(anti, { [v]: x + hh }) - math.evaluate(anti, { [v]: x - hh })) / (2 * hh); } catch { return NaN; } };
  let checked = 0;
  for (const x of [0.37, 1.13, 2.29, 3.71, 5.17, 7.43].map((d) => d + 4)) {
    let expected; try { expected = math.evaluate(`(${num})/(${den})`, { [v]: x }); } catch { continue; }
    const got = dnum(x);
    if (!Number.isFinite(expected) || !Number.isFinite(got)) continue;
    if (Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
    checked += 1;
  }
  if (checked < 3) return null;
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — the numerator has degree ${mark(String(degN))} and the denominator degree ${mark(String(degD))}, so divide first: ${mark(`${beautify(term)} = ${beautify(Q)}${R === '0' ? '' : ` + (${beautify(R)})/(${beautify(stripOuterParens(den))})`}`)}.`,
    `Integrate the polynomial part: ${mark(`∫(${beautify(Q)}) d${v} = ${lnify(antiQ)}`)}.`,
    ...(pf ? [`Then the proper fraction ${mark(beautify(rest))}${pf.linear ? '' : ' by partial fractions'}:`, ...pf.steps.map((t) => `  ${t}`)] : []),
    `Add the parts: ${mark(lnify(anti))}.`,
  ];
  return { antiderivative: anti, steps };
}

// The denominator as typed, when it is a product of powers of polynomials
// of degree ≤ 2 — (x − 1)^2*(x^2 + 1) — read exactly, so Algebrite's
// factor() and roots() (about 2 s each on (x^2 + 4)^2, which they expand
// to a quartic first) are not needed. Null for any other shape.
function typedFactors(den, v) {
  const out = [];
  // A sum outside all brackets is one factor: x^2+2*x+5 is not x^2+2 times x+5.
  const text = String(den).trim();
  const factorsTyped = hasTopLevelSum(text) ? [text] : splitTopLevel(text, '*').map((t) => t.trim()).filter(Boolean);
  for (const raw of factorsTyped) {
    let f = raw;
    let power = 1;
    const pm = f.match(/^\((.+)\)\^(\d+)$/) || f.match(/^([a-z])\^(\d+)$/i);
    if (pm && matchingParenIndex(f) === f.length - pm[2].length - 2) { f = pm[1]; power = Number(pm[2]); } else if (pm && /^[a-z]$/i.test(pm[1])) { f = pm[1]; power = Number(pm[2]); }
    f = stripOuterParens(f);
    const P = readPolynomial(f, v);
    if (!P) return null;
    const c = P.coefficients.map((q) => Number(q.s) * Number(q.n) / Number(q.d));
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    const deg = c.length - 1;
    if (deg > 2) return null;
    out.push({ deg, c, power });
  }
  return out.length ? out : null;
}
const matchingParenIndex = (s) => { let depth = 0; for (let i = 0; i < s.length; i += 1) { if (s[i] === '(') depth += 1; else if (s[i] === ')') { depth -= 1; if (depth === 0) return i; } } return -1; };

function integrateByPartialFractions(term, variable, Algebrite) {
  const v = variable;
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  if (!hasVariable(den, v)) return null;
  // A repeated or irreducible-quadratic factor, as typed, is not this
  // routine's case: say so before asking Algebrite for the roots.
  const typed = typedFactors(den, v);
  if (typed && typed.some((f) => (f.deg > 0 && f.power > 1) || (f.deg === 2 && f.c[1] ** 2 - 4 * f.c[2] * f.c[0] < 0))) return null;
  const isPoly = (e) => { try { const d = String(Algebrite.run(`deg(${e}, ${v})`)).trim(); return /^\d+$/.test(d) ? Number(d) : null; } catch { return null; } };
  const degN = isPoly(num);
  const degD = isPoly(den);
  if (degN === null || degD === null || degD < 2 || degN >= degD) return null;
  // Distinct real roots only: the exact root finder says in milliseconds
  // whether there is a non-real or a repeated root; Algebrite's roots() took
  // 2 s to list the complex roots of x⁴ + 3x² + 2 that were then thrown away
  // (and minutes on a repeated quadratic factor).
  const polyD = readPolynomial(den, v);
  if (polyD && !polyD.tooHigh) {
    const found = allRoots(polyD);
    if (found.complexCount > 0 || found.real.some((r) => r.multiplicity > 1)) return null;
  }
  // Real, distinct roots of the denominator.
  let rootsRaw;
  try { rootsRaw = String(Algebrite.run(`roots(${den}, ${v})`)).trim(); } catch { return null; }
  if (!rootsRaw || isAlgebriteFailure(rootsRaw) || /\bi\b/.test(rootsRaw)) return null;
  const rootList = rootsRaw.replace(/^\[|\]$/g, '').split(',').map((r) => r.trim()).filter(Boolean);
  if (rootList.length !== degD) return null; // repeated or missing roots
  const rootVals = rootList.map((r) => { try { return math.evaluate(r); } catch { return NaN; } });
  if (!rootVals.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  for (let i = 0; i < rootVals.length; i += 1) for (let j = i + 1; j < rootVals.length; j += 1) if (Math.abs(rootVals[i] - rootVals[j]) < 1e-9) return null;
  // Aᵢ = N(rᵢ)/D′(rᵢ), exact via Algebrite.
  const dDen = String(Algebrite.run(`d(${den}, ${v})`)).trim();
  const coefs = rootList.map((r) => {
    try { return String(Algebrite.run(`simplify(subst(${r}, ${v}, ${num}) / subst(${r}, ${v}, ${dDen}))`)).trim(); } catch { return null; }
  });
  if (coefs.some((c) => !c || isAlgebriteFailure(c) || /nil|Stop|\bi\b/.test(c))) return null;
  // Verify the decomposition numerically at a few points.
  const decomposed = rootList.map((r, i) => `(${coefs[i]})/(${v} - (${r}))`).join(' + ');
  for (const x of [0.37, 1.91, -2.63, 4.2]) {
    let lhs; let rhs;
    try { lhs = math.evaluate(`(${num})/(${den})`, { [v]: x }); rhs = math.evaluate(decomposed, { [v]: x }); } catch { return null; }
    if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) continue;
    if (Math.abs(lhs - rhs) > 1e-6 * (1 + Math.abs(lhs))) return null;
  }
  const anti = rootList.map((r, i) => `(${coefs[i]})*log(${v} - (${r}))`).join(' + ');
  let antiSimple;
  try { antiSimple = String(Algebrite.run(`simplify(${anti})`)).trim(); } catch { antiSimple = anti; }
  if (!antiSimple || isAlgebriteFailure(antiSimple)) antiSimple = anti;
  // Verify by differentiation (numerically — log(x - r) vs ln|x - r| differ only by a constant on each side).
  const back = (x) => { try { const h = 1e-5; return (math.evaluate(anti, { [v]: x + h }) - math.evaluate(anti, { [v]: x - h })) / (2 * h); } catch { return NaN; } };
  for (const x of [0.37, 1.91, 4.2]) {
    const expected = math.evaluate(`(${num})/(${den})`, { [v]: x });
    const got = back(x);
    if (Number.isFinite(expected) && Number.isFinite(got) && Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
  }
  const factorText = (r) => { const val = math.evaluate(r); const rt = Number.isInteger(val) ? String(val) : beautify(r); return val === 0 ? v : (val < 0 ? `(${v} + ${rt.replace(/^-/, '')})` : `(${v} - ${rt})`); };
  const fracText = rootList.map((r, i) => { const c = beautify(coefs[i]); return `${c === '1' ? '' : c === '-1' ? '-' : `${c}·`}1/${factorText(r)}`; }).join(' + ').replace(/\+ -/g, '− ');
  const denFactored = rootList.map(factorText).join('');
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — a proper rational function whose denominator factors into distinct linear factors: ${mark(`${beautify(den)} = ${denFactored}`)}.`,
    `Partial fractions: ${mark(`${beautify(term)} = ${fracText}`)}. Each coefficient is ${mark('N(r)/D′(r)')} at the root ${mark('r')} (the cover-up method).`,
    `Integrate each piece (${mark(`∫ 1/(${v} − r) d${v} = ln|${v} − r|`)}): ${mark(lnify(antiSimple))}.`,
  ];
  return { antiderivative: antiSimple, steps };
}

// ---------------------------------------------------------------------------
// The factorisation of a polynomial over the rationals, written the way
// Algebrite's factor() writes it — 3*(x - 1/2)*(x^2 + (-2)*x + (2))^2 — but
// built from the exact root finder (polynomialRoots.js) instead.
//
// Why it is exact and not a guess. Every real root the finder marks exact
// was confirmed by exact substitution, and a conjugate pair's quadratic
// x² − 2·Re(z)·x + |z|² is accepted only after rounding its coefficients to
// the one denominator a rational factor can have (Gauss's lemma: a monic
// factor of a polynomial with integer coefficients and leading coefficient L
// has coefficients in (1/L)ℤ) and then multiplying every factor back together
// in exact big-integer arithmetic to reproduce the polynomial coefficient by
// coefficient. Returns
//   a string   the proven factorisation (every factor linear or an
//              irreducible quadratic, with its power),
//   null       proven impossible — an irrational real root, or a pair whose
//              sum or product is not a rational of that denominator — so the
//              caller skips Algebrite too (it could not have done better; the
//              surd path handles these),
//   undefined  undecidable here (not a polynomial we can read, or non-real
//              roots the finder would not vouch for): the caller falls back to
//              Algebrite's factor() exactly as before.
function factorOverRationals(den, v) {
  const P = readPolynomial(den, v);
  if (!P || P.tooHigh || P.degree < 2) return undefined;
  const roots = allRoots(P);
  if (!roots.complex) return undefined;
  // Integer coefficients, lowest first; L the leading one; scale = what the
  // polynomial was multiplied by to get there.
  const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  const lcmD = P.coefficients.reduce((acc, c) => acc / bgcd(acc, c.d) * c.d, 1n);
  const ints = P.coefficients.map((c) => c.s * c.n * (lcmD / c.d));
  const L = ints[ints.length - 1];
  const absL = L < 0n ? -L : L;
  // A real number as k/L exactly, or null when it is not within rounding of one.
  const overL = (x) => {
    const scaled = x * Number(absL);
    const k = Math.round(scaled);
    if (!Number.isFinite(scaled) || Math.abs(scaled - k) > 1e-7 * (1 + Math.abs(scaled))) return null;
    return { n: BigInt(k), d: absL };
  };
  const factors = []; // { coeffs: [c0, c1, (c2)] as {n, d}, power }
  for (const r of [...roots.real].sort((a, b) => b.value - a.value)) {
    if (!r.exact) return null;
    factors.push({ coeffs: [{ n: -r.exact.m, d: r.exact.d }, { n: 1n, d: 1n }], power: r.multiplicity });
  }
  const pairs = roots.complex.filter((z) => z.im > 0).sort((a, b) => b.re - a.re || (a.re * a.re + a.im * a.im) - (b.re * b.re + b.im * b.im));
  for (const z of pairs) {
    // one of each conjugate pair
    const b = overL(-2 * z.re);
    const c = overL(z.re * z.re + z.im * z.im);
    if (!b || !c) return null;
    factors.push({ coeffs: [c, b, { n: 1n, d: 1n }], power: z.multiplicity });
  }
  if (!factors.length) return undefined;
  // Exact check: L · Π factor^power must equal the integer polynomial.
  const fmul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
  const fadd = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
  const pmul = (A, B) => {
    const out = Array.from({ length: A.length + B.length - 1 }, () => ({ n: 0n, d: 1n }));
    A.forEach((a, i) => B.forEach((b, j) => { out[i + j] = fadd(out[i + j], fmul(a, b)); }));
    return out;
  };
  let product = [{ n: L, d: 1n }];
  for (const f of factors) for (let k = 0; k < f.power; k += 1) product = pmul(product, f.coeffs);
  if (product.length !== ints.length) return undefined;
  if (!product.every((c, i) => c.n === ints[i] * c.d)) return undefined;
  // Text in the form the caller already parses.
  const ratText = (q) => { const g = bgcd(q.n, q.d) || 1n; const n = q.n / g; const d = q.d / g; return d === 1n ? String(n) : `${n}/${d}`; };
  const parts = [];
  if (L !== lcmD) parts.push(`(${ratText({ n: L, d: lcmD })})`);
  for (const f of factors) {
    const [c0, c1, c2] = f.coeffs;
    const text = c2 ? `(${v}^2 + (${ratText(c1)})*${v} + (${ratText(c0)}))` : `(${v} + (${ratText(c0)}))`;
    parts.push(f.power > 1 ? `${text}^${f.power}` : text);
  }
  return parts.join('*');
}

// General partial fractions: repeated linear factors and irreducible
// quadratics (with completing the square for the arctan pieces). The
// denominator is factored by Algebrite; the ansatz coefficients are found by
// solving the linear system N(x) = Σ Aᵢ·(D/dᵢ) at sample points, rationalised
// and re-verified; every antiderivative piece is a known form; the total is
// verified by differentiation before it is returned.
function integrateByGeneralPartialFractions(term, variable, Algebrite) {
  const v = variable;
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  if (!hasVariable(den, v)) return null;
  const degOf = (e) => { try { const d = String(Algebrite.run(`deg(${e}, ${v})`)).trim(); return /^\d+$/.test(d) ? Number(d) : null; } catch { return null; } };
  const degN = degOf(num);
  const degD = degOf(den);
  if (degN === null || degD === null || degD < 2 || degN >= degD) return null;

  // The factors as typed when they are already linear and irreducible
  // quadratic (no Algebrite factor() call); otherwise Algebrite factors.
  const typed = typedFactors(den, v);
  const typedOk = typed && typed.every((f) => f.deg < 2 || f.c[1] ** 2 - 4 * f.c[2] * f.c[0] < 0);
  let factored;
  if (typedOk) {
    factored = typed.map((f) => {
      const [c0, c1 = 0, c2 = 0] = f.c;
      const poly = f.deg === 0 ? String(c0) : f.deg === 1 ? `(${c1}*${v} + (${c0}))` : `(${c2}*${v}^2 + (${c1})*${v} + (${c0}))`;
      return f.power > 1 ? `${poly}^${f.power}` : poly;
    }).join('*');
  } else {
    // Our exact root finder factors over the rationals in milliseconds;
    // Algebrite's factor() grinds for 1–4 s on any denominator without a
    // small rational root (x⁴ + 1, x⁴ + 4, x⁶ + 1 — measured October 2026),
    // enough to spend a phone's 10 s budget before the surd path got its turn.
    factored = factorOverRationals(den, v);
    if (factored === null) return null; // proven: no factorisation into rational linear and quadratic factors
    if (factored === undefined) {
      try { factored = String(Algebrite.run(`factor(${den})`)).trim(); } catch { return null; }
    }
  }
  if (!factored || isAlgebriteFailure(factored)) return null;
  // A product splits on top-level '*'; a top-level sum (an irreducible
  // polynomial such as x^2+2*x+5) is a single factor.
  const rawFactors = hasTopLevelSum(factored) ? [factored] : splitTopLevel(factored, '*').filter((t) => t.trim());
  const factors = []; // { base, power, kind: 'lin'|'quad', r?, p?, q? }
  let constant = 1;
  for (const f0 of rawFactors) {
    let f = f0.trim();
    let power = 1;
    const pm = f.match(/^\((.+)\)\^(\d+)$/) || f.match(/^([a-z])\^(\d+)$/i);
    if (pm) { f = pm[1]; power = Number(pm[2]); }
    f = stripOuterParens(f);
    if (!hasVariable(f, v)) { const c = Number(math.evaluate(f)); if (!Number.isFinite(c) || c === 0) return null; constant *= c; continue; }
    const d = degOf(f);
    if (d === 1) {
      // a·x + b → root r = −b/a; normalise to (x − r) and fold a into the constant.
      const b = math.evaluate(f, { [v]: 0 });
      const a = math.evaluate(f, { [v]: 1 }) - b;
      if (!Number.isFinite(a) || a === 0) return null;
      constant *= a ** power;
      factors.push({ kind: 'lin', r: -b / a, power });
    } else if (d === 2) {
      const c0 = math.evaluate(f, { [v]: 0 });
      const c1 = math.evaluate(f, { [v]: 1 });
      const c2 = math.evaluate(f, { [v]: 2 });
      const a = (c2 - 2 * c1 + c0) / 2;
      const b = c1 - c0 - a;
      if (!Number.isFinite(a) || a === 0) return null;
      const pq = { p: b / a, q: c0 / a };
      if (pq.p * pq.p - 4 * pq.q >= -1e-12) return null; // reducible: not our case
      constant *= a ** power;
      factors.push({ kind: 'quad', ...pq, power });
    } else {
      return null;
    }
  }
  if (factors.length === 0) return null;
  const hasRepeatOrQuad = factors.some((f) => f.power > 1 || f.kind === 'quad');
  if (!hasRepeatOrQuad) return null; // the distinct-linear routine handles it

  // Ansatz terms.
  const terms = []; // { kind, r|p,q, j, unknowns: [names] }
  for (const f of factors) {
    for (let j = 1; j <= f.power; j += 1) {
      terms.push(f.kind === 'lin' ? { kind: 'lin', r: f.r, j } : { kind: 'quad', p: f.p, q: f.q, j });
    }
  }
  const nUnknowns = terms.reduce((n, t) => n + (t.kind === 'lin' ? 1 : 2), 0);
  // Denominator text in normalised form.
  const linTxt = (r) => (Math.abs(r) < 1e-12 ? v : r < 0 ? `(${v} + ${fmtNum(-r)})` : `(${v} - ${fmtNum(r)})`);
  const quadTxt = (p, q) => `(${v}^2${p === 0 ? '' : ` ${p < 0 ? '-' : '+'} ${Math.abs(p) === 1 ? '' : `${fmtNum(Math.abs(p))}*`}${v}`}${q === 0 ? '' : ` ${q < 0 ? '-' : '+'} ${fmtNum(Math.abs(q))}`})`;
  const denomOf = (t) => (t.kind === 'lin' ? `${linTxt(t.r)}${t.j > 1 ? `^${t.j}` : ''}` : `${quadTxt(t.p, t.q)}${t.j > 1 ? `^${t.j}` : ''}`);
  // The full normalised denominator D0 = Π factors (constant pulled out): N/den = (N/constant)/D0.
  const D0 = factors.map((f) => (f.kind === 'lin' ? `${linTxt(f.r)}${f.power > 1 ? `^${f.power}` : ''}` : `${quadTxt(f.p, f.q)}${f.power > 1 ? `^${f.power}` : ''}`)).join('*');
  // Basis functions: for each unknown, the polynomial (D0 / denom_t) × (1 or x).
  const basis = []; // strings in x
  for (const t of terms) {
    const cof = `(${D0})/(${denomOf(t)})`;
    if (t.kind === 'lin') basis.push(cof);
    else { basis.push(`(${cof})*${v}`); basis.push(cof); }
  }
  // Solve Σ cᵢ·basisᵢ(x) = N(x)/constant at nUnknowns integer points, in
  // exact rational arithmetic (Gaussian elimination on mathjs Fractions): the
  // basis polynomials span every polynomial of lower degree than D, so the
  // system is square and invertible, and the coefficients come out as the
  // fractions they are. (Floating least squares then "rationalising" lost
  // 1/(x⁶ − 1): six unknowns, errors past the tolerance, refused.)
  const rat = solveCoefficientsExactly(basis, num, constant, nUnknowns, v, factors);
  if (!rat) return null;
  const cTxt = rat.map((r) => (r.d === 1 ? String(r.n) : `${r.n}/${r.d}`));
  const decomposed = (() => { let i = 0; return terms.map((t) => { if (t.kind === 'lin') return `(${cTxt[i++]})/(${denomOf(t)})`; const b = cTxt[i++]; const c = cTxt[i++]; return `((${b})*${v} + (${c}))/(${denomOf(t)})`; }).join(' + '); })();
  for (const x of [0.11, 1.93, -2.47, 3.6]) {
    let l; let rr;
    try { l = math.evaluate(`(${num})/(${den})`, { [v]: x }); rr = math.evaluate(decomposed, { [v]: x }); } catch { return null; }
    if (Number.isFinite(l) && Number.isFinite(rr) && Math.abs(l - rr) > 1e-7 * (1 + Math.abs(l))) return null;
  }

  const linNum = (r0, denomText) => { const sgn = r0.n < 0 ? '−' : ''; const an = Math.abs(r0.n); const bare = stripOuterParens(denomText); return r0.d === 1 ? `${sgn}${an}/${/[+\-]/.test(bare) && !/\^/.test(denomText) ? `(${bare})` : denomText}` : `${sgn}${an}/(${r0.d}${denomText})`; };
  const quadNum = (b0, c0, denomText) => {
    // x/2, not 1/2x (which reads as 1/(2x)).
    const partB = b0.n === 0 ? '' : `${b0.n < 0 ? '−' : ''}${Math.abs(b0.n) === 1 ? '' : Math.abs(b0.n)}${v}${b0.d === 1 ? '' : `/${b0.d}`}`;
    const partC = c0.n === 0 ? '' : `${c0.n < 0 ? '−' : partB ? '+' : ''} ${c0.d === 1 ? Math.abs(c0.n) : `${Math.abs(c0.n)}/${c0.d}`}`;
    return `(${[partB, partC].filter(Boolean).join(' ').trim() || '0'})/${denomText}`;
  };
  // Integrate each piece.
  const pieces = [];
  const pieceSteps = [];
  let i = 0;
  for (const t of terms) {
    if (t.kind === 'lin') {
      const c = cTxt[i++];
      const R = rat[i - 1];
      const L = linTxt(t.r);
      const Lbare = stripOuterParens(L);
      const sgn = R.n < 0 ? '−' : '';
      const an = Math.abs(R.n);
      const cofLn = an === 1 && R.d === 1 ? '' : `${R.d === 1 ? an : `${an}/${R.d}`}·`;
      const fracOver = (extra) => `${sgn}${an}/(${R.d === 1 ? '' : `${R.d}`}${extra})`;
      const cMach = R.d === 1 ? (an === 1 ? (R.n < 0 ? '-' : '') : `${R.n}*`) : `${R.n}/${R.d}*`;
      // A zero coefficient is no term at all (1/(x − 1)² has none over x − 1).
      if (R.n === 0) continue;
      if (t.j === 1) { pieces.push(`${cMach}log(${L})`); pieceSteps.push(mark(`∫ ${fracOver(L)} d${v} = ${sgn}${cofLn}ln|${Lbare}|`)); }
      else {
        // ∫ c/(x − r)^j dx = −c/((j − 1)(x − r)^(j−1)), reduced.
        const power = t.j - 1 > 1 ? `${L}^${t.j - 1}` : L;
        const piece = overPoly(-(R.n / R.d) / (t.j - 1), '1', power);
        pieces.push(piece);
        pieceSteps.push(`${mark(`∫ ${fracOver(`${L}^${t.j}`)} d${v} = ${beautify(piece).replace(/^-/, '−')}`)} (power rule)`);
      }
    } else {
      const B = rat[i++]; const C = rat[i++];
      const Bv = B.n / B.d; const Cv = C.n / C.d;
      if (B.n === 0 && C.n === 0) continue; // (x² + 2)/((x² + 2)(x² + 3)) has no term over x² + 2
      const h = t.p / 2; const k2 = t.q - h * h; const k = Math.sqrt(k2);
      const U = h === 0 ? v : `(${v} ${h < 0 ? '-' : '+'} ${fmtNum(Math.abs(h))})`;
      const Q = quadTxt(t.p, t.q);
      // Bx + C = B·u + (C − B·h)
      const K = Cv - Bv * h;
      const Ktxt = fmtRat(K);
      const surd = !Number.isInteger(k) ? exactSurd(k2) : null;
      if (!Number.isInteger(k) && !surd) return null;
      // k = 1/2 is "1/2", not "sqrt(1/4)"; and (x + 1/2)/(1/2), never (x + 1/2)/1/2.
      const kTxt = Number.isInteger(k) ? String(k) : surd.rational ? fmtRat(k) : `sqrt(${fmtRat(k2)})`;
      const kDiv = /\//.test(kTxt) ? `(${kTxt})` : kTxt;
      const cm = (val) => (val === 1 ? '' : val === -1 ? '-' : `${fmtRat(val)}*`); // machine coefficient
      // k = √(k²) exactly: k² = a/b gives k = s·√t / b with t square-free
      // (x² − x + 1 = (x − 1/2)² + 3/4, k = √3/2). Its coefficient and the
      // arctan argument are then exact: (1/√3)·arctan((2x − 1)/√3), where
      // the decimals from a rounded k used to fail the check.
      // arctan(x - 1), not arctan((x - 1)): U carries its own brackets.
      const arcArg = k === 1 ? stripOuterParens(U) : surd && !surd.rational
        ? `(${surd.b / surd.s === 1 ? '' : `${fmtRat(surd.b / surd.s)}*`}${v}${h === 0 ? '' : ` ${h < 0 ? '-' : '+'} ${fmtRat(Math.abs(h * surd.b / surd.s))}`})/sqrt(${surd.t})`
        : surd && surd.rational
          // u/k with k = a/b: (b/a)·u, so (x + 1/2)/(1/2) is 2x + 1.
          ? (h === 0 ? `${fmtRat(1 / k)}*${v}` : `${fmtRat(1 / k)}*${v} ${h < 0 ? '-' : '+'} ${fmtRat(Math.abs(h / k))}`)
          : `${U}/${kDiv}`;
      const kShown = (() => {
        if (Number.isInteger(k)) return String(k);
        if (surd.rational) return fmtRat(k);
        const g = gcd(surd.s, surd.b) || 1; // 2√3/4 is √3/2
        return `${surd.s / g === 1 ? '' : surd.s / g}√${surd.t}${surd.b / g === 1 ? '' : `/${surd.b / g}`}`;
      })();
      const arcCoefMach = (Kv) => (surd && !surd.rational
        ? `${cm(Kv * surd.b / (surd.s * surd.t))}sqrt(${surd.t})*`
        : cm(Kv / k));
      if (t.j === 1) {
        if (Bv !== 0) { pieces.push(`${cm(Bv / 2)}log(${Q})`); }
        if (Math.abs(K) > 1e-12) { pieces.push(`${arcCoefMach(K)}arctan(${arcArg})`); }
        const numTxt = quadNum(B, C, Q).replace(/\/\(.*$/, '');
        const arcCoef = surd && !surd.rational
          ? `${beautify(arcCoefMach(K).replace(/\*$/, ''))}·`.replace(/^1\*/, '').replace(/sqrt\((\d+)\)/, '√$1')
          : Math.abs(K / k - 1) < 1e-12 ? '' : Math.abs(K / k + 1) < 1e-12 ? '−' : `${fmtRat(K / k)}·`;
        const arcShown = surd ? beautify(arcArg).replace(/sqrt\((\d+)\)/, '√$1') : k === 1 ? stripOuterParens(U) : `${U}/${kDiv}`;
        pieceSteps.push(`${mark(`∫ ${numTxt}/${Q} d${v}`)}: ${h !== 0 ? `complete the square, ${mark(`${Q} = ${U}^2 + ${fmtRat(k2)}`)}; ` : ''}${Bv !== 0 ? `the ${mark(v)}-part gives ${mark(`${fmtRat(Bv / 2)}·ln${/^\s*-/.test(stripOuterParens(Q)) ? `|${stripOuterParens(Q)}|` : `(${stripOuterParens(Q)})`}`)}` : ''}${Bv !== 0 && Math.abs(K) > 1e-12 ? ', and ' : ''}${Math.abs(K) > 1e-12 ? `the constant part gives ${mark(`${arcCoef}arctan(${arcShown})`)}` : ''}`);
      } else {
        // (Bu + K)/(u² + k²)^j, j ≥ 2, with u = x + h:
        //   ∫ u/(u² + k²)^j du = −1/(2(j − 1)(u² + k²)^(j−1))
        //   I_j = ∫ du/(u² + k²)^j = u/(2k²(j − 1)(u² + k²)^(j−1)) + (2j − 3)/(2k²(j − 1))·I_(j−1),   I_1 = (1/k)·arctan(u/k)
        // I_j is expanded to a flat sum Σ cₘ·u/(u² + k²)^m + c₀·(1/k)·arctan(u/k)
        // in exact fractions; the 1/k is exact for a rational k and for
        // k = s√t/b alike (arcCoefMach).
        const E = exactMath();
        const K2 = E.fraction(k2);
        const expand = (n) => {
          if (n === 1) return { terms: new Map(), arc: E.fraction(1) };
          const a = E.fraction(1).div(K2.mul(2 * (n - 1)));
          const b = E.fraction(2 * n - 3).div(K2.mul(2 * (n - 1)));
          const inner = expand(n - 1);
          const terms = new Map([[n - 1, a]]);
          for (const [m, c] of inner.terms) terms.set(m, (terms.get(m) || E.fraction(0)).add(b.mul(c)));
          return { terms, arc: b.mul(inner.arc) };
        };
        const asNumber = (q) => { if (Number(q.d) > 720) throw new Error('coefficient too fine to show'); return Number(q.s) * Number(q.n) / Number(q.d); };
        const uTxt = stripOuterParens(U) === v ? v : U;
        const powQ = (n) => (n === 1 ? Q : `${Q}^${n}`);
        const n = t.j;
        let expanded;
        try {
          const I = expand(n);
          expanded = { terms: [...I.terms].map(([m, c]) => [m, asNumber(c) * K]).sort((a, b) => b[0] - a[0]), arc: asNumber(I.arc) * K };
        } catch { return null; }
        if (Bv !== 0) pieces.push(overPoly(-Bv / (2 * (n - 1)), '1', powQ(n - 1)));
        if (Math.abs(K) > 1e-12) {
          for (const [m, c] of expanded.terms) pieces.push(overPoly(c, uTxt, powQ(m)));
          pieces.push(`${arcCoefMach(expanded.arc)}arctan(${arcArg})`);
        }
        const numTxt = quadNum(B, C, Q).replace(/\/\(.*$/, '');
        const paren = (txt) => (/\//.test(txt) ? `(${txt})` : txt);
        const uPower = (m) => (m === 1 ? '(u² + k²)' : `(u² + k²)^${m}`);
        pieceSteps.push(`${mark(`∫ ${numTxt}/${Q}^${n} d${v}`)}: with ${mark(`u = ${U}`)} and ${mark(`k = ${kShown}`)}, ${Bv !== 0 ? `${mark(`∫ ${Bv === 1 ? '' : Bv === -1 ? '−' : paren(fmtRat(Bv))}u/${uPower(n)} du = ${Bv < 0 ? '' : '−'}${paren(fmtRat(Math.abs(Bv) / (2 * (n - 1))))}/${uPower(n - 1)}`)} (${mark('w = u² + k²')})` : ''}${Bv !== 0 && Math.abs(K) > 1e-12 ? ' and ' : ''}${Math.abs(K) > 1e-12 ? `${mark(`∫ ${paren(Ktxt)}/${uPower(n)} du`)} by the reduction formula ${mark(`∫ du/(u² + k²)^n = u/(2k²(n − 1)(u² + k²)^(n−1)) + (2n − 3)/(2k²(n − 1))·∫ du/(u² + k²)^(n−1)`)}${n > 2 ? ` applied ${n - 1} times` : ''}, down to ${mark('∫ du/(u² + k²) = (1/k)·arctan(u/k)')}` : ''}`);
      }
    }
  }
  const anti = pieces.join(' + ').replace(/\+ -/g, '- ').replace(/\+ \(-/g, '- (');
  // Verify by numeric differentiation.
  const dnum = (x) => { try { const hh = 1e-5; return (math.evaluate(anti, { [v]: x + hh }) - math.evaluate(anti, { [v]: x - hh })) / (2 * hh); } catch { return NaN; } };
  let checked = 0;
  // Sample to the right of every real root, where log(x − r) is real.
  const maxRoot = Math.max(0, ...factors.filter((f) => f.kind === 'lin').map((f) => f.r));
  for (const x of [0.37, 1.13, 2.29, 3.71, 5.17].map((d) => maxRoot + d)) {
    let expected; try { expected = math.evaluate(`(${num})/(${den})`, { [v]: x }); } catch { continue; }
    const got = dnum(x);
    if (!Number.isFinite(expected) || !Number.isFinite(got)) continue;
    if (Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
    checked += 1;
  }
  if (checked < 3) return null;
  // Present the sum of pieces as they are (Algebrite's simplify would pull
  // out a common factor and make it harder to read).
  const antiSimple = anti;
  const ansatzTxt = (() => {
    let k = 0;
    return terms.map((t) => {
      if (t.kind === 'lin') { const r0 = rat[k++]; return r0.n === 0 ? null : linNum(r0, denomOf(t)); }
      const b0 = rat[k++]; const c0 = rat[k++];
      return b0.n === 0 && c0.n === 0 ? null : quadNum(b0, c0, denomOf(t));
    }).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
  })();
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — a proper rational function. Factor the denominator: ${mark(`${beautify(den)} = ${constant !== 1 ? `${fmtNum(constant)}·` : ''}${D0.replace(/\*/g, '')}`)}.`,
    ...sumOfSquaresQuartic(den, v),
    `Partial fractions (a repeated factor gets one term per power; an irreducible quadratic gets a linear numerator): ${mark(`${beautify(term)} = ${ansatzTxt}`)}. The coefficients come from clearing denominators and matching both sides.`,
    ...pieceSteps.map((t) => `  ${t}`),
    // An irreducible quadratic is never zero, so its log needs no bars: the
    // sum agrees with the answer (it read ln|x^2 + 1| above ln(x^2 + 1)).
    `Add the pieces: ${mark(dropBarsOnPositiveArguments(lnify(antiSimple), antiSimple, v))}.`,
  ];
  return { antiderivative: antiSimple, steps };
}

// x⁴ + 4 has no real roots, yet factors over the rationals: add and take
// away the middle term of a square, and it is a difference of squares,
// (x² + k)² − (mx)² with k² = c and m² = 2k (Sophie Germain's identity).
// The factorization alone was shown with no way to find it.
function sumOfSquaresQuartic(den, v) {
  const m0 = String(den).replace(/\s+/g, '').match(new RegExp(`^(?:${v}\\^4\\+(\\d+)|(\\d+)\\+${v}\\^4)$`));
  if (!m0) return [];
  const c = Number(m0[1] ?? m0[2]);
  const k = Math.sqrt(c);
  const m = Math.sqrt(2 * k);
  if (!Number.isInteger(k) || !Number.isInteger(m)) return [];
  const mx = m === 1 ? v : `${m}${v}`;
  return [`  To find it: ${mark(`${v}⁴ + ${c}`)} has no real roots, but adding and taking away ${mark(`${2 * k}${v}²`)} makes it a difference of squares: ${mark(`${v}⁴ + ${c} = (${v}⁴ + ${2 * k}${v}² + ${c}) − ${2 * k}${v}² = (${v}² + ${k})² − (${mx})² = (${v}² − ${mx} + ${k})(${v}² + ${mx} + ${k})`)}.`];
}

const fmtNum = (x) => (Number.isInteger(x) ? String(x) : (() => { for (let d = 2; d <= 720; d += 1) { const n = x * d; if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`; } return String(Math.round(x * 1e6) / 1e6); })());
const fmtRat = fmtNum;

// Exact rational arithmetic for the partial-fraction coefficients.
let exactMathInstance = null;
const exactMath = () => { if (!exactMathInstance) exactMathInstance = createMath({ number: 'Fraction' }); return exactMathInstance; };

// √(k²) for a rational k² = a/b as s·√t / b, t square-free; rational when t = 1.
function exactSurd(k2) {
  let a = null;
  let b = null;
  for (let d = 1; d <= 720; d += 1) { const n = k2 * d; if (Math.abs(n - Math.round(n)) < 1e-9) { a = Math.round(n); b = d; break; } }
  if (a === null || a <= 0) return null;
  let rad = a * b; // √(a/b) = √(ab)/b
  let s0 = 1;
  for (let f = 2; f * f <= rad; f += 1) while (rad % (f * f) === 0) { rad /= f * f; s0 *= f; }
  return { s: s0, t: rad, b, rational: rad === 1 };
}

// c·N/D as one fraction in lowest terms, readable and machine-evaluable:
// (−2, 1, (x − 1)^2)/2 → "-1/(x - 1)^2"; (1/2, x, (x^2 + 1)) → "x/(2*(x^2 + 1))".
function overPoly(c, numerText, denText) {
  const [n0, d0] = (() => { for (let d = 1; d <= 720; d += 1) { const n = c * d; if (Math.abs(n - Math.round(n)) < 1e-9) return [Math.round(n), d]; } return [c, 1]; })();
  const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
  const k = Number.isInteger(n0) ? g(n0, d0) || 1 : 1;
  const n = n0 / k;
  const d = d0 / k;
  const bare = stripOuterParens(denText);
  const den = /[+\-*/]/.test(bare) && !/^\(.*\)\^\d+$/.test(denText) ? `(${bare})` : denText.replace(/^\(([a-z])\)$/i, '$1');
  const top = numerText === '1' ? String(Math.abs(n)) : Math.abs(n) === 1 ? numerText : `${Math.abs(n)}*${numerText}`;
  return `${n < 0 ? '-' : ''}${top}/${d === 1 ? den : `(${d}*${den})`}`;
}

// Does the text have a '+' or binary '-' outside all parentheses?
function hasTopLevelSum(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && (ch === '+' || (ch === '-' && i > 0 && !/[*^(/]/.test(text[i - 1])))) return true;
  }
  return false;
}

// "num/den" split at the single top-level slash, or null.
function splitTopLevelSlash(term) {
  let depth = 0;
  let idx = -1;
  for (let i = 0; i < term.length; i += 1) {
    const ch = term[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === '/' && depth === 0) { if (idx !== -1) return null; idx = i; }
  }
  if (idx === -1) return null;
  const num = stripOuterParens(term.slice(0, idx));
  const den = stripOuterParens(term.slice(idx + 1));
  return [num || '1', den];
}

// Assemble the worked steps from the per-term results. Multi-term integrals get
// a header per term; a single term shows its steps directly. The closing line
// states the combined antiderivative with +C.
function buildPerTermSteps(expression, terms, perTerm, variable, total, combinedFrom = null) {
  const steps = [`Identify the function to integrate: ${mark(`∫(${beautify(expression)}) d${variable}`)}.`];
  const multi = terms.length > 1;
  if (multi) steps.push('Apply the sum rule: integrate each term separately, then add the results.');

  perTerm.forEach((res, i) => {
    if (multi) {
      const suffix = res.method === 'byparts' ? ' by parts' : res.method === 'substitution' ? ' by substitution' : res.method === 'trig substitution' ? ' by trigonometric substitution' : '';
      steps.push(`Term ${i + 1} — ${mark(`∫(${beautify(res.term)}) d${variable}`)}${suffix}:`);
    }
    steps.push(...res.steps);
  });

  if (combinedFrom) steps.push(`Combine like terms: ${mark(`${beautify(combinedFrom)} = ${beautify(total)}`)}.`);
  // The same bars as the answer: none on an argument that is always positive.
  steps.push(`Add the constant of integration: ${mark(`∫(${beautify(expression)}) d${variable} = ${String(total).trim() === '0' ? 'C' : `${dropBarsOnPositiveArguments(lnify(total), total, variable)} + C`}`)}.`);
  return steps;
}

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
function parseDefiniteIntegral(raw) {
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

const isInfiniteBound = (t) => /^-?\s*(?:∞|inf(?:inity)?|oo|Infinity)\s*$/i.test(String(t).trim());
const boundSign = (t) => (/^-/.test(String(t).trim()) ? -1 : 1);

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

// Name a limit value when it is a familiar constant.
const NAMED_CONSTANTS = [[Math.PI, 'π', 'pi'], [Math.PI / 2, 'π/2', 'pi/2'], [Math.PI / 4, 'π/4', 'pi/4'], [Math.PI / (2 * Math.SQRT2), 'π/(2√2)', 'pi/(2*sqrt(2))'], [Math.PI / Math.SQRT2, 'π/√2', 'pi/sqrt(2)'], [Math.PI / 3, 'π/3', 'pi/3'], [Math.PI / 6, 'π/6', 'pi/6'], [Math.E, 'e', 'exp(1)'], [1 / Math.E, '1/e', 'exp(-1)'], [Math.sqrt(Math.PI), '√π', 'sqrt(pi)'], [Math.sqrt(Math.PI) / 2, '√π/2', 'sqrt(pi)/2'], [Math.LN2, 'ln(2)', 'log(2)']];
function nameConstant(v) {
  if (Math.abs(v) < 1e-9) return '0';
  for (const [c, t] of NAMED_CONSTANTS) {
    if (Math.abs(v - c) < 1e-6) return t;
    if (Math.abs(v + c) < 1e-6) return `-${t}`;
  }
  return null;
}
// The same, spelled for Algebrite; also small rationals.
function constantRaw(v) {
  if (Math.abs(v) < 1e-9) return '0';
  for (const [c, , raw] of NAMED_CONSTANTS) {
    if (Math.abs(v - c) < 1e-6) return raw;
    if (Math.abs(v + c) < 1e-6) return `-(${raw})`;
  }
  const r = exactValueToRaw(v);
  return /^-?\d+(?:\/\d+)?$/.test(r) ? r : null;
}
// Algebrite's exact F(bound), unformatted, or null.
function rawSubst(Algebrite, F, variable, at) {
  try {
    const out = String(Algebrite.run(`simplify(real(subst(${at}, ${variable}, ${F})))`)).trim();
    return isAlgebriteFailure(out) || /nil|Stop/.test(out) ? null : out;
  } catch { return null; }
}

// ∫_a^∞, ∫_-∞^b, ∫_-∞^∞ — as lim_{t→∞} ∫_a^t f, via the antiderivative.
// "= 1/3 (≈ 0.3333)" or "≈ 0.8883": a value that is only a decimal is not
// introduced by "=".
function eqOrApprox(valueText) {
  return valueText.startsWith('≈') ? valueText : `= ${valueText}`;
}

function finiteBoundValue(raw) {
  return Number(math.evaluate(String(raw).replace(/π/g, 'pi')));
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

async function solveImproperInfinite(parsed, notation) {
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
    ],
    common_mistakes: [`Plugging ${mark('∞')} into ${mark('F')} as if it were a number.`, `Forgetting that a limit can fail to exist even when the integrand tends to ${mark('0')}.`],
    graph: generateDefiniteGraph(integrand, v, lowerInf ? Math.min(-10, hi - 10) : finiteBoundVal(lowerRaw), upperInf ? Math.max(10, lo + 10) : finiteBoundVal(upperRaw), lowerLabel, upperLabel, value),
  };
}

// The indefinite path's per-term antiderivative (direct / substitution /
// by-parts / abs), verified by differentiation. Returns F or null.
async function antiderivativeViaTerms(expression, variable, Algebrite) {
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

// A numeric FTC value as display text: a small exact fraction when it is one
// (1, 1/2, 3/4), otherwise the decimal.
function exactValueToRaw(value) {
  if (Number.isInteger(value)) return String(value);
  for (let den = 2; den <= 64; den += 1) {
    const num = value * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) return `${Math.round(num)}/${den}`;
  }
  return formatNumber(value);
}

async function solveDefiniteIntegral(parsed) {
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
        `No “${mark('+C')}” for a definite integral — the constant cancels in the subtraction.`,
        `A definite integral is the signed area between the curve and the x-axis over ${mark('[a, b]')}.`,
      ],
      common_mistakes: [
        `Keeping the ${mark('+C')} — it cancels when you subtract ${mark('F(a)')} from ${mark('F(b)')}.`,
        `Swapping the bounds: ${mark('∫_a^b = −∫_b^a')}.`,
        `Integrating across a discontinuity (e.g. ${mark('1/x')} on ${mark('[−1, 1]')}) as if the integral were proper.`,
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
      `A numerical integral samples the curve and adds up slices (Simpson's rule fits parabolas through triples of points); it gives the value to as many digits as two step sizes agree on, but no antiderivative.`,
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

// Evaluate an antiderivative at a bound, returning a clean exact string or null.
// Numeric F(at) via mathjs (which, unlike Algebrite, evaluates abs and sgn).
function evalAntiderivNumeric(F, variable, at) {
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

function evalAntiderivAt(Algebrite, F, variable, at) {
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
function numericIntegral(integrand, variable, a, b, N = 2000) {
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

// Least-squares solution of A·c = y via the normal equations (AᵀA)c = Aᵀy,
// by Gaussian elimination with partial pivoting. A is m×n (m ≥ n), small.
// The partial-fraction coefficients as exact fractions {n, d}, or null.
function solveCoefficientsExactly(basis, num, constant, nUnknowns, v, factors) {
  const E = exactMath();
  const F = (x) => E.fraction(x);
  const realRoots = factors.filter((f) => f.kind === 'lin').map((f) => f.r);
  const xs = [];
  for (let k = 0; xs.length < nUnknowns && k < nUnknowns + 50; k += 1) if (!realRoots.some((r) => Math.abs(r - k) < 1e-9)) xs.push(k);
  if (xs.length < nUnknowns) return null;
  let rows;
  try {
    const basisCode = basis.map((b) => E.parse(b).compile());
    const numCode = E.parse(num).compile();
    const cst = F(constant);
    rows = xs.map((x) => {
      const scope = { [v]: F(x) };
      const row = basisCode.map((c) => c.evaluate(scope));
      const y = E.divide(numCode.evaluate(scope), cst);
      if (![...row, y].every((q) => E.typeOf(q) === 'Fraction')) throw new Error('not rational');
      return [...row, y];
    });
  } catch {
    return null;
  }
  // Gaussian elimination with partial (non-zero) pivoting, all in Fractions.
  const n = nUnknowns;
  for (let col = 0; col < n; col += 1) {
    let pivot = -1;
    for (let r = col; r < n; r += 1) if (!rows[r][col].equals(0)) { pivot = r; break; }
    if (pivot < 0) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col || rows[r][col].equals(0)) continue;
      const m = rows[r][col].div(rows[col][col]);
      for (let c = col; c <= n; c += 1) rows[r][c] = rows[r][c].sub(m.mul(rows[col][c]));
    }
  }
  const out = [];
  for (let r = 0; r < n; r += 1) {
    const q = rows[r][n].div(rows[r][r]);
    const nn = Number(q.s) * Number(q.n);
    const dd = Number(q.d);
    if (!Number.isSafeInteger(nn) || !Number.isSafeInteger(dd)) return null;
    out.push({ n: nn, d: dd });
  }
  return out;
}

// Algebrite exact strings use log/pi/exp; present them the textbook way.
function formatExactValue(raw) {
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
function refuseDefinite(reason, notation, kind = 'unsupported') {
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
function refuseImproperAt(notation, variable, at, integrand) {
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

function refuseImproper(notation, variable) {
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

// The integrand is unbounded at one (or both) endpoints of [a, b]: the
// integral is improper there and is DEFINED as a one-sided limit,
// ∫_a^b = lim (t→a⁺) ∫_t^b. F(b) − F(a) with F evaluated at the singular
// endpoint is not valid reasoning — ∫₀¹ 1/√x used to show "F(0) = 0" and
// ∫₀¹ ln x "F(0) = 0" as if the Fundamental Theorem applied there. Now the
// limit of F toward the endpoint is taken explicitly: finite → converges
// (value shown as the limit), unbounded → diverges. Returns null when no
// endpoint is singular, so the ordinary path runs. (September 2026 review.)
async function integrateAtSingularEndpoint({ integrand, v, a, b, lowerRaw, upperRaw, lowerLabel, upperLabel, notation, Algebrite }) {
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
async function integrateAcrossSingularity(integrand, v, a, b, notation, lowerLabel, upperLabel, Algebrite) {
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

// Graph f(x) with the integration interval [a, b] shaded — the definite
// integral IS that signed area. Samples a padded window so the region sits in
// context and the viewer can pan out.
function generateDefiniteGraph(integrand, variable, a, b, lowerLabel, upperLabel, value) {
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

/**
 * Worked steps: integrate each top-level term individually with Algebrite and
 * show the intermediate antiderivative, then combine and add +C. Integration is
 * linear, so this term-by-term breakdown is exact.
 */
function generateIntegralSteps(expression, integral, variable, Algebrite) {
  const steps = [];
  steps.push(`Identify the function to integrate: ${mark(`∫(${beautify(expression)}) d${variable}`)}`);

  const terms = splitTerms(expression);

  if (terms.length > 1) {
    steps.push('Apply the sum rule: integrate each term separately, then add the results.');
  }

  for (const { signed } of terms) {
    const { label, hint } = classifyIntegralRule(signed, variable);
    let termIntegral = null;
    try {
      termIntegral = Algebrite.integral(rewriteReciprocalTrig(signed), variable).toString();
    } catch {
      termIntegral = null;
    }

    if (hint) {
      steps.push(`${label} — ${hint}.`);
    }

    if (termIntegral !== null) {
      steps.push(mark(`∫(${beautify(signed)}) d${variable} = ${lnify(termIntegral)}`));
    } else {
      steps.push(`Integrate ${mark(beautify(signed))} using the ${label.toLowerCase()}.`);
    }
  }

  if (terms.length > 1) {
    steps.push(`Add the term integrals: ${mark(dropBarsOnPositiveArguments(lnify(integral), integral, variable))}`);
  }

  steps.push(`Add the constant of integration: ${mark(`∫(${beautify(expression)}) d${variable} = ${dropBarsOnPositiveArguments(lnify(integral), integral, variable)} + C`)}`);

  return steps;
}

/**
 * Classify which integration technique a single term needs. Because it operates
 * on one term at a time, the heuristics are reliable and the label sits next to
 * the real computed antiderivative.
 */
// ∫c·sin²(kx) dx and ∫c·cos²(kx) dx: Algebrite hands back the antiderivative
// in one jump ("Trig rule"). The course method is the power-reduction
// (half-angle) identity followed by term-by-term integration — show it.
function halfAngleSteps(term, variable, anti) {
  const v = variable;
  const m = String(term).replace(/\s+/g, '').match(new RegExp(`^([+-]?)(\\d+(?:\\.\\d+)?)?\\*?\\(?(sin|cos)\\((?:(\\d+(?:\\.\\d+)?)\\*?)?${v}\\)\\)?\\^2$`, 'i'));
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const c = sign * (m[2] ? Number(m[2]) : 1);
  const fn = m[3].toLowerCase();
  const k = m[4] ? Number(m[4]) : 1;
  const arg = k === 1 ? v : `${formatNumber(k)}${v}`;
  const doubled = `${formatNumber(2 * k)}${v}`;
  const cText = c === 1 ? '' : c === -1 ? '-' : `${formatNumber(c)}·`;
  const op = fn === 'sin' ? '−' : '+';
  const halfC = c === 1 ? '1/2' : c === -1 ? '-1/2' : `${formatNumber(c)}/2`;
  return [
    `An even power of ${mark(fn)} has no direct rule. Use the power-reduction (half-angle) identity ${mark(`${fn}²(u) = (1 ${op} cos(2u))/2`)} with ${mark(`u = ${arg}`)}: ${mark(`∫${cText}${fn}²(${arg}) d${v} = ∫${cText}(1 ${op} cos(${doubled}))/2 d${v}`)}.`,
    `Split it into two integrals: ${mark(`${halfC}·∫1 d${v} ${fn === 'sin' ? '−' : '+'} ${halfC.replace(/^-/, '')}·∫cos(${doubled}) d${v}`)}.`,
    `Integrate term by term: ${mark(`∫1 d${v} = ${v}`)}, and ${mark(`∫cos(${doubled}) d${v} = sin(${doubled})/${formatNumber(2 * k)}`)} (the chain rule in reverse: the inner derivative ${mark(formatNumber(2 * k))} is divided out).`,
    `So ${mark(`∫${cText}${fn}²(${arg}) d${v} = ${lnify(anti)}`)}.`,
  ];
}

// ∫c·tan(kx), cot, sec, csc: the table entry, derived. tan = sin/cos with
// u = cos (cot: u = sin); sec and csc by the (sec + tan)/(sec + tan) trick.
function trigQuotientSteps(term, variable, anti) {
  const v = variable;
  const m = String(term).replace(/\s+/g, '').match(new RegExp(`^([+-]?)(\\d+(?:\\.\\d+)?)?\\*?(tan|cot|sec|csc)\\((?:(\\d+(?:\\.\\d+)?)\\*?)?${v}\\)$`, 'i'));
  if (!m) return null;
  const c = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
  const fn = m[3].toLowerCase();
  const k = m[4] ? Number(m[4]) : 1;
  const θ = k === 1 ? v : `${formatNumber(k)}${v}`;
  const θRaw = k === 1 ? v : `${k}*${v}`;
  const cText = c === 1 ? '' : c === -1 ? '−' : `${formatNumber(c)}·`;
  const overK = k === 1 ? '' : `(1/${formatNumber(k)})·`;
  if (fn === 'tan' || fn === 'cot') {
    const [num, den] = fn === 'tan' ? ['sin', 'cos'] : ['cos', 'sin'];
    const sign = fn === 'tan' ? '−' : '';
    const result = `∫${cText}${fn}(${θ}) d${v} = ${lnify(anti)}`;
    return {
      antiderivative: anti,
      steps: [
        `Write ${mark(fn)} as a quotient: ${mark(`${fn}(${θ}) = ${num}(${θ})/${den}(${θ})`)}, so ${mark(`∫${cText}${fn}(${θ}) d${v} = ∫${cText}${num}(${θ})/${den}(${θ}) d${v}`)}.`,
        `The numerator is the derivative of the denominator (up to a constant): let ${mark(`u = ${den}(${θ})`)}, ${mark(`du = ${fn === 'tan' ? '−' : ''}${k === 1 ? '' : `${formatNumber(k)}·`}${num}(${θ}) d${v}`)}, and the integral is ${mark(`${sign}${overK}${cText}∫du/u = ${sign}${overK}${cText}ln|u|`)}.`,
        `Back-substitute ${mark(`u = ${den}(${θ})`)}: ${mark(result)}${fn === 'tan' ? ` (equivalently ${mark(`${overK}${cText}ln|sec(${θ})|`)})` : ''}.`,
      ],
    };
  }
  // Algebrite writes ∫sec as ln|tan(x/2 + π/4)|; the derivation gives the
  // textbook ln|sec + tan|, equal to it, and that form is kept (verified).
  const [co, sign] = fn === 'sec' ? ['tan', '+'] : ['cot', '−'];
  const coefRaw = c / k === 1 ? '' : Number.isInteger(c) && Number.isInteger(k) ? `(${c}/${k})*` : `${c / k}*`;
  const textbook = `${coefRaw}log(${fn}(${θRaw})${sign === '+' ? '+' : '-'}${co}(${θRaw}))`;
  const antiderivative = derivativeMatchesNumerically(textbook, term, v) ? textbook : anti;
  const result = `∫${cText}${fn}(${θ}) d${v} = ${lnify(antiderivative)}`;
  return {
    antiderivative,
    steps: [
      `Multiply by ${mark(`(${fn}(${θ}) ${sign} ${co}(${θ}))/(${fn}(${θ}) ${sign} ${co}(${θ}))`)}: ${mark(`∫${cText}${fn}(${θ}) d${v} = ∫${cText}(${fn}²(${θ}) ${sign} ${fn}(${θ})${co}(${θ}))/(${fn}(${θ}) ${sign} ${co}(${θ})) d${v}`)}.`,
      `The numerator is now the derivative of the denominator: let ${mark(`u = ${fn}(${θ}) ${sign} ${co}(${θ})`)}, ${mark(`du = ${k === 1 ? '' : `${formatNumber(k)}·`}(${fn === 'sec' ? `sec(${θ})tan(${θ}) + sec²(${θ})` : `csc²(${θ}) − csc(${θ})cot(${θ})`}) d${v}`)}, and the integral is ${mark(`${overK}${cText}∫du/u = ${overK}${cText}ln|u|`)}.`,
      `Back-substitute: ${mark(result)}.`,
    ],
  };
}

function classifyIntegralRule(term, variable) {
  const v = variable;

  if (!hasVariable(term, v)) {
    return { label: 'Constant rule', hint: mark(`∫c d${v} = c·${v}`) };
  }

  const inner = term.replace(/^[-+]/, '');

  // Reciprocal: 1/x or x^-1.
  if (new RegExp(`(?:^|[^a-z])1\\s*/\\s*${v}\\b`, 'i').test(inner) || new RegExp(`${v}\\s*\\^\\s*-\\s*1\\b`, 'i').test(inner)) {
    return { label: 'Reciprocal rule', hint: mark(`∫1/${v} d${v} = ln|${v}|`) };
  }

  // √(x² ± a²), √(a² − x²) in the integrand: a trigonometric substitution
  // (Algebrite answers 1/(x²√(x² + 9)) in one line; the step used to call
  // it "u-substitution", with no u in sight — October 2026 review).
  const radical = inner.replace(/\s+/g, '').match(new RegExp(`(?:sqrt\\(|\\()(?:(?:\\d+\\*?)?${v}\\^2([+-])(\\d+)|(\\d+)([+-])(?:\\d+\\*?)?${v}\\^2)\\)(?:\\^\\(1/2\\))?`));
  if (radical) {
    const [, sign1, a2a, a2b, sign2] = radical;
    const a2 = Number(a2a ?? a2b);
    const a = Number.isInteger(Math.sqrt(a2)) ? String(Math.sqrt(a2)) : `√${a2}`;
    const kind = sign1 === '+' || sign2 === '+' ? 'tan' : sign1 === '-' ? 'sec' : 'sin';
    const form = kind === 'tan' ? `√(${v}² + a²)` : kind === 'sec' ? `√(${v}² − a²)` : `√(a² − ${v}²)`;
    const subst = kind === 'tan' ? `${v} = ${a}·tan θ` : kind === 'sec' ? `${v} = ${a}·sec θ` : `${v} = ${a}·sin θ`;
    const root = kind === 'tan' ? `${a}·sec θ` : kind === 'sec' ? `${a}·tan θ` : `${a}·cos θ`;
    return {
      label: 'Trigonometric substitution',
      hint: `the radical ${mark(form)} with ${mark(`a = ${a}`)} calls for ${mark(subst)}, which turns it into ${mark(root)}; integrate in ${mark('θ')} and convert back with a right triangle`,
    };
  }

  // Products of two families (x·eˣ, x·sin x, eˣ·sin x) need integration by
  // parts. Two trig factors (sin²x·cos²x) are one family: an identity.
  const factors = splitTopLevel(inner, '*');
  const varFactors = factors.filter((f) => hasVariable(f, v));
  const family = (f) => (/\b(?:sin|cos|tan|sec|csc|cot)\b/i.test(f) ? 'trig' : /\bexp\b|e\^/i.test(f) ? 'exp' : /\b(?:ln|log)\b/i.test(f) ? 'log' : 'algebraic');
  const families = new Set(varFactors.map(family));
  if (varFactors.length >= 2 && families.size >= 2) {
    return {
      label: 'Integration by parts',
      hint: `${mark('∫u dv = uv − ∫v du')} (choose ${mark('u')} by LIATE: Log, Inverse-trig, Algebraic, Trig, Exponential)`,
    };
  }
  const evenPower = inner.replace(/\s+/g, '').match(new RegExp(`^(?:[\\d./*]+\\*?)?(sin|cos)\\((?:\\d+(?:\\.\\d+)?\\*?)?${v}\\)\\^(\\d+)$`, 'i'));
  if ((varFactors.length >= 2 && families.size === 1 && families.has('trig')) || (evenPower && Number(evenPower[2]) % 2 === 0)) {
    return {
      label: 'Trigonometric identity',
      hint: `even powers of ${mark('sin')} and ${mark('cos')} are lowered with ${mark('sin²θ = (1 − cos 2θ)/2')}, ${mark('cos²θ = (1 + cos 2θ)/2')} and ${mark('sin θ cos θ = (sin 2θ)/2')}, repeated until only first powers of cosines remain, then integrated term by term`,
    };
  }

  // Composite function → u-substitution.
  if (isComposite(inner, v)) {
    return { label: 'u-substitution', hint: `let ${mark('u')} = the inner function, then ${mark(`du = u′ d${v}`)}` };
  }

  const t = inner.replace(/\s+/g, '');
  if (new RegExp(`^(?:[\\d./*]+\\*?)?sec\\(${v}\\)\\^2$`, 'i').test(t)) return { label: 'Trig rule', hint: `${mark(`∫sec²(${v}) d${v} = tan(${v})`)}, since ${mark(`d/d${v} tan(${v}) = sec²(${v})`)}` };
  if (new RegExp(`^(?:[\\d./*]+\\*?)?csc\\(${v}\\)\\^2$`, 'i').test(t)) return { label: 'Trig rule', hint: `${mark(`∫csc²(${v}) d${v} = -cot(${v})`)}, since ${mark(`d/d${v} cot(${v}) = -csc²(${v})`)}` };
  if (new RegExp(`^(?:[\\d./*]+\\*?)?sec\\(${v}\\)\\*tan\\(${v}\\)$|^(?:[\\d./*]+\\*?)?tan\\(${v}\\)\\*sec\\(${v}\\)$`, 'i').test(t)) return { label: 'Trig rule', hint: mark(`∫sec(${v})tan(${v}) d${v} = sec(${v})`) };
  if (/\bsin\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`∫sin(${v}) d${v} = -cos(${v})`) };
  if (/\bcos\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`∫cos(${v}) d${v} = sin(${v})`) };
  if (/\bexp\b|e\^/i.test(inner)) return { label: 'Exponential rule', hint: mark(`∫e^${v} d${v} = e^${v}`) };
  if (/\bsqrt\b|√/i.test(inner)) return { label: 'Power rule', hint: `rewrite ${mark(`√${v}`)} as ${mark(`${v}^(1/2)`)}, then use the power rule` };

  // c/(ax + b): a linear substitution, not a power of x.
  if (new RegExp(`^[\\d./]+/\\(?[\\d./]*\\*?${v}[+-][\\d./]+\\)?$`, 'i').test(t)) {
    return { label: 'Linear substitution', hint: `${mark(`∫1/(a${v} + b) d${v} = (1/a)·ln|a${v} + b|`)} — let ${mark(`u = a${v} + b`)}, so ${mark(`du = a d${v}`)}` };
  }

  // Power rule only for a genuine power of the variable: x^n, c·x^n, x, c·x.
  if (new RegExp(`^(?:[\\d./*()-]+\\*)?${v}\\^\\(?-?[\\d./]+\\)?$`, 'i').test(t)) return { label: 'Power rule', hint: mark(`∫${v}^n d${v} = ${v}^(n+1)/(n+1)`) };
  if (new RegExp(`^(?:[\\d./*()-]+\\*)?${v}$`, 'i').test(t)) return { label: 'Power rule', hint: mark(`∫${v} d${v} = ${v}²/2`) };

  // Anything else the engine integrates directly is a table antiderivative
  // — say so, never "Power rule" (which used to be the fallback label).
  return { label: 'Table antiderivative', hint: 'a standard antiderivative from the table, verified by differentiating the result' };
}

// c/(p + q·x²) → arctan, c/√(p − q·x²) → arcsin, for positive numeric p, q.
// Recognised from the integrand's structure; Algebrite's antiderivative is
// the result and it is verified by differentiation before it is shown.
function integrateInverseTrig(term, variable, Algebrite) {
  const v = variable;
  const run = (code) => { const out = safeRunLocal(Algebrite, code); return out !== null && !isAlgebriteFailure(out) ? out : null; };
  const isConst = (t) => t !== null && !new RegExp(`\\b${v}\\b`).test(t);
  const num = run(`numerator(${term})`);
  const den = run(`denominator(${term})`);
  if (!isConst(num) || !den) return null;
  const c = num;

  const quadratic = (poly) => {
    const q = run(`coeff(${poly}, ${v}, 2)`);
    const p = run(`coeff(${poly}, ${v}, 0)`);
    const linear = run(`coeff(${poly}, ${v}, 1)`);
    const degree = run(`deg(${poly}, ${v})`);
    if (!isConst(q) || !isConst(p) || linear !== '0' || degree !== '2') return null;
    return { p, q, pNum: Number(math.evaluate(p)), qNum: Number(math.evaluate(q)) };
  };

  // arctan: denominator p + q x² with p, q > 0.
  const quad = quadratic(den);
  const arcsinDen = den.match(/^\((.+)\)\^\(1\/2\)$/);
  const shape = quad && quad.pNum > 0 && quad.qNum > 0 ? 'arctan'
    : arcsinDen ? 'arcsin' : null;
  if (!shape) return null;
  const inside = shape === 'arcsin' ? quadratic(arcsinDen[1]) : quad;
  if (!inside) return null;
  if (shape === 'arcsin' && !(inside.pNum > 0 && inside.qNum < 0)) return null;

  const antiderivative = run(`integral(${term}, ${v})`);
  if (!antiderivative || isUnevaluatedOperator(antiderivative) || !/arctan|arcsin/.test(antiderivative)) return null;
  if (!derivativeMatchesNumerically(antiderivative, term, v)) return null;

  const p = inside.p;
  const qAbs = shape === 'arcsin' ? run(`simplify(-(${inside.q}))`) : inside.q;
  const k = run(`simplify(sqrt((${qAbs})/(${p})))`);
  const kx = k === '1' ? v : `${beautify(k)}${/^[\d]+$/.test(k) ? '' : '·'}${v}`;
  const steps = [];
  const shown = beautify(term);
  if (shape === 'arctan') {
    steps.push(`Recognize the inverse-tangent pattern: ${mark(`d/d${v} arctan(${v}) = 1/(1 + ${v}²)`)}, so ${mark(`∫1/(1 + ${v}²) d${v} = arctan(${v}) + C`)}. The integrand ${mark(shown)} has that shape — a constant over (constant + constant·${mark(`${v}²`)}) — and the power rule does not apply (it is not a power of ${mark(v)}).`);
    if (p !== '1' || k !== '1') {
      steps.push(`Match it to the pattern: ${mark(`${beautify(den)} = ${p === '1' ? '' : `${beautify(p)}·`}(1 + (${kx})²)`)}${p === '1' ? '' : `, factoring out ${mark(beautify(p))}`}${k === '1' ? '' : `, since ${mark(`(${kx})² = ${beautify(qAbs)}${p === '1' ? '' : `/${beautify(p)}`}·${v}²`)}`}.`);
      const coef = run(`simplify((${c})/((${p})*(${k})))`) || `${c}/(${p}·${k})`;
      const recip = run(`simplify(1/(${k}))`) || `1/(${k})`;
      steps.push(`Let ${mark(`u = ${kx}`)}, so ${mark(`du = ${beautify(k)} d${v}`)} and ${mark(`d${v} = ${recip === '1' ? '' : `${beautify(recip)}·`}du`)}: ${mark(`∫${shown} d${v} = ${beautify(c)}/(${beautify(p)}·${beautify(k)}) · ∫1/(1 + u²) du = ${coef === '1' ? '' : `${beautify(coef)}·`}arctan(u)`)}.`);
      steps.push(`Substitute back ${mark(`u = ${kx}`)}: ${mark(lnify(antiderivative))}.`);
    } else if (c !== '1') {
      steps.push(`The constant factor ${mark(beautify(c))} comes out front: ${mark(`∫${shown} d${v} = ${beautify(c)}·arctan(${v})`)}.`);
    }
  } else {
    steps.push(`Recognize the inverse-sine pattern: ${mark(`d/d${v} arcsin(${v}) = 1/√(1 − ${v}²)`)}, so ${mark(`∫1/√(1 − ${v}²) d${v} = arcsin(${v}) + C`)}. The integrand ${mark(shown)} has that shape, and no substitution ${mark(`u = 1 − ${v}²`)} will work (there is no ${mark(v)} factor to absorb ${mark('du')}).`);
    if (p !== '1' || k !== '1') {
      steps.push(`Match it to the pattern: ${mark(`√(${beautify(arcsinDen[1])}) = ${p === '1' ? '' : `√${beautify(p)}·`}√(1 − (${kx})²)`)}${p === '1' ? '' : `, factoring out ${mark(beautify(p))}`}.`);
      const coef = run(`simplify((${c})/(sqrt(${p})*(${k})))`) || `${c}/(√${p}·${k})`;
      steps.push(`Let ${mark(`u = ${kx}`)}, so ${mark(`du = ${beautify(k)} d${v}`)}: ${mark(`∫${shown} d${v} = ${beautify(c)}/(√${beautify(p)}·${beautify(k)}) · ∫1/√(1 − u²) du = ${coef === '1' ? '' : `${beautify(coef)}·`}arcsin(u)`)}; substituting back gives ${mark(lnify(antiderivative))}.`);
    } else if (c !== '1') {
      steps.push(`The constant factor ${mark(beautify(c))} comes out front: ${mark(`∫${shown} d${v} = ${beautify(c)}·arcsin(${v})`)}.`);
    }
  }
  steps.push(`Check by differentiating: ${mark(`d/d${v}[${lnify(antiderivative)}] = ${shown}`)} ✓`);
  return { antiderivative, steps };
}

// c·g′(x)/g(x): the numerator is a constant multiple of the denominator's
// derivative, so u = g(x) turns it into c∫du/u = c·ln|u|. Detected here so
// the substitution walkthrough runs instead of the engine's direct answer
// with a wrong label.
function isLogDerivativeShape(term, variable, Algebrite) {
  const v = variable;
  const run = (code) => { const out = safeRunLocal(Algebrite, code); return out !== null && !isAlgebriteFailure(out) ? out : null; };
  const num = run(`numerator(${term})`);
  const den = run(`denominator(${term})`);
  if (!num || !den || den === '1' || !hasVariable(den, v) || !hasVariable(num, v)) return false;
  // For polynomials, c·g′ has degree deg g − 1 exactly: anything else is not
  // this shape, and Algebrite's simplify took 7 s to say so on
  // (x³ + 2)/((x − 1)(x + 1)²).
  const N = readPolynomial(num, v);
  const D = readPolynomial(den, v);
  if (N && D) {
    const degree = (P) => { const c = P.coefficients.map((q) => q.n); let d = c.length - 1; while (d > 0 && c[d] === 0n) d -= 1; return d; };
    if (degree(N) !== degree(D) - 1) return false;
  }
  const ratio = run(`simplify((${num})/(d(${den}, ${v})))`);
  return ratio !== null && !new RegExp(`\\b${v}\\b`).test(ratio) && ratio !== '0';
}

// ln|x² + 1|: when the argument is a sum of even powers with positive
// coefficients plus a positive constant, it is positive everywhere and the
// absolute-value bars can be dropped. Says so; otherwise the bars stay.
function positiveArgumentNote(antiderivative, variable) {
  return alwaysPositiveLogArguments(antiderivative, variable)
    .map((arg) => `Because ${mark(`${lnify(arg)} > 0`)} for every ${mark(variable)}, the absolute-value bars in ${mark(`ln|${lnify(arg)}|`)} are not needed.`);
}

// The log arguments in an antiderivative that are positive for every x: a
// sum of even powers with positive coefficients plus a positive constant.
function alwaysPositiveLogArguments(antiderivative, variable) {
  const out = [];
  // log((x^2+1)) too: the pieces of a partial-fraction sum keep their brackets.
  for (const m of String(antiderivative).matchAll(/log\(\(?((?:[^()]|\([^()]*\))+?)\)?\)(?![^()]*\))/g)) {
    const arg = m[1].replace(/\s+/g, '');
    const terms = arg.split(/(?=[+-])/).filter(Boolean);
    // A positive constant, an even power, or an exponential (e^x, e^(2x), exp(x)).
    const positive = terms.length > 0 && terms.every((t) => !t.startsWith('-') && (/^\+?\d+(?:\.\d+)?$/.test(t) || new RegExp(`^\\+?(?:\\d+(?:\\.\\d+)?\\*?)?${variable}\\^(?:\\d*[02468])$`).test(t) || new RegExp(`^\\+?(?:\\d+(?:\\.\\d+)?\\*?)?(?:e\\^\\(?-?\\d*\\*?${variable}\\)?|exp\\(-?\\d*\\*?${variable}\\))$`).test(t)));
    const hasConstant = terms.some((t) => /^\+?\d+(?:\.\d+)?$/.test(t));
    if (positive && hasConstant) out.push(m[1]);
  }
  return out;
}

// ln|x² + 1| → ln(x² + 1) in a displayed antiderivative, for every argument
// that is always positive — so the answer agrees with the step that said the
// bars were not needed.
// ln|A| → ln(A) for every ln(A) in the integrand: the integrand is only
// defined where A > 0, and there the bars change nothing.
function dropBarsOnIntegrandLogs(shown, integrand) {
  let out = shown;
  for (const [, arg] of String(integrand).matchAll(/(?<![a-z])(?:ln|log)\(([^()]+)\)/g)) {
    for (const b of new Set([beautify(arg), lnify(arg)])) out = out.split(`ln|${b}|`).join(`ln(${b})`);
  }
  return out;
}

function dropBarsOnPositiveArguments(shown, antiderivative, variable) {
  let out = shown;
  for (const arg of alwaysPositiveLogArguments(antiderivative, variable)) {
    for (const b of new Set([beautify(arg), lnify(arg)])) out = out.split(`ln|${b}|`).join(`ln(${b})`);
  }
  return out;
}


function isComposite(term, variable) {
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]/.test(arg)) return true;
  }
  if (/\([^()]*[+\-*/][^()]*\)\s*\^/.test(term)) return true;
  return false;
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
