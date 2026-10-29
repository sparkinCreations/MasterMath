// Which topic a problem belongs to: Auto-detect (detectTopic) and the tests
// the router uses to move a problem to the topic that can solve it.

import { parseMathExpression } from '../mathParser.js';
import { math } from '../solvers/solverUtils.js';

// A system of equations has two or more equations (two or more '=' signs that
// aren't part of >=, <=, ==, !=). Detected on the raw text so the router can
// hand it to the systems solver before single-expression extraction.
export function looksLikeSystem(problem) {
  const equalsCount = (String(problem).match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount >= 2;
}

// An inequality carries a <, >, ≤, or ≥ relation.
export function looksLikeInequality(problem) {
  return /[<>≤≥]/.test(String(problem));
}

// What the INPUT says it is, regardless of the topic picked in the dropdown.
// A student who types "d/dx x^3" under Algebra means a derivative; the old
// behaviour stripped the "d/dx" and "simplified" x^3 to x^3, marked Solved.
// Returns 'derivatives' | 'integrals' | 'limits' | null.
export function detectCalculusIntent(problem) {
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
export const GRAPH_VERB = /^\s*(graph|plot|sketch|draw|analy[sz]e)\b/i;
export const graphVerb = (t) => t.match(GRAPH_VERB)[1].toLowerCase().replace(/^analyze$/, 'analyse').replace(/^draw$|^plot$/, 'graph');

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
export function isPlainEquationForAlgebra(problem, topic) {
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
export function isAlgebraUnderArithmetic(problem, topic) {
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
export function isConstantInput(problem) {
  const t = String(problem).trim();
  return t.length > 0 && !/[a-z=<>≤≥∫]/i.test(t.replace(/\b(?:pi|e)\b/gi, '')) && /\d/.test(t);
}

export function constantDividesByZero(problem) {
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
export function isArithmeticUnderTrigonometry(problem, topic) {
  if (topic !== 'trigonometry') return false;
  const t = String(problem);
  // A degree sign is an angle: "90°" stays (Arithmetic sends it here).
  if (/[a-z=<>≤≥°]/i.test(t)) return false;
  return /\d/.test(t);
}

// One equation (exactly one '=') that contains a sin/cos/tan call.
export function isSingleTrigEquation(problem) {
  const text = String(problem);
  const equalsCount = (text.match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount === 1 && /(?<![a-z])(sin|cos|tan)\s*[(^a-z0-9]/i.test(text);
}
