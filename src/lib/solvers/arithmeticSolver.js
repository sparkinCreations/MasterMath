// Arithmetic: a numeric expression evaluated with its PEMDAS working, exact
// where it can be (fractions, roots, logarithms, whole numbers of any size).
// This file is the entry point (solveArithmetic); the rest is in ./arithmetic/:
//
// - notation.js: percent, logarithm and root notation read and written exactly
// - fractions.js: a chain of fractions worked over the LCD
// - undefinedCases.js: division by zero, log of 0, 0^0, mod 0
// - working.js: the order-of-operations working, step by step
// - exactNumbers.js: exact rationals and big whole numbers, scientific form
// - complex.js: arithmetic with i, worked
// - guidance.js: tips and mistakes

import { math, formatNumber, stripMathMarkers, mark } from './solverUtils.js';
import { parseError, overflow, undefinedValue, indeterminate } from '../solutionEnvelope.js';
import { complexGuidance, arithmeticGuidance } from './arithmetic/guidance.js';
import {
  foldLogs,
  logNotation,
  rewritePercent,
  asMath,
  simplifiedRoot,
  imaginaryRoot,
} from './arithmetic/notation.js';
import {
  isSettledGroup,
  exactFraction,
  fractionText,
  fractionSteps,
} from './arithmetic/fractions.js';
import {
  modsByZero,
  logOfZero,
  dividesByZero,
  raisesZeroToZero,
} from './arithmetic/undefinedCases.js';
import {
  unshowable,
  exactRational,
  exactRationalSolution,
  formatArithmeticResult,
} from './arithmetic/exactNumbers.js';
import { showWorking, describeOrder } from './arithmetic/working.js';
import { complexWorking } from './arithmetic/complex.js';

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

    const iRoot = imaginaryRoot(cleaned);
    if (iRoot) {
      steps.push(`Take out ${mark('√(−1) = i')}: ${mark(`√(−${iRoot.N}) = √${iRoot.N}·i${iRoot.k > 1 ? ` = ${iRoot.text}` : ''}`)}${iRoot.k > 1 ? `, since ${mark(`√${iRoot.N} = √${iRoot.k * iRoot.k}·√${iRoot.inside} = ${iRoot.k}√${iRoot.inside}`)}` : ''}.`);
    }
    const shownAnswer = (iRoot ? `${iRoot.text} (≈ ${formatNumber(result.im)}i)` : formatArithmeticResult(result, cleaned, root)) + (zeroToZero && String(cleaned).replace(/\s/g, '') === '0^0' ? ' (by convention)' : '');
    steps.push(`Final answer: ${mark(shownAnswer)}`);

    // "15% of 80" is worked as a product of fractions, but its lesson is
    // the percent, not "no common denominator needed" (October 2026 audit).
    const percentWork = /%/.test(cleaned) || /Percent means/.test(stripMathMarkers(steps.join('\n')));
    const guidance = (fractionWork && !percentWork) ? fractionWork : (complexInput ? complexGuidance(cleaned) : arithmeticGuidance(steps, cleaned));
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
