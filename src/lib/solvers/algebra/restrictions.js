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
//   (a negative power, g^(−1), is a denominator too);
// - a logarithm needs a positive argument: a linear argument gives a bound
//   (x − 1 > 0, so x > 1), bounds from several logarithms are intersected
//   (ln(x) + ln(x − 2): x > 2), the square of a linear argument excludes
//   its zero (ln(x²): x ≠ 0), any other argument is stated as written.

import { math, beautify, mark, linearCoefficients, neverZeroSide, stripOuterParens } from '../solverUtils.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';
import { parseRootsList } from './rootsFormat.js';

const mentions = (text, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`, 'i').test(String(text));
const LOGS = /^(?:ln|log|log10|log2|log_\d+)$/;

// The zero of a linear expression, exactly: its coefficients read as exact
// rationals by the polynomial reader, never through floating point, where
// 1 + 1/10^20 is 1. Null for anything else (e·x + 1 is stated as written).
function exactLinearZero(node, v) {
  const poly = readPolynomial(node.toString(), v);
  if (!poly || poly.tooHigh || poly.degree !== 1) return null;
  const [c0, c1] = poly.coefficients;
  const z = math.fraction(c0).neg().div(math.fraction(c1));
  const sign = Number(z.s) < 0 && String(z.n) !== '0' ? '-' : '';
  return { value: Number(z.valueOf()), text: String(z.d) === '1' ? `${sign}${z.n}` : `${sign}${z.n}/${z.d}`, rising: Number(math.fraction(c1).s) > 0 };
}

const rootText = (r) => (r.exact ? (r.exact.d === 1n ? String(r.exact.m) : `${r.exact.m}/${r.exact.d}`) : null);

// What an expression's own denominators, logarithms and square roots
// exclude, read off its parse tree: excluded points (exact: rationals from
// the exact root finder, radicals from Algebrite checked against it), at
// most one lower and one upper bound (strict for a logarithm, closed for a
// square root), and anything else stated as written, never as a rounded
// decimal. Shared by the equation restriction and a constant function's
// domain (functions/constant.js).
export function domainConditions(text, v, { Algebrite = null, roots = true, skipTrig = false } = {}) {
  let tree;
  try { tree = math.parse(String(text)); } catch { return null; }
  const dens = [];
  const args = [];
  tree.traverse((n) => {
    if (n.type === 'OperatorNode' && n.op === '/' && mentions(n.args[1].toString(), v)) dens.push(n.args[1]);
    if (n.type === 'FunctionNode' && LOGS.test(n.fn?.name ?? '') && n.args[0] && mentions(n.args[0].toString(), v)) args.push({ node: n.args[0], kind: 'l' });
    if (roots && n.type === 'FunctionNode' && n.fn?.name === 'sqrt' && n.args[0] && mentions(n.args[0].toString(), v)) args.push({ node: n.args[0], kind: 's' });
    // g^(−k) is 1/g^k: its base is a denominator; g^(p/q) with q even is a
    // square-root-like power: its base cannot be negative.
    if (n.type === 'OperatorNode' && n.op === '^' && mentions(n.args[0].toString(), v) && !mentions(n.args[1].toString(), v)) {
      let e = NaN;
      try { e = Number(n.args[1].evaluate()); } catch { e = NaN; }
      if (Number.isFinite(e) && e < 0) dens.push(n.args[0]);
      if (roots && Number.isFinite(e) && !Number.isInteger(e)) {
        let even = true;
        try { even = Number(math.fraction(e).d) % 2 === 0; } catch { even = true; }
        if (even) args.push({ node: n.args[0], kind: 's' });
      }
    }
  });
  const reasons = [];
  const tests = [];
  const points = [];
  const unsolved = [];
  let lower = null;
  let upper = null;
  const at = (node, x) => { try { return Number(node.evaluate({ [v]: x })); } catch { return NaN; } };
  const addPoint = (value, shown) => { if (!points.some((p) => Math.abs(p.value - value) < 1e-12)) points.push({ value, text: shown }); };
  // A bound: the tighter wins; at the same value, the strict one.
  const bound = (edge, text, above, strict) => {
    if (above) { if (!lower || edge > lower.value + 1e-12 || (Math.abs(edge - lower.value) <= 1e-12 && strict)) lower = { value: edge, text, strict }; }
    else if (!upper || edge < upper.value - 1e-12 || (Math.abs(edge - upper.value) <= 1e-12 && strict)) upper = { value: edge, text, strict };
  };
  // The real zeros of a polynomial, exactly, or null.
  const exactZeros = (node) => {
    const poly = readPolynomial(node.toString(), v);
    if (!poly || poly.tooHigh || poly.degree < 1) return null;
    const real = allRoots(poly).real;
    if (real.every(rootText)) return real.map((r) => ({ value: r.value, text: rootText(r) }));
    if (!Algebrite) return null;
    try {
      const listed = parseRootsList(String(Algebrite.run(`roots(${node.toString()}, ${v})`)).trim())
        .filter((r) => Number.isFinite(r.numeric) && !/\bi\b/.test(r.display));
      // Every real root, each matched to the exact finder's value.
      if (listed.length !== real.length) return null;
      const out = real.map((r) => {
        const hit = listed.find((l) => Math.abs(l.numeric - r.value) < 1e-9 * (1 + Math.abs(r.value)));
        return hit ? { value: r.value, text: rootText(r) ?? hit.display.replace(/(\d+)\^\(1\/2\)/g, '√$1') } : null;
      });
      return out.every(Boolean) ? out : null;
    } catch { return null; }
  };

  for (const raw of dens) {
    // A denominator proved never 0 (e^x, x² + 1) excludes nothing.
    let never = null;
    try { never = neverZeroSide(raw.toString(), '0', v); } catch { never = null; }
    if (never) continue;
    // |g| is 0 exactly where g is.
    let den = raw;
    while (den.type === 'ParenthesisNode') den = den.content;
    if (den.type === 'FunctionNode' && den.fn?.name === 'abs' && den.args.length === 1) den = den.args[0];
    // sin(kx + d), cos(kx + d): a lattice the caller states itself.
    if (skipTrig && den.type === 'FunctionNode' && /^(?:sin|cos|tan|sec|csc|cot)$/.test(den.fn?.name ?? '') && linearCoefficients(den.args[0].toString(), v)) continue;
    const shown = beautify(stripOuterParens(den.toString()));
    if (reasons.some((r) => r.key === `d:${shown}`)) continue;
    tests.push((x) => Math.abs(at(den, x)) > 1e-12);
    const zeros = exactZeros(den);
    if (zeros) zeros.forEach((z) => addPoint(z.value, z.text));
    else unsolved.push(`${shown} ≠ 0`);
    reasons.push({ key: `d:${shown}`, kind: 'd', text: mark(`${shown} ≠ 0`) });
  }
  for (const { node: arg, kind } of args) {
    const strict = kind === 'l';
    const rel = strict ? '>' : '≥';
    const shown = beautify(stripOuterParens(arg.toString()));
    if (reasons.some((r) => r.key === `${kind}:${shown}`)) continue;
    tests.push((x) => (strict ? at(arg, x) > 0 : at(arg, x) >= 0));
    reasons.push({ key: `${kind}:${shown}`, kind, text: mark(`${shown} ${rel} 0`) });
    // (ax + b)^k: an odd power has the sign of ax + b; an even one is
    // positive everywhere but at its zero (and ≥ 0 everywhere).
    let base = arg;
    while (base.type === 'ParenthesisNode') base = base.content;
    const power = base.type === 'OperatorNode' && base.op === '^' && /^\d+$/.test(base.args[1].toString()) ? Number(base.args[1].toString()) : 1;
    if (power > 1) base = base.args[0];
    if (power % 2 === 0) {
      if (!strict) continue;
      const sq = exactLinearZero(base, v);
      if (sq) { addPoint(sq.value, sq.text); continue; }
      unsolved.push(`${shown} ${rel} 0`);
      continue;
    }
    const lin = exactLinearZero(base, v);
    if (lin) { bound(lin.value, lin.text, lin.rising, strict); continue; }
    unsolved.push(`${shown} ${rel} 0`);
  }
  if (!reasons.length) return null;
  if (lower && upper && (lower.value > upper.value || (lower.value === upper.value && (lower.strict || upper.strict)))) return { empty: true };

  // An excluded point on a closed edge makes the edge strict: x ≥ 0 and
  // x ≠ 0 is x > 0.
  for (const edge of [lower, upper]) {
    if (!edge || edge.strict) continue;
    const at = points.findIndex((p) => Math.abs(p.value - edge.value) <= 1e-12);
    if (at >= 0) { edge.strict = true; points.splice(at, 1); }
  }
  // One statement: the interval, then the points it does not already
  // exclude, then anything left as written.
  const inside = (x) => (!lower || x > lower.value + 1e-12 || (!lower.strict && Math.abs(x - lower.value) <= 1e-12))
    && (!upper || x < upper.value - 1e-12 || (!upper.strict && Math.abs(x - upper.value) <= 1e-12));
  const kept = points.filter((p) => inside(p.value)).sort((a, b) => a.value - b.value);
  const conditions = [];
  const lo = lower && `${lower.text} ${lower.strict ? '<' : '≤'} `;
  const hi = upper && ` ${upper.strict ? '<' : '≤'} ${upper.text}`;
  if (lower && upper) conditions.push(`${lo}${v}${hi}`);
  else if (lower) conditions.push(`${v} ${lower.strict ? '>' : '≥'} ${lower.text}`);
  else if (upper) conditions.push(`${v} ${upper.strict ? '<' : '≤'} ${upper.text}`);
  if (kept.length) conditions.push(`${v} ≠ ${kept.map((p) => p.text).join(', ')}`);
  conditions.push(...unsolved);
  return { conditions, reasons, tests, points: kept, lower, upper, holds: (x) => tests.every((t) => t(x)) };
}

export function equationRestrictions(equation, v, Algebrite = null) {
  const sides = String(equation).split('=');
  if (sides.length !== 2) return null;
  const found = domainConditions(`(${sides[0]}) - (${sides[1]})`, v, { Algebrite, roots: false });
  if (!found || found.empty || !found.conditions.length) return null;
  const { conditions, reasons } = found;
  const text = conditions.join(' and ');
  const marked = conditions.map((c) => mark(c)).join(' and ');
  return {
    text,
    step: `Restriction first: ${[
      ['d', (n) => (n > 1 ? 'a denominator cannot be 0, so ' : 'the denominator cannot be 0, so ')],
      ['l', () => 'a logarithm needs a positive argument, so '],
    ].map(([kind, lead]) => {
      const own = reasons.filter((r) => r.kind === kind);
      return own.length ? `${lead(own.length).replace(/0/, mark('0'))}${own.map((r) => r.text).join(' and ')}` : null;
    }).filter(Boolean).join('; ')}${reasons.length === 1 ? (reasons[0].text === marked ? '.' : `, that is ${marked}.`) : `. Together: ${marked}.`} A value that breaks this cannot be a solution, even if the algebra produces it.`,
    holds: found.holds,
    marked,
  };
}
