// Practice mode, the checker (1.70.0; docs/future-work/PLAN-PRACTICE-MODE.md).
//
// Three things, all in the solver worker (they need mathjs):
//   practiceKind(result)   which kind of answer a solved result has, if it is
//                          one practice can check: a number, the solutions of
//                          one equation, a derivative, an antiderivative;
//   readCorrect(result, topic, problem)
//                          the engine's answer in a form the checker uses;
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
// result names its own (routedTopic). `problem` is the text that was solved:
// a trig value has no variable in it, and an equation's sides are read from
// it for the "does not satisfy" message.
const hasVariable = (text) => /(?<![a-z])[a-df-z](?![a-z(])/i.test(String(text).replace(/\b(?:sin|cos|tan|sec|csc|cot|sqrt|cbrt|ln|log|exp|pi|abs|arcsin|arccos|arctan)\b/gi, ''));

export function practiceKind(result, topic, problem) {
  if (!result || result.status !== 'solved' || typeof result.answer !== 'string') return null;
  const answer = plain(result.answer);
  topic = result.routedTopic || topic;
  if (topic === 'algebra' && isSetAnswer(answer)) return { kind: 'intervals', variable: setVariable(answer, problem) };
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
    if (SYSTEM_PAIRS.test(answer) || SYSTEM_VALUES.test(answer)) return { kind: 'system' };
    const m = answer.match(/^([a-z]) = /);
    if (!m) return null;
    // One unknown, every clause "x = value".
    const clauses = answer.split(/\s+or\s+/);
    if (!clauses.every((c) => new RegExp(`^${m[1]} = [^=]+$`).test(c.trim()))) return null;
    return { kind: 'solutions', variable: m[1] };
  }
  if (topic === 'trigonometry') {
    // An equation: its solutions on one period, "…;  on [0, 2π): π/6, 5π/6".
    const period = answer.match(/^([a-z]) = .*;\s+on \[0°?, (2π|360°)\): (.+)$/);
    if (period) return { kind: 'solutions', variable: period[1], period: period[2] };
    // A value, sin(π/4) = √2/2: a number, when nothing in the problem varies.
    if (problem !== undefined && hasVariable(problem)) return null;
    return /^[-\d(√π]/.test(answer) && !/[a-z]{2,}/.test(dropAside(answer).replace(/\b(?:sqrt|pi)\b/g, '')) ? { kind: 'number' } : null;
  }
  if (topic === 'functions') {
    // The x-intercepts, a finite list or none: "x-intercepts at x = 1, 3".
    const zeros = answer.match(/(?:^|;\s*)(?:x-intercepts? at x = ([^;]+)|(no x-intercepts))(?:;|\.?$)/);
    const f = answer.match(/^f\(([a-z])\) = (.+?): /);
    if (!zeros || !f || (zeros[1] && /n/.test(zeros[1].replace(/\b(?:ln|sin|cos|tan)\b/g, '')))) return null;
    return { kind: 'solutions', variable: f[1], zeros: true };
  }
  if (topic === 'other') return /^[-\d(√π]/.test(answer) && !/[a-z]{2,}/.test(dropAside(answer).replace(/\b(?:sqrt|pi|ln)\b/g, '')) ? { kind: 'number' } : null;
  return null;
}

// A system's answer: "x = 18/5,  y = -2/5", or "(x, y) = (2, 3)  or  (3, 2)".
const SYSTEM_VALUES = /^[a-z] = [^,=]+(?:,\s+[a-z] = [^,=]+)+$/;
const SYSTEM_PAIRS = /^\([a-z](?:, [a-z])+\) = \(.+\)$/;

// What each kind asks for, under the practice problem.
const PROMPTS = {
  intervals: { prompt: 'Give the solution set.', placeholder: 'e.g. x < 2 or x ≥ 5, or (-∞, 2) ∪ [5, ∞)' },
  system: { prompt: 'Give every solution.', placeholder: 'e.g. x = 3, y = 2' },
};

// The sides of each equation in the problem, as mathjs reads them.
function equationsOf(problem) {
  if (!problem) return null;
  try {
    const eqs = String(problem).split(';').map((e) => e.split('='));
    if (eqs.some((e) => e.length !== 2)) return null;
    return eqs.map(([l, r]) => [typedExpr(l), typedExpr(r)]);
  } catch {
    return null;
  }
}

// { kind, variable, value | values | expr | intervals | solutions, shown,
// sides?, prompt?, placeholder? } or null when the answer cannot be read
// (practice then does not offer the problem).
export function readCorrect(result, topic, problem) {
  const kind = practiceKind(result, topic, problem);
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
    let texts;
    let sides = null;
    let prompt;
    let placeholder;
    if (kind.period) {
      // Degrees: the values are degrees, and the trig functions here read
      // radians, so no substitution message.
      const degrees = kind.period === '360°';
      texts = answer.match(/: ([^:]+)$/)[1].split(/,\s*/).map((t) => t.replace(/°/g, ''));
      prompt = `Give every solution in [0, ${degrees ? '360°' : '2π'}).`;
      placeholder = degrees ? 'e.g. 30, 150' : 'e.g. π/6, 5π/6';
      if (!degrees) sides = equationsOf(problem)?.[0] || null;
    } else if (kind.zeros) {
      const m = answer.match(/x-intercepts? at x = ([^;]+?)(?:;|\.?$)/);
      texts = m ? splitTop(m[1]) : [];
      const f = answer.match(/^f\([a-z]\) = (.+?): /)[1];
      sides = [engineExpr(f), '0'];
      prompt = 'Give every x-intercept (zero). Type none if there is none.';
      placeholder = 'e.g. 1, 3 (or none)';
    } else {
      texts = answer.split(/\s+or\s+/).map((c) => c.replace(/^\s*[a-z]\s*=\s*/, '').replace(/\s*\(repeated root[^)]*\)\s*$/, ''));
      sides = equationsOf(problem)?.[0] || null;
    }
    for (const t of texts) {
      const v = evaluateAt(engineExpr(dropAside(t)), null);
      if (v === null) return null;
      values.push(v);
    }
    return { ...kind, values: values.sort((a, b) => a - b), shown: answer, sides, prompt, placeholder };
  }
  if (kind.kind === 'intervals') {
    const intervals = parseSet(answer, engineExpr);
    if (!intervals) return null;
    return { ...kind, intervals, shown: answer, ...PROMPTS.intervals };
  }
  if (kind.kind === 'system') {
    let vars;
    let rows;
    if (SYSTEM_PAIRS.test(answer)) {
      const m = answer.match(/^\(([a-z](?:, [a-z])+)\) = (.+)$/);
      vars = m[1].split(', ');
      rows = m[2].split(/\s+or\s+/).map((t) => splitTop(t.trim().replace(/^\(|\)$/g, '')));
    } else {
      const pairs = answer.split(/,\s+(?=[a-z] = )/).map((c) => c.split(' = '));
      vars = pairs.map(([v]) => v);
      rows = [pairs.map(([, t]) => t)];
    }
    const solutions = [];
    for (const row of rows) {
      if (row.length !== vars.length) return null;
      const values = row.map((t) => evaluateAt(engineExpr(dropAside(t)), null));
      if (values.some((v) => v === null)) return null;
      solutions.push(values);
    }
    return { ...kind, vars, solutions, equations: equationsOf(problem), shown: answer, ...PROMPTS.system, placeholder: `e.g. ${vars.map((v, i) => `${v} = ${i + 2}`).join(', ')}` };
  }
  const expr = kind.kind === 'derivative'
    ? answer.replace(/^f'+\([a-z]\) = /, '').replace(/,\s*[a-z]\s*[≠<>≤≥].*$/, '').replace(/\s*\(does not exist where[^)]*\)\s*$/, '')
    : answer.replace(/^∫\(.*\) d[a-z] = /, '').replace(/\s*\+ C$/, '');
  const prepared = engineExpr(expr);
  const finite = SAMPLES.filter((x) => evaluateAt(prepared, kind.variable, x) !== null).length;
  if (finite < 4) return null;
  return { ...kind, expr: prepared, shown: expr };
}

// Split on commas outside brackets: "(1 - √5)/2, (1 + √5)/2".
function splitTop(text) {
  const out = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) { out.push(text.slice(at, i).trim()); at = i + 1; }
  }
  out.push(text.slice(at).trim());
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Solution sets of an inequality: [{ lo, hi, loClosed, hiClosed, loText, hiText }].

