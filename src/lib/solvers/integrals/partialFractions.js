// Partial fractions: improper fractions divided first, the denominator
// factored over the rationals by the exact root finder, coefficients solved
// exactly, repeated irreducible quadratics by the reduction formula, and
// c/(x⁴ + a⁴) over √2.

import {
  math,
  beautify,
  hasVariable,
  isAlgebriteFailure,
  lnify,
  splitTopLevel,
  stripOuterParens,
  gcd,
  mark,
} from '../solverUtils.js';
import { derivativeMatchesNumerically } from '../substitutionSolver.js';
import { integrateBySurdPartialFractions } from '../surdPartialFractions.js';
import { readPolynomial, allRoots } from '../polynomialRoots.js';
import { createMath } from '../../mathInstance.js';
import { dropBarsOnPositiveArguments } from './display.js';

// ∫ c/(x⁴ + d) dx for d > 0 with √d an integer s (d = 1, 9, 16, …):
//   x⁴ + d = (x² + r·x + s)(x² − r·x + s),  r = √(2s)
//   c/(x⁴ + d) = c·[(x/(2rs) + 1/(2s))/(x² + rx + s) + (−x/(2rs) + 1/(2s))/(x² − rx + s)]
// and each piece, after completing the square ((x ± r/2)² + s/2), is a
// logarithm plus an arctan (q = √(s/2)):
//   ∫ = c/(4rs)·ln((x² + rx + s)/(x² − rx + s)) + c/(4sq)·[arctan((x + r/2)/q) + arctan((x − r/2)/q)]
// (d = 4 has r = 2 and is already factored over the rationals above; this
// path serves the cases where r is a surd.) Verified by differentiation.
export function integrateQuarticSum(term, v) {
  const t = String(term).replace(/\s+/g, '');
  const m = t.match(new RegExp(`^(-)?(\\d+(?:\\.\\d+)?)?/\\((?:${v}\\^4\\+(\\d+)|(\\d+)\\+${v}\\^4)\\)$`));
  if (!m) return null;
  const c = (m[1] ? -1 : 1) * (m[2] === undefined ? 1 : Number(m[2]));
  const d = Number(m[3] ?? m[4]);
  const s0 = Math.sqrt(d);
  if (!(d > 0) || !Number.isInteger(s0)) return null;
  const twoS = 2 * s0;
  if (Number.isInteger(Math.sqrt(twoS))) return null; // r rational: the rational factoring handles it
  const surd = exactSurd(twoS); // r = s·√t
  if (!surd) return null;
  const rText = `${surd.s === 1 ? '' : surd.s}√${surd.t}`;
  const rRaw = `${surd.s === 1 ? '' : `${surd.s}*`}sqrt(${surd.t})`;
  const halfR = `${rRaw}/2`;
  const q = exactSurd(s0 / 2); // q = √(s/2)
  if (!q) return null;
  const qRaw = q.rational ? `${q.s}/${q.b}` : `${q.s === 1 ? '' : `${q.s}*`}sqrt(${q.t})/${q.b}`;
  const qText = q.rational ? fmtNum(q.s / q.b) : `${q.s === 1 ? '' : q.s}√${q.t}${q.b === 1 ? '' : `/${q.b}`}`;
  const plus = `${v}^2 + ${rRaw}*${v} + ${s0}`;
  const minus = `${v}^2 - ${rRaw}*${v} + ${s0}`;
  const plusText = `${v}² + ${rText}${v} + ${s0}`;
  const minusText = `${v}² − ${rText}${v} + ${s0}`;
  // (x ± r/2)/q = (2x ± r)/r = (2/r)·x ± 1, since 2q = √(2s) = r.
  const twoOverR = exactSurd(4 / twoS); // 2/r as a·√t/b
  if (!twoOverR) return null;
  const slopeRaw = twoOverR.rational ? `${twoOverR.s}/${twoOverR.b}` : `${twoOverR.s === 1 ? '' : `${twoOverR.s}*`}sqrt(${twoOverR.t})${twoOverR.b === 1 ? '' : `/${twoOverR.b}`}`;
  const slopeText = twoOverR.rational ? fmtNum(twoOverR.s / twoOverR.b) : `${twoOverR.s === 1 ? '' : twoOverR.s}√${twoOverR.t}${twoOverR.b === 1 ? '' : `/${twoOverR.b}`}`;
  // c/(4·s·r) and c/(2·s·r) in lowest terms over the surd: 3/(12√6) is 1/(4√6).
  const reduced = (mult) => { const g = gcd(Math.abs(c), mult * s0) || 1; return [c / g, (mult * s0) / g]; };
  const [logN, logD] = reduced(4);
  const [atanN, atanD] = reduced(2);
  const logCoefRaw = `${logN}/(${logD}*${rRaw})`;
  const atanCoefRaw = `${atanN}/(${atanD}*${rRaw})`;
  const F = `${logCoefRaw}*(log(${plus}) - log(${minus})) + ${atanCoefRaw}*(arctan(${slopeRaw}*${v} + 1) + arctan(${slopeRaw}*${v} - 1))`;
  if (!derivativeMatchesNumerically(F, term, v)) return null;
  const cT = c === 1 ? '' : c === -1 ? '−' : `${c}·`;
  const coefText = (mult) => { const [n, dd] = reduced(mult); return `${n}/(${dd === 1 ? '' : dd}${rText})`; };
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — the denominator has no real roots and does not factor over the rationals, but it does over a square root: ${mark(`${v}⁴ + ${d} = (${plusText})(${minusText})`)} (check: the ${mark(`${v}²`)} terms give ${mark(`2·${s0} − (${rText})² = 0`)}).`,
    `Partial fractions with those two irreducible quadratics: ${mark(`${beautify(term)} = ${cT}[(${v}/(2·${rText}${s0 === 1 ? '' : `·${s0}`}) + 1/${s0 === 1 ? '2' : `(2·${s0})`})/(${plusText}) + (−${v}/(2·${rText}${s0 === 1 ? '' : `·${s0}`}) + 1/${s0 === 1 ? '2' : `(2·${s0})`})/(${minusText})]`)}.`,
    `Each piece splits into the derivative of its denominator (a logarithm) and a constant over a completed square (an arctan): ${mark(`${plusText} = (${v} + ${rText}/2)² + ${s0}/2`)}, and the same for the other with ${mark('−')}; the arctan arguments simplify to ${mark(`${slopeText}${v} ± 1`)}.`,
    `So ${mark(`∫(${beautify(term)}) d${v} = ${coefText(4)}·ln((${plusText})/(${minusText})) + ${coefText(2)}·[arctan(${slopeText}${v} + 1) + arctan(${slopeText}${v} − 1)]`)}.`,
  ];
  return { antiderivative: F, steps };
}

// N(x)/D(x) with deg N < deg D and D having distinct real roots r₁…rₖ:
//   N/D = Σ Aᵢ/(x − rᵢ),  Aᵢ = N(rᵢ)/D′(rᵢ)   (Heaviside cover-up)
// so ∫ = Σ Aᵢ·ln|x − rᵢ|. Repeated or complex roots are left to the caller
// (null). Everything is checked: the decomposition numerically, the
// antiderivative by differentiation.
// An improper rational function — the numerator's degree is not below the
// denominator's: (x³ + 2)/((x − 1)(x + 1)²) — is divided first, N/D = Q + R/D
// (Algebrite's quotient, checked numerically), then ∫Q by the power rule and
// R/D by partial fractions. The total is checked by differentiation. Before
// 1.53.1 Algebrite's integral() ground on these for about a minute and gave up.
export function integrateImproperRational(term, v, Algebrite) {
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  const N = readPolynomial(stripOuterParens(num), v);
  const D = readPolynomial(stripOuterParens(den), v);
  if (!N || !D) return null;
  const degree = (P) => { const c = P.coefficients.map((q) => q.n); let d = c.length - 1; while (d > 0 && c[d] === 0n) d -= 1; return d; };
  const degN = degree(N);
  const degD = degree(D);
  if (degD < 1 || degN < degD) return null;
  const run = (e) => { try { const r = String(Algebrite.run(e)).trim(); return r && !isAlgebriteFailure(r) ? r : null; } catch { return null; } };
  const Q = run(`quotient(${num}, ${den}, ${v})`);
  if (!Q) return null;
  const R = run(`expand((${num}) - (${Q})*(${den}))`);
  if (R === null) return null;
  for (const x of [0.31, 1.73, -2.41, 3.37]) {
    let l; let r;
    try { l = math.evaluate(`(${num})/(${den})`, { [v]: x }); r = math.evaluate(`(${Q}) + (${R})/(${den})`, { [v]: x }); } catch { return null; }
    if (Number.isFinite(l) && Number.isFinite(r) && Math.abs(l - r) > 1e-8 * (1 + Math.abs(l))) return null;
  }
  const antiQ = run(`integral(${Q}, ${v})`);
  if (!antiQ) return null;
  const rest = R === '0' ? null : `(${R})/(${den})`;
  let pf = rest ? (integrateByPartialFractions(rest, v, Algebrite) || integrateByGeneralPartialFractions(rest, v, Algebrite) || integrateBySurdPartialFractions(rest, v)) : null;
  // A remainder over a linear denominator (x³/(x − 1) leaves 1/(x − 1)) is
  // one logarithm, no decomposition needed.
  if (rest && !pf && degD === 1) {
    const direct = run(`integral(${rest}, ${v})`);
    if (direct && !/integral\(/.test(direct)) {
      pf = { antiderivative: direct, steps: [`${mark(`∫${beautify(rest)} d${v} = ${lnify(direct)}`)} (${mark('∫1/(a' + v + ' + b) d' + v + ' = (1/a)·ln|a' + v + ' + b|')}).`], linear: true };
    }
  }
  if (rest && !pf) return null;
  const anti = pf ? `${antiQ} + ${pf.antiderivative}` : antiQ;
  // Differentiate back at points where the integrand and the logarithms are real.
  const dnum = (x) => { try { const hh = 1e-5; return (math.evaluate(anti, { [v]: x + hh }) - math.evaluate(anti, { [v]: x - hh })) / (2 * hh); } catch { return NaN; } };
  let checked = 0;
  for (const x of [0.37, 1.13, 2.29, 3.71, 5.17, 7.43].map((d) => d + 4)) {
    let expected; try { expected = math.evaluate(`(${num})/(${den})`, { [v]: x }); } catch { continue; }
    const got = dnum(x);
    if (!Number.isFinite(expected) || !Number.isFinite(got)) continue;
    if (Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
    checked += 1;
  }
  if (checked < 3) return null;
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — the numerator has degree ${mark(String(degN))} and the denominator degree ${mark(String(degD))}, so divide first: ${mark(`${beautify(term)} = ${beautify(Q)}${R === '0' ? '' : ` + (${beautify(R)})/(${beautify(stripOuterParens(den))})`}`)}.`,
    `Integrate the polynomial part: ${mark(`∫(${beautify(Q)}) d${v} = ${lnify(antiQ)}`)}.`,
    ...(pf ? [`Then the proper fraction ${mark(beautify(rest))}${pf.linear ? '' : ' by partial fractions'}:`, ...pf.steps.map((t) => `  ${t}`)] : []),
    `Add the parts: ${mark(lnify(anti))}.`,
  ];
  return { antiderivative: anti, steps };
}

