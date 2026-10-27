import { createMath } from '../mathInstance.js';
import { math, formatNumber, beautify, gcd, stripMathMarkers, mark } from './solverUtils.js';
import { getSettings } from '../settings.js';

// The problem as typed is math (3/4 + 5/6) or a phrase (15% of 80): mark it
// only when every word in it is a function name, or KaTeX sets the words as
// italic letters.
const MATH_NAMES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sqrt', 'ln', 'log', 'exp', 'abs', 'pi', 'mod', 'e']);
const asMath = (t) => ((String(t).match(/[a-z]{2,}/gi) || []).every((w) => MATH_NAMES.has(w.toLowerCase())) ? mark(t) : t);
import { parseError, overflow, undefinedValue, indeterminate } from '../solutionEnvelope.js';

// A second mathjs instance that computes in exact rational arithmetic. Where
// the whole expression is rational (1/3 + 1/6), it yields the exact fraction;
// where it isn't (sqrt(2), e^2, factorials) it throws, and the float result
// stands. Used only for display: the float `math` result remains the value.
const exact = createMath({ number: 'Fraction' });

// Percent notation, the narrow forms students actually type: "50% of 80" and
// a bare "N%". This is notation, not natural language — "of" here is the
// arithmetic operator it always is in percentage work.
function rewritePercent(text) {
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
const foldLogs = (text) => String(text).replace(LOG_QUOTIENT, 'log($1, $2)');
// mathjs's one-argument log → ln (first, so the log(a) written next is not
// caught by it), log(a, 10) → log(a), log(a, b) → log_b(a).
function logNotation(text) {
  return String(text)
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+)\)/g, 'ln($1)')
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+),\s*10\)/g, 'log($1)')
    .replace(/(?<![a-z_])log\(((?:[^(),]|\([^()]*\))+),\s*([^(),]+)\)/g, 'log_$2($1)');
}

