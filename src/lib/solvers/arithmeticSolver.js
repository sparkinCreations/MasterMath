import { create, all } from 'mathjs';

const math = create(all);

export function solveArithmetic(expression) {
  try {
    // Clean the expression
    let cleaned = expression.trim();

    // Detect operation type
    const hasAddition = cleaned.includes('+');
    const hasSubtraction = cleaned.includes('-') && !cleaned.startsWith('-');
    const hasMultiplication = cleaned.includes('*') || cleaned.includes('×');
    const hasDivision = cleaned.includes('/') || cleaned.includes('÷');
    const hasExponent = cleaned.includes('^') || cleaned.includes('**');
    const hasParentheses = cleaned.includes('(');

    const steps = [];
    steps.push(`Problem: ${cleaned}`);

    // Evaluate the expression
    const result = math.evaluate(cleaned);

    // Generate step-by-step based on complexity
    if (hasParentheses) {
      steps.push('Step 1: Evaluate expressions inside parentheses first (following PEMDAS/BODMAS)');

      // Try to show intermediate steps
      const innerMatch = cleaned.match(/\(([^()]+)\)/);
      if (innerMatch) {
        const innerExpr = innerMatch[1];
        const innerResult = math.evaluate(innerExpr);
        steps.push(`   Evaluate (${innerExpr}) = ${innerResult}`);
        const simplified = cleaned.replace(innerMatch[0], innerResult.toString());
        if (simplified !== result.toString()) {
          steps.push(`   Expression becomes: ${simplified}`);
        }
      }
    }

    if (hasExponent && !hasParentheses) {
      steps.push('Step 1: Calculate exponents first (following PEMDAS/BODMAS)');
      const expMatch = cleaned.match(/(\d+\.?\d*)\s*[\^]\s*(\d+\.?\d*)/);
      if (expMatch) {
        const base = parseFloat(expMatch[1]);
        const exp = parseFloat(expMatch[2]);
        const expResult = Math.pow(base, exp);
        steps.push(`   ${base}^${exp} = ${expResult}`);
      }
    }

    if ((hasMultiplication || hasDivision) && (hasAddition || hasSubtraction)) {
      const stepNum = steps.length;
      steps.push(`Step ${stepNum}: Perform multiplication and division from left to right`);
    } else if (hasMultiplication || hasDivision) {
      const stepNum = steps.length;
      steps.push(`Step ${stepNum}: Perform the ${hasMultiplication ? 'multiplication' : 'division'}`);
    }

    if ((hasAddition || hasSubtraction) && (hasMultiplication || hasDivision || hasExponent)) {
      const stepNum = steps.length;
      steps.push(`Step ${stepNum}: Finally, perform addition and subtraction from left to right`);
    } else if (hasAddition && hasSubtraction) {
      const stepNum = steps.length;
      steps.push(`Step ${stepNum}: Perform addition and subtraction from left to right`);
    } else if (hasAddition || hasSubtraction) {
      const stepNum = steps.length;
      steps.push(`Step ${stepNum}: Perform the ${hasAddition ? 'addition' : 'subtraction'}`);
    }

    steps.push(`Final Answer: ${result}`);

    // Format the result
    let formattedResult = result;
    if (typeof result === 'number') {
      // Show as fraction if it's a simple division result
      if (hasDivision && !hasAddition && !hasSubtraction && !hasMultiplication) {
        const parts = cleaned.split(/[\/÷]/);
        if (parts.length === 2) {
          const num = parseFloat(parts[0].trim());
          const den = parseFloat(parts[1].trim());
          if (!isNaN(num) && !isNaN(den)) {
            formattedResult = `${result} (or ${num}/${den} = ${result})`;
          }
        }
      }

      // Round to reasonable precision
      if (result % 1 !== 0) {
        formattedResult = result.toFixed(4);
      }
    }

    return {
      steps,
      answer: formattedResult.toString(),
      tips: [
        'Remember PEMDAS/BODMAS order: Parentheses/Brackets, Exponents/Orders, Multiplication & Division (left to right), Addition & Subtraction (left to right)',
        'When multiplying/dividing multiple numbers, work from left to right',
        'When adding/subtracting multiple numbers, work from left to right',
        'Use parentheses to group operations you want done first'
      ],
      common_mistakes: [
        'Forgetting to follow the order of operations (doing addition before multiplication)',
        'Not evaluating parentheses first',
        'Adding/subtracting before multiplying/dividing',
        'Making sign errors with negative numbers'
      ],
      graph: null
    };
  } catch (error) {
    console.error('Arithmetic solver error:', error);
    return {
      steps: [
        'Parse the arithmetic expression: ' + expression,
        'Apply PEMDAS/BODMAS rules',
        'Calculate the result'
      ],
      answer: 'Unable to evaluate',
      tips: [
        'Use * for multiplication (e.g., 5*3)',
        'Use / for division (e.g., 10/2)',
        'Use ^ for exponents (e.g., 2^3)',
        'Use parentheses to group operations: (2+3)*4'
      ],
      common_mistakes: [
        'Missing operators between numbers',
        'Incorrect order of operations'
      ],
      graph: null
    };
  }
}
