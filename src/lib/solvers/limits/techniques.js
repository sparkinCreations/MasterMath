// The named techniques, each verified numerically before it is reported:
// standard limits, the squeeze theorem, 1^∞ by logarithms, the conjugate,
// factor and cancel, leading terms at infinity, Algebrite's simplification,
// Taylor series and L'Hôpital's rule.

import {
  math,
  beautify,
  formatNumber,
  hasVariable,
  isAlgebriteFailure,
  stripOuterParens,
  mark,
  absBars,
} from '../solverUtils.js';
// A limit at a trig asymptote (tan x at π/2) is recognised by the trig code.
import { EXPLODED_MAGNITUDE } from '../trigonometrySolver.js';
import { evalAt } from './numeric.js';

// --- Symbolic rungs ---------------------------------------------------------

// Turn an Algebrite output string into a finite JS number, or null. Algebrite
// returns strings like "1/2", "-1/6", "3"; a symbolic result still containing
// the variable means "not resolved", so we reject it. An exploded magnitude is
// rejected too — substituting a float at a vertical asymptote (tan at pi/2)
// yields rounding noise like 1.6e16, not a real value, and accepting it would
// re-introduce the float-blow-up answer the asymptote handling exists to stop.
// Rejecting it lets the ladder fall through to the numeric rung, which reports
// one-sided divergence correctly.
function algebriteNumber(Algebrite, expr, variable, at) {
  try {
    const wrapped = at === undefined ? expr : `subst(${at}, ${variable}, ${expr})`;
    const raw = String(Algebrite.run(`float(${wrapped})`)).trim();
    if (isAlgebriteFailure(raw)) return null;
    if (new RegExp(`\\b${variable}\\b`).test(raw)) return null;
    const n = Number(raw);
    return Number.isFinite(n) && Math.abs(n) < EXPLODED_MAGNITUDE ? n : null;
  } catch {
    return null;
  }
}

// The exact (non-float) value of an expression at a point, as a clean display
// string, or null. This is what lets a removable limit read -1/6 instead of
// the rounded -0.1667: Algebrite computes the rational directly.
function algebriteExactAt(Algebrite, expr, variable, at) {
  try {
    const raw = String(Algebrite.run(`simplify(subst(${at}, ${variable}, ${expr}))`)).trim();
    if (isAlgebriteFailure(raw)) return null;
    if (new RegExp(`\\b${variable}\\b`).test(raw)) return null; // unresolved
    return raw;
  } catch {
    return null;
  }
}

// Prefer a clean exact form (a fraction or a symbolic constant like π/2 or
// √2) over the decimal, but only when it is genuinely exact and compact —
// never dress a rounded decimal up as if it were exact. Falls back to the
// numeric value otherwise. The numeric value is still what gets verified.
function formatLimitAnswer(numeric, exactRaw) {
  if (exactRaw) {
    const pretty = beautify(exactRaw).replace(/\bpi\b/g, 'π').replace(/\s+/g, ' ').trim();
    const isPlainInt = /^-?\d+$/.test(pretty);
    const isDecimal = /^-?\d+\.\d+$/.test(pretty);
    // Use exact only when it carries structure a decimal can't: a fraction,
    // a root, or a symbolic constant. A bare integer/decimal adds nothing.
    if (!isPlainInt && !isDecimal && pretty.length <= 16 && /[/a-zπ√^]/i.test(pretty)) {
      // Confirm the exact form actually matches the verified numeric value,
      // so a mis-simplification can never masquerade as a tidy fraction.
      try {
        const check = Number(math.evaluate(pretty.replace(/π/g, 'pi')));
        if (Number.isFinite(check) && Math.abs(check - numeric) < 1e-6 * (1 + Math.abs(numeric))) {
          return pretty;
        }
      } catch {
        // fall through to the numeric form
      }
    }
  }
  return formatNumber(numeric);
}

// --- Named techniques ---------------------------------------------------------
// The ladder below (simplify → Taylor → L'Hôpital) gets the right number for
// sin(3x)/x or (√(x+1) − 1)/x, but narrates a Taylor series where a calculus
// course says "standard limit" or "multiply by the conjugate". These matchers
// run first and produce the course's technique; every one is verified
// numerically exactly like the ladder rungs, and any that does not match or
// verify simply falls through. (Roadmap 2026-09 item 3.)

const noSpaces = (s) => String(s).replace(/\s+/g, '');

// "3*x" / "3x" / "x" → 3, 1; anything else → null.
function linearCoefficient(term, variable) {
  const m = noSpaces(term).match(new RegExp(`^\\(?(-?\\d+(?:\\.\\d+)?)?\\*?${variable}\\)?$`));
  if (!m) return null;
  if (m[1] === undefined) return 1;
  if (m[1] === '-') return -1;
  return Number(m[1]);
}