// log_b(a) as an exact fraction when b^(n/d) = a for a small d: log_2(8) = 3,
// log_8(4) = 2/3. Null otherwise.
function exactLog(a, b) {
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
function simplifiedRoot(expr) {
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

export function solveArithmetic(expression) {
  try {
    const typed = foldLogs(expression.trim());
    const original = logNotation(typed);
    // Under Arithmetic there are no variables, so an "x" between two numbers
    // is the multiplication sign a student reached for: "2 x 3" → 2*3.
    // (parseMathExpression will have removed the spaces already: "2x3".)
    const cleanedBase = rewritePercent(typed).replace(/(\d|\))\s*x\s*(\d|\()/gi, '$1*$2');
    let cleaned = cleanedBase;

    // ∞ is not a number, but students type it. Read it as mathjs's Infinity
    // so that ∞ − ∞ can be named an indeterminate form instead of a syntax
    // error (September 2026 audit).
    const usesInfinity = /∞|\binf(?:inity)?\b/i.test(cleaned);
    if (usesInfinity) cleaned = cleaned.replace(/∞|\binf(?:inity)?\b/gi, 'Infinity');

    // (−8)^(1/3): a negative base under an odd root has a real value, −2.
    // mathjs returns the principal complex root (1 + 1.7321i) — a cube root of
    // −8, but not the one a student means. Rewrite as −(8^(1/3)) (or
    // +(8^(2/3)) for an even numerator) and say so. (Audit row R01.)
    const ODD_ROOT = /\(\s*-\s*(\d+(?:\.\d+)?)\s*\)\s*\^\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g;
    const rootNotes = [];
    cleaned = cleaned.replace(ODD_ROOT, (whole, base, p, q) => {
      if (Number(q) % 2 === 0) return whole;
      let principal = '';
      try { principal = math.format(math.evaluate(whole), { precision: 5 }); } catch { /* no note */ }
      const real = Number(p) % 2 ? `-(${base}^(${p}/${q}))` : `(${base}^(${p}/${q}))`;
      rootNotes.push(`${mark(whole)}: the base is negative and the root is odd (${mark(q)}), so it has a real value — rewrite it as ${mark(real)}.${principal ? ` (A calculator that answers ${mark(principal)} is showing the principal complex root instead.)` : ''}`);
      return `(${real})`;
    });

    const result = math.evaluate(cleaned);

    if (usesInfinity && typeof result === 'number' && !Number.isFinite(result)) {
      if (Number.isNaN(result)) {
        const form = /Infinity\s*\/\s*Infinity/.test(cleaned)
          ? '∞/∞'
          : /(?:^|[^\d.])0\s*\*\s*Infinity|Infinity\s*\*\s*0(?![\d.])/.test(cleaned) ? '0·∞' : '∞ − ∞';
        return indeterminate({
          input: original,
          form,
          note: `${mark(form)} is not a number. ${mark('∞')} is not a value arithmetic can subtract, divide or multiply — it describes a limit that grows without bound, and two such limits can differ by anything. In calculus ${mark(form)} is an indeterminate form: a limit can settle it, plain arithmetic cannot.`,
        });
      }
      return undefinedValue({
        input: original,
        reason: '∞ is not a number',
        steps: [
          `Evaluate: ${asMath(original)}`,
          '∞ is not a real number, so it cannot be added to, multiplied or compared in arithmetic. It describes how a limit behaves — growing without bound — not a value.',
        ],
        tips: [`In a limit, ${mark('∞ + 1')}, ${mark('2·∞')} and ${mark('∞²')} all "equal" ${mark('∞')} — the quantity still grows without bound. As arithmetic, none of them has a value.`],
        common_mistakes: [`Treating ${mark('∞')} as a very large number.`],
      });
    }


    if (typeof result === 'number' && Number.isFinite(result) && modsByZero(cleaned)) {
      return undefinedValue({
        input: original,
        reason: 'the modulus is zero',
        steps: [`Evaluate: ${asMath(original)}`, `${mark('a mod b')} asks for the remainder after dividing by ${mark('b')} — and dividing by ${mark('0')} has no value, so neither does the remainder.`],
        tips: ['A remainder only makes sense for a nonzero divisor.'],
        common_mistakes: [`Reading ${mark('a mod 0')} as ${mark('a')} (some calculators return the dividend unchanged).`],
      });
    }

    // A non-finite result is never an answer. Which failure it is depends on
    // why: dividing by zero has no defined value (0/0 has no value even in
    // principle), while a finite calculation that runs off the end of
    // double precision (9999999999^9999) is an overflow.
    //
    // Division by zero used to be reported as the number ∞ — so
    // "(5+3)*4 - 2^3/0" was answered "-∞", marked Solved. In real arithmetic
    // 8/0 is undefined; ∞ is a statement about a limit, not a value.
    if (typeof result === 'number' && !Number.isFinite(result)) {
      // ln(0), log(0): undefined — the LIMIT is -∞, the value does not exist.
      if (logOfZero(cleaned)) {
        return undefinedValue({
          input: original,
          reason: 'the logarithm of 0 is undefined',
          steps: [`Evaluate: ${asMath(original)}`, `${mark('ln(0)')} asks for the power ${mark('e')} must be raised to in order to give ${mark('0')} — and no power of ${mark('e')} is ${mark('0')}, so there is no such number.`],
          tips: [`${mark('ln(x) → −∞')} as ${mark('x → 0⁺')}: the values grow more and more negative, but ${mark('ln(0)')} itself has no value.`, 'The logarithm is only defined for positive numbers.'],
          common_mistakes: [`Reading ${mark('ln(0)')} as ${mark('−∞')}. Infinity describes how the limit behaves, not the value of ln at ${mark('0')}.`],
        });
      }
      if (dividesByZero(cleaned)) {
        if (Number.isNaN(result)) {
          return indeterminate({
            input: original,
            form: '0/0',
            note: `${mark('0/0')} is not a number: every number times ${mark('0')} gives ${mark('0')}, so no single value fits. In calculus it is an indeterminate form — a limit can settle it, plain arithmetic cannot.`,
          });
        }
        return undefinedValue({
          input: original,
          reason: 'division by zero',
          steps: [
            `Evaluate: ${asMath(original)}`,
            'This expression divides by zero. No number multiplied by 0 gives a nonzero result, so the quotient has no value.',
          ],
          tips: [
            `A limit may grow without bound — ${mark('1/x → ∞')} as ${mark('x → 0⁺')} — but the arithmetic expression ${mark('1/0')} has no value at all.`,
            `Check for a denominator that works out to zero, such as ${mark('8/(3-3)')}.`,
          ],
          common_mistakes: [`Reading ${mark('1/0')} as ${mark('∞')}. Infinity describes how a limit behaves, not the result of a division.`],
        });
      }
      if (!Number.isNaN(result)) {
        return overflow({ input: original });
      }
    }
    // Past 2^53, or too small for the decimal setting: exact, in BigInt.
    if (unshowable(result)) {
      const exactResult = exactRational(cleaned);
      if (exactResult) return exactRationalSolution(original, exactResult, result);
    }
    const complexInput = /(?<![a-z])i(?![a-z])/.test(cleaned);
    const steps = [`Evaluate: ${asMath(original)}`, ...rootNotes];
    // n! spelled out, so 7! = 5040 is not a bare fact.
    for (const m of cleaned.matchAll(/(?<![\d.])(\d{1,2})!/g)) {
      const n = Number(m[1]);
      if (n >= 2 && n <= 12) {
        const factors = Array.from({ length: n }, (_, i) => n - i);
        steps.push(`${mark(`${n}!`)} means the product of every whole number from ${mark(n)} down to ${mark('1')}: ${mark(`${factors.join(' × ')} = ${formatNumber(factors.reduce((a, b) => a * b, 1))}`)}.`);
      } else if (n < 2) {
        steps.push(`${mark(`${n}! = 1`)} by definition (the empty product), so that formulas for counting work at the edges.`);
      }
    }
    // 0^0 is a convention, not a computation. Say so rather than presenting
    // "1" as if it were forced.
    const zeroToZero = raisesZeroToZero(cleaned);
    if (zeroToZero) {
      steps.push(`${mark('0^0')} has no single forced value: ${mark('x^0 = 1')} for every other ${mark('x')}, but ${mark('0^y = 0')} for every positive ${mark('y')}.`);
      steps.push(`This calculator follows the usual convention ${mark('0^0 = 1')} (it is what makes the binomial theorem and power series work). In a limit, ${mark('0^0')} is an indeterminate form.`);
    }
    // A complex result (sqrt(-1), ln(-1)) has no real value; name what is shown.
    if (!complexInput && result && typeof result === 'object' && 'im' in result && Math.abs(result.im) > 0) {
      steps.push(`There is no real number here — the result is a complex number, written with ${mark('i = √(−1)')}.`);
    }
    if (/%/.test(typed) && cleanedBase !== typed) {
      steps.push(`Percent means "per hundred": rewrite ${asMath(original)} as ${mark(logNotation(cleanedBase))}.`);
    } else if (cleanedBase !== typed) {
      steps.push(`Reading "x" between numbers as multiplication: ${mark(logNotation(cleanedBase))}.`);
    }

    // Show the real reduction by collapsing the innermost parentheses one at a
    // time — this is genuine intermediate work, not a canned reminder. A group
    // that works out to a fraction is shown AS a fraction: (1/3) + (1/7) used
    // to show "0.3333 + 0.1429" and then answer 10/21 — work that was not
    // equivalent to the answer, teaching that rounding mid-way is exact method.
    let working = cleaned;
    let guard = 0;
    if (complexInput) steps.push(...(complexWorking(cleaned) || []));
    while (!complexInput && /\([^()]+\)/.test(working) && guard++ < 25) {
      // The innermost group that has something to work out. A group that is
      // just a signed number — the (-1) in sqrt(-1) — or an already-reduced
      // fraction — the (1/3) in (1/3)*6 — is left as it is; "working it out"
      // gave (-1) again, 25 times over.
      // An argument list, the (8, 2) of log(8, 2), is not a group to work out.
      // Nor the power inside ln(e^2) or log(10^3): the logarithm undoes it
      // exactly, which working it out to 7.3891 first would hide.
      const match = [...working.matchAll(/\([^()]+\)/g)].find((m) => !isSettledGroup(m[0]) && !m[0].includes(',') && !/^\(\s*(?:e|pi)\s*\)$/.test(m[0])
        && !(/(?<![a-z_])(?:ln|log)$/i.test(working.slice(0, m.index)) && /^\(\s*(?:e|\d+(?:\.\d+)?)\s*\^/.test(m[0])));
      if (!match) break;
      let value;
      try {
        value = math.evaluate(match[0]);
      } catch {
        break;
      }
      const asFraction = exactFraction(match[0]);
      const shown = asFraction ? fractionText(asFraction) : formatNumber(value);
      // A function's argument keeps its brackets: ln(e^2) → ln(7.3891), not ln7.3891.
      const isArgument = /[a-z_]$/i.test(working.slice(0, match.index));
      const substitution = asFraction || Number(value) < 0 || isArgument ? `(${shown})` : shown;
      const next = working.slice(0, match.index) + substitution + working.slice(match.index + match[0].length);
      if (next === working) break;
      steps.push(`Work inside the parentheses: ${mark(`${logNotation(match[0])} = ${shown}  →  ${logNotation(next)}`)}`);
      working = next;
    }

    // A sum/difference of fractions, or a product/quotient of two, is taught
    // with common denominators and reciprocals — the exact method, never via
    // decimals (September 2026 teaching-quality review, top finding). For
    // everything else, do the work one operation at a time in PEMDAS order,
    // showing the expression after each — "Resolve the exponents" with
    // nothing worked out told a student nothing.
    const fractionWork = complexInput ? null : fractionSteps(working);
    if (fractionWork) {
      steps.push(...fractionWork.steps);
    } else if (!complexInput && !showWorking(working, steps)) {
      describeOrder(working, steps);
    }

    // √50: the working evaluated it; the answer is the simplest radical form,
    // which the tips teach (October 2026 review: "only gives 7.0711").
    const root = simplifiedRoot(cleaned) || simplifiedRoot(working);
    if (root && root.k > 1) {
      const power = root.k ** root.index;
      const kind = root.index === 2 ? 'perfect square' : 'perfect cube';
      steps.push(`Simplify the root: pull out the largest ${kind} factor, ${mark(`${root.N} = ${power} × ${root.inside}`)}, so ${mark(`${root.sym}${root.N} = ${root.sym}${power}·${root.sym}${root.inside} = ${root.text}`)}.`);
    }

    const shownAnswer = formatArithmeticResult(result, cleaned, root) + (zeroToZero && String(cleaned).replace(/\s/g, '') === '0^0' ? ' (by convention)' : '');
    steps.push(`Final answer: ${mark(shownAnswer)}`);

    const guidance = fractionWork || (complexInput ? complexGuidance() : arithmeticGuidance(steps, cleaned));
    return {
      steps,
      answer: shownAnswer,
      tips: guidance.tips,
      common_mistakes: guidance.common_mistakes,
      graph: null,
    };
  } catch (error) {
    console.error('Arithmetic solver error:', error);
    // mathjs error messages are specific ("Parenthesis ) expected (char 4)",
    // "Undefined symbol abc") — pass them through rather than generic tips.
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use "*" for multiplication, "/" for division, and "^" for exponents (e.g., "(2+3)*4^2").'],
      common_mistakes: ['Missing operators between numbers', 'Unbalanced parentheses'],
    });
  }
}

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
function exactFraction(expr) {
  try {
    const r = exact.evaluate(expr);
    if (exact.typeOf(r) !== 'Fraction' || r.d <= 1 || r.d > MAX_DENOMINATOR) return null;
    return { n: Number(r.s < 0 ? -r.n : r.n), d: Number(r.d) };
  } catch {
    return null;
  }
}

function fractionText({ n, d }) {
  return d === 1 ? String(n) : `${n}/${d}`;
}

// A parenthesised group with nothing left to work out: a signed number, or a
// fraction already in lowest terms.
function isSettledGroup(group) {
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
function fractionSteps(expr) {
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

// Tips and mistakes for a plain arithmetic evaluation, chosen by what the
// expression actually used — a negative exponent, a factorial, a percent, a
// root or function — instead of the PEMDAS list for everything.
function arithmeticGuidance(steps, expr) {
  const text = stripMathMarkers(steps.join('\n'));
  if (/negative exponent means a reciprocal/.test(text)) {
    return {
      tips: [
        `${mark('a^(−n) = 1/a^n')}: a negative exponent moves the power to the denominator — it does not make the result negative.`,
        `The base cannot be ${mark('0')} (${mark('0^(−n)')} would be ${mark('1/0')}), and the sign of the result comes from the base: ${mark('(−2)^(−3) = 1/(−8) = −1/8')}.`,
        `A negative exponent on a fraction flips it: ${mark('(1/2)^(−2) = 2² = 4')}.`,
      ],
      common_mistakes: [
        `Writing ${mark('2^(−3)')} as ${mark('−8')} or as ${mark('−2³')}.`,
        'Making the result negative — the minus sign is in the exponent, not in the value.',
        `Forgetting that ${mark('−2^(−2)')} applies the minus after the power: ${mark('−(1/4)')}.`,
      ],
    };
  }
  if (/!/.test(expr)) {
    return {
      tips: [
        `${mark('n! = n × (n − 1) × … × 2 × 1')} — the product of every whole number from ${mark('n')} down to ${mark('1')}.`,
        `${mark('0! = 1')} by definition, so that formulas for combinations and permutations work at the edges.`,
        `Factorials grow very fast: ${mark('10!')} is already 3,628,800.`,
      ],
      common_mistakes: [
        `Reading ${mark('7!')} as ${mark('7 × 1')}, or as ${mark('7 + 6 + … + 1')}.`,
        `Treating ${mark('(n − 1)!')} as ${mark('n! − 1')}.`,
        'Applying ! to a fraction or a negative number.',
      ],
    };
  }
  if (/%/.test(expr) || /Percent means/.test(text)) {
    return {
      tips: [
        `"Per cent" means per hundred: ${mark('50% = 50/100 = 1/2')}, and "of" means multiply.`,
        `To find ${mark('p%')} of a number, multiply by ${mark('p/100')} (or move the decimal point two places).`,
        `A percent of a percent multiplies: ${mark('50%')} of ${mark('50%')} is ${mark('25%')}, not ${mark('100%')}.`,
      ],
      common_mistakes: [
        `Multiplying by ${mark('50')} instead of by ${mark('0.5')}.`,
        'Adding the percentage instead of multiplying by it.',
        `Mixing up "${mark('50%')} of ${mark('80')}" with "${mark('50')} is what percent of ${mark('80')}".`,
      ],
    };
  }
  // A logarithm: what it asks, which base each name means, and the change of
  // base. (ln(8) and log(8) were given the PEMDAS list; October 2026 review.)
  if (/(?<![a-z_])(?:log|ln)\(/i.test(expr)) {
    return {
      tips: [
        `${mark('log_b(a)')} asks for the power of ${mark('b')} that gives ${mark('a')}: ${mark('log_b(a) = k')} means ${mark('b^k = a')}, so ${mark('log_2(8) = 3')} because ${mark('2^3 = 8')}.`,
        `${mark('ln')} is the natural logarithm, base ${mark('e')}. For a base other than ${mark('10')} or ${mark('e')}, change base: ${mark('log_b(a) = ln(a)/ln(b)')}.`,
        `The rules: ${mark('log(xy) = log(x) + log(y)')}, ${mark('log(x/y) = log(x) − log(y)')}, ${mark('log(x^n) = n·log(x)')}.`,
      ],
      common_mistakes: [
        `Mixing up ${mark('log')} and ${mark('ln')}: ${mark('log(8) ≈ 0.9031')} but ${mark('ln(8) ≈ 2.0794')}.`,
        `Splitting ${mark('log(a + b)')} into ${mark('log(a) + log(b)')}: the product rule is for ${mark('log(ab)')}.`,
        `Taking the logarithm of ${mark('0')} or a negative number: it is defined only for positive numbers.`,
      ],
    };
  }
  if (/\b(?:sqrt|cbrt|nthRoot)\b|√|\^\s*\(?\d+\/\d+\)?/i.test(expr)) {
    return {
      tips: [
        `${mark('√a')} is the non-negative number whose square is ${mark('a')}; ${mark('√2')} is irrational, so its decimal never ends or repeats.`,
        `Rewrite roots as powers when combining them: ${mark('√a = a^(1/2)')}, ${mark('∛a = a^(1/3)')}.`,
        `Simplify by pulling out perfect squares: ${mark('√8 = √4·√2 = 2√2')}.`,
      ],
      common_mistakes: [
        `${mark('√(a + b)')} is not ${mark('√a + √b')}.`,
        `Reporting ${mark('±√a')} for a plain root — the radical symbol means the positive root.`,
        'Rounding too early in a longer calculation.',
      ],
    };
  }
  return {
    tips: [
      'PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).',
      'Multiplication and division share a tier — resolve them left to right, not multiplication first.',
      'Use parentheses to force a different order of operations.',
    ],
    common_mistakes: [
      'Adding or subtracting before multiplying or dividing.',
      'Evaluating left to right while ignoring precedence.',
      'Sign errors when subtracting a negative number.',
    ],
  };
}

// ln(0) / log(0) anywhere in the parse tree.
function logOfZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'FunctionNode' || !['log', 'ln', 'log10', 'log2'].includes(node.fn?.name)) return;
      try {
        if (node.args[0].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Is there a 0^0 anywhere in the parse tree?
function raisesZeroToZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode' || node.fn !== 'pow') return;
      try {
        if (node.args[0].evaluate() === 0 && node.args[1].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// a mod 0 anywhere in the expression (mathjs quietly returns a).
function modsByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found) return;
      const isMod = (node.type === 'OperatorNode' && node.fn === 'mod') || (node.type === 'FunctionNode' && node.fn?.name === 'mod');
      if (!isMod) return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch { /* needs a scope: not a constant zero */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Does this expression divide by something that works out to zero? Read off
// the parse tree rather than by pattern-matching "/0", so 8/(3-3) is
// recognised as division by zero instead of being reported as an overflow.
function dividesByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode') return;
      // 0^(-n) is 1/0^n — division by zero as well.
      if (node.fn === 'pow') {
        try {
          if (node.args[0].evaluate() === 0 && node.args[1].evaluate() < 0) found = true;
        } catch { /* not constant */ }
        return;
      }
      if (node.fn !== 'divide' && node.fn !== 'mod') return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch {
        // a denominator that needs a scope isn't a constant zero
      }
    });
    return found;
  } catch {
    return false;
  }
}

// Evaluate a parenthesis-free expression one operation at a time in PEMDAS
// order — functions, then exponents (right to left), then multiplication and
// division left to right, then addition and subtraction left to right —
// pushing a step per operation with the result and the expression that
// remains. Returns false (and pushes nothing) when the expression cannot be
// worked this way, so the caller falls back to the tier description.
function showWorking(expr, steps) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return false;
  }
  const isConstant = (n) => n.type === 'ConstantNode'
    || (n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args.length === 1 && n.args[0].type === 'ConstantNode')
    || (n.type === 'ParenthesisNode' && isConstant(n.content));
  const VERBS = { pow: 'Resolve the exponent', multiply: 'Multiply', divide: 'Divide', mod: 'Take the remainder', add: 'Add', subtract: 'Subtract', unaryMinus: 'Apply the leading minus' };
  // A leading minus on a worked-out value: -2^2 is -(2^2), so the sign is
  // applied after the exponent. A (−4) this routine wrote itself is a value.
  const bareMinus = (n, parent) => n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args[0].type === 'ConstantNode' && parent?.type !== 'ParenthesisNode';
  // ln(e^k), log(10^k), log_b(b^k): the logarithm undoes its base's power.
  const baseOf = (n) => (n.fn?.name === 'ln' || n.args.length === 1 ? 'e' : n.args[1].toString());
  // ln(e) and log(10) are the first power: k = 1.
  const isBase = (n) => n.type === 'FunctionNode' && ['ln', 'log'].includes(n.fn?.name) && n.args[0].toString() === baseOf(n);
  const undoesPower = (n) => isBase(n) || (n.type === 'FunctionNode' && ['ln', 'log'].includes(n.fn?.name)
    && n.args[0].type === 'OperatorNode' && n.args[0].fn === 'pow' && n.args[0].args[0].toString() === baseOf(n)
    && (() => { try { return Number.isFinite(n.args[0].args[1].evaluate()); } catch { return false; } })());
  const tiers = [
    { intro: 'A logarithm undoes a power of its own base', pick: 'first', test: undoesPower },
    { intro: 'Evaluate the function', pick: 'first', test: (n) => n.type === 'FunctionNode' && n.args.length > 0 && n.args.every(isConstant) },
    { intro: 'Exponents first', pick: 'last', test: (n) => n.type === 'OperatorNode' && n.fn === 'pow' && n.args.every(isConstant) },
    { intro: 'The exponent binds tighter than a leading minus, so apply the sign afterwards', pick: 'first', test: bareMinus, root: true },
    { intro: 'Multiplication and division next, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['multiply', 'divide', 'mod'].includes(n.fn) && n.args.every(isConstant) },
    { intro: 'Addition and subtraction last, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['add', 'subtract'].includes(n.fn) && n.args.every(isConstant) },
  ];
  // Numbers as digits: mathjs writes 1000000 as 1e+6. One a float cannot
  // show (2^100, 2^-60) in scientific notation, bracketed.
  const handler = (n) => {
    if (n.type !== 'ConstantNode' || typeof n.value !== 'number') return undefined;
    return unshowable(n.value) ? `(${scientific(n.value)})` : String(n.value);
  };
  const render = (node) => logNotation(node.toString({ implicit: 'show', handler })
    .replace(/\b\d+\.\d{5,}\b/g, (t) => formatNumber(Number(t))));
  const lines = [];
  let lastTier = -1;
  for (let guard = 0; guard < 40; guard += 1) {
    if (tree.type === 'ConstantNode' || (isConstant(tree) && !bareMinus(tree, null))) break;
    let target = null;
    let tierIndex = -1;
    for (let t = 0; t < tiers.length && !target; t += 1) {
      const matches = [];
      // The leading-minus tier applies only to the whole expression.
      if (tiers[t].root) {
        if (tiers[t].test(tree, null)) matches.push(tree);
      } else {
        tree.traverse((n, path, parent) => { if (tiers[t].test(n, parent)) matches.push(n); });
      }
      if (matches.length > 0) {
        target = tiers[t].pick === 'first' ? matches[0] : matches[matches.length - 1];
        tierIndex = t;
      }
    }
    if (!target) return false;
    let value;
    try {
      value = target.evaluate();
    } catch {
      return false;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const replacement = value < 0 && target !== tree
      ? new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [new math.ConstantNode(-value)]))
      : new math.ConstantNode(value);
    tree = target === tree ? replacement : tree.transform((n) => (n === target ? replacement : n));
    const opText = target.type === 'OperatorNode' && target.fn === 'unaryMinus' ? `-(${render(target.args[0])})` : render(target);
    let valueText = numText(value);
    // Not for rounded decimals a step wrote itself (0.9031 + 0.301 is not
    // 12041/10000 exactly).
    if (!Number.isInteger(value) && !/\d\.\d{4,}/.test(opText)) {
      try {
        const fr = exact.evaluate(opText);
        if (exact.typeOf(fr) === 'Fraction' && fr.d > 1 && fr.d <= 10000) valueText = `${fr.s < 0 ? '-' : ''}${fr.n}/${fr.d} (≈ ${formatNumber(value)})`;
      } catch { /* not rational */ }
    }
    // A logarithm is a question about a power: log_b(a) is the k with
    // b^k = a. Exact when it is a fraction (log_2(8) = 3, log_8(4) = 2/3);
    // otherwise the decimal, by the change of base for a base other than 10
    // or e.
    let logNote = '';
    if (undoesPower(target)) {
      const base = baseOf(target);
      const tight = (n) => render(n).replace(/\s*\^\s*/g, '^');
      const k = isBase(target) ? '1' : tight(target.args[0].args[1]);
      logNote = `${mark(tight(target))} asks for the power of ${mark(base)} that gives ${mark(tight(target.args[0]))}, which is ${mark(k)}: a logarithm undoes a power of its own base, ${mark(`${base === 'e' ? 'ln' : base === '10' ? 'log' : `log_${base}`}(${base}^k) = k`)}`;
    } else if (target.type === 'FunctionNode' && ['log', 'ln'].includes(target.fn.name)) {
      try {
        const a = target.args[0].evaluate();
        const b = target.fn.name === 'ln' || target.args.length === 1 ? Math.E : target.args[1].evaluate();
        const name = render(target);
        const baseText = b === Math.E ? 'e' : formatNumber(b);
        const ex = b === Math.E ? null : exactLog(a, b);
        if (ex) {
          valueText = ex.d === 1 ? ex.text : `${ex.text} (≈ ${formatNumber(value)})`;
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}: ${mark(`${baseText}^${ex.d === 1 && ex.n >= 0 ? ex.text : `(${ex.text})`} = ${formatNumber(a)}`)}, so ${mark(`${name} = ${ex.text}`)}`;
        } else if (b === 10 || b === Math.E) {
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}: ${mark(`${baseText}^${value < 0 ? `(${formatNumber(value)})` : formatNumber(value)} ≈ ${formatNumber(a)}`)}, so ${mark(`${name} ≈ ${formatNumber(value)}`)}`;
        } else {
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}. It is not a whole number or a simple fraction, so use the change of base: ${mark(`${name} = ln(${formatNumber(a)})/ln(${baseText}) = ${formatNumber(Math.log(a))}/${formatNumber(Math.log(b))} ≈ ${formatNumber(value)}`)}`;
        }
      } catch { /* the plain evaluation line stands */ }
    }
    const verb = target.type === 'FunctionNode' ? `Evaluate ${target.fn.name}` : VERBS[target.fn] || 'Work out';
    const lead = tierIndex !== lastTier ? `${tiers[tierIndex].intro}: ` : `Then ${verb.toLowerCase()}: `;
    lastTier = tierIndex;
    const remaining = isConstant(tree) ? '' : `  →  ${render(tree)}`;
    // A negative exponent is a reciprocal: teach the rule, not just the
    // number (September 2026 review, batch 2).
    let note = '';
    if (target.type === 'OperatorNode' && target.fn === 'pow') {
      try {
        const e = target.args[1].evaluate();
        const base = target.args[0].evaluate();
        if (typeof e === 'number' && e < 0 && Number.isInteger(e) && typeof base === 'number' && base !== 0) {
          const baseText = render(target.args[0]);
          const power = Math.pow(base, -e);
          const powerText = power < 0 ? `(${formatNumber(power)})` : formatNumber(power);
          const viaReciprocal = power < 0 ? `1/${powerText} = ` : '';
          note = ` — a negative exponent means a reciprocal, ${mark('a^(-n) = 1/a^n')} (the base cannot be ${mark('0')}): ${mark(equals(`${baseText}^(${e}) = 1/${baseText}^${-e}${viaReciprocal ? ` = ${viaReciprocal.replace(/ = $/, '')}` : ''}`, valueText))}`;
        }
      } catch { /* no note */ }
    }
    if (logNote) lines.push(`${logNote}${remaining ? `, and the expression becomes ${mark(remaining.replace(/^\s*→\s*/, ''))}.` : '.'}`);
    else lines.push(note ? `${lead}${mark(opText)}${note}${remaining ? mark(remaining) : ''}` : `${lead}${mark(`${equals(opText, valueText)}${remaining}`)}`);
  }
  if (!isConstant(tree)) return false;
  for (const line of lines) steps.push(line);
  return true;
}

// Describe which PEMDAS tiers remain in a parenthesis-free expression. The UI
// numbers the steps, so these read as ordered actions without "Step N" prefixes.
function describeOrder(expr, steps) {
  const hasExponent = /\^|\*\*/.test(expr);
  const hasMulDiv = /[*/×÷]/.test(expr);
  // A binary +/- between two operands (ignores a leading unary sign).
  const hasAddSub = /[\d)]\s*[-+]\s*[\d(]/.test(expr);

  if (hasExponent) steps.push('Resolve the exponents.');
  if (hasMulDiv) steps.push('Handle multiplication and division from left to right.');
  if (hasAddSub) steps.push('Add and subtract from left to right.');
}

// Exact-first display. A rational result is shown as the fraction with the
// decimal alongside ("1/2 (= 0.5)"); a constant expression in e or π keeps
// its exact form with the approximation alongside ("e^2 ≈ 7.3891"); anything
// else is the plain number. Integers stay integers.
function formatArithmeticResult(result, cleaned, root = simplifiedRoot(cleaned)) {
  // Complex (sqrt(-1), ln(-1)): format each part to the decimal setting,
  // and write a clean multiple of π as such (ln(-1) = πi, not 3.14159…i).
  if (result && typeof result === 'object' && 'im' in result && typeof result.re === 'number' && Math.abs(result.im) < 1e-12) return formatNumber(result.re);
  if (result && typeof result === 'object' && 'im' in result && typeof result.re === 'number') {
    const part = (v) => {
      const k = v / Math.PI;
      if (Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) !== 0) {
        const n = Math.round(k);
        return `${n === 1 ? '' : n === -1 ? '-' : n}π`;
      }
      return formatNumber(v);
    };
    const re = Math.abs(result.re) < 1e-12 ? '' : part(result.re);
    const imAbs = part(Math.abs(result.im));
    const im = `${result.im < 0 ? '-' : re ? '+' : ''}${imAbs === '1' ? '' : imAbs}i`;
    return re ? `${re} ${im[0]} ${im.slice(1)}` : im;
  }
  const formatted = formatNumber(result);
  if (typeof result !== 'number') return formatted;
  if (unshowable(result)) return `≈ ${scientific(result)}`;

  // Non-finite (1/0, 0/0): keep the offending quotient visible for context.
  if (!Number.isFinite(result)) {
    if (/^[^/]+\/[^/]+$/.test(cleaned) && !/[-+*×÷]/.test(cleaned.replace(/^-/, ''))) {
      return `${formatted} (${cleaned.replace(/\s+/g, '')})`;
    }
    return formatted;
  }
  if (Number.isInteger(result)) return formatted;

  // √50 → 5√2, ∛54 → 3∛2, √7 stays √7: exact, the decimal alongside.
  if (root) return `${root.text} (≈ ${formatted})`;
  // log_8(4) → 2/3.
  const log = String(cleaned).replace(/\s+/g, '').match(/^log\(([\d.]+),([\d.]+)\)$/);
  if (log) {
    const ex = exactLog(Number(log[1]), Number(log[2]));
    if (ex && ex.d > 1) return `${ex.text} (≈ ${formatted})`;
  }

  // Exact rational?
  try {
    const r = exact.evaluate(cleaned);
    if (exact.typeOf(r) === 'Fraction' && r.d > 1 && r.d <= 10000) {
      const sign = r.s < 0 ? '-' : '';
      return `${sign}${r.n}/${r.d} (= ${formatted})`;
    }
  } catch {
    // not rational — fall through
  }

  // Constant expression built only from e, π, digits and operators (no
  // function calls — sin(π/6) has its own exact value, not "sin(π/6) ≈"):
  // keep the exact form, approximate alongside.
  if (/\b(?:e|pi)\b/.test(cleaned) && /^[\d\s+\-*/^().]*(?:\b(?:e|pi)\b[\d\s+\-*/^().]*)+$/.test(cleaned)) {
    return `${beautify(cleaned).replace(/pi/g, "π")} ≈ ${formatted}`;
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Numbers a float cannot show exactly (October 25 review).
//
// A float keeps about 16 significant digits: 123456789*987654321 came out
// …260 (it is …269), 2^100 as 1.2676506002282294e+30 and 2^53 + 1 as 2^53.
// Whole numbers joined by + − × ^ (a whole exponent) and ! are worked in
// BigInt instead. Any other result past 2^53, or too small for the decimal
// setting (2^-60 was answered 0), is shown as ≈ m × 10^k.
// ---------------------------------------------------------------------------

const SAFE = 2 ** 53;
const MAX_EXACT_DIGITS = 100;

// m × 10^k with m to the decimal setting.
function scientific(v) {
  let k = Math.floor(Math.log10(Math.abs(v)));
  let m = formatNumber(v / 10 ** k);
  if (Math.abs(Number(m)) >= 10) {
    k += 1;
    m = formatNumber(v / 10 ** k);
  }
  return `${m} × 10^${k}`;
}

// Too large for a float to hold every digit, or too small for the decimal
// setting to show anything but 0.
const unshowable = (v) => typeof v === 'number' && Number.isFinite(v) && v !== 0
  && (Math.abs(v) >= SAFE || Math.abs(v) < 0.5 * 10 ** -getSettings().decimalPlaces);
const numText = (v) => (unshowable(v) ? `≈ ${scientific(v)}` : formatNumber(v));
// "a = b", or "a ≈ b" when b is approximate.
const equals = (left, valueText) => (/^≈/.test(valueText) ? `${left} ${valueText}` : `${left} = ${valueText}`);

// Exact rational arithmetic in BigInt: { n, d } with d > 0, in lowest terms.
const bgcd = (a, b) => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const frac = (n, d = 1n) => {
  if (d === 0n) throw new Error('division by zero');
  const g = bgcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const fracText = ({ n, d }) => (d === 1n ? String(n) : `${n}/${d}`);
// A typed decimal as the fraction it names: 0.000001 is 1/1000000.
function decimalFraction(v) {
  const m = String(v).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/);
  if (!m) throw new Error('not a decimal');
  const [, sign, whole, part = '', exp = '0'] = m;
  const shift = Number(exp) - part.length;
  if (Math.abs(shift) > 400) throw new Error('out of range');
  const digits = BigInt(`${sign}${whole}${part}`);
  return shift >= 0 ? frac(digits * 10n ** BigInt(shift)) : frac(digits, 10n ** BigInt(-shift));
}

// The value of an expression of numbers joined by + − × ÷ ^ (a whole
// exponent) and !, exactly, with one line per operation; null when it has
// anything else (a root, a function, π).
function exactRational(expr) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return null;
  }
  const lines = [];
  const show = (f) => (f.n < 0n || f.d !== 1n ? `(${fracText(f)})` : fracText(f));
  const VERB = { add: 'Add', subtract: 'Subtract', multiply: 'Multiply', divide: 'Divide', pow: 'Work out the power', factorial: 'Work out the factorial' };
  const SYMBOL = { add: '+', subtract: '-', multiply: '×', divide: '÷', pow: '^' };
  const value = (n) => {
    if (n.type === 'ParenthesisNode') return value(n.content);
    if (n.type === 'ConstantNode') {
      if (typeof n.value !== 'number' || !Number.isFinite(n.value)) throw new Error('not a number');
      return Number.isSafeInteger(n.value) ? frac(BigInt(n.value)) : decimalFraction(n.value);
    }
    if (n.type !== 'OperatorNode' || !(n.fn in VERB || n.fn === 'unaryMinus' || n.fn === 'unaryPlus')) throw new Error('not exact arithmetic');
    const args = n.args.map(value);
    if (n.fn === 'unaryMinus') return frac(-args[0].n, args[0].d);
    if (n.fn === 'unaryPlus') return args[0];
    const [a, b] = args;
    let out;
    let note = '';
    if (n.fn === 'pow') {
      if (b.d !== 1n) throw new Error('fractional exponent');
      const k = b.n < 0n ? -b.n : b.n;
      // A huge power is refused before it is built.
      const size = Math.max(Math.log10(Math.abs(Number(a.n)) || 1), Math.log10(Number(a.d)));
      if (Number(k) * size > 400) throw new Error('out of range');
      const up = frac(a.n ** k, a.d ** k);
      if (b.n < 0n) {
        if (up.n === 0n) throw new Error('division by zero');
        out = frac(up.d, up.n);
        note = ` = 1/${show(a)}^${k}`;
      } else {
        out = up;
      }
    } else if (n.fn === 'factorial') {
      if (a.d !== 1n || a.n < 0n || a.n > 250n) throw new Error('out of range');
      let f = 1n;
      for (let k = 2n; k <= a.n; k += 1n) f *= k;
      out = frac(f);
    } else if (n.fn === 'add' || n.fn === 'subtract') {
      const sign = n.fn === 'add' ? 1n : -1n;
      out = frac(a.n * b.d + sign * b.n * a.d, a.d * b.d);
    } else if (n.fn === 'multiply') {
      out = frac(a.n * b.n, a.d * b.d);
    } else {
      if (b.n === 0n) throw new Error('division by zero');
      out = frac(a.n * b.d, a.d * b.n);
    }
    const left = n.fn === 'factorial' ? `${show(a)}!` : n.fn === 'pow' ? `${show(a)}^${b.n < 0n ? `(${b.n})` : b.n}` : `${show(a)} ${SYMBOL[n.fn]} ${show(b)}`;
    lines.push(`${VERB[n.fn]}${b && n.fn === 'pow' && b.n < 0n ? ` (a negative exponent means a reciprocal, ${mark('a^(-n) = 1/a^n')})` : ''}: ${mark(`${left}${note} = ${fracText(out)}`)}`);
    return out;
  };
  try {
    return { value: value(tree), lines };
  } catch {
    return null;
  }
}

function exactRationalSolution(original, exactResult, result) {
  const { value } = exactResult;
  const digits = String(value.n).replace('-', '').length + (value.d === 1n ? 0 : String(value.d).length);
  const approx = scientific(result);
  const tiny = Math.abs(result) < 1;
  // A long fraction (1.5^100) is no help to read: its size is.
  const shown = value.d === 1n ? digits <= MAX_EXACT_DIGITS : digits <= 40;
  const answer = shown ? `${fracText(value)} (≈ ${approx})` : `≈ ${approx}`;
  const why = tiny
    ? `The result is smaller than ${mark(`10^-${getSettings().decimalPlaces}`)}, so ${getSettings().decimalPlaces} decimal places would show ${mark('0')}: it is kept as an exact fraction, with its size in scientific notation.`
    : `The result has ${String(value.n / value.d).replace('-', '').length} digits, more than a calculator's decimal numbers hold exactly (about 16 significant digits), so it is worked in exact arithmetic.`;
  const steps = [
    `Evaluate: ${asMath(original)}`,
    why,
    ...(shown ? exactResult.lines : []),
    shown ? `Final answer: ${mark(`${fracText(value)} ≈ ${approx}`)}` : `Final answer: ${mark(`≈ ${approx}`)} (the exact value has ${digits} digits${value.d === 1n ? '' : ' in its numerator and denominator'})`,
  ];
  return {
    steps,
    answer,
    tips: tiny
      ? [
        `Scientific notation, ${mark('m × 10^k')}, shows the size of a very small number: ${mark('2^-60 ≈ 8.6736 × 10^-19')}, where rounding to a few decimal places would give ${mark('0')}.`,
        `A negative exponent is a reciprocal, not a negative number: ${mark('2^(-3) = 1/8')}.`,
      ]
      : [
        'Whole numbers can be multiplied exactly to any size; a calculator in decimal mode keeps only about 16 significant digits and rounds the rest.',
        `Scientific notation, ${mark('m × 10^k')}, shows the size of a large number at a glance: ${mark('2^100 ≈ 1.2677 × 10^30')}.`,
      ],
    common_mistakes: tiny
      ? ['Reading a result rounded to 0 as exactly 0: it may only be smaller than the decimals shown.']
      : ['Trusting the last digits of a large calculator result: past about 16 digits they are rounded, not computed.'],
    graph: null,
  };
}

// ---------------------------------------------------------------------------
// Complex numbers (October 25 review): (2+3i)*(1-i), (3+4i)/(1-2i), i^3.
// Worked the textbook way, one operation at a time: like parts collected,
// FOIL with i² = −1, division by the conjugate, the cycle of powers of i.
// The parentheses walk above cannot show them: it wrote (2+3i)*(1-i) as
// 2 + 3i*(1-i).
// ---------------------------------------------------------------------------

const isComplex = (z) => z && typeof z === 'object' && 'im' in z;
const parts = (z) => (isComplex(z) ? { re: z.re, im: z.im } : { re: Number(z), im: 0 });
const complexText = (z) => {
  const { re, im } = parts(z);
  return Math.abs(im) < 1e-12 ? formatNumber(re) : formatArithmeticResult(math.complex(re, im), '');
};
// In an expression: brackets around a two-part number or a negative.
const operand = (z) => {
  const t = complexText(z);
  return / [+-] /.test(t) || /^-/.test(t) ? `(${t})` : t;
};
const signed = (v, unit = '') => `${v < 0 ? '−' : '+'} ${unit && Math.abs(v) === 1 ? '' : formatNumber(Math.abs(v))}${unit}`;
// The leading term of a sum: no "+", and a zero term left out.
const first = (v, unit = '') => (unit && Math.abs(v) === 1 ? `${v < 0 ? '−' : ''}${unit}` : `${formatNumber(v)}${unit}`);
const terms = (list) => {
  const kept = list.filter(([v]) => Math.abs(v) > 1e-12);
  if (kept.length === 0) return '0';
  return kept.map(([v, unit], i) => (i === 0 ? first(v, unit) : signed(v, unit))).join(' ');
};

function complexWorking(expr) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return null;
  }
  const lines = [];
  const value = (n) => {
    if (n.type === 'ParenthesisNode') return value(n.content);
    if (n.type === 'ConstantNode' && typeof n.value === 'number') return n.value;
    if (n.type === 'SymbolNode' && n.name === 'i') return math.complex(0, 1);
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return math.unaryMinus(value(n.args[0]));
    // A plain number written with i, 3*i or 3i: nothing to work out yet.
    const plain = (z) => !isComplex(z) || Math.abs(z.re) < 1e-12 || Math.abs(z.im) < 1e-12;
    if (n.type === 'FunctionNode' && n.args.length === 1) {
      const z = value(n.args[0]);
      const { re, im } = parts(z);
      if (n.fn.name === 'abs') {
        const out = Math.hypot(re, im);
        lines.push(`The modulus is the distance from ${mark('0')}: ${mark(`|${complexText(z)}| = √(${operand(re)}^2 + ${operand(im)}^2) = √${formatNumber(re * re + im * im)} = ${formatNumber(out)}`)}.`);
        return out;
      }
      if (n.fn.name === 'sqrt' && Math.abs(im) < 1e-12 && re < 0) {
        const out = math.sqrt(z);
        lines.push(`A square root of a negative number: ${mark(`√(${formatNumber(re)}) = √${formatNumber(-re)}·√(−1) = ${complexText(out)}`)}.`);
        return out;
      }
      throw new Error('function');
    }
    if (n.type !== 'OperatorNode' || n.args.length !== 2) throw new Error('operation');
    const [z, w] = n.args.map(value);
    const { re: a, im: b } = parts(z);
    const { re: c, im: d } = parts(w);
    let out;
    if (n.fn === 'add' || n.fn === 'subtract') {
      out = n.fn === 'add' ? math.add(z, w) : math.subtract(z, w);
      // Only when like parts combine: 2 + 3i is a number being written.
      if ((a !== 0 && c !== 0) || (b !== 0 && d !== 0)) {
        const op = n.fn === 'add' ? '+' : '−';
        lines.push(`${n.fn === 'add' ? 'Add' : 'Subtract'} the real parts and the imaginary parts: ${mark(`${operand(z)} ${op} ${operand(w)} = (${formatNumber(a)} ${op} ${operand(c)}) + (${formatNumber(b)} ${op} ${operand(d)})i = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'multiply') {
      out = math.multiply(z, w);
      if (!plain(z) && !plain(w)) {
        lines.push(`Multiply out (FOIL), then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}${operand(w)} = ${terms([[a * c, ''], [a * d, 'i'], [b * c, 'i'], [b * d, 'i^2']])} = ${terms([[a * c, ''], [-b * d, ''], [a * d + b * c, 'i']])} = ${complexText(out)}`)}.`);
      } else if (isComplex(z) && isComplex(w) && Math.abs(b) > 1e-12 && Math.abs(d) > 1e-12) {
        // 3i·2i: the coefficients multiply and i·i is i², which is −1.
        lines.push(`Multiply, then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}·${operand(w)} = ${first(b * d, 'i^2')} = ${complexText(out)}`)}.`);
      } else if ((Math.abs(b) > 1e-12 && Math.abs(a) > 1e-12) || (Math.abs(d) > 1e-12 && Math.abs(c) > 1e-12)) {
        lines.push(`Multiply each part: ${mark(`${operand(z)}·${operand(w)} = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'divide') {
      out = math.divide(z, w);
      if (Math.abs(d) > 1e-12) {
        const conj = math.complex(c, -d);
        const top = math.multiply(z, conj);
        const bottom = c * c + d * d;
        lines.push(`Divide by multiplying the top and the bottom by the conjugate ${mark(complexText(conj))}, which makes the bottom real: ${mark(`${operand(z)}/${operand(w)} = (${complexText(z)})(${complexText(conj)})/((${complexText(w)})(${complexText(conj)})) = (${complexText(top)})/${formatNumber(bottom)} = ${complexText(out)}`)}.`);
      } else {
        lines.push(`Divide each part by ${mark(formatNumber(c))}: ${mark(`${operand(z)}/${formatNumber(c)} = ${complexText(out)}`)}.`);
      }
    } else if (n.fn === 'pow' && !isComplex(w) && Number.isInteger(w) && Math.abs(w) <= 12) {
      out = math.pow(z, w);
      if (Math.abs(a) < 1e-12 && Math.abs(b - 1) < 1e-12 && w >= 0) {
        const r = w % 4;
        const cycle = `Powers of ${mark('i')} repeat every 4: ${mark('i^1 = i')}, ${mark('i^2 = −1')}, ${mark('i^3 = −i')}, ${mark('i^4 = 1')}.`;
        lines.push(w < 4 ? `${cycle} So ${mark(`i^${w} = ${complexText(out)}`)}.` : `${cycle} ${mark(`${w} = 4·${Math.floor(w / 4)} + ${r}`)}, so ${mark(`i^${w} = i^${r} = ${complexText(out)}`)}.`);
      } else if (w === 2 && Math.abs(b) > 1e-12) {
        lines.push(`Square it, then use ${mark('i^2 = −1')}: ${mark(`${operand(z)}^2 = ${terms([[a * a, ''], [2 * a * b, 'i'], [b * b, 'i^2']])} = ${complexText(out)}`)}.`);
      } else if (Math.abs(b) > 1e-12) {
        lines.push(`Multiply ${mark(operand(z))} by itself ${mark(String(w))} times, using ${mark('i^2 = −1')}: ${mark(`${operand(z)}^${w} = ${complexText(out)}`)}.`);
      }
    } else {
      throw new Error('operation');
    }
    return out;
  };
  try {
    value(tree);
    return lines;
  } catch {
    return null;
  }
}

function complexGuidance() {
  return {
    tips: [
      `${mark('i')} is defined by ${mark('i^2 = −1')}: multiply complex numbers like binomials, then replace ${mark('i^2')} with ${mark('−1')}.`,
      `To divide, multiply the top and the bottom by the conjugate of the bottom (${mark('c + di → c − di')}): ${mark('(c + di)(c − di) = c^2 + d^2')} is real.`,
      `Powers of ${mark('i')} cycle every 4: ${mark('i, −1, −i, 1')}.`,
    ],
    common_mistakes: [
      `Leaving ${mark('i^2')} in the answer instead of replacing it with ${mark('−1')}.`,
      `Dividing the real and imaginary parts separately by a complex number: ${mark('(3 + 4i)/(1 − 2i)')} is not ${mark('3/1 + 4i/(−2i)')}.`,
    ],
  };
}
