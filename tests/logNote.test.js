import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { COMMON_LOG_NOTE } from '../src/lib/api/finalize.js';

// 1.70.3: a bare log is base 10 (as on a calculator), and the note says so
// beside the answer, not only among the insights: lim x→1 log(x)/(x − 1) =
// 1/ln(10) reads as wrong to anyone who takes log for ln.
test('a bare log says beside the answer that it is base 10', async () => {
  for (const p of ['lim x->1 log(x)/(x - 1)', 'log(100)', 'log(x) = 2', 'd/dx log(x)']) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.deepEqual(r.warnings.filter((w) => w === COMMON_LOG_NOTE), [COMMON_LOG_NOTE], p);
  }
  // ln, and a log with its base given, need no note.
  for (const p of ['lim x->1 ln(x)/(x - 1)', 'log(8, 2)', 'log_2(8)', 'ln(x) = 2']) {
    const r = await solveProblem(p, 'auto');
    assert.ok(!(r.warnings || []).includes(COMMON_LOG_NOTE), p);
  }
});
