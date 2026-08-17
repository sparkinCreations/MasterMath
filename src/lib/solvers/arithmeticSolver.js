import { create, all } from 'mathjs';
import { math, formatNumber, beautify } from './solverUtils.js';
import { parseError, overflow, undefinedValue, indeterminate } from '../solutionEnvelope.js';

// A second mathjs instance that computes in exact rational arithmetic. Where
// the whole expression is rational (1/3 + 1/6), it yields the exact fraction;
// where it isn't (sqrt(2), e^2, factorials) it throws, and the float result
// stands. Used only for display: the float `math` result remains the value.
const exact = create(all, { number: 'Fraction' });

// Percent notation, the narrow forms students actually type: "50% of 80" and
// a bare "N%". This is notation, not natural language — "of" here is the
// arithmetic operator it always is in percentage work.
function rewritePercent(text) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/gi, '($1/100)*')
    .replace(/(\d+(?:\.\d+)?)\s*%(?![\w(])/g, '($1/100)');
}

export function solveArithmetic(expression) {
  try {
    const original = expression.trim();
    // Under Arithmetic there are no variables, so an "x" between two numbers
    // is the multiplication sign a student reached for: "2 x 3" → 2*3.
    // (parseMathExpression will have removed the spaces already: "2x3".)
    const cleaned = rewritePercent(original).replace(/(\d|\))\s*x\s*(\d|\()/gi, '$1*$2');

    const result = math.evaluate(cleaned);

    // mathjs defines mod(a, 0) = a; in arithmetic a mod 0 has no value.
    if (typeof result === 'number' && Number.isFinite(result) && modsByZero(cleaned)) {
      return undefinedValue({
        input: original,
        reason: 'the modulus is zero',
        steps: [`Evaluate: ${original}`, 'a mod b asks for the remainder after dividing by b — and dividing by 0 has no value, so neither does the remainder.'],
        tips: ['A remainder only makes sense for a nonzero divisor.'],
        common_mistakes: ['Reading a mod 0 as a (some calculators return the dividend unchanged).'],
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
      if (dividesByZero(cleaned)) {
        if (Number.isNaN(result)) {
          return indeterminate({
            input: original,
            form: '0/0',
            note: '0/0 is not a number: every number times 0 gives 0, so no single value fits. In calculus it is an indeterminate form — a limit can settle it, plain arithmetic cannot.',
          });
        }
        return undefinedValue({
          input: original,
          reason: 'division by zero',
          steps: [
            `Evaluate: ${original}`,
            'This expression divides by zero. No number multiplied by 0 gives a nonzero result, so the quotient has no value.',
          ],
          tips: [
            'A limit may grow without bound — 1/x → ∞ as x → 0⁺ — but the arithmetic expression 1/0 has no value at all.',
            'Check for a denominator that works out to zero, such as 8/(3-3).',
          ],
          common_mistakes: ['Reading 1/0 as ∞. Infinity describes how a limit behaves, not the result of a division.'],
        });
      }
      if (!Number.isNaN(result)) {
        return overflow({ input: original });
      }
    }
    const steps = [`Evaluate: ${original}`];
    if (/%/.test(original) && cleaned !== original) {
      steps.push(`Percent means "per hundred": rewrite ${original} as ${cleaned}.`);
    } else if (cleaned !== original) {
      steps.push(`Reading "x" between numbers as multiplication: ${cleaned}.`);
    }

    // Show the real reduction by collapsing the innermost parentheses one at a
    // time — this is genuine intermediate work, not a canned reminder.
    let working = cleaned;
    let guard = 0;
    while (/\([^()]+\)/.test(working) && guard++ < 25) {
      const match = working.match(/\([^()]+\)/);
      let value;
      try {
        value = math.evaluate(match[0]);
      } catch {
        break;
      }
      const shown = formatNumber(value);
      const substitution = Number(value) < 0 ? `(${shown})` : shown;
      const next = working.slice(0, match.index) + substitution + working.slice(match.index + match[0].length);
      steps.push(`Work inside the parentheses: ${match[0]} = ${shown}  →  ${next}`);
      working = next;
    }

    // For the remaining flat expression, state the order that applies. The UI
    // numbers each step, so we describe the action rather than prefixing "Step N".
    describeOrder(working, steps);

    steps.push(`Final answer: ${formatNumber(result)}`);

    return {
      steps,
      answer: formatArithmeticResult(result, cleaned),
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
      graph: null,
    };
  } catch (error) {
    console.error('Arithmetic solver error:', error);
    // mathjs error messages are specific ("Parenthesis ) expected (char 4)",
    // "Undefined symbol abc") — pass them through rather than generic tips.
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use * for multiplication, / for division, and ^ for exponents (e.g., (2+3)*4^2).'],
      common_mistakes: ['Missing operators between numbers', 'Unbalanced parentheses'],
    });
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
function formatArithmeticResult(result, cleaned) {
  const formatted = formatNumber(result);
  if (typeof result !== 'number') return formatted;

  // Non-finite (1/0, 0/0): keep the offending quotient visible for context.
  if (!Number.isFinite(result)) {
    if (/^[^/]+\/[^/]+$/.test(cleaned) && !/[-+*×÷]/.test(cleaned.replace(/^-/, ''))) {
      return `${formatted} (${cleaned.replace(/\s+/g, '')})`;
    }
    return formatted;
  }
  if (Number.isInteger(result)) return formatted;

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
