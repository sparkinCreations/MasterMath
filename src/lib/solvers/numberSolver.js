// Questions about a number, typed in words (1.56.0): "is 97 prime", "the
// prime factorization of 360", "round 3.14159 to 2 decimal places". Each
// was refused as unreadable words.
//
// - Prime: trial division by every prime up to √n, the textbook test, in
//   whole-number arithmetic; the first divisor found shows n is composite,
//   with its factorization. Up to 10^15 (√n ≈ 3.2 × 10^7 divisions at most).
// - Prime factorization: divide by the smallest prime while it divides, then
//   the next, shown as the chain of quotients; the answer in exponent form.
// - Rounding: digit by digit on the decimal as typed (never through a float,
//   which turns 2.675 into 2.67499…), half away from zero, the textbook rule.
//   Decimal places, significant figures, or a place (nearest tenth, ten,
//   hundred, whole number). An expression (√2, π) is evaluated first and the
//   step says so.
import { math, formatNumber, mark } from './solverUtils.js';
import { unsupported as refusal, parseError } from '../solutionEnvelope.js';

const unsupported = (fields) => refusal({ ...fields, steps: [fields.reason] });
const MAX_PRIME_TEST = 10n ** 15n;

// A whole number as typed: digits, commas or spaces between groups allowed.
function wholeNumber(text) {
  const t = String(text).trim().replace(/(?<=\d)[,\s](?=\d{3}\b)/g, '');
  return /^-?\d+$/.test(t) ? BigInt(t) : null;
}

const isqrt = (n) => {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
};

// The primes up to a small bound, for listing the divisions in the steps.
function primesUpTo(limit) {
  const sieve = new Uint8Array(limit + 1);
  const out = [];
  for (let i = 2; i <= limit; i += 1) {
    if (sieve[i]) continue;
    out.push(i);
    for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
  }
  return out;
}

// The smallest prime factor of n ≥ 2 (n itself when n is prime).
function smallestFactor(n) {
  if (n % 2n === 0n) return 2n;
  const r = isqrt(n);
  for (let d = 3n; d <= r; d += 2n) if (n % d === 0n) return d;
  return n;
}

function factorize(n) {
  const factors = [];
  let m = n;
  while (m > 1n) {
    const p = smallestFactor(m);
    let k = 0;
    const chain = [m];
    while (m % p === 0n) {
      m /= p;
      k += 1;
      chain.push(m);
    }
    factors.push({ p, k, chain });
  }
  return factors;
}
const TIMES = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
const powerText = ({ p, k }) => (k === 1 ? String(p) : `${p}^${k}`);
const productText = (factors) => factors.map(powerText).join(' × ');

