// Tips and mistakes for the limits solver, chosen by the technique that
// produced the answer.

import { mark, stripMathMarkers } from '../solverUtils.js';

// Tips and mistakes chosen from the technique the limit actually used (read
// off its verification method and steps), instead of one list for every
// limit. September 2026 review, batch 3.
export function limitGuidance(result) {
  const method = String(result.verificationMethod || '');
  const text = stripMathMarkers((result.steps || []).join('\n'));
  if (/^logarithms/.test(method)) {
    return {
      tips: [
        `${mark('1^∞')} is indeterminate: a base just above ${mark('1')} raised to a huge power can go anywhere. Take logarithms to bring the exponent down: ${mark('ln(B^E) = E·ln(B)')}.`,
        `${mark('ln(1 + u) ≈ u')} for small ${mark('u')} (the standard limit ${mark('ln(1 + u)/u → 1')}), so ${mark('lim B^E = e^(lim E·(B − 1))')}.`,
        `The family to know: ${mark('(1 + a/x)^(bx) → e^(ab)')} as ${mark('x → ∞')}, and ${mark('(1 + ax)^(b/x) → e^(ab)')} as ${mark('x → 0')}.`,
      ],
      common_mistakes: [
        `Saying ${mark('1^∞ = 1')}: the base is only approaching ${mark('1')}, and the exponent magnifies the difference.`,
        `Forgetting to undo the logarithm at the end: ${mark('ln L = 2')} means ${mark('L = e²')}, not ${mark('2')}.`,
        `Dropping the constant in the exponent: ${mark('(1 + 1/x)^(2x) → e²')}, not ${mark('e')}.`,
      ],
    };
  }
  if (/standard limit/.test(method)) {
    return {
      tips: [
        `The standard limits ${mark('sin(u)/u → 1')} and ${mark('(1 − cos u)/u² → 1/2')} (as ${mark('u → 0')}) are the building blocks: rewrite so the argument of the trig function matches the denominator.`,
        `A constant factor comes out: ${mark('sin(3x)/x = 3·sin(3x)/(3x)')}.`,
        `These limits are the reason ${mark('d/dx sin(x) = cos(x)')} — they sit under every trig derivative.`,
      ],
      common_mistakes: [
        `Substituting ${mark('x = 0')} and stopping at ${mark('0/0')} — the form is indeterminate, not an answer.`,
        `Forgetting the constant factor when the argument is scaled (${mark('sin(3x)/x → 3')}, not ${mark('1')}).`,
        'Applying the standard limit when the argument does not match the denominator.',
      ],
    };
  }
  if (/factor and cancel/.test(method) || /Cancel it/.test(text)) {
    return {
      tips: [
        `${mark('0/0')} means a common factor is hiding in numerator and denominator: factor both and cancel it.`,
        'The cancelled form equals the original everywhere except at the point itself — that is exactly what a limit needs.',
        'On the graph, a cancelled factor is a hole (removable discontinuity), not an asymptote.',
      ],
      common_mistakes: [
        `Substituting the value before cancelling and stopping at ${mark('0/0')}.`,
        'Claiming the function "equals" the simplified form at the point — it is undefined there.',
        'Cancelling terms instead of factors.',
      ],
    };
  }
  if (/diverges to|opposite infinities|Does not exist|blows up instead of settling/i.test(text) && !/oscillates/.test(text)) {
    return {
      tips: [
        'When direct substitution blows up, check each side separately: the two-sided limit exists only if both sides agree.',
        'A vertical asymptote gives infinite one-sided limits; opposite signs on the two sides mean the limit does not exist.',
        `Write "does not exist" (DNE) rather than a number when the sides disagree; write ${mark('+∞')} or ${mark('−∞')} when they agree on an infinity.`,
      ],
      common_mistakes: [
        `Writing ${mark('∞')} for a limit whose two sides go to ${mark('+∞')} and ${mark('−∞')}.`,
        `Treating ${mark('1/0')} as a number instead of describing how the function behaves nearby.`,
        'Checking only one side of the point.',
      ],
    };
  }
  if (/increasingly large|values settle toward|highest powers|degree/i.test(text) || (/infinit|∞/i.test(text) && /at infinity|growth|dominant|leading/i.test(text + method))) {
    return {
      tips: [
        'For a limit at infinity, the highest power dominates: divide numerator and denominator by it.',
        `Equal degrees → the ratio of leading coefficients; lower degree on top → ${mark('0')}; higher on top → ${mark('±∞')}.`,
        'Exponentials outgrow every polynomial, and polynomials outgrow every logarithm.',
      ],
      common_mistakes: [
        'Plugging in a large number and rounding — that suggests the value but does not prove it.',
        `Forgetting the sign when the leading term is odd and ${mark('x → −∞')}.`,
        `Treating ${mark('∞/∞')} as ${mark('1')}.`,
      ],
    };
  }
  // Each remaining method gets its own advice; the generic list below was
  // shown for all of them, including "limits at infinity" for a limit at 0
  // (October 2026 roadmap P3).
  if (/Taylor series/.test(text)) {
    return {
      tips: [
        `Near ${mark('0')}, replace each function by the start of its series: ${mark('e^x = 1 + x + x^2/2 + …')}, ${mark('sin x = x − x^3/6 + …')}, ${mark('cos x = 1 − x^2/2 + …')}.`,
        'Keep terms up to the lowest power that survives in the denominator; after cancelling it, the constant left is the limit.',
        `A ${mark('0/0')} form that L'Hôpital's rule needs several rounds for is often one line with series.`,
      ],
      common_mistakes: [
        'Stopping the series too early, so everything cancels and the true leading term is lost.',
        `Expanding about the wrong point: the series must be about the value ${mark('x')} approaches.`,
        'Dropping a sign in an alternating series such as the one for sin.',
      ],
    };
  }
  if (/L'Hôpital's rule \(differentiate/.test(text)) {
    return {
      tips: [
        `L'Hôpital's rule applies only to ${mark('0/0')} or ${mark('∞/∞')}: then ${mark("lim f/g = lim f′/g′")}.`,
        'Differentiate the top and the bottom separately, then substitute again; repeat while the form stays indeterminate.',
        'Check the form before every round: once substitution gives a number, stop.',
      ],
      common_mistakes: [
        `Using the quotient rule on ${mark('f/g')}: the rule differentiates the numerator and the denominator separately.`,
        `Applying it when the form is not ${mark('0/0')} or ${mark('∞/∞')}, which gives a wrong answer.`,
        'Going round once too many and differentiating a form that was already a number.',
      ],
    };
  }
  if (/conjugate/.test(method)) {
    return {
      tips: [
        `A difference with a root, ${mark('√a − b')}, is rationalised by its conjugate: multiply top and bottom by ${mark('√a + b')}, using ${mark('(√a − b)(√a + b) = a − b^2')}.`,
        `The product clears the root and usually exposes the factor that made ${mark('0/0')}; cancel it, then substitute.`,
        `At infinity, ${mark('√(x^2 + x) − x')} is ${mark('∞ − ∞')}: the conjugate turns it into a ratio of leading terms.`,
      ],
      common_mistakes: [
        'Multiplying only the numerator by the conjugate, which changes the value.',
        `Expanding ${mark('(√a − b)(√a + b)')} as ${mark('a − b')} instead of ${mark('a − b^2')}.`,
        `Substituting before cancelling, and getting ${mark('0/0')} again.`,
      ],
    };
  }
  if (/squeeze/.test(method)) {
    return {
      tips: [
        `The squeeze theorem: if ${mark('g ≤ f ≤ h')} near the point and ${mark('g')} and ${mark('h')} have the same limit ${mark('L')}, so does ${mark('f')}.`,
        `A bounded factor times something going to ${mark('0')} goes to ${mark('0')}: ${mark('−|x| ≤ x·sin(1/x) ≤ |x|')}.`,
        `The bounds come from facts like ${mark('−1 ≤ sin(u) ≤ 1')}, which hold for every ${mark('u')}.`,
      ],
      common_mistakes: [
        `Concluding ${mark('sin(1/x)')} itself has a limit at ${mark('0')}: it oscillates; only its product with ${mark('x')} is squeezed.`,
        'Using bounds that have different limits, which squeeze nothing.',
        'Forgetting that the bounds must hold on both sides of the point.',
      ],
    };
  }
  if (method === 'direct substitution' || /the function is defined and equals/.test(text)) {
    return {
      tips: [
        'Where a function is continuous, the limit is its value: start by substituting the value directly.',
        'Polynomials, and sin, cos, eˣ and roots on their domains, are continuous, so substitution works for them.',
        `Only an undefined result (a ${mark('0/0')} form, a zero denominator) needs a technique.`,
      ],
      common_mistakes: [
        'Reaching for a technique when direct substitution already gives a number.',
        'Substituting into a function that is not defined at the point and reporting that value.',
        'Assuming the limit equals the function value at a jump or a hole.',
      ],
    };
  }
  if (/oscillates/.test(text)) {
    return {
      tips: [
        `A function that keeps swinging, such as ${mark('sin(1/x)')} near ${mark('0')}, has no limit: the values never settle on one number.`,
        `To show it, find two sequences approaching the point along which the function tends to different values (for ${mark('sin(1/x)')}, ${mark('1')} and ${mark('−1')}).`,
        'Multiplying an oscillating, bounded function by something that goes to 0 does give a limit (the squeeze theorem).',
      ],
      common_mistakes: [
        'Reporting a value read off a few sample points: an oscillating function can give any value that way.',
        'Confusing "bounded" with "has a limit".',
        `Saying the limit is ${mark('0')} because the average of the swings is ${mark('0')}.`,
      ],
    };
  }
  return {
    tips: [
      'Try substituting the value directly first — if the function is continuous there, that is the limit.',
      `A ${mark('0/0')} or ${mark('∞/∞')} result is indeterminate: factor, rationalize, or use L'Hôpital's rule.`,
      'For limits at infinity, compare the growth rates of the numerator and denominator.',
    ],
    common_mistakes: [
      'Assuming the limit equals the function value even at a discontinuity.',
      'Only checking one side when the two sides can disagree.',
      `Stopping at a ${mark('0/0')} form instead of simplifying first.`,
    ],
  };
}
