// Polynomial equations: the Rational Root Theorem with synthetic division,
// Algebrite's roots checked for completeness against the degree, and the
// exact root finder (polynomialRoots.js) past Algebrite's limit.

import { unsupported } from '../../solutionEnvelope.js';
import {
  readPolynomial,
  allRoots,
  valueAtDecimal,
  factorByRationalRoots,
  MAX_POLYNOMIAL_DEGREE,
} from '../polynomialRoots.js';
import { getSettings } from '../../settings.js';
import { math, loadAlgebrite, beautify, exactForm, decimalsAsFractions, formatNumber, mark } from '../solverUtils.js';
import {
  rootsViaComplexEvaluate,
  parseRootsList,
  formatSolutions,
  prettyRadicals,
  formatComplexRoot,
  cleanNumber,
  splitRootsList,
  IMAGINARY,
} from './rootsFormat.js';
import { quadraticDerivation } from './radicals.js';
import { exactSurdRoots, isqrt } from './surdRoots.js';

// A known function name that is NOT followed by an argument list — "sin^2*x",
// "ln + 3". Always a mis-read, never mathematics a solver should act on.
const BARE_FUNCTION_NAME = /(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp)(?![a-z])\s*(?!\()/i;

// A polynomial in v whose coefficients are numbers: read off the parse tree,
// since a cubic in form only (e^x)^3 must not be taken for one.
function isPolynomial(node, v) {
  const check = (n) => isPolynomial(n, v);
  const mentions = (n) => n.filter((t) => t.isSymbolNode && t.name === v).length > 0;
  switch (node.type) {
    case 'ConstantNode': return true;
    case 'SymbolNode': return node.name === v || node.name === 'pi' || node.name === 'e';
    case 'ParenthesisNode': return check(node.content);
    case 'FunctionNode': return node.name === 'sqrt' && !mentions(node) && node.args.every(check);
    case 'OperatorNode':
      if (['+', '-', '*'].includes(node.op)) return node.args.every(check);
      if (node.op === '/') return !mentions(node.args[1]) && node.args.every(check);
      if (node.op === '^') {
        if (!mentions(node)) return node.args.every(check);
        try {
          const power = node.args[1].evaluate();
          return Number.isInteger(power) && power >= 0 && check(node.args[0]);
        } catch { return false; }
      }
      return false;
    default: return false;
  }
}

// Three roots from the discriminant and the cubic formula in numbers: how many
// are real is read off the sign of Δ, so a repeated root (Δ ≈ 0, where rounding
// decides) goes back to the exact route.
function irrationalCubic(Algebrite, target, v, clearingSteps, sides) {
  try {
    if (!isPolynomial(math.parse(target), v)) return null;
    if (String(Algebrite.run(`deg(${target}, ${v})`)).trim() !== '3') return null;
    const [d, c, b, a] = [0, 1, 2, 3].map((k) => Number(math.evaluate(String(Algebrite.run(`coeff(${target}, ${v}, ${k})`)).trim())));
    if (![a, b, c, d].every(Number.isFinite) || a === 0) return null;
    const delta = 18 * a * b * c * d - 4 * b ** 3 * d + b ** 2 * c ** 2 - 4 * a * c ** 3 - 27 * a ** 2 * d ** 2;
    const scale = 1 + Math.abs(18 * a * b * c * d) + 4 * Math.abs(b ** 3 * d) + (b * c) ** 2 + 4 * Math.abs(a * c ** 3) + 27 * (a * d) ** 2;
    if (Math.abs(delta) < 1e-9 * scale) return null;
    const roots = math.polynomialRoot(d, c, b, a);
    const reals = roots.map((r) => (typeof r === 'number' ? r : r.re)).filter((_, i) => typeof roots[i] === 'number' || Math.abs(roots[i].im) < 1e-9 * (1 + Math.abs(roots[i].re)));
    if (reals.length !== (delta > 0 ? 3 : 1)) return null;
    const value = (x) => ((a * x + b) * x + c) * x + d;
    const size = (x) => Math.abs(a * x ** 3) + Math.abs(b * x * x) + Math.abs(c * x) + Math.abs(d);
    if (reals.some((x) => !(Math.abs(value(x)) <= 1e-9 * (1 + size(x))))) return null;
    const complex = roots.filter((r) => typeof r !== 'number' && Math.abs(r.im) >= 1e-9 * (1 + Math.abs(r.re))).sort((p, q) => p.im - q.im);
    // Each complex root substituted back as well: a pair comes from the same formula.
    const times = ([p, q], [r, s]) => [p * r - q * s, p * s + q * r];
    const atComplex = (z) => [b, c, d].reduce(([re, im], k) => { const [x, y] = times([re, im], [z.re, z.im]); return [x + k, y]; }, [a, 0]);
    if (complex.length !== 3 - reals.length || complex.some((z) => !(Math.hypot(...atComplex(z)) <= 1e-9 * (1 + size(Math.hypot(z.re, z.im)))))) return null;
    const shownReal = [...reals].sort((p, q) => p - q).map((x) => `${v} ≈ ${formatNumber(x)}`);
    const shownComplex = complex.map((z) => `${v} ≈ ${formatComplexRoot(z).display}`);
    return {
      steps: [
        ...clearingSteps,
        `${mark(sides.map(exactForm).join(' = '))} is a cubic with ${mark('π')}, ${mark('e')} or a square root in its coefficients. Its exact roots are Cardano's formula written out, too long to be of use, so they are given as decimals.`,
        `The discriminant is ${mark(`Δ ≈ ${formatNumber(delta)}`)}: ${delta > 0 ? `positive, so there are three distinct real roots.` : `negative, so there is one real root and a pair of complex ones.`}`,
        `Solution: ${[...shownReal, ...shownComplex].map((t) => mark(t)).join(' or ')}`,
      ],
      answer: [...shownReal, ...shownComplex].join('  or  '),
      solutions: [...reals].sort((p, q) => p - q),
    };
  } catch { return null; }
}

// Is this root's written form at odds with its value? (−40 + π²)^(1/2) has no
// i and is complex; i·(−3 − 2√2)^(1/2) has one and is real. An imaginary part
// that is only rounding noise counts as real.
export function writtenFormMisleads(text) {
  let value;
  try { value = math.evaluate(text); } catch { return false; }
  const real = typeof value === 'number' || (value && Math.abs(value.im) < 1e-9 * (1 + Math.abs(value.re)));
  return Boolean(real) === IMAGINARY.test(text);
}

// The roots with each misleading one as a decimal: always ≈, since it is
// rounded, reals first and each conjugate pair together. A root is repeated
// only when `multiplicity` says so: two different roots that round alike are
// not one root, so that is null, never a merge.
export function groupRootLines(written, misleads, roots, variable, multiplicity) {
  const lines = [...new Set(written)].map((text) => {
    const i = written.indexOf(text);
    const count = multiplicity.get(text) ?? written.filter((t) => t === text).length;
    const tail = count > 1 ? ` (multiplicity ${count})` : '';
    if (!misleads[i]) return { line: `${formatSolutions([roots[i]], variable)}${tail}`, re: roots[i].numeric, im: 0 };
    const shown = formatComplexRoot(math.evaluate(text));
    return { line: `${variable} ≈ ${shown.display}${tail}`, re: shown.numeric, im: shown.im };
  });
  if (new Set(lines.map((l) => l.line)).size !== lines.length) return null;
  lines.sort((p, q) => (Math.abs(p.im) > 0) - (Math.abs(q.im) > 0) || (p.re - q.re) || (p.im - q.im));
  return lines.map((l) => l.line).join('  or  ');
}

// The most distinct roots a list may have and still be shown as decimals.
export const MAX_DECIMAL_ROOTS = 8;

// Which written roots mislead: a form at odds with its value (`hides`), or one
// too long to be of use (`tooLong`).
export function misleadingForms(written) {
  const hides = written.map(writtenFormMisleads);
  const tooLong = written.map((t) => t.length > 60);
  return { hides, tooLong, misleads: written.map((_, i) => hides[i] || tooLong[i]) };
}

// The answer for Algebrite's root list when no exact a + b√n form was found
// (`rootsRaw` is its list, `asWritten` the answer from it as it stands): each
// misleading root as a decimal while there are at most MAX_DECIMAL_ROOTS of
// them; past that, a form that hides real or complex is refused, never shown.
export function rootListAnswer(rootsRaw, variable, multiplicity, asWritten) {
  const written = splitRootsList(rootsRaw).map((t) => t.trim());
  const { hides, misleads } = misleadingForms(written);
  if (misleads.some(Boolean) && new Set(written).size <= MAX_DECIMAL_ROOTS) {
    const decimals = groupRootLines(written, misleads, parseRootsList(rootsRaw), variable, multiplicity);
    return decimals === null
      ? { refuse: 'Two different roots round to the same decimal, so they cannot be shown apart. This is a limitation of the solver.' }
      : { answer: decimals };
  }
  if (hides.some(Boolean)) {
    return { refuse: 'The exact form of these roots hides whether they are real or complex, and there are too many to list as decimals. This is a limitation of the solver.' };
  }
  return { answer: asWritten };
}

// How many times each listed root counts, summing to the degree: from the list
// when it repeats them, else from the exact value of each derivative at the
// root. Null when that cannot reach the degree.
export function provenMultiplicities(Algebrite, target, v, written) {
  const degree = Number(String(Algebrite.run(`deg(${target}, ${v})`)).trim());
  const listed = [...new Set(written)];
  const counts = new Map(listed.map((t) => [t, written.filter((w) => w === t).length]));
  if (written.length >= degree) return counts;
  if (!Number.isInteger(degree) || degree > 12) return null;
  const proven = new Map();
  for (const root of listed) {
    let m = 0;
    let derivative = target;
    while (m < degree) {
      let value;
      try { value = String(Algebrite.run(`simplify(subst((${root}), ${v}, ${derivative}))`)).trim(); } catch { break; }
      if (value !== '0') break;
      m += 1;
      derivative = `d(${derivative}, ${v})`;
    }
    proven.set(root, Math.max(m, 1));
  }
  return [...proven.values()].reduce((sum, m) => sum + m, 0) === degree ? proven : null;
}

// Four roots of a quartic, accounted for as a set: four of them, none too close
// to tell apart, complex ones in conjugate pairs, and multiplied back together
// they give the polynomial. `coefficients` are highest power first. Each root
// balancing on its own would not show that none was missed or counted twice.
export function checkedQuarticRoots(coefficients, roots) {
  if (roots.length !== 4 || !roots.every((r) => Number.isFinite(r.re) && Number.isFinite(r.im))) return null;
  const clean = roots.map((r) => (Math.abs(r.im) < 1e-9 * (1 + Math.abs(r.re)) ? { re: r.re, im: 0 } : r));
  const span = 1 + Math.max(...clean.map((r) => Math.hypot(r.re, r.im)));
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      if (Math.hypot(clean[i].re - clean[j].re, clean[i].im - clean[j].im) < 1e-5 * span) return null;
    }
  }
  const above = clean.filter((r) => r.im > 0);
  const below = clean.filter((r) => r.im < 0);
  if (above.length !== below.length) return null;
  if (!above.every((u) => below.some((w) => Math.hypot(u.re - w.re, u.im + w.im) < 1e-7 * span))) return null;
  // Expand (x − r₁)(x − r₂)(x − r₃)(x − r₄), and its size with every sign taken
  // positive, which is what rounding is relative to.
  let product = [{ re: 1, im: 0 }];
  let size = [1];
  for (const r of clean) {
    const next = Array.from({ length: product.length + 1 }, () => ({ re: 0, im: 0 }));
    product.forEach((c, k) => {
      next[k].re += c.re;
      next[k].im += c.im;
      next[k + 1].re -= c.re * r.re - c.im * r.im;
      next[k + 1].im -= c.re * r.im + c.im * r.re;
    });
    const modulus = Math.hypot(r.re, r.im);
    size = Array.from({ length: size.length + 1 }, (_, k) => (size[k] ?? 0) + (k > 0 ? size[k - 1] * modulus : 0));
    product = next;
  }
  const lead = coefficients[0];
  const agrees = coefficients.every((c, k) => Math.hypot(product[k].re - c / lead, product[k].im) <= 1e-9 * (1 + Math.abs(c / lead) + size[k]));
  return agrees ? clean : null;
}

