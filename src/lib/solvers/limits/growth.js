// Growth rates: an exponential outgrows every power of x, and every power of
// x outgrows every power of ln x. These are the contests a course settles with
// L'Hôpital's rule: x³/e^x and x²·e^(−x) as x → ∞, ln(x)/x and x/ln(x) as
// x → ∞, x·ln(x) as x → 0⁺. They were answered by sampling alone ("the values
// settle toward 0"), and x^(1/2)·ln(x) at 0⁺, which settles too slowly to
// sample, was said not to exist (1.63.0).
//
// The form c·x^p·e^(kx)·ln(x)^m is read off the parse tree, so the answer is
// a fact about the expression, not about sample points; the rounds of
// L'Hôpital's rule are worked as a course works them, and a numeric check far
// out confirms the result before it is reported.

import { math, beautify, mark, isAlgebriteFailure } from '../solverUtils.js';
import { evalAt } from './numeric.js';

const unwrap = (n) => (n && n.type === 'ParenthesisNode' ? unwrap(n.content) : n);

// A small rational as { a, b } (b > 0), or null.
function fraction(value) {
  for (let b = 1; b <= 100; b += 1) {
    const a = Math.round(value * b);
    if (Math.abs(value - a / b) < 1e-12) return { a, b };
  }
  return null;
}

const fracText = (value) => {
  const f = fraction(value);
  if (!f) return null;
  return f.b === 1 ? String(f.a) : `${f.a}/${f.b}`;
};

// c·x^p·e^(kx)·ln(x)^m, read from a product and quotient of those factors and
// constants; null for anything else (a sum, sin x, e^(x + 1)).
export function growthForm(func, variable) {
  let tree;
  try { tree = math.parse(func); } catch { return null; }
  const v = variable;
  const acc = { c: 1, p: 0, k: 0, m: 0 };
  const isVar = (n) => n.type === 'SymbolNode' && n.name === v;
  const hasVar = (n) => n.filter((x) => isVar(x)).length > 0;
  const constant = (n) => {
    if (hasVar(n)) return null;
    try { const y = n.evaluate({}); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; }
  };
  const isLn = (n) => n.type === 'FunctionNode' && (n.fn?.name === 'ln' || n.fn?.name === 'log') && n.args.length === 1 && isVar(unwrap(n.args[0]));
  // k·x with no constant term: e^(2x), e^(−x).
  const linear = (n) => {
    const at = (x) => { try { return Number(n.evaluate({ [v]: x })); } catch { return NaN; } };
    const k = at(1);
    return Number.isFinite(k) && k !== 0 && at(0) === 0 && Math.abs(at(2) - 2 * k) < 1e-12 ? k : null;
  };
  const walk = (raw, s) => {
    const n = unwrap(raw);
    const c = constant(n);
    if (c !== null) {
      if (c === 0) return false;
      acc.c *= s > 0 ? c : 1 / c;
      return true;
    }
    if (isVar(n)) { acc.p += s; return true; }
    if (n.type === 'OperatorNode') {
      if (n.fn === 'unaryMinus') { acc.c *= -1; return walk(n.args[0], s); }
      if (n.op === '*') return n.args.every((a) => walk(a, s));
      if (n.op === '/') return walk(n.args[0], s) && walk(n.args[1], -s);
      if (n.op === '^') {
        const base = unwrap(n.args[0]);
        const e = constant(n.args[1]);
        if (isVar(base) && e !== null) { acc.p += s * e; return true; }
        if (isLn(base) && e !== null && Number.isInteger(e) && e > 0) { acc.m += s * e; return true; }
        if (base.type === 'SymbolNode' && base.name === 'e') {
          const k = linear(n.args[1]);
          if (k === null || acc.base) return false;
          acc.k += s * k;
          acc.e = true;
          return true;
        }
        // 2^x, 2^(−x): another base, exponent ±x only, never mixed with e
        // (x/2^x was sampled; 1.63.0 review).
        const b = constant(base);
        if (b !== null && b > 1 && Number.isInteger(b)) {
          const k = linear(n.args[1]);
          if (Math.abs(k) !== 1 || acc.e || (acc.base && acc.base !== b)) return false;
          acc.base = b;
          acc.k += s * k * Math.log(b);
          return true;
        }
      }
      return false;
    }
    if (n.type === 'FunctionNode') {
      if (isLn(n)) { acc.m += s; return true; }
      if (n.fn?.name === 'sqrt' && n.args.length === 1 && isVar(unwrap(n.args[0]))) { acc.p += s / 2; return true; }
      if (n.fn?.name === 'exp' && n.args.length === 1) {
        const k = linear(n.args[0]);
        if (k === null || acc.base) return false;
        acc.e = true;
        acc.k += s * k;
        return true;
      }
    }
    return false;
  };
  if (!walk(tree, 1)) return null;
  const top = unwrap(tree);
  acc.quotient = top.type === 'OperatorNode' && top.op === '/';
  return acc;
}

