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

import { math, beautify, formatNumber, sampleFunction, loadAlgebrite, isAlgebriteFailure } from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';

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
    if (!r.pieces) return strip(r); // a refusal from one part is the answer
    parts.push({ text, result: r });
  }
  const variables = [...new Set(parts.map((p) => p.result.variable).filter(Boolean))];
  if (variables.length > 1) {
    return refuse(`The parts use different variables (${variables.join(', ')}).`, 'A compound inequality must be about one variable.', 'unsupported');
  }
  const variable = variables[0] || 'x';
  const isAnd = compound.mode === 'and';
  const combined = isAnd
    ? parts.reduce((acc, p) => intersectPieces(acc, p.result.pieces), [{ ...ALL_REALS }])
    : parts.reduce((acc, p) => unionPieces(acc, p.result.pieces), []);

  const answer = combined.length === 0
    ? (isAnd ? 'No solution — no value satisfies both parts' : 'No solution — no value satisfies either part')
    : isAllReals(combined)
      ? 'All real numbers satisfy the inequality'
      : combined.map((p) => pieceToInequality(p, variable)).join('  or  ');

  const steps = [`Solve the compound inequality ${compound.display}.`];
  steps.push(compound.chained
    ? `A chain a ${compound.ops[0]} … ${compound.ops[1]} b means BOTH comparisons must hold at once: solve each, then keep the values common to both (the intersection).`
    : isAnd
      ? '"and" means both parts must hold: solve each, then take the intersection of the two solution sets.'
      : '"or" means either part may hold: solve each, then take the union of the two solution sets.');
  parts.forEach((p, i) => steps.push(`Part ${i + 1}: ${p.text}  →  ${p.result.answer}.`));
  if (combined.length === 0) steps.push(isAnd ? 'The two solution sets do not overlap, so there is no solution.' : 'Neither part has any solution.');
  else if (isAllReals(combined)) steps.push(isAnd ? 'Both parts hold everywhere.' : 'Between them the parts cover every real number.');
  else {
    steps.push(`${isAnd ? 'Intersection' : 'Union'}: ${combined.map((p) => pieceToInequality(p, variable)).join('  or  ')}.`);
    steps.push(`In interval notation: ${combined.map(pieceToInterval).join(' ∪ ')}.`);
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
      '"and" — or a chain a < x < b — keeps only the values that satisfy every part; "or" keeps the values that satisfy any part.',
      'Solve each part on its own first, then combine them on a number line.',
    ],
    common_mistakes: [
      'Working on only one side of a chain.',
      'Taking the union for "and", or the intersection for "or".',
      'Writing a chain whose inequalities point in different directions (a < x > b) — that is two separate statements, not a chain.',
    ],
    graph,
  };
}

const ALL_REALS = { lo: -Infinity, hi: Infinity, loC: false, hiC: false };

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

function intersectPieces(a, b) {
  const out = [];
  for (const p of a) {
    for (const q of b) {
      let lo; let loC;
      if (p.lo > q.lo) { lo = p.lo; loC = p.loC; } else if (q.lo > p.lo) { lo = q.lo; loC = q.loC; } else { lo = p.lo; loC = p.loC && q.loC; }
      let hi; let hiC;
      if (p.hi < q.hi) { hi = p.hi; hiC = p.hiC; } else if (q.hi < p.hi) { hi = q.hi; hiC = q.hiC; } else { hi = p.hi; hiC = p.hiC && q.hiC; }
      if (lo < hi - 1e-12 || (Number.isFinite(lo) && Math.abs(lo - hi) < 1e-12 && loC && hiC)) out.push({ lo, hi, loC, hiC });
    }
  }
  return coalesce(out);
}

function unionPieces(a, b) {
  const all = [...a, ...b].map((p) => ({ ...p })).sort((x, y) => x.lo - y.lo || x.hi - y.hi);
  const out = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (last && (p.lo < last.hi - 1e-12 || (Math.abs(p.lo - last.hi) < 1e-12 && (last.hiC || p.loC)))) {
      if (p.hi > last.hi + 1e-12) { last.hi = p.hi; last.hiC = p.hiC; } else if (Math.abs(p.hi - last.hi) < 1e-12) last.hiC = last.hiC || p.hiC;
      if (Math.abs(p.lo - last.lo) < 1e-12) last.loC = last.loC || p.loC;
    } else {
      out.push(p);
    }
  }
  return out;
}

