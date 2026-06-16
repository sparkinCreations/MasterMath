/**
 * Helpers for mathsteps — the library returns step arrays directly, not { steps: [] }.
 */

function formatEquationNode(node) {
  if (!node) return '';
  if (typeof node.toString === 'function') {
    return node.toString();
  }
  return String(node);
}

export function formatMathstepsEquation(equation) {
  if (!equation) return '';
  const left = formatEquationNode(equation.leftNode);
  const right = formatEquationNode(equation.rightNode);
  return `${left} = ${right}`;
}

export function formatMathstepsStep(step) {
  if (!step) return '';

  if (step.newEquation) {
    const equation = formatMathstepsEquation(step.newEquation);
    if (step.changeType) {
      const changeType = step.changeType.replace(/_/g, ' ').toLowerCase();
      return `${changeType}: ${equation}`;
    }
    return equation;
  }

  if (step.newNode) {
    const node = formatEquationNode(step.newNode);
    if (step.changeType) {
      const changeType = step.changeType.replace(/_/g, ' ').toLowerCase();
      return `${changeType}: ${node}`;
    }
    return node;
  }

  return step.changeType ? step.changeType.replace(/_/g, ' ').toLowerCase() : '';
}

export function stepsFromMathstepsResult(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const steps = result.map(formatMathstepsStep).filter(Boolean);
  const lastStep = result[result.length - 1];

  let answer = '';
  if (lastStep?.newEquation) {
    answer = formatMathstepsEquation(lastStep.newEquation);
  } else if (lastStep?.newNode) {
    answer = formatEquationNode(lastStep.newNode);
  }

  return { steps, answer };
}
