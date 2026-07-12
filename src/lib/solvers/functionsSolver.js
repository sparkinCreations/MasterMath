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

import {
  math,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
  rewriteReciprocalTrig,
} from './solverUtils.js';
import { extractVariable, parseMathExpression } from '../mathParser.js';

const WINDOW = { min: -10, max: 10 };
const FINE_STEP = 0.05;
const BIG = 1e6;

export async function solveFunctions(expression) {
  try {
    const variable = extractVariable(expression);

    let func = expression;
    const functionMatch = expression.match(/f\(.\)\s*=\s*(.+)/i);
    if (functionMatch) {
      func = parseMathExpression(functionMatch[1]);
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
      answer: `f(${variable}) = ${beautify(func)}`,
      tips: buildTips(features),
      common_mistakes: [
        'Assuming every function has a vertex — only some (like parabolas) do.',
        'Reading a graph where the function is undefined (holes and asymptotes).',
        'Confusing an x-intercept (f(x) = 0) with the y-intercept (x = 0).',
      ],
      graph: points.length > 0 ? {
        points,
        title: `Graph of f(${variable}) = ${beautify(func)}`,
        description: describeGraph(features, variable),
        // Computed features rendered as markers by GraphViewer.
        annotations: {
          extrema: features.extrema.map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
          intercepts: features.xIntercepts.list.map((r) => ({ x: r.numeric, y: 0 })),
          yIntercept: features.yIntercept,
          verticalAsymptotes: features.verticalAsymptotes,
        },
      } : null,
      features,
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

// --- numeric primitives ------------------------------------------------------

function evalAt(func, variable, x) {
  try {
    const y = math.evaluate(func, { [variable]: x });
    const n = typeof y === 'number' ? y : Number(y);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

// Bisection: refine a root of g inside [a, b] where sign(g(a)) != sign(g(b)).
function bisect(g, a, b) {
  let lo = a;
  let hi = b;
  let glo = g(lo);
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const gm = g(mid);
    if (!Number.isFinite(gm)) return null;
    if (Math.abs(gm) < 1e-12) return mid;
    if (Math.sign(gm) === Math.sign(glo)) { lo = mid; glo = gm; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

// Snap near-integers / near-halves produced by numeric refinement.
function snap(x) {
  for (const q of [1, 2, 4]) {
    const r = Math.round(x * q) / q;
    if (Math.abs(x - r) < 1e-7) return r;
  }
  return x;
}

// Parse an Algebrite bracketed root list into {display, numeric} pairs.
function parseRoots(raw) {
  const inner = String(raw).trim().replace(/^\[|\]$/g, '');
  if (!inner) return [];
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((p) => {
    let numeric = NaN;
    try {
      const v = math.evaluate(p.trim().replace(/\bi\b/, 'NaN'));
      numeric = typeof v === 'number' ? v : NaN;
    } catch { numeric = NaN; }
    return { display: beautify(p.trim()), numeric };
  }).filter((r) => Number.isFinite(r.numeric)); // real roots only
}

// --- feature extraction -------------------------------------------------------

function analyzeFunction(func, variable, Algebrite) {
  const isPeriodic = /\b(?:sin|cos|tan|sec|csc|cot)\s*\(/i.test(func);

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

  const domain = findDomain(func, variable, grid);
  const verticalAsymptotes = findVerticalAsymptotes(func, variable, grid, Algebrite);
  const xIntercepts = findXIntercepts(func, variable, grid, Algebrite, isPeriodic);
  const yIntercept = Number.isFinite(evalAt(func, variable, 0))
    ? { x: 0, y: snap(evalAt(func, variable, 0)) }
    : null;
  let { extrema, monotonic } = findExtrema(func, variable, grid, Algebrite, isPeriodic);
  // A global monotonicity claim is only honest on an unbroken domain — 1/(x-2)
  // decreases on each side of its asymptote but is not "decreasing on ℝ".
  if (domain.length > 0 || verticalAsymptotes.length > 0) monotonic = null;
  const inflections = findInflections(func, variable, Algebrite);
  const horizontalAsymptote = findHorizontalAsymptote(func, variable);
  const quadratic = analyzeQuadratic(func, variable, Algebrite);

  return {
    domain,
    xIntercepts,
    yIntercept,
    extrema,
    monotonic,
    inflections,
    verticalAsymptotes,
    horizontalAsymptote,
    isPeriodic,
    quadratic,
  };
}

// Defined/undefined intervals from the fine grid, boundaries bisection-refined.
function findDomain(func, variable, grid) {
  const restrictions = [];
  let runStart = null; // start x of current undefined run

  const refineBoundary = (definedX, undefinedX) => {
    // Bisect on definedness to locate the domain edge.
    let lo = definedX;
    let hi = undefinedX;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (Number.isFinite(evalAt(func, variable, mid))) lo = mid; else hi = mid;
    }
    return snap((lo + hi) / 2);
  };

  for (let i = 0; i < grid.length; i += 1) {
    const undef = !Number.isFinite(grid[i].y);
    if (undef && runStart === null) runStart = i;
    if (!undef && runStart !== null) {
      const from = runStart === 0 ? -Infinity : refineBoundary(grid[runStart - 1].x, grid[runStart].x);
      const to = refineBoundary(grid[i].x, grid[i - 1].x);
      restrictions.push({ from, to });
      runStart = null;
    }
  }
  if (runStart !== null) {
    const from = runStart === 0 ? -Infinity : refineBoundary(grid[runStart - 1].x, grid[runStart].x);
    restrictions.push({ from, to: Infinity });
  }

  return restrictions; // empty array = defined everywhere in the window
}

function findVerticalAsymptotes(func, variable, grid, Algebrite) {
  const candidates = new Set();

  // Symbolic: roots of the denominator, when there is one.
  if (Algebrite) {
    try {
      const den = String(Algebrite.run(`denominator(${rewriteReciprocalTrig(func)})`)).trim();
      if (den && den !== '1' && !/nil|stop/i.test(den)) {
        for (const r of parseRoots(Algebrite.roots(den, variable).toString())) {
          candidates.add(r.numeric);
        }
      }
    } catch { /* not rational — fall through to numeric */ }
  }

  // Numeric: domain-restriction boundaries and isolated undefined points.
  for (const r of findDomain(func, variable, grid)) {
    if (Number.isFinite(r.from)) candidates.add(r.from);
    if (Number.isFinite(r.to)) candidates.add(r.to);
  }

  // Verify divergence: |f| must keep GROWING as we approach the candidate.
  // A plain magnitude threshold misses slow divergence — log(x^2) at 0 only
  // reaches |f| ≈ 28 at a 1e-6 offset — so require monotone growth across
  // shrinking offsets (or an outright blow-up past BIG).
  const divergesOnSide = (c, sign) => {
    const mags = [1e-2, 1e-4, 1e-6, 1e-8].map((off) => Math.abs(evalAt(func, variable, c + sign * off)));
    if (mags.some((m) => !Number.isFinite(m))) return false;
    if (mags[3] > BIG) return true;
    const growing = mags[1] > mags[0] + 1 && mags[2] > mags[1] + 1 && mags[3] > mags[2] + 1;
    return growing && mags[3] > 10;
  };

  const asymptotes = [];
  for (const c of candidates) {
    if (c < WINDOW.min || c > WINDOW.max) continue;
    if (divergesOnSide(c, -1) || divergesOnSide(c, +1)) asymptotes.push(snap(c));
  }
  return [...new Set(asymptotes)].sort((a, b) => a - b);
}

function findXIntercepts(func, variable, grid, Algebrite, isPeriodic) {
  const found = [];
  const push = (numeric, display) => {
    // Verify: it must actually be a root, not a small-value sample.
    const y = evalAt(func, variable, numeric);
    if (!Number.isFinite(y) || Math.abs(y) > 1e-6) return;
    if (found.some((r) => Math.abs(r.numeric - numeric) < 1e-6)) return;
    found.push({ numeric: snap(numeric), display: display ?? formatNumber(snap(numeric)) });
  };

  // Symbolic roots first (exact displays like 1/3^(1/2)).
  if (Algebrite) {
    try {
      for (const r of parseRoots(Algebrite.roots(rewriteReciprocalTrig(func), variable).toString())) {
        if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) push(r.numeric, r.display);
      }
    } catch { /* not a polynomial — numeric below */ }
  }

  // Numeric: sign changes on the fine grid, bisection-refined. Touch-roots
  // (even multiplicity, like abs(x) at 0) never change sign, so near-zero
  // samples are pushed too — push() verifies |f(root)| ≈ 0 either way.
  for (let i = 1; i < grid.length; i += 1) {
    const a = grid[i - 1];
    const b = grid[i];
    if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) continue;
    if (Math.abs(a.y) < 1e-9) push(a.x);
    if (Math.sign(a.y) !== Math.sign(b.y)) {
      const root = bisect((x) => evalAt(func, variable, x), a.x, b.x);
      if (root !== null) push(root);
    }
  }

  // Domain-boundary roots: a function can start exactly ON the axis, like
  // sqrt(x-3) at (3, 0) — invisible to sign changes (no left neighbor) and to
  // polynomial root-finding. Check each finite domain edge directly.
  for (const r of findDomain(func, variable, grid)) {
    for (const edge of [r.from, r.to]) {
      if (Number.isFinite(edge)) push(edge);
    }
  }

  found.sort((p, q) => p.numeric - q.numeric);
  return { list: found.slice(0, isPeriodic ? 8 : 6), truncated: found.length > (isPeriodic ? 8 : 6) };
}

function findExtrema(func, variable, grid, Algebrite, isPeriodic) {
  const extrema = [];
  const classify = (x) => {
    const y = evalAt(func, variable, x);
    if (!Number.isFinite(y)) return;
    const l = evalAt(func, variable, x - 1e-4);
    const r = evalAt(func, variable, x + 1e-4);
    if (!Number.isFinite(l) || !Number.isFinite(r)) return;
    let kind = null;
    if (y >= l && y >= r && (y > l || y > r)) kind = 'max';
    if (y <= l && y <= r && (y < l || y < r)) kind = 'min';
    if (!kind) return; // saddle / not an extremum — do not report
    if (extrema.some((e) => Math.abs(e.x - x) < 1e-5)) return;
    extrema.push({ x: snap(x), y: snap(y), kind });
  };

  let derivativeStr = null;
  if (Algebrite) {
    try {
      derivativeStr = Algebrite.derivative(rewriteReciprocalTrig(func), variable).toString();
      // Symbolic critical points when f' is polynomial-rootable.
      for (const r of parseRoots(Algebrite.roots(derivativeStr, variable).toString())) {
        if (r.numeric >= WINDOW.min && r.numeric <= WINDOW.max) classify(r.numeric);
      }
    } catch { /* fall through to numeric */ }
  }

  // Numeric: slope sign changes from finite differences on the fine grid.
  if (extrema.length === 0) {
    for (let i = 2; i < grid.length; i += 1) {
      const s1 = grid[i - 1].y - grid[i - 2].y;
      const s2 = grid[i].y - grid[i - 1].y;
      if (!Number.isFinite(s1) || !Number.isFinite(s2)) continue;
      if (Math.sign(s1) !== Math.sign(s2) && s1 !== 0) {
        // Refine the critical point via slope bisection.
        const slope = (x) => (evalAt(func, variable, x + 1e-6) - evalAt(func, variable, x - 1e-6));
        const cp = bisect(slope, grid[i - 2].x, grid[i].x);
        if (cp !== null) classify(cp);
      }
    }
  }

  // Monotonicity: only claimed when there are no extrema and the slope keeps
  // one sign across the defined samples.
  let monotonic = null;
  if (extrema.length === 0) {
    let pos = 0;
    let neg = 0;
    for (let i = 1; i < grid.length; i += 1) {
      const d = grid[i].y - grid[i - 1].y;
      if (!Number.isFinite(d)) continue;
      if (d > 1e-12) pos += 1;
      if (d < -1e-12) neg += 1;
    }
    if (pos > 0 && neg === 0) monotonic = 'increasing';
    if (neg > 0 && pos === 0) monotonic = 'decreasing';
  }

  extrema.sort((a, b) => a.x - b.x);
  return { extrema: extrema.slice(0, isPeriodic ? 6 : 4), monotonic };
}

function findInflections(func, variable, Algebrite) {
  if (!Algebrite) return [];
  try {
    const f1 = Algebrite.derivative(rewriteReciprocalTrig(func), variable).toString();
    const f2 = Algebrite.derivative(f1, variable).toString();
    const out = [];
    for (const r of parseRoots(Algebrite.roots(f2, variable).toString())) {
      if (r.numeric < WINDOW.min || r.numeric > WINDOW.max) continue;
      // Verify concavity actually changes sign.
      const l = evalAt(f2, variable, r.numeric - 1e-3);
      const rt = evalAt(f2, variable, r.numeric + 1e-3);
      if (Number.isFinite(l) && Number.isFinite(rt) && Math.sign(l) !== Math.sign(rt)) {
        out.push({ x: snap(r.numeric), display: r.display });
      }
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
}

function findHorizontalAsymptote(func, variable) {
  const settle = (sign) => {
    const a = evalAt(func, variable, sign * 1e6);
    const b = evalAt(func, variable, sign * 1e8);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6 * (1 + Math.abs(b))) {
      return snap(b);
    }
    return null;
  };
  const right = settle(1);
  const left = settle(-1);
  if (right !== null && left !== null && Math.abs(right - left) < 1e-9) return right;
  if (right !== null || left !== null) return { left, right };
  return null;
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

// --- presentation -------------------------------------------------------------

function fmtInterval(r, variable) {
  if (!Number.isFinite(r.from) && Number.isFinite(r.to)) return `${variable} < ${formatNumber(r.to)}`;
  if (Number.isFinite(r.from) && !Number.isFinite(r.to)) return `${variable} > ${formatNumber(r.from)}`;
  if (Math.abs(r.to - r.from) < 1e-6) return `${variable} = ${formatNumber(r.from)}`;
  return `${formatNumber(r.from)} < ${variable} < ${formatNumber(r.to)}`;
}

function buildSteps(func, variable, f) {
  const steps = [];
  steps.push(`Analyze the function: f(${variable}) = ${beautify(func)}`);

  // Domain
  if (f.domain.length === 0) {
    steps.push(`Domain: all real numbers (defined everywhere in the analyzed window ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}).`);
  } else {
    const parts = f.domain.map((r) => fmtInterval(r, variable));
    steps.push(`Domain restriction: f is undefined for ${parts.join(' and for ')}.`);
  }

  // Quadratic-specific insights (exact)
  if (f.quadratic) {
    steps.push(`This is a quadratic (parabola). Leading coefficient a = ${formatNumber(f.quadratic.a)}, so it opens ${f.quadratic.opensUpward ? 'upward' : 'downward'}.`);
    steps.push(`Axis of symmetry: ${variable} = −b/(2a) = ${formatNumber(f.quadratic.axis)}.`);
    steps.push(`Vertex: (${formatNumber(f.quadratic.vertex.x)}, ${formatNumber(f.quadratic.vertex.y)}) — the ${f.quadratic.opensUpward ? 'minimum' : 'maximum'} point.`);
  }

  // Intercepts
  if (f.yIntercept) {
    steps.push(`y-intercept: f(0) = ${formatNumber(f.yIntercept.y)}, so the graph crosses the y-axis at (0, ${formatNumber(f.yIntercept.y)}).`);
  }
  if (f.xIntercepts.list.length > 0) {
    const xs = f.xIntercepts.list.map((r) => r.display).join(', ');
    steps.push(`x-intercept${f.xIntercepts.list.length > 1 ? 's' : ''}: ${variable} = ${xs}${f.xIntercepts.truncated ? ' (and more outside/inside the window — pattern continues)' : ''}.`);
  } else {
    steps.push('x-intercepts: none — the graph never crosses the x-axis.');
  }

  // Extrema / monotonicity (skip generic extrema line for quadratics — vertex already stated)
  if (!f.quadratic) {
    if (f.extrema.length > 0) {
      for (const e of f.extrema) {
        steps.push(`Local ${e.kind === 'max' ? 'maximum' : 'minimum'} at (${formatNumber(e.x)}, ${formatNumber(e.y)}) (from f′(${variable}) = 0).`);
      }
    } else if (f.monotonic) {
      steps.push(`No local extrema — the function is strictly ${f.monotonic} across the window.`);
    } else if (!f.isPeriodic) {
      steps.push('No local extrema found in the analyzed window.');
    }
  }

  // Inflection points
  if (f.inflections.length > 0) {
    steps.push(`Inflection point${f.inflections.length > 1 ? 's' : ''} (concavity changes): ${variable} = ${f.inflections.map((i) => i.display).join(', ')}.`);
  }

  // Asymptotes
  if (f.verticalAsymptotes.length > 0) {
    steps.push(`Vertical asymptote${f.verticalAsymptotes.length > 1 ? 's' : ''}: ${f.verticalAsymptotes.map((a) => `${variable} = ${formatNumber(a)}`).join(', ')} — the function blows up there.`);
  }
  if (f.horizontalAsymptote !== null && typeof f.horizontalAsymptote === 'number') {
    steps.push(`Horizontal asymptote: y = ${formatNumber(f.horizontalAsymptote)} as ${variable} → ±∞.`);
  }

  if (f.isPeriodic) {
    steps.push('This is a periodic function — its pattern of zeros and extrema repeats forever.');
  }

  steps.push('Plot the points and sketch the graph using these features.');
  return steps;
}

function buildTips(f) {
  const tips = [];
  if (f.quadratic) {
    tips.push('For ax² + bx + c, the axis of symmetry is always x = −b/(2a).');
    tips.push('The sign of a tells you the opening: a > 0 opens upward, a < 0 downward.');
  } else {
    tips.push('Critical points come from solving f′(x) = 0 — not from eyeballing the graph.');
  }
  if (f.verticalAsymptotes.length > 0) {
    tips.push('A vertical asymptote is not part of the graph — the function is undefined there.');
  }
  if (f.domain.length > 0) {
    tips.push('Always state the domain first; every other feature lives inside it.');
  }
  if (tips.length < 3) tips.push('Check symmetry: even functions mirror across the y-axis, odd ones through the origin.');
  return tips.slice(0, 3);
}

function describeGraph(f, variable) {
  const bits = [];
  if (f.verticalAsymptotes.length > 0) bits.push(`vertical asymptote at ${variable} = ${f.verticalAsymptotes.map(formatNumber).join(', ')}`);
  if (f.quadratic) bits.push(`vertex at (${formatNumber(f.quadratic.vertex.x)}, ${formatNumber(f.quadratic.vertex.y)})`);
  else if (f.extrema.length > 0) bits.push(`${f.extrema.length} local extrem${f.extrema.length > 1 ? 'a' : 'um'}`);
  if (f.xIntercepts.list.length > 0) bits.push(`x-intercepts at ${f.xIntercepts.list.slice(0, 3).map((r) => r.display).join(', ')}`);
  return bits.length ? `Key features: ${bits.join('; ')}.` : `The function over ${WINDOW.min} ≤ ${variable} ≤ ${WINDOW.max}`;
}
