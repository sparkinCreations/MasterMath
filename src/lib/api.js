import { extractFunctionFromProblem, parseMathExpression, usesCommonLog, matchingParen, extractVariable } from './mathParser.js';
import { STATUS, isValidStatus, parseError, solved, unsupported } from './solutionEnvelope.js';
import { bareFunctionName, math, formatNumber, beautify } from './solvers/solverUtils.js';
import { stripMathMarkers } from './mathMarkers.js';
import { readPlainEnglish } from './plainEnglish.js';
import { readRoundingSpec } from './solvers/numberSolver.js';
import { syntaxProblem } from './syntaxCheck.js';

async function loadSolver(topic) {
  switch (topic) {
    case 'algebra':
      return (await import('./solvers/algebraSolver.js')).solveAlgebra;
    case 'derivatives':
      return (await import('./solvers/derivativesSolver.js')).solveDerivative;
    case 'integrals':
      return (await import('./solvers/integralsSolver.js')).solveIntegral;
    case 'limits':
      return (await import('./solvers/limitsSolver.js')).solveLimit;
    case 'trigonometry':
      return (await import('./solvers/trigonometrySolver.js')).solveTrigonometry;
    case 'functions':
      return (await import('./solvers/functionsSolver.js')).solveFunctions;
    case 'other':
      return (await import('./solvers/arithmeticSolver.js')).solveArithmetic;
    default:
      return null;
  }
}

async function resolveSolver(problem, topic) {
  const solver = await loadSolver(topic);
  if (solver) {
    return solver;
  }

  const lower = problem.toLowerCase();
  if (lower.includes('derivative') || lower.includes('differentiate')) {
    return loadSolver('derivatives').then((fn) => fn);
  }
  if (lower.includes('integral') || lower.includes('integrate')) {
    return loadSolver('integrals').then((fn) => fn);
  }
  if (lower.includes('limit') || lower.includes('lim')) {
    return loadSolver('limits').then((fn) => fn);
  }

  const expression = extractFunctionFromProblem(problem);
  if (lower.includes('graph') || expression.includes('f(')) {
    return loadSolver('functions').then((fn) => fn);
  }

  return loadSolver('algebra').then((fn) => fn);
}

// A system of equations has two or more equations (two or more '=' signs that
// aren't part of >=, <=, ==, !=). Detected on the raw text so the router can
// hand it to the systems solver before single-expression extraction.
function looksLikeSystem(problem) {
  const equalsCount = (String(problem).match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount >= 2;
}

// An inequality carries a <, >, ≤, or ≥ relation.
function looksLikeInequality(problem) {
  return /[<>≤≥]/.test(String(problem));
}

// What the INPUT says it is, regardless of the topic picked in the dropdown.
// A student who types "d/dx x^3" under Algebra means a derivative; the old
// behaviour stripped the "d/dx" and "simplified" x^3 to x^3, marked Solved.
// Returns 'derivatives' | 'integrals' | 'limits' | null.
function detectCalculusIntent(problem) {
  const t = String(problem);
  if (/\bd\/d[a-z]\b|\bderivative\b|\bdifferentiate\b|\bdy\/dx\b/i.test(t)) return 'derivatives';
  if (/∫|\bintegra(?:l|te)\b|\bantiderivative\b|\barea\s+under\b/i.test(t)) return 'integrals';
  if (/\blim(?:it)?\b|→|->|\bapproaches\b/i.test(t)) return 'limits';
  return null;
}

// Auto-detect (1.53.0, the default topic for a new visitor): which topic the
// input itself asks for. Only the input's own signals decide; an expression
// with no intent of its own ("x^2 + 3x") is Algebra — simplified, factored
// where it can be — and the page offers to differentiate, integrate or
// analyse it instead (expressionNudge). Never a guess.
const TRIG_CALL = /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan)(?:\s*[(^]|\s+(?=[a-z0-9π]))/i;
const GRAPH_VERB = /^\s*(graph|plot|sketch|draw|analy[sz]e)\b/i;
const graphVerb = (t) => t.match(GRAPH_VERB)[1].toLowerCase().replace(/^analyze$/, 'analyse').replace(/^draw$|^plot$/, 'graph');

export function detectTopic(problem) {
  const t = String(problem);
  const calculus = detectCalculusIntent(t);
  if (calculus) {
    return { topic: calculus, reason: `your input uses ${calculus === 'limits' ? 'limit' : calculus === 'integrals' ? 'integral' : 'derivative'} notation` };
  }
  // A leading verb says what to do: "factor x^2 - 5x + 6", "simplify tan(x)*cos(x)".
  const verb = t.match(/^\s*(factor(?:i[sz]e)?|expand|simplify|solve)\b/i);
  if (verb) {
    const action = verb[1].toLowerCase().replace(/^factori[sz]e$/, 'factor');
    return TRIG_CALL.test(t)
      ? { topic: 'trigonometry', reason: `your input asks to ${action} a trig expression` }
      : { topic: 'algebra', reason: `your input asks to ${action} it` };
  }
  // "sketch x^3", "analyze x^2 - 4": the graphing verbs ask for the
  // function's features. "sketch x^3" was simplified to x^3 under Algebra.
  if (GRAPH_VERB.test(t)) return { topic: 'functions', reason: `your input asks to ${graphVerb(t)} it` };
  if (looksLikeSystem(t)) return { topic: 'algebra', reason: 'your input is a system of equations' };
  if (looksLikeInequality(t)) return { topic: 'algebra', reason: 'your input is an inequality' };
  // "f(x) = …" / "y = …" with y not on the right: a definition, not an equation.
  const definition = t.match(/^\s*(?:[fgh]\s*\(\s*[a-z]\s*\)|y)\s*=(?!=)(.*)$/i);
  if (definition && !/(?<![a-z])y(?![a-z])/i.test(definition[1])) {
    return { topic: 'functions', reason: 'your input defines a function' };
  }
  if (TRIG_CALL.test(t)) return { topic: 'trigonometry', reason: 'your input uses a trig function' };
  if (/°/.test(t)) return { topic: 'trigonometry', reason: 'your input is an angle in degrees' };
  if (/(?<![><!=])=(?!=)/.test(t)) return { topic: 'algebra', reason: 'your input is an equation' };
  // Function names and words that only say how to combine numbers ("two plus
  // one", "what is 20% of 50") are not variables.
  if (isComplexNumberInput(t)) return { topic: 'other', reason: 'your input is a calculation with complex numbers' };
  const letters = t.replace(/\b(?:sqrt|cbrt|abs|log|ln|exp|pi|e|mod|choose|plus|minus|times|divided|multiplied|by|over|add|subtract|multiply|divide|sum|product|difference|quotient|of|and|from|what|is|the|calculate|compute|evaluate)\b/gi, '');
  if (!/[a-z]/i.test(letters)) return { topic: 'other', reason: 'your input is a calculation with numbers' };
  return { topic: 'algebra', reason: 'your input is an expression, so it is simplified (and factored where it can be)' };
}

// One equation in one unknown, with no calculus intent, is an algebra
// problem whatever topic it was typed under — except where the topic has
// its own equation semantics: a trig equation under Trigonometry, and the
// f(x) = … / y = … definitions under Functions.
function isPlainEquationForAlgebra(problem, topic) {
  const t = String(problem);
  const equalsCount = (t.match(/(?<![><!=])=(?!=)/g) || []).length;
  if (equalsCount !== 1) return false;
  if (!/[a-z]/i.test(t.replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sqrt|abs|log|ln|exp|pi|e)\b/gi, ''))) return false;
  if (topic === 'algebra') return false;
  // (?<![a-z]) not \b: "2cos(x) - 1 = 0" has no word boundary before "cos".
  if (topic === 'trigonometry' && /(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*[(^a-z0-9]/i.test(t)) return false;
  // (A definition only when y is not on the right too: "y = 2y + 3" is an equation.)
  if (topic === 'functions' && /(?<![a-z0-9])(?:[fgh]\(\s*[a-z]\s*\)|y)\s*=(?!.*(?<![a-z])y(?![a-z]))/i.test(t)) return false;
  return true;
}

// A variable expression typed under Arithmetic ("x^2 + 3x") is algebra —
// arithmetic has no unknowns, and mathjs would just say "Undefined symbol x".
function isAlgebraUnderArithmetic(problem, topic) {
  if (topic !== 'other' || isComplexNumberInput(problem)) return false;
  const t = String(problem).replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sqrt|abs|log|ln|exp|pi|e|mod|choose)\b/gi, '').replace(/\d+(?:\.\d+)?[eE][+-]?\d+/g, '');
  return /(?<![a-z])[a-df-z](?![a-z])/i.test(t) && !/^\s*\d+(?:\.\d+)?\s*x\s*\d/i.test(String(problem)); // "2 x 3" is multiplication
}

