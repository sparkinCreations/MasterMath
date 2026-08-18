import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  splitTerms,
  sampleFunction,
  hasVariable,
  rewriteReciprocalTrig,
  expressionsNumericallyEqual,
  parsesAsMath,
  isUnevaluatedOperator,
  isAlgebriteFailure,
} from './solverUtils.js';
import { extractVariable, extractFunctionFromProblem, parseMathExpression } from '../mathParser.js';
import { integrateByParts, needsByParts } from './byPartsSolver.js';
import { integrateBySubstitution, integrateAbsLinear, derivativeMatchesNumerically } from './substitutionSolver.js';
import { parseError, unsupported } from '../solutionEnvelope.js';

// Famous non-elementary integrands, so "the engine can't do this" comes with
// the honest reason: the antiderivative exists but isn't elementary. The
// patterns are anchored to the WHOLE integrand — a substring match would
// wrongly flag elementary neighbors like x*sin(x^2) (plain u-substitution).
const NON_ELEMENTARY_NOTES = [
  [/^sin\([a-z]\^2\)$/i, 'its antiderivative is the Fresnel S function, which is not expressible in elementary functions'],
  [/^cos\([a-z]\^2\)$/i, 'its antiderivative is the Fresnel C function, which is not expressible in elementary functions'],
  [/^(?:e\^\(?-[a-z]\^2\)?|exp\(-[a-z]\^2\))$/i, 'its antiderivative is related to the error function erf(x), which is not elementary'],
  [/^(?:e\^\(?[a-z]\^2\)?|exp\([a-z]\^2\))$/i, 'its antiderivative is related to the imaginary error function erfi(x), which is not elementary'],
  [/^sin\([a-z]\)\/[a-z]$/i, 'its antiderivative is the sine integral Si(x), which is not elementary'],
];

function nonElementaryNote(expression) {
  const normalized = String(expression).replace(/\s+/g, '');
  for (const [pattern, note] of NON_ELEMENTARY_NOTES) {
    if (pattern.test(normalized)) return note;
  }
  return null;
}

// The integral solver receives the RAW problem text (see api.js), because a
// definite integral's bounds live in the notation and must be read before
// parseMathExpression collapses the spacing.
export async function solveIntegral(rawInput) {
  const definite = parseDefiniteIntegral(rawInput);
  if (definite) {
    return solveDefiniteIntegral(definite);
  }

  // A bare integral sign with no bounds — "∫x dx", "∫ sin(x) dx" — is the
  // most natural notation there is; strip the sign and the trailing d<var>
  // before the expression extractor sees it, or "∫xdx" is a parse error.
  // The trailing d<var> names the variable of integration: "∫ x^2 dy" is
  // x^2·y + C, not x^3/3 + C.
  const dvar = String(rawInput).match(/\s*\bd([a-z])\s*$/i);
  const bare = String(rawInput)
    .replace(/^\s*∫\s*/, '')
    .replace(/\s*\bd([a-z])\s*$/i, '');
  const expression = extractFunctionFromProblem(bare);
  if (!expression || !expression.trim()) {
    // "∫ dx" is ∫ 1 dx.
    if (dvar) return solveIndefiniteIntegral('1', dvar[1].toLowerCase());
    return parseError({
      input: rawInput,
      hint: 'There is nothing to integrate — the integrand is empty.',
      tips: ['Write the function after the integral sign, e.g. ∫ x^2 dx, or just x^2.'],
    });
  }
  return solveIndefiniteIntegral(expression, dvar ? dvar[1].toLowerCase() : undefined);
}