// --- Display -----------------------------------------------------------------

const power = (q, v) => {
  if (q === 1) return v;
  if (q === 0.5) return `√${v}`;
  return Number.isInteger(q) ? `${v}^${q}` : `${v}^(${fracText(q)})`;
};
const logPower = (n, v) => (n === 1 ? `ln(${v})` : `ln(${v})^${n}`);
const expo = (a, v) => {
  if (a === 1) return `e^${v}`;
  const f = fraction(a);
  return f.b === 1 ? `e^(${f.a}${v})` : `e^(${f.a === 1 ? '' : f.a}${v}/${f.b})`;
};

// An integer coefficient in front of a product of factors: "6x^2", "-ln(x)".
function term(coef, factors) {
  const body = factors.filter(Boolean).join('·');
  if (!body) return String(coef);
  if (coef === 1) return body;
  if (coef === -1) return `-${body}`;
  return `${coef}${body}`;
}
// A denominator stays bare only when it is one factor: 2x/e^x, 1/√x,
// but 3x^2/(2e^(2x)).
const ATOM = /^(?:\d+|[a-z]|\d+\^[a-z]|√[a-z]|e\^[a-z]|[a-z]\^\d+|[a-z]\^\([^()]*\)|e\^\([^()]*\)|ln\([a-z]\)(?:\^\d+)?)$/;
const wrap = (s) => (!ATOM.test(s) && /[+·/]|.-/.test(s) ? `(${s})` : s);
function quotient(num, den) {
  return den === '1' ? num : `${wrap(num)}/${ATOM.test(den) ? den : `(${den})`}`;
}
// c·[numerator factors]/[denominator factors] with c split into integers.
function shown(c, numFactors, denFactors) {
  const f = fraction(c);
  if (!f) return null;
  return quotient(term(f.a, numFactors), term(f.b, denFactors));
}

// --- Verification --------------------------------------------------------------

// Far out (or far in, toward 0⁺) along powers of ten: a 0 claim must shrink
// toward 0, an infinite claim must grow with the right sign.
function verifyGrowth(func, variable, target, claimed) {
  // A point where the pieces overflow (x³ and e^(2x) both Infinity) is
  // skipped; three must remain.
  const points = target === 0 ? [1e-8, 1e-16, 1e-32, 1e-64, 1e-128] : [1e4, 1e8, 1e16, 1e32, 1e64];
  const ys = points.map((x) => evalAt(func, variable, x)).filter((y) => !Number.isNaN(y)).slice(-4);
  if (ys.length < 3) return false;
  while (ys.length < 4) ys.unshift(ys[0]);
  const mags = ys.map(Math.abs);
  if (claimed === 0) {
    return mags[3] < 1e-3 && mags[3] <= mags[2] && mags[2] <= mags[1];
  }
  const want = claimed === '∞' ? 1 : -1;
  // Growing: strictly, with the right sign (ln x is only 147 at 10⁶⁴).
  const up = (a, b) => b > a || (a === Infinity && b === Infinity);
  return mags[3] > 10 && up(mags[2], mags[3]) && up(mags[1], mags[2]) && ys.slice(1).every((y) => Math.sign(y) === want);
}

