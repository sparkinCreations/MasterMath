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
import { extractVariable, matchingParen } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';
import { featureWindow, interestingXs } from '../graphSampling.js';

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

    // |ax + b| has a corner, not a power-rule derivative: rewrite it
    // piecewise, differentiate each branch, and compare the one-sided
    // derivatives at the corner (where f′ does not exist).
    if (order === 1) {
      const piecewise = solveAbsLinear(expression, variable, options, Algebrite);
      if (piecewise) return piecewise;
    }

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
    // sgn(u) in a derivative marks a corner of |u|: say where f′ does not exist.
    const corners = sgnArguments(derivative);
    if (corners.length > 0) {
      steps.push(`sgn(u) is +1 where u > 0 and −1 where u < 0; where u = 0 the graph of |u| has a corner and the derivative does not exist. So f${primes}(${variable}) does not exist where ${corners.map((u) => `${beautify(u)} = 0`).join(' or ')}.`);
    }
    // Where f′ is defined: poles of f′, and any root or logarithm restriction
    // carried over from f. Stated on the answer (1/x → −1/x², x ≠ 0).
    const domain = order === 1 && !options.evalAt ? derivativeDomain(expression, derivative, variable, Algebrite) : null;
    if (domain) steps.push(domain.step);
    if (order > 1) {
      const names = ['', 'first', 'second', 'third', 'fourth'];
      steps.push(`That is the first derivative. The ${names[order]} derivative differentiates ${order - 1} more time${order > 2 ? 's' : ''}:`);
      for (let k = 2; k <= order; k += 1) {
        steps.push(`f${"'".repeat(k)}(${variable}) = d/d${variable}[${lnify(orderChain[k - 2])}] = ${lnify(orderChain[k - 1])}`);
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
      // At a corner of |u| the engine's sgn(0) = 0 would read as "slope 0";
      // the derivative does not exist there.
      const atCorner = corners.some((u) => {
        try { const val = math.evaluate(u, { [variable]: value }); return typeof val === 'number' && Math.abs(val) < 1e-12; } catch { return false; }
      });
      if (atCorner) numeric = NaN;
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
      if (termDerivative.length <= 160) {
        const simpler = Algebrite.simplify(termDerivative).toString();
        if (simpler && !isAlgebriteFailure(simpler) && simpler.length < termDerivative.length) termDerivative = simpler;
      }
    } catch {
      termDerivative = null;
    }

    if (hint) {
      steps.push(`${label} — ${hint}.`);
    }

    // The worked interior of the rule: name u and w (or the inner g), give
    // their derivatives, assemble the formula, then simplify to the result.
    try {
      for (const line of workedRuleSteps(signed, variable, label, Algebrite)) steps.push(line);
    } catch { /* the label + result still stand */ }

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

// Derivative of a single piece as clean text, or null.
function derivText(expr, variable, Algebrite) {
  try {
    const d = Algebrite.derivative(rewriteReciprocalTrig(expr), variable).toString();
    if (isAlgebriteFailure(d) || isUnevaluatedOperator(d)) return null;
    return lnify(d);
  } catch { return null; }
}

// Strip one layer of wrapping parentheses: "(x+1)" → "x+1".
function unwrap(t) {
  const s = t.trim();
  if (s.startsWith('(') && s.endsWith(')') && splitTopLevel(s.slice(1, -1), ')').length === 1) {
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') depth -= 1;
      if (depth === 0 && i < s.length - 1) return s;
    }
    return s.slice(1, -1);
  }
  return s;
}

const OUTER_DERIVATIVES = {
  sin: (u) => `cos(${u})`,
  cos: (u) => `-sin(${u})`,
  tan: (u) => `sec²(${u})`,
  sec: (u) => `sec(${u})·tan(${u})`,
  csc: (u) => `-csc(${u})·cot(${u})`,
  cot: (u) => `-csc²(${u})`,
  ln: (u) => `1/(${u})`,
  log: (u) => `1/(${u})`,
  exp: (u) => `e^(${u})`,
  sqrt: (u) => `1/(2√(${u}))`,
  arcsin: (u) => `1/√(1 − (${u})²)`,
  arccos: (u) => `-1/√(1 − (${u})²)`,
  arctan: (u) => `1/(1 + (${u})²)`,
  sinh: (u) => `cosh(${u})`,
  cosh: (u) => `sinh(${u})`,
  tanh: (u) => `sech²(${u})`,
};