export function primeCheck(text) {
  const n = wholeNumber(text);
  if (n === null) return parseError({ input: String(text), hint: `"${text}" is not a whole number. Primes are whole numbers greater than 1.` });
  const definition = 'A prime number is a whole number greater than 1 whose only divisors are 1 and itself.';
  const tips = [
    `To test ${mark('n')} for primality, divide by the primes up to ${mark('√n')}: if ${mark('n = a × b')} with both factors greater than 1, one of them is at most ${mark('√n')}.`,
    `${mark('2')} is the only even prime; ${mark('1')} is not prime (it has one divisor, not two).`,
    'Quick checks: an even number is divisible by 2; a digit sum divisible by 3 means divisible by 3; a last digit 0 or 5 means divisible by 5.',
  ];
  const common_mistakes = [
    `Calling ${mark('1')} prime: a prime has exactly two divisors.`,
    `Stopping too early: ${mark('91 = 7 × 13')} looks prime until 7 is tried.`,
    `Testing every number up to ${mark('n')} instead of only the primes up to ${mark('√n')}.`,
  ];
  if (n < 2n) {
    return {
      steps: [definition, `${mark(String(n))} is not greater than ${mark('1')}${n === 1n ? ` (its only divisor is ${mark('1')})` : ''}, so it is not prime.`],
      answer: `${n} is not prime`,
      tips,
      common_mistakes,
      graph: null,
    };
  }
  if (n > MAX_PRIME_TEST) {
    return unsupported({ input: `is ${n} prime`, reason: `${mark(String(n))} has ${String(n).length} digits. MasterMath tests numbers up to ${mark('10^15')} by trial division, the method shown step by step; past that the divisions are too many to show.`, answer: 'This number is beyond what this solver can test by trial division' });
  }
  const root = isqrt(n);
  const p = smallestFactor(n);
  const steps = [definition];
  if (p !== n) {
    const q = n / p;
    const factors = factorize(n);
    steps.push(`Try the primes in order: ${mark(`${n} ÷ ${p} = ${q}`)} exactly, so ${mark(String(p))} divides ${mark(String(n))}.`);
    steps.push(`${mark(`${n} = ${p} × ${q}`)}: it has a divisor other than ${mark('1')} and itself, so it is not prime (it is composite).`);
    if (factors.length > 1 || factors[0].k > 1) steps.push(`Its prime factorization: ${mark(`${n} = ${productText(factors)}`)}.`);
    return { steps, answer: `${n} is not prime: ${n} = ${p} × ${q}`, tips, common_mistakes, graph: null };
  }
  if (n === 2n || n === 3n) {
    steps.push(`${mark(String(n))} has no divisor between ${mark('1')} and itself, so it is prime${n === 2n ? ' (the only even prime)' : ''}.`);
    return { steps, answer: `${n} is prime`, tips, common_mistakes, graph: null };
  }
  steps.push(`If ${mark(String(n))} had a divisor other than ${mark('1')} and itself, one would be at most ${mark(`√${n} ≈ ${formatNumber(Math.sqrt(Number(n)))}`)}, so only the primes up to ${mark(String(root))} need testing.`);
  if (root <= 60n) {
    const primes = primesUpTo(Number(root));
    const rems = primes.map((d) => `${n} = ${d}·${n / BigInt(d)} + ${n % BigInt(d)}`);
    steps.push(`Divide by each: ${rems.map((r) => mark(r)).join(', ')}. Every remainder is non-zero.`);
  } else if (root <= 100000n) {
    const count = primesUpTo(Number(root)).length;
    steps.push(`None of the ${count} primes from ${mark('2')} to ${mark(String(root))} divides ${mark(String(n))}: each division leaves a remainder.`);
  } else {
    steps.push(`No prime from ${mark('2')} to ${mark(String(root))} divides ${mark(String(n))}: each division leaves a remainder.`);
  }
  steps.push(`So ${mark(String(n))} is prime.`);
  return { steps, answer: `${n} is prime`, tips, common_mistakes, graph: null };
}

export function primeFactorization(text) {
  const n = wholeNumber(text);
  if (n === null) return parseError({ input: String(text), hint: `"${text}" is not a whole number.` });
  if (n < 2n) {
    return unsupported({ input: `the prime factorization of ${n}`, reason: `Only whole numbers greater than ${mark('1')} have a prime factorization; ${mark(String(n))} is not one.`, answer: `${n} has no prime factorization` });
  }
  if (n > MAX_PRIME_TEST) {
    return unsupported({ input: `the prime factorization of ${n}`, reason: `${mark(String(n))} has ${String(n).length} digits; MasterMath factors numbers up to ${mark('10^15')} by trial division.`, answer: 'This number is beyond what this solver can factor by trial division' });
  }
  const factors = factorize(n);
  const steps = [`Divide by the smallest prime that goes in, as many times as it does, then the next prime, until ${mark('1')} is left.`];
  for (const f of factors) {
    const chain = f.chain.map(String).join(' → ');
    steps.push(f.k === 1 && f.chain[1] === 1n && f.chain[0] === f.p
      ? `${mark(String(f.p))} is prime: ${mark(`${f.p} ÷ ${f.p} = 1`)}.`
      : `Divide by ${mark(String(f.p))} ${f.k === 1 ? 'once' : f.k === 2 ? 'twice' : `${TIMES[f.k] || f.k} times`}: ${mark(chain)}.`);
  }
  const answer = factors.length === 1 && factors[0].k === 1 ? `${n} = ${n} (${n} is prime)` : `${n} = ${productText(factors)}`;
  steps.push(`So ${mark(answer.replace(/ \(.*\)$/, ''))}${factors.length === 1 && factors[0].k === 1 ? `: ${mark(String(n))} is prime` : ''}.`);
  return {
    steps,
    answer,
    tips: [
      'Every whole number greater than 1 is a product of primes in exactly one way (the Fundamental Theorem of Arithmetic).',
      `Group repeated factors with exponents: ${mark('2 × 2 × 2 = 2^3')}.`,
      'The factorization gives the divisors, the GCD and the LCM: the GCD takes the lower power of each prime, the LCM the higher.',
    ],
    common_mistakes: [
      `Stopping at a composite factor: ${mark('360 = 4 × 90')} is not yet prime factors.`,
      `Listing ${mark('1')} as a prime factor.`,
    ],
    graph: null,
  };
}

