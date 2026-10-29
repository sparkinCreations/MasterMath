// Tips and mistakes for the functions solver, chosen by the family of the
// function (quadratic, periodic, logarithm, rational, exponential, root,
// polynomial).

import { math, mark } from '../solverUtils.js';

// Tips and mistakes for the kind of function analysed: a parabola, a
// rational function, a periodic one, an exponential or logarithm, a root,
// or another polynomial. One list served them all apart from the parabola
// ("check symmetry", "state the domain first"); October 2026 roadmap P3.
export function functionGuidance(func, v, f) {
  const fx = `f(${v})`;
  const has = (re) => re.test(String(func));
  if (f.quadratic) {
    return {
      tips: [
        `For ${mark('ax^2 + bx + c')}, the axis of symmetry is ${mark('x = −b/(2a)')}, and the vertex sits on it.`,
        `The sign of ${mark('a')} gives the opening: ${mark('a > 0')} opens upward (the vertex is a minimum), ${mark('a < 0')} downward.`,
        `The x-intercepts are the roots of ${mark('ax^2 + bx + c = 0')}; the discriminant ${mark('b^2 − 4ac')} says whether there are two, one or none.`,
      ],
      common_mistakes: [
        `Dropping the minus sign in ${mark('x = −b/(2a)')}.`,
        'Giving the vertex as a single number: it is a point, (x, y).',
        `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
      ],
    };
  }
  // A corner or cusp (|x|, x^(2/3)): the extremum is a critical point where
  // f′ does not exist — not a polynomial, and the polynomial list below said
  // "the leading term decides the ends" about it (October 2026 tips audit).
  if (f.extrema.some((e) => e.origin === 'cusp') || has(/(?<![a-z])abs\s*\(|\|/)) {
    const absolute = has(/(?<![a-z])abs\s*\(|\|/);
    return {
      tips: [
        `A corner or cusp is a critical point where ${mark(`f′(${v})`)} does not exist: the one-sided slopes disagree (${mark(`|${v}|`)} at ${mark('0')}) or blow up (${mark(`${v}^(2/3)`)} at ${mark('0')}). It can still be a maximum or a minimum.`,
        absolute
          ? `An absolute value is piecewise: ${mark('|g|')} is ${mark('g')} where ${mark('g ≥ 0')} and ${mark('−g')} where ${mark('g < 0')} — differentiate each piece on its own, and the corner is where ${mark('g = 0')}.`
          : `${mark(`${v}^(2/3) = (∛${v})²`)}: the odd root first, so it is defined for negative ${mark(v)} too, and the square makes it never negative.`,
        `Critical points are where ${mark(`f′ = 0`)} OR where ${mark(`f′`)} does not exist; check both kinds.`,
      ],
      common_mistakes: [
        `Saying there is no extremum because ${mark(`f′`)} is never ${mark('0')}: the minimum of ${mark(`|${v}|`)} is at the corner.`,
        `Reporting ${mark(`f′(0) = 0`)} at a corner or cusp — the derivative does not exist there.`,
        absolute
          ? `Differentiating ${mark(`|${v}|`)} as if it were ${mark(v)}, giving ${mark('1')} everywhere.`
          : `Treating ${mark(`${v}^(2/3)`)} as undefined for negative ${mark(v)}, or as negative there.`,
      ],
    };
  }
  if (f.isPeriodic) {
    const reciprocal = has(/(?<![a-z])(?:tan|cot|sec|csc)\s*\(/);
    return {
      tips: [
        `${mark(`A·sin(k${v})`)} and ${mark(`A·cos(k${v})`)} have amplitude ${mark('|A|')} and period ${mark('2π/k')}; ${mark(`tan(k${v})`)} has period ${mark('π/k')}.`,
        'Analyse one period, then repeat: the intercepts, extrema and asymptotes recur every period.',
        reciprocal
          ? `${mark(`tan(${v})`)} and ${mark(`sec(${v})`)} have a vertical asymptote wherever ${mark(`cos(${v}) = 0`)}; ${mark(`cot(${v})`)} and ${mark(`csc(${v})`)} wherever ${mark(`sin(${v}) = 0`)}.`
          : `sin and cos stay between ${mark('−1')} and ${mark('1')}: the range of ${mark(`A·sin(k${v}) + d`)} is the midline ${mark('d')} plus or minus the amplitude.`,
      ],
      common_mistakes: [
        reciprocal
          ? `Using ${mark('2π')} as the period of ${mark('tan')}: it repeats every ${mark('π')}.`
          : `Reading the amplitude off the first peak without checking the midline: ${mark(`A·sin(k${v}) + d`)} peaks at ${mark('d + |A|')}.`,
        `Forgetting the ${mark('k')}: the period of ${mark(`sin(2${v})`)} is ${mark('π')}, not ${mark('2π')}.`,
        'Listing a few intercepts as if they were all of them, instead of giving the pattern with n.',
      ],
    };
  }
  if (has(/(?<![a-z])(?:ln|log)\s*\(/i)) {
    return {
      tips: [
        `A logarithm is defined only for a positive argument: the domain is where the inside is ${mark('> 0')}.`,
        `${mark(`ln(${v})`)} has a vertical asymptote at ${mark(`${v} = 0`)} and crosses the x-axis at ${mark(`${v} = 1`)}; it grows without bound, slowly.`,
        `Inside a shift, ${mark(`ln(${v} − a)`)} moves the asymptote to ${mark(`${v} = a`)}.`,
      ],
      common_mistakes: [
        `Allowing ${mark(`${v} = 0`)} or negative values in the domain.`,
        'Saying a logarithm has a horizontal asymptote: it keeps growing, however slowly.',
        `Splitting ${mark('ln(a + b)')} into ${mark('ln a + ln b')}.`,
      ],
    };
  }
  if (f.verticalAsymptotes.length > 0 || f.holes?.length > 0 || has(new RegExp(`/\\s*\\(?[^)]*${v}`))) {
    return {
      tips: [
        'Factor the numerator and the denominator. A factor that cancels is a hole; a zero of the denominator that remains is a vertical asymptote.',
        `The horizontal asymptote comes from the degrees: top lower → ${mark('y = 0')}; equal → the ratio of the leading coefficients; top higher → none (a slant asymptote when it is higher by one).`,
        'Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.',
      ],
      common_mistakes: [
        'Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.',
        'Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.',
        'Reading values off the graph where the function is undefined.',
      ],
    };
  }
  if (has(/(?<![a-z])e\s*\^|exp\s*\(|\d\s*\^\s*\(?[^)]*[a-z]/i) && variableOutsideExponents(func, v)) {
    // x·e^(−x), x²·e^x: a product with an exponential, not an exponential.
    // "e^x has no x-intercept" sat beside an answer listing one.
    return {
      tips: [
        `A polynomial times ${mark(`e^(−${v})`)} tends to ${mark('0')} as ${mark(`${v} → ∞`)}: the exponential wins over every power, which is the horizontal asymptote on that side.`,
        `${mark('e^(…)')} is never ${mark('0')}, so the zeros of the product are the zeros of the other factor.`,
        `Extrema come from ${mark(`f′ = 0`)} with the product rule: factor out the exponential, which never vanishes, and solve what is left.`,
      ],
      common_mistakes: [
        `Giving ${mark('e^(…)')} a zero: the x-intercepts come from the other factor only.`,
        `Dropping the product rule: ${mark(`(${v}·e^(−${v}))′`)} is ${mark(`e^(−${v}) − ${v}·e^(−${v})`)}, not ${mark(`−e^(−${v})`)}.`,
        `Assuming the same end behaviour on both sides: ${mark(`e^(−${v})`)} shrinks on the right and grows on the left.`,
      ],
    };
  }
  if (has(/(?<![a-z])e\s*\^|exp\s*\(|\d\s*\^\s*\(?[^)]*[a-z]/i)) {
    return {
      tips: [
        `${mark(`e^${v}`)} is positive for every ${mark(v)}: its graph never touches the x-axis, which is its horizontal asymptote ${mark('y = 0')} on one side.`,
        `${mark(`a^${v}`)} grows for ${mark('a > 1')} and decays for ${mark('0 < a < 1')}; it passes through ${mark('(0, 1)')}.`,
        'A shift up or down moves the horizontal asymptote with it.',
      ],
      common_mistakes: [
        `Giving ${mark(`e^${v}`)} an x-intercept: ${mark(`e^${v} = 0`)} has no solution.`,
        'Treating exponential growth like a power: it eventually outgrows every polynomial.',
        `Forgetting that ${mark(`e^(−${v})`)} decays: the minus sign flips the graph.`,
      ],
    };
  }
  if (has(/sqrt\s*\(|√|\^\s*\(\s*1\s*\/\s*2\s*\)/i)) {
    return {
      tips: [
        `A square root needs a radicand ${mark('≥ 0')}: solve that inequality for the domain.`,
        `${mark(`√${v}`)} starts at the edge of its domain and rises slowly; that starting point is its minimum.`,
        `The range starts at ${mark('0')} (or the shift) and has no upper bound.`,
      ],
      common_mistakes: [
        'Including values that make the radicand negative.',
        'Missing the endpoint minimum because there is no turning point there.',
        `Writing ${mark('√(a + b)')} as ${mark('√a + √b')}.`,
      ],
    };
  }
  // Not a polynomial (sin(x²), x·ln x's cousins, a fractional power with no
  // cusp): the calculus checklist, with no leading-term talk.
  if (new RegExp(`[a-z]{2,}|/|\\^\\s*[^0-9]`, 'i').test(String(func).replace(/\s+/g, ''))) {
    return {
      tips: [
        'Domain first, then intercepts, then the derivative for extrema and the second derivative for concavity, then what happens at the ends.',
        `Critical points come from solving ${mark(`f′(${v}) = 0`)} and from where ${mark(`f′`)} does not exist; the sign of ${mark(`f′`)} on each side says maximum, minimum or neither.`,
        'Check each feature by substituting: a claimed intercept must give 0, a claimed extremum must beat its neighbours.',
      ],
      common_mistakes: [
        `Calling every root of ${mark(`f′`)} an extremum: ${mark(`f′`)} must change sign there.`,
        'Reading the end behaviour from a few plotted points instead of the dominant term for large x.',
        `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
      ],
    };
  }
  return {
    tips: [
      `Critical points come from solving ${mark(`f′(${v}) = 0`)}; the sign of ${mark(`f′`)} on each side says maximum, minimum or neither.`,
      `The leading term decides the ends: ${mark(`${v}^3`)} falls on the left and rises on the right; ${mark(`−${v}^4`)} falls on both sides.`,
      `A polynomial of degree ${mark('n')} has at most ${mark('n')} real roots and at most ${mark('n − 1')} turning points; inflection points are where ${mark(`f″`)} changes sign.`,
    ],
    common_mistakes: [
      `Calling every root of ${mark(`f′`)} an extremum: ${mark(`${v}^3`)} has ${mark(`f′(0) = 0`)} but no turning point.`,
      'Reading the end behaviour from the constant term instead of the leading term.',
      `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
    ],
  };
}

// Does the variable appear anywhere but in an exponent? x·e^(−x) yes,
// e^(−x²) and 2^x no — the pure exponential's guidance fits only the latter.
function variableOutsideExponents(func, v) {
  try {
    let count = 0;
    const walk = (n, inExponent) => {
      if (!n) return;
      if (n.type === 'SymbolNode' && n.name === v && !inExponent) count += 1;
      if (n.type === 'OperatorNode' && n.fn === 'pow') {
        walk(n.args[0], inExponent);
        walk(n.args[1], true);
        return;
      }
      if (n.type === 'FunctionNode' && n.fn?.name === 'exp') {
        n.args.forEach((a) => walk(a, true));
        return;
      }
      if (n.type === 'ParenthesisNode') { walk(n.content, inExponent); return; }
      (n.args || []).forEach((a) => walk(a, inExponent));
    };
    walk(math.parse(String(func)), false);
    return count > 0;
  } catch {
    return true;
  }
}