// The denominator as typed, when it is a product of powers of polynomials
// of degree ≤ 2 — (x − 1)^2*(x^2 + 1) — read exactly, so Algebrite's
// factor() and roots() (about 2 s each on (x^2 + 4)^2, which they expand
// to a quartic first) are not needed. Null for any other shape.
function typedFactors(den, v) {
  const out = [];
  // A sum outside all brackets is one factor: x^2+2*x+5 is not x^2+2 times x+5.
  const text = String(den).trim();
  const factorsTyped = hasTopLevelSum(text) ? [text] : splitTopLevel(text, '*').map((t) => t.trim()).filter(Boolean);
  for (const raw of factorsTyped) {
    let f = raw;
    let power = 1;
    const pm = f.match(/^\((.+)\)\^(\d+)$/) || f.match(/^([a-z])\^(\d+)$/i);
    if (pm && matchingParenIndex(f) === f.length - pm[2].length - 2) { f = pm[1]; power = Number(pm[2]); } else if (pm && /^[a-z]$/i.test(pm[1])) { f = pm[1]; power = Number(pm[2]); }
    f = stripOuterParens(f);
    const P = readPolynomial(f, v);
    if (!P) return null;
    const c = P.coefficients.map((q) => Number(q.s) * Number(q.n) / Number(q.d));
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    const deg = c.length - 1;
    if (deg > 2) return null;
    out.push({ deg, c, power });
  }
  return out.length ? out : null;
}
const matchingParenIndex = (s) => { let depth = 0; for (let i = 0; i < s.length; i += 1) { if (s[i] === '(') depth += 1; else if (s[i] === ')') { depth -= 1; if (depth === 0) return i; } } return -1; };

