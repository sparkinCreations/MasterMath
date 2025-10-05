import mathsteps from 'mathsteps';
import { create, all } from 'mathjs';
import { isEquation, extractVariable } from '../mathParser';

const math = create(all);

export function solveAlgebra(expression) {
  try {
    let steps = [];
    let answer = '';
    let graph = null;

    if (isEquation(expression)) {
      // Solve equation
      let solutions = [];
      try {
        const result = mathsteps.solveEquation(expression);

        if (result && result.steps && result.steps.length > 0) {
          steps = result.steps.map((step) => {
            if (step.changeType) {
              // Format the change type nicely
              const changeType = step.changeType.replace(/_/g, ' ');
              const equation = step.newEquation || step.newNode?.toString() || '';
              return `${changeType}: ${equation}`;
            }
            return step.newEquation?.toString() || step.newNode?.toString() || '';
          }).filter(Boolean);

          // Extract final answer
          const lastStep = result.steps[result.steps.length - 1];
          answer = lastStep.newEquation?.toString() || result.solution?.toString() || 'x = ?';

          // Extract numerical solutions for graphing
          solutions = extractSolutionsFromAnswer(answer);
        } else {
          // Fallback: try to solve with math.js
          const solved = solveWithMathJS(expression);
          steps = solved.steps;
          answer = solved.answer;
          solutions = solved.solutions || [];
        }
      } catch (e) {
        console.log('mathsteps failed, trying math.js:', e);
        const solved = solveWithMathJS(expression);
        steps = solved.steps;
        answer = solved.answer;
        solutions = solved.solutions || [];
      }

      // Generate graph showing the equation and solution points
      if (solutions.length > 0) {
        graph = generateEquationGraph(expression, solutions);
      }
    } else {
      // Simplify expression
      try {
        const result = mathsteps.simplifyExpression(expression);

        if (result && result.steps && result.steps.length > 0) {
          steps = result.steps.map((step) => {
            if (step.changeType) {
              const changeType = step.changeType.replace(/_/g, ' ');
              const node = step.newNode?.toString() || '';
              return `${changeType}: ${node}`;
            }
            return step.newNode?.toString() || '';
          }).filter(Boolean);

          const lastStep = result.steps[result.steps.length - 1];
          answer = lastStep.newNode?.toString() || expression;
        } else {
          // Fallback: use math.js to simplify
          const simplified = simplifyWithMathJS(expression);
          steps = simplified.steps;
          answer = simplified.answer;
        }

        // Generate graph for the expression
        graph = generateAlgebraGraph(expression);
      } catch (e) {
        console.log('mathsteps failed, trying math.js:', e);
        const simplified = simplifyWithMathJS(expression);
        steps = simplified.steps;
        answer = simplified.answer;
        graph = generateAlgebraGraph(expression);
      }
    }

    const tips = [
      'Combine like terms by adding or subtracting their coefficients',
      'Apply the order of operations (PEMDAS)',
      'Look for common factors to simplify expressions'
    ];

    const common_mistakes = [
      'Forgetting to distribute when multiplying expressions',
      'Incorrectly combining unlike terms',
      'Making sign errors when subtracting negative numbers'
    ];

    return {
      steps: steps.length > 0 ? steps : ['Parse the expression: ' + expression, 'Simplify: ' + answer],
      answer,
      tips,
      common_mistakes,
      graph
    };
  } catch (error) {
    console.error('Algebra solver error:', error);

    // Final fallback
    return {
      steps: [
        'Identify the expression: ' + expression,
        'Apply algebraic rules to simplify',
        'Result: ' + expression
      ],
      answer: expression,
      tips: ['Use * for multiplication (e.g., 2*x)', 'Use ^ for exponents (e.g., x^2)'],
      common_mistakes: ['Using incorrect notation', 'Missing operators'],
      graph: generateAlgebraGraph(expression)
    };
  }
}

// Fallback solver using math.js
function solveWithMathJS(equation) {
  try {
    const steps = [];
    steps.push('Parse the equation: ' + equation);

    // Extract left and right sides of equation
    const variable = extractVariable(equation);
    const parts = equation.split('=');

    if (parts.length !== 2) {
      throw new Error('Invalid equation format');
    }

    const leftSide = parts[0].trim();
    const rightSide = parts[1].trim();

    steps.push(`Move all terms to one side of the equation`);

    // Create expression by moving everything to left side
    let expression = '';
    if (rightSide === '0') {
      expression = leftSide;
    } else {
      expression = `(${leftSide}) - (${rightSide})`;
    }

    steps.push(`Solve: ${expression} = 0`);

    // Try to solve using various methods
    let solutions = [];

    try {
      // Method 1: Try algebraic solving
      const result = math.simplify(expression);
      const solveExpr = `${result.toString()} = 0`;

      // For quadratic equations
      if (expression.includes('^2') || expression.includes('**2')) {
        steps.push('This is a quadratic equation. Apply the quadratic formula or factoring');

        // Try to extract coefficients for ax^2 + bx + c = 0
        const simplified = math.simplify(expression).toString();

        // Evaluate at different points to find roots numerically
        const roots = findRootsNumerically(expression, variable);
        solutions = roots;
      } else {
        // Linear equation - solve directly
        steps.push('This is a linear equation. Isolate the variable');
        const scope = {};

        // Try to solve for the variable
        try {
          const parsed = math.parse(expression);
          const derivative = math.derivative(parsed, variable);

          // For linear: ax + b = 0, solution is x = -b/a
          const aVal = math.evaluate(derivative.toString(), scope);
          scope[variable] = 0;
          const bVal = math.evaluate(expression, scope);

          if (aVal !== 0) {
            const solution = -bVal / aVal;
            solutions = [solution];
          }
        } catch (e) {
          // Try numerical method
          solutions = findRootsNumerically(expression, variable);
        }
      }
    } catch (e) {
      // Fallback to numerical root finding
      solutions = findRootsNumerically(expression, variable);
    }

    if (solutions.length === 0) {
      return {
        steps: ['Parse the equation: ' + equation, 'Unable to find a solution'],
        answer: 'No solution found'
      };
    }

    // Format answer
    let answer = '';
    if (solutions.length === 1) {
      answer = `${variable} = ${solutions[0].toFixed(4)}`;
      steps.push(`Solution: ${variable} = ${solutions[0].toFixed(4)}`);
    } else {
      const formatted = solutions.map(s => s.toFixed(4)).join(' or ');
      answer = `${variable} = ${formatted}`;
      steps.push(`Solutions: ${variable} = ${formatted}`);
    }

    return { steps, answer, solutions };
  } catch (e) {
    console.error('Equation solving error:', e);
    return {
      steps: ['Unable to solve equation - check formatting', 'Try format: 2*x + 5 = 11'],
      answer: 'Could not solve',
      solutions: []
    };
  }
}

