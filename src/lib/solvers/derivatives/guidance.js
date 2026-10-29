// Tips and mistakes for the derivatives solver, chosen by the rule used.

import { splitTerms, splitTopLevel, stripOuterParens, beautify, hasVariable, mark } from '../solverUtils.js';
import { classifyDerivativeRule } from './rules.js';

// Key Insights and Common Mistakes, chosen by the rules the term-by-term
// walkthrough used. Each rule has a ranked list. The rule a problem depends on
// most (the quotient rule over the chain rule over the power rule…) leads
// with its whole list; every other rule used adds its first insight and
// mistake, unless the lead list already covers that idea; a general insight
// about slope closes. The page shows the first three and the rest behind
// "Show more" (src/lib/guidance.js).
//
// The first three insights use the student's own function where they can
// (1.61.0, outside review): the rule, then the rule applied to this problem
// — the inside and its derivative, u and w with u′ and w′ — then the next
// most useful idea. A task (a higher derivative, a value at a point) leads
// its insights and mistakes, since it decides what the student is doing.

// Most specific first: the first label found decides the lead list.
const PRECEDENCE = [
  ['logdiff', (l) => l === 'Logarithmic differentiation'],
  ['quotient', (l) => l === 'Quotient rule'],
  ['product', (l) => l === 'Product rule'],
  ['chain', (l) => l.startsWith('Chain rule') || l === 'Exponential rule with the chain rule'],
  ['erf', (l) => l === 'Error function rule'],
  ['inverse trig', (l) => l === 'Inverse trig rule'],
  ['hyperbolic', (l) => l === 'Hyperbolic rule'],
  ['trig', (l) => l === 'Trig rule'],
  ['log', (l) => l === 'Logarithmic rule'],
  ['exponential', (l) => l === 'Exponential rule'],
  ['negative power', (l) => l === 'Power rule (negative exponent)'],
  ['power', (l) => l === 'Power rule'],
  ['constant', (l) => l === 'Constant rule'],
];

// A mistake that names an idea another list may also name: only the first
// list's version is kept.
const inner = (text) => ({ text, concept: 'inner derivative' });

// The term without a leading sign or numeric factor.
const bare = (term) => term.replace(/\s+/g, '').replace(/^[-+]?(?:[\d.]+\*?)?/, '');

