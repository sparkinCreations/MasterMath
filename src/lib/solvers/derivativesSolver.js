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
  const expr = expression.toLowerCase();

  steps.push(`Identify the function we want to differentiate: f(${variable}) = ${expression}`);

  // Detect which rules are needed based on expression structure
  const hasTrigFunctions = /\b(sin|cos|tan|sec|csc|cot)\b/.test(expr);
  const hasExpOrLn = /\b(exp|ln|log)\b/.test(expr) || expr.includes('e^');
  const hasSqrt = /\bsqrt\b/.test(expr) || expr.includes('√');
  const hasPower = /\^\s*\d+/.test(expression) || /\*\*\s*\d+/.test(expression);

  // Check for product rule: two or more variable-containing terms multiplied
  // e.g., "x*sin(x)", "(x^2)*(x+1)"
  const hasProductRule = /[a-z][^+\-]*\*[^+\-]*[a-z]/i.test(expression) &&
    !/^\d+\s*\*/.test(expression.trim()); // exclude constant * expression

  // Check for quotient rule: expression with division where both sides have the variable
  const divParts = expression.split('/');
  const hasQuotientRule = divParts.length >= 2 &&
    new RegExp(variable).test(divParts[0]) &&
    new RegExp(variable).test(divParts.slice(1).join('/'));

  // Check for chain rule: function of a function, e.g., sin(x^2), (x+1)^3, e^(2x)
  const hasChainRule = hasTrigFunctions && new RegExp(`\\b(?:sin|cos|tan|sec|csc|cot)\\s*\\([^)]*[${variable}][^)]*[+\\-*/^][^)]*\\)`).test(expression) ||
    hasSqrt && new RegExp(`sqrt\\s*\\([^)]*[${variable}][^)]*[+\\-*/^]`).test(expression) ||
    hasExpOrLn && new RegExp(`(?:exp|ln|log)\\s*\\([^)]*[${variable}][^)]*[+\\-*/^]`).test(expression) ||
    /\([^)]+\)\s*\^\s*\d+/.test(expression); // (expr)^n

  // Sum/difference rule
  if (expression.includes('+') || /[^e]-/.test(expression)) {
    steps.push(`Apply the sum/difference rule: the derivative of a sum is the sum of the derivatives`);
  }

  // Power rule
  if (hasPower) {
    steps.push(`Apply the power rule: if f(${variable}) = ${variable}^n, then f'(${variable}) = n·${variable}^(n-1)`);
  }

  // Chain rule
  if (hasChainRule) {
    steps.push(`Apply the chain rule: d/d${variable}[f(g(${variable}))] = f'(g(${variable})) · g'(${variable})`);
    steps.push('Identify the outer function and the inner function, then differentiate each');
  }

  // Product rule
  if (hasProductRule) {
    steps.push(`Apply the product rule: d/d${variable}[u·v] = u'·v + u·v'`);
    steps.push('Identify the two factors, differentiate each separately, then combine');
  }

  // Quotient rule
  if (hasQuotientRule) {
    steps.push(`Apply the quotient rule: d/d${variable}[u/v] = (u'·v − u·v') / v²`);
    steps.push('Identify the numerator (u) and denominator (v), differentiate each');
  }

  // Trig functions
  if (hasTrigFunctions) {
    if (expr.includes('sin')) steps.push(`Trig derivative: d/d${variable}[sin(${variable})] = cos(${variable})`);
    if (expr.includes('cos')) steps.push(`Trig derivative: d/d${variable}[cos(${variable})] = -sin(${variable})`);
    if (expr.includes('tan')) steps.push(`Trig derivative: d/d${variable}[tan(${variable})] = sec²(${variable})`);
    if (expr.includes('sec')) steps.push(`Trig derivative: d/d${variable}[sec(${variable})] = sec(${variable})·tan(${variable})`);
    if (expr.includes('csc')) steps.push(`Trig derivative: d/d${variable}[csc(${variable})] = -csc(${variable})·cot(${variable})`);
    if (expr.includes('cot')) steps.push(`Trig derivative: d/d${variable}[cot(${variable})] = -csc²(${variable})`);
  }

  // Exponential and logarithmic
  if (hasExpOrLn) {
    if (expr.includes('e^') || expr.includes('exp')) steps.push(`Exponential derivative: d/d${variable}[e^${variable}] = e^${variable}`);
    if (expr.includes('ln')) steps.push(`Logarithmic derivative: d/d${variable}[ln(${variable})] = 1/${variable}`);
    if (expr.includes('log')) steps.push(`Log derivative: d/d${variable}[log(${variable})] = 1/(${variable}·ln(10))`);
  }

  // Square root
  if (hasSqrt) {
    steps.push(`Rewrite √(${variable}) as ${variable}^(1/2), then apply the power rule`);
  }

  // Constant multiplication
  if (expression.includes('*')) {
    const hasConstant = expression.match(/\d+\s*\*/);
    if (hasConstant && !hasProductRule) {
      steps.push('Constants can be factored out: d/dx(c·f(x)) = c·f\'(x)');
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
        const dy = math.evaluate(derivative, scope);
        if (isFinite(dy) && Math.abs(dy) < 1000) {
          secondaryPoints.push({ x: i, y: dy });
        }
      } catch (e) {
        // Skip points where derivative is undefined
      }
    }

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        secondaryLabel: `f'(${variable}) = ${derivative}`,
        title: `Graph of f(${variable}) = ${original}`,
        description: `Blue/purple: f(${variable}) = ${original}  |  Green: f'(${variable}) = ${derivative} (slope at each point)`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
