// Solvers with the ⟦…⟧ math markers taken out of the steps: the text a
// reader sees, and what every export carries. For tests about the wording
// of a step; tests about the markup itself call the solvers directly.
import { solveProblem } from '../../src/lib/api.js';
import { solveLimit } from '../../src/lib/solvers/limitsSolver.js';
import { stripMathMarkers } from '../../src/lib/mathMarkers.js';

export const plain = (r) => ({ ...r, steps: (r.steps || []).map(stripMathMarkers) });

export async function solvePlain(problem, topic) {
  return plain(await solveProblem(problem, topic));
}

export async function solveLimitPlain(...args) {
  return plain(await solveLimit(...args));
}
