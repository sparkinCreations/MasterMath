// Practice mode, the problems (1.70.0; docs/future-work/PLAN-PRACTICE-MODE.md).
//
// A practice problem is the solved one with new numbers, solved by the same
// engine and kept only when it is the same kind of problem: the same method
// (the first Key Insight, which tests/tipsByMethod.test.js keeps distinct
// per method), an answer as clean as the original's, and an answer the
// checker can read. Candidate i is a pure function of (problem, topic, i):
// a seeded generator, so every student gets the same set in the same order.
//
// Two ways to change the numbers:
//   literal remap — each whole number maps to a new one, the same number to
//     the same new one everywhere (x → 1 and (x − 1) stay together); a
//     square or cube of another number in the problem stays its square or
//     cube ((x² − 4)/(x − 2) at 2 becomes (x² − 9)/(x − 3) at 3); exponents
//     and 0 never change;
//   root rebuild — P(x) = 0 with every root rational: new roots, the same
//     leading coefficient, written out in standard form, so a factorable
//     quadratic stays factorable.

import { solveProblem } from '../api.js';
import { stripMathMarkers } from '../solvers/solverUtils.js';
import { readPolynomial } from '../solvers/polynomialRoots.js';
import { createMath } from '../mathInstance.js';
import { matchingParen, parseMathExpression } from '../mathParser.js';
import { readCorrect } from './check.js';

export const POOL_SIZE = 5;
export const MAX_CANDIDATES = 40;

let exactMath = null;
const ex = () => { if (!exactMath) exactMath = createMath({ number: 'Fraction' }); return exactMath; };

// FNV-1a, then mulberry32: a small, well-mixed seeded generator.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ---------------------------------------------------------------------------
// Literal remap.

// Index ranges [start, end) of exponents: "^2", "^(1/2)", "^-3". The bounds
// of a definite integral, ∫_0^1, are not exponents.
function protectedRanges(text) {
  const ranges = [];
  const bounds = [];
  for (const m of text.matchAll(/(?:∫|\bint)\s*_\s*(\{?[-\w.π]+\}?)\s*\^\s*(\{?[-\w.π∞]+\}?)/g)) bounds.push([m.index, m.index + m[0].length]);
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '^') continue;
    if (bounds.some(([s, e]) => i >= s && i < e)) continue;
    let j = i + 1;
    while (text[j] === ' ') j += 1;
    if (text[j] === '(') {
      const close = matchingParen(text, j);
      ranges.push([j, close < 0 ? text.length : close + 1]);
    } else {
      let k = j;
      if (text[k] === '-' || text[k] === '+') k += 1;
      while (k < text.length && /[\d.]/.test(text[k])) k += 1;
      ranges.push([j, k]);
    }
  }
  return ranges;
}

// Whole-number literals that may change. With `exponents`, a whole-number
// exponent of 2 or more may too (x³ → x⁵: the power rule is the same method;
// the method check rejects a change that is not).
function literals(text, { exponents = false } = {}) {
  const ranges = protectedRanges(text);
  const out = [];
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const at = m.index;
    if (m[0].includes('.')) continue;
    if (at > 0 && /[a-zA-Z_]/.test(text[at - 1])) continue; // log10, x2
    const value = Number(m[0]);
    const inExponent = ranges.some(([s, e]) => at >= s && at < e);
    if (inExponent && !(exponents && value >= 2 && /\^\s*$/.test(text.slice(0, at)))) continue;
    if (value === 0) continue;
    out.push({ at, length: m[0].length, value, exponent: inExponent });
  }
  return out;
}

const perfectRoot = (v, p) => {
  const r = Math.round(v ** (1 / p));
  return r >= 2 && r ** p === v ? r : null;
};