// --- The technique -------------------------------------------------------------

// side: 1 for x → 0⁺ (or a two-sided limit at 0 where the function is only
// defined on the right; the caller says so). Returns a limit result or null.
export function tryGrowthRates(Algebrite, func, variable, target) {
  const v = variable;
  if (target === -Infinity) return atNegativeInfinity(Algebrite, func, v);
  const g = growthForm(func, v) || (target === Infinity ? polynomialOverExponential(Algebrite, func, v) : null);
  if (!g || !fraction(g.c) || !Number.isFinite(g.p)) return null;
  if (target === Infinity) {
    if (g.k !== 0 && g.p !== 0 && g.m === 0 && Math.sign(g.k) !== Math.sign(g.p)) return exponentialContest(Algebrite, func, v, target, g);
    if (g.k === 0 && g.p !== 0 && g.m !== 0 && Math.sign(g.p) !== Math.sign(g.m) && Number.isInteger(g.m)) return logContest(func, v, target, g);
    return noContest(func, v, target, g);
  }
  if (target === 0 && g.k === 0 && g.p > 0 && Number.isInteger(g.m) && g.m > 0) return zeroTimesInfinity(func, v, g);
  return null;
}

// (x² + 1)/e^x or e^x/(x² + 1): a polynomial of degree d against e^(kx),
// the same contest as x^d; the polynomial itself is differentiated.
function polynomialOverExponential(Algebrite, func, v) {
  if (!Algebrite) return null;
  let top;
  try { top = unwrap(math.parse(func)); } catch { return null; }
  if (!(top.type === 'OperatorNode' && top.op === '/')) return null;
  const [numText, denText] = top.args.map((n) => unwrap(n).toString());
  const isPoly = (t) => new RegExp(`^[0-9${v}+\\-*^(). ]+$`).test(t) && t.includes(v);
  const polyTop = isPoly(numText);
  const poly = polyTop ? numText : denText;
  if (!isPoly(poly)) return null;
  const other = growthForm(polyTop ? denText : numText, v);
  if (!other || other.p !== 0 || other.m !== 0 || other.k <= 0) return null;
  const deg = Number(String(Algebrite.run(`deg(${poly}, ${v})`)).trim());
  const lead = Number(String(Algebrite.run(`float(coeff(${poly}, ${v}, ${deg}))`)).trim());
  if (!Number.isInteger(deg) || deg < 1 || !Number.isFinite(lead) || lead === 0) return null;
  return {
    c: polyTop ? 1 / other.c : other.c,
    p: polyTop ? deg : -deg,
    k: polyTop ? -other.k : other.k,
    m: 0,
    quotient: true,
    poly,
    leadSign: Math.sign(lead),
  };
}

