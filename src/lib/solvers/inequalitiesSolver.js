// Single-variable inequalities by the sign-chart method.
//
// Built July 2026 (roadmap item 10). Handles linear, polynomial, and rational
// inequalities with <, >, <=, >= (and ≤, ≥). The strategy is the one taught in
// class: move everything to one side, find where that expression is zero (roots
// of the numerator) or undefined (roots of the denominator), then test the sign
// on each interval between those critical points and read off the solution.
//
// Receives the RAW problem text (routed from api.js) so the operator and both
// sides survive intact.
//
// This file is the entry point, the compound split and the dispatch for one
// inequality. In ./inequalities/: roots.js (the boundary points),
// intervals.js (interval arithmetic and notation), linear.js, periodic.js,
// and presentation.js (the sign-chart steps, the graph, refusals).

import {
  math,
  beautify,
  loadAlgebrite,
  structuralPeriod,
  definedEverywhere,
  mark,
} from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';
import {
  safeRun,
  shown,
  realRoots,
  labelTranscendentalZeros,
  domainEdges,
  uniqueSorted,
} from './inequalities/roots.js';
import {
  intersectPieces,
  ALL_REALS,
  unionPieces,
  isAllReals,
  withApproximations,
  pieceToInequality,
  pieceToInterval,
  compare,
  coalesce,
  rhsIsPositiveNumber,
} from './inequalities/intervals.js';
import { refuse, buildGraph, buildTrivial, buildSteps } from './inequalities/presentation.js';
import { solveLinear } from './inequalities/linear.js';
import { solvePeriodic } from './inequalities/periodic.js';

const OPERATORS = ['<=', '>=', '<', '>'];

// Compound inequalities (roadmap 2026-09 item 5): a chain a < f(x) ≤ b is
// "a < f(x) AND f(x) ≤ b"; "and" / "or" join two inequalities. Each part is
// solved by the single-inequality machinery below and the solution sets are
// intersected (and, chain) or united (or).
export async function solveInequality(rawText) {
  const compound = splitCompound(rawText);
  if (!compound) return strip(await solveSingle(rawText));
  if (compound.error) return refuse(compound.error, compound.hint, 'unsupported');

  const parts = [];
  for (const text of compound.parts) {
    const r = await solveSingle(text);
    if (r.periodic) {
      return refuse('One part is a periodic (trigonometric) inequality; combining it with another part is not supported yet.', 'Solve each part on its own: its solution repeats every period.', 'unsupported');
    }
    if (!r.pieces) return strip(r); // a refusal from one part is the answer
    parts.push({ text, result: r });
  }
  const variables = [...new Set(parts.map((p) => p.result.variable).filter(Boolean))];
  if (variables.length > 1) {
    return refuse(`The parts use different variables (${variables.join(', ')}).`, 'A compound inequality must be about one variable.', 'unsupported');
  }
  const variable = variables[0] || 'x';
  const labels = new Map(parts.flatMap((p) => [...(p.result.labels || new Map())]));
  const isAnd = compound.mode === 'and';
  const combined = isAnd
    ? parts.reduce((acc, p) => intersectPieces(acc, p.result.pieces), [{ ...ALL_REALS }])
    : parts.reduce((acc, p) => unionPieces(acc, p.result.pieces), []);

  const answer = combined.length === 0
    ? (isAnd ? 'No solution — no value satisfies both parts' : 'No solution — no value satisfies either part')
    : isAllReals(combined)
      ? 'All real numbers satisfy the inequality'
      : withApproximations(combined.map((p) => pieceToInequality(p, variable, labels)).join('  or  '), combined, labels);

  // A part's answer is math (x < -2  or  x > 2) or a sentence ("No solution — …").
  const asMath = (t) => (/^(?:No |All |True|False)/.test(String(t)) ? t : mark(t));
  const steps = [`Solve the compound inequality ${mark(compound.display)}.`];
  steps.push(compound.chained
    ? `A chain ${mark(`a ${compound.ops[0]} … ${compound.ops[1]} b`)} means BOTH comparisons must hold at once: solve each, then keep the values common to both (the intersection).`
    : isAnd
      ? '"and" means both parts must hold: solve each, then take the intersection of the two solution sets.'
      : '"or" means either part may hold: solve each, then take the union of the two solution sets.');
  parts.forEach((p, i) => steps.push(`Part ${i + 1}: ${mark(p.text)}  →  ${asMath(p.result.answer)}.`));
  if (combined.length === 0) steps.push(isAnd ? 'The two solution sets do not overlap, so there is no solution.' : 'Neither part has any solution.');
  else if (isAllReals(combined)) steps.push(isAnd ? 'Both parts hold everywhere.' : 'Between them the parts cover every real number.');
  else {
    steps.push(`${isAnd ? 'Intersection' : 'Union'}: ${mark(combined.map((p) => pieceToInequality(p, variable, labels)).join('  or  '))}.`);
    steps.push(`In interval notation: ${mark(combined.map((p) => pieceToInterval(p, labels)).join(' ∪ '))}.`);
  }

  const chart = parts.find((p) => p.result.chart)?.result.chart;
  let graph = chart ? buildGraph(chart.fExpr, variable, chart.critical, chart.zeros, chart.poles, combined) : null;
  if (graph) {
    graph = {
      ...graph,
      title: `Solution set of ${compound.display}`,
      description: 'Green bands mark where the compound inequality holds (the curve is the first part\'s expression).',
    };
  }

  return {
    steps,
    answer,
    verified: true,
    verificationMethod: 'each part by sign chart, then set intersection/union',
    tips: [
      `"and" — or a chain ${mark('a < x < b')} — keeps only the values that satisfy every part; "or" keeps the values that satisfy any part.`,
      'Solve each part on its own first, then combine them on a number line.',
    ],
    common_mistakes: [
      'Working on only one side of a chain.',
      'Taking the union for "and", or the intersection for "or".',
      `Writing a chain whose inequalities point in different directions (${mark('a < x > b')}) — that is two separate statements, not a chain.`,
    ],
    graph,
  };
}

