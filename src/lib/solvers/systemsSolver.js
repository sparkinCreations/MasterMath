// Systems of two linear equations in two unknowns.
//
// Built July 2026 (roadmap item 9) to replace the refuse-clearly guard with a
// real capability. Receives the RAW problem text (see api.js) because the
// single-expression extractor mangles the first equation of a system.
//
// The approach: split into two equations, extract each one's coefficients by
// sampling (which also proves linearity), then solve by Cramer's rule in exact
// rational arithmetic (mathjs fractions → 18/5, not 3.6). The worked steps show
// substitution; the final answer is confirmed by substituting back into BOTH
// original equations before it is reported — the same "verify before you
// claim" gate the rest of the solver uses.

import { math, sampleFunction } from './solverUtils.js';
import { parseMathExpression } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';

const FUNCTION_NAMES = /\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|asin|acos|atan|sqrt|log|ln|exp|abs|pi)\b/gi;

export async function solveSystem(rawText) {
  try {
    const equations = splitEquations(rawText);
    if (equations.length !== 2) {
      return refuse(
        `I found ${equations.length} equation${equations.length === 1 ? '' : 's'} here.`,
        'MasterMath solves systems of exactly two linear equations in two unknowns (e.g. 2x + 3y = 6; x − y = 4).',
        'unsupported',
      );
    }

    const variables = collectVariables(equations.join(' '));
    if (variables.length !== 2) {
      return refuse(
        `This system has ${variables.length} variable${variables.length === 1 ? '' : 's'} (${variables.join(', ') || 'none'}).`,
        'I currently solve 2×2 systems — two equations in exactly two variables.',
        'unsupported',
      );
    }

    const [v1, v2] = variables;

    // Extract coefficients a·v1 + b·v2 = c for each equation. A null means the
    // equation isn't linear in these two variables — refuse rather than guess.
    const rows = [];
    for (const eq of equations) {
      const row = linearCoefficients(eq, v1, v2);
      if (!row) {
        return refuse(
          'At least one equation is not linear in the two variables.',
          'I handle linear systems (each variable to the first power, no products like x·y).',
          'unsupported',
        );
      }
      rows.push(row);
    }

    const [r1, r2] = rows;
    const F = (n) => math.fraction(n);
    const a1 = F(r1.a); const b1 = F(r1.b); const c1 = F(r1.c);
    const a2 = F(r2.a); const b2 = F(r2.b); const c2 = F(r2.c);

    // Cramer's rule in exact rational arithmetic.
    const D = sub(mul(a1, b2), mul(a2, b1));
    const eq1Disp = formatLinearEq(a1, b1, c1, v1, v2);
    const eq2Disp = formatLinearEq(a2, b2, c2, v1, v2);

    if (isZero(D)) {
      // Dependent (same line) vs inconsistent (parallel). The system is
      // dependent iff both Cramer numerators also vanish.
      const Dx = sub(mul(c1, b2), mul(c2, b1));
      const Dy = sub(mul(a1, c2), mul(a2, c1));
      const dependent = isZero(Dx) && isZero(Dy);

      if (dependent) {
        return {
          steps: [
            `Write the system: ${eq1Disp};  ${eq2Disp}.`,
            'The two equations are proportional — one is a multiple of the other, so they describe the same line.',
            'Every point on that line satisfies both equations.',
          ],
          answer: 'Infinitely many solutions — the two equations describe the same line',
          tips: [
            'When one equation is a constant multiple of the other, the system is dependent.',
            'A dependent system has infinitely many solutions: the whole line.',
          ],
          common_mistakes: [
            'Reading “0 = 0” after elimination as “no solution” — it actually means infinitely many.',
          ],
          graph: buildGraph([r1], v1, v2, null, 'The two equations graph as the same line.'),
        };
      }

      return {
        steps: [
          `Write the system: ${eq1Disp};  ${eq2Disp}.`,
          'Eliminating a variable makes both variables cancel but leaves a false statement (a nonzero number = 0).',
          'The two lines have the same slope but different intercepts — they are parallel and never meet.',
        ],
        answer: 'No solution — the two lines are parallel',
        tips: [
          'Equal coefficients ratios but a different constant ratio means the lines are parallel.',
          'A system with no solution is called inconsistent.',
        ],
        common_mistakes: [
          'Concluding a unique solution without checking whether the lines are parallel.',
        ],
        graph: buildGraph([r1, r2], v1, v2, null, 'The two lines are parallel — no intersection.'),
      };
    }

    // Unique solution.
    const x = div(sub(mul(c1, b2), mul(c2, b1)), D);
    const y = div(sub(mul(a1, c2), mul(a2, c1)), D);

    // Verify by substituting back into BOTH original equations.
    const ok1 = residualIsZero(r1, v1, v2, num(x), num(y));
    const ok2 = residualIsZero(r2, v1, v2, num(x), num(y));
    if (!ok1 || !ok2) {
      return refuse('I could not verify a consistent solution for this system.', 'Please double-check the equations.', 'unsupported');
    }

    const steps = buildSubstitutionSteps({ a1, b1, c1, a2, b2, c2, x, y, v1, v2, eq1Disp, eq2Disp });

    return {
      steps,
      answer: `${v1} = ${fmtFrac(x)},  ${v2} = ${fmtFrac(y)}`,
      verified: true,
      verificationMethod: 'substituted back into both equations',
      tips: [
        'Two independent linear equations in two unknowns meet at exactly one point.',
        'Substitution and elimination give the same answer — use whichever is cleaner.',
        'Always check your solution by plugging it into both original equations.',
      ],
      common_mistakes: [
        'A sign slip when moving terms across the equals sign.',
        'Solving for one variable and forgetting to back-substitute for the other.',
        'Dividing by a coefficient of zero — pick a different variable to isolate first.',
      ],
      graph: buildGraph([r1, r2], v1, v2, { x: num(x), y: num(y) },
        `The lines cross at (${fmtFrac(x)}, ${fmtFrac(y)}) — the unique solution.`),
    };
  } catch (error) {
    console.error('Systems solver error:', error);
    return refuse('I was unable to read this as a 2×2 linear system.', 'Try the form: 2x + 3y = 6; x − y = 4.');
  }
}

