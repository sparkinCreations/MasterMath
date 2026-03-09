// Utility to parse and clean user math input

// Known math function and constant names (used in multiple places)
const MATH_FUNCTIONS = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'log', 'ln', 'exp', 'abs'];
const MATH_CONSTANTS = ['pi', 'PI'];

export function parseMathExpression(input) {
  let cleaned = input.trim();

  // Remove trailing punctuation from natural language input (periods, question marks)
  cleaned = cleaned.replace(/[.?!]+$/, '').trim();

  // First, protect mathematical constants and functions by replacing them with placeholders
  const protectedTerms = [];
  let placeholder = 0;

  // Protect trig functions and constants (must be done before implicit multiplication)
  const allProtected = [...MATH_FUNCTIONS, ...MATH_CONSTANTS, 'e', 'E'];
  allProtected.forEach(term => {
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
    // Handle unicode minus sign (− → -)
    .replace(/\u2212/g, '-')
    // Handle square root symbol (√x → sqrt(x), √(expr) → sqrt(expr))
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/√(\w+)/g, 'sqrt($1)')
    // Handle superscripts (x² → x^2, x³ → x^3, x⁴ → x^4, etc.)
    .replace(/([a-z0-9)])⁰/gi, '$1^0')
    .replace(/([a-z0-9)])¹/gi, '$1^1')
    .replace(/([a-z0-9)])²/gi, '$1^2')
    .replace(/([a-z0-9)])³/gi, '$1^3')
    .replace(/([a-z0-9)])⁴/gi, '$1^4')
    .replace(/([a-z0-9)])⁵/gi, '$1^5')
    .replace(/([a-z0-9)])⁶/gi, '$1^6')
    .replace(/([a-z0-9)])⁷/gi, '$1^7')
    .replace(/([a-z0-9)])⁸/gi, '$1^8')
    .replace(/([a-z0-9)])⁹/gi, '$1^9')
    // Handle multiplication (2x → 2*x) - safe because constants are protected
    .replace(/(\d)([a-z])/gi, '$1*$2')
    // Handle implicit multiplication: number before paren (2(x+1) → 2*(x+1))
    .replace(/(\d)\(/g, '$1*(')
    // Handle implicit multiplication: variable/paren before paren (x(x+1) → x*(x+1), )(  → )*(  )
    .replace(/([a-z])\(/gi, '$1*(')
    .replace(/\)\(/g, ')*(')
    // Handle implicit multiplication: paren/variable after paren ()x → )*x, )2 → )*2)
    .replace(/\)([a-z])/gi, ')*$1')
    .replace(/\)(\d)/g, ')*$1')
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
  // Must skip known math function names and constants

  // Remove all known function/constant names so we don't pick letters from them
  let stripped = expression;
  const allKnown = [...MATH_FUNCTIONS, ...MATH_CONSTANTS, 'lim', 'limit'];
  allKnown.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    stripped = stripped.replace(regex, '');
  });

  // Also remove "e" when it looks like Euler's number (standalone, not part of a variable name)
  stripped = stripped.replace(/\be\b/g, '');

  // Now find the first remaining letter — that's the variable
  const match = stripped.match(/[a-z]/i);
  return match ? match[0].toLowerCase() : 'x';
}

export function extractFunctionFromProblem(problemText) {
  // Extract mathematical expression from natural language
  // Examples:
  // "Find the derivative of x^2 + 3x" -> "x^2 + 3x"
  // "Integrate 2x + 1" -> "2x + 1"
  // "Solve x^2 - 4 = 0" -> "x^2 - 4 = 0"
  // "What is 5 + 3?" -> "5 + 3"
  // "d/dx x^3" -> "x^3"

  // Clean up trailing punctuation first
  let text = problemText.trim().replace(/[.?!]+$/, '').trim();

  // Patterns are ordered from most specific to least specific.
  // More specific patterns (like "find the derivative of") must come before
  // general ones (like "find") to avoid greedy matching.
  const patterns = [
    // Derivative patterns
    /(?:find the derivative of|take the derivative of|derivative of|differentiate)\s+(.+)/i,
    /d\/d([a-z])\s*\(?(.+?)\)?$/i, // d/dx(expr) or d/dx expr — captures variable + expression
    /dy\/dx\s*(?:of|for|=)?\s*(.+)/i, // dy/dx of expr

    // Integral patterns
    /(?:find the integral of|take the integral of|integral of|integrate|antiderivative of)\s+(.+)/i,

    // Limit patterns
    /(?:find the limit|evaluate the limit|limit|lim)\s+(?:of\s+)?(.+)/i,

    // Solve/find patterns (with "the ... of" constructs handled above, these are for general use)
    /(?:solve for [a-z] in|solve for [a-z]:?)\s+(.+)/i,
    /(?:solve|find the (?:value|solution|root|zero)s? (?:of|for))\s+(.+)/i,

    // Simplify/expand/factor patterns
    /(?:simplify|reduce|combine like terms in|combine)\s+(.+)/i,
    /(?:expand)\s+(.+)/i,
    /(?:factor|factorize|factorise)\s+(.+)/i,

    // Evaluation patterns
    /(?:what is|what's|calculate|evaluate|compute|find)\s+(.+)/i,

    // Graphing patterns
    /(?:graph|plot|draw|sketch)\s+(.+)/i,

    // f(x) = ... notation
    /f\(.\)\s*=\s*(.+)/i,
    /y\s*=\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Special handling for d/dx pattern which captures both variable and expression
      if (pattern.source.startsWith('d\\/d')) {
        return parseMathExpression(match[2]);
      }
      return parseMathExpression(match[1]);
    }
  }

  // If no pattern matches, assume the entire input is the expression
  return parseMathExpression(text);
}

export function isEquation(expression) {
  // Check for a single '=' that is not part of >=, <=, ==, or !=
  return /(?<![><!!=])=(?!=)/.test(expression);
}
