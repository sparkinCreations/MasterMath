// A linear inequality, solved like an equation, with the sign flipped when
// dividing by a negative.

import { math, beautify, formatNumber, mark } from '../solverUtils.js';
import { safeRun } from './roots.js';
import { pieceToInequality, pieceToInterval, compare } from './intervals.js';
import { buildGraph } from './presentation.js';

// --- linear inequalities ------------------------------------------------------
//
// f = a·x + b with numeric a ≠ 0 and b. Steps: collect x on the left and the
// constant on the right (a·x op −b), then divide by a — reversing the
// inequality when a < 0. Returns the same shape as the sign-chart path so
// compound inequalities can combine it, or null when f isn't linear.
export function solveLinear({ Algebrite, lhs, rhs, op, variable, fExpr, simplified }) {
  const numeric = (t) => t !== null && t !== undefined && !/[a-z]/i.test(t) && Number.isFinite(Number(math.evaluate(t)));
  const a = safeRun(Algebrite, `simplify(d(${simplified}, ${variable}))`);
  if (!numeric(a) || Number(math.evaluate(a)) === 0) return null;
  const b = safeRun(Algebrite, `simplify((${simplified}) - (${a})*${variable})`);
  if (!numeric(b)) return null;
  const aValue = Number(math.evaluate(a));
  const c = safeRun(Algebrite, `simplify(-(${b})/(${a}))`);
  if (!numeric(c)) return null;
  const root = Number(math.evaluate(c));

  const flip = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
  const finalOp = aValue < 0 ? flip[op] : op;
  const pretty = (o) => ({ '<=': '≤', '>=': '≥' }[o] || o);
  const negB = safeRun(Algebrite, `simplify(-(${b}))`) || `-(${b})`;
  const ax = beautify(`${a === '1' ? '' : a === '-1' ? '-' : `${a}*`}${variable}`);

  const steps = [`Solve the inequality ${mark(`${beautify(lhs)} ${pretty(op)} ${beautify(rhs)}`)}.`];
  const collected = `${ax} ${pretty(op)} ${beautify(negB)}`;
  const alreadyCollected = beautify(lhs).replace(/\s/g, '') === ax.replace(/\s/g, '') && beautify(rhs).replace(/\s/g, '') === beautify(negB).replace(/\s/g, '');
  if (!alreadyCollected) {
    steps.push(`Collect the ${mark(variable)} terms on the left and the constants on the right (adding or subtracting the same amount on both sides never changes the direction): ${mark(collected)}.`);
  }
  if (aValue === 1) {
    // x op c already.
  } else if (aValue === -1) {
    steps.push(`Multiply both sides by ${mark('-1')} to make ${mark(variable)} positive. Multiplying or dividing by a negative number REVERSES the inequality: ${mark(`${variable} ${pretty(finalOp)} ${beautify(c)}`)}.`);
  } else if (/\//.test(a)) {
    // A fractional coefficient: multiply by its reciprocal rather than
    // "divide by 1/2".
    const reciprocal = safeRun(Algebrite, `simplify(1/(${a}))`) || `1/(${a})`;
    steps.push(aValue < 0
      ? `Multiply both sides by ${mark(beautify(reciprocal))}, the reciprocal of ${mark(beautify(a))}. Multiplying by a negative number REVERSES the inequality, so ${mark(pretty(op))} becomes ${mark(pretty(finalOp))}: ${mark(`${variable} ${pretty(finalOp)} ${beautify(c)}`)}.`
      : `Multiply both sides by ${mark(beautify(reciprocal))}, the reciprocal of ${mark(beautify(a))} (positive, so the direction stays the same): ${mark(`${variable} ${pretty(finalOp)} ${beautify(c)}`)}.`);
  } else if (aValue < 0) {
    steps.push(`Divide both sides by ${mark(beautify(a))}. Dividing by a negative number REVERSES the inequality, so ${mark(pretty(op))} becomes ${mark(pretty(finalOp))}: ${mark(`${variable} ${pretty(finalOp)} ${beautify(c)}`)}.`);
  } else {
    steps.push(`Divide both sides by ${mark(beautify(a))} (positive, so the direction stays the same): ${mark(`${variable} ${pretty(finalOp)} ${beautify(c)}`)}.`);
  }

  const nonStrict = finalOp === '<=' || finalOp === '>=';
  const piece = finalOp === '<' || finalOp === '<='
    ? { lo: -Infinity, hi: root, loC: false, hiC: nonStrict }
    : { lo: root, hi: Infinity, loC: nonStrict, hiC: false };
  const solution = [piece];
  steps.push(`Solution: ${mark(pieceToInequality(piece, variable))}.  In interval notation: ${mark(pieceToInterval(piece))}.`);

  // Verify: a point inside the solution satisfies the original, a point
  // outside does not, and the boundary matches the operator.
  const holds = (x) => {
    try {
      return compare(Number(math.evaluate(lhs, { [variable]: x })), Number(math.evaluate(rhs, { [variable]: x })), op);
    } catch {
      return null;
    }
  };
  const inside = piece.lo === -Infinity ? root - 1 : root + 1;
  const outside = piece.lo === -Infinity ? root + 1 : root - 1;
  if (holds(inside) !== true || holds(outside) !== false || holds(root) !== nonStrict) return null;
  const reads = (x) => `${formatNumber(math.evaluate(lhs, { [variable]: x }))} ${pretty(op)} ${formatNumber(math.evaluate(rhs, { [variable]: x }))}`;
  steps.push(`Check: at ${mark(`${variable} = ${formatNumber(inside)}`)} the original reads ${mark(reads(inside))}, true; at ${mark(`${variable} = ${formatNumber(outside)}`)} it reads ${mark(reads(outside))}, false. ✓`);

  return {
    steps,
    answer: pieceToInequality(piece, variable),
    verified: true,
    verificationMethod: 'test points on either side of the boundary, and the boundary itself',
    tips: [
      'Solve a linear inequality like a linear equation, with one extra rule: multiplying or dividing both sides by a negative number reverses the inequality sign.',
      'Adding or subtracting the same quantity on both sides never changes the direction.',
      `Polynomial and rational inequalities (${mark('x² − 4 > 0')}) need a sign chart instead: move everything to one side and test each interval.`,
    ],
    common_mistakes: [
      'Forgetting to reverse the sign when dividing by a negative number.',
      'Reversing the sign when adding or subtracting — only multiplying or dividing by a negative flips it.',
      `Using a closed endpoint (${mark('≤')}, bracket) for a strict inequality, or vice versa.`,
    ],
    graph: buildGraph(fExpr, variable, [root], [root], [], solution),
    pieces: solution,
    variable,
    chart: { fExpr, critical: [root], zeros: [root], poles: [] },
  };
}
