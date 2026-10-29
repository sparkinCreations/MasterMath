// Words in a problem: a word no engine knows (a parse error on every path,
// never a constant), the hint for it, and word problems refused up front.

import { parseError, unsupported } from '../solutionEnvelope.js';

// Words the engines know. Anything else that is two or more letters long is
// not mathematics this app can read ("hello", "helpme", "xx").
const KNOWN_WORDS = new Set(['of', 'gcd', 'lcm', 'min', 'max', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sqrt', 'cbrt', 'nthroot', 'abs', 'log', 'ln', 'log10', 'log2', 'exp', 'pi', 'mod', 'choose', 'combinations', 'permutations', 'factorial', 'floor', 'ceil', 'round', 'sign', 'sgn', 'gamma', 'erf', 'infinity', 'inf', 'deg', 'degrees', 'rad']);
export function unknownWord(expression) {
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
export function unknownWordInProblem(problem) {
  const words = String(problem).match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  const unknown = words.find((w) => {
    const lower = w.toLowerCase();
    return !KNOWN_WORDS.has(lower) && !INSTRUCTION_WORDS.has(lower) && !/^d[a-z]$/.test(lower);
  });
  if (unknown) return unknown;
  const call = unknownFunction(problem);
  return call && !INSTRUCTION_WORDS.has(call.slice(0, -1).toLowerCase()) ? call : null;
}

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
export function looksLikeWordProblem(problem) {
  const words = String(problem).match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  const prose = words.filter((w) => {
    const lower = w.toLowerCase();
    return !KNOWN_WORDS.has(lower) && !INSTRUCTION_WORDS.has(lower) && !MATH_TALK.has(lower) && !/^d[a-z]$/.test(lower);
  });
  // A story problem gives its numbers ("120 miles in 2 hours"); a question
  // with none ("determine whether the series converges") is not one.
  return prose.length >= 3 && /\d/.test(problem);
}
export const wordProblemRefusal = (problem) => unsupported({
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
export const unknownWordHint = (word) => (/\($/.test(word) ? unknownFunctionHint(word.slice(0, -1)) : gluedWords(word)
  ? 'The words in this problem could not be read as maths. Type the expression or equation itself, such as "x^3 - 3x" or "2x + 5 = 11", and choose a topic for what to do with it.'
  : `"${word}" is not a known function, constant or variable. Variables are single letters (x, t, y); functions are sin, cos, ln, sqrt, …`);

export const unknownWordError = (problem, word) => parseError({
  input: problem,
  hint: unknownWordHint(word),
  tips: ['Type the mathematics itself — an expression or an equation, such as "2x + 5 = 11" or "x^2 - 4".'],
});
