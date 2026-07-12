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

import { math, beautify, formatNumber, sampleFunction, loadAlgebrite } from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';

const OPERATORS = ['<=', '>=', '<', '>'];

export async function solveInequality(rawText) {
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
      };
    }

    const Algebrite = await loadAlgebrite();
    const simplified = safeRun(Algebrite, `simplify(${fExpr})`) || fExpr;

    // Identically zero: e.g. 2x < 2x. Then f = 0 everywhere.
    if (simplified.replace(/\s/g, '') === '0') {
      const all = op === '<=' || op === '>=';
      return buildTrivial(all, variable, op);
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
    };
  } catch (error) {
    console.error('Inequality solver error:', error);
    return refuse('I was unable to solve this inequality.', 'Try a form like x^2 - 4 > 0.');
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
  if (!raw || /stop|error|nil/i.test(raw)) return numericRoots(poly, variable);

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
    return /stop|error/i.test(out) ? null : out;
  } catch {
    return null;
  }
}

function clean(n) {
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-7) return r;
  return Math.round(n * 1e6) / 1e6;
}

function refuse(reason, hint) {
  return {
    steps: ['Read the input as an inequality.', reason, hint].filter(Boolean),
    answer: 'Unable to solve this inequality',
    tips: ['An inequality uses <, >, ≤, or ≥, e.g. x^2 - 4 > 0.'],
    common_mistakes: ['Compound inequalities (a < x < b) are not supported yet — split them into two.'],
    graph: null,
  };
}
