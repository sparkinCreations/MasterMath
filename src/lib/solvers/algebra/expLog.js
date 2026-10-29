// Power, exponential and logarithmic equations: a fractional power undone,
// one exponential isolated and logged, and the u = eˣ and u = ln(x)
// substitutions.

import { matchingParen } from '../../mathParser.js';
import { readPolynomial } from '../polynomialRoots.js';
import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  mark,
  linearCoefficients,
  realOddRoots,
  gcd,
} from '../solverUtils.js';
import {
  parseRootsList,
  formatSolutions,
  prettyRadicals,
  satisfiesEquation,
} from './rootsFormat.js';
import { rootsAccountForDegree } from './polynomial.js';

// A·(ax + b)^(p/q) + C = D, the variable inside one fractional power:
// isolate the power, then undo it. With q odd the power is real for every
// base (the real q-th root, raised to p): an odd p undoes to one value of
// either sign, an even p to ±. With q even the base must be ≥ 0 and the
// power is never negative. Returns { steps, answer, solutions } or null.
export function solvePowerEquation(equation, variable) {
  const v = variable;
  const sides = equation.split('=');
  if (sides.length !== 2) return null;
  let tree;
  try {
    tree = math.parse(`(${sides[0].trim()}) - (${sides[1].trim()})`);
  } catch {
    return null;
  }
  const has = (n) => n.filter((c) => c.type === 'SymbolNode' && c.name === v).length > 0;
  const constant = (n) => {
    try {
      const x = n.evaluate({});
      return typeof x === 'number' && Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  };
  // The terms of the difference, each with its sign.
  const terms = [];
  const collect = (n, sign) => {
    if (n.type === 'ParenthesisNode') return collect(n.content, sign);
    if (n.type === 'OperatorNode' && n.fn === 'add') { collect(n.args[0], sign); collect(n.args[1], sign); return; }
    if (n.type === 'OperatorNode' && n.fn === 'subtract') { collect(n.args[0], sign); collect(n.args[1], -sign); return; }
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { collect(n.args[0], -sign); return; }
    terms.push({ n, sign });
  };
  collect(tree, 1);
  const withVar = terms.filter((t) => has(t.n));
  if (withVar.length !== 1) return null;
  let C = 0;
  for (const t of terms) {
    if (t === withVar[0]) continue;
    const c = constant(t.n);
    if (c === null) return null;
    C += t.sign * c;
  }
  // k·power or power/k.
  let k = withVar[0].sign;
  let node = withVar[0].n;
  while (node.type === 'ParenthesisNode') node = node.content;
  if (node.type === 'OperatorNode' && node.fn === 'multiply') {
    const [x, y] = node.args;
    if (constant(x) !== null && has(y)) { k *= constant(x); node = y; } else if (constant(y) !== null && has(x)) { k *= constant(y); node = x; } else return null;
  } else if (node.type === 'OperatorNode' && node.fn === 'divide' && constant(node.args[1])) {
    k /= constant(node.args[1]);
    node = node.args[0];
  }
  while (node.type === 'ParenthesisNode') node = node.content;
  let base;
  let r;
  if (node.type === 'OperatorNode' && node.fn === 'pow' && constant(node.args[1]) !== null) {
    [base] = node.args;
    r = constant(node.args[1]);
  } else if (node.type === 'FunctionNode' && node.fn.name === 'sqrt') {
    [base] = node.args;
    r = 1 / 2;
  } else if (node.type === 'FunctionNode' && node.fn.name === 'cbrt') {
    [base] = node.args;
    r = 1 / 3;
  } else if (node.type === 'FunctionNode' && ['nthRoot', 'nthroot'].includes(node.fn.name) && node.args.length === 2 && constant(node.args[1])) {
    [base] = node.args;
    r = 1 / constant(node.args[1]);
  } else {
    return null;
  }
  if (Number.isInteger(r) || k === 0) return null;
  // r = p/q in lowest terms, q ≤ 12.
  let p = null;
  let q = null;
  for (let d = 2; d <= 12 && p === null; d += 1) {
    const n = Math.round(r * d);
    if (Math.abs(r * d - n) < 1e-12) { p = n; q = d; }
  }
  if (p === null) return null;
  const lin = linearCoefficients(base.toString(), v);
  if (!lin || lin.k === 0) return null;
  const m = -C / k;
  const baseShown = beautify(base.toString());
  const rText = `${p}/${q}`;
  const powerShown = `${/^[\w.]+$/.test(baseShown) ? baseShown : `(${baseShown})`}^(${rText})`;
  const fmt = (x) => {
    const rounded = Math.round(x);
    if (Math.abs(x - rounded) < 1e-9) return String(rounded);
    for (let d = 2; d <= 64; d += 1) {
      const n = Math.round(x * d);
      if (Math.abs(x * d - n) < 1e-9) return `${n}/${d}`;
    }
    return null;
  };
  const mText = fmt(m) ?? formatNumber(m);
  const steps = [`Isolate the power: ${mark(`${powerShown} = ${mText}`)}.`];
  const evenRoot = q % 2 === 0;
  const evenPower = p % 2 === 0;
  const none = (why) => ({ steps: [...steps, why, 'Solution: no real solution'], answer: `No real solution (${why.replace(/\.$/, '').replace(/⟦|⟧/g, '')})`, solutions: [] });
  if (m === 0 && p < 0) return none(`A negative power is ${mark('1')} over a power, never ${mark('0')}.`);
  if (m < 0 && (evenRoot || evenPower)) {
    return none(evenRoot ? `${mark(`${powerShown}`)} is a power of a square root, which is never negative.` : `${mark(`${powerShown}`)} is an even power of a real root, which is never negative.`);
  }
  // The values of the base: (base)^(p/q) = m ⇔ base = ±m^(q/p).
  const magnitude = Math.abs(m) ** (q / p);
  const values = [];
  if (m === 0) values.push(0);
  else if (evenPower && !evenRoot) values.push(-magnitude, magnitude);
  else values.push(m < 0 ? -magnitude : magnitude);
  const magText = fmt(magnitude);
  if (m === 0) steps.push(`A power is ${mark('0')} only when its base is: ${mark(`${baseShown} = 0`)}.`);
  else if (evenPower && !evenRoot) steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}. The numerator ${mark(String(p))} is even, so both signs: ${mark(`${baseShown} = ±${mText}^(${q}/${p}) = ±${magText ?? formatNumber(magnitude)}`)}.`);
  else if (!evenRoot && m < 0) steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}: the ${mark(String(q))}-th root is real for a negative number, so the sign carries through: ${mark(`${baseShown} = −${formatNumber(Math.abs(m))}^(${q}/${p}) = ${fmt(-magnitude) ?? formatNumber(-magnitude)}`)}.`);
  else steps.push(`Raise both sides to the power ${mark(`${q}/${p}`)}${evenRoot ? ` (the base of a square root is ${mark('≥ 0')}, and ${mark(mText)} is)` : ''}: ${mark(`${baseShown} = ${mText}^(${q}/${p}) = ${magText ?? formatNumber(magnitude)}`)}.`);
  // Solve the linear base for each value, and check each in the original.
  const evalOriginal = (x) => {
    try {
      const value = math.evaluate(realOddRoots(`(${sides[0].trim()}) - (${sides[1].trim()})`), { [v]: x });
      return typeof value === 'number' ? value : NaN;
    } catch {
      return NaN;
    }
  };
  const found = [];
  for (const value of values) {
    const x = (value - lin.d) / lin.k;
    const residual = evalOriginal(x);
    if (!(Math.abs(residual) <= 1e-9 * (1 + Math.abs(m)))) continue;
    found.push({ x, text: fmt(x) });
  }
  if (found.length !== values.length) return null;
  if (lin.k !== 1 || lin.d !== 0) {
    steps.push(`Solve for ${mark(v)}: ${found.map((f) => mark(`${v} = ${f.text ?? `≈ ${formatNumber(f.x)}`}`)).join(' or ')}.`);
  }
  steps.push(`Check in the original equation: ${found.map((f) => mark(`${v} = ${f.text ?? formatNumber(f.x)}`)).join(', ')} ${found.length === 1 ? 'satisfies' : 'each satisfy'} it ✓`);
  found.sort((x, y) => x.x - y.x);
  const answer = found.map((f) => (f.text ? `${v} = ${f.text}` : `${v} ≈ ${formatNumber(f.x)}`)).join('  or  ');
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: found.map((f) => f.x) };
}

