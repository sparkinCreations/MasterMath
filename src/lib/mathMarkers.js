// Explicit math markers in solver step text.
//
// A step such as "write the coefficients 1, (−6), 11, (−6); bring down 1"
// interleaves words and math, and no heuristic can tell where the math
// starts and stops — only the author of the template knows. Solvers wrap
// the math in ⟦…⟧ (mark() below); the renderer (latex.js) typesets exactly
// what is marked and leaves the rest as prose, and falls back to its
// heuristics for unmarked text.
//
// The markers are a rendering hint for step text only. They never reach
// an answer, a tip, an export or the clipboard: finalizeResult (api.js) and
// the exporters strip them, and sanitizeInput strips them from what the
// user types (a parse error echoes the input into a step). ⟦ ⟧ (U+27E6,
// U+27E7) were chosen because no keyboard types them and no solver prints
// them; a dollar sign is real input ("$5 + $3").

export const MATH_OPEN = '⟦';
export const MATH_CLOSE = '⟧';

// Wrap a math fragment: `Let ${mark(`u = ${inner}`)} (the inside).`
export function mark(math) {
  return `${MATH_OPEN}${math}${MATH_CLOSE}`;
}

export function stripMathMarkers(text) {
  return String(text ?? '').replace(/[⟦⟧]/g, '');
}

export function hasMathMarkers(text) {
  return /[⟦⟧]/.test(String(text ?? ''));
}
