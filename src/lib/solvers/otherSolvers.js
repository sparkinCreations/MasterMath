import { create, all } from 'mathjs';
import { extractVariable, parseMathExpression } from '../mathParser';

const math = create(all);

// Limits Solver
export function solveLimit(expression) {
  try {
    const variable = extractVariable(expression);

    // Parse limit notation (e.g., "lim x->0 (sin(x)/x)")
    const limitMatch = expression.match(/(?:lim|limit).*?(?:->|→)\s*(\S+)\s+(.+)/i);
    let approachValue = 0;
    let func = expression;

    if (limitMatch) {
      approachValue = limitMatch[1];
      func = parseMathExpression(limitMatch[2]);
    }

    // Evaluate limit numerically by approaching from both sides
    const leftLimit = evaluateLimitNumerically(func, variable, approachValue, 'left');
    const rightLimit = evaluateLimitNumerically(func, variable, approachValue, 'right');

    const limitExists = Math.abs(leftLimit - rightLimit) < 0.0001;
    const limitValue = limitExists ? leftLimit : 'Does not exist';

    const steps = [
      `Evaluate lim (${variable}→${approachValue}) ${func}`,
      `Approach from the left: ${variable} = ${approachValue} - ε`,
      `Left-hand limit: ${leftLimit.toFixed(4)}`,
      `Approach from the right: ${variable} = ${approachValue} + ε`,
      `Right-hand limit: ${rightLimit.toFixed(4)}`,
      limitExists
        ? `Since left and right limits agree, the limit exists: ${limitValue}`
        : 'The left and right limits do not agree, so the limit does not exist'
    ];

    return {
      steps,
      answer: `lim (${variable}→${approachValue}) ${func} = ${limitValue}`,
      tips: [
        'Check if the function is continuous at the point',
        'Try substituting the value directly first',
        'If you get 0/0, try factoring or using L\'Hôpital\'s rule'
      ],
      common_mistakes: [
        'Forgetting to check both left and right limits',
        'Assuming the limit exists without verification',
        'Confusing the limit value with the function value'
      ],
      graph: generateLimitGraph(func, variable, approachValue)
    };
  } catch (error) {
    console.error('Limit solver error:', error);
    return {
      steps: ['Identify the limit expression', 'Approach the value from both sides', 'Evaluate the limit'],
      answer: 'Unable to evaluate limit',
      tips: ['Check formatting of your limit expression'],
      common_mistakes: ['Using incorrect notation'],
      graph: null
    };
  }
}

function evaluateLimitNumerically(func, variable, approachValue, direction) {
  const epsilon = 0.0001;
  const offset = direction === 'left' ? -epsilon : epsilon;
  const scope = {};
  scope[variable] = parseFloat(approachValue) + offset;

  try {
    return math.evaluate(func, scope);
  } catch (e) {
    return NaN;
  }
}

