// Partial fractions when the denominator factors over the reals but not over
// the rationals (1.57.0, from the October 28 outside review: 1/(x⁵ + 1) and
// 1/(x³ − 2) were refused while 1/(x³ + 1) was worked).
//
//   x⁵ + 1 = (x + 1)(x² − φx + 1)(x² + x/φ + 1),  φ = (1 + √5)/2
//   x³ − 2 = (x − ∛2)(x² + ∛2·x + ∛4)
//
// The real factorisation comes from the exact root finder (every real root,
// every complex pair, each verified there): a real root r gives (x − r), a
// complex pair gives x² − 2·Re·x + |z|². Each coefficient is then recognised
// as an exact number when it is one — a rational, or a quadratic surd
// (p + q√d)/r — and otherwise kept to full precision and shown with ≈ (the
// cube roots of 1/(x³ − 2)). The partial-fraction constants are found by
// clearing denominators and matching at sample points (a small linear
// system), recognised the same way; each piece is a logarithm (linear
// factor), or a logarithm plus an arctan (quadratic factor, completed
// square). The whole antiderivative is differentiated back before it is
// returned; the caller checks it again numerically (`numericCheck`).
//
// Out of scope here (null): a repeated irrational factor, an improper
// fraction (the caller divides first), a denominator the root finder cannot
// settle, and a denominator that factors over the rationals (worked
// elsewhere, with Algebrite's exact decomposition).
import { readPolynomial, allRoots } from './polynomialRoots.js';
import { derivativeMatchesNumerically } from './substitutionSolver.js';
import { beautify, formatNumber, gcd, splitTopLevel, stripOuterParens, mark } from './solverUtils.js';

const SQUARE_FREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 46, 47, 51, 53, 55, 57, 58, 59];
const TOL = 1e-9;
const close = (a, b) => Math.abs(a - b) <= TOL * (1 + Math.abs(a) + Math.abs(b));

// A number as it is. Every result carries: value; negative; mag (the text of
// its absolute value, bracketed when it is a sum or a fraction so it can be
// multiplied); text (signed); raw (an evaluable expression); exact.
export function recogniseNumber(value) {
  if (!Number.isFinite(value)) return null;
  for (let r = 1; r <= 1000; r += 1) {
    const p = Math.round(value * r);
    if (close(p / r, value)) return rational(p, r);
  }
  for (let r = 1; r <= 60; r += 1) {
    for (const d of SQUARE_FREE) {
      const sd = Math.sqrt(d);
      for (let q = 1; q <= 12; q += 1) {
        for (const sq of [q, -q]) {
          const p = Math.round(value * r - sq * sd);
          if (close((p + sq * sd) / r, value)) {
            const g = gcd(gcd(Math.abs(p), Math.abs(sq)), r) || 1;
            return surd(p / g, sq / g, d, r / g);
          }
        }
      }
    }
  }
  return decimal(value);
}

function rational(p, r) {
  const a = Math.abs(p);
  const mag = r === 1 ? String(a) : `${a}/${r}`;
  return { kind: 'rational', p, r, value: p / r, negative: p < 0, mag, magRaw: mag, text: `${p < 0 ? '−' : ''}${mag}`, raw: `${p < 0 ? '-' : ''}${mag}`, exact: true, isOne: a === 1 && r === 1, isZero: p === 0 };
}