async function solveIndefiniteIntegral(expression, variableOverride) {
  try {
    if (!expression || !expression.trim()) {
      throw new Error('empty integrand');
    }

    const Algebrite = await loadAlgebrite();
    const variable = variableOverride || extractVariable(expression);

    // Integrate term by term so an integration-by-parts term can get its own
    // worked walkthrough (and so a single hard term doesn't sink the whole
    // integral the way Algebrite.integral of the full expression would).
    const terms = splitTerms(expression);
    const perTerm = [];
    let anyByParts = false;
    let anySubstitution = false;
    let anyAbs = false;
    for (const { signed } of terms) {
      const res = await integrateTerm(signed, variable, Algebrite);
      if (!res) { perTerm.length = 0; break; }
      if (res.method === 'byparts') anyByParts = true;
      if (res.method === 'substitution') anySubstitution = true;
      if (res.method === 'abs') anyAbs = true;
      perTerm.push(res);
    }

    let integral;
    let steps;
    if (perTerm.length === terms.length && perTerm.length > 0) {
      integral = simplifyRun(Algebrite, perTerm.map((r) => `(${r.antideriv})`).join(' + ')) ||
        perTerm.map((r) => r.antideriv).join(' + ');
      // Algebrite's simplify re-expands log arguments into partial fractions;
      // polish after combining, not before.
      integral = polishLogArguments(Algebrite, integral);
      steps = buildPerTermSteps(expression, terms, perTerm, variable, integral);
    } else {
      // Fallback: authoritative antiderivative for the whole expression.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = polishLogArguments(Algebrite, Algebrite.integral(forAlgebrite, variable).toString());
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
    }

    // Trust gate: the derivative of the antiderivative must equal the integrand.
    // Algebrite differentiates the result when it can; when it can't (it has
    // no abs), a numeric derivative check decides instead of failing closed.
    const dRaw = safeRunLocal(Algebrite, `d(${integral}, ${variable})`);
    // An unevaluated d(...) inside the derivative (Algebrite met abs) is not
    // a derivative it could take — fall through to the numeric check.
    const dCheck = dRaw && !isUnevaluatedOperator(dRaw) ? dRaw : null;
    const trusted = dCheck
      ? expressionsNumericallyEqual(dCheck, rewriteReciprocalTrig(expression), variable)
      : derivativeMatchesNumerically(integral, expression, variable);
    if (!trusted) {
      // The per-term path failed verification — fall back to whole-Algebrite.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = polishLogArguments(Algebrite, Algebrite.integral(forAlgebrite, variable).toString());
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
    }

    // Algebrite doesn't always throw when it can't integrate — it can return
    // `integral(f, x)` unevaluated. The derivative trust gate above does not
    // catch that (d(integral(f,x),x) simplifies straight back to f), so check
    // for the operator directly. Same honest refusal as the throw path.
    if (isUnevaluatedOperator(integral)) {
      throw new Error('Algebrite returned the integral unevaluated');
    }
    // A complex-valued antiderivative for a real integrand — Algebrite writes
    // ∫e^(x²) as -½·i·√π·erf(i·x) — is technically right (it is erfi) but not
    // a real-calculus answer. Refuse it the same way; the non-elementary note
    // for e^(x²) explains why.
    if (/\bi\b/.test(integral)) {
      throw new Error('Algebrite returned a complex-valued antiderivative');
    }

    const tips = [
      anyByParts
        ? 'Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential).'
        : anySubstitution
          ? 'u-substitution: look for an inner function whose derivative appears as a factor — ∫g′(x)·h(g(x)) dx = ∫h(u) du with u = g(x).'
          : anyAbs
            ? '∫|ax + b| dx = (ax + b)·|ax + b| / (2a) + C — split at the corner, integrate each piece, and the two pieces match up into one formula.'
            : `Power rule: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C  (n ≠ -1)`,
      'Always add the constant of integration (+C) for an indefinite integral.',
      'Constant factors pull out front: ∫c·f dx = c·∫f dx.',
    ];

    const common_mistakes = [
      'Forgetting the constant of integration (+C).',
      anyByParts
        ? 'Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.'
        : anySubstitution
          ? 'Forgetting to divide by g′(x) when changing to du — the constant from du = g′(x) dx must be carried.'
          : anyAbs
            ? 'Integrating |x| as if it were x, giving x²/2 — that is only right for x ≥ 0.'
            : 'Mishandling the (n+1) denominator in the power rule.',
      'Applying the power rule to 1/x — that integrates to ln|x|, not x⁰/0.',
    ];

    return {
      steps,
      answer: `∫(${beautify(expression)}) d${variable} = ${lnify(integral)} + C`,
      tips,
      common_mistakes,
      graph: generateIntegralGraph(expression, integral, variable),
    };
  } catch (error) {
    console.error('Integral solver error:', error);
    if (parsesAsMath(expression)) {
      // Two different claims, kept apart: "non-elementary" is asserted only
      // for the integrands in the known list; everything else is an engine
      // limitation, and is said to be — never dressed up as a theorem.
      const note = nonElementaryNote(expression);
      return unsupported({
        input: `∫(${expression}) dx`,
        reason: note
          ? `This integral is non-elementary — ${note}.`
          : 'MasterMath could not find this antiderivative symbolically. The input is valid; the integral may well have an elementary answer that this engine\'s methods (direct rules, u-substitution, integration by parts) do not reach.',
        answer: note ? undefined : 'MasterMath could not solve this integral symbolically',
        tips: note
          ? [
              'The input is valid — not every elementary function has an elementary antiderivative.',
              'A definite version can still be computed numerically, e.g. ∫_0^1 of the same integrand.',
            ]
          : [
              'This is a limitation of the solver, not a statement about the mathematics.',
              'A definite version can still be computed numerically, e.g. ∫_0^1 of the same integrand.',
              'Try rewriting the integrand (expand, split a fraction, use an identity) — a different form may be one the engine handles.',
            ],
      });
    }
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use ^ for powers and * for products (e.g., x^2 * sin(x)).'],
    });
  }
}

// Algebrite writes the natural log as `log(x)` and omits the absolute value.
// The textbook antiderivative of 1/x is ln|x| (correct for negative x too), so
// present integral RESULTS with that convention. Only applied to outputs, never
// to the integrand.
function lnify(integralResult) {
  return beautify(integralResult)
    // outermost log(...) (one nesting level inside) → ln|...|
    .replace(/\blog\(((?:[^()]|\([^()]*\))+)\)/g, 'ln|$1|')
    // a log(...) left inside those bars → ln(...) (bars within bars read badly)
    .replace(/\blog\(([^()]+)\)/g, 'ln($1)');
}

function safeRunLocal(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return isAlgebriteFailure(out) ? null : out;
  } catch {
    return null;
  }
}

function simplifyRun(Algebrite, expr) {
  return safeRunLocal(Algebrite, `simplify(${expr})`);
}