export function solveSingleExponential(equation, variable) {
  const v = variable;
  const [lhsText, rhsText] = equation.split('=');
  if (rhsText === undefined || equation.split('=').length !== 2) return null;
  let lhs;
  let rhs;
  try {
    lhs = math.parse(lhsText.trim());
    rhs = math.parse(rhsText.trim());
  } catch {
    return null;
  }
  const has = (n) => n.filter((c) => c.type === 'SymbolNode' && c.name === v).length > 0;
  const constant = (n) => {
    try {
      const x = n.evaluate({});
      return typeof x === 'number' && Number.isFinite(x) ? x : null;
    } catch {
      return null;
    }
  };
  if (has(lhs) === has(rhs)) return null;
  let node = has(lhs) ? lhs : rhs;
  let value = has(lhs) ? rhs : lhs;
  if (constant(value) === null) return null;
  const exact = (n) => {
    try {
      return beautify(math.simplify(n, {}, { exactFractions: true }).toString());
    } catch {
      return beautify(n.toString());
    }
  };
  const txt = (n) => beautify(n.toString().replace(/\s*([*/])\s*/g, '$1'));
  const op = (o, fn, a, b) => new math.OperatorNode(o, fn, [a, b]);
  const lines = [];
  let base = null;
  let exponent = null;
  for (let guard = 0; guard < 20 && !base; guard += 1) {
    if (node.type === 'ParenthesisNode') { node = node.content; continue; }
    if (node.type === 'FunctionNode' && node.fn?.name === 'exp' && node.args.length === 1) {
      base = 'e'; exponent = node.args[0]; break;
    }
    if (node.type !== 'OperatorNode') return null;
    if (node.args.length === 1) {
      if (node.op !== '-') return null;
      node = node.args[0];
      value = new math.OperatorNode('-', 'unaryMinus', [value]);
      lines.push(['Multiply both sides by −1', node, value]);
      continue;
    }
    const [a, b] = node.args;
    if (node.op === '^') {
      if (has(a) || !has(b)) return null;
      const bv = constant(a);
      if (bv === null || !(bv > 0) || bv === 1) return null;
      // A fraction base keeps its brackets: (1/2)^x, not 1/2^x.
      const shownBase = exact(a).replace(/\s*\/\s*/g, '/');
      base = a.type === 'SymbolNode' && a.name === 'e' ? 'e' : /^(?:\d+(?:\.\d+)?|pi)$/.test(shownBase) ? shownBase : `(${shownBase})`;
      exponent = b;
      break;
    }
    if (has(a) && has(b)) return null;
    const inA = has(a);
    const other = inA ? b : a;
    const k = exact(other);
    if (node.op === '+') {
      value = op('-', 'subtract', value, other);
      node = inA ? a : b;
      lines.push([`Subtract ${mark(k)} from both sides`, node, value]);
    } else if (node.op === '-') {
      if (inA) {
        value = op('+', 'add', value, other);
        node = a;
        lines.push([`Add ${mark(k)} to both sides`, node, value]);
      } else {
        value = op('-', 'subtract', other, value);
        node = b;
        lines.push([`Subtract ${mark(k)} from both sides, then multiply by ${mark('−1')}`, node, value]);
      }
    } else if (node.op === '*') {
      if (constant(other) === 0) return null;
      value = op('/', 'divide', value, other);
      node = inA ? a : b;
      lines.push([`Divide both sides by ${mark(k)}`, node, value]);
    } else if (node.op === '/') {
      if (inA) {
        value = op('*', 'multiply', value, other);
        node = a;
        lines.push([`Multiply both sides by ${mark(k)}`, node, value]);
      } else {
        if (constant(value) === 0) return null;
        value = op('/', 'divide', other, value);
        node = b;
        lines.push([`Take the reciprocal of both sides, then multiply by ${mark(k)}`, node, value]);
      }
    } else {
      return null;
    }
  }
  if (!base) return null;
  while (exponent.type === 'ParenthesisNode') exponent = exponent.content;
  const lin = linearCoefficients(exponent.toString(), v);
  if (!lin || lin.k === 0) return null;
  const K = constant(value);
  if (K === null) return null;
  const b = base === 'e' ? Math.E : constant(math.parse(base));
  const linear = txt(exponent);
  const power = /^(?:[a-z]|\d+(?:\.\d+)?)$/i.test(linear) ? `${base}^${linear}` : `${base}^(${linear})`;
  const steps = [`The variable appears once, in the exponent of ${mark(power)}: isolate that power, then take logarithms.`];
  for (const [text, n, val] of lines) steps.push(`${text}: ${mark(`${txt(n)} = ${exact(val)}`)}`);
  const Ktext = exact(value);
  if (K <= 0) {
    steps.push(`${mark(`${base}^u`)} is positive for every real ${mark('u')}, and ${mark(`${Ktext} ≤ 0`)}, so ${mark(`${power} = ${Ktext}`)} has no real solution.`);
    return { steps: [...steps, 'Solution: no real solution'], answer: `No real solution (${power} is always positive)`, solutions: [] };
  }
  const L = Math.log(K) / Math.log(b);
  if (!Number.isFinite(L)) return null;
  const frac = (x) => {
    try {
      const f = math.fraction(x);
      return Math.abs(Number(f.s) * Number(f.n) / Number(f.d) - x) < 1e-12 && Number(f.d) <= 1000 ? f : null;
    } catch {
      return null;
    }
  };
  const fracText = (f) => {
    const n = Number(f.s) * Number(f.n);
    return Number(f.d) === 1 ? `${n}` : `${n}/${Number(f.d)}`;
  };
  const p = frac(lin.k);
  const q = frac(lin.d);
  if (!p || !q) return null;
  // log_b(K) exactly when it is a simple fraction: 4^x = 2 → x = 1/2, not
  // ln(2)/ln(4).
  const Lfrac = (() => {
    const f = frac(L);
    if (!f || Number(f.d) > 12) return null;
    const value = Number(f.s) * Number(f.n) / Number(f.d);
    return Math.abs(b ** value - K) <= 1e-12 * Math.abs(K) ? f : null;
  })();
  const Lint = Lfrac ? fracText(Lfrac) : null;
  const lnBase = base.startsWith('(') ? `ln${base}` : `ln(${base})`;
  const logOf = base === 'e' ? `ln(${Ktext})` : `ln(${Ktext})/${lnBase}`;
  steps.push(base === 'e'
    ? `Take ${mark('ln')} of both sides (${mark('ln(e^u) = u')}): ${mark(`${linear} = ${Lint !== null ? Lint : logOf}`)}`
    : `Take ${mark('ln')} of both sides (${mark(`ln(${base}^u) = u·${lnBase}`)}), then divide by ${mark(`${lnBase}`)}: ${mark(`${linear} = ${Lint !== null ? Lint : logOf}`)}`);
  const x = (L - lin.d) / lin.k;
  let xText;
  if (Lint !== null) {
    const r = Lfrac.sub(q).div(p);
    xText = fracText(r);
  } else if (base !== 'e' && lin.d === 0) {
    // ln(K)/ln(b) over p: one fraction, ln(7)/(2ln(2)), not (ln(7)/ln(2))/2.
    const c = math.fraction(1).div(p);
    const cn = Number(c.s) * Number(c.n);
    const cd = Number(c.d);
    const top = `${cn === -1 ? '-' : cn === 1 ? '' : cn}ln(${Ktext})`;
    xText = `${top}/${cd === 1 ? `${lnBase}` : `(${cd}${lnBase})`} (≈ ${formatNumber(x)})`;
  } else {
    const qn = Number(q.s) * Number(q.n);
    const T = qn === 0 ? logOf : `${logOf} ${qn > 0 ? '-' : '+'} ${fracText(math.fraction(Math.abs(lin.d)))}`;
    const compound = qn !== 0 || base !== 'e';
    const c = math.fraction(1).div(p);
    const cn = Number(c.s) * Number(c.n);
    const cd = Number(c.d);
    const wrapped = compound ? `(${T})` : T;
    if (cd === 1) xText = cn === 1 ? T : cn === -1 ? `-${wrapped}` : `${cn}${wrapped}`;
    else if (Math.abs(cn) === 1) xText = `${cn < 0 ? '-' : ''}${wrapped}/${cd}`;
    else xText = `${cn}${wrapped}/${cd}`;
    xText = `${xText} (≈ ${formatNumber(x)})`;
  }
  if (!(lin.k === 1 && lin.d === 0)) steps.push(`Solve the linear equation for ${mark(v)}: ${mark(`${v} = ${xText.replace(/ \(≈ .*\)$/, '')}`)}`);
  // The candidate must satisfy the original equation.
  try {
    const l = lhs.evaluate({ [v]: x });
    const r = rhs.evaluate({ [v]: x });
    if (!(Math.abs(l - r) <= 1e-9 * (1 + Math.abs(l)))) return null;
  } catch {
    return null;
  }
  const answer = `${v} = ${xText}`;
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: [x] };
}