// One inequality. Returns the usual result object plus `pieces` (the solution
// set), `variable`, and `chart` (inputs for the graph) for the compound
// combiner; `strip` removes those before anything reaches the UI.
async function solveSingle(rawText) {
  try {
    const parsed = parseInequality(rawText);
    if (!parsed) {
      return refuse('I could not read this as a single inequality.', 'Try the form: x^2 - 4 > 0, or (x-1)/(x+2) <= 0.');
    }
    const { lhs, rhs, op } = parsed;

    const variable = extractVariable(`${lhs} ${rhs}`);
    const fExpr = `(${lhs}) - (${rhs})`;

    // A constant comparison (no variable) is simply true or false.
    if (!new RegExp(`\\b${variable}\\b`).test(fExpr)) {
      let holds;
      try {
        holds = compare(Number(math.evaluate(lhs)), Number(math.evaluate(rhs)), op);
      } catch {
        return refuse('I could not evaluate this comparison.', '');
      }
      return {
        steps: [
          `Evaluate the comparison ${beautify(lhs)} ${op} ${beautify(rhs)}.`,
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

    const numerator = safeRun(Algebrite, `numerator(${simplified})`) || simplified;
    const denominator = safeRun(Algebrite, `denominator(${simplified})`) || '1';

    const zeros = realRoots(Algebrite, numerator, variable);
    const poles = realRoots(Algebrite, denominator, variable);
    const isPole = (x) => poles.some((p) => Math.abs(p - x) < 1e-9);

    // Critical points: numerator zeros (that aren't cancelled poles) and poles.
    const critical = uniqueSorted([...zeros.filter((z) => !isPole(z)), ...poles]);

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
      chartRows.push({ lo, hi, sign: s });
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
        : solution.map((p) => pieceToInequality(p, variable)).join('  or  ');

    const steps = buildSteps({
      lhs, rhs, op, variable, fExpr, simplified, critical, poles, zeros, chartRows, solution, nonStrict,
    });

    return {
      steps,
      answer,
      verified: true,
      verificationMethod: 'sign chart over the critical points',
      tips: [
        'Move everything to one side so the inequality compares an expression with 0.',
        'The sign can only change at a zero (numerator) or a break (denominator).',
        'Test one point in each interval; the whole interval shares that sign.',
      ],
      common_mistakes: [
        'Multiplying both sides by a variable expression — its sign may flip the inequality.',
        'Including a value where the expression is undefined (a denominator zero).',
        'Forgetting that ≤ / ≥ include the roots, while < / > exclude them.',
      ],
      graph: buildGraph(fExpr, variable, critical, zeros, poles, solution),
      pieces: solution,
      variable,
      chart: { fExpr, critical, zeros, poles },
    };
  } catch (error) {
    console.error('Inequality solver error:', error);
    return refuse('I was unable to solve this inequality.', 'Try a form like x^2 - 4 > 0.', 'unsupported');
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

// --- roots -------------------------------------------------------------------

// Real roots of a polynomial string, cleaned and de-duplicated. Non-polynomial
// or constant inputs (no roots) and complex roots are handled gracefully.
function realRoots(Algebrite, poly, variable) {
  if (!new RegExp(`\\b${variable}\\b`).test(String(poly))) return [];
  const raw = safeRun(Algebrite, `roots(${poly})`);
  if (isAlgebriteFailure(raw)) return numericRoots(poly, variable);

  const parts = String(raw).replace(/^\[|\]$/g, '').split(/,(?![^(]*\))/);
  const out = [];
  for (const part of parts) {
    const p = part.trim();
    if (!p || /\bi\b/.test(p)) continue; // skip complex roots
    try {
      const v = Number(math.evaluate(p));
      if (Number.isFinite(v)) out.push(clean(v));
    } catch {
      // ignore unparseable root
    }
  }
  return out;
}

// Fallback: scan for sign changes when Algebrite can't factor the polynomial.
function numericRoots(expr, variable) {
  const roots = [];
  let prev = null;
  for (let x = -50; x <= 50; x += 0.25) {
    let y;
    try {
      y = math.evaluate(expr, { [variable]: x });
    } catch {
      prev = null;
      continue;
    }
    if (typeof y !== 'number' || !Number.isFinite(y)) { prev = null; continue; }
    if (prev !== null && Math.sign(prev) !== Math.sign(y) && prev !== 0) {
      roots.push(clean(bisect(expr, variable, x - 0.25, x)));
    }
    prev = y;
  }
  return roots;
}

function bisect(expr, variable, a, b) {
  let lo = a;
  let hi = b;
  const f = (x) => Number(math.evaluate(expr, { [variable]: x }));
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(lo)) === Math.sign(f(mid))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- interval algebra --------------------------------------------------------

function uniqueSorted(arr) {
  const out = [];
  for (const v of arr.slice().sort((a, b) => a - b)) {
    if (!out.some((u) => Math.abs(u - v) < 1e-9)) out.push(v);
  }
  return out;
}

// Merge pieces of a partition that touch at a shared, included endpoint.
function coalesce(pieces) {
  const sorted = pieces.slice().sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const out = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.hi - p.lo) < 1e-9 && (last.hiC || p.loC)) {
      last.hi = p.hi;
      last.hiC = p.hiC;
    } else if (last && p.lo < last.hi - 1e-9) {
      // overlap (shouldn't happen from a partition, but be safe)
      if (p.hi > last.hi) { last.hi = p.hi; last.hiC = p.hiC; }
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

function isAllReals(sol) {
  return sol.length === 1 && !Number.isFinite(sol[0].lo) && !Number.isFinite(sol[0].hi);
}

function pieceToInequality(p, v) {
  const lo = formatNumber(p.lo);
  const hi = formatNumber(p.hi);
  if (Math.abs(p.lo - p.hi) < 1e-12 && p.loC && p.hiC) return `${v} = ${lo}`;
  if (!Number.isFinite(p.lo)) return `${v} ${p.hiC ? '≤' : '<'} ${hi}`;
  if (!Number.isFinite(p.hi)) return `${v} ${p.loC ? '≥' : '>'} ${lo}`;
  return `${lo} ${p.loC ? '≤' : '<'} ${v} ${p.hiC ? '≤' : '<'} ${hi}`;
}

function pieceToInterval(p) {
  const left = !Number.isFinite(p.lo) ? '(-∞' : `${p.loC ? '[' : '('}${formatNumber(p.lo)}`;
  const right = !Number.isFinite(p.hi) ? '∞)' : `${formatNumber(p.hi)}${p.hiC ? ']' : ')'}`;
  return `${left}, ${right}`;
}

function compare(a, b, op) {
  if (op === '<') return a < b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  return a >= b;
}

// --- display -----------------------------------------------------------------

function buildSteps({ lhs, rhs, op, variable, fExpr, simplified, critical, poles, zeros, chartRows, solution, nonStrict }) {
  const steps = [`Solve the inequality ${beautify(lhs)} ${op} ${beautify(rhs)}.`];

  if (beautify(rhs) !== '0') {
    steps.push(`Move everything to one side: ${beautify(simplified)} ${op} 0.`);
  }

  if (critical.length > 0) {
    const zeroList = zeros.filter((z) => !poles.some((p) => Math.abs(p - z) < 1e-9));
    if (zeroList.length) {
      steps.push(`Find where the expression is zero: ${variable} = ${zeroList.map((z) => formatNumber(z)).join(', ')}.`);
    }
    if (poles.length) {
      steps.push(`Note where it is undefined (denominator zero): ${variable} = ${poles.map((p) => formatNumber(p)).join(', ')}.`);
    }
    steps.push(`These split the number line into intervals. Test the sign of ${beautify(simplified)} in each:`);
    for (const row of chartRows) {
      const label = intervalLabel(row.lo, row.hi);
      const word = row.sign > 0 ? 'positive' : row.sign < 0 ? 'negative' : 'zero';
      steps.push(`  • On ${label}: ${beautify(simplified)} is ${word}.`);
    }
  } else {
    steps.push(`The expression never changes sign, so check any single value of ${variable}.`);
  }

  if (solution.length === 0) {
    steps.push('No interval satisfies the inequality, so there is no solution.');
  } else if (isAllReals(solution)) {
    steps.push('Every interval satisfies the inequality, so all real numbers work.');
  } else {
    const kind = nonStrict ? 'including the boundary roots (≤/≥)' : 'excluding the boundary roots (</>) ';
    steps.push(`Collect the satisfying intervals, ${kind}: ${solution.map((p) => pieceToInequality(p, variable)).join('  or  ')}.`);
    steps.push(`In interval notation: ${solution.map(pieceToInterval).join(' ∪ ')}.`);
  }

  return steps;
}

function intervalLabel(lo, hi) {
  const l = !Number.isFinite(lo) ? '(-∞' : `(${formatNumber(lo)}`;
  const r = !Number.isFinite(hi) ? '∞)' : `${formatNumber(hi)})`;
  return `${l}, ${r}`;
}

function buildTrivial(all, variable, op) {
  return {
    steps: [
      `Simplify the inequality — both sides are equal, so it reads 0 ${op} 0.`,
      all ? 'Since equality is allowed, every value works.' : 'Since it is strict, no value works.',
    ],
    answer: all ? 'All real numbers satisfy the inequality' : 'No solution — no value satisfies the inequality',
    tips: ['When both sides are identical, a ≤/≥ inequality holds everywhere and a </> holds nowhere.'],
    common_mistakes: [],
    graph: null,
  };
}

// --- graph -------------------------------------------------------------------

// Plot f(x), mark its zeros (intercepts) and breaks (vertical asymptotes), and
// shade the x-ranges where the inequality holds.
function buildGraph(fExpr, variable, critical, zeros, poles, solution) {
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

// --- misc --------------------------------------------------------------------

function safeRun(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

function clean(n) {
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-7) return r;
  return Math.round(n * 1e6) / 1e6;
}

// kind 'parse' = the text couldn't be read as an inequality; 'unsupported' =
// a readable inequality this solver can't handle.
function refuse(reason, hint, kind = 'parse') {
  const fields = {
    steps: ['Read the input as an inequality.', reason, hint].filter(Boolean),
    answer: reason,
    tips: ['An inequality uses <, >, ≤, or ≥, e.g. x^2 - 4 > 0.'],
    common_mistakes: ['A chain must point one way (a < x < b, not a < x > b); separate conditions are joined with "and" or "or".'],
  };
  return kind === 'parse' ? parseError(fields) : unsupported(fields);
}
