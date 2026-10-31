// Limits: lim x→a f(x), one-sided limits and limits at ±∞. Named techniques
// first (standard limits, factor-and-cancel, conjugate, leading terms,
// squeeze, series, L'Hôpital), each verified numerically, then numeric
// estimation as the honest fallback. Split out of otherSolvers.js in 1.39.0.
// The named techniques are in ./limits/techniques.js, the numeric estimates
// and one-sided limits in ./limits/numeric.js, the tips and mistakes in
// ./limits/guidance.js.

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
  mark,
  absBars,
} from './solverUtils.js';
import { parseError, unsupported, undefinedValue } from '../solutionEnvelope.js';
// A limit at a trig asymptote (tan x at π/2) is recognised by the trig code.
import { detectTrigAsymptote, EXPLODED_MAGNITUDE } from './trigonometrySolver.js';
import { limitGuidance } from './limits/guidance.js';
import {
  evaluateOneSidedLimit,
  evalAt,
  valueAt,
  domainEdgeStep,
  zeroToZero,
  estimateFiniteLimitNumeric,
  estimateInfiniteLimit,
} from './limits/numeric.js';
import { tryGrowthRates, tryZeroToZero, tryNoContestAtZero } from './limits/growth.js';
import { tryTwoSequences } from './limits/sequences.js';
import {
  tryNamedTechnique,
  tryAlgebriteSimplify,
  trySeriesLimit,
  tryLHopital,
  trySqueezeAtInfinity,
  tryOneToInfinity,
  tryLeadingTerms,
  tryConjugateAtInfinity,
  tryPoleSigns,
} from './limits/techniques.js';

