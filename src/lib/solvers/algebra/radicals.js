// Exact radical forms (simplest radical form of an expression) and the
// quadratic-formula derivation shown when a quadratic is solved.

import { math, loadAlgebrite, beautify, formatNumber, mark } from '../solverUtils.js';
import { RADICAL_TIPS, RADICAL_MISTAKES } from './guidance.js';
import { prettyRadicals } from './rootsFormat.js';

// A monic quadratic with integer coefficients that factors over the integers
// is solved the way it is taught first: factor out x when c = 0, otherwise
// list the factor pairs of c, find the pair that sums to b, check by
// expanding, and apply the zero-product property. Null when it does not
// factor that way — the caller shows the quadratic formula instead, never a
// fabricated search.
function factoringLines(B, C, v, expanded) {
  if (![B, C].every(Number.isInteger)) return null;
  const sign = (n) => (n < 0 ? `(${n})` : String(n));
  const factor = (n) => (n === 0 ? v : n < 0 ? `${v} - ${-n}` : `${v} + ${n}`);
  if (C === 0) {
    if (B === 0) return null;
    return [
      `Factor out the common ${v}: ${expanded} = 0 becomes ${v}(${factor(B)}) = 0.`,
      `Set each factor to zero: ${v} = 0 or ${factor(B)} = 0, so ${v} = 0 or ${v} = ${-B}.`,
    ];
  }
  const pairs = [];
  for (let p = 1; p * p <= Math.abs(C); p += 1) {
    if (C % p !== 0) continue;
    pairs.push([p, C / p]);
    pairs.push([-p, -C / p]);
  }
  if (pairs.length > 12) return null;
  const hit = pairs.find(([p, q]) => p + q === B);
  if (!hit) return null;
  const [p, q] = hit;
  const factored = p === q ? `(${factor(p)})^2` : `(${factor(p)})(${factor(q)})`;
  return [
    `To factor ${mark(expanded)}, look for two numbers whose product is ${mark(C)} (the constant term) and whose sum is ${mark(B)} (the coefficient of ${mark(v)}).`,
    `Factor pairs of ${mark(C)}: ${mark(pairs.map(([m, n]) => `${sign(m)}·${sign(n)}`).join(', '))}. Their sums: ${mark(pairs.map(([m, n]) => m + n).join(', '))} — the pair ${mark(p)} and ${mark(q)} sums to ${mark(B)}.`,
    `So ${mark(`${expanded} = ${factored}`)}. Check by expanding: ${mark(`${v}·${v} + ${sign(q)}${v} + ${sign(p)}${v} + ${sign(p)}·${sign(q)} = ${expanded}`)}. ✓`,
    p === q
      ? `Set the factor to zero: ${factor(p)} = 0, so ${v} = ${-p} (a repeated root).`
      : `Set each factor to zero (zero-product property): ${factor(p)} = 0 or ${factor(q)} = 0, so ${v} = ${-p} or ${v} = ${-q}.`,
  ];
}

