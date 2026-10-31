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
import { nonElementaryNote, indefiniteMethod, indefiniteGuidance } from './integrals/guidance.js';
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
// "Here: u = x², du = 2x dx, so ∫… = …": the pieces this integral's steps
// chose, read back from the step templates, and its answer.
function workedIntegral(method, text, answer) {
  const pick = (re) => (text.match(re) || [])[1]?.trim();
  const parts = [];
  if (method === 'substitution') {
    const u = pick(/Let u = (.+?)\. Then du = /);
    const du = pick(/\. Then (du = .+? d[a-z])\b/);
    if (u && du) parts.push(mark(`u = ${u}`), mark(du));
  } else if (method.startsWith('by parts')) {
    const u = pick(/Choose the parts: u = (.+?), dv = /);
    const dv = pick(/Choose the parts: u = .+?, (dv = .+? d[a-z])\b/);
    if (u && dv) parts.push(mark(`u = ${u}`), mark(dv));
    const rounds = [...text.matchAll(/\(round (\d+)\)/g)].map((m) => Number(m[1]));
    const solved = text.match(/Move it to the left and solve: \((-?[\d/]+)\)·I = (.+)$/m);
    if (solved) parts.push(`and the integral comes back: ${mark(`${solved[1]}I = ${solved[2].trim()}`)}`);
    else if (rounds.length) parts.push(`and ${Math.max(...rounds)} rounds`);
  } else if (method.startsWith('partial fractions') || method === 'irreducible quadratic') {
    const split = pick(/Partial fractions[^:\n]*: (.+?)\.(?:\s|$)/);
    // A split that only restates the fraction (one irreducible quadratic) says nothing.
    const [lhs, rhs] = (split || '').split(' = ');
    if (split && rhs && lhs.replace(/\s+/g, '') !== rhs.replace(/\s+/g, '') && !/[a-z]{4,}/i.test(split.replace(/\b(?:ln|arctan|sqrt)\b/g, ''))) parts.push(mark(split));
  } else if (method === 'trig substitution') {
    const sub = pick(/substitute ([a-z] = [^(,]+?)\s*[(,]/);
    const dx = pick(/so (d[a-z] = [^,;]+?)(?:,| and\b|;|\.)/);
    if (sub) parts.push(mark(sub.replace(/\s+$/, '')));
    if (dx) parts.push(mark(dx));
  } else if (method === 'form substitution') {
    const u = pick(/substitute (u = [^,]+?)(?:,| so)/);
    if (u) parts.push(mark(u));
  }
  const pieces = parts.length > 2 ? `${parts.slice(0, -1).join(', ')} ${parts[parts.length - 1]}` : parts.join(', ');
  return pieces ? `Here: ${pieces}, so ${mark(answer)}.` : `Here: ${mark(answer)}.`;
}

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
    const byParts = perTerm.filter((r) => r.method === 'byparts');
    const reduction = perTerm.find((r) => r.method === 'reduction');
    const table = perTerm.filter((r) => r.label === 'Table antiderivative').map((r) => r.term).join(' ');
    const method = indefiniteMethod({
      usesErf, anyFormSub, anyReduction, anyTrigPower, anyByParts, anyTrigSub, anyInverseTrig, anyPartial, anySubstitution, anyAbs, directLabels,
      reductionOfTan: Boolean(reduction && /\b(?:tan|cot)\b/.test(reduction.term) && !/\b(?:sec|csc)\b/.test(reduction.term)),
      byPartsCyclic: byParts.some((r) => r.cyclic),
      byPartsLog: byParts.some((r) => new RegExp(`^[-+]?(?:[\\d./]+\\*?)?(?:ln|log)\\(${variable}\\)$`).test(r.term.replace(/\s+/g, ''))),
      byPartsRepeated: byParts.some((r) => new RegExp(`${variable}\\^\\(?[2-9]`).test(r.term)),
      divideFirst: /divide first/.test(stepText),
      singleQuadratic,
      tableExponential: new RegExp(`(?:\\d|\\))\\s*\\^\\s*\\(?[^)]*\\b${variable}\\b`).test(table) && !/\be\s*\^/.test(table),
      tableHyperbolic: /\b(?:sinh|cosh|tanh)\b/.test(table),
    });
    const { tips, mistakes: common_mistakes } = indefiniteGuidance(method, variable);

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
    // ∫(x − x) dx: the antiderivative is the constant alone, not "0 + C".
    const answer = `∫(${beautify(expression)}) d${variable} ${perTerm.some((r) => r.approximate) ? '≈' : '='} ${shownIntegral.trim() === '0' ? 'C' : `${shownIntegral} + C`}`;
    // The second insight works this integral (outside review, 1.61.0): the
    // pieces the steps chose — u and du, u and dv, the split into partial
    // fractions, the trig substitution — and the result.
    const here = workedIntegral(method, stripMathMarkers(steps.join('\n')), answer);
    if (here && method !== 'erf') tips.splice(method === 'tan reduction' ? 0 : 1, 0, here);
    return {
      steps,
      answer,
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
