// Tips and mistakes for inequalities, chosen by the method used, ranked,
// with a worked "Here: …" line second: the method's first insight applied
// to this problem (1.66.0, after integrals, derivatives, algebra, limits,
// functions and trigonometry). The solver hands over `guide`, the numbers
// its own steps were written from, so the worked line says what the steps
// say.

import { mark } from '../solverUtils.js';

const dedupe = (list) => [...new Set(list.filter(Boolean))];
const assemble = (tips, here, mistakes) => ({ tips: dedupe([tips[0], here, ...tips.slice(1)]), common_mistakes: dedupe(mistakes) });
const pretty = (op) => ({ '<=': '≤', '>=': '≥' }[op] || op);
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// --- Linear ---------------------------------------------------------------------

const LINEAR = {
  tips: [
    'Solve a linear inequality like a linear equation, with one extra rule: multiplying or dividing both sides by a negative number reverses the inequality sign.',
    'Adding or subtracting the same amount on both sides never changes the direction, and neither does multiplying or dividing by a positive number.',
    'Check with two numbers: one from the answer must make the original true, one from outside it must make it false.',
    `The boundary is part of the answer for ${mark('≤')} and ${mark('≥')} (a closed dot, a square bracket) and not for ${mark('<')} and ${mark('>')} (an open dot, a round bracket).`,
    `Polynomial and rational inequalities (${mark('x² − 4 > 0')}) need a sign chart instead: move everything to one side and test each interval.`,
  ],
  mistakes: [
    'Forgetting to reverse the sign when dividing by a negative number.',
    'Reversing the sign when adding or subtracting: only multiplying or dividing by a negative flips it.',
    `Reading ${mark('−2 > x')} as ${mark('x > −2')}: read from the ${mark('x')}, it says ${mark('x < −2')}.`,
    `Using a closed endpoint (${mark('≤')}, a bracket) for a strict inequality, or an open one for ${mark('≤')}.`,
  ],
};

function linearHere(g) {
  const result = mark(g.answer);
  if (g.a === 1) return `Here: collecting the terms already leaves ${result}; nothing is divided, so nothing is reversed.`;
  if (g.a === -1) return `Here: multiplying by ${mark('−1')} makes the ${mark(g.variable)} positive and reverses ${mark(pretty(g.op))} to ${mark(pretty(g.finalOp))}: ${result}.`;
  const by = g.reciprocal ? `multiplying by ${mark(g.reciprocal)}` : `dividing by ${mark(g.aText)}`;
  return g.a < 0
    ? `Here: ${by}, a negative number, reverses ${mark(pretty(g.op))} to ${mark(pretty(g.finalOp))}: ${result}.`
    : `Here: ${by}, a positive number, keeps ${mark(pretty(g.op))}: ${result}.`;
}

// --- Sign charts --------------------------------------------------------------

// The domain list's third insight, for the function the problem has.
const LOG_TIP = `Then solve as usual on the domain: ${mark('ln(x) < 1')} is ${mark('x < e')} there, because ln is increasing.`;
const ROOT_TIP = `A square root is never negative: ${mark('√u ≤ 0')} holds only where ${mark('u = 0')}, ${mark('√u < 0')} nowhere, and ${mark('√u ≥ 0')} on the whole domain.`;