// Constant expressions with radicals should simplify exactly: sqrt(50) → 5√2,
// not 7.0711. Pure sqrt(N) gets the textbook perfect-square walkthrough in
// plain JS; other constant radical expressions go through Algebrite simplify,
// verified numerically before being claimed. Returns null when the input has
// a variable or no radical, so the regular simplify path runs instead.
export async function exactRadicalForm(expression) {
  const expr = String(expression).trim();
  if (!/sqrt|√|\^\(1\/\d+\)/.test(expr)) return null;

  // Constant check: no letters may remain once function/constant names go.
  const residue = expr
    .replace(/\b(?:sqrt|abs|sin|cos|tan|sec|csc|cot|ln|log|exp|pi)\b/gi, '')
    .replace(/\be\b/gi, '');
  if (/[a-z]/i.test(residue)) return null;

  let decimal;
  try {
    decimal = Number(math.evaluate(expr));
  } catch {
    return null;
  }
  if (!Number.isFinite(decimal)) return null;

  // Pure sqrt(N): factor out the largest perfect square by hand.
  const pure = expr.replace(/\s+/g, '').match(/^sqrt\((\d+)\)$/);
  if (pure) {
    const n = Number(pure[1]);
    let k = 1;
    for (let i = Math.floor(Math.sqrt(n)); i >= 2; i -= 1) {
      if (n % (i * i) === 0) { k = i; break; }
    }
    const m = n / (k * k);

    if (m === 1) {
      return radicalResult([
        `Simplify the radical: √${n}`,
        `${n} is a perfect square: ${k}² = ${n}.`,
        `√${n} = ${k}.`,
      ], String(k));
    }
    if (k === 1) {
      return radicalResult([
        `Simplify the radical: √${n}`,
        `${n} has no perfect-square factor larger than 1, so √${n} is already in simplest form.`,
        `Decimal value: √${n} ≈ ${formatNumber(decimal)}.`,
      ], `√${n} (≈ ${formatNumber(decimal)})`);
    }
    return radicalResult([
      `Simplify the radical: √${n}`,
      `Find the largest perfect square that divides ${n}: ${n} = ${k * k} × ${m}.`,
      `Split the radical: √${n} = √${k * k} · √${m} = ${k}√${m}.`,
      `Decimal value: ${k}√${m} ≈ ${formatNumber(decimal)}.`,
    ], `${k}√${m} (≈ ${formatNumber(decimal)})`);
  }

  // General constant radical (sqrt(8) + sqrt(2), 2*sqrt(12), …): Algebrite
  // finds the exact form; a numeric cross-check gates it before display.
  try {
    const Algebrite = await loadAlgebrite();
    const simplified = String(Algebrite.run(`simplify(${expr})`)).trim();
    if (!simplified || /nil|error|stop/i.test(simplified)) return null;

    const value = Number(math.evaluate(simplified));
    if (!Number.isFinite(value) || Math.abs(value - decimal) > 1e-9 * (1 + Math.abs(decimal))) return null;

    if (!/\^\(1\/\d+\)/.test(simplified)) {
      // Collapsed all the way to a plain number or fraction.
      const display = beautify(simplified);
      if (display.replace(/\s/g, '') === expr.replace(/\s/g, '')) return null;
      return radicalResult([
        `Simplify the radical expression: ${beautify(expr)}`,
        `The radicals combine exactly: ${display}.`,
      ], display);
    }

    const exact = prettifyRadicals(simplified);
    return radicalResult([
      `Simplify the radical expression: ${beautify(expr)}`,
      `Combine into exact simplified form: ${exact}.`,
      `Decimal value: ${exact} ≈ ${formatNumber(decimal)}.`,
    ], `${exact} (≈ ${formatNumber(decimal)})`);
  } catch {
    return null;
  }
}

function radicalResult(steps, answer) {
  return {
    steps,
    answer,
    tips: RADICAL_TIPS,
    common_mistakes: RADICAL_MISTAKES,
    graph: null, // a constant has no curve worth drawing
  };
}

// Algebrite writes radicals as fractional powers: 5*2^(1/2). Convert to the
// familiar 5√2 for display (value untouched — presentation only).
function prettifyRadicals(s) {
  let out = String(s)
    .replace(/(\d+)\^\(1\/2\)/g, '√$1')
    .replace(/(\d+)\^\(1\/3\)/g, '∛$1');
  out = beautify(out);
  return out.replace(/(\d+)\s*\*\s*([√∛])/g, '$1$2');
}

