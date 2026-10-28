// Powers and products of trigonometric functions, worked the way a Calculus
// II course works them (1.57.0, from the October 2026 outside review: sin²x·
// cos³x and sec³x were refused, sin³x was answered in one unexplained line).
//
//   sin^m θ · cos^n θ, one exponent odd (θ = kx):
//     cos odd — split off one cos θ, cos²θ = 1 − sin²θ, u = sin θ:
//       ∫ sin^m θ (1 − sin²θ)^j cos θ dθ = ∫ u^m (1 − u²)^j du
//     sin odd — split off one sin θ, sin²θ = 1 − cos²θ, u = cos θ (du = −sin θ dθ).
//     Both even are left to the half-angle identities (the caller's path).
//   sec^n θ, csc^n θ:
//     n even ≥ 4 — keep one sec²θ, sec²θ = 1 + tan²θ, u = tan θ
//       (csc: keep csc²θ, csc²θ = 1 + cot²θ, u = cot θ, du = −csc²θ dθ);
//     n odd ≥ 3 — the reduction formula, derived by parts with the integral
//       reappearing: (n − 1)·I_n = sec^(n−2)θ tan θ + (n − 2)·I_(n−2), down to
//       I_1 = ∫sec θ dθ = ln|sec θ + tan θ|  (csc: −csc^(n−2)θ cot θ, and
//       ∫csc θ dθ = ln|csc θ − cot θ|).
//   tan^m θ · sec^n θ:
//     n even — keep sec²θ, write the rest in tan θ, u = tan θ;
//     m odd  — keep sec θ tan θ, write the rest in sec θ, u = sec θ.
//     (cot^m θ · csc^n θ the same way, with the signs of d(cot), d(csc).)
//
// Every antiderivative is differentiated back numerically before it is
// returned; a failed check returns null and the caller's other methods run.
import { runAlgebrite, formatNumber, beautify, lnify, gcd, mark } from './solverUtils.js';
import { derivativeMatchesNumerically } from './substitutionSolver.js';

const FN = '(sin|cos|tan|sec|csc|cot)';

// c · Π fn(θ)^p with a shared θ = k·v. Returns { c, k, powers: {fn: p} } or null.
function readTrigProduct(term, v) {
  const t = String(term).replace(/\s+/g, '');
  const head = t.match(/^([+-]?)(\d+(?:\.\d+)?(?:\/\d+)?)?\*?(?=[a-z])/);
  if (!head) return null;
  const sign = head[1] === '-' ? -1 : 1;
  const c = sign * (head[2] ? Number(eval(head[2])) : 1); // eslint-disable-line no-eval -- a digit/slash literal matched above
  if (!Number.isFinite(c) || c === 0) return null;
  let rest = t.slice(head[0].length);
  const factorRe = new RegExp(`^${FN}\\(((?:\\d+(?:\\.\\d+)?\\*?)?${v})\\)(?:\\^(\\d+))?(?:\\*|$)`);
  const powers = {};
  let arg = null;
  while (rest.length) {
    const m = rest.match(factorRe);
    if (!m) return null;
    const fn = m[1];
    if (arg === null) arg = m[2];
    else if (arg !== m[2]) return null;
    powers[fn] = (powers[fn] || 0) + (m[3] ? Number(m[3]) : 1);
    rest = rest.slice(m[0].length);
  }
  if (arg === null) return null;
  const kMatch = arg.match(/^(\d+(?:\.\d+)?)\*?/);
  const k = kMatch ? Number(kMatch[1]) : 1;
  if (!(k > 0)) return null;
  return { c, k, powers, arg };
}

// fn^p(θ) as a textbook writes it.
const powText = (fn, theta, p) => (p === 1 ? `${fn}(${theta})` : p === 2 ? `${fn}²(${theta})` : p === 3 ? `${fn}³(${theta})` : `${fn}(${theta})^${p}`);
const coefText = (c) => (c === 1 ? '' : c === -1 ? '−' : `${formatNumber(c)}·`);
// c/k as an exact-looking factor for the steps and as a mathjs/Algebrite number.
function factorOf(c, k) {
  const value = c / k;
  const text = Number.isInteger(value) ? String(value) : (Number.isInteger(c) && Number.isInteger(k) ? `${c}/${k}` : formatNumber(value));
  return { value, text, raw: Number.isInteger(c) && Number.isInteger(k) ? `(${c}/${k})` : String(value) };
}
const times = (factor, body) => (factor.text === '1' ? body : factor.text === '-1' ? `−${body}` : `${factor.text}·${body}`);

