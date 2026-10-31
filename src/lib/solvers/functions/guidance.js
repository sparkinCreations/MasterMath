// Tips and mistakes for the functions solver, chosen by the family of the
// function (quadratic, corner or cusp, periodic, logarithm, rational,
// exponential, root, polynomial), ranked, with a worked "Here: …" line second:
// the family's first insight applied to this function, from its features
// (1.64.0, after integrals, derivatives, algebra and limits).

import { math, mark, beautify, formatNumber, piForm } from '../solverUtils.js';
import { exactNumber } from './features.js';

// x-values, = for exact and ≈ for numeric (the same as the steps).
const xList = (items, v) => {
  const exact = items.filter((r) => !r.approx).map((r) => r.display);
  const approx = items.filter((r) => r.approx).map((r) => r.display);
  return [exact.length ? `${v} = ${exact.join(', ')}` : '', approx.length ? `${v} ≈ ${approx.join(', ')}` : ''].filter(Boolean).join(', ');
};

// The family, from the features the analysis proved.
function familyOf(func, v, f) {
  const has = (re) => re.test(String(func));
  if (f.quadratic) return 'quadratic';
  if (f.extrema.some((e) => e.origin === 'cusp') || has(/(?<![a-z])abs\s*\(|\|/)) return has(/(?<![a-z])abs\s*\(|\|/) ? 'absolute value' : 'cusp';
  if (f.isPeriodic) return has(/(?<![a-z])(?:tan|cot|sec|csc)\s*\(/) ? 'periodic: asymptotes' : 'periodic';
  if (has(/(?<![a-z])(?:ln|log)\s*\(/i)) return variableOutsideLog(func, v) ? 'logarithm product' : 'logarithm';
  // A quotient of polynomials only: sin(x)/x was given "factor the numerator
  // and the denominator" (1.64.0).
  if (f.isRational) return f.slant ? 'rational: slant' : f.holes?.length ? 'rational: hole' : 'rational';
  if (has(/(?<![a-z])e\s*\^|exp\s*\(|\d\s*\^\s*\(?[^)]*[a-z]/i)) return variableOutsideExponents(func, v) ? 'exponential product' : 'exponential';
  if (has(/sqrt\s*\(|√|\^\s*\(\s*1\s*\/\s*2\s*\)/i)) return 'root';
  if (new RegExp('[a-z]{2,}|/|\\^\\s*[^0-9]', 'i').test(String(func).replace(/\s+/g, ''))) return 'other';
  return 'polynomial';
}

// Ranked lists: tips[0] is the family's own insight (no two families share
// it; tests/tipsByMethod.test.js), the worked line goes second, the rest
// follow in order of how much they help.
function lists(family, v, func) {
  const fx = `f(${v})`;
  const has = (re) => re.test(String(func));
  switch (family) {
    case 'quadratic':
      return {
        tips: [
          `For ${mark('ax^2 + bx + c')}, the axis of symmetry is ${mark('x = −b/(2a)')}, and the vertex sits on it.`,
          `The sign of ${mark('a')} gives the opening: ${mark('a > 0')} opens upward (the vertex is a minimum), ${mark('a < 0')} downward.`,
          `The x-intercepts are the roots of ${mark('ax^2 + bx + c = 0')}; the discriminant ${mark('b^2 − 4ac')} says whether there are two, one or none.`,
          `Vertex form ${mark('a(x − h)^2 + k')} shows the vertex ${mark('(h, k)')} directly; completing the square turns ${mark('ax^2 + bx + c')} into it.`,
          `The y-intercept is ${mark('c')}, the value at ${mark('x = 0')}; the parabola is symmetric about its axis, so ${mark('(2h, c)')} is on it too.`,
          `The range starts at the vertex height: ${mark('y ≥ k')} when ${mark('a > 0')}, ${mark('y ≤ k')} when ${mark('a < 0')}.`,
        ],
        mistakes: [
          `Dropping the minus sign in ${mark('x = −b/(2a)')}.`,
          'Giving the vertex as a single number: it is a point, (x, y).',
          `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
          `Reading ${mark('h')} with the wrong sign from ${mark('a(x − h)^2 + k')}: ${mark('(x + 3)^2')} has ${mark('h = −3')}.`,
        ],
      };
    case 'absolute value':
      return {
        tips: [
          `An absolute value is piecewise: ${mark('|g|')} is ${mark('g')} where ${mark('g ≥ 0')} and ${mark('−g')} where ${mark('g < 0')}. The zeros of ${mark('g')} are where corners can be: there is a corner where ${mark('g')} changes sign with a nonzero slope (the slopes on the two sides then disagree), but ${mark(`|${v}^2| = ${v}^2`)} is smooth at ${mark('0')}.`,
          `Critical points are where ${mark('f′ = 0')} OR where ${mark('f′')} does not exist; a corner can be a maximum or a minimum.`,
          `Where ${mark('g = 0')}, ${mark('|g|')} touches ${mark('0')}: that point is an x-intercept, even though the graph does not cross there.`,
          `${mark('|g| ≥ 0')} always: for ${mark('a > 0')}, if ${mark('g')} is ${mark('0')} somewhere, then ${mark('k')} is the least value of ${mark('a|g| + k')} (for ${mark('a < 0')}, the greatest). The rest of the range depends on how large ${mark('|g|')} gets: ${mark('|sin(x)|')} stays between ${mark('0')} and ${mark('1')}.`,
        ],
        mistakes: [
          `Saying there is no extremum because ${mark('f′')} is never ${mark('0')}: the minimum of ${mark(`|${v}|`)} is at the corner.`,
          `Reporting ${mark('f′ = 0')} at a corner: the derivative does not exist there. (Not every zero of the inside is a corner: check the slopes on each side.)`,
          `Differentiating ${mark(`|${v}|`)} as if it were ${mark(v)}, giving ${mark('1')} everywhere.`,
          'Missing an intercept where the graph only touches the axis: a sign check finds crossings, not touches.',
        ],
      };
    case 'cusp':
      return {
        tips: [
          `A cusp is a critical point where ${mark('f′')} blows up: ${mark(`${v}^(2/3)`)} has ${mark(`f′ = 2/(3∛${v})`)}, undefined at ${mark('0')}, yet ${mark('(0, 0)')} is a minimum.`,
          `Critical points are where ${mark('f′ = 0')} OR where ${mark('f′')} does not exist; check both kinds.`,
          `${mark(`${v}^(2/3) = (∛${v})²`)}: the odd root first, so it is defined for negative ${mark(v)} too, and the square makes it never negative.`,
          `${mark(`${v}^(p/q)`)} with ${mark('q')} odd is defined for every ${mark(v)}; with ${mark('q')} even, only for ${mark(`${v} ≥ 0`)}.`,
        ],
        mistakes: [
          `Reporting ${mark('f′(0) = 0')} at a cusp — the derivative does not exist there.`,
          `Treating ${mark(`${v}^(2/3)`)} as undefined for negative ${mark(v)}, or as negative there.`,
          `Saying there is no extremum because ${mark('f′')} is never ${mark('0')}.`,
        ],
      };
    case 'periodic':
      return {
        tips: [
          `${mark(`A·sin(k${v}) + d`)} and ${mark(`A·cos(k${v}) + d`)} (with ${mark('k ≠ 0')}) have amplitude ${mark('|A|')}, period ${mark('2π/|k|')} and midline ${mark('y = d')}.`,
          'Analyse one period, then repeat: every intercept and extremum comes back each period, so give them as patterns in n.',
          `The range is the midline plus or minus the amplitude: ${mark('d − |A| ≤ y ≤ d + |A|')}.`,
          `${mark('sin = c')} has two solutions per period when ${mark('|c| < 1')}: ${mark('arcsin(c)')} and ${mark('π − arcsin(c)')}; ${mark('cos = c')} has ${mark('±arccos(c)')}. None when ${mark('|c| > 1')}.`,
          `Maxima are where the sine or cosine is ${mark('1')} (or ${mark('−1')} when ${mark('A < 0')}), minima the other way.`,
        ],
        mistakes: [
          `Forgetting the ${mark('k')}: the period of ${mark(`sin(2${v})`)} is ${mark('π')}, not ${mark('2π')}; ${mark(`sin(−2${v})`)} has period ${mark('π')} too, not ${mark('−π')}.`,
          'Listing a few intercepts as if they were all of them, instead of giving the pattern with n.',
          `Reading the amplitude off the first peak without the midline: ${mark(`A·sin(k${v}) + d`)} peaks at ${mark('d + |A|')}.`,
          `Giving only ${mark('arcsin(c)')}: the second solution in each period, ${mark('π − arcsin(c)')}, is missed.`,
        ],
      };
    case 'periodic: asymptotes':
      return {
        tips: [
          `${mark(`tan(k${v})`)} and ${mark(`cot(k${v})`)} have period ${mark('π/|k|')} (for ${mark('k ≠ 0')}); ${mark('sec')} and ${mark('csc')} have ${mark('2π/|k|')}.`,
          `${mark(`tan(${v})`)} and ${mark(`sec(${v})`)} have a vertical asymptote wherever ${mark(`cos(${v}) = 0`)}; ${mark(`cot(${v})`)} and ${mark(`csc(${v})`)} wherever ${mark(`sin(${v}) = 0`)}.`,
          'Analyse one period, then repeat: the intercepts and asymptotes come back each period, so give them as patterns in n.',
          `${mark('tan')} takes every real value on each period, so its range is all real numbers; ${mark('sec')} and ${mark('csc')} never take values strictly between ${mark('−1')} and ${mark('1')}.`,
        ],
        mistakes: [
          `Using ${mark('2π')} as the period of ${mark('tan')}: it repeats every ${mark('π')}.`,
          'Listing a few asymptotes instead of the pattern with n.',
          `Putting a tangent's asymptotes where ${mark('sin = 0')}: those are its zeros.`,
        ],
      };
    case 'logarithm product':
      return {
        tips: [
          `${mark(`${v}·ln(${v})`)} is defined for ${mark(`${v} > 0`)}, and as ${mark(`${v} → 0⁺`)} it tends to ${mark('0')}: the factor ${mark(v)} shrinks faster than ${mark(`ln(${v})`)} grows in size, so there is no vertical asymptote at ${mark('0')}, unlike ${mark(`ln(${v})`)} alone.`,
          `The product rule gives ${mark(`(${v}·ln(${v}))′ = ln(${v}) + 1`)}, which is ${mark('0')} only at ${mark(`${v} = 1/e`)}: negative before, positive after.`,
          `A single critical point that is a minimum on an interval, with the function rising away on both sides, is the least value: the range starts there.`,
          `The zeros are where a factor is ${mark('0')} inside the domain: ${mark(`ln(${v}) = 0`)} at ${mark(`${v} = 1`)} (the factor ${mark(v)} is ${mark('0')} only at the excluded ${mark('0')}).`,
        ],
        mistakes: [
          `Giving ${mark(`${v}·ln(${v})`)} a vertical asymptote at ${mark('0')} because ${mark(`ln(${v})`)} has one.`,
          `Differentiating ${mark(`${v}·ln(${v})`)} as ${mark(`1/${v}`)}: the product rule adds ${mark(`ln(${v})·1`)}.`,
          `Listing ${mark(`${v} = 0`)} as an x-intercept: it is not in the domain.`,
        ],
      };
    case 'logarithm':
      return {
        tips: [
          `A logarithm is defined only for a positive argument: the domain is where the inside is ${mark('> 0')}.`,
          `${mark(`ln(${v})`)} has a vertical asymptote at ${mark(`${v} = 0`)} and crosses the x-axis at ${mark(`${v} = 1`)}; it grows without bound, slowly.`,
          `Inside a shift, ${mark(`ln(${v} − a)`)} moves the asymptote to ${mark(`${v} = a`)} and the x-intercept to ${mark(`${v} = a + 1`)}.`,
          `${mark('ln(g) = 0')} exactly when ${mark('g = 1')}: that gives the x-intercepts.`,
        ],
        mistakes: [
          `Allowing ${mark(`${v} = 0`)} or negative values in the domain.`,
          'Saying a logarithm has a horizontal asymptote: it keeps growing, however slowly.',
          `Splitting ${mark('ln(a + b)')} into ${mark('ln a + ln b')}.`,
          `Setting ${mark('ln(g) = 0')} at ${mark('g = 0')}: the logarithm is ${mark('0')} at ${mark('g = 1')}.`,
        ],
      };
    case 'rational':
    case 'rational: hole':
    case 'rational: slant': {
      const tips = [
        `Factor the numerator and the denominator and cancel common factors. Then look at each excluded input in the simplified form: a finite value there is a hole; a zero of the simplified denominator is a vertical asymptote (${mark('x/x^2 = 1/x')} still has one at ${mark('0')}).`,
        `The horizontal asymptote comes from the degrees: top lower → ${mark('y = 0')}; equal → the ratio of the leading coefficients; top higher by one → a slant asymptote, the quotient of the division.`,
        'Test the sign on each side of a vertical asymptote to see whether the curve goes up or down there.',
        `A denominator with no real roots (${mark(`${v}^2 + 1`)}) excludes nothing: the domain is all real numbers.`,
        `The x-intercepts are the zeros of the numerator that are not zeros of the denominator.`,
      ];
      if (family === 'rational: slant') tips.splice(1, 0, `When the top's degree is one more than the bottom's, divide: ${mark('f = (ax + b) + r/q')}, and ${mark('y = ax + b')} is the slant asymptote, since ${mark('r/q → 0')}.`);
      if (family === 'rational: hole') tips.splice(1, 0, `A hole sits where a cancelled factor was ${mark('0')}, when the simplified function has a finite value there; that value is its height.`);
      return {
        tips,
        mistakes: [
          'Calling a hole an asymptote: after cancelling, the function is defined everywhere near the hole except at that one point.',
          `Calling every cancelled factor a hole: ${mark('x/x^2')} cancels to ${mark('1/x')}, which still blows up at ${mark('0')}.`,
          'Thinking a graph can never cross its horizontal asymptote: it can, for finite x; the asymptote describes the ends.',
          `Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there. Simplify, then check whether that point is a hole or a vertical asymptote.`,
          `Using the ratio of leading coefficients when the degrees differ: that rule is for equal degrees only.`,
        ],
      };
    }
    case 'exponential product':
      return {
        tips: [
          `${mark('e^(…)')} is never ${mark('0')}, so the zeros of a product with it are the zeros of the other factor, and so are the zeros of its derivative once ${mark('e^(…)')} is factored out.`,
          `A polynomial times ${mark(`e^(−${v})`)} tends to ${mark('0')} as ${mark(`${v} → ∞`)}: the exponential wins over every power, which is the horizontal asymptote on that side.`,
          `Extrema come from ${mark(`f′ = 0`)} with the product rule: ${mark(`(${v}·e^(−${v}))′ = e^(−${v})(1 − ${v})`)}.`,
          `The two ends differ: ${mark(`${v}·e^(−${v})`)} → 0 on the right and → ${mark('−∞')} on the left.`,
        ],
        mistakes: [
          `Giving ${mark('e^(…)')} a zero: the x-intercepts come from the other factor only.`,
          `Dropping the product rule: ${mark(`(${v}·e^(−${v}))′`)} is ${mark(`e^(−${v}) − ${v}·e^(−${v})`)}, not ${mark(`−e^(−${v})`)}.`,
          `Assuming the same end behaviour on both sides: ${mark(`e^(−${v})`)} shrinks on the right and grows on the left.`,
        ],
      };
    case 'exponential':
      return {
        tips: [
          `${mark(`a·b^${v} + k`)} (with ${mark('b > 0')}, ${mark('b ≠ 1')}) has the horizontal asymptote ${mark('y = k')} on one side, and never reaches it: ${mark(`b^${v}`)} is positive for every ${mark(v)}.`,
          `${mark(`b^${v}`)} grows for ${mark('b > 1')} and decays for ${mark('0 < b < 1')}; it passes through ${mark('(0, 1)')}.`,
          `The x-intercept of ${mark(`a·b^${v} + k`)} solves ${mark(`b^${v} = −k/a`)}: one when ${mark('−k/a > 0')}, by a logarithm, and none otherwise.`,
          'A shift up or down moves the horizontal asymptote with it; the range is everything on one side of it.',
        ],
        mistakes: [
          `Giving ${mark(`e^${v}`)} an x-intercept: ${mark(`e^${v} = 0`)} has no solution.`,
          'Treating exponential growth like a power: it eventually outgrows every polynomial.',
          `Forgetting that ${mark(`e^(−${v})`)} decays: the minus sign flips the graph.`,
        ],
      };
    case 'root':
      return {
        tips: [
          `A square root needs a radicand ${mark('≥ 0')}: solve that inequality for the domain.`,
          `${mark(`√${v}`)} starts at the edge of its domain and rises slowly; that starting point is its minimum.`,
          `The range starts at ${mark('0')} (or the shift) and has no upper bound${has(/sqrt\s*\(\s*-?\d*\s*-\s*\w*\^2|sqrt\(\s*\d+\s*-/) ? ', unless the radicand is bounded above, as in a semicircle' : ''}.`,
          `${mark(`√(r^2 − ${v}^2)`)} is the top half of a circle of radius ${mark('r')}: its domain is ${mark(`−r ≤ ${v} ≤ r`)} and its range ${mark('0 ≤ y ≤ r')}.`,
        ],
        mistakes: [
          'Including values that make the radicand negative.',
          'Missing the endpoint minimum because there is no turning point there.',
          `Writing ${mark('√(a + b)')} as ${mark('√a + √b')}.`,
        ],
      };
    case 'other':
      return {
        tips: [
          'Domain first, then intercepts, then the derivative for extrema and the second derivative for concavity, then what happens at the ends.',
          `Critical points come from solving ${mark(`f′(${v}) = 0`)} and from where ${mark(`f′`)} does not exist; the sign of ${mark(`f′`)} on each side says maximum, minimum or neither.`,
          `A point located numerically is shown with ${mark('≈')}: its exact value may have no closed form (the extrema of ${mark('sin(x)/x')} solve ${mark('tan(x) = x')}).`,
          'Check each feature by substituting: a claimed intercept must give 0, a claimed extremum must beat its neighbours.',
        ],
        mistakes: [
          `Calling every root of ${mark(`f′`)} an extremum: ${mark(`f′`)} must change sign there.`,
          'Reading the end behaviour from a few plotted points instead of the dominant term for large x.',
          `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
        ],
      };
    default:
      return {
        tips: [
          `Critical points come from solving ${mark(`f′(${v}) = 0`)}; the sign of ${mark(`f′`)} on each side says maximum, minimum or neither.`,
          `The leading term decides the ends: ${mark(`${v}^3`)} falls on the left and rises on the right; ${mark(`−${v}^4`)} falls on both sides.`,
          `A polynomial of degree ${mark('n')} has at most ${mark('n')} real roots and at most ${mark('n − 1')} turning points; inflection points are where ${mark(`f″`)} changes sign.`,
          `An odd-degree polynomial takes every real value; an even-degree one has a least value (positive leading coefficient) or a greatest, at a critical point.`,
          `A root of even multiplicity touches the axis without crossing (${mark(`(${v} − 1)^2`)} at ${mark(`${v} = 1`)}); a root of odd multiplicity crosses, even when repeated (${mark(`(${v} − 1)^3`)}).`,
        ],
        mistakes: [
          `Calling every root of ${mark(`f′`)} an extremum: ${mark(`${v}^3`)} has ${mark(`f′(0) = 0`)} but no turning point.`,
          'Reading the end behaviour from the constant term instead of the leading term.',
          `Confusing an x-intercept (${mark(`${fx} = 0`)}) with the y-intercept (${mark(`${v} = 0`)}).`,
          'Missing a root where the graph only touches the axis: a sign change finds crossings, not touches.',
          `Thinking every repeated root only touches the axis: ${mark(`(${v} − 1)^3`)} crosses it at ${mark(`${v} = 1`)}.`,
        ],
      };
  }
}

// r/q with brackets only where they are needed: 2/(x − 1).
export function fraction(r, q) {
  const wrap = (t) => (/^-?[\w.^√]+$/.test(t) ? t : `(${t})`);
  return `${wrap(r)}/${wrap(q)}`;
}

// The family's first insight applied to this function, from its features.
function worked(family, func, v, f) {
  const n = (x) => formatNumber(x);
  const point = (e) => `${e.approx ? '≈ ' : ''}(${e.xText}, ${e.yText})`;
  const extremaText = () => f.extrema.map((e) => `a ${e.kind === 'max' ? 'maximum' : 'minimum'} ${point(e)}`).join(' and ');
  switch (family) {
    case 'quadratic': {
      const q = f.quadratic;
      const b = -2 * q.a * q.axis;
      const e = exactNumber;
      return `Here: ${mark(`a = ${e(q.a)}`)} and ${mark(`b = ${e(b)}`)}, so ${mark(`${v} = −b/(2a) = ${e(q.axis)}`)}, and ${mark(`f(${e(q.axis)}) = ${e(q.vertex.y)}`)}: the vertex is ${mark(`(${e(q.vertex.x)}, ${e(q.vertex.y)})`)}, a ${q.opensUpward ? 'minimum' : 'maximum'}.`;
    }
    case 'absolute value': {
      if (f.absWave) return `Here: the corners are where ${mark(`${f.absWave.inside} = 0`)}, at ${mark(`${v} = ${f.absWave.zeros}`)}: minima of value ${mark('0')}, with maxima ${mark(f.absWave.maxima.y)} halfway between, so the range is ${mark(f.absWave.range.text)}.`;
      const corners = f.extrema.filter((e) => e.origin === 'cusp');
      const inside = (() => { try { return math.parse(String(func)).filter((x) => x.type === 'FunctionNode' && x.fn?.name === 'abs').map((x) => beautify(x.args[0].toString()))[0]; } catch { return null; } })();
      if (!corners.length || !inside) return null;
      return `Here: the corner${corners.length > 1 ? 's are' : ' is'} where ${mark(`${inside} = 0`)}, at ${mark(`${v} = ${corners.map((e) => e.xText).join(', ')}`)}: ${corners.map((e) => `a ${e.kind === 'max' ? 'maximum' : 'minimum'} ${mark(point(e))}`).join(' and ')}.`;
    }
    case 'cusp': {
      const c = f.extrema.find((e) => e.origin === 'cusp');
      return c && f.derivative ? `Here: ${mark(`f′(${v}) = ${f.derivative}`)} does not exist at ${mark(`${v} = ${c.xText}`)}, and ${mark(point(c))} is a ${c.kind === 'max' ? 'maximum' : 'minimum'}.` : null;
    }
    case 'periodic': {
      const w = f.wave;
      if (!w) return null;
      const typedK = /^-/.test(w.arg) ? -w.k : w.k;
      return `Here: ${mark(`A = ${n(w.typedCoef)}`)}, ${mark(`k = ${n(typedK)}`)} and ${mark(`d = ${n(w.d)}`)}, so the amplitude is ${mark(n(Math.abs(w.coef)))}, the period ${mark(w.k === 1 ? w.period : `2π/${typedK < 0 ? `|${n(typedK)}|` : n(w.k)} = ${w.period}`)} and the midline ${mark(`y = ${n(w.d)}`)}.`;
    }
    case 'periodic: asymptotes': {
      const near = f.verticalAsymptotes.filter((a) => Math.abs(a) < 4);
      return near.length ? `Here: the asymptotes nearest ${mark('0')} are at ${mark(`${v} = ${near.map((a) => piForm(a) ?? n(a)).join(', ')}`)}, and the pattern repeats.` : null;
    }
    case 'logarithm': {
      const arg = String(func).match(/(?<![a-z])(?:ln|log)\(([^()]+)\)/);
      if (!arg) return null;
      const inside = beautify(arg[1]);
      const edge = f.domain.find((r) => r.from === -Infinity && Number.isFinite(r.to));
      const domain = edge ? `, so the domain is ${mark(`${v} ${edge.toClosed ? '>' : '≥'} ${n(edge.to)}`)}` : '';
      const asym = f.verticalAsymptotes.length ? ` and the vertical asymptote is ${mark(`${v} = ${n(f.verticalAsymptotes[0])}`)}` : '';
      return `Here: the inside ${mark(inside)} must be ${mark('> 0')}${domain}${domain ? asym : asym.replace(/^ and/, ', so')}.`;
    }
    case 'logarithm product': {
      const min = f.extrema[0];
      if (!min || !f.derivative) return null;
      return `Here: ${mark(`f′(${v}) = ${f.derivative}`)} is ${mark('0')} at ${mark(`${v} = ${min.xText}`)}, the ${min.kind === 'min' ? 'minimum' : 'maximum'} ${mark(point(min))}${f.range ? `, so the range is ${mark(f.range.text)}` : ''}.`;
    }
    case 'rational: slant':
      return `Here: dividing, ${mark(`${beautify(func)} = ${f.slant.line} + ${fraction(f.slant.remainder, f.slant.den)}`)}, so the slant asymptote is ${mark(`y = ${f.slant.line}`)}.`;
    case 'rational: hole': {
      const h = f.holes[0];
      return h.simplified ? `Here: ${mark(`${beautify(func)} = ${beautify(h.simplified)}`)} for ${mark(`${v} ≠ ${n(h.x)}`)}, so there is a hole at ${mark(`(${n(h.x)}, ${h.yText ?? n(h.y)})`)}.` : null;
    }
    case 'rational':
      if (f.domainWhy) return `Here: ${f.domainWhy}`;
      if (f.reduced && f.verticalAsymptotes.length) return `Here: ${mark(`${beautify(func)} = ${f.reduced}`)} for ${mark(`${v} ≠ ${f.verticalAsymptotes.map((x) => n(x)).join(', ')}`)}, and the simplified denominator is still ${mark('0')} there, so ${f.verticalAsymptotes.length > 1 ? 'those are vertical asymptotes' : 'that is a vertical asymptote'}, not a hole.`;
      return f.verticalAsymptotes.length
        ? `Here: the denominator is ${mark('0')} at ${mark(`${v} = ${f.verticalAsymptotes.map((a) => n(a)).join(', ')}`)} and nothing cancels, so ${f.verticalAsymptotes.length > 1 ? 'those are vertical asymptotes' : 'that is a vertical asymptote'}${typeof f.horizontalAsymptote === 'number' ? `; the degrees give ${mark(`y = ${n(f.horizontalAsymptote)}`)}` : ''}.`
        : null;
    case 'exponential product':
      return f.derivative && f.extrema.length ? `Here: ${mark(`f′(${v}) = ${f.derivative}`)}, and only the factor without the exponential can be ${mark('0')}: ${extremaText().replace(/\(([^)]*)\)/g, (m) => mark(m))}.` : null;
    case 'exponential': {
      const k = f.range && /^y [<>] /.test(f.range.text) ? f.range.text.replace(/^y [<>] /, '') : null;
      if (k === null) return null;
      const crosses = f.xIntercepts.list.length ? `it crosses the x-axis at ${mark(`${v} = ${f.xIntercepts.list.map((r) => r.display).join(', ')}`)}` : 'it never crosses the x-axis';
      return `Here: the horizontal asymptote is ${mark(`y = ${k}`)}, the range is ${mark(f.range.text)}, and ${crosses}.`;
    }
    case 'root': {
      const ends = f.endpointExtrema;
      if (!ends.length) return null;
      if (ends.length === 2 && f.extrema.length) {
        // A semicircle: both endpoints and the top.
        const top = f.extrema[0];
        return `Here: the graph runs from ${mark(`(${n(ends[0].x)}, ${n(ends[0].y)})`)} up to its highest point ${mark(point(top))} and down to ${mark(`(${n(ends[1].x)}, ${n(ends[1].y)})`)}${f.range ? `, so the range is ${mark(f.range.text)}` : ''}.`;
      }
      const end = ends[0];
      return `Here: the radicand is ${mark('≥ 0')} on the domain, and the graph ${end.side === 1 ? 'starts' : 'ends'} at ${mark(`(${n(end.x)}, ${n(end.y)})`)}, ${end.kind === 'min' ? 'its minimum' : 'its maximum'} there.`;
    }
    case 'other':
    case 'polynomial':
      // f′ = 0 without a sign change: (x − 1)³ (1.64.0, second review).
      if (f.derivative && !f.extrema.length && f.stationary?.length) {
        const r = f.stationary[0];
        const at = (x) => { try { return Number(math.evaluate(String(func), { [v]: x })); } catch { return NaN; } };
        const crosses = Math.abs(at(r.numeric)) < 1e-12 && at(r.numeric - 1e-3) * at(r.numeric + 1e-3) < 0;
        return `Here: ${mark(`f′(${v}) = ${f.derivativeFactored ?? f.derivative}`)} is ${mark('0')} at ${mark(`${v} = ${r.display}`)} but does not change sign there, so there is no maximum or minimum${crosses ? `, and the graph crosses the x-axis at ${mark(`${v} = ${r.display}`)}` : ''}.`;
      }
      if (!f.derivative || !f.extrema.length) return null;
      return `Here: ${mark(`f′(${v}) = ${f.derivative}`)} is ${mark('0')} at ${mark(xList(f.extrema.map((e) => ({ display: e.xText, approx: e.approx })), v))}${f.extrema.some((e) => e.approx) ? ' (located numerically)' : ''}, and it changes sign at each: ${f.extrema.map((e) => `a ${e.kind === 'max' ? 'maximum' : 'minimum'} ${mark(point(e))}`).join(', ')}.`;
    default:
      return null;
  }
}

export function functionGuidance(func, v, f) {
  const family = familyOf(func, v, f);
  const list = lists(family, v, func);
  let here = null;
  try { here = worked(family, func, v, f); } catch { here = null; }
  const tips = [list.tips[0], ...(here ? [here] : []), ...list.tips.slice(1)];
  return { tips: [...new Set(tips)], common_mistakes: [...new Set(list.mistakes)] };
}

// Does the variable appear outside every logarithm? x·ln(x) yes, ln(x − 2) no.
function variableOutsideLog(func, v) {
  try {
    let count = 0;
    const walk = (n, inLog) => {
      if (!n) return;
      if (n.type === 'SymbolNode' && n.name === v && !inLog) count += 1;
      if (n.type === 'FunctionNode' && (n.fn?.name === 'ln' || n.fn?.name === 'log')) { n.args.forEach((a) => walk(a, true)); return; }
      if (n.type === 'ParenthesisNode') { walk(n.content, inLog); return; }
      (n.args || []).forEach((a) => walk(a, inLog));
    };
    walk(math.parse(String(func)), false);
    return count > 0;
  } catch {
    return false;
  }
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

