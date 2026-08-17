import { create, all } from 'mathjs';
import { math, formatNumber, beautify } from './solverUtils.js';
import { parseError } from '../solutionEnvelope.js';

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
    const cleaned = rewritePercent(original);

    const result = math.evaluate(cleaned);
    const steps = [`Evaluate: ${original}`];
    if (cleaned !== original) {
      steps.push(`Percent means "per hundred": rewrite ${original} as ${cleaned}.`);
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