// e^(2x) − 3e^x + 2 = 0: substitute u = e^x, solve the polynomial in u, and
// back-substitute x = ln u for each positive u. A negative exponent is 1/u^k
// (e^(−x) = 1/u, e^(−2x) = 1/u²): the equation is then multiplied through by
// the highest such power — allowed because u > 0 — before the polynomial is
// solved, so e^x + e^(−x) = 3 gives x = ln((3 ± √5)/2) and e^x + e^(−x) = 1
// is shown to have no real solution (u² − u + 1 has no real root). Returns
// null unless the whole equation is a polynomial in e^x and e^(−x) (any
// other appearance of the variable, or a transcendental function of it,
// means the substitution does not close).
export async function solveViaExpSubstitution(equation, variable) {
  const v = variable;
  // The base: e (e^x, exp(x)) or a positive number other than 1 (2^x,
  // 10^(2x)). Every exponential term must share it — 4^x − 5·2^x + 4 = 0
  // leaves a 2^x behind after the substitution and is declined below.
  const numericBase = equation.match(new RegExp(`(?<![\\w.])(\\d+(?:\\.\\d+)?)\\s*\\^\\s*(?:\\(\\s*-?\\s*\\d*\\s*\\*?\\s*${v}\\s*\\)|${v}\\b)`));
  const base = numericBase ? numericBase[1] : 'e';
  if (base !== 'e' && !(Number(base) > 0 && Number(base) !== 1)) return null;
  const baseRe = base === 'e' ? 'e' : base.replace('.', '\\.');
  const expPower = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\)|exp\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*\\(\\s*(\\d+)\\s*\\*?\\s*${v}\\s*\\)`, 'g');
  const expPlain = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*${v}\\b|e\\s*\\^\\s*\\(\\s*${v}\\s*\\)|exp\\(\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*(?:${v}\\b|\\(\\s*${v}\\s*\\))`, 'g');
  // e^(-x), e^(-2x), exp(-x), 2^(-x): the parser writes every negative
  // exponent in parentheses, so one shape per base covers them.
  const expNegative = base === 'e'
    ? new RegExp(`\\b(?:e\\s*\\^\\s*\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\)|exp\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\))`, 'g')
    : new RegExp(`(?<![\\w.])${baseRe}\\s*\\^\\s*\\(\\s*-\\s*(\\d*)\\s*\\*?\\s*${v}\\s*\\)`, 'g');
  if (!expPower.test(equation) && !expPlain.test(equation) && !expNegative.test(equation)) return null;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zeroForm = `(${lhs.trim()}) - (${rhs.trim()})`;
  let highestNegative = 0;
  const powersUsed = [];
  const inU = zeroForm
    .replace(expNegative, (m, ...rest) => {
      // The e-form has two groups (e^(−kx) | exp(−kx)), the numeric form one;
      // the captured k is whichever group matched, and an empty one is 1.
      const k = Number(rest.slice(0, -2).find((g) => g) || 1);
      highestNegative = Math.max(highestNegative, k);
      powersUsed.push(-k);
      return k === 1 ? 'u^(-1)' : `u^(-${k})`;
    })
    .replace(expPower, (m, k1, k2) => { powersUsed.push(Number(k1 || k2)); return `u^${k1 || k2}`; })
    .replace(expPlain, () => { powersUsed.push(1); return 'u'; });
  if (new RegExp(`\\b${v}\\b`).test(inU)) return null;
  if (/\b(?:sin|cos|tan|log|ln|sqrt|abs)\b/.test(inU)) return null;
  try {
    const Algebrite = await loadAlgebrite();
    // Clear the negative powers: multiply through by u^k (u > 0, so no
    // solution is gained or lost) and expand to the polynomial Algebrite
    // solves. A decimal coefficient (e^x + e^(−x) = 2.5) is written as a
    // fraction first: Algebrite's root finder refuses a float.
    const polynomial = highestNegative > 0
      ? Algebrite.run(`expand((${decimalsAsFractions(inU)}) * u^${highestNegative})`)
      : decimalsAsFractions(inU);
    if (highestNegative > 0 && (/\bu\^\(?-|nil|stop|error/i.test(polynomial) || !/^[-+*^()/\d.\su]+$/.test(polynomial))) return null;
    const rootsRaw = Algebrite.roots(polynomial, 'u').toString();
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    // Algebrite can list only the roots it factored out (see
    // solveWithAlgebriteRoots): a partial list would miss a solution, or
    // claim "no real solution" unproved — decline rather than guess.
    if (!rootsAccountForDegree(Algebrite, polynomial, 'u', rootsRaw)) return null;
    const degree = readPolynomial(polynomial, 'u')?.degree ?? 0;

    const b = base === 'e' ? Math.E : Number(base);
    const lines = [];
    const shown = [];
    const numeric = [];
    for (const r of roots) {
      const uText = formatSolutions([r], 'u').replace(/^u\s*=\s*/, '');
      if (!Number.isFinite(r.numeric)) {
        lines.push(`u = ${uText} is not real, so it gives no real ${v}`);
        continue;
      }
      if (r.numeric <= 0) {
        lines.push(`u = ${uText}: ${base}^${v} is always positive, so this gives no real ${v}`);
        continue;
      }
      const value = Math.log(r.numeric) / Math.log(b);
      let xText;
      if (Math.abs(value - Math.round(value)) < 1e-9) xText = String(Math.round(value)); // u is an exact power of the base
      else if (base === 'e') xText = `ln(${uText}) (≈ ${formatNumber(value)})`;
      else xText = `ln(${uText})/ln(${base}) (≈ ${formatNumber(value)})`;
      lines.push(`${base}^${v} = ${uText} → ${v} = ${xText}`);
      shown.push(`${v} = ${xText}`);
      numeric.push(value);
    }
    const realRoots = roots.filter((r) => Number.isFinite(r.numeric));
    const noneReal = realRoots.length === 0;
    // "No real solution" is claimed only when every listed root visibly has
    // an imaginary part: a root mathjs could not evaluate is not thereby
    // non-real, so such a list proves nothing and the path declines.
    if (noneReal && !roots.every((r) => /(?<![a-z])i(?![a-z])/.test(r.display))) return null;
    const answer = shown.length > 0
      ? shown.join('  or  ')
      : noneReal
        ? `No real solution (no real ${mark('u')} solves ${mark(`${beautify(polynomial)} = 0`)}, so no real ${mark(v)})`
        : `No real solution (${base}^${v} is always positive, so no listed u is reachable)`;
    const takeLog = base === 'e' ? `take ${mark('ln')} of both sides` : `take the logarithm of both sides, ${mark(`${v} = ln(u)/ln(${base}) = log_${base}(u)`)}`;
    // The powers the substitution turns into: e^(2x) = u², e^(−x) = 1/u, …
    const powerNotes = [...new Set(powersUsed)].sort((a, b) => a - b)
      .filter((k) => k !== 1)
      .map((k) => (k < 0 ? `${base}^(${k === -1 ? '-' : k}${v}) = 1/u${k < -1 ? `^${-k}` : ''}` : `${base}^(${k}${v}) = u^${k}`));
    const substitutionNote = mark(powerNotes.length ? powerNotes.join(', ') : `${base}^(2${v}) = u², ${base}^(3${v}) = u³`);
    const steps = [
      `Rewrite as an equation set to zero: ${beautify(zeroForm)} = 0`,
      `Let ${mark(`u = ${base}^${v}`)} (so ${substitutionNote}): ${mark(`${beautify(inU)} = 0`)}`,
    ];
    if (highestNegative > 0) {
      const multiplier = highestNegative === 1 ? 'u' : `u^${highestNegative}`;
      steps.push(`Multiply both sides by ${mark(multiplier)} to clear the negative powers (${mark(`u = ${base}^${v} > 0`)}, so no solution is gained or lost): ${mark(`${beautify(polynomial)} = 0`)}`);
    }
    const uSolutions = formatSolutions(roots, 'u').split('  or  ').map(mark).join('  or  ');
    if (noneReal && degree === 2) {
      const [c2, c1, c0] = quadraticCoefficients(polynomial);
      if (c2 !== null) {
        const disc = c1 * c1 - 4 * c2 * c0;
        const signed = (n) => (n < 0 ? `(${formatNumber(n)})` : formatNumber(n));
        steps.push(`The discriminant is ${mark(`${signed(c1)}² − 4(${signed(c2)})(${signed(c0)}) = ${formatNumber(disc)}`)}, which is negative, so no real ${mark('u')} solves it: ${uSolutions}, neither of which is real`);
      } else {
        steps.push(`Solve for ${mark('u')}: ${uSolutions}, none of which is real`);
      }
    } else if (noneReal) {
      steps.push(`Solve for ${mark('u')}: ${uSolutions}, none of which is real`);
    } else {
      steps.push(`Solve for u: ${formatSolutions(roots, 'u')}`);
    }
    if (!noneReal) steps.push(`Back-substitute ${mark(`u = ${base}^${v}`)} and ${takeLog}: ${lines.map(mark).join('; ')}`);
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: numeric };
  } catch {
    return null;
  }
}

