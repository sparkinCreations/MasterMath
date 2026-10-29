// A list of roots: read from Algebrite, checked against the equation, and
// shown as a textbook writes it (radicals, complex pairs, ± forms).

import { math, beautify, formatNumber, splitTopLevel } from '../solverUtils.js';

/**
 * Clean up mangled symbolic roots beyond polynomialRoot's cubic ceiling by
 * evaluating each root expression numerically (mathjs handles the complex
 * arithmetic: (-1)^(1/4) → 0.7071 + 0.7071i). Every root must back-substitute
 * into the polynomial with a tiny residual, or the whole cleanup is rejected
 * and the caller falls through — never a prettier-but-unverified answer.
 */
export function rootsViaComplexEvaluate(rootsRaw, polynomial, variable) {
  try {
    const parts = splitRootsList(rootsRaw);
    if (parts.length === 0) return null;

    const roots = [];
    for (const part of parts) {
      let value;
      try {
        value = math.evaluate(part.trim());
      } catch {
        return null;
      }
      const isComplex = value && typeof value === 'object' && Number.isFinite(value.re);
      if (typeof value !== 'number' && !isComplex) return null;

      const residual = math.abs(math.evaluate(polynomial, { [variable]: value }));
      if (!(residual < 1e-6)) return null;

      roots.push(formatComplexRoot(typeof value === 'number' ? value : { re: value.re, im: value.im }));
    }

    roots.sort((a, b) => {
      if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
      return a.numeric - b.numeric || a.im - b.im;
    });

    const answer = roots.map((r) => `${variable} = ${r.display}`).join('  or  ');
    const steps = [
      `Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`,
      `Find all ${roots.length} roots and verify each by substituting it back.`,
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: roots.filter((r) => r.isReal).map((r) => r.numeric) };
  } catch {
    return null;
  }
}

// Snap a number to the nearest integer when within rounding noise, else round
// to 4 decimals. Keeps 2.0000000004 -> 2 and 1.7320508 -> 1.7321.
export function cleanNumber(n) {
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return rounded;
  return parseFloat(n.toFixed(4));
}

// Format a mathjs root (number or {re, im} Complex) as a display string plus
// metadata, treating a negligible imaginary part as a real root.
export function formatComplexRoot(root) {
  const re = typeof root === 'number' ? root : (root.re ?? 0);
  const im = typeof root === 'number' ? 0 : (root.im ?? 0);

  const cleanRe = cleanNumber(re);
  const cleanIm = cleanNumber(im);

  if (Math.abs(cleanIm) < 1e-9) {
    return { display: formatNumber(cleanRe), numeric: cleanRe, im: 0, isReal: true };
  }

  const sign = cleanIm < 0 ? '-' : '+';
  const absIm = Math.abs(cleanIm);
  const imPart = absIm === 1 ? 'i' : `${formatNumber(absIm)}i`;
  const rePart = cleanRe === 0 ? '' : `${formatNumber(cleanRe)} `;
  const display = rePart
    ? `${rePart}${sign} ${imPart}`
    : `${cleanIm < 0 ? '-' : ''}${imPart}`;

  return { display, numeric: cleanRe, im: cleanIm, isReal: false };
}


// Split an Algebrite roots list ("[a, b, c]") into its entries, respecting
// commas inside parentheses.
export function splitRootsList(raw) {
  const trimmed = String(raw).trim().replace(/^\[|\]$/g, '');
  return trimmed ? splitTopLevel(trimmed, ',').filter(Boolean) : [];
}

export function parseRootsList(raw) {
  return splitRootsList(raw).map((part) => {
    const display = beautify(part.trim());
    let numeric = NaN;
    try {
      const value = math.evaluate(part.trim());
      // A real root Algebrite wrote in complex form (the ±1 among the roots
      // of x^100 = 1 come back as cos·cos − i·(…) with the i-terms cancelling).
      numeric = typeof value === 'number' ? value
        : (value && typeof value === 'object' && Number.isFinite(value.re) && Math.abs(value.im) < 1e-9) ? value.re : NaN;
    } catch {
      numeric = NaN;
    }
    return { display, numeric };
  });
}

// Does x balance the equation? A side that cannot be evaluated at x is not a
// disproof (the extraneous-root check deals with undefined sides); only a
// finite, clearly unequal pair of sides says "wrong".
export function satisfiesEquation(equation, variable, x) {
  const [lhs, rhs = '0'] = equation.split('=');
  try {
    const l = math.evaluate(lhs, { [variable]: x });
    const r = math.evaluate(rhs, { [variable]: x });
    if (typeof l !== 'number' || typeof r !== 'number' || !Number.isFinite(l) || !Number.isFinite(r)) return true;
    return Math.abs(l - r) <= 1e-6 * (1 + Math.abs(l) + Math.abs(r));
  } catch {
    return true;
  }
}

