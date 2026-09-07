/**
 * The one seam between MasterMath and mathsteps.
 *
 * mathsteps (v0.2.0) is unmaintained and has produced a confidently-wrong
 * answer — it "factored" x² − 2x − 1 as (x − 1)². Its linear and simple-
 * quadratic walkthroughs are still the best explanations in the app, so it
 * stays, but on these terms: `mathstepsSolveEquation` and `mathstepsSimplify`
 * below are the ONLY calls into the library anywhere in src. They never throw,
 * return null for anything that is not a usable step list, and can be turned
 * off with `setMathstepsEnabled(false)`. Every caller has an exact fallback
 * (Algebrite roots / simplify), so switching mathsteps off costs worked steps,
 * never answers — tests/mathstepsSeam.test.js proves that on every path.
 * Callers still verify the answers it returns (algebraSolver substitutes every
 * solution back into the original equation). Roadmap 2026-09 item 8.
 *
 * The rest of this file formats mathsteps' step arrays (it returns arrays
 * directly, not { steps: [] }).
 */

import mathsteps from 'mathsteps';
import { beautify } from './solvers/solverUtils.js';

let enabled = true;

export function setMathstepsEnabled(on) {
  enabled = Boolean(on);
}

export function isMathstepsEnabled() {
  return enabled;
}

function guarded(call) {
  if (!enabled) return null;
  try {
    return stepsFromMathstepsResult(call());
  } catch {
    return null;
  }
}

// Worked steps for a single-variable equation, or null.
export function mathstepsSolveEquation(equation) {
  return guarded(() => mathsteps.solveEquation(equation));
}

// Worked steps for simplifying an expression, or null.
export function mathstepsSimplify(expression) {
  return guarded(() => mathsteps.simplifyExpression(expression));
}

// mathsteps renders implicit multiplication with a space ("2 x", ") (").
// Collapse those first, then run the shared beautifier so equations read like
// textbook math.
function tidy(value) {
  const collapsed = String(value ?? '')
    .replace(/(\d)\s+(?=[a-zA-Z(])/g, '$1')
    .replace(/\)\s+(?=[a-zA-Z0-9(])/g, ')');
  return beautify(collapsed);
}

// Friendly, plain-English descriptions for mathsteps' internal change types.
// Anything not listed falls back to a de-underscored, lowercased version.
const CHANGE_TYPE_LABELS = {
  SIMPLIFY_ARITHMETIC: 'Simplify the arithmetic',
  SIMPLIFY_LEFT_SIDE: 'Simplify the left side',
  SIMPLIFY_RIGHT_SIDE: 'Simplify the right side',
  COLLECT_AND_COMBINE_LIKE_TERMS: 'Collect and combine like terms',
  COMBINE_LIKE_TERMS: 'Combine like terms',
  ADD_POLYNOMIAL_TERMS: 'Add the like terms',
  ADD_FRACTIONS: 'Add the fractions',
  DISTRIBUTE: 'Distribute across the parentheses',
  DISTRIBUTE_NEGATIVE_ONE: 'Distribute the negative sign',
  SUBTRACT_FROM_BOTH_SIDES: 'Subtract from both sides',
  ADD_TO_BOTH_SIDES: 'Add to both sides',
  DIVIDE_FROM_BOTH_SIDES: 'Divide both sides',
  MULTIPLY_TO_BOTH_SIDES: 'Multiply both sides',
  MULTIPLY_BOTH_SIDES_BY_INVERSE_FRACTION: 'Multiply both sides by the reciprocal',
  MULTIPLY_BOTH_SIDES_BY_NEGATIVE_ONE: 'Multiply both sides by -1',
  SIMPLIFY_SIGNS: 'Simplify the signs',
  SWAP_SIDES: 'Swap the two sides',
  REMOVE_ADDING_ZERO: 'Drop the added zero',
  REMOVE_MULTIPLYING_BY_ONE: 'Drop the factor of 1',
  REMOVE_MULTIPLYING_BY_NEGATIVE_ONE: 'Apply the factor of -1',
  RESOLVE_DOUBLE_MINUS: 'Resolve the double negative',
  BREAK_UP_FRACTION: 'Break up the fraction',
  CANCEL_MINUSES: 'Cancel the matching minus signs',
  CANCEL_TERMS: 'Cancel the common terms',
  MULTIPLY_FRACTIONS: 'Multiply the fractions',
  SIMPLIFY_FRACTION: 'Simplify the fraction',
  DIVIDE_BY_GCD: 'Divide by the greatest common divisor',
  MULTIPLY_POLYNOMIAL_TERMS: 'Multiply the terms',
  REARRANGE_COEFF: 'Move the coefficient to the front',
  FACTOR_SUM_PRODUCT_RULE: 'Factor using the sum-product method',
  BREAK_UP_TERM: 'Break up the term',
  FIND_ROOTS: 'Find the roots',
};

export function humanizeChangeType(changeType) {
  if (!changeType) return '';
  if (CHANGE_TYPE_LABELS[changeType]) return CHANGE_TYPE_LABELS[changeType];
  return changeType.replace(/_/g, ' ').toLowerCase();
}

function formatEquationNode(node) {
  if (!node) return '';
  if (typeof node.toString === 'function') {
    return node.toString();
  }
  return String(node);
}

export function formatMathstepsEquation(equation) {
  if (!equation) return '';
  const left = tidy(formatEquationNode(equation.leftNode));
  const right = tidy(formatEquationNode(equation.rightNode));
  return `${left} = ${right}`;
}

export function formatMathstepsStep(step) {
  if (!step) return '';

  if (step.newEquation) {
    const equation = formatMathstepsEquation(step.newEquation);
    if (step.changeType) {
      return `${humanizeChangeType(step.changeType)}: ${equation}`;
    }
    return equation;
  }

  if (step.newNode) {
    const node = tidy(formatEquationNode(step.newNode));
    if (step.changeType) {
      return `${humanizeChangeType(step.changeType)}: ${node}`;
    }
    return node;
  }

  return humanizeChangeType(step.changeType);
}

export function stepsFromMathstepsResult(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const steps = result.map(formatMathstepsStep).filter(Boolean);
  const lastStep = result[result.length - 1];

  let answer = '';
  if (lastStep?.newEquation) {
    answer = formatMathstepsEquation(lastStep.newEquation);
  } else if (lastStep?.newNode) {
    answer = tidy(formatEquationNode(lastStep.newNode));
  }

  return { steps, answer };
}