// (p + q√d)/r with the positive term written first: (√5 − 1)/2, −(1 + √5)/20.
function surd(p, q, d, r) {
  const value = (p + q * Math.sqrt(d)) / r;
  const negative = value < 0;
  const [P, Q] = negative ? [-p, -q] : [p, q];
  const root = `${Math.abs(Q) === 1 ? '' : Math.abs(Q)}√${d}`;
  const rootRaw = `${Math.abs(Q) === 1 ? '' : `${Math.abs(Q)}*`}sqrt(${d})`;
  let inner;
  let innerRaw;
  if (P === 0) { inner = root; innerRaw = rootRaw; } else if (P > 0) { inner = `${P} ${Q < 0 ? '−' : '+'} ${root}`; innerRaw = `${P} ${Q < 0 ? '-' : '+'} ${rootRaw}`; } else { inner = `${root} − ${-P}`; innerRaw = `${rootRaw} - ${-P}`; }
  const twoTerms = P !== 0;
  const mag = r === 1 ? (twoTerms ? `(${inner})` : inner) : `${twoTerms ? `(${inner})` : inner}/${r}`;
  const magRaw = r === 1 ? (twoTerms ? `(${innerRaw})` : innerRaw) : `${twoTerms ? `(${innerRaw})` : innerRaw}/${r}`;
  return { kind: 'surd', p, q, d, r, value, negative, mag, magRaw, text: `${negative ? '−' : ''}${mag}`, raw: `${negative ? '-' : ''}${magRaw}`, exact: true, isOne: false, isZero: false, inner, innerRaw, twoTerms };
}

// A decimal is shown rounded, without its own ≈: the whole answer carries one.
function decimal(value) {
  const mag = formatNumber(Math.abs(value));
  return { kind: 'decimal', value, negative: value < 0, mag, magRaw: String(Math.abs(value)), text: `${value < 0 ? '−' : ''}${mag}`, raw: String(value), exact: false, isOne: false, isZero: Math.abs(value) < 1e-12 };
}

// √w for a recognised w > 0: √(p/r) = √(pr)/r; √((p + q√d)/r) = √(r(p + q√d))/r,
// with a square factor pulled out. Returns { num, radText, radRaw, den, value, exact }
// meaning num·radText/den.
function rootOf(w) {
  if (!(w.value > 0)) return null;
  const value = Math.sqrt(w.value);
  if (w.kind === 'rational') {
    let rad = w.p * w.r;
    let out = 1;
    for (let f = 2; f * f <= rad; f += 1) while (rad % (f * f) === 0) { rad /= f * f; out *= f; }
    const g = gcd(out, w.r) || 1;
    return { num: out / g, den: w.r / g, radText: rad === 1 ? '' : `√${rad}`, radRaw: rad === 1 ? '1' : `sqrt(${rad})`, value, exact: true };
  }
  if (w.kind === 'surd') {
    let a = w.p * w.r;
    let b = w.q * w.r;
    let out = 1;
    for (let f = 2; f * f <= Math.max(Math.abs(a), Math.abs(b)); f += 1) {
      while (a % (f * f) === 0 && b % (f * f) === 0) { a /= f * f; b /= f * f; out *= f; }
    }
    const g = gcd(out, w.r) || 1;
    const rootPart = `${Math.abs(b) === 1 ? '' : Math.abs(b)}√${w.d}`;
    const inner = a === 0 ? rootPart : `${a} ${b < 0 ? '−' : '+'} ${rootPart}`;
    const innerRaw = `${a} + ${b}*sqrt(${w.d})`;
    return { num: out / g, den: w.r / g, radText: `√(${inner})`, radRaw: `sqrt(${innerRaw})`, value, exact: true };
  }
  return { num: 1, den: 1, radText: formatNumber(value), radRaw: String(value), value, exact: false };
}
const rootText = (q) => `${q.num === 1 && q.radText ? '' : q.num}${q.radText}${q.den === 1 ? '' : `/${q.den}`}`;
const rootRaw = (q) => `${q.radRaw === '1' ? String(q.num) : `${q.num === 1 ? '' : `${q.num}*`}${q.radRaw}`}${q.den === 1 ? '' : `/${q.den}`}`;

