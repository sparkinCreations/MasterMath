import {
  loadAlgebrite,
  beautify,
  splitTerms,
  sampleFunction,
  hasVariable,
} from './solverUtils.js';
import { extractVariable } from '../mathParser.js';

export async function solveIntegral(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = extractVariable(expression);

    // Authoritative antiderivative for the whole expression.
    const integral = Algebrite.integral(expression, variable).toString();

    const steps = generateIntegralSteps(expression, integral, variable, Algebrite);

    const tips = [
      `Power rule: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C  (n ≠ -1)`,
      'Always add the constant of integration (+C) for an indefinite integral.',
      'Constant factors pull out front: ∫c·f dx = c·∫f dx.',
    ];

    const common_mistakes = [
      'Forgetting the constant of integration (+C).',
      'Mishandling the (n+1) denominator in the power rule.',
      'Applying the power rule to 1/x — that integrates to ln|x|, not x⁰/0.',
    ];

    return {
      steps,
      answer: `∫(${beautify(expression)}) d${variable} = ${beautify(integral)} + C`,
      tips,
      common_mistakes,
      graph: generateIntegralGraph(expression, integral, variable),
    };
  } catch (error) {
    console.error('Integral solver error:', error);
    return {
      steps: [
        `Identify the function to integrate: ∫(${expression}) dx`,
        'Integrate each term, applying the appropriate rule',
        'Add the constant of integration (+C)',
      ],
      answer: 'Unable to compute integral',
      tips: ['Check that your function is properly formatted.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
  }
}

/**
 * Worked steps: integrate each top-level term individually with Algebrite and
 * show the intermediate antiderivative, then combine and add +C. Integration is
 * linear, so this term-by-term breakdown is exact.
 */
function generateIntegralSteps(expression, integral, variable, Algebrite) {
  const steps = [];
  steps.push(`Identify the function to integrate: ∫(${beautify(expression)}) d${variable}`);

  const terms = splitTerms(expression);

  if (terms.length > 1) {
    steps.push('Apply the sum rule: integrate each term separately, then add the results.');
  }

  for (const { signed } of terms) {
    const { label, hint } = classifyIntegralRule(signed, variable);
    let termIntegral = null;
    try {
      termIntegral = Algebrite.integral(signed, variable).toString();
    } catch {
      termIntegral = null;
    }

    if (hint) {
      steps.push(`${label} — ${hint}.`);
    }

    if (termIntegral !== null) {
      steps.push(`∫(${beautify(signed)}) d${variable} = ${beautify(termIntegral)}`);
    } else {
      steps.push(`Integrate ${beautify(signed)} using the ${label.toLowerCase()}.`);
    }
  }

  if (terms.length > 1) {
    steps.push(`Add the term integrals: ${beautify(integral)}`);
  }

  steps.push(`Add the constant of integration: ∫(${beautify(expression)}) d${variable} = ${beautify(integral)} + C`);

  return steps;
}

/**
 * Classify which integration technique a single term needs. Because it operates
 * on one term at a time, the heuristics are reliable and the label sits next to
 * the real computed antiderivative.
 */
function classifyIntegralRule(term, variable) {
  const v = variable;

  if (!hasVariable(term, v)) {
    return { label: 'Constant rule', hint: `∫c d${v} = c·${v}` };
  }

  const inner = term.replace(/^[-+]/, '');

  // Reciprocal: 1/x or x^-1.
  if (new RegExp(`(?:^|[^a-z])1\\s*/\\s*${v}\\b`, 'i').test(inner) || new RegExp(`${v}\\s*\\^\\s*-\\s*1\\b`, 'i').test(inner)) {
    return { label: 'Reciprocal rule', hint: `∫1/${v} d${v} = ln|${v}|` };
  }

  // Products mixing function families usually need integration by parts.
  const factors = splitTopLevel(inner, '*');
  const varFactors = factors.filter((f) => hasVariable(f, v));
  const mixesFamilies =
    varFactors.length >= 2 &&
    /\b(?:sin|cos|tan|exp|ln|log)\b|e\^/i.test(inner);
  if (mixesFamilies) {
    return {
      label: 'Integration by parts',
      hint: '∫u dv = uv − ∫v du (choose u by LIATE: Log, Inverse-trig, Algebraic, Trig, Exponential)',
    };
  }

  // Composite function → u-substitution.
  if (isComposite(inner, v)) {
    return { label: 'u-substitution', hint: `let u = the inner function, then du = u′ d${v}` };
  }

  if (/\bsin\b/i.test(inner)) return { label: 'Trig rule', hint: `∫sin(${v}) d${v} = -cos(${v})` };
  if (/\bcos\b/i.test(inner)) return { label: 'Trig rule', hint: `∫cos(${v}) d${v} = sin(${v})` };
  if (/\bexp\b|e\^/i.test(inner)) return { label: 'Exponential rule', hint: `∫e^${v} d${v} = e^${v}` };
  if (/\bsqrt\b|√/i.test(inner)) return { label: 'Power rule', hint: `rewrite √${v} as ${v}^(1/2), then use the power rule` };

  if (/\^/.test(inner)) return { label: 'Power rule', hint: `∫${v}^n d${v} = ${v}^(n+1)/(n+1)` };

  // Linear term (a·x or x).
  return { label: 'Power rule', hint: `∫${v} d${v} = ${v}²/2` };
}

function isComposite(term, variable) {
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]/.test(arg)) return true;
  }
  if (/\([^()]*[+\-*/][^()]*\)\s*\^/.test(term)) return true;
  return false;
}

function splitTopLevel(str, delimiter) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function generateIntegralGraph(original, integral, variable) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(integral, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        secondaryLabel: `F(${variable}) = ${beautify(integral)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: F(${variable}) = ${beautify(integral)} (antiderivative)`,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
