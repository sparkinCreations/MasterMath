// The rule each term is integrated by (power, exponential, inverse trig,
// half-angle, a quotient of trig functions, …) and the worked steps shown
// for it.

import {
  math,
  beautify,
  formatNumber,
  splitTerms,
  hasVariable,
  rewriteReciprocalTrig,
  isUnevaluatedOperator,
  isAlgebriteFailure,
  lnify,
  splitTopLevel,
  mark,
} from '../solverUtils.js';
import { derivativeMatchesNumerically } from '../substitutionSolver.js';
import { readPolynomial } from '../polynomialRoots.js';
import { dropBarsOnPositiveArguments, safeRunLocal } from './display.js';

// Assemble the worked steps from the per-term results. Multi-term integrals get
// a header per term; a single term shows its steps directly. The closing line
// states the combined antiderivative with +C.
export function buildPerTermSteps(expression, terms, perTerm, variable, total, combinedFrom = null) {
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

/**
 * Worked steps: integrate each top-level term individually with Algebrite and
 * show the intermediate antiderivative, then combine and add +C. Integration is
 * linear, so this term-by-term breakdown is exact.
 */
export function generateIntegralSteps(expression, integral, variable, Algebrite) {
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
export function halfAngleSteps(term, variable, anti) {
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
export function trigQuotientSteps(term, variable, anti) {
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

export function classifyIntegralRule(term, variable) {
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
export function integrateInverseTrig(term, variable, Algebrite) {
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
export function isLogDerivativeShape(term, variable, Algebrite) {
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


function isComposite(term, variable) {
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]/.test(arg)) return true;
  }
  if (/\([^()]*[+\-*/][^()]*\)\s*\^/.test(term)) return true;
  return false;
}