export async function solveLimit(expression) {
  try {
    let cleaned = expression.trim().replace(/[.?!]+$/, '').trim();
    // "limit of" with nothing after it is an empty limit, not the limit of a
    // variable called "of" (it was answered "lim (o→0) of does not exist").
    cleaned = cleaned.replace(/^(?:(?:what(?:'s| is)|find|evaluate|calculate|compute|determine)\s+)?(?:the\s+)?lim(?:it)?\s+of(?:\s+|$)/i, '');

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
      func = parseMathExpression(cleaned.replace(/^(?:lim(?:it)?)(?:\s+of)?\s*/i, ''));
      variable = extractVariable(func);
      // A constant expression (tan(pi/2)) has no approach point to miss —
      // fall through and let the constant/asymptote handling speak. An
      // EMPTY one ("lim") is not a constant.
      if (!func.trim()) {
        return parseError({
          input: expression,
          hint: 'There is no expression to take the limit of.',
          tips: ['Write limits like: "lim x->0 (sin(x)/x)".'],
        });
      }
      if (hasVariable(func, variable)) {
        // The expression itself reads fine — say so, rather than the generic
        // "Could not read … as a math expression" first step.
        return parseError({
          input: expression,
          steps: [
            `${mark(absBars(beautify(func)))} reads fine as an expression, but no approach point was given.`,
            `A limit needs one: the same expression has different limits at different points (where does ${mark(variable)} go?).`,
          ],
          hint: `No approach point was given — a limit needs one (where does ${variable} go?).`,
          tips: ['Write limits like: "lim x->0 (sin(x)/x)", or "(x^2-1)/(x-1) as x approaches 1", or "lim x->infinity 1/x".'],
          common_mistakes: [`Leaving out the "${mark('x → a')}" part — the same expression has different limits at different points.`],
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
        tips: ['Write limits like: "lim x->0 (sin(x)/x)", or "sin(x)/x as x approaches 0".'],
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
        tips: ['Write limits like: "lim x->0 (sin(x)/x)", or "(x^2-1)/(x-1) as x approaches 1".'],
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
          `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${absBars(beautify(func))}`)}`,
          `${mark(`${hit.func}(${hit.argDisplay})`)} is undefined — ${mark(hit.identity)}, and ${mark(`${hit.denom}(${hit.argDisplay}) = 0`)}, so the graph has a vertical asymptote there.`,
          `The expression inside the limit is undefined for every ${mark(variable)}, so the limit is undefined as well.`,
        ],
        answer: 'Undefined',
        tips: [
          `${mark(`${hit.func}(x)`)} has a vertical asymptote wherever ${mark(`${hit.denom}(x) = 0`)} — the value grows without bound instead of settling on a number.`,
          'A limit can only exist where the expression takes real values near the point.',
        ],
        common_mistakes: [
          `Assuming ${hit.func} is defined everywhere — it blows up wherever ${mark(`${hit.denom}(x) = 0`)}.`,
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
          reason: `${absBars(beautify(func))} divides by zero: it is undefined for every ${variable}, so it has no limit`,
          steps: [
            `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${absBars(beautify(func))}`)}.`,
            `The expression has no ${mark(variable)} in it, and it divides by zero: it is undefined for every ${mark(variable)}, not just near ${mark(displayTarget)}.`,
            'A limit describes what a function approaches near a point where it is defined around it. Here it is defined nowhere, so the limit does not exist.',
          ],
          tips: [`Division by zero is undefined; a limit can only say what happens as a denominator APPROACHES zero (${mark('lim x→0 1/x')}), not when it is zero.`],
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
            `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${absBars(beautify(func))}`)}`,
            `The expression also contains ${mark(otherSymbol)}, which stays symbolic — so simplify first: ${mark(`${absBars(beautify(func))} = ${beautify(sym.simplified)}`)}`,
            `Now substitute ${mark(`${variable} = ${displayTarget}`)}: ${mark(beautify(sym.substituted))}`,
          ],
          answer: `lim (${variable}→${displayTarget}) ${absBars(beautify(func))} = ${beautify(sym.substituted)}`,
          tips: ['When the expression has a parameter, simplify algebraically until the limit variable can be substituted directly.', 'This is exactly the difference-quotient limit that defines the derivative.'],
          common_mistakes: [`Substituting before simplifying and stopping at ${mark('0/0')}.`],
          graph: null,
        };
      }
      return unsupported({
        input: expression,
        reason: `The expression contains another symbol (${otherSymbol}) as well as ${variable}, and it did not simplify to something ${variable} = ${displayTarget} can be substituted into. Limits with a symbolic parameter are only supported when they simplify algebraically.`,
        answer: 'This limit is beyond what this solver can compute',
        tips: [`Give the parameter a value (e.g. replace ${mark('x')} with ${mark('3')}) to evaluate the limit numerically.`],
      });
    }

    const result = !Number.isFinite(target)
      ? await evaluateInfiniteLimit(func, variable, target)
      : side !== 0
        ? await evaluateOneSided(func, variable, target, side)
        : await evaluateFiniteLimit(func, variable, target);

    // Defined on one side only (ln(x) at 0): the answer is written as the
    // one-sided limit it is, and the last step says courses differ on the
    // plain one (1.63.0 review).
    const edge = side === 0 && result.domainEdge ? (result.domainEdge > 0 ? '⁺' : '⁻') : '';
    const answerTarget = displayTarget + edge;
    const shownFunc = absBars(beautify(func));
    const valueText = result.answer === 'Does not exist' ? ' does not exist' : ` = ${result.answer}`;
    const steps = [
      `Evaluate ${mark(`lim (${variable}→${displayTarget}) ${shownFunc}`)}`,
      ...result.steps,
      ...(edge ? [`${mark(shownFunc)} is defined only to the ${edge === '⁺' ? 'right' : 'left'} of ${mark(displayTarget)} near it, so the answer is its ${edge === '⁺' ? 'right' : 'left'}-hand limit, ${mark(`lim (${variable}→${answerTarget}) ${shownFunc}${valueText.replace(/\s*\(≈[^)]*\)$/, '')}`)}. Whether the plain ${mark(`lim (${variable}→${displayTarget})`)} is accepted depends on your course: some take a limit over the function's domain, others require both sides and call it nonexistent.`] : []),
    ];

    return {
      steps,
      // "lim (x→0) 1/x does not exist", not "lim … = Does not exist".
      answer: `lim (${variable}→${answerTarget}) ${shownFunc}${valueText}`,
      verified: result.verified ?? false,
      verificationMethod: result.verified ? (result.verificationMethod ?? 'numeric check') : null,
      ...pick(limitGuidance(result, { func, variable, displayTarget, side, infinite: !Number.isFinite(target) })),
      graph: generateLimitGraph(func, variable, target, displayTarget, result.answer),
    };
  } catch (error) {
    console.error('Limit solver error:', error);
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Write limits like: "lim x->0 (sin(x)/x)", or "(x^2-1)/(x-1) as x approaches 1".'],
    });
  }
}