// Numbers and i only: (2+3i)*(1-i), (3+4i)/(1-2i), i^3. Arithmetic computes
// them in complex numbers; the algebra simplifier called them "already in
// simplest form" (October 25 review). Not an equation, and i on its own:
// "ix" or "pi" is not the imaginary unit.
export function isComplexNumberInput(problem) {
  const t = String(problem).replace(/\b(?:sqrt|abs|pi|e)\b/gi, '');
  return /(?<![a-z])i(?![a-z])/i.test(t) && !/[a-hj-z=<>≤≥]/i.test(t) && /\d/.test(t);
}

// A constant that divides by zero — "1/0", "5/(3-3)", "0/0" — typed under a
// calculus or Functions topic. Those solvers answered it as if it were a
// function: "f(x) = 2/0: a constant function", "lim (x→0) 2/0 = ∞" (an
// approach point nobody typed), or "beyond this solver" (October 2026
// review). Arithmetic says what it is: undefined, or indeterminate.
// A number with no variable and no limit notation, typed under Limits.
// "1/2" was answered "lim (x→0) 1/2 = 0.5", with an approach point nobody
// typed; a number is just evaluated.
function isConstantInput(problem) {
  const t = String(problem).trim();
  return t.length > 0 && !/[a-z=<>≤≥∫]/i.test(t.replace(/\b(?:pi|e)\b/gi, '')) && /\d/.test(t);
}

