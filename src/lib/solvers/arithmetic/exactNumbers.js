// Exact results: rationals and whole numbers past a float's range kept exact
// (BigInt), anything else shown as ≈ m × 10^k, and the final answer
// formatted.

import { math, formatNumber, beautify, mark } from '../solverUtils.js';
import { getSettings } from '../../settings.js';
import { simplifiedRoot, exactLog, exact, asMath } from './notation.js';

// Exact-first display. A rational result is shown as the fraction with the
// decimal alongside ("1/2 (= 0.5)"); a constant expression in e or π keeps
// its exact form with the approximation alongside ("e^2 ≈ 7.3891"); anything
// else is the plain number. Integers stay integers.
export function formatArithmeticResult(result, cleaned, root = simplifiedRoot(cleaned)) {
  // Complex (sqrt(-1), ln(-1)): format each part to the decimal setting,
  // and write a clean multiple of π as such (ln(-1) = πi, not 3.14159…i).
  if (result && typeof result === 'object' && 'im' in result && typeof result.re === 'number' && Math.abs(result.im) < 1e-12) return formatNumber(result.re);
  if (result && typeof result === 'object' && 'im' in result && typeof result.re === 'number') {
    const part = (v) => {
      const k = v / Math.PI;
      if (Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) !== 0) {
        const n = Math.round(k);
        return `${n === 1 ? '' : n === -1 ? '-' : n}π`;
      }
      return formatNumber(v);
    };
    const re = Math.abs(result.re) < 1e-12 ? '' : part(result.re);
    const imAbs = part(Math.abs(result.im));
    const im = `${result.im < 0 ? '-' : re ? '+' : ''}${imAbs === '1' ? '' : imAbs}i`;
    return re ? `${re} ${im[0]} ${im.slice(1)}` : im;
  }
  const formatted = formatNumber(result);
  if (typeof result !== 'number') return formatted;
  if (unshowable(result)) return `≈ ${scientific(result)}`;

  // Non-finite (1/0, 0/0): keep the offending quotient visible for context.
  if (!Number.isFinite(result)) {
    if (/^[^/]+\/[^/]+$/.test(cleaned) && !/[-+*×÷]/.test(cleaned.replace(/^-/, ''))) {
      return `${formatted} (${cleaned.replace(/\s+/g, '')})`;
    }
    return formatted;
  }
  if (Number.isInteger(result)) return formatted;

  // √50 → 5√2, ∛54 → 3∛2, √7 stays √7: exact, the decimal alongside.
  if (root) return `${root.text} (≈ ${formatted})`;
  // log_8(4) → 2/3.
  const log = String(cleaned).replace(/\s+/g, '').match(/^log\(([\d.]+),([\d.]+)\)$/);
  if (log) {
    const ex = exactLog(Number(log[1]), Number(log[2]));
    if (ex && ex.d > 1) return `${ex.text} (≈ ${formatted})`;
  }

  // Exact rational?
  try {
    const r = exact.evaluate(cleaned);
    if (exact.typeOf(r) === 'Fraction' && r.d > 1 && r.d <= 10000) {
      const sign = r.s < 0 ? '-' : '';
      return `${sign}${r.n}/${r.d} (= ${formatted})`;
    }
  } catch {
    // not rational — fall through
  }

  // Constant expression built only from e, π, digits and operators (no
  // function calls — sin(π/6) has its own exact value, not "sin(π/6) ≈"):
  // keep the exact form, approximate alongside.
  if (/\b(?:e|pi)\b/.test(cleaned) && /^[\d\s+\-*/^().]*(?:\b(?:e|pi)\b[\d\s+\-*/^().]*)+$/.test(cleaned)) {
    return `${beautify(cleaned).replace(/pi/g, "π")} ≈ ${formatted}`;
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Numbers a float cannot show exactly (October 25 review).
//
// A float keeps about 16 significant digits: 123456789*987654321 came out
// …260 (it is …269), 2^100 as 1.2676506002282294e+30 and 2^53 + 1 as 2^53.
// Whole numbers joined by + − × ^ (a whole exponent) and ! are worked in
// BigInt instead. Any other result past 2^53, or too small for the decimal
// setting (2^-60 was answered 0), is shown as ≈ m × 10^k.
// ---------------------------------------------------------------------------

const SAFE = 2 ** 53;
const MAX_EXACT_DIGITS = 100;

// m × 10^k with m to the decimal setting.
export function scientific(v) {
  let k = Math.floor(Math.log10(Math.abs(v)));
  let m = formatNumber(v / 10 ** k);
  if (Math.abs(Number(m)) >= 10) {
    k += 1;
    m = formatNumber(v / 10 ** k);
  }
  return `${m} × 10^${k}`;
}

// Too large for a float to hold every digit, or too small for the decimal
// setting to show anything but 0.
export const unshowable = (v) => typeof v === 'number' && Number.isFinite(v) && v !== 0
  && (Math.abs(v) >= SAFE || Math.abs(v) < 0.5 * 10 ** -getSettings().decimalPlaces);
export const numText = (v) => (unshowable(v) ? `≈ ${scientific(v)}` : formatNumber(v));
// "a = b", or "a ≈ b" when b is approximate.
export const equals = (left, valueText) => (/^≈/.test(valueText) ? `${left} ${valueText}` : `${left} = ${valueText}`);

// Exact rational arithmetic in BigInt: { n, d } with d > 0, in lowest terms.
const bgcd = (a, b) => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const frac = (n, d = 1n) => {
  if (d === 0n) throw new Error('division by zero');
  const g = bgcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const fracText = ({ n, d }) => (d === 1n ? String(n) : `${n}/${d}`);
// A typed decimal as the fraction it names: 0.000001 is 1/1000000.
function decimalFraction(v) {
  const m = String(v).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/);
  if (!m) throw new Error('not a decimal');
  const [, sign, whole, part = '', exp = '0'] = m;
  const shift = Number(exp) - part.length;
  if (Math.abs(shift) > 400) throw new Error('out of range');
  const digits = BigInt(`${sign}${whole}${part}`);
  return shift >= 0 ? frac(digits * 10n ** BigInt(shift)) : frac(digits, 10n ** BigInt(-shift));
}

// The value of an expression of numbers joined by + − × ÷ ^ (a whole
// exponent) and !, exactly, with one line per operation; null when it has
// anything else (a root, a function, π).
export function exactRational(expr) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return null;
  }
  const lines = [];
  const show = (f) => (f.n < 0n || f.d !== 1n ? `(${fracText(f)})` : fracText(f));
  const VERB = { add: 'Add', subtract: 'Subtract', multiply: 'Multiply', divide: 'Divide', pow: 'Work out the power', factorial: 'Work out the factorial' };
  const SYMBOL = { add: '+', subtract: '-', multiply: '×', divide: '÷', pow: '^' };
  const value = (n) => {
    if (n.type === 'ParenthesisNode') return value(n.content);
    if (n.type === 'ConstantNode') {
      if (typeof n.value !== 'number' || !Number.isFinite(n.value)) throw new Error('not a number');
      return Number.isSafeInteger(n.value) ? frac(BigInt(n.value)) : decimalFraction(n.value);
    }
    if (n.type !== 'OperatorNode' || !(n.fn in VERB || n.fn === 'unaryMinus' || n.fn === 'unaryPlus')) throw new Error('not exact arithmetic');
    const args = n.args.map(value);
    if (n.fn === 'unaryMinus') return frac(-args[0].n, args[0].d);
    if (n.fn === 'unaryPlus') return args[0];
    const [a, b] = args;
    let out;
    let note = '';
    if (n.fn === 'pow') {
      if (b.d !== 1n) throw new Error('fractional exponent');
      const k = b.n < 0n ? -b.n : b.n;
      // A huge power is refused before it is built.
      const size = Math.max(Math.log10(Math.abs(Number(a.n)) || 1), Math.log10(Number(a.d)));
      if (Number(k) * size > 400) throw new Error('out of range');
      const up = frac(a.n ** k, a.d ** k);
      if (b.n < 0n) {
        if (up.n === 0n) throw new Error('division by zero');
        out = frac(up.d, up.n);
        note = ` = 1/${show(a)}^${k}`;
      } else {
        out = up;
      }
    } else if (n.fn === 'factorial') {
      if (a.d !== 1n || a.n < 0n || a.n > 250n) throw new Error('out of range');
      let f = 1n;
      for (let k = 2n; k <= a.n; k += 1n) f *= k;
      out = frac(f);
    } else if (n.fn === 'add' || n.fn === 'subtract') {
      const sign = n.fn === 'add' ? 1n : -1n;
      out = frac(a.n * b.d + sign * b.n * a.d, a.d * b.d);
    } else if (n.fn === 'multiply') {
      out = frac(a.n * b.n, a.d * b.d);
    } else {
      if (b.n === 0n) throw new Error('division by zero');
      out = frac(a.n * b.d, a.d * b.n);
    }
    const left = n.fn === 'factorial' ? `${show(a)}!` : n.fn === 'pow' ? `${show(a)}^${b.n < 0n ? `(${b.n})` : b.n}` : `${show(a)} ${SYMBOL[n.fn]} ${show(b)}`;
    lines.push(`${VERB[n.fn]}${b && n.fn === 'pow' && b.n < 0n ? ` (a negative exponent means a reciprocal, ${mark('a^(-n) = 1/a^n')})` : ''}: ${mark(`${left}${note} = ${fracText(out)}`)}`);
    return out;
  };
  try {
    return { value: value(tree), lines };
  } catch {
    return null;
  }
}