// The lists only: the method name stays internal.
const pick = ({ tips, common_mistakes }) => ({ tips, common_mistakes });

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
  const direct = valueAt(func, variable, target);
  if (Number.isFinite(direct) && Math.abs(direct) < EXPLODED_MAGNITUDE) {
    // √x at 0: defined at the point but on one side only. Say so: the limit
    // is then one-sided, a convention some courses do not use (1.63.0).
    const edge = oneSidedDomain(func, variable, target);
    return {
      steps: [
        `Substitute directly: at ${mark(`${variable} = ${formatNumber(target)}`)}, the function is defined and equals ${mark(formatNumber(direct))}.`,
        ...(edge ? [domainEdgeStep(variable, target, edge), `From that side the function is continuous at ${mark(formatNumber(target))}, so the limit is its value there, ${mark(formatNumber(direct))}.`] : []),
      ],
      answer: formatNumber(direct),
      verified: true,
      verificationMethod: 'direct substitution',
      domainEdge: edge || undefined,
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

  // Rung 4b: x^p·ln(x)^m at 0, defined only on the right: 0·∞ settled by
  // growth rates (x·ln(x) → 0), too slow for sampling to see.
  const edge = oneSidedDomain(func, variable, target);
  if (edge === 1) {
    try {
      const growth = zeroToZero(func, variable, target) ? tryZeroToZero(func, variable) : (target === 0 && tryNoContestAtZero(func, variable)) || tryGrowthRates(Algebrite, func, variable, target);
      if (growth && growth.verified) return { ...growth, steps: [domainEdgeStep(variable, target, 1), ...growth.steps], domainEdge: 1 };
    } catch { /* fall through */ }
  }

  // Rung 4b′: a rational function's vertical asymptote, by the signs.
  try {
    const pole = tryPoleSigns(Algebrite, func, variable, target);
    if (pole && pole.verified) return pole;
  } catch { /* fall through */ }

  // Rung 4c: sin(1/x) at 0 — no limit, shown by two sequences, not samples.
  try {
    const sequences = tryTwoSequences(func, variable, target);
    if (sequences && sequences.verified) return sequences;
  } catch { /* fall through */ }

  // Rung 5: numeric sampling from both sides. Unchanged legacy behaviour, now
  // reached only when every exact method above declined. Still the right tool
  // for genuine jump/oscillation cases and one-sided divergence.
  return estimateFiniteLimitNumeric(func, variable, target);
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
    try {
      const conjugate = tryConjugateAtInfinity(Algebrite, func, variable, target);
      if (conjugate && conjugate.verified) return conjugate;
    } catch { /* fall through */ }
  }
  try {
    const growth = tryGrowthRates(Algebrite, func, variable, target);
    if (growth && growth.verified) return growth;
  } catch { /* fall through */ }
  try {
    const sequences = tryTwoSequences(func, variable, target);
    if (sequences && sequences.verified) return sequences;
  } catch { /* fall through */ }
  return estimateInfiniteLimit(func, variable, target);
}

// A one-sided limit: growth rates first at 0⁺ (x·ln(x)), then sampling.
async function evaluateOneSided(func, variable, target, side) {
  try {
    const pole = tryPoleSigns(await loadAlgebrite(), func, variable, target, side);
    if (pole && pole.verified) {
      return { ...pole, steps: [`This is a one-sided limit: only the ${side > 0 ? 'right' : 'left'}-hand behaviour (${mark(`${variable} → ${formatNumber(target)}${side > 0 ? '⁺' : '⁻'}`)}) matters.`, ...pole.steps] };
    }
  } catch { /* fall through */ }
  if (side === 1 && target === 0) {
    try {
      const growth = zeroToZero(func, variable, target) ? tryZeroToZero(func, variable) : tryNoContestAtZero(func, variable) || tryGrowthRates(await loadAlgebrite(), func, variable, target);
      if (growth && growth.verified) {
        return { ...growth, steps: [`This is a one-sided limit: only the right-hand behaviour (${mark(`${variable} → 0⁺`)}) matters.`, ...growth.steps] };
      }
    } catch { /* fall through */ }
  }
  return evaluateOneSidedLimit(func, variable, target, side);
}

// 1 when the function is defined just right of the point but not just left
// of it (√x, ln(x) at 0), −1 for the reverse, 0 otherwise.
function oneSidedDomain(func, variable, target) {
  const defined = (x) => !Number.isNaN(evalAt(func, variable, x));
  const left = [1e-6, 1e-8].every((d) => defined(target - d));
  const right = [1e-6, 1e-8].every((d) => defined(target + d));
  const leftOut = [1e-6, 1e-8].every((d) => !defined(target - d));
  const rightOut = [1e-6, 1e-8].every((d) => !defined(target + d));
  if (right && leftOut) return 1;
  if (left && rightOut) return -1;
  return 0;
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
        title: `Graph of f(${variable}) = ${absBars(beautify(func))}`,
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
