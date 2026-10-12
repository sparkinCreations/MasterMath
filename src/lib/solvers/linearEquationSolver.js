/**
 * Linear equations in one unknown, worked the way a textbook does it:
 * clear fractions (or distribute and combine like terms), collect the
 * variable on one side, move the constant to the other, divide by the
 * coefficient. Every number is an exact fraction — mathjs in Fraction mode —
 * so 3(x − 2) = 2x + 1 never passes through floating point, and 1/3 stays
 * 1/3.
 *
 * Replaces mathsteps' linear walkthrough (mathsteps was removed in 1.39.0:
 * unmaintained, and its bundled mathjs 3 builds code with `new Function`,
 * which the app's Content-Security-Policy forbids). Linearity is proved,
 * not sampled: the parse tree gives an upper bound d on each side's degree
 * as a polynomial, and a polynomial of degree ≤ d that equals a·x + c at
 * d + 1 points (in exact arithmetic) equals it everywhere. A fixed set of
 * sample points is not enough — x(x − 1)(x − 2)(x + 3)(7x − 1)(3x − 5) + x
 * agrees with x at six chosen points and once passed as linear (October
 * 2026). Anything else — another letter, x in a denominator or a function,
 * a constant like π, an equation whose x terms cancel — returns null, and
 * algebraSolver's later paths handle it.
 */

import { createMath } from '../mathInstance.js';
import { beautify, formatNumber, gcd, splitTerms } from './solverUtils.js';
import { degreeBound } from './polynomialRoots.js';

const exact = createMath({ number: 'Fraction' });
// Above this degree bound the side is left to the general paths.
const MAX_DEGREE = 24;

// { a, c } with side ≡ a·x + c exactly, or null.
function linearForm(side, variable) {
  try {
    const node = exact.parse(side);
    const bound = degreeBound(node, variable);
    if (!(bound <= MAX_DEGREE)) return null;
    const code = node.compile();
    const at = (v) => {
      const r = code.evaluate({ [variable]: exact.fraction(v) });
      if (exact.typeOf(r) !== 'Fraction') throw new Error('not exact');
      return r;
    };
    const c = at(0);
    const a = exact.subtract(at(1), c);
    // side − (a·x + c) has degree ≤ max(bound, 1) and vanishes at 0 and 1;
    // vanishing at `bound` more distinct points makes it identically zero.
    for (let k = 2; k <= bound + 1; k += 1) {
      const expected = exact.add(exact.multiply(a, k), c);
      if (!exact.equal(at(k), expected)) return null;
    }
    return { a, c };
  } catch {
    return null;
  }
}

function makeFormat(decimal) {
  const num = (f) => {
    if (decimal) return formatNumber(f.valueOf());
    return exact.isInteger(f) ? String(f.valueOf()) : f.toFraction();
  };
  // A signed coefficient times the variable: x, -x, 3x, (1/4)x, -(2/3)x.
  const term = (a, v) => {
    const abs = exact.abs(a);
    let coef = num(abs);
    if (exact.equal(abs, 1)) coef = '';
    else if (!decimal && !exact.isInteger(abs)) coef = `(${coef})`;
    return `${exact.isNegative(a) ? '-' : ''}${coef}${v}`;
  };
  const linear = (a, c, v) => {
    if (exact.isZero(a)) return num(c);
    if (exact.isZero(c)) return term(a, v);
    return `${term(a, v)} ${exact.isNegative(c) ? '-' : '+'} ${num(exact.abs(c))}`;
  };
  return { num, term, linear };
}

// Does a side need a simplifying step before the inverse operations?
function needsSimplifying(side, variable) {
  if (side.includes('(')) return true;
  const occurrences = (side.match(new RegExp(`(?<![a-zA-Z])${variable}(?![a-zA-Z])`, 'g')) || []).length;
  if (occurrences > 1) return true;
  let depth = 0;
  let terms = 1;
  const s = side.replace(/\s+/g, '');
  for (let i = 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && (ch === '+' || ch === '-') && !/[*/^(eE]/.test(s[i - 1])) terms++;
  }
  return terms > 2;
}

const tight = (t) => t.replace(/[\s*]/g, '');

// A side with each parenthesised term multiplied out but nothing combined:
// 4 - 3(2x + 1) -> 4 - 6x - 3.
function distribute(side, variable, linear) {
  const pieces = splitTerms(side).map(({ signed }) => {
    const form = signed.includes('(') ? linearForm(signed, variable) : null;
    return form ? linear(form.a, form.c, variable) : signed;
  });
  // beautify turns the "+ -" joins into "-".
  return beautify(pieces.join(' + '));
}

const lcm = (a, b) => (a / gcd(a, b)) * b;

