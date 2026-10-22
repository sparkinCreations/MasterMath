// Trigonometry: exact values, identities and simplification, with the
// configured angle unit. Equations go to trigEquationSolver.js. Split out of
// otherSolvers.js in 1.39.0.

import { extractVariable, isEquation } from '../mathParser.js';
import {
  math,
  beautify,
  formatNumber,
  sampleFunction,
  loadAlgebrite,
  hasVariable,
  rewriteReciprocalTrig,
  expressionsNumericallyEqual,
  isAlgebriteFailure,
  stripMathMarkers,
  mark,
  gcd,
} from './solverUtils.js';
import { getSettings } from '../settings.js';
import { parseError, unsupported, solved } from '../solutionEnvelope.js';

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
export const EXPLODED_MAGNITUDE = 1e12;

/**
 * Detect when a trig expression lands on a vertical asymptote. mathjs never
 * errors there: the floating-point argument misses the asymptote by a hair,
 * so tan(pi/2) comes back as ~1.6e16 (or csc(0) as Infinity) instead of
 * failing. Returns `{ func, denom, identity, argDisplay }` for the offending
 * call, or null when the expression is genuinely defined.
 */
export function detectTrigAsymptote(expression, result, treatAsDegrees) {
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

// Tips and mistakes for a trig evaluation, chosen by the function that was
// evaluated and by whether a unit or a special angle came up — instead of
// the same four lines (all about sin and degrees) for every input.
function trigGuidance(expression, steps) {
  const text = stripMathMarkers(steps.join('\n'));
  const fn = (expression.match(/\b(arcsin|arccos|arctan|asin|acos|atan|sin|cos|tan|sec|csc|cot)\b/i) || [])[1]?.toLowerCase();
  const tips = [];
  const mistakes = [];
  const special = /special angle/.test(text);
  const unit = /degrees|radians/.test(text);
  if (/^arc|^a(sin|cos|tan)$/.test(fn || '')) {
    tips.push('An inverse trig function returns an ANGLE: arcsin(1/2) asks "which angle has sine 1/2?" — the principal one, in [−π/2, π/2] for arcsin and arctan, [0, π] for arccos.');
    tips.push('arcsin and arccos only accept inputs in [−1, 1]; arctan accepts any real number.');
    mistakes.push('Reading arcsin(x) as 1/sin(x) — that is csc(x), a different function.');
    mistakes.push('Reporting an angle outside the principal range, or in the wrong unit.');
  } else if (fn === 'tan' || fn === 'cot' || fn === 'sec' || fn === 'csc') {
    tips.push(fn === 'tan' ? 'tan = sin/cos, so tan is undefined wherever cos = 0 (90°, 270°, …) and its period is 180°, not 360°.' : `${fn} is a reciprocal: sec = 1/cos, csc = 1/sin, cot = 1/tan — undefined wherever the function it inverts is 0.`);
    tips.push('Key identity: 1 + tan²(x) = sec²(x).');
    mistakes.push('Forgetting that tan(90°) is undefined — a calculator shows a huge number, not the truth.');
    mistakes.push(fn === 'tan' ? 'Using 360° as the period of tan (it repeats every 180°).' : 'Confusing sec with 1/sin (sec = 1/cos).');
  } else {
    tips.push(fn === 'cos'
      ? 'Remember: cos(0°) = 1, cos(30°) = √3/2, cos(45°) = √2/2, cos(60°) = 1/2, cos(90°) = 0.'
      : 'Remember: sin(0°) = 0, sin(30°) = 1/2, sin(45°) = √2/2, sin(60°) = √3/2, sin(90°) = 1.');
    tips.push('Key identity: sin²(x) + cos²(x) = 1 — and sin and cos are cofunctions: sin(θ) = cos(90° − θ).');
    mistakes.push('Confusing sin and cos values for complementary angles (sin 30° = cos 60°).');
    if (special) mistakes.push('Not memorising the special-angle values — they are expected exactly, not as decimals.');
  }
  if (unit) {
    tips.push('π radians = 180°: multiply degrees by π/180 to get radians. Write pi for π (sin(pi/6)) or set the angle unit in Settings.');
    mistakes.unshift('Mixing up radians and degrees — sin(30) in radians is −0.988, not 1/2.');
  }
  // A degree-looking angle (a multiple of 15) read as radians: sin(30) with
  // the angle unit on Radians is −0.988, and the table tip "sin(30°) = 1/2"
  // beside it read as the app contradicting itself. Lead with why.
  const arg = expression.match(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\(\s*(-?\d+)\s*\)/i);
  const n = arg ? Number(arg[1]) : NaN;
  if (fn && Number.isInteger(n) && n !== 0 && n % 15 === 0 && /treated as -?\d+ radians|Interpreting -?\d+ as radians/.test(text)) {
    tips.unshift(`Here ${fn}(${n}) is ${n} radians (about ${Math.round((n * 1800) / Math.PI) / 10}°), not ${n}° — which is why the answer is not the value of ${fn}(${n}°). For degrees, write ${fn}(${n}°) or set the angle unit to Degrees in Settings.`);
  }
  return { tips: tips.slice(0, 3), common_mistakes: mistakes.slice(0, 3) };
}

export async function solveTrigonometry(expression, settingsOverride) {
  try {
    // Equations go to the trig-equation solver and never reach the numeric
    // evaluator below. That order matters: mathjs reads "sin(x) = 1/2" as a
    // *definition* of a function named sin and returns the function object,
    // which — stringified — is minified JavaScript, and that is exactly what
    // used to be shown as the final answer.
    const variable = extractVariable(expression);
    if (isEquation(expression)) {
      const { solveTrigEquation } = await import('./trigEquationSolver.js');
      const exact = solveTrigEquation(expression, variable, settingsOverride);
      if (exact.status !== 'unsupported') return exact;
      // No exact reduction (sin x·cos 2x = 1/3 is transcendental; sin(x²) = 0
      // has a non-linear argument): fall back to the algebra solver's
      // verified numeric root scan rather than refusing outright.
      const { solveAlgebra } = await import('./algebraSolver.js');
      const numeric = await solveAlgebra(expression);
      if (numeric && numeric.answer && !['unsupported', 'parse_error'].includes(numeric.status || '')) {
        if (/identity/i.test(numeric.answer)) {
          // An identity is recognised before any root scan; saying it was
          // "solved numerically" and then "true for every x" contradicted
          // itself.
          numeric.steps = [
            'The two sides simplify to the same expression, so this is an identity, not an equation with particular solutions.',
            ...(numeric.steps || []),
          ];
          numeric.tips = [
            'An identity is true for every input where both sides are defined — check the domain: tan, sec, cot and csc have points where they do not exist.',
            'To prove an identity by hand, rewrite everything in terms of sin and cos and simplify one side until it matches the other.',
          ];
          numeric.common_mistakes = ['Treating the points where tan(x) or sec(x) is undefined as solutions because the simplified form 0 = 0 allows them.'];
          return numeric;
        }
        numeric.steps = [
          'This trig equation has no exact reduction here (it is not linear or quadratic in one function, not a·sin + b·cos = c, and not f(A) = f(B) with linear arguments), so it is solved numerically: the roots nearest zero are found by scanning and each is verified by substitution.',
          ...(numeric.steps || []),
        ];
        numeric.tips = ['Equations that mix trig terms with different arguments or with x itself usually have no closed form — numeric solutions are the honest answer.', ...(numeric.tips || [])].slice(0, 3);
        return numeric;
      }
      return exact;
    }

    // A free variable means this is a symbolic expression (an identity to
    // simplify), not a value to compute — math.evaluate would just throw
    // "Undefined symbol x". Route it to the Algebrite simplification path.
    if (hasVariable(expression, variable)) {
      return await simplifyTrigExpression(expression, variable);
    }

    // Angles with no trig function ("90°", "45° + 30°") ask for a
    // conversion, not a value: answered in degrees and in radians, exact
    // (a fraction of π) for any terminating decimal: 22.5° = π/8. It was
    // "1.5708", unlabelled.
    if (expression.includes('°') && !/[a-z]/i.test(expression.replace(/\bpi\b/gi, ''))) {
      const degrees = math.evaluate(expression.replace(/(\d+(?:\.\d+)?)\s*°/g, '($1)'));
      if (typeof degrees === 'number' && Number.isFinite(degrees)) {
        const radians = (degrees * Math.PI) / 180;
        let exact = null;
        const places = (String(degrees).split('.')[1] || '').length;
        if (places <= 6 && !/e/i.test(String(degrees))) {
          const scale = 10 ** places;
          const p = Math.round(degrees * scale);
          const g = gcd(Math.abs(p), 180 * scale) || 1;
          const n = p / g;
          const d = (180 * scale) / g;
          exact = n === 0 ? '0' : `${n < 0 ? '-' : ''}${Math.abs(n) === 1 ? '' : Math.abs(n)}π${d === 1 ? '' : `/${d}`}`;
        }
        // The degrees exactly as they are ("=" only for an exact value), and
        // the input as typed when it is a sum: "100° - 10° = 90°".
        const total = `${Number(degrees.toPrecision(12))}°`;
        // (The parser has already removed the spaces: put them back around
        // + and − between angles.)
        const typed = expression.trim().replace(/\s+/g, '').replace(/(?<=°)([+-])/g, ' $1 ');
        const sum = typed.replace(/\s+/g, '') === total ? '' : `${typed} = `;
        const radiansText = exact === '0' ? '0 rad' : exact ? `${exact} rad (≈ ${formatNumber(radians)})` : null;
        return solved({
          steps: [
            ...(sum ? [`Add the angles: ${mark(`${typed} = ${total}`)}.`] : []),
            `To convert degrees to radians, multiply by ${mark('π/180')} (a half turn is ${mark('180° = π')} radians).`,
            exact
              ? `${mark(`${total} × π/180 = ${exact}`)} radians${exact === '0' ? '' : ` ${mark(`≈ ${formatNumber(radians)}`)}`}.`
              : `${mark(`${total} × π/180 ≈ ${formatNumber(radians)}`)} radians.`,
          ],
          answer: radiansText ? `${sum}${total} = ${radiansText}` : `${sum}${total} ≈ ${formatNumber(radians)} rad`,
          tips: ['Degrees to radians: multiply by π/180. Radians to degrees: multiply by 180/π.', 'Common angles: 30° = π/6, 45° = π/4, 60° = π/3, 90° = π/2, 180° = π.'],
          common_mistakes: ['Multiplying by 180/π when converting degrees to radians: that goes the other way.'],
        });
      }
    }

    const steps = [];
    steps.push(`Evaluate the trigonometric expression: ${mark(beautify(expression))}`);

    // 'auto' (default) guesses degrees for bare common angles like sin(30);
    // 'degrees'/'radians' pin the interpretation from the Settings page.
    const angleUnit = settingsOverride?.angleUnit ?? getSettings().angleUnit;

    const hasRadians = expression.includes('pi') || expression.includes('PI');
    const hasDegreeSymbol = expression.includes('°');

    // The angle inside a direct trig call: sin(30), cos(0.5), tan(-45). Not
    // arcsin(0.3) — the (?<![a-z]) keeps "sin(" inside "arcsin(" from
    // matching, whose argument is a ratio, not an angle.
    const degreeArgMatch = expression.match(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*\(\s*(-?\d+(?:\.\d+)?)\s*°?\s*\)/i);
    const argValue = degreeArgMatch ? parseFloat(degreeArgMatch[1]) : null;
    // The whole expression is one inverse-trig call: its VALUE is an angle,
    // so the angle unit applies to the output, not the input.
    const inverseWhole = /^\s*(?:arcsin|arccos|arctan|asin|acos|atan)\s*\((?:[^()]|\([^()]*\))*\)\s*$/i.test(expression);

    const autoDegrees = !hasRadians && argValue !== null && Number.isInteger(argValue) && COMMON_DEGREE_VALUES.includes(Math.abs(argValue));
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
    // mathjs has no ° token; the symbol is handled by the degree rewrite
    // below, so it is dropped here for the "if you meant radians" cross-check.
    const radianResult = math.evaluate(expression.replace(/°/g, ''));

    // A complex value here means an inverse trig function was asked for an
    // argument outside [-1, 1] (arcsin(2)). That is undefined over the reals,
    // and a raw "1.5707963267948966 - 1.3169578969248166i" is not an answer a
    // trigonometry student can use — say what happened.
    if (radianResult && typeof radianResult === 'object' && 'im' in radianResult && Math.abs(radianResult.im) > 1e-12) {
      const inv = expression.match(/\b(arcsin|arccos)\s*\(([^()]*)\)/i);
      const fn = inv ? inv[1].toLowerCase() : 'this function';
      const arg = inv ? inv[2] : '';
      steps.push(inv
        ? `${fn}(${arg}) asks for an angle whose ${fn === 'arcsin' ? 'sine' : 'cosine'} is ${arg} — but ${fn === 'arcsin' ? 'sine' : 'cosine'} only takes values between −1 and 1, so no real angle works.`
        : 'The expression has no real value.');
      return {
        steps,
        answer: `Undefined for real numbers${inv ? ` — ${fn} is only defined on [−1, 1]` : ''}`,
        status: 'undefined',
        tips: [
          'The inverse trig functions arcsin and arccos accept inputs from −1 to 1 only; arctan accepts any real number.',
          'A calculator that reports a complex value here has left the real numbers — that is not the angle you were looking for.',
        ],
        common_mistakes: ['Asking for arcsin or arccos of a value outside [−1, 1] and reading the complex result as an angle.'],
        graph: null,
      };
    }

    // Also computed in radians mode when the input *looks* like degrees, so
    // we can offer the "if you meant degrees" cross-check note below.
    if (looksLikeDegrees || hasDegreeSymbol || (angleUnit === 'radians' && autoDegrees)) {
      // Convert ONLY the angle inside each trig call. Rewriting every integer
      // turned sin(45)^2 into sin(45°)^(2°) = 0.988.
      const degExpr = hasDegreeSymbol
        // sin(30°), sin(2*30°), 90° - 30°: every N° is an angle in degrees.
        ? expression.replace(/(-?\d+(?:\.\d+)?)\s*°/g, (_, deg) => `((${deg}) * pi / 180)`)
        : expression.replace(
          /(?<![a-z])(sin|cos|tan|sec|csc|cot)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
          (_, fn, deg) => `${fn}((${deg} * pi / 180))`
        );
      try {
        degreeResult = math.evaluate(degExpr);
      } catch {
        // fall back to radian result
      }
    }

    if (looksLikeDegrees && degreeResult !== null) {
      if (angleUnit === 'degrees') {
        steps.push(`Angle unit is set to degrees (Settings): ${mark(`${argValue}° = ${argValue} × π/180`)} radians`);
      } else {
        steps.push(`Detected input as degrees: ${mark(`${argValue}° = ${argValue} × π/180`)} radians`);
      }
      result = degreeResult;
      steps.push(`Converting: ${mark(`${argValue}° = ${formatNumber(argValue * Math.PI / 180)}`)} radians`);
    } else if (hasDegreeSymbol && degreeResult !== null) {
      result = degreeResult;
      steps.push('Input is in degrees (° symbol detected), converting to radians.');
    } else {
      result = radianResult;
      if (angleUnit === 'radians' && autoDegrees) {
        steps.push(`Angle unit is set to radians (Settings), so ${argValue} is treated as ${argValue} radians.`);
      } else if (!inverseWhole && !hasRadians && argValue !== null) {
        // Say which unit was assumed EVERY time a plain number is read as an
        // angle. sin(45) announced "detected as degrees" while sin(1) went
        // silently to radians (September 2026 teaching-quality review).
        steps.push(`Interpreting ${mark(argValue)} as radians, which is ${mark(`${argValue} × 180/π ≈ ${formatNumber(argValue * 180 / Math.PI)}°`)}. For degrees, write ${mark(`${argValue}°`)} or set the angle unit to degrees in Settings.`);
      }
    }

    const lower = expression.toLowerCase();
    if (/\b(?:arcsin|asin)\b/.test(lower)) {
      steps.push('Using the inverse sine (arcsin): the angle whose sine is the given value.');
    } else if (/\b(?:arccos|acos)\b/.test(lower)) {
      steps.push('Using the inverse cosine (arccos): the angle whose cosine is the given value.');
    } else if (/\b(?:arctan|atan)\b/.test(lower)) {
      steps.push('Using the inverse tangent (arctan): the angle whose tangent is the given value.');
    } else if (lower.includes('sin')) {
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
      // Half-angle family.
      'sin(pi/12)': 'sin(15°) = (√6 − √2)/4',
      'cos(pi/12)': 'cos(15°) = (√6 + √2)/4',
      'tan(pi/12)': 'tan(15°) = 2 − √3',
      'sin(5pi/12)': 'sin(75°) = (√6 + √2)/4',
      'cos(5pi/12)': 'cos(75°) = (√6 − √2)/4',
      'tan(5pi/12)': 'tan(75°) = 2 + √3',
      'sin(pi/8)': 'sin(22.5°) = √(2 − √2)/2',
      'cos(pi/8)': 'cos(22.5°) = √(2 + √2)/2',
      'tan(pi/8)': 'tan(22.5°) = √2 − 1',
      'sin(3pi/8)': 'sin(67.5°) = √(2 + √2)/2',
      'cos(3pi/8)': 'cos(67.5°) = √(2 − √2)/2',
      'tan(3pi/8)': 'tan(67.5°) = √2 + 1',
    };
    // "5pi/12" and "5*pi/12" are the same angle; index both spellings.
    for (const key of Object.keys(commonAngles)) {
      const starred = key.replace(/(\d)pi/, '$1*pi');
      if (starred !== key) commonAngles[starred] = commonAngles[key];
    }
    const degreeToRadianAngles = {
      30: 'pi/6', 45: 'pi/4', 60: 'pi/3', 90: 'pi/2',
      120: '2*pi/3', 135: '3*pi/4', 150: '5*pi/6', 180: 'pi',
      15: 'pi/12', 75: '5*pi/12', 22.5: 'pi/8', 67.5: '3*pi/8',
    };

    const normalized = expression.replace(/\s/g, '').toLowerCase();
    if (commonAngles[normalized]) {
      steps.push(`This is a special angle. Common value: ${mark(commonAngles[normalized])}`);
    } else if (looksLikeDegrees && degreeArgMatch) {
      const funcName = expression.match(/(sin|cos|tan)/i)?.[1]?.toLowerCase();
      const radianKey = degreeToRadianAngles[argValue];
      const lookupKey = funcName && radianKey ? `${funcName}(${radianKey})` : null;
      if (lookupKey && commonAngles[lookupKey]) {
        steps.push(`This is a special angle: ${mark(`${argValue}°`)}. Common value: ${mark(commonAngles[lookupKey])}`);
      }
    }

    const treatAsDegrees = (looksLikeDegrees || hasDegreeSymbol) && degreeResult !== null;
    const asymptote = detectTrigAsymptote(expression, result, treatAsDegrees);
    if (asymptote) {
      const { func, denom, identity, argDisplay } = asymptote;
      if (argDisplay !== null) {
        steps.push(`${mark(`${func}(${argDisplay})`)} is undefined — ${mark(identity)}, and ${mark(`${denom}(${argDisplay}) = 0`)}, so the graph has a vertical asymptote there.`);
      } else {
        steps.push(`The expression is undefined — ${mark(identity)}, and ${mark(denom)} hits ${mark('0')} at this input, so ${mark(func)} has a vertical asymptote there.`);
      }
      if (treatAsDegrees && Number.isFinite(radianResult) && Math.abs(radianResult) < EXPLODED_MAGNITUDE) {
        steps.push(`Note: if you meant radians, the result would be ${mark(formatNumber(radianResult))}.`);
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

    let formattedResult = formatTrigResult(result, expression);

    // Inverse trig returns an angle. Report it in the unit the student
    // chose: degrees when the angle unit is set to degrees, radians
    // otherwise — with the other unit as a note either way.
    if (inverseWhole && typeof result === 'number' && Number.isFinite(result)) {
      const degrees = result * 180 / Math.PI;
      const degShown = `${formatNumber(degrees)}°`;
      if (angleUnit === 'degrees') {
        steps.push(`The result is an angle. Angle unit is set to degrees (Settings), so convert from radians: ${mark(`${formatNumber(result)} × 180/π = ${degShown}`)}`);
        steps.push(`Note: in radians the result would be ${mark(formattedResult)}.`);
        formattedResult = degShown;
      } else {
        steps.push(`The result is an angle, in radians: ${mark(formattedResult)} (${mark(`= ${degShown}`)}).`);
      }
    }

    if (looksLikeDegrees && radianResult !== null && degreeResult !== null) {
      steps.push(`Result (treating input as degrees): ${mark(formattedResult)}`);
      steps.push(`Note: if you meant radians, the result would be ${mark(formatNumber(radianResult))}.`);
    } else if (angleUnit === 'radians' && autoDegrees && degreeResult !== null) {
      steps.push(`Calculate the value: ${mark(formattedResult)}`);
      steps.push(`Note: if you meant ${mark(`${argValue}°`)}, the result would be ${mark(formatNumber(degreeResult))} (switch the angle unit in Settings).`);
    } else {
      steps.push(`Calculate the value: ${mark(formattedResult)}`);
    }

    return {
      steps,
      answer: formattedResult,
      ...trigGuidance(expression, steps),
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
    let simplified = String(Algebrite.run(`simplify(${rewritten})`)).trim();
    let identityUsed = null;

    // Algebrite's simplify knows the Pythagorean identity but not the
    // double-angle family — it leaves 2·sin(x)·cos(x) alone. Try the standard
    // compact forms and keep the shortest one that is NUMERICALLY equal to
    // the input; each is verified before it is claimed, never assumed.
    const v = variable;
    const targets = [
      [`sin(2*${v})`, `double-angle identity ${mark('sin(2θ) = 2·sin(θ)·cos(θ)')}`],
      [`-sin(2*${v})`, `double-angle identity ${mark('sin(2θ) = 2·sin(θ)·cos(θ)')}`],
      [`cos(2*${v})`, `double-angle identity ${mark('cos(2θ) = cos²(θ) − sin²(θ) = 1 − 2sin²(θ) = 2cos²(θ) − 1')}`],
      [`-cos(2*${v})`, `double-angle identity ${mark('cos(2θ) = cos²(θ) − sin²(θ)')}`],
      [`tan(2*${v})`, `double-angle identity ${mark('tan(2θ) = 2tan(θ)/(1 − tan²(θ))')}`],
      [`sin(${v})^2`, `Pythagorean identity ${mark('sin²(θ) = 1 − cos²(θ)')}`],
      [`cos(${v})^2`, `Pythagorean identity ${mark('cos²(θ) = 1 − sin²(θ)')}`],
      [`sec(${v})^2`, `Pythagorean identity ${mark('1 + tan²(θ) = sec²(θ)')}`],
      [`csc(${v})^2`, `Pythagorean identity ${mark('1 + cot²(θ) = csc²(θ)')}`],
      [`tan(${v})`, `quotient identity ${mark('tan(θ) = sin(θ)/cos(θ)')}`],
      [`cot(${v})`, `quotient identity ${mark('cot(θ) = cos(θ)/sin(θ)')}`],
      [`2*cos(${v})`, `double-angle identity ${mark('sin(2θ) = 2·sin(θ)·cos(θ)')}`],
      [`2*sin(${v})`, `double-angle identity ${mark('sin(2θ) = 2·sin(θ)·cos(θ)')}`],
      [`sin(${v})`, 'trigonometric identities'],
      [`cos(${v})`, 'trigonometric identities'],
      ['1', `Pythagorean identity ${mark('sin²(θ) + cos²(θ) = 1')}`],
      ['0', 'trigonometric identities'],
    ];
    const len = (e) => normalizeForCompare(e).length;
    for (const [candidate, name] of targets) {
      if (len(candidate) >= len(expression)) continue;
      if (simplified && !isAlgebriteFailure(simplified) && len(candidate) >= len(simplified)) continue;
      if (expressionsNumericallyEqual(expression, candidate, v)) {
        simplified = candidate;
        identityUsed = name;
        break;
      }
    }

    const usable = Boolean(simplified) && !isAlgebriteFailure(simplified);
    const verified = usable && expressionsNumericallyEqual(expression, simplified, variable);
    // "Changed" requires a strictly shorter form — a mere reordering of terms
    // is not a simplification worth presenting as one.
    const changed = usable &&
      normalizeForCompare(simplified) !== normalizeForCompare(expression) &&
      normalizeForCompare(simplified).length < normalizeForCompare(expression).length;

    if (usable && verified && changed) {
      const steps = [`Simplify the trigonometric expression: ${mark(display)}`];
      if (identityUsed) {
        steps.push(`Apply the ${identityUsed}.`);
      } else if (simplified === '1' && isPythagoreanIdentity(expression)) {
        steps.push(`Apply the Pythagorean identity: ${mark('sin²(θ) + cos²(θ) = 1')} for every angle ${mark('θ')}.`);
      } else {
        steps.push('Apply trigonometric identities and combine terms.');
      }
      steps.push(`Result: ${mark(beautify(simplified))} (confirmed numerically at several values of ${mark(variable)}).`);
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
        `Simplify the trigonometric expression: ${mark(display)}`,
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

// Exact-first display. A special value is shown exactly with the decimal
// alongside ("√2/2 (≈ 0.7071)"); the result of an inverse trig function that
// lands on a multiple of π is shown as that multiple ("π/6 (≈ 0.5236)");
// anything else is the plain decimal.
function formatTrigResult(result, expression = '') {
  if (typeof result !== 'number') return String(result);
  const dec = formatNumber(result);

  // Inverse trig: the answer is an ANGLE, so look for a clean multiple of π.
  if (/\b(?:arcsin|arccos|arctan|asin|acos|atan)\s*\(/i.test(expression)) {
    const ratio = result / Math.PI;
    for (const d of [1, 2, 3, 4, 6, 8, 12, 5, 10, 9, 18, 16, 24]) {
      const n = ratio * d;
      if (Math.abs(n - Math.round(n)) < 1e-6) {
        const k = Math.round(n);
        if (k === 0) return '0';
        const num = Math.abs(k) === 1 ? '' : String(Math.abs(k));
        const sign = k < 0 ? '-' : '';
        const exactAngle = d === 1 ? `${sign}${num}π` : `${sign}${num}π/${d}`;
        return `${exactAngle} (≈ ${dec})`;
      }
    }
    return dec;
  }

  const exact = [
    [0.5, '1/2'],
    [-0.5, '-1/2'],
    [Math.sqrt(2) / 2, '√2/2'],
    [-Math.sqrt(2) / 2, '-√2/2'],
    [Math.sqrt(3) / 2, '√3/2'],
    [-Math.sqrt(3) / 2, '-√3/2'],
    [Math.sqrt(3), '√3'],
    [-Math.sqrt(3), '-√3'],
    [1 / Math.sqrt(3), '√3/3'],
    [-1 / Math.sqrt(3), '-√3/3'],
    [Math.sqrt(2), '√2'],
    [2 / Math.sqrt(3), '2√3/3'],
    // Half-angle family — π/12 (15°), 5π/12 (75°), π/8 (22.5°), 3π/8 (67.5°).
    // September 2026 audit row V06: sin(π/12) was decimal-only.
    [(Math.sqrt(6) - Math.sqrt(2)) / 4, '(√6 − √2)/4'],
    [-(Math.sqrt(6) - Math.sqrt(2)) / 4, '-(√6 − √2)/4'],
    [(Math.sqrt(6) + Math.sqrt(2)) / 4, '(√6 + √2)/4'],
    [-(Math.sqrt(6) + Math.sqrt(2)) / 4, '-(√6 + √2)/4'],
    [2 - Math.sqrt(3), '2 − √3'],
    [-(2 - Math.sqrt(3)), '-(2 − √3)'],
    [2 + Math.sqrt(3), '2 + √3'],
    [-(2 + Math.sqrt(3)), '-(2 + √3)'],
    [Math.sqrt(2 - Math.SQRT2) / 2, '√(2 − √2)/2'],
    [-Math.sqrt(2 - Math.SQRT2) / 2, '-√(2 − √2)/2'],
    [Math.sqrt(2 + Math.SQRT2) / 2, '√(2 + √2)/2'],
    [-Math.sqrt(2 + Math.SQRT2) / 2, '-√(2 + √2)/2'],
    [Math.SQRT2 - 1, '√2 − 1'],
    [-(Math.SQRT2 - 1), '-(√2 − 1)'],
    [Math.SQRT2 + 1, '√2 + 1'],
    [-(Math.SQRT2 + 1), '-(√2 + 1)'],
  ];
  for (const [value, label] of exact) {
    if (Math.abs(result - value) < 1e-4) {
      return `${label} (≈ ${dec})`;
    }
  }
  return dec;
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