const ALL = /^(?:all real numbers(?: satisfy the inequality)?|all reals|every real number|ℝ|R|\(\s*-\s*∞\s*,\s*∞\s*\)|\(-inf(?:inity)?\s*,\s*inf(?:inity)?\))$/i;
const NONE = /^(?:no solution\b.*|none|no real solution|∅|\{\s*\})$/i;

function isSetAnswer(answer) {
  const a = answer.trim();
  if (ALL.test(a) || NONE.test(a)) return true;
  return /[<>≤≥≠]/.test(a) && !/=(?![^(]*\))/.test(a.replace(/[≤≥≠]/g, ''));
}

// The unknown: from the problem when there is one ("No solution" has no
// variable to read), else from the answer's inequalities.
function setVariable(answer, problem) {
  const fromProblem = String(problem || '').replace(/\b(?:sin|cos|tan|sqrt|abs|ln|log|exp|pi)\b/gi, '').match(/(?<![a-z])([a-df-z])(?![a-z])/i);
  if (fromProblem) return fromProblem[1];
  const fromAnswer = String(answer).match(/(?<![a-z])([a-z])(?![a-z])\s*[<>≤≥≠]|[<>≤≥]\s*([a-z])(?![a-z])/i);
  return fromAnswer ? fromAnswer[1] || fromAnswer[2] : 'x';
}

