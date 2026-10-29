// Functions/Graphing solver — Wave 2 rebuild (July 2026).
//
// The previous implementation guessed features from 0.5-step samples: it fell
// back to the MIDPOINT sample as a "vertex" for monotonic functions and called
// any |y| < 0.1 sample an "intercept", inventing intercepts at the window edge
// for functions like 1/(x-2). It scored 2/10 in the July 2026 evaluation.
//
// This rebuild computes features honestly and NEVER fabricates one:
//   - extrema:     f'(x) = 0 solved symbolically (Algebrite), numeric
//                  sign-change fallback — both verified, no midpoint fallback
//   - intercepts:  roots of f (symbolic first, bisection-refined sign changes
//                  second), each VERIFIED with |f(root)| ≈ 0
//   - domain:      fine sampling → undefined regions reported, boundaries
//                  refined by bisection
//   - asymptotes:  denominator roots + divergence check; horizontal via
//                  large-|x| settling
//   - inflection:  f''(x) = 0 with concavity-change verification
//   - quadratics:  exact vertex, axis of symmetry, opening direction
// When a feature can't be established, the honest answer is to say nothing
// (or "none found in the analyzed window") — not to invent one.
//
// The feature finders are in ./functions/features.js, the steps, summary and
// graph description in ./functions/presentation.js, the tips and mistakes in
// ./functions/guidance.js.

import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
  parsesAsMath,
  structuralPeriod,
  definedEverywhere,
  mark,
} from './solverUtils.js';
import { featureWindow } from '../graphSampling.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';
import { parseError, unsupported } from '../solutionEnvelope.js';
import { functionGuidance } from './functions/guidance.js';
import {
  WINDOW,
  FINE_STEP,
  evalAt,
  findDomain,
  findVerticalAsymptotes,
  findHoles,
  findXIntercepts,
  snap,
  exactValueAt,
  findExtrema,
  findEndpointExtrema,
  findInflections,
  findHorizontalAsymptote,
} from './functions/features.js';
import {
  buildSteps,
  summarizeAnalysis,
  featureXs,
  describeGraph,
} from './functions/presentation.js';