export function integrateByPartialFractions(term, variable, Algebrite) {
  const v = variable;
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  if (!hasVariable(den, v)) return null;
  // A repeated or irreducible-quadratic factor, as typed, is not this
  // routine's case: say so before asking Algebrite for the roots.
  const typed = typedFactors(den, v);
  if (typed && typed.some((f) => (f.deg > 0 && f.power > 1) || (f.deg === 2 && f.c[1] ** 2 - 4 * f.c[2] * f.c[0] < 0))) return null;
  const isPoly = (e) => { try { const d = String(Algebrite.run(`deg(${e}, ${v})`)).trim(); return /^\d+$/.test(d) ? Number(d) : null; } catch { return null; } };
  const degN = isPoly(num);
  const degD = isPoly(den);
  if (degN === null || degD === null || degD < 2 || degN >= degD) return null;
  // Distinct real roots only: the exact root finder says in milliseconds
  // whether there is a non-real or a repeated root; Algebrite's roots() took
  // 2 s to list the complex roots of x⁴ + 3x² + 2 that were then thrown away
  // (and minutes on a repeated quadratic factor).
  const polyD = readPolynomial(den, v);
  if (polyD && !polyD.tooHigh) {
    const found = allRoots(polyD);
    if (found.complexCount > 0 || found.real.some((r) => r.multiplicity > 1)) return null;
  }
  // Real, distinct roots of the denominator.
  let rootsRaw;
  try { rootsRaw = String(Algebrite.run(`roots(${den}, ${v})`)).trim(); } catch { return null; }
  if (!rootsRaw || isAlgebriteFailure(rootsRaw) || /\bi\b/.test(rootsRaw)) return null;
  const rootList = rootsRaw.replace(/^\[|\]$/g, '').split(',').map((r) => r.trim()).filter(Boolean);
  if (rootList.length !== degD) return null; // repeated or missing roots
  const rootVals = rootList.map((r) => { try { return math.evaluate(r); } catch { return NaN; } });
  if (!rootVals.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  for (let i = 0; i < rootVals.length; i += 1) for (let j = i + 1; j < rootVals.length; j += 1) if (Math.abs(rootVals[i] - rootVals[j]) < 1e-9) return null;
  // Aᵢ = N(rᵢ)/D′(rᵢ), exact via Algebrite.
  const dDen = String(Algebrite.run(`d(${den}, ${v})`)).trim();
  const coefs = rootList.map((r) => {
    try { return String(Algebrite.run(`simplify(subst(${r}, ${v}, ${num}) / subst(${r}, ${v}, ${dDen}))`)).trim(); } catch { return null; }
  });
  if (coefs.some((c) => !c || isAlgebriteFailure(c) || /nil|Stop|\bi\b/.test(c))) return null;
  // Verify the decomposition numerically at a few points.
  const decomposed = rootList.map((r, i) => `(${coefs[i]})/(${v} - (${r}))`).join(' + ');
  for (const x of [0.37, 1.91, -2.63, 4.2]) {
    let lhs; let rhs;
    try { lhs = math.evaluate(`(${num})/(${den})`, { [v]: x }); rhs = math.evaluate(decomposed, { [v]: x }); } catch { return null; }
    if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) continue;
    if (Math.abs(lhs - rhs) > 1e-6 * (1 + Math.abs(lhs))) return null;
  }
  const anti = rootList.map((r, i) => `(${coefs[i]})*log(${v} - (${r}))`).join(' + ');
  let antiSimple;
  try { antiSimple = String(Algebrite.run(`simplify(${anti})`)).trim(); } catch { antiSimple = anti; }
  if (!antiSimple || isAlgebriteFailure(antiSimple)) antiSimple = anti;
  // Verify by differentiation (numerically — log(x - r) vs ln|x - r| differ only by a constant on each side).
  const back = (x) => { try { const h = 1e-5; return (math.evaluate(anti, { [v]: x + h }) - math.evaluate(anti, { [v]: x - h })) / (2 * h); } catch { return NaN; } };
  for (const x of [0.37, 1.91, 4.2]) {
    const expected = math.evaluate(`(${num})/(${den})`, { [v]: x });
    const got = back(x);
    if (Number.isFinite(expected) && Number.isFinite(got) && Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
  }
  const factorText = (r) => { const val = math.evaluate(r); const rt = Number.isInteger(val) ? String(val) : beautify(r); return val === 0 ? v : (val < 0 ? `(${v} + ${rt.replace(/^-/, '')})` : `(${v} - ${rt})`); };
  const fracText = rootList.map((r, i) => { const c = beautify(coefs[i]); return `${c === '1' ? '' : c === '-1' ? '-' : `${c}·`}1/${factorText(r)}`; }).join(' + ').replace(/\+ -/g, '− ');
  const denFactored = rootList.map(factorText).join('');
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — a proper rational function whose denominator factors into distinct linear factors: ${mark(`${beautify(den)} = ${denFactored}`)}.`,
    `Partial fractions: ${mark(`${beautify(term)} = ${fracText}`)}. Each coefficient is ${mark('N(r)/D′(r)')} at the root ${mark('r')} (the cover-up method).`,
    `Integrate each piece (${mark(`∫ 1/(${v} − r) d${v} = ln|${v} − r|`)}): ${mark(lnify(antiSimple))}.`,
  ];
  return { antiderivative: antiSimple, steps };
}

// ---------------------------------------------------------------------------
// The factorisation of a polynomial over the rationals, written the way
// Algebrite's factor() writes it — 3*(x - 1/2)*(x^2 + (-2)*x + (2))^2 — but
// built from the exact root finder (polynomialRoots.js) instead.
//
// Why it is exact and not a guess. Every real root the finder marks exact
// was confirmed by exact substitution, and a conjugate pair's quadratic
// x² − 2·Re(z)·x + |z|² is accepted only after rounding its coefficients to
// the one denominator a rational factor can have (Gauss's lemma: a monic
// factor of a polynomial with integer coefficients and leading coefficient L
// has coefficients in (1/L)ℤ) and then multiplying every factor back together
// in exact big-integer arithmetic to reproduce the polynomial coefficient by
// coefficient. Returns
//   a string   the proven factorisation (every factor linear or an
//              irreducible quadratic, with its power),
//   null       proven impossible — an irrational real root, or a pair whose
//              sum or product is not a rational of that denominator — so the
//              caller skips Algebrite too (it could not have done better; the
//              surd path handles these),
//   undefined  undecidable here (not a polynomial we can read, or non-real
//              roots the finder would not vouch for): the caller falls back to
//              Algebrite's factor() exactly as before.
function factorOverRationals(den, v) {
  const P = readPolynomial(den, v);
  if (!P || P.tooHigh || P.degree < 2) return undefined;
  const roots = allRoots(P);
  if (!roots.complex) return undefined;
  // Integer coefficients, lowest first; L the leading one; scale = what the
  // polynomial was multiplied by to get there.
  const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  const lcmD = P.coefficients.reduce((acc, c) => acc / bgcd(acc, c.d) * c.d, 1n);
  const ints = P.coefficients.map((c) => c.s * c.n * (lcmD / c.d));
  const L = ints[ints.length - 1];
  const absL = L < 0n ? -L : L;
  // A real number as k/L exactly, or null when it is not within rounding of one.
  const overL = (x) => {
    const scaled = x * Number(absL);
    const k = Math.round(scaled);
    if (!Number.isFinite(scaled) || Math.abs(scaled - k) > 1e-7 * (1 + Math.abs(scaled))) return null;
    return { n: BigInt(k), d: absL };
  };
  const factors = []; // { coeffs: [c0, c1, (c2)] as {n, d}, power }
  for (const r of [...roots.real].sort((a, b) => b.value - a.value)) {
    if (!r.exact) return null;
    factors.push({ coeffs: [{ n: -r.exact.m, d: r.exact.d }, { n: 1n, d: 1n }], power: r.multiplicity });
  }
  const pairs = roots.complex.filter((z) => z.im > 0).sort((a, b) => b.re - a.re || (a.re * a.re + a.im * a.im) - (b.re * b.re + b.im * b.im));
  for (const z of pairs) {
    // one of each conjugate pair
    const b = overL(-2 * z.re);
    const c = overL(z.re * z.re + z.im * z.im);
    if (!b || !c) return null;
    factors.push({ coeffs: [c, b, { n: 1n, d: 1n }], power: z.multiplicity });
  }
  if (!factors.length) return undefined;
  // Exact check: L · Π factor^power must equal the integer polynomial.
  const fmul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
  const fadd = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
  const pmul = (A, B) => {
    const out = Array.from({ length: A.length + B.length - 1 }, () => ({ n: 0n, d: 1n }));
    A.forEach((a, i) => B.forEach((b, j) => { out[i + j] = fadd(out[i + j], fmul(a, b)); }));
    return out;
  };
  let product = [{ n: L, d: 1n }];
  for (const f of factors) for (let k = 0; k < f.power; k += 1) product = pmul(product, f.coeffs);
  if (product.length !== ints.length) return undefined;
  if (!product.every((c, i) => c.n === ints[i] * c.d)) return undefined;
  // Text in the form the caller already parses.
  const ratText = (q) => { const g = bgcd(q.n, q.d) || 1n; const n = q.n / g; const d = q.d / g; return d === 1n ? String(n) : `${n}/${d}`; };
  const parts = [];
  if (L !== lcmD) parts.push(`(${ratText({ n: L, d: lcmD })})`);
  for (const f of factors) {
    const [c0, c1, c2] = f.coeffs;
    const text = c2 ? `(${v}^2 + (${ratText(c1)})*${v} + (${ratText(c0)}))` : `(${v} + (${ratText(c0)}))`;
    parts.push(f.power > 1 ? `${text}^${f.power}` : text);
  }
  return parts.join('*');
}

// General partial fractions: repeated linear factors and irreducible
// quadratics (with completing the square for the arctan pieces). The
// denominator is factored by Algebrite; the ansatz coefficients are found by
// solving the linear system N(x) = Σ Aᵢ·(D/dᵢ) at sample points, rationalised
// and re-verified; every antiderivative piece is a known form; the total is
// verified by differentiation before it is returned.
export function integrateByGeneralPartialFractions(term, variable, Algebrite) {
  const v = variable;
  const parts = splitTopLevelSlash(term);
  if (!parts) return null;
  const [num, den] = parts;
  if (!hasVariable(den, v)) return null;
  const degOf = (e) => { try { const d = String(Algebrite.run(`deg(${e}, ${v})`)).trim(); return /^\d+$/.test(d) ? Number(d) : null; } catch { return null; } };
  const degN = degOf(num);
  const degD = degOf(den);
  if (degN === null || degD === null || degD < 2 || degN >= degD) return null;

  // The factors as typed when they are already linear and irreducible
  // quadratic (no Algebrite factor() call); otherwise Algebrite factors.
  const typed = typedFactors(den, v);
  const typedOk = typed && typed.every((f) => f.deg < 2 || f.c[1] ** 2 - 4 * f.c[2] * f.c[0] < 0);
  let factored;
  if (typedOk) {
    factored = typed.map((f) => {
      const [c0, c1 = 0, c2 = 0] = f.c;
      const poly = f.deg === 0 ? String(c0) : f.deg === 1 ? `(${c1}*${v} + (${c0}))` : `(${c2}*${v}^2 + (${c1})*${v} + (${c0}))`;
      return f.power > 1 ? `${poly}^${f.power}` : poly;
    }).join('*');
  } else {
    // Our exact root finder factors over the rationals in milliseconds;
    // Algebrite's factor() grinds for 1–4 s on any denominator without a
    // small rational root (x⁴ + 1, x⁴ + 4, x⁶ + 1 — measured October 2026),
    // enough to spend a phone's 10 s budget before the surd path got its turn.
    factored = factorOverRationals(den, v);
    if (factored === null) return null; // proven: no factorisation into rational linear and quadratic factors
    if (factored === undefined) {
      try { factored = String(Algebrite.run(`factor(${den})`)).trim(); } catch { return null; }
    }
  }
  if (!factored || isAlgebriteFailure(factored)) return null;
  // A product splits on top-level '*'; a top-level sum (an irreducible
  // polynomial such as x^2+2*x+5) is a single factor.
  const rawFactors = hasTopLevelSum(factored) ? [factored] : splitTopLevel(factored, '*').filter((t) => t.trim());
  const factors = []; // { base, power, kind: 'lin'|'quad', r?, p?, q? }
  let constant = 1;
  for (const f0 of rawFactors) {
    let f = f0.trim();
    let power = 1;
    const pm = f.match(/^\((.+)\)\^(\d+)$/) || f.match(/^([a-z])\^(\d+)$/i);
    if (pm) { f = pm[1]; power = Number(pm[2]); }
    f = stripOuterParens(f);
    if (!hasVariable(f, v)) { const c = Number(math.evaluate(f)); if (!Number.isFinite(c) || c === 0) return null; constant *= c; continue; }
    const d = degOf(f);
    if (d === 1) {
      // a·x + b → root r = −b/a; normalise to (x − r) and fold a into the constant.
      const b = math.evaluate(f, { [v]: 0 });
      const a = math.evaluate(f, { [v]: 1 }) - b;
      if (!Number.isFinite(a) || a === 0) return null;
      constant *= a ** power;
      factors.push({ kind: 'lin', r: -b / a, power });
    } else if (d === 2) {
      const c0 = math.evaluate(f, { [v]: 0 });
      const c1 = math.evaluate(f, { [v]: 1 });
      const c2 = math.evaluate(f, { [v]: 2 });
      const a = (c2 - 2 * c1 + c0) / 2;
      const b = c1 - c0 - a;
      if (!Number.isFinite(a) || a === 0) return null;
      const pq = { p: b / a, q: c0 / a };
      if (pq.p * pq.p - 4 * pq.q >= -1e-12) return null; // reducible: not our case
      constant *= a ** power;
      factors.push({ kind: 'quad', ...pq, power });
    } else {
      return null;
    }
  }
  if (factors.length === 0) return null;
  const hasRepeatOrQuad = factors.some((f) => f.power > 1 || f.kind === 'quad');
  if (!hasRepeatOrQuad) return null; // the distinct-linear routine handles it

  // Ansatz terms.
  const terms = []; // { kind, r|p,q, j, unknowns: [names] }
  for (const f of factors) {
    for (let j = 1; j <= f.power; j += 1) {
      terms.push(f.kind === 'lin' ? { kind: 'lin', r: f.r, j } : { kind: 'quad', p: f.p, q: f.q, j });
    }
  }
  const nUnknowns = terms.reduce((n, t) => n + (t.kind === 'lin' ? 1 : 2), 0);
  // Denominator text in normalised form.
  const linTxt = (r) => (Math.abs(r) < 1e-12 ? v : r < 0 ? `(${v} + ${fmtNum(-r)})` : `(${v} - ${fmtNum(r)})`);
  const quadTxt = (p, q) => `(${v}^2${p === 0 ? '' : ` ${p < 0 ? '-' : '+'} ${Math.abs(p) === 1 ? '' : `${fmtNum(Math.abs(p))}*`}${v}`}${q === 0 ? '' : ` ${q < 0 ? '-' : '+'} ${fmtNum(Math.abs(q))}`})`;
  const denomOf = (t) => (t.kind === 'lin' ? `${linTxt(t.r)}${t.j > 1 ? `^${t.j}` : ''}` : `${quadTxt(t.p, t.q)}${t.j > 1 ? `^${t.j}` : ''}`);
  // The full normalised denominator D0 = Π factors (constant pulled out): N/den = (N/constant)/D0.
  const D0 = factors.map((f) => (f.kind === 'lin' ? `${linTxt(f.r)}${f.power > 1 ? `^${f.power}` : ''}` : `${quadTxt(f.p, f.q)}${f.power > 1 ? `^${f.power}` : ''}`)).join('*');
  // Basis functions: for each unknown, the polynomial (D0 / denom_t) × (1 or x).
  const basis = []; // strings in x
  for (const t of terms) {
    const cof = `(${D0})/(${denomOf(t)})`;
    if (t.kind === 'lin') basis.push(cof);
    else { basis.push(`(${cof})*${v}`); basis.push(cof); }
  }
  // Solve Σ cᵢ·basisᵢ(x) = N(x)/constant at nUnknowns integer points, in
  // exact rational arithmetic (Gaussian elimination on mathjs Fractions): the
  // basis polynomials span every polynomial of lower degree than D, so the
  // system is square and invertible, and the coefficients come out as the
  // fractions they are. (Floating least squares then "rationalising" lost
  // 1/(x⁶ − 1): six unknowns, errors past the tolerance, refused.)
  const rat = solveCoefficientsExactly(basis, num, constant, nUnknowns, v, factors);
  if (!rat) return null;
  const cTxt = rat.map((r) => (r.d === 1 ? String(r.n) : `${r.n}/${r.d}`));
  const decomposed = (() => { let i = 0; return terms.map((t) => { if (t.kind === 'lin') return `(${cTxt[i++]})/(${denomOf(t)})`; const b = cTxt[i++]; const c = cTxt[i++]; return `((${b})*${v} + (${c}))/(${denomOf(t)})`; }).join(' + '); })();
  for (const x of [0.11, 1.93, -2.47, 3.6]) {
    let l; let rr;
    try { l = math.evaluate(`(${num})/(${den})`, { [v]: x }); rr = math.evaluate(decomposed, { [v]: x }); } catch { return null; }
    if (Number.isFinite(l) && Number.isFinite(rr) && Math.abs(l - rr) > 1e-7 * (1 + Math.abs(l))) return null;
  }

  const linNum = (r0, denomText) => { const sgn = r0.n < 0 ? '−' : ''; const an = Math.abs(r0.n); const bare = stripOuterParens(denomText); return r0.d === 1 ? `${sgn}${an}/${/[+\-]/.test(bare) && !/\^/.test(denomText) ? `(${bare})` : denomText}` : `${sgn}${an}/(${r0.d}${denomText})`; };
  const quadNum = (b0, c0, denomText) => {
    // x/2, not 1/2x (which reads as 1/(2x)).
    const partB = b0.n === 0 ? '' : `${b0.n < 0 ? '−' : ''}${Math.abs(b0.n) === 1 ? '' : Math.abs(b0.n)}${v}${b0.d === 1 ? '' : `/${b0.d}`}`;
    const partC = c0.n === 0 ? '' : `${c0.n < 0 ? '−' : partB ? '+' : ''} ${c0.d === 1 ? Math.abs(c0.n) : `${Math.abs(c0.n)}/${c0.d}`}`;
    return `(${[partB, partC].filter(Boolean).join(' ').trim() || '0'})/${denomText}`;
  };
  // Integrate each piece.
  const pieces = [];
  const pieceSteps = [];
  let i = 0;
  for (const t of terms) {
    if (t.kind === 'lin') {
      const c = cTxt[i++];
      const R = rat[i - 1];
      const L = linTxt(t.r);
      const Lbare = stripOuterParens(L);
      const sgn = R.n < 0 ? '−' : '';
      const an = Math.abs(R.n);
      const cofLn = an === 1 && R.d === 1 ? '' : `${R.d === 1 ? an : `${an}/${R.d}`}·`;
      const fracOver = (extra) => `${sgn}${an}/(${R.d === 1 ? '' : `${R.d}`}${extra})`;
      const cMach = R.d === 1 ? (an === 1 ? (R.n < 0 ? '-' : '') : `${R.n}*`) : `${R.n}/${R.d}*`;
      // A zero coefficient is no term at all (1/(x − 1)² has none over x − 1).
      if (R.n === 0) continue;
      if (t.j === 1) { pieces.push(`${cMach}log(${L})`); pieceSteps.push(mark(`∫ ${fracOver(L)} d${v} = ${sgn}${cofLn}ln|${Lbare}|`)); }
      else {
        // ∫ c/(x − r)^j dx = −c/((j − 1)(x − r)^(j−1)), reduced.
        const power = t.j - 1 > 1 ? `${L}^${t.j - 1}` : L;
        const piece = overPoly(-(R.n / R.d) / (t.j - 1), '1', power);
        pieces.push(piece);
        pieceSteps.push(`${mark(`∫ ${fracOver(`${L}^${t.j}`)} d${v} = ${beautify(piece).replace(/^-/, '−')}`)} (power rule)`);
      }
    } else {
      const B = rat[i++]; const C = rat[i++];
      const Bv = B.n / B.d; const Cv = C.n / C.d;
      if (B.n === 0 && C.n === 0) continue; // (x² + 2)/((x² + 2)(x² + 3)) has no term over x² + 2
      const h = t.p / 2; const k2 = t.q - h * h; const k = Math.sqrt(k2);
      const U = h === 0 ? v : `(${v} ${h < 0 ? '-' : '+'} ${fmtNum(Math.abs(h))})`;
      const Q = quadTxt(t.p, t.q);
      // Bx + C = B·u + (C − B·h)
      const K = Cv - Bv * h;
      const Ktxt = fmtRat(K);
      const surd = !Number.isInteger(k) ? exactSurd(k2) : null;
      if (!Number.isInteger(k) && !surd) return null;
      // k = 1/2 is "1/2", not "sqrt(1/4)"; and (x + 1/2)/(1/2), never (x + 1/2)/1/2.
      const kTxt = Number.isInteger(k) ? String(k) : surd.rational ? fmtRat(k) : `sqrt(${fmtRat(k2)})`;
      const kDiv = /\//.test(kTxt) ? `(${kTxt})` : kTxt;
      const cm = (val) => (val === 1 ? '' : val === -1 ? '-' : `${fmtRat(val)}*`); // machine coefficient
      // k = √(k²) exactly: k² = a/b gives k = s·√t / b with t square-free
      // (x² − x + 1 = (x − 1/2)² + 3/4, k = √3/2). Its coefficient and the
      // arctan argument are then exact: (1/√3)·arctan((2x − 1)/√3), where
      // the decimals from a rounded k used to fail the check.
      // arctan(x - 1), not arctan((x - 1)): U carries its own brackets.
      const arcArg = k === 1 ? stripOuterParens(U) : surd && !surd.rational
        ? `(${surd.b / surd.s === 1 ? '' : `${fmtRat(surd.b / surd.s)}*`}${v}${h === 0 ? '' : ` ${h < 0 ? '-' : '+'} ${fmtRat(Math.abs(h * surd.b / surd.s))}`})/sqrt(${surd.t})`
        : surd && surd.rational
          // u/k with k = a/b: (b/a)·u, so (x + 1/2)/(1/2) is 2x + 1.
          ? (h === 0 ? `${fmtRat(1 / k)}*${v}` : `${fmtRat(1 / k)}*${v} ${h < 0 ? '-' : '+'} ${fmtRat(Math.abs(h / k))}`)
          : `${U}/${kDiv}`;
      const kShown = (() => {
        if (Number.isInteger(k)) return String(k);
        if (surd.rational) return fmtRat(k);
        const g = gcd(surd.s, surd.b) || 1; // 2√3/4 is √3/2
        return `${surd.s / g === 1 ? '' : surd.s / g}√${surd.t}${surd.b / g === 1 ? '' : `/${surd.b / g}`}`;
      })();
      const arcCoefMach = (Kv) => (surd && !surd.rational
        ? `${cm(Kv * surd.b / (surd.s * surd.t))}sqrt(${surd.t})*`
        : cm(Kv / k));
      if (t.j === 1) {
        if (Bv !== 0) { pieces.push(`${cm(Bv / 2)}log(${Q})`); }
        if (Math.abs(K) > 1e-12) { pieces.push(`${arcCoefMach(K)}arctan(${arcArg})`); }
        const numTxt = quadNum(B, C, Q).replace(/\/\(.*$/, '');
        const arcCoef = surd && !surd.rational
          ? `${beautify(arcCoefMach(K).replace(/\*$/, ''))}·`.replace(/^1\*/, '').replace(/sqrt\((\d+)\)/, '√$1')
          : Math.abs(K / k - 1) < 1e-12 ? '' : Math.abs(K / k + 1) < 1e-12 ? '−' : `${fmtRat(K / k)}·`;
        const arcShown = surd ? beautify(arcArg).replace(/sqrt\((\d+)\)/, '√$1') : k === 1 ? stripOuterParens(U) : `${U}/${kDiv}`;
        pieceSteps.push(`${mark(`∫ ${numTxt}/${Q} d${v}`)}: ${h !== 0 ? `complete the square, ${mark(`${Q} = ${U}^2 + ${fmtRat(k2)}`)}; ` : ''}${Bv !== 0 ? `the ${mark(v)}-part gives ${mark(`${fmtRat(Bv / 2)}·ln${/^\s*-/.test(stripOuterParens(Q)) ? `|${stripOuterParens(Q)}|` : `(${stripOuterParens(Q)})`}`)}` : ''}${Bv !== 0 && Math.abs(K) > 1e-12 ? ', and ' : ''}${Math.abs(K) > 1e-12 ? `the constant part gives ${mark(`${arcCoef}arctan(${arcShown})`)}` : ''}`);
      } else {
        // (Bu + K)/(u² + k²)^j, j ≥ 2, with u = x + h:
        //   ∫ u/(u² + k²)^j du = −1/(2(j − 1)(u² + k²)^(j−1))
        //   I_j = ∫ du/(u² + k²)^j = u/(2k²(j − 1)(u² + k²)^(j−1)) + (2j − 3)/(2k²(j − 1))·I_(j−1),   I_1 = (1/k)·arctan(u/k)
        // I_j is expanded to a flat sum Σ cₘ·u/(u² + k²)^m + c₀·(1/k)·arctan(u/k)
        // in exact fractions; the 1/k is exact for a rational k and for
        // k = s√t/b alike (arcCoefMach).
        const E = exactMath();
        const K2 = E.fraction(k2);
        const expand = (n) => {
          if (n === 1) return { terms: new Map(), arc: E.fraction(1) };
          const a = E.fraction(1).div(K2.mul(2 * (n - 1)));
          const b = E.fraction(2 * n - 3).div(K2.mul(2 * (n - 1)));
          const inner = expand(n - 1);
          const terms = new Map([[n - 1, a]]);
          for (const [m, c] of inner.terms) terms.set(m, (terms.get(m) || E.fraction(0)).add(b.mul(c)));
          return { terms, arc: b.mul(inner.arc) };
        };
        const asNumber = (q) => { if (Number(q.d) > 720) throw new Error('coefficient too fine to show'); return Number(q.s) * Number(q.n) / Number(q.d); };
        const uTxt = stripOuterParens(U) === v ? v : U;
        const powQ = (n) => (n === 1 ? Q : `${Q}^${n}`);
        const n = t.j;
        let expanded;
        try {
          const I = expand(n);
          expanded = { terms: [...I.terms].map(([m, c]) => [m, asNumber(c) * K]).sort((a, b) => b[0] - a[0]), arc: asNumber(I.arc) * K };
        } catch { return null; }
        if (Bv !== 0) pieces.push(overPoly(-Bv / (2 * (n - 1)), '1', powQ(n - 1)));
        if (Math.abs(K) > 1e-12) {
          for (const [m, c] of expanded.terms) pieces.push(overPoly(c, uTxt, powQ(m)));
          pieces.push(`${arcCoefMach(expanded.arc)}arctan(${arcArg})`);
        }
        const numTxt = quadNum(B, C, Q).replace(/\/\(.*$/, '');
        const paren = (txt) => (/\//.test(txt) ? `(${txt})` : txt);
        const uPower = (m) => (m === 1 ? '(u² + k²)' : `(u² + k²)^${m}`);
        pieceSteps.push(`${mark(`∫ ${numTxt}/${Q}^${n} d${v}`)}: with ${mark(`u = ${U}`)} and ${mark(`k = ${kShown}`)}, ${Bv !== 0 ? `${mark(`∫ ${Bv === 1 ? '' : Bv === -1 ? '−' : paren(fmtRat(Bv))}u/${uPower(n)} du = ${Bv < 0 ? '' : '−'}${paren(fmtRat(Math.abs(Bv) / (2 * (n - 1))))}/${uPower(n - 1)}`)} (${mark('w = u² + k²')})` : ''}${Bv !== 0 && Math.abs(K) > 1e-12 ? ' and ' : ''}${Math.abs(K) > 1e-12 ? `${mark(`∫ ${paren(Ktxt)}/${uPower(n)} du`)} by the reduction formula ${mark(`∫ du/(u² + k²)^n = u/(2k²(n − 1)(u² + k²)^(n−1)) + (2n − 3)/(2k²(n − 1))·∫ du/(u² + k²)^(n−1)`)}${n > 2 ? ` applied ${n - 1} times` : ''}, down to ${mark('∫ du/(u² + k²) = (1/k)·arctan(u/k)')}` : ''}`);
      }
    }
  }
  const anti = pieces.join(' + ').replace(/\+ -/g, '- ').replace(/\+ \(-/g, '- (');
  // Verify by numeric differentiation.
  const dnum = (x) => { try { const hh = 1e-5; return (math.evaluate(anti, { [v]: x + hh }) - math.evaluate(anti, { [v]: x - hh })) / (2 * hh); } catch { return NaN; } };
  let checked = 0;
  // Sample to the right of every real root, where log(x − r) is real.
  const maxRoot = Math.max(0, ...factors.filter((f) => f.kind === 'lin').map((f) => f.r));
  for (const x of [0.37, 1.13, 2.29, 3.71, 5.17].map((d) => maxRoot + d)) {
    let expected; try { expected = math.evaluate(`(${num})/(${den})`, { [v]: x }); } catch { continue; }
    const got = dnum(x);
    if (!Number.isFinite(expected) || !Number.isFinite(got)) continue;
    if (Math.abs(expected - got) > 1e-4 * (1 + Math.abs(expected))) return null;
    checked += 1;
  }
  if (checked < 3) return null;
  // Present the sum of pieces as they are (Algebrite's simplify would pull
  // out a common factor and make it harder to read).
  const antiSimple = anti;
  const ansatzTxt = (() => {
    let k = 0;
    return terms.map((t) => {
      if (t.kind === 'lin') { const r0 = rat[k++]; return r0.n === 0 ? null : linNum(r0, denomOf(t)); }
      const b0 = rat[k++]; const c0 = rat[k++];
      return b0.n === 0 && c0.n === 0 ? null : quadNum(b0, c0, denomOf(t));
    }).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
  })();
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — a proper rational function. Factor the denominator: ${mark(`${beautify(den)} = ${constant !== 1 ? `${fmtNum(constant)}·` : ''}${D0.replace(/\*/g, '')}`)}.`,
    ...sumOfSquaresQuartic(den, v),
    `Partial fractions (a repeated factor gets one term per power; an irreducible quadratic gets a linear numerator): ${mark(`${beautify(term)} = ${ansatzTxt}`)}. The coefficients come from clearing denominators and matching both sides.`,
    ...pieceSteps.map((t) => `  ${t}`),
    // An irreducible quadratic is never zero, so its log needs no bars: the
    // sum agrees with the answer (it read ln|x^2 + 1| above ln(x^2 + 1)).
    `Add the pieces: ${mark(dropBarsOnPositiveArguments(lnify(antiSimple), antiSimple, v))}.`,
  ];
  return { antiderivative: antiSimple, steps };
}