// Exact display for a rational value: "3/2", "-1/4", "3"; null if not a
// small rational.
function rationalText(value) {
  if (Number.isInteger(value)) return String(value);
  for (let q = 2; q <= 1000; q += 1) {
    const p = Math.round(value * q);
    if (Math.abs(value - p / q) < 1e-12) return `${p}/${q}`;
  }
  return null;
}

// The exact text of a whole function call at the start of s ("sqrt(x+1)" from
// "sqrt(x+1)-1"): returns { arg, end } or null.
function leadingCall(s, name) {
  if (!s.startsWith(`${name}(`)) return null;
  let depth = 0;
  for (let i = name.length; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return { arg: s.slice(name.length + 1, i), end: i + 1 };
    }
  }
  return null;
}

const isWholeSqrt = (t) => { const c = leadingCall(noSpaces(t), 'sqrt'); return Boolean(c && c.end === noSpaces(t).length); };

// Split "left ± right" at the top-level sign (never the leading sign of a
// term, never inside parentheses). Returns { left, sign, right } or null.
function splitTopLevelSum(expr) {
  const s = noSpaces(expr);
  let depth = 0;
  for (let i = 1; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && (ch === '+' || ch === '-') && !/[*/^(]/.test(s[i - 1])) {
      return { left: s.slice(0, i), sign: ch, right: s.slice(i + 1) };
    }
  }
  return null;
}

function isPolynomial(expr, variable) {
  const s = noSpaces(expr);
  return s.length > 0 && new RegExp(`^[0-9${variable}+\\-*^().]+$`).test(s);
}

export function tryNamedTechnique(Algebrite, func, variable, target) {
  const attempts = [
    () => tryStandardLimit(func, variable, target),
    () => trySqueezeAtZero(func, variable, target),
    () => tryOneToInfinity(Algebrite, func, variable, target),
    () => (Algebrite ? tryConjugate(Algebrite, func, variable, target) : null),
    () => (Algebrite ? tryFactorAndCancel(Algebrite, func, variable, target) : null),
  ];
  for (const attempt of attempts) {
    try {
      const r = attempt();
      if (r && r.verified) return r;
    } catch { /* next technique */ }
  }
  return null;
}

// sin(kx)/(mx), tan(kx)/(mx) → k/m; (1 − cos(kx))/(mx²) → k²/(2m);
// (1 − cos(kx))/(mx) → 0. All at x → 0.
function tryStandardLimit(func, variable, target) {
  if (target !== 0) return null;
  const parts = splitQuotient(func);
  if (!parts) return null;
  const num = noSpaces(parts.num);
  const den = noSpaces(parts.den);
  const v = variable;

  const trig = leadingCall(num, 'sin') || leadingCall(num, 'tan');
  const fn = num.startsWith('sin(') ? 'sin' : 'tan';
  if (trig && trig.end === num.length) {
    const k = linearCoefficient(trig.arg, v);
    const m = linearCoefficient(den, v);
    if (k === null || m === null || k === 0 || m === 0) return null;
    const value = k / m;
    const shown = formatLimitAnswer(value, rationalText(value));
    const u = k === 1 ? v : `${formatNumber(k)}${v}`;
    const steps = [
      `Direct substitution gives ${mark('0/0')}. This is the standard limit ${mark(`${fn}(u)/u → 1`)} as ${mark('u → 0')}.`,
    ];
    if (k !== 1 || m !== 1) {
      steps.push(`Rewrite so the argument matches the denominator: ${mark(`${fn}(${u})/${beautify(den)} = (${rationalText(value) ?? formatNumber(value)}) · ${fn}(${u})/(${u})`)}. With ${mark(`u = ${u}`)}, ${mark('u → 0')} as ${mark(`${v} → 0`)}.`);
    }
    steps.push(`${mark(`${fn}(${u})/(${u}) → 1`)}, so the limit is ${mark(shown)}.`);
    return { steps, answer: shown, verified: verifyLimitNumerically(func, v, target, value), verificationMethod: 'standard limit + numeric check' };
  }

  const cosForm = num.match(/^1-cos\((.+)\)$/);
  if (cosForm) {
    const k = linearCoefficient(cosForm[1], v);
    if (k === null || k === 0) return null;
    const square = den.match(new RegExp(`^\\(?(-?\\d+(?:\\.\\d+)?)?\\*?${v}\\^2\\)?$`));
    const linear = linearCoefficient(den, v);
    if (square) {
      const m = square[1] === undefined ? 1 : Number(square[1]);
      if (m === 0) return null;
      const value = (k * k) / (2 * m);
      const shown = formatLimitAnswer(value, rationalText(value));
      const u = k === 1 ? v : `${formatNumber(k)}${v}`;
      const steps = [
        `Direct substitution gives ${mark('0/0')}. This is the standard limit ${mark('(1 − cos u)/u² → 1/2')} as ${mark('u → 0')} — which comes from the sine limit:`,
        `Use the half-angle identity ${mark('1 − cos(u) = 2sin²(u/2)')}. Then ${mark('(1 − cos(u))/u² = 2sin²(u/2)/u² = (1/2)·[sin(u/2)/(u/2)]²')}.`,
        `As ${mark('u → 0')}, ${mark('u/2 → 0')} too, so ${mark('sin(u/2)/(u/2) → 1')} (the standard limit ${mark('sin(w)/w → 1')}), and the bracket squared ${mark('→ 1')}. Hence ${mark('(1 − cos u)/u² → 1/2')}.`,
      ];
      if (k !== 1 || m !== 1) steps.push(`With ${mark(`u = ${u}`)}: ${mark(`(1 − cos(${u}))/${beautify(den)} = (${rationalText((k * k) / m) ?? formatNumber((k * k) / m)}) · (1 − cos(${u}))/(${u})²`)}.`);
      steps.push(`${mark(`(1 − cos(${u}))/(${u})² → 1/2`)}, so the limit is ${mark(shown)}.`);
      return { steps, answer: shown, verified: verifyLimitNumerically(func, v, target, value), verificationMethod: 'standard limit + numeric check' };
    }
    if (linear !== null && linear !== 0) {
      const u = k === 1 ? v : `${formatNumber(k)}${v}`;
      const steps = [
        `Direct substitution gives ${mark('0/0')}. This is the standard limit ${mark('(1 − cos u)/u → 0')} as ${mark('u → 0')}.`,
        `With ${mark(`u = ${u}`)}, ${mark(`(1 − cos(${u}))/${beautify(den)}`)} is a constant multiple of ${mark(`(1 − cos(${u}))/(${u})`)}, which ${mark('→ 0')}. So the limit is ${mark('0')}.`,
      ];
      return { steps, answer: '0', verified: verifyLimitNumerically(func, v, target, 0), verificationMethod: 'standard limit + numeric check' };
    }
  }
  return null;
}

