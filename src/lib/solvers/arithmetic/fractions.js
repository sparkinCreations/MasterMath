// A chain of fractions added and subtracted over the least common
// denominator, each step shown and reduced.

import { gcd, mark } from '../solverUtils.js';
import { exact } from './notation.js';

// ---------------------------------------------------------------------------
// Exact fraction work.
//
// The whole solver computes in floats (the value) and shows exact rationals
// where it can (the display). These helpers make the WORK exact too: a group
// that is a fraction is shown as one, and a flat chain of fractions is taught
// by the textbook method — common denominator for + and −, multiply across
// for ×, reciprocal for ÷ — so the intermediate steps are equivalent to the
// answer. Before this, (1/3) + (1/7) showed 0.3333 + 0.1429 and then 10/21.
// ---------------------------------------------------------------------------

const MAX_DENOMINATOR = 10000;

// The exact rational value of an expression as {n, d} with d > 1 (sign on n),
// or null when it isn't rational, is an integer, or has an unwieldy denominator.
export function exactFraction(expr) {
  try {
    const r = exact.evaluate(expr);
    if (exact.typeOf(r) !== 'Fraction' || r.d <= 1 || r.d > MAX_DENOMINATOR) return null;
    return { n: Number(r.s < 0 ? -r.n : r.n), d: Number(r.d) };
  } catch {
    return null;
  }
}

export function fractionText({ n, d }) {
  return d === 1 ? String(n) : `${n}/${d}`;
}

// A parenthesised group with nothing left to work out: a signed number, or a
// fraction already in lowest terms.
export function isSettledGroup(group) {
  if (/^\(\s*-?\d+(?:\.\d+)?\s*\)$/.test(group)) return true;
  const m = group.match(/^\(\s*(-?\d+)\s*\/\s*(\d+)\s*\)$/);
  if (!m) return false;
  const f = exactFraction(group);
  return !!f && f.n === Number(m[1]) && f.d === Number(m[2]);
}

// One term of a flat chain: an integer or a fraction, optionally negative,
// optionally in parentheses. Returns {n, d} or null.
function parseRationalTerm(text) {
  const raw = text.replace(/\s+/g, '');
  const wrapped = /^\(.*\)$/.test(raw);
  const t = raw.replace(/^\((.*)\)$/, '$1');
  const m = t.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const d = m[2] ? Number(m[2]) : 1;
  if (d === 0) return null;
  const n = Number(m[1]);
  // A bare p/q that is a whole number — the 8/2 in 8/2*4 — is a division
  // to perform in PEMDAS order, not a fraction to add or multiply.
  if (!wrapped && d > 1 && n % d === 0) return null;
  return { n, d };
}

// Split a flat expression into rational terms joined by the operators in
// `ops` (a character class). Returns { terms, operators } or null.
function splitRationalChain(expr, ops) {
  const t = expr.replace(/\s+/g, '');
  const term = '\\(?-?\\d+(?:/\\d+)?\\)?';
  const chain = new RegExp(`^(${term})((?:[${ops}]${term})+)$`);
  const m = t.match(chain);
  if (!m) return null;
  const terms = [parseRationalTerm(m[1])];
  const operators = [];
  const rest = new RegExp(`([${ops}])(${term})`, 'g');
  for (const part of m[2].matchAll(rest)) {
    operators.push(part[1]);
    terms.push(parseRationalTerm(part[2]));
  }
  if (terms.some((x) => !x) || terms.every((x) => x.d === 1)) return null;
  return { terms, operators };
}

function signedFraction(f) {
  return f.n < 0 ? `(${fractionText(f)})` : fractionText(f);
}

// Show a sum of signed fractions as "7/21 − 3/21 + 42/21".
function joinSigned(fractions) {
  return fractions
    .map((f, i) => {
      const body = fractionText({ n: Math.abs(f.n), d: f.d });
      if (i === 0) return f.n < 0 ? `-${body}` : body;
      return `${f.n < 0 ? ' - ' : ' + '}${body}`;
    })
    .join('');
}

function reduceStep(n, d, steps) {
  const g = gcd(n, d);
  if (g <= 1) return { n, d };
  const reduced = { n: n / g, d: d / g };
  steps.push(`Reduce by the common factor ${mark(g)}: ${mark(`${fractionText({ n, d })} = ${fractionText(reduced)}`)}${reduced.d === 1 ? ', a whole number' : ''}.`);
  return reduced;
}

