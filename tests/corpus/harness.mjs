// Regression harness over the July and September 2026 evaluation corpora.
//
// Reads docs/evaluations/2026-07/mastermath_evaluation.csv (91 problems),
// tests/corpus/additions.csv and docs/evaluations/2026-09/
// mastermath_evaluation_v1.29.csv (149 problems), and re-runs each input
// through the real solvers, grading
// by MATH EQUIVALENCE rather than string match — several correct answers are
// format-divergent (1/(cos(x)^2) vs sec^2(x)), so assert.equal would false-alarm.
//
// Each row resolves to one of:
//   CORRECT     — answer is mathematically equal to the expected value
//   WRONG       — answer disagrees (a real bug, or a confidently-wrong answer)
//   REFUSED     — solver declined ("Unable to…", "Does not exist" where the
//                 expected value is also DNE). A pass for unbuilt-feature rows.
//   SKIP        — not auto-gradable here (Functions/Graphing feature analysis
//                 is Wave 2; those rows are graded manually in the eval)
//
// Run: node tests/corpus/harness.mjs        (scoreboard)
//      node tests/corpus/harness.mjs --wrong (only show WRONG/unexpected rows)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { math } from '../../src/lib/solvers/solverUtils.js';
import { solveProblem } from '../../src/lib/api.js';
import { saveSettings, resetSettings } from '../../src/lib/settings.js';

// settings.js persists through localStorage, which Node lacks; an in-memory
// stand-in lets "[angle unit: degrees]" rows run under that setting.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

// Route each row through the real app entry point so parser/pipeline bugs
// (e.g. `7!` -> `7`) are exercised, exactly as a user hits them.
const TOPIC = {
  derivatives: 'derivatives',
  integrals: 'integrals',
  limits: 'limits',
  algebra: 'algebra',
  trigonometry: 'trigonometry',
  functions: 'functions',
  arithmetic: 'other',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '../../docs/evaluations/2026-07/mastermath_evaluation.csv');

// Post-evaluation acceptance rows: bugs found after the original evaluation
// (production audits, user reports) land here, citing their source in the
// Classification column — the original evaluation artifact stays pristine.
const ADDITIONS = path.resolve(__dirname, 'additions.csv');

// Documented errors in the external evaluation corpus itself — cases where the
// solver is right and the CSV's "expected" is wrong. We correct the expected
// here (with the reason) rather than editing the external artifact or, worse,
// "fixing" a correct solver to match a bad expectation.
const CORPUS_CORRECTIONS = {
  'lim x→0 (x-2)/abs(x-2)': {
    expected: '-1',
    reason: '(x-2)/|x-2| = -1 for all x<2, so the x→0 limit is -1, not DNE. The eval report text discusses x→2 (which does DNE); the CSV row says x→0.',
  },
  '2x+3y=6; x-y=4 (system)': {
    expected: 'x=3.6, y=-0.4',
    reason: 'The eval CSV lists x=2.8, but 2x+3y=6 and x-y=4 give x=18/5=3.6, y=-2/5=-0.4 (verify: 2(3.6)+3(-0.4)=6 ✓, 3.6-(-0.4)=4 ✓). The app now solves it exactly.',
  },
};

// --- tiny CSV parser (handles quoted fields with commas) --------------------
function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells.map((s) => s.trim()));
  }
  return rows;
}

// --- normalization helpers --------------------------------------------------

// Turn textbook notation into something math.evaluate can read.
function normalizeExpr(s) {
  return String(s)
    .replace(/√\s*/g, 'sqrt')      // √2 -> sqrt2 ... handled below
    .replace(/sqrt(\d)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/·/g, '*')
    .replace(/\^\(/g, '^(')
    .replace(/e\^/g, 'exp')        // e^x -> expx (then fix parens)
    .replace(/\s+/g, '');
}

// Parse an expected scalar answer to a number, or null if it isn't a scalar.
function toNumber(raw) {
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^≈\s*/, '').replace(/\.\.\.$/, '');
  // Exact-form answers carry the decimal alongside: "5√2 (≈ 7.0711)",
  // "1/2 (= 0.5)", "e^2 ≈ 7.3891". Grade the exact part.
  s = s.replace(/\s*\((?:≈|=)[^)]*\)\s*$/, '');
  s = s.replace(/\s*≈\s*[-\d.]+\s*$/, '');
  s = s.replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/−/g, '-');
  s = s.replace(/sqrt(\d+)/g, 'sqrt($1)');
  // strip a leading "x=" or "f(-2) =" label, and a degree sign
  s = s.replace(/^[a-z]\s*=\s*/i, '').replace(/^[a-z]'*\([^)]*\)\s*=\s*/i, '').replace(/°$/, '');
  try {
    const v = math.evaluate(s);
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Seven hand-picked points plus 40 from a fixed-seed generator over
// [−10, 10]. Seven alone could be beaten by an answer that agrees with the
// expected value only at those points (an outside review, October 2026);
// the seed keeps every run identical.
function seededPoints(n, seed) {
  let s = seed >>> 0;
  return Array.from({ length: n }, () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.round((s / 2 ** 32 * 20 - 10) * 1e4) / 1e4;
  });
}
const SAMPLE_POINTS = [0.37, 0.83, 1.29, 2.11, -0.71, -1.53, 3.4, ...seededPoints(40, 20261012)];

// Are two single-variable expressions equal? Sample at many points.
function exprEquivalent(a, b, variable = 'x') {
  const na = prepForEval(a);
  const nb = prepForEval(b);
  if (na === null || nb === null) return false;
  let agree = 0;
  let seen = 0;
  for (const x of SAMPLE_POINTS) {
    let ya;
    let yb;
    try { ya = Number(math.evaluate(na, { [variable]: x })); } catch { continue; }
    try { yb = Number(math.evaluate(nb, { [variable]: x })); } catch { continue; }
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) continue;
    seen += 1;
    if (Math.abs(ya - yb) < 1e-6 * (1 + Math.abs(ya))) agree += 1;
  }
  return seen >= 3 && agree === seen;
}

