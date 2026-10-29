// The sign-chart working, the trivial cases (identical sides), the graph,
// and refusals.

import { beautify, sampleFunction, mark } from '../solverUtils.js';
import { parseError, unsupported } from '../../solutionEnvelope.js';
import { bars, shown, labelKey } from './roots.js';
import {
  endpoint,
  intervalLabel,
  isAllReals,
  pieceToInequality,
  pieceToInterval,
} from './intervals.js';

// --- display -----------------------------------------------------------------

export function buildSteps({ lhs, rhs, op, variable, fExpr, simplified, critical, poles, zeros, chartRows, solution, nonStrict, labels, edges = [] }) {
  const opShown = op.replace('<=', '≤').replace('>=', '≥');
  const steps = [`Solve the inequality ${mark(`${bars(beautify(lhs))} ${opShown} ${bars(beautify(rhs))}`)}.`];

  // A number on the right moves across as it is: |2x − 1| − 5, not the
  // engine's −5 + |−2x + 1| (October 2026 test list).
  const rhsNumber = /^-?\d+(?:\.\d+)?$/.test(beautify(rhs).trim()) ? Number(beautify(rhs)) : null;
  const moved = rhsNumber !== null && rhsNumber !== 0
    ? `${bars(beautify(lhs))} ${rhsNumber < 0 ? '+' : '-'} ${beautify(String(Math.abs(rhsNumber)))}`
    : shown(simplified);
  if (beautify(rhs) !== '0') {
    steps.push(`Move everything to one side: ${mark(`${moved} ${opShown} 0`)}.`);
  }

  if (critical.length > 0) {
    const zeroList = zeros.filter((z) => !poles.some((p) => Math.abs(p - z) < 1e-9));
    if (zeroList.length) {
      steps.push(`Find where the expression is zero: ${mark(`${variable} = ${zeroList.map((z) => endpoint(z, labels)).join(', ')}`)}${zeroList.some((z) => !labels?.has(labelKey(z)) && !Number.isInteger(z)) ? ' (located numerically, to the decimals shown)' : ''}.`);
    }
    if (poles.length) {
      steps.push(`Note where it is undefined (denominator zero): ${mark(`${variable} = ${poles.map((p) => endpoint(p, labels)).join(', ')}`)}.`);
    }
    if (edges.length) {
      steps.push(`Note where the expression stops being defined (a logarithm or square root of a negative number): its domain ends at ${mark(`${variable} = ${edges.map((e) => endpoint(e, labels)).join(', ')}`)}.`);
    }
    steps.push(`These split the number line into intervals. Test the sign of ${mark(moved)} in each:`);
    for (const row of chartRows) {
      const label = intervalLabel(row.lo, row.hi, labels);
      const word = row.sign > 0 ? 'positive' : row.sign < 0 ? 'negative' : row.defined === false ? 'undefined' : 'zero';
      steps.push(`  • On ${mark(label)}: ${mark(moved)} is ${word}.`);
    }
  } else {
    steps.push(`The expression never changes sign, so check any single value of ${mark(variable)}.`);
  }

  if (solution.length === 0) {
    steps.push('No interval satisfies the inequality, so there is no solution.');
  } else if (isAllReals(solution)) {
    steps.push('Every interval satisfies the inequality, so all real numbers work.');
  } else {
    const kind = nonStrict ? 'including the boundary roots' : 'excluding the boundary roots';
    steps.push(`Collect the satisfying intervals, ${kind}: ${mark(solution.map((p) => pieceToInequality(p, variable, labels)).join('  or  '))}.`);
    steps.push(`In interval notation: ${mark(solution.map((p) => pieceToInterval(p, labels)).join(' ∪ '))}.`);
  }

  return steps;
}

export function buildTrivial(all, variable, op) {
  return {
    steps: [
      `Simplify the inequality — both sides are equal, so it reads ${mark(`0 ${op.replace('<=', '≤').replace('>=', '≥')} 0`)}.`,
      all ? 'Since equality is allowed, every value works.' : 'Since it is strict, no value works.',
    ],
    answer: all ? 'All real numbers satisfy the inequality' : 'No solution — no value satisfies the inequality',
    tips: [`When both sides are identical, a ${mark('≤')}/${mark('≥')} inequality holds everywhere and a ${mark('<')}/${mark('>')} holds nowhere.`],
    common_mistakes: [],
    graph: null,
  };
}

// --- graph -------------------------------------------------------------------

// Plot f(x), mark its zeros (intercepts) and breaks (vertical asymptotes), and
// shade the x-ranges where the inequality holds.
export function buildGraph(fExpr, variable, critical, zeros, poles, solution) {
  try {
    const pad = 4;
    const lo = critical.length ? Math.min(...critical) - pad : -10;
    const hi = critical.length ? Math.max(...critical) + pad : 10;
    const span = Math.max(hi - lo, 8);
    const min = lo - span * 0.4;
    const max = hi + span * 0.4;

    const points = sampleFunction(fExpr, variable, { min, max, step: (max - min) / 300, cap: 1e4 });
    if (points.length === 0) return null;

    const shadedRegions = solution
      .filter((p) => !(Math.abs(p.lo - p.hi) < 1e-12)) // skip single points
      .map((p) => ({ from: p.lo, to: p.hi }));

    return {
      points,
      title: `Sign of f(${variable}) = ${beautify(fExpr)}`,
      description: `Green bands mark where the inequality holds. Zeros are dots; breaks are dashed lines.`,
      annotations: {
        intercepts: zeros.filter((z) => !poles.some((p) => Math.abs(p - z) < 1e-9)).map((z) => ({ x: z, y: 0 })),
        verticalAsymptotes: poles,
        shadedRegions,
      },
      initialWindow: { xMin: min, xMax: max },
    };
  } catch {
    return null;
  }
}

// kind 'parse' = the text couldn't be read as an inequality; 'unsupported' =
// a readable inequality this solver can't handle.
export function refuse(reason, hint, kind = 'parse') {
  const fields = {
    steps: ['Read the input as an inequality.', reason, hint].filter(Boolean),
    answer: reason,
    tips: [`An inequality uses ${mark('<')}, ${mark('>')}, ${mark('≤')}, or ${mark('≥')}, e.g. ${mark('x^2 - 4 > 0')}.`],
    common_mistakes: [`A chain must point one way (${mark('a < x < b')}, not ${mark('a < x > b')}); separate conditions are joined with "and" or "or".`],
  };
  return kind === 'parse' ? parseError(fields) : unsupported(fields);
}