// Worked steps for the product, quotient and chain rules on one term: name
// the parts, differentiate them, assemble the formula, simplify. Returns []
// when the term is not one of those shapes (the label and result suffice).
function workedRuleSteps(term, variable, label, Algebrite) {
  const v = variable;
  const inner = stripOuterSign(term);
  const sign = term.trim().startsWith('-') ? '-' : '';
  const U = v === 'u' ? 'p' : 'u';
  const W = v === 'w' ? 'q' : 'w';
  const b = (t) => beautify(unwrap(t));
  const paren = (t) => (/^[a-z0-9.]+$|^[a-z]+\([^()]*\)$/i.test(b(t)) ? b(t) : `(${b(t)})`);

  if (label === 'Product rule') {
    const factors = splitTopLevel(inner, '*');
    const varIdx = factors.map((f, i) => (hasVariable(f, v) ? i : -1)).filter((i) => i >= 0);
    if (varIdx.length < 2) return [];
    const constFactors = factors.filter((f) => !hasVariable(f, v));
    const first = factors[varIdx[0]];
    const rest = factors.filter((f, i) => i !== varIdx[0] && hasVariable(f, v)).join('*');
    const du = derivText(first, v, Algebrite);
    const dw = derivText(rest, v, Algebrite);
    if (!du || !dw) return [];
    const c = constFactors.length ? `${constFactors.map(b).join('·')}·` : '';
    return [
      `Let ${U} = ${b(first)} and ${W} = ${b(rest)}${c ? ` (the constant factor ${constFactors.map(b).join('·')} carries through)` : ''}.`,
      `Then ${U}′ = ${du} and ${W}′ = ${dw}.`,
      `${U}′·${W} + ${U}·${W}′ = ${paren(du)}·${paren(rest)} + ${paren(first)}·${paren(dw)}${sign ? `, with the leading minus sign${c ? ' and constant' : ''} kept in front` : c ? `, times ${constFactors.map(b).join('·')}` : ''}.`,
    ];
  }

  if (label === 'Quotient rule') {
    const parts = splitTopLevel(inner, '/');
    if (parts.length < 2) return [];
    const num = parts[0];
    const den = parts.slice(1).join('/');
    const du = derivText(num, v, Algebrite);
    const dw = derivText(den, v, Algebrite);
    if (!du || !dw) return [];
    return [
      `Let ${U} = ${b(num)} (numerator) and ${W} = ${b(den)} (denominator).`,
      `Then ${U}′ = ${du} and ${W}′ = ${dw}.`,
      `(${U}′·${W} − ${U}·${W}′)/${W}² = (${paren(du)}·${paren(den)} − ${paren(num)}·${paren(dw)})/${paren(den)}².`,
    ];
  }

  if (label === 'Chain rule' || label === 'Exponential rule with the chain rule' || label === 'Chain rule (reciprocal)') {
    let g = null;
    let outerText = null;
    let outerDerivText = null;
    let coef = '';
    let m;
    if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)((?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\(\s*[a-z]\s*\))\s*\^\s*(\d+)$/i))) {
      // sin(x)^n: the inside is sin(x) itself, the outer is u^n.
      coef = m[1];
      g = m[2];
      const n = m[3];
      outerText = `${U}^${n}`;
      outerDerivText = Number(n) === 2 ? `2·${U}` : `${n}·${U}^${Number(n) - 1}`;
    } else if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)\((.+)\)\s*\^\s*(\(?-?[\d./]+\)?)$/))) {
      // (g)^n
      coef = m[1];
      g = m[2];
      const n = m[3].replace(/[()]/g, '');
      outerText = `${U}^${n}`;
      const nm1 = /^-?\d+$/.test(n) ? String(Number(n) - 1) : `(${n} − 1)`;
      outerDerivText = `${n}·${U}^${nm1}`;
    } else if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)(?:e|exp)\s*\^?\s*\((.+)\)$/)) && !/^\d/.test(inner.replace(/^-?\s*[\d.]+\s*\*?\s*/, '')[0] === 'e' ? 'e' : 'x')) {
      coef = m[1];
      g = m[2];
      outerText = `e^${U}`;
      outerDerivText = `e^${U}`;
    } else if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)([\d.]+)\s*\^\s*\((.+)\)$/))) {
      coef = m[1];
      g = m[3];
      outerText = `${m[2]}^${U}`;
      outerDerivText = `${m[2]}^${U}·ln(${m[2]})`;
    } else if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)(sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\((.+)\)(?:\s*\^\s*(\d+))?$/i))) {
      const fn = m[2].toLowerCase();
      const power = m[4];
      coef = m[1];
      g = m[3];
      if (power) {
        // sin(g)^n: outer is (sin u)^n — two layers; name the inner sin as w
        outerText = `${fn}(${U})^${power}`;
        outerDerivText = `${power}·${fn}(${U})^${Number(power) - 1}·${OUTER_DERIVATIVES[fn](U)}`;
      } else {
        outerText = `${fn}(${U})`;
        outerDerivText = OUTER_DERIVATIVES[fn](U);
      }
    } else if ((m = inner.match(/^(-?\s*[\d.]*)\s*\/\s*\((.+)\)$/)) || (m = inner.match(/^(-?\s*[\d.]*)\s*\/\s*([a-z][^*/]*)$/i))) {
      g = m[2];
      const c = m[1].trim() || '1';
      outerText = `${c}/${U} = ${c}·${U}^(−1)`;
      outerDerivText = `−${c === '1' ? '' : `${c}·`}${U}^(−2) = −${c}/${U}²`;
    }
    if (!g || !hasVariable(g, v)) return [];
    // If the "inner" is itself just the variable there is no chain to show.
    if (unwrap(g).trim() === v) return [];
    const dg = derivText(g, v, Algebrite);
    if (!dg) return [];
    const gShown = b(g);
    const gParen = /^[a-z0-9.]+$|^[a-z]+\([^()]*\)$/i.test(gShown) ? gShown : `(${gShown})`;
    // Put u back: "(u)" → "(g)", then any bare u → g in parentheses.
    const gExp = /^[a-z]$|^\d+(?:\.\d+)?$/i.test(gShown) ? gShown : `(${gShown})`;
    const back = outerDerivText
      .replace(/\^1\b/g, '')
      .replace(new RegExp(`\\(${U}\\)`, 'g'), `(${gShown})`)
      .replace(new RegExp(`\\^${U}\\b`, 'g'), `^${gExp}`)
      .replace(new RegExp(`\\b${U}\\b`, 'g'), gParen);
    const c = coef.replace(/[\s*]/g, '');
    const notes = [];
    if (c) notes.push(`The constant factor ${c} carries through.`);
    if (sign) notes.push('The leading minus sign carries through.');
    const coefNote = notes.length ? ` ${notes.join(' ')}` : '';
    return [
      `Let ${U} = ${gShown} (the inside), so the outer function is ${outerText}.`,
      `Outer derivative: d/d${U}[${outerText.split(' = ')[0]}] = ${outerDerivText}. Inner derivative: ${U}′ = d/d${v}[${gShown}] = ${dg}.`,
      `Chain rule: multiply them and put ${U} = ${gShown} back: ${back} · ${paren(dg)}.${coefNote}`,
    ];
  }

  return [];
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
  // sin(x)^n: a power of a function.
  if (/\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\([^()]*\)\s*\^/i.test(term)) return true;
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

