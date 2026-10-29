// Expression text: numbers formatted, Algebrite output written as a textbook
// does (beautify, ln, π forms, exact forms), splitting at top-level
// operators, and reading what was typed (bare function names, "Read as").

import { getSettings } from '../../settings.js';
import { math } from './engines.js';

/**
 * Did Algebrite give up and hand the operator back unevaluated?
 *
 * When Algebrite cannot differentiate or integrate something it does not
 * throw — it returns the expression with the operator still wrapped around
 * it: `d(foo(x),x)`, `integral(foo(x),x)`, `defint(...)`. Reported as-is,
 * that is a wrong "Solved" answer (the QA report's `f'(x) = d(asin(x),x)`).
 * Every solver that reads an Algebrite derivative/integral must check this
 * and refuse honestly. Note the integral solver's derivative trust-gate does
 * NOT catch it: d(integral(f,x),x) simplifies straight back to f.
 */
// A known function name with no argument list — "sin^2", "ln + 3", "2sin".
// Never mathematics a solver should act on: mathjs reads the bare name as a
// function VALUE (and errors deep inside pow), Algebrite applies it to its
// previous result. Callers refuse it with a hint instead.
const BARE_FUNCTION = /(?<![a-z])(arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp)(?![a-z0-9])\s*(?!\()/i;
export function bareFunctionName(expression) {
  const m = BARE_FUNCTION.exec(String(expression));
  return m ? m[1] : null;
}

// What the solver understood, as a textbook writes it, for the "Read as"
// line above a solution: (sec(x))^3 and sec(x)^3 → sec^3(x), abs(u) → |u|,
// so a misread ("sec·x" for sec³x) is visible before the first step.
const READ_AS_FN = '(sin|cos|tan|sec|csc|cot|ln|log|sinh|cosh|tanh|arcsin|arccos|arctan)';
const ARG = '([^()]*(?:\\([^()]*\\)[^()]*)*)';
export function readAsText(expression) {
  return absBars(beautify(expression))
    .replace(new RegExp(`\\(${READ_AS_FN}\\(${ARG}\\)\\)\\^(\\d+)`, 'g'), '$1^$3($2)')
    .replace(new RegExp(`(?<![a-z])${READ_AS_FN}\\(${ARG}\\)\\^(\\d+)`, 'g'), '$1^$3($2)');
}

// abs(…) as a textbook writes it, |…| (innermost, unnested arguments).
export function absBars(text) {
  return String(text).replace(/(?<![a-z])abs\(([^()]*)\)/g, '|$1|');
}

// The parse error for a bare function name, worded once for every path.
export function bareFunctionRefusal(name) {
  return {
    hint: `${name} needs an argument in parentheses — ${name}(x), ${name}(2), ${name}^2(x).`,
    tips: [`Every function call needs parentheses: "${name}(x)", not "${name} x" or "${name}" alone.`],
  };
}

export function isUnevaluatedOperator(result) {
  const s = String(result ?? '');
  return /\b(?:d|derivative|integral|defint)\s*\(/.test(s);
}

/**
 * Whether the input is at least readable as a mathematical expression.
 * Solvers' catch blocks use this to pick an honest failure status: input
 * that parses but couldn't be solved is `unsupported` (an engine limit),
 * input that doesn't parse is a `parse_error` — the message must never
 * blame the user's formatting when the input was valid.
 */
export function parsesAsMath(expression) {
  try {
    math.parse(String(expression));
    return true;
  } catch {
    return false;
  }
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
    // The parser writes log2(x) as log(x)/log(2); show it as log_2(x).
    .replace(/\(?(?<![a-z])log\(([^()]+)\)\s*\/\s*log\((\d+(?:\.\d+)?)\)\)?/g, (m, arg, base) => (base === '10' ? `log(${arg})` : `log_${base}(${arg})`))
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

  // The parser rewrites a bare log(…) as (log(…)/log(10)) for the engines;
  // that internal form must never reach the screen — show what was typed.
  out = out.replace(/\(log\(((?:[^()]|\([^()]*\))+)\)\/log\(10\)\)/g, 'log($1)');

  return out;
}

// Algebrite writes the natural log as `log(x)` (without the absolute value
// the antiderivative of 1/x needs) and the exponential as `exp(x)`. Present
// integral RESULTS the textbook way: ln|…| and e^(…). One formatter for every
// integral step and answer, so a walkthrough never switches between log and
// ln, or exp and e^, part-way through (September 2026 review, 1.38.1).
export function lnify(result) {
  const once = lnifyOnce(result);
  // A root inside a root (√(10 + 2√5)) needs a second look: the inner one
  // is converted first and the outer one then has no parentheses inside.
  // Only the root rules run again — beautify would also drop the "*" in
  // √2*x, changing every pinned answer.
  return once
    .replace(/(?<![a-z])sqrt\(([^()]+)\)/g, '√($1)')
    .replace(/√\((\d+)\)/g, '√$1');
}

function lnifyOnce(result) {
  return beautify(result)
    // outermost log(...) (one nesting level inside) → ln|...|
    // (?<![a-z]) not \b: beautify writes 4*log(x) as 4log(x).
    .replace(/(?<![a-z])log\(((?:[^()]|\([^()]*\))+)\)/g, 'ln|$1|')
    // a log(...) left inside those bars → ln(...) (bars within bars read badly)
    .replace(/(?<![a-z])log\(([^()]+)\)/g, 'ln($1)')
    // ln|(x - 1)| reads as ln|x - 1|: the bars already group it
    .replace(/ln\|\(([^()]+)\)\|/g, 'ln|$1|')
    // bars around a positive number mean nothing: ln|10| reads as ln(10)
    .replace(/ln\|(\d+(?:\.\d+)?)\|/g, 'ln($1)')
    // exp(x) → e^x for a single token, e^(…) otherwise
    .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/gi, 'e^$1')
    .replace(/(?<![a-z])exp\(((?:[^()]|\([^()]*\))+)\)/g, 'e^($1)')
    // (…)^(1/2) and sqrt(…) → √(…), and Algebrite's −x² + 1 inside → 1 − x²
    .replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)')
    .replace(/(?<![a-z])sqrt\(([^()]+)\)/g, '√($1)')
    .replace(/√\(-([^()]+?) \+ (\d+(?:\.\d+)?)\)/g, '√($2 - $1)')
    // √(3) → √3: a plain number needs no bracket.
    .replace(/√\((\d+)\)/g, '√$1')
    // 2^(1/2) and x^(1/2) → √2, √x (Algebrite's form for a root of a token)
    .replace(/(?<![\w.])(\d+)\^\(1\/2\)(?![\w])/g, '√$1')
    .replace(/(?<![a-z.])([a-z])\^\(1\/2\)(?![\w])/g, '√$1');
}

