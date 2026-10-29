// Expressions with no value, found before evaluating: division by zero, the
// logarithm of 0, 0 to the power 0, mod 0.

import { math } from '../solverUtils.js';

// ln(0) / log(0) anywhere in the parse tree.
export function logOfZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'FunctionNode' || !['log', 'ln', 'log10', 'log2'].includes(node.fn?.name)) return;
      try {
        if (node.args[0].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Is there a 0^0 anywhere in the parse tree?
export function raisesZeroToZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode' || node.fn !== 'pow') return;
      try {
        if (node.args[0].evaluate() === 0 && node.args[1].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// a mod 0 anywhere in the expression (mathjs quietly returns a).
export function modsByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found) return;
      const isMod = (node.type === 'OperatorNode' && node.fn === 'mod') || (node.type === 'FunctionNode' && node.fn?.name === 'mod');
      if (!isMod) return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch { /* needs a scope: not a constant zero */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Does this expression divide by something that works out to zero? Read off
// the parse tree rather than by pattern-matching "/0", so 8/(3-3) is
// recognised as division by zero instead of being reported as an overflow.
export function dividesByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode') return;
      // 0^(-n) is 1/0^n — division by zero as well.
      if (node.fn === 'pow') {
        try {
          if (node.args[0].evaluate() === 0 && node.args[1].evaluate() < 0) found = true;
        } catch { /* not constant */ }
        return;
      }
      if (node.fn !== 'divide' && node.fn !== 'mod') return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch {
        // a denominator that needs a scope isn't a constant zero
      }
    });
    return found;
  } catch {
    return false;
  }
}