export const numericText = (t) => /^-?\d+(?:\/\d+)?(?:\.\d+)?$/.test(String(t).trim());
export const asNumber = (t) => {
  try {
    const v = math.evaluate(String(t));
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

// The working for a quadratic with numeric coefficients: x² = c and the
// square root of both sides (with √(−1) = i named when c < 0), or a, b, c,
// the discriminant and the quadratic formula. "Solve for x by finding the
// roots" told a student nothing. Null when the polynomial is not a plain
// quadratic; the roots themselves come from Algebrite either way.
export function quadraticDerivation(Algebrite, poly, v) {
  try {
    if (/[a-wyz]{2,}/i.test(String(poly).replace(new RegExp(v, 'g'), ''))) return null; // function names: not a plain polynomial
    if (String(Algebrite.run(`deg(${poly}, ${v})`)).trim() !== '2') return null;
    const [a, b, c] = [2, 1, 0].map((k) => String(Algebrite.run(`coeff(${poly}, ${v}, ${k})`)).trim());
    if (![a, b, c].every(numericText)) return null;
    const A = asNumber(a);
    const B = asNumber(b);
    const C = asNumber(c);
    const expanded = beautify(String(Algebrite.run(`expand(${poly})`)));
    const lines = [];
    if (B === 0) {
      const rhs = String(Algebrite.run(`simplify(-(${c})/(${a}))`)).trim();
      const R = asNumber(rhs);
      lines.push(`Isolate ${mark(`${v}^2`)}: ${mark(`${expanded} = 0`)} gives ${mark(`${v}^2 = ${beautify(rhs)}`)}.`);
      if (R < 0) {
        const mag = String(Algebrite.run(`simplify(${-R === Math.round(-R) ? Math.round(-R) : `(${rhs})*(-1)`}^(1/2))`)).trim();
        const magShown = prettyRadicals(beautify(mag));
        lines.push(`Take the square root of both sides: ${mark(`${v} = ±√(${beautify(rhs)})`)}. A negative number has no real square root; with ${mark('i = √(−1)')}, ${mark(`√(${beautify(rhs)}) = √${-R === Math.round(-R) ? Math.round(-R) : `(${-R})`}·√(−1) = ${magShown === '1' ? '' : magShown}i`)}.`);
      } else if (R === 0) {
        lines.push(`Take the square root of both sides: ${mark(`${v} = 0`)} (a repeated root).`);
      } else {
        const rootShown = prettyRadicals(beautify(String(Algebrite.run(`simplify((${rhs})^(1/2))`)).trim()));
        lines.push(`Take the square root of both sides — remembering both signs: ${mark(`${v} = ±√(${beautify(rhs)}) = ±${rootShown}`)}.`);
      }
      return lines;
    }
    if (A === 1) {
      const factoring = factoringLines(B, C, v, expanded);
      if (factoring) return factoring;
    }
    const D = String(Algebrite.run(`(${b})^2 - 4*(${a})*(${c})`)).trim();
    const Dn = asNumber(D);
    lines.push(`This is a quadratic in ${mark(v)}: ${mark(`${expanded} = 0`)}, with ${mark(`a = ${beautify(a)}, b = ${beautify(b)}, c = ${beautify(c)}`)}.`);
    lines.push(`Discriminant: ${mark(`b² − 4ac = (${beautify(b)})² − 4(${beautify(a)})(${beautify(c)}) = ${beautify(D)}`)}${Dn < 0 ? ' — negative, so the two roots are a complex conjugate pair' : Dn === 0 ? ' — zero, so there is one repeated root' : ''}.`);
    const sqrtD = prettyRadicals(beautify(String(Algebrite.run(`simplify((${D})^(1/2))`)).trim()));
    const negB = beautify(String(Algebrite.run(`-(${b})`)).trim());
    const twoA = beautify(String(Algebrite.run(`2*(${a})`)).trim());
    lines.push(`Quadratic formula: ${mark(`${v} = (−b ± √(b² − 4ac))/(2a) = (${negB} ± √(${beautify(D)}))/${twoA}${sqrtD !== `√${beautify(D)}` && sqrtD !== `√(${beautify(D)})` ? ` = (${negB} ± ${sqrtD})/${twoA}` : ''}`)}.`);
    return lines;
  } catch {
    return null;
  }
}