export async function solveFunctions(expression) {
  try {
    let variable = extractVariable(expression);

    let func = expression;
    // Accept "f(x) = …" and "y = …" as definitions of the function to analyse
    // (the y must be standalone — "2x + 3y = 6" is an equation, not a
    // definition, and never reaches here).
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i) || expression.match(/(?:^|[^a-z0-9])y\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
      // The variable lives in the body ("y = 2x + 1" is a function of x, not
      // of y): re-derive it from the body, not the definition.
      variable = extractVariable(func);
    }

    // Unreadable input must fail here, loudly — sampling would otherwise
    // "analyze" a function that doesn't exist and echo it back as a success.
    if (!parsesAsMath(func)) {
      return parseError({
        input: expression,
        hint: 'This could not be read as a function of one variable.',
        tips: [`Write the function in terms of ${mark('x')}, e.g. "x^2 - 4*x + 3" or "1/(x-2)".`],
      });
    }

    // No variable at all (sin(pi/4), 5): a constant function. The general
    // analysis would call sin(pi/4) "periodic" (it sees a sin) and give it a
    // "horizontal asymptote" (it IS its own value everywhere) — both silly.
    if (!new RegExp(`\\b${variable}\\b`).test(func.replace(/\b(?:e|pi)\b/g, ''))) {
      let value;
      try { value = math.evaluate(func); } catch { value = NaN; }
      const shown = typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : beautify(func);
      const points = sampleFunction(func, variable, { min: -40, max: 40, step: 0.5 });
      return {
        steps: [
          `Analyze the function: f(${variable}) = ${beautify(func)}`,
          `${beautify(func)} does not depend on ${variable} — this is a constant function${typeof value === 'number' && Number.isFinite(value) ? `, f(${variable}) = ${shown} for every ${variable}` : ''}.`,
          'Domain: all real numbers. Its graph is a horizontal line.',
          `y-intercept: (0, ${shown}). ${typeof value === 'number' && Math.abs(value) < 1e-12 ? 'It IS the x-axis, so every point is an x-intercept.' : 'It never crosses the x-axis, so there are no x-intercepts.'}`,
          'No extrema in the usual sense (every point is both a maximum and a minimum), no asymptotes, no periodicity — a constant is the same everywhere.',
        ],
        answer: `f(${variable}) = ${beautify(func)}: a constant function, equal to ${shown} for every ${variable}; its graph is the horizontal line y = ${shown}.`,
        tips: [`A constant function has derivative ${mark('0')} — its graph has slope zero everywhere.`, `For a constant ${mark('c')}, ${mark('∫c dx = c·x + C')}.`],
        common_mistakes: ['Looking for x-intercepts or turning points on a horizontal line.'],
        graph: points.length > 0 ? { points, title: `Graph of f(${variable}) = ${beautify(func)}`, description: `A horizontal line at y = ${shown}.`, annotations: { yIntercept: typeof value === 'number' ? { x: 0, y: value } : null } } : null,
      };
    }

    let Algebrite = null;
    try {
      Algebrite = await loadAlgebrite();
    } catch {
      Algebrite = null;
    }

    const features = analyzeFunction(func, variable, Algebrite);
    const steps = buildSteps(func, variable, features);
    // Plot over a wider window than the ±10 analysis so panning has room;
    // the viewer starts at ±10 and clamps to this extent.
    const points = sampleFunction(func, variable, { min: -40, max: 40, step: 0.25 });

    return {
      steps,
      answer: summarizeAnalysis(func, variable, features),
      ...functionGuidance(func, variable, features),
      graph: points.length > 0 ? {
        points,
        // The viewer re-samples a graph that carries its expression for the
        // window on screen, and opens on the window that frames the features.
        expression: func,
        variable,
        // A periodic curve opens on two full turns; anything else on its
        // features (a cubic's roots and turning points, not ±10 with the
        // shape squashed into a strip).
        initialWindow: features.isPeriodic ? { xMin: -2 * Math.PI, xMax: 2 * Math.PI } : featureWindow(featureXs(features)),
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: describeGraph(features, variable),
        // Computed features rendered as markers by GraphViewer.
        annotations: {
          extrema: [
            ...features.extrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
            // Endpoint extrema are drawn like the others; the step text carries
            // the distinction, the marker just shows where the value is.
            ...features.endpointExtrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind, endpoint: true, absolute: e.absolute })),
          ],
          intercepts: features.xIntercepts.list.map((r) => ({ x: r.numeric, y: 0 })),
          yIntercept: features.yIntercept,
          verticalAsymptotes: features.verticalAsymptotes,
          holes: features.holes.map((h) => ({ x: h.x, y: h.y })),
        },
      } : null,
      features,
    };
  } catch (error) {
    console.error('Functions solver error:', error);
    if (parsesAsMath(expression)) {
      return unsupported({
        input: expression,
        reason: 'Analyzing this function is beyond what this engine can do.',
      });
    }
    return parseError({
      input: expression,
      hint: error.message,
      tips: [`Write the function in terms of ${mark('x')}, e.g. "x^2 - 4*x + 3" or "1/(x-2)".`],
    });
  }
}

// --- feature extraction -------------------------------------------------------

function analyzeFunction(func, variable, Algebrite) {
  // "Periodic" is a claim about every x, so it is proved from the structure
  // (trig functions of linear arguments, commensurately combined), never
  // read off the presence of a sin: sin(x²)·eˣ has a sin and is not periodic.
  const isPeriodic = (structuralPeriod(func, variable) || 0) > 0;
  const provedEverywhere = definedEverywhere(func, variable);

  // Fine-grained sample of definedness across the window. Built by index with
  // rounding so grid points land EXACTLY on values like 0 — accumulating
  // x += 0.05 drifts (≈1e-13 off), which silently skips isolated undefined
  // points such as log(x^2) at x = 0.
  const grid = [];
  const steps = Math.round((WINDOW.max - WINDOW.min) / FINE_STEP);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round((WINDOW.min + i * FINE_STEP) * 100) / 100;
    grid.push({ x, y: evalAt(func, variable, x) });
  }

  const domain = findDomain(func, variable);
  const verticalAsymptotes = findVerticalAsymptotes(func, variable, grid, Algebrite);
  const holes = findHoles(func, variable, domain, verticalAsymptotes, Algebrite);
  const xIntercepts = findXIntercepts(func, variable, grid, Algebrite, isPeriodic);
  // f(0) exactly, as the extrema are: (0, 1/4), not (0, 0.25) beside a
  // local maximum (0, 1/4).
  const yIntercept = Number.isFinite(evalAt(func, variable, 0))
    ? { x: 0, y: snap(evalAt(func, variable, 0)), yText: exactValueAt(Algebrite, func, variable, '0', snap(evalAt(func, variable, 0))) }
    : null;
  let { extrema, monotonic, derivative, stationary, derivativeNeverZero } = findExtrema(func, variable, grid, Algebrite, isPeriodic);
  // Monotonic on the part of the window where f is defined — kept for the
  // endpoint reasoning below even when the global claim has to be dropped.
  const monotonicOnDomain = monotonic;
  // A global monotonicity claim is only honest on an unbroken domain — 1/(x-2)
  // decreases on each side of its asymptote but is not "decreasing on ℝ".
  if (domain.length > 0 || verticalAsymptotes.length > 0) monotonic = null;
  const endpointExtrema = findEndpointExtrema(func, variable, domain, extrema, monotonicOnDomain);
  const inflections = findInflections(func, variable, Algebrite);
  const horizontalAsymptote = findHorizontalAsymptote(func, variable);
  const quadratic = analyzeQuadratic(func, variable, Algebrite);
  const range = detectRange(func, variable, quadratic);

  return {
    range,
    domain,
    holes,
    xIntercepts,
    yIntercept,
    extrema,
    endpointExtrema,
    monotonic,
    derivative,
    stationary,
    derivativeNeverZero,
    inflections,
    verticalAsymptotes,
    horizontalAsymptote,
    isPeriodic,
    provedEverywhere,
    quadratic,
  };
}