// x⁴ + 4 has no real roots, yet factors over the rationals: add and take
// away the middle term of a square, and it is a difference of squares,
// (x² + k)² − (mx)² with k² = c and m² = 2k (Sophie Germain's identity).
// The factorization alone was shown with no way to find it.
function sumOfSquaresQuartic(den, v) {
  const m0 = String(den).replace(/\s+/g, '').match(new RegExp(`^(?:${v}\\^4\\+(\\d+)|(\\d+)\\+${v}\\^4)$`));
  if (!m0) return [];
  const c = Number(m0[1] ?? m0[2]);
  const k = Math.sqrt(c);
  const m = Math.sqrt(2 * k);
  if (!Number.isInteger(k) || !Number.isInteger(m)) return [];
  const mx = m === 1 ? v : `${m}${v}`;
  return [`  To find it: ${mark(`${v}⁴ + ${c}`)} has no real roots, but adding and taking away ${mark(`${2 * k}${v}²`)} makes it a difference of squares: ${mark(`${v}⁴ + ${c} = (${v}⁴ + ${2 * k}${v}² + ${c}) − ${2 * k}${v}² = (${v}² + ${k})² − (${mx})² = (${v}² − ${mx} + ${k})(${v}² + ${mx} + ${k})`)}.`];
}

