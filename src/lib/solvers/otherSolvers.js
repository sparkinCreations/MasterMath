import { extractVariable, parseMathExpression } from '../mathParser.js';
import { math, beautify, formatNumber, sampleFunction, loadAlgebrite } from './solverUtils.js';
import { getSettings } from '../settings.js';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export async function solveLimit(expression) {
  try {
    let cleaned = expression.trim().replace(/[.?!]+$/, '').trim();
    cleaned = cleaned.replace(/^(?:find the limit|evaluate the limit|calculate the limit)\s+(?:of\s+)?/i, '');

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

    const target = resolveApproachValue(approachValue);
    if (Number.isNaN(target)) {
      throw new Error('Unable to interpret the limit approach value');
    }

    const displayTarget = formatApproach(approachValue, target);

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

    const result = Number.isFinite(target)
      ? await evaluateFiniteLimit(func, variable, target)
      : estimateInfiniteLimit(func, variable, target);

    const steps = [
      `Evaluate lim (${variable}→${displayTarget}) ${beautify(func)}`,
      ...result.steps,
    ];

    return {
      steps,
      answer: `lim (${variable}→${displayTarget}) ${beautify(func)} = ${result.answer}`,
      verified: result.verified ?? false,
      verificationMethod: result.verified ? (result.verificationMethod ?? 'numeric check') : null,
      tips: [
        'Try substituting the value directly first — if the function is continuous there, that is the limit.',
        'A 0/0 or ∞/∞ result is indeterminate: factor, rationalize, or use L\'Hôpital\'s rule.',
        'For limits at infinity, compare the growth rates of the numerator and denominator.',
      ],
      common_mistakes: [
        'Assuming the limit equals the function value even at a discontinuity.',
        'Only checking one side when the two sides can disagree.',
        'Stopping at a 0/0 form instead of simplifying first.',
      ],
      graph: generateLimitGraph(func, variable, target, displayTarget),
    };
  } catch (error) {
    console.error('Limit solver error:', error);
    return {
      steps: ['Identify the limit expression', 'Approach the value from both sides', 'Evaluate the limit'],
      answer: 'Unable to evaluate limit',
      tips: ['Check the formatting of your limit expression.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
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

function tryAlgebriteSimplify(Algebrite, func, variable, target) {
  try {
    const simplified = String(Algebrite.run(`simplify(${func})`)).trim();
    if (!simplified || /nil|error/i.test(simplified)) return null;

    // Re-substitute into the simplified form.
    const value = algebriteNumber(Algebrite, `(${simplified})`, variable, target);
    if (value === null) return null;

    return {
      steps: [
        `Direct substitution gives an indeterminate form, so simplify first.`,
        `Simplify the expression: ${beautify(simplified)}.`,
        `Now substitute ${variable} = ${formatNumber(target)}: the limit is ${formatNumber(value)}.`,
      ],
      answer: formatNumber(value),
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

    return {
      steps: [
        `Direct substitution gives 0/0, so expand the numerator and denominator as Taylor series about ${variable} = ${formatNumber(target)}.`,
        `Numerator ≈ ${beautify(numExp)}; denominator ≈ ${beautify(denExp)}.`,
        `Divide the series and cancel the common factor; the limit is ${formatNumber(value)}.`,
      ],
      answer: formatNumber(value),
      verified: verifyLimitNumerically(func, variable, target, value),
    };
  }

  // Non-quotient indeterminate forms: expand the whole expression directly.
  const expanded = taylorExpand(Algebrite, func, variable, target);
  if (!expanded) return null;
  const value = algebriteNumber(Algebrite, `(${expanded})`, variable, target);
  if (value === null) return null;

  return {
    steps: [
      `Expand as a Taylor series about ${variable} = ${formatNumber(target)}.`,
      `Series: ${beautify(expanded)}.`,
      `Evaluating the leading behaviour gives ${formatNumber(value)}.`,
    ],
    answer: formatNumber(value),
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
      steps.push(`After ${i} differentiation${i === 1 ? '' : 's'}, substitution gives ${formatNumber(value)}.`);
      return {
        steps,
        answer: formatNumber(value),
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

function generateLimitGraph(func, variable, target, displayTarget) {
  try {
    const center = Number.isFinite(target) ? target : 0;
    const points = sampleFunction(func, variable, { min: center - 10, max: center + 10, step: 0.2, cap: 1000 });

    if (points.length > 0) {
      return {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: `Showing the behavior as ${variable} approaches ${displayTarget}`,
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

export function solveTrigonometry(expression, settingsOverride) {
  try {
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
    return {
      steps: [
        `Parse trigonometric expression: ${expression}`,
        'Unable to evaluate — check the formatting.',
        'Try: sin(pi/4), or cos(60 * pi / 180) for degrees.',
      ],
      answer: 'Unable to evaluate',
      tips: ['Use pi for π', 'For degrees, multiply by pi/180.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
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
// Functions / graphing
// ---------------------------------------------------------------------------

export function solveFunctions(expression) {
  try {
    const variable = extractVariable(expression);

    let func = expression;
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
    }

    const points = sampleFunction(func, variable);
    const vertex = findVertex(points);
    const intercepts = findIntercepts(func, variable);

    const steps = [
      `Analyze the function: f(${variable}) = ${beautify(func)}`,
      'Identify the type of function (linear, quadratic, etc.).',
      vertex ? `Vertex / extremum near (${formatNumber(vertex.x)}, ${formatNumber(vertex.y)}).` : 'Calculate the key features.',
      intercepts.length > 0
        ? `x-intercepts near ${variable} = ${intercepts.map(formatNumber).join(', ')}.`
        : 'No x-intercepts found in the sampled range.',
      'Plot the points and sketch the graph.',
    ];

    return {
      steps,
      answer: `f(${variable}) = ${beautify(func)}`,
      tips: [
        'Identify the domain and range of the function.',
        'Look for symmetry (even or odd functions).',
        'Critical points occur where the derivative equals zero.',
      ],
      common_mistakes: [
        'Not checking for undefined values in the domain.',
        'Misidentifying the type of function.',
        'Plotting too few points to see the shape.',
      ],
      graph: points.length > 0 ? {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: `The function as ${variable} ranges from -10 to 10`,
      } : null,
    };
  } catch (error) {
    console.error('Functions solver error:', error);
    return {
      steps: ['Parse the function', 'Identify the key features', 'Generate the graph'],
      answer: 'Unable to analyze function',
      tips: ['Check your function notation.'],
      common_mistakes: ['Using incorrect syntax'],
      graph: null,
    };
  }
}

function findVertex(points) {
  if (points.length < 3) return null;
  const extrema = [];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i].y - points[i - 1].y;
    const after = points[i + 1].y - points[i].y;
    if ((before <= 0 && after >= 0) || (before >= 0 && after <= 0)) {
      extrema.push(points[i]);
    }
  }
  if (extrema.length > 0) {
    return extrema.reduce((closest, point) => (Math.abs(point.x) < Math.abs(closest.x) ? point : closest));
  }
  return points[Math.floor(points.length / 2)];
}

function findIntercepts(func, variable) {
  const intercepts = [];
  for (let i = -10; i <= 10; i += 0.5) {
    let y;
    try {
      y = math.evaluate(func, { [variable]: i });
    } catch {
      continue;
    }
    if (Number.isFinite(y) && Math.abs(y) < 0.1) intercepts.push(i);
  }
  return intercepts.slice(0, 3);
}
