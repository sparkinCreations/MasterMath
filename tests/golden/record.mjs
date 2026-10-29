// Golden-file check for refactors that must not change behaviour (the solver
// file split, docs/future-work/PLAN-FILE-SPLIT.md).
//
// Collects every problem the project already exercises — the evaluation
// corpora, the October test list, the typesetting problems, and every
// solveProblem / solvePlain call with a literal problem in tests/ — and runs
// each through solveProblem under its own topic and under Auto-detect. The
// whole result (status, steps, answer, tips, mistakes, readAs, graph, …) is
// written as JSON, one entry per case.
//
// Run: node tests/golden/record.mjs <out.json>             (record)
//      node tests/golden/record.mjs <out.json> --compare <golden.json>
//
// Not part of `npm test`: it takes minutes, and the file is a snapshot of one
// moment, not a statement of what is right.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

const { solveProblem } = await import('../../src/lib/api.js');
const { saveSettings, resetSettings } = await import('../../src/lib/settings.js');
const { CONVERTED } = await import('../helpers/typesetProblems.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const TOPIC = {
  derivatives: 'derivatives', integrals: 'integrals', limits: 'limits', algebra: 'algebra',
  trigonometry: 'trigonometry', 'trig values': 'trigonometry', 'trig equations': 'trigonometry',
  functions: 'functions', arithmetic: 'other', systems: 'algebra', inequalities: 'algebra',
};
const TOPICS = new Set(['auto', 'derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'algebra', 'other']);

function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const cases = new Map();
function add(problem, topic, angleUnit = null) {
  if (typeof problem !== 'string' || !problem.trim() || !TOPICS.has(topic)) return;
  for (const t of new Set([topic, 'auto'])) {
    const key = JSON.stringify([t, problem, angleUnit]);
    if (!cases.has(key)) cases.set(key, { problem, topic: t, angleUnit });
  }
}

for (const file of [
  'docs/evaluations/2026-07/mastermath_evaluation.csv',
  'tests/corpus/additions.csv',
  'docs/evaluations/2026-09/mastermath_evaluation_v1.29.csv',
]) {
  const rows = parseCSV(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  rows.shift();
  for (const [category, raw] of rows) {
    if (!category || !raw) continue;
    let angle = null;
    let topic = TOPIC[category.toLowerCase()] || 'algebra';
    const p = raw
      .replace(/\s*\[angle unit:\s*(\w+)\]/i, (_, u) => { angle = u.toLowerCase(); return ''; })
      .replace(/\s*\[topic:\s*(\w+)\]/i, (_, t) => { topic = TOPIC[t.toLowerCase()] || topic; return ''; })
      .trim();
    add(p, topic, angle);
  }
}

for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/evaluations/2026-10/test-cases.json'), 'utf8'))) {
  add(c.input, TOPIC[c.topic] || c.topic);
}

for (const [topic, problem] of CONVERTED) add(problem, topic);

// solveProblem('x^2 = 4', 'algebra') / solvePlain("…", "…") with a literal
// problem; template literals with ${…} are skipped.
const CALL = /solve(?:Problem|Plain)\(\s*(['"`])((?:\\.|(?!\1).)*?)\1\s*,\s*['"`](\w+)['"`]/g;
const unescape = (s) => s.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t' }[c] ?? c));
for (const f of fs.readdirSync(path.join(ROOT, 'tests')).sort()) {
  if (!/\.(m?js)$/.test(f)) continue;
  const src = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
  for (const m of src.matchAll(CALL)) {
    if (m[1] === '`' && m[2].includes('${')) continue;
    add(unescape(m[2]), m[3]);
  }
}

const args = process.argv.slice(2);
const out = args[0];
const compareTo = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;
if (!out) {
  console.error('usage: node tests/golden/record.mjs <out.json> [--compare <golden.json>]');
  process.exit(2);
}

const keys = [...cases.keys()].sort();
const results = {};
const slow = [];
let n = 0;
for (const key of keys) {
  const { problem, topic, angleUnit } = cases.get(key);
  const t0 = Date.now();
  try {
    if (angleUnit) saveSettings({ angleUnit });
    results[key] = JSON.parse(JSON.stringify(await solveProblem(problem, topic)));
  } catch (e) {
    results[key] = { THREW: String(e && e.message) };
  } finally {
    if (angleUnit) resetSettings();
  }
  const ms = Date.now() - t0;
  if (ms > 3000) slow.push(`${(ms / 1000).toFixed(1)} s  ${key}`);
  if (++n % 200 === 0) console.error(`${n}/${keys.length}`);
}

fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(`${keys.length} cases written to ${out}`);
if (slow.length) console.log(`slow (> 3 s):\n  ${slow.join('\n  ')}`);

if (compareTo) {
  const golden = JSON.parse(fs.readFileSync(compareTo, 'utf8'));
  const diffs = [];
  for (const key of new Set([...Object.keys(golden), ...keys])) {
    const a = JSON.stringify(golden[key]);
    const b = JSON.stringify(results[key]);
    if (a !== b) diffs.push(key);
  }
  if (diffs.length) {
    console.log(`\n${diffs.length} case(s) differ from ${compareTo}:`);
    for (const k of diffs.slice(0, 40)) console.log(`  ${k}`);
    process.exit(1);
  }
  console.log(`identical to ${compareTo}`);
}