const CHART = {
  polynomial: {
    tips: [
      'A polynomial can change sign only at its real zeros: they split the number line into intervals, and on each interval the sign is the same throughout.',
      'One test point per interval is enough: a polynomial cannot change sign without passing through 0, and there is no zero inside an interval.',
      `At a zero of odd multiplicity the sign changes; at a zero of even multiplicity, such as ${mark('x = 1')} in ${mark('(x − 1)²')}, it does not, and the intervals on both sides share a sign.`,
      `For ${mark('≤')} and ${mark('≥')} the zeros themselves are solutions; for ${mark('<')} and ${mark('>')} they are not.`,
      `Move everything to one side first and compare with ${mark('0')}: the sign of one expression is what the chart reads.`,
    ],
    mistakes: [
      `Dividing both sides by an expression in ${mark('x')}: ${mark('x² > x')} divided by ${mark('x')} gives ${mark('x > 1')} and loses ${mark('x < 0')}, because the sign of ${mark('x')} is unknown.`,
      'Reporting the zeros as the answer: they are only the places where the sign can change.',
      'Assuming the signs alternate from interval to interval: at a zero of even multiplicity they do not.',
      `Taking square roots of ${mark('x² > 4')} as ${mark('x > 2')}: it is ${mark('|x| > 2')}, that is ${mark('x < −2')} or ${mark('x > 2')}.`,
    ],
  },
  rational: {
    tips: [
      'A rational expression can change sign at a zero of its numerator and at a zero of its denominator: both kinds of point go on the sign chart.',
      `A zero of the denominator is never in the solution, not even for ${mark('≤')} or ${mark('≥')}: the expression is undefined there.`,
      'Do not multiply both sides by the denominator: its sign changes from interval to interval. If you must clear it, multiply by its square, which is never negative.',
      `For ${mark('≤')} and ${mark('≥')} a zero of the numerator is a solution where the denominator is not ${mark('0')} (in ${mark('(x² − 1)/(x − 1) ≥ 0')}, ${mark('x = 1')} zeroes both and is out); for ${mark('<')} and ${mark('>')} it is not.`,
    ],
    mistakes: [
      'Multiplying both sides by the denominator as if it were positive.',
      `Including a zero of the denominator because the inequality is ${mark('≤')} or ${mark('≥')}.`,
      'Reporting the zeros as the answer: they are only the places where the sign can change.',
    ],
  },
  holes: {
    tips: [
      `A factor that cancels still leaves its point out: ${mark('(x² − 1)/(x − 1)')} is ${mark('x + 1')} everywhere except ${mark('x = 1')}, where the expression as written divides by ${mark('0')}.`,
      'Find where the expression is undefined before simplifying it; the simplified form no longer shows those points.',
      'A zero of the numerator and a zero of the denominator both go on the sign chart.',
    ],
    mistakes: [
      'Cancelling a common factor and forgetting the point where it was 0.',
      'Solving the simplified inequality alone and reporting a value at which the original is undefined.',
    ],
  },
  abs: {
    tips: [
      `${mark('|g| < c')} with ${mark('c > 0')} means ${mark('−c < g < c')}, within ${mark('c')} of ${mark('0')}; ${mark('|g| > c')} means ${mark('g < −c')} or ${mark('g > c')}, farther than ${mark('c')} from ${mark('0')}.`,
      `${mark('|a − b|')} is the distance between ${mark('a')} and ${mark('b')}: ${mark('|x − 3| > 2')} is every ${mark('x')} more than ${mark('2')} from ${mark('3')}.`,
      `${mark('|g| < c')} has no solution when ${mark('c ≤ 0')}, and ${mark('|g| > c')} holds wherever ${mark('g')} is defined when ${mark('c < 0')}.`,
      'With a variable on the other side, the shortcut does not apply: split into the cases g ≥ 0 and g < 0, or use a sign chart.',
    ],
    mistakes: [
      `Writing ${mark('|g| > c')} as the chain ${mark('−c > g > c')}: no number is both, so the "greater than" case is two pieces joined by "or".`,
      `Dropping the bars and solving ${mark('g < c')} alone: the values with ${mark('g < −c')} are lost (for "less than", the values with ${mark('g ≤ −c')} are wrongly kept).`,
      `Reversing a sign inside the chain only on one side when dividing by a negative.`,
    ],
  },
  absChart: {
    tips: [
      `An absolute value changes form where its inside is ${mark('0')}: with a variable on both sides, the sign chart tests each interval on the original inequality.`,
      `The shortcut ${mark('|g| < c')} ⇔ ${mark('−c < g < c')} needs ${mark('c')} to be a positive number; with anything else on the other side, the sign chart decides.`,
      'Test one point in each interval; the whole interval shares that sign.',
    ],
    mistakes: [
      'Applying the shortcut for |g| < c when c is not a positive number.',
      'Dropping the bars and solving without them: half of the cases are lost.',
    ],
  },
  domain: {
    tips: [
      `First find where the expression is defined: ${mark('ln(u)')} needs ${mark('u > 0')}, ${mark('√u')} needs ${mark('u ≥ 0')}. The answer can only come from there.`,
      LOG_TIP,
      `An edge of the domain is in the answer only when the inequality holds there: ${mark('√x ≥ 0')} includes ${mark('x = 0')}, while ${mark('ln(x)')} is never defined at ${mark('0')}.`,
      'The edges of the domain go on the sign chart with the zeros.',
    ],
    mistakes: [
      `Solving ${mark('ln(x) < 1')} as ${mark('x < e')} and keeping ${mark('x ≤ 0')}, where ln is undefined.`,
      `Squaring both sides of ${mark('√u < c')} and forgetting the condition ${mark('u ≥ 0')}.`,
      `Leaving out the edge of a square root's domain when the inequality holds there (${mark('√(x − 1) ≤ 0')} is ${mark('x = 1')}).`,
    ],
  },
  transcendental: {
    tips: [
      `An inequality that mixes ${mark('x')} with ${mark('eˣ')}, ${mark('ln(x)')} or a trig function usually has no boundary in elementary closed form: the zeros are located numerically, named and shown with ≈, and proved to be all of them.`,
      'Between consecutive turning points the expression only rises or only falls, so it crosses zero at most once there: the signs at the two ends decide whether it does.',
      `At ±∞, and at the edge of a logarithm's domain, the fastest-growing term decides the sign: an exponential outgrows any power of ${mark('x')}, and a power outgrows any power of ${mark('ln(x)')}.`,
      'A table of values can miss two zeros close together, or a zero far out; the turning points are what rule that out.',
    ],
    mistakes: [
      `Expecting an elementary closed form: ${mark('x − ln(x) = 2')} has none (its roots need the Lambert W function, ${mark('x = −W(−e^(−2))')} on its two branches), so the boundaries are located numerically, and the decimals are rounded.`,
      `Searching a fixed window: ${mark('e^(x/20) > x')} fails again past ${mark('x ≈ 89.995')}.`,
      `Forgetting the domain of ${mark('ln(x)')}: only ${mark('x > 0')} can be in the answer.`,
    ],
  },
  exponential: {
    tips: [
      `With ${mark('t = eˣ')}, which is always positive, an inequality in ${mark('e^(2x)')}, ${mark('eˣ')} and constants is a polynomial inequality in ${mark('t')}; each positive root ${mark('t')} gives one ${mark('x = ln(t)')}.`,
      `A root ${mark('t ≤ 0')} gives no ${mark('x')}: ${mark('eˣ')} is never zero or negative.`,
      `${mark('2^x')} and ${mark('4^x = (2^x)²')} work the same way with ${mark('t = 2^x')}; ${mark('sinh')}, ${mark('cosh')} and ${mark('tanh')} are made of ${mark('eˣ')} and ${mark('e^(−x)')}, so ${mark('t = eˣ')} applies after multiplying through by ${mark('t')}.`,
      `${mark('eˣ')} is increasing, so ${mark('eˣ > c')} is ${mark('x > ln(c)')} for ${mark('c > 0')}; the direction is kept.`,
    ],
    mistakes: [
      `Keeping a root ${mark('t ≤ 0')} and taking its logarithm.`,
      `Writing ${mark('e^(2x)')} as ${mark('2eˣ')}: it is ${mark('(eˣ)²')}.`,
      'Solving for t and forgetting to turn each value back into x.',
    ],
  },
  wave: {
    tips: [
      `A sine or cosine compared with a line usually has no boundary in closed form: since the wave stays between ${mark('−1')} and ${mark('1')}, every zero lies where the line does too, and there they are counted and located.`,
      'Between consecutive zeros of the sine (or cosine) the difference is concave or convex, so it has at most two zeros there: counting them piece by piece gives all of them.',
      'Then test the sign between consecutive zeros, as on any sign chart.',
    ],
    mistakes: [
      'Searching for zeros without a bound: outside the strip where the line stays between −1 and 1 there are none, and inside it a scan can miss two that are close together.',
      `Expecting a closed form: the zeros of ${mark('sin(x) = x/2')} other than ${mark('0')} have none in elementary functions, so they are located numerically.`,
    ],
  },
};

