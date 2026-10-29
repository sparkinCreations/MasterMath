// Derivatives: orders 1–4 and a value at a point, worked rule by rule and
// checked. This file is the entry point (solveDerivative); the rest is in
// ./derivatives/:
//
// - rules.js: the rule each term uses, and its worked steps
// - absLinear.js: |ax + b| by cases, the derivative's domain, the graph
// - guidance.js: tips and mistakes, chosen by the rule used

import {
  loadAlgebrite,
  beautify,
  readAsText,
  rewriteReciprocalTrig,
  parsesAsMath,
  isUnevaluatedOperator,
  isAlgebriteFailure,
  math,
  formatNumber,
  expressionsNumericallyEqual,
  realOddRoots,
  mark,
} from './solverUtils.js';
import { extractVariable } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';
import { trigRatioForm, generateDerivativeSteps, lnify } from './derivatives/rules.js';
import { derivativeGuidance } from './derivatives/guidance.js';
import {
  solveAbsLinear,
  sgnArguments,
  derivativeDomain,
  generateDerivativeGraph,
} from './derivatives/absLinear.js';

// Algebrite prefers a monic denominator, so d/dx arctan(2x) came back as
// 1/(2x² + 1/2). Clear the fractions inside a denominator sum by scaling
// numerator and denominator by their least common denominator: 2/(4x² + 1).
function clearDenominatorFractions(Algebrite, text) {
  const m = String(text).match(/^(-?)([^/()]+|\([^()]*\))\/\(([^()]*\/[^()]*)\)$/);
  if (!m) return text;
  const [, sign, numerator, denominator] = m.map((part, i) => (i > 1 && part ? part.replace(/(\d)\s*([a-z(])/gi, '$1*$2').replace(/\s+/g, '') : part));
  const denominators = [...denominator.matchAll(/\/\s*(\d+)/g)].map((d) => Number(d[1]));
  if (!denominators.length) return text;
  const L = denominators.reduce((acc, d) => (acc * d) / gcdInt(acc, d), 1);
  try {
    const top = Algebrite.run(`simplify((${numerator})*${L})`).toString();
    const bottom = Algebrite.run(`simplify((${denominator})*${L})`).toString();
    if (/\//.test(bottom) || isAlgebriteFailure(top) || isAlgebriteFailure(bottom)) return text;
    return `${sign}${/[+-]/.test(top.slice(1)) ? `(${top})` : top}/(${bottom})`;
  } catch {
    return text;
  }
}
const gcdInt = (a, b) => (b ? gcdInt(b, a % b) : Math.abs(a));

// What was differentiated, shown above the steps ("Read as"), so a misread
// is visible before the first step.
export async function solveDerivative(expression, options = {}) {
  const result = await solveDerivativeInner(expression, options);
  if (result && result.status !== 'parse_error' && String(expression).trim()) {
    const variable = options.variable || options.evalAt?.variable || extractVariable(expression);
    const order = Math.max(1, Math.min(4, Number(options.order) || 1));
    const op = order === 1 ? `d/d${variable}` : `d^${order}/d${variable}^${order}`;
    result.readAs = `${op} (${readAsText(expression)})${options.evalAt ? ` at ${variable} = ${options.evalAt.valueText}` : ''}`;
  }
  return result;
}

async function solveDerivativeInner(expression, options = {}) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = options.variable || options.evalAt?.variable || extractVariable(expression);
    const order = Math.max(1, Math.min(4, Number(options.order) || 1));

    // Algebrite has no sec/csc/cot; rewrite them into sin/cos before handing
    // off so those derivatives evaluate instead of coming back unevaluated.
    // ln|u| differentiates exactly as ln(u) does (u′/u), and Algebrite has no
    // abs — so drop the bars for differentiation only.
    const forAlgebrite = rewriteReciprocalTrig(expression).replace(/\b(?:ln|log)\s*\(\s*abs\s*\(([^()]*)\)\s*\)/gi, 'log($1)');

    // |ax + b| has a corner, not a power-rule derivative: rewrite it
    // piecewise, differentiate each branch, and compare the one-sided
    // derivatives at the corner (where f′ does not exist).
    if (order === 1) {
      const piecewise = solveAbsLinear(expression, variable, options, Algebrite);
      if (piecewise) return piecewise;
    }

    // Algebrite leaves quotient-rule results as a sum of fractions:
    // (x+1)/(x-1) → -1/(x-1)^2 + 1/(x-1) - x/(x-1)^2. Prefer the simplified
    // form when it is genuinely shorter and still a real answer — at every
    // order, so a second derivative is shown from the simplified first one.
    // Only for results of modest size: simplify on the expanded derivative
    // of (x+1)^50 does not return in any useful time.
    const shorten = (expr) => {
      try {
        if (expr.length > 160) return expr;
        const simplified = Algebrite.simplify(expr).toString();
        return simplified && !isAlgebriteFailure(simplified) && !isUnevaluatedOperator(simplified) && simplified.length < expr.length ? simplified : expr;
      } catch {
        return expr;
      }
    };
    // The derivative of one piece (an inside, a factor), for the insight that
    // shows the rule applied to this problem.
    const differentiate = (piece) => {
      try {
        const out = shorten(Algebrite.derivative(rewriteReciprocalTrig(piece), variable).toString());
        return out && !isAlgebriteFailure(out) && !isUnevaluatedOperator(out) ? lnify(out) : null;
      } catch {
        return null;
      }
    };
    // Authoritative, fully-simplified derivative. cos/sin and sin/cos of the
    // same argument are written as cot and tan (ln(sin x) → cot x), after a
    // numeric check that nothing changed.
    let derivative = trigRatioForm(clearDenominatorFractions(Algebrite, shorten(Algebrite.derivative(forAlgebrite, variable).toString())), variable);
    // A power of a polynomial keeps the chain rule's form: (2x + 1)^5 gave
    // 160x^4 + 320x^3 + … where a textbook writes 10(2x + 1)^4 (outside
    // review, 1.61.0). Only for that shape and a modest result, and only when
    // the factored form is shorter and numerically the same.
    if (/^\s*(?:[\d.]+\s*\*?\s*)?\([^()]+\)\s*\^\s*\(?\d+\)?\s*$/.test(expression) && derivative.length <= 160) {
      try {
        const factored = Algebrite.factor(derivative, variable).toString();
        if (factored && !isAlgebriteFailure(factored) && !isUnevaluatedOperator(factored) && factored.length < derivative.length && expressionsNumericallyEqual(factored, derivative, variable)) derivative = factored;
      } catch { /* keep the expanded form */ }
    }
    // Higher orders: differentiate the previous result again, showing each.
    const orderChain = [derivative];
    for (let k = 2; k <= order; k += 1) {
      derivative = trigRatioForm(clearDenominatorFractions(Algebrite, shorten(Algebrite.derivative(rewriteReciprocalTrig(derivative), variable).toString())), variable);
      orderChain.push(derivative);
    }

    // Algebrite doesn't throw when it can't differentiate something — it
    // returns `d(f, x)` unevaluated. That is not an answer.
    if (isUnevaluatedOperator(derivative)) {
      return unsupported({
        input: expression,
        reason: `The engine could not differentiate ${beautify(expression)} — it handed the derivative back unevaluated. This is a limitation of the solver, not your notation.`,
        answer: 'This derivative is beyond what this engine can compute',
        tips: [
          'Check that every function is one the solver knows: sin, cos, tan, sec, csc, cot, arcsin, arccos, arctan, sinh, cosh, tanh, sqrt, ln, log, exp, abs.',
          'Products, quotients and compositions of those all work — the gap is usually an unrecognised function name.',
        ],
      });
    }

    const primes = "'".repeat(order);
    const worked = generateDerivativeSteps(expression, order === 1 ? derivative : orderChain[0], variable, Algebrite);
    // The chain-rule steps quote the simplest form; clear its denominator
    // fractions before they are shown (1/(2x² + 1/2) → 2/(4x² + 1)).
    if (worked?.simplest) {
      const cleared = clearDenominatorFractions(Algebrite, worked.simplest);
      if (cleared !== worked.simplest) {
        const before = lnify(worked.simplest);
        const after = lnify(cleared);
        worked.steps = (worked.steps || []).map((st) => st.split(before).join(after));
        worked.simplest = cleared;
      }
    }
    const steps = worked.steps;
    // A single term's simplified derivative is the canonical answer. Before,
    // the term step showed (x² − 2x − 1)/(x − 1)² and the closing line then
    // restated it as Algebrite's expanded sum of fractions — a step backward
    // (September 2026 teaching-quality review, batch 1).
    if (worked.simplest && worked.simplest !== orderChain[0]
        && (worked.preferSimplest || worked.simplest.length <= orderChain[0].length)
        && expressionsNumericallyEqual(rewriteReciprocalTrig(worked.simplest), rewriteReciprocalTrig(orderChain[0]), variable)) {
      orderChain[0] = worked.simplest;
      if (order === 1) derivative = clearDenominatorFractions(Algebrite, worked.simplest);
    }
    // sgn(u) in a derivative marks a corner of |u|: say where f′ does not exist.
    const corners = sgnArguments(derivative);
    if (corners.length > 0) {
      steps.push(`${mark('sgn(u)')} is ${mark('+1')} where ${mark('u > 0')} and ${mark('−1')} where ${mark('u < 0')}; where ${mark('u = 0')} the graph of ${mark('|u|')} has a corner and the derivative does not exist. So ${mark(`f${primes}(${variable})`)} does not exist where ${mark(corners.map((u) => `${beautify(u)} = 0`).join(' or '))}.`);
    }
    // Where f′ is defined: poles of f′, and any root or logarithm restriction
    // carried over from f. Stated on the answer (1/x → −1/x², x ≠ 0).
    const domain = order === 1 && !options.evalAt ? derivativeDomain(expression, derivative, variable, Algebrite) : null;
    if (domain) steps.push(domain.step);
    if (order > 1) {
      const names = ['', 'first', 'second', 'third', 'fourth'];
      steps.push(`That is the first derivative. The ${names[order]} derivative differentiates ${order - 1} more time${order > 2 ? 's' : ''}:`);
      for (let k = 2; k <= order; k += 1) {
        steps.push(mark(`f${"'".repeat(k)}(${variable}) = d/d${variable}[${lnify(orderChain[k - 2])}] = ${lnify(orderChain[k - 1])}`));
      }
    }

    // "at x = a": evaluate the derivative there — the slope of the tangent
    // line at that point. Exact via Algebrite substitution, decimal alongside.
    let answer = `f${primes}(${variable}) = ${lnify(derivative)}${domain ? `, ${domain.text}` : ''}${corners.length > 0 ? ` (does not exist where ${corners.map((u) => `${beautify(u)} = 0`).join(' or ')})` : ''}`;
    let evalPoint = null;
    if (options.evalAt) {
      const { valueText } = options.evalAt;
      // A symbolic point ("at x = a"): substitute and leave it symbolic.
      if (/^[a-df-z]$/i.test(String(valueText).trim()) && String(valueText).trim().toLowerCase() !== variable) {
        const sym = Algebrite.run(`simplify(subst(${valueText}, ${variable}, ${derivative}))`).toString();
        if (sym && !isAlgebriteFailure(sym) && !/Stop|nil/.test(sym)) {
          steps.push(`Evaluate at ${mark(`${variable} = ${valueText}`)}: ${mark(`f${primes}(${valueText}) = ${lnify(sym)}`)}`);
          answer = `f${primes}(${valueText}) = ${lnify(sym)}`;
        }
        return { steps, answer, tips: [`${mark(`f${primes}(a)`)} is the slope of the tangent line at ${mark(`${variable} = a`)}; here ${mark('a')} is left as a symbol.`], common_mistakes: [], graph: generateDerivativeGraph(expression, derivative, variable) };
      }
      let value;
      try { value = math.evaluate(String(valueText).replace(/π/g, 'pi').replace(/√/g, 'sqrt')); } catch { value = NaN; }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return parseError({ input: expression, hint: `The evaluation point ${variable} = ${valueText} is not a number.` });
      }
      let exact = '';
      try {
        exact = Algebrite.run(`simplify(subst(${String(valueText).replace(/π/g, 'pi').replace(/√/g, 'sqrt')}, ${variable}, ${rewriteReciprocalTrig(derivative)}))`).toString();
        if (isAlgebriteFailure(exact) || isUnevaluatedOperator(exact) || /Stop|nil/.test(exact)) exact = '';
        // Algebrite writes e^n as exp(n); students read 1/e, e^2.
        exact = exact.replace(/exp\(-1\)/g, '1/e').replace(/exp\(1\)/g, 'e').replace(/exp\(-(\d+)\)/g, '1/e^$1').replace(/exp\((\d+)\)/g, 'e^$1');
      } catch { exact = ''; }
      // f must be defined at the point before f′ can be: ln(x) at x = −1 gave
      // f′(−1) = −1 from 1/x (outside review sweep, 1.61.0). A value that is
      // not a real number means the point is outside the domain.
      // Odd roots are real: x^(1/3) at x = −8 is −2 (mathjs alone gives a
      // complex root), and its derivative there is 1/12, not "undefined".
      const real = (e) => realOddRoots(String(e).replace(/(\([^()]*\)|\b[a-z]\b|\d+(?:\.\d+)?)\^\(-(\d+)\/([3579])\)/g, '(1/($1^($2/$3)))'));
      let outside = false;
      try {
        const fv = math.evaluate(real(rewriteReciprocalTrig(expression)), { [variable]: value });
        outside = typeof fv !== 'number' ? Boolean(fv && typeof fv === 'object' && 'im' in fv && Math.abs(fv.im) > 1e-12) : Number.isNaN(fv);
      } catch { outside = false; }
      if (outside) {
        steps.push(`Check the point first: ${mark(`f(${valueText})`)} is not a real number, so ${mark(`${variable} = ${valueText}`)} is outside the domain of ${mark('f')}, and ${mark(`f${primes}(${valueText})`)} does not exist.`);
        const { tips, common_mistakes } = derivativeGuidance(expression, variable, { order, differentiate });
        common_mistakes.unshift(`Applying the derivative's formula outside the domain of ${mark('f')}: the formula may give a number at ${mark(`${variable} = ${valueText}`)}, but ${mark(`f(${valueText})`)} is not a real number, so ${mark(`f${primes}(${valueText})`)} does not exist.`);
        tips.unshift(`${mark(`f${primes}(a)`)} can exist only where ${mark('f')} itself is defined: check that the point is in the domain of ${mark('f')} before evaluating the derivative's formula there.`);
        return { steps, answer: `f${primes}(${valueText}) does not exist: ${variable} = ${valueText} is outside the domain of f`, tips, common_mistakes, graph: generateDerivativeGraph(expression, derivative, variable) };
      }
      let numeric;
      try { numeric = math.evaluate(real(rewriteReciprocalTrig(derivative)), { [variable]: value }); } catch { numeric = NaN; }
      // At a corner of |u| the engine's sgn(0) = 0 would read as "slope 0";
      // the derivative does not exist there.
      const atCorner = corners.some((u) => {
        try { const val = math.evaluate(u, { [variable]: value }); return typeof val === 'number' && Math.abs(val) < 1e-12; } catch { return false; }
      });
      if (atCorner) numeric = NaN;
      // Algebrite's exact value of a real odd root at a negative point goes
      // through the complex (−1)^(1/3); keep the real value instead, as a
      // fraction when it is one (x^(1/3) at x = −8: 1/12).
      if (/\(-1\)\^/.test(exact)) {
        exact = '';
        for (let q = 1; q <= 1000 && Number.isFinite(numeric); q += 1) {
          const p = Math.round(numeric * q);
          if (Math.abs(p / q - numeric) < 1e-12) { exact = q === 1 ? String(p) : `${p}/${q}`; break; }
        }
      }
      // A vertical asymptote of f′ (tan at π/2) evaluates to a huge float,
      // not ∞ — treat anything beyond 1e12 as undefined there.
      if (typeof numeric !== 'number' || !Number.isFinite(numeric) || Math.abs(numeric) > 1e12) {
        steps.push(`Evaluate at ${mark(`${variable} = ${valueText}`)}: ${mark(`f${primes}(${valueText})`)} is undefined there${Number.isFinite(numeric) ? ' (the derivative has a vertical asymptote at that point)' : ''}.`);
        answer = `f${primes}(${valueText}) is undefined`;
      } else {
        const dec = formatNumber(numeric);
        const exactShown = exact && !/^-?\d+(?:\.\d+)?$/.test(exact) && lnify(exact) !== dec ? `${lnify(exact)} ≈ ${dec}` : (exact && /^-?\d+$/.test(exact) ? exact : dec);
        steps.push(`Evaluate at ${mark(`${variable} = ${valueText}`)}: ${mark(`f${primes}(${valueText}) = ${exactShown}`)}`);
        if (order === 1) steps.push(`That is the slope of the tangent line to f at ${mark(`${variable} = ${valueText}`)}.`);
        answer = `f${primes}(${valueText}) = ${exactShown}`;
        evalPoint = { x: value, y: numeric, valueText, shown: exactShown };
      }
    }

    // Tips and mistakes are chosen from the rules this derivative actually
    // used. A plain polynomial used to be served chain-rule warnings and a
    // pointer to the product and quotient rules that never appeared
    // (September 2026 teaching-quality review).
    const { tips, common_mistakes } = derivativeGuidance(expression, variable, {
      order,
      atPoint: Boolean(options.evalAt),
      differentiate,
      rounds: orderChain.map((d) => lnify(d)),
      point: evalPoint,
      result: lnify(derivative),
    });

    if (evalPoint) tips.unshift(`${mark("f'(a)")} is a number — the slope at one point — while ${mark(`f'(${variable})`)} is a function giving the slope everywhere.`);

    return {
      steps,
      answer,
      tips,
      common_mistakes,
      graph: generateDerivativeGraph(expression, derivative, variable),
    };
  } catch (error) {
    console.error('Derivative solver error:', error);
    if (parsesAsMath(expression)) {
      return unsupported({
        input: expression,
        reason: 'This derivative is beyond what this engine can compute.',
      });
    }
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use "^" for powers and "*" for products (e.g., "x^2 * sin(x)").'],
    });
  }
}