/**
 * Worked solution of a linear equation in `variable`, or null when the
 * equation is not linear with a non-zero net coefficient.
 * Returns { steps, answer, solutions } like algebraSolver's other paths.
 */
export function solveLinearEquation(expression, variable = 'x') {
  const parts = String(expression).split('=');
  if (parts.length !== 2) return null;
  const [lhs, rhs] = parts.map((p) => p.trim());
  if (!lhs || !rhs) return null;

  const L = linearForm(lhs, variable);
  const R = linearForm(rhs, variable);
  if (!L || !R) return null;
  if (exact.isZero(L.a) && exact.isZero(R.a)) return null;
  // Identity or contradiction: the x terms cancel. Handled elsewhere, with
  // its own explanation.
  if (exact.equal(L.a, R.a)) return null;

  const decimal = /\d\.\d/.test(expression);
  const { num, term, linear } = makeFormat(decimal);
  const v = variable;
  const steps = [];
  let { a: aL, c: cL } = L;
  let { a: aR, c: cR } = R;

  // 1. Clear fractions, or simplify each side.
  const denominators = [aL, cL, aR, cR].map((f) => Number(f.d));
  const D = decimal ? 1 : denominators.reduce(lcm, 1);
  if (D > 1) {
    [aL, cL, aR, cR] = [aL, cL, aR, cR].map((f) => exact.multiply(f, D));
    steps.push(`Multiply both sides by ${D} (the least common denominator) to clear the fractions: ${linear(aL, cL, v)} = ${linear(aR, cR, v)}`);
  } else if (needsSimplifying(lhs, v) || needsSimplifying(rhs, v)) {
    const simplified = `${linear(aL, cL, v)} = ${linear(aR, cR, v)}`;
    if ((lhs + rhs).includes('(')) {
      // Distribution and combining are separate steps: folding them into one
      // hid the two things a student most needs to see (September 2026).
      const distributed = `${distribute(lhs, v, linear)} = ${distribute(rhs, v, linear)}`;
      if (tight(distributed) === tight(`${beautify(lhs)} = ${beautify(rhs)}`)) {
        // Nothing distributes term by term — (x + 1)^2 − x^2 expands as a whole.
        steps.push(`Expand and combine like terms on each side: ${simplified}`);
      } else {
        steps.push(`Distribute to remove the parentheses: ${distributed}`);
        if (tight(distributed) !== tight(simplified)) steps.push(`Combine like terms: ${simplified}`);
      }
    } else {
      steps.push(`Combine like terms on each side: ${simplified}`);
    }
  }

  // 2. The variable only appears on the right: swap the sides.
  if (exact.isZero(aL)) {
    [aL, cL, aR, cR] = [aR, cR, aL, cL];
    steps.push(`Swap the two sides so ${v} is on the left: ${linear(aL, cL, v)} = ${linear(aR, cR, v)}`);
  }

  // 3. Collect the variable terms on the left.
  if (!exact.isZero(aR)) {
    const moved = exact.isNegative(aR) ? `Add ${term(exact.abs(aR), v)} to both sides` : `Subtract ${term(aR, v)} from both sides`;
    aL = exact.subtract(aL, aR);
    aR = exact.fraction(0);
    steps.push(`${moved}: ${linear(aL, cL, v)} = ${num(cR)}`);
  }

  // 4. Move the constant to the right.
  if (!exact.isZero(cL)) {
    const moved = exact.isNegative(cL) ? `Add ${num(exact.abs(cL))} to both sides` : `Subtract ${num(cL)} from both sides`;
    cR = exact.subtract(cR, cL);
    cL = exact.fraction(0);
    steps.push(`${moved}: ${term(aL, v)} = ${num(cR)}`);
  }

  // 5. Divide by the coefficient.
  const solution = exact.divide(cR, aL);
  if (exact.equal(aL, -1)) {
    steps.push(`Multiply both sides by -1: ${v} = ${num(solution)}`);
  } else if (!exact.equal(aL, 1)) {
    const result = num(solution);
    if (!decimal && !exact.isInteger(aL)) {
      steps.push(`Multiply both sides by ${num(exact.divide(1, aL))}, the reciprocal of ${num(aL)}: ${v} = ${result}`);
    } else {
      const divisor = exact.isNegative(aL) ? `(${num(aL)})` : num(aL);
      const quotient = `${num(cR)}/${divisor}`;
      steps.push(`Divide both sides by ${num(aL)}: ${v} = ${quotient === result ? result : `${quotient} = ${result}`}`);
    }
  }

  // Nothing to do (x = 5): leave it to the general path.
  if (steps.length === 0) return null;
  return { steps, answer: `${v} = ${num(solution)}`, solutions: [solution.valueOf()] };
}