// --- parsing -----------------------------------------------------------------

// Split raw text into individual equation strings. Handles ';', newlines, the
// word "and", and a comma between two equations. Leading verbs ("solve the
// system") are stripped.
function splitEquations(rawText) {
  let s = String(rawText || '')
    .replace(/−/g, '-')
    .replace(/^\s*solve\s+(?:the\s+)?(?:system\s+(?:of\s+equations\s+)?)?/i, '')
    .trim();

  let parts = s.split(/\s*;\s*|\s*\n\s*|\s+and\s+/i).filter((p) => p.trim());
  // If that left a single chunk that still holds two equations, split on comma.
  if (parts.length === 1 && (s.match(/=/g) || []).length >= 2) {
    parts = s.split(/\s*,\s*/).filter((p) => p.trim());
  }
  return parts
    .map((p) => p.replace(/^\s*(?:where|with)\s+/i, '').trim())
    .filter((p) => p.includes('='));
}

// Distinct single-letter variables in appearance order, excluding function
// names and the constants e / pi.
function collectVariables(text) {
  const cleaned = String(text).replace(FUNCTION_NAMES, ' ').replace(/\be\b/gi, ' ');
  const found = [];
  for (const m of cleaned.matchAll(/[a-z]/gi)) {
    const v = m[0].toLowerCase();
    if (!found.includes(v)) found.push(v);
  }
  return found;
}

// Extract { a, b, c } for the linear equation `a·v1 + b·v2 = c`, or null when
// the equation is not linear in (v1, v2). Works by sampling g = LHS − RHS at a
// few points: a linear g satisfies g(p,q) = a·p + b·q + k exactly, so we read
// off the coefficients and then confirm linearity at extra points.
function linearCoefficients(equation, v1, v2) {
  const eqIdx = equation.indexOf('=');
  if (eqIdx === -1) return null;
  const lhs = parseMathExpression(equation.slice(0, eqIdx));
  const rhs = parseMathExpression(equation.slice(eqIdx + 1));
  const g = `(${lhs}) - (${rhs})`;

  const at = (p, q) => {
    const val = math.evaluate(g, { [v1]: p, [v2]: q });
    return typeof val === 'number' ? val : NaN;
  };

  try {
    const k = at(0, 0);
    const a = at(1, 0) - k;
    const b = at(0, 1) - k;
    if (![k, a, b].every(Number.isFinite)) return null;

    // Linearity checks: g must be exactly a·p + b·q + k everywhere.
    const linear =
      approx(at(2, 0) - k, 2 * a) &&
      approx(at(0, 2) - k, 2 * b) &&
      approx(at(1, 1) - k, a + b) &&
      approx(at(-1, 3) - k, -a + 3 * b);
    if (!linear) return null;

    // Equation a·v1 + b·v2 + k = 0  ⇒  a·v1 + b·v2 = -k.
    if (approx(a, 0) && approx(b, 0)) return null; // 0 = c, degenerate
    return { a: clean(a), b: clean(b), c: clean(-k) };
  } catch {
    return null;
  }
}

// --- exact rational helpers (mathjs fractions) -------------------------------

// mathjs fraction.js stores n/d/s as BigInt, so `fr.n === 0` is always false
// (0n !== 0). Coerce with Number() before every comparison or interpolation.
const sub = (p, q) => math.subtract(p, q);
const mul = (p, q) => math.multiply(p, q);
const div = (p, q) => math.divide(p, q);
const isZero = (fr) => Number(fr.n) === 0;
const num = (fr) => math.number(fr);

function fmtFrac(fr) {
  const n = Number(fr.n);
  const d = Number(fr.d);
  const sign = Number(fr.s) < 0 ? -1 : 1;
  if (d === 1) return String(sign * n);
  return `${sign < 0 ? '-' : ''}${n}/${d}`;
}

