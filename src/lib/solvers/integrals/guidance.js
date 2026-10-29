// Tips and mistakes for the integrals solver, and the notes for integrals
// with no elementary antiderivative (erf, Si, Fresnel).

import { mark } from '../solverUtils.js';

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

export function nonElementaryNote(expression) {
  const normalized = String(expression).replace(/\s+/g, '');
  for (const [pattern, note] of NON_ELEMENTARY_NOTES) {
    if (pattern.test(normalized)) return note;
  }
  return null;
}

// The first tip and mistake for a directly-integrated expression follow the
// rule(s) its terms actually used; "Power rule" used to be served with
// sec²(x) → tan(x) and ln|2x + 1| alike.
export function directTip(labels, v) {
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

export function directMistake(labels, v) {
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