// k/q with k recognised and q a root: (innerK · den)/(r · num · rad), reduced.
function quotient(k, q) {
  if (k.kind === 'decimal' || !q.exact) {
    const value = k.value / q.value;
    return { text: `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`, raw: String(value) };
  }
  const r1 = k.r;
  const innerText = k.kind === 'rational' ? String(Math.abs(k.p)) : (k.twoTerms ? `(${k.inner})` : k.inner);
  const innerRaw = k.kind === 'rational' ? String(Math.abs(k.p)) : k.innerRaw;
  const g = gcd(q.den, r1 * q.num) || 1;
  const top = q.den / g;
  const bottom = (r1 * q.num) / g;
  const numText = `${top === 1 ? '' : `${top}`}${innerText}`;
  const denText = `${bottom === 1 ? '' : bottom}${q.radText}`;
  const text = `${k.negative ? '−' : ''}${denText ? `${numText}/${/[√(]/.test(denText) && bottom > 1 ? `(${denText})` : denText}` : numText}`;
  const raw = `${k.negative ? '-' : ''}${top === 1 ? (k.kind === 'rational' ? innerRaw : `(${innerRaw})`) : `${top}*(${innerRaw})`}${denText ? `/(${bottom === 1 ? '' : `${bottom}*`}${q.radRaw})` : ''}`;
  return { text, raw };
}

const polyValue = (coeffs, x) => coeffs.reduce((acc, c, i) => acc + c * x ** i, 0);
// Horner's scheme at a complex point.
function complexPoly(coeffs, re, im) {
  let r = 0;
  let i = 0;
  for (let k = coeffs.length - 1; k >= 0; k -= 1) {
    const nr = r * re - i * im + coeffs[k];
    const ni = r * im + i * re;
    r = nr; i = ni;
  }
  return { re: r, im: i };
}
// "+ 3", "− (1 + √5)/2", "+ √5 − 1": a term joined to what precedes it (a
// whole-number surd sum needs no brackets inside a sum).
const joined = (n) => `${n.negative ? '−' : '+'} ${n.kind === 'surd' && n.twoTerms && n.r === 1 ? n.inner : n.mag}`;
// coefficient·body, with 1 and −1 absorbed and no dot between a whole number and a variable.
const times = (n, body) => `${n.negative ? '−' : ''}${n.isOne ? '' : `${n.mag}${/^\d+$/.test(n.mag) && /^[a-z]$/.test(body) ? '' : '·'}`}${body}`;
// x − r for the factor of a root r.
const linearFactor = (v, rec) => `${v} ${rec.negative ? '+' : '−'} ${rec.mag}`;
const quadFactor = (v, bRec, cRec) => `${v}²${bRec.isZero ? '' : ` ${joined(bRec)}${v}`} ${joined(cRec)}`;

export function integrateBySurdPartialFractions(term, v) {
  const parts = splitTopLevel(String(term).trim(), '/');
  if (parts.length !== 2) return null;
  const numText = stripOuterParens(parts[0].trim());
  const denText = stripOuterParens(parts[1].trim());
  const N = readPolynomial(numText, v);
  const D = readPolynomial(denText, v);
  if (!N || !D || N.tooHigh || D.tooHigh) return null;
  if (D.degree < 3 || N.degree >= D.degree) return null;
  const roots = allRoots(D);
  if (!roots || roots.complex === null) return null;
  if (roots.real.some((r) => r.multiplicity > 1) || roots.complex.some((z) => z.multiplicity > 1)) return null;
  const nCoeffs = N.coefficients.map((c) => Number(c.valueOf()));
  const dCoeffs = D.coefficients.map((c) => Number(c.valueOf()));
  const lead = dCoeffs[dCoeffs.length - 1];
  const linear = roots.real.map((r) => ({ r: r.value, rec: recogniseNumber(r.value) }));
  const pairs = roots.complex.filter((z) => z.im > 0).map((z) => ({ b: -2 * z.re, c: z.re * z.re + z.im * z.im }));
  if (linear.length + 2 * pairs.length !== D.degree) return null;
  const quads = pairs.map(({ b, c }) => ({ b, c, bRec: recogniseNumber(Math.abs(b) < 1e-12 ? 0 : b), cRec: recogniseNumber(c) }));
  const allRational = linear.every((l) => l.rec.kind === 'rational') && quads.every((q) => q.bRec.kind === 'rational' && q.cRec.kind === 'rational');
  if (allRational) return null;

  // Partial-fraction constants by residues (every root is simple): a real
  // root r gives A = N(r)/D′(r); a complex root z with residue c = N(z)/D′(z)
  // pairs with its conjugate into (2·Re c·x − 2·Re(c·z̄))/(x² − 2·Re z·x + |z|²).
  const dPrime = dCoeffs.map((c, i) => c * i).slice(1);
  const scale = Math.max(...nCoeffs.map(Math.abs), 1e-300);
  const tidy = (value) => (Math.abs(value) < 1e-10 * scale ? 0 : value);
  const coefA = linear.map((l) => recogniseNumber(tidy(polyValue(nCoeffs, l.r) / polyValue(dPrime, l.r))));
  const coefBC = pairs.map(({ b, c }) => {
    const re = -b / 2;
    const im = Math.sqrt(Math.max(c - re * re, 0));
    const nz = complexPoly(nCoeffs, re, im);
    const dz = complexPoly(dPrime, re, im);
    const den = dz.re * dz.re + dz.im * dz.im;
    const res = { re: (nz.re * dz.re + nz.im * dz.im) / den, im: (nz.im * dz.re - nz.re * dz.im) / den };
    const B = 2 * res.re;
    const C = -2 * (res.re * re + res.im * im); // −2·Re(c·z̄)
    return [recogniseNumber(tidy(B)), recogniseNumber(tidy(C))];
  });
  // The decomposition must reproduce the integrand (guards a misrecognised constant).
  for (const x of [0.41, 1.37, 2.23, -1.71]) {
    const d = polyValue(dCoeffs, x);
    if (Math.abs(d) < 1e-9) continue;
    const lhs = polyValue(nCoeffs, x) / d;
    const rhs = linear.reduce((acc, l, i) => acc + coefA[i].value / (x - l.r), 0)
      + quads.reduce((acc, q, j) => acc + (coefBC[j][0].value * x + coefBC[j][1].value) / (x * x + q.b * x + q.c), 0);
    if (!Number.isFinite(rhs) || Math.abs(lhs - rhs) > 1e-8 * (1 + Math.abs(lhs))) return null;
  }

  const pieceRaw = [];
  const pieceText = [];
  const pieceSteps = [];
  let approximate = false;
  const note = (n) => { if (!n.exact) approximate = true; return n; };
  const ansatz = [];
  linear.forEach((l, i) => {
    const a = note(coefA[i]);
    note(l.rec);
    const arg = linearFactor(v, l.rec);
    ansatz.push(`${a.kind === 'rational' && Math.abs(a.p) === 1 && a.r > 1 ? `${a.negative ? '−' : ''}1/(${a.r}(${arg}))` : `${a.text}/(${arg})`}`);
    if (a.isZero) return;
    const argRaw = `${v} ${l.rec.negative ? '+' : '-'} ${l.rec.magRaw}`;
    pieceRaw.push(`${a.isOne ? (a.negative ? '-' : '') : `(${a.raw})*`}log(${argRaw})`);
    pieceText.push(times(a, `ln|${arg}|`));
    pieceSteps.push(mark(`∫ ${ansatz[ansatz.length - 1]} d${v} = ${times(a, `ln|${arg}|`)}`));
  });
  quads.forEach((q, j) => {
    const [B, C] = coefBC[j].map(note);
    note(q.bRec); note(q.cRec);
    const quad = quadFactor(v, q.bRec, q.cRec);
    const quadRaw = `${v}^2${q.bRec.isZero ? '' : ` ${q.bRec.negative ? '-' : '+'} ${q.bRec.magRaw}*${v}`} ${q.cRec.negative ? '-' : '+'} ${q.cRec.magRaw}`;
    const halfB = recogniseNumber(q.b / 2);
    const w = recogniseNumber(q.c - (q.b * q.b) / 4);
    const root = rootOf(w);
    if (!root) return;
    const logCoef = note(recogniseNumber(B.value / 2));
    const kNum = note(recogniseNumber(C.value - (B.value * q.b) / 2));
    note(root);
    const shift = halfB.isZero ? v : `${v} ${halfB.negative ? '−' : '+'} ${halfB.mag}`;
    const shiftRaw = halfB.isZero ? v : `${v} ${halfB.negative ? '-' : '+'} ${halfB.magRaw}`;
    const K = quotient(kNum, root);
    const numeratorText = B.isZero ? C.text : `${times(B, v)} ${joined(C)}`;
    ansatz.push(`(${numeratorText})/(${quad})`);
    // (x + b/2)/(num·rad/den) is written as (den·x + den·b/2)/(num·rad): the
    // halves clear — (x + √3/2)/(1/2) is 2x + √3, (x + √2/2)/(√2/2) is (2x + √2)/√2.
    let arctanArg;
    if (!root.exact) {
      arctanArg = `${halfB.isZero ? v : `(${shift})`}/${rootText(root)}`;
    } else {
      const xCoef = recogniseNumber(root.den);
      const constant = recogniseNumber(tidy(halfB.value * root.den));
      const top = constant.isZero ? times(xCoef, v) : `${times(xCoef, v)} ${joined(constant)}`;
      const bottom = `${root.num === 1 && root.radText ? '' : root.num}${root.radText}`;
      arctanArg = bottom === '1' || bottom === '' ? top : `${constant.isZero && xCoef.isOne ? top : `(${top})`}/${bottom}`;
    }
    if (!B.isZero) { pieceRaw.push(`(${logCoef.raw})*log(${quadRaw})`); pieceText.push(times(logCoef, `ln(${quad})`)); }
    if (!kNum.isZero) { pieceRaw.push(`(${K.raw})*arctan((${shiftRaw})/(${rootRaw(root)}))`); pieceText.push(`${K.text}·arctan(${arctanArg})`); }
    pieceSteps.push(`${mark(`∫ (${numeratorText})/(${quad}) d${v}`)}: complete the square, ${mark(`${quad} = (${shift})² + ${w.mag}`)};${B.isZero ? '' : ` the part that is the derivative of the denominator gives ${mark(times(logCoef, `ln(${quad})`))},`} the constant part gives ${mark(`${K.text}·arctan(${arctanArg})`)}.`);
  });
  if (pieceRaw.length === 0) return null;
  const F = pieceRaw.join(' + ');
  if (!derivativeMatchesNumerically(F, term, v)) return null;

  const factorTexts = [
    ...(lead === 1 ? [] : [String(lead)]),
    ...linear.map((l) => `(${linearFactor(v, l.rec)})`),
    ...quads.map((q) => `(${quadFactor(v, q.bRec, q.cRec)})`),
  ];
  const surds = [...new Set([...linear.map((l) => l.rec), ...quads.flatMap((q) => [q.bRec, q.cRec])].filter((n) => n.kind === 'surd').map((n) => `√${n.d}`))];
  const shown = pieceText.join(' + ').replace(/\+ −/g, '− ');
  const steps = [
    `${mark(`∫(${beautify(term)}) d${v}`)} — the denominator has no factorisation over the rationals${linear.some((l) => l.rec.kind === 'rational') ? ' beyond its rational root' : ''}, but over the reals it does: its roots give ${mark(`${beautify(denText)} = ${factorTexts.join('')}`)}${surds.length ? ` (the coefficients involve ${surds.map(mark).join(', ')})` : ''}${approximate ? ' (a root with no closed form in square roots is kept to full precision and shown rounded)' : ''}.`,
    `Partial fractions, one term per factor (a linear numerator over each irreducible quadratic): ${mark(`${beautify(term)} = ${ansatz.join(' + ')}`)}. The constants come from clearing denominators and matching both sides.`,
    ...pieceSteps.map((t) => `  ${t}`),
    `Add the pieces: ${mark(shown)}.${approximate ? ' The decimals are rounded (the answer is marked ≈); the antiderivative is checked by differentiation at full precision.' : ''}`,
  ];
  return { antiderivative: F, steps, shown, approximate, numericCheck: true };
}