// 2.5 → (5/2), 0.75 → (3/4): decimals as the fractions Algebrite can factor.
function decimalsAsFractions(text) {
  return text.replace(/(?<![\w.])(\d+)\.(\d+)(?![\w.])/g, (m, whole, places) => {
    const denominator = 10 ** places.length;
    const numerator = Number(whole) * denominator + Number(places);
    const g = gcd(numerator, denominator);
    return `(${numerator / g}/${denominator / g})`;
  });
}

// The coefficients [a, b, c] of a quadratic in u as Algebrite prints it
// (1-u+u^2, 2*u^2-3*u+1, …); [null] when the text is not of that shape.
function quadraticCoefficients(polynomial) {
  const coeffs = [0, 0, 0];
  const terms = polynomial.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  for (const term of terms) {
    const m = term.match(/^([+-]?)(\d+(?:\.\d+)?)?(?:\*?u(?:\^(\d+))?)?$/);
    if (!m) return [null];
    const sign = m[1] === '-' ? -1 : 1;
    const coefficient = sign * (m[2] === undefined ? 1 : Number(m[2]));
    const power = term.includes('u') ? Number(m[3] || 1) : 0;
    if (power > 2) return [null];
    coeffs[2 - power] += coefficient;
  }
  return coeffs;
}

