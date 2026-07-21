import { extractVariable, parseMathExpression, isEquation } from '../mathParser.js';
import {
  math,
  beautify,
  formatNumber,
  sampleFunction,
  loadAlgebrite,
  hasVariable,
  rewriteReciprocalTrig,
  expressionsNumericallyEqual,
  parsesAsMath,
} from './solverUtils.js';
import { getSettings } from '../settings.js';
import { parseError } from '../solutionEnvelope.js';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export async function solveLimit(expression) {
  try {
    let cleaned = expression.trim().replace(/[.?!]+$/, '').trim();
    cleaned = cleaned.replace(/^(?:find the limit|evaluate the limit|calculate the limit)\s+(?:of\s+)?/i, '');

    // One-sided limits, phrasing form: "… as x approaches 0 from the right".
    // The phrase is stripped here, before the notation regexes run, so it can
    // never leak into the extracted function expression. The suffix form
    // ("x→0⁺", "x->0+") is handled after the approach token is captured.
    let side = 0; // 0 = two-sided, 1 = from the right (⁺), -1 = from the left (⁻)
    cleaned = cleaned
      .replace(/\bfrom\s+the\s+(left|right)(?:\s+side)?\b/i, (_, s) => {
        side = s.toLowerCase() === 'right' ? 1 : -1;
        return '';
      })
      .replace(/\s{2,}/g, ' ')
      .trim();

    let approachValue = 0;
    let func = cleaned;
    let variable = 'x';

    const limitMatch1 = cleaned.match(/(?:lim(?:it)?)\s+(?:as\s+)?([a-z])\s*(?:->|→|approaches)\s*([^\s,]+)[\s,]+(?:of\s+)?(.+)/i);
    const limitMatch2 = cleaned.match(/([a-z])\s*(?:->|→|approaches)\s*([^\s,]+)[\s,]+(.+)/i);
    const limitMatch3 = cleaned.match(/(.+?)\s+as\s+([a-z])\s*(?:->|→|approaches)\s*(.+)/i);

    if (limitMatch1) {
      variable = limitMatch1[1];
      approachValue = limitMatch1[2];
      func = parseMathExpression(limitMatch1[3]);
    } else if (limitMatch2) {
      variable = limitMatch2[1];
      approachValue = limitMatch2[2];
      func = parseMathExpression(limitMatch2[3]);
    } else if (limitMatch3) {
      func = parseMathExpression(limitMatch3[1]);
      variable = limitMatch3[2];
      approachValue = limitMatch3[3].trim();
    } else {
      func = parseMathExpression(cleaned.replace(/^(?:lim(?:it)?)\s*/i, ''));
      variable = extractVariable(func);
    }

    // One-sided limits, suffix form: a trailing +/- (or ⁺/⁻, or ^+/^-) on the
    // approach value selects a side. The base must itself resolve to a number
    // for the suffix to count — this keeps a plain negative like "-2" from
    // losing its sign to the side detector.
    let approachToken = String(approachValue).trim();
    const sideSuffix = approachToken.match(/^(.+?)\^?([+⁺\-−⁻])$/);
    if (sideSuffix && Number.isFinite(resolveApproachValue(sideSuffix[1]))) {
      approachToken = sideSuffix[1];
      side = /[+⁺]/.test(sideSuffix[2]) ? 1 : -1;
    }

    const target = resolveApproachValue(approachToken);
    if (Number.isNaN(target)) {
      throw new Error('Unable to interpret the limit approach value');
    }
    if (!Number.isFinite(target)) side = 0; // ±∞ has no sides to approach from

    const sideMark = side === 1 ? '⁺' : side === -1 ? '⁻' : '';
    const displayTarget = formatApproach(approachToken, target) + sideMark;

    // Unreadable input must fail here: sampling an unparseable function
    // returns NaN everywhere, which the machinery below would misreport as
    // "the one-sided limits disagree" — a false statement about a function
    // that doesn't exist.
    if (!parsesAsMath(func)) {
      return parseError({
        input: expression,
        hint: `"${func}" could not be read as a function of ${variable}.`,
        tips: ['Write limits like: lim x->0 (sin(x)/x), or (x^2-1)/(x-1) as x approaches 1.'],
      });
    }

    // A constant sub-expression can sit exactly on a trig asymptote (e.g. the
    // user typed tan(pi/2) under the Limits topic). The expression is
    // undefined no matter what the variable does, so say that instead of
    // reporting the floating-point blow-up as a limit. Passing 0 as the
    // result restricts the check to calls with a concrete constant argument.
    const hit = detectTrigAsymptote(func, 0, false);
    if (hit) {
      return {
        steps: [
          `Evaluate lim (${variable}→${displayTarget}) ${beautify(func)}`,
          `${hit.func}(${hit.argDisplay}) is undefined — ${hit.identity}, and ${hit.denom}(${hit.argDisplay}) = 0, so the graph has a vertical asymptote there.`,
          `The expression inside the limit is undefined for every ${variable}, so the limit is undefined as well.`,
        ],
        answer: 'Undefined',
        tips: [
          `${hit.func}(x) has a vertical asymptote wherever ${hit.denom}(x) = 0 — the value grows without bound instead of settling on a number.`,
          'A limit can only exist where the expression takes real values near the point.',
        ],
        common_mistakes: [
          `Assuming ${hit.func} is defined everywhere — it blows up wherever ${hit.denom}(x) = 0.`,
          'Reading the huge floating-point number near an asymptote as the actual answer.',
        ],
        graph: null,
      };
    }

    const result = !Number.isFinite(target)
      ? estimateInfiniteLimit(func, variable, target)
      : side !== 0
        ? evaluateOneSidedLimit(func, variable, target, side)
        : await evaluateFiniteLimit(func, variable, target);

    const steps = [
      `Evaluate lim (${variable}→${displayTarget}) ${beautify(func)}`,
      ...result.steps,
    ];

    return {
      steps,
      answer: `lim (${variable}→${displayTarget}) ${beautify(func)} = ${result.answer}`,
      verified: result.verified ?? false,
      verificationMethod: result.verified ? (result.verificationMethod ?? 'numeric check') : null,
      tips: side !== 0 ? [
        'A one-sided limit only follows the function along one side of the point — the other side is ignored entirely.',
        'The two-sided limit exists exactly when the left- and right-hand limits agree.',
        'One-sided limits are the right tool at domain boundaries, jump discontinuities, and vertical asymptotes.',
      ] : [
        'Try substituting the value directly first — if the function is continuous there, that is the limit.',
        'A 0/0 or ∞/∞ result is indeterminate: factor, rationalize, or use L\'Hôpital\'s rule.',
        'For limits at infinity, compare the growth rates of the numerator and denominator.',
      ],
      common_mistakes: side !== 0 ? [
        'Mixing up the notation: x → a⁺ approaches from the right (values above a), x → a⁻ from the left.',
        'Reporting a two-sided limit when only one side was asked for (or exists).',
        'Assuming a one-sided limit exists where the function is not even defined on that side.',
      ] : [
        'Assuming the limit equals the function value even at a discontinuity.',
        'Only checking one side when the two sides can disagree.',
        'Stopping at a 0/0 form instead of simplifying first.',
      ],
      graph: generateLimitGraph(func, variable, target, displayTarget, result.answer),
    };
  } catch (error) {
    console.error('Limit solver error:', error);
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Write limits like: lim x->0 (sin(x)/x), or (x^2-1)/(x-1) as x approaches 1.'],
    });
  }
}