// x^p against e^(kx) as x → ∞. The power side is differentiated by Algebrite,
// ⌈p⌉ rounds, until it no longer grows; the exponential stays a multiple of
// itself.
function exponentialContest(Algebrite, func, v, target, g) {
  if (!Algebrite || !fraction(g.p) || (!g.base && !fraction(Math.abs(g.k)))) return null;
  const powerOnTop = g.p > 0; // x^3/e^x → 0; e^x/x^2 → ∞
  const q = Math.abs(g.p);
  const a = Math.abs(g.k);
  const f = fraction(g.c);
  // c·x^p/e^(ax) is a·x^p over b·e^(ax) (c = a/b); e^(ax)/x^q likewise. The
  // power side is an Algebrite expression, the exponential side a whole-number
  // coefficient on e^(ax), multiplied by a each round (declined when that
  // stops being a whole number).
  let powerSide = `${powerOnTop ? f.a : f.b}*(${g.poly ?? `${v}^(${fracText(q)})`})`;
  let expCoef = powerOnTop ? f.b : f.a;
  // b^x differentiates to ln(b)·b^x: the ln(b) factors are counted, not
  // multiplied into the coefficient.
  let lnFactors = 0;
  const expBody = g.base ? `${g.base}^${v}` : expo(a, v);
  // A fractional coefficient on e^(ax) (e^(x/2) gives 1/2 each round) moves
  // its denominator onto the power side: x/e^(x/2) → 2/e^(x/2).
  const showRound = () => {
    const ef = fraction(expCoef);
    if (!ef) return null;
    const scaled = String(Algebrite.run(ef.b === 1 ? powerSide : `${ef.b}*(${powerSide})`)).trim();
    const ps = beautify(scaled).replace(new RegExp(`(?<![a-z])${v}\\^\\(1/2\\)`, 'g'), `√${v}`);
    const lnText = lnFactors === 0 ? '' : lnFactors === 1 ? `ln(${g.base})` : `ln(${g.base})^${lnFactors}`;
    const expText = term(ef.a, [lnText, expBody]);
    return powerOnTop ? quotient(ps, expText) : quotient(expText, ps);
  };
  const start = showRound();
  if (!start) return null;
  const rounds = [];
  for (let j = 0; j < Math.ceil(q); j += 1) {
    const next = String(Algebrite.run(`d(${powerSide}, ${v})`)).trim();
    if (isAlgebriteFailure(next)) return null;
    powerSide = next;
    if (g.base) lnFactors += 1;
    else expCoef *= a;
    const r = showRound();
    if (!r) return null;
    rounds.push(r);
  }
  const answer = powerOnTop ? 0 : g.c * (g.leadSign ?? 1) > 0 ? '∞' : '-∞';
  const steps = [...opening(func, v, target, g, start)];
  steps.push(`Apply L'Hôpital's rule ${rounds.length === 1 ? 'once' : `${rounds.length} times`}: each round lowers the power of ${mark(v)} by one, and the derivative of ${mark(expBody)} is a multiple of ${mark(expBody)} itself: ${roundList(rounds)}.`);
  steps.push(powerOnTop
    ? `Now the top no longer grows while ${mark(expBody)} ${mark('→ ∞')}, so the quotient ${mark('→ 0')}. The limit is ${mark('0')}: an exponential outgrows every power of ${mark(v)}.`
    : `Now the bottom no longer grows while ${mark(expBody)} ${mark('→ ∞')}, so the quotient ${mark(`→ ${answer}`)}. The limit is ${mark(answer)}: an exponential outgrows every power of ${mark(v)}.`);
  return finish(func, v, target, steps, answer);
}

// x^p against ln(x)^m as x → ∞: each round of L'Hôpital's rule lowers the
// power of ln x by one and leaves the power of x as it was.
function logContest(func, v, target, g) {
  const logOnTop = g.m > 0; // ln(x)^2/x → 0; x/ln(x) → ∞
  const q = Math.abs(g.p);
  const n = Math.abs(g.m);
  if (!fraction(q) || n > 4) return null;
  const at = (c, logs) => (logOnTop
    ? shown(c, [logs > 0 ? logPower(logs, v) : ''], [power(q, v)])
    : shown(c, [power(q, v)], [logs > 0 ? logPower(logs, v) : '']));
  const start = at(g.c, n);
  if (!start) return null;
  const rounds = [];
  let c = g.c;
  for (let logs = n; logs > 0; logs -= 1) {
    // ln(x)^j/x^q → (j/q)·ln(x)^(j−1)/x^q; x^q/ln(x)^j → (q/j)·x^q/ln(x)^(j−1).
    c *= logOnTop ? logs / q : q / logs;
    const r = at(c, logs - 1);
    if (!r) return null;
    rounds.push(r);
  }
  const answer = logOnTop ? 0 : g.c > 0 ? '∞' : '-∞';
  const steps = [...opening(func, v, target, g, start)];
  steps.push(`Apply L'Hôpital's rule ${rounds.length === 1 ? 'once' : `${rounds.length} times`}: the derivative of ${mark(`ln(${v})^j`)} is ${mark(`j·ln(${v})^(j − 1)/${v}`)}, and the extra ${mark(`1/${v}`)} cancels against the derivative of ${mark(power(q, v))}, so each round lowers the power of ${mark(`ln(${v})`)} by one: ${roundList(rounds)}.`);
  steps.push(logOnTop
    ? `A constant over ${mark(power(q, v))} ${mark('→ 0')}. The limit is ${mark('0')}: every power of ${mark(v)} outgrows every power of ${mark(`ln(${v})`)}.`
    : `A constant times ${mark(power(q, v))} ${mark(`→ ${answer}`)}. The limit is ${mark(answer)}: every power of ${mark(v)} outgrows every power of ${mark(`ln(${v})`)}.`);
  return finish(func, v, target, steps, answer);
}

