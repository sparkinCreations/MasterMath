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

// Key Insights and Common Mistakes for an indefinite integral, chosen by
// the method the steps used (one per method; tests/tipsByMethod.test.js
// fails when two lead with the same insight). Each list is ranked: the page
// shows the first three and the rest behind "Show more" (src/lib/guidance.js).
// The insight a method needs most comes first; "+C" and "check by
// differentiating", true of every method, close the list, and forgetting +C
// stays a visible mistake.

// Integration by parts' LIATE order, as published (Kasube 1983).
export const LIATE_SOURCE = {
  title: 'Herbert E. Kasube, "A Technique for Integration by Parts", The American Mathematical Monthly 90(3), 1983',
  url: 'https://doi.org/10.1080/00029890.1983.11971195',
};

const plusC = () => `Always add the constant of integration (${mark('+C')}) for an indefinite integral: any two antiderivatives of the same function differ by a constant.`;
const checkByDifferentiating = () => 'Check any antiderivative by differentiating it: the derivative must give back the integrand exactly.';
const forgotC = () => `Forgetting the constant of integration (${mark('+C')}).`;

// The method an indefinite integral used, from the flags the entry collects
// while integrating term by term. The order is the order of precedence when
// several terms used different methods.
export function indefiniteMethod(f) {
  if (f.usesErf) return 'erf';
  if (f.anyFormSub) return 'form substitution';
  if (f.anyReduction) return f.reductionOfTan ? 'tan reduction' : 'reduction';
  if (f.anyTrigPower) return 'trig power';
  if (f.anyByParts) return f.byPartsCyclic ? 'by parts, cyclic' : f.byPartsLog ? 'by parts, ln' : f.byPartsRepeated ? 'by parts, repeated' : 'by parts';
  if (f.anyTrigSub) return 'trig substitution';
  if (f.anyInverseTrig) return 'inverse trig';
  if (f.anyPartial) return f.divideFirst ? 'partial fractions, divide first' : f.singleQuadratic ? 'irreducible quadratic' : 'partial fractions';
  if (f.anySubstitution) return 'substitution';
  if (f.anyAbs) return 'absolute value';
  const l = f.directLabels;
  if (l.has('Power rule') || l.size === 0) return 'power';
  if (l.has('Trig rule')) return 'trig';
  if (l.has('Exponential rule')) return 'exponential';
  if (l.has('Reciprocal rule')) return 'reciprocal';
  if (l.has('Linear substitution')) return 'linear substitution';
  if (l.has('Half-angle identity')) return 'half-angle';
  if (l.has('u-substitution')) return 'linear inside';
  if (l.has('Trig quotient')) return 'trig quotient';
  if (l.has('Trigonometric substitution')) return 'trig substitution';
  if (l.has('Trigonometric identity')) return 'trig identity';
  if (l.has('Table antiderivative')) return f.tableExponential ? 'exponential base' : f.tableHyperbolic ? 'hyperbolic' : 'table';
  return 'table';
}

const byPartsTips = (v) => ({
  liate: { text: `Integration by parts: ${mark('∫u dv = uv − ∫v du')}. Pick ${mark('u')} by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential), a rule of thumb: the best ${mark('u')} is the one that makes ${mark('∫v du')} simpler.`, source: LIATE_SOURCE },
  choose: `${mark('u')} should get simpler when it is differentiated, and ${mark('dv')} must be something you can integrate; ${mark('du')} and ${mark('v')} then follow.`,
  repeated: `A power of ${mark(v)} times a trig function or an exponential needs one round per power: ${mark(`${v}²·sin(${v})`)} takes two, each lowering the power by one. A table of derivatives of ${mark('u')} and integrals of ${mark('dv')}, with alternating signs (tabular integration), keeps the rounds straight.`,
  cyclic: `When the original integral comes back (${mark(`∫e^${v}·sin(${v}) d${v}`)} after two rounds), move it to the left side and solve for it like an unknown.`,
  log: `${mark(`∫ln(${v}) d${v}`)} is by parts with ${mark(`u = ln(${v})`)} and ${mark(`dv = d${v}`)}: ${mark(`∫ln(${v}) d${v} = ${v}·ln(${v}) − ${v} + C`)}.`,
});