const fmtNum = (x) => (Number.isInteger(x) ? String(x) : (() => { for (let d = 2; d <= 720; d += 1) { const n = x * d; if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`; } return String(Math.round(x * 1e6) / 1e6); })());
const fmtRat = fmtNum;

// Exact rational arithmetic for the partial-fraction coefficients.
let exactMathInstance = null;
const exactMath = () => { if (!exactMathInstance) exactMathInstance = createMath({ number: 'Fraction' }); return exactMathInstance; };

// √(k²) for a rational k² = a/b as s·√t / b, t square-free; rational when t = 1.
function exactSurd(k2) {
  let a = null;
  let b = null;
  for (let d = 1; d <= 720; d += 1) { const n = k2 * d; if (Math.abs(n - Math.round(n)) < 1e-9) { a = Math.round(n); b = d; break; } }
  if (a === null || a <= 0) return null;
  let rad = a * b; // √(a/b) = √(ab)/b
  let s0 = 1;
  for (let f = 2; f * f <= rad; f += 1) while (rad % (f * f) === 0) { rad /= f * f; s0 *= f; }
  return { s: s0, t: rad, b, rational: rad === 1 };
}

// c·N/D as one fraction in lowest terms, readable and machine-evaluable:
// (−2, 1, (x − 1)^2)/2 → "-1/(x - 1)^2"; (1/2, x, (x^2 + 1)) → "x/(2*(x^2 + 1))".
function overPoly(c, numerText, denText) {
  const [n0, d0] = (() => { for (let d = 1; d <= 720; d += 1) { const n = c * d; if (Math.abs(n - Math.round(n)) < 1e-9) return [Math.round(n), d]; } return [c, 1]; })();
  const g = (a, b) => (b ? g(b, a % b) : Math.abs(a));
  const k = Number.isInteger(n0) ? g(n0, d0) || 1 : 1;
  const n = n0 / k;
  const d = d0 / k;
  const bare = stripOuterParens(denText);
  const den = /[+\-*/]/.test(bare) && !/^\(.*\)\^\d+$/.test(denText) ? `(${bare})` : denText.replace(/^\(([a-z])\)$/i, '$1');
  const top = numerText === '1' ? String(Math.abs(n)) : Math.abs(n) === 1 ? numerText : `${Math.abs(n)}*${numerText}`;
  return `${n < 0 ? '-' : ''}${top}/${d === 1 ? den : `(${d}*${den})`}`;
}

// Does the text have a '+' or binary '-' outside all parentheses?
function hasTopLevelSum(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && (ch === '+' || (ch === '-' && i > 0 && !/[*^(/]/.test(text[i - 1])))) return true;
  }
  return false;
}

// "num/den" split at the single top-level slash, or null.
export function splitTopLevelSlash(term) {
  let depth = 0;
  let idx = -1;
  for (let i = 0; i < term.length; i += 1) {
    const ch = term[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === '/' && depth === 0) { if (idx !== -1) return null; idx = i; }
  }
  if (idx === -1) return null;
  const num = stripOuterParens(term.slice(0, idx));
  const den = stripOuterParens(term.slice(idx + 1));
  return [num || '1', den];
}

// Least-squares solution of A·c = y via the normal equations (AᵀA)c = Aᵀy,
// by Gaussian elimination with partial pivoting. A is m×n (m ≥ n), small.
// The partial-fraction coefficients as exact fractions {n, d}, or null.
function solveCoefficientsExactly(basis, num, constant, nUnknowns, v, factors) {
  const E = exactMath();
  const F = (x) => E.fraction(x);
  const realRoots = factors.filter((f) => f.kind === 'lin').map((f) => f.r);
  const xs = [];
  for (let k = 0; xs.length < nUnknowns && k < nUnknowns + 50; k += 1) if (!realRoots.some((r) => Math.abs(r - k) < 1e-9)) xs.push(k);
  if (xs.length < nUnknowns) return null;
  let rows;
  try {
    const basisCode = basis.map((b) => E.parse(b).compile());
    const numCode = E.parse(num).compile();
    const cst = F(constant);
    rows = xs.map((x) => {
      const scope = { [v]: F(x) };
      const row = basisCode.map((c) => c.evaluate(scope));
      const y = E.divide(numCode.evaluate(scope), cst);
      if (![...row, y].every((q) => E.typeOf(q) === 'Fraction')) throw new Error('not rational');
      return [...row, y];
    });
  } catch {
    return null;
  }
  // Gaussian elimination with partial (non-zero) pivoting, all in Fractions.
  const n = nUnknowns;
  for (let col = 0; col < n; col += 1) {
    let pivot = -1;
    for (let r = col; r < n; r += 1) if (!rows[r][col].equals(0)) { pivot = r; break; }
    if (pivot < 0) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col || rows[r][col].equals(0)) continue;
      const m = rows[r][col].div(rows[col][col]);
      for (let c = col; c <= n; c += 1) rows[r][c] = rows[r][c].sub(m.mul(rows[col][c]));
    }
  }
  const out = [];
  for (let r = 0; r < n; r += 1) {
    const q = rows[r][n].div(rows[r][r]);
    const nn = Number(q.s) * Number(q.n);
    const dd = Number(q.d);
    if (!Number.isSafeInteger(nn) || !Number.isSafeInteger(dd)) return null;
    out.push({ n: nn, d: dd });
  }
  return out;
}