export function integrateTrigPower(term, variable, Algebrite) {
  if (!Algebrite) return null;
  const read = readTrigProduct(term, variable);
  if (!read) return null;
  const { c, k, powers, arg } = read;
  const names = Object.keys(powers);
  const theta = arg.replace('*', '');
  const ctx = { Algebrite, v: variable, c, k, theta, argRaw: arg };

  const onlySinCos = names.every((n) => n === 'sin' || n === 'cos');
  if (onlySinCos) return sinCosProduct(ctx, powers.sin || 0, powers.cos || 0, term);
  if (names.length === 1 && (names[0] === 'sec' || names[0] === 'csc')) {
    const n = powers[names[0]];
    if (n % 2 === 0 && n >= 4) return secantEven(ctx, names[0], n, term);
    if (n % 2 === 1 && n >= 3) return secantOdd(ctx, names[0], n, term);
    return null;
  }
  if (names.length === 1 && (names[0] === 'tan' || names[0] === 'cot') && powers[names[0]] >= 2) return tangentPower(ctx, names[0], powers[names[0]], term);
  if (names.every((n) => n === 'tan' || n === 'sec')) return tanSecProduct(ctx, 'tan', 'sec', powers.tan || 0, powers.sec || 0, term);
  if (names.every((n) => n === 'cot' || n === 'csc')) return tanSecProduct(ctx, 'cot', 'csc', powers.cot || 0, powers.csc || 0, term);
  return null;
}

