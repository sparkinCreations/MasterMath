// Import IndexedDB functions (local storage - no API needed!)
import { getAllProblems, addProblem, updateProblem, clearAllProblems } from './indexedDB.js';
import { validateProblemHistory } from './validation.js';
import { extractFunctionFromProblem } from './mathParser.js';

// Fetch all problem history from local IndexedDB
export async function fetchProblemHistory() {
  try {
    return await getAllProblems();
  } catch (error) {
    console.error('Error fetching problem history:', error);
    throw new Error('Failed to load problem history. Please try again.');
  }
}

// Create a new problem history entry in local IndexedDB
export async function createProblemHistory(problemData) {
  try {
    // Validate data before saving
    const validation = validateProblemHistory(problemData);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    return await addProblem(problemData);
  } catch (error) {
    console.error('Error creating problem history:', error);
    throw new Error('Failed to save problem. Please try again.');
  }
}

// Update an existing problem history entity in local IndexedDB
export async function updateProblemHistory(entityId, updateData) {
  try {
    if (!entityId) {
      throw new Error('Invalid entity ID');
    }
    return await updateProblem(entityId, updateData);
  } catch (error) {
    console.error('Error updating problem history:', error);
    throw new Error('Failed to update problem. Please try again.');
  }
}

// Clear all problem history from local IndexedDB
export async function clearProblemHistory() {
  try {
    return await clearAllProblems();
  } catch (error) {
    console.error('Error clearing problem history:', error);
    throw new Error('Failed to clear history. Please try again.');
  }
}

async function loadSolver(topic) {
  switch (topic) {
    case 'algebra':
      return (await import('./solvers/algebraSolver.js')).solveAlgebra;
    case 'derivatives':
      return (await import('./solvers/derivativesSolver.js')).solveDerivative;
    case 'integrals':
      return (await import('./solvers/integralsSolver.js')).solveIntegral;
    case 'limits':
      return (await import('./solvers/otherSolvers.js')).solveLimit;
    case 'trigonometry':
      return (await import('./solvers/otherSolvers.js')).solveTrigonometry;
    case 'functions':
      return (await import('./solvers/otherSolvers.js')).solveFunctions;
    case 'other':
      return (await import('./solvers/arithmeticSolver.js')).solveArithmetic;
    default:
      return null;
  }
}

async function resolveSolver(problem, topic) {
  const solver = await loadSolver(topic);
  if (solver) {
    return solver;
  }

  const lower = problem.toLowerCase();
  if (lower.includes('derivative') || lower.includes('differentiate')) {
    return loadSolver('derivatives').then((fn) => fn);
  }
  if (lower.includes('integral') || lower.includes('integrate')) {
    return loadSolver('integrals').then((fn) => fn);
  }
  if (lower.includes('limit') || lower.includes('lim')) {
    return loadSolver('limits').then((fn) => fn);
  }

  const expression = extractFunctionFromProblem(problem);
  if (lower.includes('graph') || expression.includes('f(')) {
    return loadSolver('functions').then((fn) => fn);
  }

  return loadSolver('algebra').then((fn) => fn);
}

// Real math solver using local libraries
export async function solveProblem(problem, topic) {
  try {
    // Validate inputs
    if (!problem || typeof problem !== 'string') {
      throw new Error('Invalid problem input');
    }

    if (!topic || typeof topic !== 'string') {
      throw new Error('Invalid topic selection');
    }

    const solver = await resolveSolver(problem, topic);
    if (!solver) {
      throw new Error('No solver available for this topic');
    }

    let result;

    // Route to appropriate solver based on topic
    switch (topic) {
      case 'limits':
        // Pass raw problem text so the limit solver can extract the approach value
        result = await solver(problem);
        break;

      default: {
        const expression = extractFunctionFromProblem(problem);
        if (!expression || expression.trim().length === 0) {
          throw new Error('Unable to extract mathematical expression from input');
        }
        result = await solver(expression);
        break;
      }
    }

    // Validate result structure
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid solver result');
    }

    if (!result.steps || !Array.isArray(result.steps)) {
      result.steps = ['Solution computed'];
    }

    if (!result.answer) {
      throw new Error('No solution found');
    }

    if (!result.tips || !Array.isArray(result.tips)) {
      result.tips = [];
    }

    if (!result.common_mistakes || !Array.isArray(result.common_mistakes)) {
      result.common_mistakes = [];
    }

    return result;

  } catch (error) {
    console.error('Solver error:', error);

    // Create a more helpful error message
    const errorMessage = error.message || 'An unexpected error occurred';

    // Fallback response if all solvers fail
    return {
      steps: [
        `Error: ${errorMessage}`,
        'Please check your input and try again'
      ],
      answer: 'Unable to solve this problem',
      tips: [
        'Make sure your expression uses standard mathematical notation',
        'Use * for multiplication (e.g., 2*x instead of 2x)',
        'Use ^ for exponents (e.g., x^2 instead of x²)',
        'Ensure all parentheses are balanced',
        'Check for typos in function names (sin, cos, tan, sqrt, etc.)'
      ],
      common_mistakes: [
        'Using ambiguous notation',
        'Missing operators between terms',
        'Incorrectly formatted functions',
        'Unbalanced parentheses',
        'Invalid characters in expressions'
      ],
      graph: null
    };
  }
}
