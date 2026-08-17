// Utility to parse and clean user math input

// Known math function and constant names (used in multiple places).
// Inverse-trig names must be listed so extractVariable doesn't mistake the
// leading letter of `arctan`/`asin` for the variable.
const MATH_FUNCTIONS = ['arcsin', 'arccos', 'arctan', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'log', 'ln', 'exp', 'abs', 'combinations', 'permutations'];
const MATH_CONSTANTS = ['pi', 'PI'];

// Functions that carry textbook power notation: sin^2(x), log^2(x), cos^3 t.
// Longer names first so `arcsin` is not matched as `sin`.
const POWER_NOTATION_FUNCTIONS = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log'];

// Index of the ")" that closes the "(" at `open`, or -1 if it is unbalanced.
function matchingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// sin^2(x) -> (sin(x))^2, cos^3 t -> (cos(t))^3. The argument is taken by
// paren matching, so a nested call — sin^2(f(x)) — survives intact. Only a
// parenthesised argument or a single variable letter counts as one; anything
// else (sin^2 + 3) is left exactly as written for the caller to reject.
function rewriteFunctionPowers(text) {
  // (?<![a-z]) rather than \b: in "2sin^3(2x)" there is no word boundary
  // between the digit and the "s", and that form has to be caught too.
  const pattern = new RegExp(`(?<![a-z])(${POWER_NOTATION_FUNCTIONS.join('|')})\\s*\\^\\s*(\\d+)\\s*(\\(|[a-z](?![a-z]))`, 'i');
  let out = text;
  // Each rewrite wraps the name in parens, so the same spot cannot match
  // twice; the cap is belt-and-braces against a pathological input.
  for (let guard = 0; guard < 50; guard += 1) {
    const m = pattern.exec(out);
    if (!m) break;
    const [full, fn, power, opener] = m;
    let argument;
    let end;
    if (opener === '(') {
      const open = m.index + full.length - 1;
      const close = matchingParen(out, open);
      if (close === -1) break; // unbalanced — leave the text as the user typed it
      argument = out.slice(open + 1, close);
      end = close + 1;
    } else {
      argument = opener;
      end = m.index + full.length;
    }
    out = `${out.slice(0, m.index)}(${fn}(${argument}))^${power}${out.slice(end)}`;
  }
  return out;
}

