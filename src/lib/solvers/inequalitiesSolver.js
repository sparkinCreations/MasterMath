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
  formatNumber,
  mark,
  piForm,
} from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';
import {
  safeRun,
  inAppNotation,
  shown,
  bars,
  labelTranscendentalZeros,
  uniqueSorted,
  labelKey,
  exactDecimals,
} from './inequalities/roots.js';
import { provedZeros, domainEdges, denominatorZeros, exactValueAt, infiniteSignChanges } from './inequalities/zeros.js';
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
  endpoint,
  intervalLabel,
  distinctDigits,
} from './inequalities/intervals.js';
import { refuse, buildGraph, buildTrivial, buildSteps, movedText } from './inequalities/presentation.js';
import { inequalityGuidance } from './inequalities/guidance.js';
import { solveLinear } from './inequalities/linear.js';
import { solvePeriodic } from './inequalities/periodic.js';
import { readTanBranches } from './trigonometry/tanBranches.js';

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

  const combinedText = combined.length === 0 ? answer : isAllReals(combined) ? answer : combined.map((p) => pieceToInequality(p, variable, labels)).join('  or  ');
  return strip({
    steps,
    answer,
    verified: true,
    verificationMethod: 'each part by sign chart, then set intersection/union',
    guide: {
      method: 'compound',
      mode: compound.mode,
      parts: parts.map((p) => ({ answer: String(p.result.answer).replace(/\s+\([^()]*≈[^()]*\)$/, ''), math: !/^(?:No |All |True|False)/.test(String(p.result.answer)) })),
      answer: combinedText,
      combinedMath: combined.length > 0 && !isAllReals(combined),
    },
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
  });
}

