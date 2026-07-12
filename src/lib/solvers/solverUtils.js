// Shared helpers for the math solvers.
//
// Every solver used to carry its own copy of the Algebrite loader, the graph
// sampling loop, and ad-hoc number/expression formatting. Those now live here
// so the individual solvers can focus on the mathematics and the step wording.

import { create, all } from 'mathjs';
import { getSettings } from '../settings.js';

export const math = create(all);

// mathjs names the natural log `log`; students (and Algebrite) write `ln`.
// Alias it so every numeric evaluation — graphs, sampling, arithmetic —
// understands `ln(x)` instead of throwing "Undefined function ln".
math.import({ ln: (x) => math.log(x) }, { override: true });

// Algebrite is large and only needed for symbolic work, so it is imported
// lazily and memoized. Every solver shares this single promise.
let algebritePromise = null;

export function loadAlgebrite() {
  if (!algebritePromise) {
    algebritePromise = import('algebrite').then((module) => module.default);
  }
  return algebritePromise;
}

/**
 * Format a number for display: collapse floating-point noise to a clean
 * integer when appropriate, otherwise show up to `decimals` decimals with
 * trailing zeros trimmed. The default precision comes from user settings
 * (Settings page, 2-6, default 4). Non-finite values are passed through as
 * readable text.
 */
export function formatNumber(value, decimals = getSettings().decimalPlaces) {
  const n = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(n)) {
    if (n === Infinity) return '∞';
    if (n === -Infinity) return '-∞';
    return String(value);
  }

  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) {
    return String(rounded);
  }

  return parseFloat(n.toFixed(decimals)).toString();
}

/**
 * Tidy a raw algebra string (typically Algebrite/math.js output) for display.
 *
 * - Drops the explicit `*` in unambiguous coefficient products: `2*x` -> `2x`,
 *   `2*(x+1)` -> `2(x+1)`, `2*sin(x)` -> `2sin(x)`.
 * - Leaves `*` in place where removing it would be ambiguous, e.g. `x*cos(x)`
 *   or `1/3*x^3`.
 * - Removes redundant `^1` and adds spacing around binary `+`/`-`.
 *
 * The transformation is intentionally conservative: it never changes the value
 * of the expression, only its presentation.
 */
export function beautify(expression) {
  if (expression === null || expression === undefined) return '';
  let out = String(expression).trim();
  if (!out) return out;

  // Tighten spaced exponents: `x ^ 2` -> `x^2`.
  out = out.replace(/\s*\^\s*/g, '^');

  // Drop `*` in coefficient products (number * variable/paren/function).
  // The negative lookbehind avoids touching exponents (`x^2*y`), decimals, and
  // denominators (`1/3*x`) where implicit multiplication would read ambiguously.
  // Run repeatedly so chained coefficients (`2*3*x`) settle.
  let previous;
  do {
    previous = out;
    out = out.replace(/(?<![.\w^/])(\d+(?:\.\d+)?)\s*\*\s*([a-zA-Z(])/g, '$1$2');
  } while (out !== previous);

  out = out
    // Redundant exponent of one: `x^1` -> `x` (but keep `x^12`, `x^1.5`).
    .replace(/\^1(?![\d.])/g, '')
    // Space around binary plus.
    .replace(/\s*\+\s*/g, ' + ')
    // Space around binary minus: only when it follows a value (digit, letter,
    // or closing paren). Leading unary minus and negative exponents (`x^-2`)
    // are left untouched because they are not preceded by a value character.
    .replace(/([0-9a-zA-Z)])\s*-\s*/g, '$1 - ')
    // Normalize adjacent signs: `a + -b` -> `a - b`, `a - -b` -> `a + b`.
    .replace(/\+\s*-\s*/g, '- ')
    .replace(/(?<=[0-9a-zA-Z)])\s*-\s*-\s*/g, ' + ')
    // Collapse any doubled spaces introduced above.
    .replace(/\s{2,}/g, ' ')
    .trim();

  return out;
}

/**
 * Split an expression into its top-level additive terms.
 *
 * Returns `[{ sign, term, signed }]` where `sign` is '+' or '-', `term` is the
 * unsigned term, and `signed` includes a leading '-' for negative terms. Splits
 * only happen at depth 0, so products, quotients, function arguments, and
 * negative exponents (`x^-2`) stay intact.
 *
 *   "x^2 - 4*x + 3" -> [{+, x^2}, {-, 4*x}, {+, 3}]
 *   "(x+1)*(x-1)"   -> [{+, (x+1)*(x-1)}]   (no top-level +/-)
 */
export function splitTerms(expression) {
  const expr = String(expression).replace(/\s+/g, '');
  const terms = [];
  let depth = 0;
  let current = '';
  let sign = '+';

  const push = () => {
    if (current !== '') {
      terms.push({ sign, term: current, signed: (sign === '-' ? '-' : '') + current });
    }
  };

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    const isTopLevelOperator = (ch === '+' || ch === '-') && depth === 0 && i > 0;

    if (isTopLevelOperator) {
      const prev = expr[i - 1];
      // A '+'/'-' is only a term separator when it follows a value. Otherwise it
      // is a sign attached to what follows (exponents `x^-2`, scientific `1e-5`,
      // or a doubled operator like `*-`).
      const followsValue = /[0-9a-zA-Z)]/.test(prev) && prev !== 'e' && prev !== 'E';
      const scientific = (prev === 'e' || prev === 'E') && /[0-9]/.test(expr[i - 2] || '');

      if (followsValue && !scientific) {
        push();
        sign = ch;
        current = '';
        continue;
      }
    }

    current += ch;
  }
  push();

  return terms;
}