function constantDividesByZero(problem) {
  const t = String(problem).trim();
  if (/[a-z=<>≤≥]/i.test(t.replace(/\b(?:pi|e)\b/gi, ''))) return false;
  if (!/\/\s*\(?\s*[-\d(]/.test(t)) return false;
  try {
    const v = math.evaluate(parseMathExpression(t));
    return typeof v === 'number' && !Number.isFinite(v);
  } catch {
    return false;
  }
}

// An expression of pure numbers under Trigonometry — "(5+3)*4 - 2^3" — is
// arithmetic: there is no angle, no function call, nothing trigonometric to
// say about it. It used to be evaluated by the trig path and served with trig
// tips ("Remember: sin(30°) = 1/2") attached to a PEMDAS problem.
// Deliberately narrow: any letter at all (sin, pi, sqrt, e, x) means the
// topic may still have a legitimate claim on the input.
function isArithmeticUnderTrigonometry(problem, topic) {
  if (topic !== 'trigonometry') return false;
  const t = String(problem);
  // A degree sign is an angle: "90°" stays (Arithmetic sends it here).
  if (/[a-z=<>≤≥°]/i.test(t)) return false;
  return /\d/.test(t);
}

// Words the engines know. Anything else that is two or more letters long is
// not mathematics this app can read ("hello", "helpme", "xx").
const KNOWN_WORDS = new Set(['of', 'gcd', 'lcm', 'min', 'max', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sqrt', 'cbrt', 'nthroot', 'abs', 'log', 'ln', 'log10', 'log2', 'exp', 'pi', 'mod', 'choose', 'combinations', 'permutations', 'factorial', 'floor', 'ceil', 'round', 'sign', 'sgn', 'gamma', 'erf', 'infinity', 'inf', 'deg', 'degrees', 'rad']);
function unknownWord(expression) {
  const text = String(expression);
  // Two single letters with only a space between them: "x x".
  const pair = text.match(/(?<![a-z])([a-z])\s+([a-z])(?![a-z])/i);
  if (pair) return `${pair[1]} ${pair[2]}`;
  const words = text.match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  const unknown = words.find((w) => !KNOWN_WORDS.has(w.toLowerCase()));
  if (unknown) return unknown;
  // A word followed by "(" is a function call. An unknown one — foo(x) —
  // was left to the engines, which echoed it back as "already in simplest
  // form" and "domain: no real numbers", marked Solved.
  return unknownFunction(text);
}

// The name is returned with its "(" so the hint can say "function".
function unknownFunction(text) {
  const calls = String(text).match(/[a-z]{2,}(?=\s*\()/gi) || [];
  const name = calls.find((w) => !KNOWN_WORDS.has(w.toLowerCase()));
  return name ? `${name}(` : null;
}
const unknownFunctionHint = (name) => `"${name}" is not a known function. The functions are sin, cos, tan, arcsin, sinh, …, sqrt, cbrt, abs, ln, log, exp, floor, ceil, round, gcd, lcm, min, max and the factorial "n!".`;

// The same question for the paths that read the whole problem — limits,
// integrals, inequalities, systems — where the instruction words are still
// in the text. Those paths had no check, and read an unknown word as a
// constant: "x apples > 2" was answered "No solution", "lim x→2 x apples"
// "Does not exist", "∫ x squared dx" ½·squared·x² (all marked Solved).
// Two single letters side by side are not flagged here ("from a to b").
const INSTRUCTION_WORDS = new Set(['solve', 'find', 'for', 'the', 'and', 'or', 'evaluate', 'simplify', 'compute', 'calculate',
  'what', 'is', 'value', 'values', 'where', 'when', 'if', 'then', 'determine', 'show', 'all', 'real', 'number', 'numbers',
  'lim', 'limit', 'as', 'approaches', 'approach', 'goes', 'tends', 'from', 'left', 'right', 'side', 'sided', 'one', 'above', 'below',
  'integral', 'integrate', 'antiderivative', 'definite', 'indefinite', 'with', 'respect', 'to', 'area', 'under', 'curve', 'between',
  'system', 'equations', 'equation', 'inequality', 'inequalities', 'simultaneous', 'interval', 'notation']);
function unknownWordInProblem(problem) {
  const words = String(problem).match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  const unknown = words.find((w) => {
    const lower = w.toLowerCase();
    return !KNOWN_WORDS.has(lower) && !INSTRUCTION_WORDS.has(lower) && !/^d[a-z]$/.test(lower);
  });
  if (unknown) return unknown;
  const call = unknownFunction(problem);
  return call && !INSTRUCTION_WORDS.has(call.slice(0, -1).toLowerCase()) ? call : null;
}

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
function readRequestPhrases(text) {
  let t = String(text).trim();
  const verb = '(?:please\\s+)?(?:find|calculate|compute|evaluate|determine|what\\s+(?:is|are))';
  // "solve the quadratic equation x^2 - 5x + 6 = 0", "simplify the expression …"
  t = t.replace(/^(simplify|factor(?:ise|ize)?|expand|solve)\s+(?:completely\s+)?(?:the\s+)?(?:(?:quadratic|linear|cubic|polynomial|rational|following|given)\s+)?(?:expression|equation|polynomial|inequality|system(?:\s+of\s+equations)?)?\s*:?\s*(?=\S)/i, (m, v) => `${v.toLowerCase()} `);
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

// The request read by readRequestPhrases, solved by requestSolver.js and
// finalized. An unknown word in the expression is a parse error, as on
// every other path.
async function solveRequest(request, problem) {
  const solvers = await import('./solvers/requestSolver.js');
  if (request.kind === 'angle') return finalizeResult(asResult(solvers.convertAngle(request.value, request.from)), problem);
  if (['prime', 'factorization', 'round'].includes(request.kind)) {
    const numbers = await import('./solvers/numberSolver.js');
    const result = request.kind === 'prime' ? numbers.primeCheck(request.value)
      : request.kind === 'factorization' ? numbers.primeFactorization(request.value)
        : numbers.roundNumber(request.value, request.spec);
    return finalizeResult(asResult(result), problem);
  }
  const expression = parseMathExpression(extractFunctionFromProblem(request.expression));
  const word = unknownWord(expression);
  if (word) return finalizeResult(parseError({ input: request.expression, hint: unknownWordHint(word) }), problem);
  const variable = request.variable || extractVariable(expression);
  let result;
  if (request.kind === 'period') result = solvers.periodOf(expression, variable);
  else if (request.kind === 'amplitude') result = solvers.amplitudeOf(expression, variable);
  else if (request.kind === 'tangent') result = await solvers.tangentLine(expression, variable, request.point, request.givenY);
  else if (request.kind === 'average' || request.kind === 'extrema') {
    const interval = await import('./solvers/intervalSolver.js');
    result = request.kind === 'average'
      ? await interval.averageValue(expression, variable, request.a, request.b, solveProblem)
      : await interval.extremaOnInterval(expression, variable, request.a, request.b, request.which, solveProblem);
  } else {
    const { solveAlgebra } = await import('./solvers/algebraSolver.js');
    result = await solvers.inverseOf(expression, variable, solveAlgebra);
  }
  return finalizeResult(asResult(result), problem);
}
const asResult = (r) => (r.status ? r : solved(r));

// A word problem: a sentence about trains or apples, not notation. Its
// words were glued together and refused as "itsspeed is not a known
// function" (October 2026 review). Three or more words that are neither
// maths nor an instruction ("find the second derivative of" has none) say it
// is prose, with a number in it; the problem is refused as one, saying what
// to type instead.
const MATH_TALK = new Set(['derivative', 'derivatives', 'differentiate', 'differentiation', 'implicit', 'implicitly', 'second', 'third',
  'fourth', 'first', 'slope', 'tangent', 'factor', 'factorise', 'factorize', 'expand', 'at', 'in', 'by', 'on', 'radians', 'degree',
  'graph', 'plot', 'sketch', 'domain', 'range', 'point', 'roots', 'root', 'zero', 'zeros', 'intercept', 'intercepts', 'asymptote',
  'asymptotes', 'maximum', 'minimum', 'max', 'min', 'exact', 'decimal', 'using', 'rule', 'parts', 'substitution', 'partial',
  'fractions', 'fraction', 'function', 'given', 'let', 'squared', 'cubed', 'power', 'times', 'plus', 'minus', 'over', 'divided',
  'multiplied', 'sum', 'difference', 'product', 'quotient', 'percent', 'square', 'cube', 'sine', 'cosine', 'tangent', 'natural',
  'logarithm', 'differential', 'matrix', 'determinant', 'inverse', 'positive', 'negative', 'odd', 'even', 'per', 'cent']);
function looksLikeWordProblem(problem) {
  const words = String(problem).match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  const prose = words.filter((w) => {
    const lower = w.toLowerCase();
    return !KNOWN_WORDS.has(lower) && !INSTRUCTION_WORDS.has(lower) && !MATH_TALK.has(lower) && !/^d[a-z]$/.test(lower);
  });
  // A story problem gives its numbers ("120 miles in 2 hours"); a question
  // with none ("determine whether the series converges") is not one.
  return prose.length >= 3 && /\d/.test(problem);
}
const wordProblemRefusal = (problem) => unsupported({
  input: problem,
  reason: 'This reads as a word problem. Word problems are not supported: the solver works on mathematics typed as notation, not on a story about it.',
  answer: 'Word problems are not supported',
  tips: [
    'Write the maths the problem describes: a train that travels 120 miles in 2 hours has speed "120/2".',
    'An unknown becomes a letter: "a number plus 7 is 12" is "x + 7 = 12".',
  ],
});

// The words of a request the solver could not read, glued together when the
// spaces were taken out ("thecriticalpointsofx"): say so in plain terms
// rather than calling that a function name (October 2026 review).
const gluedWords = (word) => word.length >= 12 || /^(?:the|is|of)[a-z]{3,}/i.test(word);
const unknownWordHint = (word) => (/\($/.test(word) ? unknownFunctionHint(word.slice(0, -1)) : gluedWords(word)
  ? 'The words in this problem could not be read as maths. Type the expression or equation itself, such as "x^3 - 3x" or "2x + 5 = 11", and choose a topic for what to do with it.'
  : `"${word}" is not a known function, constant or variable. Variables are single letters (x, t, y); functions are sin, cos, ln, sqrt, …`);

const unknownWordError = (problem, word) => parseError({
  input: problem,
  hint: unknownWordHint(word),
  tips: ['Type the mathematics itself — an expression or an equation, such as "2x + 5 = 11" or "x^2 - 4".'],
});

// "… at x = 2" / "… when x = π/4": an evaluation point tacked onto the end
// of a problem. Read on the raw text before any routing, because the "=" in
// it would otherwise make "x^2 at x = 1.5" look like an equation (in the
// unknowns a, t and x). Returns { rest, variable, valueText } or null.
function extractEvalPoint(problem) {
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
function renameFunction(result, name) {
  if (!result || name === 'f') return result;
  const swap = (text) => (typeof text === 'string' ? text.replace(/(?<![a-z])f(?=(?:'+|′+|″|‴)?\(\s*[^()]*\s*\))/g, name) : text);
  result.answer = swap(result.answer);
  for (const key of ['steps', 'tips', 'common_mistakes']) if (Array.isArray(result[key])) result[key] = result[key].map(swap);
  if (result.graph?.secondaryLabel) result.graph.secondaryLabel = swap(result.graph.secondaryLabel);
  return result;
}

const PRIMED_CALL = /(?<![a-z])([a-z])\s*('+|′+|″|‴)\s*\(\s*([^()]+?)\s*\)/gi;
function primedFunctionRequest(problem) {
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
function implicitDerivativeRequest(problem, topic) {
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

const TOPIC_NAMES = { auto: 'Auto-detect', derivatives: 'Derivatives', integrals: 'Integrals', limits: 'Limits', functions: 'Functions', trigonometry: 'Trigonometry', algebra: 'Algebra', other: 'Arithmetic' };

// A solved result that was routed away from the chosen topic says so, first.
function noteRouting(result, from, to, why) {
  // Nothing was solved as anything when the input could not be read: no
  // "Solved as Arithmetic" notice above a parse error.
  if (result && Array.isArray(result.steps) && from !== to && result.status !== STATUS.PARSE_ERROR) {
    result.steps = [`Solved as ${TOPIC_NAMES[to]} (you chose ${TOPIC_NAMES[from]}): ${why}.`, ...result.steps];
    // For the page: SolutionDisplay shows this as a notice above the steps
    // (with a button to switch the topic) instead of the first step above,
    // which stays for exports and history, where there is no notice.
    result.routing = { from, to, reason: why };
    // The topic the problem was actually solved under — history and the
    // Progress stats file it there, not under the dropdown's guess.
    result.routedTopic = to;
  }
  return result;
}

// One equation (exactly one '=') that contains a sin/cos/tan call.
function isSingleTrigEquation(problem) {
  const text = String(problem);
  const equalsCount = (text.match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount === 1 && /(?<![a-z])(sin|cos|tan)\s*[(^a-z0-9]/i.test(text);
}

// Text that is program source rather than mathematics. The engines can hand
// back a live function or object — mathjs parses "sin(x) = 1/2" as a function
// *definition* and returns the function — and stringifying one yields its
// (minified) JavaScript. Nothing that matches these belongs in a solution.
// The shapes are deliberately code-specific (a `function` keyword with a
// parameter list and body, an arrow with a body, a native/object stringify)
// so ordinary prose — "return to the original variable", "the arguments of
// the trig functions" — is never mistaken for a leak.
const SOURCE_CODE_PATTERN = /\bfunction\b\s*[\w$]*\s*\([^)]*\)\s*\{|\)\s*=>\s*[{(\w]|\[native code\]|\[object \w+\]|\barguments\.length\b/;

// Is this value a legitimate piece of solution text — a string of maths or
// prose, or a finite/readable number? Anything else (functions, objects,
// arrays, symbols, code-shaped strings) is an engine internal that leaked.
export function isPresentable(value) {
  if (typeof value === 'number') return true; // formatNumber handles NaN/∞ text
  if (typeof value === 'bigint') return true;
  if (typeof value !== 'string') return false;
  return !SOURCE_CODE_PATTERN.test(value);
}

// Shared result validation — every solver's output passes through here.
// This is the envelope contract gate: a result must carry a valid `status`
// (see solutionEnvelope.js). The legacy shim below infers one for solvers
// not yet migrated; it is deleted at the end of the migration (Phase 2 of
// docs/future-work/MATH-STATE-SEMANTICS.md).
//
// It is also the last line of defence against engine internals reaching the
// screen: an answer or step that is not presentable text is replaced with an
// honest "unsupported" envelope, never rendered — and never marked solved.
// Shown whenever a solved input relied on the base-10 reading of a bare `log`.
export const COMMON_LOG_TIP = '"log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.';

export function finalizeResult(result, input) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid solver result');
  }
  if (!result.steps || !Array.isArray(result.steps)) {
    result.steps = ['Solution computed'];
  }
  if (result.answer === undefined || result.answer === null || result.answer === '') {
    throw new Error('No solution found');
  }

  const leaked = [result.answer, ...result.steps].find((v) => !isPresentable(v));
  if (leaked !== undefined) {
    console.error('Solver returned a non-presentable value; refusing to render it:', typeof leaked, String(leaked).slice(0, 120));
    return unsupported({
      input,
      reason: 'The maths engine returned an internal value instead of a result for this input. This is a limitation of the solver, not your notation.',
      answer: 'This problem is beyond what this solver can compute',
      tips: [
        'If this is an equation, try the Algebra topic — the Trigonometry topic evaluates and simplifies expressions.',
        'The input itself was read correctly; nothing needs reformatting.',
      ],
    });
  }
  // Numbers are fine as answers, but the UI and exports expect a string.
  // The ⟦…⟧ math markers (mathMarkers.js) belong to steps, tips and
  // mistakes, which the page typesets by them; the answer is graded, saved
  // to history and shown in Progress as text.
  result.answer = stripMathMarkers(result.answer);
  result.steps = result.steps.map((s) => (typeof s === 'string' ? s : String(s)));
  if (!result.tips || !Array.isArray(result.tips)) {
    result.tips = [];
  }
  if (!result.common_mistakes || !Array.isArray(result.common_mistakes)) {
    result.common_mistakes = [];
  }
  // Tips and mistakes keep their markers (1.53.0): the page typesets only
  // the marked runs ('marked' mode), and every export strips them.
  result.tips = result.tips.map(String);
  result.common_mistakes = result.common_mistakes.map(String);
  if (Array.isArray(result.warnings)) result.warnings = result.warnings.map(stripMathMarkers);
  if (!isValidStatus(result.status)) {
    // Legacy shim: the pre-envelope failure convention was an answer string
    // starting with "Unable to". Anything else counts as solved. Only an
    // inferred failure gets a warning — it means a failure path somewhere
    // still isn't using the envelope constructors.
    if (/^unable to/i.test(String(result.answer))) {
      result.status = STATUS.PARSE_ERROR;
      console.warn(`Solver failure path returned no status — inferred "${result.status}" for answer: ${result.answer}`);
    } else {
      result.status = STATUS.SOLVED;
    }
  }
  // Say which logarithm convention was applied, once, on solved results only.
  if (result.status === STATUS.SOLVED && usesCommonLog(input || '') && !result.tips.includes(COMMON_LOG_TIP)) {
    result.tips = [COMMON_LOG_TIP, ...result.tips];
  }
  // 8/2(2+2), 6/2x, 1/2pi: division followed by implicit multiplication is
  // read left to right (as every calculator and the parser do), but many
  // readers see the juxtaposed factor as part of the denominator. Solve it,
  // and say which reading was used (September 2026 review, batch 3).
  if (result.status === STATUS.SOLVED) {
    const warning = implicitDivisionWarning(input || '');
    if (warning && !(result.warnings || []).includes(warning)) result.warnings = [...(result.warnings || []), warning];
  }
  return result;
}

// The two readings of a/b(c) — MasterMath's (a/b)·(c) and the grouped
// a/(b·c) — with values when the input is purely numeric. Null when the
// input has no such juxtaposition, or the grouping is already explicit.
function implicitDivisionWarning(raw) {
  const text = String(raw).replace(/\s+/g, '');
  // number or single letter, slash, number, then a paren group or a letter
  // (a variable, or pi) — with no operator in between.
  const m = text.match(/(?<![\w.)])((?:\d+(?:\.\d+)?|[a-z]))\/(\d+(?:\.\d+)?)(\(|[a-z])/i);
  if (!m) return null;
  const tailStart = m.index + m[0].length - 1;
  let tail;
  if (m[3] === '(') {
    const close = matchingParen(text, tailStart);
    if (close < 0) return null;
    tail = text.slice(tailStart, close + 1);
  } else {
    const word = text.slice(tailStart).match(/^[a-z]+/i)[0];
    tail = word;
  }
  const num = m[1];
  const den = m[2];
  const asWritten = `(${num}/${den})·${tail}`;
  const grouped = `${num}/(${den}·${tail})`;
  let values = '';
  if (!/[a-z]/i.test(`${num}${tail}`.replace(/\bpi\b/gi, ''))) {
    try {
      const evalText = (t) => math.evaluate(t.replace(/·/g, '*').replace(/\bpi\b/gi, 'pi'));
      const a = evalText(asWritten);
      const b = evalText(grouped);
      if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-12) {
        values = ` = ${formatNumber(a)}`;
        return `"${num}/${den}${tail}" can be read two ways. MasterMath follows left-to-right precedence: ${asWritten}${values}. If you meant ${grouped} = ${formatNumber(b)}, write the grouping explicitly: ${num}/(${den}*${tail}).`;
      }
      return null;
    } catch {
      /* fall through to the symbolic wording */
    }
  }
  return `"${num}/${den}${tail}" can be read two ways. MasterMath follows left-to-right precedence: ${asWritten}. If you meant ${grouped}, write the grouping explicitly: ${num}/(${den}*${tail}).`;
}

// Real math solver using local libraries
// "x^2 + 1 at x = 3": substitute the value and evaluate as arithmetic, with
// the substitution shown as a step.
async function evaluateAtPoint({ rest, variable, valueText }) {
  // parseMathExpression is imported statically at the top of this file.
  const expression = parseMathExpression(extractFunctionFromProblem(rest));
  const substituted = expression.replace(new RegExp(`(?<![a-z])${variable}(?![a-z(])`, 'gi'), `(${valueText})`);
  const { solveArithmetic } = await import('./solvers/arithmeticSolver.js');
  const result = await solveArithmetic(substituted);
  if (result.status && result.status !== STATUS.SOLVED) return result;
  const shownExpr = beautifyText(expression);
  return {
    ...result,
    steps: [
      `Evaluate f(${variable}) = ${shownExpr} at ${variable} = ${valueText}.`,
      `Substitute ${variable} = ${valueText}: ${beautifyText(substituted)}`,
      ...(result.steps || []),
    ],
    answer: `f(${valueText}) = ${result.answer}`,
  };
}

const beautifyText = (s) => String(s).replace(/\*/g, '·').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³');

export async function solveProblem(problem, topic) {
  try {
    // Validate inputs
    if (!problem || typeof problem !== 'string') {
      throw new Error('Invalid problem input');
    }

    if (!topic || typeof topic !== 'string') {
      throw new Error('Invalid topic selection');
    }

    // "x squared", "e to the x", "is greater than", "x**3" → notation,
    // before routing reads it (plainEnglish.js).
    problem = readPlainEnglish(problem);
    // The request phrases students type around the maths: "the", "the
    // expression", "the quadratic equation", "the zeros of". Each word was
    // glued to the maths and refused as one unknown word, or worse:
    // "simplify the expression (x^2-1)/(x-1)" was answered
    // "theexpression(x^2 - 1)/(x - 1)", marked Solved; "calculate the definite
    // integral of x^2 from 0 to 3" was refused as improper (October 2026
    // review sweep).
    const request = readRequestPhrases(problem);
    // Malformed typing — "2+*", "x^2 +", "sin()", "2 # 3" — is refused here,
    // once, before any topic or request reads it (syntaxCheck.js). Each path
    // used to check for itself, and what one refused another answered,
    // marked Solved. After the word-problem test: that one reads prose.
    if (!looksLikeWordProblem(request.problem)) {
      const bad = syntaxProblem(request.problem);
      if (bad) return finalizeResult(parseError({ input: problem, hint: bad.hint, tips: bad.tips }), problem);
    }
    if (request.topic) {
      const routed = request.request ? await solveRequest(request.request, problem) : await solveProblem(request.problem, request.topic);
      if (topic === request.topic) return routed;
      if (topic !== 'auto') return noteRouting(routed, topic, request.topic, request.reason);
      // Under Auto-detect: the same notice and record as a detected topic.
      if (!routed || !Array.isArray(routed.steps) || routed.status === 'parse_error') return routed;
      const reason = request.reason.replace(/^the input\b/i, 'your input');
      routed.steps = [`Detected as ${TOPIC_NAMES[request.topic]}: ${reason}.`, ...routed.steps];
      routed.routing = { from: 'auto', to: request.topic, reason, detected: true };
      routed.routedTopic = request.topic;
      return routed;
    }
    problem = request.problem;

    // "area under the curve x^2 from 0 to 1" is the definite integral, with
    // a tip that it is the net area.
    const areaUnder = /^\s*(?:find\s+)?(?:the\s+)?area\s+under\s/i.test(problem);
    if (areaUnder) {
      const result = await solveProblem(problem.replace(/^\s*(?:find\s+)?(?:the\s+)?area\s+under\s+(?:the\s+)?(?:curve\s+|graph\s+)?(?:of\s+)?(?:y\s*=\s*|f\s*\(\s*x\s*\)\s*=\s*)?/i, 'integral of '), topic);
      if (result?.status === 'solved' && Array.isArray(result.tips)) {
        result.tips = ['The area under a curve is its definite integral. Where the curve dips below the x-axis, that part counts as negative, so the integral is the net area; for the total area, integrate the absolute value.', ...result.tips];
      }
      return result;
    }

    if (looksLikeWordProblem(problem)) return finalizeResult(wordProblemRefusal(problem), problem);

    // Auto-detect: solve under the topic the input asks for, and say which.
    // The detected topic's own routing may move it again (a verb, a constant
    // that divides by zero); the final topic is the one reported and saved.
    if (topic === 'auto') {
      const detected = detectTopic(problem);
      const result = await solveProblem(problem, detected.topic);
      // A parse error was not solved as anything: no notice.
      if (!result || !Array.isArray(result.steps) || result.status === 'parse_error') return result;
      const to = result.routing?.to || detected.topic;
      const reason = result.routing?.reason ? result.routing.reason.replace(/^the input\b/i, 'your input') : detected.reason;
      const steps = result.routing ? result.steps.slice(1) : result.steps;
      result.steps = [`Detected as ${TOPIC_NAMES[to]}: ${reason}.`, ...steps];
      result.routing = { from: 'auto', to, reason, detected: true };
      result.routedTopic = to;
      return result;
    }

    let result;

    // f(x) = … (or g, h, y = …) under Integrals integrates the right side, as
    // Derivatives differentiates it; it came back "x^2", marked Solved.
    if (topic === 'integrals') {
      const def = String(problem).match(/^\s*(?:[fgh]\s*\(\s*[a-z]\s*\)|y)\s*=(?!=)\s*(.+)$/i);
      if (def && !/[=<>≤≥]/.test(def[1]) && !/(?<![a-z])y(?![a-z])/i.test(def[1])) {
        return solveProblem(def[1], 'integrals');
      }
    }

    // dy/dx of an equation in x and y, before the differential-equation
    // check below: "find dy/dx if x^2 + y^2 = 25" names dy/dx but is not one.
    const implicit = implicitDerivativeRequest(problem, topic);
    if (implicit) {
      if (implicit.explicit) {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(implicit.explicit);
        const evalAt = implicit.point !== null ? { variable: implicit.variable, valueText: implicit.point } : undefined;
        result = await solveDerivative(expression, { variable: implicit.variable, evalAt });
      } else {
        const { solveImplicitDerivative } = await import('./solvers/implicitDerivativeSolver.js');
        result = await solveImplicitDerivative(implicit.lhs, implicit.rhs, implicit);
      }
      return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', `the input asks for the derivative of an equation in ${implicit.explicit ? implicit.variable : `${implicit.independent} and ${implicit.dependent}`}`), problem);
    }

    // Differential equations (y'' + y = 0, dy/dx = 2x) and matrices are
    // outside every solver family. Refused up front, honestly: the algebra
    // path read y'' + y = 0 as 0 and called it solved (October 2026 review).
    {
      const t = String(problem);
      // A primed call — f'(x), y''(t) — is read by primedFunctionRequest: a
      // derivative when the input defines the function, else an ODE or a
      // function that was never given. A bare prime (y'' + y = 0) is an ODE.
      // (The lookahead sits after the whole prime run, so the regex cannot
      // back off to a shorter run to dodge it.)
      const fn = primedFunctionRequest(t);
      if (fn?.kind === 'derivative') {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(fn.expression);
        const evalAt = fn.point !== null ? { variable: fn.variable, valueText: fn.point } : undefined;
        result = renameFunction(await solveDerivative(expression, { order: fn.order, variable: fn.variable, evalAt }), fn.name);
        return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input asks for a derivative'), problem);
      }
      if (fn?.kind === 'undefined') {
        const call = fn.call.replace(/\s+/g, '');
        const arg = (call.match(/\(([a-z])\)$/i) || [null, 'x'])[1];
        const example = `${fn.name}${"'".repeat(Math.max(1, fn.order))}(${arg}) where ${fn.name}(${arg}) = ${arg}^3`;
        return finalizeResult(unsupported({
          input: problem,
          reason: `${call} ${fn.order ? 'is a derivative of' : 'names'} a function ${fn.name}, and the input does not say what ${fn.name} is. Enter the function itself, or define it in the same input.`,
          answer: `The function ${fn.name} is not given`,
          tips: [
            'Under Derivatives, type the function itself: "x^3" gives its derivative, and "x^3 at x = 2" its value there.',
            `Or define it: "${example}".`,
          ],
        }), problem);
      }
      const primed = fn?.kind === 'ode' || /(?<![a-z])[a-z]\s*(?:'+|′+|″|‴)(?!['′″‴]|\s*\()/.test(t);
      const leibniz = /\bd[a-z]\s*\/\s*d[a-z]\b/i.test(t);
      if (primed || leibniz) {
        return finalizeResult(unsupported({
          input: problem,
          reason: `${beautify(t)} is a differential equation: it relates a function to its own derivative${primed ? " (the ' marks a derivative)" : ' (dy/dx is the derivative of y)'}. Solving differential equations is not supported; the solver differentiates and integrates functions you give it.`,
          answer: 'Differential equations are not supported',
          tips: [
            'To differentiate a function, enter it under Derivatives: "x^3", or "d/dx(x^3)".',
            fn?.rhs
              ? `This one only gives the derivative, so ${fn.name} is an antiderivative of the other side: integrate it under Integrals, "∫ ${fn.rhs} dx", and the answer is that plus a constant C.`
              : 'To find a function from its derivative, integrate it under Integrals: "∫ 2x dx".',
          ],
        }), problem);
      }
      // "[1, 2]" alone is a vector; it was echoed back as the answer, and
      // "integrated" to [x, 2x] + C.
      if (/^\s*\[[^\]]*\]\s*$|\[\s*\[|\b(?:matrix|matrices|determinant|eigenvalues?|eigenvectors?|transpose|vectors?)\b/i.test(t)) {
        return finalizeResult(unsupported({
          input: problem,
          reason: 'Vectors and matrices (determinants, inverses, eigenvalues, products) are not supported yet. The solver covers arithmetic, algebra, systems of equations, inequalities, trigonometry, functions, limits, derivatives and integrals.',
          answer: 'Vectors and matrices are not supported yet',
          tips: ['A system of linear equations can be solved as equations: "2x + 3y = 6; x - y = 4".'],
        }), problem);
      }
    }

    // Higher-order derivatives and "with respect to": read from the raw text
    // and handed to the derivative solver as options. "second derivative of
    // x^3" was answering the FIRST derivative; "d^2/dx^2 x^3" was garbage.
    const derivOpts = {};
    {
      const t = String(problem);
      const ord = t.match(/\b(second|third|fourth|2nd|3rd|4th)\s+derivative\b/i) || t.match(/\bd\s*(?:\^\s*(\d)|([²³])|(\d))\s*\/\s*d[a-z]\s*(?:\^\s*\d|[²³]|\d)/i) || t.match(/\b[a-z]('{2,}|′{2,}|″|‴)\s*\(/);
      if (ord) {
        const word = ord[1] || ord[2] || ord[3] || '';
        derivOpts.order = /^(second|2nd|2|²)$/i.test(word) ? 2 : /^(third|3rd|3|³)$/i.test(word) ? 3 : /^(fourth|4th|4)$/i.test(word) ? 4 : /^(''|′′|″)$/.test(word) ? 2 : /^('''|′′′|‴)$/.test(word) ? 3 : 1;
      }
      const wrt = t.match(/\bwith\s+respect\s+to\s+([a-z])\b/i);
      if (wrt) derivOpts.variable = wrt[1].toLowerCase();
    }
    const stripDerivPhrases = (t) => String(t)
      .replace(/\bwith\s+respect\s+to\s+[a-z]\b/i, '')
      .replace(/\b(second|third|fourth|2nd|3rd|4th)\s+derivative\b/i, 'derivative')
      .replace(/\bd\s*(?:\^\s*\d|[²³]|\d)\s*\/\s*d([a-z])\s*(?:\^\s*\d|[²³]|\d)/i, 'd/d$1')
      .replace(/\b([a-z])(?:'{2,}|′{2,}|″|‴)\s*\(([a-z])\)\s*(?:where|if|when|,)?\s*(?:\1\s*\(\2\)\s*=)?/i, (m, f, v, ) => (/=/.test(m) ? '' : m))
      .replace(/^\s*[a-z]'*\s*\(\s*[a-z]\s*\)\s*=\s*/i, '');
    if (derivOpts.order || derivOpts.variable) {
      const stripped = stripDerivPhrases(problem);
      const point = extractEvalPoint(stripped);
      const src = point ? point.rest : stripped;
      const { solveDerivative } = await import('./solvers/derivativesSolver.js');
      const expression = extractFunctionFromProblem(/\bderivative\b|d\/d[a-z]/i.test(src) ? src : `derivative of ${src}`);
      result = await solveDerivative(expression, { ...derivOpts, evalAt: point || undefined });
      return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input asks for a derivative'), problem);
    }

    // "f at x = a": strip the evaluation point first so the "=" in it is not
    // mistaken for an equation, then hand it to the solver as an option.
    const evalAt = extractEvalPoint(problem);
    if (evalAt) {
      const calculusRaw = detectCalculusIntent(problem);
      if (calculusRaw === 'derivatives' || (!calculusRaw && topic === 'derivatives')) {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(evalAt.rest);
        result = await solveDerivative(expression, { ...derivOpts, evalAt });
        return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input uses derivative notation'), problem);
      }
      if (!calculusRaw && ['algebra', 'functions', 'other', 'trigonometry'].includes(topic) && !looksLikeInequality(evalAt.rest) && !/=/.test(evalAt.rest)) {
        return finalizeResult(await evaluateAtPoint(evalAt), problem);
      }
    }

    // The input's own intent wins over the dropdown. Calculus notation under
    // any topic goes to that solver; a plain equation in one unknown under a
    // non-algebra topic goes to Algebra. Each is labelled as routed.
    const calculus = detectCalculusIntent(problem);
    if (calculus && calculus !== topic) {
      const routed = await solveProblem(problem, calculus);
      return noteRouting(routed, topic, calculus, `the input uses ${calculus === 'limits' ? 'limit' : calculus === 'integrals' ? 'integral' : 'derivative'} notation`);
    }
    // An inequality is an algebra problem under any topic. Under Derivatives
    // "x^2 - 4 > 0" was refused outright ("beyond this engine") when the
    // sign-chart solver had the answer all along.
    if (!calculus && topic !== 'algebra' && looksLikeInequality(problem)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is an inequality');
    }
    // A system of equations is an algebra problem under any topic. Without
    // this, "2x + 3y = 6; x - y = 4" typed under Derivatives was fed to the
    // single-expression extractor, which kept the "6" of the first equation
    // and answered "f(x) = 4, f'(x) = 0" — silently, and marked Solved.
    if (!calculus && topic !== 'algebra' && looksLikeSystem(problem)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is a system of equations');
    }
    if (!calculus && isPlainEquationForAlgebra(problem, topic)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is an equation to solve');
    }
    // A trig function or a degree sign under Arithmetic is a Trigonometry
    // problem: the arithmetic evaluator knows no angle units, so sin(30) was
    // -0.988 (radians) where the Trigonometry solver and the angle setting
    // say 1/2, sin(30°) was a syntax error, and sin(pi/6) lost its exact 1/2.
    if (!calculus && topic === 'other' && /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan)\s*\(|°/i.test(problem)) {
      const routed = await solveProblem(problem, 'trigonometry');
      return noteRouting(routed, topic, 'trigonometry', 'the input uses a trig function, and angles are read with your angle setting there');
    }
    if (!calculus && topic === 'algebra' && isComplexNumberInput(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a calculation with complex numbers');
    }
    if (!calculus && isAlgebraUnderArithmetic(problem, topic)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input contains a variable, and arithmetic has none');
    }
    // "2 3": two numbers with only a space between them would be read as 23.
    // Any topic, not just Arithmetic: under Algebra "12 34" was answered
    // 1234, and under Derivatives f'(x) = 0 (corpus row, October 2026).
    const spaced = /[a-z=<>]/i.test(problem) ? null : problem.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (spaced) {
      const [, a, b] = spaced;
      return finalizeResult(parseError({
        input: problem,
        hint: `Two numbers with a space between them — did you mean to multiply (${a}*${b}) or to write one number (${a}${b})?`,
        tips: [`Use "*" for multiplication: "${a}*${b}". To write one number, remove the space.`],
      }), problem);
    }
    // "factor x^2-5x+6", "expand (x+1)^2", "simplify …", "solve …": the verb
    // is the intent, as "derivative of" is. Under Integrals "factor …" was
    // a parse error ("factor" is not a known function; October 2026 review).
    // With a trig function in it, the verb's home is Trigonometry, which
    // knows the identities: under Algebra "simplify tan(x)*cos(x)" came back
    // unchanged, where Trigonometry gives sin(x).
    const verb = !calculus && String(problem).match(/^\s*(factor(?:i[sz]e)?|expand|simplify|solve)\b/i);
    const verbHome = verb && (/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*[(^]/i.test(problem) ? 'trigonometry' : 'algebra');
    if (verb && topic !== verbHome) {
      const routed = await solveProblem(problem, verbHome);
      return noteRouting(routed, topic, verbHome, `the input asks to ${verb[1].toLowerCase().replace(/^factori[sz]e$/, 'factor')} it`);
    }
    if (!calculus && topic !== 'functions' && GRAPH_VERB.test(problem)) {
      const routed = await solveProblem(problem, 'functions');
      return noteRouting(routed, topic, 'functions', `the input asks to ${graphVerb(problem)} it`);
    }
    if (['integrals', 'derivatives', 'functions', 'limits'].includes(topic) && constantDividesByZero(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a number, not a function, and it divides by zero');
    }
    // "50% of 80" is a calculation whatever the topic: under Integrals it was
    // ∫(50%of80) do = 50o + C, marked Solved.
    if (!calculus && topic !== 'other' && /^\s*\d+(?:\.\d+)?\s*%\s*of\s+\d/i.test(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a percentage calculation');
    }
    if (topic === 'limits' && !calculus && isConstantInput(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a number with no limit in it (a limit needs "lim x->a")');
    }
    if (!calculus && isArithmeticUnderTrigonometry(problem, topic)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a numeric expression, with no angle or trig function in it');
    }

    // Inequalities: a <, >, ≤, or ≥ operator. Routed from the raw text so the
    // operator and both sides stay intact for the sign-chart solver.
    if (topic === 'algebra' && looksLikeInequality(problem)) {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
      const { solveInequality } = await import('./solvers/inequalitiesSolver.js');
      result = await solveInequality(problem);
      return finalizeResult(result, problem);
    }

    // Systems of equations: two or more equations. Detected from the RAW
    // problem (before the single-expression extractor mangles the first
    // equation) and routed to the dedicated 2×2 linear solver.
    if (topic === 'algebra' && looksLikeSystem(problem)) {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
      const { solveSystem } = await import('./solvers/systemsSolver.js');
      result = await solveSystem(problem);
      return finalizeResult(result, problem);
    }

    // A single trig equation typed under Algebra (sin(x) = 1/2) gets the same
    // exact treatment as under Trigonometry — general solution and special
    // angles — instead of the algebra solver's numeric root scan. Only the
    // supported family is taken; anything else falls through to algebra.
    if (topic === 'algebra' && isSingleTrigEquation(problem)) {
      const { solveTrigEquation } = await import('./solvers/trigEquationSolver.js');
      const trig = solveTrigEquation(extractFunctionFromProblem(problem));
      if (trig.status !== STATUS.UNSUPPORTED) {
        return finalizeResult(trig, problem);
      }
    }

    if (topic === 'limits' || topic === 'integrals') {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
    }

    const solver = await resolveSolver(problem, topic);
    if (!solver) {
      throw new Error('No solver available for this topic');
    }

    // Route to appropriate solver based on topic
    switch (topic) {
      case 'limits':
        // Pass raw problem text so the limit solver can extract the approach value
        result = await solver(problem);
        break;

      case 'integrals':
        // Pass raw problem text so the integral solver can read definite-
        // integral bounds before parseMathExpression collapses the spacing.
        result = await solver(problem);
        break;

      default: {
        // "d/dx" alone, "derivative of": the instruction with nothing to
        // work on ("dx" was refused as an unknown word).
        const expression = /^\s*(?:d\/d[a-z]|(?:find\s+)?(?:the\s+)?derivative(?:\s+of)?|differentiate)\s*$/i.test(problem) ? '' : extractFunctionFromProblem(problem);
        if (!expression || expression.trim().length === 0) {
          return finalizeResult(parseError({
            input: problem,
            hint: topic === 'derivatives'
              ? 'There is nothing to differentiate — write the function after d/dx: "d/dx (x^3)", or just "x^3".'
              : 'No expression was found in the input.',
          }), problem);
        }
        // "hello", "help me", "x x" (→ "xx"): a word the engines do not know.
        // Not a variable, not a function — a parse error with a hint, before
        // Algebrite treats it as a symbol and "solves" or echoes it.
        if (topic !== 'other') {
          const word = unknownWord(expression);
          if (word) {
            const twoLetters = /^[a-z] [a-z]$/i.test(word) || (word.length === 2 && word[0] === word[1]);
            return finalizeResult(parseError({
              input: problem,
              hint: twoLetters
                ? `"${word}" — two variables side by side. For a product, write ${word[0]}*${word[word.length - 1]}.`
                : unknownWordHint(word),
              tips: ['Type the mathematics itself — an expression or an equation, such as "2x + 5 = 11" or "x^2 - 4".'],
            }), problem);
          }
        }
        // Unbalanced parentheses: "sin(x", "sin(x))". Echoed back as "solved"
        // before; a parse error with the count is what a student needs.
        {
          const opens = (expression.match(/\(/g) || []).length;
          const closes = (expression.match(/\)/g) || []).length;
          if (opens !== closes) {
            return finalizeResult(parseError({
              input: problem,
              hint: `Unbalanced parentheses: ${opens} opening "(" and ${closes} closing ")".`,
              tips: ['Every "(" needs a matching ")": "sin(x)", "(x + 1)^2".'],
            }), problem);
          }
          if (/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i.test(expression)) {
            const fn = expression.match(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i)[1];
            return finalizeResult(parseError({
              input: problem,
              hint: `"${fn}()" has nothing inside it — ${fn} needs an argument: "${fn}(x)", "${fn}(30)".`,
            }), problem);
          }
        }
        // "sin^2", "ln + 3": a function name with nothing to apply it to.
        // Refused here with a usable hint; left alone, mathjs fails deep
        // inside pow ("Unexpected type of argument … actual: function").
        {
          // parseMathExpression is imported statically at the top of this file.
          const bare = bareFunctionName(parseMathExpression(expression));
          if (bare) {
            return finalizeResult(parseError({
              input: problem,
              hint: `${bare} needs an argument in parentheses — ${bare}(x), ${bare}(2), ${bare}^2(x).`,
              tips: [`Every function call needs parentheses: "${bare}(x)", not "${bare} x" or "${bare}" alone.`],
            }), problem);
          }
        }
        // The extractor strips verbs, so intent has to ride alongside the
        // expression: "factor x^2 - 9" routes to the algebra solver's
        // factoring path instead of the (no-op) simplify path.
        if (topic === 'algebra' && /\b(?:factor|factorize|factorise)\b/i.test(problem)) {
          result = await solver(expression, { intent: 'factor' });
        } else if (topic === 'algebra' && /\b(?:expand|multiply out|distribute)\b/i.test(problem)) {
          result = await solver(expression, { intent: 'expand' });
        } else if (topic === 'algebra' && /\bsolve\s+for\s+([a-z])\b/i.test(problem)) {
          // "solve for y" — matters when the equation has two unknowns.
          result = await solver(expression, { solveFor: problem.match(/\bsolve\s+for\s+([a-z])\b/i)[1].toLowerCase() });
        } else {
          result = await solver(expression);
        }
        break;
      }
    }

    return finalizeResult(result, problem);

  } catch (error) {
    console.error('Solver error:', error);

    // Last-resort fallback: an error escaped every solver's own handling, so
    // the specific cause is unknown — the error message is the best hint we
    // have (parseError puts an engine's message into words). Solver-level
    // failures carry more specific envelopes than this. No generic tips:
    // "use * for multiplication" under an error about something else only
    // sends the student looking in the wrong place.
    return parseError({
      input: problem,
      hint: error.message || 'An unexpected error occurred',
    });
  }
}