// x^n · sin(1/x) or x^n · cos(1/x) at 0: bounded times something → 0.
function trySqueezeAtZero(func, variable, target) {
  if (target !== 0) return null;
  const s = noSpaces(func);
  const v = variable;
  const m = s.match(new RegExp(`^${v}(?:\\^(\\d+))?\\*(sin|cos)\\(1/${v}\\)$`)) || s.match(new RegExp(`^(sin|cos)\\(1/${v}\\)\\*${v}(?:\\^(\\d+))?$`));
  if (!m) return null;
  const fn = m[2] && /sin|cos/.test(m[2]) ? m[2] : m[1];
  const nText = (m[1] && /^\d+$/.test(m[1])) ? m[1] : (m[2] && /^\d+$/.test(m[2]) ? m[2] : '1');
  const power = nText === '1' ? v : `${v}^${nText}`;
  const steps = [
    `${mark(`${fn}(1/${v})`)} oscillates faster and faster as ${mark(`${v} → 0`)} and has no limit of its own — but it is bounded: ${mark(`−1 ≤ ${fn}(1/${v}) ≤ 1`)}.`,
    `Multiply through by ${mark(`|${power}|`)}: ${mark(`−|${power}| ≤ ${power}·${fn}(1/${v}) ≤ |${power}|`)}.`,
    `Both bounds ${mark('→ 0')} as ${mark(`${v} → 0`)}, so by the squeeze theorem the limit is ${mark('0')}.`,
  ];
  return { steps, answer: '0', verified: verifyLimitNumerically(func, v, target, 0), verificationMethod: 'squeeze theorem + numeric check' };
}

// (√A ± B)/C or C/(√A ± B) that is 0/0: multiply by the conjugate.
function tryConjugate(Algebrite, func, variable, target) {
  const parts = splitQuotient(func);
  if (!parts) return null;
  const v = variable;
  const numAt = algebriteNumber(Algebrite, `(${parts.num})`, v, target);
  const denAt = algebriteNumber(Algebrite, `(${parts.den})`, v, target);
  if (numAt !== 0 || denAt !== 0) return null;

  const attempt = (radicalSide, otherSide, radicalIsNumerator) => {
    const sum = splitTopLevelSum(radicalSide);
    if (!sum || !(isWholeSqrt(sum.left) || isWholeSqrt(sum.right))) return null;
    const conjugate = `${sum.left}${sum.sign === '-' ? '+' : '-'}${sum.right}`;
    const product = String(Algebrite.run(`simplify((${sum.left})^2-(${sum.right})^2)`)).trim();
    if (isAlgebriteFailure(product)) return null;
    const rewritten = radicalIsNumerator
      ? `(${product})/((${otherSide})*(${conjugate}))`
      : `((${otherSide})*(${conjugate}))/(${product})`;
    const simplified = String(Algebrite.run(`simplify(${rewritten})`)).trim();
    if (isAlgebriteFailure(simplified)) return null;
    const value = algebriteNumber(Algebrite, `(${simplified})`, v, target);
    if (value === null) return null;
    const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `(${simplified})`, v, target));
    const where = radicalIsNumerator ? 'numerator' : 'denominator';
    const steps = [
      `Direct substitution gives ${mark('0/0')}. The ${where} is a difference involving a square root, so multiply top and bottom by its conjugate, ${mark(beautify(conjugate))}.`,
      `${mark('(a − b)(a + b) = a² − b²')}, so the ${where} becomes ${mark(beautify(product))} — the square root is gone.`,
      `Cancel the common factor: the expression simplifies to ${mark(beautify(simplified))}.`,
      `Substitute ${mark(`${v} = ${formatNumber(target)}`)}: the limit is ${mark(shown)}.`,
    ];
    return { steps, answer: shown, verified: verifyLimitNumerically(func, v, target, value), verificationMethod: 'conjugate + numeric check' };
  };
  return attempt(parts.num, parts.den, true) || attempt(parts.den, parts.num, false);
}