export function indefiniteGuidance(method, v) {
  switch (method) {
    case 'erf':
      return {
        tips: [
          `${mark(`∫e^(−${v}²) d${v} = (√π/2)·erf(${v}) + C`)}: the antiderivative is written with erf, the error function, ${mark(`erf(${v}) = (2/√π)·∫_0^${v} e^(−t²) dt`)}.`,
          `erf is a "special function": a named antiderivative, the way ln is the name for ${mark('∫1/x dx')}. It is not a trick or a shortcut — it is the honest answer, and tables and calculators have it.`,
          `Whole-line and half-line definite versions do have closed forms: ${mark('∫_{−∞}^∞ e^(−x²) dx = √π')}, and ${mark('∫₀^∞ e^(−x²) dx = √π/2')}.`,
          'The bell curve of statistics is this function in disguise: probabilities under the normal distribution are values of erf.',
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Trying ${mark('u = −x²')}: then ${mark('du = −2x dx')}, and there is no ${mark('x')} factor in the integrand to absorb it — the substitution does not close.`,
          `Reading ${mark('e^(−x²)')} as ${mark('(e^(−x))²')} — the square is on ${mark('x')}, not on ${mark('e^(−x)')}. ${mark('(e^(−x))² = e^(−2x)')}, which IS elementary.`,
          forgotC(),
        ],
      };
    case 'form substitution':
      return {
        tips: [
          `When the awkward piece is a function of ${mark(v)} — ${mark(`e^${v}`)}, ${mark(`√${v}`)} — substitute for that piece and change ${mark(`d${v}`)} with it: ${mark(`u = e^${v}`)} gives ${mark(`d${v} = du/u`)}; ${mark(`${v} = u²`)} gives ${mark(`d${v} = 2u du`)}. The new integral is rational, and partial fractions or a direct rule finish it.`,
          `After ${mark(`u = e^${v}`)}, every ${mark(`e^(k${v})`)} becomes ${mark('u^k')}, so an integrand built from exponentials becomes a rational function of ${mark('u')}.`,
          `Substitute back at the end: the answer is a function of ${mark(v)}, so ${mark('u')} is replaced by ${mark(`e^${v}`)} (or ${mark(`√${v}`)}).`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Substituting ${mark(`u = e^${v}`)} but leaving ${mark(`d${v}`)} alone — ${mark(`d${v} = du/u`)}, and that extra ${mark('1/u')} is what makes the new integrand rational.`,
          forgotC(),
          `Leaving the answer in ${mark('u')} instead of substituting back.`,
        ],
      };
    case 'reduction':
      return {
        tips: [
          `A reduction formula lowers a power by two: ${mark('∫sec^n(θ) dθ = sec^(n−2)(θ)·tan(θ)/(n − 1) + ((n − 2)/(n − 1))·∫sec^(n−2)(θ) dθ')}. It comes from integration by parts in which the original integral reappears and is solved for, as with ${mark('∫e^x·sin(x) dx')}.`,
          `Apply it until the power is ${mark('1')} or ${mark('0')}: the base cases are ${mark('∫sec(θ) dθ = ln|sec θ + tan θ|')} and ${mark('∫1 dθ = θ')}.`,
          `${mark('∫sec³(θ) dθ = (sec θ·tan θ + ln|sec θ + tan θ|)/2 + C')} comes up often (arc length of a parabola, trigonometric substitutions) and is worth knowing.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Trying ${mark('u = sec θ')} on ${mark('sec³θ')}: ${mark('du = sec θ tan θ dθ')} is not a factor of the integrand, so the substitution does not close — the reduction formula is the way.`,
          forgotC(),
          `Dropping the factor ${mark('(n − 2)/(n − 1)')} in front of the remaining integral.`,
        ],
      };
    case 'tan reduction':
      return {
        tips: [
          `Powers of ${mark('tan')} come down two at a time with ${mark('tan²θ = sec²θ − 1')}: ${mark('∫tan^m(θ) dθ = tan^(m−1)(θ)/(m − 1) − ∫tan^(m−2)(θ) dθ')}, down to ${mark('∫tan θ dθ = −ln|cos θ|')} or ${mark('∫1 dθ = θ')}.`,
          `The first part is a substitution: ${mark('u = tan θ')}, ${mark('du = sec²θ dθ')}, so ${mark('∫tan^(m−2)θ·sec²θ dθ = tan^(m−1)θ/(m − 1)')}.`,
          `${mark('cot')} works the same way with ${mark('cot²θ = csc²θ − 1')}, with a minus sign from ${mark('du = −csc²θ dθ')}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Integrating ${mark(`tan²(${v})`)} as ${mark(`tan³(${v})/3`)}: differentiating that puts a ${mark(`sec²(${v})`)} in the result.`,
          forgotC(),
          'Losing the minus sign: each round subtracts the next integral.',
        ],
      };
    case 'trig power':
      return {
        tips: [
          `Products of powers of ${mark('sin')} and ${mark('cos')}: with an odd power, keep one factor for ${mark('du')} and convert the rest with ${mark('sin²θ + cos²θ = 1')} (odd ${mark('cos')} → ${mark('u = sin θ')}; odd ${mark('sin')} → ${mark('u = cos θ')}). Both even: the half-angle identities. For ${mark('tan^m θ·sec^n θ')}: keep a factor ${mark('sec²θ')} for ${mark('u = tan θ')} (an even ${mark('sec')} power), or a factor ${mark('sec θ·tan θ')} for ${mark('u = sec θ')} (an odd ${mark('tan')} power with at least one ${mark('sec')}).`,
          `After the substitution the integral is a polynomial in ${mark('u')}, done by the power rule; substitute back at the end.`,
          `Both powers even: lower them with ${mark('sin²θ = (1 − cos 2θ)/2')} and ${mark('cos²θ = (1 + cos 2θ)/2')}, repeating until only first powers of cosines remain.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Splitting off the factor from the EVEN power: the leftover must be convertible with ${mark('sin²θ + cos²θ = 1')}, which needs an even power left behind.`,
          forgotC(),
          `Dropping the minus sign from ${mark('du = −sin θ dθ')} when ${mark('u = cos θ')}.`,
        ],
      };
    case 'by parts':
    case 'by parts, cyclic':
    case 'by parts, ln':
    case 'by parts, repeated': {
      const t = byPartsTips(v);
      const lead = method === 'by parts, cyclic' ? [t.cyclic, t.liate, t.choose]
        : method === 'by parts, ln' ? [t.log, t.liate, t.choose]
          : method === 'by parts, repeated' ? [t.repeated, t.liate, t.choose]
            : [t.liate, t.choose, t.repeated];
      const rest = [t.repeated, t.cyclic, t.log].filter((x) => !lead.includes(x));
      const choose = `Choosing ${mark('u')} and ${mark('dv')} the wrong way round — LIATE picks the ${mark('u')} that gets simpler when differentiated.`;
      const signs = `Sign slips in ${mark('uv − ∫v du')}, above all on a second round: the signs alternate.`;
      const swap = `Swapping ${mark('u')} and ${mark('dv')} on the second round: that undoes the first round and leads back to the start.`;
      // The mistake each variant invites most comes first.
      const first = method === 'by parts, cyclic'
        ? `Not recognising the original integral when it comes back: instead of a third round, call it ${mark('I')}, move it to the left side and solve for it.`
        : method === 'by parts, repeated'
          ? `Stopping after one round: the integral left over still has a power of ${mark(v)} in it, and needs parts again until that power is gone.`
          : null;
      return {
        tips: [...lead, ...rest, plusC(), checkByDifferentiating()],
        mistakes: first ? [first, forgotC(), method === 'by parts, cyclic' ? swap : signs, choose, method === 'by parts, cyclic' ? signs : swap] : [choose, forgotC(), signs, swap],
      };
    }
    case 'trig substitution':
      return {
        tips: [
          `Trigonometric substitution: ${mark(`√(a² − ${v}²)`)} calls for ${mark(`${v} = a·sin θ`)} (${mark(`√(a² + ${v}²)`)} for ${mark(`${v} = a·tan θ`)}, ${mark(`√(${v}² − a²)`)} for ${mark(`${v} = a·sec θ`)}); the root becomes ${mark('a·cos θ')} and the integral is one in ${mark('θ')}. Convert back with a right triangle.`,
          `Each choice rests on an identity that turns the radical into one term: ${mark('1 − sin²θ = cos²θ')}, ${mark('1 + tan²θ = sec²θ')}, ${mark('sec²θ − 1 = tan²θ')}.`,
          `To convert back, draw the triangle the substitution describes (${mark(`sin θ = ${v}/a`)}: opposite side ${mark(v)}, hypotenuse ${mark('a')}) and read the other ratios off it.`,
          `A quadratic with an ${mark(v)} term under the root is completed to a square first: ${mark(`${v}² + 2${v} + 5 = (${v} + 1)² + 4`)}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Forgetting to change ${mark(`d${v}`)} as well as the integrand (${mark('dx = a·cos θ dθ')}), or leaving the answer in ${mark('θ')} instead of converting back to ${mark(v)}.`,
          forgotC(),
          `Choosing the substitution for the wrong sign: ${mark(`√(${v}² − a²)`)} needs ${mark('sec')}, not ${mark('sin')}.`,
          `Ignoring the range of ${mark('θ')}: it is what makes ${mark('√(cos²θ) = cos θ')} rather than ${mark('|cos θ|')}.`,
        ],
      };
    case 'inverse trig':
      return {
        tips: [
          `Inverse-trig antiderivatives come from derivatives you know: ${mark(`d/d${v} arctan(${v}) = 1/(1 + ${v}²)`)} and ${mark(`d/d${v} arcsin(${v}) = 1/√(1 − ${v}²)`)}. A constant ${mark('a²')} in the pattern is factored out first.`,
          `With the constant in place, for ${mark('a > 0')}: ${mark(`∫1/(a² + ${v}²) d${v} = (1/a)·arctan(${v}/a) + C`)} and ${mark(`∫1/√(a² − ${v}²) d${v} = arcsin(${v}/a) + C`)}.`,
          `A quadratic with an ${mark(v)} term is completed to a square first: ${mark(`${v}² + 2${v} + 5 = (${v} + 1)² + 4`)}, then the pattern applies with ${mark(`${v} + 1`)} in place of ${mark(v)}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Reading ${mark(`1/(1 + ${v}²)`)} as a power of ${mark(v)} — it is not ${mark(`${v}^(−2)`)}, and the power rule does not apply.`,
          forgotC(),
          `Forgetting the ${mark('1/a')} in front of ${mark(`arctan(${v}/a)`)} (the arcsin form has none).`,
          `Using arcsin for ${mark(`√(a² + ${v}²)`)}: a plus sign under the root is a different pattern.`,
        ],
      };
    case 'partial fractions, divide first':
    case 'irreducible quadratic':
    case 'partial fractions': {
      const general = 'Partial fractions: factor the denominator, write the fraction as a sum of simpler ones (one per factor), find each constant (cover-up or comparing coefficients), then integrate each piece — a linear factor gives a logarithm, an irreducible quadratic a logarithm, an arctan or both (depending on its numerator), and a repeated factor one term per power: its first power a logarithm, the higher powers a power.';
      const forms = `Each factor sets the shape of its piece: ${mark('(x − a)')} takes ${mark('A/(x − a)')}; a repeated ${mark('(x − a)²')} takes ${mark('A/(x − a) + B/(x − a)²')}; an irreducible ${mark('x² + px + q')} takes ${mark('(Bx + C)/(x² + px + q)')}.`;
      const coverUp = `The cover-up method finds the constant of a non-repeated linear factor at once: cover ${mark('(x − a)')} in the fraction and evaluate what is left at ${mark('x = a')}.`;
      const lead = method === 'partial fractions, divide first'
        ? ['When the numerator\'s degree is not lower than the denominator\'s, divide first: the quotient integrates term by term, and only the remainder over the denominator needs partial fractions.', general, forms]
        : method === 'irreducible quadratic'
          ? [`A numerator over an irreducible quadratic splits in two: the part that is the denominator's derivative integrates to a logarithm, the constant part to an arctan (${mark('∫1/(x² + a²) dx = (1/a)·arctan(x/a)')}).`, `Complete the square when the quadratic has an ${mark('x')} term: ${mark('x² + 2x + 5 = (x + 1)² + 4')}, so the arctan part has ${mark('x + 1')} inside.`, general]
          : [general, forms, coverUp];
      const rest = [forms, coverUp].filter((x) => !lead.includes(x));
      const lead2 = method === 'partial fractions, divide first'
        ? 'Decomposing an improper fraction without dividing first: partial fractions need the numerator\'s degree below the denominator\'s.'
        : method === 'irreducible quadratic'
          ? `Integrating ${mark('1/(x² + 1)')} as a logarithm: ${mark('ln(x² + 1)')} differentiates to ${mark('2x/(x² + 1)')}, which has an ${mark('x')} on top. The constant part is an arctan.`
          : `Splitting ${mark('1/(a·b)')} into ${mark('1/a + 1/b')} — the decomposition needs constants found from the factors, not a guess.`;
      return {
        tips: [...lead, ...rest, plusC(), checkByDifferentiating()],
        mistakes: [
          lead2,
          forgotC(),
          `Giving an irreducible quadratic a constant numerator ${mark('A')} instead of ${mark('Bx + C')}.`,
          `Missing a power of a repeated factor: ${mark('(x − 1)²')} needs both ${mark('A/(x − 1)')} and ${mark('B/(x − 1)²')}.`,
        ],
      };
    }
    case 'substitution':
      return {
        tips: [
          `u-substitution: look for an inner function whose derivative appears as a factor — ${mark('∫g′(x)·h(g(x)) dx = ∫h(u) du')} with ${mark('u = g(x)')}.`,
          `Good choices for ${mark('u')}: the inside of a composite, a denominator, or the base of a power, whichever has its derivative elsewhere in the integrand (up to a constant factor).`,
          `After substituting, no ${mark(v)} may be left. If one is, that ${mark('u')} does not work, or the leftover ${mark(v)} has to be written in terms of ${mark('u')}.`,
          `In a definite integral, change the bounds to values of ${mark('u')} as well; then there is no need to substitute back.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Forgetting to account for ${mark('du = g′(x) dx')}: the inside's derivative must match a factor of the integrand, up to a constant multiple, and that constant is carried into the new integral.`,
          forgotC(),
          `Leaving the answer in ${mark('u')}: substitute ${mark('u = g(x)')} back at the end.`,
          'Keeping the old bounds after changing variables in a definite integral.',
        ],
      };
    case 'absolute value':
      return {
        tips: [
          `${mark('∫|ax + b| dx = (ax + b)·|ax + b| / (2a) + C')} — split at the corner, integrate each piece, and the two pieces match up into one formula.`,
          `${mark(`|${v}|`)} is ${mark(v)} for ${mark(`${v} ≥ 0`)} and ${mark(`−${v}`)} for ${mark(`${v} < 0`)}: integrate each piece and choose the constants so the pieces join without a jump.`,
          `${mark(`${v}·|${v}|/2`)} has derivative ${mark(`|${v}|`)} everywhere, including at the corner ${mark(`${v} = 0`)}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Integrating ${mark('|x|')} as if it were ${mark('x')}, giving ${mark('x²/2')} — that is only right for ${mark('x ≥ 0')}.`,
          forgotC(),
          'Joining the two pieces with unrelated constants: an antiderivative of a continuous function is continuous too.',
        ],
      };
    case 'power':
      return {
        tips: [
          `Power rule: ${mark(`∫${v}^n d${v} = ${v}^(n+1)/(n+1) + C`)}  (${mark('n ≠ -1')})`,
          `Rewrite roots and reciprocals as powers first: ${mark(`√${v} = ${v}^(1/2)`)}, ${mark(`1/${v}³ = ${v}^(−3)`)}; then the power rule applies.`,
          `A sum integrates term by term, and constant factors pull out front: ${mark('∫(a·f + b·g) dx = a·∫f dx + b·∫g dx')}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Dividing by ${mark('n')} instead of ${mark('n + 1')}: ${mark(`∫${v}³ d${v} = ${v}⁴/4`)}, not ${mark(`${v}⁴/3`)}.`,
          forgotC(),
          `Applying the power rule to ${mark('1/x')} — that integrates to ${mark('ln|x|')}, not ${mark('x⁰/0')}.`,
          `Integrating a product factor by factor: ${mark(`∫${v}·${v}² d${v}`)} is ${mark(`∫${v}³ d${v} = ${v}⁴/4`)}, not ${mark(`(${v}²/2)·(${v}³/3)`)}. Multiply out first.`,
        ],
      };
    case 'trig':
      return {
        tips: [
          `The trig antiderivatives are the trig derivatives read backwards: ${mark('∫cos = sin')}, ${mark('∫sin = −cos')}, ${mark('∫sec² = tan')}, ${mark('∫sec·tan = sec')}.`,
          `The signs come from the derivatives: ${mark('d/dx cos(x) = −sin(x)')}, so ${mark('∫sin(x) dx = −cos(x)')}; ${mark('d/dx cot(x) = −csc²(x)')}, so ${mark('∫csc²(x) dx = −cot(x)')}.`,
          `A linear inside brings out its reciprocal: ${mark(`∫sin(3${v}) d${v} = −cos(3${v})/3 + C`)}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Sign slips: ${mark(`∫sin(${v}) d${v} = −cos(${v})`)}, while ${mark(`∫cos(${v}) d${v} = +sin(${v})`)}.`,
          forgotC(),
          `Using this table for ${mark(`sin²(${v})`)} or ${mark(`tan(${v})`)}: neither is on it. ${mark(`sin²(${v})`)} needs a half-angle identity, and ${mark(`∫tan(${v}) d${v} = −ln|cos(${v})|`)}.`,
          'Working in degrees: these rules hold for an angle in radians.',
        ],
      };
    case 'exponential':
      return {
        tips: [
          `${mark(`∫e^${v} d${v} = e^${v}`)} — the exponential is its own antiderivative; ${mark(`∫a^${v} d${v} = a^${v}/ln(a)`)} for ${mark('a > 0')}, ${mark('a ≠ 1')}.`,
          `A linear exponent brings out its reciprocal: ${mark(`∫e^(k${v}) d${v} = e^(k${v})/k + C`)} for ${mark('k ≠ 0')}.`,
          `Another base becomes ${mark('e')}: ${mark(`a^${v} = e^(${v}·ln a)`)}, which is where the ${mark('1/ln(a)')} comes from.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Treating ${mark(`e^${v}`)} like a power and writing ${mark(`e^(${v}+1)/(${v}+1)`)}.`,
          forgotC(),
          `Forgetting the ${mark('1/k')}: ${mark(`∫e^(2${v}) d${v} = e^(2${v})/2`)}, not ${mark(`e^(2${v})`)}.`,
          `Using the ${mark('1/k')} shortcut on an exponent that is not linear: ${mark(`e^(${v}²)/(2${v})`)} does not differentiate back to ${mark(`e^(${v}²)`)}, which has no elementary antiderivative.`,
        ],
      };
    case 'exponential base':
      return {
        tips: [
          `${mark(`∫a^${v} d${v} = a^${v}/ln(a) + C`)} for ${mark('a > 0')}, ${mark('a ≠ 1')}: write ${mark(`a^${v} = e^(${v}·ln a)`)} and use the exponential rule with ${mark('k = ln a')}.`,
          `Differentiating checks it: ${mark(`d/d${v} a^${v} = a^${v}·ln(a)`)}, and dividing by ${mark('ln(a)')} undoes that factor.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Using the power rule on ${mark(`a^${v}`)}: the variable is in the exponent, so ${mark(`∫2^${v} d${v}`)} is not ${mark(`2^(${v}+1)/(${v}+1)`)}.`,
          forgotC(),
          `Dropping the ${mark('ln(a)')}: ${mark(`∫2^${v} d${v} = 2^${v}/ln(2)`)}, not ${mark(`2^${v}`)}.`,
        ],
      };
    case 'reciprocal':
      return {
        tips: [
          `${mark(`∫1/${v} d${v} = ln|${v}| + C`)} — the one power the power rule cannot do (${mark('n = −1')} would divide by ${mark('0')}).`,
          `The absolute value keeps the answer right for negative ${mark(v)} too: ${mark(`d/d${v} ln|${v}| = 1/${v}`)} for every ${mark(`${v} ≠ 0`)}.`,
          `The same pattern in general: ${mark('∫f′(x)/f(x) dx = ln|f(x)| + C')}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Writing ${mark(`∫1/${v} d${v}`)} as ${mark(`${v}⁰/0`)} — use ${mark(`ln|${v}|`)} instead, with the absolute value.`,
          forgotC(),
          `Dropping the absolute value: ${mark(`ln(${v})`)} only covers ${mark(`${v} > 0`)}.`,
          `Integrating ${mark(`1/${v}`)} across ${mark(`${v} = 0`)} in a definite integral: it is undefined there, so ${mark('∫_{−1}^{1} 1/x dx')} is improper.`,
        ],
      };
    case 'linear substitution':
      return {
        tips: [
          `For ${mark(`1/(a${v} + b)`)}, let ${mark(`u = a${v} + b`)}: the ${mark('1/a')} from ${mark(`du = a d${v}`)} is the only extra factor.`,
          `The result is a logarithm with an absolute value: ${mark(`∫1/(a${v} + b) d${v} = (1/a)·ln|a${v} + b| + C`)}.`,
          `The same ${mark('1/a')} appears for any function of a linear inside: ${mark(`∫f(a${v} + b) d${v} = (1/a)·F(a${v} + b) + C`)}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Forgetting the ${mark('1/a')} factor that comes from ${mark('du = a dx')}.`,
          forgotC(),
          `Using the ${mark('1/a')} shortcut when the inside is not linear: ${mark(`∫1/(${v}² + 1) d${v}`)} is ${mark(`arctan(${v})`)}, not a logarithm.`,
        ],
      };
    case 'half-angle':
      return {
        tips: [
          `${mark(`sin²(${v})`)} and ${mark(`cos²(${v})`)} integrate through the half-angle identities: ${mark(`sin²(${v}) = (1 − cos(2${v}))/2`)}, ${mark(`cos²(${v}) = (1 + cos(2${v}))/2`)} — a sum of a constant and a cosine, each easy.`,
          `The identities come from the double-angle formula ${mark(`cos(2${v}) = 1 − 2sin²(${v}) = 2cos²(${v}) − 1`)}.`,
          `${mark(`∫sin²(${v}) d${v} = ${v}/2 − sin(2${v})/4 + C`)} and ${mark(`∫cos²(${v}) d${v} = ${v}/2 + sin(2${v})/4 + C`)}; over a whole period each averages ${mark('1/2')}.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Applying the power rule to ${mark(`sin²(${v})`)}: ${mark(`sin³(${v})/3`)} is not its antiderivative — differentiating that leaves a ${mark(`cos(${v})`)} behind.`,
          forgotC(),
          `Forgetting the ${mark('1/2')} from the inside when integrating ${mark(`cos(2${v})`)}: ${mark(`∫cos(2${v}) d${v} = sin(2${v})/2`)}.`,
        ],
      };
    case 'linear inside':
      return {
        tips: [
          `A linear inside, ${mark(`cos(a${v} + b)`)}: let ${mark(`u = a${v} + b`)}, so ${mark(`du = a d${v}`)} and a factor ${mark('1/a')} comes out.`,
          `In general ${mark(`∫f(a${v} + b) d${v} = (1/a)·F(a${v} + b) + C`)}, where ${mark('F')} is an antiderivative of ${mark('f')}.`,
          `Differentiating checks the factor: the chain rule multiplies by ${mark('a')}, and the ${mark('1/a')} cancels it.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Forgetting the ${mark('1/a')}: ${mark(`∫cos(2${v}) d${v}`)} is ${mark(`(1/2)·sin(2${v})`)}, not ${mark(`sin(2${v})`)}.`,
          forgotC(),
          `Multiplying by ${mark('a')} instead of dividing: that is the chain rule for derivatives, read the wrong way round.`,
        ],
      };
    case 'trig quotient':
      return {
        tips: [
          `The table entries ${mark('∫tan = −ln|cos|')}, ${mark('∫cot = ln|sin|')}, ${mark('∫sec = ln|sec + tan|')}, ${mark('∫csc = ln|csc − cot|')} all come from one idea: write the integrand as (derivative of a function)/(that function), and ${mark('∫u′/u = ln|u|')}.`,
          `${mark('−ln|cos(x)|')} and ${mark('ln|sec(x)|')} are the same function, so either form of ${mark('∫tan(x) dx')} is right.`,
          `${mark('∫sec(x) dx')} comes from multiplying by ${mark('(sec x + tan x)/(sec x + tan x)')}: the numerator becomes the derivative of the denominator.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Writing ${mark(`∫tan(${v}) d${v}`)} as ${mark(`sec²(${v})`)} — that is the derivative of tan, read the wrong way round — or dropping the minus sign from ${mark(`du = −sin(${v}) d${v}`)}.`,
          forgotC(),
          `Dropping the absolute value inside the logarithm: ${mark(`cos(${v})`)} is negative on part of every period.`,
        ],
      };
    case 'trig identity':
      return {
        tips: [
          `Even powers of ${mark('sin')} and ${mark('cos')} are lowered with the half-angle identities (${mark('sin²θ = (1 − cos 2θ)/2')}, ${mark('cos²θ = (1 + cos 2θ)/2')}); a product ${mark('sin θ cos θ')} is ${mark('(sin 2θ)/2')}. Repeat until only first powers of cosines remain.`,
          `So ${mark('sin²θ·cos²θ = sin²(2θ)/4')}, and one more half-angle step finishes it.`,
          `With an odd power, none of this is needed: keep one factor for ${mark('du')} and substitute instead.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Applying the power rule to ${mark(`sin²(${v})`)} or ${mark(`cos²(${v})`)}: ${mark(`sin³(${v})/3`)} is not an antiderivative of ${mark(`sin²(${v})`)} — differentiating it leaves a ${mark(`cos(${v})`)} behind.`,
          forgotC(),
          `Stopping too early: a remaining ${mark('cos²(2θ)')} still needs the identity before it can be integrated.`,
        ],
      };
    case 'hyperbolic':
      return {
        tips: [
          `The hyperbolic antiderivatives mirror the trig ones without the sign change: ${mark(`∫sinh(${v}) d${v} = cosh(${v})`)}, ${mark(`∫cosh(${v}) d${v} = sinh(${v})`)}.`,
          `They follow from the definitions ${mark(`sinh(${v}) = (e^${v} − e^(−${v}))/2`)} and ${mark(`cosh(${v}) = (e^${v} + e^(−${v}))/2`)}, integrated term by term.`,
          plusC(),
          checkByDifferentiating(),
        ],
        mistakes: [
          `Carrying the trig minus sign over: ${mark(`∫sinh(${v}) d${v} = +cosh(${v})`)}, not ${mark(`−cosh(${v})`)}.`,
          forgotC(),
        ],
      };
    default:
      return {
        tips: [
          'This antiderivative is a standard table entry. Every antiderivative can be checked by differentiating it — the derivative must give back the integrand exactly.',
          plusC(),
        ],
        mistakes: [
          forgotC(),
          'Skipping the check: differentiate the result and compare it with the integrand.',
        ],
      };
  }
}