function chartHere(g) {
  const rows = g.rows.map((r) => `${mark(r.interval)} ${r.sign}`).join(', ');
  // "every real number" and "no solution" are words, not math.
  const kept = g.answerIsMath ? mark(g.answer) : g.answer;
  switch (g.kind) {
    case 'abs':
      if (g.abs) return `Here: ${mark(`${g.abs.text}`)} means ${mark(g.abs.unfolded)}, and solving that gives ${kept}.`;
      return null;
    case 'domain':
      return g.edges.length
        ? `Here: the expression is defined only where ${mark(g.domainText)}, so the domain ends at ${mark(`${g.variable} = ${list(g.edges)}`)}; testing the intervals there gives ${kept}.`
        : null;
    case 'holes':
      return `Here: the expression as written is undefined at ${mark(`${g.variable} = ${list(g.holes)}`)}, even though that factor cancels, so that point stays out: ${kept}.`;
    case 'transcendental':
      if (!g.proof) return null;
      return `Here: ${mark(g.moved)} ${g.proof}: ${g.zeros.length ? `${mark(g.zerosText)}, and no others` : 'none'}.`;
    case 'wave':
      return g.proof ? `Here: ${g.proof}: ${mark(g.zerosText)}.` : null;
    case 'exponential': {
      const sub = g.substitution;
      if (!sub) return null;
      const poly = ` ${sub.whole ? 'it is' : 'its numerator is'} ${mark(`${sub.polynomial} = 0`)}`;
      return `Here: with ${mark(`t = ${sub.t}`)}${poly}${sub.roots.length ? `, so ${mark(`t = ${sub.roots.join(', ')}`)}` : ''}, and ${mark(`${g.variable} = ${list(g.zeros)}`)}; ${g.zeros.length ? `the sign between them gives ${kept}` : `it keeps one sign: ${g.answer}`}.`;
    }
    case 'rational': {
      const ends = `the numerator is ${mark('0')} at ${mark(`${g.variable} = ${list(g.zeros)}`)} and the denominator at ${mark(`${g.variable} = ${list(g.poles)}`)}`;
      return g.zeros.length ? `Here: ${ends}; the sign is ${rows}, so ${kept}${g.nonStrict ? ', the denominator\'s zero left out' : ''}.` : `Here: the denominator is ${mark('0')} at ${mark(`${g.variable} = ${list(g.poles)}`)}; the sign is ${rows}, so ${kept}.`;
    }
    default: {
      if (!g.zeros.length) return null;
      const even = g.even.length ? ` The sign does not change at ${mark(`${g.variable} = ${list(g.even)}`)}, a zero of even multiplicity.` : '';
      return `Here: ${mark(g.moved)} is ${mark('0')} at ${mark(`${g.variable} = ${list(g.zeros)}`)}; testing the intervals gives ${rows}, so ${kept}.${even}`;
    }
  }
}