// x^p·ln(x)^m as x → 0⁺ (p > 0): the form 0·(±∞). Written as
// ln(x)^m/x^(−p) it is ∞/∞, and each round of L'Hôpital's rule turns it into
// −(m/p)·x^p·ln(x)^(m−1), the same contest with one power of ln x fewer.
function zeroTimesInfinity(func, v, g) {
  const p = g.p;
  if (!fraction(p) || g.m > 4) return null;
  const product = (c, logs) => shown(c, [power(p, v), logs > 0 ? logPower(logs, v) : ''], []);
  if (!product(g.c, g.m)) return null;
  const rounds = [];
  let c = g.c;
  for (let logs = g.m; logs > 0; logs -= 1) {
    c *= -logs / p;
    const r = product(c, logs - 1);
    if (!r) return null;
    rounds.push(r);
  }
  const negPower = `${v}^(${fracText(-p)})`;
  const steps = [
    `As ${mark(`${v} → 0⁺`)}, ${mark(power(p, v))} ${mark('→ 0')} while ${mark(logPower(g.m, v))} ${mark(`→ ${g.m % 2 ? '−∞' : '∞'}`)}: the form ${mark('0·∞')}, which on its own says nothing.`,
    `Rewrite the product as a quotient, ${mark(quotient(term(fraction(g.c).a, [logPower(g.m, v)]), term(fraction(g.c).b, [negPower])))}, which is ${mark('∞/∞')}.`,
    `Apply L'Hôpital's rule: the derivative of ${mark(`ln(${v})^j`)} is ${mark(`j·ln(${v})^(j − 1)/${v}`)} and of ${mark(negPower)} is ${mark(shown(-p, [`${v}^(${fracText(-p - 1)})`], []))}, so each round gives back a power of ${mark(v)} with one power of ${mark(`ln(${v})`)} fewer: ${roundList(rounds)}.`,
    `${mark(rounds[rounds.length - 1])} ${mark('→ 0')} as ${mark(`${v} → 0⁺`)}. The limit is ${mark('0')}: near ${mark('0')}, a power of ${mark(v)} shrinks faster than a power of ${mark(`ln(${v})`)} grows in size.`,
  ];
  return finish(func, v, 0, steps, 0);
}

// Does c·x^p·e^(kx)·ln(x)^m grow without bound as x → ∞?
export const grows = (f) => Boolean(f) && (f.k > 0 || (f.k === 0 && (f.p > 0 || (f.p === 0 && f.m > 0))));

// The rounds in order; ten rounds of x^10/e^x show the first two and the last.
function roundList(rounds) {
  const shownRounds = rounds.length > 4 ? [rounds[0], rounds[1], null, rounds[rounds.length - 1]] : rounds;
  return shownRounds.map((r) => (r === null ? '…' : mark(r))).join(', then ').replace(', then …, then', ', …, then');
}