// P(x)/Q(x), both polynomials vanishing at a: factor, cancel (x − a), substitute.
function tryFactorAndCancel(Algebrite, func, variable, target) {
  const parts = splitQuotient(func);
  if (!parts) return null;
  const v = variable;
  if (!isPolynomial(parts.num, v) || !isPolynomial(parts.den, v)) return null;
  const numAt = algebriteNumber(Algebrite, `(${parts.num})`, v, target);
  const denAt = algebriteNumber(Algebrite, `(${parts.den})`, v, target);
  if (numAt !== 0 || denAt !== 0) return null;
  const root = rationalText(target);
  if (root === null) return null;

  const factoredNum = String(Algebrite.run(`factor(${parts.num})`)).trim();
  const factoredDen = String(Algebrite.run(`factor(${parts.den})`)).trim();
  if (isAlgebriteFailure(factoredNum) || isAlgebriteFailure(factoredDen)) return null;
  const factorText = target < 0 ? `${v}+${rationalText(-target)}` : `${v}-${root}`;
  const has = (t) => noSpaces(t).includes(factorText);
  if (!has(factoredNum) || !has(factoredDen)) return null;

  const cancelled = String(Algebrite.run(`simplify((${parts.num})/(${parts.den}))`)).trim();
  if (isAlgebriteFailure(cancelled)) return null;
  const value = algebriteNumber(Algebrite, `(${cancelled})`, v, target);
  if (value === null) return null;
  const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `(${cancelled})`, v, target));
  const factorShown = target < 0 ? `${v} + ${rationalText(-target)}` : `${v} − ${root}`;
  const steps = [
    `Direct substitution gives ${mark('0/0')}, so factor the numerator and the denominator.`,
    `Numerator: ${mark(beautify(factoredNum))}.  Denominator: ${mark(beautify(factoredDen))}.`,
    `Both contain the factor ${mark(`(${factorShown})`)}, which is what makes the ${mark('0/0')}. Cancel it: ${mark(beautify(cancelled))}.`,
    `Cancelling is allowed only for ${mark(`${v} ≠ ${formatNumber(target)}`)}: at ${mark(`${v} = ${formatNumber(target)}`)} the factor is ${mark('0')}, and ${mark('0/0')} has no value. That is fine here, because a limit asks what the function approaches for ${mark(v)} NEAR ${mark(formatNumber(target))}, never at it — and away from ${mark(formatNumber(target))} the original and ${mark(beautify(cancelled))} are the same function.`,
    `Now substitute ${mark(`${v} = ${formatNumber(target)}`)} into the simplified form: the limit is ${mark(shown)}. On a graph the original is the curve ${mark(beautify(cancelled))} with a single hole at ${mark(`(${formatNumber(target)}, ${shown})`)} — a removable discontinuity.`,
  ];
  return { steps, answer: shown, verified: verifyLimitNumerically(func, v, target, value), verificationMethod: 'factor and cancel + numeric check' };
}

// Numeric check for a limit at ±∞: a finite claim must be approached, an
// infinite claim must be exceeded with the right sign.
function verifyInfiniteLimit(func, variable, target, claimed) {
  const sign = target === Infinity ? 1 : -1;
  const samples = [1e4, 1e6, 1e8].map((m) => evalAt(func, variable, sign * m));
  if (typeof claimed === 'number') {
    if (!samples.every(Number.isFinite)) return false;
    const gaps = samples.map((y) => Math.abs(y - claimed));
    return gaps[2] < 1e-3 * (1 + Math.abs(claimed)) && gaps[2] <= gaps[1] + 1e-12 && gaps[1] <= gaps[0] + 1e-12;
  }
  const want = claimed === '∞' ? 1 : -1;
  const mags = samples.map((y) => (Number.isFinite(y) ? Math.abs(y) : Infinity));
  const signs = samples.map((y) => (Number.isFinite(y) ? Math.sign(y) : want));
  return mags[2] > 1e6 && mags[2] >= mags[1] && mags[1] >= mags[0] && signs.every((s) => s === want);
}