// Split on a delimiter at parenthesis depth 0: splitTopLevel('(a*b)*c', '*')
// is ['(a*b)', 'c']. Pieces are untrimmed; a string without the delimiter is
// one piece.
export function splitTopLevel(str, delimiter) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of String(str)) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

// Remove parentheses that wrap the WHOLE expression, as many layers as there
// are: '((x + 1))' -> 'x + 1'. '(x + 1)*(x + 2)' is returned unchanged — its
// first '(' closes before the end. (A bare /^\((.*)\)$/ strip turns that into
// 'x + 1)*(x + 2', which is how a factored numerator once broke partial
// fractions.)
export function stripOuterParens(expr) {
  let s = String(expr).trim();
  while (s.length >= 2 && s[0] === '(' && s[s.length - 1] === ')') {
    let depth = 0;
    for (let i = 0; i < s.length - 1; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') depth -= 1;
      if (depth === 0) return s;
    }
    s = s.slice(1, -1).trim();
  }
  return s;
}

// Greatest common divisor of two integers, always ≥ 0.
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
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
  // 1e10 is a number, not a use of the variable e.
  const text = String(expression).replace(/\d+(?:\.\d+)?[eE][+-]?\d+/g, '0');
  return new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'i').test(text);
}

// A multiple of π/12 written as such: π/2, -3π/4, 2π. Null otherwise.
// Shared by the functions solver (periodic patterns) and the graph viewer
// (asymptote labels), so an asymptote reads "x = 3π/2", not a 15-digit float.
export function piForm(x) {
  const ratio = x / Math.PI;
  for (const d of [1, 2, 3, 4, 6, 12]) {
    const n = ratio * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const k = Math.round(n);
      if (k === 0) return '0';
      const num = Math.abs(k) === 1 ? '' : String(Math.abs(k));
      return `${k < 0 ? '-' : ''}${num}π${d > 1 ? `/${d}` : ''}`;
    }
  }
  return null;
}

// A value from Algebrite shown as a textbook writes it: 1/e, √2, ∛2, π/6,
// e^(x), ln(3) − 3. Shared by the interval solver (its exact values at
// critical points) and the function analysis (extremum values).
export function exactForm(text) {
  const out = beautify(String(text))
    // The real cube root: Algebrite writes ∛(−2) as (−1)^(1/3)·2^(1/3).
    .replace(/\(-1\)\^\(1\/3\)\*/g, '-')
    .replace(/(?<![a-z])(\d+|[a-z])\^\(1\/3\)/g, '∛$1')
    // 1/6*π → π/6, 5/6*π → 5π/6.
    .replace(/(?<![\w.])1\/(\d+)\*pi(?![a-z])/g, 'pi/$1')
    .replace(/(?<![\w.])(\d+)\/(\d+)\*pi(?![a-z])/g, '$1pi/$2')
    .replace(/(?<![a-z])exp\(-1\)/g, '1/e')
    .replace(/(?<![a-z])(\d+|[a-z])\^\(1\/2\)/g, '√$1')
    .replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)')
    // Algebrite's −1 + e first: (e − 1).
    .replace(/\(-(\d+) \+ ([a-zπ√][^()]*)\)/g, '($2 - $1)')
    .replace(/(?<![a-z])log\(/g, 'ln(')
    .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
    .replace(/(?<![a-z])exp\(((?:[^()]|\([^()]*\))+)\)/g, 'e^($1)')
    .replace(/(?<![a-z])sqrt\(/g, '√(')
    .replace(/√\(([a-z]|\d+)\)/g, '√$1')
    .replace(/(?<![a-z])pi(?![a-z])/g, 'π')
    .replace(/\s*\/\s*/g, '/');
  // −3 + ln(3) reads as ln(3) − 3.
  const lead = out.match(/^-(\d+(?:\/\d+)?) \+ ([^+\-]+)$/);
  return lead ? `${lead[2]} - ${lead[1]}` : out;
}