const INF = /^\+?(?:∞|inf(?:inity)?)$/i;
const NEG_INF = /^-\s*(?:∞|inf(?:inity)?)$/i;

// Interval notation or inequalities, joined by ∪, U or "or". `read` turns a
// number's text into mathjs syntax (the engine's text or a typed one).
function parseSet(text, read) {
  const t = String(text).replace(/−/g, '-').replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠').trim();
  if (ALL.test(t)) return [{ lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false }];
  if (NONE.test(t)) return [];
  const num = (raw) => {
    const u = raw.trim();
    if (INF.test(u)) return { v: Infinity };
    if (NEG_INF.test(u)) return { v: -Infinity };
    const v = evaluateAt(read(u), null);
    return v === null ? null : { v, text: u };
  };
  const out = [];
  const parts = /^[[(]/.test(t) ? t.split(/\s*(?:∪|\bU\b|\bor\b)\s*/) : t.split(/\s+or\s+|\s*,\s*(?=[a-z\d-])/i);
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    let m;
    if ((m = part.match(/^([[(])\s*([^,]+),\s*([^\])]+)([\])])$/))) {
      const lo = num(m[2]);
      const hi = num(m[3]);
      if (!lo || !hi) return null;
      out.push({ lo: lo.v, hi: hi.v, loClosed: m[1] === '[', hiClosed: m[4] === ']', loText: lo.text, hiText: hi.text });
    } else if ((m = part.match(/^(.+?)\s*([<≤])\s*[a-z]\s*([<≤])\s*(.+)$/))) {
      const lo = num(m[1]);
      const hi = num(m[4]);
      if (!lo || !hi) return null;
      out.push({ lo: lo.v, hi: hi.v, loClosed: m[2] === '≤', hiClosed: m[3] === '≤', loText: lo.text, hiText: hi.text });
    } else if ((m = part.match(/^[a-z]\s*([<≤>≥≠])\s*(.+)$/)) || (m = part.match(/^(.+?)\s*([<≤>≥])\s*[a-z]$/))) {
      const flipped = !/^[a-z]/.test(part);
      const op = flipped ? { '<': '>', '≤': '≥', '>': '<', '≥': '≤' }[m[2]] : m[1];
      const n = num(flipped ? m[1] : m[2]);
      if (!n) return null;
      if (op === '≠') {
        out.push({ lo: -Infinity, hi: n.v, loClosed: false, hiClosed: false, hiText: n.text }, { lo: n.v, hi: Infinity, loClosed: false, hiClosed: false, loText: n.text });
      } else if (op === '<' || op === '≤') {
        out.push({ lo: -Infinity, hi: n.v, loClosed: false, hiClosed: op === '≤', hiText: n.text });
      } else {
        out.push({ lo: n.v, hi: Infinity, loClosed: op === '≥', hiClosed: false, loText: n.text });
      }
    } else {
      return null;
    }
  }
  return out.sort((a, b) => a.lo - b.lo);
}

const inSet = (set, x) => set.some((i) => (x > i.lo || (i.loClosed && close(x, i.lo))) && (x < i.hi || (i.hiClosed && close(x, i.hi))) && !(close(x, i.lo) && !i.loClosed) && !(close(x, i.hi) && !i.hiClosed));

// ---------------------------------------------------------------------------
// The student's answer.

const close = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a) + Math.abs(b)) : a === b);

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

// "x < 2 or x ≥ 5" as typed; a leading "x ∈" or "x is in" goes.
const stripLabelSet = (text) => String(text).replace(/^\s*[a-z]\s*(?:∈|\bis in\b|\bin\b)\s*/i, '').trim();

