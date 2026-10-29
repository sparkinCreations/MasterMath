// The rule each derivative uses (power, product, quotient, chain,
// logarithmic differentiation, …) and the worked steps shown for it.

import {
  beautify,
  splitTerms,
  hasVariable,
  rewriteReciprocalTrig,
  isUnevaluatedOperator,
  isAlgebriteFailure,
  expressionsNumericallyEqual,
  splitTopLevel,
  stripOuterParens,
  mark,
} from '../solverUtils.js';

// Algebrite writes the natural log as log(...); students read ln(...). Applied
// to RESULTS only — the input is echoed as typed.
// Likewise exp(x) → e^x. (?<![a-z]) not \b: beautify writes 2*log(x) as 2log(x).
// (…)^(1/2) → √(…), with Algebrite's −x² + 1 inside read as 1 − x², so
// arcsin′ shows as 1/√(1 − x^2), not 1/((-x^2 + 1)^(1/2)).
export const lnify = (s) => beautify(s)
  .replace(/(?<![a-z])log\(/g, 'ln(')
  .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
  .replace(/(?<![a-z])exp\(([^()]+)\)/g, 'e^($1)')
  .replace(/(?<![a-z])pi\^\(1\/2\)/g, '√π')
  .replace(/\/\(√π\)/g, '/√π')
  .replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)')
  .replace(/(?<![a-zA-Z_)^.])([a-z])\^\(1\/2\)/g, '√$1')
  .replace(/\/\(√([a-z])\)/g, '/√$1')
  .replace(/√\(-([^()]+?) \+ (\d+(?:\.\d+)?)\)/g, '√($2 - $1)')
  .replace(/\/\(√\(([^()]+)\)\)/g, '/√($1)');

/**
 * Build genuine, worked steps: differentiate each top-level term on its own
 * with Algebrite and show the intermediate result, then combine. Because
 * differentiation is linear, term-by-term differentiation is exact.
 */
