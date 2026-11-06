// Practice mode, the checker (1.70.0; docs/future-work/PLAN-PRACTICE-MODE.md).
//
// Three things, all in the solver worker (they need mathjs):
//   practiceKind(result)   which kind of answer a solved result has, if it is
//                          one practice can check: a number, the solutions of
//                          one equation, a derivative, an antiderivative;
//   readCorrect(result)    the engine's answer in a form the checker uses;
//   checkAnswer(…)         the student's typed answer against it, by
//                          mathematics, never by text, with a message that
//                          says what is wrong without giving the answer away.

import { math, stripMathMarkers } from '../solvers/solverUtils.js';
import { parseMathExpression } from '../mathParser.js';

// Points away from the usual special values (0, ±1, π/2), where an
// expression and its rewriting must agree. A point where either side is not
// a finite real number is skipped.
const SAMPLES = [0.37, 0.71, 1.13, 1.61, 2.27, 2.93, 3.7, -0.53, -1.31, -2.41];

const MAX_ANSWER_LENGTH = 300;

const plain = (text) => stripMathMarkers(String(text ?? ''));

// The engine's answer text as mathjs reads it. Its natural log is written
// ln, or log where Algebrite's own form survives; a typed log is base 10, so
// the engine's text is not read by the typed-input reader's log rule.
function engineExpr(text) {
  return String(text)
    .replace(/−/g, '-')
    .replace(/·/g, '*')
    .replace(/π/g, 'pi')
    .replace(/∞/g, 'Infinity')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*(\d+(?:\.\d+)?|[a-z])/g, 'sqrt($1)')
    .replace(/(?<![a-z])(?:ln|log)\s*\|([^|]+)\|/g, 'log(abs($1))')
    .replace(/(?<![a-z])ln\s*\(/g, 'log(')
    .replace(/\barcsin\b/g, 'asin')
    .replace(/\barccos\b/g, 'acos')
    .replace(/\barctan\b/g, 'atan')
    .replace(/\|([^|]+)\|/g, 'abs($1)')
    .replace(/(\d)\s*(?=[a-z(])/g, '$1*')
    .replace(/\)\s*(?=[a-z(\d])/g, ')*')
    .replace(/\s+/g, ' ')
    .trim();
}

// What a student types, as mathjs reads it: the app's own reader (2x, x², √,
// ln|x|, π, log as base 10).
function typedExpr(text) {
  return parseMathExpression(String(text).trim());
}

function evaluateAt(expr, variable, x) {
  try {
    const value = math.evaluate(expr, variable ? { [variable]: x } : {});
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// The main value of an answer: the decimal beside an exact value goes, as
// does a domain note.
const dropAside = (text) => String(text).replace(/\s*\((?:≈|=)[^()]*\)\s*$/, '').trim();
const afterLastEquals = (text) => {
  // The last "=" outside brackets: "lim (x→2) (x^2 - 4)/(x - 2) = 4".
  let depth = 0;
  let at = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === '=' && depth === 0) at = i;
  }
  return at < 0 ? text : text.slice(at + 1).trim();
};

// ---------------------------------------------------------------------------
// Which kind of answer, and the correct one read off the engine's text.

// `topic` is the one the problem was solved under; a routed or detected
// result names its own (routedTopic).
export function practiceKind(result, topic) {
  if (!result || result.status !== 'solved' || typeof result.answer !== 'string') return null;
  const answer = plain(result.answer);
  topic = result.routedTopic || topic;
  if (/≈/.test(dropAside(answer))) return null; // an estimate or a located root: nothing exact to check against
  if (topic === 'integrals') {
    if (/^∫\(.*\) d([a-z]) = .+ \+ C$/.test(answer)) return { kind: 'antiderivative', variable: answer.match(/^∫\(.*\) d([a-z]) = /)[1] };
    if (/^∫_/.test(answer)) return { kind: 'number' };
    return null;
  }
  if (topic === 'derivatives') {
    const m = answer.match(/^f'+\(([a-z])\) = /);
    if (m) return { kind: 'derivative', variable: m[1] };
    if (/^f'+\([^)a-z]+\) = /.test(answer)) return { kind: 'number' };
    return null;
  }
  if (topic === 'limits') return /= [^=]+$/.test(answer) && !/does not exist|∞/.test(afterLastEquals(dropAside(answer))) ? { kind: 'number' } : null;
  if (topic === 'algebra') {
    const m = answer.match(/^([a-z]) = /);
    if (!m) return null;
    // One unknown, every clause "x = value".
    const clauses = answer.split(/\s+or\s+/);
    if (!clauses.every((c) => new RegExp(`^${m[1]} = [^=]+$`).test(c.trim()))) return null;
    return { kind: 'solutions', variable: m[1] };
  }
  if (topic === 'other') return /^[-\d(√π]/.test(answer) && !/[a-z]{2,}/.test(dropAside(answer).replace(/\b(?:sqrt|pi|ln)\b/g, '')) ? { kind: 'number' } : null;
  return null;
}

// { kind, variable, value | values | expr, shown } or null when the answer
// cannot be read (practice then does not offer the problem).
export function readCorrect(result, topic) {
  const kind = practiceKind(result, topic);
  if (!kind) return null;
  const answer = plain(result.answer);
  if (kind.kind === 'number') {
    const main = afterLastEquals(dropAside(answer));
    const value = evaluateAt(engineExpr(main), null);
    if (value === null) return null;
    // The decimal beside it, when given, must agree: a misread answer is
    // never used to mark a student.
    const aside = answer.match(/\((?:≈|=)\s*(-?[\d.]+)\)\s*$/);
    if (aside && Math.abs(Number(aside[1]) - value) > 1e-3 * (1 + Math.abs(value))) return null;
    return { ...kind, value, shown: main };
  }
  if (kind.kind === 'solutions') {
    const values = [];
    for (const clause of answer.split(/\s+or\s+/)) {
      const rhs = dropAside(clause.replace(/^\s*[a-z]\s*=\s*/, '').replace(/\s*\(repeated root[^)]*\)\s*$/, ''));
      const v = evaluateAt(engineExpr(rhs), null);
      if (v === null) return null;
      values.push(v);
    }
    return { ...kind, values: values.sort((a, b) => a - b), shown: answer };
  }
  const expr = kind.kind === 'derivative'
    ? answer.replace(/^f'+\([a-z]\) = /, '').replace(/,\s*[a-z]\s*[≠<>≤≥].*$/, '').replace(/\s*\(does not exist where[^)]*\)\s*$/, '')
    : answer.replace(/^∫\(.*\) d[a-z] = /, '').replace(/\s*\+ C$/, '');
  const prepared = engineExpr(expr);
  const finite = SAMPLES.filter((x) => evaluateAt(prepared, kind.variable, x) !== null).length;
  if (finite < 4) return null;
  return { ...kind, expr: prepared, shown: expr };
}

// ---------------------------------------------------------------------------
// The student's answer.

const close = (a, b) => Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a) + Math.abs(b));

// A typed number: its value, and how many decimal places it was typed to
// (null when it is exact: a whole number, a fraction, √2, π/8).
function readNumber(text) {
  const t = String(text).trim();
  if (!t) return null;
  const decimal = t.match(/^-?\d*\.(\d+)$/);
  const value = evaluateAt(typedExpr(t), null);
  if (value === null) return null;
  return { value, places: decimal ? decimal[1].length : null };
}

// Right, close (a rounded decimal with too few places) or wrong.
function compareNumber(typed, value) {
  if (close(typed.value, value)) return 'right';
  if (typed.places !== null) {
    const half = 0.5 * 10 ** -typed.places + 1e-12 * (1 + Math.abs(value));
    if (Math.abs(typed.value - value) <= half) return typed.places >= 2 ? 'right' : 'close';
  }
  return 'wrong';
}

const fmt = (x) => {
  if (Number.isInteger(x)) return String(x);
  const r = Math.round(x * 10000) / 10000;
  return String(r);
};

function stripLabel(text, variable) {
  // "f'(x) = …", "y = …", "F(x) = …", "∫… = …", "x = 3": the right-hand side.
  const t = String(text).trim();
  const eq = t.lastIndexOf('=');
  if (eq < 0) return t;
  const left = t.slice(0, eq).trim();
  if (new RegExp(`^(?:f'*\\(${variable}\\)|[yF]'*(?:\\(${variable}\\))?|dy/d${variable}|∫.*|${variable})$`).test(left)) return t.slice(eq + 1).trim();
  return t;
}

const unreadable = () => ({
  verdict: 'unreadable',
  message: 'MasterMath could not read that answer. Type it the way you would type a problem: 2x, x^2, sqrt(x), 3/4.',
});

// The equation sides of a one-unknown equation, for substituting a value.
function equationSides(problem) {
  const parts = String(problem).split('=');
  if (parts.length !== 2) return null;
  try {
    return [typedExpr(parts[0]), typedExpr(parts[1])];
  } catch {
    return null;
  }
}

// A typed log is base 10 in MasterMath (as on a calculator); a student who
// meant the natural logarithm is told so rather than marked wrong.
export function checkAnswer(correct, typed, context = {}) {
  const verdict = checkTyped(correct, typed, context);
  if (['wrong', 'partial', 'unreadable'].includes(verdict.verdict) && /(?<![a-z])log\s*\(/.test(String(typed))) {
    const asLn = checkTyped(correct, String(typed).replace(/(?<![a-z])log\s*\(/g, 'ln('), context);
    if (asLn.verdict === 'correct') return { verdict: 'close', message: 'Nearly: in MasterMath log(…) means base 10. For the natural logarithm write ln(…).' };
  }
  return verdict;
}

function checkTyped(correct, typed, context = {}) {
  const text = String(typed ?? '').trim();
  if (!text) return { verdict: 'empty', message: 'Type your answer first.' };
  if (text.length > MAX_ANSWER_LENGTH) return unreadable();
  const v = correct.variable || 'x';
  try {
    if (correct.kind === 'number') {
      const n = readNumber(stripLabel(text, v));
      if (!n) return unreadable();
      const how = compareNumber(n, correct.value);
      if (how === 'right') return { verdict: 'correct', message: 'Correct ✓' };
      if (how === 'close') return { verdict: 'close', message: 'Close, but give at least two decimal places, or the exact value.' };
      return { verdict: 'wrong', message: 'Not quite. Check your working, or use Hint to see the next step.' };
    }

    if (correct.kind === 'solutions') {
      // "2, 3", "x = 3 or x = 2", "x = -1/2 and x = 2", "3/2"
      const pieces = text.split(/\s*(?:,|;|\bor\b|\band\b)\s*/i).map((p) => p.replace(new RegExp(`^\\s*${v}\\s*=\\s*`), '').trim()).filter(Boolean);
      const typedValues = [];
      for (const p of pieces) {
        const n = readNumber(p);
        if (!n) return unreadable();
        if (!typedValues.some((t) => close(t.value, n.value))) typedValues.push({ ...n, text: p });
      }
      const matched = new Set();
      const wrong = [];
      let rounded = false;
      for (const t of typedValues) {
        const hit = correct.values.findIndex((c, i) => !matched.has(i) && compareNumber(t, c) !== 'wrong');
        if (hit < 0) { wrong.push(t); continue; }
        if (compareNumber(t, correct.values[hit]) === 'close') rounded = true;
        matched.add(hit);
      }
      const missing = correct.values.length - matched.size;
      if (wrong.length === 0 && missing === 0) {
        return rounded
          ? { verdict: 'close', message: 'Close, but give at least two decimal places, or the exact values.' }
          : { verdict: 'correct', message: 'Correct ✓' };
      }
      if (wrong.length) {
        const sides = equationSides(context.problem);
        const w = wrong[0];
        if (sides) {
          const l = evaluateAt(sides[0], v, w.value);
          const r = evaluateAt(sides[1], v, w.value);
          if (l !== null && r !== null) {
            return { verdict: 'wrong', message: `${v} = ${w.text} does not satisfy the equation: there the left side is ${fmt(l)} and the right side is ${fmt(r)}.` };
          }
        }
        return { verdict: 'wrong', message: `${v} = ${w.text} is not a solution. Check your working, or use Hint to see the next step.` };
      }
      const found = matched.size;
      return {
        verdict: 'partial',
        message: `${found === 1 ? 'That one is right' : `Those ${found} are right`}, but there ${missing === 1 ? 'is one more solution' : `are ${missing} more solutions`}.`,
      };
    }

    if (correct.kind === 'derivative' || correct.kind === 'antiderivative') {
      let body = stripLabel(text, v);
      const withC = /\+\s*[cC]\s*$/.test(body);
      if (correct.kind === 'antiderivative') body = body.replace(/\s*\+\s*[cC]\s*$/, '');
      const expr = typedExpr(body);
      // A variable other than the problem's, or a word: not an answer here.
      try {
        // Names of variables only: a function's own name (cos, ln) is not one.
        const symbols = math.parse(expr).filter((n, path, parent) => n.type === 'SymbolNode' && !(parent?.type === 'FunctionNode' && path === 'fn')).map((n) => n.name);
        if (symbols.some((s) => s !== v && s !== 'pi' && s !== 'e')) return unreadable();
      } catch {
        return unreadable();
      }
      const pairs = [];
      for (const x of SAMPLES) {
        const a = evaluateAt(expr, v, x);
        const b = evaluateAt(correct.expr, v, x);
        if (a !== null && b !== null) pairs.push({ x, a, b });
      }
      if (pairs.length < 3) return unreadable();
      if (correct.kind === 'derivative') {
        const off = pairs.find(({ a, b }) => Math.abs(a - b) > 1e-6 * (1 + Math.abs(a) + Math.abs(b)));
        if (!off) return { verdict: 'correct', message: 'Correct ✓' };
        return { verdict: 'wrong', message: `Not quite: at ${v} = ${off.x} yours gives ${fmt(off.a)}, but the derivative is ${fmt(off.b)}.` };
      }
      // An antiderivative: any constant of integration.
      const ref = pairs.reduce((best, p) => (Math.abs(p.a) + Math.abs(p.b) < Math.abs(best.a) + Math.abs(best.b) ? p : best));
      const shift = ref.a - ref.b;
      const off = pairs.find(({ a, b }) => Math.abs(a - b - shift) > 1e-6 * (1 + Math.abs(a) + Math.abs(b) + Math.abs(shift)));
      if (!off) {
        const same = Math.abs(shift) < 1e-9 * (1 + Math.abs(ref.a));
        return {
          verdict: 'correct',
          message: same ? (withC ? 'Correct ✓' : 'Correct ✓ (remember the + C)') : `Correct ✓ (it differs from ours by a constant, which the + C covers${withC ? '' : '; remember to write it'})`,
        };
      }
      // Where it goes wrong: the derivative of theirs against the integrand.
      const h = 1e-5;
      const slope = (e, x) => {
        const p = evaluateAt(e, v, x + h);
        const m = evaluateAt(e, v, x - h);
        return p === null || m === null ? null : (p - m) / (2 * h);
      };
      const dTyped = slope(expr, off.x);
      const integrand = slope(correct.expr, off.x);
      if (dTyped !== null && integrand !== null) {
        return { verdict: 'wrong', message: `Not quite: differentiate yours and compare. At ${v} = ${off.x} its derivative is ${fmt(dTyped)}, but the integrand is ${fmt(integrand)}.` };
      }
      return { verdict: 'wrong', message: 'Not quite: differentiating yours should give back the integrand.' };
    }
  } catch {
    return unreadable();
  }
  return unreadable();
}
