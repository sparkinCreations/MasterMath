// The analysis written out: the steps, the domain in interval notation, the
// summary answer and the graph's text description.

import { beautify, formatNumber, formatRestriction, piForm, mark } from '../solverUtils.js';
import { WINDOW, exactNumber } from './features.js';
import { fraction } from './guidance.js';

// --- presentation -------------------------------------------------------------

// x-values with = for the exact ones and ≈ for those located numerically:
// "x = −1, 1" / "x ≈ 2.4142" / "x = −1, x ≈ 2.4142" (1.64.0: e^x − 2 had
// "x = 0.6931").
export function xList(items, variable) {
  const exact = items.filter((r) => !r.approx).map((r) => r.display);
  const approx = items.filter((r) => r.approx).map((r) => r.display);
  return [exact.length ? `${variable} = ${exact.join(', ')}` : '', approx.length ? `${variable} ≈ ${approx.join(', ')}` : ''].filter(Boolean).join(', ');
}

// A point, with ≈ in front when its x was located numerically.
export function pointText(e) {
  return `${e.approx ? '≈ ' : ''}(${e.xText}, ${e.yText})`;
}

export function buildSteps(func, variable, f) {
  // A domain or range is marked as math when it is a condition (x > 0,
  // y ≠ 0), and left as words when it is "all real numbers".
  const condition = (t) => (/^all real/i.test(String(t).trim()) ? t : mark(t));
  const steps = [];
  steps.push(`Analyze the function: ${mark(`f(${variable}) = ${beautify(func)}`)}`);

  // Domain
  if (f.domain.length === 0 && f.verticalAsymptotes.length > 0) {
    // The grid never landed on the poles (tan at π/2), so no undefined
    // region was measured — but the asymptotes ARE excluded from the domain.
    steps.push(`Domain: all real numbers except where the function blows up — ${mark(`${variable} ≠ ${f.verticalAsymptotes.map((a) => formatNumber(a)).join(', ')}`)} (in the analyzed window ${mark(`${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}`)}${f.isPeriodic ? '; the pattern repeats' : ''}).`);
  } else if (f.domain.length === 0 && f.domainWhy) {
    steps.push(`Domain: all real numbers — ${f.domainWhy}`);
  } else if (f.domain.length === 0 && f.provedEverywhere) {
    // Proved from the structure: no quotient, root, log or tan to exclude
    // anything. The ±10 window is where features were searched, not the
    // domain — the two used to be run together in one sentence.
    steps.push('Domain: all real numbers — polynomials, sin, cos, eˣ and absolute values, and their sums, products and compositions, are defined for every real input.');
  } else if (f.domain.length === 0) {
    steps.push(`Domain: no restrictions found — the function is defined at every point checked for ${mark(`${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}`)} (that window is where the features below were searched; it is not a statement about the whole real line).`);
  } else {
    // "undefined for x ≤ 0" (ln: the edge itself is undefined) vs
    // "undefined for x < 2" (sqrt: defined at the edge) — the closed/open
    // flag on each region is what makes that distinction honest. Poles the
    // grid stepped over (1/sin(x) at ±π) are excluded too, from the
    // asymptote finder, so the domain line and the asymptote line agree.
    // A point inside an excluded interval is not named again (ln: "x ≤ 0 and for x = 0").
    const isPointRegion = (r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.to - r.from) < 1e-9;
    const covered = (p) => f.domain.some((r) => !isPointRegion(r) && (p > r.from + 1e-9 || (Math.abs(p - r.from) < 1e-9 && r.fromClosed)) && (p < r.to - 1e-9 || (Math.abs(p - r.to) < 1e-9 && r.toClosed)));
    const undefinedFor = f.domain.filter((r) => !(isPointRegion(r) && covered(r.from))).map((r) => markDomain(formatRestriction(r, variable))).join(' and for ');
    const extraPoles = f.verticalAsymptotes.filter((a) => !covered(a) && !f.domain.some((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.from - a) < 1e-6));
    const allowed = formatDomain(f.domain, variable, extraPoles);
    const undefinedAll = undefinedFor + (extraPoles.length ? ` and for ${extraPoles.map((a) => mark(`${variable} = ${formatNumber(a)}`)).join(', ')}` : '');
    steps.push(`Domain restriction: ${mark('f')} is undefined for ${undefinedAll} — so the domain is ${markDomain(allowed)}.`);
  }

  // Range, only for families where it is known exactly (never read off the
  // sampled window). September 2026 review, batch 3.
  if (f.range) steps.push(`Range: ${condition(f.range.text)} — ${f.range.why}`);

  // Holes (removable discontinuities) — explained, not just "undefined at".
  for (const h of f.holes) {
    const why = h.simplified
      ? ` Simplifying, f(${variable}) = ${beautify(h.simplified)} for every ${variable} ≠ ${formatNumber(h.x)}: a common factor cancels, but the original is still undefined at ${variable} = ${formatNumber(h.x)}.`
      : '';
    steps.push(`Hole (removable discontinuity) at ${mark(`(${formatNumber(h.x)}, ${h.yText ?? formatNumber(h.y)})`)}: the function is undefined at ${mark(`${variable} = ${formatNumber(h.x)}`)}, but it does not blow up there — the graph is a single point short of continuous.${why}`);
  }

  // Quadratic-specific insights (exact)
  if (f.quadratic) {
    steps.push(`This is a quadratic (parabola). Leading coefficient ${mark(`a = ${formatNumber(f.quadratic.a)}`)}, so it opens ${f.quadratic.opensUpward ? 'upward' : 'downward'}.`);
    steps.push(`Axis of symmetry: ${mark(`${variable} = −b/(2a) = ${exactNumber(f.quadratic.axis)}`)}.`);
    steps.push(`Vertex: ${mark(`(${exactNumber(f.quadratic.vertex.x)}, ${exactNumber(f.quadratic.vertex.y)})`)} — the ${f.quadratic.opensUpward ? 'minimum' : 'maximum'} point.`);
  }

  // Intercepts
  if (f.yIntercept) {
    const y0 = f.yIntercept.yText ?? formatNumber(f.yIntercept.y);
    steps.push(`y-intercept: ${mark(`f(0) = ${y0}`)}, so the graph crosses the y-axis at ${mark(`(0, ${y0})`)}.`);
  } else if (variable === 'x' || variable) {
    const holeAt0 = f.holes.find((h) => Math.abs(h.x) < 1e-12);
    steps.push(`y-intercept: none — ${mark(`${variable} = 0`)} is not in the domain${holeAt0 ? `; the graph approaches ${mark(`(0, ${holeAt0.yText ?? formatNumber(holeAt0.y)})`)} without containing it` : ''}.`);
  }
  if (f.absWave) {
    steps.push(`x-intercepts: ${mark(`|${f.absWave.inside}| = 0`)} exactly where ${mark(`${f.absWave.inside} = 0`)}, so ${mark(`${variable} = ${f.absWave.zeros}`)} (${mark('n')} any integer). The graph touches the axis there without crossing.`);
  } else if (f.waveZeros) {
    steps.push(`x-intercepts: the numerator is ${mark('0')} at ${mark(`${variable} = ${f.waveZeros.text}`)}, but the function is undefined where the denominator is ${mark('0')} too, so ${mark(`${variable} = ${f.waveZeros.text}`)} (${mark('n')} ${f.waveZeros.which ?? 'any integer'}).`);
  } else if (f.wave) {
    const w = f.wave;
    if (w.intercepts.none) steps.push(`x-intercepts: none — ${mark(`f(${variable}) = 0`)} needs ${mark(w.equation)}, and ${w.fn} never leaves ${mark('[−1, 1]')}.`);
    else steps.push(`x-intercepts: ${mark(`f(${variable}) = 0`)} when ${mark(w.equation)}, so ${mark(`${variable} = ${w.intercepts.text}`)} (${mark('n')} any integer)${w.intercepts.approxText ? `, that is ${mark(`${variable} ≈ ${w.intercepts.approxText}`)}` : ''}${w.intercepts.touches ? ': the graph touches the axis there without crossing' : ''}.`);
  } else if (f.xIntercepts.list.length > 0) {
    steps.push(`x-intercept${f.xIntercepts.list.length > 1 ? 's' : ''}: ${mark(xList(f.xIntercepts.list, variable))}${f.xIntercepts.truncated ? ' (and more outside the window: the list continues)' : ''}.`);
  } else {
    steps.push('x-intercepts: none — the graph never crosses the x-axis.');
  }

  // Extrema / monotonicity (skip generic extrema line for quadratics — vertex already stated)
  if (!f.quadratic) {
    // The method, shown: differentiate, set f′ = 0, read the sign change.
    const fPrime = `f′(${variable})`;
    if (f.derivative) {
      const d = mark(`${fPrime} = ${f.derivative}`);
      const stationaryXs = f.extrema.filter((e) => e.origin === 'stationary');
      if (f.stationary.length > 0) {
        steps.push(`Differentiate: ${d}. Set ${mark(`${fPrime} = 0`)}: ${mark(`${f.derivative} = 0`)} at ${mark(`${variable} = ${f.stationary.map((r) => r.display).join(', ')}`)}.`);
        const saddles = f.stationary.filter((r) => !f.extrema.some((e) => Math.abs(e.x - r.numeric) < 1e-6));
        if (saddles.length > 0) {
          steps.push(`At ${mark(`${variable} = ${saddles.map((r) => r.display).join(', ')}`)} ${mark(fPrime)} is 0 but does not change sign, so there is no extremum there: the graph flattens and carries on.`);
        }
      } else if (stationaryXs.length > 0) {
        steps.push(`Differentiate: ${d}. ${mark(fPrime)} is 0 at ${mark(xList(stationaryXs.map((e) => ({ display: e.xText, approx: e.approx })), variable))} (found where the slope changes sign${stationaryXs.some((e) => e.approx) ? ', and located numerically' : ''}).`);
      } else if (f.derivativeNeverZero) {
        steps.push(`Differentiate: ${d}. ${mark(fPrime)} is never 0 (${f.derivativeNeverZero.why}), so there are no stationary points${f.monotonic ? `: ${mark('f')} is strictly ${f.monotonic}` : ''}.`);
      } else {
        steps.push(`Differentiate: ${d}.`);
      }
    }
    if (f.wave) {
      const w = f.wave;
      steps.push(`Maxima: ${mark(`${w.fn} = ${w.coef > 0 ? '1' : '−1'}`)} at ${mark(`${variable} = ${w.maxima.x}`)}, where ${mark(`f = ${w.maxima.y}`)}. Minima: ${mark(`${w.fn} = ${w.coef > 0 ? '−1' : '1'}`)} at ${mark(`${variable} = ${w.minima.x}`)}, where ${mark(`f = ${w.minima.y}`)} (${mark('n')} any integer). The period is ${mark(w.period)}.`);
    } else if (f.absWave) {
      steps.push(`Maxima: ${mark(`|${f.absWave.inside}| = ${f.absWave.maxima.y}`)} at ${mark(`${variable} = ${f.absWave.maxima.x}`)}. Minima: ${mark('0')} at the corners ${mark(`${variable} = ${f.absWave.zeros}`)} (${mark('n')} any integer). The period is ${mark(f.absWave.period)}.`);
    } else if (f.extrema.length > 0) {
      if (f.extremaInWindow) steps.push(`Local extrema found in the analysed window ${mark(`${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}`)} (there may be more outside it):`);
      for (const e of f.extrema) {
        const name = e.kind === 'max' ? 'maximum' : 'minimum';
        const point = mark(pointText(e));
        if (e.origin === 'cusp') {
          steps.push(`Local ${name} at ${point} — at a corner/cusp: ${mark(fPrime)} does not exist there (the slopes on either side disagree), yet it is still a critical point and an extremum. Not a stationary point: this does NOT come from ${mark(`${fPrime} = 0`)}.`);
        } else {
          steps.push(`Local ${name} at ${point}: ${mark(fPrime)} changes from ${e.kind === 'max' ? 'positive to negative' : 'negative to positive'} there${f.derivative ? '' : ` (${mark(`${fPrime} = 0`)})`}.`);
        }
      }
    } else if (f.derivativeNeverZero) {
      // Said with the derivative above.
    } else if (f.monotonic) {
      steps.push(`No local extrema — the function is strictly ${f.monotonic} across the window.`);
    } else if (f.endpointExtrema.length === 0 && !f.isPeriodic) {
      steps.push(`No local extrema found in the analyzed window${f.derivative ? ` (no zero of ${mark(fPrime)} was found there)` : ''}.`);
    }
    // Endpoint extrema are reported in their own words: they are where the
    // function starts or stops, not two-sided local extrema.
    for (const e of f.endpointExtrema) {
      const name = e.kind === 'max' ? 'maximum' : 'minimum';
      const which = e.absolute ? `absolute ${name}` : name;
      const begins = e.side === +1;
      // min where the graph begins ⇒ f increases from it; max where it
      // begins ⇒ decreases from it; min where it ends ⇒ f decreases toward
      // it; max where it ends ⇒ increases toward it.
      const dir = (e.kind === 'min') === begins ? 'increasing' : 'decreasing';
      steps.push(`${which.charAt(0).toUpperCase() + which.slice(1)} at the domain endpoint ${mark(`(${formatNumber(e.x)}, ${formatNumber(e.y)})`)}: ${mark('f')} is undefined ${begins ? 'to the left' : 'to the right'}, so this is where the graph ${begins ? 'begins' : 'ends'}${e.absolute ? ` — and since ${mark('f')} is ${dir} ${begins ? 'from' : 'toward'} there, no other value is ${e.kind === 'min' ? 'lower' : 'higher'}` : ''}. There is no stationary point here (${mark('f′ ≠ 0')}); the extremum comes from the edge of the domain.`);
    }
  }

  // Inflection points
  if (f.inflections.length > 0) {
    steps.push(`Inflection point${f.inflections.length > 1 ? 's' : ''} (concavity changes): ${mark(`${variable} = ${f.inflections.map((i) => i.display).join(', ')}`)}.`);
  }

  // Asymptotes
  if (f.verticalAsymptotes.length > 0) {
    steps.push(`Vertical asymptote${f.verticalAsymptotes.length > 1 ? 's' : ''}: ${mark(f.verticalAsymptotes.map((a) => `${variable} = ${formatNumber(a)}`).join(', '))} — the function blows up there.`);
  }
  if (f.horizontalAsymptote !== null && typeof f.horizontalAsymptote === 'number') {
    steps.push(`Horizontal asymptote: ${mark(`y = ${formatNumber(f.horizontalAsymptote)}`)} as ${mark(`${variable} → ±∞`)}.`);
  } else if (f.horizontalAsymptote && typeof f.horizontalAsymptote === 'object') {
    // One side only: eˣ − 2 levels off at −2 as x → −∞ (it was left out).
    for (const [side, y] of [['−∞', f.horizontalAsymptote.left], ['∞', f.horizontalAsymptote.right]]) {
      if (y !== null && y !== undefined) steps.push(`Horizontal asymptote: ${mark(`y = ${formatNumber(y)}`)} as ${mark(`${variable} → ${side}`)} only.`);
    }
  }

  if (f.slant) {
    steps.push(`Slant asymptote: ${mark(`y = ${f.slant.line}`)}. The top's degree is one more than the bottom's, so divide: ${mark(`f(${variable}) = ${f.slant.line} + ${fraction(f.slant.remainder, f.slant.den)}`)}, and the fraction ${mark('→ 0')} as ${mark(`${variable} → ±∞`)}.`);
  }
  if (f.isPeriodic) {
    steps.push('This is a periodic function — its pattern of zeros and extrema repeats forever.');
  }

  steps.push('Plot the points and sketch the graph using these features.');
  return steps;
}

