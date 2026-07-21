import { math, formatNumber } from './solverUtils.js';
import { parseError } from '../solutionEnvelope.js';

export function solveArithmetic(expression) {
  try {
    const cleaned = expression.trim();

    const result = math.evaluate(cleaned);
    const steps = [`Evaluate: ${cleaned}`];

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

function formatArithmeticResult(result, cleaned) {
  const formatted = formatNumber(result);

  // For a single division, also show the fractional form for context.
  if (typeof result === 'number' && /^[^/]+\/[^/]+$/.test(cleaned) && !/[-+*×÷]/.test(cleaned.replace(/^-/, ''))) {
    const [num, den] = cleaned.split('/').map((p) => p.trim());
    if (num && den && !Number.isNaN(Number(num)) && !Number.isNaN(Number(den))) {
      return `${formatted} (${num}/${den})`;
    }
  }

  return formatted;
}
