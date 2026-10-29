// Facts read off the parse tree, never from sample points: linear
// coefficients, the period, "defined everywhere", where a trig function is
// undefined, a side that is never 0.

import { math } from './engines.js';
import { piForm, beautify } from './text.js';
import { realOddRoots } from './numeric.js';

// ---------------------------------------------------------------------------
// Structural facts read off the parse tree, not off sample points: a claim
// such as "periodic" or "defined everywhere" needs a proof, and a few values
// are not one (sin(x²)·eˣ is not periodic, however it samples).

// k and d with expr ≡ k·variable + d, or null when expr is not linear in the
// variable (any other symbol is read as a constant; pi and e evaluate).
export function linearCoefficients(expr, variable) {
  let node;
  try {
    node = math.parse(String(expr));
  } catch {
    return null;
  }
  const constant = (n) => {
    try {
      const v = n.evaluate({});
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
  const walk = (n) => {
    if (n.type === 'ConstantNode') return typeof n.value === 'number' ? { k: 0, d: n.value } : null;
    if (n.type === 'SymbolNode') {
      if (n.name === variable) return { k: 1, d: 0 };
      const v = constant(n);
      return v === null ? null : { k: 0, d: v };
    }
    if (n.type === 'ParenthesisNode') return walk(n.content);
    if (n.type === 'OperatorNode') {
      if (n.args.length === 1) {
        const a = walk(n.args[0]);
        if (!a) return null;
        return n.op === '-' ? { k: -a.k, d: -a.d } : n.op === '+' ? a : null;
      }
      const [a, b] = n.args.map(walk);
      if (!a || !b) return null;
      if (n.op === '+') return { k: a.k + b.k, d: a.d + b.d };
      if (n.op === '-') return { k: a.k - b.k, d: a.d - b.d };
      if (n.op === '*') {
        if (a.k === 0) return { k: a.d * b.k, d: a.d * b.d };
        if (b.k === 0) return { k: a.k * b.d, d: a.d * b.d };
        return null;
      }
      if (n.op === '/') return b.k === 0 && b.d !== 0 ? { k: a.k / b.d, d: a.d / b.d } : null;
      if (a.k === 0 && b.k === 0) {
        const v = constant(n);
        return v === null ? null : { k: 0, d: v };
      }
      return null;
    }
    if (n.type === 'FunctionNode') {
      const v = constant(n);
      return v === null ? null : { k: 0, d: v };
    }
    return null;
  };
  return walk(node);
}

const TRIG_PERIOD = { sin: 2 * Math.PI, cos: 2 * Math.PI, sec: 2 * Math.PI, csc: 2 * Math.PI, tan: Math.PI, cot: Math.PI };
const ALWAYS_DEFINED_FUNCTIONS = new Set(['sin', 'cos', 'exp', 'abs', 'sinh', 'cosh', 'tanh', 'atan', 'arctan']);

// A period of the expression as a function of the variable, proved from its
// structure: trig functions of linear arguments, combined by +, −, ×, ÷, ^
// and by composition with any outer function, with periods that are
// commensurate. 0 means constant in the variable; null means no period could
// be proved (a bare x, a non-linear argument, incommensurate periods) — the
// caller must then not call it periodic.
export function structuralPeriod(expr, variable) {
  let node;
  try {
    node = math.parse(realOddRoots(String(expr)));
  } catch {
    return null;
  }
  const combine = (p, q) => {
    if (p === null || q === null) return null;
    if (p === 0) return q;
    if (q === 0) return p;
    const ratio = p / q;
    for (let den = 1; den <= 12; den += 1) {
      const num = ratio * den;
      if (Math.abs(num - Math.round(num)) < 1e-9) return p * den; // = q·num
    }
    return null;
  };
  const walk = (n) => {
    if (n.type === 'ConstantNode') return 0;
    if (n.type === 'SymbolNode') return n.name === variable ? null : 0;
    if (n.type === 'ParenthesisNode') return walk(n.content);
    if (n.type === 'OperatorNode') return n.args.map(walk).reduce(combine, 0);
    if (n.type === 'FunctionNode') {
      const name = n.fn.name;
      if (TRIG_PERIOD[name] && n.args.length === 1) {
        const lin = linearCoefficients(n.args[0].toString(), variable);
        if (!lin) return null;
        return lin.k === 0 ? 0 : TRIG_PERIOD[name] / Math.abs(lin.k);
      }
      // f(periodic) is periodic with the same period, whatever f is.
      return n.args.map(walk).reduce(combine, 0);
    }
    return null;
  };
  return walk(node);
}

// True only when the parse tree proves the expression is defined for every
// real value of the variable: polynomials, sin, cos, eˣ, |…|, integer powers,
// constant positive bases, and their sums, products and compositions. A
// quotient, root, logarithm, tan, or a fractional power returns false — not
// "undefined somewhere", just "not proved here".
export function definedEverywhere(expr, variable) {
  let node;
  try {
    node = math.parse(String(expr));
  } catch {
    return false;
  }
  const isConst = (n) => linearCoefficients(n.toString(), variable)?.k === 0;
  const constValue = (n) => {
    try {
      const v = n.evaluate({});
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
  const walk = (n) => {
    if (n.type === 'ConstantNode') return typeof n.value === 'number' && Number.isFinite(n.value);
    if (n.type === 'SymbolNode') return n.name === variable || constValue(n) !== null;
    if (n.type === 'ParenthesisNode') return walk(n.content);
    if (n.type === 'OperatorNode') {
      if (['+', '-', '*'].includes(n.op)) return n.args.every(walk);
      if (n.op === '/') {
        const den = constValue(n.args[1]);
        return n.args.length === 2 && walk(n.args[0]) && isConst(n.args[1]) && den !== null && den !== 0;
      }
      if (n.op === '^' && n.args.length === 2) {
        const [base, expo] = n.args;
        const e = constValue(expo);
        if (e !== null && Number.isInteger(e) && e >= 0) return walk(base);
        // x^(p/q) with q odd is a real odd root (the app evaluates it as one
        // for negative x), so x^(1/3) and x^(2/3) are defined everywhere.
        if (e !== null && e > 0 && oddDenominator(e)) return walk(base);
        const b = constValue(base);
        return b !== null && b > 0 && walk(expo);
      }
      return false;
    }
    if (n.type === 'FunctionNode') return ALWAYS_DEFINED_FUNCTIONS.has(n.fn.name) && n.args.every(walk);
    return false;
  };
  return walk(node);
}

// Where tan, sec, cot, csc or a division by sin/cos makes an expression
// undefined, for linear arguments: [{ text: 'x = π/2 + nπ', because: 'tan(x)' }].
// Only structural, so cos(x) = 0 inside a tan is found; a pole hidden in an
// algebraic denominator is not this function's job.
export function trigUndefinedPoints(expr, variable) {
  const out = [];
  const seen = new Set();
  const s = String(expr);
  const re = /(?:\b(tan|sec|cot|csc)|\/\s*(sin|cos))\s*\(/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParenAt(s, open);
    if (close === -1) continue;
    const arg = s.slice(open + 1, close);
    const name = (m[1] || m[2]).toLowerCase();
    const zeroOf = name === 'tan' || name === 'sec' || name === 'cos' ? 'cos' : 'sin';
    const lin = linearCoefficients(arg, variable);
    if (!lin || lin.k === 0) continue;
    // cos(kx + d) = 0 ⇔ kx + d = π/2 + nπ; sin(kx + d) = 0 ⇔ kx + d = nπ.
    const offset = ((zeroOf === 'cos' ? Math.PI / 2 : 0) - lin.d) / lin.k;
    const step = Math.PI / Math.abs(lin.k);
    const shownOffset = Math.abs(offset) < 1e-12 ? '' : `${piForm(offset)} + `;
    const shownStep = Math.abs(step - Math.PI) < 1e-12 ? 'nπ' : `n·${piForm(step)}`;
    const text = `${variable} = ${shownOffset}${shownStep}`;
    const because = m[1] ? `${name}(${beautify(arg)})` : `division by ${name}(${beautify(arg)})`;
    const key = `${text}|${because}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, because });
  }
  return out;
}

function oddDenominator(e) {
  for (let q = 1; q <= 15; q += 2) {
    if (Math.abs(e * q - Math.round(e * q)) < 1e-9) return true;
  }
  return false;
}

function matchingParenAt(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// An expression that is never 0, read off the parse tree: a nonzero constant,
// a product of such, a fraction whose numerator never vanishes, a positive
// base to any power (eˣ, 2^x). `left = right` with one side 0: returns
// { side, why } for the other side, or null when no such proof exists. Used
// for "no real solution" (algebraSolver) and "f′ is never 0, so no stationary
// points" (functionsSolver) — a claim about every x needs a proof, never a
// search.
export function neverZeroSide(left, right, variable) {
  const isZero = (t) => {
    try {
      return math.evaluate(String(t)) === 0;
    } catch {
      return false;
    }
  };
  const side = isZero(right) ? left : isZero(left) ? right : null;
  if (!side) return null;
  let node;
  try {
    node = math.parse(String(side));
  } catch {
    return null;
  }
  const reasons = new Set();
  const never = (n) => {
    if (n.type === 'ParenthesisNode') return never(n.content);
    if (n.type === 'ConstantNode') return typeof n.value === 'number' && n.value !== 0;
    if (n.type === 'SymbolNode') return ['e', 'pi'].includes(n.name);
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return never(n.args[0]);
    if (n.type === 'OperatorNode' && n.fn === 'multiply') return never(n.args[0]) && never(n.args[1]);
    if (n.type === 'OperatorNode' && n.fn === 'divide') {
      if (!never(n.args[0])) return false;
      if (n.args[1].filter((c) => c.type === 'SymbolNode' && c.name === variable).length) reasons.add('a fraction is 0 only when its numerator is, and this numerator never is');
      return true;
    }
    if (n.type === 'OperatorNode' && n.fn === 'pow') {
      let base = n.args[0];
      while (base.type === 'ParenthesisNode') base = base.content;
      let b;
      try { b = base.evaluate({}); } catch { b = null; }
      if (typeof b === 'number' && b > 0) { reasons.add('a positive base to any power is positive'); return true; }
      return false;
    }
    if (n.type === 'FunctionNode' && n.fn?.name === 'exp') { reasons.add('a positive base to any power is positive'); return true; }
    return false;
  };
  if (!never(node) || !node.filter((c) => c.type === 'SymbolNode' && c.name === variable).length) return null;
  return { side, why: [...reasons].join('; ') || 'it is a nonzero constant' };
}
