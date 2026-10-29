// Notation read and written exactly: the problem marked as math, percent
// rewritten, logarithms folded and named, roots simplified.

import { createMath } from '../../mathInstance.js';
import { gcd, mark } from '../solverUtils.js';

// The problem as typed is math (3/4 + 5/6) or a phrase (15% of 80): mark it
// only when every word in it is a function name, or KaTeX sets the words as
// italic letters.
const MATH_NAMES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sqrt', 'ln', 'log', 'exp', 'abs', 'pi', 'mod', 'e']);
export const asMath = (t) => ((String(t).match(/[a-z]{2,}/gi) || []).every((w) => MATH_NAMES.has(w.toLowerCase())) ? mark(t) : t);

// A second mathjs instance that computes in exact rational arithmetic. Where
// the whole expression is rational (1/3 + 1/6), it yields the exact fraction;
// where it isn't (sqrt(2), e^2, factorials) it throws, and the float result
// stands. Used only for display: the float `math` result remains the value.
export const exact = createMath({ number: 'Fraction' });

// Percent notation, the narrow forms students actually type: "50% of 80" and
// a bare "N%". This is notation, not natural language — "of" here is the
// arithmetic operator it always is in percentage work.
export function rewritePercent(text) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/gi, '($1/100)*')
    .replace(/(\d+(?:\.\d+)?)\s*%(?![\w(])/g, '($1/100)');
}

// The parser writes a typed log(8) as (log(8)/log(10)) and log(8, 2) as
// (log(8)/log(2)), mathjs's natural log over the base's. Folded back into
// one call, log(8, 10), the working evaluates the logarithm the student
// typed: the steps read "log(8) = 0.9031", not "log(8) = 2.0794" (the
// natural log under a base-10 name) over "log(10) = 2.3026" (October 2026
// review).
const LOG_QUOTIENT = /\(log\(((?:[^()]|\([^()]*\))+)\)\/log\((\d+(?:\.\d+)?)\)\)/g;
export const foldLogs = (text) => String(text).replace(LOG_QUOTIENT, 'log($1, $2)');
// mathjs's one-argument log → ln (first, so the log(a) written next is not
// caught by it), log(a, 10) → log(a), log(a, b) → log_b(a).
export function logNotation(text) {
  return String(text)
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+)\)/g, 'ln($1)')
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+),\s*10\)/g, 'log($1)')
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+),\s*([^(),]+)\)/g, 'log_$2($1)');
}

// log_b(a) as an exact fraction when b^(n/d) = a for a small d: log_2(8) = 3,
// log_8(4) = 2/3. Null otherwise.
export function exactLog(a, b) {
  if (!(a > 0) || !(b > 0) || b === 1) return null;
  const k = Math.log(a) / Math.log(b);
  for (let d = 1; d <= 12; d += 1) {
    const n = Math.round(k * d);
    if (Math.abs(b ** (n / d) - a) <= 1e-12 * Math.max(1, Math.abs(a))) {
      const g = gcd(Math.abs(n), d) || 1;
      return { n: n / g, d: d / g, text: d / g === 1 ? `${n / g}` : `${n / g}/${d / g}` };
    }
  }
  return null;
}

// √n and ∛n in simplest radical form: √50 = 5√2, ∛54 = 3∛2. The input must
// be just the root of a whole number; null otherwise, or when nothing comes
// out (√7) or everything does (√49).
export function simplifiedRoot(expr) {
  const t = String(expr).replace(/\s+/g, '');
  const m = t.match(/^(?:sqrt\((\d+)\)|(\d+)\^\(1\/2\)|cbrt\((\d+)\)|(\d+)\^\(1\/3\)|nthRoot\((\d+),3\))$/);
  if (!m) return null;
  const N = Number(m[1] || m[2] || m[3] || m[4] || m[5]);
  const index = m[1] || m[2] ? 2 : 3;
  if (!Number.isSafeInteger(N) || N < 2 || N > 1e9) return null;
  let k = 1;
  for (let f = 2; f ** index <= N; f += 1) if (N % (f ** index) === 0) k = f;
  const inside = N / k ** index;
  if (inside === 1) return null;
  const sym = index === 2 ? '√' : '∛';
  return { N, k, inside, index, sym, text: `${k === 1 ? '' : k}${sym}${inside}` };
}

// √(−8) → 2√2·i: the square root of a negative whole number in exact form.
// (2.8284i alone broke the exact-first rule that √8 = 2√2 follows.)
export function imaginaryRoot(expr) {
  const t = String(expr).replace(/\s+/g, '');
  const m = t.match(/^(?:sqrt\(-(\d+)\)|\(-(\d+)\)\^\(1\/2\))$/);
  if (!m) return null;
  const N = Number(m[1] || m[2]);
  if (!Number.isSafeInteger(N) || N < 2 || N > 1e9) return null;
  let k = 1;
  for (let f = 2; f * f <= N; f += 1) if (N % (f * f) === 0) k = f;
  const inside = N / (k * k);
  if (inside === 1) return null; // a perfect square: 2i is already exact
  return { N, k, inside, text: `${k === 1 ? '' : k}√${inside}·i` };
}
