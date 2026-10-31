// Expressions with no equals sign: simplify (cancelling stated with its
// restriction), expand and factor.

import { isEquation, extractVariable, parseMathExpression } from '../../mathParser.js';
import { parseError } from '../../solutionEnvelope.js';
import {
  math,
  loadAlgebrite,
  isAlgebriteFailure,
  beautify,
  hasVariable,
  sampleFunction,
  expressionsNumericallyEqual,
  splitTerms,
  splitTopLevel,
  mark,
  stripOuterParens,
} from '../solverUtils.js';
import { CANCEL_TIPS, SIMPLIFY_TIPS, CANCEL_MISTAKES, SIMPLIFY_MISTAKES } from './guidance.js';
import { parseRootsList, IMAGINARY } from './rootsFormat.js';
import { exactRadicalForm } from './radicals.js';

// "expand (x+1)^2" → x^2 + 2x + 1. Algebrite's expand, verified numerically.
export async function expandExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const expanded = String(Algebrite.run(`expand(${expression})`)).trim();
    if (!expanded || /stop|error|nil/i.test(expanded)) return null;
    if (!expressionsNumericallyEqual(expression, expanded, extractVariable(expression))) return null;
    return {
      steps: [
        `Expand: ${beautify(expression)}`,
        'Multiply out every product of sums, then collect like terms.',
        `Result: ${beautify(expanded)} (confirmed numerically at several values).`,
      ],
      answer: beautify(expanded),
      tips: ['Expanding is the reverse of factoring; each term of one bracket multiplies each term of the other.', `${mark('(a + b)² = a² + 2ab + b²')} — the middle term is the one students drop.`, `Collect like terms at the end, and check by substituting a value into both forms: at ${mark('x = 1')}, ${mark('(x + 1)² = 4')} and ${mark('x² + 2x + 1 = 4')}.`],
      common_mistakes: [`Writing ${mark('(a + b)²')} as ${mark('a² + b²')}.`, 'Losing a sign when a bracket is subtracted.'],
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

export async function factorExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = extractVariable(expression);
    const factored = String(Algebrite.run(`factor(${expression})`)).trim();
    if (!factored || /nil|error|stop/i.test(factored)) return null;
    if (!expressionsNumericallyEqual(expression, factored, variable)) return null;

    const changed = factored.replace(/[\s*]/g, '') !== String(expression).replace(/[\s*]/g, '');

    const tips = [
      'Always pull out the greatest common factor first.',
      `${mark('a² − b² = (a − b)(a + b)')} — the difference-of-squares pattern.`,
      'Check a factorization by expanding it back out.',
    ];
    const commonMistakes = [
      'Stopping before the expression is fully factored.',
      'Sign errors inside the factors — expand to verify.',
      `Treating a sum of squares like a difference: ${mark('a² + b²')} does not factor over the reals.`,
    ];

    if (!changed) {
      return {
        steps: [
          `Factor the expression: ${beautify(expression)}`,
          'No factorization over the integers exists — the expression is already fully factored.',
        ],
        answer: `${beautify(expression)} (no simpler factors over the integers)`,
        tips,
        common_mistakes: commonMistakes,
        graph: generateAlgebraGraph(expression),
      };
    }

    const display = formatFactoredForm(factored);
    const steps = [`Factor the expression: ${beautify(expression)}`];

    const squares = diffOfSquares(expression);
    if (squares) {
      steps.push(`Recognize a difference of squares: ${squares}`);
    } else {
      steps.push('Pull out common factors and match factoring patterns (difference of squares, trinomials).');
    }
    steps.push(`Factored form: ${display}`);

    // Genuinely recompute the expansion for the verification step.
    try {
      const expanded = String(Algebrite.run(`expand(${factored})`)).trim();
      if (expanded && !/nil|error|stop/i.test(expanded)) {
        steps.push(`Check by expanding: ${display} = ${beautify(expanded)}.`);
      }
    } catch {
      // The check step is optional; the numeric gate above already passed.
    }

    return {
      steps,
      answer: display,
      tips,
      common_mistakes: commonMistakes,
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

// Drop the explicit '*' between factors for display: (x-3)*(x+3) reads as
// (x - 3)(x + 3). beautify() already handles digit coefficients like 2*(…).
function formatFactoredForm(factored) {
  return beautify(factored).replace(/([a-z0-9)])\s*\*\s*\(/gi, '$1(');
}

// Textbook narration for the x^2 - N (perfect square N) shape.
function diffOfSquares(expression) {
  const m = String(expression).replace(/\s+/g, '').match(/^([a-z])\^2-(\d+)$/i);
  if (!m) return null;
  const n = Number(m[2]);
  const root = Math.round(Math.sqrt(n));
  if (root * root !== n) return null;
  const v = m[1];
  return `${v}² − ${n} = ${v}² − ${root}², so it factors as (${v} − ${root})(${v} + ${root}).`;
}

// Where cancelling changed the domain: (x^2 - 1)/(x - 1) = x + 1 only for
// x ≠ 1. The points where a denominator of the original is zero but the
// simplified form is defined, exactly (Algebrite roots, each confirmed by
// evaluating the denominator there). Empty when nothing was cancelled away.
async function cancelledPoints(original, simplified, variable) {
  if (!/\//.test(original)) return [];
  const denominators = [];
  try {
    math.parse(original).traverse((node) => {
      if (node.isOperatorNode && node.op === '/' && node.args[1]) denominators.push(node.args[1].toString());
    });
  } catch {
    return [];
  }
  const Algebrite = await loadAlgebrite();
  const points = [];
  for (const den of denominators) {
    if (!new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(den)) continue;
    let raw;
    try { raw = String(Algebrite.roots(den, variable)).trim(); } catch { continue; }
    if (!raw || /stop|error|nil|roots/i.test(raw)) continue;
    for (const { display, numeric } of parseRootsList(raw)) {
      if (!Number.isFinite(numeric) || IMAGINARY.test(display)) continue;
      let d;
      let v;
      try {
        d = math.evaluate(den, { [variable]: numeric });
        v = math.evaluate(simplified, { [variable]: numeric });
      } catch { continue; }
      if (typeof d !== 'number' || Math.abs(d) > 1e-9) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (!points.some((q) => Math.abs(q.numeric - numeric) < 1e-9)) points.push({ display, numeric });
    }
  }
  return points.sort((p1, p2) => p1.numeric - p2.numeric);
}

export async function simplifyExpression(expression) {
  // Exact-radical rung: a constant expression containing a radical should
  // answer in exact simplified form (sqrt(50) → 5√2), not a decimal.
  const exact = await exactRadicalForm(expression);
  if (exact) return exact;

  const variable = extractVariable(expression);
  const inputLen = complexity(expression);

  // A constant expression that nothing above could simplify (sqrt(-4),
  // (-8)^(1/3)) is still worth a value: evaluate it as arithmetic rather
  // than echoing the input back as the "simplified" answer.
  if (!hasVariable(expression, variable)) {
    try {
      const { solveArithmetic } = await import('../arithmeticSolver.js');
      const arith = solveArithmetic(parseMathExpression(expression));
      if (arith && arith.answer && String(arith.answer).replace(/\s/g, '') !== String(expression).replace(/\s/g, '')) {
        return arith;
      }
    } catch { /* fall through to the symbolic candidates */ }
  }

  // Gather candidate simplifications and keep only those that are genuinely
  // equal to the input. An engine can "simplify" (x^2-9)/(x+3) into the
  // LONGER split form x^2/(x+3) - 9/(x+3) where Algebrite cancels it to x-3,
  // so we pick the SHORTEST verified-equivalent candidate and a result is
  // never longer than what the student typed. A polynomial's expanded form
  // wins ties: "simplify 2(x + 3) + 4x" means 6x + 6, not 6(x + 1).
  const candidates = [];
  const polynomial = await expandPolynomial(expression, variable);
  if (polynomial) candidates.push({ source: 'expand', answer: polynomial.answer, steps: polynomial.steps });
  const algebrite = await algebriteSimplify(expression, variable);
  if (algebrite) candidates.push({ source: 'algebrite', answer: algebrite });
  try {
    const mjs = beautify(math.simplify(expression).toString());
    if (mjs && equivalentOrConstant(expression, mjs, variable)) {
      candidates.push({ source: 'mathjs', answer: mjs });
    }
  } catch {
    // fall through
  }

  // No engine produced anything. If the input does not even parse, that is a
  // syntax problem and must be reported as one — echoing "x^2 + *3 is already
  // in simplest form" under a solved status was the July F1 class surviving in
  // this one path (September 2026 audit row A02).
  if (candidates.length === 0) {
    try {
      math.parse(expression);
    } catch (err) {
      const detail = String(err?.message || '').replace(/\s*\(char \d+\)\s*$/, '');
      return parseError({
        input: expression,
        hint: detail ? `${detail}.` : 'The expression contains an operator sequence that cannot be read.',
      });
    }
  }

  // Best = shortest; on a tie prefer the expanded polynomial and its steps.
  candidates.sort((a, b) => {
    const d = complexity(a.answer) - complexity(b.answer);
    if (d !== 0) return d;
    return (a.source === 'expand' ? -1 : 0) - (b.source === 'expand' ? -1 : 0);
  });
  const best = candidates[0];

  let steps;
  let answer;
  let cancelled = false;
  if (best && complexity(best.answer) < inputLen) {
    // A real simplification. A polynomial shows its expansion and combining;
    // anything else gets a clean three-line derivation.
    answer = best.answer;
    // A fraction whose denominator has the variable is simplified by
    // cancelling, whichever engine found the answer ((x^3 - x)/(x^2 - 1) was
    // "Multiply out the parentheses: x").
    const factoring = /\/\s*\(?[^)]*[a-z]/i.test(expression) ? await fractionFactoring(expression, variable) : null;
    if (factoring) cancelled = true;
    if (best.steps && !factoring) {
      steps = best.steps;
    } else {
      steps = [
        `Original expression: ${mark(beautify(expression))}`,
        ...(factoring || [/\//.test(expression)
          ? 'Factor and cancel the common factor(s).'
          : 'Combine like terms and simplify.']),
        `Simplified form: ${mark(answer)}`,
      ];
    }
    // A cancelled factor was zero somewhere: the original is undefined
    // there and the simplified form is not, so they are equal only away
    // from those points, as a textbook says.
    const excluded = await cancelledPoints(expression, answer, variable);
    if (excluded.length) {
      cancelled = true;
      const list = excluded.map((q) => `${variable} ≠ ${q.display}`).join(', ');
      steps.push(`The original divides by zero at ${excluded.map((q) => mark(`${variable} = ${q.display}`)).join(' and ')}, where the simplified form does not, so the two are equal only for ${excluded.map((q) => mark(`${variable} ≠ ${q.display}`)).join(' and ')}.`);
      answer = `${answer}, for ${list}`;
    }
  } else {
    // A polynomial that is already expanded may still factor, and that is
    // usually what a student typing x^2 - 5x + 6 under Algebra wants: it
    // was echoed back unchanged (October 2026 review). Both forms are given.
    const polynomial = !/[a-z]{2,}/i.test(expression) && !/\/\s*(?:\([^)]*[a-z]|[a-z])/i.test(expression) && /[a-z]\s*\^\s*\d/i.test(expression);
    const factored = polynomial ? await factorExpression(expression) : null;
    if (factored && !/no simpler factors/.test(factored.answer)) {
      return {
        ...factored,
        steps: [
          `${mark(beautify(expression))} is already simplified: expanded, with like terms combined. It does factor, though:`,
          ...factored.steps.slice(1),
        ],
        answer: `${beautify(expression)} = ${factored.answer}`,
      };
    }
    answer = beautify(expression);
    steps = [`The expression ${beautify(expression)} is already in simplest form.`];
  }

  return {
    steps,
    answer,
    tips: cancelled ? CANCEL_TIPS : SIMPLIFY_TIPS,
    common_mistakes: cancelled ? CANCEL_MISTAKES : SIMPLIFY_MISTAKES,
    graph: generateAlgebraGraph(expression),
  };
}

// N/D with polynomial N and D: each factored (Algebrite, degree ≤ 6), and the
// factors they share named, as the cancellation is taught. Null when the
// expression is not one such fraction, nothing is shared, or factoring fails.
async function fractionFactoring(expression, variable) {
  const parts = splitTopLevel(String(expression), '/');
  if (parts.length !== 2) return null;
  const [num, den] = parts.map((t) => stripOuterParens(t.trim()));
  const isPoly = (t) => /^[\d\s+\-*^().a-z]*$/i.test(t) && !/[a-z]{2,}/i.test(t);
  if (!isPoly(num) || !isPoly(den)) return null;
  try {
    const Algebrite = await loadAlgebrite();
    const degree = (t) => Number(String(Algebrite.run(`deg(${t}, ${variable})`)).trim());
    if (!(degree(num) <= 6 && degree(den) <= 6)) return null;
    const factorText = (t) => beautify(String(Algebrite.run(`factor(${t}, ${variable})`)).trim()).replace(/\)\*\(/g, ')(').replace(/(^|[^\w)])(\w+)\*\(/g, '$1$2(');
    const fn = factorText(num);
    const fd = factorText(den);
    const common = beautify(String(Algebrite.run(`gcd(${num}, ${den})`)).trim());
    if (isAlgebriteFailure(fn) || isAlgebriteFailure(fd) || !common || /^-?\d+$/.test(common)) return null;
    const show = (t) => (/[+\-]/.test(t.replace(/^-/, '')) && !/^\(.*\)$/.test(t) ? `(${t})` : t);
    return [
      `Factor the numerator: ${mark(`${beautify(num)} = ${fn}`)}.`,
      beautify(den) === fd ? `The denominator ${mark(fd)} is already factored.` : `Factor the denominator: ${mark(`${beautify(den)} = ${fd}`)}.`,
      `Cancel the common factor${/\)\s*\(|\)\^/.test(factorText(common)) ? 's' : ''} ${mark(show(factorText(common)))} from the top and the bottom.`,
    ];
  } catch {
    return null;
  }
}

// A polynomial in the variable (nothing but numbers in any denominator),
// expanded by Algebrite, with the working: each top-level term multiplied out,
// then like terms combined. Null for anything that is not a polynomial.
async function expandPolynomial(expression, variable) {
  if (/[a-z]{2,}/i.test(expression)) return null; // function calls
  if (/[a-z]/i.test(expression.replace(new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'gi'), ''))) return null; // other letters
  try {
    const Algebrite = await loadAlgebrite();
    const denominator = String(Algebrite.run(`denominator(${expression})`)).trim();
    if (hasVariable(denominator, variable) || /nil|error|stop/i.test(denominator)) return null;
    const expand = (e) => {
      const out = String(Algebrite.run(`expand(${e})`)).trim();
      if (!out || /nil|error|stop/i.test(out)) throw new Error('expand failed');
      return out;
    };
    const answer = beautify(expand(expression));
    if (!equivalentOrConstant(expression, answer, variable)) return null;
    const terms = splitTerms(expression);
    const multiplied = beautify(terms.map((t) => `(${t.signed.includes('(') ? expand(t.signed) : t.signed})`).join(' + ')
      .replace(/\(([^()]*)\)/g, '$1'));
    const steps = [];
    if (expression.includes('(')) {
      steps.push(`Multiply out the parentheses: ${multiplied}`);
      if (complexity(multiplied) !== complexity(answer)) steps.push(`Combine like terms: ${answer}`);
    } else {
      steps.push(`${terms.length > 1 ? 'Combine like terms' : 'Simplify'}: ${answer}`);
    }
    return { answer, steps };
  } catch {
    return null;
  }
}

// Normalized size of an expression for "is this actually simpler?" comparisons.
// Strips spaces and explicit '*' so 2*(x+2) and 2(x+2) compare equal.
function complexity(expr) {
  return String(expr).replace(/[\s*]/g, '').length;
}

// Algebrite simplify, beautified, or null if it errors / doesn't change / no
// longer matches the input numerically.
async function algebriteSimplify(expression, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const out = String(Algebrite.run(`simplify(${expression})`)).trim();
    if (!out || /nil|error|stop/i.test(out)) return null;
    // Algebrite writes x/2 as 1/2*x; show it the textbook way.
    const pretty = beautify(out)
      .replace(/(?<![\w^/.)])1\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$2/$1')
      .replace(/(?<![\w^/.)])(\d+)\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$1$3/$2');
    if (!equivalentOrConstant(expression, pretty, variable)) return null;
    return pretty;
  } catch {
    return null;
  }
}

// expressionsNumericallyEqual, but tolerant of constant (variable-free)
// expressions, where the sampler has nothing to vary.
function equivalentOrConstant(a, b, variable) {
  if (expressionsNumericallyEqual(a, b, variable)) return true;
  try {
    const va = Number(math.evaluate(String(a)));
    const vb = Number(math.evaluate(String(b)));
    return Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-9 * (1 + Math.abs(va));
  } catch {
    return false;
  }
}

export function generateAlgebraGraph(expression) {
  try {
    if (isEquation(expression)) return null;
    const variable = extractVariable(expression);
    const points = sampleFunction(expression, variable);

    if (points.length > 0) {
      return {
        points,
        expression,
        variable,
        title: `Graph of ${beautify(expression)}`,
        description: 'Visual representation of the expression',
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }
  return null;
}