// The internal fields go; the guide becomes the ranked tips and mistakes
// (inequalities/guidance.js).
function strip(result) {
  if (!result || typeof result !== 'object') return result;
  const { pieces, variable, chart, labels, guide, periodic, ...rest } = result;
  const guided = inequalityGuidance(guide);
  return guided ? { ...rest, ...guided } : rest;
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
    const simplified = safeRun(Algebrite, `simplify(${exactDecimals(fExpr)})`) || fExpr;

    // x/x and (x² − 1)/(x − 1) simplify past a point where the typed
    // expression is undefined; such an inequality goes to the sign chart,
    // which keeps that point out (the linear shortcut answered x > −1 for
    // (x² − 1)/(x − 1) > 0, x = 1 included).
    const holes = await denominatorZeros(Algebrite, fExpr, variable);
    const hasHoles = !holes || holes.length > 0;

    // Identically zero: e.g. 2x < 2x. Then f = 0 everywhere.
    if (simplified.replace(/\s/g, '') === '0' && !hasHoles) {
      const all = op === '<=' || op === '>=';
      return { ...buildTrivial(all, variable, op), pieces: all ? [{ ...ALL_REALS }] : [], variable };
    }

    // Linear: solve it the way it is taught — collect terms, divide, and
    // reverse the sign when dividing by a negative. The sign chart is correct
    // for -2x > 4 but is eight steps of the wrong method for the problem
    // (September 2026 teaching-quality review).
    const linear = hasHoles ? null : solveLinear({ Algebrite, lhs, rhs, op, variable, fExpr, simplified });
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
        return refuse(`${movedText(lhs, rhs, simplified)} is periodic and has breaks (it is undefined at some points of every period). Inequalities of that kind are not supported yet.`, 'A periodic inequality without breaks, such as sin(x) > 1/2 or 2cos(x) - 1 ≤ 0, is solved for every period.', 'unsupported');
      }
      const periodic = solvePeriodic({ Algebrite, lhs, rhs, op, variable, fExpr, simplified, period });
      if (periodic) return periodic;
      return refuse(`${movedText(lhs, rhs, simplified)} is periodic, and its sign changes could not be pinned down on one period.`, 'Try a simpler form such as sin(x) > 1/2.', 'unsupported');
    }

    const numerator = safeRun(Algebrite, `numerator(${simplified})`) || simplified;
    const denominator = safeRun(Algebrite, `denominator(${simplified})`) || '1';

    const labels = new Map();
    // Every boundary point is proved: the exact root finder for a
    // polynomial, the monotone-pieces argument otherwise (zeros.js). A
    // scan over −50 ≤ x ≤ 50 used to stand in for both, and missed roots.
    const zeros = await provedZeros(Algebrite, numerator, variable, { labels, lhs, rhs });
    const cancelled = holes;
    const reduced = await provedZeros(Algebrite, denominator, variable, { labels });
    const edgesFound = await domainEdges(Algebrite, fExpr, variable, labels);
    if (!zeros || !cancelled || !reduced || !edgesFound) {
      // tan(x) > x: a zero between every two poles, and a sign change at
      // every pole too, so no list of endpoints exists.
      const branches = !zeros && readTanBranches(fExpr, variable);
      if (branches && ['tan', 'cot'].includes(branches.fn)) {
        const fn = `${branches.fn}(${beautify(branches.arg)})`;
        return refuse(
          `${mark(movedText(lhs, rhs, simplified))} is zero at least once between each pair of consecutive poles of ${mark(fn)}, where ${mark(fn)} runs through every real value, so its sign changes infinitely often and the solution set is infinitely many intervals. Inequalities of that kind are not supported.`,
          `The equation ${mark(`${beautify(lhs)} = ${beautify(rhs)}`)} is solved: it lists the solutions nearest ${mark('0')}.`,
          'unsupported',
        );
      }
      // e^x > cos(x): no list of zeros exists to prove complete. Say so.
      const endless = !zeros && [simplified, numerator].map((e) => infiniteSignChanges(inAppNotation(e), variable)).find(Boolean);
      if (endless) {
        const end = endless.dir < 0 ? '−∞' : '∞';
        const every = piForm(endless.period) ?? formatNumber(endless.period);
        return refuse(
          `${mark(movedText(lhs, rhs, simplified))} changes sign infinitely often: as ${mark(`${variable} → ${end}`)}, ${mark(beautify(endless.settling))} approaches ${mark(formatNumber(endless.limit))} while ${mark(beautify(endless.periodic))} repeats every ${mark(every)}, so the solution set is infinitely many intervals whose ends have no pattern to state. Inequalities of that kind are not supported.`,
          `A periodic inequality such as ${mark('cos(x) > 1/2')} is solved for every period, and one where a term outgrows the wave, such as ${mark('x^2 > 2sin(x) + 1')}, exactly.`,
          'unsupported',
        );
      }
      return refuse(
        `The points where ${movedText(lhs, rhs, simplified)} is zero or undefined could only be located numerically here, not proved to be all of them, so no solution set is stated.`,
        `Polynomial, rational, exponential and logarithmic inequalities are solved exactly, e.g. ${mark('x^3 - 2 > 0')}, ${mark('(x-1)/(x+2) ≤ 0')}, ${mark('e^x > 2')}.`,
        'unsupported',
      );
    }
    // (x² − 1)/(x − 1) simplifies to x + 1, but x = 1 is still not allowed:
    // the poles of the typed expression, not only of the simplified one.
    const poles = uniqueSorted([...reduced, ...cancelled]);
    await labelTranscendentalZeros(numerator, variable, zeros, labels);
    const isPole = (x) => poles.some((p) => Math.abs(p - x) < 1e-9);

    // Critical points: numerator zeros (that aren't cancelled poles), poles,
    // and the edges of the domain. ln(x) < 1 was answered x < e: the sign
    // chart had one interval left of e, tested it at 1.718 and kept all of
    // it, x ≤ 0 included, where ln(x) is undefined. With 0 as a boundary,
    // (−∞, 0) tests undefined and drops out: 0 < x < e.
    const edges = edgesFound.filter((e) => !zeros.some((z) => Math.abs(z - e) < 1e-9));
    const critical = uniqueSorted([...zeros.filter((z) => !isPole(z)), ...poles, ...edges]);

    const nonStrict = op === '<=' || op === '>=';
    const wantPositive = op === '>' || op === '>=';
    const identicallyZero = simplified.replace(/\s/g, '') === '0';

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
      // x/x − 1 is 0 wherever it is defined: every such interval satisfies
      // ≤ and ≥, none satisfies < and >.
      // An interval on which f is 0 at the test point is one on which it is
      // 0 throughout (every isolated zero is a boundary): |x| − x on x > 0.
      const satisfies = identicallyZero || (s === 0 && definedOn(lo, hi)) ? nonStrict && definedOn(lo, hi) : wantPositive ? s > 0 : s < 0;
      chartRows.push({ lo, hi, sign: s, defined: s !== 0 || definedOn(lo, hi) });
      if (satisfies) pieces.push({ lo, hi, loC: false, hiC: false });
    }
    // A boundary point is in the solution when the inequality holds there,
    // decided at the point itself: a zero for ≤ and ≥ only; the edge of a
    // square root's domain when its value there satisfies it (√x > −1 holds
    // at 0, √x ≥ 0 too); never a pole or a logarithm's edge, where the
    // expression is undefined. Edges were always left out, and √(x − 1) ≤ 0
    // was answered "No solution" instead of x = 1.
    for (const c of critical) {
      if (isPole(c)) continue;
      const isZero = zeros.some((z) => Math.abs(z - c) < 1e-9);
      const y = isZero ? 0 : valueAtEdge(Algebrite, fExpr, variable, c, labels);
      if (y === null) continue;
      if (y === 0 ? nonStrict : (wantPositive ? y > 0 : y < 0)) pieces.push({ lo: c, hi: c, loC: true, hiC: true });
    }

    const solution = coalesce(pieces);

    // A zero located numerically is named, α, β, …, in the answer and in
    // every solution set the working writes, its decimal said once: "0 < x <
    // α  or  x > β, where α ≈ 0.1586 and β ≈ 3.1462 are zeros of
    // x − ln(x) − 2". A rounded decimal written as the boundary read as if it
    // were exact (the outside reviews, Rounds 34 and 35).
    const isNumeric = (x) => Number.isFinite(x) && !Number.isInteger(x) && !labels.has(labelKey(x));
    const numericPoints = uniqueSorted(critical.filter((c) => !isPole(c) && isNumeric(c)));
    const named = nameEndpoints(numericPoints, labels);
    const inAnswer = numericPoints.filter((x) => solution.some((p) => Math.abs(p.lo - x) < 1e-12 || Math.abs(p.hi - x) < 1e-12));
    const whereText = named.where && inAnswer.length
      ? `, where ${inAnswer.map((x) => named.decimals.get(labelKey(x))).join(inAnswer.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')} ${inAnswer.length > 1 ? 'are zeros' : 'is a zero'} of ${movedText(lhs, rhs, simplified)}`
      : '';
    const answer = solution.length === 0
      ? 'No solution — no value satisfies the inequality'
      : isAllReals(solution)
        ? 'All real numbers satisfy the inequality'
        : `${withApproximations(solution.map((p) => pieceToInequality(p, variable, named.labels)).join('  or  '), solution, labels)}${whereText}`;

    // How the zeros were proved, said in the working: a polynomial's come
    // from the exact root finder; the others from the turning points, or by
    // convexity for a wave against a line (zeros.js).
    const proof = zeros.proof;
    const numericZeros = zeros.filter((z) => !isPole(z) && !Number.isInteger(z) && !labels.has(labelKey(z)));
    const at = (x) => endpoint(x, labels);
    // x = 1, or x ≈ 59.9146 for a turning point located numerically.
    const turnsAt = (xs) => xs.map((x) => (labels.has(labelKey(x)) || Number.isInteger(x) ? `${variable} = ${at(x)}` : `${variable} ≈ ${formatNumber(x)}`)).join(', ');
    let zeroProof = null;
    if (proof?.kind === 'wave') {
      const b = (x) => (Number.isInteger(x) ? String(x) : formatNumber(x));
      zeroProof = `These are all of its zeros: ${mark(`|${proof.fn}(${proof.arg})| ≤ 1`)} confines them to ${mark(`${b(proof.lo)} ≤ ${variable} ≤ ${b(proof.hi)}`)}, and between consecutive zeros of ${mark(`${proof.fn}(${proof.arg})`)} the expression is concave or convex, so it has at most two zeros there: counted piece by piece, there are exactly ${proof.count}.`;
    } else if (proof?.kind === 'radical') {
      zeroProof = `These are all of its zeros: written as ${mark('P + Q·√u')}, a zero has ${mark('P² = Q²·u')}, the polynomial ${mark(`${shown(proof.squared)} = 0`)}, whose real roots come from the exact root finder; each is kept only where it satisfies the original, since squaring can add roots.`;
    } else if (proof?.kind === 'exp' && proof.t) {
      zeroProof = `These are all of its zeros: with ${mark(`t = ${proof.t}`)}, which is always positive, ${proof.whole ? `it is the polynomial ${mark(shown(proof.polynomial))}` : `its numerator is the polynomial ${mark(shown(proof.polynomial))}`}, whose real roots come from the exact root finder, and each positive root gives one ${mark(variable)}.`;
    } else if (proof?.kind === 'monotone' && numericZeros.length) {
      zeroProof = proof.turns.length
        ? `These are all of its zeros: its derivative is ${mark('0')} only at ${mark(turnsAt(proof.turns))}, so between those points it is strictly increasing or decreasing and crosses ${mark('0')} at most once on each stretch; the signs at the ends of each stretch say whether it does.`
        : `These are all of its zeros: its derivative is never ${mark('0')}, so it is strictly increasing or decreasing on each interval of its domain and crosses ${mark('0')} at most once there.`;
    }

    const steps = buildSteps({
      lhs, rhs, op, variable, fExpr, simplified, critical, poles, zeros, chartRows, solution, nonStrict, labels: named.labels, edges, zeroProof, approximations: named.decimals,
    });

    const zeroList = zeros.filter((z) => !isPole(z));
    const signWord = (r) => (r.sign > 0 ? 'positive' : r.sign < 0 ? 'negative' : r.defined === false ? 'undefined' : 'zero');
    // A zero with the same sign on both sides: of even multiplicity.
    const even = zeroList.filter((z) => {
      const i = chartRows.findIndex((r) => Math.abs(r.hi - z) < 1e-9);
      return i >= 0 && chartRows[i + 1] && chartRows[i].sign !== 0 && chartRows[i].sign === chartRows[i + 1].sign;
    });
    const absShortcut = absForm(lhs, rhs, op);
    const holeList = cancelled.filter((h) => !reduced.some((p) => Math.abs(p - h) < 1e-9));
    const kind = holeList.length ? 'holes'
      : absShortcut ? 'abs'
        : /(?<![a-z])abs\(/.test(`${lhs} ${rhs}`) ? 'absChart'
          : proof?.kind === 'wave' ? 'wave'
            : proof?.kind === 'exp' && proof.t ? 'exponential'
            : proof?.kind === 'monotone' && numericZeros.length ? 'transcendental'
              : edges.length || edgesFound.length ? 'domain'
                : poles.length ? 'rational' : 'polynomial';
    const guide = {
      method: 'chart',
      kind,
      variable,
      op,
      nonStrict,
      moved: movedText(lhs, rhs, simplified),
      zeros: zeroList.map((z) => named.decimals.get(labelKey(z)) ?? at(z)),
      poles: poles.map(at),
      holes: holeList.map(at),
      edges: edgesFound.map(at),
      even: even.map(at),
      rows: chartRows.map((r) => ({ interval: intervalLabel(r.lo, r.hi, named.labels), sign: signWord(r) })),
      answer: solution.length === 0 ? 'no solution' : isAllReals(solution) ? 'every real number' : solution.map((p) => pieceToInequality(p, variable, named.labels)).join('  or  '),
      answerIsMath: solution.length > 0 && !isAllReals(solution),
      abs: absShortcut,
      substitution: proof?.kind === 'exp' && proof.t ? { t: proof.t, polynomial: shown(proof.polynomial), whole: proof.whole, roots: proof.tRoots.filter(Boolean) } : null,
      domainText: domainConditions(fExpr, variable),
      proof: kind === 'transcendental'
        ? (proof.turns.length ? `turns only at ${mark(turnsAt(proof.turns))}, and is strictly increasing or decreasing between, so each stretch holds at most one zero, decided by the signs at its ends` : 'has a derivative that is never 0, so it crosses 0 at most once on each interval of its domain')
        : kind === 'wave' ? `${mark(`|${proof.fn}(${proof.arg})| ≤ 1`)} keeps every zero in ${mark(`${formatNumber(proof.lo)} ≤ ${variable} ≤ ${formatNumber(proof.hi)}`)}, and counting by convexity there gives exactly ${proof.count}` : null,
    };
    // x = 0, x ≈ 0.8767: ≈ only on the zeros located numerically.
    if (kind === 'transcendental' || kind === 'wave') guide.zerosText = zeroList.map((z) => (named.decimals.has(labelKey(z)) ? `${variable} = ${named.decimals.get(labelKey(z))}` : turnsAt([z]))).join(', ');

    return {
      steps,
      answer,
      verified: true,
      verificationMethod: 'sign chart over the critical points',
      guide,
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

// Names for endpoints located numerically: α, β, … in order, with their
// decimals ("α ≈ 0.1586 and β ≈ 3.1462"), digits enough to tell them apart.
const NAMES = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'κ'];
export function nameEndpoints(values, labels) {
  const out = new Map(labels);
  const decimals = new Map();
  if (!values.length || values.length > NAMES.length) return { labels: out, decimals, where: '' };
  const digits = distinctDigits(values);
  const parts = values.map((x, i) => {
    out.set(labelKey(x), NAMES[i]);
    const text = `${NAMES[i]} ≈ ${digits === null ? formatNumber(x) : x.toFixed(digits)}`;
    decimals.set(labelKey(x), text);
    return text;
  });
  return { labels: out, decimals, where: parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] };
}