function strip(result) {
  if (!result || typeof result !== 'object') return result;
  const { pieces, variable, chart, ...rest } = result;
  return rest;
}

// Returns null for a single inequality; { mode, parts, chained, ops, display }
// for a compound one; { error, hint } for a compound that cannot be read.
function splitCompound(rawText) {
  let s = String(rawText || '').replace(/−/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').trim();
  s = s.replace(/^\s*solve\s+/i, '').trim();
  const ops = s.match(/<=|>=|<|>/g) || [];
  const connector = s.match(/\s+(and|or)\s+|&&|\|\||∧|∨/i);

  if (connector) {
    const both = /\band\b/i.test(s) || /&&|∧/.test(s);
    const either = /\bor\b/i.test(s) || /\|\||∨/.test(s);
    if (both && either) return { error: 'This mixes "and" with "or".', hint: 'Enter one compound inequality at a time: a < x < b, x < a and x > b, or x < a or x > b.' };
    const parts = s.split(/\s+(?:and|or)\s+|&&|\|\||∧|∨/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2 || parts.some((p) => (p.match(/<=|>=|<|>/g) || []).length !== 1)) {
      return { error: 'Each part of an "and"/"or" needs its own complete inequality.', hint: 'For example: x > 1 and x < 4, or x < 2 or x > 5.' };
    }
    return { mode: both ? 'and' : 'or', parts, chained: false, ops, display: s.replace(/<=/g, '≤').replace(/>=/g, '≥') };
  }

  if (ops.length < 2) return null;
  if (ops.length > 2) return { error: 'More than two comparisons in one chain.', hint: 'A chain has the form a < x < b.' };
  const sameWay = (/^[<]/.test(ops[0]) && /^[<]/.test(ops[1])) || (/^[>]/.test(ops[0]) && /^[>]/.test(ops[1]));
  if (!sameWay) return { error: 'The two comparisons point in different directions, so this is not a chain.', hint: 'A chain reads a < x < b (or a > x > b). For separate conditions, join them with "and" or "or".' };
  const first = s.indexOf(ops[0]);
  const second = s.indexOf(ops[1], first + ops[0].length);
  const a = s.slice(0, first).trim();
  const middle = s.slice(first + ops[0].length, second).trim();
  const c = s.slice(second + ops[1].length).trim();
  if (!a || !middle || !c) return { error: 'A chain needs an expression on each side of both comparisons.', hint: 'For example: -1 < 2x + 1 ≤ 5.' };
  return {
    mode: 'and',
    parts: [`${a} ${ops[0]} ${middle}`, `${middle} ${ops[1]} ${c}`],
    chained: true,
    ops: ops.map((o) => o.replace('<=', '≤').replace('>=', '≥')),
    display: s.replace(/<=/g, '≤').replace(/>=/g, '≥'),
  };
}

// One inequality. Returns the usual result object plus `pieces` (the solution
// set), `variable`, and `chart` (inputs for the graph) for the compound
// combiner; `strip` removes those before anything reaches the UI.
async function solveSingle(rawText) {
  try {
    const parsed = parseInequality(rawText);
    if (!parsed) {
      return refuse('This could not be read as a single inequality.', 'Try the form: x^2 - 4 > 0, or (x-1)/(x+2) <= 0.');
    }
    const { lhs, rhs, op } = parsed;

    const variable = extractVariable(`${lhs} ${rhs}`);
    const fExpr = `(${lhs}) - (${rhs})`;

    // Two variables (x + y > 2, x² + y² ≤ 25) describe a region of the
    // plane, not a set on the number line. The sign chart in x read y as a
    // symbol and answered "No solution" — confidently wrong (found in the
    // 1.49.0 routing sweep).
    const letters = new Set((fExpr.replace(/(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp|pi|e)(?![a-z])/gi, ' ').match(/(?<![a-z])[a-z](?![a-z])/gi) || []).map((c) => c.toLowerCase()));
    if (letters.size > 1) {
      return refuse(
        `This inequality has more than one variable (${[...letters].sort().join(', ')}). Its solutions are a region of the plane, not a set of numbers on a line, and graphing regions is not supported.`,
        'An inequality in one variable is solved with a sign chart: x^2 - 4 > 0, or 2x + 3 ≤ 7.',
        'unsupported',
      );
    }

    // A constant comparison (no variable) is simply true or false.
    if (!new RegExp(`\\b${variable}\\b`).test(fExpr)) {
      let holds;
      try {
        holds = compare(Number(math.evaluate(lhs)), Number(math.evaluate(rhs)), op);
      } catch {
        return refuse('This comparison could not be evaluated.', '');
      }
      return {
        steps: [
          `Evaluate the comparison ${mark(`${beautify(lhs)} ${op.replace('<=', '≤').replace('>=', '≥')} ${beautify(rhs)}`)}.`,
          holds ? 'The statement is true.' : 'The statement is false.',
        ],
        answer: holds ? 'True — the inequality always holds' : 'False — the inequality never holds',
        tips: ['A comparison with no variable is either always true or always false.'],
        common_mistakes: [],
        graph: null,
        pieces: holds ? [{ ...ALL_REALS }] : [],
        variable: null,
      };
    }

    const Algebrite = await loadAlgebrite();
    const simplified = safeRun(Algebrite, `simplify(${fExpr})`) || fExpr;

    // Identically zero: e.g. 2x < 2x. Then f = 0 everywhere.
    if (simplified.replace(/\s/g, '') === '0') {
      const all = op === '<=' || op === '>=';
      return { ...buildTrivial(all, variable, op), pieces: all ? [{ ...ALL_REALS }] : [], variable };
    }

    // Linear: solve it the way it is taught — collect terms, divide, and
    // reverse the sign when dividing by a negative. The sign chart is correct
    // for -2x > 4 but is eight steps of the wrong method for the problem
    // (September 2026 teaching-quality review).
    const linear = solveLinear({ Algebrite, lhs, rhs, op, variable, fExpr, simplified });
    if (linear) return linear;

    // sin(x) > 1/2: a periodic expression has infinitely many sign changes.
    // The sign chart below scans −50 ≤ x ≤ 50 for them and listed the
    // intervals inside that window as if they were the whole answer
    // (October 2026 release review). Solve on one period instead and say the
    // pattern repeats. A periodic expression with breaks (tan) is refused
    // rather than truncated.
    const period = structuralPeriod(fExpr, variable);
    if (period && period > 0) {
      if (!definedEverywhere(fExpr, variable)) {
        return refuse(`${shown(simplified)} is periodic and has breaks (it is undefined at some points of every period). Inequalities of that kind are not supported yet.`, 'A periodic inequality without breaks, such as sin(x) > 1/2 or 2cos(x) - 1 ≤ 0, is solved for every period.', 'unsupported');
      }
      const periodic = solvePeriodic({ Algebrite, lhs, rhs, op, variable, fExpr, simplified, period });
      if (periodic) return periodic;
      return refuse(`${shown(simplified)} is periodic, and its sign changes could not be pinned down on one period.`, 'Try a simpler form such as sin(x) > 1/2.', 'unsupported');
    }

    const numerator = safeRun(Algebrite, `numerator(${simplified})`) || simplified;
    const denominator = safeRun(Algebrite, `denominator(${simplified})`) || '1';

    const labels = new Map();
    const zeros = realRoots(Algebrite, numerator, variable, labels);
    const poles = realRoots(Algebrite, denominator, variable, labels);
    await labelTranscendentalZeros(numerator, variable, zeros, labels);
    const isPole = (x) => poles.some((p) => Math.abs(p - x) < 1e-9);

    // Critical points: numerator zeros (that aren't cancelled poles), poles,
    // and the edges of the domain. ln(x) < 1 was answered x < e: the sign
    // chart had one interval left of e, tested it at 1.718 and kept all of
    // it, x ≤ 0 included, where ln(x) is undefined. With 0 as a boundary,
    // (−∞, 0) tests undefined and drops out: 0 < x < e.
    const edges = domainEdges(Algebrite, fExpr, variable, labels).filter((e) => !zeros.some((z) => Math.abs(z - e) < 1e-9));
    const critical = uniqueSorted([...zeros.filter((z) => !isPole(z)), ...poles, ...edges]);

    const nonStrict = op === '<=' || op === '>=';
    const wantPositive = op === '>' || op === '>=';

    // Sign of f on each open interval between consecutive critical points.
    const evalF = (x) => {
      try {
        const y = math.evaluate(fExpr, { [variable]: x });
        return typeof y === 'number' ? y : NaN;
      } catch {
        return NaN;
      }
    };
    const testPoint = (lo, hi) => (!Number.isFinite(lo) && !Number.isFinite(hi) ? 0 : !Number.isFinite(lo) ? hi - 1 : !Number.isFinite(hi) ? lo + 1 : (lo + hi) / 2);
    const definedOn = (lo, hi) => Number.isFinite(evalF(testPoint(lo, hi)));
    const signOn = (lo, hi) => {
      let test;
      if (!Number.isFinite(lo) && !Number.isFinite(hi)) test = 0;
      else if (!Number.isFinite(lo)) test = hi - 1;
      else if (!Number.isFinite(hi)) test = lo + 1;
      else test = (lo + hi) / 2;
      const y = evalF(test);
      return Number.isFinite(y) ? Math.sign(y) : 0;
    };

    // Build satisfying pieces from the partition, then coalesce across included
    // critical points (a root is included only for a non-strict operator).
    const bounds = [-Infinity, ...critical, Infinity];
    const pieces = [];
    const chartRows = [];
    for (let i = 0; i < bounds.length - 1; i += 1) {
      const lo = bounds[i];
      const hi = bounds[i + 1];
      const s = signOn(lo, hi);
      const satisfies = wantPositive ? s > 0 : s < 0;
      chartRows.push({ lo, hi, sign: s, defined: s !== 0 || definedOn(lo, hi) });
      if (satisfies) pieces.push({ lo, hi, loC: false, hiC: false });
    }
    // Included isolated/boundary roots (f = 0 satisfies a non-strict operator).
    for (const z of zeros) {
      if (nonStrict && !isPole(z)) pieces.push({ lo: z, hi: z, loC: true, hiC: true });
    }

    const solution = coalesce(pieces);

    const answer = solution.length === 0
      ? 'No solution — no value satisfies the inequality'
      : isAllReals(solution)
        ? 'All real numbers satisfy the inequality'
        : withApproximations(solution.map((p) => pieceToInequality(p, variable, labels)).join('  or  '), solution, labels);

    const steps = buildSteps({
      lhs, rhs, op, variable, fExpr, simplified, critical, poles, zeros, chartRows, solution, nonStrict, labels, edges,
    });

    return {
      steps,
      answer,
      verified: true,
      verificationMethod: 'sign chart over the critical points',
      // Chosen from the problem: a denominator, an absolute value, or
      // neither ("numerator" in a tip for |2x − 1| < 5 was noise).
      tips: [
        ...(/(?<![a-z])abs\(/.test(lhs) && rhsIsPositiveNumber(rhs)
          ? [`For ${mark('|g| < c')} with ${mark('c > 0')}, the shortcut is ${mark('−c < g < c')}; ${mark('|g| > c')} means ${mark('g < −c')} or ${mark('g > c')}.`]
          : [`Move everything to one side so the inequality compares an expression with ${mark('0')}.`]),
        poles.length
          ? 'The sign can only change at a zero of the numerator or a zero of the denominator (where the expression breaks).'
          : 'The sign can only change where the expression is zero (or where it stops being defined).',
        'Test one point in each interval; the whole interval shares that sign.',
      ],
      common_mistakes: [
        'Multiplying both sides by a variable expression — its sign may flip the inequality.',
        poles.length
          ? 'Including a value where the expression is undefined (a denominator zero).'
          : `Treating an inequality like an equation and reporting only the boundary points, not the intervals between them.`,
        `Forgetting that ${mark('≤')} / ${mark('≥')} include the roots, while ${mark('<')} / ${mark('>')} exclude them.`,
      ],
      graph: buildGraph(fExpr, variable, critical, zeros, poles, solution),
      pieces: solution,
      labels,
      variable,
      chart: { fExpr, critical, zeros, poles },
    };
  } catch (error) {
    console.error('Inequality solver error:', error);
    return refuse('This inequality could not be solved here.', 'Try a form like x^2 - 4 > 0.', 'unsupported');
  }
}

// --- parsing -----------------------------------------------------------------

function parseInequality(raw) {
  let s = String(raw || '').replace(/−/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').trim();
  s = s.replace(/^\s*solve\s+/i, '').trim();

  // Reject compound inequalities (two operators) — out of scope for now.
  const opCount = (s.match(/<=|>=|<|>/g) || []).length;
  if (opCount !== 1) return null;

  for (const op of OPERATORS) {
    const idx = s.indexOf(op);
    if (idx !== -1) {
      const lhs = parseMathExpression(s.slice(0, idx));
      const rhs = parseMathExpression(s.slice(idx + op.length));
      if (!lhs || !rhs) return null;
      return { lhs, rhs, op };
    }
  }
  return null;
}