// P(x)/Q(x) (or a bare polynomial) as x → ±∞: compare degrees and leading
// coefficients — the technique every course teaches for this case.
export function tryLeadingTerms(Algebrite, func, variable, target) {
  const v = variable;
  const parts = splitQuotient(func) || (isPolynomial(func, v) ? { num: stripOuterParens(func), den: '1' } : null);
  if (!parts || !isPolynomial(parts.num, v) || !isPolynomial(parts.den, v)) return null;
  const degree = (p) => { const d = Number(String(Algebrite.run(`deg(${p}, ${v})`)).trim()); return Number.isInteger(d) && d >= 0 ? d : null; };
  const lead = (p, d) => String(Algebrite.run(`coeff(${p}, ${v}, ${d})`)).trim();
  const dn = degree(parts.num);
  const dd = degree(parts.den);
  if (dn === null || dd === null || (dn === 0 && dd === 0)) return null;
  const cn = lead(parts.num, dn);
  const cd = lead(parts.den, dd);
  if (isAlgebriteFailure(cn) || isAlgebriteFailure(cd) || Number(math.evaluate(cd)) === 0) return null;
  const toward = target === Infinity ? '∞' : '−∞';
  const pow = (d) => (d === 1 ? v : `${v}^${d}`);
  const method = 'leading terms + numeric check';

  if (dn < dd) {
    const steps = [
      `For a limit at ${toward}, only the highest powers matter. The numerator has degree ${dn} and the denominator degree ${dd}.`,
      `Divide numerator and denominator by ${mark(pow(dd))}: every numerator term becomes a multiple of ${mark(`1/${v}^k`)} and ${mark('→ 0')}, while the denominator ${mark(`→ ${beautify(cd)}`)}.`,
      'So the limit is 0 — the denominator grows faster.',
    ];
    return { steps, answer: '0', verified: verifyInfiniteLimit(func, v, target, 0), verificationMethod: method };
  }
  if (dn === dd) {
    const ratioRaw = String(Algebrite.run(`simplify((${cn})/(${cd}))`)).trim();
    const value = Number(math.evaluate(ratioRaw));
    if (!Number.isFinite(value)) return null;
    const exact = rationalText(value);
    const shown = exact && !Number.isInteger(value) ? `${exact} (≈ ${formatNumber(value)})` : formatNumber(value);
    const steps = [
      `For a limit at ${toward}, only the highest powers matter. Numerator and denominator both have degree ${dn}.`,
      `Divide numerator and denominator by ${mark(pow(dn))}: every lower term becomes a multiple of ${mark(`1/${v}^k`)} and ${mark('→ 0')}, leaving the leading coefficients ${mark(`${beautify(cn)}/${beautify(cd)}`)}.`,
      `So the limit is ${mark(shown)}.`,
    ];
    return { steps, answer: shown, verified: verifyInfiniteLimit(func, v, target, value), verificationMethod: method };
  }
  const ratioSign = Math.sign(Number(math.evaluate(cn)) / Number(math.evaluate(cd)));
  const parity = (dn - dd) % 2 === 1 && target === -Infinity ? -1 : 1;
  const answer = ratioSign * parity > 0 ? '∞' : '-∞';
  const steps = [
    `For a limit at ${toward}, only the highest powers matter. The numerator has degree ${dn}, the denominator degree ${dd}.`,
    `Divide numerator and denominator by ${mark(pow(dd))}: the quotient behaves like ${mark(`(${beautify(cn)}/${beautify(cd)})·${pow(dn - dd)}`)}, which grows without bound.`,
    `As ${mark(`${v} → ${toward}`)}, that goes to ${mark(answer)}, so the limit is ${mark(answer)}.`,
  ];
  return { steps, answer, verified: verifyInfiniteLimit(func, v, target, answer), verificationMethod: method };
}