// Durand–Kerner in plain numbers, for a quartic whose coefficients are not
// fractions. Highest power first.
function quarticRootsNumeric(coefficients) {
  const monic = coefficients.map((c) => c / coefficients[0]);
  const radius = 1 + Math.max(...monic.slice(1).map(Math.abs));
  let z = [0, 1, 2, 3].map((k) => ({ re: radius * Math.cos(0.4 + k * 1.57), im: radius * Math.sin(0.4 + k * 1.57) }));
  const times = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const over = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
  for (let step = 0; step < 2000; step += 1) {
    let moved = 0;
    z = z.map((r, i) => {
      const value = monic.reduce((sum, c) => { const t = times(sum, r); return { re: t.re + c, im: t.im }; }, { re: 0, im: 0 });
      const below = z.reduce((p, w, j) => (j === i ? p : times(p, { re: r.re - w.re, im: r.im - w.im })), { re: 1, im: 0 });
      const delta = over(value, below);
      moved = Math.max(moved, Math.hypot(delta.re, delta.im));
      return { re: r.re - delta.re, im: r.im - delta.im };
    });
    if (moved < 1e-15 * radius) break;
  }
  return z;
}

function isQuarticPolynomial(Algebrite, target, v) {
  try { return isPolynomial(math.parse(target), v) && String(Algebrite.run(`deg(${target}, ${v})`)).trim() === '4'; } catch { return false; }
}