/**
 * Rewrite reciprocal trig functions into the sin/cos forms Algebrite
 * understands. Algebrite has no sec/csc/cot: it returns an unevaluated
 * `d(sec(x),x)` for derivatives and throws "Unsupported function sec" for
 * integrals. But it handles the definitions perfectly — 1/cos(x) differentiates
 * and 1/cos(x)^2 integrates to tan(x) — so rewriting before the handoff is all
 * that is needed.
 *
 *   sec(u) -> (1/cos(u))     csc(u) -> (1/sin(u))     cot(u) -> (cos(u)/sin(u))
 *
 * The argument is matched with balanced-parenthesis scanning so nested calls
 * like sec(cos(x)) and multi-token arguments like sec(2*x) rewrite correctly.
 * A trailing power binds to the whole reciprocal: sec(x)^2 -> (1/cos(x))^2.
 */
const RECIPROCAL_TRIG = {
  sec: (arg) => `(1/cos(${arg}))`,
  csc: (arg) => `(1/sin(${arg}))`,
  cot: (arg) => `(cos(${arg})/sin(${arg}))`,
};

export function rewriteReciprocalTrig(expression) {
  let expr = String(expression);
  // Repeat until stable so nested reciprocals (e.g. cot(sec(x))) fully resolve.
  for (let pass = 0; pass < 5; pass += 1) {
    const next = rewriteReciprocalTrigOnce(expr);
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function rewriteReciprocalTrigOnce(expr) {
  const names = Object.keys(RECIPROCAL_TRIG).join('|');
  const re = new RegExp(`\\b(${names})\\s*\\(`, 'i');
  const match = re.exec(expr);
  if (!match) return expr;

  const name = match[1].toLowerCase();
  const openIdx = match.index + match[0].length - 1; // index of the '('

  // Find the matching close paren by depth counting.
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < expr.length; i += 1) {
    if (expr[i] === '(') depth += 1;
    else if (expr[i] === ')') {
      depth -= 1;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx === -1) return expr; // Unbalanced; leave untouched.

  const arg = expr.slice(openIdx + 1, closeIdx);
  const replacement = RECIPROCAL_TRIG[name](arg);
  return expr.slice(0, match.index) + replacement + expr.slice(closeIdx + 1);
}

/**
 * Test whether an expression actually contains the given variable as a
 * standalone identifier — not as a letter buried inside a function name
 * (e.g. the "x" in "exp"). Variables here are always single letters.
 */
export function hasVariable(expression, variable) {
  return new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'i').test(String(expression));
}


/**
 * Are two expressions numerically equal? Samples both at several points and
 * requires agreement everywhere both are defined (at least 3 usable points).
 * This is the verification gate for symbolic results — a factorization or
 * identity simplification is only *claimed* after it passes this check, so a
 * symbolic-engine bug degrades to "no answer" rather than a wrong answer.
 */
const EQUIVALENCE_SAMPLE_POINTS = [-2.31, -1.17, -0.43, 0.29, 0.87, 1.61, 2.53];

export function expressionsNumericallyEqual(exprA, exprB, variable = 'x') {
  let seen = 0;
  let agree = 0;
  for (const x of EQUIVALENCE_SAMPLE_POINTS) {
    let a;
    let b;
    try {
      a = Number(math.evaluate(String(exprA), { [variable]: x }));
      b = Number(math.evaluate(String(exprB), { [variable]: x }));
    } catch {
      continue;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    seen += 1;
    if (Math.abs(a - b) <= 1e-6 * (1 + Math.abs(a))) agree += 1;
  }
  return seen >= 3 && agree === seen;
}

/**
 * Sample a single-variable expression over a range, returning `{x, y}` points
 * suitable for the graph components. Points where the function is undefined,
 * non-finite, or explodes beyond `cap` are skipped.
 */
export function sampleFunction(expression, variable, options = {}) {
  // Default window is ±40 so the graph viewer can pan beyond the initial
  // ±10 view "to a reasonable extent" without hitting empty space; the
  // viewer clamps panning to the sampled data. The cap only excludes true
  // blow-ups (asymptotes, exponential explosion) — the viewer windows the
  // y-axis itself, so ordinary polynomial growth must NOT be dropped or the
  // pannable extent collapses.
  const { min = -40, max = 40, step = 0.5, cap = 1e5 } = options;
  const points = [];

  for (let x = min; x <= max + 1e-9; x += step) {
    const scope = { [variable]: x };
    try {
      const y = math.evaluate(expression, scope);
      if (Number.isFinite(y) && Math.abs(y) <= cap) {
        // Round x to avoid floating-point drift in labels (…, 0.4999999).
        points.push({ x: Math.round(x * 1e6) / 1e6, y });
      }
    } catch {
      // Undefined at this point — skip it.
    }
  }

  return points;
}
