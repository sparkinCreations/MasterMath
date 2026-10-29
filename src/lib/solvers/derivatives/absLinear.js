// |ax + b| differentiated by cases, where the derivative is undefined, the
// domain of a derivative, and the graph.

import {
  beautify,
  sampleFunction,
  rewriteReciprocalTrig,
  math,
  formatNumber,
  mark,
} from '../solverUtils.js';
import { matchingParen } from '../../mathParser.js';
import { parseError } from '../../solutionEnvelope.js';
import { featureWindow, interestingXs } from '../../graphSampling.js';
import { lnify } from './rules.js';

export function generateDerivativeGraph(original, derivative, variable, extras = {}) {
  try {
    const points = sampleFunction(original, variable);
    const secondaryPoints = sampleFunction(derivative, variable);

    if (points.length > 0) {
      return {
        points,
        secondaryPoints: secondaryPoints.length > 0 ? secondaryPoints : null,
        // The viewer re-samples both curves for the window on screen; the
        // starting window frames where f and f′ do something (zeros,
        // turning points, inflections) rather than a fixed ±10.
        expression: original,
        secondaryExpression: derivative,
        variable,
        initialWindow: featureWindow([...interestingXs(original, variable), ...interestingXs(derivative, variable)]),
        secondaryLabel: `f'(${variable}) = ${lnify(derivative)}`,
        title: `Graph of f(${variable}) = ${beautify(original)}`,
        description: `Blue/indigo: f(${variable}) = ${beautify(original)}  |  Green: f'(${variable}) = ${lnify(derivative)} (slope at each point)`,
        ...extras,
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }

  return null;
}


// The arguments of every sgn(…) call in an Algebrite derivative.
export function sgnArguments(derivative) {
  const text = String(derivative);
  const out = [];
  const re = /(?<![a-z])sgn\s*\(/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchingParen(text, open);
    if (close === -1) break;
    const arg = text.slice(open + 1, close).trim();
    if (!out.includes(arg)) out.push(arg);
    re.lastIndex = close + 1;
  }
  return out;
}

const toNumber = (text) => {
  try {
    const v = math.evaluate(String(text));
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
};

// a·x + b with numeric a ≠ 0 and b, or null.
function linearCoefficients(expr, variable, Algebrite) {
  try {
    const a = toNumber(Algebrite.run(`coeff(${expr}, ${variable}, 1)`));
    const b = toNumber(Algebrite.run(`coeff(${expr}, ${variable}, 0)`));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
    if (String(Algebrite.run(`simplify((${expr}) - ((${a})*${variable} + (${b})))`)).trim() !== '0') return null;
    return { a, b };
  } catch {
    return null;
  }
}

// f(x) = k·|ax + b|: the derivative is ±k·a on either side of the corner
// x₀ = −b/a and does not exist at x₀. Shown as the course does it — rewrite
// piecewise, differentiate each branch, compare the one-sided derivatives.
// Returns null unless the whole expression has that shape.
export function solveAbsLinear(expression, variable, options, Algebrite) {
  const v = variable;
  const m = String(expression).replace(/\s+/g, '').match(/^([+-]?)(\d+(?:\.\d+)?)?\*?abs\(([^()]+)\)$/i);
  if (!m) return null;
  const k = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
  const inner = m[3];
  const lin = linearCoefficients(inner, v, Algebrite);
  if (!lin) return null;
  const { a, b } = lin;
  const x0 = -b / a === 0 ? 0 : -b / a; // never -0
  let x0Text;
  try {
    x0Text = beautify(Algebrite.run(`simplify(-(${b})/(${a}))`));
  } catch {
    x0Text = formatNumber(x0);
  }
  if (!x0Text || /nil|stop/i.test(x0Text)) x0Text = formatNumber(x0);
  const right = k * Math.abs(a); // slope for x > x0
  const left = -right; // slope for x < x0
  const fmt = (n) => formatNumber(n);
  const innerShown = beautify(inner);
  const kShown = k === 1 ? '' : k === -1 ? '-' : `${fmt(k)}`;
  const branchPos = beautify(String(Algebrite.run(`simplify((${k})*(${inner}))`)));
  const branchNeg = beautify(String(Algebrite.run(`simplify(-(${k})*(${inner}))`)));
  const geq = a > 0 ? '≥' : '≤';
  const lt = a > 0 ? '<' : '>';

  const steps = [
    `Identify the function to differentiate: ${mark(`f(${v}) = ${kShown}|${innerShown}|`)}`,
    innerShown === v
      ? `An absolute value is not a power, so the power rule does not apply. Rewrite it piecewise: ${mark(`|${v}| = ${v}`)} when ${mark(`${v} ≥ 0`)}, and ${mark(`|${v}| = −${v}`)} when ${mark(`${v} < 0`)}.`
      : `An absolute value is not a power, so the power rule does not apply. Rewrite it piecewise: ${mark(`|${innerShown}| = ${innerShown}`)} when ${mark(`${innerShown} ≥ 0`)}, that is ${mark(`${v} ${geq} ${x0Text}`)}; and ${mark(`|${innerShown}| = −(${innerShown})`)} when ${mark(`${innerShown} < 0`)}, that is ${mark(`${v} ${lt} ${x0Text}`)}.`,
    `So ${mark(`f(${v}) = ${branchPos}`)} for ${mark(`${v} ${geq} ${x0Text}`)}, and ${mark(`f(${v}) = ${branchNeg}`)} for ${mark(`${v} ${lt} ${x0Text}`)}.`,
    `Differentiate each branch (each is a line, so its derivative is its slope): for ${mark(`${v} > ${x0Text}`)}, ${mark(`f'(${v}) = ${fmt(right)}`)}; for ${mark(`${v} < ${x0Text}`)}, ${mark(`f'(${v}) = ${fmt(left)}`)}.`,
    `At ${mark(`${v} = ${x0Text}`)} compare the one-sided derivatives: from the left the slope is ${mark(fmt(left))}, from the right it is ${mark(fmt(right))}. They differ, so ${mark(`f'(${x0Text})`)} does not exist — the graph has a corner there.`,
    `Conclusion: ${mark(`f'(${v}) = ${fmt(left)}`)} for ${mark(`${v} < ${x0Text}`)}, ${mark(`f'(${v}) = ${fmt(right)}`)} for ${mark(`${v} > ${x0Text}`)}, and ${mark(`f'(${x0Text})`)} does not exist.`,
  ];
  let answer = `f'(${v}) = ${fmt(left)} for ${v} < ${x0Text}, ${fmt(right)} for ${v} > ${x0Text}; f'(${x0Text}) does not exist`;

  if (options.evalAt) {
    const { valueText } = options.evalAt;
    const value = toNumber(String(valueText).replace(/π/g, 'pi').replace(/√/g, 'sqrt'));
    if (!Number.isFinite(value)) {
      return parseError({ input: expression, hint: `The evaluation point ${v} = ${valueText} is not a number.` });
    }
    if (Math.abs(value - x0) < 1e-12) {
      steps.push(`Evaluate at ${mark(`${v} = ${valueText}`)}: this is the corner. The one-sided derivatives are ${mark(fmt(left))} (from the left) and ${mark(fmt(right))} (from the right), so ${mark(`f'(${valueText})`)} does not exist.`);
      answer = `f'(${valueText}) does not exist`;
    } else {
      const slope = value > x0 ? right : left;
      steps.push(`Evaluate at ${mark(`${v} = ${valueText}`)}: ${mark(`${valueText} ${value > x0 ? '>' : '<'} ${x0Text}`)}, so ${mark(`f'(${valueText}) = ${fmt(slope)}`)}.`);
      steps.push(`That is the slope of the tangent line to f at ${mark(`${v} = ${valueText}`)}.`);
      answer = `f'(${valueText}) = ${fmt(slope)}`;
    }
  }

  const cornerLabel = `f'(${x0Text}) does not exist`;
  const graph = generateDerivativeGraph(expression, `(${k * a})*sgn(${inner})`, v, {
    secondaryLabel: `f'(${v}) = ${fmt(left)} (${v} < ${x0Text}), ${fmt(right)} (${v} > ${x0Text})`,
    description: `Blue/indigo: f(${v}) = ${kShown}|${innerShown}|  |  Green: f'(${v}) = ${fmt(left)} for ${v} < ${x0Text} and ${fmt(right)} for ${v} > ${x0Text}; the hollow markers show f'(${x0Text}) does not exist.`,
    secondaryBreaks: [x0],
    initialWindow: featureWindow([x0 - 2, x0 + 2]),
    annotations: {
      openPoints: [
        { x: x0, y: left, label: cornerLabel, series: 'secondary' },
        { x: x0, y: right, label: cornerLabel, series: 'secondary' },
      ],
    },
  });

  return {
    steps,
    answer,
    tips: [
      `${mark('|u| = u')} for ${mark('u ≥ 0')} and ${mark('−u')} for ${mark('u < 0')}: an absolute value is a piecewise function, and each piece is differentiated on its own.`,
      'A derivative exists at a point only if the left and right derivatives agree. At a corner they do not, so there is no tangent line there.',
      `Away from the corner, ${mark(`d/d${v}|u| = sgn(u)·u′`)} — the sign of ${mark('u')} times the inner derivative.`,
    ],
    common_mistakes: [
      `Applying the power rule to ${mark('|x|')} as if it were ${mark('x')}.`,
      `Reporting ${mark(`f'(${x0Text}) = 0`)} because ${mark('sgn(0) = 0')} on a calculator — the derivative does not exist there.`,
    ],
    graph,
  };
}

// Where f′ is defined, as a condition on the answer ("x ≠ 0", "x > 0"), with
// a step giving the reason. Two sources: the poles of f′ (a polynomial
// denominator's real roots), and root/log restrictions carried from f or
// created by f′ — √u needs u ≥ 0 (u > 0 when it sits in a denominator),
// ln(u) needs u > 0 — for a linear u. Null when nothing restricts f′; a
// restriction that cannot be read exactly is left unstated, never guessed.
export function derivativeDomain(original, derivative, variable, Algebrite) {
  const v = variable;
  const conditions = [];
  const reasons = [];
  const hasVar = new RegExp(`(?<![a-z])${v}(?![a-z])`);
  const push = (cond, reason) => {
    if (!conditions.includes(cond)) {
      conditions.push(cond);
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    }
  };

  // Root and log restrictions.
  const restrictions = []; // { r, strict, dir: 1 | -1, reason }
  const scan = (text, source) => {
    const t = String(text);
    const patterns = [
      { re: /(?<![a-z])sqrt\s*\(/gi, kind: 'sqrt' },
      { re: /(?<![a-z])(?:ln|log)\s*\(/gi, kind: 'log' },
    ];
    for (const { re, kind } of patterns) {
      let m;
      while ((m = re.exec(t)) !== null) {
        const open = m.index + m[0].length - 1;
        const close = matchingParen(t, open);
        if (close === -1) break;
        const arg = t.slice(open + 1, close).trim();
        re.lastIndex = close + 1;
        if (!hasVar.test(arg)) continue;
        const lin = linearCoefficients(arg, v, Algebrite);
        if (!lin) continue;
        restrictions.push({ r: -lin.b / lin.a, dir: lin.a > 0 ? 1 : -1, kind, arg, source });
      }
    }
    // x^(1/2), (ax+b)^(1/2)
    const half = /(?:\(([^()]+)\)|(?<![a-z])([a-z]))\^\(1\/2\)/g;
    let m;
    while ((m = half.exec(t)) !== null) {
      const arg = (m[1] || m[2]).trim();
      if (!hasVar.test(arg)) continue;
      const lin = linearCoefficients(arg, v, Algebrite);
      if (!lin) continue;
      restrictions.push({ r: -lin.b / lin.a, dir: lin.a > 0 ? 1 : -1, kind: 'sqrt', arg, source });
    }
  };
  scan(original, 'f');
  scan(derivative, "f'");

  const finiteAt = (x) => {
    try {
      const y = math.evaluate(rewriteReciprocalTrig(derivative), { [v]: x });
      return typeof y === 'number' && Number.isFinite(y);
    } catch {
      return false;
    }
  };
  for (const { r, dir, kind, arg } of restrictions) {
    // Strict when f′ itself is undefined at the boundary (the radical sits
    // in a denominator) or the restriction comes from a logarithm.
    const strict = kind === 'log' || !finiteAt(r);
    const sym = dir > 0 ? (strict ? '>' : '≥') : (strict ? '<' : '≤');
    const rText = formatNumber(r);
    const reason = kind === 'log'
      ? `${mark(`ln(${beautify(arg)})`)} is defined only for ${mark(`${beautify(arg)} > 0`)}`
      : `${mark(`√(${beautify(arg)})`)} is defined only for ${mark(`${beautify(arg)} ≥ 0`)}${strict ? `, and ${mark("f'")} has it in a denominator, so ${mark(`${v} = ${rText}`)} is excluded too` : ''}`;
    push(`${v} ${sym} ${rText}`, reason);
  }

  // Poles of f′: real roots of a polynomial denominator.
  try {
    const den = String(Algebrite.run(`denominator(${derivative})`)).trim();
    if (den && hasVar.test(den) && !/[a-wyz]{2,}/i.test(den.replace(new RegExp(v, 'g'), ''))) {
      const rootsRaw = String(Algebrite.roots(den, v)).trim();
      if (rootsRaw && !/stop|error|nil/i.test(rootsRaw)) {
        const poles = rootsRaw.replace(/^\[|\]$/g, '').split(',').map((t) => toNumber(t.trim())).filter(Number.isFinite);
        for (const p of [...new Set(poles.map((x) => Math.round(x * 1e9) / 1e9))]) {
          const excluded = restrictions.some(({ r, dir }) => (dir > 0 ? p <= r + 1e-12 : p >= r - 1e-12));
          if (!excluded) push(`${v} ≠ ${formatNumber(p)}`, `the denominator of ${mark("f'")} is 0 at ${mark(`${v} = ${formatNumber(p)}`)}`);
        }
      }
    }
  } catch { /* no pole information */ }

  if (conditions.length === 0) return null;
  return {
    text: conditions.join(', '),
    step: `Domain of ${mark(`f'(${v})`)}: ${mark(conditions.join(' and '))} — ${reasons.join('; ')}.`,
  };
}
