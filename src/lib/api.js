// Import IndexedDB functions (local storage - no API needed!)
import { getAllProblems, addProblem, updateProblem, clearAllProblems } from './indexedDB';

// Fetch all problem history from local IndexedDB
export async function fetchProblemHistory() {
  return await getAllProblems();
}

// Create a new problem history entry in local IndexedDB
export async function createProblemHistory(problemData) {
  return await addProblem(problemData);
}

// Update an existing problem history entity in local IndexedDB
export async function updateProblemHistory(entityId, updateData) {
  return await updateProblem(entityId, updateData);
}

// Clear all problem history from local IndexedDB
export async function clearProblemHistory() {
  return await clearAllProblems();
}

// Import solvers
import { solveAlgebra } from './solvers/algebraSolver';
import { solveDerivative } from './solvers/derivativesSolver';
import { solveIntegral } from './solvers/integralsSolver';
import { solveLimit, solveTrigonometry, solveFunctions } from './solvers/otherSolvers';
import { solveArithmetic } from './solvers/arithmeticSolver';
import { extractFunctionFromProblem } from './mathParser';

// Real math solver using local libraries
export async function solveProblem(problem, topic) {
  // Simulate slight delay for UX (so users see the loading state)
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Extract the mathematical expression from natural language
    const expression = extractFunctionFromProblem(problem);

    // Route to appropriate solver based on topic
    switch (topic) {
      case 'algebra':
        return solveAlgebra(expression);

      case 'derivatives':
        return solveDerivative(expression);

      case 'integrals':
        return solveIntegral(expression);

      case 'limits':
        return solveLimit(expression);

      case 'trigonometry':
        return solveTrigonometry(expression);

      case 'functions':
        return solveFunctions(expression);

      case 'other':
        // Arithmetic / Basic Operations
        return solveArithmetic(expression);

      default:
        // Try to auto-detect based on keywords
        if (problem.toLowerCase().includes('derivative') || problem.toLowerCase().includes('differentiate')) {
          return solveDerivative(expression);
        } else if (problem.toLowerCase().includes('integral') || problem.toLowerCase().includes('integrate')) {
          return solveIntegral(expression);
        } else if (problem.toLowerCase().includes('limit') || problem.toLowerCase().includes('lim')) {
          return solveLimit(expression);
        } else if (problem.toLowerCase().includes('graph') || expression.includes('f(')) {
          return solveFunctions(expression);
        } else {
          // Default to algebra for general expressions
          return solveAlgebra(expression);
        }
    }
  } catch (error) {
    console.error('Solver error:', error);

    // Fallback response if all solvers fail
    return {
      steps: [
        'Parse the problem: ' + problem,
        'Apply appropriate mathematical rules',
        'Simplify and solve'
      ],
      answer: 'Unable to solve - please check your input formatting',
      tips: [
        'Make sure your expression uses standard mathematical notation',
        'Use * for multiplication (e.g., 2*x instead of 2x)',
        'Use ^ for exponents (e.g., x^2 instead of x²)'
      ],
      common_mistakes: [
        'Using ambiguous notation',
        'Missing operators between terms',
        'Incorrectly formatted functions'
      ],
      graph: null
    };
  }
}
