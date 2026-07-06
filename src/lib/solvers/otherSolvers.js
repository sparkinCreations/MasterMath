import { extractVariable, parseMathExpression } from '../mathParser.js';
import { math, beautify, formatNumber, sampleFunction } from './solverUtils.js';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export function solveLimit(expression) {
  try {
    let cleaned = expression.trim().replace(/[.?!]+$/, '').trim();
    cleaned = cleaned.replace(/^(?:find the limit|evaluate the limit|calculate the limit)\s+(?:of\s+)?/i, '');

    let approachValue = 0;
    let func = cleaned;
    let variable = 'x';

    const limitMatch1 = cleaned.match(/(?:lim(?:it)?)\s+(?:as\s+)?([a-z])\s*(?:->|→|approaches)\s*([^\s,]+)[\s,]+(?:of\s+)?(.+)/i);
    const limitMatch2 = cleaned.match(/([a-z])\s*(?:->|→|approaches)\s*([^\s,]+)[\s,]+(.+)/i);
    const limitMatch3 = cleaned.match(/(.+?)\s+as\s+([a-z])\s*(?:->|→|approaches)\s*(.+)/i);

    if (limitMatch1) {
      variable = limitMatch1[1];
      approachValue = limitMatch1[2];
      func = parseMathExpression(limitMatch1[3]);
    } else if (limitMatch2) {
      variable = limitMatch2[1];
      approachValue = limitMatch2[2];
      func = parseMathExpression(limitMatch2[3]);
    } else if (limitMatch3) {
      func = parseMathExpression(limitMatch3[1]);
      variable = limitMatch3[2];
      approachValue = limitMatch3[3].trim();
    } else {
      func = parseMathExpression(cleaned.replace(/^(?:lim(?:it)?)\s*/i, ''));
      variable = extractVariable(func);
    }

    const target = resolveApproachValue(approachValue);
    if (Number.isNaN(target)) {
      throw new Error('Unable to interpret the limit approach value');
    }

    const displayTarget = formatApproach(approachValue, target);
    const result = Number.isFinite(target)
      ? estimateFiniteLimit(func, variable, target)
      : estimateInfiniteLimit(func, variable, target);

    const steps = [
      `Evaluate lim (${variable}→${displayTarget}) ${beautify(func)}`,
      ...result.steps,
    ];

    return {
      steps,
      answer: `lim (${variable}→${displayTarget}) ${beautify(func)} = ${result.answer}`,
      tips: [
        'Try substituting the value directly first — if the function is continuous there, that is the limit.',
        'A 0/0 or ∞/∞ result is indeterminate: factor, rationalize, or use L\'Hôpital\'s rule.',
        'For limits at infinity, compare the growth rates of the numerator and denominator.',
      ],
      common_mistakes: [
        'Assuming the limit equals the function value even at a discontinuity.',
        'Only checking one side when the two sides can disagree.',
        'Stopping at a 0/0 form instead of simplifying first.',
      ],
      graph: generateLimitGraph(func, variable, target, displayTarget),
    };
  } catch (error) {
    console.error('Limit solver error:', error);
    return {
      steps: ['Identify the limit expression', 'Approach the value from both sides', 'Evaluate the limit'],
      answer: 'Unable to evaluate limit',
      tips: ['Check the formatting of your limit expression.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
  }
}

function resolveApproachValue(approachValue) {
  if (typeof approachValue === 'number') return approachValue;

  const normalized = String(approachValue).trim().toLowerCase();
  if (!normalized) return Number.NaN;

  // Recognize infinity in its common written forms.
  if (/^\+?(?:infinity|infty|inf|∞)$/.test(normalized)) return Infinity;
  if (/^-(?:infinity|infty|inf|∞)$/.test(normalized)) return -Infinity;

  try {
    const evaluated = math.evaluate(normalized);
    const numeric = typeof evaluated === 'number' ? evaluated : Number(evaluated);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  } catch {
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
}

function formatApproach(raw, target) {
  if (target === Infinity) return '∞';
  if (target === -Infinity) return '-∞';
  // Keep symbolic forms like pi/2 as typed; otherwise show the clean number.
  const rawStr = String(raw).trim();
  if (/[a-z]/i.test(rawStr)) return rawStr;
  return formatNumber(target);
}

function evalAt(func, variable, x) {
  try {
    const y = math.evaluate(func, { [variable]: x });
    return typeof y === 'number' ? y : Number(y);
  } catch {
    return NaN;
  }
}

function estimateFiniteLimit(func, variable, target) {
  const eps = 1e-6;
  const left = evalAt(func, variable, target - eps);
  const right = evalAt(func, variable, target + eps);
  const direct = evalAt(func, variable, target);

  const steps = [];
  const bothFinite = Number.isFinite(left) && Number.isFinite(right);
  const agree = bothFinite && Math.abs(left - right) < 1e-4;

  if (Number.isFinite(direct)) {
    steps.push(`Substitute directly: at ${variable} = ${formatNumber(target)}, the function is defined and equals ${formatNumber(direct)}.`);
    return { steps, answer: formatNumber(direct) };
  }

  // Direct substitution is undefined (e.g. 0/0) — approach from both sides.
  steps.push(`Direct substitution at ${variable} = ${formatNumber(target)} is undefined (an indeterminate form), so approach from both sides.`);
  steps.push(`From the left (${variable} → ${formatNumber(target)}⁻): ${Number.isFinite(left) ? formatNumber(left) : 'diverges'}`);
  steps.push(`From the right (${variable} → ${formatNumber(target)}⁺): ${Number.isFinite(right) ? formatNumber(right) : 'diverges'}`);

  if (agree) {
    const value = formatNumber((left + right) / 2);
    steps.push(`Both sides approach ${value}, so the limit exists.`);
    return { steps, answer: value };
  }

  steps.push('The one-sided limits disagree, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

function estimateInfiniteLimit(func, variable, target) {
  const sign = target === Infinity ? 1 : -1;
  const samples = [1e2, 1e3, 1e4, 1e6].map((m) => evalAt(func, variable, sign * m));
  const finite = samples.filter((v) => Number.isFinite(v));

  const steps = [`Evaluate the function at increasingly large ${sign > 0 ? 'positive' : 'negative'} values of ${variable}.`];
  steps.push(`Samples: ${samples.map((v) => (Number.isFinite(v) ? formatNumber(v) : '±∞')).join(', ')}`);

  if (finite.length < 2) {
    // Growing without bound — base the sign on the last value we could evaluate.
    const reference = finite.length ? finite[finite.length - 1] : samples[samples.length - 1];
    const answer = reference > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the limit is ${answer}.`);
    return { steps, answer };
  }

  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  if (Math.abs(last - prev) < 1e-3) {
    const value = formatNumber(last);
    steps.push(`The values settle toward ${value}, so that is the limit.`);
    return { steps, answer: value };
  }

  if (Math.abs(last) > Math.abs(prev) * 5) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values keep growing, so the limit is ${answer}.`);
    return { steps, answer };
  }

  steps.push('The values do not settle, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

function generateLimitGraph(func, variable, target, displayTarget) {
  try {
    const center = Number.isFinite(target) ? target : 0;
    const points = sampleFunction(func, variable, { min: center - 10, max: center + 10, step: 0.2, cap: 1000 });

    if (points.length > 0) {
      return {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: `Showing the behavior as ${variable} approaches ${displayTarget}`,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Trigonometry
// ---------------------------------------------------------------------------

const COMMON_DEGREE_VALUES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];

export function solveTrigonometry(expression) {
  try {
    const steps = [];
    steps.push(`Evaluate the trigonometric expression: ${beautify(expression)}`);

    const hasRadians = expression.includes('pi') || expression.includes('PI');
    const hasDegreeSymbol = expression.includes('°');

    const degreeArgMatch = expression.match(/(?:sin|cos|tan|sec|csc|cot)\s*\(\s*(\d+)\s*\)/i);
    const argValue = degreeArgMatch ? parseInt(degreeArgMatch[1], 10) : null;
    const looksLikeDegrees = !hasRadians && argValue !== null && COMMON_DEGREE_VALUES.includes(argValue);

    let result;
    let degreeResult = null;
    const radianResult = math.evaluate(expression);

    if (looksLikeDegrees || hasDegreeSymbol) {
      const degExpr = expression.replace(/(\d+)\s*°?/g, '($1 * pi / 180)');
      try {
        degreeResult = math.evaluate(degExpr);
      } catch {
        // fall back to radian result
      }
    }

    if (looksLikeDegrees && degreeResult !== null) {
      result = degreeResult;
      steps.push(`Detected input as degrees: ${argValue}° = ${argValue} × π/180 radians`);
      steps.push(`Converting: ${argValue}° = ${formatNumber(argValue * Math.PI / 180)} radians`);
    } else if (hasDegreeSymbol && degreeResult !== null) {
      result = degreeResult;
      steps.push('Input is in degrees (° symbol detected), converting to radians.');
    } else {
      result = radianResult;
    }

    const lower = expression.toLowerCase();
    if (lower.includes('sin')) {
      steps.push('Using the sine function (opposite / hypotenuse in a right triangle).');
    } else if (lower.includes('cos')) {
      steps.push('Using the cosine function (adjacent / hypotenuse in a right triangle).');
    } else if (lower.includes('tan')) {
      steps.push('Using the tangent function (opposite / adjacent in a right triangle).');
    }
    if (hasRadians) steps.push('Input is in radians (π = 180°).');

    const commonAngles = {
      'sin(pi/6)': 'sin(30°) = 1/2',
      'sin(pi/4)': 'sin(45°) = √2/2',
      'sin(pi/3)': 'sin(60°) = √3/2',
      'sin(pi/2)': 'sin(90°) = 1',
      'cos(pi/6)': 'cos(30°) = √3/2',
      'cos(pi/4)': 'cos(45°) = √2/2',
      'cos(pi/3)': 'cos(60°) = 1/2',
      'cos(pi/2)': 'cos(90°) = 0',
      'tan(pi/4)': 'tan(45°) = 1',
      'tan(pi/3)': 'tan(60°) = √3',
      'tan(pi/6)': 'tan(30°) = 1/√3',
    };
    const degreeToRadianAngles = {
      30: 'pi/6', 45: 'pi/4', 60: 'pi/3', 90: 'pi/2',
      120: '2*pi/3', 135: '3*pi/4', 150: '5*pi/6', 180: 'pi',
    };

    const normalized = expression.replace(/\s/g, '').toLowerCase();
    if (commonAngles[normalized]) {
      steps.push(`This is a special angle. Common value: ${commonAngles[normalized]}`);
    } else if (looksLikeDegrees && degreeArgMatch) {
      const funcName = expression.match(/(sin|cos|tan)/i)?.[1]?.toLowerCase();
      const radianKey = degreeToRadianAngles[argValue];
      const lookupKey = funcName && radianKey ? `${funcName}(${radianKey})` : null;
      if (lookupKey && commonAngles[lookupKey]) {
        steps.push(`This is a special angle: ${argValue}°. Common value: ${commonAngles[lookupKey]}`);
      }
    }

    const formattedResult = formatTrigResult(result);

    if (looksLikeDegrees && radianResult !== null && degreeResult !== null) {
      steps.push(`Result (treating input as degrees): ${formattedResult}`);
      steps.push(`Note: if you meant radians, the result would be ${formatNumber(radianResult)}.`);
    } else {
      steps.push(`Calculate the value: ${formattedResult}`);
    }

    return {
      steps,
      answer: formattedResult,
      tips: [
        'Remember: sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2.',
        'math.js uses radians by default (π radians = 180°).',
        'Key identity: sin²(x) + cos²(x) = 1.',
        'Use pi for π (e.g., sin(pi/2) for sin(90°)).',
      ],
      common_mistakes: [
        'Mixing up radians and degrees (use pi for radians).',
        'Forgetting that tan(90°) is undefined.',
        'Not memorizing the special-angle values.',
        'Confusing sin/cos values for complementary angles.',
      ],
      graph: generateTrigGraph(expression),
    };
  } catch (error) {
    console.error('Trigonometry solver error:', error);
    return {
      steps: [
        `Parse trigonometric expression: ${expression}`,
        'Unable to evaluate — check the formatting.',
        'Try: sin(pi/4), or cos(60 * pi / 180) for degrees.',
      ],
      answer: 'Unable to evaluate',
      tips: ['Use pi for π', 'For degrees, multiply by pi/180.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
  }
}

function formatTrigResult(result) {
  if (typeof result !== 'number') return String(result);

  const exact = [
    [0.5, '1/2'],
    [-0.5, '-1/2'],
    [Math.sqrt(2) / 2, '√2/2'],
    [-Math.sqrt(2) / 2, '-√2/2'],
    [Math.sqrt(3) / 2, '√3/2'],
    [-Math.sqrt(3) / 2, '-√3/2'],
    [Math.sqrt(3), '√3'],
    [1 / Math.sqrt(3), '1/√3'],
  ];
  for (const [value, label] of exact) {
    if (Math.abs(result - value) < 1e-4) {
      return `${formatNumber(result)} (or ${label})`;
    }
  }
  return formatNumber(result);
}

function generateTrigGraph(expression) {
  try {
    const lower = expression.toLowerCase();
    if (!['sin', 'cos', 'tan'].some((fn) => lower.includes(fn))) return null;

    let funcToGraph = 'sin(x)';
    if (lower.includes('cos')) funcToGraph = 'cos(x)';
    else if (lower.includes('tan')) funcToGraph = 'tan(x)';

    // -2π to 2π; cap keeps tan's asymptotes from exploding the axis.
    const points = sampleFunction(funcToGraph, 'x', { min: -6.28, max: 6.28, step: 0.1, cap: 10 });

    if (points.length > 0) {
      return {
        points,
        title: `Graph of ${funcToGraph}`,
        description: `Showing the ${funcToGraph.split('(')[0]} function over -2π to 2π`,
      };
    }
  } catch (error) {
    console.error('Trig graph generation error:', error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Functions / graphing
// ---------------------------------------------------------------------------

export function solveFunctions(expression) {
  try {
    const variable = extractVariable(expression);

    let func = expression;
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
    }

    const points = sampleFunction(func, variable);
    const vertex = findVertex(points);
    const intercepts = findIntercepts(func, variable);

    const steps = [
      `Analyze the function: f(${variable}) = ${beautify(func)}`,
      'Identify the type of function (linear, quadratic, etc.).',
      vertex ? `Vertex / extremum near (${formatNumber(vertex.x)}, ${formatNumber(vertex.y)}).` : 'Calculate the key features.',
      intercepts.length > 0
        ? `x-intercepts near ${variable} = ${intercepts.map(formatNumber).join(', ')}.`
        : 'No x-intercepts found in the sampled range.',
      'Plot the points and sketch the graph.',
    ];

    return {
      steps,
      answer: `f(${variable}) = ${beautify(func)}`,
      tips: [
        'Identify the domain and range of the function.',
        'Look for symmetry (even or odd functions).',
        'Critical points occur where the derivative equals zero.',
      ],
      common_mistakes: [
        'Not checking for undefined values in the domain.',
        'Misidentifying the type of function.',
        'Plotting too few points to see the shape.',
      ],
      graph: points.length > 0 ? {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: `The function as ${variable} ranges from -10 to 10`,
      } : null,
    };
  } catch (error) {
    console.error('Functions solver error:', error);
    return {
      steps: ['Parse the function', 'Identify the key features', 'Generate the graph'],
      answer: 'Unable to analyze function',
      tips: ['Check your function notation.'],
      common_mistakes: ['Using incorrect syntax'],
      graph: null,
    };
  }
}

function findVertex(points) {
  if (points.length < 3) return null;
  const extrema = [];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i].y - points[i - 1].y;
    const after = points[i + 1].y - points[i].y;
    if ((before <= 0 && after >= 0) || (before >= 0 && after <= 0)) {
      extrema.push(points[i]);
    }
  }
  if (extrema.length > 0) {
    return extrema.reduce((closest, point) => (Math.abs(point.x) < Math.abs(closest.x) ? point : closest));
  }
  return points[Math.floor(points.length / 2)];
}

function findIntercepts(func, variable) {
  const intercepts = [];
  for (let i = -10; i <= 10; i += 0.5) {
    let y;
    try {
      y = math.evaluate(func, { [variable]: i });
    } catch {
      continue;
    }
    if (Number.isFinite(y) && Math.abs(y) < 0.1) intercepts.push(i);
  }
  return intercepts.slice(0, 3);
}
