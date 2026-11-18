// 1.76.4: guards against coverage regressions, not only wrong answers.
// The safety rate counts a refusal as safe, so a change that starts refusing
// floor(x) at π passes every "not wrong" test; these fail on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { MUST_SOLVE, stepCrossCases } from './helpers/stepLimitCases.js';
import { math } from '../src/lib/solvers/solverUtils.js';

test('textbook limits stay solved, with their answers (a refusal fails)', async () => {
  for (const [problem, ending] of MUST_SOLVE) {
    const r = await solvePlain(problem, 'limits');
    assert.equal(r.status, 'solved', `${problem}: ${r.status} — ${r.answer}`);
    assert.ok(String(r.answer).endsWith(ending), `${problem}: expected "…${ending}", got "${r.answer}"`);
    assert.doesNotMatch(r.answer, /estimate/, problem);
  }
});

// The oracle: the function a little either side of the point. Exact for
// this family (piecewise linear, small rational coefficients, jumps at
// least 1/12 apart), and used only to check the solver, never by it.
function oracle(f, point, side) {
  const a = Number(math.evaluate(point));
  const at = (x) => Number(math.evaluate(f, { x }));
  // Each side is linear near the point, so extrapolating two samples to the
  // point gives that side's limit exactly.
  const h = 1e-6;
  const L = 2 * at(a - h) - at(a - 2 * h);
  const R = 2 * at(a + h) - at(a + 2 * h);
  const near = (u, v) => Math.abs(u - v) < 1e-6;
  if (side === '-') return L;
  if (side === '+') return R;
  return near(L, R) ? L : 'DNE';
}

function solverValue(answer) {
  if (/does not exist$/.test(answer)) return 'DNE';
  const tail = answer.slice(answer.lastIndexOf(' = ') + 3).replace(/\s*\((?:≈|=)[^)]*\)\s*$/, '').replace(/√(\d+)/g, 'sqrt($1)');
  return Number(math.evaluate(tail));
}

test('step-function limits agree with a one-sided oracle on a seeded family, and are rarely refused', async () => {
  const cases = stepCrossCases();
  let refused = 0;
  const wrong = [];
  for (const { problem, f, point, side } of cases) {
    const r = await solvePlain(problem, 'limits');
    // A labelled estimate is not a proof: for this family it counts with
    // the refusals.
    if (r.status !== 'solved' || /estimate/.test(r.answer)) { refused += 1; continue; }
    let got;
    try { got = solverValue(String(r.answer)); } catch { wrong.push(`${problem}: unreadable answer ${r.answer}`); continue; }
    const want = oracle(f, point, side);
    const ok = want === 'DNE' ? got === 'DNE' : (got !== 'DNE' && Math.abs(got - want) < 1e-6);
    if (!ok) wrong.push(`${problem}: solver ${r.answer} — oracle ${want}`);
  }
  assert.deepEqual(wrong, [], `confidently wrong:\n${wrong.join('\n')}`);
  // Every case here is rational and piecewise linear: nothing in it needs a
  // refusal. A rise means a coverage regression.
  assert.ok(refused <= Math.floor(cases.length * 0.02), `${refused} of ${cases.length} refused`);
});
