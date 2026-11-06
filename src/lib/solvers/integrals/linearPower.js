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

// A polynomial times a root of a linear inside, P(x)·(ax + b)^r with r not a
// whole number: x·√(x + 1), x²/√(1 − x), x·∛(x + 2) (1.69.1). By u = ax + b
// the polynomial becomes one in u, x = (u − b)/a, and every term is a power
// of u: ∫x·√(x + 1) dx = ∫(u − 1)·u^(1/2) du = 2/5·(x + 1)^(5/2) −
// 2/3·(x + 1)^(3/2). Algebrite answered it as 2/5·(x − 2/3)·√(x³ + 3x² + 3x +
// 1), the cube expanded under the root, and refused x·(2x + 1)^(3/2) and
// x·∛(x + 2). Exact fractions throughout; checked by differentiating.
import { createMath } from '../../mathInstance.js';
import { readPolynomial } from '../polynomialRoots.js';

let exactMath = null;
const ex = () => { if (!exactMath) exactMath = createMath({ number: 'Fraction' }); return exactMath; };
const toF = (x) => { const f = fraction(x); return f ? ex().fraction(f.p, f.q) : null; };
const pq = (F) => ({ p: Number(F.s * F.n), q: Number(F.d) });
// "2/5·", "−", "" — a coefficient in front of a body, the sign handled by the caller.
const coefShown = (F) => { const a = F.abs(); return a.equals(1) ? '' : `${a.toFraction()}·`; };
const coefRaw = (F) => { const a = F.abs(); return a.equals(1) ? '' : `${a.toFraction()}*`; };

// Numerator and denominator factors of a product/quotient, with its sign.
function factorsOf(raw, inDen, out) {
  const n = unwrap(raw);
  if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { out.sign = -out.sign; return factorsOf(n.args[0], inDen, out); }
  if (n.type === 'OperatorNode' && n.op === '*') { n.args.forEach((a) => factorsOf(a, inDen, out)); return out; }
  if (n.type === 'OperatorNode' && n.op === '/') { factorsOf(n.args[0], inDen, out); factorsOf(n.args[1], !inDen, out); return out; }
  out.list.push({ node: n, inDen });
  return out;
}

// Σ c·u^e as text, highest power first: "2/5·u^(5/2) − 2/3·u^(3/2)".
function sumShown(terms, body) {
  return terms.map(({ c, e }, i) => {
    const sign = c.s < 0 ? (i === 0 ? '−' : ' − ') : (i === 0 ? '' : ' + ');
    return `${sign}${coefShown(c)}${body(e)}`;
  }).join('');
}

