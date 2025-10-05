// Utility to parse and clean user math input

export function parseMathExpression(input) {
  let cleaned = input.trim();

  // First, protect mathematical constants and functions by replacing them with placeholders
  const protectedTerms = [];
  let placeholder = 0;

  // Protect trig functions and constants (must be done before implicit multiplication)
  const constants = ['pi', 'PI', 'e', 'E', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'exp', 'abs'];
  constants.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(regex, (match) => {
      const token = `__PROTECTED_${placeholder}__`;
      protectedTerms.push({ token, value: match });
      placeholder++;
      return token;
    });
  });

  // Convert common math notation to JavaScript-friendly format
  cleaned = cleaned
    // Handle superscripts (x² → x^2)
    .replace(/([a-z])²/gi, '$1^2')
    .replace(/([a-z])³/gi, '$1^3')
    // Handle multiplication (2x → 2*x) - now safe because constants are protected
    .replace(/(\d)([a-z])/gi, '$1*$2')
    // Handle implicit multiplication (x(x+1) → x*(x+1))
    .replace(/([a-z])\(/gi, '$1*(')
    .replace(/\)([a-z])/gi, ')*$1')
    // Handle division symbol (÷ → /)
    .replace(/÷/g, '/')
    // Handle multiplication symbol (× → *)
    .replace(/×/g, '*')
    // Handle spaces around operators
    .replace(/\s+/g, '');

  // Restore protected terms
  protectedTerms.forEach(({ token, value }) => {
    cleaned = cleaned.replace(token, value);
  });

  return cleaned;
}

export function extractVariable(expression) {
  // Find the main variable (usually x, but could be y, t, etc.)
  const match = expression.match(/[a-z]/i);
  return match ? match[0] : 'x';
}

export function extractFunctionFromProblem(problemText) {
  // Extract mathematical expression from natural language
  // Examples:
  // "Find the derivative of x^2 + 3x" -> "x^2 + 3x"
  // "Integrate 2x + 1" -> "2x + 1"
  // "Solve x^2 - 4 = 0" -> "x^2 - 4 = 0"

  const patterns = [
    /(?:derivative of|differentiate)\s+(.+)/i,
    /(?:integrate|integral of)\s+(.+)/i,
    /(?:solve|find)\s+(.+)/i,
    /(?:simplify|expand)\s+(.+)/i,
    /(?:factor|factorize)\s+(.+)/i,
    /(?:limit|lim)\s+.*?of\s+(.+?)(?:\s+as|$)/i,
    /f\(.\)\s*=\s*(.+)/i, // f(x) = ...
  ];

  for (const pattern of patterns) {
    const match = problemText.match(pattern);
    if (match) {
      return parseMathExpression(match[1]);
    }
  }

  // If no pattern matches, assume the entire input is the expression
  return parseMathExpression(problemText);
}

export function isEquation(expression) {
  return expression.includes('=');
}