export function exactRationalSolution(original, exactResult, result) {
  const { value } = exactResult;
  const digits = String(value.n).replace('-', '').length + (value.d === 1n ? 0 : String(value.d).length);
  const approx = scientific(result);
  const tiny = Math.abs(result) < 1;
  // A long fraction (1.5^100) is no help to read: its size is.
  const shown = value.d === 1n ? digits <= MAX_EXACT_DIGITS : digits <= 40;
  const answer = shown ? `${fracText(value)} (≈ ${approx})` : `≈ ${approx}`;
  const why = tiny
    ? `The result is smaller than ${mark(`10^-${getSettings().decimalPlaces}`)}, so ${getSettings().decimalPlaces} decimal places would show ${mark('0')}: it is kept as an exact fraction, with its size in scientific notation.`
    : `The result has ${String(value.n / value.d).replace('-', '').length} digits, more than a calculator's decimal numbers hold exactly (about 16 significant digits), so it is worked in exact arithmetic.`;
  const steps = [
    `Evaluate: ${asMath(original)}`,
    why,
    ...(shown ? exactResult.lines : []),
    shown ? `Final answer: ${mark(`${fracText(value)} ≈ ${approx}`)}` : `Final answer: ${mark(`≈ ${approx}`)} (the exact value has ${digits} digits${value.d === 1n ? '' : ' in its numerator and denominator'})`,
  ];
  return {
    steps,
    answer,
    tips: tiny
      ? [
        `Scientific notation, ${mark('m × 10^k')}, shows the size of a very small number: ${mark('2^-60 ≈ 8.6736 × 10^-19')}, where rounding to a few decimal places would give ${mark('0')}.`,
        `A negative exponent is a reciprocal, not a negative number: ${mark('2^(-3) = 1/8')}.`,
      ]
      : [
        'Whole numbers can be multiplied exactly to any size; a calculator in decimal mode keeps only about 16 significant digits and rounds the rest.',
        `Scientific notation, ${mark('m × 10^k')}, shows the size of a large number at a glance: ${mark('2^100 ≈ 1.2677 × 10^30')}.`,
      ],
    common_mistakes: tiny
      ? ['Reading a result rounded to 0 as exactly 0: it may only be smaller than the decimals shown.']
      : ['Trusting the last digits of a large calculator result: past about 16 digits they are rounded, not computed.'],
    graph: null,
  };
}