export function integratePolynomialTimesLinearPower(term, variable) {
  const v = variable;
  let tree;
  try { tree = math.parse(term); } catch { return null; }
  const { list, sign } = factorsOf(tree, false, { list: [], sign: 1 });
  let K = ex().fraction(sign);
  const polys = [];
  let power = null;
  for (const { node, inDen } of list) {
    const c = constantOf(node, v);
    if (c !== null) {
      const f = toF(c);
      if (!f || f.equals(0)) return null;
      K = inDen ? K.div(f) : K.mul(f);
      continue;
    }
    const p = readPower(node, v);
    const lin = p && linearCoefficients(p.base.toString(), v);
    const r = p && fraction(p.r);
    if (p && lin && lin.k !== 0 && lin.d !== 0 && r && r.q > 1) {
      if (power) return null;
      const cf = toF(p.c);
      if (!cf) return null;
      K = inDen ? K.div(cf) : K.mul(cf);
      power = { base: p.base, r: ex().fraction(inDen ? -r.p : r.p, r.q), lin };
      continue;
    }
    if (inDen) return null;
    polys.push(node.toString({ implicit: 'show' }));
  }
  if (!power || polys.length === 0) return null;
  const P = readPolynomial(polys.map((t) => `(${t})`).join('*'), v);
  if (!P || P.tooHigh || P.degree < 1 || P.degree > 6) return null;
  const a = toF(power.lin.k);
  const b = toF(power.lin.d);
  if (!a || !b) return null;
  const pCoeffs = P.coefficients.map((c) => ex().fraction(c.toFraction()));

  // P((u − b)/a) as coefficients in u, lowest first.
  const xInU = [b.neg().div(a), ex().fraction(1).div(a)];
  let q = [ex().fraction(0)];
  let powerOfX = [ex().fraction(1)];
  for (const c of pCoeffs) {
    q = Array.from({ length: Math.max(q.length, powerOfX.length) }, (_, i) => (q[i] || ex().fraction(0)).add((powerOfX[i] || ex().fraction(0)).mul(c)));
    const next = Array.from({ length: powerOfX.length + 1 }, () => ex().fraction(0));
    powerOfX.forEach((pc, i) => { next[i] = next[i].add(pc.mul(xInU[0])); next[i + 1] = next[i + 1].add(pc.mul(xInU[1])); });
    powerOfX = next;
  }
  const scale = K.div(a); // dx = du/a
  const integrand = []; // c·u^(j + r)
  const integrated = []; // c/(j + r + 1)·u^(j + r + 1)
  q.forEach((c, j) => {
    if (c.equals(0)) return;
    const coef = c.mul(scale);
    const e = power.r.add(j);
    const e1 = e.add(1);
    integrand.push({ c: coef, e });
    integrated.push({ c: coef.div(e1), e: e1 });
  });
  if (integrated.length === 0) return null;
  integrand.reverse();
  integrated.reverse();

  const B = beautify(power.base.toString());
  const baseRaw = power.base.toString({ implicit: 'show' });
  const uPow = (e) => `u^${powText(pq(e))}`;
  // A negative power is written as a fraction: −2/√(x + 1), not −2·(x + 1)^(−1/2).
  const termRaw = ({ c, e }, i) => {
    const sgn = c.s < 0 ? (i === 0 ? '-' : ' - ') : (i === 0 ? '' : ' + ');
    if (e.s > 0) return `${sgn}${coefRaw(c)}(${baseRaw})^${powText(pq(e))}`;
    const { p: num, q: den } = pq(c.abs());
    const pw = `(${baseRaw})^${powText(pq(e.neg()))}`;
    return `${sgn}${num}/${den === 1 ? pw : `(${den}*${pw})`}`;
  };
  const powerOfB = (e) => (e.equals(ex().fraction(1, 2)) ? `√(${B})` : `(${B})^${powText(pq(e))}`);
  const termShown = ({ c, e }, i) => {
    const sgn = c.s < 0 ? (i === 0 ? '−' : ' − ') : (i === 0 ? '' : ' + ');
    if (e.s > 0) return `${sgn}${coefShown(c)}${powerOfB(e)}`;
    const { p: num, q: den } = pq(c.abs());
    return `${sgn}${num}/${den === 1 ? powerOfB(e.neg()) : `(${den}${powerOfB(e.neg())})`}`;
  };
  const antiderivative = integrated.map(termRaw).join('');
  if (!derivativeMatchesNumerically(antiderivative, term, v)) return null;
  const shown = integrated.map(termShown).join('');

  const minus = (t) => t.replace(/^-/, '−');
  const aText = minus(a.toFraction());
  const bAbs = b.abs().toFraction();
  // x = (u − b)/a, as a textbook writes it: u − 1, 1 − u, (u − 1)/2, (3 − u)/2.
  const xText = (() => {
    const top = a.s > 0 ? `u ${b.s > 0 ? '−' : '+'} ${bAbs}` : `${minus(b.toFraction())} − u`;
    const den = a.abs();
    return den.equals(1) ? top : `(${top})/${den.toFraction()}`;
  })();
  // du = a dx: "du = 2 dx, so dx = du/2"; "du = −dx, so dx = −du".
  const duText = a.equals(1) ? mark(`du = d${v}`)
    : a.equals(-1) ? `${mark(`du = −d${v}`)}, so ${mark(`d${v} = −du`)}`
      : `${mark(`du = ${aText} d${v}`)}, so ${mark(`d${v} = du/${a.s < 0 ? `(${aText})` : aText}`)}`;
  const inverseA = minus(ex().fraction(1).div(a).toFraction());
  const qShown = (() => {
    const scaled = q.map((c, j) => ({ c: c.mul(scale), e: j })).filter((t) => !t.c.equals(0)).reverse();
    const body = sumShown(scaled, (e) => (e === 0 ? '1' : e === 1 ? 'u' : `u^${e}`)).replace(/·1$|(?<=^|[ −+])1(?=$)/, (m) => (m === '·1' ? '' : '1'));
    return scaled.length === 1 && !/[ ]/.test(body) ? body : `(${body})`;
  })();
  return {
    antiderivative,
    shown,
    steps: [
      `The root's inside ${mark(B)} is linear, so substitute for it: let ${mark(`u = ${B}`)}. Then ${duText}, and the rest of the integrand is written in ${mark('u')} too: ${mark(`${v} = ${xText}`)}.`,
      `Rewrite in ${mark('u')}: ${mark(`∫${beautify(term)} d${v} = ∫${qShown}·${uPow(power.r)} du`)}${a.equals(1) ? '' : ` (the factor ${mark(inverseA)} from ${mark(`d${v}`)} included)`}.`,
      `Multiply out, so each term is a single power of ${mark('u')}: ${mark(`∫(${sumShown(integrand, uPow)}) du`)}.`,
      `Power rule on each term, ${mark('∫u^n du = u^(n+1)/(n + 1)')}: ${mark(sumShown(integrated, uPow))}.`,
      `Substitute back ${mark(`u = ${B}`)}: ${mark(shown)}.`,
      `Check by differentiating: ${mark(`d/d${v}[${shown}] = ${beautify(term)}`)} ✓`,
    ],
  };
}
