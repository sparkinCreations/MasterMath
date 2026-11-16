// The values an equation's own expressions exclude, stated before solving
// and carried into the answer (November 2026 review): (x + 1)/(x − 2) = 3
// was x = 7/2 and log₂(x − 1) = 3 was x = 9, both right, but neither said
// x ≠ 2 or x > 1, which a textbook writes first. The check in the original
// already rejected a value that breaks them; now the restriction is said.
//
// Read off the parse tree of the equation as typed:
// - a denominator cannot be 0: the real zeros of a polynomial denominator
//   from the exact root finder (x ≠ 2), any other denominator as written
//   (sin(x) ≠ 0);
// - a logarithm needs a positive argument: a linear argument gives a bound
//   (x − 1 > 0, so x > 1), bounds from several logarithms are intersected
//   (ln(x) + ln(x − 2): x > 2), the square of a linear argument excludes
//   its zero (ln(x²): x ≠ 0), any other argument is stated as written.

import { math, beautify, mark, linearCoefficients, neverZeroSide } from '../solverUtils.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';

const mentions = (text, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`, 'i').test(String(text));
const LOGS = /^(?:ln|log|log10|log2|log_\d+)$/;

// A number as a fraction when it is one: 7/2, −1/3.
function fraction(x) {
  for (let q = 1; q <= 100; q += 1) {
    const p = Math.round(x * q);
    if (Math.abs(x - p / q) < 1e-12 * (1 + Math.abs(x))) return q === 1 ? String(p) : `${p}/${q}`;
  }
  return null;
}

const rootText = (r) => (r.exact ? (r.exact.d === 1n ? String(r.exact.m) : `${r.exact.m}/${r.exact.d}`) : null);

export function equationRestrictions(equation, v) {
  const sides = String(equation).split('=');
  if (sides.length !== 2) return null;
  let tree;
  try { tree = math.parse(`(${sides[0]}) - (${sides[1]})`); } catch { return null; }
  const dens = [];
  const args = [];
  tree.traverse((n) => {
    if (n.type === 'OperatorNode' && n.op === '/' && mentions(n.args[1].toString(), v)) dens.push(n.args[1]);
    if (n.type === 'FunctionNode' && LOGS.test(n.fn?.name ?? '') && n.args[0] && mentions(n.args[0].toString(), v)) args.push(n.args[0]);
  });
  if (!dens.length && !args.length) return null;

  const reasons = [];
  const tests = [];
  const points = [];
  const unsolved = [];
  let lower = null;
  let upper = null;
  const at = (node, x) => { try { return Number(node.evaluate({ [v]: x })); } catch { return NaN; } };

  for (const raw of dens) {
    // A denominator proved never 0 (e^x, x² + 1) excludes nothing.
    let never = null;
    try { never = neverZeroSide(raw.toString(), '0', v); } catch { never = null; }
    if (never) continue;
    // |g| is 0 exactly where g is.
    let den = raw;
    while (den.type === 'ParenthesisNode') den = den.content;
    if (den.type === 'FunctionNode' && den.fn?.name === 'abs' && den.args.length === 1) den = den.args[0];
    const shown = beautify(den.toString().replace(/^\((.*)\)$/, '$1'));
    if (reasons.some((r) => r.key === `d:${shown}`)) continue;
    tests.push((x) => Math.abs(at(den, x)) > 1e-12);
    const poly = readPolynomial(den.toString(), v);
    const roots = poly && !poly.tooHigh && poly.degree >= 1 ? allRoots(poly).real : null;
    if (roots && roots.every(rootText)) {
      for (const r of roots) if (!points.some((p) => Math.abs(p.value - r.value) < 1e-12)) points.push({ value: r.value, text: rootText(r) });
    } else {
      unsolved.push(`${shown} ≠ 0`);
    }
    reasons.push({ key: `d:${shown}`, kind: 'd', text: mark(`${shown} ≠ 0`) });
  }
  for (const arg of args) {
    const shown = beautify(arg.toString().replace(/^\((.*)\)$/, '$1'));
    if (reasons.some((r) => r.key === `l:${shown}`)) continue;
    tests.push((x) => at(arg, x) > 0);
    reasons.push({ key: `l:${shown}`, kind: 'l', text: mark(`${shown} > 0`) });
    // (ax + b)^k: an odd power has the sign of ax + b; an even one is
    // positive everywhere but at its zero.
    let base = arg;
    while (base.type === 'ParenthesisNode') base = base.content;
    const power = base.type === 'OperatorNode' && base.op === '^' && /^\d+$/.test(base.args[1].toString()) ? Number(base.args[1].toString()) : 1;
    if (power > 1) base = base.args[0];
    if (power % 2 === 0) {
      const sq = linearCoefficients(base.toString(), v);
      if (sq && sq.k !== 0 && fraction(-sq.d / sq.k) !== null) {
        const value = -sq.d / sq.k;
        if (!points.some((p) => Math.abs(p.value - value) < 1e-12)) points.push({ value, text: fraction(value) });
        continue;
      }
      unsolved.push(`${shown} > 0`);
      continue;
    }
    const lin = linearCoefficients(base.toString(), v);
    if (lin && lin.k !== 0) {
      const edge = -lin.d / lin.k;
      const text = fraction(edge);
      if (text === null) { unsolved.push(`${shown} > 0`); continue; }
      if (lin.k > 0) { if (!lower || edge > lower.value) lower = { value: edge, text }; } else if (!upper || edge < upper.value) upper = { value: edge, text };
      continue;
    }
    unsolved.push(`${shown} > 0`);
  }

  // One statement: the interval, then the points it does not already
  // exclude, then anything left as written.
  if (lower && upper && lower.value >= upper.value) return null; // no value at all: left to the solver
  const inside = (x) => (!lower || x > lower.value + 1e-12) && (!upper || x < upper.value - 1e-12);
  const kept = points.filter((p) => inside(p.value)).sort((a, b) => a.value - b.value);
  const conditions = [];
  if (lower && upper) conditions.push(`${lower.text} < ${v} < ${upper.text}`);
  else if (lower) conditions.push(`${v} > ${lower.text}`);
  else if (upper) conditions.push(`${v} < ${upper.text}`);
  if (kept.length) conditions.push(`${v} ≠ ${kept.map((p) => p.text).join(', ')}`);
  conditions.push(...unsolved);
  if (!conditions.length) return null;

  const text = conditions.join(' and ');
  const marked = conditions.map((c) => mark(c)).join(' and ');
  return {
    text,
    step: `Restriction first: ${[
      ['d', (n) => (n > 1 ? 'a denominator cannot be 0, so ' : 'the denominator cannot be 0, so ')],
      ['l', (n) => (n > 1 ? 'a logarithm needs a positive argument, so ' : 'a logarithm needs a positive argument, so ')],
    ].map(([kind, lead]) => {
      const own = reasons.filter((r) => r.kind === kind);
      return own.length ? `${lead(own.length).replace(/0/, mark('0'))}${own.map((r) => r.text).join(' and ')}` : null;
    }).filter(Boolean).join('; ')}${reasons.length === 1 ? (reasons[0].text === marked ? '.' : `, that is ${marked}.`) : `. Together: ${marked}.`} A value that breaks this cannot be a solution, even if the algebra produces it.`,
    holds: (x) => tests.every((t) => t(x)),
    marked,
  };
}