// |g| < c with a positive number c: { text, unfolded } for the shortcut, or
// null.
function absForm(lhs, rhs, op) {
  const m = String(lhs).replace(/\s+/g, '').match(/^abs\((.*)\)$/);
  if (!m || !rhsIsPositiveNumber(rhs) || !balanced(m[1])) return null;
  const g = bars(beautify(m[1]));
  const c = beautify(rhs);
  const o = pretty(op);
  const text = `|${g}| ${o} ${c}`;
  if (op === '<' || op === '<=') return { text, unfolded: `−${c} ${o} ${g} ${o} ${c}` };
  return { text, unfolded: `${g} ${op === '>' ? '<' : '≤'} −${c}  or  ${g} ${o} ${c}` };
}
const balanced = (t) => {
  let depth = 0;
  for (const ch of t) {
    if (ch === '(') depth += 1;
    if (ch === ')') { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0;
};
const pretty = (op) => ({ '<=': '≤', '>=': '≥' }[op] || op);

// "x > 0", "x - 1 ≥ 0": where each logarithm and square root is defined.
function domainConditions(fExpr, variable) {
  const out = [];
  try {
    math.parse(fExpr).traverse((node) => {
      if (!node.isFunctionNode || !node.args[0] || !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(node.args[0].toString())) return;
      const arg = shown(node.args[0].toString());
      if (['log', 'ln', 'log10', 'log2'].includes(node.fn?.name)) out.push(`${arg} > 0`);
      if (node.fn?.name === 'sqrt') out.push(`${arg} ≥ 0`);
    });
  } catch { /* none */ }
  return [...new Set(out)].join(' and ');
}

// The expression's value at an edge of its domain: exact by substitution
// when the edge has an exact form (√2, 3/2), else numeric; null where it is
// undefined (ln(x) at 0).
function valueAtEdge(Algebrite, fExpr, variable, x, labels) {
  const exact = exactValueAt(Algebrite, fExpr, variable, x, labels);
  if (exact !== null) return exact;
  try {
    const y = math.evaluate(fExpr, { [variable]: x });
    if (typeof y !== 'number' || !Number.isFinite(y)) return null;
    return Math.abs(y) < 1e-12 ? 0 : y;
  } catch {
    return null;
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
