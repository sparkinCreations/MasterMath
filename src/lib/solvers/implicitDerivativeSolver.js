// Implicit differentiation: dy/dx for a curve F(x, y) = 0 given as an
// equation, x² + y² = 25, x·y = 1, sin(y) = x.
//
// The working is the textbook's, term by term:
//
//   1. Differentiate both sides with respect to x, treating y as a function
//      of x. Each term T(x, y) differentiates to T_x + T_y·dy/dx (the chain
//      rule puts the dy/dx on every y-term; a product of x and y adds the
//      product rule). The partials come from Algebrite.
//   2. Collect the dy/dx terms on one side: F_y·dy/dx = −F_x.
//   3. Divide: dy/dx = −F_x/F_y, simplified. Valid where F_y ≠ 0.
//
// Verified before it is reported: points on the curve are located
// numerically (a sign change of F along a vertical line, then bisection),
// the curve is followed a step either side by Newton's method in y, and the
// finite-difference slope must match the formula. No point found, or a
// mismatch, is an honest refusal — never an unchecked formula.
//
// "at (3, 4)" evaluates dy/dx there, exactly: the point must lie on the
// curve, and F_y = 0 there means a vertical tangent (or, with F_x = 0 too,
// a singular point) — dy/dx is undefined, and the answer says why.

import { math, beautify, splitTerms, loadAlgebrite, runAlgebrite, formatNumber, rewriteReciprocalTrig, mark } from './solverUtils.js';
import { parseMathExpression } from '../mathParser.js';
import { implicitWindow } from '../graphSampling.js';
import { solved, unsupported, undefinedValue } from '../solutionEnvelope.js';

// Algebrite's natural log is log(); students read ln(). Results only.
// Square roots as √, and no parentheses around a lone denominator such as
// /(cos(y)) or /(√x) — but /(2y) keeps them.
const show = (s) => beautify(s)
  .replace(/(?<![a-z])log\(/g, 'ln(')
  .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
  .replace(/(?<![a-z])exp\(([^()]+)\)/g, 'e^($1)')
  .replace(/(?<![a-z])sqrt\(([^()]+)\)/g, '√($1)')
  .replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)')
  .replace(/(?<![a-z])([a-z]|\d+)\^\(1\/2\)/g, '√$1')
  .replace(/√\(([a-z]|\d+)\)/g, '√$1')
  .replace(/\/\((√?[a-z]|[a-z]+\([^()]*\))\)/g, '/$1');