// sin(…)/x^n or cos(…)/x^n as x → ±∞: bounded over unbounded → 0.
export function trySqueezeAtInfinity(func, variable, target) {
  const parts = splitQuotient(func);
  if (!parts) return null;
  const v = variable;
  const num = noSpaces(parts.num);
  const fn = num.startsWith('sin(') ? 'sin' : num.startsWith('cos(') ? 'cos' : null;
  const call = fn ? leadingCall(num, fn) : null;
  if (!call || call.end !== num.length) return null;
  const den = noSpaces(parts.den);
  if (!new RegExp(`^\\(?\\d*\\*?${v}(?:\\^\\d+)?\\)?$`).test(den)) return null;
  const toward = target === Infinity ? '∞' : '−∞';
  const steps = [
    `${mark(`${fn}(${beautify(call.arg)})`)} never settles, but it is bounded: ${mark(`−1 ≤ ${fn}(${beautify(call.arg)}) ≤ 1`)}.`,
    `Divide through by ${mark(beautify(den))}: ${mark(`−1/${beautify(den)} ≤ ${absBars(beautify(func))} ≤ 1/${beautify(den)}`)}.`,
    `Both bounds ${mark('→ 0')} as ${mark(`${v} → ${toward}`)}, so by the squeeze theorem the limit is ${mark('0')}.`,
  ];
  return { steps, answer: '0', verified: verifyInfiniteLimit(func, v, target, 0), verificationMethod: 'squeeze theorem + numeric check' };
}

// The form 1^∞: B^E with B → 1 and E → ±∞, such as (1 + a/x)^(bx) at ∞,
// (x/(x + 1))^x at ∞, (1 + ax)^(b/x) at 0. Take logarithms:
// ln L = lim E·ln(1 + u) with u = B − 1 → 0, and the standard limit
// ln(1 + u)/u → 1 leaves ln L = lim E·u = c, so L = e^c. c is found exactly
// (E·u simplified: a constant, or at ±∞ a ratio of equal-degree
// polynomials); anything else is left to the ladder. The sampling fallback
// used to produce e for this family, with steps that admitted it.
export function tryOneToInfinity(Algebrite, func, variable, target) {
  if (!Algebrite || (target !== 0 && Number.isFinite(target))) return null;
  let node;
  try {
    node = math.parse(func);
  } catch {
    return null;
  }
  while (node.type === 'ParenthesisNode') node = node.content;
  if (node.type !== 'OperatorNode' || node.op !== '^') return null;
  const base = stripOuterParens(noSpaces(node.args[0].toString()));
  const exponent = stripOuterParens(noSpaces(node.args[1].toString()));
  const v = variable;
  if (!hasVariable(base, v) || !hasVariable(exponent, v)) return null;

  // Near the point: the base must go to 1, the exponent to ±∞.
  const near = Number.isFinite(target) ? [1e-6, -1e-6] : [target === Infinity ? 1e7 : -1e7];
  for (const x of near) {
    const b = evalAt(base, v, x);
    const e = evalAt(exponent, v, x);
    if (!Number.isFinite(b) || Math.abs(b - 1) > 1e-4 || !Number.isFinite(e) || Math.abs(e) < 1e4) return null;
  }

  const run = (code) => {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  };
  const u = run(`simplify((${base}) - 1)`);
  const product = u && run(`simplify((${exponent})*(${u}))`);
  if (!u || !product) return null;

  // c = lim E·u, exactly.
  const grouped = (t) => (/^[a-z0-9^]+$/i.test(noSpaces(t)) ? beautify(t) : `(${beautify(t)})`);
  const cSteps = [`${mark(`E·u = ${grouped(exponent)}·${grouped(u)} = ${beautify(product)}`)}${hasVariable(product, v) ? '' : ', a constant'}.`];
  let c = null;
  if (!hasVariable(product, v)) {
    c = algebriteNumber(Algebrite, product, v);
  } else if (!Number.isFinite(target)) {
    const rational = run(`rationalize(${product})`);
    const num = rational && run(`numerator(${rational})`);
    const den = rational && run(`denominator(${rational})`);
    if (!num || !den || !isPolynomial(num, v) || !isPolynomial(den, v)) return null;
    const dn = Number(run(`deg(${num}, ${v})`));
    const dd = Number(run(`deg(${den}, ${v})`));
    if (!Number.isInteger(dn) || !Number.isInteger(dd) || dn > dd) return null;
    const ratio = dn < dd ? '0' : run(`simplify((${run(`coeff(${num}, ${v}, ${dn})`)})/(${run(`coeff(${den}, ${v}, ${dd})`)}))`);
    c = ratio === null ? null : algebriteNumber(Algebrite, ratio, v);
    const toward = target === Infinity ? '∞' : '−∞';
    cSteps.push(dn < dd
      ? `As a single fraction its denominator has the higher degree, so as ${mark(`${v} → ${toward}`)} it ${mark('→ 0')}.`
      : `As a single fraction, ${mark(beautify(num))} over ${mark(beautify(den))}, numerator and denominator both have degree ${dn}; only the leading coefficients survive as ${mark(`${v} → ${toward}`)}, so it ${mark(`→ ${beautify(ratio)}`)}.`);
  }
  if (c === null || !Number.isFinite(c)) return null;

  const exactC = rationalText(c);
  if (exactC === null) return null;
  const value = Math.exp(c);
  const power = exactC === '0' ? '1' : exactC === '1' ? 'e' : exactC === '-1' ? '1/e' : exactC === '1/2' ? '√e' : /^-?\d+$/.test(exactC) && c > 0 ? `e^${exactC}` : `e^(${exactC})`;
  const shown = power === '1' ? '1' : `${power} (≈ ${formatNumber(value)})`;
  const towardShown = Number.isFinite(target) ? '0' : target === Infinity ? '∞' : '−∞';
  const exponentGoes = Number.isFinite(target) ? '±∞ (the sign depends on the side)' : evalAt(exponent, v, near[0]) > 0 ? '∞' : '−∞';
  const steps = [
    `As ${mark(`${v} → ${towardShown}`)} the base ${mark(`${beautify(base)} → 1`)} while the exponent ${mark(`${beautify(exponent)} → ${exponentGoes}`)}: the indeterminate form ${mark('1^∞')}. A power with a moving exponent is handled by taking logarithms.`,
    `Let ${mark('L')} be the limit, and write the power as ${mark('B^E')} with ${mark(`B = ${beautify(base)}`)} and ${mark(`E = ${beautify(exponent)}`)}. Then ${mark('ln L')} is the limit of ${mark('ln(B^E) = E·ln(B)')}.`,
    `Write the base as ${mark('1 + u')}, with ${mark(`u = B − 1 = ${beautify(u)}`)}; ${mark('u → 0')} as ${mark(`${v} → ${towardShown}`)}. Then ${mark('E·ln(1 + u) = (E·u)·[ln(1 + u)/u]')}, and the standard limit ${mark('ln(1 + u)/u → 1')} as ${mark('u → 0')} leaves ${mark('ln L')} equal to the limit of ${mark('E·u')}.`,
    ...cSteps,
    `So ${mark(`ln L = ${exactC}`)}, and ${mark(`L = e^${/^\d+$/.test(exactC) ? exactC : `(${exactC})`}${power.startsWith('e^') ? '' : ` = ${power}`}`)}. The limit is ${mark(shown)}.`,
  ];
  const verified = Number.isFinite(target)
    ? verifyLimitNumerically(func, v, target, value)
    : verifyInfiniteLimit(func, v, target, value);
  return { steps, answer: shown, verified, verificationMethod: 'logarithms and the standard limit ln(1 + u)/u → 1 + numeric check' };
}