// Exact quadratic analysis: axis of symmetry, vertex, opening direction.
function analyzeQuadratic(func, variable, Algebrite) {
  if (!Algebrite) return null;
  try {
    const coeff = (n) => {
      const raw = String(Algebrite.run(`coeff(${func}, ${variable}, ${n})`)).trim();
      const v = math.evaluate(raw);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };
    const a = coeff(2);
    if (a === null || a === 0) return null;
    const c3 = coeff(3);
    const c4 = coeff(4);
    if ((c3 !== null && c3 !== 0) || (c4 !== null && c4 !== 0)) return null; // not degree 2
    const b = coeff(1) ?? 0;
    const axis = snap(-b / (2 * a));
    const vy = evalAt(func, variable, axis);
    return { a, axis, vertex: { x: axis, y: snap(vy) }, opensUpward: a > 0 };
  } catch {
    return null;
  }
}

// The range for the families where it follows from the form alone:
//   ax + b (a ≠ 0)          all real numbers
//   a(x − h)² + k           y ≥ k (a > 0) / y ≤ k (a < 0)     [any quadratic, via the vertex]
//   a·√(linear) + k         y ≥ k / y ≤ k
//   a·|linear| + k          y ≥ k / y ≤ k
//   a/(linear) + k          y ≠ k
//   a·b^(linear) + k        y > k / y < k
//   ln(linear) + k          all real numbers
//   a·sin/cos(linear) + k   k − |a| ≤ y ≤ k + |a|
// Anything else: null, and nothing is said — a range must never be
// estimated from the visible graph window.
function detectRange(func, variable, quadratic) {
  const v = variable;
  const t = String(func).replace(/\s+/g, '');
  const fmt = (n) => formatNumber(n);
  const num = (str) => {
    if (str === undefined || str === '' || str === '+') return 1;
    if (str === '-') return -1;
    try {
      const n = math.evaluate(str.replace(/\*$/, ''));
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };
  const linearInV = (g) => new RegExp(`^[-+\\d./*]*${v}[-+\\d./*]*$|^[-+\\d./*]*$`).test(g) && new RegExp(v).test(g) && !/\^/.test(g) && !/[a-z]/i.test(g.replace(new RegExp(v, 'g'), ''));
  const COEF = '(-?(?:\\d+(?:\\.\\d+)?|\\d+/\\d+)?\\*?|-)?';
  const SHIFT = '([+-](?:\\d+(?:\\.\\d+)?|\\d+/\\d+))?';

  if (quadratic) {
    const k = quadratic.vertex.y;
    return quadratic.opensUpward
      ? { text: `y ≥ ${fmt(k)}`, why: `the parabola opens upward, so its lowest value is the vertex height ${mark(fmt(k))} and it takes every value above it.` }
      : { text: `y ≤ ${fmt(k)}`, why: `the parabola opens downward, so its highest value is the vertex height ${mark(fmt(k))} and it takes every value below it.` };
  }

  const linear = t.match(new RegExp(`^${COEF}${v}${SHIFT}$`));
  if (linear && num(linear[1]) !== 0) {
    return { text: 'all real numbers', why: 'a non-horizontal line takes every real value.' };
  }

  const halfLine = (a, k, fn) => {
    const zeroText = fn === 'sqrt' ? `the square root is ${mark('0')} at the edge of the domain and grows without bound` : `the absolute value is ${mark('0')} at its corner and grows without bound`;
    return a > 0
      ? { text: `y ≥ ${fmt(k)}`, why: `${zeroText}, so ${mark(`a·${fn === 'sqrt' ? '√(…)' : '|…|'} ${k < 0 ? '− ' + fmt(-k) : '+ ' + fmt(k)}`)} with ${mark(`a = ${fmt(a)} > 0`)} starts at ${mark(fmt(k))} and rises.` }
      : { text: `y ≤ ${fmt(k)}`, why: `${zeroText}, so ${mark(`a·${fn === 'sqrt' ? '√(…)' : '|…|'} ${k < 0 ? '− ' + fmt(-k) : '+ ' + fmt(k)}`)} with ${mark(`a = ${fmt(a)} < 0`)} starts at ${mark(fmt(k))} and falls.` };
  };
  const root = t.match(new RegExp(`^${COEF}sqrt\\(([^()]+)\\)${SHIFT}$`));
  if (root && linearInV(root[2]) && num(root[1]) !== null && num(root[1]) !== 0) return halfLine(num(root[1]), num(root[3]) === 1 && !root[3] ? 0 : num(root[3]), 'sqrt');
  const absV = t.match(new RegExp(`^${COEF}abs\\(([^()]+)\\)${SHIFT}$`));
  if (absV && linearInV(absV[2]) && num(absV[1]) !== null && num(absV[1]) !== 0) return halfLine(num(absV[1]), absV[3] ? num(absV[3]) : 0, 'abs');

  const recip = t.match(new RegExp(`^(-?(?:\\d+(?:\\.\\d+)?|\\d+/\\d+))/(?:\\(([^()]+)\\)|(${v}))${SHIFT}$`));
  if (recip && recip[3]) recip[2] = recip[3];
  if (recip && linearInV(recip[2]) && num(recip[1]) !== 0) {
    const k = recip[4] ? num(recip[4]) : 0;
    return { text: `y ≠ ${fmt(k)}`, why: `${mark('a/(…)')} is never ${mark('0')} but comes arbitrarily close, so the shifted curve takes every value except its horizontal asymptote ${mark(`y = ${fmt(k)}`)}.` };
  }

  const expo = t.match(new RegExp(`^${COEF}(\\d+(?:\\.\\d+)?|e)\\^\\(?([^()]+?)\\)?${SHIFT}$`));
  if (expo && linearInV(expo[3]) && num(expo[1]) !== null && num(expo[1]) !== 0 && expo[2] !== '1') {
    const a = num(expo[1]);
    const k = expo[4] ? num(expo[4]) : 0;
    return a > 0
      ? { text: `y > ${fmt(k)}`, why: `${mark(`${expo[2]}^u`)} is always positive and takes every positive value, so ${mark(`a·${expo[2]}^u${k === 0 ? '' : k < 0 ? ` − ${fmt(-k)}` : ` + ${fmt(k)}`}`)} with ${mark('a > 0')} stays above its asymptote ${mark(`y = ${fmt(k)}`)}.` }
      : { text: `y < ${fmt(k)}`, why: `${mark(`${expo[2]}^u`)} is always positive and takes every positive value, so ${mark(`a·${expo[2]}^u${k === 0 ? '' : k < 0 ? ` − ${fmt(-k)}` : ` + ${fmt(k)}`}`)} with ${mark('a < 0')} stays below its asymptote ${mark(`y = ${fmt(k)}`)}.` };
  }

  const logV = t.match(new RegExp(`^${COEF}(?:ln|log)\\(([^()]+)\\)${SHIFT}$`));
  if (logV && linearInV(logV[2]) && num(logV[1]) !== 0) {
    return { text: 'all real numbers', why: 'a logarithm takes every real value (→ −∞ near the edge of its domain, → +∞ as its argument grows).' };
  }

  const wave = t.match(new RegExp(`^${COEF}(sin|cos)\\(([^()]+)\\)${SHIFT}$`));
  if (wave && linearInV(wave[3]) && num(wave[1]) !== null && num(wave[1]) !== 0) {
    const a = Math.abs(num(wave[1]));
    const k = wave[4] ? num(wave[4]) : 0;
    return { text: `${fmt(k - a)} ≤ y ≤ ${fmt(k + a)}`, why: `${mark(wave[2])} swings between ${mark('−1')} and ${mark('1')}, so ${mark(`a·${wave[2]}(…) + k`)} swings between ${mark(`k − |a| = ${fmt(k - a)}`)} and ${mark(`k + |a| = ${fmt(k + a)}`)}.` };
  }
  return null;
}