function resolveApproachValue(approachValue) {
  if (typeof approachValue === 'number') return approachValue;

  const normalized = String(approachValue).trim().toLowerCase();
  if (!normalized) return Number.NaN;

  // Recognize infinity in its common written forms.
  if (/^\+?(?:infinity|infty|inf|∞)$/.test(normalized)) return Infinity;
  if (/^-(?:infinity|infty|inf|∞)$/.test(normalized)) return -Infinity;

  try {
    const evaluated = math.evaluate(normalized);
    const numeric = typeof evaluated === 'number' ? evaluated : Number(evaluated);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  } catch {
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
}

function formatApproach(raw, target) {
  if (target === Infinity) return '∞';
  if (target === -Infinity) return '-∞';
  // Keep symbolic forms like pi/2 as typed; otherwise show the clean number.
  const rawStr = String(raw).trim();
  if (/[a-z]/i.test(rawStr)) return rawStr;
  return formatNumber(target);
}

function evalAt(func, variable, x) {
  try {
    const y = math.evaluate(func, { [variable]: x });
    return typeof y === 'number' ? y : Number(y);
  } catch {
    return NaN;
  }
}

// Orchestrates the finite-limit strategy ladder. Each rung is exact/symbolic
// where possible; numeric sampling is the *last* resort, and even then only
// after the symbolic rungs have had a chance. This ordering is what fixes the
// classic 0/0 removable limits — (1-cos x)/x^2, (sin x - x)/x^3, etc. — that
// blind sampling at 1e-6/1e-8 gets wrong through floating-point cancellation.
async function evaluateFiniteLimit(func, variable, target) {
  // Rung 1: direct substitution. If the function is continuous at the point,
  // that value *is* the limit and we are done. This is exact by evaluation —
  // stronger than a numeric cross-check — so it carries its own method label
  // rather than surfacing as unverified alongside the sampled cases.
  const direct = evalAt(func, variable, target);
  if (Number.isFinite(direct) && Math.abs(direct) < EXPLODED_MAGNITUDE) {
    return {
      steps: [`Substitute directly: at ${variable} = ${formatNumber(target)}, the function is defined and equals ${formatNumber(direct)}.`],
      answer: formatNumber(direct),
      verified: true,
      verificationMethod: 'direct substitution',
    };
  }

  // Rungs 2-4 need Algebrite. If it cannot load for any reason, fall straight
  // through to numeric sampling so the solver still returns an answer.
  let Algebrite = null;
  try {
    Algebrite = await loadAlgebrite();
  } catch {
    Algebrite = null;
  }

  if (Algebrite) {
    // A symbolic rung is only trusted if its own numeric cross-check confirms
    // it. This is what stops abs(x)/x from returning a spurious 0: Algebrite's
    // manipulation of a non-differentiable point produces an unverifiable
    // value, so we fall through to the numeric rung, which correctly reports
    // the two-sided disagreement as "does not exist".
    // Rung 2: simplify, then re-substitute. Catches removable factors like
    // (x^2-1)/(x-1) -> x+1, and rational cancellations generally.
    const simplified = tryAlgebriteSimplify(Algebrite, func, variable, target);
    if (simplified && simplified.verified) return simplified;

    // Rung 3: series (Taylor) expansion ratio. This is the principled version
    // of a hardcoded pattern table: expand numerator and denominator about the
    // point and read off the leading-order behaviour. Handles the whole family
    // of trig/exp removable limits at once, not just enumerated special cases.
    const series = trySeriesLimit(Algebrite, func, variable, target);
    if (series && series.verified) return series;

    // Rung 4: L'Hôpital, capped so a stubborn indeterminate form cannot loop.
    const lhopital = tryLHopital(Algebrite, func, variable, target);
    if (lhopital && lhopital.verified) return lhopital;
  }

  // Rung 5: numeric sampling from both sides. Unchanged legacy behaviour, now
  // reached only when every exact method above declined. Still the right tool
  // for genuine jump/oscillation cases and one-sided divergence.
  return estimateFiniteLimitNumeric(func, variable, target);
}

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
    if (/stop|error|nil/i.test(raw)) return null;
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
    if (!raw || /stop|error|nil/i.test(raw)) return null;
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

function tryAlgebriteSimplify(Algebrite, func, variable, target) {
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
        `Simplify the expression: ${beautify(simplified)}.`,
        `Now substitute ${variable} = ${formatNumber(target)}: the limit is ${shown}.`,
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

function trySeriesLimit(Algebrite, func, variable, target) {
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
        `Direct substitution gives 0/0, so expand the numerator and denominator as Taylor series about ${variable} = ${formatNumber(target)}.`,
        `Numerator ≈ ${beautify(numExp)}; denominator ≈ ${beautify(denExp)}.`,
        `Divide the series and cancel the common factor; the limit is ${shown}.`,
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
      `Expand as a Taylor series about ${variable} = ${formatNumber(target)}.`,
      `Series: ${beautify(expanded)}.`,
      `Evaluating the leading behaviour gives ${shown}.`,
    ],
    answer: shown,
    verified: verifyLimitNumerically(func, variable, target, value),
  };
}