export function tryAlgebriteSimplify(Algebrite, func, variable, target) {
  try {
    const simplified = String(Algebrite.run(`simplify(${func})`)).trim();
    if (!simplified || /nil|error/i.test(simplified)) return null;

    // Re-substitute into the simplified form.
    const value = algebriteNumber(Algebrite, `(${simplified})`, variable, target);
    if (value === null) return null;
    const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `(${simplified})`, variable, target));

    return {
      steps: [
        `Direct substitution gives an indeterminate form, so simplify first.`,
        `Simplify the expression: ${mark(beautify(simplified))}.`,
        `Now substitute ${mark(`${variable} = ${formatNumber(target)}`)}: the limit is ${mark(shown)}.`,
      ],
      answer: shown,
      verified: verifyLimitNumerically(func, variable, target, value),
    };
  } catch {
    return null;
  }
}

function taylorExpand(Algebrite, expr, variable, target) {
  try {
    const out = String(Algebrite.run(`taylor(${expr}, ${variable}, 8, ${target})`)).trim();
    if (!out || /nil|error|taylor|stop/i.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

export function trySeriesLimit(Algebrite, func, variable, target) {
  // Algebrite refuses to Taylor-expand a whole fraction whose denominator
  // vanishes ("divide by zero"). The correct move for a 0/0 quotient is to
  // expand numerator and denominator *separately* and take the ratio of the
  // resulting polynomials, which cancels the common vanishing factor. This is
  // the general mechanism a hardcoded (1-cos x)/x^2 -> 1/2 table only fakes.
  const parts = splitQuotient(func);

  if (parts) {
    const numExp = taylorExpand(Algebrite, parts.num, variable, target);
    const denExp = taylorExpand(Algebrite, parts.den, variable, target);
    if (!numExp || !denExp) return null;

    // Ratio of the two truncated series, simplified, then evaluated at target.
    // If the first simplify leaves a common factor uncancelled (substitution
    // still 0/0), a second simplify pass usually clears it. Either way,
    // algebriteNumber returns null on an unresolved form, so a stubborn case
    // degrades safely to the next rung rather than producing a wrong answer.
    let value = algebriteNumber(Algebrite, `simplify((${numExp})/(${denExp}))`, variable, target);
    if (value === null) {
      value = algebriteNumber(Algebrite, `simplify(simplify((${numExp})/(${denExp})))`, variable, target);
    }
    if (value === null) return null;
    const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `simplify((${numExp})/(${denExp}))`, variable, target));

    return {
      steps: [
        `Direct substitution gives ${mark('0/0')}, so expand the numerator and denominator as Taylor series about ${mark(`${variable} = ${formatNumber(target)}`)}.`,
        `Numerator ${mark(`≈ ${beautify(numExp)}`)}; denominator ${mark(`≈ ${beautify(denExp)}`)}.`,
        `Divide the series and cancel the common factor; the limit is ${mark(shown)}.`,
      ],
      answer: shown,
      verified: verifyLimitNumerically(func, variable, target, value),
    };
  }

  // Non-quotient indeterminate forms: expand the whole expression directly.
  const expanded = taylorExpand(Algebrite, func, variable, target);
  if (!expanded) return null;
  const value = algebriteNumber(Algebrite, `(${expanded})`, variable, target);
  if (value === null) return null;
  const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `(${expanded})`, variable, target));

  return {
    steps: [
      `Expand as a Taylor series about ${mark(`${variable} = ${formatNumber(target)}`)}.`,
      `Series: ${mark(beautify(expanded))}.`,
      `Evaluating the leading behaviour gives ${mark(shown)}.`,
    ],
    answer: shown,
    verified: verifyLimitNumerically(func, variable, target, value),
  };
}