// For mathjs: its log is natural, it has no ln.
const forMathjs = (s) => String(s).replace(/(?<![a-z])ln\(/g, 'log(');

// The curve itself, F(x, y) = 0, traced by the viewer (implicitCurve in
// graphSampling.js), with the tangent line at the point when there is one:
// a slope (dashed line), or a vertical tangent (a dashed vertical line).
function implicitGraph({ F, ind, dep, shownEquation, point = null, slope = null, vertical = false }) {
  const focus = point ? { x: point.x, y: point.y } : null;
  const window = implicitWindow(F, ind, dep, { focus });
  if (!window) return null;
  const graph = {
    points: [],
    variable: ind,
    implicit: { expression: F, x: ind, y: dep, label: shownEquation },
    initialWindow: { xMin: window.xMin, xMax: window.xMax },
    implicitYWindow: { yMin: window.yMin, yMax: window.yMax },
    sharedAxis: true,
    title: `Graph of the curve ${shownEquation}`,
    description: `Indigo: the curve ${shownEquation}`,
  };
  if (point) {
    const at = `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
    graph.annotations = { tangentPoint: { x: point.x, y: point.y, label: at } };
    if (Number.isFinite(slope)) {
      const line = `${point.y} + (${slope})*(${ind} - (${point.x}))`;
      const b = point.y - slope * point.x;
      // Exact where the numbers are fractions: y = −3x/4 + 25/4.
      const frac = (v) => {
        for (let q = 1; q <= 64; q += 1) {
          const n = Math.round(v * q);
          if (Math.abs(v * q - n) < 1e-9) return { n, q };
        }
        return null;
      };
      const term = (v) => {
        const f = frac(v);
        if (!f) return `${formatNumber(v)}${ind}`;
        const n = Math.abs(f.n);
        const top = n === 1 ? ind : `${n}${ind}`;
        return `${f.n < 0 ? '-' : ''}${f.q === 1 ? top : `${top}/${f.q}`}`;
      };
      const num = (v) => {
        const f = frac(v);
        return f ? (f.q === 1 ? String(f.n) : `${f.n}/${f.q}`) : formatNumber(v);
      };
      const slopePart = slope === 0 ? '' : term(slope);
      const interceptPart = b === 0 ? '' : num(b);
      const lineShown = `${dep} = ${slopePart && interceptPart ? `${slopePart} ${b < 0 ? '-' : '+'} ${num(Math.abs(b))}` : slopePart || interceptPart || '0'}`;
      graph.secondaryExpression = line;
      graph.secondaryLabel = `tangent: ${lineShown}`;
      graph.title = `Graph of the curve ${shownEquation} and its tangent at ${at}`;
      graph.description = `Indigo: the curve ${shownEquation}  |  Green: the tangent line ${lineShown} at ${at}`;
    } else if (vertical) {
      graph.solutions = [point.x];
      graph.title = `Graph of the curve ${shownEquation} and its vertical tangent at ${at}`;
      graph.description = `Indigo: the curve ${shownEquation}  |  Green: the vertical tangent ${ind} = ${formatNumber(point.x)} at ${at}`;
    }
  }
  return graph;
}

// xy, 2xy, e^(xy): two variables written side by side, read as a product.
// Only runs made of the curve's own two letters are split; sin, pi, … are
// never touched.
export function splitVariableProducts(text, vars) {
  const set = new Set(vars);
  return String(text).replace(/(?<![a-z])[a-z]{2,4}(?![a-z(])/gi, (run) => ([...run].every((c) => set.has(c)) ? [...run].join('*') : run));
}

// Coefficient times dy/dx, as written on paper: dy/dx, −dy/dx, 2y·dy/dx,
// (x + 2y)·dy/dx.
function timesDydx(coefficient, dep, ind) {
  const d = `d${dep}/d${ind}`;
  const c = show(coefficient);
  if (c === '1') return d;
  if (c === '-1') return `-${d}`;
  return splitTerms(coefficient).length > 1 ? `(${c})·${d}` : `${c}·${d}`;
}

// Tx + Ty·dy/dx as one signed sum, or "0".
function totalDerivative(tx, ty, dep, ind) {
  const parts = [];
  if (tx !== '0') parts.push(show(tx));
  if (ty !== '0') parts.push(timesDydx(ty, dep, ind));
  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

function ruleFor(term, tx, ty, dep, ind) {
  if (ty === '0') return tx === '0' ? 'a constant' : '';
  const both = tx !== '0';
  const product = /[*/]/.test(term.replace(/\*\*/g, '')) && both;
  if (product) return `product rule, with the chain rule on ${dep}`;
  return 'chain rule';
}

// A real root of g on [lo, hi] by bisection, or null.
function bisect(g, lo, hi) {
  let a = lo;
  let b = hi;
  let fa = g(a);
  for (let i = 0; i < 80; i += 1) {
    const m = (a + b) / 2;
    const fm = g(m);
    if (!Number.isFinite(fm)) return null;
    if (fm === 0) return m;
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
  }
  return (a + b) / 2;
}

// Points (x0, y0) on F = 0 where the curve is a graph near the point, found
// along vertical lines x = x0.
function pointsOnCurve(F, maxPoints = 3) {
  const out = [];
  for (const x0 of [0.7, 1.3, -0.6, 2.1, 0.35, -1.7, 3.1, 4.3, -2.9, 0.15]) {
    const g = (y) => F(x0, y);
    // Outward from y = 0, so the point shown is the one nearest the axis.
    scan: for (let k = 0; k < 200; k += 1) {
      for (const [lo, hi] of [[k * 0.1, (k + 1) * 0.1], [-(k + 1) * 0.1, -k * 0.1]]) {
        const a = g(lo);
        const b = g(hi);
        if (!Number.isFinite(a) || !Number.isFinite(b) || (a < 0) === (b < 0) || a === 0) continue;
        const y0 = bisect(g, lo, hi);
        // A sign change across a pole (1/y) is not a root.
        if (y0 !== null && Math.abs(g(y0)) < 1e-8 * (1 + Math.abs(a) + Math.abs(b))) {
          out.push({ x: x0, y: y0 });
          break scan;
        }
      }
    }
    if (out.length >= maxPoints) break;
  }
  return out;
}

// Follow the curve to x0 + h from (x0, y0): Newton in y with a numeric
// partial, so the check does not reuse the symbolic F_y it is checking.
function followCurve(F, x, yStart) {
  let y = yStart;
  for (let i = 0; i < 30; i += 1) {
    const f = F(x, y);
    const dy = 1e-7 * (1 + Math.abs(y));
    const fy = (F(x, y + dy) - F(x, y - dy)) / (2 * dy);
    if (!Number.isFinite(f) || !Number.isFinite(fy) || fy === 0) return null;
    const next = y - f / fy;
    if (Math.abs(next - y) < 1e-13 * (1 + Math.abs(y))) return next;
    y = next;
  }
  return Math.abs(F(x, y)) < 1e-9 ? y : null;
}

function numericValue(text) {
  try {
    const v = math.evaluate(forMathjs(String(text).replace(/π/g, 'pi').replace(/√/g, 'sqrt')));
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * dy/dx for the curve lhs = rhs.
 * @param {string} lhsText, rhsText  the two sides as typed
 * @param {{ independent?: string, dependent?: string, point?: { x: string, y: string } }} options
 */
export async function solveImplicitDerivative(lhsText, rhsText, options = {}) {
  const ind = options.independent || 'x';
  const dep = options.dependent || 'y';
  const vars = [ind, dep];
  const input = `${lhsText} = ${rhsText}`;
  const Algebrite = await loadAlgebrite();

  const prepare = (side) => rewriteReciprocalTrig(splitVariableProducts(parseMathExpression(side), vars));
  const lhs = prepare(lhsText);
  const rhs = prepare(rhsText);
  const shownEquation = `${show(lhs)} = ${show(rhs)}`;
  const run = (code) => runAlgebrite(Algebrite, code);
  const refuse = (reason) => unsupported({ input, reason, answer: 'This implicit derivative is beyond what this solver can compute' });

  const fx = run(`simplify(d((${lhs}) - (${rhs}), ${ind}))`);
  const fy = run(`simplify(d((${lhs}) - (${rhs}), ${dep}))`);
  if (fx === null || fy === null || /\bd\(/.test(fx + fy)) {
    return refuse(`The engine could not differentiate ${shownEquation} term by term.`);
  }
  if (fy === '0') {
    return refuse(`${shownEquation} does not contain ${dep}, so it does not define ${dep} as a function of ${ind}.`);
  }

  const steps = [
    `Differentiate both sides of ${mark(shownEquation)} with respect to ${mark(ind)}, treating ${mark(dep)} as a function of ${mark(ind)}: by the chain rule, every term that contains ${mark(dep)} picks up a factor ${mark(`d${dep}/d${ind}`)}.`,
  ];

  // Term by term, both sides.
  let usedProduct = false;
  const sideDerivative = (side) => {
    const pieces = [];
    for (const { signed } of splitTerms(side)) {
      const tx = run(`simplify(d(${signed}, ${ind}))`);
      const ty = run(`simplify(d(${signed}, ${dep}))`);
      if (tx === null || ty === null) return null;
      const rule = ruleFor(signed, tx, ty, dep, ind);
      if (rule.startsWith('product')) usedProduct = true;
      // Label first: "Chain rule: d/dx(y^2) = …" typesets the formula whole.
      const label = rule ? `${rule[0].toUpperCase()}${rule.slice(1)}: ` : '';
      steps.push(`${label}${mark(`d/d${ind}(${show(signed)}) = ${totalDerivative(tx, ty, dep, ind)}`)}`);
      pieces.push({ tx, ty });
    }
    return pieces;
  };
  const left = sideDerivative(lhs);
  const right = sideDerivative(rhs);
  if (!left || !right) return refuse(`The engine could not differentiate ${shownEquation} term by term.`);
  const sum = (pieces) => {
    const parts = pieces.map(({ tx, ty }) => totalDerivative(tx, ty, dep, ind)).filter((p) => p !== '0');
    return parts.length ? parts.join(' + ').replace(/\+ -/g, '- ') : '0';
  };
  const together = `${sum(left)} = ${sum(right)}`;
  steps.push(`So: ${mark(together)}`);

  const minusFx = run(`simplify(-(${fx}))`);
  const collected = `${timesDydx(fy, dep, ind)} = ${show(minusFx)}`;
  if (collected !== together) steps.push(`Collect the ${mark(`d${dep}/d${ind}`)} terms on the left and everything else on the right: ${mark(collected)}`);

  const raw = `(${minusFx})/(${fy})`;
  const result = run(`simplify(${raw})`);
  if (result === null || /\bd\(/.test(result)) return refuse(`The engine could not simplify d${dep}/d${ind} for ${shownEquation}.`);
  const rawShown = `${splitTerms(minusFx).length > 1 ? `(${show(minusFx)})` : show(minusFx)}/${splitTerms(fy).length > 1 || /[*/]/.test(fy) ? `(${show(fy)})` : show(fy)}`;
  const dydx = `d${dep}/d${ind}`;
  if (fy === '-1') steps.push(`Multiply both sides by ${mark('−1')}: ${mark(`${dydx} = ${show(result)}`)}`);
  else if (fy !== '1') steps.push(`Divide by ${mark(show(fy))}: ${mark(`${dydx} = ${rawShown === show(result) ? show(result) : `${rawShown} = ${show(result)}`}`)}`);
  const denominator = run(`denominator(${result})`);
  if (denominator && denominator !== '1' && /[a-z]/.test(denominator)) {
    steps.push(`This holds wherever ${mark(`${show(denominator)} ≠ 0`)}. At a point of the curve where it is 0 the tangent is vertical, or the curve has no single tangent there.`);
  }

  // Verification along the curve.
  let Fnum;
  let Rnum;
  let Lnum;
  try {
    const numeric = (text) => {
      const compiled = math.parse(forMathjs(text)).compile();
      return (a, b) => {
        try {
          const v = compiled.evaluate({ [ind]: a, [dep]: b });
          return typeof v === 'number' ? v : NaN;
        } catch {
          return NaN;
        }
      };
    };
    Fnum = numeric(`(${lhs}) - (${rhs})`);
    Rnum = numeric(result);
    Lnum = numeric(lhs);
  } catch {
    return refuse(`The result for ${shownEquation} could not be checked numerically, so it is not reported.`);
  }
  const checks = [];
  for (const p of pointsOnCurve(Fnum)) {
    const h = 1e-5;
    const yPlus = followCurve(Fnum, p.x + h, p.y);
    const yMinus = followCurve(Fnum, p.x - h, p.y);
    const formula = Rnum(p.x, p.y);
    if (yPlus === null || yMinus === null || !Number.isFinite(formula) || Math.abs(formula) > 1e6) continue;
    const measured = (yPlus - yMinus) / (2 * h);
    if (Math.abs(measured - formula) > 1e-4 * (1 + Math.abs(formula))) {
      return refuse(`The formula for ${dydx} did not match the slope of ${shownEquation} measured along the curve, so it is not reported.`);
    }
    checks.push({ ...p, slope: formula });
  }
  if (checks.length === 0) {
    return refuse(`No point on ${shownEquation} could be found to check ${dydx} against (the curve may have no real points), so the formula is not reported.`);
  }
  const c = checks[0];
  steps.push(`Check: ${mark(`(${formatNumber(c.x)}, ${formatNumber(c.y)})`)} is on the curve; following the curve a short step either side gives a slope of ${mark(formatNumber(c.slope))}, and the formula gives the same.`);

  const tips = [
    `Treat ${mark(dep)} as an unknown function of ${mark(ind)}: differentiate a ${mark(dep)}-term as you would ${mark(`f(${ind})`)}, so ${mark(`${dep}²`)} gives ${mark(`2${dep}·${dydx}`)}.`,
    `In one line: for ${mark(`F(${ind}, ${dep}) = 0`)}, ${mark(`${dydx} = −F_${ind}/F_${dep}`)}, the two partial derivatives — a useful check on the term-by-term working.`,
  ];
  const common_mistakes = [
    `Forgetting the ${mark(dydx)} on a ${mark(dep)}-term: ${mark(`d/d${ind}(${dep}²)`)} is ${mark(`2${dep}·${dydx}`)}, not ${mark(`2${dep}`)}.`,
    `Differentiating the constant side as anything but ${mark('0')}.`,
  ];
  if (usedProduct) {
    tips.push(`A term with both ${mark(ind)} and ${mark(dep)} is a product: ${mark(`d/d${ind}(${ind}${dep}) = ${dep} + ${ind}·${dydx}`)}.`);
    common_mistakes.push(`Treating ${mark(`${ind}${dep}`)} as a constant times ${mark(ind)}: ${mark(`d/d${ind}(${ind}${dep})`)} is ${mark(`${dep} + ${ind}·${dydx}`)}, not just ${mark(dep)}.`);
  }

  const curve = forMathjs(`(${lhs}) - (${rhs})`);
  const graphFor = (extra = {}) => implicitGraph({ F: curve, ind, dep, shownEquation, ...extra });
  if (!options.point) {
    return solved({ steps, answer: `${dydx} = ${show(result)}`, tips, common_mistakes, graph: graphFor() });
  }
  // "at x = 3" alone: enough only when the formula has no y in it.
  if (options.point.y === null || options.point.y === undefined) {
    const xv = numericValue(parseMathExpression(String(options.point.x)));
    const hasDep = new RegExp(`(?<![a-z])${dep}(?![a-z])`).test(result);
    if (xv !== null && !hasDep) {
      const value = Rnum(xv, 0);
      if (Number.isFinite(value)) {
        steps.push(`The formula has no ${mark(dep)} in it, so ${mark(ind)} alone fixes the slope: at ${mark(`${ind} = ${options.point.x}`)}, ${mark(`${dydx} = ${formatNumber(value)}`)}`);
        return solved({ steps, answer: `${dydx} at ${ind} = ${options.point.x} = ${formatNumber(value)}`, tips, common_mistakes, graph: graphFor() });
      }
    }
    steps.push(`${mark(`${dydx} = ${show(result)}`)} depends on ${mark(dep)} as well as ${mark(ind)}, and the curve can pass through ${mark(`${ind} = ${options.point.x}`)} more than once, so a slope needs the whole point: give it as ${mark(`(${options.point.x}, ${dep})`)}.`);
    tips.unshift(`To evaluate an implicit derivative, give the point as ${mark(`(${ind}, ${dep})`)} — for example "at (3, 4)".`);
    return solved({ steps, answer: `${dydx} = ${show(result)}`, tips, common_mistakes, graph: graphFor() });
  }

  // The slope at a given point.
  const px = parseMathExpression(String(options.point.x));
  const py = parseMathExpression(String(options.point.y));
  const pointShown = `(${show(px)}, ${show(py)})`;
  const a = numericValue(px);
  const b = numericValue(py);
  if (a === null || b === null) {
    return refuse(`The point ${pointShown} is not a pair of numbers.`);
  }
  const residual = Fnum(a, b);
  const scale = 1 + (Number.isFinite(Lnum(a, b)) ? Math.abs(Lnum(a, b)) : 0);
  if (!Number.isFinite(residual) || Math.abs(residual) > 1e-9 * scale) {
    return undefinedValue({
      input,
      reason: `${pointShown} is not on the curve ${shownEquation}`,
      steps: [...steps, `Substitute ${mark(pointShown)}: the two sides of ${mark(shownEquation)} are not equal there, so the point is not on the curve and the curve has no slope there.`],
      tips: [`Check the point first: substitute it into the equation — both sides must be equal. On this curve ${mark(`${dydx} = ${show(result)}`)}.`],
      graph: graphFor(),
    });
  }
  const at = (expr) => run(`simplify(subst((${py}), ${dep}, subst((${px}), ${ind}, ${expr})))`);
  const fyAt = numericValue(at(fy));
  if (fyAt === 0 || (fyAt !== null && Math.abs(fyAt) < 1e-12)) {
    const fxAt = numericValue(at(fx));
    const singular = fxAt !== null && Math.abs(fxAt) < 1e-12;
    return undefinedValue({
      input,
      reason: singular ? `both partial derivatives are 0 at ${pointShown} (a singular point of the curve)` : `the tangent at ${pointShown} is vertical`,
      steps: [...steps, `At ${mark(pointShown)}: ${mark(`${show(fy)} = 0`)}, so ${mark(`${dydx} = ${show(result)}`)} has a zero denominator there${singular ? ', and the numerator is 0 too: the curve has a singular point there, with no single tangent' : ': the tangent line is vertical, and a vertical line has no slope'}.`],
      tips: [`${mark(dydx)} is undefined exactly where ${mark(`${show(fy)} = 0`)}.`],
      graph: graphFor({ point: { x: a, y: b }, vertical: !singular }),
    });
  }
  const exact = at(result);
  const value = Rnum(a, b);
  if (!Number.isFinite(value)) return refuse(`${dydx} could not be evaluated at ${pointShown}.`);
  const dec = formatNumber(value);
  const exactText = exact && numericValue(exact) !== null && Math.abs(numericValue(exact) - value) < 1e-9 * (1 + Math.abs(value)) ? show(exact) : null;
  const shownValue = exactText && exactText !== dec && !/^-?\d+$/.test(exactText) ? `${exactText} ≈ ${dec}` : (exactText || dec);
  steps.push(`At ${mark(pointShown)} (on the curve: both sides agree there), substitute ${mark(`${ind} = ${show(px)}, ${dep} = ${show(py)}`)}: ${mark(`${dydx} = ${shownValue}`)}`);
  steps.push(`That is the slope of the tangent line to the curve at ${mark(pointShown)}.`);
  tips.unshift(`An implicit ${mark(dydx)} usually involves both ${mark(ind)} and ${mark(dep)}, so evaluating it needs the whole point ${mark(`(${ind}, ${dep})`)}, not just ${mark(ind)}.`);
  return solved({ steps, answer: `${dydx} at ${pointShown} = ${shownValue}`, tips, common_mistakes, graph: graphFor({ point: { x: a, y: b }, slope: value }) });
}
