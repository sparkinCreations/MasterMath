import {
  loadAlgebrite,
  beautify,
  splitTerms,
  sampleFunction,
  hasVariable,
  rewriteReciprocalTrig,
  parsesAsMath,
  isUnevaluatedOperator,
  isAlgebriteFailure,
  math,
  formatNumber,
} from './solverUtils.js';
import { extractVariable } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';

// Algebrite writes the natural log as log(...); students read ln(...). Applied
// to RESULTS only — the input is echoed as typed.
// Likewise exp(x) → e^x. (?<![a-z]) not \b: beautify writes 2*log(x) as 2log(x).
const lnify = (s) => beautify(s)
  .replace(/(?<![a-z])log\(/g, 'ln(')
  .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
  .replace(/(?<![a-z])exp\(([^()]+)\)/g, 'e^($1)');

export async function solveDerivative(expression, options = {}) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = options.evalAt?.variable || extractVariable(expression);

    // Algebrite has no sec/csc/cot; rewrite them into sin/cos before handing
    // off so those derivatives evaluate instead of coming back unevaluated.
    const forAlgebrite = rewriteReciprocalTrig(expression);

    // Authoritative, fully-simplified derivative.
    const derivative = Algebrite.derivative(forAlgebrite, variable).toString();

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

    const steps = generateDerivativeSteps(expression, derivative, variable, Algebrite);

    // "at x = a": evaluate the derivative there — the slope of the tangent
    // line at that point. Exact via Algebrite substitution, decimal alongside.
    let answer = `f'(${variable}) = ${lnify(derivative)}`;
    let evalPoint = null;
    if (options.evalAt) {
      const { valueText } = options.evalAt;
      const value = math.evaluate(String(valueText).replace(/π/g, 'pi').replace(/√/g, 'sqrt'));
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
      const numeric = math.evaluate(rewriteReciprocalTrig(derivative), { [variable]: value });
      if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
        steps.push(`Evaluate at ${variable} = ${valueText}: f'(${valueText}) is undefined there.`);
        answer = `f'(${valueText}) is undefined`;
      } else {
        const dec = formatNumber(numeric);
        const exactShown = exact && !/^-?\d+(?:\.\d+)?$/.test(exact) && lnify(exact) !== dec ? `${lnify(exact)} ≈ ${dec}` : (exact && /^-?\d+$/.test(exact) ? exact : dec);
        steps.push(`Evaluate at ${variable} = ${valueText}: f'(${valueText}) = ${exactShown}`);
        steps.push(`That is the slope of the tangent line to f at ${variable} = ${valueText}.`);
        answer = `f'(${valueText}) = ${exactShown}`;
        evalPoint = { x: value, y: numeric };
      }
    }

    const tips = [
      `Power rule: d/d${variable}(${variable}^n) = n·${variable}^(n-1)`,
      'The derivative of a constant is 0, and constant factors carry straight through.',
      'For products, quotients, and nested functions, reach for the product, quotient, or chain rule.',
    ];

    const common_mistakes = [
      'Dropping a constant factor when differentiating terms like 3x.',
      'Forgetting the inner derivative when using the chain rule.',
      'Sign slips when differentiating negative or subtracted terms.',
    ];

    if (evalPoint) tips.unshift(`f'(a) is a number — the slope at one point — while f'(${variable}) is a function giving the slope everywhere.`);

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
      tips: ['Use ^ for powers and * for products (e.g., x^2 * sin(x)).'],
    });
  }
}

/**
 * Build genuine, worked steps: differentiate each top-level term on its own
 * with Algebrite and show the intermediate result, then combine. Because
 * differentiation is linear, term-by-term differentiation is exact.
 */
