// Practice mode on the page (1.70.0): the set of up to five problems and the
// answer checks, each a request to the solver worker (practice/tasks.js).
// Nothing here imports the solver: mathjs stays in the worker
// (tests/buildPreload.test.js).

import { solveWithBudget } from './budgetedSolver.js';

export const POOL_SIZE = 5;
export const MAX_CANDIDATES = 40;
// Stop looking once this many candidates in a row added nothing: the
// variations have run out (duplicates, or a method that will not keep).
const GIVE_UP_AFTER = 15;

// Builds the set for a solved problem, calling onItem(item, index) as each
// one is found and resolving with the whole set ([] when there is none, null
// when the problem cannot be practised). Candidate i is the same for every
// student, so the set is too.
export async function buildPracticeSet(problem, topic, { onItem = () => {}, signal } = {}) {
  const set = [];
  const seen = new Set([problem.replace(/\s+/g, '')]);
  let misses = 0;
  for (let index = 0; index < MAX_CANDIDATES && set.length < POOL_SIZE && misses < GIVE_UP_AFTER; index += 1) {
    if (signal?.aborted) return set;
    let reply;
    try {
      reply = await solveWithBudget(problem, topic, { signal, task: 'practice-candidate', payload: { index } });
    } catch {
      reply = null;
    }
    if (signal?.aborted) return set;
    // A candidate past the time budget comes back as a solver envelope: skip it.
    if (reply && reply.practicable === false) return set.length ? set : null;
    const item = reply?.item;
    const key = item?.problem?.replace(/\s+/g, '');
    if (!item || seen.has(key)) { misses += 1; continue; }
    seen.add(key);
    misses = 0;
    set.push(item);
    onItem(item, set.length - 1);
  }
  return set;
}

export async function checkPracticeAnswer(item, typed) {
  try {
    const verdict = await solveWithBudget(item.problem, item.topic, { task: 'practice-check', payload: { correct: item.correct, typed } });
    if (verdict && typeof verdict.verdict === 'string') return verdict;
  } catch {
    // fall through
  }
  return { verdict: 'unreadable', message: 'MasterMath could not check that answer. Try typing it again.' };
}