export function generateDerivativeSteps(expression, derivative, variable, Algebrite) {
  const steps = [];
  const ddx = `d/d${variable}`;
  steps.push(`Identify the function to differentiate: ${mark(`f(${variable}) = ${beautify(expression)}`)}`);

  const terms = splitTerms(expression);
  let simplest = null;
  let preferSimplest = false;

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

    if (termDerivative !== null && label === 'Logarithmic differentiation') {
      // Keep the factored u^v·(…) form the derivation arrived at, rather
      // than restating it expanded.
      const factored = logDiffFactoredForm(signed, variable, Algebrite);
      if (factored && expressionsNumericallyEqual(factored, termDerivative, variable)) {
        termDerivative = factored;
        preferSimplest = true;
      }
    }
    if (termDerivative !== null) {
      termDerivative = trigRatioForm(termDerivative, variable);
      steps.push(mark(`${ddx}(${beautify(signed)}) = ${lnify(termDerivative)}`));
      if (terms.length === 1) simplest = termDerivative;
    } else {
      steps.push(`Differentiate ${mark(beautify(signed))} using the ${label.toLowerCase()}.`);
    }
  }

  if (terms.length > 1) {
    steps.push(`Add the term derivatives and simplify: ${mark(`f'(${variable}) = ${lnify(derivative)}`)}`);
  } else if (simplest === null) {
    steps.push(`So ${mark(`f'(${variable}) = ${lnify(derivative)}`)}`);
  }
  // With one term, the term line IS the result; restating it in another form
  // reads as a step backward, so it is not repeated.

  return { steps, simplest, preferSimplest };
}

/**
 * Classify which differentiation rule a single term needs. Operating on one
 * term (rather than the whole expression) makes the heuristics far more
 * reliable, and the label always sits next to the real computed result.
 */
export function classifyDerivativeRule(term, variable) {
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
    return { label: 'Quotient rule', hint: mark(`d/d${v}(u/w) = (u′w − u·w′) / w²`) };
  }

  // Product: two variable-bearing factors multiplied (excludes constant · f).
  if (isProduct(inner, v)) {
    return { label: 'Product rule', hint: mark(`d/d${v}(u·w) = u′·w + u·w′`) };
  }

  // x^x, x^(sin x): the variable in both base and exponent — neither the
  // power rule nor the exponential rule applies on its own.
  const powParts = splitTopLevel(inner, '^');
  if (powParts.length === 2 && hasVariable(powParts[0], v) && hasVariable(powParts[1], v)) {
    return { label: 'Logarithmic differentiation', hint: `write ${mark(`${beautify(inner)} = e^(${beautify(powParts[1])}·ln(${beautify(powParts[0])}))`)} and use the chain rule, or take ${mark('ln')} of both sides and differentiate implicitly` };
  }
  // a^x: constant base, variable exponent.
  if (powParts.length === 2 && !hasVariable(powParts[0], v) && hasVariable(powParts[1], v) && !/^\(?e\)?$/.test(powParts[0].trim())) {
    const u = stripOuterParens(powParts[1]);
    if (/[+\-*/^]/.test(u)) {
      return { label: 'Exponential rule with the chain rule', hint: `${mark(`d/d${v}(a^u) = a^u·ln(a)·u′`)} with ${mark(`u = ${beautify(u)}`)}` };
    }
    return { label: 'Exponential rule', hint: `${mark(`d/d${v}(a^${v}) = a^${v}·ln(a)`)} — the base is a constant, so this is not the power rule` };
  }
  // c/x^n: a constant over a power of the variable — the power rule with a
  // negative exponent, not the linear rule.
  const divOnce = splitTopLevel(inner, '/');
  if (divOnce.length === 2 && !hasVariable(divOnce[0], v) && hasVariable(divOnce[1], v)) {
    const den = stripOuterParens(divOnce[1]);
    const pow = den.match(new RegExp(`^${v}(?:\\^([\\d.]+))?$`));
    if (pow) {
      const n = pow[1] || '1';
      const coef = divOnce[0].trim() === '1' ? '' : `${beautify(divOnce[0])}·`;
      return { label: 'Power rule (negative exponent)', hint: `rewrite ${mark(beautify(inner))} as ${mark(`${coef}${v}^(−${n})`)}, then ${mark(`d/d${v}(${v}^n) = n·${v}^(n−1)`)}` };
    }
    // c/u for a whole expression u: the reciprocal is u^(−1), chain rule.
    const c = divOnce[0].trim() === '1' ? '' : `${beautify(divOnce[0])}·`;
    return { label: 'Chain rule (reciprocal)', hint: `${mark(`${beautify(inner)} = ${c}(${beautify(den)})^(−1)`)}, so the derivative is ${mark(`−${c}u′/u²`)} with ${mark(`u = ${beautify(den)}`)}` };
  }


  // Chain: a function applied to a non-trivial inner expression, or (…)^n.
  if (isChain(inner, v)) {
    return { label: 'Chain rule', hint: mark(`d/d${v}[f(g(${v}))] = f′(g(${v}))·g′(${v})`) };
  }

  // log(x) is the common logarithm: the parser wrote it as log(x)/log(10).
  if (/\blog\(/i.test(inner) && /log\(10\)/.test(inner)) return { label: 'Logarithmic rule', hint: `${mark(`log(${v})`)} is the base-10 logarithm, ${mark(`log(${v}) = ln(${v})/ln(10)`)}, so ${mark(`d/d${v}[log(${v})] = 1/(${v}·ln(10))`)}` };
  // Single trig / exponential / logarithmic / root functions. The inverse,
  // reciprocal and hyperbolic ones were filed under the power rule (October
  // 2026 test list: "Power rule — d/dx(x) = 1" for arcsin(x)).
  if (/\berf\b/i.test(inner)) return { label: 'Error function rule', hint: `${mark(`erf(${v}) = (2/√π)·∫_0^${v} e^(−t^2) dt`)}, so by the Fundamental Theorem of Calculus ${mark(`d/d${v}[erf(${v})] = (2/√π)·e^(−${v}^2)`)}` };
  if (/\b(?:arcsin|asin)\b/i.test(inner)) return { label: 'Inverse trig rule', hint: mark(`d/d${v}[arcsin(${v})] = 1/√(1 − ${v}^2)`) };
  if (/\b(?:arccos|acos)\b/i.test(inner)) return { label: 'Inverse trig rule', hint: mark(`d/d${v}[arccos(${v})] = −1/√(1 − ${v}^2)`) };
  if (/\b(?:arctan|atan)\b/i.test(inner)) return { label: 'Inverse trig rule', hint: mark(`d/d${v}[arctan(${v})] = 1/(1 + ${v}^2)`) };
  if (/\bsinh\b/i.test(inner)) return { label: 'Hyperbolic rule', hint: mark(`d/d${v}[sinh(${v})] = cosh(${v})`) };
  if (/\bcosh\b/i.test(inner)) return { label: 'Hyperbolic rule', hint: mark(`d/d${v}[cosh(${v})] = sinh(${v})`) };
  if (/\btanh\b/i.test(inner)) return { label: 'Hyperbolic rule', hint: mark(`d/d${v}[tanh(${v})] = 1 − tanh^2(${v})`) };
  if (/\bsec\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[sec(${v})] = sec(${v})·tan(${v})`) };
  if (/\bcsc\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[csc(${v})] = −csc(${v})·cot(${v})`) };
  if (/\bcot\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[cot(${v})] = −csc²(${v})`) };
  if (/\bsin\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[sin(${v})] = cos(${v})`) };
  if (/\bcos\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[cos(${v})] = -sin(${v})`) };
  if (/\btan\b/i.test(inner)) return { label: 'Trig rule', hint: mark(`d/d${v}[tan(${v})] = sec²(${v})`) };
  if (/\b(?:exp)\b|e\^/i.test(inner)) return { label: 'Exponential rule', hint: mark(`d/d${v}[e^${v}] = e^${v}`) };
  if (/\bln\b/i.test(inner)) return { label: 'Logarithmic rule', hint: mark(`d/d${v}[ln(${v})] = 1/${v}`) };
  if (/\bsqrt\b|√/i.test(inner)) return { label: 'Power rule', hint: `rewrite ${mark(`√${v}`)} as ${mark(`${v}^(1/2)`)}, then use the power rule` };

  // Power / constant-multiple of a power.
  if (/\^/.test(inner)) return { label: 'Power rule', hint: mark(`d/d${v}(${v}^n) = n·${v}^(n-1)`) };

  // Linear term (a·x or x): power rule with n = 1.
  return { label: 'Power rule', hint: `${mark(`d/d${v}(${v}) = 1`)}, so ${mark(`d/d${v}(a·${v}) = a`)}` };
}

// Derivative of a single piece as clean text, or null.
// d/dx[v·ln(u)] simplified — the bracket in y′ = u^v·(v′·ln u + v·u′/u).
function logDiffInnerDerivative(base, expo, v, Algebrite) {
  try {
    const raw = Algebrite.simplify(`d((${expo})*log(${base}), ${v})`).toString();
    if (isAlgebriteFailure(raw) || isUnevaluatedOperator(raw)) return null;
    return lnify(raw);
  } catch { return null; }
}

// The factored form u^v·(…) of a logarithmic-differentiation result, as an
// Algebrite-evaluable string, or null.
function logDiffFactoredForm(term, v, Algebrite) {
  const inner = stripOuterSign(term);
  const sign = term.trim().startsWith('-') ? '-' : '';
  const powParts = splitTopLevel(inner, '^');
  if (powParts.length !== 2) return null;
  try {
    const bracket = Algebrite.simplify(`d((${stripOuterParens(powParts[1])})*log(${stripOuterParens(powParts[0])}), ${v})`).toString();
    if (isAlgebriteFailure(bracket) || isUnevaluatedOperator(bracket)) return null;
    return `${sign}${inner}*(${bracket})`;
  } catch { return null; }
}

function derivText(expr, variable, Algebrite) {
  try {
    const d = Algebrite.derivative(rewriteReciprocalTrig(expr), variable).toString();
    if (isAlgebriteFailure(d) || isUnevaluatedOperator(d)) return null;
    return lnify(d);
  } catch { return null; }
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
  erf: (u) => `(2/√π)·e^(−(${u})²)`,
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
  const b = (t) => beautify(stripOuterParens(t));
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
      `Let ${mark(`${U} = ${b(first)}`)} and ${mark(`${W} = ${b(rest)}`)}${c ? ` (the constant factor ${mark(constFactors.map(b).join('·'))} carries through)` : ''}.`,
      `Then ${mark(`${U}′ = ${du}`)} and ${mark(`${W}′ = ${dw}`)}.`,
      `${mark(`${U}′·${W} + ${U}·${W}′ = ${paren(du)}·${paren(rest)} + ${paren(first)}·${paren(dw)}`)}${sign ? `, with the leading minus sign${c ? ' and constant' : ''} kept in front` : c ? `, times ${mark(constFactors.map(b).join('·'))}` : ''}.`,
    ];
  }

  if (label === 'Logarithmic differentiation') {
    const powParts = splitTopLevel(inner, '^');
    if (powParts.length !== 2) return [];
    const base = stripOuterParens(powParts[0]);
    const expo = stripOuterParens(powParts[1]);
    const du = derivText(base, v, Algebrite);
    const dv = derivText(expo, v, Algebrite);
    if (!du || !dv) return [];
    const bB = b(base);
    const bE = b(expo);
    const parenExp = (t) => (/^[a-z]$|^\d+(?:\.\d+)?$|^[a-z]+\([^()]*\)$/i.test(b(t)) ? b(t) : `(${b(t)})`);
    const rhs = logDiffInnerDerivative(base, expo, v, Algebrite);
    if (!rhs) return [];
    const productForm = `${dv === '1' ? '' : `${paren(dv)}·`}ln(${bB}) + ${bE === v ? v : paren(expo)}·${du === '1' ? '' : `${paren(du)}`}${du === '1' ? '' : '/'}${du === '1' ? `1/${paren(base)}` : paren(base)}`;
    return [
      `Let ${mark(`y = ${b(inner)}`)}, with ${mark(`${bB} > 0`)} so that ${mark(`ln(${bB})`)} is defined. The variable is in both the base and the exponent, so neither the power rule nor the exponential rule applies on its own.`,
      `Take ${mark('ln')} of both sides: ${mark(`ln(y) = ln(${paren(base)}^${parenExp(expo)}) = ${bE === v ? v : paren(expo)}·ln(${bB})`)} (the log rule ${mark('ln(a^b) = b·ln(a)')} brings the exponent down).`,
      `Differentiate both sides with respect to ${mark(v)}. The left side is implicit: ${mark(`d/d${v} ln(y) = y′/y`)}. The right side is a product: ${mark(`d/d${v}[${bE === v ? v : paren(expo)}·ln(${bB})] = ${productForm} = ${rhs}`)}.`,
      `So ${mark(`y′/y = ${rhs}`)}. Multiply both sides by ${mark('y')}: ${mark(`y′ = y·(${rhs})`)}.`,
      `Substitute ${mark(`y = ${b(inner)}`)} back: ${mark(`y′ = ${b(inner)}·(${rhs})`)}${sign ? ', with the leading minus sign kept in front' : ''}.`,
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
      `Let ${mark(`${U} = ${b(num)}`)} (numerator) and ${mark(`${W} = ${b(den)}`)} (denominator).`,
      `Then ${mark(`${U}′ = ${du}`)} and ${mark(`${W}′ = ${dw}`)}.`,
      `${mark(`(${U}′·${W} − ${U}·${W}′)/${W}² = (${paren(du)}·${paren(den)} − ${paren(num)}·${paren(dw)})/${paren(den)}²`)}.`,
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
    } else if ((m = inner.match(/^(-?\s*(?:[\d.]+\s*\*?\s*)?)(sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh|erf)\s*\((.+)\)(?:\s*\^\s*(\d+))?$/i))) {
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
    if (stripOuterParens(g).trim() === v) return [];
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
    if (c) notes.push(`The constant factor ${mark(c)} carries through.`);
    if (sign) notes.push('The leading minus sign carries through.');
    const coefNote = notes.length ? ` ${notes.join(' ')}` : '';
    return [
      `Let ${mark(`${U} = ${gShown}`)} (the inside), so the outer function is ${mark(outerText)}.`,
      `Outer derivative: ${mark(`d/d${U}[${outerText.split(' = ')[0]}] = ${outerDerivText}`)}. Inner derivative: ${mark(`${U}′ = d/d${v}[${gShown}] = ${dg}`)}.`,
      `Chain rule: multiply them and put ${mark(`${U} = ${gShown}`)} back: ${mark(`${back} · ${paren(dg)}`)}.${coefNote}`,
    ];
  }

  return [];
}

// cos(u)/sin(u) → cot(u), sin(u)/cos(u) → tan(u), for a quotient of the two
// with the same argument and no power on the denominator. Applied only when
// the two forms agree numerically, so a mis-read leaves the original alone.
export function trigRatioForm(expr, variable) {
  const s = String(expr);
  const out = s
    .replace(/\bcos\(([^()]*)\)\s*\/\s*sin\(\1\)(?!\s*\^)/g, 'cot($1)')
    .replace(/\bsin\(([^()]*)\)\s*\/\s*cos\(\1\)(?!\s*\^)/g, 'tan($1)');
  if (out === s) return s;
  try {
    return expressionsNumericallyEqual(rewriteReciprocalTrig(out), rewriteReciprocalTrig(s), variable) ? out : s;
  } catch {
    return s;
  }
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
  // function(function(...)): ln(sin(x)), sqrt(cos(x)) — a composition even
  // though the inner argument has no operator. Used to be filed under the
  // inner function's rule ("Trig rule" for ln(sin x)), skipping the chain.
  if (/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\(\s*(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh|abs)\s*\(/i.test(term)) return true;
  // function( ...variable...with an operator... )
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|erf)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]|\d\s*[a-z]/i.test(arg)) return true;
  }
  return false;
}
