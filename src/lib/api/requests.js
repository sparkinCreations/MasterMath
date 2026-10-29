// Requests read from the words: "the zeros of", "the period of", "on [a, b]",
// a trailing "at x = a", a primed call f'(x), and dy/dx of an equation in x
// and y.

import { readRoundingSpec } from '../solvers/numberSolver.js';
import { graphVerb } from './topic.js';

// "x^2 on [0, 3]", "x^2 over the interval [0, 3]", "x^2 from 0 to 3",
// "x^2 between x = 0 and x = 3", "x^2 for 0 <= x <= 3" → { expr, a, b,
// variable }, or null when no interval is given.
function readInterval(text) {
  const t = String(text).trim().replace(/[?.]$/, '');
  let m = t.match(/^(.+?)\s*,?\s+(?:on|over|in)\s+(?:the\s+(?:closed\s+)?interval\s+)?\[\s*([^,\]]+?)\s*,\s*([^\]]+?)\s*\]$/i);
  if (m) return { expr: m[1].trim(), a: m[2], b: m[3], variable: null };
  m = t.match(/^(.+?)\s*,?\s+(?:on|over|for|when|where)\s+(?:the\s+interval\s+)?(-?[^\s<≤]+)\s*(?:<=|≤)\s*([a-z])\s*(?:<=|≤)\s*([^\s<≤]+)$/i);
  if (m) return { expr: m[1].trim(), a: m[2], b: m[4], variable: m[3] };
  m = t.match(/^(.+?)\s+(?:from|between)\s+(?:([a-z])\s*=\s*)?(-?\S+)\s+(?:to|and)\s+(?:[a-z]\s*=\s*)?(-?\S+)$/i);
  if (m) return { expr: m[1].trim(), a: m[3], b: m[4], variable: m[2] || null };
  return null;
}