// Tidy the argument of every log(...) in an antiderivative for display.
// Algebrite's partial fractions leave ∫1/(x²−1) as
// ½·log(−1/(−x−1) + x/(−x−1)); rationalized that is (x−1)/(−x−1), and since
// the result is shown as ln|…| a sign flip of the argument is exact, so the
// form with fewer minus signs is chosen: ½·ln|(x−1)/(x+1)|. Display only —
// the value is unchanged (checked below by numeric equality of |arg|).
function polishLogArguments(Algebrite, expr) {
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

/**
 * Integrate one additive term. A by-parts term returns its full walkthrough;
 * everything else is integrated directly by Algebrite. Returns
 * { antideriv, steps, method, term } or null when the term can't be integrated.
 */
async function integrateTerm(term, variable, Algebrite) {
  if (needsByParts(term, variable)) {
    // A product can be a substitution in disguise — x·e^(x²) is g′·h(g), not
    // a by-parts problem (by parts drags in erf(ix) and only recovers by
    // luck). Try substitution first for products; it is verified, so a wrong
    // guess simply declines and by parts proceeds as before.
    const sub = integrateBySubstitution(rewriteReciprocalTrig(term), variable, Algebrite);
    if (sub) {
      return { antideriv: sub.antiderivative, steps: sub.steps, method: 'substitution', term };
    }
    const bp = await integrateByParts(term, variable);
    if (bp) {
      return { antideriv: bp.antiderivative, steps: bp.steps, method: 'byparts', term, cyclic: bp.cyclic };
    }
    // fall through to a direct attempt if by-parts declined
  }

  let anti = safeRunLocal(Algebrite, `integral(${rewriteReciprocalTrig(term)}, ${variable})`);
  if (anti !== null && !isUnevaluatedOperator(anti)) {
    anti = polishLogArguments(Algebrite, anti);
    const { label, hint } = classifyIntegralRule(term, variable);
    const steps = [`∫(${beautify(term)}) d${variable} = ${lnify(anti)}${hint ? `  (${label})` : ''}.`];
    return { antideriv: anti, steps, method: 'direct', term };
  }

  // Algebrite has no substitution step: it gives up on x·cos(x²). Try the
  // g′(x)·h(g(x)) pattern ourselves (verified by differentiation).
  const sub = integrateBySubstitution(rewriteReciprocalTrig(term), variable, Algebrite);
  if (sub) {
    return { antideriv: sub.antiderivative, steps: sub.steps, method: 'substitution', term };
  }

  // Algebrite has no abs either: |a·x + b| and constant multiples of it.
  const abs = integrateAbsLinear(term, variable);
  if (abs) {
    return { antideriv: abs.antiderivative, steps: abs.steps, method: 'abs', term };
  }

  return null;
}

// Assemble the worked steps from the per-term results. Multi-term integrals get
// a header per term; a single term shows its steps directly. The closing line
// states the combined antiderivative with +C.
function buildPerTermSteps(expression, terms, perTerm, variable, total) {
  const steps = [`Identify the function to integrate: ∫(${beautify(expression)}) d${variable}.`];
  const multi = terms.length > 1;
  if (multi) steps.push('Apply the sum rule: integrate each term separately, then add the results.');

  perTerm.forEach((res, i) => {
    if (multi) {
      const suffix = res.method === 'byparts' ? ' by parts' : res.method === 'substitution' ? ' by substitution' : '';
      steps.push(`Term ${i + 1} — ∫(${beautify(res.term)}) d${variable}${suffix}:`);
    }
    steps.push(...res.steps);
  });

  steps.push(`Add the constant of integration: ∫(${beautify(expression)}) d${variable} = ${lnify(total)} + C.`);
  return steps;
}

// ---------------------------------------------------------------------------
// Definite integrals — ∫_a^b f dx via the Fundamental Theorem of Calculus.
//
// Built after the July 2026 audit noted the honest refusal was the last thing
// standing between the app and this capability. The exact value comes from
// Algebrite's defint; a Simpson cross-check independently confirms it and, in
// the process, refuses improper integrals (a discontinuity between the bounds)
// rather than shipping Algebrite's occasional complex/garbage value for them.
// ---------------------------------------------------------------------------

/**
 * Recognize a definite integral in the raw problem text and pull out its
 * pieces. Returns { integrand, variable, lowerRaw, upperRaw, lowerLabel,
 * upperLabel }, a { error: true } marker when it clearly looks definite but
 * the bounds can't be read, or null when it isn't a definite integral at all.
 */
function parseDefiniteIntegral(raw) {
  const s = String(raw || '').trim().replace(/−/g, '-');
  const looksDefinite = /∫\s*_|_\s*\{?\s*[-\d]|\bfrom\b[\s\S]*\bto\b|\bdefinite\b/i.test(s);
  if (!looksDefinite) return null;

  let lowerRaw;
  let upperRaw;
  let body;

  // Form A — sub/superscript bounds: ∫_a^b <integrand> d<var>
  //   ∫_0^1 x dx · ∫_{0}^{pi} sin(x) dx · definite ∫_0^1 x^2 dx
  let m = s.match(/∫?\s*_\s*\{?\s*([^{}^]+?)\s*\}?\s*\^\s*\{?\s*([^{}\s]+?)\s*\}?\s+(.+)/i);
  if (m) {
    [, lowerRaw, upperRaw, body] = m;
  } else {
    // Form B — "<integrand> from a to b"
    m = s.match(/(.+?)\s+from\s+(\S+)\s+to\s+(.+)/i);
    if (m) {
      [, body, lowerRaw, upperRaw] = m;
    } else {
      // Form C — "from a to b <integrand>"
      m = s.match(/from\s+(\S+)\s+to\s+(\S+)\s+(?:of\s+)?(.+)/i);
      if (m) {
        [, lowerRaw, upperRaw, body] = m;
      } else {
        return { error: true };
      }
    }
  }

  // Identify the variable from a trailing d<var>; default to x.
  let variable = 'x';
  const dm = body.match(/\bd\s*([a-z])\b/i);
  if (dm) variable = dm[1].toLowerCase();

  // Strip decoration from the integrand: ∫, "definite", the verb, d<var>.
  const integrand = body
    .replace(/∫/g, ' ')
    .replace(/\bdefinite\b/gi, ' ')
    .replace(/\b(?:find|take)\s+the\s+integral\s+of\b/gi, ' ')
    .replace(/\b(?:the\s+)?integral\s+of\b/gi, ' ')
    .replace(/\bantiderivative\s+of\b/gi, ' ')
    .replace(/\bintegrate\b/gi, ' ')
    .replace(new RegExp(`\\bd\\s*${variable}\\b`, 'i'), ' ')
    .trim();

  // "∫_0^1 dx": nothing between the bounds and dx is the integrand 1.
  const integrandOrOne = integrand || (dm ? '1' : '');
  if (!integrandOrOne) return { error: true };

  return {
    integrand: parseMathExpression(integrandOrOne),
    variable,
    lowerRaw: parseMathExpression(lowerRaw.trim()),
    upperRaw: parseMathExpression(upperRaw.trim()),
    lowerLabel: prettifyBound(lowerRaw.trim()),
    upperLabel: prettifyBound(upperRaw.trim()),
  };
}

function prettifyBound(label) {
  return String(label).replace(/\bpi\b/gi, 'π').replace(/\*/g, '').replace(/^(-?)\s*(?:inf(?:inity)?|oo)$/i, '$1∞');
}

const isInfiniteBound = (t) => /^-?\s*(?:∞|inf(?:inity)?|oo|Infinity)\s*$/i.test(String(t).trim());
const boundSign = (t) => (/^-/.test(String(t).trim()) ? -1 : 1);

// lim F(t) as t → ±∞, by sampling. Returns { value } (finite limit),
// { diverges: '∞' | '-∞' } or { undefined: true } (oscillates / unreadable).
function limitAtInfinity(F, variable, sign) {
  const samples = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((m) => evalAntiderivNumeric(F, variable, sign * m));
  const finite = samples.filter(Number.isFinite);
  if (finite.length < 3) {
    const last = finite[finite.length - 1];
    if (last === undefined) return { undefined: true };
    return { diverges: last > 0 ? '∞' : '-∞', samples };
  }
  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  const diffs = finite.slice(1).map((v, i) => Math.abs(v - finite[i]));
  const shrinking = diffs.slice(-3).every((d, i, arr) => i === 0 || d <= arr[i - 1] * 1.01);
  if (Math.abs(last - prev) < 1e-6 * (1 + Math.abs(last)) || (shrinking && Math.abs(last - prev) < 1e-4 * (1 + Math.abs(last)))) {
    return { value: last, samples };
  }
  if (Math.abs(last) > Math.abs(prev) * 2 && Math.abs(last) > 1e3) return { diverges: last > 0 ? '∞' : '-∞', samples };
  // Slow but steady growth (ln t, √t): every step in the same direction and
  // the steps not shrinking away — that is divergence, not oscillation.
  const signedDiffs = finite.slice(1).map((v, i) => v - finite[i]);
  const sameDir = signedDiffs.every((d) => d > 0) || signedDiffs.every((d) => d < 0);
  const notShrinking = Math.abs(signedDiffs[signedDiffs.length - 1]) >= 0.5 * Math.abs(signedDiffs[0]);
  if (sameDir && notShrinking) return { diverges: last > 0 ? '∞' : '-∞', slow: true, samples };
  return { undefined: true, samples };
}

// Name a limit value when it is a familiar constant.
function nameConstant(v) {
  if (Math.abs(v) < 1e-9) return '0';
  const named = [[Math.PI, 'π'], [Math.PI / 2, 'π/2'], [Math.PI / 4, 'π/4'], [Math.E, 'e'], [1 / Math.E, '1/e'], [Math.sqrt(Math.PI), '√π'], [Math.sqrt(Math.PI) / 2, '√π/2']];
  for (const [c, t] of named) {
    if (Math.abs(v - c) < 1e-6) return t;
    if (Math.abs(v + c) < 1e-6) return `-${t}`;
  }
  return null;
}

// ∫_a^∞, ∫_-∞^b, ∫_-∞^∞ — as lim_{t→∞} ∫_a^t f, via the antiderivative.
async function solveImproperInfinite(parsed, notation) {
  const { integrand, variable: v, lowerRaw, upperRaw, lowerLabel, upperLabel } = parsed;
  const Algebrite = await loadAlgebrite();
  const lowerInf = isInfiniteBound(lowerRaw);
  const upperInf = isInfiniteBound(upperRaw);
  const steps = [`Evaluate the improper integral ${notation}.`];
  const which = lowerInf && upperInf ? 'both limits are infinite' : `the ${upperInf ? 'upper' : 'lower'} limit is ${upperInf ? upperLabel : lowerLabel}`;
  steps.push(`This is an improper integral — ${which}. It is defined as a limit of proper integrals: ${lowerInf && upperInf ? `∫_{-∞}^{∞} f d${v} = lim_{s→-∞} ∫_s^0 f d${v} + lim_{t→∞} ∫_0^t f d${v}` : upperInf ? `∫_${lowerLabel}^∞ f d${v} = lim_{t→∞} ∫_${lowerLabel}^t f d${v}` : `∫_{-∞}^${upperLabel} f d${v} = lim_{s→-∞} ∫_s^${upperLabel} f d${v}`}.`);

  const F = await antiderivativeViaTerms(integrand, v, Algebrite);
  if (!F) {
    return unsupported({
      input: notation,
      reason: 'The antiderivative could not be found, so the limit defining this improper integral cannot be evaluated here.',
      answer: 'This improper integral is beyond what this solver can compute',
      steps,
    });
  }
  const showF = (t) => lnify(t).replace(/\bexp\(([^()]+)\)/g, 'e^($1)');
  steps.push(`Antiderivative: F(${v}) = ${showF(F)}.`);

  // Each infinite end contributes lim F; each finite end contributes F(bound).
  const ends = [];
  const finiteBoundVal = (raw) => Number(math.evaluate(String(raw).replace(/π/g, 'pi')));
  const describeLimit = (sign, res) => {
    const arrow = sign > 0 ? 't → ∞' : 's → -∞';
    const shown = (res.samples || []).slice(0, 4).map((x) => (Number.isFinite(x) ? formatNumber(x) : '±∞')).join(', ');
    const at = sign > 0 ? '10², 10³, 10⁴, 10⁵' : '-10², -10³, -10⁴, -10⁵';
    if (res.value !== undefined) steps.push(`As ${arrow}, F(${sign > 0 ? 't' : 's'}) → ${nameConstant(res.value) ?? formatNumber(res.value)} (samples at ${at}: ${shown}).`);
    else if (res.diverges) steps.push(`As ${arrow}, F(${sign > 0 ? 't' : 's'}) grows without bound${res.slow ? ' — slowly, but steadily' : ''} (samples: ${shown}) — the limit is ${res.diverges}.`);
    else steps.push(`As ${arrow}, F(${sign > 0 ? 't' : 's'}) does not settle (samples: ${shown}).`);
  };

  let upperPart;
  let lowerPart;
  if (upperInf) {
    const res = limitAtInfinity(F, v, boundSign(upperRaw));
    describeLimit(boundSign(upperRaw), res);
    upperPart = res;
  } else {
    const val = finiteBoundVal(upperRaw);
    const exact = evalAntiderivAt(Algebrite, F, v, upperRaw);
    const num = evalAntiderivNumeric(F, v, val);
    upperPart = { value: num, exact };
    steps.push(`F(${upperLabel}) = ${exact ?? formatNumber(num)}.`);
  }
  if (lowerInf) {
    const res = limitAtInfinity(F, v, boundSign(lowerRaw));
    describeLimit(boundSign(lowerRaw), res);
    lowerPart = res;
  } else {
    const val = finiteBoundVal(lowerRaw);
    const exact = evalAntiderivAt(Algebrite, F, v, lowerRaw);
    const num = evalAntiderivNumeric(F, v, val);
    lowerPart = { value: num, exact };
    steps.push(`F(${lowerLabel}) = ${exact ?? formatNumber(num)}.`);
  }

  const divergent = [upperPart, lowerPart].find((p) => p.diverges || p.undefined);
  if (divergent) {
    if (upperPart.diverges && lowerPart.diverges && upperPart.diverges !== lowerPart.diverges) {
      steps.push('Both ends run off to infinity in the same direction of F, so the difference is ∞ − ∞ — the integral does not converge.');
    } else if (divergent.diverges) {
      steps.push('The limit is infinite, so the integral diverges.');
    } else {
      steps.push('The limit does not exist, so the integral does not converge.');
    }
    return {
      steps,
      answer: `${notation} diverges`,
      status: 'undefined',
      tips: ['An improper integral converges only if the limit defining it is a finite number.', 'Compare with ∫₁^∞ 1/x^p dx: it converges for p > 1 and diverges for p ≤ 1.'],
      common_mistakes: ['Treating ∞ as a number and "plugging it in" — the integral is a limit, and it can fail to exist.', 'Assuming a function that tends to 0 has a convergent integral (1/x → 0 but ∫₁^∞ 1/x dx = ∞).'],
      graph: generateDefiniteGraph(integrand, v, lowerInf ? -10 : finiteBoundVal(lowerRaw), upperInf ? 10 : finiteBoundVal(upperRaw), lowerLabel, upperLabel, NaN),
    };
  }

  const value = upperPart.value - lowerPart.value;
  // Exact form when the infinite ends contribute a nameable constant.
  const partText = (p, isUpper) => (p.exact !== undefined && p.exact !== null ? p.exact : (nameConstant(p.value) ?? formatNumber(p.value)));
  const upText = partText(upperPart, true);
  const lowText = partText(lowerPart, false);
  let exactText = null;
  try {
    // Ask Algebrite to simplify "upper − lower" when both are exact-able.
    const upRaw = upperPart.exact !== undefined && upperPart.exact !== null ? exactValueToRaw(upperPart.exact) : (nameConstant(upperPart.value) ?? null);
    const lowRaw = lowerPart.exact !== undefined && lowerPart.exact !== null ? exactValueToRaw(lowerPart.exact) : (nameConstant(lowerPart.value) ?? null);
    if (upRaw !== null && lowRaw !== null) {
      const toAlg = (t) => t.replace(/√π/g, 'sqrt(pi)').replace(/√(\d+)/g, 'sqrt($1)').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
      const raw = String(Algebrite.run(`simplify((${toAlg(upRaw)}) - (${toAlg(lowRaw)}))`)).trim();
      if (!isAlgebriteFailure(raw) && !/nil|Stop/.test(raw)) {
        exactText = formatExactValue(raw)
          .replace(/^1\/(\d+)\*(π|e|√π|sqrt\(π\))$/, '$2/$1')
          .replace(/^1\/(\d+)\*π\^\(1\/2\)$/, '√π/$1')
          .replace(/π\^\(1\/2\)/g, '√π');
      }
    }
  } catch { exactText = null; }
  const approx = formatNumber(value);
  const valueText = exactText && exactText !== approx ? `${exactText} (≈ ${approx})` : (exactText || approx);
  steps.push(`Subtract: ${upText} − (${lowText}) = ${valueText}. The limit is finite, so the integral converges.`);

  // Cross-check by quadrature over a long finite stretch.
  const lo = lowerInf ? -200 : finiteBoundVal(lowerRaw);
  const hi = upperInf ? 200 : finiteBoundVal(upperRaw);
  const check = numericIntegral(integrand, v, lo, hi, 4000);
  const agrees = typeof check === 'number' && Number.isFinite(check) && Math.abs(check - value) < Math.max(0.05, Math.abs(value) * 0.05);
  if (typeof check === 'number' && Number.isFinite(check) && !agrees) {
    // A slowly-decaying tail can make the finite check fall short; only refuse when
    // the mismatch is gross.
    if (Math.abs(check - value) > Math.max(0.5, Math.abs(value) * 0.5)) {
      return refuseDefinite('The limit value and a numeric check disagree, so I am not reporting a value.', notation);
    }
  }
  steps.push(`Check: integrating numerically over a long finite stretch gives ≈ ${typeof check === 'number' ? formatNumber(check) : '—'}, consistent with the limit.`);

  return {
    steps,
    answer: `${notation} = ${valueText}`,
    tips: [
      'An improper integral is a limit: replace the infinite bound by t, integrate, then let t → ∞.',
      'It converges when that limit is finite; ∫₁^∞ 1/x^p dx converges exactly when p > 1.',
    ],
    common_mistakes: ['Plugging ∞ into F as if it were a number.', 'Forgetting that a limit can fail to exist even when the integrand tends to 0.'],
    graph: generateDefiniteGraph(integrand, v, lowerInf ? Math.min(-10, hi - 10) : finiteBoundVal(lowerRaw), upperInf ? Math.max(10, lo + 10) : finiteBoundVal(upperRaw), lowerLabel, upperLabel, value),
  };
}

// The indefinite path's per-term antiderivative (direct / substitution /
// by-parts / abs), verified by differentiation. Returns F or null.
async function antiderivativeViaTerms(expression, variable, Algebrite) {
  try {
    const terms = splitTerms(expression);
    const parts = [];
    for (const { signed } of terms) {
      const res = await integrateTerm(signed, variable, Algebrite);
      if (!res) return null;
      parts.push(res.antideriv);
    }
    if (parts.length === 0) return null;
    const F = simplifyRun(Algebrite, parts.map((p) => `(${p})`).join(' + ')) || parts.join(' + ');
    if (isUnevaluatedOperator(F) || /\bi\b/.test(F)) return null;
    return derivativeMatchesNumerically(F, expression, variable) ? F : null;
  } catch {
    return null;
  }
}

// A numeric FTC value as display text: a small exact fraction when it is one
// (1, 1/2, 3/4), otherwise the decimal.
function exactValueToRaw(value) {
  if (Number.isInteger(value)) return String(value);
  for (let den = 2; den <= 64; den += 1) {
    const num = value * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) return `${Math.round(num)}/${den}`;
  }
  return formatNumber(value);
}

async function solveDefiniteIntegral(parsed) {
  if (parsed.error) {
    return refuseDefinite(
      'This looks like a definite integral, but I could not read its bounds.',
      'Try the form ∫_0^1 x^2 dx, or "x^2 from 0 to 1".',
      'parse',
    );
  }

  const { integrand, variable: v, lowerRaw, upperRaw, lowerLabel, upperLabel } = parsed;
  const intgDisp = beautify(integrand);
  const notation = `∫_${lowerLabel}^${upperLabel} (${intgDisp}) d${v}`;

  try {
    // Improper integrals to ±∞: defined as a limit of proper ones.
    if (isInfiniteBound(lowerRaw) || isInfiniteBound(upperRaw)) {
      return solveImproperInfinite(parsed, notation);
    }

    const a = Number(math.evaluate(lowerRaw));
    const b = Number(math.evaluate(upperRaw));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return refuseDefinite('I could not read the integration bounds as numbers.', notation, 'parse');
    }

    const Algebrite = await loadAlgebrite();
    const forAlgebrite = rewriteReciprocalTrig(integrand);

    // Authoritative exact value.
    let exactRaw;
    try {
      exactRaw = String(Algebrite.run(`defint(${forAlgebrite}, ${v}, ${lowerRaw}, ${upperRaw})`)).trim();
    } catch {
      exactRaw = null;
    }

    // Reject unresolved, non-real, or still-symbolic results.
    const badExact =
      !exactRaw ||
      isAlgebriteFailure(exactRaw) || /defint/i.test(exactRaw) ||
      /\bi\b/.test(exactRaw) ||
      new RegExp(`\\b${v}\\b`).test(exactRaw);

    let exactValue = NaN;
    if (!badExact) {
      try {
        const evaluated = math.evaluate(exactRaw);
        exactValue = typeof evaluated === 'number' ? evaluated : NaN;
      } catch {
        exactValue = NaN;
      }
    }

    // Independent numeric confirmation (Simpson's rule). Also the improper-
    // integral detector: a discontinuity inside [a,b] returns IMPROPER.
    const numeric = numericIntegral(integrand, v, a, b);
    if (numeric === 'IMPROPER') {
      return refuseImproper(notation, v);
    }

    // Algebrite's defint has no abs and no substitution step. When it fails,
    // the per-term antiderivative machinery the indefinite path uses (which
    // has both) supplies F, and the FTC — F(b) − F(a) — supplies the value.
    // Still cross-checked against Simpson below, and still refused if the two
    // disagree.
    let ftcF = null;
    if (badExact || !Number.isFinite(exactValue)) {
      ftcF = await antiderivativeViaTerms(integrand, v, Algebrite);
      if (ftcF) {
        const Fb = evalAntiderivNumeric(ftcF, v, b);
        const Fa = evalAntiderivNumeric(ftcF, v, a);
        // F unbounded at an endpoint (∫₀¹ 1/x: F = ln|x| → −∞ at 0) means the
        // integral DIVERGES there — say so, instead of "could not compute".
        // An integrable endpoint singularity (1/√x: F = 2√x, finite at 0)
        // passes straight through.
        if (!Number.isFinite(Fb) || !Number.isFinite(Fa)) {
          const at = !Number.isFinite(Fa) ? lowerLabel : upperLabel;
          const bigNear = (x0) => { const y = evalAntiderivNumeric(integrand, v, x0); return !Number.isFinite(y) || Math.abs(y) > 1e6; };
          const edge = !Number.isFinite(Fa) ? a : b;
          if (bigNear(edge) || bigNear(edge + (edge === a ? 1e-9 : -1e-9))) {
            return refuseImproperAt(notation, v, at, integrand);
          }
          ftcF = null;
        }
        if (Number.isFinite(Fb) && Number.isFinite(Fa)) {
          exactValue = Fb - Fa;
          // Prefer an exact symbolic value when Algebrite can form one from F
          // (½·sin(1) rather than 0.4207); it must agree with the numeric FTC.
          let symbolic = null;
          try {
            const out = String(Algebrite.run(`simplify(subst(${upperRaw}, ${v}, ${ftcF}) - subst(${lowerRaw}, ${v}, ${ftcF}))`)).trim();
            if (!isAlgebriteFailure(out) && !/\bi\b/.test(out) && !new RegExp(`\\b${v}\\b`).test(out)) {
              const n = Number(math.evaluate(out));
              if (Number.isFinite(n) && Math.abs(n - exactValue) < 1e-9 * (1 + Math.abs(n))) symbolic = out;
            }
          } catch { /* fall back to the numeric form */ }
          exactRaw = symbolic || exactValueToRaw(exactValue);
        } else {
          ftcF = null;
        }
      }
    }
    const exactUsable = Number.isFinite(exactValue) && (!badExact || ftcF);

    // If Algebrite's exact value is unusable, or the two methods disagree,
    // refuse rather than present a number we don't trust.
    const tol = Math.max(1e-2, Math.abs(Number.isFinite(exactValue) ? exactValue : numeric) * 1e-2);
    if (!exactUsable || !Number.isFinite(numeric) || Math.abs(numeric - exactValue) > tol) {
      // A confirmed-finite numeric with no trustworthy exact still gets refused
      // here: without the symbolic value we can't show honest FTC steps, and a
      // bare decimal from quadrature isn't what this solver promises.
      return refuseDefinite(
        'I could not compute this definite integral exactly (the antiderivative may have no elementary form).',
        notation,
      );
    }

    // Antiderivative for the worked FTC steps.
    let F = ftcF;
    if (!F) {
      try {
        F = Algebrite.integral(forAlgebrite, v).toString();
      } catch {
        F = null;
      }
    }
    const hasAntideriv = F && !isAlgebriteFailure(F) && !/integral/i.test(F);

    const exactDisplay = formatExactValue(exactRaw);
    const isCleanValue = /^-?\d+$/.test(exactRaw.replace(/\s/g, ''));
    const approx = formatNumber(exactValue);
    const valueText = isCleanValue || exactDisplay === approx ? exactDisplay : `${exactDisplay} (≈ ${approx})`;

    const steps = [`Evaluate the definite integral ${notation}.`];
    if (hasAntideriv) {
      steps.push(`First find the antiderivative: F(${v}) = ${lnify(F)}.`);
      steps.push(`Apply the Fundamental Theorem of Calculus: ∫_a^b f d${v} = F(b) − F(a).`);
      const Fb = evalAntiderivAt(Algebrite, F, v, upperRaw);
      const Fa = evalAntiderivAt(Algebrite, F, v, lowerRaw);
      if (Fb !== null && Fa !== null) {
        steps.push(`Evaluate at the bounds: F(${upperLabel}) = ${Fb} and F(${lowerLabel}) = ${Fa}.`);
        steps.push(`Subtract: F(${upperLabel}) − F(${lowerLabel}) = ${valueText}.`);
      } else {
        steps.push(`Evaluate F at the two bounds and subtract to get ${valueText}.`);
      }
    } else {
      steps.push('Find the antiderivative, then subtract its values at the two bounds.');
      steps.push(`The definite integral equals ${valueText}.`);
    }
    steps.push(`Verified numerically (Simpson's rule): ≈ ${formatNumber(numeric)}.`);

    return {
      steps,
      answer: `${notation} = ${valueText}`,
      verified: true,
      verificationMethod: 'Fundamental Theorem of Calculus + numeric quadrature',
      tips: [
        'The Fundamental Theorem of Calculus: ∫_a^b f d' + v + ' = F(b) − F(a), where F is any antiderivative.',
        'No “+C” for a definite integral — the constant cancels in the subtraction.',
        'A definite integral is the signed area between the curve and the x-axis over [a, b].',
      ],
      common_mistakes: [
        'Keeping the +C — it cancels when you subtract F(a) from F(b).',
        'Swapping the bounds: ∫_a^b = −∫_b^a.',
        'Integrating across a discontinuity (e.g. 1/x on [−1, 1]) as if the integral were proper.',
      ],
      graph: generateDefiniteGraph(integrand, v, a, b, lowerLabel, upperLabel, exactValue),
    };
  } catch (error) {
    console.error('Definite integral solver error:', error);
    return refuseDefinite('I was unable to compute this definite integral.', notation);
  }
}

