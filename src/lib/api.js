// Import IndexedDB functions (local storage - no API needed!)
import { getAllProblems, addProblem, updateProblem, clearAllProblems } from './indexedDB';
import { validateProblemHistory } from './validation';

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
    // Validate inputs
    if (!problem || typeof problem !== 'string') {
      throw new Error('Invalid problem input');
    }

    if (!topic || typeof topic !== 'string') {
      throw new Error('Invalid topic selection');
    }

    // Extract the mathematical expression from natural language
    const expression = extractFunctionFromProblem(problem);

    if (!expression || expression.trim().length === 0) {
      throw new Error('Unable to extract mathematical expression from input');
    }

    let result;

    // Route to appropriate solver based on topic
    switch (topic) {
      case 'algebra':
        result = solveAlgebra(expression);
        break;

      case 'derivatives':
        result = solveDerivative(expression);
        break;

      case 'integrals':
        result = solveIntegral(expression);
        break;

      case 'limits':
        result = solveLimit(expression);
        break;

      case 'trigonometry':
        result = solveTrigonometry(expression);
        break;

      case 'functions':
        result = solveFunctions(expression);
        break;

      case 'other':
        // Arithmetic / Basic Operations
        result = solveArithmetic(expression);
        break;

      default:
        // Try to auto-detect based on keywords
        if (problem.toLowerCase().includes('derivative') || problem.toLowerCase().includes('differentiate')) {
          result = solveDerivative(expression);
        } else if (problem.toLowerCase().includes('integral') || problem.toLowerCase().includes('integrate')) {
          result = solveIntegral(expression);
        } else if (problem.toLowerCase().includes('limit') || problem.toLowerCase().includes('lim')) {
          result = solveLimit(expression);
        } else if (problem.toLowerCase().includes('graph') || expression.includes('f(')) {
          result = solveFunctions(expression);
        } else {
          // Default to algebra for general expressions
          result = solveAlgebra(expression);
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