// ---------------------------------------------------------------------------
// Rounding.
// ---------------------------------------------------------------------------

const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, zero: 0 };
const PLACES = {
  'whole number': 0, integer: 0, unit: 0, one: 0, units: 0, ones: 0, tenth: 1, hundredth: 2, thousandth: 3,
  'ten thousandth': 4, ten: -1, hundred: -2, thousand: -3, 'ten thousand': -4, 'hundred thousand': -5, million: -6,
};
const PLACE_NAMES = { 0: 'ones', 1: 'tenths', 2: 'hundredths', 3: 'thousandths', 4: 'ten-thousandths', [-1]: 'tens', [-2]: 'hundreds', [-3]: 'thousands', [-4]: 'ten-thousands', [-5]: 'hundred-thousands', [-6]: 'millions' };

// "2 decimal places", "two dp", "3 significant figures", "the nearest tenth",
// "nearest hundred": { places } or { sig }, or null.
export function readRoundingSpec(text) {
  const t = String(text).trim().toLowerCase().replace(/^the\s+/, '').replace(/^nearest\s+/, '').replace(/[.?!]+$/, '');
  const count = (w) => (/^\d+$/.test(w) ? Number(w) : WORD_NUMBERS[w]);
  let m = t.match(/^(\d+|[a-z]+)\s*(?:decimal\s+places?|decimals?|dp|d\.p|places?)$/);
  if (m && count(m[1]) !== undefined) return { places: count(m[1]) };
  m = t.match(/^(\d+|[a-z]+)\s*(?:significant\s+(?:figures?|digits?)|sig\.?\s*figs?|s\.?f)$/);
  if (m && count(m[1]) > 0) return { sig: count(m[1]) };
  const place = t.replace(/s$/, '');
  if (place in PLACES) return { places: PLACES[place] };
  // "the nearest 100", "nearest 0.1" (the plain-English reader writes
  // "hundred" as 100): a power of ten.
  m = t.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    const k = Math.log10(Number(m[1]));
    if (Number.isInteger(Math.round(k * 1e9) / 1e9)) return { places: -Math.round(k) };
  }
  return null;
}