function generateDerivativeGraph(original, derivative, variable, extras = {}) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(derivative, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        // The viewer re-samples both curves for the window on screen; the
        // starting window frames where f and f′ do something (zeros,
        // turning points, inflections) rather than a fixed ±10.
        expression: original,
        secondaryExpression: derivative,
        variable,
        initialWindow: featureWindow([...interestingXs(original, variable), ...interestingXs(derivative, variable)]),
        secondaryLabel: `f'(${variable}) = ${lnify(derivative)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: f'(${variable}) = ${lnify(derivative)} (slope at each point)`,
        ...extras,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}


// The arguments of every sgn(…) call in an Algebrite derivative.
function sgnArguments(derivative) {
  const text = String(derivative);
  const out = [];
  const re = /(?<![a-z])sgn\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close === -1) break;
    const arg = text.slice(open + 1, close).trim();
    if (!out.includes(arg)) out.push(arg);
    re.lastIndex = close + 1;
  }
  return out;
}

const toNumber = (text) => {
  try {
    const v = math.evaluate(String(text));
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

// a·x + b with numeric a ≠ 0 and b, or null.
function linearCoefficients(expr, variable, Algebrite) {
  try {
    const a = toNumber(Algebrite.run(`coeff(${expr}, ${variable}, 1)`));
    const b = toNumber(Algebrite.run(`coeff(${expr}, ${variable}, 0)`));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
    if (String(Algebrite.run(`simplify((${expr}) - ((${a})*${variable} + (${b})))`)).trim() !== '0') return null;
    return { a, b };
  } catch {
    return null;
  }
}

// f(x) = k·|ax + b|: the derivative is ±k·a on either side of the corner
// x₀ = −b/a and does not exist at x₀. Shown as the course does it — rewrite
// piecewise, differentiate each branch, compare the one-sided derivatives.
// Returns null unless the whole expression has that shape.
function solveAbsLinear(expression, variable, options, Algebrite) {
  const v = variable;
  const m = String(expression).replace(/\s+/g, '').match(/^([+-]?)(\d+(?:\.\d+)?)?\*?abs\(([^()]+)\)$/i);
  if (!m) return null;
  const k = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
  const inner = m[3];
  const lin = linearCoefficients(inner, v, Algebrite);
  if (!lin) return null;
  const { a, b } = lin;
  const x0 = -b / a === 0 ? 0 : -b / a; // never -0
  let x0Text;
  try {
    x0Text = beautify(Algebrite.run(`simplify(-(${b})/(${a}))`));
  } catch {
    x0Text = formatNumber(x0);
  }
  if (!x0Text || /nil|stop/i.test(x0Text)) x0Text = formatNumber(x0);
  const right = k * Math.abs(a); // slope for x > x0
  const left = -right; // slope for x < x0
  const fmt = (n) => formatNumber(n);
  const innerShown = beautify(inner);
  const kShown = k === 1 ? '' : k === -1 ? '-' : `${fmt(k)}`;
  const branchPos = beautify(String(Algebrite.run(`simplify((${k})*(${inner}))`)));
  const branchNeg = beautify(String(Algebrite.run(`simplify(-(${k})*(${inner}))`)));
  const geq = a > 0 ? '≥' : '≤';
  const lt = a > 0 ? '<' : '>';

  const steps = [
    `Identify the function to differentiate: f(${v}) = ${kShown}|${innerShown}|`,
    innerShown === v
      ? `An absolute value is not a power, so the power rule does not apply. Rewrite it piecewise: |${v}| = ${v} when ${v} ≥ 0, and |${v}| = −${v} when ${v} < 0.`
      : `An absolute value is not a power, so the power rule does not apply. Rewrite it piecewise: |${innerShown}| = ${innerShown} when ${innerShown} ≥ 0, that is ${v} ${geq} ${x0Text}; and |${innerShown}| = −(${innerShown}) when ${innerShown} < 0, that is ${v} ${lt} ${x0Text}.`,
    `So f(${v}) = ${branchPos} for ${v} ${geq} ${x0Text}, and f(${v}) = ${branchNeg} for ${v} ${lt} ${x0Text}.`,
    `Differentiate each branch (each is a line, so its derivative is its slope): for ${v} > ${x0Text}, f'(${v}) = ${fmt(right)}; for ${v} < ${x0Text}, f'(${v}) = ${fmt(left)}.`,
    `At ${v} = ${x0Text} compare the one-sided derivatives: from the left the slope is ${fmt(left)}, from the right it is ${fmt(right)}. They differ, so f'(${x0Text}) does not exist — the graph has a corner there.`,
    `Conclusion: f'(${v}) = ${fmt(left)} for ${v} < ${x0Text}, f'(${v}) = ${fmt(right)} for ${v} > ${x0Text}, and f'(${x0Text}) does not exist.`,
  ];
  let answer = `f'(${v}) = ${fmt(left)} for ${v} < ${x0Text}, ${fmt(right)} for ${v} > ${x0Text}; f'(${x0Text}) does not exist`;

  if (options.evalAt) {
    const { valueText } = options.evalAt;
    const value = toNumber(String(valueText).replace(/π/g, 'pi').replace(/√/g, 'sqrt'));
    if (!Number.isFinite(value)) {
      return parseError({ input: expression, hint: `The evaluation point ${v} = ${valueText} is not a number.` });
    }
    if (Math.abs(value - x0) < 1e-12) {
      steps.push(`Evaluate at ${v} = ${valueText}: this is the corner. The one-sided derivatives are ${fmt(left)} (from the left) and ${fmt(right)} (from the right), so f'(${valueText}) does not exist.`);
      answer = `f'(${valueText}) does not exist`;
    } else {
      const slope = value > x0 ? right : left;
      steps.push(`Evaluate at ${v} = ${valueText}: ${valueText} ${value > x0 ? '>' : '<'} ${x0Text}, so f'(${valueText}) = ${fmt(slope)}.`);
      steps.push(`That is the slope of the tangent line to f at ${v} = ${valueText}.`);
      answer = `f'(${valueText}) = ${fmt(slope)}`;
    }
  }

  const cornerLabel = `f'(${x0Text}) does not exist`;
  const graph = generateDerivativeGraph(expression, `(${k * a})*sgn(${inner})`, v, {
    secondaryLabel: `f'(${v}) = ${fmt(left)} (${v} < ${x0Text}), ${fmt(right)} (${v} > ${x0Text})`,
    description: `Blue/indigo: f(${v}) = ${kShown}|${innerShown}|  |  Green: f'(${v}) = ${fmt(left)} for ${v} < ${x0Text} and ${fmt(right)} for ${v} > ${x0Text}; the hollow markers show f'(${x0Text}) does not exist.`,
    secondaryBreaks: [x0],
    initialWindow: featureWindow([x0 - 2, x0 + 2]),
    annotations: {
      openPoints: [
        { x: x0, y: left, label: cornerLabel, series: 'secondary' },
        { x: x0, y: right, label: cornerLabel, series: 'secondary' },
      ],
    },
  });

  return {
    steps,
    answer,
    tips: [
      `|u| = u for u ≥ 0 and −u for u < 0: an absolute value is a piecewise function, and each piece is differentiated on its own.`,
      'A derivative exists at a point only if the left and right derivatives agree. At a corner they do not, so there is no tangent line there.',
      `Away from the corner, d/d${v}|u| = sgn(u)·u′ — the sign of u times the inner derivative.`,
    ],
    common_mistakes: [
      'Applying the power rule to |x| as if it were x.',
      `Reporting f'(${x0Text}) = 0 because sgn(0) = 0 on a calculator — the derivative does not exist there.`,
    ],
    graph,
  };
}

// Where f′ is defined, as a condition on the answer ("x ≠ 0", "x > 0"), with
// a step giving the reason. Two sources: the poles of f′ (a polynomial
// denominator's real roots), and root/log restrictions carried from f or
// created by f′ — √u needs u ≥ 0 (u > 0 when it sits in a denominator),
// ln(u) needs u > 0 — for a linear u. Null when nothing restricts f′; a
// restriction that cannot be read exactly is left unstated, never guessed.
function derivativeDomain(original, derivative, variable, Algebrite) {
  const v = variable;
  const conditions = [];
  const reasons = [];
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  const push = (cond, reason) => {
    if (!conditions.includes(cond)) {
      conditions.push(cond);
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    }
  };

  // Root and log restrictions.
  const restrictions = []; // { r, strict, dir: 1 | -1, reason }
  const scan = (text, source) => {
    const t = String(text);
    const patterns = [
      { re: /(?<![a-z])sqrt\s*\(/gi, kind: 'sqrt' },
      { re: /(?<![a-z])(?:ln|log)\s*\(/gi, kind: 'log' },
    ];
    for (const { re, kind } of patterns) {
      let m;
      while ((m = re.exec(t)) !== null) {
        const open = m.index + m[0].length - 1;
        const close = matchingParen(t, open);
        if (close === -1) break;
        const arg = t.slice(open + 1, close).trim();
        re.lastIndex = close + 1;
        if (!hasVar.test(arg)) continue;
        const lin = linearCoefficients(arg, v, Algebrite);
        if (!lin) continue;
        restrictions.push({ r: -lin.b / lin.a, dir: lin.a > 0 ? 1 : -1, kind, arg, source });
      }
    }
    // x^(1/2), (ax+b)^(1/2)
    const half = /(?:\(([^()]+)\)|(?<![a-z])([a-z]))\^\(1\/2\)/g;
    let m;
    while ((m = half.exec(t)) !== null) {
      const arg = (m[1] || m[2]).trim();
      if (!hasVar.test(arg)) continue;
      const lin = linearCoefficients(arg, v, Algebrite);
      if (!lin) continue;
      restrictions.push({ r: -lin.b / lin.a, dir: lin.a > 0 ? 1 : -1, kind: 'sqrt', arg, source });
    }
  };
  scan(original, 'f');
  scan(derivative, "f'");

  const finiteAt = (x) => {
    try {
      const y = math.evaluate(rewriteReciprocalTrig(derivative), { [v]: x });
      return typeof y === 'number' && Number.isFinite(y);
    } catch {
      return false;
    }
  };
  for (const { r, dir, kind, arg } of restrictions) {
    // Strict when f′ itself is undefined at the boundary (the radical sits
    // in a denominator) or the restriction comes from a logarithm.
    const strict = kind === 'log' || !finiteAt(r);
    const sym = dir > 0 ? (strict ? '>' : '≥') : (strict ? '<' : '≤');
    const rText = formatNumber(r);
    const reason = kind === 'log'
      ? `ln(${beautify(arg)}) is defined only for ${beautify(arg)} > 0`
      : `√(${beautify(arg)}) is defined only for ${beautify(arg)} ≥ 0${strict ? `, and f' has it in a denominator, so ${v} = ${rText} is excluded too` : ''}`;
    push(`${v} ${sym} ${rText}`, reason);
  }

  // Poles of f′: real roots of a polynomial denominator.
  try {
    const den = String(Algebrite.run(`denominator(${derivative})`)).trim();
    if (den && hasVar.test(den) && !/[a-wyz]{2,}/i.test(den.replace(new RegExp(v, 'g'), ''))) {
      const rootsRaw = String(Algebrite.roots(den, v)).trim();
      if (rootsRaw && !/stop|error|nil/i.test(rootsRaw)) {
        const poles = rootsRaw.replace(/^\[|\]$/g, '').split(',').map((t) => toNumber(t.trim())).filter(Number.isFinite);
        for (const p of [...new Set(poles.map((x) => Math.round(x * 1e9) / 1e9))]) {
          const excluded = restrictions.some(({ r, dir }) => (dir > 0 ? p <= r + 1e-12 : p >= r - 1e-12));
          if (!excluded) push(`${v} ≠ ${formatNumber(p)}`, `the denominator of f' is 0 at ${v} = ${formatNumber(p)}`);
        }
      }
    }
  } catch { /* no pole information */ }

  if (conditions.length === 0) return null;
  return {
    text: conditions.join(', '),
    step: `Domain of f'(${v}): ${conditions.join(' and ')} — ${reasons.join('; ')}.`,
  };
}
