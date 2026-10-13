// The time budget and Cancel (1.40.0). Driven with a fake worker so the
// termination, timeout and fallback paths run in node without a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetedSolver, budgetExceeded, SOLVE_BUDGET_MS, FALLBACK_WARNING } from '../src/lib/budgetedSolver.js';
import { getSettings, primeSettings, DEFAULT_SETTINGS } from '../src/lib/settings.js';

// A worker double. `script` decides what happens to each posted message:
// 'reply' answers, 'hang' never answers, 'crash' raises a worker error.
function fakeWorker(script) {
  const listeners = { message: [], error: [] };
  const w = {
    terminated: false,
    posted: [],
    addEventListener: (type, fn) => listeners[type].push(fn),
    removeEventListener: (type, fn) => { listeners[type] = listeners[type].filter((f) => f !== fn); },
    terminate: () => { w.terminated = true; },
    postMessage: (msg) => {
      w.posted.push(msg);
      if (script === 'reply') setTimeout(() => listeners.message.forEach((fn) => fn({ data: { id: msg.id, result: { status: 'solved', answer: `${msg.problem} solved`, settings: msg.settings } } })), 0);
      if (script === 'crash') setTimeout(() => listeners.error.forEach((fn) => fn({ message: 'boom' })), 0);
    },
  };
  return w;
}

test('a solve that finishes in time returns the worker\'s result, with the settings it was sent', async () => {
  const made = [];
  const solver = createBudgetedSolver({ makeWorker: () => { const w = fakeWorker('reply'); made.push(w); return w; }, fallback: () => { throw new Error('fallback must not run'); } });
  const r = await solver.solve('2x = 4', 'algebra');
  assert.equal(r.answer, '2x = 4 solved');
  assert.deepEqual(r.settings, getSettings());
  assert.equal(made.length, 1);
  assert.equal(made[0].terminated, false);
  // The worker is reused for the next solve.
  await solver.solve('x = 1', 'algebra');
  assert.equal(made.length, 1);
});

test('a solve past the budget terminates the worker and answers with an honest refusal; the next solve gets a fresh worker', async () => {
  const made = [];
  const solver = createBudgetedSolver({ makeWorker: () => { const w = fakeWorker(made.length ? 'reply' : 'hang'); made.push(w); return w; }, fallback: () => { throw new Error('fallback must not run'); }, budgetMs: 30 });
  const started = Date.now();
  const r = await solver.solve('x^41 - x = 1', 'algebra');
  assert.ok(Date.now() - started < 1000);
  assert.equal(r.status, 'unsupported');
  assert.match(r.answer, /^Stopped after/);
  assert.equal(made[0].terminated, true);
  const next = await solver.solve('x = 1', 'algebra');
  assert.equal(next.answer, 'x = 1 solved');
  assert.equal(made.length, 2);
});

test('Cancel terminates the worker and resolves null', async () => {
  const made = [];
  const solver = createBudgetedSolver({ makeWorker: () => { const w = fakeWorker('hang'); made.push(w); return w; }, fallback: () => { throw new Error('fallback must not run'); }, budgetMs: 5000 });
  const controller = new AbortController();
  const pending = solver.solve('x^41 - x = 1', 'algebra', { signal: controller.signal });
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(made[0].terminated, true);
});

test('a worker that cannot start, or that crashes, is reported, the solve falls back to the main thread, and the result says so', async () => {
  const failures = [];
  const noWorker = createBudgetedSolver({ makeWorker: () => { throw new Error('no workers here'); }, fallback: async (p) => ({ status: 'solved', answer: `${p} in-thread` }), onWorkerFailure: (e) => failures.push(e) });
  const r1 = await noWorker.solve('x = 1', 'algebra');
  assert.equal(r1.answer, 'x = 1 in-thread');
  // The budget and Cancel do not apply in-thread; the user is told on the result.
  assert.deepEqual(r1.warnings, [FALLBACK_WARNING]);
  assert.equal(failures.length, 1);

  const crashing = createBudgetedSolver({ makeWorker: () => fakeWorker('crash'), fallback: async (p) => ({ status: 'solved', answer: `${p} in-thread`, warnings: ['existing'] }), onWorkerFailure: (e) => failures.push(e) });
  const r2 = await crashing.solve('x = 2', 'algebra');
  assert.equal(r2.answer, 'x = 2 in-thread');
  assert.deepEqual(r2.warnings, ['existing', FALLBACK_WARNING]);
  assert.equal(failures.length, 2);

  // A worker result carries no such warning.
  const fine = createBudgetedSolver({ makeWorker: () => fakeWorker('reply'), fallback: () => { throw new Error('fallback must not run'); } });
  assert.equal((await fine.solve('x = 3', 'algebra')).warnings, undefined);
});

test('the budget refusal names the budget, and the default budget is ten seconds', () => {
  assert.equal(SOLVE_BUDGET_MS, 10_000);
  const r = budgetExceeded('x^41 - x = 1', SOLVE_BUDGET_MS);
  assert.equal(r.status, 'unsupported');
  assert.match(r.steps.join('\n'), /longer than 10 seconds/);
});

test('primed settings take precedence, and clearing them restores the defaults', () => {
  primeSettings({ angleUnit: 'degrees', decimalPlaces: 2 });
  assert.deepEqual(getSettings(), { angleUnit: 'degrees', decimalPlaces: 2 });
  primeSettings({ angleUnit: 'nonsense', decimalPlaces: 99 });
  assert.deepEqual(getSettings(), { angleUnit: DEFAULT_SETTINGS.angleUnit, decimalPlaces: 6 });
  primeSettings(null);
  assert.deepEqual(getSettings(), { ...DEFAULT_SETTINGS });
});