// Algebrite writes √2 as 2^(1/2) and (3 − √5)/2 as 3/2 - 1/2*5^(1/2). Show the
// textbook form; the value is untouched.
export function prettyRadicals(display) {
  let s = String(display);
  s = s.replace(/(\d+)\^\(1\/2\)/g, '√$1');
  s = s.replace(/\b1\/(\d+)\*√(\d+)/g, '√$2/$1');
  s = s.replace(/\b(\d+)\/(\d+)\*√(\d+)/g, '$1√$3/$2');
  s = s.replace(/\b(\d+)\*√(\d+)/g, '$1√$2');
  s = s.replace(/^(-?\d+)\/(\d+) ([+-]) √(\d+)\/\2$/, '($1 $3 √$4)/$2');
  s = s.replace(/^(-?\d+)\/(\d+) ([+-]) (\d+)√(\d+)\/\2$/, '($1 $3 $4√$5)/$2');
  return prettyComplex(s.replace(/i\*√/g, 'i√'));
}

// a/b ± (c/e)·i·√n over one denominator: -3/4 - 1/4*i√31 → (-3 - i√31)/4,
// -1/2 + 1/2*i√3 → (-1 + i√3)/2, 1 + 2*i → 1 + 2i (October 2026: complex
// quadratic roots read "-3/4 - 1/4*i*√31").
function prettyComplex(display) {
  const m = String(display).match(/^(-?\d+)(?:\/(\d+))? ([+-]) (?:(\d+)(?:\/(\d+))?\*)?i(?:√(\d+))?$/);
  if (!m) return display;
  const [, a, b = '1', sign, c = '1', e = '1', n] = m;
  const den = (Number(b) * Number(e)) / (gcdInt(Number(b), Number(e)) || 1);
  const re = (Number(a) * den) / Number(b);
  const im = (Number(c) * den) / Number(e);
  const imText = `${im === 1 ? '' : im}i${n ? `√${n}` : ''}`;
  return den === 1 ? `${re} ${sign} ${imText}` : `(${re} ${sign} ${imText})/${den}`;
}
const gcdInt = (x, y) => (y === 0 ? Math.abs(x) : gcdInt(y, x % y));

export function formatSolutions(roots, variable) {
  const displays = roots.map((r) => {
    // A plain integer/decimal root: show the clean numeric form.
    // Anything symbolic (radicals like 2^(1/2), complex like i) is kept exact.
    if (/^-?\d+(?:\.\d+)?$/.test(r.display)) {
      return formatNumber(r.numeric);
    }
    return prettyRadicals(r.display);
  });
  // A repeated root (x² = 0 → [0, 0]) is one solution, not two. Say once,
  // and note the multiplicity so the information isn't lost.
  const counts = new Map();
  for (const d of displays) counts.set(d, (counts.get(d) || 0) + 1);
  const unique = [...counts.keys()];
  const line = (d) => `${variable} = ${d}${counts.get(d) > 1 ? ` (repeated root, multiplicity ${counts.get(d)})` : ''}`;
  // x^100 = 1 has 2 real roots and 98 complex ones; listing all 100 as
  // trigonometric expressions is not an answer anyone can read. Past a
  // handful of complex roots, give the real ones and count the rest.
  const isComplex = (d) => /(?<![a-z])i(?![a-z])/.test(d);
  const complexOnes = unique.filter(isComplex);
  if (complexOnes.length > 4 || unique.length > 8) {
    // Real roots by value (Algebrite writes cos(π/50)… for the roots of
    // x^100 = 1; the two real ones are ±1), the rest counted.
    const reals = [];
    for (const r of roots) {
      if (Number.isFinite(r.numeric) && !reals.some((v) => Math.abs(v - r.numeric) < 1e-9)) reals.push(r.numeric);
    }
    const complexCount = roots.length - reals.length;
    const realText = reals.length ? reals.sort((a, b) => a - b).map((v) => `${variable} = ${formatNumber(v)}`).join('  or  ') : 'no real solutions';
    return `${realText};  plus ${complexCount} complex solutions (not listed)`;
  }
  return unique.map(line).join('  or  ');
}

// Over the reals, in textbook form: x = ±√(25 − y²), not Algebrite's
// "x = -(-y^2+25)^(1/2)  or  x = (-y^2+25)^(1/2)", and a cubic's two
// complex roots are dropped (x and y are real): x³ + y³ = 1 gives
// x = ∛(1 − y³) alone. Every root shown is substituted back into the
// equation at sample values of the other unknowns; one that fails anywhere
// it is real, or is real nowhere, is not shown. Null when none survives.
export const IMAGINARY = /(?<![a-z])i(?![a-z])/;