// --- Periodic, compound, and the rest -------------------------------------------

// Taking the calculator's one inverse value, said for the function the
// inequality has; at c = ±1 the two values are one.
const INVERSE = {
  sin: `Using arcsin alone: for ${mark('−1 < c < 1')}, ${mark('sin(x) = c')} has a second zero in each period, ${mark('π − arcsin(c)')} (at ${mark('c = ±1')} the two are the same point, the top or the bottom of the wave).`,
  cos: `Using arccos alone: for ${mark('−1 < c < 1')}, ${mark('cos(x) = c')} has a second zero in each period, ${mark('−arccos(c)')} (at ${mark('c = ±1')} the two are the same point, the top or the bottom of the wave).`,
  other: 'Taking only the calculator\'s inverse value: a trig equation usually has more than one solution in each period.',
};

const PERIODIC = {
  tips: [
    'A periodic inequality has infinitely many solution intervals: solve it on one period, then add every multiple of the period to each interval.',
    'Find where the expression is 0 on that period first; the sign can only change there.',
    `For ${mark('sin(x) > c')}, the unit circle shows it at once: the arc of angles whose height is above ${mark('c')}.`,
    `Each zero on the period is found exactly: written in ${mark('t = tan(θ/2)')}, where ${mark('θ')} is the angle inside (${mark('x')} for ${mark('sin(x)')}), the expression becomes a polynomial in ${mark('t')}, whose real roots are counted. The one angle ${mark('t')} never reaches, ${mark('θ = π')}, is checked on its own, so none is missed.`,
  ],
  mistakes: [
    'Giving only the intervals in one period and leaving out "+ a multiple of the period".',
    'Finding one zero in the period and stopping: the sign can change at every zero.',
    INVERSE.sin,
    `Using the wrong period: ${mark('sin(2x)')} repeats every ${mark('π')}, not every ${mark('2π')}.`,
  ],
};

