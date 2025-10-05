import Algebrite from 'algebrite';
import { create, all } from 'mathjs';
import { extractVariable } from '../mathParser';

const math = create(all);

export function solveIntegral(expression) {
  try {
    const variable = extractVariable(expression);

    // Use Algebrite to compute the integral
    const integral = Algebrite.integral(expression, variable).toString();

    // Generate step-by-step explanation
    const steps = generateIntegralSteps(expression, integral, variable);

    const tips = [
      `Remember the power rule for integration: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C`,
      'Don\'t forget to add the constant of integration (+C) for indefinite integrals',
      'The integral of a constant k is k*x + C'
    ];

    const common_mistakes = [
      'Forgetting to add the constant of integration (+C)',
      'Incorrectly applying the power rule, especially with the (n+1) in the denominator',
      'Leaving out the constant factor when integrating terms like 3x'
    ];

    return {
      steps,
      answer: `∫(${expression}) d${variable} = ${integral} + C`,
      tips,
      common_mistakes,
      graph: generateIntegralGraph(expression, integral, variable)
    };
  } catch (error) {
    console.error('Integral solver error:', error);
    return {
      steps: [
        `Identify the function to integrate: ∫(${expression}) dx`,
        'Apply integration rules',
        'Add constant of integration',
        'Simplify the result'
      ],
      answer: 'Unable to compute integral',
      tips: ['Check that your function is properly formatted'],
      common_mistakes: ['Using incorrect notation'],
      graph: null
    };
  }
}

function generateIntegralSteps(expression, integral, variable) {
  const steps = [];

  steps.push(`Identify the function we want to integrate: ∫(${expression}) d${variable}`);

  // Analyze the expression to provide relevant steps
  if (expression.includes('+') || expression.includes('-')) {
    steps.push('Apply the sum/difference rule: the integral of a sum is the sum of the integrals');
  }

  if (expression.match(/\^\s*\d+/) || expression.match(/\*\*\s*\d+/)) {
    steps.push(`Apply the power rule: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C`);
  }

  if (expression.includes('*')) {
    const hasConstant = expression.match(/\d+\s*\*/);
    if (hasConstant) {
      steps.push('Constants can be factored out: ∫c*f(x)dx = c*∫f(x)dx');
    }
  }

  steps.push('Integrate each term according to the appropriate rule');
  steps.push('Add the constant of integration (+C)');
  steps.push(`Final result: ${integral} + C`);

  return steps;
}

function generateIntegralGraph(original, integral, variable) {
  try {
    const points = [];

    for (let i = -10; i <= 10; i += 0.5) {
      const scope = {};
      scope[variable] = i;

      try {
        // Evaluate the original function
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
        description: `The area under this curve is given by the integral: ${integral} + C`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