function approx(x, y) {
  return Math.abs(x - y) < 1e-9 * (1 + Math.abs(y));
}

// Snap floating-point noise from the sampling to a clean rational-friendly number.
function clean(n) {
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-9) return r;
  return Math.round(n * 1e6) / 1e6;
}

function residualIsZero(row, v1, v2, xv, yv) {
  const lhs = row.a * xv + row.b * yv;
  return Math.abs(lhs - row.c) < 1e-6 * (1 + Math.abs(row.c));
}

// --- display -----------------------------------------------------------------

function coeffTerm(fr, varName, isFirst) {
  const n = Number(fr.n);
  const d = Number(fr.d);
  if (n === 0) return '';
  const negative = Number(fr.s) < 0;
  const magIsOne = n === d;
  const mag = d === 1 ? String(n) : `(${n}/${d})`;
  const body = magIsOne ? varName : `${mag}${varName}`;
  if (isFirst) return negative ? `-${body}` : body;
  return negative ? ` - ${body}` : ` + ${body}`;
}

function formatLinearEq(a, b, c, v1, v2) {
  let lhs = coeffTerm(a, v1, true);
  const second = coeffTerm(b, v2, lhs === '');
  lhs += second;
  if (lhs === '') lhs = '0';
  return `${lhs} = ${fmtFrac(c)}`;
}

function buildSubstitutionSteps({ a1, b1, c1, a2, b2, c2, x, y, v1, v2, eq1Disp, eq2Disp }) {
  const steps = [`Write the system:  ${eq1Disp};   ${eq2Disp}.`];

  // Isolate a variable from equation 1 — prefer one with a nonzero coefficient.
  if (!isZero(a1)) {
    // v1 = (c1 - b1·v2) / a1
    steps.push(`From equation 1, solve for ${v1}:  ${v1} = (${fmtFrac(c1)} − ${fmtFrac(b1)}·${v2}) / ${fmtFrac(a1)}.`);
    steps.push(`Substitute that into equation 2 and simplify to a single equation in ${v2}.`);
    steps.push(`Solve it:  ${v2} = ${fmtFrac(y)}.`);
    steps.push(`Back-substitute:  ${v1} = ${fmtFrac(x)}.`);
  } else {
    // a1 == 0 means equation 1 already gives v2 directly.
    steps.push(`Equation 1 has no ${v1} term, so it gives ${v2} directly:  ${v2} = ${fmtFrac(y)}.`);
    steps.push(`Substitute into equation 2 and solve:  ${v1} = ${fmtFrac(x)}.`);
  }

  steps.push(`Check: substituting (${v1} = ${fmtFrac(x)}, ${v2} = ${fmtFrac(y)}) satisfies both equations.`);
  return steps;
}

// --- graph -------------------------------------------------------------------

// Plot each equation as a line y = (c - a·v1)/b over a window around the
// solution, and (for a unique solution) mark the intersection. Vertical lines
// (b = 0) are skipped rather than mis-drawn — the answer is unaffected.
function buildGraph(rows, v1, v2, intersection, description) {
  try {
    if (rows.some((r) => Math.abs(r.b) < 1e-12)) return null;

    const center = intersection || { x: 0, y: 0 };
    const span = Math.max(10, Math.abs(center.x) * 2 + 6);
    const min = center.x - span;
    const max = center.x + span;
    const lineExpr = (r) => `(${r.c} - (${r.a})*x) / (${r.b})`;

    const points = sampleFunction(lineExpr(rows[0]), 'x', { min, max, step: (max - min) / 200 });
    if (points.length === 0) return null;

    const graph = {
      points,
      title: `Lines for the system in ${v1} and ${v2}`,
      description,
    };

    if (rows.length > 1) {
      const secondary = sampleFunction(lineExpr(rows[1]), 'x', { min, max, step: (max - min) / 200 });
      if (secondary.length > 0) {
        graph.secondaryPoints = secondary;
        graph.secondaryLabel = `equation 2 (${v2} vs ${v1})`;
      }
    }

    if (intersection) {
      graph.annotations = {
        intersection: {
          x: intersection.x,
          y: intersection.y,
          label: `(${round(intersection.x)}, ${round(intersection.y)})`,
        },
      };
      graph.initialWindow = { xMin: center.x - span / 3, xMax: center.x + span / 3 };
    }

    return graph;
  } catch {
    return null;
  }
}

function round(n) {
  return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(Math.round(n * 1000) / 1000);
}

// kind 'parse' = the text couldn't be read as a 2×2 system; 'unsupported' =
// a readable system outside what this solver handles (wrong size, non-linear).
function refuse(reason, hint, kind = 'parse') {
  const fields = {
    steps: ['Read the input as a system of equations.', reason, hint],
    answer: reason,
    tips: ['A 2×2 linear system looks like: 2x + 3y = 6; x − y = 4.'],
    common_mistakes: ['Mixing more than two equations or variables.', 'Non-linear terms like x·y or x².'],
  };
  return kind === 'parse' ? parseError(fields) : unsupported(fields);
}