function generateDerivativeSteps(expression, derivative, variable, Algebrite) {
  const steps = [];
  const ddx = `d/d${variable}`;
  steps.push(`Identify the function to differentiate: f(${variable}) = ${beautify(expression)}`);

  const terms = splitTerms(expression);

  if (terms.length > 1) {
    steps.push('Apply the sum/difference rule: differentiate each term separately, then add the results.');
  }

  for (const { signed } of terms) {
    const { label, hint } = classifyDerivativeRule(signed, variable);
    let termDerivative = null;
    try {
      termDerivative = Algebrite.derivative(rewriteReciprocalTrig(signed), variable).toString();
    } catch {
      termDerivative = null;
    }

    if (hint) {
      steps.push(`${label} — ${hint}.`);
    }

    if (termDerivative !== null) {
      steps.push(`${ddx}(${beautify(signed)}) = ${lnify(termDerivative)}`);
    } else {
      steps.push(`Differentiate ${beautify(signed)} using the ${label.toLowerCase()}.`);
    }
  }

  if (terms.length > 1) {
    steps.push(`Add the term derivatives and simplify: f'(${variable}) = ${lnify(derivative)}`);
  } else {
    steps.push(`So f'(${variable}) = ${lnify(derivative)}`);
  }

  return steps;
}

/**
 * Classify which differentiation rule a single term needs. Operating on one
 * term (rather than the whole expression) makes the heuristics far more
 * reliable, and the label always sits next to the real computed result.
 */
function classifyDerivativeRule(term, variable) {
  const v = variable;

  if (!hasVariable(term, v)) {
    return { label: 'Constant rule', hint: 'the derivative of a constant is 0' };
  }

  const inner = stripOuterSign(term);

  // Quotient: division where both sides contain the variable.
  const divParts = inner.split('/');
  if (
    divParts.length >= 2 &&
    hasVariable(divParts[0], v) &&
    hasVariable(divParts.slice(1).join('/'), v)
  ) {
    return { label: 'Quotient rule', hint: `d/d${v}(u/w) = (u′w − u·w′) / w²` };
  }

  // Product: two variable-bearing factors multiplied (excludes constant · f).
  if (isProduct(inner, v)) {
    return { label: 'Product rule', hint: `d/d${v}(u·w) = u′·w + u·w′` };
  }

  // Chain: a function applied to a non-trivial inner expression, or (…)^n.
  if (isChain(inner, v)) {
    return { label: 'Chain rule', hint: `d/d${v}[f(g(${v}))] = f′(g(${v}))·g′(${v})` };
  }

  // Single trig / exponential / logarithmic / root functions.
  if (/\bsin\b/i.test(inner)) return { label: 'Trig rule', hint: `d/d${v}[sin(${v})] = cos(${v})` };
  if (/\bcos\b/i.test(inner)) return { label: 'Trig rule', hint: `d/d${v}[cos(${v})] = -sin(${v})` };
  if (/\btan\b/i.test(inner)) return { label: 'Trig rule', hint: `d/d${v}[tan(${v})] = sec²(${v})` };
  if (/\b(?:exp)\b|e\^/i.test(inner)) return { label: 'Exponential rule', hint: `d/d${v}[e^${v}] = e^${v}` };
  if (/\bln\b/i.test(inner)) return { label: 'Logarithmic rule', hint: `d/d${v}[ln(${v})] = 1/${v}` };
  if (/\bsqrt\b|√/i.test(inner)) return { label: 'Power rule', hint: `rewrite √${v} as ${v}^(1/2), then use the power rule` };

  // Power / constant-multiple of a power.
  if (/\^/.test(inner)) return { label: 'Power rule', hint: `d/d${v}(${v}^n) = n·${v}^(n-1)` };

  // Linear term (a·x or x): power rule with n = 1.
  return { label: 'Power rule', hint: `d/d${v}(${v}) = 1, so d/d${v}(a·${v}) = a` };
}

function stripOuterSign(term) {
  return term.replace(/^[-+]/, '');
}

function isProduct(term, variable) {
  // Split on top-level '*' and check for at least two variable-bearing factors.
  const factors = splitTopLevel(term, '*');
  if (factors.length < 2) return false;
  const varFactors = factors.filter((f) => hasVariable(f, variable));
  return varFactors.length >= 2;
}

function isChain(term, variable) {
  // (expr)^n where expr is more than a bare variable.
  if (/\([^()]*[+\-*/][^()]*\)\s*\^/.test(term)) return true;
  // function( ...variable...with an operator... )
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]/.test(arg)) return true;
  }
  return false;
}

// Split a string on a delimiter that appears only at parenthesis depth 0.
function splitTopLevel(str, delimiter) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function generateDerivativeGraph(original, derivative, variable) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(derivative, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        secondaryLabel: `f'(${variable}) = ${beautify(derivative)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: f'(${variable}) = ${lnify(derivative)} (slope at each point)`,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
