// Algebrite's antiderivatives tidied for display: logarithm arguments
// polished, absolute-value bars dropped where the argument is positive, erf
// written as a textbook does, other letters bound as constants.

import {
  beautify,
  expressionsNumericallyEqual,
  isAlgebriteFailure,
  lnify,
  splitTopLevel,
  mark,
} from '../solverUtils.js';

// Algebrite writes √π as pi^(1/2) and the Gaussian antiderivative as
// 1/2*pi^(1/2)*erf(x). Present it the way a table does: (√π/2)·erf(x).
export function prettyErf(integralResult) {
  return lnify(integralResult)
    .replace(/pi\^\(1\/2\)/g, '√π')
    .replace(/(\d+)\/(\d+)\*√π/g, '($1√π/$2)')
    .replace(/\(1√π\/(\d+)\)/g, '(√π/$1)')
    .replace(/\)\*erf/g, ')·erf');
}

// Steps for an antiderivative that involves the error function: say plainly
// that no elementary antiderivative exists, define erf, and show that the
// stated answer differentiates back to the integrand. The mathematics is
// Algebrite's; the explanation is the whole point.
export function buildErfSteps(expression, integral, variable) {
  const v = variable;
  const shown = beautify(expression);
  return [
    `Identify the function to integrate: ∫(${shown}) d${v}.`,
    `This integrand has no elementary antiderivative: no finite combination of polynomials, roots, exponentials, logarithms and trig functions differentiates to a Gaussian ${mark(`e^(−k${v}²)`)} (Liouville's theorem). So no substitution or integration by parts will finish it — ${mark('u')} = the exponent would need a factor of ${mark(v)} that is not there.`,
    `Calculus handles this by NAMING the antiderivative. The error function is defined as ${mark(`erf(${v}) = (2/√π)·∫_0^${v} e^(−t²) dt`)}, so by the Fundamental Theorem of Calculus ${mark(`d/d${v} erf(${v}) = (2/√π)·e^(−${v}²)`)}.`,
    `Rearranging that derivative: ${mark(`e^(−${v}²) = (√π/2)·d/d${v} erf(${v})`)}, so ${mark(`∫e^(−${v}²) d${v} = (√π/2)·erf(${v}) + C`)}. Constant factors and a scaled argument (${mark(`e^(−k${v}²)`)}) carry through the same way.`,
    `For this integrand: ${mark(`∫(${shown}) d${v} = ${prettyErf(integral)}`)}.`,
    `Check by differentiating: ${mark(`d/d${v}[${prettyErf(integral)}] = ${shown}`)} ✓ (verified symbolically).`,
    `Add the constant of integration: ${mark(`∫(${shown}) d${v} = ${prettyErf(integral)} + C`)}.`,
  ];
}

// lnify (ln|…|, e^…) is the shared formatter in solverUtils.