// The logarithm terms in `text`, each with its base and argument: ln(g) is
// base e; (log(g)/log(b)) — the parser's form for a bare log (b = 10) and for
// log_b(g) — is base b. Returns null if a log appears in any other shape.
function logTermsOf(text) {
  const terms = [];
  const re = /(?<![a-z])(ln|log)\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close === -1) return null;
    const arg = text.slice(open + 1, close).trim();
    if (m[1].toLowerCase() === 'ln') {
      terms.push({ start: m.index, end: close + 1, base: 'e', arg });
      continue;
    }
    const quotient = text.slice(close + 1).match(/^\s*\/\s*log\s*\(/i);
    if (!quotient || text[m.index - 1] !== '(') return null;
    const baseOpen = close + 1 + quotient[0].length - 1;
    const baseClose = matchingParen(text, baseOpen);
    if (baseClose === -1 || text[baseClose + 1] !== ')') return null;
    const base = text.slice(baseOpen + 1, baseClose).trim();
    if (!/^\d+(?:\.\d+)?$/.test(base) || !(Number(base) > 0) || Number(base) === 1) return null;
    terms.push({ start: m.index - 1, end: baseClose + 2, base, arg });
    re.lastIndex = baseClose + 2;
  }
  return terms;
}

// Algebrite writes e^k as exp(k); show the textbook form.
function prettyExp(display) {
  return String(display)
    .replace(/\bexp\(1\)/g, 'e')
    .replace(/\bexp\(\s*-\s*(\d+)\s*\)/g, (_, k) => (k === '1' ? '1/e' : `1/e^${k}`))
    .replace(/\bexp\(([\w.]+)\)/g, 'e^$1')
    .replace(/\bexp\(([^()]+)\)/g, 'e^($1)')
    .replace(/\b1\/(\d+)\*(e(?:\^[\w.]+|\^\([^()]+\))?)/g, '$2/$1')
    .replace(/\b(\d+)\*(e(?:\^[\w.]+|\^\([^()]+\))?)/g, '$1$2');
}