// A system's solutions as typed: "x = 3, y = 2", "(3, 2)", "(2, 3) or (3, 2)",
// "x = 2, y = 3 or x = 3, y = 2". Each row is [{ value, places, text }] in
// the order of `vars`; null when it cannot be read.
function readTuples(text, vars) {
  const t = String(text).trim();
  const groups = t.split(/\s*(?:\bor\b|;)\s*/i).filter(Boolean);
  const rows = [];
  for (const group of groups) {
    let pieces;
    if (/=/.test(group)) {
      const found = {};
      for (const m of group.matchAll(/([a-z])\s*=\s*([^=]+?)(?=\s*(?:,|\band\b)?\s*[a-z]\s*=|$)/gi)) found[m[1].toLowerCase()] = m[2].replace(/[,\s]+$/, '').replace(/\band$/i, '').trim();
      if (vars.some((v) => found[v] === undefined)) return null;
      pieces = vars.map((v) => found[v]);
    } else {
      const inner = group.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
      // Several tuples in a row without "or": "(2, 3), (3, 2)".
      if (/\)\s*,\s*\(/.test(group)) {
        for (const tuple of group.split(/\)\s*,\s*\(/)) {
          const sub = readTuples(`(${tuple.replace(/^\(|\)$/g, '')})`, vars);
          if (!sub) return null;
          rows.push(...sub);
        }
        continue;
      }
      pieces = splitTop(inner);
    }
    if (pieces.length !== vars.length) return null;
    const row = [];
    for (const p of pieces) {
      const n = readNumber(p);
      if (!n) return null;
      row.push({ ...n, text: p });
    }
    rows.push(row);
  }
  return rows.length ? rows : null;
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
      const saysNone = /^(?:none|no (?:real )?(?:solutions?|zeros?|x-intercepts?|roots?)|∅|\{\s*\})\.?$/i.test(text);
      if (saysNone) {
        return correct.values.length === 0
          ? { verdict: 'correct', message: 'Correct ✓' }
          : { verdict: 'wrong', message: `Not quite: there ${correct.values.length === 1 ? `is ${correct.zeros ? 'an x-intercept' : 'a solution'}` : `are ${correct.zeros ? 'x-intercepts' : 'solutions'}`}. Check your working, or use Hint to see the next step.` };
      }
      // "2, 3", "x = 3 or x = 2", "x = -1/2 and x = 2", "3/2", "π/6, 5π/6", "30°"
      const pieces = text.split(/\s*(?:,|;|\bor\b|\band\b)\s*/i).map((p) => p.replace(new RegExp(`^\\s*${v}\\s*=\\s*`), '').trim()).filter(Boolean);
      const typedValues = [];
      for (const p of pieces) {
        const n = readNumber(p.replace(/°/g, ''));
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
      // Degrees where radians were asked for: 30, 150 for π/6, 5π/6.
      if (correct.period === '2π' && wrong.length && typedValues.length === correct.values.length
        && typedValues.every((t) => correct.values.some((c) => close(t.value * Math.PI / 180, c)))) {
        return { verdict: 'close', message: 'Those are the right angles in degrees; give them in radians (π/6, not 30).' };
      }
      if (wrong.length === 0 && missing === 0) {
        return rounded
          ? { verdict: 'close', message: 'Close, but give at least two decimal places, or the exact values.' }
          : { verdict: 'correct', message: 'Correct ✓' };
      }
      if (wrong.length) {
        const sides = correct.sides !== undefined ? correct.sides : equationSides(context.problem);
        const w = wrong[0];
        if (correct.values.length === 0) {
          return { verdict: 'wrong', message: correct.zeros ? `Not quite: f(${v}) is never 0, so there is no x-intercept. Type none.` : 'Not quite: there is no solution. Type none.' };
        }
        if (sides) {
          const l = evaluateAt(sides[0], v, w.value);
          const r = evaluateAt(sides[1], v, w.value);
          if (l !== null && r !== null) {
            return {
              verdict: 'wrong',
              message: correct.zeros
                ? `${v} = ${w.text} is not an x-intercept: f(${w.text}) = ${fmt(l)}, not 0.`
                : `${v} = ${w.text} does not satisfy the equation: there the left side is ${fmt(l)} and the right side is ${fmt(r)}.`,
            };
          }
        }
        return { verdict: 'wrong', message: `${v} = ${w.text} is not a solution. Check your working, or use Hint to see the next step.` };
      }
      const found = matched.size;
      return {
        verdict: 'partial',
        message: `${found === 1 ? 'That one is right' : `Those ${found} are right`}, but there ${missing === 1 ? `is one more ${correct.zeros ? 'x-intercept' : 'solution'}` : `are ${missing} more ${correct.zeros ? 'x-intercepts' : 'solutions'}`}.`,
      };
    }

    if (correct.kind === 'intervals') {
      const typedSet = parseSet(stripLabelSet(text), typedExpr);
      if (!typedSet) return { verdict: 'unreadable', message: 'MasterMath could not read that set. Write it as inequalities (x < 2 or x ≥ 5) or intervals ((-∞, 2) ∪ [5, ∞)).' };
      // Compare at the endpoints of both sets, between them, and beyond.
      const ends = [...new Set([...correct.intervals, ...typedSet].flatMap((i) => [i.lo, i.hi]).filter(Number.isFinite))].sort((a, b) => a - b);
      const points = ends.length === 0 ? [0] : [ends[0] - 1, ...ends.flatMap((e, i) => (i + 1 < ends.length ? [e, (e + ends[i + 1]) / 2] : [e])), ends[ends.length - 1] + 1];
      const named = (x) => {
        const hit = correct.intervals.flatMap((i) => [[i.lo, i.loText], [i.hi, i.hiText]]).find(([value, t]) => t && close(value, x));
        return hit ? hit[1] : fmt(x);
      };
      for (const x of points) {
        const truth = inSet(correct.intervals, x);
        if (truth === inSet(typedSet, x)) continue;
        const endpoint = ends.some((e) => close(e, x));
        return {
          verdict: endpoint ? 'close' : 'wrong',
          message: truth
            ? `${v} = ${named(x)} satisfies the inequality, but your answer leaves it out.${endpoint ? ' Check whether each endpoint is included.' : ''}`
            : `${v} = ${named(x)} is in your answer, but it does not satisfy the inequality.${endpoint ? ' Check whether each endpoint is included.' : ''}`,
        };
      }
      return { verdict: 'correct', message: 'Correct ✓' };
    }

    if (correct.kind === 'system') {
      const rows = readTuples(text, correct.vars);
      if (!rows) return { verdict: 'unreadable', message: `MasterMath could not read that. Write each solution as ${correct.vars.map((x, i) => `${x} = ${i + 2}`).join(', ')}, or as (${correct.vars.map((_, i) => i + 2).join(', ')}).` };
      const matched = new Set();
      const wrong = [];
      let rounded = false;
      for (const row of rows) {
        const hit = correct.solutions.findIndex((sol, i) => !matched.has(i) && sol.every((c, k) => compareNumber(row[k], c) !== 'wrong'));
        if (hit < 0) { wrong.push(row); continue; }
        if (correct.solutions[hit].some((c, k) => compareNumber(row[k], c) === 'close')) rounded = true;
        matched.add(hit);
      }
      const missing = correct.solutions.length - matched.size;
      if (!wrong.length && !missing) return rounded ? { verdict: 'close', message: 'Close, but give at least two decimal places, or the exact values.' } : { verdict: 'correct', message: 'Correct ✓' };
      if (wrong.length) {
        const row = wrong[0];
        const label = `(${row.map((r) => r.text).join(', ')})`;
        const scope = Object.fromEntries(correct.vars.map((name, k) => [name, row[k].value]));
        const failing = (correct.equations || []).findIndex(([l, r]) => {
          try { return !close(Number(math.evaluate(l, scope)), Number(math.evaluate(r, scope))); } catch { return false; }
        });
        if (failing >= 0) {
          const [l, r] = correct.equations[failing];
          const lv = Number(math.evaluate(l, scope));
          const rv = Number(math.evaluate(r, scope));
          const nth = ['first', 'second', 'third', 'fourth'][failing] || `number ${failing + 1}`;
          return { verdict: 'wrong', message: `${label} does not satisfy the ${nth} equation: there the left side is ${fmt(lv)} and the right side is ${fmt(rv)}.` };
        }
        return { verdict: 'wrong', message: `${label} is not a solution. Check your working, or use Hint to see the next step.` };
      }
      return { verdict: 'partial', message: `${matched.size === 1 ? 'That one is right' : `Those ${matched.size} are right`}, but there ${missing === 1 ? 'is one more solution' : `are ${missing} more solutions`}.` };
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