export function parseMathExpression(input) {
  let cleaned = input.trim();

  // Remove trailing sentence punctuation ("What is 5+3?") — but preserve a
  // factorial `!` that follows a number or a closing paren (`7!`, `(x+1)!`).
  cleaned = cleaned.replace(/[.?]+$/, '').trim();
  cleaned = cleaned.replace(/(?<![\d)])!+$/, '').trim();

  // Inverse-trig aliases → the canonical names every engine here understands.
  // Students (and calculators) write asin/acos/atan or sin⁻¹; Algebrite only
  // differentiates/integrates/simplifies arcsin/arccos/arctan, and would
  // otherwise hand `d(asin(x),x)` back unevaluated. Normalising once, here,
  // fixes derivatives, integrals, functions and trig alike.
  cleaned = cleaned
    .replace(/\b(sin|cos|tan)\s*(?:\^\s*\(?\s*-\s*1\s*\)?|⁻¹)\s*(?=\()/gi, (_, fn) => `arc${fn.toLowerCase()}`)
    .replace(/\ba(sin|cos|tan)\b(?!h)/gi, (_, fn) => `arc${fn.toLowerCase()}`);

  // Textbook power notation on a function: sin^2(x) means (sin(x))^2, never
  // "sin squared, times x". Left alone, the implicit-multiplication rules
  // below turned it into `sin^2*(x)` — a BARE function name, which Algebrite
  // evaluates against its *previous* result. "sin^2(x) = 1/2" was answered
  // "x = 1/(2sin([-2,2])^2)", carrying the last problem's roots and growing
  // one level deeper on every solve. Rewritten here, before anything else
  // reads the string. (The ^-1 inverse form is handled just above and never
  // reaches this rule.)
  cleaned = rewriteFunctionPowers(cleaned);

  // Absolute-value bars → abs(): |x-3| becomes abs(x-3). mathjs cannot parse
  // bar notation, so without this an equation like |x-3| = 5 fails to
  // evaluate at every point and reads as having no solution. Bars cannot
  // nest, so pairing innermost non-bar runs is unambiguous.
  cleaned = cleaned.replace(/\|([^|]+)\|/g, 'abs($1)');

  // Combinatorics notation → mathjs built-ins: C(5,2) -> combinations(5,2),
  // P(5,2) -> permutations(5,2), the nCr / nPr infix forms, and the spoken
  // "12 choose 3".
  cleaned = cleaned
    .replace(/\bC\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, 'combinations($1,$2)')
    .replace(/\bP\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, 'permutations($1,$2)')
    .replace(/(\d+)\s*C\s*(\d+)/g, 'combinations($1,$2)')
    .replace(/(\d+)\s*P\s*(\d+)/g, 'permutations($1,$2)')
    .replace(/(\d+)\s+choose\s+(\d+)/gi, 'combinations($1,$2)');

  // A lone uppercase letter is the same variable as its lowercase form —
  // "2X + 4 = 10" is a keyboard habit, not a second unknown. mathjs is
  // case-sensitive, so left alone the X was undefined at every sample and
  // the equation "had no solution". Applied after the combinatorics rewrite
  // (5C2 must stay nCr); E is excluded (Euler's constant), as is any letter
  // that is part of a longer name (PI) or followed by "(" (a function).
  cleaned = cleaned.replace(/(?<![A-Za-z_])([A-DF-Z])(?![A-Za-z_]|\s*\()/g, (m) => m.toLowerCase());

  // Word operator "mod". Every space is stripped further down, which would
  // fuse "7 mod 3" into the symbol "7mod3"; rewrite the numeric infix form
  // to mathjs's function form first.
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s+mod\s+(\d+(?:\.\d+)?)/gi, 'mod($1,$2)');

  // First, protect mathematical constants and functions by replacing them with placeholders
  const protectedTerms = [];
  let placeholder = 0;

  // Scientific notation (1e3, 2.5e-4) must be protected as a single number
  // before the constant e is protected, or "1e3" splits into 1·e·3.
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)[eE]([+-]?\d+)\b/g, (m, mant, exp) => {
    const token = `__PROTECTED_${placeholder}__`;
    protectedTerms.push({ token, value: `${mant}e${exp}` });
    placeholder++;
    return token;
  });

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
    // Handle implicit multiplication for single-letter variables before parens.
    // A word boundary avoids breaking function calls like sqrt(x) into sqrt*(x).
    .replace(/\b([a-z])\(/gi, '$1*(')
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

  // Any remaining multi-letter word directly followed by "(" is a function
  // call the list above doesn't know (erf(x), foo(x), gamma(x)). Its letters
  // are not candidates: taking the "f" of erf as the variable produced
  // f'(f) = 0. Single letters before "(" are left alone — x(x+1) is implicit
  // multiplication, and x is the variable.
  stripped = stripped.replace(/\b[a-z_]\w+\s*(?=\()/gi, '');

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

  // Clean up trailing sentence punctuation, but keep a factorial `!`.
  let text = problemText.trim().replace(/[.?]+$/, '').trim();
  text = text.replace(/(?<![\d)])!+$/, '').trim();
  // A trailing parenthetical instruction — "(solve for y)", "(find x)" — is
  // routing information, not part of the expression.
  text = text.replace(/\s*\(\s*(?:solve|find|for|in terms of)\b[^)]*\)\s*$/i, '').trim();

  // Patterns are ordered from most specific to least specific.
  // More specific patterns (like "find the derivative of") must come before
  // general ones (like "find") to avoid greedy matching.
  const patterns = [
    // Derivative patterns
    /(?:find the derivative of|take the derivative of|derivative of|differentiate)\s+(.+)/i,
    /d\/d([a-z])\s*(.+)$/i, // d/dx(expr) or d/dx expr — captures variable + expression (outer parens stripped below)
    /dy\/dx\s*(?:of|for|=)?\s*(.+)/i, // dy/dx of expr

    // Integral patterns
    /(?:find the integral of|take the integral of|integral of|integrate|antiderivative of)\s+(.+)/i,

    // Limit patterns
    /(?:find the limit|evaluate the limit|limit|lim)\s+(?:of\s+)?(.+)/i,

    // "What is x if 2x + 5 = 11?", "find y when 3y - 1 = 5", "solve for x given …"
    /(?:what is|what's|find|solve for)\s+[a-z]\s+(?:if|when|given|such that|where)\s+(.+)/i,
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

    // f(x) = ... notation, and "y = …" as a function definition — only a
    // standalone y, not the y in "2x + 3y = 6" (that is an equation, and
    // grabbing "= 6" out of it turned a two-unknown equation into "6").
    /f\(.\)\s*=\s*(.+)/i,
    /(?<![a-z0-9])y\s*=\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Special handling for d/dx pattern which captures both variable and expression
      if (pattern.source.startsWith('d\\/d')) {
        // Strip ONE pair of outer parentheses only when they wrap the whole
        // expression: d/dx (x^3) → x^3, but d/dx sin(x) keeps its ")".
        let inner = match[2].trim();
        if (inner.startsWith('(') && inner.endsWith(')')) {
          let depth = 0;
          let wraps = true;
          for (let i = 0; i < inner.length; i += 1) {
            if (inner[i] === '(') depth += 1;
            else if (inner[i] === ')') depth -= 1;
            if (depth === 0 && i < inner.length - 1) { wraps = false; break; }
          }
          if (wraps) inner = inner.slice(1, -1);
        }
        return parseMathExpression(inner);
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
