// Limits: lim x→a f(x), one-sided limits and limits at ±∞. Named techniques
// first (standard limits, factor-and-cancel, conjugate, leading terms,
// squeeze, series, L'Hôpital), each verified numerically, then numeric
// estimation as the honest fallback. Split out of otherSolvers.js in 1.39.0.

import { extractVariable, parseMathExpression } from '../mathParser.js';
import {
  math,
  beautify,
  formatNumber,
  sampleFunction,
  loadAlgebrite,
  hasVariable,
  parsesAsMath,
  isAlgebriteFailure,
  stripOuterParens,
  gcd,
  mark,
  stripMathMarkers,
} from './solverUtils.js';
import { parseError, unsupported, undefinedValue } from '../solutionEnvelope.js';
// A limit at a trig asymptote (tan x at π/2) is recognised by the trig code.
import { detectTrigAsymptote, EXPLODED_MAGNITUDE } from './trigonometrySolver.js';

// Tips and mistakes chosen from the technique the limit actually used (read
// off its verification method and steps), instead of one list for every
// limit. September 2026 review, batch 3.
function limitGuidance(result) {
  const method = String(result.verificationMethod || '');
  const text = stripMathMarkers((result.steps || []).join('\n'));
  if (/^logarithms/.test(method)) {
    return {
      tips: [
        '1^∞ is indeterminate: a base just above 1 raised to a huge power can go anywhere. Take logarithms to bring the exponent down: ln(B^E) = E·ln(B).',
        'ln(1 + u) ≈ u for small u (the standard limit ln(1 + u)/u → 1), so lim B^E = e^(lim E·(B − 1)).',
        'The family to know: (1 + a/x)^(bx) → e^(ab) as x → ∞, and (1 + ax)^(b/x) → e^(ab) as x → 0.',
      ],
      common_mistakes: [
        'Saying 1^∞ = 1: the base is only approaching 1, and the exponent magnifies the difference.',
        'Forgetting to undo the logarithm at the end: ln L = 2 means L = e², not 2.',
        'Dropping the constant in the exponent: (1 + 1/x)^(2x) → e², not e.',
      ],
    };
  }
  if (/standard limit/.test(method)) {
    return {
      tips: [
        'The standard limits sin(u)/u → 1 and (1 − cos u)/u² → 1/2 (as u → 0) are the building blocks: rewrite so the argument of the trig function matches the denominator.',
        'A constant factor comes out: sin(3x)/x = 3·sin(3x)/(3x).',
        'These limits are the reason d/dx sin(x) = cos(x) — they sit under every trig derivative.',
      ],
      common_mistakes: [
        'Substituting x = 0 and stopping at 0/0 — the form is indeterminate, not an answer.',
        'Forgetting the constant factor when the argument is scaled (sin(3x)/x → 3, not 1).',
        'Applying the standard limit when the argument does not match the denominator.',
      ],
    };
  }
  if (/factor and cancel/.test(method) || /Cancel it/.test(text)) {
    return {
      tips: [
        '0/0 means a common factor is hiding in numerator and denominator: factor both and cancel it.',
        'The cancelled form equals the original everywhere except at the point itself — that is exactly what a limit needs.',
        'On the graph, a cancelled factor is a hole (removable discontinuity), not an asymptote.',
      ],
      common_mistakes: [
        'Substituting the value before cancelling and stopping at 0/0.',
        'Claiming the function "equals" the simplified form at the point — it is undefined there.',
        'Cancelling terms instead of factors.',
      ],
    };
  }
  if (/diverges to|opposite infinities|Does not exist|blows up instead of settling/i.test(text)) {
    return {
      tips: [
        'When direct substitution blows up, check each side separately: the two-sided limit exists only if both sides agree.',
        'A vertical asymptote gives infinite one-sided limits; opposite signs on the two sides mean the limit does not exist.',
        'Write "does not exist" (DNE) rather than a number when the sides disagree; write +∞ or −∞ when they agree on an infinity.',
      ],
      common_mistakes: [
        'Writing ∞ for a limit whose two sides go to +∞ and −∞.',
        'Treating 1/0 as a number instead of describing how the function behaves nearby.',
        'Checking only one side of the point.',
      ],
    };
  }
  if (/increasingly large|values settle toward|highest powers|degree/i.test(text) || (/infinit|∞/i.test(text) && /at infinity|growth|dominant|leading/i.test(text + method))) {
    return {
      tips: [
        'For a limit at infinity, the highest power dominates: divide numerator and denominator by it.',
        'Equal degrees → the ratio of leading coefficients; lower degree on top → 0; higher on top → ±∞.',
        'Exponentials outgrow every polynomial, and polynomials outgrow every logarithm.',
      ],
      common_mistakes: [
        'Plugging in a large number and rounding — that suggests the value but does not prove it.',
        'Forgetting the sign when the leading term is odd and x → −∞.',
        'Treating ∞/∞ as 1.',
      ],
    };
  }
  return {
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
  };
}

