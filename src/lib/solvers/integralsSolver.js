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
} from './solverUtils.js';
import { extractVariable, extractFunctionFromProblem, parseMathExpression } from '../mathParser.js';
import { integrateByParts, needsByParts } from './byPartsSolver.js';

// The integral solver receives the RAW problem text (see api.js), because a
// definite integral's bounds live in the notation and must be read before
// parseMathExpression collapses the spacing.
export async function solveIntegral(rawInput) {
  const definite = parseDefiniteIntegral(rawInput);
  if (definite) {
    return solveDefiniteIntegral(definite);
  }

  const expression = extractFunctionFromProblem(rawInput);
  return solveIndefiniteIntegral(expression);
}

async function solveIndefiniteIntegral(expression) {
  try {
    if (!expression || !expression.trim()) {
      throw new Error('empty integrand');
    }

    const Algebrite = await loadAlgebrite();
    const variable = extractVariable(expression);

    // Integrate term by term so an integration-by-parts term can get its own
    // worked walkthrough (and so a single hard term doesn't sink the whole
    // integral the way Algebrite.integral of the full expression would).
    const terms = splitTerms(expression);
    const perTerm = [];
    let anyByParts = false;
    for (const { signed } of terms) {
      const res = await integrateTerm(signed, variable, Algebrite);
      if (!res) { perTerm.length = 0; break; }
      if (res.method === 'byparts') anyByParts = true;
      perTerm.push(res);
    }

    let integral;
    let steps;
    if (perTerm.length === terms.length && perTerm.length > 0) {
      integral = simplifyRun(Algebrite, perTerm.map((r) => `(${r.antideriv})`).join(' + ')) ||
        perTerm.map((r) => r.antideriv).join(' + ');
      steps = buildPerTermSteps(expression, terms, perTerm, variable, integral);
    } else {
      // Fallback: authoritative antiderivative for the whole expression.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = Algebrite.integral(forAlgebrite, variable).toString();
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
    }

    // Trust gate: the derivative of the antiderivative must equal the integrand.
    const dCheck = safeRunLocal(Algebrite, `d(${integral}, ${variable})`);
    if (!dCheck || !expressionsNumericallyEqual(dCheck, rewriteReciprocalTrig(expression), variable)) {
      // The per-term path failed verification — fall back to whole-Algebrite.
      const forAlgebrite = rewriteReciprocalTrig(expression);
      integral = Algebrite.integral(forAlgebrite, variable).toString();
      steps = generateIntegralSteps(expression, integral, variable, Algebrite);
    }

    const tips = [
      anyByParts
        ? 'Integration by parts: ∫u dv = uv − ∫v du. Pick u by LIATE (Log, Inverse-trig, Algebraic, Trig, Exponential).'
        : `Power rule: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) + C  (n ≠ -1)`,
      'Always add the constant of integration (+C) for an indefinite integral.',
      'Constant factors pull out front: ∫c·f dx = c·∫f dx.',
    ];

    const common_mistakes = [
      'Forgetting the constant of integration (+C).',
      anyByParts
        ? 'Choosing u and dv the wrong way round — LIATE picks the u that gets simpler when differentiated.'
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
    return {
      steps: [
        `Identify the function to integrate: ∫(${expression}) dx`,
        'Integrate each term, applying the appropriate rule',
        'Add the constant of integration (+C)',
      ],
      answer: 'Unable to compute integral',
      tips: ['Check that your function is properly formatted.'],
      common_mistakes: ['Using incorrect notation'],
      graph: null,
    };
  }
}

// Algebrite writes the natural log as `log(x)` and omits the absolute value.
// The textbook antiderivative of 1/x is ln|x| (correct for negative x too), so
// present integral RESULTS with that convention. Only applied to outputs, never
// to the integrand.
function lnify(integralResult) {
  return beautify(integralResult).replace(/\blog\(([^()]+)\)/g, 'ln|$1|');
}

function safeRunLocal(Algebrite, code) {
  try {
    const out = String(Algebrite.run(code)).trim();
    return /stop|error|nil/i.test(out) ? null : out;
  } catch {
    return null;
  }
}

function simplifyRun(Algebrite, expr) {
  return safeRunLocal(Algebrite, `simplify(${expr})`);
}

/**
 * Integrate one additive term. A by-parts term returns its full walkthrough;
 * everything else is integrated directly by Algebrite. Returns
 * { antideriv, steps, method, term } or null when the term can't be integrated.
 */
async function integrateTerm(term, variable, Algebrite) {
  if (needsByParts(term, variable)) {
    const bp = await integrateByParts(term, variable);
    if (bp) {
      return { antideriv: bp.antiderivative, steps: bp.steps, method: 'byparts', term, cyclic: bp.cyclic };
    }
    // fall through to a direct attempt if by-parts declined
  }

  const anti = safeRunLocal(Algebrite, `integral(${rewriteReciprocalTrig(term)}, ${variable})`);
  if (anti === null) return null;

  const { label, hint } = classifyIntegralRule(term, variable);
  const steps = [`∫(${beautify(term)}) d${variable} = ${lnify(anti)}${hint ? `  (${label})` : ''}.`];
  return { antideriv: anti, steps, method: 'direct', term };
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
      const suffix = res.method === 'byparts' ? ' by parts' : '';
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

  if (!integrand) return { error: true };

  return {
    integrand: parseMathExpression(integrand),
    variable,
    lowerRaw: parseMathExpression(lowerRaw.trim()),
    upperRaw: parseMathExpression(upperRaw.trim()),
    lowerLabel: prettifyBound(lowerRaw.trim()),
    upperLabel: prettifyBound(upperRaw.trim()),
  };
}

function prettifyBound(label) {
  return String(label).replace(/\bpi\b/gi, 'π').replace(/\*/g, '');
}

async function solveDefiniteIntegral(parsed) {
  if (parsed.error) {
    return refuseDefinite(
      'This looks like a definite integral, but I could not read its bounds.',
      'Try the form ∫_0^1 x^2 dx, or "x^2 from 0 to 1".',
    );
  }

  const { integrand, variable: v, lowerRaw, upperRaw, lowerLabel, upperLabel } = parsed;
  const intgDisp = beautify(integrand);
  const notation = `∫_${lowerLabel}^${upperLabel} (${intgDisp}) d${v}`;

  try {
    const a = Number(math.evaluate(lowerRaw));
    const b = Number(math.evaluate(upperRaw));
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return refuseDefinite('I could not read the integration bounds as numbers.', notation);
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
      /stop|error|nil|defint/i.test(exactRaw) ||
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

    // If Algebrite's exact value is unusable, or the two methods disagree,
    // refuse rather than present a number we don't trust.
    const tol = Math.max(1e-2, Math.abs(Number.isFinite(exactValue) ? exactValue : numeric) * 1e-2);
    if (badExact || !Number.isFinite(exactValue) || !Number.isFinite(numeric) || Math.abs(numeric - exactValue) > tol) {
      // A confirmed-finite numeric with no trustworthy exact still gets refused
      // here: without the symbolic value we can't show honest FTC steps, and a
      // bare decimal from quadrature isn't what this solver promises.
      return refuseDefinite(
        'I could not compute this definite integral exactly (the antiderivative may have no elementary form).',
        notation,
      );
    }

    // Antiderivative for the worked FTC steps.
    let F = null;
    try {
      F = Algebrite.integral(forAlgebrite, v).toString();
    } catch {
      F = null;
    }
    const hasAntideriv = F && !/integral|stop|error|nil/i.test(F);

    const exactDisplay = formatExactValue(exactRaw);
    const isCleanValue = /^-?\d+$/.test(exactRaw.replace(/\s/g, ''));
    const valueText = isCleanValue ? exactDisplay : `${exactDisplay} (≈ ${formatNumber(exactValue)})`;

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
function evalAntiderivAt(Algebrite, F, variable, at) {
  try {
    const out = String(Algebrite.run(`simplify(subst(${at}, ${variable}, ${F}))`)).trim();
    if (!out || /stop|error|nil/i.test(out)) return null;
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

function refuseDefinite(reason, notation) {
  const steps = [];
  if (notation) steps.push(`Evaluate the definite integral ${notation}.`);
  steps.push(reason);
  steps.push('Tip: check the bounds and the integrand, or find the antiderivative F and compute F(upper) − F(lower).');
  return {
    steps,
    answer: 'Unable to compute this definite integral',
    tips: ['A definite integral needs a lower and an upper bound, e.g. ∫_0^1 x^2 dx.'],
    common_mistakes: ['Bounds that cannot be parsed as numbers.', 'An integrand with no elementary antiderivative.'],
    graph: null,
  };
}

function refuseImproper(notation, variable) {
  return {
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
    graph: null,
  };
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