function generateLimitGraph(func, variable, approachValue) {
  try {
    const points = [];
    const center = parseFloat(approachValue) || 0;

    for (let i = -10; i <= 10; i += 0.2) {
      const scope = {};
      scope[variable] = i;

      try {
        const y = math.evaluate(func, scope);
        if (isFinite(y)) {
          points.push({ x: i, y });
        }
      } catch (e) {
        // Skip points where function is undefined
      }
    }

    if (points.length > 0) {
      return {
        points,
        title: `Graph of f(${variable}) = ${func}`,
        description: `Showing the behavior as ${variable} approaches ${approachValue}`
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}

// Trigonometry Solver
export function solveTrigonometry(expression) {
  try {
    const steps = [];
    steps.push(`Evaluate the trigonometric expression: ${expression}`);

    // Detect what type of trig function is being used
    const hasRadians = expression.includes('pi') || expression.includes('PI');
    const hasDegrees = !hasRadians && /\d+/.test(expression);

    // Evaluate the expression
    let result = math.evaluate(expression);

    // Provide context based on the function
    if (expression.toLowerCase().includes('sin')) {
      steps.push('Using the sine function (opposite/hypotenuse in right triangle)');
      if (hasRadians) {
        steps.push('Input is in radians (π = 180°)');
      }
    } else if (expression.toLowerCase().includes('cos')) {
      steps.push('Using the cosine function (adjacent/hypotenuse in right triangle)');
      if (hasRadians) {
        steps.push('Input is in radians (π = 180°)');
      }
    } else if (expression.toLowerCase().includes('tan')) {
      steps.push('Using the tangent function (opposite/adjacent in right triangle)');
      if (hasRadians) {
        steps.push('Input is in radians (π = 180°)');
      }
    }

    // Check for common angles and provide context
    const commonAngles = {
      'sin(pi/6)': { value: 0.5, degrees: '30°', note: 'sin(30°) = 1/2' },
      'sin(pi/4)': { value: Math.sqrt(2)/2, degrees: '45°', note: 'sin(45°) = √2/2' },
      'sin(pi/3)': { value: Math.sqrt(3)/2, degrees: '60°', note: 'sin(60°) = √3/2' },
      'cos(pi/6)': { value: Math.sqrt(3)/2, degrees: '30°', note: 'cos(30°) = √3/2' },
      'cos(pi/4)': { value: Math.sqrt(2)/2, degrees: '45°', note: 'cos(45°) = √2/2' },
      'cos(pi/3)': { value: 0.5, degrees: '60°', note: 'cos(60°) = 1/2' },
    };

    const normalized = expression.replace(/\s/g, '').toLowerCase();
    if (commonAngles[normalized]) {
      const angle = commonAngles[normalized];
      steps.push(`This is a special angle: ${angle.degrees}`);
      steps.push(`Common value: ${angle.note}`);
    }

    // Format the result nicely
    let formattedResult = result;
    if (typeof result === 'number') {
      // Round to 4 decimal places
      formattedResult = result.toFixed(4);

      // Also provide exact values for common results
      if (Math.abs(result - 0.5) < 0.0001) {
        formattedResult = '0.5000 (or 1/2)';
      } else if (Math.abs(result - Math.sqrt(2)/2) < 0.0001) {
        formattedResult = '0.7071 (or √2/2)';
      } else if (Math.abs(result - Math.sqrt(3)/2) < 0.0001) {
        formattedResult = '0.8660 (or √3/2)';
      } else if (Math.abs(result - 1) < 0.0001) {
        formattedResult = '1.0000';
      } else if (Math.abs(result) < 0.0001) {
        formattedResult = '0.0000';
      }
    }

    steps.push(`Calculate the value: ${formattedResult}`);

    // Generate graph for trig functions
    const graph = generateTrigGraph(expression);

    return {
      steps,
      answer: formattedResult.toString(),
      tips: [
        'Remember: sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2',
        'In math.js, angles are in radians by default (π radians = 180°)',
        'Key identity: sin²(x) + cos²(x) = 1',
        'Use pi for π (e.g., sin(pi/2) for sin(90°))'
      ],
      common_mistakes: [
        'Mixing up radians and degrees (use pi for radians)',
        'Forgetting that tan(90°) is undefined',
        'Not memorizing special angle values',
        'Confusing sin/cos values for complementary angles'
      ],
      graph
    };
  } catch (error) {
    console.error('Trigonometry solver error:', error);
    return {
      steps: [
        'Parse trigonometric expression: ' + expression,
        'Error: Unable to evaluate - check formatting',
        'Try: sin(pi/4) or cos(60*pi/180) for degrees'
      ],
      answer: 'Unable to evaluate',
      tips: ['Use pi for π', 'For degrees: multiply by pi/180'],
      common_mistakes: ['Using incorrect notation'],
      graph: null
    };
  }
}

// Generate graph for trigonometric functions
function generateTrigGraph(expression) {
  try {
    // Check if it's a simple trig function we can graph
    const trigFunctions = ['sin', 'cos', 'tan'];
    const hasTrigFunc = trigFunctions.some(func => expression.toLowerCase().includes(func));

    if (!hasTrigFunc) return null;

    // Determine which function to graph
    let funcToGraph = 'sin(x)';
    if (expression.toLowerCase().includes('cos')) {
      funcToGraph = 'cos(x)';
    } else if (expression.toLowerCase().includes('tan')) {
      funcToGraph = 'tan(x)';
    }

    const points = [];
    const isTan = funcToGraph.includes('tan');

    // Generate points from -2π to 2π
    for (let i = -6.28; i <= 6.28; i += 0.1) {
      const scope = { x: i };

      try {
        const y = math.evaluate(funcToGraph, scope);
        // Limit tan values to prevent huge spikes
        if (isFinite(y) && Math.abs(y) < 10) {
          points.push({ x: i, y });
        }
      } catch (e) {
        // Skip undefined points
      }
    }

    if (points.length > 0) {
      return {
        points,
        title: `Graph of ${funcToGraph}`,
        description: `Showing the ${funcToGraph.split('(')[0]} function over -2π to 2π`
      };
    }
  } catch (error) {
    console.error('Trig graph generation error:', error);
  }

  return null;
}

// Functions/Graphing Solver
export function solveFunctions(expression) {
  try {
    const variable = extractVariable(expression);

    // Extract function from f(x) = ... notation
    let func = expression;
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
    }

    // Generate graph points
    const points = [];
    for (let i = -10; i <= 10; i += 0.5) {
      const scope = {};
      scope[variable] = i;

      try {
        const y = math.evaluate(func, scope);
        if (isFinite(y) && Math.abs(y) < 1000) {
          points.push({ x: i, y });
        }
      } catch (e) {
        // Skip points where function is undefined
      }
    }

    // Find key features
    const vertex = findVertex(points);
    const intercepts = findIntercepts(func, variable);

    const steps = [
      `Analyze the function: f(${variable}) = ${func}`,
      'Identify the type of function (linear, quadratic, etc.)',
      vertex ? `Vertex/extremum: (${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)})` : 'Calculate key features',
      intercepts.length > 0 ? `Intercepts found at ${variable} = ${intercepts.join(', ')}` : 'Find intercepts',
      'Plot points and sketch the graph'
    ];

    return {
      steps,
      answer: `f(${variable}) = ${func}`,
      tips: [
        'Identify the domain and range of the function',
        'Look for symmetry (even/odd functions)',
        'Find critical points where the derivative equals zero'
      ],
      common_mistakes: [
        'Not checking for undefined values in the domain',
        'Misidentifying the type of function',
        'Forgetting to plot enough points for accuracy'
      ],
      graph: points.length > 0 ? {
        points,
        title: `Graph of f(${variable}) = ${func}`,
        description: `This graph shows the function and how it behaves as ${variable} changes from -10 to 10`
      } : null
    };
  } catch (error) {
    console.error('Functions solver error:', error);
    return {
      steps: ['Parse the function', 'Identify key features', 'Generate graph'],
      answer: 'Unable to analyze function',
      tips: ['Check your function notation'],
      common_mistakes: ['Using incorrect syntax'],
      graph: null
    };
  }
}

function findVertex(points) {
  if (points.length === 0) return null;

  // Find point with minimum or maximum y value
  let extremum = points[0];
  for (const point of points) {
    if (Math.abs(point.y) > Math.abs(extremum.y)) {
      extremum = point;
    }
  }

  return extremum;
}

function findIntercepts(func, variable) {
  const intercepts = [];

  // Try to find x-intercepts by checking where function crosses zero
  for (let i = -10; i <= 10; i += 0.5) {
    const scope = {};
    scope[variable] = i;

    try {
      const y = math.evaluate(func, scope);
      if (Math.abs(y) < 0.1) {
        intercepts.push(i.toFixed(1));
      }
    } catch (e) {
      // Skip
    }
  }

  return intercepts.slice(0, 3); // Return at most 3 intercepts
}
