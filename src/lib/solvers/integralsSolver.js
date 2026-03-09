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
  const expr = expression.toLowerCase();

  steps.push(`Identify the function we want to integrate: ∫(${expression}) d${variable}`);

  // Detect which rules/techniques are involved
  const hasTrigFunctions = /\b(sin|cos|tan|sec|csc|cot)\b/.test(expr);
  const hasExpOrLn = /\b(exp|ln|log)\b/.test(expr) || expr.includes('e^');
  const hasSqrt = /\bsqrt\b/.test(expr) || expr.includes('√');
  const hasPower = /\^\s*\d+/.test(expression) || /\*\*\s*\d+/.test(expression);

  // Check for u-substitution indicators: function of a function
  const hasUSubstitution = hasTrigFunctions && new RegExp(`\\b(?:sin|cos|tan)\\s*\\([^)]*[${variable}][^)]*[+\\-*/^]`).test(expression) ||
    hasExpOrLn && new RegExp(`(?:exp|ln)\\s*\\([^)]*[${variable}][^)]*[+\\-*/^]`).test(expression) ||
    /\([^)]+\)\s*\^\s*\d+/.test(expression);

  // Check for integration by parts indicators: product of different function types
  const hasIntegrationByParts = /[a-z][^+\-]*\*[^+\-]*[a-z]/i.test(expression) &&
    (hasTrigFunctions || hasExpOrLn) &&
    (hasPower || /\b[a-z]\b/.test(expr));

  // Sum/difference rule
  if (expression.includes('+') || /[^e]-/.test(expression)) {
    steps.push('Apply the sum/difference rule: the integral of a sum is the sum of the integrals');
  }

  // Power rule
  if (hasPower) {
    steps.push(`Apply the power rule: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C (where n ≠ -1)`);
  }

  // U-substitution
  if (hasUSubstitution) {
    steps.push(`This may require u-substitution: let u = inner function, then du = u' d${variable}`);
    steps.push('Rewrite the integral in terms of u, integrate, then substitute back');
  }

  // Integration by parts
  if (hasIntegrationByParts && !hasUSubstitution) {
    steps.push(`This may require integration by parts: ∫u dv = uv − ∫v du`);
    steps.push('Choose u and dv using the LIATE rule (Logarithmic, Inverse trig, Algebraic, Trig, Exponential)');
  }

  // Trig integrals
  if (hasTrigFunctions) {
    if (expr.includes('sin')) steps.push(`Trig integral: ∫sin(${variable}) d${variable} = -cos(${variable}) + C`);
    if (expr.includes('cos')) steps.push(`Trig integral: ∫cos(${variable}) d${variable} = sin(${variable}) + C`);
    if (expr.includes('sec') && expr.includes('^2')) steps.push(`Trig integral: ∫sec²(${variable}) d${variable} = tan(${variable}) + C`);
    if (expr.includes('tan') && !expr.includes('^2')) steps.push(`Trig integral: ∫tan(${variable}) d${variable} = -ln|cos(${variable})| + C`);
  }

  // Exponential and logarithmic
  if (hasExpOrLn) {
    if (expr.includes('e^') || expr.includes('exp')) steps.push(`Exponential integral: ∫e^${variable} d${variable} = e^${variable} + C`);
    if (expr.includes('1/' + variable) || expr.includes(variable + '^(-1)')) steps.push(`Reciprocal integral: ∫1/${variable} d${variable} = ln|${variable}| + C`);
  }

  // Square root
  if (hasSqrt) {
    steps.push(`Rewrite √(${variable}) as ${variable}^(1/2), then apply the power rule`);
  }

  // Constant multiplication
  if (expression.includes('*')) {
    const hasConstant = expression.match(/\d+\s*\*/);
    if (hasConstant) {
      steps.push('Constants can be factored out: ∫c·f(x)dx = c·∫f(x)dx');
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
    const secondaryPoints = [];

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

      try {
        const iy = math.evaluate(integral, scope);
        if (isFinite(iy) && Math.abs(iy) < 1000) {
          secondaryPoints.push({ x: i, y: iy });
        }
      } catch (e) {
        // Skip points where integral is undefined
      }
    }

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        secondaryLabel: `F(${variable}) = ${integral}`,
        title: `Graph of f(${variable}) = ${original}`,
        description: `Blue/purple: f(${variable}) = ${original}  |  Green: F(${variable}) = ${integral} (antiderivative)`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
