// Regression harness over the July 2026 evaluation corpus.
//
// Reads docs/evaluations/2026-07/mastermath_evaluation.csv (input -> expected
// pairs, 91 problems) and re-runs each input through the real solvers, grading
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

// Documented errors in the external evaluation corpus itself — cases where the
// solver is right and the CSV's "expected" is wrong. We correct the expected
// here (with the reason) rather than editing the external artifact or, worse,
// "fixing" a correct solver to match a bad expectation.
const CORPUS_CORRECTIONS = {
  'lim x→0 (x-2)/abs(x-2)': {
    expected: '-1',
    reason: '(x-2)/|x-2| = -1 for all x<2, so the x→0 limit is -1, not DNE. The eval report text discusses x→2 (which does DNE); the CSV row says x→0.',
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
  s = s.replace(/√/g, 'sqrt').replace(/π/g, 'pi');
  s = s.replace(/sqrt(\d+)/g, 'sqrt($1)');
  // strip a leading "x=" style label
  s = s.replace(/^[a-z]\s*=\s*/i, '');
  try {
    const v = math.evaluate(s);
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const SAMPLE_POINTS = [0.37, 0.83, 1.29, 2.11, -0.71, -1.53, 3.4];

// Are two single-variable expressions equal? Sample at several points.
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

// Convert an answer/expected string into an evaluable expression, or null.
function prepForEval(s) {
  let out = String(s)
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/·/g, '*')
    // ln|EXPR| -> log((EXPR))  (do this before stripping bars / generic ln)
    .replace(/\bln\s*\|([^|]+)\|/gi, 'log(($1))')
    .replace(/\bln\b/g, 'log')     // natural log for math.evaluate
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
    diffs.push(a - b);
  }
  if (diffs.length < 3) return false;
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  return diffs.every((d) => Math.abs(d - mean) < 1e-6 * (1 + Math.abs(mean)));
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

// Pull the numeric solution set out of an algebra answer like "x = 2  or  x = 3".
function solutionNumbers(s) {
  const nums = [];
  for (const m of String(s).matchAll(/-?\d+(?:\.\d+)?/g)) nums.push(Number(m[0]));
  return nums.sort((a, b) => a - b);
}

// --- per-category grading ---------------------------------------------------

async function grade(category, problem, expected) {
  const cat = category.toLowerCase();
  if (cat === 'functions') return { verdict: 'SKIP', detail: 'Wave 2 (feature analysis)' };

  const topic = TOPIC[cat];

  // Derive the input a user would actually type. The CSV uses display notation
  // for integrals (∫ … dx); strip that wrapper to the integrand, but pass a
  // definite integral (∫_a^b) through verbatim so the refuse-clearly path is
  // exercised. Everything else goes in as written (that IS what was typed).
  const isDefiniteIntegral = cat === 'integrals' && /definite|_\d|_\{/.test(problem);
  let input = problem;
  if (cat === 'integrals' && !isDefiniteIntegral) {
    input = problem.replace(/∫/g, '').replace(/\bdx\b/gi, '').trim();
  }
  if (cat === 'algebra') {
    input = problem.replace(/\((?:solve[^)]*|system)\)\s*$/i, '').trim();
  }

  const r = await solveProblem(input, topic);
  const ans = String(r.answer);

  if (cat === 'derivatives') {
    const core = ans.replace(/^f'\([^)]*\)\s*=\s*/, '');
    if (isRefusal(core)) return { verdict: 'REFUSED', got: ans };
    return { verdict: exprEquivalent(core, expected) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'integrals') {
    if (isDefiniteIntegral) {
      // Unbuilt: a clear refusal is the desired Wave-1 outcome, not a number.
      return { verdict: isRefusal(ans) ? 'REFUSED' : 'WRONG', got: ans, note: 'definite (unbuilt)' };
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
    return { verdict: numClose(toNumber(core), toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'trigonometry') {
    if (saysDNE(expected)) return { verdict: saysDNE(ans) ? 'CORRECT' : 'WRONG', got: ans };
    if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
    const got = toNumber(ans.replace(/\s*\(or.*\)/, ''));
    return { verdict: numClose(got, toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'arithmetic') {
    if (isRefusal(ans)) return { verdict: 'REFUSED', got: ans };
    return { verdict: numClose(toNumber(ans), toNumber(expected)) ? 'CORRECT' : 'WRONG', got: ans };
  }

  if (cat === 'algebra') {
    const cleaned = input;
    if (isRefusal(ans) || /unsolved|no factorization/i.test(ans)) return { verdict: 'REFUSED', got: ans };

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

const tally = { CORRECT: 0, WRONG: 0, REFUSED: 0, SKIP: 0 };
const wrong = [];

let corrected = 0;
for (const [category, problem, rawExpected] of rows) {
  if (!category) continue;
  const correction = CORPUS_CORRECTIONS[problem];
  const expected = correction ? correction.expected : rawExpected;
  if (correction) corrected += 1;
  let res;
  try {
    res = await grade(category, problem, expected);
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
