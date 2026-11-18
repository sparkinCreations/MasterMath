import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs the evaluation corpora (docs/evaluations/2026-07 and 2026-09) through the
// real solver pipeline. The harness exits non-zero if ANY row is confidently
// wrong (a real answer that disagrees with the verified expected value), so this
// test fails loudly the moment a regression reintroduces one. Refusals on
// unbuilt features (definite integrals, systems) count as passes.
test('evaluation corpus: zero confidently-wrong answers', () => {
  const harness = path.join(__dirname, 'corpus', 'harness.mjs');
  assert.doesNotThrow(() => {
    execFileSync('node', [harness, '--wrong'], { stdio: 'pipe' });
  }, 'the evaluation corpus produced a confidently-wrong answer — run `node tests/corpus/harness.mjs` to see which');
});

// A refusal is graded by its status before its text (1.76.4): x^x = 0 is
// "No solution was found, but this solver cannot show there is none", an
// unsupported answer, never a match for an expected "No solution".
test('the corpus grader counts an unsupported "No solution was found" as refused, not correct', async () => {
  const { grade } = await import('./corpus/harness.mjs');
  const g = await grade('Algebra', 'x^x = 0 (solve)', 'No solution');
  assert.equal(g.verdict, 'REFUSED', g.got);
});
