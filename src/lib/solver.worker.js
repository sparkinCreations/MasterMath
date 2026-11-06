// The solver, off the main thread.
//
// Every solve runs here so the page never freezes on a slow input, and so a
// solve that overruns its time budget can be stopped: the page terminates
// this worker and starts a fresh one (budgetedSolver.js). Termination also
// discards a poisoned Algebrite instance — a direct call that threw used to
// break every later call (see solverUtils.loadAlgebrite).
//
// Messages in: { id, problem, topic, settings, task?, payload? }. Settings
// travel with each request because a worker has no localStorage to read
// them from. No task is a solve; a practice task (practice/tasks.js) makes a
// candidate problem or checks an answer.
// Messages out: { id, result } or { id, error }.

import { solveProblem } from './api.js';
import { primeSettings } from './settings.js';
import { runPracticeTask, practicable } from './practice/tasks.js';

self.onmessage = async ({ data }) => {
  const { id, problem, topic, settings, task, payload } = data;
  try {
    primeSettings(settings);
    if (task) {
      self.postMessage({ id, result: await runPracticeTask(task, { ...payload, problem, topic }) });
      return;
    }
    const result = await solveProblem(problem, topic);
    // Whether "Try a similar one" is offered (practice mode, 1.70.0).
    if (result && typeof result === 'object' && practicable(result, topic)) result.practicable = true;
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