// Allowed-set wording for a list of undefined regions. Two one-sided
// restrictions that bound an interval read as one: "-3 ≤ x ≤ 3", not
// "x ≥ -3 and x ≤ 3".
function formatDomain(domain, variable, extraPoints = []) {
  const isPoint = (r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.to - r.from) < 1e-9;
  const left = domain.find((r) => !Number.isFinite(r.from) && Number.isFinite(r.to));
  const right = domain.find((r) => Number.isFinite(r.from) && !Number.isFinite(r.to));
  const others = domain.filter((r) => r !== left && r !== right && !isPoint(r));
  // A point already outside an interval restriction adds nothing: log(x)^2
  // is undefined for x ≤ 0, and "x > 0 and x ≠ 0" says the same thing twice.
  const intervals = domain.filter((r) => !isPoint(r));
  const alreadyExcluded = (p) => intervals.some((r) =>
    (p > r.from + 1e-9 && p < r.to - 1e-9)
    || (Math.abs(p - r.from) < 1e-9 && r.fromClosed)
    || (Math.abs(p - r.to) < 1e-9 && r.toClosed));
  const points = [...domain.filter(isPoint).map((r) => r.from), ...extraPoints]
    .filter((v, i, arr) => arr.findIndex((w) => Math.abs(w - v) < 1e-6) === i)
    .filter((v) => !alreadyExcluded(v))
    .sort((a, b) => a - b);
  const parts = [];
  if (left && right && others.length === 0) {
    parts.push(`${formatNumber(left.to)} ${left.toClosed ? '<' : '≤'} ${variable} ${right.fromClosed ? '<' : '≤'} ${formatNumber(right.from)}`);
  } else {
    for (const r of domain) if (!isPoint(r)) parts.push(formatRestriction(r, variable, { allowed: true }));
  }
  // Excluded points read as one list: "x ≠ -π, 0, π", not a chain of "and".
  if (points.length) parts.push(`${variable} ≠ ${points.map((v) => formatNumber(v)).join(', ')}`);
  const isolated = intervals.flatMap((r) => r.isolated || []);
  const examples = isolated.slice(-3).reverse().map((v) => formatNumber(v)).join(', ');
  // (-2)^x: no interval at all, only isolated points.
  if (intervals.length === 1 && !Number.isFinite(intervals[0].from) && !Number.isFinite(intervals[0].to) && isolated.length) {
    return `only isolated points (such as ${variable} = ${examples}) — no interval of real numbers`;
  }
  const note = isolated.length ? ` (plus isolated points such as ${variable} = ${examples})` : '';
  return parts.join(' and ') + note;
}