// Are two expressions in x and y equal? Sample (x, y) pairs off the same
// fixed points.
function expr2Equivalent(a, b) {
  const na = prepForEval(a);
  const nb = prepForEval(b);
  if (na === null || nb === null) return false;
  let agree = 0;
  let seen = 0;
  SAMPLE_POINTS.forEach((x, i) => {
    const y = SAMPLE_POINTS[(i + 3) % SAMPLE_POINTS.length];
    let ya;
    let yb;
    try { ya = Number(math.evaluate(na, { x, y })); yb = Number(math.evaluate(nb, { x, y })); } catch { return; }
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) return;
    seen += 1;
    if (Math.abs(ya - yb) < 1e-6 * (1 + Math.abs(ya))) agree += 1;
  });
  return seen >= 3 && agree === seen;
}

// Convert an answer/expected string into an evaluable expression, or null.
function prepForEval(s) {
  let out = String(s)
    .replace(/√/g, 'sqrt')
    .replace(/−/g, '-')            // unicode minus from exact-form answers
    .replace(/π/g, 'pi')
    .replace(/·/g, '*')
    // ln|EXPR| -> log((EXPR))  (do this before stripping bars / generic ln)
    // (?<![a-z]) not \b: "2ln|x + 1|" has no word boundary before the l.
    .replace(/(?<![a-z])ln\s*\|([^|]+)\|/gi, 'log(($1))')
    .replace(/(?<![a-z])ln\b/g, 'log') // natural log for math.evaluate
    .replace(/\barcsin\b/g, 'asin') // mathjs names for inverse trig
    .replace(/\barccos\b/g, 'acos')
    .replace(/\barctan\b/g, 'atan')
    .replace(/\|/g, '')            // any remaining bars
    .trim();
  out = out.replace(/sqrt(\w+)/g, 'sqrt($1)');
  // e^(...) or e^x  -> exp(...)
  out = out.replace(/e\^\(([^)]*)\)/g, 'exp($1)').replace(/e\^(\w+)/g, 'exp($1)');
  // log x -> log(x)
  out = out.replace(/log(?!\()\s*([a-z0-9]+)/gi, 'log($1)');
  // sec^2(x) -> sec(x)^2  (function-name-with-exponent notation)
  out = out.replace(/\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\^(\d+)\(([^()]*)\)/gi, '$1($3)^$2');
  if (!out) return null;
  return out;
}