// Integrate a polynomial in u, back-substitute u = g(θ), and check.
function finishInU({ Algebrite, v, c, k }, polyInU, gRaw, factorSign, term, steps, uName) {
  const factor = factorOf(c * factorSign, k);
  const expanded = runAlgebrite(Algebrite, `expand(${polyInU})`);
  if (!expanded) return null;
  const H = runAlgebrite(Algebrite, `integral(${expanded}, u)`);
  if (!H || /integral\(/.test(H)) return null;
  const scaled = factor.value === 1 ? H : runAlgebrite(Algebrite, `expand(${factor.raw}*(${H}))`);
  if (!scaled) return null;
  const back = runAlgebrite(Algebrite, `subst(${gRaw}, u, ${scaled})`);
  if (!back || /\bu\b/.test(back)) return null;
  if (!derivativeMatchesNumerically(back, term, v)) return null;
  if (expanded !== polyInU.replace(/\^1\b/g, '').replace(/\*\(1[-+]u\^2\)\^0/, '')) steps.push(`Expand the polynomial: ${mark(times(factor, `∫(${beautify(expanded)}) du`))}.`);
  steps.push(`Integrate term by term with the power rule: ${mark(`${times(factor, `(${beautify(H)})`)}${factor.value === 1 ? '' : ` = ${beautify(scaled)}`}`)}.`);
  steps.push(`Back-substitute ${mark(`u = ${uName}`)}: ${mark(beautify(back))}.`);
  return { antiderivative: back, steps, method: 'trig power' };
}

function sinCosProduct(ctx, m, n, term) {
  const { c, k, theta, argRaw, v } = ctx;
  if (m + n < 2 || (m % 2 === 0 && n % 2 === 0)) return null; // sin θ, cos θ alone are direct; both even go to half-angles
  const original = `${coefText(c)}${m ? powText('sin', theta, m) : ''}${m && n ? '·' : ''}${n ? powText('cos', theta, n) : ''}`;
  const steps = [];
  if (n % 2 === 1) {
    const j = (n - 1) / 2;
    if (j === 0) steps.push(`The single factor ${mark(`cos(${theta})`)} is ${k === 1 ? '' : `(up to the constant ${mark(formatNumber(k))}) `}the derivative of ${mark(`sin(${theta})`)}: a substitution ${mark(`u = sin(${theta})`)} turns the rest into a power of ${mark('u')}.`);
    else steps.push(`The power of ${mark('cos')} is odd: keep one factor of ${mark(`cos(${theta})`)} for ${mark('du')} and turn the rest into sines with ${mark(`cos²(${theta}) = 1 − sin²(${theta})`)}: ${mark(`${original} = ${coefText(c)}${m ? `${powText('sin', theta, m)}·` : ''}(1 − sin²(${theta}))${j > 1 ? `^${j}` : ''}·cos(${theta})`)}.`);
    steps.push(`Let ${mark(`u = sin(${theta})`)}, so ${mark(`du = ${k === 1 ? '' : `${formatNumber(k)}·`}cos(${theta}) d${v}`)}${k === 1 ? '' : ` and ${mark(`cos(${theta}) d${v} = du/${formatNumber(k)}`)}`}: ${mark(`∫${original} d${v} = ${times(factorOf(c, k), `∫${m ? `u${m > 1 ? `^${m}` : ''}` : ''}${j ? `(1 − u²)${j > 1 ? `^${j}` : ''}` : ''}${!m && !j ? '1' : ''} du`)}`)}.`);
    return finishInU(ctx, `u^${m}*(1-u^2)^${j}`, `sin(${argRaw})`, 1, term, steps, `sin(${theta})`);
  }
  const i = (m - 1) / 2;
  if (i === 0) steps.push(`The single factor ${mark(`sin(${theta})`)} is (up to the constant ${mark(formatNumber(-k))}) the derivative of ${mark(`cos(${theta})`)}: a substitution ${mark(`u = cos(${theta})`)} turns the rest into a power of ${mark('u')}.`);
  else steps.push(`The power of ${mark('sin')} is odd: keep one factor of ${mark(`sin(${theta})`)} for ${mark('du')} and turn the rest into cosines with ${mark(`sin²(${theta}) = 1 − cos²(${theta})`)}: ${mark(`${original} = ${coefText(c)}(1 − cos²(${theta}))${i > 1 ? `^${i}` : ''}·${n ? `${powText('cos', theta, n)}·` : ''}sin(${theta})`)}.`);
  steps.push(`Let ${mark(`u = cos(${theta})`)}, so ${mark(`du = −${k === 1 ? '' : `${formatNumber(k)}·`}sin(${theta}) d${v}`)} and ${mark(`sin(${theta}) d${v} = −du${k === 1 ? '' : `/${formatNumber(k)}`}`)}: ${mark(`∫${original} d${v} = ${times(factorOf(-c, k), `∫${i ? `(1 − u²)${i > 1 ? `^${i}` : ''}` : ''}${n ? `u${n > 1 ? `^${n}` : ''}` : ''}${!i && !n ? '1' : ''} du`)}`)}.`);
  return finishInU(ctx, `(1-u^2)^${i}*u^${n}`, `cos(${argRaw})`, -1, term, steps, `cos(${theta})`);
}

function secantEven(ctx, fn, n, term) {
  const { c, k, theta, argRaw, v } = ctx;
  const co = fn === 'sec' ? 'tan' : 'cot';
  const sign = fn === 'sec' ? 1 : -1;
  const j = n / 2 - 1;
  const steps = [
    `The power of ${mark(fn)} is even: keep one ${mark(`${fn}²(${theta})`)} for ${mark('du')} and write the rest with ${mark(`${fn}²(${theta}) = 1 + ${co}²(${theta})`)}: ${mark(`${coefText(c)}${powText(fn, theta, n)} = ${coefText(c)}(1 + ${co}²(${theta}))${j > 1 ? `^${j}` : ''}·${fn}²(${theta})`)}.`,
    `Let ${mark(`u = ${co}(${theta})`)}, so ${mark(`du = ${sign < 0 ? '−' : ''}${k === 1 ? '' : `${formatNumber(k)}·`}${fn}²(${theta}) d${v}`)}: ${mark(`∫${coefText(c)}${powText(fn, theta, n)} d${v} = ${times(factorOf(c * sign, k), `∫(1 + u²)${j > 1 ? `^${j}` : ''} du`)}`)}.`,
  ];
  return finishInU(ctx, `(1+u^2)^${j}`, `${co}(${argRaw})`, sign, term, steps, `${co}(${theta})`);
}

function tanSecProduct(ctx, tfn, sfn, m, n, term) {
  const { c, k, theta, argRaw, v } = ctx;
  const sign = sfn === 'sec' ? 1 : -1; // d(tan) = sec², d(sec) = sec·tan; d(cot) = −csc², d(csc) = −csc·cot
  const original = `${coefText(c)}${m ? powText(tfn, theta, m) : ''}${m && n ? '·' : ''}${n ? powText(sfn, theta, n) : ''}`;
  if (n >= 2 && n % 2 === 0) {
    const j = n / 2 - 1;
    const steps = [
      `The power of ${mark(sfn)} is even: keep one ${mark(`${sfn}²(${theta})`)} for ${mark('du')} and write the rest in ${mark(tfn)} with ${mark(`${sfn}²(${theta}) = 1 + ${tfn}²(${theta})`)}: ${mark(`${original} = ${coefText(c)}${m ? `${powText(tfn, theta, m)}·` : ''}${j ? `(1 + ${tfn}²(${theta}))${j > 1 ? `^${j}` : ''}·` : ''}${sfn}²(${theta})`)}.`,
      `Let ${mark(`u = ${tfn}(${theta})`)}, so ${mark(`du = ${sign < 0 ? '−' : ''}${k === 1 ? '' : `${formatNumber(k)}·`}${sfn}²(${theta}) d${v}`)}: ${mark(`∫${original} d${v} = ${times(factorOf(c * sign, k), `∫${m ? `u${m > 1 ? `^${m}` : ''}` : ''}${j ? `(1 + u²)${j > 1 ? `^${j}` : ''}` : ''}${!m && !j ? '1' : ''} du`)}`)}.`,
    ];
    return finishInU(ctx, `u^${m}*(1+u^2)^${j}`, `${tfn}(${argRaw})`, sign, term, steps, `${tfn}(${theta})`);
  }
  if (m % 2 === 1 && n >= 1) {
    const i = (m - 1) / 2;
    const steps = [
      `The power of ${mark(tfn)} is odd: keep ${mark(`${sfn}(${theta})·${tfn}(${theta})`)} for ${mark('du')} and write the rest in ${mark(sfn)} with ${mark(`${tfn}²(${theta}) = ${sfn}²(${theta}) − 1`)}: ${mark(`${original} = ${coefText(c)}${i ? `(${sfn}²(${theta}) − 1)${i > 1 ? `^${i}` : ''}·` : ''}${n > 1 ? `${powText(sfn, theta, n - 1)}·` : ''}${sfn}(${theta})${tfn}(${theta})`)}.`,
      `Let ${mark(`u = ${sfn}(${theta})`)}, so ${mark(`du = ${sign < 0 ? '−' : ''}${k === 1 ? '' : `${formatNumber(k)}·`}${sfn}(${theta})${tfn}(${theta}) d${v}`)}: ${mark(`∫${original} d${v} = ${times(factorOf(c * sign, k), `∫${i ? `(u² − 1)${i > 1 ? `^${i}` : ''}` : ''}${n > 1 ? `u${n > 2 ? `^${n - 1}` : ''}` : ''}${!i && n <= 1 ? '1' : ''} du`)}`)}.`,
    ];
    return finishInU(ctx, `(u^2-1)^${i}*u^${n - 1}`, `${sfn}(${argRaw})`, sign, term, steps, `${sfn}(${theta})`);
  }
  return null;
}

// sec^n θ (n odd ≥ 3) by the reduction formula, and csc^n θ alike. The
// derivation is written in θ; the assembled antiderivative in the variable.
function secantOdd(ctx, fn, n, term) {
  const { c, k, theta, argRaw, v } = ctx;
  const co = fn === 'sec' ? 'tan' : 'cot';
  const s = fn === 'sec' ? '' : '−';          // the sign in front of fn^(n−2)·co
  const sgn = fn === 'sec' ? 1 : -1;
  const base = fn === 'sec' ? 'ln|sec θ + tan θ|' : 'ln|csc θ − cot θ|';
  const baseRaw = fn === 'sec' ? `log(sec(${argRaw})+tan(${argRaw}))` : `log(csc(${argRaw})-cot(${argRaw}))`;
  const I = (p) => `I_${p}`;
  const nm2 = n - 2 === 1 ? '' : `${n - 2}·`;
  const steps = [
    `Write ${mark(`${I(n)} = ∫${powText(fn, 'θ', n)} dθ`)} with ${mark(`θ = ${theta}`)}${k === 1 ? '' : ` (so ${mark(`d${v} = dθ/${formatNumber(k)}`)})`}. An odd power of ${mark(fn)} has no substitution that closes; a reduction formula lowers the power by two.`,
    `Integrate by parts with ${mark(`u = ${powText(fn, 'θ', n - 2)}`)}, ${mark(`dv = ${fn}²(θ) dθ`)} (so ${mark(`du = ${s}${nm2}${powText(fn, 'θ', n - 2)}${co}(θ) dθ`)}, ${mark(`v = ${s}${co}(θ)`)}): ${mark(`${I(n)} = ${s}${powText(fn, 'θ', n - 2)}${co}(θ) − ${nm2}∫${powText(fn, 'θ', n - 2)}${co}²(θ) dθ`)}.`,
    `Use ${mark(`${co}²(θ) = ${fn}²(θ) − 1`)}: the last integral is ${mark(`${I(n)} − ${I(n - 2)}`)}, so the integral reappears: ${mark(`${I(n)} = ${s}${powText(fn, 'θ', n - 2)}${co}(θ) − ${nm2}${I(n)} + ${nm2}${I(n - 2)}`)}.`,
    `Solve for ${mark(I(n))}: ${mark(`${n - 1}·${I(n)} = ${s}${powText(fn, 'θ', n - 2)}${co}(θ) + ${nm2}${I(n - 2)}`)}, the reduction formula ${mark(`${I(n)} = ${s}${powText(fn, 'θ', n - 2)}${co}(θ)/${n - 1} + (${n - 2}/${n - 1})·${I(n - 2)}`)}.`,
  ];
  if (n > 3) steps.push(`Apply the same formula to ${mark(I(n - 2))}${n - 2 > 3 ? ', and again,' : ''} down to ${mark(I(1))}.`);
  steps.push(`The base case: ${mark(`${I(1)} = ∫${fn}(θ) dθ = ${base}`)}${fn === 'sec' ? ` (multiply by ${mark('(sec θ + tan θ)/(sec θ + tan θ)')}: the numerator is the derivative of the denominator)` : ''}.`);
  // I_n = Σ a_p·fn^(p−2)·co + b·I_1, with exact rational coefficients.
  const terms = []; // [numerator, denominator, power p]
  let [bn, bd] = [1, 1];
  for (let p = n; p >= 3; p -= 2) {
    terms.push([bn * sgn, bd * (p - 1), p - 2]);
    [bn, bd] = [bn * (p - 2), bd * (p - 1)];
  }
  const scale = factorOf(c, k);
  const frac = (num, den) => {
    const g = gcd(Math.abs(num), Math.abs(den)) || 1;
    const [a, b] = [num / g, den / g];
    return b === 1 ? String(a) : `${a}/${b}`;
  };
  const withScale = (num, den) => (Number.isInteger(c) && Number.isInteger(k) ? frac(num * c, den * k) : String((num / den) * scale.value));
  const pieces = terms.map(([num, den, p]) => `${withScale(num, den)}*${fn}(${argRaw})${p === 1 ? '' : `^${p}`}*${co}(${argRaw})`);
  pieces.push(`${withScale(bn, bd)}*${baseRaw}`);
  const F = pieces.join(' + ').replace(/\+ -/g, '- ').replace(/(?<![\d/])1\*/g, '');
  if (!derivativeMatchesNumerically(F, term, v)) return null;
  steps.push(`Assemble${k === 1 && c === 1 ? '' : `, with the factor ${mark(scale.text)}`}: ${mark(`∫${coefText(c)}${powText(fn, theta, n)} d${v} = ${lnify(F)}`)}.`);
  return { antiderivative: F, steps, method: 'reduction' };
}

// tan^m θ (m ≥ 2) by the reduction formula tan^m = tan^(m−2)·(sec² − 1):
//   ∫tan^m θ dθ = tan^(m−1)θ/(m − 1) − ∫tan^(m−2)θ dθ,
// down to ∫tan θ = −ln|cos θ| or ∫1 = θ (cot: −cot^(m−1)/(m − 1), ∫cot = ln|sin|).
function tangentPower(ctx, fn, m, term) {
  const { c, k, theta, argRaw, v } = ctx;
  const sq = fn === 'tan' ? 'sec' : 'csc';
  const s = fn === 'tan' ? '' : '−';
  const sgn = fn === 'tan' ? 1 : -1;
  const I = (p) => `I_${p}`;
  const steps = [
    `Write ${mark(`${I(m)} = ∫${powText(fn, 'θ', m)} dθ`)} with ${mark(`θ = ${theta}`)}${k === 1 ? '' : ` (so ${mark(`d${v} = dθ/${formatNumber(k)}`)})`}. ${m === 2 ? `Use ${mark(`${fn}²(θ) = ${sq}²(θ) − 1`)} directly` : `Split off ${mark(`${fn}²(θ) = ${sq}²(θ) − 1`)}: ${mark(`${powText(fn, 'θ', m)} = ${powText(fn, 'θ', m - 2)}·${sq}²(θ) − ${powText(fn, 'θ', m - 2)}`)}`}.`,
    `The first part is a substitution ${mark(`u = ${fn}(θ)`)} (${mark(`du = ${s}${sq}²(θ) dθ`)}): ${mark(`∫${m - 2 === 0 ? '' : `${powText(fn, 'θ', m - 2)}·`}${sq}²(θ) dθ = ${s}${powText(fn, 'θ', m - 1)}${m - 1 === 1 ? '' : `/${m - 1}`}`)}. So the reduction formula: ${mark(`${I(m)} = ${s}${powText(fn, 'θ', m - 1)}${m - 1 === 1 ? '' : `/${m - 1}`} − ${I(m - 2)}`)}.`,
  ];
  if (m - 2 >= 2) steps.push(`Apply the same formula to ${mark(I(m - 2))}${m - 2 >= 4 ? ', and again,' : ''} down to ${mark(m % 2 === 0 ? I(0) : I(1))}.`);
  steps.push(m % 2 === 0
    ? `The base case: ${mark(`${I(0)} = ∫1 dθ = θ`)}.`
    : `The base case: ${mark(`${I(1)} = ∫${fn}(θ) dθ = ${fn === 'tan' ? '−ln|cos θ|' : 'ln|sin θ|'}`)}.`);
  // Σ (−1)^j · (±)tan^(m−1−2j)/(m−1−2j) + (−1)^(⌈…⌉) · base
  const scale = factorOf(c, k);
  const frac = (num, den) => {
    const g = gcd(Math.abs(num), Math.abs(den)) || 1;
    const [a, b] = [num / g, den / g];
    return b === 1 ? String(a) : `${a}/${b}`;
  };
  const withScale = (num, den) => (Number.isInteger(c) && Number.isInteger(k) ? frac(num * c, den * k) : String((num / den) * scale.value));
  const pieces = [];
  let signJ = 1;
  let p = m;
  while (p >= 2) {
    pieces.push(`${withScale(signJ * sgn, p - 1)}*${fn}(${argRaw})${p - 1 === 1 ? '' : `^${p - 1}`}`);
    signJ = -signJ;
    p -= 2;
  }
  const baseRaw = p === 0 ? `${argRaw}` : (fn === 'tan' ? `log(cos(${argRaw}))` : `log(sin(${argRaw}))`);
  const baseSign = p === 0 ? signJ : (fn === 'tan' ? -signJ : signJ);
  pieces.push(`${withScale(baseSign, 1)}*${baseRaw}`);
  const F = pieces.join(' + ').replace(/\+ -/g, '- ').replace(/(?<![\d/])1\*/g, '');
  if (!derivativeMatchesNumerically(F, term, v)) return null;
  steps.push(`Assemble${k === 1 && c === 1 ? '' : `, with the factor ${mark(scale.text)}`}: ${mark(`∫${coefText(c)}${powText(fn, theta, m)} d${v} = ${lnify(F)}`)}.`);
  return { antiderivative: F, steps, method: 'reduction' };
}