// Every factor pulls the same way as x → ∞ (e^(−x), e^(−x)/x, x²·e^x): no
// indeterminate form, so the limit is read off directly. e^(−x) was sampled.
function noContest(func, v, target, g) {
  if (g.poly || !Number.isInteger(g.m)) return null;
  const parts = [];
  if (g.p !== 0) parts.push({ dir: Math.sign(g.p), text: power(Math.abs(g.p), v) });
  if (g.k !== 0) parts.push({ dir: Math.sign(g.k), text: g.base ? `${g.base}^${v}` : expo(Math.abs(g.k), v) });
  if (g.m !== 0) parts.push({ dir: Math.sign(g.m), text: logPower(Math.abs(g.m), v) });
  if (!parts.length || parts.some((x) => x.dir !== parts[0].dir) || parts.some((x) => !x.text)) return null;
  const shrinks = parts[0].dir < 0;
  const answer = shrinks ? 0 : g.c > 0 ? '∞' : '-∞';
  const rewritten = shrinks ? shown(g.c, [], parts.map((x) => x.text)) : shown(g.c, parts.map((x) => x.text), []);
  if (!rewritten) return null;
  const growing = parts.length === 1 ? `${mark(parts[0].text)} grows` : `${parts.map((x) => mark(x.text)).join(' and ')} both grow`;
  const same = !shrinks || noSpaces(beautify(func)) === noSpaces(rewritten);
  const steps = [
    `${same ? `As ${mark(`${v} → ∞`)}` : `Write it as ${mark(rewritten)}. As ${mark(`${v} → ∞`)}`}, ${growing} without bound, and nothing pulls the other way: this is not an indeterminate form.`,
    shrinks
      ? `A constant over something that grows without bound ${mark('→ 0')}, so the limit is ${mark('0')}.`
      : `So ${mark(rewritten)} ${mark(`→ ${answer}`)}: the limit is ${mark(answer)}.`,
  ];
  return { steps, answer: String(answer), verified: verifyGrowth(func, v, target, answer), verificationMethod: 'growth (no indeterminate form) + numeric check' };
}

const noSpaces = (t) => String(t).replace(/\s+/g, '').replace(/·/g, '*');

function opening(func, v, target, g, start) {
  const toward = target === Infinity ? '∞' : '−∞';
  const top = unwrap(math.parse(func));
  if (g.poly) return [`As ${mark(`${v} → ${toward}`)}, the top and the bottom both grow without bound: the form ${mark('∞/∞')}, which on its own says nothing.`];
  if (g.quotient && grows(growthForm(top.args[0].toString(), v)) && grows(growthForm(top.args[1].toString(), v))) {
    return [`As ${mark(`${v} → ${toward}`)}, the top and the bottom both grow without bound: the form ${mark('∞/∞')}, which on its own says nothing.`];
  }
  return [
    `As ${mark(`${v} → ${toward}`)}, one factor grows without bound while the other shrinks to ${mark('0')}: the form ${mark('∞·0')}, which on its own says nothing.`,
    `Rewrite it as a quotient whose top and bottom both grow: ${mark(start)}, the form ${mark('∞/∞')}.`,
  ];
}

function finish(func, v, target, steps, answer) {
  return {
    steps,
    answer: String(answer),
    verified: verifyGrowth(func, v, target, answer),
    verificationMethod: 'growth rates (L\'Hôpital\'s rule) + numeric check',
  };
}