// Two antiderivatives are equivalent iff they differ by a constant. Sample
// (F - E) at several points and require it to be constant. Handles both the
// "+ C" and format divergence (log(x) vs ln|x|).
function antiderivEquivalent(F, E, variable = 'x') {
  const nf = prepForEval(String(F).replace(/\+\s*C\s*$/, ''));
  const ne = prepForEval(String(E).replace(/\+\s*C\s*$/, ''));
  if (nf === null || ne === null) return false;
  const diffs = [];
  for (const x of SAMPLE_POINTS) {
    let a;
    let b;
    try { a = Number(math.evaluate(nf, { [variable]: x })); } catch { continue; }
    try { b = Number(math.evaluate(ne, { [variable]: x })); } catch { continue; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    diffs.push({ d: a - b, size: Math.abs(a) + Math.abs(b) });
  }
  if (diffs.length < 3) return false;
  // F − E must be one constant, to a tolerance that scales with the values
  // themselves: e^(x³) reaches 10²⁷⁶ at the sample points. The constant is
  // read where the values are smallest — a mean would be swamped by the
  // rounding error of the largest point.
  const ref = diffs.reduce((best, p) => (p.size < best.size ? p : best)).d;
  return diffs.every(({ d, size }) => Math.abs(d - ref) < 1e-6 * (1 + Math.abs(ref) + size));
}

// A solution set as [{ lo, hi, loClosed, hiClosed }], from interval notation
// ("(-∞, -1] ∪ [1, 3)") or inequalities ("x ≤ -1  or  1 ≤ x < 3"). Null if
// the text is neither.
function parseIntervals(text) {
  const t = String(text).replace(/−/g, '-').replace(/<=/g, '≤').replace(/>=/g, '≥').trim();
  const num = (v) => {
    const u = v.trim();
    if (/^\+?∞$/.test(u)) return Infinity;
    if (/^-∞$/.test(u)) return -Infinity;
    return toNumber(u);
  };
  const out = [];
  if (/^[[(]/.test(t)) {
    for (const part of t.split('∪')) {
      const m = part.trim().match(/^([[(])\s*([^,]+),\s*([^\])]+)([\])])$/);
      if (!m) return null;
      out.push({ lo: num(m[2]), hi: num(m[3]), loClosed: m[1] === '[', hiClosed: m[4] === ']' });
    }
  } else {
    for (const part of t.split(/\s+or\s+/)) {
      const p = part.trim();
      let m;
      if ((m = p.match(/^(.+?)\s*([<≤])\s*[a-z]\s*([<≤])\s*(.+)$/))) {
        out.push({ lo: num(m[1]), hi: num(m[4]), loClosed: m[2] === '≤', hiClosed: m[3] === '≤' });
      } else if ((m = p.match(/^[a-z]\s*([<≤>≥])\s*(.+)$/))) {
        const v = num(m[2]);
        out.push(/[<≤]/.test(m[1])
          ? { lo: -Infinity, hi: v, loClosed: false, hiClosed: m[1] === '≤' }
          : { lo: v, hi: Infinity, loClosed: m[1] === '≥', hiClosed: false });
      } else {
        return null;
      }
    }
  }
  if (out.some((i) => i.lo === null || i.hi === null)) return null;
  return out.sort((a, b) => a.lo - b.lo);
}

function sameIntervals(a, b) {
  const end = (x, y) => (x === y || (Number.isFinite(x) && Number.isFinite(y) && numClose(x, y)));
  return a.length === b.length && a.every((i, k) => end(i.lo, b[k].lo) && end(i.hi, b[k].hi)
    && (i.loClosed === b[k].loClosed || !Number.isFinite(i.lo)) && (i.hiClosed === b[k].hiClosed || !Number.isFinite(i.hi)));
}

// numeric compare with tolerance
function numClose(a, b) {
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 1e-3 * (1 + Math.abs(b));
}

function isRefusal(answer) {
  return /unable to|could not|no solution|not (?:recognized|supported)|invalid/i.test(String(answer));
}
function saysDNE(s) {
  return /does not exist|dne|undefined/i.test(String(s));
}

// Parse "x = 18/5, y = -2/5" (or "x=3.6, y=-0.4") into { x: 3.6, y: -0.4 }.
function parseVarValues(s) {
  const out = {};
  for (const m of String(s).matchAll(/([a-z])\s*=\s*([^,]+?)(?:,|$)/gi)) {
    const key = m[1].toLowerCase();
    try {
      const v = Number(math.evaluate(m[2].replace(/[?\s]/g, '')));
      if (Number.isFinite(v)) out[key] = v;
    } catch {
      // not a numeric value (e.g. "y=?") — skip
    }
  }
  return out;
}

// Pull the numeric solution set out of an algebra answer like "x = 2  or  x = 3".
// An exact answer — "x = e (≈ 2.7183)", "x = ln(10)/ln(2) (≈ 3.3219)",
// "x = (1 + √5)/2 (≈ 1.618)" — is graded by the VALUE of each "x = …" clause
// (the decimal aside and any multiplicity note stripped, √n and ln made
// evaluable), never by the digits that happen to appear in its text.
function solutionNumbers(s) {
  const text = String(s);
  // A clause is "x = <value>" up to the next "or" / ";" / end; the CSV's
  // shorthand "x=2,3" lists several values in one clause, so split on commas.
  const clauses = [...text.matchAll(/(?<![a-z])[a-z]\s*=\s*(.+?)(?=\s+or\s+|;|$)/gi)];
  if (clauses.length > 0) {
    const values = [];
    let failed = false;
    for (const m of clauses) {
      for (const piece of m[1].split(',')) {
        const expr = piece
          .replace(/\(≈[^)]*\)/g, '')
          .replace(/\(repeated root[^)]*\)/g, '')
          .replace(/√\s*(\d+)/g, 'sqrt($1)')
          .replace(/\bln\b/g, 'log')
          .trim();
        try {
          const v = Number(math.evaluate(expr));
          if (!Number.isFinite(v)) throw new Error('not a real number');
          values.push(v);
        } catch {
          failed = true;
        }
      }
    }
    if (!failed && values.length > 0) return values.sort((a, b) => a - b);
  }
  const nums = [];
  for (const m of text.matchAll(/-?\d+(?:\.\d+)?/g)) nums.push(Number(m[0]));
  return nums.sort((a, b) => a - b);
}

