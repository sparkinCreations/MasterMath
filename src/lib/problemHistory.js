// The problem history store: IndexedDB through indexedDB.js, behind
// wrappers whose errors are fit for a toast. Its own module, apart from the
// solve router in api.js: the Solver, Progress and Settings pages import
// these, and importing api.js for them pulled mathjs (79 kB gzipped) onto the
// main thread of each page, where nothing else needs it. Solving happens in
// the worker (budgetedSolver.js).
import { getAllProblems, addProblem, updateProblem, clearAllProblems } from './indexedDB.js';
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

// Fetch all problem history from local IndexedDB
export async function fetchProblemHistory() {
  try {
    return await getAllProblems();
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

// Clear all problem history from local IndexedDB
export async function clearProblemHistory() {
  try {
    return await clearAllProblems();
  } catch (error) {
    console.error('Error clearing problem history:', error);
    throw new Error('Failed to clear history. Please try again.', { cause: error });
  }
}