// A problem with a variable keeps squares and cubes of its numbers; plain
// arithmetic does not ((5 + 3)·4 − 2³ is not about 4 being 2²).
function remapValues(values, rng, { algebraic = true } = {}) {
  const map = new Map();
  const used = new Set();
  const take = (v, w) => { map.set(v, w); used.add(w); };
  const fresh = (v) => {
    for (let tries = 0; tries < 30; tries += 1) {
      // A lone 1 always changes; beside other numbers it often stays (x − 1).
      const w = v === 1 ? (values.length > 1 && rng() < 0.5 ? 1 : pick(rng, 2, 7)) : v <= 12 ? pick(rng, Math.max(2, v - 3), v + 6) : pick(rng, Math.max(2, v - 6), v + 6);
      if ((w !== v || (v === 1 && values.length > 1)) && !used.has(w)) return w;
    }
    return null;
  };
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  // Plain numbers first; then each square or cube of one already mapped.
  const derived = (v) => (algebraic ? [2, 3].map((p) => ({ p, r: perfectRoot(v, p) })).find(({ r }) => r !== null && sorted.includes(r)) : null);
  for (const v of sorted) {
    if (derived(v)) continue;
    const sq = algebraic ? perfectRoot(v, 2) : null;
    if (sq !== null && v >= 4) {
      // A lone square stays a square: x^2 = 9 → x^2 = 16.
      let k = null;
      for (let t = 0; t < 20 && k === null; t += 1) { const c = pick(rng, 2, 9); if (c !== sq && !used.has(c * c)) k = c; }
      if (k === null) return null;
      take(v, k * k);
      continue;
    }
    const w = fresh(v);
    if (w === null) return null;
    take(v, w);
  }
  for (const v of sorted) {
    const d = derived(v);
    if (!d) continue;
    const w = map.get(d.r) ** d.p;
    take(v, w);
  }
  return map;
}

const algebraicText = (text) => /(?<![a-z])[a-df-z](?![a-z])/i.test(text.replace(/\b(?:lim|int|dx|d\/d[a-z])\b/g, ''));

export function literalRemap(text, rng, { exponents = false } = {}) {
  const lits = literals(text, { exponents });
  // Exponents are their own numbers: x² and a coefficient 2 change apart.
  const plainLits = lits.filter((l) => !l.exponent);
  const powLits = lits.filter((l) => l.exponent);
  if (exponents && powLits.length === 0) return null;
  if (lits.length === 0) return null;
  const map = remapValues(plainLits.map((l) => l.value), rng, { algebraic: algebraicText(text) });
  const powMap = new Map();
  for (const v of new Set(powLits.map((l) => l.value))) {
    let w = v;
    for (let t = 0; t < 10 && w === v; t += 1) w = pick(rng, 2, 7);
    powMap.set(v, w);
  }
  if (!map) return null;
  let out = '';
  let at = 0;
  for (const l of lits) {
    out += text.slice(at, l.at) + String((l.exponent ? powMap : map).get(l.value));
    at = l.at + l.length;
  }
  out += text.slice(at);
  return out === text ? null : out;
}