// Numerical root finding
function findRootsNumerically(expression, variable) {
  const roots = [];
  const scope = {};

  // Check points from -100 to 100
  let prevValue = null;
  for (let x = -100; x <= 100; x += 0.5) {
    scope[variable] = x;

    try {
      const value = math.evaluate(expression, scope);

      // Check for sign change (indicates a root)
      if (prevValue !== null && Math.sign(prevValue) !== Math.sign(value)) {
        // Refine the root
        const root = findRootBetween(expression, variable, x - 0.5, x);
        if (root !== null && !roots.some(r => Math.abs(r - root) < 0.01)) {
          roots.push(root);
        }
      }

      // Check if very close to zero
      if (Math.abs(value) < 0.001 && !roots.some(r => Math.abs(r - x) < 0.01)) {
        roots.push(x);
      }

      prevValue = value;
    } catch (e) {
      prevValue = null;
    }
  }

  return roots.slice(0, 5); // Return at most 5 roots
}

// Binary search for precise root
function findRootBetween(expression, variable, a, b) {
  const scope = {};
  let left = a;
  let right = b;

  for (let i = 0; i < 20; i++) {
    const mid = (left + right) / 2;
    scope[variable] = mid;

    try {
      const value = math.evaluate(expression, scope);

      if (Math.abs(value) < 0.0001) {
        return mid;
      }

      scope[variable] = left;
      const leftValue = math.evaluate(expression, scope);

      if (Math.sign(leftValue) === Math.sign(value)) {
        left = mid;
      } else {
        right = mid;
      }
    } catch (e) {
      return null;
    }
  }

  return (left + right) / 2;
}

// Simplify expression using math.js
function simplifyWithMathJS(expression) {
  try {
    const steps = [];
    steps.push('Original expression: ' + expression);

    const simplified = math.simplify(expression).toString();

    if (simplified !== expression) {
      steps.push('Combine like terms and simplify');
      steps.push('Simplified form: ' + simplified);
    } else {
      steps.push('Expression is already in simplest form');
    }

    return {
      steps,
      answer: simplified
    };
  } catch (e) {
    return {
      steps: ['Expression: ' + expression],
      answer: expression
    };
  }
}

// Generate graph for algebraic expression
function generateAlgebraGraph(expression) {
  try {
    // Don't graph if it's an equation
    if (isEquation(expression)) {
      return null;
    }

    const variable = extractVariable(expression);
    const points = [];

    for (let i = -10; i <= 10; i += 0.5) {
      const scope = {};
      scope[variable] = i;

      try {
        const y = math.evaluate(expression, scope);
        if (isFinite(y) && Math.abs(y) < 1000) {
          points.push({ x: i, y });
        }
      } catch (e) {
        // Skip points where function is undefined
      }
    }

    if (points.length > 0) {
      return {
        points,
        title: `Graph of ${expression}`,
        description: `Visual representation of the expression`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}

// Generate graph for equation showing the curve and solution points
function generateEquationGraph(equation, solutions) {
  try {
    // Extract left side of equation for graphing
    const parts = equation.split('=');
    if (parts.length !== 2) return null;

    const leftSide = parts[0].trim();
    const variable = extractVariable(equation);
    const points = [];

    // Generate curve points
    for (let i = -10; i <= 10; i += 0.5) {
      const scope = {};
      scope[variable] = i;

      try {
        const y = math.evaluate(leftSide, scope);
        if (isFinite(y) && Math.abs(y) < 1000) {
          points.push({ x: i, y });
        }
      } catch (e) {
        // Skip points where function is undefined
      }
    }

    if (points.length === 0) return null;

    // Format solution points for display
    const solutionText = solutions.length === 1
      ? `Solution at ${variable} = ${solutions[0].toFixed(2)}`
      : `Solutions at ${variable} = ${solutions.map(s => s.toFixed(2)).join(', ')}`;

    return {
      points,
      solutions, // Pass solutions to be rendered as special points
      title: `Graph of ${leftSide}`,
      description: `${solutionText} (shown where the curve crosses y = ${parts[1].trim()})`
    };
  } catch (error) {
    console.error('Equation graph generation error:', error);
    return null;
  }
}

// Extract numerical solutions from answer string
function extractSolutionsFromAnswer(answer) {
  const solutions = [];
  // Match patterns like "x = 3" or "x = -2 or 2"
  const matches = answer.match(/-?\d+\.?\d*/g);
  if (matches) {
    return matches.map(m => parseFloat(m)).filter(n => !isNaN(n));
  }
  return solutions;
}