export function tryLHopital(Algebrite, func, variable, target) {
  // Only applies to an explicit quotient n/d that is 0/0 or ∞/∞ at the point.
  const parts = splitQuotient(func);
  if (!parts) return null;

  let { num, den } = parts;
  const steps = [`Direct substitution gives an indeterminate form, so apply L'Hôpital's rule (differentiate top and bottom).`];

  for (let i = 0; i < 4; i += 1) {
    const nAtTarget = algebriteNumber(Algebrite, `(${num})`, variable, target);
    const dAtTarget = algebriteNumber(Algebrite, `(${den})`, variable, target);

    // Only a *confirmed* 0/0 justifies another differentiation. When both
    // sides come back null we cannot tell ∞/∞ from a symbolic-evaluation
    // failure, so we stop and let a later rung (or the numeric fallback)
    // handle it rather than over-trusting a guess.
    const indeterminate = nAtTarget === 0 && dAtTarget === 0;
    const symbolicFailure = nAtTarget === null || dAtTarget === null;

    if (!indeterminate) {
      if (symbolicFailure) return null;
      if (dAtTarget === 0) return null; // n/0 with n≠0: not a finite limit here
      const value = nAtTarget / dAtTarget;
      const shown = formatLimitAnswer(value, algebriteExactAt(Algebrite, `(${num})/(${den})`, variable, target));
      steps.push(`After ${i} differentiation${i === 1 ? '' : 's'}, substitution gives ${mark(shown)}.`);
      return {
        steps,
        answer: shown,
        verified: verifyLimitNumerically(func, variable, target, value),
      };
    }

    try {
      num = String(Algebrite.run(`d(${num}, ${variable})`)).trim();
      den = String(Algebrite.run(`d(${den}, ${variable})`)).trim();
    } catch {
      return null;
    }
    steps.push(`Differentiate: numerator ${mark(`→ ${beautify(num)}`)}, denominator ${mark(`→ ${beautify(den)}`)}.`);
  }

  return null; // Did not resolve within the iteration cap.
}

// Split "a/b" into {num, den} only when the top-level operator is a division.
// Rejects expressions where the "/" sits inside parentheses (e.g. sin(x/2)).
// First strips any balanced outer parentheses so a fully-wrapped fraction like
// "((1-cos(x))/(x^2))" is still recognized as a quotient.
function splitQuotient(expr) {
  const inner = stripOuterParens(expr.trim());
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === '/' && depth === 0) {
      const num = stripOuterParens(inner.slice(0, i).trim());
      const den = stripOuterParens(inner.slice(i + 1).trim());
      if (num && den) return { num, den };
    }
  }
  return null;
}

// Independent numeric check of a claimed symbolic answer. Returns a boolean —
// never a fabricated probability. Samples small offsets on both sides and
// requires agreement. The tolerance is scaled to the offset: a point 1e-3 away
// from the limit will, for any function with nonzero slope, sit ~1e-3 away in
// value, so a fixed tiny tolerance would wrongly reject correct answers (this
// is exactly what made removable limits like (x^2-1)/(x-1) read "unverified").
// We use offsets close enough that the linear term is small and a tolerance
// generous enough to absorb it, while still catching a genuinely wrong answer.
function verifyLimitNumerically(func, variable, target, claimed) {
  const offsets = [1e-4, -1e-4, 1e-5, -1e-5, 1e-6, -1e-6];
  const tol = Math.max(1e-3, Math.abs(claimed) * 1e-3);
  let agree = 0;
  let seen = 0;
  for (const dx of offsets) {
    const y = evalAt(func, variable, target + dx);
    if (!Number.isFinite(y)) continue;
    seen += 1;
    if (Math.abs(y - claimed) < tol) agree += 1;
  }
  return seen >= 3 && agree >= seen - 1;
}