// --- per-category grading ---------------------------------------------------

// Ground truth for the Functions rows, graded against the structured
// `features` object (the CSV "expected" column is prose). Each checker
// returns null on pass, or a string describing the failure.
const FUNCTION_TRUTH = {
  'x^2 - 4x + 3': (f) => {
    if (!f.quadratic || Math.abs(f.quadratic.vertex.x - 2) > 1e-6 || Math.abs(f.quadratic.vertex.y + 1) > 1e-6) return 'vertex must be (2,-1)';
    const xs = f.xIntercepts.list.map((r) => r.numeric);
    if (!(xs.includes(1) && xs.includes(3))) return 'zeros must be 1 and 3';
    return null;
  },
  '1/(x-2)': (f) => {
    if (f.xIntercepts.list.length !== 0) return 'must have no x-intercepts';
    if (!f.verticalAsymptotes.some((a) => Math.abs(a - 2) < 1e-6)) return 'must report vertical asymptote x=2';
    if (f.extrema.length !== 0) return 'must not fabricate extrema';
    return null;
  },
  'sqrt(x-3)': (f) => {
    if (!f.domain.some((r) => Number.isFinite(r.to) && Math.abs(r.to - 3) < 1e-3)) return 'domain must exclude x<3';
    if (!f.xIntercepts.list.some((r) => Math.abs(r.numeric - 3) < 1e-3)) return 'must find the (3,0) starting point';
    if (f.extrema.length !== 0) return 'must not fabricate a vertex';
    return null;
  },
  'ln(x)': (f) => {
    if (!f.domain.some((r) => Number.isFinite(r.to) && Math.abs(r.to) < 1e-3)) return 'domain must exclude x<=0';
    if (!f.xIntercepts.list.some((r) => Math.abs(r.numeric - 1) < 1e-6)) return 'must find the (1,0) intercept';
    return null;
  },
  'abs(x)': (f) => {
    if (!f.extrema.some((e) => e.kind === 'min' && Math.abs(e.x) < 1e-6)) return 'must find the vertex/min at (0,0)';
    if (!f.xIntercepts.list.some((r) => Math.abs(r.numeric) < 1e-6)) return 'must find the intercept at 0';
    return null;
  },
  'x^3 - x': (f) => {
    const xs = f.xIntercepts.list.map((r) => r.numeric);
    if (!([-1, 0, 1].every((v) => xs.some((x) => Math.abs(x - v) < 1e-6)))) return 'zeros must be -1, 0, 1';
    if (!f.extrema.some((e) => Math.abs(Math.abs(e.x) - 1 / Math.sqrt(3)) < 1e-3)) return 'extrema must be at ±1/√3 ≈ ±0.577';
    if (!f.inflections.some((i) => Math.abs(i.x) < 1e-6)) return 'inflection at 0';
    return null;
  },
  'sin(x)': (f) => {
    if (!f.isPeriodic) return 'must be flagged periodic';
    if (!f.xIntercepts.list.some((r) => Math.abs(r.numeric) < 1e-6)) return 'zeros must include 0';
    if (!f.xIntercepts.list.some((r) => Math.abs(r.numeric - Math.PI) < 1e-3)) return 'zeros must include π';
    if (!f.extrema.some((e) => e.kind === 'max' && Math.abs(e.x - Math.PI / 2) < 1e-3)) return 'max at π/2';
    return null;
  },
  'exp(x)': (f) => {
    if (f.xIntercepts.list.length !== 0) return 'must have no x-intercepts';
    if (f.extrema.length !== 0) return 'must not fabricate a vertex';
    if (f.monotonic !== 'increasing') return 'must be reported increasing';
    if (!f.yIntercept || Math.abs(f.yIntercept.y - 1) > 1e-9) return 'y-intercept must be (0,1)';
    return null;
  },
  'log(x^2)': (f) => {
    if (!f.domain.some((r) => Math.abs(r.from) < 1e-3 && Math.abs(r.to) < 1e-3)) return 'domain must exclude x=0';
    const xs = f.xIntercepts.list.map((r) => r.numeric);
    if (!(xs.some((x) => Math.abs(x - 1) < 1e-6) && xs.some((x) => Math.abs(x + 1) < 1e-6))) return 'zeros must be ±1';
    if (f.extrema.length !== 0) return 'must not fabricate extrema';
    return null;
  },
  '1/(x^2)': (f) => {
    if (f.xIntercepts.list.length !== 0) return 'must have no x-intercepts';
    if (!f.verticalAsymptotes.some((a) => Math.abs(a) < 1e-6)) return 'must report vertical asymptote x=0';
    if (f.extrema.length !== 0) return 'must not fabricate extrema';
    return null;
  },
};

