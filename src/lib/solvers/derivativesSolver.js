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
    const variable = options.variable || options.evalAt?.variable || extractVariable(expression);
    const order = Math.max(1, Math.min(4, Number(options.order) || 1));

    // Algebrite has no sec/csc/cot; rewrite them into sin/cos before handing
    // off so those derivatives evaluate instead of coming back unevaluated.
    // ln|u| differentiates exactly as ln(u) does (u′/u), and Algebrite has no
    // abs — so drop the bars for differentiation only.
    const forAlgebrite = rewriteReciprocalTrig(expression).replace(/\b(?:ln|log)\s*\(\s*abs\s*\(([^()]*)\)\s*\)/gi, 'log($1)');

    // Authoritative, fully-simplified derivative.
    let derivative = Algebrite.derivative(forAlgebrite, variable).toString();
    // Higher orders: differentiate the previous result again, showing each.
    const orderChain = [derivative];
    for (let k = 2; k <= order; k += 1) {
      derivative = Algebrite.derivative(derivative, variable).toString();
      orderChain.push(derivative);
    }
    // Algebrite leaves quotient-rule results as a sum of fractions:
    // (x+1)/(x-1) → -1/(x-1)^2 + 1/(x-1) - x/(x-1)^2. Prefer the simplified
    // form when it is genuinely shorter and still a real answer.
    // Only for results of modest size: simplify on the expanded derivative
    // of (x+1)^50 does not return in any useful time.
    try {
      const simplified = derivative.length > 160 ? derivative : Algebrite.simplify(derivative).toString();
      if (simplified && !isAlgebriteFailure(simplified) && !isUnevaluatedOperator(simplified) && simplified.length < derivative.length) {
        derivative = simplified;
      }
    } catch { /* keep the raw derivative */ }

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
    const steps = generateDerivativeSteps(expression, orderChain[0], variable, Algebrite);
    if (order > 1) {
      const names = ['', 'first', 'second', 'third', 'fourth'];
      steps.push(`That is the first derivative. The ${names[order]} derivative differentiates ${order - 1} more time${order > 2 ? 's' : ''}:`);
      for (let k = 2; k <= order; k += 1) {
        steps.push(`f${"'".repeat(k)}(${variable}) = d/d${variable}[${lnify(orderChain[k - 2])}] = ${lnify(orderChain[k - 1])}`);
      }
    }

    // "at x = a": evaluate the derivative there — the slope of the tangent
    // line at that point. Exact via Algebrite substitution, decimal alongside.
    let answer = `f${primes}(${variable}) = ${lnify(derivative)}`;
    let evalPoint = null;
    if (options.evalAt) {
      const { valueText } = options.evalAt;
      // A symbolic point ("at x = a"): substitute and leave it symbolic.
      if (/^[a-df-z]$/i.test(String(valueText).trim()) && String(valueText).trim().toLowerCase() !== variable) {
        const sym = Algebrite.run(`simplify(subst(${valueText}, ${variable}, ${derivative}))`).toString();
        if (sym && !isAlgebriteFailure(sym) && !/Stop|nil/.test(sym)) {
          steps.push(`Evaluate at ${variable} = ${valueText}: f${primes}(${valueText}) = ${lnify(sym)}`);
          answer = `f${primes}(${valueText}) = ${lnify(sym)}`;
        }
        return { steps, answer, tips: [`f${primes}(a) is the slope of the tangent line at ${variable} = a; here a is left as a symbol.`], common_mistakes: [], graph: generateDerivativeGraph(expression, derivative, variable) };
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
      let numeric;
      try { numeric = math.evaluate(rewriteReciprocalTrig(derivative), { [variable]: value }); } catch { numeric = NaN; }
      // A vertical asymptote of f′ (tan at π/2) evaluates to a huge float,
      // not ∞ — treat anything beyond 1e12 as undefined there.
      if (typeof numeric !== 'number' || !Number.isFinite(numeric) || Math.abs(numeric) > 1e12) {
        steps.push(`Evaluate at ${variable} = ${valueText}: f${primes}(${valueText}) is undefined there${Number.isFinite(numeric) ? ' (the derivative has a vertical asymptote at that point)' : ''}.`);
        answer = `f${primes}(${valueText}) is undefined`;
      } else {
        const dec = formatNumber(numeric);
        const exactShown = exact && !/^-?\d+(?:\.\d+)?$/.test(exact) && lnify(exact) !== dec ? `${lnify(exact)} ≈ ${dec}` : (exact && /^-?\d+$/.test(exact) ? exact : dec);
        steps.push(`Evaluate at ${variable} = ${valueText}: f${primes}(${valueText}) = ${exactShown}`);
        if (order === 1) steps.push(`That is the slope of the tangent line to f at ${variable} = ${valueText}.`);
        answer = `f${primes}(${valueText}) = ${exactShown}`;
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

  // x^x, x^(sin x): the variable in both base and exponent — neither the
  // power rule nor the exponential rule applies on its own.
  const powParts = splitTopLevel(inner, '^');
  if (powParts.length === 2 && hasVariable(powParts[0], v) && hasVariable(powParts[1], v)) {
    return { label: 'Logarithmic differentiation', hint: `write ${beautify(inner)} = e^(${beautify(powParts[1])}·ln(${beautify(powParts[0])})) and use the chain rule, or take ln of both sides and differentiate implicitly` };
  }
  // a^x: constant base, variable exponent.
  if (powParts.length === 2 && !hasVariable(powParts[0], v) && hasVariable(powParts[1], v) && !/^\(?e\)?$/.test(powParts[0].trim())) {
    const u = powParts[1].trim().replace(/^\((.*)\)$/, '$1');
    if (/[+\-*/^]/.test(u)) {
      return { label: 'Exponential rule with the chain rule', hint: `d/d${v}(a^u) = a^u·ln(a)·u′ with u = ${beautify(u)}` };
    }
    return { label: 'Exponential rule', hint: `d/d${v}(a^${v}) = a^${v}·ln(a) — the base is a constant, so this is not the power rule` };
  }
  // c/x^n: a constant over a power of the variable — the power rule with a
  // negative exponent, not the linear rule.
  const divOnce = splitTopLevel(inner, '/');
  if (divOnce.length === 2 && !hasVariable(divOnce[0], v) && hasVariable(divOnce[1], v)) {
    const den = divOnce[1].trim().replace(/^\((.*)\)$/, '$1').trim();
    const pow = den.match(new RegExp(`^${v}(?:\\^([\\d.]+))?$`));
    if (pow) {
      const n = pow[1] || '1';
      const coef = divOnce[0].trim() === '1' ? '' : `${beautify(divOnce[0])}·`;
      return { label: 'Power rule (negative exponent)', hint: `rewrite ${beautify(inner)} as ${coef}${v}^(−${n}), then d/d${v}(${v}^n) = n·${v}^(n−1)` };
    }
    // c/u for a whole expression u: the reciprocal is u^(−1), chain rule.
    const c = divOnce[0].trim() === '1' ? '' : `${beautify(divOnce[0])}·`;
    return { label: 'Chain rule (reciprocal)', hint: `${beautify(inner)} = ${c}(${beautify(den)})^(−1), so the derivative is −${c}u′/u² with u = ${beautify(den)}` };
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
  // e^(expr) or a^(expr) with a non-trivial exponent: e^(x^2), 2^(3x).
  const expArg = term.match(/\^\s*\(([^()]*)\)/);
  if (expArg && hasVariable(expArg[1], variable) && /[+\-*/^]/.test(expArg[1])) return true;
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
