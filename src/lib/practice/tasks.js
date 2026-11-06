// The practice tasks the solver worker runs (1.70.0): one candidate of a
// set, or a check of a typed answer. Kept apart from solver.worker.js so the
// in-thread fallback (budgetedSolver.js) can run them too.

import { practiceCandidate } from './generate.js';
import { checkAnswer, readCorrect } from './check.js';

export async function runPracticeTask(task, payload) {
  if (task === 'practice-candidate') return practiceCandidate(payload);
  if (task === 'practice-check') return checkAnswer(payload.correct, payload.typed, { problem: payload.problem });
  throw new Error(`Unknown task: ${task}`);
}

// Whether a solved result can be practised: its answer is one the checker
// reads (a number, the solutions of one equation, a derivative or an
// antiderivative). The page shows "Try a similar one" only then.
export function practicable(result, topic) {
  try {
    return Boolean(readCorrect(result, topic));
  } catch {
    return false;
  }
}