// ln(x) = 1, ln(x)² = 4, ln(2x) = 3, log(x) + log(x − 3) = 1, ln(x) − ln(x − 1)
// = ln(2): an equation whose only use of the variable is inside logarithms of
// one base. One distinct argument g: substitute u = log(g), solve the
// polynomial in u, and back-substitute g = b^u. Several arguments: the
// equation must be linear in the logarithms with integer coefficients, so
// the product/quotient rules combine them into one — Σ kᵢ·log(gᵢ) = c →
// Π gᵢ^kᵢ = b^c — and that polynomial is solved. Every candidate is checked
// against the domain (each argument positive) and substituted into the
// original equation before it is reported, so log(x) + log(x − 3) = 1 gives
// x = 5 and says why x = −2 is rejected. Returns null when the shape does
// not fit; the caller falls through to the numeric scan.
export async function solveViaLogSubstitution(equation, variable) {
  const v = variable;
  const [lhs, rhs] = equation.split('=');
  if (rhs === undefined || !lhs.trim() || !rhs.trim()) return null;
  const zeroForm = `(${lhs.trim()}) - (${rhs.trim()})`;
  const terms = logTermsOf(zeroForm);
  if (!terms || terms.length === 0) return null;
  const base = terms[0].base;
  if (!terms.every((t) => t.base === base)) return null;
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  // Arguments must be polynomial in the variable (no nested transcendental,
  // no variable exponent) for the combined equation to be a polynomial.
  if (terms.some((t) => /[a-df-wyz]{2,}/i.test(t.arg) || /\^\s*\(?[^()]*[a-z]/i.test(t.arg))) return null;

  // Distinct arguments → u1, u2, …
  const args = [];
  const keyOf = (a) => a.replace(/\s+/g, '');
  for (const t of terms) {
    let idx = args.findIndex((a) => keyOf(a) === keyOf(t.arg));
    if (idx === -1) { args.push(t.arg); idx = args.length - 1; }
    t.sym = `u${idx + 1}`;
  }
  let inU = zeroForm;
  for (const t of [...terms].sort((a, b) => b.start - a.start)) {
    inU = `${inU.slice(0, t.start)}${t.sym}${inU.slice(t.end)}`;
  }
  if (hasVar.test(inU)) return null; // the variable outside a log: the substitution does not close
  if (/\b(?:sin|cos|tan|sqrt|abs|ln|log)\b/.test(inU)) return null;

  const logName = base === 'e' ? 'ln' : base === '10' ? 'log' : `log_${base}`;
  const powText = (u) => (base === 'e' ? `exp(${u})` : `${base}^(${u})`);
  const argumentPositive = (x) => args.every((a) => {
    try {
      const val = math.evaluate(a, { [v]: x });
      return typeof val === 'number' && val > 0;
    } catch {
      return false;
    }
  });

  try {
    const Algebrite = await loadAlgebrite();
    const steps = [`Rewrite as an equation set to zero: ${beautify(zeroForm)} = 0`];
    let candidates = []; // { display, numeric }

    if (args.length === 1) {
      const g = args[0];
      const inOneU = inU.replace(/\bu1\b/g, 'u');
      const rootsRaw = Algebrite.roots(inOneU, 'u').toString();
      if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
      const uRoots = parseRootsList(rootsRaw);
      if (uRoots.length === 0) return null;
      steps.push(`Let ${mark(`u = ${logName}(${beautify(g)})`)}: ${mark(`${beautify(inOneU)} = 0`)}`);
      steps.push(`Solve for u: ${formatSolutions(uRoots, 'u')}`);
      const lines = [];
      for (const r of uRoots) {
        const uText = formatSolutions([r], 'u').replace(/^u\s*=\s*/, '');
        if (!Number.isFinite(r.numeric)) {
          lines.push(`${mark(`u = ${uText}`)} is not real, so it gives no real ${mark(v)}`);
          continue;
        }
        // g = xⁿ: x = ±b^(u/n) (n even) or b^(u/n) (n odd), exactly.
        // Algebrite writes the real roots of x² = e⁴ as ±i·(−e⁴)^(1/2), and
        // the numeric scan gave ±7.3891 for what is ±e².
        const power = String(g).replace(/\s+/g, '').match(new RegExp(`^\\(?${v}\\^\\(?(\\d+)\\)?\\)?$`));
        let xs;
        if (power && Number(power[1]) >= 2) {
          const n = Number(power[1]);
          let ex;
          try {
            const f = math.fraction(String(r.display).replace(/\s+/g, '')).div(n);
            ex = Number(f.d) === 1 ? `${Number(f.s) * Number(f.n)}` : `${Number(f.s) * Number(f.n)}/${Number(f.d)}`;
          } catch {
            ex = `(${r.display})/${n}`;
          }
          const one = ex === '1' ? (base === 'e' ? 'exp(1)' : base) : base === 'e' ? `exp(${ex})` : `${base}^(${ex})`;
          const value = (base === 'e' ? Math.E : Number(base)) ** (r.numeric / n);
          xs = n % 2 === 0
            ? [{ display: `-${one}`, numeric: -value }, { display: one, numeric: value }]
            : [{ display: one, numeric: value }];
        } else {
          const raw = String(Algebrite.run(`roots((${g}) - ${powText(r.display)}, ${v})`)).trim();
          if (!raw || /stop|error|nil/i.test(raw)) return null;
          // Any other g with that complex form: decline; the numeric scan takes it.
          if (/\(-.*\)\^\(1\/\d+\)/.test(raw)) return null;
          xs = parseRootsList(raw);
        }
        if (xs.length === 0) return null;
        lines.push(`${mark(`u = ${uText}`)} means ${mark(`${logName}(${beautify(g)}) = ${uText}`)}, so ${mark(`${beautify(g)} = ${base}^${/^[\w.]+$/.test(uText) ? uText : `(${uText})`} → ${xs.map((x) => `${v} = ${prettyExp(prettyRadicals(x.display))}`).join(' or ')}`)}`);
        candidates.push(...xs);
      }
      steps.push(`Back-substitute (${mark(`${logName}(a) = u`)} means ${mark(`a = ${base}^u`)}): ${lines.join('; ')}`);
    } else {
      // Linear in the logarithms with integer coefficients?
      const coeffs = [];
      for (let i = 0; i < args.length; i += 1) {
        const c = String(Algebrite.run(`coeff(${inU}, u${i + 1}, 1)`)).trim();
        if (!/^-?\d+$/.test(c)) return null;
        coeffs.push(Number(c));
      }
      let constantExpr = inU;
      for (let i = 0; i < args.length; i += 1) constantExpr = `subst(0, u${i + 1}, ${constantExpr})`;
      const constant = String(Algebrite.run(constantExpr)).trim();
      if (/\bu\d+\b|stop|error|nil/i.test(constant) || hasVar.test(constant)) return null;
      const linear = coeffs.map((c, i) => `(${c})*u${i + 1}`).join(' + ');
      if (String(Algebrite.run(`simplify((${inU}) - (${linear} + (${constant})))`)).trim() !== '0') return null;

      // Σ kᵢ·log(gᵢ) = −constant → Π gᵢ^kᵢ = b^(−constant)
      const rhsExp = String(Algebrite.run(`simplify(-(${constant}))`)).trim();
      const numerator = args.map((a, i) => ({ a, k: coeffs[i] })).filter((t) => t.k > 0).map((t) => (t.k === 1 ? `(${t.a})` : `(${t.a})^${t.k}`));
      const denominator = args.map((a, i) => ({ a, k: coeffs[i] })).filter((t) => t.k < 0).map((t) => (t.k === -1 ? `(${t.a})` : `(${t.a})^${-t.k}`));
      if (numerator.length === 0 && denominator.length === 0) return null;
      const numText = numerator.length ? numerator.join('*') : '1';
      const denText = denominator.length ? denominator.join('*') : '';
      const combined = denText ? `(${numText})/(${denText})` : numText;
      const rhsValue = String(Algebrite.run(`simplify(${powText(rhsExp)})`)).trim();
      steps.push(`Every term is a logarithm with the same base, so combine them with the log rules (${mark(`k·${logName}(a) = ${logName}(a^k)`)}, ${mark(`${logName}(a) + ${logName}(b) = ${logName}(ab)`)}, ${mark(`${logName}(a) − ${logName}(b) = ${logName}(a/b)`)}): ${mark(`${logName}(${beautify(combined)}) = ${beautify(rhsExp)}`)}`);
      steps.push(`Rewrite in exponential form: ${beautify(combined)} = ${base}^${/^[\w.]+$/.test(rhsExp) ? rhsExp : `(${rhsExp})`}${prettyExp(rhsValue) !== beautify(rhsExp) && !/^\d+(?:\.\d+)?$/.test(rhsExp) ? ` = ${prettyExp(beautify(rhsValue))}` : ''}`);
      const poly = denText ? `(${numText}) - (${rhsValue})*(${denText})` : `(${numText}) - (${rhsValue})`;
      const rootsRaw = String(Algebrite.run(`roots(${poly}, ${v})`)).trim();
      if (!rootsRaw || /stop|error|nil/i.test(rootsRaw)) return null;
      if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) return null;
      candidates = parseRootsList(rootsRaw);
      if (candidates.length === 0) return null;
      steps.push(`Solve ${mark(`${beautify(poly)} = 0`)}: ${mark(candidates.map((x) => `${v} = ${prettyExp(prettyRadicals(x.display))}`).join(' or '))}`);
    }

    // Domain and verification: every argument positive, and the original
    // equation balanced, before a candidate is reported.
    const kept = [];
    const rejected = [];
    for (const c of candidates) {
      const show = prettyExp(prettyRadicals(c.display));
      if (!Number.isFinite(c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} is not real`); continue; }
      if (!argumentPositive(c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} makes a logarithm's argument zero or negative`); continue; }
      if (!satisfiesEquation(equation, v, c.numeric)) { rejected.push(`${mark(`${v} = ${show}`)} does not balance the original equation`); continue; }
      if (kept.some((k) => Math.abs(k.numeric - c.numeric) < 1e-9)) continue;
      kept.push({ display: show, numeric: c.numeric });
    }
    if (rejected.length > 0) {
      steps.push(`A logarithm is defined only for a positive argument, so check each candidate in the original equation: ${rejected.join('; ')} — rejected.`);
    }
    const answer = kept.length > 0
      ? kept.map((k) => `${v} = ${k.display}${/^-?\d+(?:\.\d+)?$/.test(k.display) ? '' : ` (≈ ${formatNumber(k.numeric)})`}`).join('  or  ')
      : 'No solution (every candidate makes a logarithm argument zero or negative)';
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: kept.map((k) => k.numeric) };
  } catch {
    return null;
  }
}