function periodicHere(g) {
  if (!g.zeros.length) return `Here: on one period the expression is never ${mark('0')}, so it keeps one sign: ${g.answer.startsWith('No') ? 'no value satisfies it' : 'every value does'}.`;
  return `Here: on ${mark(`0 ≤ ${g.variable} < ${g.period}`)} the expression is ${mark('0')} at ${mark(list(g.zeros))}; it is ${g.rows.map((r) => `${r.sign} on ${mark(r.interval)}`).join(', ')}, so ${mark(g.pieces)}, for every integer ${mark('n')}.`;
}

const COMPOUND = {
  tips: [
    `"and", or a chain ${mark('a < x < b')}, keeps only the values that satisfy every part; "or" keeps the values that satisfy any part.`,
    'Solve each part on its own first, then combine them on a number line.',
    `A chain ${mark('a < g < b')} with ${mark('g')} linear can be solved all at once: do the same to all three parts, and reverse both signs when multiplying or dividing by a negative.`,
  ],
  mistakes: [
    'Working on only one side of a chain.',
    'Taking the union for "and", or the intersection for "or".',
    `Writing a chain whose inequalities point in different directions (${mark('a < x > b')}): that is two separate statements, not a chain.`,
    'Reversing only one of the two signs of a chain when dividing by a negative.',
  ],
};

function compoundHere(g) {
  const parts = g.parts.map((p, i) => `part ${i + 1} gives ${p.math ? mark(p.answer) : p.answer}`);
  const how = g.mode === 'and' ? 'both must hold, so keep the overlap' : 'either may hold, so keep both';
  return `Here: ${list(parts)}; ${how}: ${g.combinedMath ? mark(g.answer) : g.answer}.`;
}

export function inequalityGuidance(guide) {
  if (!guide) return null;
  try {
    switch (guide.method) {
      case 'linear':
        return assemble(LINEAR.tips, linearHere(guide), LINEAR.mistakes);
      case 'chart': {
        const lists = CHART[guide.kind] || CHART.polynomial;
        // A square root's domain, with no logarithm: the root's own rule, not ln's.
        const tips = guide.kind === 'domain' && !/>\s*0/.test(guide.domainText || '') ? lists.tips.map((t) => (t === LOG_TIP ? ROOT_TIP : t)) : lists.tips;
        return assemble(tips, chartHere(guide), lists.mistakes);
      }
      case 'periodic': {
        // Stopping at the first zero, said with this problem's zeros.
        const base = PERIODIC.mistakes.map((m) => (m === INVERSE.sin ? INVERSE[guide.fn] || INVERSE.other : m));
        const mistakes = guide.zeros.length >= 2
          ? [base[0], `Finding one zero in the period and stopping: on one period the expression is ${mark('0')} at ${mark(guide.zeros.join(' and at '))}, and the sign can change at each.`, ...base.slice(2)]
          : base;
        return assemble(PERIODIC.tips, periodicHere(guide), mistakes);
      }
      case 'compound':
        return assemble(COMPOUND.tips, compoundHere(guide), COMPOUND.mistakes);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
