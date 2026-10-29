// Tips and mistakes for the derivatives solver, chosen by the rule used.

import { splitTerms, mark } from '../solverUtils.js';
import { classifyDerivativeRule } from './rules.js';

// Guidance matched to the rules the term-by-term walkthrough used.
export function derivativeGuidance(expression, variable) {
  const v = variable;
  let labels;
  try {
    labels = splitTerms(expression).map(({ signed }) => classifyDerivativeRule(signed, v).label);
  } catch {
    labels = [];
  }
  const used = (word) => labels.some((l) => l.includes(word));
  const tips = [];
  const mistakes = [];

  if (used('Power') || labels.length === 0) {
    tips.push(`Power rule: ${mark(`d/d${v}(${v}^n) = n·${v}^(n-1)`)} — bring the exponent down as a factor, then lower it by one.`);
    mistakes.push('Forgetting to lower the exponent by one after bringing it down as a factor.');
  }
  if (used('negative exponent')) {
    tips.push(`Rewrite reciprocals as powers before differentiating: ${mark(`1/${v}^n = ${v}^(-n)`)}, so the power rule applies.`);
    mistakes.push(`Lowering a negative exponent the wrong way: ${mark(`d/d${v}(${v}^-2) = -2${v}^-3`)}, not ${mark(`-2${v}^-1`)}.`);
  }
  if (used('Chain')) {
    tips.push(`Chain rule: ${mark(`d/d${v} f(g(${v})) = f′(g(${v}))·g′(${v})`)} — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.`);
    mistakes.push('Forgetting to multiply by the derivative of the inside function.');
  }
  if (used('Product')) {
    tips.push(`Product rule: ${mark('(u·w)′ = u′·w + u·w′')} — the derivative of a product is NOT the product of the derivatives.`);
    mistakes.push(`Differentiating each factor and multiplying the results — ${mark('(u·w)′')} is not ${mark('u′·w′')}.`);
  }
  if (used('Quotient')) {
    tips.push(`Quotient rule: ${mark('(u/w)′ = (u′·w − u·w′)/w²')} — "low d-high minus high d-low, over low squared".`);
    mistakes.push('Swapping the order in the numerator of the quotient rule; the subtraction makes the order matter.');
  }
  if (used('Exponential')) {
    tips.push(`${mark(`d/d${v} e^${v} = e^${v}`)} (the exponential is its own derivative), and ${mark(`d/d${v} a^${v} = a^${v}·ln(a)`)} for any other base.`);
    mistakes.push(`Treating ${mark(`e^${v}`)} like a power and writing ${mark(`${v}·e^(${v}-1)`)} — the power rule is for a variable BASE, not a variable exponent.`);
  }
  if (used('Logarithmic rule')) {
    tips.push(`${mark(`d/d${v} ln(${v}) = 1/${v}`)}, valid on the domain ${mark(`${v} > 0`)}; for log base ${mark('b')}, divide by ${mark('ln(b)')}.`);
    mistakes.push(`Writing ${mark(`d/d${v} ln(${v})`)} as ${mark(`1/ln(${v})`)} or as ${mark(`ln(${v})/${v}`)}.`);
  }
  if (used('Logarithmic differentiation')) {
    tips.push(`For ${mark(`${v}^${v}`)}-type terms, take ln of both sides first: ${mark(`ln(y) = ${v}·ln(${v})`)}, differentiate implicitly, then multiply back by ${mark('y')}.`);
    mistakes.push('Applying the power rule or the exponential rule to a term where BOTH the base and the exponent contain the variable.');
  }
  if (used('Trig')) {
    tips.push(`${mark(`d/d${v} sin(${v}) = cos(${v})`)}, ${mark(`d/d${v} cos(${v}) = −sin(${v})`)}, ${mark(`d/d${v} tan(${v}) = sec²(${v})`)} — the trig derivatives are worth memorising as a set.`);
    mistakes.push(`Losing the minus sign in ${mark(`d/d${v} cos(${v}) = −sin(${v})`)}.`);
  }
  if (used('Inverse trig')) {
    tips.push(`${mark(`d/d${v} arcsin(${v}) = 1/√(1 − ${v}^2)`)}, ${mark(`d/d${v} arccos(${v}) = −1/√(1 − ${v}^2)`)}, ${mark(`d/d${v} arctan(${v}) = 1/(1 + ${v}^2)`)} — arcsin and arccos differ only in sign.`);
    mistakes.push(`Reading ${mark(`arcsin(${v})`)} (also written ${mark(`sin^(-1)(${v})`)}) as ${mark(`1/sin(${v})`)}: it is the inverse function, not the reciprocal.`);
  }
  if (used('Error function')) {
    tips.push(`${mark(`erf(${v})`)} is defined by an integral, ${mark(`(2/√π)·∫_0^${v} e^(−t^2) dt`)}: its derivative is the integrand times ${mark('2/√π')}, by the Fundamental Theorem of Calculus.`);
    mistakes.push(`Looking for an elementary antiderivative of ${mark(`e^(−${v}^2)`)}: there is none, which is why ${mark('erf')} is defined as an integral.`);
  }
  if (used('Hyperbolic')) {
    tips.push(`${mark(`d/d${v} sinh(${v}) = cosh(${v})`)} and ${mark(`d/d${v} cosh(${v}) = sinh(${v})`)}, with no minus sign; ${mark(`d/d${v} tanh(${v}) = 1 − tanh^2(${v})`)}.`);
    mistakes.push(`Adding a minus sign to ${mark(`d/d${v} cosh(${v})`)} by analogy with ${mark(`cos(${v})`)}.`);
  }
  if (used('Trig') && /\b(?:sec|csc|cot)\b/i.test(expression)) {
    tips.push(`${mark(`d/d${v} sec(${v}) = sec(${v})·tan(${v})`)}, ${mark(`d/d${v} csc(${v}) = −csc(${v})·cot(${v})`)}, ${mark(`d/d${v} cot(${v}) = −csc²(${v})`)}: the co-functions carry the minus sign.`);
  }
  if (labels.some((l) => l === 'Constant rule') || labels.length > 1) {
    tips.push(`The derivative of a constant is ${mark('0')}, and constant factors carry straight through.`);
    mistakes.push(`Dropping a constant factor when differentiating terms like ${mark('3x')}, or keeping a lone constant instead of sending it to ${mark('0')}.`);
  }
  if (labels.length > 1) {
    mistakes.push('Sign slips when differentiating negative or subtracted terms.');
  }
  return { tips: tips.slice(0, 4), common_mistakes: mistakes.slice(0, 4) };
}