// 0⁰ by logarithms: (x^a)^E with E = c·x^p (p > 0) as x → 0⁺. For x > 0 it
// is e^(E·a·ln x), and E·a·ln x is the 0·∞ contest above, → 0, so the limit
// is e^0 = 1. x^x was settled by samples alone (1.63.0 review).
export function tryZeroToZero(func, variable) {
  const v = variable;
  let top;
  try { top = unwrap(math.parse(func)); } catch { return null; }
  if (!(top.type === 'OperatorNode' && top.op === '^')) return null;
  const base = growthForm(top.args[0].toString(), v);
  const expText = top.args[1].toString();
  const exponent = growthForm(expText, v);
  if (!base || !exponent || base.c !== 1 || base.k !== 0 || base.m !== 0 || !(base.p > 0)) return null;
  if (exponent.k !== 0 || exponent.m !== 0 || !(exponent.p > 0) || !fraction(base.p * exponent.c)) return null;
  const lnBase = base.p === 1 ? `ln(${v})` : `${fracText(base.p)}·ln(${v})`;
  const inner = `${base.p * exponent.c}*${v}^(${fracText(exponent.p)})*ln(${v})`;
  const contest = tryGrowthRates(null, inner, v, 0);
  if (!contest || !contest.verified) return null;
  const f = beautify(func);
  const product = shown(base.p * exponent.c, [power(exponent.p, v), `ln(${v})`], []);
  const steps = [
    `Direct substitution gives ${mark('0^0')}: an indeterminate form, not ${mark('1')}.`,
    `Take logarithms: for ${mark(`${v} > 0`)}, ${mark(`${f} = e^(${beautify(expText)}·${lnBase})`)}, so the limit of the exponent, ${mark(product)}, decides.`,
    ...contest.steps.slice(0, -1),
    `So ${mark(`${product} → 0`)}, and ${mark(`${f} → e^0 = 1`)}. The limit is ${mark('1')}.`,
  ];
  return { steps, answer: '1', verified: verifyOne(func, v), verificationMethod: 'logarithms (0⁰) + numeric check' };
}

function verifyOne(func, v) {
  const ys = [1e-6, 1e-12, 1e-24].map((x) => evalAt(func, v, x));
  return ys.every(Number.isFinite) && Math.abs(ys[2] - 1) < 1e-3 && Math.abs(ys[2] - 1) <= Math.abs(ys[0] - 1);
}

// c·x^p·ln(x)^m as x → 0⁺ where nothing pulls the other way: ln(x), ln(x)/x,
// 1/(x·ln(x)^2). ln(x) → −∞ is proved, not sampled: ln is increasing and
// ln(e^(−M)) = −M, so ln(x) < −M once 0 < x < e^(−M) (1.63.0 review).
export function tryNoContestAtZero(func, variable) {
  const v = variable;
  const g = growthForm(func, v);
  if (!g || g.k !== 0 || !Number.isInteger(g.m) || g.m === 0 || !fraction(g.c) || !fraction(g.p)) return null;
  const powerBig = g.p < 0;
  const logBig = g.m > 0;
  if (g.p !== 0 && powerBig !== logBig) return null; // x·ln(x) is a contest
  const big = logBig;
  const sign = Math.sign(g.c) * (Math.abs(g.m) % 2 ? -1 : 1);
  const answer = big ? (sign > 0 ? '∞' : '-∞') : 0;
  const lnPow = logPower(Math.abs(g.m), v);
  const lnGoes = Math.abs(g.m) % 2 ? '−∞' : '∞';
  const steps = [
    `As ${mark(`${v} → 0⁺`)}, ${mark(`ln(${v}) → −∞`)}: ${mark('ln')} is increasing and ${mark('ln(e^(−M)) = −M')}, so ${mark(`ln(${v}) < −M`)} once ${mark(`0 < ${v} < e^(−M)`)}, for every ${mark('M')}.${Math.abs(g.m) > 1 && g.p !== 0 ? ` So ${mark(`${lnPow} → ${lnGoes}`)}.` : ''}`,
  ];
  if (g.p !== 0) steps.push(`${mark(power(Math.abs(g.p), v))} ${mark('→ 0')} through positive values, so ${g.p < 0 ? `${mark(`1/${power(-g.p, v)}`)} ${mark('→ ∞')}` : `${mark(power(g.p, v))} shrinks`}: both parts pull the same way, so this is not an indeterminate form.`);
  steps.push(big
    ? `So ${mark(beautify(func))} ${mark(`→ ${answer}`)}: the limit is ${mark(answer)}.`
    : `So ${mark(beautify(func))} ${mark('→ 0')}: the limit is ${mark('0')}.`);
  const verified = (() => {
    const ys = [1e-8, 1e-16, 1e-32, 1e-64].map((x) => evalAt(func, v, x));
    if (!ys.every((y) => !Number.isNaN(y))) return false;
    const mags = ys.map(Math.abs);
    if (!big) return mags[3] < 1e-2 && mags[3] < mags[1];
    return mags[3] > mags[2] && mags[2] > mags[1] && ys.every((y) => Math.sign(y) === sign);
  })();
  return { steps, answer: String(answer), verified, verificationMethod: 'growth (no indeterminate form) + numeric check' };
}