// The answer's mathematics without the qualifiers that accompany it since
// 1.53.1, which grade nothing themselves: a cancelled factor's domain
// ("x + 1, for x ≠ 1") and the decimals beside exact endpoints
// ("x > √2  (√2 ≈ 1.4142)").
function gradable(r) {
  if (!r || typeof r.answer !== 'string') return r;
  const answer = r.answer
    .replace(/,\s*for\s+[a-z]\s*≠[^]*$/, '')
    .replace(/\s{2}\(([^]*≈[^]*)\)\s*$/, '');
  return { ...r, answer };
}

async function grade(category, problem, expected, meta = {}) {
  const cat = category.toLowerCase();
  if (cat === 'functions') {
    const checker = FUNCTION_TRUTH[problem];
    if (!checker) return { verdict: 'SKIP', detail: 'no truth entry' };
    const r = await solveProblem(problem, 'functions');
    if (!r.features) return { verdict: 'WRONG', got: 'no structured features returned' };
    const fail = checker(r.features);
    return fail ? { verdict: 'WRONG', got: fail } : { verdict: 'CORRECT', got: 'features verified' };
  }

  if (meta.skip) return { verdict: 'SKIP', detail: meta.skip };
  const topic = TOPIC[cat];
  if (!topic && !meta.topic) return { verdict: 'SKIP', detail: 'no grader for this category' };

  // Derive the input a user would actually type. The CSV uses display notation
  // for integrals (∫ … dx); strip that wrapper to the integrand, but pass a
  // definite integral (∫_a^b) through verbatim so the refuse-clearly path is
  // exercised. Everything else goes in as written (that IS what was typed).
  const isDefiniteIntegral = cat === 'integrals' && /definite|_[-\d{∞]/.test(problem);
  let input = problem;
  if (cat === 'integrals' && !isDefiniteIntegral) {
    input = problem.replace(/∫/g, '').replace(/\bdx\b/gi, '').trim();
  }
  if (cat === 'algebra') {
    input = problem.replace(/\((?:solve[^)]*|system)\)\s*$/i, '').trim();
  }

  const r = gradable(await solveProblem(input, TOPIC[meta.topic] || topic));
  const ans = String(r.answer);

  // Trig equations: compare the solutions listed on one period, as sets.
  // Expected "5pi/6, 7pi/6 on [0,2pi)"; the answer ends "on [0, 2π): 5π/6, 7π/6".
  if (meta.trigEquation && !meta.expectRefusal) {
    if (/no real solution/i.test(expected)) return { verdict: /no (?:real )?solution/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
    if (/identity/i.test(expected)) return { verdict: /all real|identity/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
    const list = (t) => t.split(',').map((v) => toNumber(v.replace(/°/g, '').trim())).filter((v) => v !== null).sort((a, b) => a - b);
    const expList = /\s+on\s+\[/.test(expected) ? list(expected.replace(/\s+on\s+\[.*$/, '')) : [];
    const gotPart = ans.match(/on\s+\[0[^\]]*[)\]]\s*:\s*(.+)$/);
    if (!expList.length || !gotPart) return { verdict: 'SKIP', detail: 'no period listing to compare' };
    const gotList = list(gotPart[1]);
    const ok = gotList.length === expList.length && gotList.every((v, i) => numClose(v, expList[i]));
    return { verdict: ok ? 'CORRECT' : 'WRONG', got: ans };
  }

  // An expected refusal ("undefined", "indeterminate", "diverges", "refuse"):
  // the answer must not be presented as an ordinary solved value.
  if (meta.expectRefusal) {
    const declined = r.status !== 'solved' || /diverge|undefined|indeterminate|non-elementary|does not exist|beyond what|cannot|not supported/i.test(ans);
    return { verdict: declined ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'derivatives' && /^d[a-z]\/d[a-z]\b/.test(ans)) {
    // An implicit derivative, "dy/dx = -x/y" or "dy/dx at (3, 4) = -3/4 ≈ -0.75":
    // a value, or an expression in both variables graded by sampling (x, y).
    const core = ans.replace(/^d[a-z]\/d[a-z](?:\s+at\s+\([^)]*\))?\s*=\s*/, '').replace(/\s*≈\s*[-\d.]+\s*$/, '');
    const en = toNumber(expected);
    if (en !== null) return { verdict: numClose(toNumber(core), en) ? 'CORRECT' : 'WRONG', got: ans };
    return { verdict: expr2Equivalent(core, expected) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'derivatives') {
    // The answer may carry its domain ("…, x ≠ 0") and a corner note
    // ("(does not exist where x = 0)"); the expression is graded alone.
    const core = ans.replace(/^f'+\([^)]*\)\s*=\s*/, '').replace(/\s*≈\s*[-\d.]+\s*$/, '').replace(/\s*\(does not exist where[^)]*\)\s*$/, '').replace(/,\s*[a-z]\s*[≠><≥≤].*$/, '');
    if (isRefusal(core)) return { verdict: 'REFUSED', got: ans };
    const variable = (problem.match(/with respect to ([a-z])\b/i) || [])[1] || 'x';
    const en = toNumber(expected);
    if (en !== null && toNumber(core) !== null) return { verdict: numClose(toNumber(core), en) ? 'CORRECT' : 'WRONG', got: ans };
    return { verdict: exprEquivalent(core, expected, variable) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'integrals') {
    if (isDefiniteIntegral) {
      // Built as of v1.9.0. Grade the numeric value; a refusal is only a pass
      // for a genuinely improper integral (expected value says so).
      if (/improper|diverge|does not exist|dne/i.test(expected)) {
        return { verdict: isRefusal(ans) || /improper|diverge/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
      }
      if (isRefusal(ans) || /improper/i.test(ans)) return { verdict: 'REFUSED', got: ans };
      const gotNum = toNumber(ans.replace(/^.*=\s*/, ''));
      return { verdict: numClose(gotNum, toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
    }
    if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
    // Correctness: the antiderivative must differ from the expected one by only
    // a constant (equivalently, d/dx(F) == integrand). Try both checks.
    const F = ans.replace(/^∫.*?=\s*/, '').replace(/\+\s*C\s*$/, '').trim();
    if (antiderivEquivalent(F, expected)) return { verdict: 'CORRECT', got: ans };
    try {
      const dF = math.derivative(prepForEval(F), 'x').toString();
      return { verdict: exprEquivalent(dF, prepForEval(input)) ? 'CORRECT' : 'WRONG', got: ans };
    } catch {
      return { verdict: 'WRONG', got: ans };
    }
  }

  if (cat === 'limits') {
    const core = ans.replace(/^.*?=\s*/, '');
    if (saysDNE(expected)) return { verdict: saysDNE(core) ? 'CORRECT' : 'WRONG', got: ans };
    if (isRefusal(core)) return { verdict: 'REFUSED', got: ans };
    const inf = (t) => (/^[-−]\s*∞$/.test(t.trim()) ? -1 : /^\+?∞$/.test(t.trim()) ? 1 : 0);
    if (inf(expected)) return { verdict: inf(core) === inf(expected) ? 'CORRECT' : 'WRONG', got: ans };
    return { verdict: numClose(toNumber(core), toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'trigonometry') {
    if (saysDNE(expected)) return { verdict: saysDNE(ans) ? 'CORRECT' : 'WRONG', got: ans };
    if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
    const got = toNumber(ans.replace(/\s*\(or.*\)/, ''));
    if (toNumber(expected) === null) return { verdict: exprEquivalent(ans, expected) ? 'CORRECT' : 'WRONG', got: ans };
    return { verdict: numClose(got, toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'arithmetic') {
    if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
    if (ans.replace(/\s+/g, '') === String(expected).replace(/\s+/g, '')) return { verdict: 'CORRECT', got: ans };
    return { verdict: numClose(toNumber(ans), toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'algebra') {
    const cleaned = input;

    // Inequalities (<, >, ≤, ≥): compare the solution set as a normalized
    // string (≤→<=, drop spaces), or grade the all-reals / no-solution claim.
    if (/[<>≤≥]/.test(cleaned)) {
      if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
      if (/all real/i.test(expected)) return { verdict: /all real/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
      if (/no solution/i.test(expected)) return { verdict: /no solution/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
      const norm = (s) => String(s).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\s+/g, '').toLowerCase();
      if (norm(ans) === norm(expected)) return { verdict: 'CORRECT', got: ans };
      // "-1 < x < 0 or x > 1" and "(-1, 0) ∪ (1, ∞)" name the same set.
      const a = parseIntervals(ans);
      const b = parseIntervals(expected);
      return { verdict: a && b && sameIntervals(a, b) ? 'CORRECT' : 'WRONG', got: ans };
    }

    // Systems of equations (two or more '='): grade each variable's value.
    if ((cleaned.match(/=/g) || []).length >= 2) {
      if (/infinitely many/i.test(expected)) {
        return { verdict: /infinitely many/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
      }
      if (/no solution|inconsistent/i.test(expected)) {
        return { verdict: /no solution/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
      }
      if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
      // Several solution pairs, "(x, y) = (3, 4) or (4, 3)" vs "(3,4) and (4,3)".
      const pairs = (t) => [...String(t).matchAll(/\(\s*(-?[\d./√]+)\s*,\s*(-?[\d./√]+)\s*\)/g)]
        .map((m) => [toNumber(m[1]), toNumber(m[2])]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const expPairs = pairs(expected);
      if (expPairs.length > 1) {
        const gotPairs = pairs(ans);
        const ok = gotPairs.length === expPairs.length && gotPairs.every((g, i) => numClose(g[0], expPairs[i][0]) && numClose(g[1], expPairs[i][1]));
        return { verdict: ok ? 'CORRECT' : 'WRONG', got: ans };
      }
      const expVals = parseVarValues(expected);
      const gotVals = parseVarValues(ans);
      const keys = Object.keys(expVals);
      const ok = keys.length > 0 && keys.every((k) => k in gotVals && numClose(gotVals[k], expVals[k]));
      return { verdict: ok ? 'CORRECT' : 'WRONG', got: ans };
    }

    // Statement answers (identity / no-solution rows): the expected value is
    // a claim about the solution set, not a number — grade the claim. These
    // run before the refusal check because "No solution" IS the answer here,
    // not a refusal.
    if (/all real|identity/i.test(expected)) {
      return { verdict: /all real|identity/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
    }
    if (/^no solution/i.test(String(expected).trim())) {
      return { verdict: /no (?:real )?solution/i.test(ans) ? 'CORRECT' : 'WRONG', got: ans };
    }
    if (isRefusal(ans) || /unsolved|no factorization/i.test(ans)) return { verdict: 'REFUSED', got: ans };

    // "x^3 - 2x at x = -2" is an evaluation, not an equation: grade the value.
    if (/\bat\s+[a-z]\s*=/i.test(cleaned) && toNumber(expected) !== null) {
      return { verdict: numClose(toNumber(ans), toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
    }

    // equation with a solution set?
    const expNums = solutionNumbers(expected);
    if (/=/.test(cleaned) && expNums.length && /=/.test(ans)) {
      const gotNums = solutionNumbers(ans);
      const ok = expNums.length === gotNums.length &&
        expNums.every((v, i) => numClose(v, gotNums[i]));
      // Complex/partial expected ("x=3, complex", "x=-2±i"): accept when the
      // stated real root(s) appear and the answer carries the complex pair.
      const expectsComplex = /i\b|complex/i.test(expected);
      const gotComplex = /i\b/.test(ans);
      const realRootsMatch = expNums.every((v) => gotNums.some((g) => numClose(g, v)));
      if (ok || (expectsComplex && gotComplex && realRootsMatch)) return { verdict: 'CORRECT', got: ans };
      return { verdict: 'WRONG', got: ans };
    }
    // scalar expression (sqrt(50), abs(-7), numeric)
    const en = toNumber(expected);
    if (en !== null) {
      return { verdict: numClose(toNumber(ans), en) ? 'CORRECT' : 'WRONG', got: ans };
    }
    // symbolic expression (simplification, factoring)
    return { verdict: exprEquivalent(ans.replace(/^.*?=\s*/, ''), expected) ? 'CORRECT' : 'WRONG', got: ans };
  }

  return { verdict: 'SKIP', detail: 'unknown category' };
}

// --- run --------------------------------------------------------------------

const showWrongOnly = process.argv.includes('--wrong');
const rows = parseCSV(fs.readFileSync(CSV, 'utf8'));
const header = rows.shift(); // Category,Problem,Expected,Solver,Classification
if (fs.existsSync(ADDITIONS)) {
  const extra = parseCSV(fs.readFileSync(ADDITIONS, 'utf8'));
  extra.shift(); // same header shape
  rows.push(...extra);
}
// The September 2026 evaluation (149 problems, graded against SymPy). Its
// "Trig values" rows are the trigonometry topic; categories this harness
// has no grader for (systems, inequalities, trig equations, adversarial
// input) are counted as SKIP rather than guessed at.
const SEPTEMBER = path.resolve(__dirname, '../../docs/evaluations/2026-09/mastermath_evaluation_v1.29.csv');
const septemberRows = parseCSV(fs.readFileSync(SEPTEMBER, 'utf8'));
septemberRows.shift();
rows.push(...septemberRows.map(adaptSeptemberRow));

// The September CSV writes metadata into the text: "[angle unit: degrees]"
// and "[topic: integrals]" on the problem, commentary on the expected value
// ("x = 1 (x = -2 is extraneous)", "… — must route to Algebra"), and an
// expected refusal as a word ("refuse", "undefined", "indeterminate",
// "diverges"). Read all of that into a row the grader understands.
function adaptSeptemberRow([category, problem, expected, ...rest]) {
  const meta = {};
  let p = problem;
  p = p.replace(/\s*\[angle unit:\s*(\w+)\]/i, (_, u) => { meta.angleUnit = u.toLowerCase(); return ''; });
  p = p.replace(/\s*\[topic:\s*(\w+)\]/i, (_, t) => { meta.topic = t.toLowerCase(); return ''; });
  // An adversarial row whose expected value allows an alternative ("refuse —
  // or the correct set (-1, 3)") is not graded by guesswork; plain "refuse"
  // rows are, under Algebra (whose router sends calculus notation onward).
  if (category === 'Adversarial') {
    if (/—\s*or\b|\bor a clear refusal/i.test(expected)) meta.skip = 'adversarial row with an alternative answer';
    else meta.topic = meta.topic || 'algebra';
  }
  if (category === 'Trig equations') meta.trigEquation = true;
  let e = expected;
  // Commentary follows a space and ends the value: "x = 1 (x = -2 is
  // extraneous)", "4x^3 (derivative notation … — must route)". Brackets that
  // are part of the maths — "(√6 − √2)/4", "e^(2x)(2cos(x) + sin(x))/5" —
  // either have no space before them or do not end the string.
  const noteRe = /\s+\((?![≈=])(?=[^)]*[a-z]{3,}[\s)])(?:[^()]|\([^()]*\))*\)\s*(?:—.*)?$/i;
  const note = (e.match(noteRe) || [''])[0];
  e = e.replace(noteRe, '').replace(/\s+—\s+.*$/, '').trim();
  // "x = 1 (plus a complex pair)": the grader accepts the complex roots
  // alongside the real one when the expected value says "complex".
  if (/\bplus\b[^)]*complex|complex (?:pair|roots|solutions)/i.test(note)) e = `${e}, complex`;
  if (/^(?:refuse|undefined|indeterminate|diverges|does not exist|dne)\b/i.test(e)) meta.expectRefusal = true;
  // "sin(0.5 rad) ≈ 0.4794", "cos(1.5°) ≈ 0.99966": grade the decimal.
  const approx = e.match(/(?:rad|°)\)?\s*≈\s*(-?[\d.]+)\s*$/);
  if (approx) e = approx[1];
  const cat = { 'Trig values': 'Trigonometry', Systems: 'Algebra', Inequalities: 'Algebra', 'Trig equations': 'Trigonometry', Adversarial: 'Algebra' }[category] || category;
  return [cat, p.trim(), e, ...rest, meta];
}

const tally = { CORRECT: 0, WRONG: 0, REFUSED: 0, SKIP: 0 };
const wrong = [];

let corrected = 0;
for (const row of rows) {
  const [category, problem, rawExpected] = row;
  const meta = typeof row[row.length - 1] === 'object' ? row[row.length - 1] : {};
  if (!category) continue;
  const correction = CORPUS_CORRECTIONS[problem];
  const expected = correction ? correction.expected : rawExpected;
  if (correction) corrected += 1;
  let res;
  try {
    if (meta.angleUnit) saveSettings({ angleUnit: meta.angleUnit });
    try {
      res = await grade(category, problem, expected, meta);
    } finally {
      if (meta.angleUnit) resetSettings();
    }
  } catch (e) {
    res = { verdict: 'WRONG', got: `THREW: ${e.message.slice(0, 60)}` };
  }
  tally[res.verdict] = (tally[res.verdict] || 0) + 1;
  if (res.verdict === 'WRONG') {
    wrong.push(`  ✗ [${category}] ${problem}  →  got: ${res.got}  |  expected: ${expected}${res.note ? '  (' + res.note + ')' : ''}`);
  }
}

const graded = tally.CORRECT + tally.WRONG + tally.REFUSED;
const pct = graded ? ((tally.CORRECT + tally.REFUSED) / graded * 100).toFixed(1) : '0';

if (wrong.length) {
  console.log('\nWRONG / unexpected rows:');
  console.log(wrong.join('\n'));
}
if (!showWrongOnly) {
  console.log('\n─── Corpus scoreboard ───');
  console.log(`  CORRECT : ${tally.CORRECT}`);
  console.log(`  REFUSED : ${tally.REFUSED}  (pass for unbuilt features)`);
  console.log(`  WRONG   : ${tally.WRONG}`);
  console.log(`  SKIP    : ${tally.SKIP}  (Functions — Wave 2)`);
  console.log(`  ─────────────────────`);
  console.log(`  Score   : ${pct}%  (CORRECT+REFUSED of ${graded} graded)`);
  console.log(`  Confident-wrong answers: ${tally.WRONG}  ← Wave 1 target: 0`);
  if (corrected) console.log(`  (${corrected} corpus row(s) use a documented correction — see CORPUS_CORRECTIONS)`);
  console.log('');
}

// Exit non-zero if any confident-wrong answers remain (for CI / npm test use).
process.exit(tally.WRONG > 0 ? 1 : 0);