// A number inside a function of the bare variable: sin(x)/x → sin(3x)/x,
// e^x → e^(2x), the same number everywhere (sin(x)·cos(x) → sin(2x)·cos(2x)).
// For a problem whose only number is structural (lim x → 0 sin(x)/x had no
// practice problems at all).
export function withInsideCoefficient(text, rng) {
  // The variable: the one after d/d or "lim", else x when it appears.
  const named = text.match(/\bd\/d([a-z])\b|\blim\s*_?\s*\(?\s*([a-z])\s*(?:->|→)/);
  const v = named ? named[1] || named[2] : /(?<![a-z])x(?![a-z])/.test(text) ? 'x' : null;
  if (!v) return null;
  const k = pick(rng, 2, 7);
  const fn = new RegExp(`\\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|ln|exp|sqrt)\\(\\s*${v}\\s*\\)`, 'g');
  const exp = new RegExp(`\\be\\^(?:\\(\\s*${v}\\s*\\)|${v}(?![\\w(^]))`, 'g');
  const out = text.replace(fn, `$1(${k}${v})`).replace(exp, `e^(${k}${v})`);
  return out === text ? null : out;
}

// A coefficient in front of the function: d/dx x³ → d/dx 4x³, ∫ x·eˣ dx →
// ∫ 3x·eˣ dx. For a derivative or an integral with no number to change.
export function withCoefficient(text, rng) {
  const head = text.match(/^(\s*(?:d\/d[a-z]\s*|(?:∫|int)(?:\s*_\s*\S+?\s*\^\s*\S+)?\s+|(?:the\s+)?(?:derivative|integral)\s+of\s+)?)/i);
  const at = head ? head[0].length : 0;
  const rest = text.slice(at);
  if (!/^[a-z(√]/i.test(rest)) return null;
  // The whole expression scales: a sum needs brackets. Up to "dx" or " at ".
  const end = rest.search(/\s+d[a-z]\s*$|\s+at\s+[a-z]\s*=|\s*$/);
  const body = rest.slice(0, end);
  const tail = rest.slice(end);
  const k = pick(rng, 2, 7);
  const sum = /[+-]/.test(body.replace(/\([^()]*\)/g, '').replace(/\^-/g, '^'));
  return `${text.slice(0, at)}${k}${sum ? `(${body})` : body}${tail}`;
}

// ---------------------------------------------------------------------------
// Root rebuild: P(x) = 0 with rational roots.

function polynomialText(coeffs, v) {
  // coeffs: BigInt, lowest first.
  const terms = [];
  for (let d = coeffs.length - 1; d >= 0; d -= 1) {
    const c = coeffs[d];
    if (c === 0n) continue;
    const mag = c < 0n ? -c : c;
    const body = d === 0 ? String(mag) : `${mag === 1n ? '' : String(mag)}${v}${d === 1 ? '' : `^${d}`}`;
    terms.push(terms.length === 0 ? `${c < 0n ? '-' : ''}${body}` : ` ${c < 0n ? '-' : '+'} ${body}`);
  }
  return terms.join('');
}

// The forms it rebuilds: P = 0 (an equation), P < 0 and the like (an
// inequality: the roots are its endpoints), and P alone (a function: the
// roots are its x-intercepts).
export function rootRebuild(text, rng, correct) {
  if (!correct || !['solutions', 'intervals'].includes(correct.kind) || correct.period) return null;
  const rel = text.match(/^(.*?)\s*(=|<=|>=|<|>|≤|≥)\s*0\s*$/);
  if (rel ? (correct.kind === 'solutions') !== (rel[2] === '=') : !correct.zeros) return null;
  const lhs = rel ? rel[1] : text;
  const v = correct.variable;
  const P = readPolynomial(lhs.replace(new RegExp(`(\\d)\\s*${v}`, 'g'), `$1*${v}`), v);
  if (!P || P.tooHigh || P.degree < 1 || P.degree > 4) return null;
  const rootValues = correct.kind === 'intervals'
    ? [...new Set(correct.intervals.flatMap((i) => [i.lo, i.hi]).filter(Number.isFinite))]
    : correct.values;
  if (rootValues.length !== P.degree) return null;
  const roots = [];
  for (const value of rootValues) {
    let found = null;
    for (let q = 1; q <= 12 && !found; q += 1) {
      const p = Math.round(value * q);
      if (Math.abs(p / q - value) < 1e-9) found = { p, q };
    }
    if (!found) return null;
    roots.push(found);
  }
  const mags = roots.map((r) => Math.abs(r.p)).filter((m) => m > 0);
  const map = remapValues(mags, rng);
  if (!map) return null;
  const F = (n, d = 1) => ex().fraction(n, d);
  const lead = ex().fraction(P.coefficients[P.degree].toFraction());
  let poly = [lead];
  const seen = new Set();
  for (const { p, q } of roots) {
    const np = p === 0 ? 0 : Math.sign(p) * map.get(Math.abs(p));
    const r = F(np, q);
    const key = r.toFraction();
    if (seen.has(key)) return null;
    seen.add(key);
    // poly · (x − r)
    const next = Array.from({ length: poly.length + 1 }, () => F(0));
    poly.forEach((c, i) => { next[i + 1] = next[i + 1].add(c); next[i] = next[i].sub(c.mul(r)); });
    poly = next;
  }
  // Whole-number coefficients, the leading one's sign kept.
  const lcm = poly.reduce((acc, c) => { const d = BigInt(c.d); const g = (a, b) => (b === 0n ? a : g(b, a % b)); return (acc * d) / g(acc, d); }, 1n);
  let ints = poly.map((c) => (BigInt(c.s) * BigInt(c.n) * lcm) / BigInt(c.d));
  const g = (a, b) => (b === 0n ? (a < 0n ? -a : a) : g(b, a % b));
  const common = ints.reduce((acc, c) => g(acc, c), 0n) || 1n;
  // Keep the original's leading coefficient when it was a whole number.
  if (lead.d === 1n && lcm === 1n) ints = poly.map((c) => BigInt(c.s) * BigInt(c.n));
  else ints = ints.map((c) => c / common);
  const out = rel ? `${polynomialText(ints, v)} ${rel[2]} 0` : polynomialText(ints, v);
  return out.replace(/\s+/g, '') === text.replace(/\s+/g, '') ? null : out;
}

// ---------------------------------------------------------------------------
// Trigonometry: special angles and special values, so an exact answer stays
// exact (sin(π/4) → sin(π/3); 2sin(x) = 1 → 2sin(x) = √3).

// Special values as [sign, numerator, root, denominator]: √3/2 is [1, 1, 3, 2].
const SIN_COS_VALUES = [[1, 0, 1, 1], [1, 1, 1, 2], [1, 1, 2, 2], [1, 1, 3, 2], [1, 1, 1, 1], [-1, 1, 1, 2], [-1, 1, 2, 2], [-1, 1, 3, 2], [-1, 1, 1, 1]];
const TAN_VALUES = [[1, 0, 1, 1], [1, 1, 1, 1], [1, 1, 3, 1], [1, 1, 3, 3], [-1, 1, 1, 1], [-1, 1, 3, 1]];
// c times a special value, as text: 2·√3/2 → "sqrt(3)", 2·1/2 → "1".
function specialText([sign, num, root, den], c = 1) {
  if (num === 0) return '0';
  let n = num * c;
  let d = den;
  const g = (a, b) => (b ? g(b, a % b) : a);
  const k = g(n, d);
  n /= k; d /= k;
  const body = `${n === 1 && root > 1 ? '' : n}${root > 1 ? `sqrt(${root})` : ''}${d > 1 ? `/${d}` : ''}`;
  return `${sign < 0 ? '-' : ''}${body}`;
}
const DEGREES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

export function trigSpecials(text, rng, correct) {
  if (!/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*\(/.test(text)) return null;
  let out = text;
  // π/k with k ∈ {2, 3, 4, 6}: sin(π/4) → sin(2π/3).
  // An angle stays in its quadrant: the first quadrant is a value to
  // remember, the others a reference angle (another method, another tip).
  const quadrant = (deg) => (deg <= 90 ? 0 : 1);
  const g = (a, b) => (b ? g(b, a % b) : a);
  out = out.replace(/(\d*)\s*\*?\s*(pi|π)\s*\/\s*(\d+)/g, (m, num, pi, den) => {
    const was = ((Number(num) || 1) / Number(den)) * 180;
    const choices = [];
    for (const k of [2, 3, 4, 6]) for (let n = 1; n < 2 * k; n += 1) if (g(n, k) === 1 && quadrant((n / k) * 180) === quadrant(was) && Math.abs((n / k) * 180 - was) > 1e-9) choices.push([n, k]);
    if (!choices.length) return m;
    const [n, k] = choices[pick(rng, 0, choices.length - 1)];
    return `${n === 1 ? '' : n}${pi}${k === 1 ? '' : `/${k}`}`;
  });
  // Degrees: 60° → another special angle in the same quadrant.
  out = out.replace(/(\d+)\s*°/g, (m, d) => {
    const choices = DEGREES.filter((x) => x !== Number(d) && quadrant(x) === quadrant(Number(d)));
    return choices.length ? `${choices[pick(rng, 0, choices.length - 1)]}°` : m;
  });
  // An equation's right side: another special value of the same function.
  if (correct?.period) {
    // c·f(…) = value: the new value is c times a special one (2sin(x) = 1 →
    // 2sin(x) = √3), so sin(x) is still a special value.
    const eq = out.match(/^\s*(?:(\d+)\s*\*?\s*)?((sin|cos|tan)\s*\([^()]*\))\s*=\s*([^=]+)$/);
    if (eq && !/[a-z]/i.test(eq[4].replace(/\b(?:sqrt|pi)\b/g, ''))) {
      const list = eq[3] === 'tan' ? TAN_VALUES : SIN_COS_VALUES;
      const choice = specialText(list[pick(rng, 0, list.length - 1)], Number(eq[1] || 1));
      out = `${eq[1] || ''}${eq[2]} = ${choice}`;
    }
  }
  return out === text ? null : out;
}

// ---------------------------------------------------------------------------
// A system: new whole-number solutions, new coefficients, and the right
// sides worked out from them, so the answer stays as clean as the original.

export function systemRebuild(text, rng, correct) {
  if (!correct || correct.kind !== 'system' || correct.solutions.length === 0) return null;
  const eqs = text.split(';').map((e) => e.split('='));
  if (eqs.some((e) => e.length !== 2)) return null;
  // Every right side a plain number, every solution value a whole number.
  if (eqs.some(([, r]) => !/^\s*-?\d+(?:\/\d+)?\s*$/.test(r))) return null;
  // The new solution: each value remapped, a fraction replaced by a whole
  // number (x = 18/5, y = −2/5 → x = 3, y = −1), the signs kept.
  const first = correct.solutions[0];
  const whole = first.filter((x) => Number.isInteger(x) && x !== 0).map(Math.abs);
  const map = remapValues(whole, rng);
  if (!map) return null;
  const used = new Set(map.values());
  const scope = {};
  correct.vars.forEach((v, k) => {
    const x = first[k];
    if (x === 0) { scope[v] = 0; return; }
    let w = Number.isInteger(x) ? map.get(Math.abs(x)) : null;
    for (let t = 0; t < 20 && (w === null || (!Number.isInteger(x) && used.has(w))); t += 1) w = pick(rng, 1, 6);
    used.add(w);
    scope[v] = Math.sign(x) * w;
  });
  const lhsText = eqs.map(([l]) => l.trim()).join(' ; ');
  const newLhs = (literalRemap(lhsText, rng) || lhsText).split(' ; ');
  const rows = [];
  for (const l of newLhs) {
    let value;
    try { value = ex().evaluate(parseMathExpression(l), Object.fromEntries(Object.entries(scope).map(([k, x]) => [k, ex().fraction(x)]))); } catch { return null; }
    const f = ex().fraction(value);
    rows.push(`${l} = ${f.toFraction()}`);
  }
  const out = rows.join('; ');
  return out.replace(/\s+/g, '') === text.replace(/\s+/g, '') ? null : out;
}

// ---------------------------------------------------------------------------
// The fingerprint a candidate must match.

const plain = (t) => stripMathMarkers(String(t ?? ''));

// What an answer is made of: a fraction, a root, π, a logarithm, e, a
// decimal, an approximation, i. A practice answer may use only what the
// original's does.
export function answerFeatures(answer, kind) {
  const main = plain(answer).replace(/\((?:≈|=)[^()]*\)/g, '').replace(/^.*?(?:=)\s*(?=[^=]*$)/, '');
  const f = new Set();
  // Every function the answer uses: a practice answer needs no new one
  // (1/(x⁴ − 1) brings in an arctan that 1/(x² − 1) does not).
  for (const m of main.matchAll(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|erf)\b/g)) f.add(`fn:${m[1]}`);
  // A number answer keeps its sign: 24 does not become −168.
  if (kind === 'number' && /^\s*[-−]/.test(main)) f.add('negative');
  if (/\d\s*\/\s*[\d(]|\)\s*\/\s*\d/.test(main)) f.add('fraction');
  if (/√|sqrt|cbrt|\^\(\d+\/\d+\)/.test(main)) f.add('root');
  if (/π|\bpi\b/.test(main)) f.add('pi');
  if (/\bln\b|\blog\b/.test(main)) f.add('log');
  if (/(?<![a-z])e(?![a-z])/.test(main)) f.add('e');
  if (/\d\.\d/.test(main)) f.add('decimal');
  if (/≈/.test(main)) f.add('approx');
  if (/(?<![a-z])i(?![a-z])/.test(main)) f.add('complex');
  return f;
}
const biggest = (answer) => Math.max(0, ...[...plain(answer).replace(/\((?:≈|=)[^()]*\)/g, '').matchAll(/\d+/g)].map((m) => Number(m[0])));

export function fingerprint(result, topic, problem) {
  const correct = readCorrect(result, topic, problem);
  if (!correct) return null;
  return {
    topic: result.routedTopic || topic,
    kind: correct.kind,
    // The method's words, its formulas set aside: "Remember both quadrants
    // where sin takes the value ⟦1/2⟧" is the same method for ⟦√3/2⟧.
    lead: String(result.tips?.[0] ?? '').replace(/⟦[^⟧]*⟧/g, '⟦⟧'),
    features: answerFeatures(result.answer, correct.kind),
    count: correct.kind === 'solutions' ? correct.values.length : correct.kind === 'intervals' ? correct.intervals.length : correct.kind === 'system' ? correct.solutions.length : 1,
    steps: (result.steps || []).length,
    biggest: biggest(result.answer),
    correct,
  };
}

// Why a solved candidate is not kept (null when it is).
export function mismatch(fp, result, topic, problem) {
  if (!result || result.status !== 'solved') return 'not solved';
  const other = fingerprint(result, topic, problem);
  if (!other) return 'answer not checkable';
  if (other.topic !== fp.topic || other.kind !== fp.kind) return 'another kind of problem';
  if (other.lead !== fp.lead) return 'another method';
  // A trig value is a root or a fraction by nature (tan(π/6) = √3/3).
  const inherent = fp.topic === 'trigonometry' ? new Set(['root', 'fraction']) : new Set();
  for (const f of other.features) if (!fp.features.has(f) && !inherent.has(f)) return `a ${f} in the answer`;
  if (other.count !== fp.count) return 'another number of solutions';
  if (Math.abs(other.steps - fp.steps) > Math.max(2, Math.round(fp.steps * 0.3))) return 'different working';
  if (other.biggest > Math.max(50, 10 * fp.biggest)) return 'numbers too large';
  return null;
}

// ---------------------------------------------------------------------------
// The worker's task: candidate number `index` of the set for this problem.

const originals = new Map(); // problem|topic → fingerprint (or null): one solve per set

// Candidate i: a root rebuild, the numbers, the exponents, or a coefficient
// in front, by turn; the next way when one has nothing to change.
export function candidateText(problem, topic, index, correct) {
  const rng = seeded(hash(`${problem}|${topic}|${index}`));
  const ways = [
    () => rootRebuild(problem, rng, correct),
    () => systemRebuild(problem, rng, correct),
    () => trigSpecials(problem, rng, correct),
    // A trig angle changes only to another special angle (trigSpecials).
    () => (topic === 'trigonometry' && /pi|π|°/.test(problem) ? null : literalRemap(problem, rng)),
    // A new exponent keeps the power rule's method; elsewhere (x² − 5x + 6 ≤
    // 0 → x³ − 11x + 4 ≤ 0) it is a harder problem, and was 45 s to solve.
    () => (['derivatives', 'integrals', 'limits', 'other'].includes(topic) ? literalRemap(problem, rng, { exponents: true }) : null),
    () => (['derivatives', 'integrals'].includes(topic) ? withCoefficient(problem, rng) : null),
    () => withInsideCoefficient(problem, rng),
  ];
  for (let k = 0; k < ways.length; k += 1) {
    const text = ways[(index + k) % ways.length]();
    if (text) return text;
  }
  return null;
}

export async function practiceCandidate({ problem, topic, index }) {
  const key = `${topic}|${problem}`;
  if (!originals.has(key)) {
    const original = await solveProblem(problem, topic);
    originals.set(key, fingerprint(original, topic, problem));
    if (originals.size > 20) originals.delete(originals.keys().next().value);
  }
  const fp = originals.get(key);
  if (!fp) return { practicable: false };
  const text = candidateText(problem, fp.topic, index, fp.correct);
  if (!text || text.replace(/\s+/g, '') === problem.replace(/\s+/g, '')) return { practicable: true, item: null, reason: 'no new numbers' };
  const result = await solveProblem(text, fp.topic);
  const why = mismatch(fp, result, fp.topic, text);
  if (why) return { practicable: true, item: null, reason: why, problem: text };
  return { practicable: true, item: { problem: text, topic: fp.topic, result, correct: readCorrect(result, fp.topic, text) } };
}