// x → −∞: let t = −x, so t → ∞ and the same contests apply. x·e^x is
// −t·e^(−t) = −t/e^t → 0, approached from below. Every exponential at −∞
// was sampled (1.63.0, second review).
function atNegativeInfinity(Algebrite, func, v) {
  const t = v === 't' ? 'u' : 't';
  let tree;
  try { tree = math.parse(func); } catch { return null; }
  // x^n becomes ±t^n (even or odd n), any other x becomes (−t).
  const T = () => new math.SymbolNode(t);
  const neg = (node) => new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [node]));
  const swapped = tree.transform((n) => {
    if (n.type === 'OperatorNode' && n.op === '^' && unwrap(n.args[0]).type === 'SymbolNode' && unwrap(n.args[0]).name === v) {
      const e = Number(n.args[1].toString());
      if (Number.isInteger(e)) {
        const power = new math.OperatorNode('^', 'pow', [T(), new math.ConstantNode(e)]);
        return e % 2 ? neg(power) : power;
      }
    }
    return n.type === 'SymbolNode' && n.name === v ? neg(T()) : n;
  });
  const text = swapped.toString();
  const inner = tryGrowthRates(Algebrite, text, t, Infinity);
  if (!inner || !inner.verified) return null;
  const f = beautify(func);
  const flipped = beautify(String(Algebrite ? Algebrite.run(`simplify(${text})`) : text).trim().replace(/exp\(([^()]*)\)/g, 'e^($1)').replace(/e\^\(([a-z])\)/g, 'e^$1'));
  const steps = [
    `Let ${mark(`${t} = −${v}`)}: as ${mark(`${v} → −∞`)}, ${mark(`${t} → ∞`)}, and ${mark(`${f} = ${/nil|Stop|error/i.test(flipped) ? beautify(text) : flipped}`)}. The question is now one at ${mark('+∞')}.`,
    ...inner.steps,
  ];
  // Which side of 0 the values come from: −t/e^t is negative for every t > 0.
  const far = evalAt(func, v, -50);
  if (inner.answer === '0' && Number.isFinite(far) && far !== 0) {
    steps.push(`${mark(f)} is ${far < 0 ? 'negative' : 'positive'} for large negative ${mark(v)}, so it approaches ${mark('0')} from ${far < 0 ? 'below' : 'above'}.`);
  }
  const verified = (() => {
    const ys = [-1e2, -1e3, -1e4, -1e8].map((x) => evalAt(func, v, x)).filter((y) => !Number.isNaN(y));
    if (ys.length < 3) return false;
    if (inner.answer === '0') return Math.abs(ys[ys.length - 1]) < 1e-3 && Math.abs(ys[1]) <= Math.abs(ys[0]);
    const want = inner.answer === '∞' ? 1 : -1;
    return ys.every((y) => Math.sign(y) === want) && Math.abs(ys[ys.length - 1]) >= Math.abs(ys[0]);
  })();
  return { ...inner, steps, verified, substitution: { t, from: f, approach: far < 0 ? 'below' : 'above' } };
}