// Teaching steps for a flat chain of fractions, or null when the expression
// isn't one. Sums and differences of any length; products and quotients of
// exactly two terms (longer mixed chains fall back to the PEMDAS narration).
export function fractionSteps(expr) {
  const sum = splitRationalChain(expr, '+\\-');
  if (sum) {
    const { terms, operators } = sum;
    const signed = terms.map((f, i) => (i > 0 && operators[i - 1] === '-' ? { n: -f.n, d: f.d } : f));
    const denominators = [...new Set(signed.map((f) => f.d))];
    const lcd = denominators.reduce((acc, d) => (acc * d) / gcd(acc, d), 1);
    if (lcd > MAX_DENOMINATOR) return null;
    const steps = [];
    const converted = signed.map((f) => ({ n: f.n * (lcd / f.d), d: lcd }));
    if (denominators.length > 1) {
      const wholes = signed.filter((f) => f.d === 1);
      steps.push(`The denominators differ (${mark(denominators.join(', '))}), so first rewrite every term over a common denominator.`);
      steps.push(`The least common denominator is ${mark(lcd)}${denominators.length === 2 && gcd(denominators[0], denominators[1]) === 1 && !wholes.length ? ` (${mark(`${denominators[0]} × ${denominators[1]}`)}, since they share no factor)` : ` (the least common multiple of ${denominators.map(mark).join(' and ')})`}.`);
      const rewrites = signed
        .map((f, i) => (f.d === lcd ? null : `${signedFraction(f)} = ${signedFraction(converted[i])}`))
        .filter(Boolean);
      steps.push(`Rewrite each term over ${mark(lcd)}: ${mark(rewrites.join(',  '))}.`);
    } else {
      steps.push(`The denominators are the same (${mark(lcd)}), so add or subtract the numerators and keep the denominator.`);
    }
    const total = converted.reduce((acc, f) => acc + f.n, 0);
    const numeratorWork = converted
      .map((f, i) => (i === 0 ? String(f.n) : `${f.n < 0 ? ' - ' : ' + '}${Math.abs(f.n)}`))
      .join('');
    steps.push(`Combine the numerators over ${mark(lcd)}: ${mark(`${joinSigned(converted)} = (${numeratorWork})/${lcd} = ${fractionText({ n: total, d: lcd })}`)}.`);
    reduceStep(total, lcd, steps);
    return {
      steps,
      tips: [
        'To add or subtract fractions, rewrite them over a common denominator first, then combine only the numerators.',
        `Work with the fractions exactly — ${mark('1/3')} is not ${mark('0.3333')}, and rounding part-way through changes the answer.`,
        'Reduce the result by dividing numerator and denominator by their greatest common factor.',
      ],
      common_mistakes: [
        `Adding the numerators and the denominators separately: ${mark('1/3 + 1/7')} is not ${mark('2/10')}.`,
        'Converting only some of the terms — a whole number must be rewritten over the common denominator too.',
        'Rounding a fraction to a decimal in the middle of exact work.',
      ],
    };
  }

  const product = splitRationalChain(expr, '*/');
  if (product && product.terms.length === 2) {
    const [a, b] = product.terms;
    const op = product.operators[0];
    const steps = [];
    let n;
    let d;
    if (op === '*') {
      n = a.n * b.n;
      d = a.d * b.d;
      steps.push(`To multiply fractions, multiply the numerators together and the denominators together: ${mark(`${signedFraction(a)} × ${signedFraction(b)} = (${a.n} × ${b.n})/(${a.d} × ${b.d}) = ${fractionText({ n, d })}`)}.`);
    } else {
      if (b.n === 0) return null;
      const reciprocal = b.n < 0 ? { n: -b.d, d: -b.n } : { n: b.d, d: b.n };
      steps.push(`Dividing by a fraction is the same as multiplying by its reciprocal: ${mark(`${signedFraction(a)} ÷ ${signedFraction(b)} = ${signedFraction(a)} × ${signedFraction(reciprocal)}`)}.`);
      n = a.n * reciprocal.n;
      d = a.d * reciprocal.d;
      steps.push(`Multiply the numerators together and the denominators together: ${mark(`(${a.n} × ${reciprocal.n})/(${a.d} × ${reciprocal.d}) = ${fractionText({ n, d })}`)}.`);
    }
    if (d > MAX_DENOMINATOR) return null;
    reduceStep(n, d, steps);
    return {
      steps,
      tips: op === '*' ? [
        'Multiplying fractions needs no common denominator: multiply straight across, numerators together and denominators together.',
        'Cross-cancel a common factor between a numerator and a denominator before multiplying, and the product is already reduced.',
        'Reduce the result by dividing numerator and denominator by their greatest common factor.',
      ] : [
        'To divide by a fraction, flip it (take its reciprocal) and multiply — "keep, change, flip".',
        'Only the divisor (the second fraction) is inverted; the first fraction stays as it is.',
        'Reduce the result by dividing numerator and denominator by their greatest common factor.',
      ],
      common_mistakes: op === '*' ? [
        'Finding a common denominator before multiplying — that is only needed for adding and subtracting.',
        'Multiplying the numerators but keeping one of the denominators.',
        'Rounding a fraction to a decimal in the middle of exact work.',
      ] : [
        'Flipping the wrong fraction when dividing: only the divisor (the second fraction) is inverted.',
        'Dividing straight across (numerator by numerator) — that only works when it happens to divide evenly.',
        'Rounding a fraction to a decimal in the middle of exact work.',
      ],
    };
  }
  return null;
}