export async function solveLimit(expression) {
  try {
    let cleaned = expression.trim().replace(/[.?!]+$/, '').trim();
    cleaned = cleaned.replace(/^(?:(?:what(?:'s| is)|find|evaluate|calculate|compute|determine)\s+)?(?:the\s+)?lim(?:it)?\s+of\s+/i, '');

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
      // "lim sin(x)/x as x approaches 0": the leading "lim" belongs to the
      // notation, not the function — left in, it was read as a variable
      // multiplying sin(x)/x and the limit "did not exist".
      func = parseMathExpression(limitMatch3[1].replace(/^\s*lim(?:it)?(?:\s+of)?\s+/i, ''));
      variable = limitMatch3[2];
      approachValue = limitMatch3[3].trim();
    } else {
      // No approach point anywhere in the input ("lim sin(x)/x", or a bare
      // expression). Quietly assuming x → 0 gave confident answers to
      // questions that were never asked; ask for the point instead.
      func = parseMathExpression(cleaned.replace(/^(?:lim(?:it)?)\s*/i, ''));
      variable = extractVariable(func);
      // A constant expression (tan(pi/2)) has no approach point to miss —
      // fall through and let the constant/asymptote handling speak. An
      // EMPTY one ("lim") is not a constant.
      if (!func.trim()) {
        return parseError({
          input: expression,
          hint: 'There is no expression to take the limit of.',
          tips: ['Write limits like: lim x->0 (sin(x)/x).'],
        });
      }
      if (hasVariable(func, variable)) {
        // The expression itself reads fine — say so, rather than the generic
        // "Could not read … as a math expression" first step.
        return parseError({
          input: expression,
          steps: [
            `${mark(beautify(func))} reads fine as an expression, but no approach point was given.`,
            `A limit needs one: the same expression has different limits at different points (where does ${mark(variable)} go?).`,
          ],
          hint: `No approach point was given — a limit needs one (where does ${variable} go?).`,
          tips: ['Write limits like: lim x->0 (sin(x)/x), or (x^2-1)/(x-1) as x approaches 1, or lim x->infinity 1/x.'],
          common_mistakes: ['Leaving out the "x → a" part — the same expression has different limits at different points.'],
        });
      }
    }

    // Whatever the phrasing, "lim" must never survive into the function: if it
    // does, the input is in a shape the patterns above do not read, and the
    // honest answer is a format hint, not a limit of lim·f(x).
    if (/(?<![a-z])lim(?:it)?(?![a-z])/i.test(func)) {
      return parseError({
        input: expression,
        hint: 'The limit notation could not be separated from the function.',
        tips: ['Write limits like: lim x->0 (sin(x)/x), or sin(x)/x as x approaches 0.'],
      });
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
          `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${beautify(func)}`)}`,
          `${mark(`${hit.func}(${hit.argDisplay})`)} is undefined — ${mark(hit.identity)}, and ${mark(`${hit.denom}(${hit.argDisplay}) = 0`)}, so the graph has a vertical asymptote there.`,
          `The expression inside the limit is undefined for every ${mark(variable)}, so the limit is undefined as well.`,
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

    // A constant that divides by zero — lim x→0 1/0 — is undefined for every
    // x, so there is no limit to take. It was answered "∞", marked Solved.
    if (!hasVariable(func, variable)) {
      let value;
      try { value = math.evaluate(func); } catch { value = undefined; }
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return undefinedValue({
          input: expression,
          reason: `${beautify(func)} divides by zero: it is undefined for every ${variable}, so it has no limit`,
          steps: [
            `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${beautify(func)}`)}.`,
            `The expression has no ${mark(variable)} in it, and it divides by zero: it is undefined for every ${mark(variable)}, not just near ${mark(displayTarget)}.`,
            'A limit describes what a function approaches near a point where it is defined around it. Here it is defined nowhere, so the limit does not exist.',
          ],
          tips: ['Division by zero is undefined; a limit can only say what happens as a denominator APPROACHES zero (lim x→0 1/x), not when it is zero.'],
        });
      }
    }

    // A second symbol in the expression — lim h→0 ((x+h)² − x²)/h — cannot
    // be sampled numerically (x has no value). Simplify symbolically first;
    // if the singularity cancels, substitute. Otherwise say why not.
    const otherSymbol = (func.replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|abs|log|ln|exp|pi|e|infinity)\b/gi, '').match(new RegExp(`(?<![a-z])[a-z](?![a-z])`, 'gi')) || []).find((c) => c.toLowerCase() !== variable);
    if (otherSymbol) {
      const Algebrite = await loadAlgebrite();
      let sym = null;
      try {
        const simplified = String(Algebrite.run(`simplify(${func})`));
        const substituted = Number.isFinite(target) ? String(Algebrite.run(`simplify(subst(${target}, ${variable}, ${simplified}))`)) : '';
        if (substituted && !isAlgebriteFailure(substituted) && !/\bnil\b|Stop/.test(substituted) && !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(substituted)) {
          sym = { simplified, substituted };
        }
      } catch { sym = null; }
      if (sym) {
        return {
          steps: [
            `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${beautify(func)}`)}`,
            `The expression also contains ${mark(otherSymbol)}, which stays symbolic — so simplify first: ${mark(`${beautify(func)} = ${beautify(sym.simplified)}`)}`,
            `Now substitute ${mark(`${variable} = ${displayTarget}`)}: ${mark(beautify(sym.substituted))}`,
          ],
          answer: `lim (${variable}→${displayTarget}) ${beautify(func)} = ${beautify(sym.substituted)}`,
          tips: ['When the expression has a parameter, simplify algebraically until the limit variable can be substituted directly.', 'This is exactly the difference-quotient limit that defines the derivative.'],
          common_mistakes: ['Substituting before simplifying and stopping at 0/0.'],
          graph: null,
        };
      }
      return unsupported({
        input: expression,
        reason: `The expression contains another symbol (${otherSymbol}) as well as ${variable}, and it did not simplify to something ${variable} = ${displayTarget} can be substituted into. Limits with a symbolic parameter are only supported when they simplify algebraically.`,
        answer: 'This limit is beyond what this solver can compute',
        tips: ['Give the parameter a value (e.g. replace x with 3) to evaluate the limit numerically.'],
      });
    }

    const result = !Number.isFinite(target)
      ? await evaluateInfiniteLimit(func, variable, target)
      : side !== 0
        ? evaluateOneSidedLimit(func, variable, target, side)
        : await evaluateFiniteLimit(func, variable, target);

    const steps = [
      `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${beautify(func)}`)}`,
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
      ] : limitGuidance(result).tips,
      common_mistakes: side !== 0 ? [
        'Mixing up the notation: x → a⁺ approaches from the right (values above a), x → a⁻ from the left.',
        'Reporting a two-sided limit when only one side was asked for (or exists).',
        'Assuming a one-sided limit exists where the function is not even defined on that side.',
      ] : limitGuidance(result).common_mistakes,
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
      steps: [`Substitute directly: at ${mark(`${variable} = ${formatNumber(target)}`)}, the function is defined and equals ${mark(formatNumber(direct))}.`],
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

  // Rung 1b: the technique a calculus course would name — standard limit,
  // squeeze, conjugate, factor-and-cancel — each verified numerically. The
  // general ladder below still catches everything these do not match.
  const named = tryNamedTechnique(Algebrite, func, variable, target);
  if (named && named.verified) return named;

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

function tryNamedTechnique(Algebrite, func, variable, target) {
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
function tryLeadingTerms(Algebrite, func, variable, target) {
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
function trySqueezeAtInfinity(func, variable, target) {
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
    `Divide through by ${mark(beautify(den))}: ${mark(`−1/${beautify(den)} ≤ ${beautify(func)} ≤ 1/${beautify(den)}`)}.`,
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
function tryOneToInfinity(Algebrite, func, variable, target) {
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

async function evaluateInfiniteLimit(func, variable, target) {
  let Algebrite = null;
  try {
    Algebrite = await loadAlgebrite();
  } catch {
    Algebrite = null;
  }
  try {
    const squeeze = trySqueezeAtInfinity(func, variable, target);
    if (squeeze && squeeze.verified) return squeeze;
  } catch { /* fall through */ }
  try {
    const power = tryOneToInfinity(Algebrite, func, variable, target);
    if (power && power.verified) return power;
  } catch { /* fall through */ }
  if (Algebrite) {
    try {
      const leading = tryLeadingTerms(Algebrite, func, variable, target);
      if (leading && leading.verified) return leading;
    } catch { /* fall through */ }
  }
  return estimateInfiniteLimit(func, variable, target);
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
    steps.push(`Substitute directly: at ${mark(`${variable} = ${formatNumber(target)}`)}, the function is defined and equals ${mark(formatNumber(direct))}.`);
    return { steps, answer: formatNumber(direct) };
  }

  if (Number.isNaN(direct)) {
    steps.push(`Direct substitution at ${mark(`${variable} = ${formatNumber(target)}`)} is undefined (an indeterminate form), so approach from both sides.`);
  } else {
    steps.push(`Direct substitution at ${mark(`${variable} = ${formatNumber(target)}`)} blows up instead of settling on a value, so approach from both sides.`);
  }

  // Oscillation: if a side never settles — the values keep swinging across a
  // wide range no matter how close we get — the limit fails to exist *because
  // the function oscillates*, which is a different reason than two one-sided
  // values disagreeing. Say so specifically (sin(1/x) is the classic case).
  if (sideOscillates(func, variable, target, 1) || sideOscillates(func, variable, target, -1)) {
    steps.push(`Sampling ever closer to ${mark(`${variable} = ${formatNumber(target)}`)}, the values keep swinging between roughly the same high and low values instead of settling toward any number.`);
    steps.push('The function oscillates infinitely often near this point, so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const left = sampleSide(func, variable, target, -1);
  const right = sampleSide(func, variable, target, 1);
  steps.push(`From the left (${mark(`${variable} → ${formatNumber(target)}⁻`)}): ${sideText(left)}`);
  steps.push(`From the right (${mark(`${variable} → ${formatNumber(target)}⁺`)}): ${sideText(right)}`);

  if (left.diverges && right.diverges) {
    if (left.sign === right.sign) {
      const answer = left.sign > 0 ? '∞' : '-∞';
      steps.push(`Both sides grow without bound in the same direction, so the limit diverges to ${mark(answer)}.`);
      return { steps, answer };
    }
    steps.push('The two sides run off to opposite infinities (a vertical asymptote), so the limit does not exist.');
    return { steps, answer: 'Does not exist' };
  }

  const bothConverge = left.value !== undefined && right.value !== undefined;
  if (bothConverge && Math.abs(left.value - right.value) < 1e-4) {
    const value = formatLimitConstant((left.value + right.value) / 2);
    steps.push(`Both sides approach ${mark(value)}, so the limit exists.`);
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

// describeSide for a step: the value or the infinity typeset, the words not.
function sideText(side) {
  if (side.diverges) return `diverges to ${mark(side.sign > 0 ? '∞' : '-∞')}`;
  if (side.outOfDomain) return 'not defined on this side';
  return mark(formatNumber(side.value));
}

// Evaluate a one-sided limit (side: 1 = from the right, -1 = from the left)
// by sampling a log-spaced ladder of offsets shrinking toward the point.
// Numeric by nature — like estimateFiniteLimitNumeric, it does not fabricate
// a "verified" flag — with one exactness upgrade: when the function is defined
// at the point and the samples settle onto that value, the limit is reported
// as the exact value and marked verified by direct substitution.
function evaluateOneSidedLimit(func, variable, target, side) {
  const dirWord = side > 0 ? 'right' : 'left';
  const sideMark = side > 0 ? '⁺' : '⁻';
  const steps = [
    `This is a one-sided limit: only the ${dirWord}-hand behaviour (${mark(`${variable} → ${formatNumber(target)}${sideMark}`)}) matters.`,
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
      steps.push(`Approaching from the ${dirWord}, the values grow without bound — the limit is ${mark(answer)}.`);
      return { steps, answer };
    }
    steps.push(`The function is not defined on the ${dirWord} side of ${mark(`${variable} = ${formatNumber(target)}`)}, so this one-sided limit does not exist.`);
    return { steps, answer: 'Does not exist' };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const preview = [values[0], values[Math.floor(values.length / 2)], last]
    .map((v) => formatNumber(v));
  steps.push(`Sample ever closer on the ${dirWord} side: the values run ${mark(preview.join(' → '))}.`);

  // Explosive growth: magnitudes climbing steadily to something huge.
  if (Math.abs(last) > 1e4 && Math.abs(last) > 5 * Math.abs(first)) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the one-sided limit is ${mark(answer)}.`);
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
      steps.push(`The values settle onto the function's own value there: ${mark(`f(${formatNumber(target)}) = ${formatNumber(direct)}`)}.`);
      return { steps, answer: formatNumber(direct), verified: true, verificationMethod: 'direct substitution' };
    }
    steps.push(`The values settle toward ${mark(formatLimitConstant(last))}, so that is the one-sided limit.`);
    return { steps, answer: formatLimitConstant(last) };
  }

  // Slow, steady divergence (e.g. ln(x) as x → 0⁺): each step keeps the same
  // sign and never decays, so the values are marching off to ±∞ even though
  // the magnitudes still look tame at these offsets.
  const sameSign = deltas.every((d) => d !== 0 && Math.sign(d) === Math.sign(deltas[0]));
  if (sameSign && lastDelta >= 0.5 * Math.abs(deltas[0])) {
    const answer = deltas[0] > 0 ? '∞' : '-∞';
    steps.push(`The values keep marching in the same direction without settling — a slow divergence to ${mark(answer)}.`);
    return { steps, answer };
  }

  steps.push('The values do not settle on that side, so the one-sided limit does not exist.');
  return { steps, answer: 'Does not exist' };
}

// A numeric limit that is a familiar constant is named: e, e², π, π/2.
function formatLimitConstant(v) {
  const dec = formatNumber(v);
  const named = [
    [Math.E, 'e'], [Math.E ** 2, 'e^2'], [1 / Math.E, '1/e'], [Math.sqrt(Math.E), '√e'],
    [Math.PI, 'π'], [Math.PI / 2, 'π/2'], [Math.PI / 4, 'π/4'], [2 * Math.PI, '2π'], [Math.SQRT2, '√2'], [Math.LN2, 'ln(2)'],
  ];
  const hit = named.find(([c]) => Math.abs(v - c) < 1e-6 * Math.max(1, Math.abs(c)));
  if (hit) return `${hit[1]} (≈ ${dec})`;
  // Beyond the table: any integer power of e ((1 + 3/x)^x → e^3), then a small
  // rational (2/5 rather than 0.4). Only claim a name when the sampled value
  // is unambiguously close — a limit estimate is accurate to ~1e-6 at best.
  const close = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  if (v > 0) {
    const n = Math.round(Math.log(v));
    if (n !== 0 && Math.abs(n) <= 12 && close(v, Math.exp(n))) {
      return `${n > 0 ? `e^${n}` : `e^(${n})`} (≈ ${dec})`;
    }
  }
  if (!Number.isInteger(v)) {
    for (let q = 2; q <= 12; q += 1) {
      const p = Math.round(v * q);
      if (p !== 0 && Math.abs(p) <= 200 && close(v, p / q) && gcd(Math.abs(p), q) === 1) {
        return `${p}/${q} (≈ ${dec})`;
      }
    }
  }
  return dec;
}

function estimateInfiniteLimit(func, variable, target) {
  const sign = target === Infinity ? 1 : -1;
  const samples = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((m) => evalAt(func, variable, sign * m));
  const finite = samples.filter((v) => Number.isFinite(v));

  const steps = [`Evaluate the function at increasingly large ${sign > 0 ? 'positive' : 'negative'} values of ${variable}.`];
  // A value the display precision would round to 0 is shown in scientific
  // notation instead: "0, 0, 0, 0" hid the convergence of x/e^x (3.7e-42,
  // then values too small for double precision) and looked like a bug.
  const shown = samples.map((v) => {
    if (!Number.isFinite(v)) return '±∞';
    const text = formatNumber(v);
    return v !== 0 && /^-?0(?:\.0+)?$/.test(text) ? v.toExponential(2) : text;
  });
  const underflowed = samples.some((v, i) => v === 0 && i > 0 && samples[i - 1] !== 0 && Math.abs(samples[i - 1]) < 1e-30);
  steps.push(`Samples: ${mark(shown.join(', '))}${underflowed ? ' (a value smaller than about 1e-308 cannot be represented in double precision and is computed as exactly 0)' : ''}`);

  if (finite.length < 2) {
    // Growing without bound — base the sign on the last value we could evaluate.
    const reference = finite.length ? finite[finite.length - 1] : samples[samples.length - 1];
    const answer = reference > 0 ? '∞' : '-∞';
    steps.push(`The values grow without bound, so the limit is ${mark(answer)}.`);
    return { steps, answer };
  }

  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  // Converging: the successive differences shrink and the last is small
  // relative to the value. (1 + 2/x)^x still moves in the third decimal at
  // x = 10⁴ (7.3876 → 7.3890) yet is plainly settling on e².
  const diffs = finite.slice(1).map((v, i) => Math.abs(v - finite[i]));
  const shrinking = diffs.length >= 3 && diffs.slice(-3).every((d, i, arr) => i === 0 || d <= arr[i - 1] * 1.01);
  if (Math.abs(last - prev) < 1e-3 || (shrinking && Math.abs(last - prev) < 1e-4 * (1 + Math.abs(last)))) {
    const value = formatLimitConstant(last);
    steps.push(`The values settle toward ${mark(value)}, so that is the limit.`);
    return { steps, answer: value };
  }

  if (Math.abs(last) > Math.abs(prev) * 5) {
    const answer = last > 0 ? '∞' : '-∞';
    steps.push(`The values keep growing, so the limit is ${mark(answer)}.`);
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
