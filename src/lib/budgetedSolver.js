// Solving with a time budget and a cancel button.
//
// Algebrite is synchronous and cannot be interrupted: x^41 − x = 1 locks the
// page for ten seconds before it gives up. So the solver runs in a Web Worker
// (solver.worker.js), and a solve that exceeds SOLVE_BUDGET_MS — or that the
// user cancels — is ended by terminating the worker. The next solve gets a
// fresh worker (and a fresh, unpoisoned Algebrite).
//
// `createBudgetedSolver` takes its worker factory and fallback as arguments
// so tests/budgetedSolver.test.js can drive it with a fake worker in node;
// `solveWithBudget` is the page's instance.

import { unsupported } from './solutionEnvelope.js';
import { getSettings } from './settings.js';

export const SOLVE_BUDGET_MS = 10_000;

export function budgetExceeded(problem, budgetMs) {
  const seconds = Math.round(budgetMs / 1000);
  return unsupported({
    input: problem,
    reason: `This took longer than ${seconds} seconds, so MasterMath stopped rather than keep the page frozen. Very high-degree polynomials, deeply nested expressions and some symbolic integrals can exceed the budget.`,
    answer: `Stopped after ${seconds} seconds — no answer rather than a late or partial one`,
    tips: ['Try a simpler form of the problem: factor out common factors, lower the degree, or split it into parts.'],
  });
}

export function createBudgetedSolver({ makeWorker, fallback, budgetMs = SOLVE_BUDGET_MS, onWorkerFailure = () => {} }) {
  let worker = null;
  let nextId = 1;

  const dropWorker = () => {
    if (worker) worker.terminate();
    worker = null;
  };

  // Create the worker ahead of the first solve so its bundle is downloading
  // while the user types. Returns null when workers are unavailable.
  const warm = () => {
    if (worker) return worker;
    try {
      worker = makeWorker();
    } catch (error) {
      onWorkerFailure(error);
      worker = null;
    }
    return worker;
  };

  const solve = (problem, topic, { signal } = {}) => new Promise((resolve, reject) => {
    const w = warm();
    if (!w) {
      // No worker (an environment without them, or one that failed to
      // load): solve in-thread so the user still gets an answer.
      Promise.resolve(fallback(problem, topic)).then(resolve, reject);
      return;
    }
    const id = nextId++;
    const settings = getSettings();
    let settled = false;
    let timer = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };

    const onMessage = ({ data }) => {
      if (!data || data.id !== id) return;
      if (data.error) finish(reject, new Error(data.error));
      else finish(resolve, data.result);
    };
    const onError = (event) => {
      // The worker itself failed (a bundling or loading fault, not a maths
      // error — those arrive as messages). Report it, then answer in-thread.
      dropWorker();
      onWorkerFailure(event?.error || event?.message || event);
      Promise.resolve(fallback(problem, topic)).then((r) => finish(resolve, r), (e) => finish(reject, e));
    };
    const onAbort = () => {
      dropWorker();
      finish(resolve, null);
    };

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort);
    timer = setTimeout(() => {
      dropWorker();
      finish(resolve, budgetExceeded(problem, budgetMs));
    }, budgetMs);
    w.postMessage({ id, problem, topic, settings });
  });

  return { solve, warm, dropWorker };
}

// The page's solver. The worker is created from a URL relative to this
// module so Vite bundles solver.worker.js (and the solver modules it imports)
// as a separate worker build.
const pageSolver = createBudgetedSolver({
  makeWorker: () => {
    if (typeof Worker === 'undefined') throw new Error('Web Workers are not available');
    return new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
  },
  fallback: async (problem, topic) => (await import('./api.js')).solveProblem(problem, topic),
  onWorkerFailure: (error) => {
    // The smoke test fails on this line: a worker that cannot start means
    // every solve silently runs on the main thread, which is the bug this
    // module exists to prevent.
    console.error('Solver worker failed; solving on the main thread instead:', error);
  },
});

export const solveWithBudget = pageSolver.solve;
export const warmSolver = pageSolver.warm;