function tryLHopital(Algebrite, func, variable, target) {
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
      steps.push(`After ${i} differentiation${i === 1 ? '' : 's'}, substitution gives ${shown}.`);
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
    steps.push(`Differentiate: numerator → ${beautify(num)}, denominator → ${beautify(den)}.`);
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

// Remove one or more layers of balanced parentheses that wrap the whole
// string. "((a)/(b))" -> "(a)/(b)"; "sin(x)" is left untouched because its
// outer parens are not balanced around the entire expression.
function stripOuterParens(expr) {
  let s = expr.trim();
  while (s.length >= 2 && s[0] === '(' && s[s.length - 1] === ')') {
    let depth = 0;
    let wrapsWhole = true;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') depth -= 1;
      // If depth returns to 0 before the final char, the leading "(" does not
      // pair with the trailing ")", so the parens do not wrap the whole thing.
      if (depth === 0 && i < s.length - 1) { wrapsWhole = false; break; }
    }
    if (!wrapsWhole) break;
    s = s.slice(1, -1).trim();
  }
  return s;
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

function estimateFiniteLimitNumeric(func, variable, target) {
  // This is the sampling rung itself, so it deliberately does not set
  // `verified`: cross-checking a numeric estimate with more numeric sampling
  // would be circular. Answers from here surface as unverified, which honestly
  // signals "numerical estimate" rather than "proven symbolically".
  const direct = evalAt(func, variable, target);
  const steps = [];

  // A huge magnitude means the point sits on a vertical asymptote and the
  // float value is rounding noise, not a real function value.
  if (Number.isFinite(direct) && Math.abs(direct) < EXPLODED_MAGNITUDE) {
    steps.push(`Substitute directly: at ${variable} = ${formatNumber(target)}, the function is defined and equals ${formatNumber(direct)}.`);
    return { steps, answer: formatNumber(direct) };
  }

  if (Number.isNaN(direct)) {
    steps.push(`Direct substitution at ${variable} = ${formatNumber(target)} is undefined (an indeterminate form), so approach from both sides.`);
  } else {
    steps.push(`Direct substitution at ${variable} = ${formatNumber(target)} blows up instead of settling on a value, so approach from both sides.`);
  }

  // Oscillation: if a side never settles — the values keep swinging across a
  // wide range no matter how close we get — the limit fails to exist *because
  // the function oscillates*, which is a different reason than two one-sided
  // values disagreeing. Say so specifically (sin(1/x) is the classic case).
  if (sideOscillates(func, variable, target, 1) || sideOscillates(func, variable, target, -1)) {
    steps.push(`Sampling ever closer to ${variable} = ${formatNumber(target)}, the values keep swinging between roughly the same high and low values instead of settling toward any number.`);
    steps.push('The function oscillates infinitely often near this point, so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const left = sampleSide(func, variable, target, -1);
  const right = sampleSide(func, variable, target, 1);
  steps.push(`From the left (${variable} → ${formatNumber(target)}⁻): ${describeSide(left)}`);
  steps.push(`From the right (${variable} → ${formatNumber(target)}⁺): ${describeSide(right)}`);

  if (left.diverges && right.diverges) {
    if (left.sign === right.sign) {
      const answer = left.sign > 0 ? '∞' : '-∞';
      steps.push(`Both sides grow without bound in the same direction, so the limit diverges to ${answer}.`);
      return { steps, answer };
    }
    steps.push('The two sides run off to opposite infinities (a vertical asymptote), so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const bothConverge = left.value !== undefined && right.value !== undefined;
  if (bothConverge && Math.abs(left.value - right.value) < 1e-4) {
    const value = formatNumber((left.value + right.value) / 2);
    steps.push(`Both sides approach ${value}, so the limit exists.`);
    return { steps, answer: value };
  }

  steps.push('The one-sided limits disagree, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

// Does the function oscillate as it approaches the point from one side?
// Sample a geometric ladder of shrinking offsets; the tell-tale of oscillation
// (vs. convergence or a plain jump) is that the *innermost* samples still span
// a wide range and the sequence keeps reversing direction. A converging side
// collapses to a point; a jump side settles too — only oscillation stays wide.
function sideOscillates(func, variable, target, direction) {
  const offsets = [1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 3e-6, 1e-6, 3e-7, 1e-7, 3e-8, 1e-8];
  const values = [];
  for (const o of offsets) {
    const y = evalAt(func, variable, target + direction * o);
    if (Number.isFinite(y)) values.push(y);
  }
  if (values.length < 8) return false;

  const inner = values.slice(Math.floor(values.length / 2));
  const innerSpread = Math.max(...inner) - Math.min(...inner);

  let reversals = 0;
  for (let i = 2; i < values.length; i += 1) {
    const d1 = values[i - 1] - values[i - 2];
    const d2 = values[i] - values[i - 1];
    if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) reversals += 1;
  }

  // Wide, still-swinging behaviour close in — not settling to a value.
  return innerSpread > 0.3 && reversals >= 3;
}

// Probe one side of a limit at two distances from the point. A closer sample
// that is an order of magnitude larger means the side is diverging toward an
// asymptote rather than settling on a value.
function sampleSide(func, variable, target, direction) {
  const far = evalAt(func, variable, target + direction * 1e-6);
  const near = evalAt(func, variable, target + direction * 1e-8);

  if (Number.isNaN(near)) return { outOfDomain: true };
  if (!Number.isFinite(near) || (Math.abs(near) > 1e5 && Math.abs(near) > 10 * Math.abs(far))) {
    return { diverges: true, sign: near > 0 ? 1 : -1 };
  }
  return { value: near };
}

function describeSide(side) {
  if (side.diverges) return side.sign > 0 ? 'diverges to ∞' : 'diverges to -∞';
  if (side.outOfDomain) return 'not defined on this side';
  return formatNumber(side.value);
}

// Evaluate a one-sided limit (side: 1 = from the right, -1 = from the left)
// by sampling a log-spaced ladder of offsets shrinking toward the point.
// Numeric by nature — like estimateFiniteLimitNumeric, it does not fabricate
// a "verified" flag — with one exactness upgrade: when the function is defined
// at the point and the samples settle onto that value, the limit is reported
// as the exact value and marked verified by direct substitution.
function evaluateOneSidedLimit(func, variable, target, side) {
  const dirWord = side > 0 ? 'right' : 'left';
  const mark = side > 0 ? '⁺' : '⁻';
  const steps = [
    `This is a one-sided limit: only the ${dirWord}-hand behaviour (${variable} → ${formatNumber(target)}${mark}) matters.`,
  ];

  const offsets = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9];
  const samples = offsets
    .map((o) => evalAt(func, variable, target + side * o))
    .filter((y) => !Number.isNaN(y));
  const values = samples.filter((y) => Number.isFinite(y));

  if (values.length < 3) {
    // Mostly undefined or infinite on that side. Distinguish the two.
    const infinities = samples.filter((y) => !Number.isFinite(y));
    if (infinities.length >= 2) {
      const answer = infinities[infinities.length - 1] > 0 ? '∞' : '-∞';
      steps.push(`Approaching from the ${dirWord}, the values grow without bound — the limit is ${answer}.`);
      return { steps, answer };
    }
    steps.push(`The function is not defined on the ${dirWord} side of ${variable} = ${formatNumber(target)}, so this one-sided limit does not exist.`);
    return { steps, answer: 'Does not exist' };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const preview = [values[0], values[Math.floor(values.length / 2)], last]
    .map((v) => formatNumber(v));
  steps.push(`Sample ever closer on the ${dirWord} side: the values run ${preview.join(' → ')}.`);

  // Explosive growth: magnitudes climbing steadily to something huge.
  if (Math.abs(last) > 1e4 && Math.abs(last) > 5 * Math.abs(first)) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the one-sided limit is ${answer}.`);
    return { steps, answer };
  }

  const deltas = [];
  for (let i = 1; i < values.length; i += 1) deltas.push(values[i] - values[i - 1]);
  const lastDelta = Math.abs(deltas[deltas.length - 1]);

  // Convergence: consecutive samples settle within a tight tolerance.
  if (lastDelta <= 1e-4 * (1 + Math.abs(last))) {
    const direct = evalAt(func, variable, target);
    if (
      Number.isFinite(direct) &&
      Math.abs(direct) < EXPLODED_MAGNITUDE &&
      Math.abs(direct - last) < 1e-3 * (1 + Math.abs(direct))
    ) {
      steps.push(`The values settle onto the function's own value there: f(${formatNumber(target)}) = ${formatNumber(direct)}.`);
      return { steps, answer: formatNumber(direct), verified: true, verificationMethod: 'direct substitution' };
    }
    steps.push(`The values settle toward ${formatNumber(last)}, so that is the one-sided limit.`);
    return { steps, answer: formatNumber(last) };
  }

  // Slow, steady divergence (e.g. ln(x) as x → 0⁺): each step keeps the same
  // sign and never decays, so the values are marching off to ±∞ even though
  // the magnitudes still look tame at these offsets.
  const sameSign = deltas.every((d) => d !== 0 && Math.sign(d) === Math.sign(deltas[0]));
  if (sameSign && lastDelta >= 0.5 * Math.abs(deltas[0])) {
    const answer = deltas[0] > 0 ? '∞' : '-∞';
    steps.push(`The values keep marching in the same direction without settling — a slow divergence to ${answer}.`);
    return { steps, answer };
  }

  steps.push('The values do not settle on that side, so the one-sided limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

function estimateInfiniteLimit(func, variable, target) {
  const sign = target === Infinity ? 1 : -1;
  const samples = [1e2, 1e3, 1e4, 1e6].map((m) => evalAt(func, variable, sign * m));
  const finite = samples.filter((v) => Number.isFinite(v));

  const steps = [`Evaluate the function at increasingly large ${sign > 0 ? 'positive' : 'negative'} values of ${variable}.`];
  steps.push(`Samples: ${samples.map((v) => (Number.isFinite(v) ? formatNumber(v) : '±∞')).join(', ')}`);

  if (finite.length < 2) {
    // Growing without bound — base the sign on the last value we could evaluate.
    const reference = finite.length ? finite[finite.length - 1] : samples[samples.length - 1];
    const answer = reference > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the limit is ${answer}.`);
    return { steps, answer };
  }

  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  if (Math.abs(last - prev) < 1e-3) {
    const value = formatNumber(last);
    steps.push(`The values settle toward ${value}, so that is the limit.`);
    return { steps, answer: value };
  }

  if (Math.abs(last) > Math.abs(prev) * 5) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values keep growing, so the limit is ${answer}.`);
    return { steps, answer };
  }

  steps.push('The values do not settle, so the limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

function generateLimitGraph(func, variable, target, displayTarget, limitAnswer) {
  try {
    const center = Number.isFinite(target) ? target : 0;
    // Sample wide (±30 around the point) so the viewer can pan; it opens
    // focused on the approach point.
    const points = sampleFunction(func, variable, { min: center - 30, max: center + 30, step: 0.2, cap: 1e5 });

    if (points.length > 0) {
      // Annotate the point of interest: a guideline at the approach value and,
      // when the limit is a finite number, a marker at (target, L) — hollow,
      // because the function need not actually reach that value.
      const numericLimit = Number(String(limitAnswer).trim());
      const annotations = Number.isFinite(target)
        ? {
            guideline: { x: target, label: `${variable} → ${displayTarget}` },
            limitPoint: Number.isFinite(numericLimit) ? { x: target, y: numericLimit } : null,
          }
        : null;

      return {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: `Showing the behavior as ${variable} approaches ${displayTarget}`,
        annotations,
        initialWindow: Number.isFinite(target) ? { xMin: center - 10, xMax: center + 10 } : null,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Trigonometry
// ---------------------------------------------------------------------------

const COMMON_DEGREE_VALUES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];

// Trig functions with vertical asymptotes, keyed by the function whose zero
// causes them: tan/sec blow up where cos = 0, cot/csc where sin = 0.
const TRIG_ASYMPTOTES = {
  tan: { denom: 'cos', identity: 'tan(x) = sin(x)/cos(x)' },
  sec: { denom: 'cos', identity: 'sec(x) = 1/cos(x)' },
  cot: { denom: 'sin', identity: 'cot(x) = cos(x)/sin(x)' },
  csc: { denom: 'sin', identity: 'csc(x) = 1/sin(x)' },
};

const ASYMPTOTE_EPSILON = 1e-9;
const EXPLODED_MAGNITUDE = 1e12;

/**
 * Detect when a trig expression lands on a vertical asymptote. mathjs never
 * errors there: the floating-point argument misses the asymptote by a hair,
 * so tan(pi/2) comes back as ~1.6e16 (or csc(0) as Infinity) instead of
 * failing. Returns `{ func, denom, identity, argDisplay }` for the offending
 * call, or null when the expression is genuinely defined.
 */
function detectTrigAsymptote(expression, result, treatAsDegrees) {
  const calls = [...String(expression).matchAll(/\b(tan|sec|csc|cot)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi)];
  if (calls.length === 0) return null;

  for (const [, name, rawArg] of calls) {
    const func = name.toLowerCase();
    const { denom, identity } = TRIG_ASYMPTOTES[func];

    let arg;
    try {
      arg = Number(math.evaluate(rawArg.replace(/°/g, '')));
    } catch {
      continue;
    }
    if (!Number.isFinite(arg)) continue;

    const radians = treatAsDegrees ? (arg * Math.PI) / 180 : arg;
    const denomValue = denom === 'cos' ? Math.cos(radians) : Math.sin(radians);
    if (Math.abs(denomValue) < ASYMPTOTE_EPSILON) {
      const argDisplay = treatAsDegrees ? `${beautify(rawArg.replace(/°/g, ''))}°` : beautify(rawArg);
      return { func, denom, identity, argDisplay };
    }
  }

  // No single call sits exactly on an asymptote, but a blown-up magnitude
  // still means the expression as a whole is effectively undefined.
  const numeric = typeof result === 'number' ? result : Number(result);
  if (Math.abs(numeric) > EXPLODED_MAGNITUDE) {
    const func = calls[0][1].toLowerCase();
    const { denom, identity } = TRIG_ASYMPTOTES[func];
    return { func, denom, identity, argDisplay: null };
  }

  return null;
}

export async function solveTrigonometry(expression, settingsOverride) {
  try {
    // A free variable means this is a symbolic expression (an identity to
    // simplify), not a value to compute — math.evaluate would just throw
    // "Undefined symbol x". Route it to the Algebrite simplification path.
    // Equations are excluded: Algebrite reads "=" as assignment, and solving
    // trig equations is not built yet — the error fallback refuses clearly.
    const variable = extractVariable(expression);
    if (!isEquation(expression) && hasVariable(expression, variable)) {
      return await simplifyTrigExpression(expression, variable);
    }

    const steps = [];
    steps.push(`Evaluate the trigonometric expression: ${beautify(expression)}`);

    // 'auto' (default) guesses degrees for bare common angles like sin(30);
    // 'degrees'/'radians' pin the interpretation from the Settings page.
    const angleUnit = settingsOverride?.angleUnit ?? getSettings().angleUnit;

    const hasRadians = expression.includes('pi') || expression.includes('PI');
    const hasDegreeSymbol = expression.includes('°');

    const degreeArgMatch = expression.match(/(?:sin|cos|tan|sec|csc|cot)\s*\(\s*(\d+)\s*\)/i);
    const argValue = degreeArgMatch ? parseInt(degreeArgMatch[1], 10) : null;

    const autoDegrees = !hasRadians && argValue !== null && COMMON_DEGREE_VALUES.includes(argValue);
    let looksLikeDegrees;
    if (angleUnit === 'degrees') {
      // An explicit pi in the input still means radians, even with the
      // preference set to degrees — pi is unambiguous.
      looksLikeDegrees = !hasRadians && argValue !== null;
    } else if (angleUnit === 'radians') {
      looksLikeDegrees = false;
    } else {
      looksLikeDegrees = autoDegrees;
    }

    let result;
    let degreeResult = null;
    const radianResult = math.evaluate(expression);

    // Also computed in radians mode when the input *looks* like degrees, so
    // we can offer the "if you meant degrees" cross-check note below.
    if (looksLikeDegrees || hasDegreeSymbol || (angleUnit === 'radians' && autoDegrees)) {
      const degExpr = expression.replace(/(\d+)\s*°?/g, '($1 * pi / 180)');
      try {
        degreeResult = math.evaluate(degExpr);
      } catch {
        // fall back to radian result
      }
    }

    if (looksLikeDegrees && degreeResult !== null) {
      if (angleUnit === 'degrees') {
        steps.push(`Angle unit is set to degrees (Settings): ${argValue}° = ${argValue} × π/180 radians`);
      } else {
        steps.push(`Detected input as degrees: ${argValue}° = ${argValue} × π/180 radians`);
      }
      result = degreeResult;
      steps.push(`Converting: ${argValue}° = ${formatNumber(argValue * Math.PI / 180)} radians`);
    } else if (hasDegreeSymbol && degreeResult !== null) {
      result = degreeResult;
      steps.push('Input is in degrees (° symbol detected), converting to radians.');
    } else {
      result = radianResult;
      if (angleUnit === 'radians' && autoDegrees) {
        steps.push(`Angle unit is set to radians (Settings), so ${argValue} is treated as ${argValue} radians.`);
      }
    }

    const lower = expression.toLowerCase();
    if (lower.includes('sin')) {
      steps.push('Using the sine function (opposite / hypotenuse in a right triangle).');
    } else if (lower.includes('cos')) {
      steps.push('Using the cosine function (adjacent / hypotenuse in a right triangle).');
    } else if (lower.includes('tan')) {
      steps.push('Using the tangent function (opposite / adjacent in a right triangle).');
    }
    if (hasRadians) steps.push('Input is in radians (π = 180°).');

    const commonAngles = {
      'sin(pi/6)': 'sin(30°) = 1/2',
      'sin(pi/4)': 'sin(45°) = √2/2',
      'sin(pi/3)': 'sin(60°) = √3/2',
      'sin(pi/2)': 'sin(90°) = 1',
      'cos(pi/6)': 'cos(30°) = √3/2',
      'cos(pi/4)': 'cos(45°) = √2/2',
      'cos(pi/3)': 'cos(60°) = 1/2',
      'cos(pi/2)': 'cos(90°) = 0',
      'tan(pi/4)': 'tan(45°) = 1',
      'tan(pi/3)': 'tan(60°) = √3',
      'tan(pi/6)': 'tan(30°) = 1/√3',
    };
    const degreeToRadianAngles = {
      30: 'pi/6', 45: 'pi/4', 60: 'pi/3', 90: 'pi/2',
      120: '2*pi/3', 135: '3*pi/4', 150: '5*pi/6', 180: 'pi',
    };

    const normalized = expression.replace(/\s/g, '').toLowerCase();
    if (commonAngles[normalized]) {
      steps.push(`This is a special angle. Common value: ${commonAngles[normalized]}`);
    } else if (looksLikeDegrees && degreeArgMatch) {
      const funcName = expression.match(/(sin|cos|tan)/i)?.[1]?.toLowerCase();
      const radianKey = degreeToRadianAngles[argValue];
      const lookupKey = funcName && radianKey ? `${funcName}(${radianKey})` : null;
      if (lookupKey && commonAngles[lookupKey]) {
        steps.push(`This is a special angle: ${argValue}°. Common value: ${commonAngles[lookupKey]}`);
      }
    }

    const treatAsDegrees = (looksLikeDegrees || hasDegreeSymbol) && degreeResult !== null;
    const asymptote = detectTrigAsymptote(expression, result, treatAsDegrees);
    if (asymptote) {
      const { func, denom, identity, argDisplay } = asymptote;
      if (argDisplay !== null) {
        steps.push(`${func}(${argDisplay}) is undefined — ${identity}, and ${denom}(${argDisplay}) = 0, so the graph has a vertical asymptote there.`);
      } else {
        steps.push(`The expression is undefined — ${identity}, and ${denom} hits 0 at this input, so ${func} has a vertical asymptote there.`);
      }
      if (treatAsDegrees && Number.isFinite(radianResult) && Math.abs(radianResult) < EXPLODED_MAGNITUDE) {
        steps.push(`Note: if you meant radians, the result would be ${formatNumber(radianResult)}.`);
      }

      return {
        steps,
        answer: 'Undefined',
        tips: [
          `${func}(x) has a vertical asymptote wherever ${denom}(x) = 0 — the value grows without bound instead of settling on a number.`,
          'A calculator that shows a huge number here is hitting floating-point rounding, not a real value.',
          'math.js uses radians by default (π radians = 180°).',
        ],
        common_mistakes: [
          `Assuming ${func} is defined everywhere — it blows up wherever ${denom}(x) = 0.`,
          'Reading the huge floating-point number near an asymptote as the actual answer.',
          'Mixing up radians and degrees (use pi for radians).',
        ],
        graph: generateTrigGraph(expression),
      };
    }

    const formattedResult = formatTrigResult(result);

    if (looksLikeDegrees && radianResult !== null && degreeResult !== null) {
      steps.push(`Result (treating input as degrees): ${formattedResult}`);
      steps.push(`Note: if you meant radians, the result would be ${formatNumber(radianResult)}.`);
    } else if (angleUnit === 'radians' && autoDegrees && degreeResult !== null) {
      steps.push(`Calculate the value: ${formattedResult}`);
      steps.push(`Note: if you meant ${argValue}°, the result would be ${formatNumber(degreeResult)} (switch the angle unit in Settings).`);
    } else {
      steps.push(`Calculate the value: ${formattedResult}`);
    }

    return {
      steps,
      answer: formattedResult,
      tips: [
        'Remember: sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2.',
        'math.js uses radians by default (π radians = 180°).',
        'Key identity: sin²(x) + cos²(x) = 1.',
        'Use pi for π (e.g., sin(pi/2) for sin(90°)).',
      ],
      common_mistakes: [
        'Mixing up radians and degrees (use pi for radians).',
        'Forgetting that tan(90°) is undefined.',
        'Not memorizing the special-angle values.',
        'Confusing sin/cos values for complementary angles.',
      ],
      graph: generateTrigGraph(expression),
    };
  } catch (error) {
    console.error('Trigonometry solver error:', error);
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use pi for π (e.g., sin(pi/4)).', 'For degrees, write sin(30 degrees) or multiply by pi/180.'],
    });
  }
}

// Symbolic trig input (contains a variable): simplify with Algebrite and only
// claim the result after a numeric equivalence check at sample points. This is
// what turns sin(x)^2 + cos(x)^2 into 1 instead of "Unable to evaluate".
async function simplifyTrigExpression(expression, variable) {
  const display = beautify(expression);
  const tips = [
    'Pythagorean identity: sin²(x) + cos²(x) = 1 (and its ÷cos², ÷sin² forms).',
    'Double angle: sin(2x) = 2·sin(x)·cos(x), cos(2x) = cos²(x) − sin²(x).',
    'Rewriting tan, sec, csc, cot in terms of sin and cos often unlocks a simplification.',
  ];
  const commonMistakes = [
    'Cancelling across a sum: sin(x)/x is not sin — only common *factors* cancel.',
    'Dropping the argument: sin² + cos² means nothing without the same angle inside both.',
    'Forgetting that an identity must hold for every angle, not just one test value.',
  ];

  try {
    const Algebrite = await loadAlgebrite();
    const rewritten = rewriteReciprocalTrig(expression);
    const simplified = String(Algebrite.run(`simplify(${rewritten})`)).trim();

    const usable = Boolean(simplified) && !/nil|error|stop/i.test(simplified);
    const verified = usable && expressionsNumericallyEqual(expression, simplified, variable);
    // "Changed" requires a strictly shorter form — a mere reordering of terms
    // is not a simplification worth presenting as one.
    const changed = usable &&
      normalizeForCompare(simplified) !== normalizeForCompare(expression) &&
      normalizeForCompare(simplified).length < normalizeForCompare(expression).length;

    if (usable && verified && changed) {
      const steps = [`Simplify the trigonometric expression: ${display}`];
      if (simplified === '1' && isPythagoreanIdentity(expression)) {
        steps.push('Apply the Pythagorean identity: sin²(θ) + cos²(θ) = 1 for every angle θ.');
      } else {
        steps.push('Apply trigonometric identities and combine terms.');
      }
      steps.push(`Result: ${beautify(simplified)} (confirmed numerically at several values of ${variable}).`);
      return {
        steps,
        answer: beautify(simplified),
        tips,
        common_mistakes: commonMistakes,
        graph: generateSymbolicTrigGraph(expression, variable, beautify(simplified)),
      };
    }

    // Nothing simpler was found (or the candidate failed verification):
    // be honest rather than guessing.
    return {
      steps: [
        `Simplify the trigonometric expression: ${display}`,
        verified
          ? 'No simpler equivalent form was found — the expression is already in simplest terms.'
          : 'No trustworthy simplification was found for this expression.',
      ],
      answer: display,
      tips,
      common_mistakes: commonMistakes,
      graph: generateSymbolicTrigGraph(expression, variable, null),
    };
  } catch (error) {
    console.error('Symbolic trig simplification error:', error);
    return parseError({
      input: display,
      hint: error.message,
      tips,
    });
  }
}

function normalizeForCompare(s) {
  return String(s).replace(/[\s*]/g, '');
}

function isPythagoreanIdentity(expression) {
  const s = String(expression).replace(/\s+/g, '');
  return (
    /^sin\(([^()]+)\)\^2\+cos\(\1\)\^2$/i.test(s) ||
    /^cos\(([^()]+)\)\^2\+sin\(\1\)\^2$/i.test(s)
  );
}

// Graph the symbolic expression itself over -2π..2π (an identity like
// sin²+cos² draws its constant value — a flat line at 1 — which is the point).
function generateSymbolicTrigGraph(expression, variable, simplifiedDisplay) {
  try {
    const points = sampleFunction(expression, variable, { min: -6.28, max: 6.28, step: 0.1, cap: 10 });
    if (points.length === 0) return null;
    return {
      points,
      title: `Graph of ${beautify(expression)}`,
      description: simplifiedDisplay
        ? `Equivalent to ${simplifiedDisplay} over -2π to 2π`
        : 'Shown over -2π to 2π',
    };
  } catch {
    return null;
  }
}

function formatTrigResult(result) {
  if (typeof result !== 'number') return String(result);

  const exact = [
    [0.5, '1/2'],
    [-0.5, '-1/2'],
    [Math.sqrt(2) / 2, '√2/2'],
    [-Math.sqrt(2) / 2, '-√2/2'],
    [Math.sqrt(3) / 2, '√3/2'],
    [-Math.sqrt(3) / 2, '-√3/2'],
    [Math.sqrt(3), '√3'],
    [1 / Math.sqrt(3), '1/√3'],
  ];
  for (const [value, label] of exact) {
    if (Math.abs(result - value) < 1e-4) {
      return `${formatNumber(result)} (or ${label})`;
    }
  }
  return formatNumber(result);
}

function generateTrigGraph(expression) {
  try {
    const lower = expression.toLowerCase();
    if (!['sin', 'cos', 'tan'].some((fn) => lower.includes(fn))) return null;

    let funcToGraph = 'sin(x)';
    if (lower.includes('cos')) funcToGraph = 'cos(x)';
    else if (lower.includes('tan')) funcToGraph = 'tan(x)';

    // -2π to 2π; cap keeps tan's asymptotes from exploding the axis.
    const points = sampleFunction(funcToGraph, 'x', { min: -6.28, max: 6.28, step: 0.1, cap: 10 });

    if (points.length > 0) {
      return {
        points,
        title: `Graph of ${funcToGraph}`,
        description: `Showing the ${funcToGraph.split('(')[0]} function over -2π to 2π`,
      };
    }
  } catch (error) {
    console.error('Trig graph generation error:', error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Functions / graphing — rebuilt July 2026 (Wave 2), lives in its own module.
// Re-exported here so existing import sites keep working.
// ---------------------------------------------------------------------------

export { solveFunctions } from './functionsSolver.js';
