// The solver, off the main thread.
//
// Every solve runs here so the page never freezes on a slow input, and so a
// solve that overruns its time budget can be stopped: the page terminates
// this worker and starts a fresh one (budgetedSolver.js). Termination also
// discards a poisoned Algebrite instance — a direct call that threw used to
// break every later call (see solverUtils.loadAlgebrite).
//
// Messages in: { id, problem, topic, settings }. Settings travel with each
// request because a worker has no localStorage to read them from.
// Messages out: { id, result } or { id, error }.

import { solveProblem } from './api.js';
import { primeSettings } from './settings.js';

self.onmessage = async ({ data }) => {
  const { id, problem, topic, settings } = data;
  try {
    primeSettings(settings);
    const result = await solveProblem(problem, topic);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
