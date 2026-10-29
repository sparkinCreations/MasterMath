// The order-of-operations working: each operation evaluated in turn and
// shown, with the order described.

import { math, formatNumber, mark } from '../solverUtils.js';
import { logNotation, exact, exactLog } from './notation.js';
import { unshowable, scientific, numText, equals } from './exactNumbers.js';

// Evaluate a parenthesis-free expression one operation at a time in PEMDAS
// order — functions, then exponents (right to left), then multiplication and
// division left to right, then addition and subtraction left to right —
// pushing a step per operation with the result and the expression that
// remains. Returns false (and pushes nothing) when the expression cannot be
// worked this way, so the caller falls back to the tier description.
export function showWorking(expr, steps) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return false;
  }
  const isConstant = (n) => n.type === 'ConstantNode'
    || (n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args.length === 1 && n.args[0].type === 'ConstantNode')
    || (n.type === 'ParenthesisNode' && isConstant(n.content));
  const VERBS = { pow: 'Resolve the exponent', multiply: 'Multiply', divide: 'Divide', mod: 'Take the remainder', add: 'Add', subtract: 'Subtract', unaryMinus: 'Apply the leading minus' };
  // A leading minus on a worked-out value: -2^2 is -(2^2), so the sign is
  // applied after the exponent. A (−4) this routine wrote itself is a value.
  const bareMinus = (n, parent) => n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args[0].type === 'ConstantNode' && parent?.type !== 'ParenthesisNode';
  // ln(e^k), log(10^k), log_b(b^k): the logarithm undoes its base's power.
  const baseOf = (n) => (n.fn?.name === 'ln' || n.args.length === 1 ? 'e' : n.args[1].toString());
  // ln(e) and log(10) are the first power: k = 1.
  const isBase = (n) => n.type === 'FunctionNode' && ['ln', 'log'].includes(n.fn?.name) && n.args[0].toString() === baseOf(n);
  const undoesPower = (n) => isBase(n) || (n.type === 'FunctionNode' && ['ln', 'log'].includes(n.fn?.name)
    && n.args[0].type === 'OperatorNode' && n.args[0].fn === 'pow' && n.args[0].args[0].toString() === baseOf(n)
    && (() => { try { return Number.isFinite(n.args[0].args[1].evaluate()); } catch { return false; } })());
  const tiers = [
    { intro: 'A logarithm undoes a power of its own base', pick: 'first', test: undoesPower },
    { intro: 'Evaluate the function', pick: 'first', test: (n) => n.type === 'FunctionNode' && n.args.length > 0 && n.args.every(isConstant) },
    { intro: 'Exponents first', pick: 'last', test: (n) => n.type === 'OperatorNode' && n.fn === 'pow' && n.args.every(isConstant) },
    { intro: 'The exponent binds tighter than a leading minus, so apply the sign afterwards', pick: 'first', test: bareMinus, root: true },
    { intro: 'Multiplication and division next, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['multiply', 'divide', 'mod'].includes(n.fn) && n.args.every(isConstant) },
    { intro: 'Addition and subtraction last, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['add', 'subtract'].includes(n.fn) && n.args.every(isConstant) },
  ];
  // Numbers as digits: mathjs writes 1000000 as 1e+6. One a float cannot
  // show (2^100, 2^-60) in scientific notation, bracketed.
  const handler = (n) => {
    if (n.type !== 'ConstantNode' || typeof n.value !== 'number') return undefined;
    return unshowable(n.value) ? `(${scientific(n.value)})` : String(n.value);
  };
  const render = (node) => logNotation(node.toString({ implicit: 'show', handler })
    .replace(/\b\d+\.\d{5,}\b/g, (t) => formatNumber(Number(t))));
  const lines = [];
  let lastTier = -1;
  for (let guard = 0; guard < 40; guard += 1) {
    if (tree.type === 'ConstantNode' || (isConstant(tree) && !bareMinus(tree, null))) break;
    let target = null;
    let tierIndex = -1;
    for (let t = 0; t < tiers.length && !target; t += 1) {
      const matches = [];
      // The leading-minus tier applies only to the whole expression.
      if (tiers[t].root) {
        if (tiers[t].test(tree, null)) matches.push(tree);
      } else {
        tree.traverse((n, path, parent) => { if (tiers[t].test(n, parent)) matches.push(n); });
      }
      if (matches.length > 0) {
        target = tiers[t].pick === 'first' ? matches[0] : matches[matches.length - 1];
        tierIndex = t;
      }
    }
    if (!target) return false;
    let value;
    try {
      value = target.evaluate();
    } catch {
      return false;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const replacement = value < 0 && target !== tree
      ? new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [new math.ConstantNode(-value)]))
      : new math.ConstantNode(value);
    tree = target === tree ? replacement : tree.transform((n) => (n === target ? replacement : n));
    const opText = target.type === 'OperatorNode' && target.fn === 'unaryMinus' ? `-(${render(target.args[0])})` : render(target);
    let valueText = numText(value);
    // Not for rounded decimals a step wrote itself (0.9031 + 0.301 is not
    // 12041/10000 exactly).
    if (!Number.isInteger(value) && !/\d\.\d{4,}/.test(opText)) {
      try {
        const fr = exact.evaluate(opText);
        if (exact.typeOf(fr) === 'Fraction' && fr.d > 1 && fr.d <= 10000) valueText = `${fr.s < 0 ? '-' : ''}${fr.n}/${fr.d} (≈ ${formatNumber(value)})`;
      } catch { /* not rational */ }
    }
    // A logarithm is a question about a power: log_b(a) is the k with
    // b^k = a. Exact when it is a fraction (log_2(8) = 3, log_8(4) = 2/3);
    // otherwise the decimal, by the change of base for a base other than 10
    // or e.
    let logNote = '';
    if (undoesPower(target)) {
      const base = baseOf(target);
      const tight = (n) => render(n).replace(/\s*\^\s*/g, '^');
      const k = isBase(target) ? '1' : tight(target.args[0].args[1]);
      logNote = `${mark(tight(target))} asks for the power of ${mark(base)} that gives ${mark(tight(target.args[0]))}, which is ${mark(k)}: a logarithm undoes a power of its own base, ${mark(`${base === 'e' ? 'ln' : base === '10' ? 'log' : `log_${base}`}(${base}^k) = k`)}`;
    } else if (target.type === 'FunctionNode' && ['log', 'ln'].includes(target.fn.name)) {
      try {
        const a = target.args[0].evaluate();
        const b = target.fn.name === 'ln' || target.args.length === 1 ? Math.E : target.args[1].evaluate();
        const name = render(target);
        const baseText = b === Math.E ? 'e' : formatNumber(b);
        const ex = b === Math.E ? null : exactLog(a, b);
        if (ex) {
          valueText = ex.d === 1 ? ex.text : `${ex.text} (≈ ${formatNumber(value)})`;
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}: ${mark(`${baseText}^${ex.d === 1 && ex.n >= 0 ? ex.text : `(${ex.text})`} = ${formatNumber(a)}`)}, so ${mark(`${name} = ${ex.text}`)}`;
        } else if (b === 10 || b === Math.E) {
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}: ${mark(`${baseText}^${value < 0 ? `(${formatNumber(value)})` : formatNumber(value)} ≈ ${formatNumber(a)}`)}, so ${mark(`${name} ≈ ${formatNumber(value)}`)}`;
        } else {
          logNote = `${mark(name)} asks for the power of ${mark(baseText)} that gives ${mark(formatNumber(a))}. It is not a whole number or a simple fraction, so use the change of base: ${mark(`${name} = ln(${formatNumber(a)})/ln(${baseText}) = ${formatNumber(Math.log(a))}/${formatNumber(Math.log(b))} ≈ ${formatNumber(value)}`)}`;
        }
      } catch { /* the plain evaluation line stands */ }
    }
    const verb = target.type === 'FunctionNode' ? `Evaluate ${target.fn.name}` : VERBS[target.fn] || 'Work out';
    const lead = tierIndex !== lastTier ? `${tiers[tierIndex].intro}: ` : `Then ${verb.toLowerCase()}: `;
    lastTier = tierIndex;
    const remaining = isConstant(tree) ? '' : `  →  ${render(tree)}`;
    // A negative exponent is a reciprocal: teach the rule, not just the
    // number (September 2026 review, batch 2).
    let note = '';
    if (target.type === 'OperatorNode' && target.fn === 'pow') {
      try {
        const e = target.args[1].evaluate();
        const base = target.args[0].evaluate();
        if (typeof e === 'number' && e < 0 && Number.isInteger(e) && typeof base === 'number' && base !== 0) {
          const baseText = render(target.args[0]);
          const power = Math.pow(base, -e);
          const powerText = power < 0 ? `(${formatNumber(power)})` : formatNumber(power);
          const viaReciprocal = power < 0 ? `1/${powerText} = ` : '';
          note = ` — a negative exponent means a reciprocal, ${mark('a^(-n) = 1/a^n')} (the base cannot be ${mark('0')}): ${mark(equals(`${baseText}^(${e}) = 1/${baseText}^${-e}${viaReciprocal ? ` = ${viaReciprocal.replace(/ = $/, '')}` : ''}`, valueText))}`;
        }
      } catch { /* no note */ }
    }
    if (logNote) lines.push(`${logNote}${remaining ? `, and the expression becomes ${mark(remaining.replace(/^\s*→\s*/, ''))}.` : '.'}`);
    else lines.push(note ? `${lead}${mark(opText)}${note}${remaining ? mark(remaining) : ''}` : `${lead}${mark(`${equals(opText, valueText)}${remaining}`)}`);
  }
  if (!isConstant(tree)) return false;
  for (const line of lines) steps.push(line);
  return true;
}

// Describe which PEMDAS tiers remain in a parenthesis-free expression. The UI
// numbers the steps, so these read as ordered actions without "Step N" prefixes.
export function describeOrder(expr, steps) {
  const hasExponent = /\^|\*\*/.test(expr);
  const hasMulDiv = /[*/×÷]/.test(expr);
  // A binary +/- between two operands (ignores a leading unary sign).
  const hasAddSub = /[\d)]\s*[-+]\s*[\d(]/.test(expr);

  if (hasExponent) steps.push('Resolve the exponents.');
  if (hasMulDiv) steps.push('Handle multiplication and division from left to right.');
  if (hasAddSub) steps.push('Add and subtract from left to right.');
}