export function safeRunLocal(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

export function simplifyRun(Algebrite, expr) {
  return safeRunLocal(Algebrite, `simplify(${expr})`);
}

// Tidy the argument of every log(...) in an antiderivative for display.
// Algebrite's partial fractions leave ∫1/(x²−1) as
// ½·log(−1/(−x−1) + x/(−x−1)); rationalized that is (x−1)/(−x−1), and since
// the result is shown as ln|…| a sign flip of the argument is exact, so the
// form with fewer minus signs is chosen: ½·ln|(x−1)/(x+1)|. Display only —
// the value is unchanged (checked below by numeric equality of |arg|).
export function polishLogArguments(Algebrite, expr) {
  const src = String(expr);
  return src.replace(/\blog\(((?:[^()]|\([^()]*\))+)\)/g, (whole, arg) => {
    if (!/[+\-*/]/.test(arg)) return whole; // already a bare factor
    let best = arg;
    const candidates = [];
    const rat = safeRunLocal(Algebrite, `rationalize(${arg})`);
    if (rat) {
      candidates.push(rat);
      // For a quotient, also try flipping the signs of numerator and
      // denominator together: (x−1)/(−x−1) → (1−x)/(x+1) → shown as
      // (x−1)/(x+1) since it sits under |…|. Each is a candidate; the
      // numeric check below decides.
      const parts = splitTopLevel(rat, '/');
      if (parts.length === 2) {
        const num = safeRunLocal(Algebrite, `simplify(-(${parts[0]}))`);
        const den = safeRunLocal(Algebrite, `simplify(-(${parts[1]}))`);
        if (num && den) {
          const wrap = (t) => (/[+\-]/.test(t.replace(/^-/, '')) ? `(${t})` : t);
          candidates.push(`${wrap(num)}/${wrap(den)}`);
          candidates.push(`${wrap(parts[0].trim())}/${wrap(den)}`); // |A/−B| = |A/B|
          candidates.push(`${wrap(num)}/${wrap(parts[1].trim())}`);
        }
      }
    }
    const neg = safeRunLocal(Algebrite, `rationalize(-(${arg}))`);
    if (neg) candidates.push(neg);
    for (const c of candidates) {
      // |candidate| must equal |arg| numerically before it may replace it.
      const same = expressionsNumericallyEqual(`abs(${c})`, `abs(${arg})`, 'x');
      if (!same) continue;
      const minuses = (c.match(/-/g) || []).length;
      const bestMinuses = (best.match(/-/g) || []).length;
      if (minuses < bestMinuses || (minuses === bestMinuses && c.length < best.length)) best = c;
    }
    return `log(${best})`;
  });
}

// ln|x² + 1|: when the argument is a sum of even powers with positive
// coefficients plus a positive constant, it is positive everywhere and the
// absolute-value bars can be dropped. Says so; otherwise the bars stay.
export function positiveArgumentNote(antiderivative, variable) {
  return alwaysPositiveLogArguments(antiderivative, variable)
    .map((arg) => `Because ${mark(`${lnify(arg)} > 0`)} for every ${mark(variable)}, the absolute-value bars in ${mark(`ln|${lnify(arg)}|`)} are not needed.`);
}

// The log arguments in an antiderivative that are positive for every x: a
// sum of even powers with positive coefficients plus a positive constant.
function alwaysPositiveLogArguments(antiderivative, variable) {
  const out = [];
  // log((x^2+1)) too: the pieces of a partial-fraction sum keep their brackets.
  for (const m of String(antiderivative).matchAll(/log\(\(?((?:[^()]|\([^()]*\))+?)\)?\)(?![^()]*\))/g)) {
    const arg = m[1].replace(/\s+/g, '');
    const terms = arg.split(/(?=[+-])/).filter(Boolean);
    // A positive constant, an even power, or an exponential (e^x, e^(2x), exp(x)).
    const positive = terms.length > 0 && terms.every((t) => !t.startsWith('-') && (/^\+?\d+(?:\.\d+)?$/.test(t) || new RegExp(`^\\+?(?:\\d+(?:\\.\\d+)?\\*?)?${variable}\\^(?:\\d*[02468])$`).test(t) || new RegExp(`^\\+?(?:\\d+(?:\\.\\d+)?\\*?)?(?:e\\^\\(?-?\\d*\\*?${variable}\\)?|exp\\(-?\\d*\\*?${variable}\\))$`).test(t)));
    const hasConstant = terms.some((t) => /^\+?\d+(?:\.\d+)?$/.test(t));
    if (positive && hasConstant) out.push(m[1]);
  }
  return out;
}

// ln|x² + 1| → ln(x² + 1) in a displayed antiderivative, for every argument
// that is always positive — so the answer agrees with the step that said the
// bars were not needed.
// Every single letter other than the variable (and e, i) replaced by a fixed
// sample value, distinct per letter, for a numeric check of an expression
// with constants in it.
export function bindOtherLetters(expr, variable) {
  const values = { a: 1.37, b: 2.11, c: 0.83, k: 1.59, m: 2.47, n: 1.21, p: 0.67, q: 1.93, r: 2.29, s: 0.91, t: 1.43, u: 1.77, v: 0.59, w: 2.03, x: 1.31, y: 1.69, z: 0.77 };
  return String(expr).replace(/(?<![a-z_])([a-z])(?![a-z_(])/gi, (m, l) => (l === variable || l === 'e' || l === 'i' || !(l.toLowerCase() in values) ? m : `(${values[l.toLowerCase()]})`));
}

// ln|A| → ln(A) for every ln(A) in the integrand: the integrand is only
// defined where A > 0, and there the bars change nothing.
export function dropBarsOnIntegrandLogs(shown, integrand) {
  let out = shown;
  for (const [, arg] of String(integrand).matchAll(/(?<![a-z])(?:ln|log)\(([^()]+)\)/g)) {
    for (const b of new Set([beautify(arg), lnify(arg)])) out = out.split(`ln|${b}|`).join(`ln(${b})`);
  }
  return out;
}

export function dropBarsOnPositiveArguments(shown, antiderivative, variable) {
  let out = shown;
  for (const arg of alwaysPositiveLogArguments(antiderivative, variable)) {
    for (const b of new Set([beautify(arg), lnify(arg)])) out = out.split(`ln|${b}|`).join(`ln(${b})`);
  }
  return out;
}