// Each condition of a domain marked on its own, the words between them left
// as prose: one run around "x = -2 and for x = 2" set "and for" in math
// italics (October 25 review).
function markDomain(text) {
  const t = String(text);
  if (/^(?:all|no) real/i.test(t.trim())) return t;
  const only = t.match(/^only isolated points \(such as (.+)\) — (.+)$/);
  if (only) return `only isolated points (such as ${mark(only[1])}) — ${only[2]}`;
  const [main, note] = t.split(/ (?=\(plus isolated points such as )/);
  const marked = main.split(' and ').map((c) => (/^not /.test(c) ? `not ${mark(c.slice(4))}` : mark(c))).join(' and ');
  return note ? `${marked} ${note.replace(/such as (.+)\)$/, (m, v) => `such as ${mark(v)})`)}` : marked;
}

// Every x at which the analysis found something — the window to open on.
export function featureXs(f) {
  const xs = [];
  const push = (v) => { if (Number.isFinite(v)) xs.push(v); };
  for (const e of f.extrema) push(e.x);
  for (const e of f.endpointExtrema) push(e.x);
  for (const r of f.xIntercepts.list) push(r.numeric);
  if (f.yIntercept) push(0);
  for (const h of f.holes) push(h.x);
  for (const a of f.verticalAsymptotes) push(a);
  for (const i of f.inflections) push(i.x);
  if (f.quadratic) push(f.quadratic.vertex.x);
  return xs;
}