// The decimal digits of a value: as typed when it is a plain decimal, else
// evaluated (15 significant digits).
function decimalOf(text) {
  const t = String(text).trim().replace(/(?<=\d),(?=\d{3}\b)/g, '');
  if (/^[-+]?\d*\.?\d+$/.test(t)) return { digits: t.replace(/^\+/, ''), typed: true };
  let value;
  try {
    value = math.evaluate(t.replace(/π/g, 'pi').replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)'));
  } catch {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const precise = Number(value.toPrecision(15));
  const s = Math.abs(precise) < 1e-6 || Math.abs(precise) >= 1e21 ? null : String(precise);
  return s ? { digits: s, typed: false, value } : null;
}

export function roundNumber(valueText, spec) {
  const dec = decimalOf(valueText);
  if (!dec) return parseError({ input: String(valueText), hint: `"${valueText}" could not be read as a number to round.` });
  const negative = dec.digits.startsWith('-');
  const [intPart, fracPart = ''] = dec.digits.replace('-', '').split('.');
  const digits = (intPart + fracPart).replace(/^0+(?=\d)/, '');
  const intLen = intPart.replace(/^0+(?=\d)/, '').length;
  const scale = fracPart.length;
  const N = BigInt(intPart + fracPart);
  let places = spec.places;
  let sigNote = '';
  if (spec.sig !== undefined) {
    if (N === 0n) places = spec.sig - 1;
    else {
      // The leading digit's place: 10^e.
      const lead = (intPart.replace(/^0+/, '') ? intPart.replace(/^0+/, '').length - 1 : -(fracPart.match(/^0*/)[0].length + 1));
      places = spec.sig - 1 - lead;
      sigNote = `The first significant digit is the first non-zero one; counting ${mark(String(spec.sig))} from there ends in the ${PLACE_NAMES[places] || `10^${-places}`} place.`;
    }
  }
  const shownIn = dec.typed ? dec.digits : String(valueText).trim();
  const placeName = PLACE_NAMES[places] || (places > 0 ? `${places}th decimal` : `10^${-places}`);
  // Round N / 10^scale to 10^-places, half away from zero.
  let q;
  let next = 0;
  let kept = null;
  if (places >= scale) {
    q = N * 10n ** BigInt(places - scale);
  } else {
    const div = 10n ** BigInt(scale - places);
    q = N / div;
    const r = N % div;
    next = Number(String(r).padStart(scale - places, '0')[0]);
    kept = Number(q % 10n);
    if (2n * r >= div) q += 1n;
  }
  // q in units of 10^-places, back to a decimal string.
  let out;
  if (places > 0) {
    const s = String(q).padStart(places + 1, '0');
    out = `${s.slice(0, -places)}.${s.slice(-places)}`;
  } else {
    out = String(q * 10n ** BigInt(-places));
  }
  if (negative && /[1-9]/.test(out)) out = `-${out}`;
  const roundedUp = places < scale && next >= 5;
  const steps = [];
  if (!dec.typed) steps.push(`Evaluate first: ${mark(`${shownIn} = ${dec.digits}…`)}`);
  if (sigNote) steps.push(sigNote);
  const target = spec.sig !== undefined ? `${spec.sig} significant figure${spec.sig === 1 ? '' : 's'}` : places > 0 ? `${places} decimal place${places === 1 ? '' : 's'}` : `the nearest ${({ 0: 'whole number', [-1]: 'ten', [-2]: 'hundred', [-3]: 'thousand', [-4]: 'ten thousand', [-5]: 'hundred thousand', [-6]: 'million' })[places] || placeName}`;
  if (places >= scale) {
    steps.push(`${mark(dec.digits)} has no digits past the ${placeName} place, so rounding to ${target} changes nothing${places > scale && places > 0 ? ` (zeros are written to show the precision)` : ''}.`);
  } else {
    steps.push(`Rounding to ${target} keeps the digits up to the ${placeName} place, where the digit is ${mark(String(kept))}.`);
    steps.push(roundedUp
      ? `The next digit is ${mark(String(next))}, which is ${mark('5')} or more, so round up: the ${mark(String(kept))} becomes ${mark(String((kept + 1) % 10))}${kept === 9 ? ', carrying 1 to the place before it' : ''}${places <= 0 && intLen + places > 0 ? ', and the places after it become zeros' : ''}.`
      : `The next digit is ${mark(String(next))}, less than ${mark('5')}, so round down: the ${mark(String(kept))} stays${places < 0 ? ', and the places after it become zeros' : ''}.`);
  }
  steps.push(`So ${mark(`${shownIn} ≈ ${out}`)}${spec.places !== undefined && places > 0 ? ` (to ${target})` : ''}.`);
  void digits;
  return {
    steps,
    answer: out,
    tips: [
      `Look only at the digit just after the last one you keep: ${mark('5')} or more rounds up, less than ${mark('5')} rounds down.`,
      spec.sig !== undefined
        ? `Significant figures count from the first non-zero digit: ${mark('0.004567')} to 2 significant figures is ${mark('0.0046')}.`
        : `Keep trailing zeros the rounding asks for: ${mark('2.996')} to 2 decimal places is ${mark('3.00')}, not ${mark('3')}.`,
    ],
    common_mistakes: [
      `Rounding in stages: ${mark('2.346')} to 1 decimal place is ${mark('2.3')}; rounding to ${mark('2.35')} first and then to ${mark('2.4')} is wrong.`,
      `Dropping digits instead of rounding: ${mark('3.789')} to 1 decimal place is ${mark('3.8')}, not ${mark('3.7')}.`,
    ],
    graph: null,
  };
}