// A quartic with a repeated root in a + b√n: proven there, without roots().
function exactRepeatedQuartic(target, v, clearingSteps) {
  const exact = /(?<![a-z])sqrt\(|\^\(1\/2\)/.test(target) ? exactSurdRoots(target, v) : null;
  if (!exact || exact.roots.reduce((sum, r) => sum + r.multiplicity, 0) !== 4) return null;
  const line = (r) => `${v} = ${r.text}${r.multiplicity > 1 ? ` (repeated root, multiplicity ${r.multiplicity})` : ''}`;
  return {
    steps: [...clearingSteps, ...exact.steps, `Solution: ${exact.roots.map((r) => `${mark(`${v} = ${r.text}`)}${r.multiplicity > 1 ? ` (repeated root, multiplicity ${r.multiplicity})` : ''}`).join(' or ')}`],
    answer: exact.roots.map(line).join('  or  '),
    solutions: exact.roots.map((r) => r.value),
  };
}

// A written-out quartic with π, e or a square root: Algebrite spent seconds on
// Ferrari's formula, which nobody could read. A factored form, or x⁴ + π with
// no x or x³ term, stays with Algebrite: its exact answer is short and quick.
function irrationalQuartic(Algebrite, target, v, clearingSteps, sides, equation) {
  try {
    if (!isPolynomial(math.parse(target), v)) return null;
    let top = math.parse(sides[0]);
    while (top.type === 'ParenthesisNode') top = top.content;
    if (!(top.type === 'OperatorNode' && (top.op === '+' || top.op === '-') && top.args.length === 2)) return null;
    if (String(Algebrite.run(`deg(${target}, ${v})`)).trim() !== '4') return null;
    const coefficients = [4, 3, 2, 1, 0].map((k) => Number(math.evaluate(String(Algebrite.run(`coeff(${target}, ${v}, ${k})`)).trim())));
    if (!coefficients.every(Number.isFinite) || (coefficients[1] === 0 && coefficients[3] === 0)) return null;
    const checked = checkedQuarticRoots(coefficients, quarticRootsNumeric(coefficients));
    if (!checked) return null;
    if (!rootsBalance(`[${checked.map((r) => `(${r.re})+(${r.im})*i`).join(',')}]`, target, v, equation)) return null;
    const sorted = [...checked].sort((p, q) => (p.im !== 0) - (q.im !== 0) || p.re - q.re || p.im - q.im);
    const shown = sorted.map((r) => `${v} ≈ ${formatComplexRoot(r).display}`);
    return {
      steps: [
        ...clearingSteps,
        `${mark(sides.map(exactForm).join(' = '))} is a quartic with ${mark('π')}, ${mark('e')} or a square root in its coefficients. Its exact roots are too long to be of use, so they are found numerically.`,
        'All four roots are accounted for: multiplied back together they give the polynomial, each one balances the equation, and complex roots come in conjugate pairs.',
        `Solution: ${shown.map((t) => mark(t)).join(' or ')}`,
      ],
      answer: shown.join('  or  '),
      solutions: sorted.filter((r) => r.im === 0).map((r) => r.re),
    };
  } catch { return null; }
}

// A quadratic whose coefficients run past 10^9. A common factor is divided out
// and the small equation solved as usual; failing that, the formula in exact
// integers. Null for anything smaller.
async function largeQuadratic(read, target, variable, equation, clearingSteps) {
  const parts = read.coefficients.map((c) => ({ m: BigInt(c.s) * BigInt(c.n), d: BigInt(c.d) }));
  const bgcd = (p, q) => (q === 0n ? (p < 0n ? -p : p) : bgcd(q, p % q));
  const common = parts.reduce((l, c) => (l * c.d) / bgcd(l, c.d), 1n);
  let [C, B, A] = parts.map((c) => (c.m * common) / c.d);
  const limit = 1000000000n;
  const size = (x) => (x < 0n ? -x : x);
  if (![A, B, C].some((x) => size(x) >= limit)) return null;
  const g = bgcd(bgcd(A, B), C);
  [A, B, C] = [A / g, B / g, C / g];
  if (A < 0n) [A, B, C] = [-A, -B, -C];
  const shown = `${A === 1n ? '' : `${A}*`}x^2${B === 0n ? '' : ` ${B < 0n ? '-' : '+'} ${size(B) === 1n ? '' : `${size(B)}*`}x`}${C === 0n ? '' : ` ${C < 0n ? '-' : '+'} ${size(C)}`}`.replace(/x/g, variable);
  if (![A, B, C].some((x) => size(x) >= limit)) {
    const small = await solveWithAlgebriteRoots(`${shown} = 0`, variable);
    if (!small || small.envelope) return null;
    return { ...small, steps: [...clearingSteps, `Divide every term by the common factor ${mark(String(g))}: ${mark(`${beautify(shown)} = 0`)}.`, ...small.steps] };
  }
  const D = B * B - 4n * A * C;
  const abs = size(D);
  let [s, t, rest] = [1n, 1n, abs];
  for (let p = 2n; p * p <= rest && p < 200000n; p += 1n) {
    let k = 0;
    while (rest % p === 0n) { rest /= p; k += 1; }
    s *= p ** BigInt(k >> 1);
    if (k % 2) t *= p;
  }
  const leftover = isqrt(rest);
  if (leftover * leftover === rest) s *= leftover;
  else t *= rest;
  const over = (top, bottom) => {
    const k = bgcd(top, bottom) || 1n;
    return `${top / k}${bottom / k === 1n ? '' : `/${bottom / k}`}`;
  };
  const two = 2n * A;
  const unit = D < 0n ? 'i' : '';
  const surd = t === 1n ? '' : `√${t}`;
  const raw = [-1n, 1n].map((sign) => `(${-B} ${sign < 0n ? '-' : '+'} ${s}${t === 1n ? '' : `*${t}^(1/2)`}${D < 0n ? '*i' : ''})/${two}`);
  if (!rootsBalance(`[${raw.join(',')}]`, target, variable, equation)) return null;
  const k = bgcd(bgcd(B, s), two) || 1n;
  const text = (sign) => {
    if (D === 0n) return over(-B, two);
    if (t === 1n && D > 0n) return over(-B + sign * s, two);
    const part = `${s / k === 1n ? '' : s / k}${unit}${surd}`;
    const body = B === 0n ? `${sign < 0n ? '-' : ''}${part}` : `${-B / k} ${sign < 0n ? '-' : '+'} ${part}`;
    return two / k === 1n ? body : B === 0n ? `${body}/${two / k}` : `(${body})/${two / k}`;
  };
  const answer = D === 0n ? `${variable} = ${text(1n)} (repeated root, multiplicity 2)` : `${variable} = ${text(-1n)}  or  ${variable} = ${text(1n)}`;
  return {
    steps: [
      ...clearingSteps,
      `Discriminant: ${mark(`b² − 4ac = ${D}`)}.`,
      `Quadratic formula: ${mark(`${variable} = (−b ± √(b² − 4ac))/(2a)`)}.`,
      `Solution: ${answer}`,
    ],
    answer,
    solutions: D < 0n ? [] : [-1, 1].map((sign) => (-Number(B) + sign * Number(s) * Math.sqrt(Number(t))) / Number(two)).filter((x, i, all) => all.indexOf(x) === i),
  };
}

// The size of a number, real or complex.
const sizeOf = (v) => (typeof v === 'number' ? Math.abs(v) : v && typeof v.re === 'number' ? Math.hypot(v.re, v.im) : NaN);

// How large the written terms of an expression are at a point: rounding is
// relative to them, so a tolerance must follow the coefficients and the root
// together. 10^13·x² − 2·10^13 at √2 misses 0 by 0.004 and is right.
function termSize(node, scope) {
  if (node.type === 'ParenthesisNode') return termSize(node.content, scope);
  if (node.type === 'OperatorNode') {
    if (node.op === '+' || node.op === '-') return node.args.reduce((sum, a) => sum + termSize(a, scope), 0);
    if (node.op === '*') return node.args.reduce((product, a) => product * termSize(a, scope), 1);
    if (node.op === '/') return termSize(node.args[0], scope) / sizeOf(node.args[1].evaluate(scope));
    if (node.op === '^') {
      const power = sizeOf(node.args[1].evaluate(scope));
      if (power > 0 && typeof node.args[1].evaluate(scope) === 'number') return termSize(node.args[0], scope) ** power;
    }
  }
  return sizeOf(node.evaluate(scope));
}

// Do the two sides agree at this value? One that cannot be evaluated is not a
// disproof here: the check for undefined points in solveEquation handles it.
function sidesAgree(left, right, scope) {
  try {
    const miss = sizeOf(math.evaluate(`(${left}) - (${right})`, scope));
    const size = termSize(math.parse(left), scope) + termSize(math.parse(right), scope);
    if (!Number.isFinite(miss) || !Number.isFinite(size)) return true;
    return miss <= 1e-9 * size;
  } catch { return true; }
}

// Does every root Algebrite listed, real or complex, balance the polynomial it
// solved and the equation as typed? A value that cannot be read, or is not a
// number at all (1/0 + √2), fails.
export function rootsBalance(rootsRaw, target, variable, equation = null) {
  for (const text of splitRootsList(rootsRaw)) {
    let value;
    try { value = math.evaluate(text.trim()); } catch { return false; }
    if (!Number.isFinite(sizeOf(value))) return false;
    const scope = { [variable]: value };
    if (!sidesAgree(target, '0', scope)) return false;
    if (equation) {
      const [left, right] = equation.split('=');
      if (right !== undefined && !sidesAgree(left, right, scope)) return false;
    }
  }
  return true;
}

export async function solveWithAlgebriteRoots(equation, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const [left, right] = equation.split('=');
    if (right === undefined) return null;

    // Move everything to one side: (left) - (right) = 0.
    const polynomial = `(${left.trim()}) - (${right.trim()})`;

    // A function name with no argument list is not something Algebrite can be
    // trusted with: a bare name there is applied to its PREVIOUS result, so
    // the "roots" of a mis-parsed `sin^2*x - 1/2` came back as
    // `1/(2*sin([-2,2])^2)` — the last problem's answer, embedded, nesting one
    // level deeper per solve. Nothing well-formed reaches here in that shape
    // (the parser rewrites sin^2(x) to (sin(x))^2), so refuse rather than
    // hand a leaked value to the formatter.
    if (BARE_FUNCTION_NAME.test(polynomial)) return null;

    // A rational equation — the variable in a denominator, as in
    // 1/(x−1) + 1/(x+1) = 1 — used to skip straight to the numeric scan and
    // print −0.4142 for 1 − √2. Clear the denominators first and find the
    // roots of the numerator; solveEquation's extraneous-root check then
    // drops any root that makes an original denominator zero.
    // (September 2026 audit row G06.)
    let target = polynomial;
    const clearingSteps = [];
    if (new RegExp(`/\\s*\\(?[^()]*\\b${variable}\\b`).test(polynomial)) {
      const numerator = String(Algebrite.run(`numerator(rationalize(${polynomial}))`)).trim();
      if (numerator && !/stop|error|nil/i.test(numerator) && new RegExp(`\\b${variable}\\b`).test(numerator)) {
        target = numerator;
        clearingSteps.push(`Multiply through by the denominators to clear the fractions: ${beautify(numerator)} = 0`);
      }
    }

    // Above degree 12 Algebrite's exact forms are not readable (x^50 = 2 came
    // back as 2^(1/50)·cos(π/50)… and was evaluated numerically anyway), and
    // a dense polynomial makes it grind for seconds before it fails
    // (x^41 − x − 1: ten seconds). Go straight to the exact root finder,
    // which also refuses at once above its own limit.
    const read = readPolynomial(target, variable);
    if (read && (read.tooHigh || read.degree > ALGEBRITE_DEGREE_LIMIT)) {
      const exact = rootsViaPolynomialRoot(Algebrite, target, variable, clearingSteps);
      if (exact) return exact;
    }

    // A cubic or higher is worked the way a course does it: the Rational
    // Root Theorem, synthetic division by each root found, then the
    // quadratic that remains — and whatever has no rational root goes to
    // the exact root finder without a call to Algebrite, whose roots() ground
    // for three seconds on an irreducible quintic before giving up.
    // A cubic with π, e or a square root in it: Algebrite's roots() spent
    // about ten seconds writing out Cardano's formula, which nobody could read.
    if (!read) {
      // A decimal beside π or √2: Algebrite floats the whole polynomial and
      // prints "9.901020...", which nothing can read back, and a root was lost.
      try { if (isPolynomial(math.parse(target), variable)) target = decimalsAsFractions(target); } catch { /* not a polynomial */ }
      const cubic = irrationalCubic(Algebrite, target, variable, clearingSteps, [left.trim(), right.trim()]);
      if (cubic) return cubic;
      const quartic = irrationalQuartic(Algebrite, target, variable, clearingSteps, [left.trim(), right.trim()], equation);
      if (quartic) return quartic;
      const repeated = exactRepeatedQuartic(target, variable, clearingSteps);
      if (repeated) return repeated;
    }

    if (read && !read.tooHigh && read.degree >= 3) {
      const leading = [
        ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
        ...clearingSteps,
      ];
      const viaRational = solveByRationalRoots(Algebrite, target, variable, read, leading);
      if (viaRational) return viaRational;
    }

    // Algebrite throws "not factorable" for x^5 − x + 1: every root is
    // still found numerically rather than left to the zero-crossing scan.
    // A quadratic with very large coefficients: Algebrite's roots() factors
    // them, 32 seconds at 10^11, past the page's budget.
    if (read && read.degree === 2) {
      const large = await largeQuadratic(read, target, variable, equation, clearingSteps);
      if (large) return large;
    }

    let rootsRaw;
    try {
      rootsRaw = Algebrite.roots(target, variable).toString();
    } catch {
      // A quartic with irrational coefficients has no other complete route:
      // the numeric scan could miss a root or lose how often one repeats.
      if (!read && isQuarticPolynomial(Algebrite, target, variable)) {
        return { envelope: unsupported({ input: equation, reason: 'The roots of this quartic could not all be accounted for, so none are shown. This is a limitation of the solver.', answer: 'This equation is beyond what this solver can compute' }) };
      }
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    // Algebrite mangles many cubics: rather than a clean real root like x = 2
    // for x^3 - 8, it emits terms like "-2*(-1)^(1/3)", the *principal complex*
    // cube root, which is both unreadable and numerically wrong for the real
    // solution. Detect that signature and recompute the roots numerically from
    // the polynomial's coefficients, which yields clean, correct values.
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) {
      const numericRoots = rootsViaPolynomialRoot(Algebrite, target, variable);
      if (numericRoots && !numericRoots.envelope) return numericRoots;
      // Past the exact reader's degree limit, Algebrite's own list is still
      // usable when it is complete (x^50 = 2): evaluate it below.
      if (numericRoots?.envelope && !rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) return numericRoots;
      // polynomialRoot caps at cubics. For higher degrees (x^4 - 16), evaluate
      // each symbolic root numerically instead — mathjs handles the complex
      // arithmetic — so students see ±2, ±2i, not (-1)^(1/4) soup.
      const evaluated = rootsViaComplexEvaluate(rootsRaw, target, variable);
      if (evaluated) return evaluated;
    }

    // Algebrite can return only the roots it could factor out and say nothing
    // about the rest: for x(x − 1)(x − 2)(x + 3)(7x − 1)(3x − 5) + x it
    // answers [0] and drops the quintic. A degree-n polynomial has n roots
    // counted with multiplicity; if the listed ones fall short, the list is
    // partial and the numeric scan below must answer instead (October 2026).
    if (!rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) {
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    // Every root is substituted back before it is reported: the check
    // shown later only decides whether a line is printed.
    if (!rootsBalance(rootsRaw, target, variable, equation)) {
      return {
        envelope: unsupported({
          input: equation,
          reason: 'A solution this exact method produced did not balance the equation when it was substituted back, so none are shown. This is a limitation of the solver.',
          answer: 'This equation is beyond what this solver can compute',
        }),
      };
    }

    let roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    const refuse = (reason) => ({ envelope: unsupported({ input: equation, reason, answer: 'This equation is beyond what this solver can compute' }) });

    // With irrational coefficients the list can hold a repeated root only
    // once: [pi, -i, i] for (x − π)²(x² + 1). How many times is proven here,
    // and a list that cannot reach the degree is refused.
    const written = splitRootsList(rootsRaw).map((t) => t.trim());
    let multiplicity = new Map();
    if (!read && isPolynomial(math.parse(target), variable)) {
      const proven = provenMultiplicities(Algebrite, target, variable, written);
      if (!proven) return refuse('The exact method did not account for every root of this polynomial, so none are shown. This is a limitation of the solver.');
      multiplicity = proven;
      const listed = [...new Set(written)];
      if (listed.reduce((sum, t) => sum + proven.get(t), 0) > written.length) {
        roots = listed.flatMap((t) => Array(proven.get(t)).fill(roots[written.indexOf(t)]));
      }
    }

    let answer = formatSolutions(roots, variable);
    const { hides, tooLong, misleads } = misleadingForms(written);
    // Worked again in a + b√n when that says it plainly: x = 1 + √2, not a
    // decimal, and not a quotient with a radical below the line.
    const exact = misleads.some(Boolean) || written.some((t) => /\/\(/.test(t)) ? exactSurdRoots(target, variable) : null;
    if (exact) answer = exact.roots.map((r) => `${variable} = ${r.text}${r.multiplicity > 1 ? ` (repeated root, multiplicity ${r.multiplicity})` : ''}`).join('  or  ');
    else {
      const shown = rootListAnswer(rootsRaw, variable, multiplicity, answer);
      if (shown.refuse) return refuse(shown.refuse);
      answer = shown.answer;
    }
    // Algebrite lists a double root once; a quadratic with a single root has
    // it twice, and the answer says so.
    if (roots.length === 1 && !/multiplicity/.test(answer) && String(Algebrite.run(`deg(${target}, ${variable})`)).trim() === '2') {
      answer += ' (repeated root, multiplicity 2)';
    }
    const numericSolutions = roots
      .map((r) => r.numeric)
      .filter((n) => Number.isFinite(n));

    const derivation = quadraticDerivation(Algebrite, target, variable);
    const steps = [
      // Already "… = 0": no rewrite to show.
      ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
      ...clearingSteps,
      ...(derivation || [`Solve for ${variable} by finding the roots.`]),
      ...(exact ? exact.steps : []),
      ...(!exact && hides.some(Boolean) ? ['The exact form hides whether these roots are real or complex, so they are given as decimals.'] : []),
      ...(!exact && !hides.some(Boolean) && tooLong.some(Boolean) ? ['The exact form is too long to be of use, so these roots are given as decimals.'] : []),
      exact
        ? `Solution: ${exact.roots.map((r) => `${mark(`${variable} = ${r.text}`)}${r.multiplicity > 1 ? ` (repeated root, multiplicity ${r.multiplicity})` : ''}`).join(' or ')}`
        : `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: exact ? exact.roots.map((r) => r.value) : numericSolutions };
  } catch (e) {
    return null;
  }
}

/**
 * Every root of a polynomial, for when Algebrite's symbolic output is
 * malformed, partial or missing. polynomialRoots.js reads the polynomial
 * exactly, counts its real roots by Sturm's theorem (so none can be missed,
 * however close together), locates each by exact bisection, and lists the
 * non-real ones only if they verify. Returns { steps, answer, solutions },
 * { envelope } (an honest refusal) past the supported degree, or null when
 * the input is not a polynomial with rational coefficients.
 */
// Past this degree a polynomial equation skips Algebrite (see solveWithAlgebriteRoots).
const ALGEBRITE_DEGREE_LIMIT = 12;

// Highest-first coefficient strings → "x^3 - 6x^2 + 11x - 6".
function polynomialText(coeffs, v) {
  const n = coeffs.length - 1;
  const parts = [];
  coeffs.forEach((c, i) => {
    const text = String(c);
    if (text === '0') return;
    const power = n - i;
    const neg = text.startsWith('-');
    const mag = neg ? text.slice(1) : text;
    const coef = mag === '1' && power > 0 ? '' : mag;
    const term = power === 0 ? mag : `${coef}${v}${power > 1 ? `^${power}` : ''}`;
    parts.push(parts.length === 0 ? `${neg ? '-' : ''}${term}` : `${neg ? '- ' : '+ '}${term}`);
  });
  return parts.length ? parts.join(' ') : '0';
}
const signedList = (items) => items.map((t) => (String(t).startsWith('-') ? `(${t})` : String(t)));

// x³ − 6x² + 11x − 6 = 0, worked: factor out x if the constant term is 0,
// list the Rational Root Theorem candidates, test them by substitution,
// divide synthetically by each root found, and solve what remains — a
// quadratic by the formula (exactly, surds and complex pairs kept), or a
// factor with no rational root by the exact numeric finder. Returns
// { steps, answer, solutions } or null when the shape is not suitable.
function solveByRationalRoots(Algebrite, target, v, read, leadingSteps) {
  const fac = factorByRationalRoots(read);
  if (!fac) return null;
  const steps = [...leadingSteps];
  const shown = []; // { display, numeric, sign }
  const pow = (k) => (k === 1 ? v : `${v}^${k}`);
  const afterX = polynomialText(fac.coefficients, v);
  if (fac.xPower > 0) {
    steps.push(`Every term has a factor of ${pow(fac.xPower)}: factor it out — ${pow(fac.xPower)}·(${afterX}) = 0 — so ${v} = 0 is a root${fac.xPower > 1 ? ` (multiplicity ${fac.xPower})` : ''}, and the other factor is solved on its own.`);
    shown.push({ display: '0', numeric: 0, sign: '=', multiplicity: fac.xPower });
  }
  if (fac.degree >= 3) {
    const name = fac.degree === 3 ? 'a cubic' : fac.degree === 4 ? 'a quartic' : `degree ${fac.degree}`;
    const list = fac.candidates.length > 16 ? `${fac.candidates.slice(0, 16).join(', ')}, …` : fac.candidates.join(', ');
    steps.push(`${mark(`${afterX} = 0`)} is ${name}. Rational Root Theorem: any rational root ${mark('p/q')} has ${mark('p')} dividing the constant term ${mark(fac.constant)} and ${mark('q')} dividing the leading coefficient ${mark(fac.leading)}, so the only possible rational roots are ${mark(list)}.`);
    let currentText = afterX;
    for (const round of fac.rounds) {
      const failed = round.trials.filter((t) => !t.isRoot);
      const shownFailed = failed.slice(0, 5).map((t) => `p(${t.text}) = ${t.value}`);
      const more = failed.length > 5 ? `, … (${failed.length - 5} more fail)` : '';
      const r = round.root.text;
      // (x − r) reads as (x + 3) for r = −3.
      const factorText = r.startsWith('-') ? `(${v} + ${r.slice(1)})` : `(${v} − ${r})`;
      steps.push(`Test the candidates in ${mark(`p(${v}) = ${currentText}`)}: ${shownFailed.length ? `${shownFailed.map(mark).join(', ')}${more}; ` : ''}${mark(`p(${r}) = 0`)} ✓ — so ${mark(`${v} = ${r}`)} is a root and ${mark(factorText)} is a factor.`);
      const work = round.products.map((prod, i) => `${mark(`${signedList([r])[0]}·${signedList([round.bottom[i]])[0]} = ${prod}`)}, then ${mark(`${signedList([round.top[i + 1]])[0]} + ${signedList([prod])[0]} = ${round.bottom[i + 1]}`)}`);
      const quotientText = polynomialText(round.quotient, v);
      steps.push(`Synthetic division by ${mark(factorText)}, using ${mark(`r = ${r}`)}: write the coefficients ${mark(signedList(round.top).join(', '))}; bring down ${mark(round.top[0])}; ${work.join('; ')}. The last number is the remainder, ${mark('0')} ✓, and the rest are the quotient: ${mark(quotientText)}.`);
      shown.push({ display: round.root.text, numeric: Number(round.root.m) / Number(round.root.d), sign: '=' });
      currentText = quotientText;
    }
  }
  // What is left after x^k and the rational roots: solved whatever its
  // degree. Only a remainder of degree 3 or more was solved before, so
  // x^3 - 4x = 0 (x·(x² − 4)) was answered x = 0 alone (October 26).
  const remDegree = fac.remaining.length - 1;
  const remText = polynomialText(fac.remaining.map((f) => (f.d === 1n ? String(f.s * f.n) : `${f.s < 0 ? '-' : ''}${f.n}/${f.d}`)), v);
  if (remDegree === 2) {
    steps.push(`The remaining factor is a quadratic: ${mark(`${remText} = 0`)}.`);
    let rootsRaw = '';
    try { rootsRaw = Algebrite.roots(remText, v).toString(); } catch { rootsRaw = ''; }
    const derivation = quadraticDerivation(Algebrite, remText, v);
    if (derivation) steps.push(...derivation);
    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    // i*√3 reads as i√3.
    const tidy = (d) => prettyRadicals(d).replace(/i\*√/g, 'i√');
    // A double root (zero discriminant) is reported once: it counts twice.
    for (const root of roots) shown.push({ display: tidy(root.display), numeric: root.numeric, sign: '=', multiplicity: roots.length === 1 ? 2 : 1 });
    const names = roots.map((root) => `${v} = ${tidy(root.display)}`).join(' or ');
    steps.push(`So the quadratic gives ${names}.`);
  } else if (remDegree === 1) {
    const [b, c] = fac.remaining;
    const root = c.neg().div(b);
    const rootText = root.d === 1n ? String(root.s * root.n) : `${root.s < 0 ? '-' : ''}${root.n}/${root.d}`;
    steps.push(`The remaining factor is linear: ${remText} = 0, so ${v} = ${rootText}.`);
    shown.push({ display: rootText, numeric: Number(root.valueOf()), sign: '=' });
  } else if (remDegree >= 3) {
    steps.push(`No rational root remains: every candidate fails for ${mark(remText)}. Its roots cannot be written in a closed form here, so they are found numerically.`);
    const numeric = rootsViaPolynomialRoot(Algebrite, `(${remText}) - (0)`, v);
    if (!numeric || numeric.envelope) return null;
    // Its own "degree-n polynomial … Sturm …" steps, minus the solution line.
    steps.push(...numeric.steps.filter((line) => !/^Solution:/.test(line)));
    // The finder's own answer may open with "no real solutions;" when
    // every remaining root is complex — the rational ones already listed
    // are the real solutions, so only its count clause is kept.
    const rest = numeric.answer.replace(/^no real solutions;\s*/, '');
    const sortedShown = mergeRepeated(shown).sort((a, b) => a.numeric - b.numeric);
    const answer = /^plus \d+ complex/.test(rest)
      ? `${sortedShown.map(line).join('  or  ')};  ${rest}`
      : [...sortedShown.map(line), rest].join('  or  ');
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: [...shown.map((r) => r.numeric).filter(Number.isFinite), ...(numeric.solutions || [])] };
  }
  if (shown.length === 0) return null;
  // Real roots in ascending order, then the complex pair(s); a root found
  // twice (x = 2 from two rounds of division) is one root of multiplicity 2.
  const merged = mergeRepeated(shown);
  const reals = merged.filter((r) => Number.isFinite(r.numeric)).sort((a, b) => a.numeric - b.numeric);
  const others = merged.filter((r) => !Number.isFinite(r.numeric));
  const answer = [...reals, ...others].map(line).join('  or  ');
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: reals.map((r) => r.numeric) };

  function line(r) {
    return `${v} ${r.sign} ${r.display}${r.multiplicity > 1 ? ` (multiplicity ${r.multiplicity})` : ''}`;
  }
}

// The same root listed more than once — "x = 2 or x = 2" — is one root with
// its multiplicities added.
function mergeRepeated(shown) {
  const out = [];
  for (const r of shown) {
    const same = out.find((o) => o.display === r.display || (Number.isFinite(o.numeric) && Number.isFinite(r.numeric) && Math.abs(o.numeric - r.numeric) < 1e-12 && o.sign === '=' && r.sign === '='));
    if (same) same.multiplicity = (same.multiplicity || 1) + (r.multiplicity || 1);
    else out.push({ ...r });
  }
  return out;
}

export function rootsViaPolynomialRoot(Algebrite, polynomial, variable, extraSteps = []) {
  const poly = readPolynomial(polynomial, variable);
  if (!poly) return null;
  if (poly.tooHigh) {
    return {
      envelope: unsupported({
        input: polynomial,
        reason: `This polynomial has degree ${poly.degree}. MasterMath finds every root of polynomials up to degree ${MAX_POLYNOMIAL_DEGREE}; past that it cannot guarantee a complete list, so it gives none rather than a partial one.`,
        answer: `Degree ${poly.degree} is above the supported limit (${MAX_POLYNOMIAL_DEGREE}) for a guaranteed-complete list of roots`,
        tips: ['Factor out any common factor first, or check whether the equation simplifies to a lower degree.'],
      }),
    };
  }
  if (poly.degree < 1) return null;
  const { real, complex, complexCount, degree } = allRoots(poly);
  const multiplicity = (m) => (m > 1 ? ` (multiplicity ${m})` : '');
  // A root that is exactly a rational is shown as one ("x = 1/3"); a root
  // only located numerically is marked ≈ — x(x−1)⋯(x−20) + x has a root at
  // 20 − 7×10⁻¹², and "x = 20" would be false (outside review, October 2026).
  const rational = ({ m, d }) => (d === 1n ? String(m) : `${m}/${d}`);
  const realShown = real.map((r) => (r.exact
    ? { display: rational(r.exact), sign: '=', multiplicity: r.multiplicity, numeric: r.value }
    : { display: formatNumber(r.value), sign: '≈', multiplicity: r.multiplicity, numeric: r.value }));
  const gaussian = ({ re, im }) => {
    const rePart = re.m === 0n ? '' : rational(re);
    const imAbs = { m: im.m < 0n ? -im.m : im.m, d: im.d };
    const imPart = `${imAbs.m === 1n && imAbs.d === 1n ? '' : rational(imAbs)}i`;
    return rePart ? `${rePart} ${im.m < 0n ? '-' : '+'} ${imPart}` : `${im.m < 0n ? '-' : ''}${imPart}`;
  };
  const complexShown = (complex || []).map((z) => (z.exact
    ? { display: gaussian(z.exact), sign: '=', multiplicity: z.multiplicity }
    : { ...formatComplexRoot(z), sign: '≈', multiplicity: z.multiplicity }));
  const line = (r) => `${variable} ${r.sign} ${r.display}${multiplicity(r.multiplicity)}`;
  // As formatSolutions: past a handful of complex roots, list the real ones
  // and count the rest — 98 decimal pairs is not an answer anyone can read.
  const listComplex = complex !== null && complexShown.length <= 4 && realShown.length + complexShown.length <= 8;
  let answer;
  if (complexCount === 0 || listComplex) {
    const parts = [...realShown, ...complexShown].map(line);
    if (parts.length === 0) return null;
    answer = parts.join('  or  ');
  } else {
    const realText = realShown.length ? realShown.map(line).join('  or  ') : 'no real solutions';
    answer = `${realText};  plus ${complexCount} complex solutions (not listed)`;
  }
  const realCount = real.reduce((n, r) => n + r.multiplicity, 0);
  const counted = `${real.length === 0 ? 'no' : real.length} distinct real root${real.length === 1 ? '' : 's'}${realCount > real.length ? ` (${realCount} counting multiplicity)` : ''}`;
  // The first approximate root whose decimal display reads as a simple
  // number: say what that number actually gives, so ≈ is not read as =.
  const approxNote = (() => {
    const shown = realShown.find((r) => r.sign === '≈' && /^-?\d+(?:\.\d+)?$/.test(r.display));
    if (!shown) return [];
    const at = valueAtDecimal(poly, shown.display);
    if (!at || at.equals(0)) return [];
    const v = Number(at.valueOf());
    // Small values in scientific notation, so "0.00000012" never rounds to "0".
    const sup = (t) => String(t).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
    const shownValue = Math.abs(v) >= 1e-3 && Math.abs(v) < 1e6
      ? (at.d === 1n ? String(at.s * at.n) : formatNumber(v))
      : v.toExponential(2).replace(/e([+-]?\d+)/, (_, e) => `×10${sup(Number(e))}`);
    return [`Roots marked ≈ were located numerically and are not exactly the number shown: substituting ${mark(`${variable} = ${shown.display}`)} gives ${shownValue}, not 0. The number shown is rounded to ${getSettings().decimalPlaces} decimals; MasterMath located the root itself to within 10⁻¹².`];
  })();
  const steps = [
    ...(/\)\s*-\s*\(0\)$/.test(polynomial) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
    ...extraSteps,
    `This is a degree-${degree} polynomial, so it has exactly ${degree} roots counted with multiplicity. MasterMath cannot write them in exact form, so they are found numerically.`,
    `Real roots: Sturm's theorem counts them exactly — ${counted} — and each is located by bisection to 12 significant digits, so none is missed even when roots lie very close together.${real.some((r) => r.exact) ? ' A root shown with = was confirmed exact by substitution.' : ''}`,
    ...approxNote,
    ...(complexCount === 0 ? [] : [complex === null
      ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real; ${complexCount === 1 ? 'it' : 'they'} could not be computed to a value MasterMath can verify, so only the count is given.`
      : listComplex
        ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real, found by Durand–Kerner iteration and each checked by substitution.`
        : `The remaining ${complexCount} roots are non-real (found by Durand–Kerner iteration and each checked by substitution); that many decimal pairs would not be a readable answer, so they are counted rather than listed.`]),
    `Solution: ${answer}`,
  ];
  return { steps, answer, solutions: real.map((r) => cleanNumber(r.value)) };
}

// Do the listed roots, with their multiplicities, add up to the polynomial's
// degree? A root's multiplicity is the number of successive derivatives that
// vanish there, checked exactly by Algebrite; the degree comes from an exact
// read of the polynomial (polynomialRoots.js), with no cap that silently
// passes a higher degree. Degree ≤ 2 is not checked (Algebrite's quadratic
// roots are complete), nor is anything that is not a polynomial (the other
// paths verify their own answers). A shortfall sends the polynomial to
// rootsViaPolynomialRoot, which finds every root; a multiplicity Algebrite
// cannot simplify to zero is undercounted, which errs the same safe way.
export function rootsAccountForDegree(Algebrite, poly, variable, rootsRaw) {
  const read = readPolynomial(poly, variable);
  if (!read) return true;
  // Past the exact reader's limit the degree is the parse-tree bound — an
  // upper bound, so a list that reaches it is certainly complete
  // (x^100 = 1: all 100 roots of unity).
  const { degree } = read;
  if (degree <= 2) return true;
  const roots = [...new Set(splitRootsList(rootsRaw).map((r) => r.trim()))];
  // As many distinct roots as the degree: complete by counting alone, with no
  // multiplicity to check (a polynomial cannot have more roots than that).
  if (roots.length >= degree) return true;
  let counted = 0;
  for (const r of roots) {
    let multiplicity = 0;
    let derivative = poly;
    while (multiplicity < degree) {
      let value;
      try { value = String(Algebrite.run(`simplify(subst((${r}), ${variable}, ${derivative}))`)).trim(); } catch { break; }
      if (value !== '0') break;
      multiplicity += 1;
      derivative = `d(${derivative}, ${variable})`;
    }
    counted += Math.max(multiplicity, 1);
  }
  return counted >= degree;
}
