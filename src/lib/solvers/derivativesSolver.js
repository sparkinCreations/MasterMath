import Algebrite from 'algebrite';
import { create, all } from 'mathjs';
import { extractVariable } from '../mathParser';

const math = create(all);

export function solveDerivative(expression) {
  try {
    const variable = extractVariable(expression);

    // Use Algebrite to compute the derivative
    const derivative = Algebrite.derivative(expression, variable).toString();

    // Generate step-by-step explanation
    const steps = generateDerivativeSteps(expression, derivative, variable);

    const tips = [
      `Remember to apply the power rule: d/d${variable}(${variable}^n) = n*${variable}^(n-1)`,
      'The derivative of a constant is 0',
      `Always check if there are any constants that need to be multiplied by the derivative of the variable term`
    ];

    const common_mistakes = [
      'Forgetting to apply the power rule correctly, especially for terms with coefficients',
      'Leaving out the constant factor when differentiating terms like 3x',
      'Miscalculating the coefficient or exponent during differentiation'
    ];

    return {
      steps,
      answer: `f'(${variable}) = ${derivative}`,
      tips,
      common_mistakes,
      graph: generateDerivativeGraph(expression, derivative, variable)
    };
  } catch (error) {
    console.error('Derivative solver error:', error);
    return {
      steps: [
        `Identify the function to differentiate: f(x) = ${expression}`,
        'Apply differentiation rules',
        'Simplify the result'
      ],
      answer: 'Unable to compute derivative',
      tips: ['Check that your function is properly formatted'],
      common_mistakes: ['Using incorrect notation'],
      graph: null
    };
  }
}

function generateDerivativeSteps(expression, derivative, variable) {
  const steps = [];

  steps.push(`Identify the function we want to differentiate: f(${variable}) = ${expression}`);

  // Analyze the expression to provide relevant steps
  if (expression.includes('+') || expression.includes('-')) {
    steps.push(`Apply the sum/difference rule: the derivative of a sum is the sum of the derivatives`);
  }

  if (expression.match(/\^\s*\d+/) || expression.match(/\*\*\s*\d+/)) {
    steps.push(`Apply the power rule: if f(${variable}) = ${variable}^n, then f'(${variable}) = n*${variable}^(n-1)`);
  }

  if (expression.includes('*')) {
    const hasConstant = expression.match(/\d+\s*\*/);
    if (hasConstant) {
      steps.push('Constants can be factored out: d/dx(c*f(x)) = c*f\'(x)');
    }
  }

  steps.push(`Differentiate each term according to the appropriate rule`);
  steps.push(`Simplify the expression`);
  steps.push(`Final result: f'(${variable}) = ${derivative}`);

  return steps;
}

function generateDerivativeGraph(original, derivative, variable) {
  try {
    const points = [];

    for (let i = -10; i <= 10; i += 0.5) {
      const scope = {};
      scope[variable] = i;

      try {
        const y = math.evaluate(original, scope);
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
        title: `Graph of f(${variable}) = ${original}`,
        description: `The derivative f'(${variable}) = ${derivative} represents the slope at each point`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
