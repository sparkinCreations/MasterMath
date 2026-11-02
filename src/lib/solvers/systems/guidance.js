// Tips and mistakes for systems of equations, chosen by what the solve
// found, ranked, with a worked "Here: …" line second: the first insight
// applied to this system (1.66.0, with inequalities). The solver hands over
// `guide`, the values its steps were written from.

import { mark } from '../solverUtils.js';

const dedupe = (list) => [...new Set(list.filter(Boolean))];
const assemble = (tips, here, mistakes) => ({ tips: dedupe([tips[0], here, ...tips.slice(1)]), common_mistakes: dedupe(mistakes) });

const LISTS = {
  unique: {
    tips: [
      'Substitution: solve one equation for one variable, put that into the other, and what is left is one equation in one unknown.',
      `Two lines cross at exactly one point when the determinant ${mark('a₁b₂ − a₂b₁')} is not ${mark('0')}; when it is ${mark('0')} they are parallel or the same line.`,
      'Elimination is the other route: add or subtract multiples of the equations so that one variable cancels. Both routes give the same point.',
      'Check the pair in both original equations, not only in the one you substituted into.',
      'Clear fractions first: multiplying an equation by its common denominator gives the same line with whole-number coefficients.',
    ],
    mistakes: [
      `Substituting back into the equation the variable was solved from: it always gives ${mark('0 = 0')} and says nothing.`,
      'A sign slip when moving a term across the equals sign, or when multiplying out a minus sign.',
      'Solving for one variable and forgetting to find the other.',
      'Checking the answer in only one of the equations.',
    ],
  },
  parallel: {
    tips: [
      'Lines with the same slope and different intercepts are parallel and never meet: the system has no solution (it is inconsistent).',
      `In the equations this shows as left sides in proportion with the constants out of proportion; elimination then leaves a false statement such as ${mark('0 = 2')}.`,
      `The determinant ${mark('a₁b₂ − a₂b₁')} is ${mark('0')} both for parallel lines and for the same line: the constants decide which.`,
    ],
    mistakes: [
      `Reading ${mark('0 = 2')} as a value for a variable: it is a contradiction, so there is no solution.`,
      'Concluding there is one solution without checking whether the lines are parallel.',
    ],
  },
  same: {
    tips: [
      'When one equation is a constant multiple of the other, both describe the same line, and every point on it is a solution.',
      `Describe the solutions with a parameter: let one variable be ${mark('t')}, solve for the other in terms of ${mark('t')}, and each real ${mark('t')} gives one point.`,
      `Elimination leaves ${mark('0 = 0')}: true, and it says nothing new.`,
    ],
    mistakes: [
      `Reading ${mark('0 = 0')} as "no solution": it means infinitely many.`,
      'Stopping at "infinitely many" without saying which points: the parameterised line is the answer.',
    ],
  },
  gauss: {
    tips: [
      'Elimination on a 3×3 system: use one equation to clear the first variable from the other two, then one of those to clear the second variable, then back-substitute.',
      `If a pivot is ${mark('0')}, swap in an equation below that has that variable; never divide by ${mark('0')}. If none has it, that variable is free, and the system has no single solution.`,
      'Keep the arithmetic exact, in fractions: decimals collect rounding over the row operations.',
      'Check the triple in all three original equations.',
    ],
    mistakes: [
      'Losing a sign when subtracting a multiple of one equation from another.',
      'Forgetting to apply a row operation to the right-hand side as well.',
      'Back-substituting in the wrong order: the last equation gives the last variable first.',
    ],
  },
  gaussNone: {
    tips: [
      `A row ${mark('0 = c')} with ${mark('c ≠ 0')} after elimination means no triple satisfies all three equations: the system is inconsistent.`,
      'Geometrically, the three planes have no point in common.',
    ],
    mistakes: [
      'Dividing by a zero pivot instead of swapping equations.',
      `Reading ${mark('0 = c')} as a value for a variable.`,
    ],
  },
  gaussMany: {
    tips: [
      `A row ${mark('0 = 0')} after elimination means one equation is a combination of the others: the solutions form a line or a plane, not a point.`,
      'With fewer independent equations than unknowns, at least one variable is free.',
    ],
    mistakes: [
      `Reporting "no solution" when a row becomes ${mark('0 = 0')}: that row is simply redundant.`,
    ],
  },
  curves: {
    tips: [
      'Substitution: solve the equation that is linear in a variable for that variable, put it into the other, and what is left is one polynomial equation in one variable.',
      'A line can meet a parabola or a circle at 0, 1 or 2 points: find every real root, then the partner value for each.',
      'Always substitute each pair back into BOTH original equations.',
      'The polynomial left after substituting has at most as many real roots as its degree, so the curves meet at most that many times.',
    ],
    mistakes: [
      `Finding the ${mark('x')}-values and forgetting to compute the matching ${mark('y')} for each one.`,
      `Pairing every ${mark('x')} with every ${mark('y')} instead of the ${mark('y')} that belongs to each ${mark('x')}.`,
      'Reporting a complex root as an intersection point.',
    ],
  },
};

// The root count, for the degree this substitution left.
function curvesTips(g) {
  const tips = LISTS.curves.tips.slice();
  if (g.degree > 2) {
    tips[1] = `After substituting, the polynomial left has degree ${mark(String(g.degree))}, so the curves meet at most ${g.degree} times: find every real root, then the partner value for each.`;
    tips.splice(tips.indexOf(LISTS.curves.tips[3]), 1);
  }
  return tips;
}

function here(g) {
  switch (g.kind) {
    case 'unique':
      return g.route ? `Here: ${g.route}.` : null;
    case 'parallel':
      return `Here: ${g.proportional}; subtracting leaves ${mark(`0 = ${g.gap}`)}, which is false.`;
    case 'same':
      return `Here: ${g.proportional}, so both are the line ${mark(g.line)}: every point ${mark(g.param)} is a solution.`;
    case 'gauss':
      return `Here: after the elimination the last equation has only ${mark(g.last)} left, so ${mark(`${g.last} = ${g.lastValue}`)}; back-substituting gives ${mark(g.rest)}.`;
    case 'gaussNone':
      return 'Here: the elimination leaves an equation with no variables and a nonzero constant, so the equations contradict each other.';
    case 'gaussMany':
      return 'Here: the elimination leaves one equation that the others already imply, so one variable is free.';
    case 'curves':
      return g.substituted
        ? `Here: ${mark(`${g.w} = ${g.isolated}`)} put into the other equation leaves ${mark(`${g.substituted} = 0`)}${g.roots ? `, so ${mark(g.roots)}` : ', which has no real root'}.`
        : null;
    default:
      return null;
  }
}

export function systemGuidance(guide) {
  const lists = guide && LISTS[guide.kind];
  if (!lists) return null;
  try {
    return assemble(guide.kind === 'curves' ? curvesTips(guide) : lists.tips, here(guide), lists.mistakes);
  } catch {
    return null;
  }
}
