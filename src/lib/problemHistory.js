// The problem history store: IndexedDB through indexedDB.js, behind
// wrappers whose errors are fit for a toast. Its own module, apart from the
// solve router in api.js: the Solver, Progress and Settings pages import
// these, and importing api.js for them pulled mathjs (79 kB gzipped) onto the
// main thread of each page, where nothing else needs it. Solving happens in
// the worker (budgetedSolver.js).
import { getAllProblems, addProblem, updateProblem, deleteProblem, clearAllProblems } from './indexedDB.js';
import { validateProblemHistory } from './validation.js';

// The storage wrappers below replace the underlying error with a message fit
// for a toast. That message is all the user should see, but it is not all a
// developer needs, so the original is attached as `cause` and logged rather
// than discarded.
//
// Argument and validation failures are deliberately NOT wrapped: they are
// already specific ("Topic is required", "Invalid entity ID"), they mean the
// caller passed something wrong rather than storage misbehaving, and
// flattening them into "Failed to save problem. Please try again." told
// nobody anything.

// One entry per problem: the same problem under the same topic, solved
// again, is the same entry, not a new row (October 2026 review: "My Progress
// lists the same problem again every time you solve it"). Spacing does not
// make a problem different.
export const problemKey = (p) => `${p.topic}\u0000${String(p.problem).replace(/\s+/g, '')}`;

// Entries saved before 1.54.0 may repeat: merged on read, newest first, with
// how many times the problem was solved and when it was first.
export function collapseRepeats(problems) {
  const byKey = new Map();
  for (const p of problems) {
    const key = problemKey(p);
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, { ...p, solveCount: p.solveCount || 1, firstSolvedAt: p.firstSolvedAt || p.createdAt });
      continue;
    }
    kept.solveCount += p.solveCount || 1;
    const first = p.firstSolvedAt || p.createdAt;
    if (first && (!kept.firstSolvedAt || new Date(first) < new Date(kept.firstSolvedAt))) kept.firstSolvedAt = first;
  }
  return [...byKey.values()];
}

// Fetch all problem history from local IndexedDB
export async function fetchProblemHistory() {
  try {
    return collapseRepeats(await getAllProblems());
  } catch (error) {
    console.error('Error fetching problem history:', error);
    throw new Error('Failed to load problem history. Please try again.', { cause: error });
  }
}

// Create a new problem history entry in local IndexedDB
export async function createProblemHistory(problemData) {
  // Validate before the try, so a validation failure reaches the caller with
  // its own message instead of the generic storage one.
  const validation = validateProblemHistory(problemData);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    // Solved before: update that entry (its newest solution, moved to the
    // top, counted) rather than adding a row.
    const key = problemKey(problemData);
    const existing = (await getAllProblems()).filter((p) => problemKey(p) === key);
    if (existing.length > 0) {
      const [latest, ...older] = existing;
      const solveCount = existing.reduce((n, p) => n + (p.solveCount || 1), 0) + 1;
      // Repeats saved before 1.54.0 fold into this one entry.
      for (const p of older) await deleteProblem(p.id);
      return await updateProblem(latest.id, {
        ...problemData,
        createdAt: new Date().toISOString(),
        firstSolvedAt: latest.firstSolvedAt || existing[existing.length - 1].createdAt,
        solveCount,
      });
    }
    return await addProblem(problemData);
  } catch (error) {
    console.error('Error creating problem history:', error);
    throw new Error('Failed to save problem. Please try again.', { cause: error });
  }
}

// Update an existing problem history entity in local IndexedDB
export async function updateProblemHistory(entityId, updateData) {
  if (!entityId) {
    throw new Error('Invalid entity ID');
  }

  try {
    return await updateProblem(entityId, updateData);
  } catch (error) {
    console.error('Error updating problem history:', error);
    throw new Error('Failed to update problem. Please try again.', { cause: error });
  }
}

// Delete one entry from the history (1.59.0). An entry on the page may stand
// for several stored rows (repeats saved before 1.54.0 are merged on read),
// so every row with its key goes: deleting must not leave an older copy to
// reappear.
export async function deleteProblemHistory(entry) {
  if (!entry || entry.problem === undefined || !entry.topic) {
    throw new Error('Invalid history entry');
  }
  try {
    const key = problemKey(entry);
    for (const p of (await getAllProblems()).filter((row) => problemKey(row) === key)) await deleteProblem(p.id);
  } catch (error) {
    console.error('Error deleting problem history:', error);
    throw new Error('Failed to delete that problem. Please try again.', { cause: error });
  }
}

// Clear all problem history from local IndexedDB
export async function clearProblemHistory() {
  try {
    return await clearAllProblems();
  } catch (error) {
    console.error('Error clearing problem history:', error);
    throw new Error('Failed to clear history. Please try again.', { cause: error });
  }
}
