// Tips and mistakes for the limits solver, chosen by the technique that
// produced the answer, ranked, with a worked "Here: …" line second: the first
// insight applied to this limit (1.63.0, after integrals, derivatives and
// algebra). The first three of each list show; the rest sit behind "Show more".

import { mark, stripMathMarkers, beautify, absBars } from '../solverUtils.js';

// The technique, read off the verification method and the steps.
function methodOf(result, side, infinite) {
  const vm = String(result.verificationMethod || '');
  const text = stripMathMarkers((result.steps || []).join('\n'));
  if (/^logarithms \(0⁰\)/.test(vm)) return '0^0';
  if (/^logarithms/.test(vm)) return '1^∞';
  if (/two sequences/.test(vm)) return 'oscillation';
  if (/standard limit/.test(vm)) return /1 − cos/.test(text) ? 'standard limit: cosine' : 'standard limit';
  if (/factor and cancel/.test(vm)) return 'factor and cancel';
  if (/conjugate at infinity/.test(vm)) return 'conjugate at infinity';
  if (/leading terms of a root/.test(vm)) return 'root at infinity';
  if (/conjugate/.test(vm)) return 'conjugate';
  if (/squeeze/.test(vm)) return 'squeeze';
  if (/growth rates/.test(vm)) {
    if (/form 0·∞/.test(text)) return 'growth: 0·∞';
    return /outgrows every power of ln/.test(text) ? 'growth: logarithm' : 'growth: exponential';
  }
  if (/no indeterminate form/.test(vm)) return result.domainEdge ? 'domain edge' : 'no contest';
  if (/leading terms/.test(vm)) return /a polynomial behaves like its highest-power term/.test(text) ? 'polynomial at infinity' : 'leading terms';
  if (side !== 0) return 'one-sided';
  if (vm === 'direct substitution' || /the function is defined and equals/.test(text)) return result.domainEdge ? 'domain edge: defined' : 'direct substitution';
  if (/Taylor series/.test(text)) return 'series';
  if (/L'Hôpital's rule \(differentiate/.test(text)) return "L'Hôpital";
  if (/Simplify the expression/.test(text)) return 'simplify';
  if (/gives 0\^0/.test(text)) return '0^0';
  if (result.domainEdge) return 'domain edge';
  if (result.outOfDomain) return 'outside the domain';
  if (/oscillates|swing between positive and negative/.test(text)) return 'oscillation';
  if (/opposite infinities/.test(text)) return 'opposite infinities';
  if (/Both sides grow without bound in the same direction/.test(text)) return 'infinite limit';
  if (/one-sided limits disagree/.test(text)) return 'jump';
  if (infinite) return 'sampled at infinity';
  if (/Both sides approach/.test(text)) return 'numeric estimate';
  return 'general';
}

// Ranked lists per technique: tips[0] is the method's own insight (no two
// methods share it; tests/tipsByMethod.test.js), the worked line goes
// second, the rest follow in order of how much they help.
const LISTS = {
  'direct substitution': {
    tips: [
      'Where a function is continuous, the limit is its value: start by substituting the value directly.',
      'Polynomials, and sin, cos, eˣ and roots on their domains, are continuous, so substitution works for them.',
      `When substitution gives a finite value by continuity, no other technique is needed; a ${mark('0/0')} form or a division by ${mark('0')} needs more analysis.`,
      'A sum, product or quotient of continuous functions is continuous (a quotient wherever its denominator is not zero), and so is a composition of them.',
      'A limit describes the values near the point, not at it: for a continuous function the two agree, which is what continuity means.',
    ],
    mistakes: [
      'Reaching for a technique when direct substitution already gives a number.',
      'Substituting into a function that is not defined at the point and reporting that value.',
      'Assuming the limit equals the function value at a jump or a hole.',
      `Treating ${mark('0/0')} as ${mark('0')} or ${mark('1')}: it is a signal to simplify, not a value.`,
    ],
  },
  'domain edge: defined': {
    tips: [
      `At an end of the domain (${mark('√x')} at ${mark('0')}), the function lives on one side only, so the limit is taken from that side.`,
      'The answer is written as the one-sided limit. Courses differ on the plain two-sided notation: some accept it (a limit taken over the domain), others require the function on both sides and call it nonexistent.',
      'Where a function is continuous from the side it lives on, that one-sided limit is its value at the point.',
    ],
    mistakes: [
      `Sampling the side where the function is not defined: ${mark('√(−0.001)')} is not a real number.`,
      `Writing ${mark('lim (x→0)')} where your course expects ${mark('lim (x→0⁺)')} for a function defined on one side only.`,
      'Assuming a function defined at a point is defined on both sides of it.',
    ],
  },
  'domain edge': {
    tips: [
      `When a function is defined on one side of the point only (${mark('ln(x)')} near ${mark('0')}), the limit can only be approached from that side.`,
      'The answer is written as the one-sided limit. Courses differ on the plain two-sided notation: some accept it (a limit taken over the domain), others require the function on both sides and call it nonexistent.',
      `${mark('ln(x)')} is defined only for ${mark('x > 0')} and ${mark('√x')} only for ${mark('x ≥ 0')}: check the domain before sampling a side.`,
    ],
    mistakes: [
      'Calling the one-sided limits "different" when one side does not exist at all.',
      `Reading a slow trend as a value: ${mark('ln(10^(−8)) ≈ −18.4')}, but ${mark('ln(x) → −∞')} as ${mark('x → 0⁺')}.`,
      `Writing ${mark('lim (x→0)')} where your course expects ${mark('lim (x→0⁺)')} for a function defined on one side only.`,
    ],
  },
  'factor and cancel': {
    tips: [
      `For a quotient of polynomials that gives ${mark('0/0')} at ${mark('x = a')}, both have the factor ${mark('(x − a)')}: factor them, cancel it (allowed, since ${mark('x ≠ a')} near the point), then substitute.`,
      'The cancelled form equals the original everywhere except at the point itself — that is exactly what a limit needs.',
      'On the graph, a cancelled factor is a hole (removable discontinuity), not an asymptote.',
      `By the Factor Theorem, if a polynomial is ${mark('0')} at ${mark('x = a')}, then ${mark('(x − a)')} is one of its factors: that is the factor to look for.`,
      `If ${mark('0/0')} remains after one cancellation, the factor is repeated: factor and cancel again.`,
    ],
    mistakes: [
      `Substituting the value before cancelling and stopping at ${mark('0/0')}.`,
      'Claiming the function "equals" the simplified form at the point — it is undefined there.',
      'Cancelling terms instead of factors.',
      `Writing the limit as "undefined" because the function is undefined at the point: the limit can still exist.`,
    ],
  },
  'standard limit': {
    tips: [
      `The standard limits ${mark('sin(u)/u → 1')} and ${mark('(1 − cos u)/u² → 1/2')} (as ${mark('u → 0')}) are the building blocks: rewrite so the argument of the trig function matches the denominator.`,
      `A constant factor comes out: ${mark('sin(5x)/(2x) = (5/2)·sin(5x)/(5x) → 5/2')}.`,
      `${mark('tan(u)/u → 1')} too, because ${mark('tan(u)/u = (sin(u)/u)·(1/cos(u))')}, and ${mark('cos(u) → 1')}.`,
      `These limits are the reason ${mark('d/dx sin(x) = cos(x)')} — they sit under every trig derivative.`,
      `The angle must be in radians: in degrees, ${mark('sin(u°)/u → π/180')}, not ${mark('1')}.`,
    ],
    mistakes: [
      `Forgetting the constant factor when the argument is scaled (${mark('sin(3x)/x → 3')}, not ${mark('1')}).`,
      `Substituting ${mark('x = 0')} and stopping at ${mark('0/0')} — the form is indeterminate, not an answer.`,
      'Applying the standard limit when the argument does not match the denominator.',
      `Using ${mark('sin(u)/u → 1')} away from ${mark('u → 0')}: as ${mark('u → ∞')}, ${mark('sin(u)/u → 0')}.`,
    ],
  },
  'standard limit: cosine': {
    tips: [
      `${mark('(1 − cos u)/u² → 1/2')} as ${mark('u → 0')}: it comes from ${mark('sin(u)/u → 1')} through ${mark('1 − cos u = 2sin²(u/2)')}.`,
      `Over ${mark('u')} instead of ${mark('u²')}, ${mark('(1 − cos u)/u → 0')}: the top shrinks like ${mark('u²/2')}, faster than the bottom.`,
      `The same answer comes from the series ${mark('cos u = 1 − u²/2 + …')}: ${mark('1 − cos u ≈ u²/2')} near ${mark('0')}.`,
      `Multiplying by ${mark('1 + cos u')} works too: ${mark('(1 − cos u)(1 + cos u) = sin²u')}.`,
    ],
    mistakes: [
      `Squaring the scale factor wrongly: ${mark('(1 − cos(2x))/x² → 2')}, not ${mark('1/2')} or ${mark('1')}.`,
      `Substituting ${mark('x = 0')} and stopping at ${mark('0/0')} — the form is indeterminate, not an answer.`,
      `Mixing up the two forms: over ${mark('u²')} the limit is ${mark('1/2')}, over ${mark('u')} it is ${mark('0')}.`,
    ],
  },
  conjugate: {
    tips: [
      `A difference with a root, ${mark('√a − b')}, is rationalised by its conjugate: multiply top and bottom by ${mark('√a + b')}, using ${mark('(√a − b)(√a + b) = a − b^2')}.`,
      `The product clears the root and usually exposes the factor that made ${mark('0/0')}; cancel it, then substitute.`,
      'Leave the other side of the fraction factored: expanding it only hides the factor you are about to cancel.',
    ],
    mistakes: [
      'Multiplying only the numerator by the conjugate, which changes the value.',
      `Expanding ${mark('(√a − b)(√a + b)')} as ${mark('a − b')} instead of ${mark('a − b^2')}.`,
      `Substituting before cancelling, and getting ${mark('0/0')} again.`,
    ],
  },
  'conjugate at infinity': {
    tips: [
      `${mark('∞ − ∞')} is indeterminate: a root and a linear term that grow at the same rate can differ by any amount. The conjugate turns the difference into a quotient.`,
      `After the conjugate, divide the top and the bottom by ${mark('x')}; inside the root that is ${mark('√(x² + bx)/x = √(1 + b/x)')} for ${mark('x > 0')}, which ${mark('→ 1')}.`,
      `As ${mark('x → −∞')}, ${mark('√(x²) = |x| = −x')}: the sign changes when ${mark('x')} is taken inside the root.`,
      `When the leading growth does not cancel, there is no ${mark('∞ − ∞')} to resolve and the difference diverges: as ${mark('x → ∞')}, ${mark('√(4x²) − x = 2x − x = x → ∞')}.`,
    ],
    mistakes: [
      `Saying ${mark('∞ − ∞ = 0')}: two quantities that both grow can differ by any amount.`,
      `Writing ${mark('√(x² + bx) ≈ x')} and concluding the limit is ${mark('0')}: the ${mark('bx')} inside shifts the difference by ${mark('b/2')}.`,
      `Forgetting that ${mark('√(x²) = −x')} for negative ${mark('x')}, which flips the sign of the answer at ${mark('−∞')}.`,
    ],
  },
  'root at infinity': {
    tips: [
      `A root behaves like its leading term at ${mark('±∞')}: ${mark('√(ax² + bx + c) ≈ √a·|x|')}. When that does not cancel the other term, the difference diverges.`,
      `As ${mark('x → ∞')}, ${mark('√(4x²) − x = 2x − x = x → ∞')}; only when the leading terms cancel (${mark('√(x² + x) − x')}) is there an ${mark('∞ − ∞')} that needs the conjugate.`,
      `At ${mark('−∞')}, ${mark('√(x²) = |x| = −x')}, which can turn a cancellation into a sum or the reverse.`,
    ],
    mistakes: [
      `Multiplying by the conjugate when nothing cancels: it works, but the leading terms already answer it.`,
      `Writing ${mark('√(4x²) = 4x')}: the root of ${mark('4')} is ${mark('2')}.`,
      `Forgetting that ${mark('√(x²) = −x')} for negative ${mark('x')}.`,
    ],
  },
  squeeze: {
    tips: [
      `The squeeze theorem: if ${mark('g ≤ f ≤ h')} near the point and ${mark('g')} and ${mark('h')} have the same limit ${mark('L')}, so does ${mark('f')}.`,
      `A bounded factor times something going to ${mark('0')} goes to ${mark('0')}, whatever the bounded factor does: ${mark('|g·h| ≤ M·|h|')} when ${mark('|g| ≤ M')}.`,
      `The bounds come from facts like ${mark('−1 ≤ sin(u) ≤ 1')}, which hold for every ${mark('u')}.`,
    ],
    mistakes: [
      `Concluding ${mark('sin(1/x)')} itself has a limit at ${mark('0')}: it oscillates; only its product with ${mark('x')} is squeezed.`,
      'Using bounds that have different limits, which squeeze nothing.',
      'Forgetting that the bounds must hold on both sides of the point.',
      `Using the product rule for limits, ${mark('lim x · lim sin(1/x)')}: it needs both limits to exist, and the second does not.`,
    ],
  },
  '1^∞': {
    tips: [
      `${mark('1^∞')} is indeterminate: a base just above ${mark('1')} raised to a huge power can go anywhere. Take logarithms to bring the exponent down: ${mark('ln(B^E) = E·ln(B)')}.`,
      `${mark('ln(1 + u) ≈ u')} for small ${mark('u')} (the standard limit ${mark('ln(1 + u)/u → 1')}), so ${mark('lim B^E = e^(lim E·(B − 1))')}.`,
      `The family to know: ${mark('(1 + a/x)^(bx) → e^(ab)')} as ${mark('x → ∞')}, and ${mark('(1 + ax)^(b/x) → e^(ab)')} as ${mark('x → 0')}.`,
      `${mark('e')} itself is defined this way: ${mark('(1 + 1/n)^n → e')}, the limit of compound interest compounded ever more often.`,
    ],
    mistakes: [
      `Saying ${mark('1^∞ = 1')}: the base is only approaching ${mark('1')}, and the exponent magnifies the difference.`,
      `Forgetting to undo the logarithm at the end: ${mark('ln L = 2')} means ${mark('L = e²')}, not ${mark('2')}.`,
      `Dropping the constant in the exponent: ${mark('(1 + 1/x)^(2x) → e²')}, not ${mark('e')}.`,
    ],
  },
  series: {
    tips: [
      `Near ${mark('0')}, replace each function by the start of its series: ${mark('e^x = 1 + x + x^2/2 + …')}, ${mark('sin x = x − x^3/6 + …')}, ${mark('cos x = 1 − x^2/2 + …')}.`,
      'Keep terms up to the lowest power that survives in the denominator; after cancelling it, the constant left is the limit.',
      `A ${mark('0/0')} form that L'Hôpital's rule needs several rounds for is often one line with series.`,
      `${mark('ln(1 + x) = x − x^2/2 + …')} and ${mark('tan x = x + x^3/3 + …')} complete the set most limits need.`,
    ],
    mistakes: [
      'Stopping the series too early, so everything cancels and the true leading term is lost.',
      `Expanding about the wrong point: the series must be about the value ${mark('x')} approaches.`,
      'Dropping a sign in an alternating series such as the one for sin.',
    ],
  },
  "L'Hôpital": {
    tips: [
      `L'Hôpital's rule applies only to ${mark('0/0')} or ${mark('∞/∞')}: then ${mark('lim f/g = lim f′/g′')}.`,
      'Differentiate the top and the bottom separately, then substitute again; repeat while the form stays indeterminate.',
      'Check the form before every round: once substitution gives a number, stop.',
      `It also needs ${mark('g′ ≠ 0')} near the point, and the new limit to exist (or be infinite); when it fails, the original limit can still exist.`,
      `Another form (${mark('0·∞')}, ${mark('∞ − ∞')}, ${mark('1^∞')}) must be rewritten as a quotient first.`,
    ],
    mistakes: [
      `Using the quotient rule on ${mark('f/g')}: the rule differentiates the numerator and the denominator separately.`,
      `Applying it when the form is not ${mark('0/0')} or ${mark('∞/∞')}, which gives a wrong answer.`,
      'Going round once too many and differentiating a form that was already a number.',
    ],
  },
  'growth: exponential': {
    tips: [
      `An exponential outgrows every power: ${mark('x^n/e^(kx) → 0')} as ${mark('x → ∞')} for every ${mark('n')} and every ${mark('k > 0')}, and ${mark('x^n/b^x → 0')} for every base ${mark('b > 1')}.`,
      `Each round of L'Hôpital's rule lowers the power of ${mark('x')} by one and leaves ${mark('e^(kx)')} a multiple of itself, so ${mark('n')} rounds finish the job.`,
      `Turned over, ${mark('e^(kx)/x^n → ∞')}: the same fact read the other way.`,
      `A product such as ${mark('x^2·e^(−x)')} is the same contest: write it as ${mark('x^2/e^x')} first.`,
    ],
    mistakes: [
      `Plugging in ${mark('x = 100')}, seeing a huge or tiny number, and stopping: a few values suggest the answer but do not prove it.`,
      `Thinking a high power such as ${mark('x^10')} can beat ${mark('e^x')}: it leads for a while, but ${mark('e^x')} always wins.`,
      `Calling ${mark('∞/∞')} equal to ${mark('1')}.`,
    ],
  },
  'growth: logarithm': {
    tips: [
      `Every power of ${mark('x')} outgrows every power of ${mark('ln x')}: ${mark('(ln x)^m/x^p → 0')} as ${mark('x → ∞')} for every ${mark('p > 0')}.`,
      `Each round of L'Hôpital's rule lowers the power of ${mark('ln x')} by one: the ${mark('1/x')} from ${mark('d/dx ln x')} cancels the power of ${mark('x')} lost below.`,
      `The growth ladder, slowest to fastest: ${mark('ln x')}, then powers ${mark('x^p')}, then exponentials ${mark('e^(kx)')}.`,
      `${mark('ln x')} does grow without bound, just slowly: ${mark('ln(10^6) ≈ 13.8')}.`,
    ],
    mistakes: [
      `Thinking ${mark('ln x')} levels off: it grows forever, only more and more slowly.`,
      `Plugging in a few large values and stopping: ${mark('(ln x)^3/x')} is still above ${mark('0.03')} at ${mark('x = 10^4')}, yet the limit is ${mark('0')}.`,
      `Calling ${mark('∞/∞')} equal to ${mark('1')}.`,
    ],
  },
  'growth: 0·∞': {
    tips: [
      `${mark('0·∞')} is indeterminate: rewrite the product as a quotient (${mark('x·ln x = ln x/(1/x)')}) so L'Hôpital's rule applies.`,
      `Near ${mark('0')}, any positive power of ${mark('x')} shrinks faster than any power of ${mark('ln x')} grows in size: ${mark('x^p·(ln x)^m → 0')} as ${mark('x → 0⁺')}.`,
      `Put the logarithm on top: differentiating ${mark('1/ln x')} would make the quotient harder, not easier.`,
      `${mark('x^x = e^(x·ln x) → e^0 = 1')} as ${mark('x → 0⁺')} uses this same limit.`,
    ],
    mistakes: [
      `Saying ${mark('0·∞ = 0')}: a factor going to ${mark('0')} can be beaten by one growing fast enough.`,
      `Rewriting as ${mark('x/(1/ln x)')}: it is ${mark('0/0')}, but each round makes it more complicated.`,
      `Taking ${mark('x → 0⁻')} as well: ${mark('ln x')} is not defined for ${mark('x < 0')}.`,
    ],
  },
  'no contest': {
    tips: [
      `When every part pulls the same way (${mark('e^(−x) = 1/e^x')}), there is no indeterminate form: the limit is read off directly.`,
      `Indeterminate forms are the ones where parts pull against each other: ${mark('0/0')}, ${mark('∞/∞')}, ${mark('0·∞')}, ${mark('∞ − ∞')}, ${mark('1^∞')}, ${mark('0^0')}, ${mark('∞^0')}.`,
      `A constant over something that grows without bound ${mark('→ 0')}; a product of things that all grow ${mark('→ ∞')}.`,
    ],
    mistakes: [
      `Reaching for L'Hôpital's rule when the form is not ${mark('0/0')} or ${mark('∞/∞')}.`,
      `Treating ${mark('1/∞')} as indeterminate: it is ${mark('0')}.`,
      `Losing the sign: ${mark('−2e^x → −∞')}, not ${mark('∞')}.`,
    ],
  },
  'leading terms': {
    tips: [
      'For a limit at infinity, the highest power dominates: divide numerator and denominator by it.',
      `Equal degrees → the ratio of leading coefficients; lower degree on top → ${mark('0')}; higher on top → ${mark('±∞')}.`,
      'Exponentials outgrow every polynomial, and polynomials outgrow every logarithm.',
      'The same degrees decide the horizontal asymptote of the graph: the limit at infinity is its height.',
    ],
    mistakes: [
      'Plugging in a large number and rounding — that suggests the value but does not prove it.',
      `Forgetting the sign when the leading term is odd and ${mark('x → −∞')}.`,
      `Treating ${mark('∞/∞')} as ${mark('1')}.`,
      'Comparing the first terms as typed instead of the highest powers.',
    ],
  },
  'polynomial at infinity': {
    tips: [
      `A polynomial at ${mark('±∞')} behaves like its highest-power term: ${mark('x^3 − 2x')} like ${mark('x^3')}.`,
      `The sign of the answer comes from the leading coefficient and, at ${mark('−∞')}, whether the power is odd or even.`,
      `Factoring out the highest power shows why: ${mark('x^3 − 2x = x^3(1 − 2/x^2)')}, and the bracket ${mark('→ 1')}.`,
    ],
    mistakes: [
      `Saying ${mark('∞ − ∞ = 0')} for ${mark('x^3 − 2x')}: the higher power wins.`,
      `Forgetting that an odd power of a negative number is negative: ${mark('x^3 → −∞')} as ${mark('x → −∞')}.`,
      'Letting a large coefficient on a lower power decide the answer: the highest power always wins eventually.',
    ],
  },
  'one-sided': {
    tips: [
      'A one-sided limit only follows the function along one side of the point — the other side is ignored entirely.',
      'The two-sided limit exists exactly when the left- and right-hand limits agree.',
      'One-sided limits are the right tool at domain boundaries, jump discontinuities, and vertical asymptotes.',
    ],
    mistakes: [
      `Mixing up the notation: ${mark('x → a⁺')} approaches from the right (values above ${mark('a')}), ${mark('x → a⁻')} from the left.`,
      'Reporting a two-sided limit when only one side was asked for (or exists).',
      'Assuming a one-sided limit exists where the function is not even defined on that side.',
    ],
  },
  simplify: {
    tips: [
      `When substitution gives ${mark('0/0')}, simplify the expression algebraically, then substitute into the simplified form.`,
      'The simplified form agrees with the original away from the point, which is all a limit looks at.',
      'Common moves: factor and cancel, combine fractions over a common denominator, multiply by a conjugate.',
    ],
    mistakes: [
      `Substituting before simplifying and stopping at ${mark('0/0')}.`,
      'Cancelling terms instead of factors.',
      'Claiming the original equals the simplified form at the point itself.',
    ],
  },
  '0^0': {
    tips: [
      `${mark('0^0')} is indeterminate in a limit: take logarithms, find the limit of ${mark('ln f')}, then raise ${mark('e')} to it.`,
      `${mark('0^0')} and ${mark('∞^0')} are handled like ${mark('1^∞')}: bring the exponent down with ${mark('ln(B^E) = E·ln B')}.`,
      `Some calculators and programs define ${mark('0^0 = 1')}; that is a convention for the value, not a limit.`,
    ],
    mistakes: [
      `Substituting and writing ${mark('0^0 = 1')} as if it were a value.`,
      'Forgetting to undo the logarithm at the end.',
      `Sampling ${mark('x < 0')}: ${mark('x^x')} is not a real number there for most ${mark('x')}.`,
    ],
  },
  oscillation: {
    tips: [
      `A function that keeps swinging, such as ${mark('sin(1/x)')} near ${mark('0')}, has no limit: the values never settle on one number.`,
      `To show it, find two sequences approaching the point along which the function tends to different values (for ${mark('sin(1/x)')}, ${mark('1')} and ${mark('−1')}).`,
      'Multiplying an oscillating, bounded function by something that goes to 0 does give a limit (the squeeze theorem).',
      `Swings that grow, as in ${mark('x·sin x')} at ${mark('∞')}, have no limit either: not a number, and not ${mark('∞')}.`,
    ],
    mistakes: [
      'Reporting a value read off a few sample points: an oscillating function can give any value that way.',
      'Confusing "bounded" with "has a limit".',
      `Saying the limit is ${mark('0')} because the average of the swings is ${mark('0')}.`,
      `Calling growing swings ${mark('∞')}: an infinite limit must eventually stay large and of one sign.`,
    ],
  },
  'opposite infinities': {
    tips: [
      'When direct substitution blows up, check each side separately: the two-sided limit exists only if both sides agree.',
      'A vertical asymptote gives infinite one-sided limits; opposite signs on the two sides mean the limit does not exist.',
      `Write "does not exist" (DNE) rather than a number when the sides disagree; write ${mark('+∞')} or ${mark('−∞')} when they agree on an infinity.`,
      `The sign on each side comes from the signs of the pieces: ${mark('1/x')} is negative just left of ${mark('0')} and positive just right.`,
    ],
    mistakes: [
      `Writing ${mark('∞')} for a limit whose two sides go to ${mark('+∞')} and ${mark('−∞')}.`,
      `Treating ${mark('1/0')} as a number instead of describing how the function behaves nearby.`,
      'Checking only one side of the point.',
    ],
  },
  'infinite limit': {
    tips: [
      `When both sides grow without bound in the same direction, the limit is ${mark('∞')} (or ${mark('−∞')}): the graph has a vertical asymptote and both branches go the same way.`,
      `An even power in the denominator, as in ${mark('1/x^2')}, keeps the sign the same on both sides.`,
      `${mark('lim = ∞')} still means the limit does not exist as a number: it says how it fails to exist.`,
    ],
    mistakes: [
      `Writing ${mark('1/0 = ∞')} as arithmetic instead of describing the behaviour near the point.`,
      'Checking only one side: with an odd power the other side would go the other way.',
      `Calling the limit "undefined" when ${mark('∞')} describes it exactly.`,
    ],
  },
  jump: {
    tips: [
      'When the left and right limits are different numbers, the two-sided limit does not exist: the graph jumps.',
      `${mark('|x|/x')} is ${mark('−1')} for ${mark('x < 0')} and ${mark('1')} for ${mark('x > 0')}: split an absolute value at the point where its inside is ${mark('0')}.`,
      'Each one-sided limit still exists; report them separately when a question asks.',
    ],
    mistakes: [
      'Averaging the two one-sided limits.',
      'Checking only one side of the point.',
      `Treating ${mark('|x|/x')} as ${mark('1')}: that holds only for ${mark('x > 0')}.`,
    ],
  },
  'outside the domain': {
    tips: [
      `A limit at ${mark('±∞')} needs the function defined for all large enough ${mark('x')} on that side: ${mark('ln(x)')} and ${mark('√x')} are not defined for ${mark('x < 0')}, so they have no limit as ${mark('x → −∞')}.`,
      'Check the domain first: where a function is not defined, there are no values to approach.',
      `${mark('ln(−x)')} or ${mark('√(−x)')} is defined for ${mark('x < 0')}, if that is the function you meant.`,
    ],
    mistakes: [
      `Treating ${mark('ln')} of a negative number as ${mark('−∞')}: it is not a real number at all.`,
      'Reading a calculator error as an infinite value.',
      'Answering a limit at a place where the function does not exist.',
    ],
  },
  'sampled at infinity': {
    tips: [
      'This limit was estimated by sampling large values, not proved by a technique: treat the number as a strong hint, and prove it with one of the methods in the next insights.',
      `Compare growth rates: ${mark('ln x')} is slower than any power of ${mark('x')}, which is slower than any exponential.`,
      `For a ratio, divide the top and the bottom by the fastest-growing term; for ${mark('∞ − ∞')} with a root, multiply by the conjugate.`,
    ],
    mistakes: [
      'Plugging in a large number and rounding — that suggests the value but does not prove it.',
      `Trusting a computed ${mark('0')}: a value below about ${mark('10^(−308)')} underflows to ${mark('0')} in a computer.`,
      `Treating ${mark('∞/∞')} as ${mark('1')} or ${mark('∞ − ∞')} as ${mark('0')}.`,
    ],
  },
  'numeric estimate': {
    tips: [
      'This limit was estimated by sampling both sides, not proved by a technique: treat the number as a strong hint.',
      `For a proof, find the method: factor and cancel a ${mark('0/0')}, use a standard limit or a series, or L'Hôpital's rule.`,
      'Agreement from both sides is what a two-sided limit needs; sampling shows it, a technique proves it.',
    ],
    mistakes: [
      'Reporting a rounded sample as an exact value.',
      'Checking only one side of the point.',
      `Stopping at a ${mark('0/0')} form instead of simplifying first.`,
    ],
  },
  general: {
    tips: [
      'Try substituting the value directly first — if the function is continuous there, that is the limit.',
      `A ${mark('0/0')} or ${mark('∞/∞')} result is indeterminate: factor, rationalize, or use L'Hôpital's rule.`,
      'For limits at infinity, compare the growth rates of the numerator and denominator.',
    ],
    mistakes: [
      'Assuming the limit equals the function value even at a discontinuity.',
      'Only checking one side when the two sides can disagree.',
      `Stopping at a ${mark('0/0')} form instead of simplifying first.`,
    ],
  },
};

// The step text after the label, up to its closing full stop.
const after = (text, re) => {
  const m = text.match(re);
  return m ? m[1].trim().replace(/\.$/, '') : null;
};

// The first insight applied to this limit, from the solver's own steps.
function worked(method, result, ctx) {
  const text = stripMathMarkers((result.steps || []).join('\n'));
  const f = absBars(beautify(ctx.func));
  const v = ctx.variable;
  const a = ctx.displayTarget;
  // The value without its decimal: "1/2 (≈ 0.5)" is 1/2 in a formula.
  const answer = String(result.answer).replace(/\s*\(≈[^)]*\)$/, '');
  // At −∞ by t = −x: the rewrite, the winner, and the side 0 is approached from.
  const sub = result.substitution;
  if (sub && /^(growth: |no contest)/.test(method)) {
    const rewrite = after(text, /^Let [^:]+: [^\n]*, and ([^\n]+?)\. The question is now/m);
    if (rewrite) {
      const side = answer === '0' ? `, approached from ${sub.approach}` : '';
      const why = method === 'no contest' ? 'nothing pulls against it' : `the exponential outgrows the power of ${mark(sub.t)}`;
      return `Here: with ${mark(`${sub.t} = −${v} → ∞`)}, ${mark(rewrite)}; ${why}, so the limit is ${mark(answer)}${side}.`;
    }
  }
  switch (method) {
    case 'direct substitution':
      return `Here: ${mark(`${f}`)} is defined at ${mark(`${v} = ${a}`)}, and substituting gives ${mark(answer)}, a number, so no technique is needed.`;
    case 'domain edge: defined':
    case 'domain edge':
      return `Here: ${mark(f)} is not defined just to the ${result.domainEdge > 0 ? 'left' : 'right'} of ${mark(a)}, so ${mark(`${v} → ${a}`)} can only mean ${mark(`${v} → ${a}${result.domainEdge > 0 ? '⁺' : '⁻'}`)}.`;
    case 'factor and cancel': {
      const cancelled = after(text, /Cancel it: ([^\n]+)/);
      return cancelled ? `Here: ${mark(`${f} = ${cancelled}`)} for ${mark(`${v} ≠ ${a}`)}, and ${mark(`${cancelled} → ${answer}`)} as ${mark(`${v} → ${a}`)}.` : null;
    }
    case 'standard limit': {
      const rewrite = after(text, /matches the denominator: ([^\n]+?)\. With/);
      return rewrite
        ? `Here: ${mark(rewrite)}, and the fraction ${mark('→ 1')}, so the limit is ${mark(answer)}.`
        : `Here: ${mark(f)} is the standard limit itself, so the limit is ${mark(answer)}.`;
    }
    case 'standard limit: cosine': {
      const rewrite = after(text, /With u = [^:]+: ([^\n]+)/);
      return rewrite
        ? `Here: ${mark(rewrite)}, and the fraction ${mark('→ 1/2')}, so the limit is ${mark(answer)}.`
        : `Here: ${mark(f)} is the standard limit itself, so the limit is ${mark(answer)}.`;
    }
    case 'conjugate': {
      const simplified = after(text, /simplifies to ([^\n]+)/);
      return simplified ? `Here: after the conjugate and the cancelling, ${mark(f)} becomes ${mark(simplified)}, which is defined at ${mark(`${v} = ${a}`)}: substituting gives ${mark(answer)}.` : null;
    }
    case 'root at infinity': {
      const like = text.match(/behaves like ([^ ]+) \(/);
      return like ? `Here: ${mark(f)} ${mark('≈')} a nonzero multiple of ${mark(`|${v}|`)}, so the limit is ${mark(answer)}.` : null;
    }
    case 'conjugate at infinity': {
      const conj = after(text, /by the conjugate ([^\n]+?)\. Since/);
      const top = after(text, /the top becomes [^\n]*= ([^\n:]+): the square root/);
      const sign = /Factor out the sign/.test(text) ? '−' : '';
      return conj && top ? `Here: ${mark(`${f} = ${sign}${top}/(${conj})`)}, a quotient whose top and bottom grow at the same rate.` : null;
    }
    case 'squeeze': {
      const bounds = after(text, /(?:Multiply|Divide) through by [^:]+: ([^\n]+)/);
      return bounds ? `Here: ${mark(bounds)}, and both bounds ${mark('→ 0')}, so the limit is ${mark('0')}.` : null;
    }
    case '1^∞': {
      const eu = after(text, /(E·u = [^\n]+?), a constant/) || after(text, /(E·u = [^\n]+?)\./);
      return eu ? `Here: ${mark(eu)}, so ${mark(`ln L = ${eu.split('=').pop().trim()}`)} and the limit is ${mark(answer.replace(/\s*\(≈.*\)$/, ''))}.` : null;
    }
    case 'series': {
      const num = after(text, /Numerator ≈ ([^;]+);/);
      const den = after(text, /denominator ≈ ([^\n]+)/);
      const first = (s) => s && s.split(/ [+-] /)[0];
      return num && den ? `Here: the numerator starts ${mark(first(num))} and the denominator ${mark(first(den))}; after cancelling, the limit is ${mark(answer)}.` : null;
    }
    case "L'Hôpital": {
      // The bottom after each round: the rounds stop once it is not 0 there.
      const bottoms = [...text.matchAll(/^Differentiate: numerator → .*, denominator → (.+)\.$/gm)].map((m) => m[1]);
      if (!bottoms.length) return null;
      return bottoms.length === 1
        ? `Here: after one round the bottom is ${mark(bottoms[0])}, not ${mark('0')} at ${mark(`${v} = ${a}`)}, so substitution gives ${mark(answer)}.`
        : `Here: the bottom goes ${bottoms.map((b) => mark(b)).join(', then ')}; only after round ${bottoms.length} is it not ${mark('0')} at ${mark(`${v} = ${a}`)}, and substitution gives ${mark(answer)}.`;
    }
    case 'growth: exponential': {
      const m = text.match(/Apply L'Hôpital's rule (once|\d+ times)/);
      const n = m ? (m[1] === 'once' ? 1 : Number(m[1].split(' ')[0])) : null;
      return n ? `Here: ${n === 1 ? 'one round' : `${n} rounds`} of L'Hôpital's rule, one per power of ${mark(v)}, left a ${answer === '0' ? 'top' : 'bottom'} that no longer grows, so the limit is ${mark(answer)}.` : null;
    }
    case 'growth: logarithm': {
      const m = text.match(/Apply L'Hôpital's rule (once|\d+ times)/);
      const n = m ? (m[1] === 'once' ? 1 : Number(m[1].split(' ')[0])) : null;
      return n ? `Here: ${n === 1 ? 'one round' : `${n} rounds`} of L'Hôpital's rule, one per power of ${mark(`ln(${v})`)}, left a power of ${mark(v)} alone, so the limit is ${mark(answer)}.` : null;
    }
    case 'growth: 0·∞': {
      const q = after(text, /as a quotient, ([^\n]+?), which is/);
      return q ? `Here: ${mark(`${f} = ${q}`)} for ${mark(`${v} > 0`)}, the form ${mark('∞/∞')}.` : null;
    }
    case 'no contest':
      return `Here: ${mark(f)} has nothing pulling against it, so the limit is ${mark(answer)} without any technique.`;
    case 'leading terms': {
      const equal = text.match(/both have degree (\d+)/);
      if (equal) return `Here: top and bottom both have degree ${mark(equal[1])}, so the limit is the ratio of the leading coefficients, ${mark(answer.replace(/\s*\(≈.*\)$/, ''))}.`;
      const degs = text.match(/numerator has degree (\d+),? (?:and )?the denominator degree (\d+)/);
      if (!degs) return null;
      return Number(degs[1]) < Number(degs[2])
        ? `Here: the bottom has the higher degree (${mark(`${degs[2]} > ${degs[1]}`)}), so the limit is ${mark('0')}.`
        : `Here: the top has the higher degree (${mark(`${degs[1]} > ${degs[2]}`)}), so the quotient grows without bound: ${mark(answer)}.`;
    }
    case 'polynomial at infinity': {
      const lead = after(text, /highest-power term, ([^:]+):/);
      return lead ? `Here: ${mark(lead)} decides, so the limit is ${mark(answer)}.` : null;
    }
    case 'one-sided':
      return `Here: only values of ${mark(v)} just ${/⁺$/.test(a) ? 'above' : 'below'} ${mark(a.replace(/[⁺⁻]$/, ''))} count${/Does not exist/.test(answer) ? '' : `, and there ${mark(`${f} → ${answer}`)}`}.`;
    case '0^0': {
      const m = text.match(/Take logarithms: for [^,]+, (.+) = e\^\((.+)\), so the limit of the exponent, (.+), decides/);
      return m ? `Here: ${mark(`${m[1]} = e^(${m[2]})`)} and ${mark(`${m[3]} → 0`)}, so the limit is ${mark('e^0 = 1')}.` : null;
    }
    case 'oscillation': {
      const q = result.sequences;
      if (q) return `Here: ${mark(`x_n = ${q.x}`)} and ${mark(`y_n = ${q.y}`)} both ${mark(`→ ${q.toward}`)}, but ${mark(f)} ${/∞/.test(q.along1) ? `${mark(`→ ${q.along1}`)} along one and ${mark(`→ ${q.along2}`)}` : `is ${mark(q.along1)} along one and ${mark(q.along2)}`} along the other.`;
      return /swing between positive and negative/.test(text) ? `Here: ${mark(f)} takes values of both signs, larger and larger, as ${mark(v)} grows.` : null;
    }
    case 'opposite infinities':
    case 'jump': {
      if (result.sides) return `Here: from the left ${mark(`${f} → ${result.sides.left}`)}, from the right ${mark(`→ ${result.sides.right}`)}.`;
      const left = after(text, /From the left \([^)]*\): ([^\n]+)/);
      const right = after(text, /From the right \([^)]*\): ([^\n]+)/);
      const show = (s) => (/^diverges to /.test(s) ? `→ ${s.replace('diverges to ', '')}` : `→ ${s}`);
      return left && right ? `Here: from the left ${mark(`${f} ${show(left)}`)}, from the right ${mark(show(right))}.` : null;
    }
    case 'infinite limit':
      return `Here: ${mark(f)} ${mark(`→ ${answer}`)} from both sides, so the limit is ${mark(answer)}.`;
    default:
      return null;
  }
}

// side: 0 for a two-sided limit, ±1 for one-sided. ctx: { func, variable,
// displayTarget, infinite }.
export function limitGuidance(result, ctx = {}) {
  const method = methodOf(result, ctx.side || 0, Boolean(ctx.infinite));
  const list = LISTS[method] || LISTS.general;
  const here = ctx.func ? worked(method, result, ctx) : null;
  const tips = [list.tips[0], ...(here ? [here] : []), ...list.tips.slice(1)];
  return { method, tips: [...new Set(tips)], common_mistakes: [...new Set(list.mistakes)] };
}