// Three or more evenly spaced values → their general form, "x = π/2 + nπ" or
// "x = nπ" (n any integer). Null when they are not evenly spaced. Listing
// six asymptotes and seven intercepts to four decimals made the tangent
// answer a wall of numbers; the pattern is the answer.
function generalForm(values, variable) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length < 3) return null;
  const d = sorted[1] - sorted[0];
  if (!(d > 1e-9)) return null;
  for (let i = 2; i < sorted.length; i += 1) {
    if (Math.abs(sorted[i] - sorted[i - 1] - d) > 1e-6) return null;
  }
  let a0 = sorted.find((v) => v >= -1e-9);
  if (a0 === undefined) a0 = sorted[sorted.length - 1];
  const dText = piForm(d) || formatNumber(d);
  const stepText = dText.startsWith('π') ? `n${dText}` : `n·${dText}`;
  if (Math.abs(a0) < 1e-9) return `${variable} = ${stepText}`;
  const aText = piForm(a0) || formatNumber(a0);
  return `${variable} = ${aText} + ${stepText}`;
}

// The "Final Answer" of a function analysis is the analysis, not the input
// echoed back. One line, the useful findings in reading order: domain, then
// intercepts, then the shape (vertex / extrema / holes / asymptotes). Only
// features that were actually established appear — nothing is padded in.
export function summarizeAnalysis(func, variable, f) {
  const parts = [];
  const pt = (x, y) => `(${formatNumber(x)}, ${formatNumber(y)})`;

  const asymptotePattern = f.isPeriodic ? generalForm(f.verticalAsymptotes, variable) : null;
  const interceptPattern = f.isPeriodic ? generalForm(f.xIntercepts.list.map((r) => r.numeric), variable) : null;
  if (f.domain.length === 0 && asymptotePattern) parts.push(`domain: all real numbers except ${asymptotePattern} (n any integer)`);
  else if (f.domain.length === 0 && f.verticalAsymptotes.length > 0) parts.push(`domain: all real numbers except ${variable} = ${f.verticalAsymptotes.map((a) => formatNumber(a)).join(', ')}${f.isPeriodic ? ' (repeating)' : ''}`);
  else if (f.domain.length === 0) parts.push(f.provedEverywhere ? 'domain: all real numbers' : 'domain: no restrictions found');
  else {
    const extraPoles = f.verticalAsymptotes.filter((a) => !f.domain.some((r) => Number.isFinite(r.from) && Number.isFinite(r.to) && Math.abs(r.from - a) < 1e-6));
    parts.push(`domain: ${formatDomain(f.domain, variable, extraPoles)}`);
  }

  if (f.range) parts.push(`range: ${f.range.text}`);
  if (f.yIntercept) parts.push(`y-intercept (0, ${f.yIntercept.yText ?? formatNumber(f.yIntercept.y)})`);
  else parts.push('no y-intercept');
  if (f.absWave) {
    parts.push(`x-intercepts at ${variable} = ${f.absWave.zeros}`);
  } else if (f.waveZeros) {
    parts.push(`x-intercepts at ${variable} = ${f.waveZeros.text}${f.waveZeros.which ? ` (n ${f.waveZeros.which})` : ''}`);
  } else if (f.wave) {
    parts.push(f.wave.intercepts.none ? 'no x-intercepts' : `x-intercepts at ${variable} = ${f.wave.intercepts.text}${f.wave.intercepts.approxText ? ` (≈ ${f.wave.intercepts.approxText})` : ''}`);
  } else if (interceptPattern) {
    parts.push(`x-intercepts at ${interceptPattern}`);
  } else if (f.xIntercepts.list.length > 0) {
    parts.push(`x-intercept${f.xIntercepts.list.length > 1 ? 's' : ''} at ${xList(f.xIntercepts.list, variable)}${f.xIntercepts.truncated ? ', …' : ''}`);
  } else if (!f.isPeriodic) {
    parts.push('no x-intercepts');
  }

  if (f.quadratic) {
    parts.push(`vertex (${exactNumber(f.quadratic.vertex.x)}, ${exactNumber(f.quadratic.vertex.y)}) (${f.quadratic.opensUpward ? 'minimum' : 'maximum'}), axis ${variable} = ${exactNumber(f.quadratic.axis)}`);
  } else {
    if (f.absWave) {
      parts.push(`maxima at ${variable} = ${f.absWave.maxima.x} (value ${f.absWave.maxima.y}), minima at ${variable} = ${f.absWave.zeros} (value 0), period ${f.absWave.period} (n any integer)`);
    } else if (f.wave) {
      parts.push(`maxima at ${variable} = ${f.wave.maxima.x} (value ${f.wave.maxima.y}), minima at ${variable} = ${f.wave.minima.x} (value ${f.wave.minima.y}), period ${f.wave.period} (n any integer)`);
    } else {
      const listed = f.extrema.map((e) => `local ${e.kind === 'max' ? 'maximum' : 'minimum'} ${pointText(e)}${e.origin === 'cusp' ? ' (cusp)' : ''}`);
      if (f.extremaInWindow && listed.length) parts.push(`in ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}: ${listed.join(', ')}`);
      else parts.push(...listed);
    }
    for (const e of f.endpointExtrema) {
      parts.push(`${e.absolute ? 'absolute ' : ''}${e.kind === 'max' ? 'maximum' : 'minimum'} ${pt(e.x, e.y)} at the domain endpoint`);
    }
    if (f.extrema.length === 0 && f.endpointExtrema.length === 0 && f.monotonic) parts.push(`strictly ${f.monotonic}, no extrema`);
  }

  for (const h of f.holes) parts.push(`hole at (${formatNumber(h.x)}, ${h.yText ?? formatNumber(h.y)})`);
  if (asymptotePattern) parts.push(`vertical asymptotes at ${asymptotePattern}`);
  else if (f.verticalAsymptotes.length > 0) parts.push(`vertical asymptote${f.verticalAsymptotes.length > 1 ? 's' : ''} ${f.verticalAsymptotes.map((a) => `${variable} = ${formatNumber(a)}`).join(', ')}`);
  if (typeof f.horizontalAsymptote === 'number') parts.push(`horizontal asymptote y = ${formatNumber(f.horizontalAsymptote)}`);
  else if (f.horizontalAsymptote && typeof f.horizontalAsymptote === 'object') {
    if (f.horizontalAsymptote.left != null) parts.push(`horizontal asymptote y = ${formatNumber(f.horizontalAsymptote.left)} as ${variable} → −∞`);
    if (f.horizontalAsymptote.right != null) parts.push(`horizontal asymptote y = ${formatNumber(f.horizontalAsymptote.right)} as ${variable} → ∞`);
  }
  if (f.slant) parts.push(`slant asymptote y = ${f.slant.line}`);
  if (f.inflections.length > 0) parts.push(`inflection at ${variable} = ${f.inflections.map((i) => i.display).join(', ')}`);
  if (f.isPeriodic) parts.push('periodic');

  return `f(${variable}) = ${beautify(func)}: ${parts.join('; ')}.`;
}

export function describeGraph(f, variable) {
  // The marked features themselves are listed (and read aloud) from the
  // graph's own "Key features" panel, generated from the annotations. This
  // line is what that panel does NOT say: the overall shape, and where it
  // was analysed. Repeating the feature list here in different words made
  // the two panels contradict each other in wording.
  const shape = f.quadratic
    ? `A parabola opening ${f.quadratic.opensUpward ? 'upward' : 'downward'}.`
    : f.isPeriodic
      ? 'A periodic curve — the pattern repeats beyond the window.'
      : f.monotonic
        ? `Strictly ${f.monotonic} across the window.`
        : f.verticalAsymptotes.length > 0
          ? 'The curve breaks at its vertical asymptote' + (f.verticalAsymptotes.length > 1 ? 's' : '') + '.'
          : '';
  return `${shape ? shape + ' ' : ''}Analysed over ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}; use the pan and zoom controls to see more.`.trim();
}