// Evaluate an antiderivative at a bound, returning a clean exact string or null.
// Numeric F(at) via mathjs (which, unlike Algebrite, evaluates abs and sgn).
function evalAntiderivNumeric(F, variable, at) {
  try {
    const v = math.evaluate(F, { [variable]: at });
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

function evalAntiderivAt(Algebrite, F, variable, at) {
  try {
    const out = String(Algebrite.run(`simplify(subst(${at}, ${variable}, ${F}))`)).trim();
    if (isAlgebriteFailure(out)) return null;
    return formatExactValue(out);
  } catch {
    return null;
  }
}

// Simpson's rule with singularity detection. Returns the numeric value, or the
// string 'IMPROPER' when the integrand has a pole strictly inside [a, b]
// (endpoint singularities, which are often integrable, are nudged and kept).
function numericIntegral(integrand, variable, a, b, N = 2000) {
  if (a === b) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const h = (hi - lo) / N;

  const fx = (x) => {
    try {
      const y = math.evaluate(integrand, { [variable]: x });
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  };

  // An integrable singularity AT an endpoint (1/√x at 0) makes uniform
  // Simpson converge too slowly to pass the exact-vs-numeric cross-check.
  // Substitute x = lo + (hi−lo)·t³ (or the mirror image at hi): the mesh is
  // graded toward the singular end and the transformed integrand,
  // f(x(t))·3(hi−lo)t², is tame. Interior poles are still reported IMPROPER.
  const singularLo = !Number.isFinite(fx(lo)) && Number.isFinite(fx(lo + h / 997));
  const singularHi = !Number.isFinite(fx(hi)) && Number.isFinite(fx(hi - h / 997));
  if (singularLo !== singularHi) {
    const L = hi - lo;
    const g = (t) => {
      const x = singularLo ? lo + L * t * t * t : hi - L * t * t * t;
      const y = fx(x);
      return Number.isFinite(y) ? y * 3 * L * t * t : NaN;
    };
    let tsum = 0;
    const th = 1 / N;
    for (let i = 0; i <= N; i += 1) {
      let y = g(i * th);
      if (!Number.isFinite(y)) {
        if (i !== 0 && i !== N) return 'IMPROPER';
        y = 0; // t = 0 maps to the singular endpoint; the weight t² kills it
      }
      if (i !== 0 && i !== N && Math.abs(y) > 1e9) return 'IMPROPER';
      tsum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * y;
    }
    const value = (tsum * th) / 3;
    return b < a ? -value : value;
  }

  let sum = 0;
  for (let i = 0; i <= N; i += 1) {
    const interior = i !== 0 && i !== N;
    const x = lo + i * h;
    let y = fx(x);
    if (!Number.isFinite(y)) {
      // A non-finite value strictly inside the interval is a pole — the
      // integral is improper. Endpoints are often integrable singularities
      // (∫₀¹ ln x dx), so nudge inward and keep them.
      if (interior) return 'IMPROPER';
      y = fx(x + (i === N ? -1 : 1) * (h / 997));
      if (!Number.isFinite(y)) y = 0;
    }
    if (interior && Math.abs(y) > 1e9) return 'IMPROPER';
    sum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * y;
  }

  const value = (sum * h) / 3;
  return b < a ? -value : value;
}

// Algebrite exact strings use log/pi/exp; present them the textbook way.
function formatExactValue(raw) {
  let s = beautify(String(raw));
  s = s
    .replace(/\bexp\(1\)/g, 'e')
    .replace(/\bexp\(([^()]+)\)/g, 'e^($1)')
    .replace(/\blog\(([^()]+)\)/g, 'ln($1)')
    .replace(/\bpi\b/g, 'π');
  return s;
}

// kind 'parse' = the bounds/notation couldn't be read; 'unsupported' = the
// notation was fine but the value couldn't be computed trustworthily.
function refuseDefinite(reason, notation, kind = 'unsupported') {
  const steps = [];
  if (notation) steps.push(`Evaluate the definite integral ${notation}.`);
  steps.push(reason);
  steps.push('Tip: check the bounds and the integrand, or find the antiderivative F and compute F(upper) − F(lower).');
  const fields = {
    steps,
    answer: reason,
    tips: ['A definite integral needs a lower and an upper bound, e.g. ∫_0^1 x^2 dx.'],
    common_mistakes: ['Bounds that cannot be parsed as numbers.', 'An integrand with no elementary antiderivative.'],
  };
  return kind === 'parse' ? parseError(fields) : unsupported(fields);
}

// The integrand is unbounded at an endpoint and the antiderivative has no
// finite limit there: the improper integral diverges.
function refuseImproperAt(notation, variable, at, integrand) {
  return unsupported({
    input: notation,
    reason: `The integrand ${beautify(integrand)} is unbounded as ${variable} → ${at}, and its antiderivative has no finite value there — this improper integral diverges (it has no finite value).`,
    answer: `Diverges — the integral has no finite value (unbounded at ${variable} = ${at})`,
    steps: [
      `Evaluate the definite integral ${notation}.`,
      `The integrand blows up at the endpoint ${variable} = ${at}, so this is an improper integral: it means lim (t→${at}) of the integral over the rest of the interval.`,
      'That limit does not exist as a finite number — the area grows without bound — so the integral diverges.',
    ],
    tips: [
      'An improper integral converges only if the limit toward the singular endpoint is finite: ∫₀¹ 1/√x dx = 2 converges, ∫₀¹ 1/x dx diverges.',
      'Compare with a p-integral: ∫₀¹ 1/xᵖ dx converges for p < 1 and diverges for p ≥ 1.',
    ],
    common_mistakes: ['Applying F(b) − F(a) at a point where F is not defined.'],
  });
}

function refuseImproper(notation, variable) {
  return unsupported({
    steps: [
      `Evaluate the definite integral ${notation}.`,
      `The integrand is discontinuous somewhere between the bounds (it has a vertical asymptote in the interval).`,
      'That makes this an improper integral — its value cannot be found by the ordinary Fundamental Theorem of Calculus, so MasterMath does not report a number here.',
    ],
    answer: 'Improper integral (discontinuous on the interval) — not supported',
    tips: [
      `Split the integral at the discontinuity and take one-sided limits to test convergence.`,
      `For example, ∫ 1/${variable} over an interval containing 0 diverges — it has no finite value.`,
    ],
    common_mistakes: [
      'Blindly applying F(b) − F(a) across a vertical asymptote — that gives a confident but meaningless number.',
    ],
  });
}

// Graph f(x) with the integration interval [a, b] shaded — the definite
// integral IS that signed area. Samples a padded window so the region sits in
// context and the viewer can pan out.
function generateDefiniteGraph(integrand, variable, a, b, lowerLabel, upperLabel, value) {
  try {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const pad = Math.max((hi - lo) * 1.5, 4);
    const points = sampleFunction(integrand, variable, {
      min: lo - pad,
      max: hi + pad,
      step: Math.max((hi - lo + 2 * pad) / 400, 0.02),
      cap: 1e5,
    });
    if (points.length === 0) return null;

    return {
      points,
      title: `Area under f(${variable}) = ${beautify(integrand)}`,
      description: `The shaded region from ${variable} = ${lowerLabel} to ${variable} = ${upperLabel} has signed area ${formatNumber(value)}.`,
      annotations: {
        shaded: { from: a, to: b, fromLabel: lowerLabel, toLabel: upperLabel },
      },
      initialWindow: { xMin: lo - pad / 2, xMax: hi + pad / 2 },
    };
  } catch (error) {
    console.error('Definite integral graph error:', error);
    return null;
  }
}

/**
 * Worked steps: integrate each top-level term individually with Algebrite and
 * show the intermediate antiderivative, then combine and add +C. Integration is
 * linear, so this term-by-term breakdown is exact.
 */
function generateIntegralSteps(expression, integral, variable, Algebrite) {
  const steps = [];
  steps.push(`Identify the function to integrate: ∫(${beautify(expression)}) d${variable}`);

  const terms = splitTerms(expression);

  if (terms.length > 1) {
    steps.push('Apply the sum rule: integrate each term separately, then add the results.');
  }

  for (const { signed } of terms) {
    const { label, hint } = classifyIntegralRule(signed, variable);
    let termIntegral = null;
    try {
      termIntegral = Algebrite.integral(rewriteReciprocalTrig(signed), variable).toString();
    } catch {
      termIntegral = null;
    }

    if (hint) {
      steps.push(`${label} — ${hint}.`);
    }

    if (termIntegral !== null) {
      steps.push(`∫(${beautify(signed)}) d${variable} = ${lnify(termIntegral)}`);
    } else {
      steps.push(`Integrate ${beautify(signed)} using the ${label.toLowerCase()}.`);
    }
  }

  if (terms.length > 1) {
    steps.push(`Add the term integrals: ${lnify(integral)}`);
  }

  steps.push(`Add the constant of integration: ∫(${beautify(expression)}) d${variable} = ${lnify(integral)} + C`);

  return steps;
}

/**
 * Classify which integration technique a single term needs. Because it operates
 * on one term at a time, the heuristics are reliable and the label sits next to
 * the real computed antiderivative.
 */
function classifyIntegralRule(term, variable) {
  const v = variable;

  if (!hasVariable(term, v)) {
    return { label: 'Constant rule', hint: `∫c d${v} = c·${v}` };
  }

  const inner = term.replace(/^[-+]/, '');

  // Reciprocal: 1/x or x^-1.
  if (new RegExp(`(?:^|[^a-z])1\\s*/\\s*${v}\\b`, 'i').test(inner) || new RegExp(`${v}\\s*\\^\\s*-\\s*1\\b`, 'i').test(inner)) {
    return { label: 'Reciprocal rule', hint: `∫1/${v} d${v} = ln|${v}|` };
  }

  // Products mixing function families usually need integration by parts.
  const factors = splitTopLevel(inner, '*');
  const varFactors = factors.filter((f) => hasVariable(f, v));
  const mixesFamilies =
    varFactors.length >= 2 &&
    /\b(?:sin|cos|tan|exp|ln|log)\b|e\^/i.test(inner);
  if (mixesFamilies) {
    return {
      label: 'Integration by parts',
      hint: '∫u dv = uv − ∫v du (choose u by LIATE: Log, Inverse-trig, Algebraic, Trig, Exponential)',
    };
  }

  // Composite function → u-substitution.
  if (isComposite(inner, v)) {
    return { label: 'u-substitution', hint: `let u = the inner function, then du = u′ d${v}` };
  }

  if (/\bsin\b/i.test(inner)) return { label: 'Trig rule', hint: `∫sin(${v}) d${v} = -cos(${v})` };
  if (/\bcos\b/i.test(inner)) return { label: 'Trig rule', hint: `∫cos(${v}) d${v} = sin(${v})` };
  if (/\bexp\b|e\^/i.test(inner)) return { label: 'Exponential rule', hint: `∫e^${v} d${v} = e^${v}` };
  if (/\bsqrt\b|√/i.test(inner)) return { label: 'Power rule', hint: `rewrite √${v} as ${v}^(1/2), then use the power rule` };

  if (/\^/.test(inner)) return { label: 'Power rule', hint: `∫${v}^n d${v} = ${v}^(n+1)/(n+1)` };

  // Linear term (a·x or x).
  return { label: 'Power rule', hint: `∫${v} d${v} = ${v}²/2` };
}

function isComposite(term, variable) {
  const fnInner = term.match(/\b(?:sin|cos|tan|sec|csc|cot|exp|ln|log|sqrt)\s*\(([^()]*)\)/i);
  if (fnInner) {
    const arg = fnInner[1];
    if (hasVariable(arg, variable) && /[+\-*/^]/.test(arg)) return true;
  }
  if (/\([^()]*[+\-*/][^()]*\)\s*\^/.test(term)) return true;
  return false;
}

function splitTopLevel(str, delimiter) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function generateIntegralGraph(original, integral, variable) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(integral, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        secondaryLabel: `F(${variable}) = ${lnify(integral)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: F(${variable}) = ${lnify(integral)} (antiderivative)`,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}