// Request phrases around the maths, read as what they ask for. Returns
// { problem } with the phrase rewritten in notation the routing knows, or
// { problem, topic, reason } when the phrase names a topic of its own
// (critical points → Functions). Only phrases at the start of the input.
export function readRequestPhrases(text) {
  let t = String(text).trim();
  const verb = '(?:please\\s+)?(?:find|calculate|compute|evaluate|determine|what\\s+(?:is|are))';
  // "solve the quadratic equation x^2 - 5x + 6 = 0", "simplify the expression …"
  t = t.replace(/^(simplify|factor(?:ise|ize)?|expand|solve)\s+(?:completely\s+)?(?:the\s+)?(?:(?:quadratic|linear|cubic|polynomial|rational|following|given)\s+)?(?:expression|equation|polynomial|inequality|system(?:\s+of\s+equations)?)?\s*:?\s*(?=\S)/i, (m, v) => `${v.toLowerCase()} `);
  // A trailing "solve for x" ("2x + 3y = 6, solve for x", "solve 2x + 3y = 6
  // for x") is the leading form the router knows; it was refused as the
  // unknown word "forx".
  t = t.replace(/^(?:solve\s+)?([^=]*[^<>!=]=[^=].*?)\s*,?\s+(?:solve\s+|and\s+solve\s+)?for\s+([a-z])\s*[.?]?$/i, (m, eq, v) => `solve for ${v.toLowerCase()}: ${eq.trim()}`);
  // "calculate the definite integral of …", "find the derivative of …"
  t = t.replace(new RegExp(`^${verb}\\s+(?:the\\s+)?(?:definite\\s+)?(integral|antiderivative|derivative|limit)\\s+of\\s+`, 'i'), (m, what) => `${what.toLowerCase()} of `);
  // Shorthand and a missing "of": "int x^2 dx" and "int_0^1 …" are ∫;
  // "integral x^2 dx" was read as the constant "integralx^2" and answered
  // ∫(integralx^2) dx, marked Solved; "integral from 0 to 1 of x^2" was
  // refused; "derivative x^2", "deriv of x^2", "diff x^2" were glued into
  // one unknown word (October 25 review).
  t = t.replace(/^int(?![a-z])\s*/i, '∫');
  const calculus = `^(?:${verb}\\s+)?(?:the\\s+)?(?:(?:definite|indefinite)\\s+)?`;
  // "with respect to x" names the variable. Any input with it went to the
  // derivative solver, integrals too: "integral of x^2 with respect to x"
  // was answered f'(x) = 0, marked Solved (October 25 sweep). For an
  // integral it is the dx; "… with respect to x of f" puts it after f.
  t = t.replace(new RegExp(`${calculus}(integral|antiderivative|derivative)\\s+with\\s+respect\\s+to\\s+([a-z])\\s+of\\s+(.+)$`, 'i'), (m, what, v, f) => `${what.toLowerCase()} of ${f} with respect to ${v}`);
  if (/^(?:∫|integral\b|antiderivative\b|integrate\b)|^(?:\S+\s+){0,3}(?:integral|antiderivative)\s+of\b/i.test(t)) {
    t = t.replace(/(\s+d[a-z])?\s+with\s+respect\s+to\s+([a-z])\b/i, (m, given, v) => given || ` d${v.toLowerCase()}`);
  }
  t = t.replace(new RegExp(`${calculus}(?:integral|antiderivative)\\s+from\\s+(\\S+)\\s+to\\s+(\\S+)\\s+of\\s+(.+)$`, 'i'), (m, a, b, f) => `integral of ${f} from ${a} to ${b}`);
  // (An "of" with nothing after it stays as typed: "derivative of" became
  // "derivative of of", the derivative of a variable called "of".)
  t = t.replace(new RegExp(`${calculus}(integral|antiderivative|derivative|deriv|diff)\\s+(?:of\\s+)?(?!from\\b|with\\b|of\\s*$)(?=\\S)`, 'i'), (m, what) => `${/^d/i.test(what) ? 'derivative' : what.toLowerCase()} of `);
  // "sketch the graph of x^3", "graph y = x^2", "analyze the function
  // x^3 − x": the function's analysis. ("graph of y = x^2" was refused as
  // the unknown word "ofy".)
  const graphing = t.match(new RegExp(`^(?:${verb}\\s+)?(graph|plot|sketch|draw|analy[sz]e)\\s+(?:the\\s+graph\\s+of\\s+|the\\s+(?:function|curve)\\s+|of\\s+)?(?:y\\s*=\\s*|f\\s*\\(\\s*x\\s*\\)\\s*=\\s*)?([^=<>]+)$`, 'i'));
  if (graphing) return { problem: graphing[2].trim(), topic: 'functions', reason: `the input asks to ${graphVerb(graphing[1])} it` };
  // "find the zeros of x^2 - 5x + 6": the equation f = 0.
  const zeros = t.match(new RegExp(`^${verb}\\s+(?:the\\s+)?(?:zeros|zeroes|roots|solutions|x-intercepts)\\s+of\\s+(?:y\\s*=\\s*|f\\s*\\(\\s*x\\s*\\)\\s*=\\s*)?([^=<>]+)$`, 'i'));
  if (zeros) return { problem: `${zeros[1].trim()} = 0` };
  // "what is the slope of the tangent line to x^2 at x = 3": the derivative there.
  const slope = t.match(new RegExp(`^${verb}\\s+(?:the\\s+)?slope\\s+of\\s+(?:the\\s+)?(?:tangent(?:\\s+line)?|curve)\\s+(?:to|of)\\s+(?:the\\s+curve\\s+)?(?:y\\s*=\\s*)?(.+?\\s+at\\s+[a-z]\\s*=\\s*.+)$`, 'i'));
  if (slope) return { problem: `derivative of ${slope[1].trim()}` };
  // "find the critical points of x^3 - 3x": the function's analysis. Not
  // when an interval is given (the analysis is over the whole domain).
  const fnOf = '(?:the\\s+(?:function|graph|curve)\\s+)?(?:y\\s*=\\s*|f\\s*\\(\\s*x\\s*\\)\\s*=\\s*)?';
  const lead = `(?:${verb}\\s+)?(?:the\\s+)?`;
  // "the average value of x^2 on [0, 3]", "the maximum of x^3 - 3x on
  // [0, 2]" (the closed interval method), "is 97 prime", "the prime
  // factorization of 360", "round 3.14159 to 2 decimal places" (1.56.0):
  // each was refused as unreadable words.
  const average = t.match(new RegExp(`^${lead}(?:average|mean)\\s+value\\s+of\\s+${fnOf}(.+)$`, 'i'));
  const averageOn = average && readInterval(average[1]);
  if (averageOn) {
    return { problem: averageOn.expr, request: { kind: 'average', expression: averageOn.expr, a: averageOn.a, b: averageOn.b, variable: averageOn.variable }, topic: 'integrals', reason: 'the input asks for the average value of a function on an interval' };
  }
  const extreme = t.match(new RegExp(`^${lead}(?:absolute\\s+|global\\s+)?(max(?:imum)?(?:\\s+(?:and|&)\\s+min(?:imum)?)?|min(?:imum)?(?:\\s+(?:and|&)\\s+max(?:imum)?)?|extreme\\s+values?|extrema)(?:\\s+values?)?\\s+of\\s+${fnOf}(.+)$`, 'i'));
  const extremeOn = extreme && readInterval(extreme[2]);
  if (extremeOn) {
    const which = /max/i.test(extreme[1]) && /min/i.test(extreme[1]) || /extrem/i.test(extreme[1]) ? 'both' : /max/i.test(extreme[1]) ? 'maximum' : 'minimum';
    return { problem: extremeOn.expr, request: { kind: 'extrema', expression: extremeOn.expr, a: extremeOn.a, b: extremeOn.b, which, variable: extremeOn.variable }, topic: 'functions', reason: `the input asks for the absolute ${which === 'both' ? 'maximum and minimum' : which} of a function on an interval` };
  }
  const prime = t.match(/^(?:is\s+|check\s+(?:if|whether)\s+)(\d[\d,]*)\s+(?:is\s+)?(?:a\s+)?(prime|composite)(?:\s+number)?\s*\??$/i)
    || t.match(/^(\d[\d,]*)\s+(?:is\s+)?(?:a\s+)?(prime|composite)(?:\s+number)?\s*\?$/i);
  if (prime) return { problem: prime[1], request: { kind: 'prime', value: prime[1] }, topic: 'other', reason: 'the input asks whether a number is prime' };
  const factorization = t.match(new RegExp(`^${lead}(?:prime\\s+factori[sz]ation|prime\\s+factors|factor\\s+tree)\\s+of\\s+(\\d[\\d,]*)\\s*[?.]?$`, 'i'))
    || t.match(/^(?:factor(?:i[sz]e)?|write)\s+(\d[\d,]*)(?:\s+(?:into\s+primes|as\s+a\s+product\s+of\s+primes(?:\s+factors)?|completely))?\s*[?.]?$/i);
  if (factorization) return { problem: factorization[1], request: { kind: 'factorization', value: factorization[1] }, topic: 'other', reason: 'the input asks for a prime factorization' };
  const rounding = t.match(/^(?:round(?:\s+off)?\s+(.+?)|(.+?)\s+rounded)\s+to\s+(.+?)\s*[?.]?$/i);
  if (rounding) {
    const spec = readRoundingSpec(rounding[3]);
    if (spec) return { problem: rounding[1] || rounding[2], request: { kind: 'round', value: (rounding[1] || rounding[2]).trim(), spec }, topic: 'other', reason: 'the input asks to round a number' };
  }
  const analysis = t.match(new RegExp(`^${verb}\\s+(?:the\\s+)?(critical\\s+points|inflection\\s+points|points\\s+of\\s+inflection|extrema|local\\s+(?:maximum|minimum|extrema)|turning\\s+points|vertex|domain(?:\\s+and\\s+range)?|range|asymptotes|intercepts)\\s+of\\s+(?:the\\s+(?:function|parabola|curve|graph)\\s+)?(?:y\\s*=\\s*|f\\s*\\(\\s*x\\s*\\)\\s*=\\s*)?(.+)$`, 'i'));
  if (analysis && !/\bon\b|\[|\binterval\b/i.test(analysis[2])) {
    return { problem: analysis[2].trim(), topic: 'functions', reason: `the input asks for the ${analysis[1].toLowerCase().replace(/\s+/g, ' ')} of a function` };
  }
  // "find the period of 3sin(2x) + 1", "the amplitude of …", "the equation
  // of the tangent line to x^2 at x = 3", "the inverse of 2x + 3", "convert
  // 45 degrees to radians": one thing asked about a function or an angle
  // (requestSolver.js). Each was refused as unreadable words.
  const property = t.match(new RegExp(`^${lead}(period|amplitude)\\s+of\\s+${fnOf}(.+?)\\s*[?.]?$`, 'i'));
  if (property) {
    return { problem: property[2].trim(), request: { kind: property[1].toLowerCase(), expression: property[2].trim() }, topic: 'trigonometry', reason: `the input asks for the ${property[1].toLowerCase()} of a function` };
  }
  const num = '-?(?:[\\d.]+\\s*\\*?\\s*)?(?:pi|π|e)(?:\\s*\\/\\s*\\d+)?|-?[\\d.]+(?:\\s*\\/\\s*\\d+)?';
  const tangent = t.match(new RegExp(`^${lead}(?:equation\\s+of\\s+(?:the\\s+)?)?tangent(?:\\s+line)?\\s+(?:to|of)\\s+${fnOf}(.+?)\\s+at\\s+(?:the\\s+point\\s+)?(?:(?:([a-z])\\s*=\\s*)?(${num})|\\(\\s*(${num})\\s*,\\s*(${num})\\s*\\))\\s*[?.]?$`, 'i'));
  if (tangent && !/[=<>]/.test(tangent[1])) {
    const tidy = (n) => n.replace(/π/g, 'pi').replace(/\s+/g, '');
    return {
      problem: tangent[1].trim(),
      request: { kind: 'tangent', expression: tangent[1].trim(), variable: tangent[2] || null, point: tidy(tangent[3] || tangent[4]), givenY: tangent[5] ? tidy(tangent[5]) : null },
      topic: 'derivatives',
      reason: 'the input asks for the equation of a tangent line',
    };
  }
  const inverse = t.match(new RegExp(`^${lead}inverse(?:\\s+function)?\\s+of\\s+${fnOf}(.+?)\\s*[?.]?$`, 'i'));
  if (inverse && !/[=<>[\]]/.test(inverse[1]) && !/\bmatri(?:x|ces)\b/i.test(inverse[1])) {
    return { problem: inverse[1].trim(), request: { kind: 'inverse', expression: inverse[1].trim() }, topic: 'functions', reason: 'the input asks for the inverse of a function' };
  }
  const angle = t.match(/^(?:convert\s+)?(-?[\d.]+(?:\s*\/\s*\d+)?|-?(?:\d*\s*\*?\s*)?(?:pi|π)(?:\s*\/\s*\d+)?|-?[\d.]+\s*\*?\s*(?:pi|π)(?:\s*\/\s*\d+)?)\s*(°|degrees?|deg|radians?|rad)\s+(?:to|in(?:to)?)\s+(degrees?|deg|radians?|rad)\s*[?.]?$/i);
  if (angle) {
    const from = /^(?:°|deg)/i.test(angle[2]) ? 'degrees' : 'radians';
    const to = /^deg/i.test(angle[3]) ? 'degrees' : 'radians';
    if (from !== to) {
      return { problem: angle[1].replace(/π/g, 'pi'), request: { kind: 'angle', value: angle[1].replace(/π/g, 'pi').replace(/\s+/g, ''), from }, topic: 'trigonometry', reason: `the input asks to convert ${from} to ${to}` };
    }
  }
  // "find the gcd of 12 and 18"
  const divisor = t.match(new RegExp(`^(?:${verb}\\s+)?(?:the\\s+)?(gcd|gcf|hcf|lcm|greatest\\s+common\\s+(?:divisor|factor)|highest\\s+common\\s+factor|least\\s+common\\s+multiple)\\s+of\\s+(\\d+)\\s*(?:,|and)\\s*(\\d+)\\s*[?.]?$`, 'i'));
  if (divisor) {
    const lcm = /^(?:lcm|least)/i.test(divisor[1]);
    // A calculation, whatever the topic: under Derivatives it was f'(x) = 0.
    return { problem: `${lcm ? 'lcm' : 'gcd'}(${divisor[2]}, ${divisor[3]})`, topic: 'other', reason: `the input asks for a ${lcm ? 'least common multiple' : 'greatest common divisor'}` };
  }
  return { problem: t };
}

// "… at x = 2" / "… when x = π/4": an evaluation point tacked onto the end
// of a problem. Read on the raw text before any routing, because the "=" in
// it would otherwise make "x^2 at x = 1.5" look like an equation (in the
// unknowns a, t and x). Returns { rest, variable, valueText } or null.
export function extractEvalPoint(problem) {
  const m = String(problem).match(/^(.*?)[\s,]+(?:at|when|where|for)\s+([a-z])\s*=\s*(-?[0-9a-z.\/*+^() π√]+?)\s*[.?!]?\s*$/i);
  if (!m || !m[1].trim()) return null;
  // The value must be a number, not another expression in the variable.
  const variable = m[2].toLowerCase();
  if (new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'i').test(m[3].replace(/\b(?:pi|sqrt|e)\b/gi, ''))) return null;
  return { rest: m[1].trim(), variable, valueText: m[3].trim() };
}

// A primed function call — f'(x), f''(2), y'(x) — in the input (October
// 2026 test list). Returns null when there is none; else
//   { kind: 'derivative', expression, order, variable, point } when the
//     input also defines the function: "f'(x) where f(x) = x^3",
//     "f(x) = x^2, find f'(3)", "f''(x) if f(x) = sin(x) at x = 0";
//   { kind: 'ode', name, order, rhs } when the call sits in an equation
//     that does not define it: "f''(x) + f(x) = 0", "y'(x) = 3x^2";
//   { kind: 'undefined', name, order } when nothing gives the function:
//     "f'(x)", "f'(x) at x = 2".
// Before this, f'(x) where f(x) = x^3 answered "x^3", f''(x) + f(x) = 0
// answered "f''(f) = 0", and a bare f'(x) answered "f'(f) = 1" — all marked
// Solved.
// The derivative solver writes f, f′, f″; "g'(t) where g(t) = t^2" is
// answered in the input's own letter, g'(t) = 2t.
export function renameFunction(result, name) {
  if (!result || name === 'f') return result;
  const swap = (text) => (typeof text === 'string' ? text.replace(/(?<![a-z])f(?=(?:'+|′+|″|‴)?\(\s*[^()]*\s*\))/g, name) : text);
  result.answer = swap(result.answer);
  for (const key of ['steps', 'tips', 'common_mistakes']) if (Array.isArray(result[key])) result[key] = result[key].map(swap);
  if (result.graph?.secondaryLabel) result.graph.secondaryLabel = swap(result.graph.secondaryLabel);
  return result;
}

const PRIMED_CALL = /(?<![a-z])([a-z])\s*('+|′+|″|‴)\s*\(\s*([^()]+?)\s*\)/gi;
export function primedFunctionRequest(problem) {
  const t = String(problem).trim();
  const calls = [...t.matchAll(PRIMED_CALL)];
  if (!calls.length) {
    // f(x), g(t), h(x) named but never defined: "d/dx f(x)", "∫ f(x) dx",
    // "lim x->0 f(x)". The letter was read as a constant times (x) and
    // answered "f'(f) = x", "1/2*f*x^2 + C", "0" before 1.53.2. A letter
    // applied to itself, x(x), is a product.
    for (const m of t.matchAll(/(?<![a-z0-9.])([fgh])\s*\(\s*([a-z])\s*\)/gi)) {
      const name = m[1].toLowerCase();
      if (name === m[2].toLowerCase()) continue;
      if (new RegExp(`(?<![a-z])${name}\\s*\\(\\s*[a-z]\\s*\\)\\s*=(?!=)`, 'i').test(t)) continue;
      return { kind: 'undefined', name, order: 0, call: m[0] };
    }
    return null;
  }
  const name = calls[0][1].toLowerCase();
  const primes = calls[0][2];
  const order = primes === '″' ? 2 : primes === '‴' ? 3 : primes.length;
  const at = t.match(/[\s,]+at\s+([a-z])\s*=\s*([^,;=]+?)\s*[.?!]?\s*$/i);
  const body = at ? t.slice(0, at.index) : t;

  // The definition: f(x) = … (or y = …), up to a separator, a request word,
  // the primed call or the end.
  const def = body.match(new RegExp(`(?<![a-z])${name}\\s*(?:\\(\\s*([a-z])\\s*\\))?\\s*=(?!=)\\s*(.+?)\\s*(?=[,;]|\\b(?:find|compute|calculate|determine|evaluate|what|and|then|where|if|when)\\b|(?<![a-z])${name}\\s*(?:'|′|″|‴)|$)`, 'i'));
  if (def && calls.length === 1) {
    const leftover = body
      .replace(def[0], ' ')
      .replace(calls[0][0], ' ')
      .replace(/\b(?:find|compute|calculate|determine|evaluate|what\s+is|the|where|if|when|given|for|and|then|derivative)\b/gi, ' ')
      .replace(/[\s,;:.?!]/g, '');
    const variable = (def[1] || (/^[a-z]$/i.test(calls[0][3]) ? calls[0][3] : 'x')).toLowerCase();
    const arg = calls[0][3].toLowerCase();
    if (!leftover && /[a-z0-9]/i.test(def[2])) {
      let point = arg !== variable ? calls[0][3] : null;
      if (at && at[1].toLowerCase() === variable) point = point ?? at[2].trim();
      else if (at) return { kind: 'undefined', name, order, call: calls[0][0] };
      return { kind: 'derivative', name, expression: def[2], order, variable, point };
    }
  }
  if (/(?<![<>!=])=(?!=)/.test(body)) {
    const sides = body.split(/(?<![<>!=])=(?!=)/);
    const lone = sides.length === 2 ? sides.findIndex((s) => s.trim() === calls[0][0]) : -1;
    const rhs = lone >= 0 && order === 1 && !new RegExp(`(?<![a-z])${name}(?![a-z])`, 'i').test(sides[1 - lone]) ? sides[1 - lone].trim() : null;
    return { kind: 'ode', name, order, rhs };
  }
  return { kind: 'undefined', name, order, call: calls[0][0] };
}

// dy/dx of an equation in two variables: "x^2 + y^2 = 25" under Derivatives,
// or "find dy/dx if x^2 + y^2 = 25" / "differentiate implicitly: xy = 1"
// under any topic. The equation used to go to Algebra and be solved for x
// (October 2026 review); "dy/dx" in the request was refused as a
// differential equation. Returns null when the input is not such a request;
// { explicit, variable, point } for y = f(x) and f(x) = …, which are
// ordinary derivatives; else { lhs, rhs, independent, dependent, point }.
const IMPLICIT_FUNCTIONS = /(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp|pi|e)(?![a-z])/gi;
export function implicitDerivativeRequest(problem, topic) {
  let t = String(problem).trim();
  if (/[<>≤≥]/.test(t)) return null;
  let wanted = null; // [dependent, independent] from a typed dy/dx
  let asked = false;
  let withRespectTo = null;

  // The point, at the end: "at (3, 4)", "at x = 3, y = 4", "at x = 3".
  const VAL = '((?:[^,()=]|\\([^()]*\\))+?)';
  let point = null;
  let m = t.match(new RegExp(`[\\s,]+(?:at|when|where)\\s+(?:the\\s+point\\s+)?\\(\\s*${VAL}\\s*,\\s*${VAL}\\s*\\)\\s*[.?!]?\\s*$`, 'i'));
  if (m) {
    point = { first: m[1].trim(), second: m[2].trim() };
  } else if ((m = t.match(new RegExp(`[\\s,]+(?:at|when|where)\\s+([a-z])\\s*=\\s*${VAL}\\s*(?:,|and)\\s*([a-z])\\s*=\\s*${VAL}\\s*[.?!]?\\s*$`, 'i')))) {
    point = { named: { [m[1].toLowerCase()]: m[2].trim(), [m[3].toLowerCase()]: m[4].trim() } };
  } else if ((m = t.match(new RegExp(`[\\s,]+(?:at|when|where)\\s+([a-z])\\s*=\\s*${VAL}\\s*[.?!]?\\s*$`, 'i')))) {
    point = { named: { [m[1].toLowerCase()]: m[2].trim() } };
  }
  if (m && point) t = t.slice(0, m.index).trim();

  // The request words around the equation.
  const LEAD = [
    /^(?:please\s+)?(?:find|compute|calculate|determine|get|what\s+is|use|using|by)\s+/i,
    /^the\s+/i,
    /^(?:implicit\s+)?(?:derivative|slope)\s*/i,
    /^implicit(?:ly)?\s+(?:differentiat(?:e|ion)\s*)?/i,
    /^differentiat(?:e|ion)\s+(?:implicitly\s*)?/i,
    /^(?:to\s+find|for|of|if|given|when|where|from|on|the\s+curve)\s+/i,
    /^[:,]\s*/,
  ];
  for (let changed = true; changed;) {
    changed = false;
    const leibniz = t.match(/^d([a-z])\s*\/\s*d([a-z])\s*/i);
    if (leibniz) {
      wanted = [leibniz[1].toLowerCase(), leibniz[2].toLowerCase()];
      t = t.slice(leibniz[0].length);
      asked = true;
      changed = true;
      continue;
    }
    for (const re of LEAD) {
      const lead = t.match(re);
      if (lead && lead[0]) {
        if (/deriv|differentiat|implicit|slope/i.test(lead[0])) asked = true;
        t = t.slice(lead[0].length);
        changed = true;
        break;
      }
    }
  }
  const TRAIL = /[\s,;]+(?:(?:and\s+)?(?:find|compute)\s+)?(?:d([a-z])\s*\/\s*d([a-z])|the\s+derivative|the\s+slope|implicitly|by\s+implicit\s+differentiation|with\s+respect\s+to\s+([a-z]))\s*[.?!]?\s*$/i;
  for (let trail = t.match(TRAIL); trail; trail = t.match(TRAIL)) {
    if (trail[1]) wanted = [trail[1].toLowerCase(), trail[2].toLowerCase()];
    if (trail[3]) withRespectTo = trail[3].toLowerCase();
    asked = true;
    t = t.slice(0, trail.index).trim();
  }
  if (!asked && topic !== 'derivatives') return null;

  // One equation, both sides present, nothing left of a derivative in it
  // (dy/dx + y = x is a differential equation, and stays refused).
  const sides = t.split(/(?<![<>!=])=(?!=)/);
  if (sides.length !== 2) return null;
  const [lhs, rhs] = sides.map((s) => s.trim());
  if (!lhs || !rhs || /^[+\-*/^]/.test(lhs) || /['′″‴]|\bd[a-z]\s*\/\s*d[a-z]\b/i.test(t)) return null;

  // f(x) = …: a named function, differentiated as usual.
  const named = lhs.match(/^([a-z])\s*\(\s*([a-z])\s*\)$/i);
  if (named && !/(?<![a-z])[a-z]\s*\(\s*[a-z]\s*\)/i.test(rhs.replace(IMPLICIT_FUNCTIONS, ''))) {
    const v = named[2].toLowerCase();
    return { explicit: rhs, variable: v, point: point?.named?.[v] ?? point?.first ?? null };
  }

  // The variables: single letters, with xy / 2xy read as products.
  const letters = new Set();
  for (const word of t.replace(IMPLICIT_FUNCTIONS, ' ').match(/[a-z]+/gi) || []) {
    const lower = word.toLowerCase();
    if (lower.length > 1 && !/^[xy]+$/.test(lower) && !(wanted && [...lower].every((c) => wanted.includes(c)))) return null;
    for (const c of lower) letters.add(c);
  }
  if (letters.size !== 2) return null;
  let dependent;
  let independent;
  if (wanted && letters.has(wanted[0]) && letters.has(wanted[1])) [dependent, independent] = wanted;
  else if (letters.has('x') && letters.has('y')) [dependent, independent] = ['y', 'x'];
  else return null;
  if (withRespectTo && withRespectTo !== independent) return null;

  let at = null;
  if (point?.first !== undefined) at = { x: point.first, y: point.second };
  else if (point?.named) {
    if (Object.keys(point.named).some((k) => k !== independent && k !== dependent)) return null;
    at = { x: point.named[independent] ?? null, y: point.named[dependent] ?? null };
    if (at.x === null) return null;
  }

  // y = f(x), either way round: an ordinary derivative, unless a full point
  // was given (then the point is checked against the curve).
  const varRe = (v) => new RegExp(`(?<![a-z])${v}(?![a-z])`, 'i');
  for (const [alone, other] of [[lhs, rhs], [rhs, lhs]]) {
    if (alone.toLowerCase() === dependent && !varRe(dependent).test(other.replace(IMPLICIT_FUNCTIONS, ' ')) && !(at && at.y !== null)) {
      return { explicit: other, variable: independent, point: at ? at.x : null };
    }
  }
  return { lhs, rhs, independent, dependent, point: at };
}