// f(u) as name and inside, when the whole term is one call: sin(3x^2),
// e^(3x), (2x+1)^5. Null for anything else.
function callOf(term) {
  const t = bare(term);
  const closes = (s, open) => {
    let depth = 0;
    for (let i = open; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') { depth -= 1; if (depth === 0) return i; }
    }
    return -1;
  };
  let m = t.match(/^(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|exp|erf)\(/);
  if (m && closes(t, m[0].length - 1) === t.length - 1) return { name: m[1], inside: t.slice(m[0].length, -1) };
  m = t.match(/^e\^\(/);
  if (m && closes(t, 2) === t.length - 1) return { name: 'exp', inside: t.slice(3, -1) };
  if (t.startsWith('(')) {
    const end = closes(t, 0);
    const power = t.slice(end + 1).match(/^\^\(?(-?\d+(?:\/\d+)?)\)?$/);
    if (end > 0 && power) return { name: 'power', inside: t.slice(1, end), n: power[1] };
  }
  return null;
}

// d/dx of the outside, written at the inside u: cos(u), e^u, 1/u, …
function outerDerivative(call) {
  const u = beautify(call.inside);
  const p = /^(?:[a-z]|\d+(?:\.\d+)?)$/i.test(u) ? u : `(${u})`;
  switch (call.name) {
    case 'sin': return `cos(${u})`;
    case 'cos': return `−sin(${u})`;
    case 'tan': return `sec²(${u})`;
    case 'sec': return `sec(${u})·tan(${u})`;
    case 'csc': return `−csc(${u})·cot(${u})`;
    case 'cot': return `−csc²(${u})`;
    case 'exp': return `e^${p}`;
    case 'ln': return `1/${p}`;
    case 'log': return `1/(${u}·ln(10))`;
    case 'sqrt': return `1/(2√${p})`;
    case 'arcsin': case 'asin': return `1/√(1 − ${p}²)`;
    case 'arccos': case 'acos': return `−1/√(1 − ${p}²)`;
    case 'arctan': case 'atan': return `1/(1 + ${p}²)`;
    case 'sinh': return `cosh(${u})`;
    case 'cosh': return `sinh(${u})`;
    case 'erf': return `(2/√π)·e^(−${p}²)`;
    case 'power': {
      const n = Number(call.n);
      return Number.isFinite(n) ? `${call.n}·${p}^${Number.isInteger(n - 1) ? n - 1 : `(${call.n} − 1)`}` : null;
    }
    default: return null;
  }
}

const shownCall = (call) => (call.name === 'power' ? `(${beautify(call.inside)})^${call.n}` : call.name === 'exp' ? `e^(${beautify(call.inside)})` : `${call.name}(${beautify(call.inside)})`);
// Parentheses only where a sum or difference would otherwise read wrongly.
const wrap = (s) => {
  let depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') depth -= 1;
    else if (depth === 0 && i > 0 && (s[i] === '+' || s[i] === '-' || s[i] === '−')) return `(${s})`;
  }
  return s;
};

// The rule applied to this problem, when its pieces can be read and
// differentiated: null otherwise (the generic list stands).
function worked(rule, term, v, d) {
  if (!term || !d) return null;
  if (rule === 'chain') {
    const call = callOf(term);
    if (!call || !hasVariable(call.inside, v)) return null;
    const du = d(call.inside);
    const outer = outerDerivative(call);
    if (!du || !outer) return null;
    const u = beautify(call.inside);
    return `Here the inside is ${mark(`u = ${u}`)}, with ${mark(`u′ = ${du}`)}: ${mark(`d/d${v} ${shownCall(call)} = ${outer}·${wrap(du)}`)}.`;
  }
  if (rule === 'product') {
    const factors = splitTopLevel(bare(term), '*').filter((f) => hasVariable(f, v));
    if (factors.length !== 2) return null;
    const [u, w] = factors.map((f) => beautify(stripOuterParens(f)));
    const [du, dw] = factors.map((f) => d(f));
    if (!du || !dw) return null;
    const chainInside = factors.map((f) => callOf(f)).some((c) => c && c.name !== 'power' && hasVariable(c.inside, v) && c.inside.replace(/\s+/g, '') !== v);
    return `Here ${mark(`u = ${u}`)} and ${mark(`w = ${w}`)}, so ${mark(`u′ = ${du}`)} and ${mark(`w′ = ${dw}`)}${chainInside ? ' (one factor needs the chain rule)' : ''}: the derivative is ${mark(`${wrap(du)}·${wrap(w)} + ${wrap(u)}·${wrap(dw)}`)}.`;
  }
  if (rule === 'quotient') {
    const parts = splitTopLevel(bare(term), '/');
    if (parts.length !== 2) return null;
    const [u, w] = parts.map((p) => beautify(stripOuterParens(p)));
    const [du, dw] = parts.map((p) => d(p));
    if (!du || !dw) return null;
    return `Here ${mark(`u = ${u}`)} and ${mark(`w = ${w}`)}, so ${mark(`u′ = ${du}`)} and ${mark(`w′ = ${dw}`)}: the derivative is ${mark(`(${wrap(du)}·${wrap(w)} − ${wrap(u)}·${wrap(dw)})/${wrap(w)}²`)}.`;
  }
  return null;
}

function lists(rule, v, ctx) {
  switch (rule) {
    case 'logdiff':
      return {
        tips: [
          `For ${mark(`${v}^${v}`)}-type terms (real-valued for ${mark(`${v} > 0`)}), take ln of both sides first: ${mark(`ln(y) = ${v}·ln(${v})`)}, differentiate implicitly, then multiply back by ${mark('y')}.`,
          `Differentiating ${mark(`ln(y) = ${v}·ln(${v})`)} gives ${mark(`y′/y = ln(${v}) + 1`)}, so ${mark(`y′ = ${v}^${v}·(ln(${v}) + 1)`)}.`,
          'Logarithmic differentiation also tames long products and quotients: the logarithm turns them into sums, differentiated term by term.',
        ],
        mistakes: [
          'Applying the power rule or the exponential rule to a term where BOTH the base and the exponent contain the variable.',
          `Forgetting to multiply back by ${mark('y')} at the end.`,
          `Taking half of it. Logarithmic differentiation gives, for ${mark(`f(${v})^g(${v})`)} with ${mark(`f(${v}) > 0`)}, ${mark(`d/d${v} f^g = g·f^(g−1)·f′ + f^g·ln(f)·g′`)}: a power-rule part and an exponential-rule part. For ${mark(`${v}^${v}`)} that is ${mark(`${v}·${v}^(${v}−1) + ${v}^${v}·ln(${v})`)}; either part alone is wrong.`,
        ],
      };
    case 'quotient':
      return {
        tips: [
          `Quotient rule: ${mark('(u/w)′ = (u′·w − u·w′)/w²')} — "low d-high minus high d-low, over low squared".`,
          ctx.worked,
          `Leave the denominator squared rather than expanding it: ${mark('w²')} shows at a glance where the derivative is undefined.`,
          `A constant numerator is quicker as a power: ${mark(`d/d${v}(3/${v}²) = d/d${v}(3${v}^(−2)) = −6${v}^(−3)`)}.`,
          `Writing ${mark('u/w')} as ${mark('u·w^(−1)')} and using the product and chain rules gives the same answer, a useful check.`,
        ],
        mistakes: [
          'Swapping the order in the numerator of the quotient rule; the subtraction makes the order matter.',
          `Forgetting to square the denominator: it is ${mark('w²')}, not ${mark('w')}.`,
          `Differentiating top and bottom separately: ${mark('(u/w)′')} is not ${mark('u′/w′')}.`,
        ],
      };
    case 'product':
      return {
        tips: [
          `Product rule: ${mark('(u·w)′ = u′·w + u·w′')} — the derivative of a product is NOT the product of the derivatives.`,
          ctx.worked,
          ctx.factored
            ? `Tidy the result by factoring out what the two terms share: here it becomes ${mark(ctx.factored)}.`
            : `Tidy the result by factoring out what the two terms share, such as a power of ${mark(v)} or an exponential.`,
          `With three factors, each takes a turn being differentiated: ${mark('(u·v·w)′ = u′·v·w + u·v′·w + u·v·w′')}.`,
          `A constant factor needs no product rule: ${mark(`d/d${v}(5${v}²) = 10${v}`)}.`,
        ],
        mistakes: [
          `Differentiating each factor and multiplying the results — ${mark('(u·w)′')} is not ${mark('u′·w′')}.`,
          inner(`Missing a chain rule inside a factor: in ${mark(`${v}²·e^(3${v})`)}, the factor ${mark(`e^(3${v})`)} differentiates to ${mark(`3e^(3${v})`)}, not ${mark(`e^(3${v})`)}.`),
          `Dropping one of the two terms: both ${mark('u′·w')} and ${mark('u·w′')} are needed.`,
        ],
      };
    case 'chain': {
      const outer = {
        exp: `For an exponential, ${mark(`d/d${v} e^u = e^u·u′`)}.`,
        log: `For a logarithm, ${mark(`d/d${v} ln(u) = u′/u`)}: the derivative of the inside over the inside.`,
        power: `For a power of an expression, ${mark(`d/d${v} u^n = n·u^(n−1)·u′`)}: bring the power down, lower it by one, then multiply by ${mark('u′')}.`,
        trig: `For a trig function, ${mark(`d/d${v} sin(u) = cos(u)·u′`)}, and the same pattern holds for each of the others.`,
        'inverse trig': `For an inverse trig function, ${mark(`d/d${v} arctan(u) = u′/(1 + u²)`)} and ${mark(`d/d${v} arcsin(u) = u′/√(1 − u²)`)}.`,
      }[ctx.outer] || `Name the inside ${mark(`u = g(${v})`)}, differentiate the outside as if ${mark('u')} were the variable, then multiply by ${mark('u′')}.`;
      return {
        tips: [
          `Chain rule: ${mark(`d/d${v} f(g(${v})) = f′(g(${v}))·g′(${v})`)} — differentiate the outside function, keep the inside as it is, then multiply by the inside's derivative.`,
          ctx.worked,
          outer,
          `Several layers take one factor each: ${mark(`d/d${v} sin(e^(2${v})) = cos(e^(2${v}))·e^(2${v})·2`)}.`,
          ...(ctx.outer === 'power' ? [`A power of a polynomial could be expanded first, but the chain rule usually avoids the extra algebra: ${mark(`d/d${v} (2${v} + 1)^5 = 10(2${v} + 1)^4`)}.`] : []),
        ],
        mistakes: [
          inner('Forgetting to multiply by the derivative of the inside function.'),
          ctx.keepInside || `Changing the inside too: the outside's derivative keeps the original inside, so ${mark(`d/d${v} sin(3${v}²)`)} has ${mark(`cos(3${v}²)`)} in it, not ${mark(`cos(6${v})`)}.`,
          'Stopping after one layer when there are several.',
        ],
      };
    }
    case 'erf':
      return {
        tips: [
          `${mark(`erf(${v})`)} is defined by an integral, ${mark(`(2/√π)·∫_0^${v} e^(−t^2) dt`)}: its derivative is the integrand times ${mark('2/√π')}, by the Fundamental Theorem of Calculus.`,
          `With an inside, the chain rule as usual: ${mark(`d/d${v} erf(u) = (2/√π)·e^(−u²)·u′`)}.`,
          `The same reasoning differentiates any function defined as an integral: ${mark(`d/d${v} ∫_a^${v} f(t) dt = f(${v})`)}.`,
        ],
        mistakes: [
          `Looking for an elementary antiderivative of ${mark(`e^(−${v}^2)`)}: there is none, which is why ${mark('erf')} is defined as an integral.`,
          inner(`Leaving out ${mark('u′')} when the inside is not ${mark(v)}: ${mark(`d/d${v} erf(2${v}) = (2/√π)·e^(−4${v}²)·2`)}.`),
          `Dropping the constant ${mark('2/√π')}.`,
        ],
      };
    case 'inverse trig':
      return {
        tips: [
          `${mark(`d/d${v} arcsin(${v}) = 1/√(1 − ${v}^2)`)}, ${mark(`d/d${v} arccos(${v}) = −1/√(1 − ${v}^2)`)}, ${mark(`d/d${v} arctan(${v}) = 1/(1 + ${v}^2)`)} — arcsin and arccos differ only in sign.`,
          `Each comes from implicit differentiation: ${mark(`y = arcsin(${v})`)} means ${mark(`sin(y) = ${v}`)}, so ${mark('cos(y)·y′ = 1')} and ${mark(`y′ = 1/cos(y) = 1/√(1 − ${v}²)`)}.`,
          `With an inside: ${mark(`d/d${v} arctan(u) = u′/(1 + u²)`)}, ${mark(`d/d${v} arcsin(u) = u′/√(1 − u²)`)}.`,
          `${mark('arcsin')} and ${mark('arccos')} are defined for ${mark(`−1 ≤ ${v} ≤ 1`)}, and their derivatives only for ${mark(`−1 < ${v} < 1`)}.`,
        ],
        mistakes: [
          `Reading ${mark(`arcsin(${v})`)} (also written ${mark(`sin^(-1)(${v})`)}) as ${mark(`1/sin(${v})`)}: it is the inverse function, not the reciprocal.`,
          `Forgetting the minus sign on ${mark('arccos')}.`,
          `Dropping the square root: ${mark(`d/d${v} arcsin(${v})`)} is ${mark(`1/√(1 − ${v}²)`)}, not ${mark(`1/(1 − ${v}²)`)}.`,
        ],
      };
    case 'hyperbolic':
      return {
        tips: [
          `${mark(`d/d${v} sinh(${v}) = cosh(${v})`)} and ${mark(`d/d${v} cosh(${v}) = sinh(${v})`)}, with no minus sign; ${mark(`d/d${v} tanh(${v}) = 1 − tanh^2(${v})`)}.`,
          `They follow from ${mark(`sinh(${v}) = (e^${v} − e^(−${v}))/2`)} and ${mark(`cosh(${v}) = (e^${v} + e^(−${v}))/2`)}, differentiated term by term.`,
          `${mark(`cosh²(${v}) − sinh²(${v}) = 1`)} plays the part that ${mark(`sin²(${v}) + cos²(${v}) = 1`)} plays for trig functions.`,
        ],
        mistakes: [
          `Adding a minus sign to ${mark(`d/d${v} cosh(${v})`)} by analogy with ${mark(`cos(${v})`)}.`,
          `Writing ${mark(`d/d${v} tanh(${v})`)} as ${mark(`1 + tanh²(${v})`)}, by analogy with ${mark(`tan(${v})`)}.`,
        ],
      };
    case 'trig': {
      const set = `${mark(`d/d${v} sin(${v}) = cos(${v})`)}, ${mark(`d/d${v} cos(${v}) = −sin(${v})`)}, ${mark(`d/d${v} tan(${v}) = sec²(${v})`)} — the trig derivatives are worth memorising as a set.`;
      const co = `${mark(`d/d${v} sec(${v}) = sec(${v})·tan(${v})`)}, ${mark(`d/d${v} csc(${v}) = −csc(${v})·cot(${v})`)}, ${mark(`d/d${v} cot(${v}) = −csc²(${v})`)}: the co-functions carry the minus sign.`;
      return {
        tips: [
          ...(ctx.coFunction ? [co, set] : [set, co]),
          `${mark('sin')} and ${mark('cos')} come back every four derivatives: ${mark('sin → cos → −sin → −cos → sin')}.`,
          'These rules hold for angles in radians; in degrees every derivative picks up a factor π/180.',
        ],
        mistakes: [
          ...(ctx.coFunction ? [`Confusing the derivative of ${mark(`sec(${v})`)} with ${mark(`sec²(${v})`)}: ${mark(`d/d${v} sec(${v}) = sec(${v})·tan(${v})`)}, while ${mark(`d/d${v} tan(${v}) = sec²(${v})`)}.`] : []),
          `Losing the minus sign in ${mark(`d/d${v} cos(${v}) = −sin(${v})`)}.`,
          `Writing ${mark(`d/d${v} tan(${v})`)} as ${mark(`sec(${v})`)} instead of ${mark(`sec²(${v})`)}.`,
          'Working in degrees: the derivatives above assume radians.',
        ],
      };
    }
    case 'log':
      return {
        tips: [
          ...(ctx.commonLog ? [`${mark(`log(${v})`)} is base 10 here: ${mark(`d/d${v} log(${v}) = 1/(${v}·ln(10))`)}, the natural-log derivative divided by ${mark('ln(10)')}.`] : []),
          `${mark(`d/d${v} ln(${v}) = 1/${v}`)}, valid on the domain ${mark(`${v} > 0`)}; for log base ${mark('b')}, divide by ${mark('ln(b)')}.`,
          `With an inside: ${mark(`d/d${v} ln(u) = u′/u`)}, so ${mark(`d/d${v} ln(${v}² + 1) = 2${v}/(${v}² + 1)`)}.`,
          `Log laws can save work, on the domain where both sides are defined: for ${mark(`${v} > 0`)}, ${mark(`ln(${v}³·(${v} + 1)) = 3ln(${v}) + ln(${v} + 1)`)}.`,
          `${mark(`ln|${v}|`)} has derivative ${mark(`1/${v}`)} on both sides of ${mark('0')}.`,
        ],
        mistakes: [
          `Writing ${mark(`d/d${v} ln(${v})`)} as ${mark(`1/ln(${v})`)} or as ${mark(`ln(${v})/${v}`)}.`,
          `Forgetting the ${mark('1/ln(b)')} for another base: ${mark(`d/d${v} log(${v}) = 1/(${v}·ln(10))`)}.`,
          `Ignoring the domain: ${mark(`ln(${v})`)} and its derivative exist only for ${mark(`${v} > 0`)}.`,
        ],
      };
    case 'exponential':
      return {
        tips: [
          ...(ctx.base ? [`For a constant base ${mark('a > 0')}, ${mark(`d/d${v} a^${v} = a^${v}·ln(a)`)}: here ${mark(`d/d${v} ${ctx.base}^${v} = ${ctx.base}^${v}·ln(${ctx.base})`)}.`] : []),
          `${mark(`d/d${v} e^${v} = e^${v}`)}: the exponential is its own derivative, and ${mark(`d/d${v} a^${v} = a^${v}·ln(a)`)} for a constant base ${mark('a > 0')} (with ${mark('a = e')} it is the same rule, since ${mark('ln(e) = 1')}).`,
          `With an inside: ${mark(`d/d${v} e^u = e^u·u′`)}, so ${mark(`d/d${v} e^(3${v}) = 3e^(3${v})`)}.`,
          `${mark(`e^${v}`)} is the function whose slope at every point equals its height; that is what makes ${mark('e')} the natural base.`,
        ],
        mistakes: [
          `Treating ${mark(`e^${v}`)} like a power and writing ${mark(`${v}·e^(${v}-1)`)} — the power rule is for a variable BASE, not a variable exponent.`,
          `Forgetting the ${mark('ln(a)')} for a base other than ${mark('e')}: ${mark(`d/d${v} 2^${v} = 2^${v}·ln(2)`)}.`,
          inner(`Leaving out the inside's derivative: ${mark(`d/d${v} e^(3${v})`)} is ${mark(`3e^(3${v})`)}.`),
        ],
      };
    case 'negative power':
    case 'power': {
      const negative = rule === 'negative power';
      const n = ctx.reciprocalPower || 2;
      const sumFirst = ctx.terms > 1 && !negative;
      const sum = `A sum is differentiated term by term, and constant factors carry through: ${mark(`d/d${v}(3${v}⁴ − 2${v} + 7) = 12${v}³ − 2`)}.`;
      const rewrite = `Rewrite roots and reciprocals as powers first: ${mark(`√${v} = ${v}^(1/2)`)}, ${mark(`1/${v}^n = ${v}^(−n)`)}. The power rule holds for any real exponent wherever the function is differentiable (always for ${mark(`${v} > 0`)}).`;
      const rule1 = `Power rule: ${mark(`d/d${v}(${v}^n) = n·${v}^(n-1)`)} — bring the exponent down as a factor, then lower it by one.`;
      return {
        tips: negative
          ? [
            `Rewrite reciprocals as powers before differentiating: ${mark(`1/${v}^n = ${v}^(-n)`)}, so the power rule applies.`,
            rule1,
            `Here: ${mark(`d/d${v}(1/${v}^${n}) = d/d${v}(${v}^(−${n})) = −${n}${v}^(−${n + 1}) = −${n}/${v}^${n + 1}`)}.`,
            sum,
          ]
          : [...(sumFirst ? [sum, rule1] : [rule1]), rewrite, ...(sumFirst ? [] : [sum]), `The derivative of a constant is ${mark('0')}: a constant does not change, so its slope is ${mark('0')}.`],
        // A polynomial's own slips (its constant, its subtracted terms) come
        // before warnings about exponents it does not have.
        mistakes: sumFirst
          ? [
            'Forgetting to lower the exponent by one after bringing it down as a factor.',
            `Keeping a lone constant instead of sending it to ${mark('0')}.`,
            'Sign slips when differentiating negative or subtracted terms.',
            `Lowering a negative exponent the wrong way: ${mark(`d/d${v}(${v}^-2) = -2${v}^-3`)}, not ${mark(`-2${v}^-1`)}.`,
            `Using the power rule on a variable exponent: ${mark(`d/d${v}(2^${v})`)} is ${mark(`2^${v}·ln(2)`)}, not ${mark(`${v}·2^(${v}−1)`)}.`,
          ]
          : [
            ...(negative ? [`Lowering a negative exponent the wrong way: ${mark(`d/d${v}(${v}^-2) = -2${v}^-3`)}, not ${mark(`-2${v}^-1`)}.`] : []),
            'Forgetting to lower the exponent by one after bringing it down as a factor.',
            ...(negative ? [] : [`Lowering a negative exponent the wrong way: ${mark(`d/d${v}(${v}^-2) = -2${v}^-3`)}, not ${mark(`-2${v}^-1`)}.`]),
            `Using the power rule on a variable exponent: ${mark(`d/d${v}(2^${v})`)} is ${mark(`2^${v}·ln(2)`)}, not ${mark(`${v}·2^(${v}−1)`)}.`,
            `Keeping a lone constant instead of sending it to ${mark('0')}.`,
          ],
      };
    }
    default:
      return {
        tips: [`The derivative of a constant is 0, and constant factors carry straight through.`],
        mistakes: [`Dropping a constant factor when differentiating terms like ${mark('3x')}, or keeping a lone constant instead of sending it to ${mark('0')}.`],
      };
  }
}

// f′, f″, f‴, f^(4)
const prime = (k) => (k <= 3 ? `f${'′″‴'[k - 1]}` : `f^(${k})`);

// options.order: 1–4. options.atPoint: the derivative is evaluated at a
// point. options.differentiate(text): the derivative of a piece, as text, or
// null — used to show the rule applied to this problem. options.rounds: f′,
// f″, … as shown. options.point: { valueText, shown } when f′(a) was found.
// options.result: the derivative as shown in the answer.
export function derivativeGuidance(expression, variable, { order = 1, atPoint = false, differentiate = null, rounds = null, point = null, result = null } = {}) {
  const v = variable;
  let terms;
  try {
    terms = splitTerms(expression).map(({ signed }) => ({ signed, label: classifyDerivativeRule(signed, v).label }));
  } catch {
    terms = [];
  }
  const labels = terms.map((t) => t.label);
  const used = PRECEDENCE.filter(([, test]) => labels.some(test)).map(([rule]) => rule);
  const lead = used[0] || (labels.length === 0 ? 'power' : 'constant');
  const leadTest = (PRECEDENCE.find(([r]) => r === lead) || [])[1];
  const leadTerm = leadTest ? terms.find((t) => leadTest(t.label)) : null;
  const call = leadTerm ? callOf(leadTerm.signed) : null;
  const outer = call
    ? ({ exp: 'exp', ln: 'log', log: 'log', power: 'power', arcsin: 'inverse trig', arccos: 'inverse trig', arctan: 'inverse trig', asin: 'inverse trig', acos: 'inverse trig', atan: 'inverse trig', sin: 'trig', cos: 'trig', tan: 'trig', sec: 'trig', csc: 'trig', cot: 'trig' })[call.name] || null
    : null;
  const recip = expression.replace(/\s+/g, '').match(new RegExp(`^1/${v}\\^(\\d+)$`));
  const base = expression.replace(/\s+/g, '').match(new RegExp(`(?:^|[^\\w.])(\\d+(?:\\.\\d+)?)\\^\\(?${v}\\)?(?![\\w(])`));
  const outerHere = call && lead === 'chain' ? outerDerivative(call) : null;
  const ctx = {
    outer,
    keepInside: outerHere ? `Changing the inside too: the outside's derivative keeps the original inside, so here it is ${mark(outerHere)}, with ${mark(beautify(call.inside))} unchanged inside it.` : null,
    worked: worked(lead, leadTerm?.signed, v, differentiate),
    terms: terms.length,
    reciprocalPower: recip ? Number(recip[1]) : null,
    base: base ? base[1] : null,
    commonLog: /(?<![a-z])log\(/i.test(expression) && !/\bln\(/i.test(expression),
    coFunction: /\b(?:sec|csc|cot)\(/i.test(expression),
    // The answer, when it is the factored form of a two-term product rule.
    // At a higher order the answer is f″, not the product rule's result.
    factored: order === 1 && result && lead === 'product' && /\*\(/.test(result) && !/^[^(]*\+/.test(result) ? result : null,
  };

  const first = lists(lead, v, ctx);
  const tips = first.tips.filter(Boolean);
  const mistakes = [...first.mistakes];
  // Every other rule the terms used: its first insight and mistake, unless
  // the lead list already says the same thing.
  const concepts = () => new Set(mistakes.map((m) => m.concept).filter(Boolean));
  for (const rule of used.slice(1)) {
    if (rule === 'constant' || (rule === 'power' && lead === 'negative power') || (rule === 'negative power' && lead === 'power')) continue;
    const other = lists(rule, v, ctx);
    tips.push(other.tips.filter(Boolean)[0]);
    const m = other.mistakes[0];
    if (!m.concept || !concepts().has(m.concept)) mistakes.push(m);
  }
  // A task decides what the student is doing, so it leads.
  // A value at a point: the derivative first, then the number.
  if (point && rounds && rounds.length) {
    const fn = prime(order);
    tips.splice(1, 0, `Differentiate first, then evaluate: ${mark(`${fn}(${v}) = ${rounds[rounds.length - 1]}`)}, so ${mark(`${fn}(${point.valueText}) = ${point.shown}`)}.`);
  }
  if (order > 1) {
    // Every round, so the student sees f′ and f″ both, not the first only.
    if (rounds && rounds.length === order) {
      const shown = rounds.map((r, k) => mark(`${prime(k + 1)}(${v}) = ${r}`)).join(', then ');
      tips.splice(1, 0, `Apply the rules once per order: ${shown}.`);
    }
    tips.unshift(`A higher derivative is the derivative of the derivative: differentiate ${mark("f′")} to get ${mark("f″")}, and so on. ${mark("f″")} says how the slope is changing: positive where the graph bends up, negative where it bends down.`);
    mistakes.unshift(rounds && rounds.length === order
      ? `Stopping at ${mark('f′')}: ${mark(`f′(${v}) = ${rounds[0]}`)} is only the first round, and ${mark(prime(order))} needs ${order - 1 === 1 ? 'one more' : `${order - 1} more`}, with the same rules applied to the result each time.`
      : `Stopping at ${mark('f′')}: ${mark('f″')} needs a second round of differentiation, with the same rules applied to ${mark('f′')}.`);
  }
  if (atPoint) {
    mistakes.unshift(`Substituting the point before differentiating: ${mark('f(a)')} is a constant, whose derivative is ${mark('0')}. Differentiate first, then substitute.`);
  }
  if (labels.length > 1) mistakes.push('Sign slips when differentiating negative or subtracted terms.');
  if (lead !== 'constant') {
    tips.push(`Where the derivative exists, ${mark(`f′(${v})`)} is the slope of the tangent line: positive where ${mark('f')} is increasing, negative where it is decreasing, and ${mark('0')} at a stationary point (a smooth peak or valley, or a level spot such as ${mark(`${v} = 0`)} on ${mark(`${v}³`)}).`);
  }
  return {
    tips: [...new Set(tips)],
    common_mistakes: [...new Set(mistakes.map((m) => (typeof m === 'string' ? m : m.text)))],
  };
}
