// A power of a linear inside, c·(ax + b)^r (a root, 1 over a root, or a
// whole power): ∫ = c·(ax + b)^(r + 1)/(a(r + 1)), by u = ax + b. Algebrite
// answered ∫√(2x + 1) dx as 1/3·√(8x^3 + 12x^2 + 6x + 1), the cube expanded
// under the root, with the step only labelled "u-substitution" (outside
// review, November 2026; 1.68.8). Worked here as the substitution it is, in
// exact fractions, and checked by differentiating.

import { math, beautify, mark, linearCoefficients } from '../solverUtils.js';
import { derivativeMatchesNumerically } from '../substitutionSolver.js';

const unwrap = (n) => (n && n.type === 'ParenthesisNode' ? unwrap(n.content) : n);

function fraction(x) {
  for (let q = 1; q <= 1000; q += 1) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-12) return { p, q };
  }
  return null;
}
const fracText = ({ p, q }) => (q === 1 ? String(p) : `${p}/${q}`);
const powText = (f) => (f.q === 1 && f.p >= 0 ? String(f.p) : `(${fracText(f)})`);

function constantOf(n, v) {
  if (n.filter((x) => x.type === 'SymbolNode' && x.name === v).length) return null;
  try {
    const y = n.evaluate({});
    return typeof y === 'number' && Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

// { c, base, r } for c·base^r, or null.
function readPower(raw, v) {
  const n = unwrap(raw);
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') {
    const inner = readPower(n.args[0], v);
    return inner && { ...inner, c: -inner.c };
  }
  if (n.type === 'OperatorNode' && n.op === '*' && n.args.length === 2) {
    for (const [k, other] of [[0, 1], [1, 0]]) {
      const c = constantOf(n.args[k], v);
      if (c !== null) {
        const inner = readPower(n.args[other], v);
        return inner && { ...inner, c: c * inner.c };
      }
    }
    return null;
  }
  if (n.type === 'OperatorNode' && n.op === '/') {
    const top = constantOf(n.args[0], v);
    const bottom = constantOf(n.args[1], v);
    if (bottom !== null && bottom !== 0) {
      const inner = readPower(n.args[0], v);
      return inner && { ...inner, c: inner.c / bottom };
    }
    if (top !== null) {
      const inner = readPower(n.args[1], v);
      return inner && inner.c !== 0 && { base: inner.base, r: -inner.r, c: top / inner.c };
    }
    return null;
  }
  if (n.type === 'OperatorNode' && n.op === '^') {
    const r = constantOf(n.args[1], v);
    return r === null ? null : { c: 1, base: unwrap(n.args[0]), r };
  }
  if (n.type === 'FunctionNode' && n.args.length === 1 && (n.fn.name === 'sqrt' || n.fn.name === 'cbrt')) {
    return { c: 1, base: unwrap(n.args[0]), r: n.fn.name === 'sqrt' ? 1 / 2 : 1 / 3 };
  }
  return null;
}

export function integrateLinearPower(term, variable) {
  const v = variable;
  let tree;
  try { tree = math.parse(term); } catch { return null; }
  const power = readPower(tree, v);
  // Any power but −1 (a logarithm), 0 and 1 (nothing to substitute):
  // (2x + 1)^5 was answered expanded, x·(16/3·x^5 + 16x^4 + …), in 1.8 s.
  if (!power || power.r === -1 || power.r === 0 || power.r === 1) return null;
  const lin = linearCoefficients(power.base.toString(), v);
  if (!lin || lin.k === 0 || (lin.k === 1 && lin.d === 0)) return null;
  const a = fraction(lin.k);
  const r = fraction(power.r);
  const R = fraction(power.r + 1);
  const k = fraction(power.c / (lin.k * (power.r + 1)));
  const cf = fraction(power.c);
  if (!a || !r || !R || !k || !cf) return null;
  const B = beautify(power.base.toString());
  // Explicit products for Algebrite, which reads "2x" as a symbol.
  const base = power.base.toString({ implicit: 'show' });
  const kAlg = k.p === k.q ? '' : k.p === -k.q ? '-' : `${fracText(k)}*`;
  // A negative power is written as a fraction: −1/(3(3x + 2)), not
  // −1/3·(3x + 2)^−1.
  const over = (inside) => {
    const m = { p: -R.p, q: R.q };
    const pow = m.p === m.q ? '' : `^${powText(m)}`;
    const top = k.p;
    return Math.abs(k.q) === 1 ? `${top}/(${inside})${pow}` : `${top}/(${k.q}*(${inside})${pow})`;
  };
  const antiderivative = R.p < 0 ? over(base) : `${kAlg}(${base})^${powText(R)}`;
  if (!derivativeMatchesNumerically(antiderivative, term, v)) return null;
  // The inside as typed: (1 - x)^(4/3), not (-x + 1)^(4/3).
  const shownOver = () => {
    const m = { p: -R.p, q: R.q };
    const pow = m.p === m.q ? '' : `^${powText(m)}`;
    return Math.abs(k.q) === 1 ? `${k.p}/(${B})${pow}` : `${k.p}/(${k.q}(${B})${pow})`;
  };
  const shown = R.p < 0 ? shownOver() : `${kAlg}(${B})^${powText(R)}`;
  const aText = fracText(a);
  const cShown = cf.p === cf.q ? '' : cf.p === -cf.q ? '-' : `${fracText(cf)}·`;
  const kShown = k.p === k.q ? '' : k.p === -k.q ? '-' : `${fracText(k)}·`;
  return {
    antiderivative,
    steps: [
      `The inside ${mark(B)} is linear, so its derivative is a constant. Let ${mark(`u = ${B}`)}. Then ${mark(`du = ${aText === '1' ? '' : `${aText} `}d${v}`)}${aText === '1' ? '' : `, so ${mark(`d${v} = du/${aText}`)}`}.`,
      `Rewrite in ${mark('u')}: ${mark(`∫${cShown}u^${powText(r)}${aText === '1' ? '' : `/${aText}`} du`)}.`,
      `Power rule in ${mark('u')}: ${mark(`∫u^${powText(r)} du = u^${powText(R)}/${powText(R)}`)}, so the integral is ${mark(`${kShown}u^${powText(R)}`)}.`,
      `Substitute back ${mark(`u = ${B}`)}: ${mark(shown)}.`,
      `Check by differentiating: ${mark(`d/d${v}[${shown}] = ${beautify(term)}`)} ✓`,
    ],
  };
}
