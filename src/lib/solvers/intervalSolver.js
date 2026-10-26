// A function on a closed interval, asked in words (1.56.0): "the average
// value of x^2 on [0, 3]", "the maximum of x^3 - 3x on [0, 2]". Both were
// refused as unreadable words.
//
// - Average value: f_avg = (1/(b − a))·∫_a^b f(x) dx. The integral is the
//   integrals solver's (verified there), its working shown; the division is
//   exact where the integral is.
// - Absolute maximum and minimum: the closed interval method. f must be
//   continuous on [a, b], shown from its parts (no denominator, logarithm
//   argument, root or tangent goes bad inside it), never from samples; the
//   candidates are the endpoints and the critical points inside, where
//   f′ = 0 or f′ does not exist. Every critical point must be found:
//   polynomial equations by the exact root finder (Sturm counting), others
//   by the equation solvers, whose answers are complete (the trig solver's
//   general solution is enumerated on the interval). When a list cannot be
//   shown complete, the answer is a refusal, not a guess.
import { math, beautify, formatNumber, mark, piForm, loadAlgebrite, isAlgebriteFailure, sampleFunction, realOddRoots } from './solverUtils.js';
import { readPolynomial, allRoots } from './polynomialRoots.js';
import { unsupported as refusal } from '../solutionEnvelope.js';

const unsupported = (fields) => refusal({ ...fields, steps: [fields.reason] });
const TRIG_CALL = /(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\(/;

// Engine syntax → what a student reads.
function show(text) {
  const out = beautify(String(text))
    // The real cube root: Algebrite writes ∛(−2) as (−1)^(1/3)·2^(1/3).
    .replace(/\(-1\)\^\(1\/3\)\*/g, '-')
    .replace(/(?<![a-z])(\d+|[a-z])\^\(1\/3\)/g, '∛$1')
    // 1/6*π → π/6, 5/6*π → 5π/6.
    .replace(/(?<![\w.])1\/(\d+)\*pi(?![a-z])/g, 'pi/$1')
    .replace(/(?<![\w.])(\d+)\/(\d+)\*pi(?![a-z])/g, '$1pi/$2')
    .replace(/(?<![a-z])exp\(-1\)/g, '1/e')
    .replace(/(?<![a-z])(\d+|[a-z])\^\(1\/2\)/g, '√$1')
    .replace(/\(([^()]+)\)\^\(1\/2\)/g, '√($1)')
    // Algebrite's −1 + e first: (e − 1).
    .replace(/\(-(\d+) \+ ([a-zπ√][^()]*)\)/g, '($2 - $1)')
    .replace(/(?<![a-z])log\(/g, 'ln(')
    .replace(/(?<![a-z])exp\(([a-z]|\d+)\)/g, 'e^$1')
    .replace(/(?<![a-z])exp\(((?:[^()]|\([^()]*\))+)\)/g, 'e^($1)')
    .replace(/(?<![a-z])sqrt\(/g, '√(')
    .replace(/√\(([a-z]|\d+)\)/g, '√$1')
    .replace(/(?<![a-z])pi(?![a-z])/g, 'π')
    .replace(/\s*\/\s*/g, '/');
  // −3 + ln(3) reads as ln(3) − 3.
  const lead = out.match(/^-(\d+(?:\/\d+)?) \+ ([^+\-]+)$/);
  return lead ? `${lead[2]} - ${lead[1]}` : out;
}
// A typed or displayed value → mathjs syntax.
const toMath = (t) => String(t).replace(/π/g, 'pi').replace(/√\(/g, 'sqrt(').replace(/√(\d+|[a-z])/g, 'sqrt($1)').replace(/(\d)\s*(pi|sqrt|e\b)/g, '$1*$2').replace(/·/g, '*');
// mathjs → Algebrite: its natural log is log().
const toAlgebrite = (t) => toMath(t).replace(/(?<![a-z])ln\(/g, 'log(');
const fromAlgebrite = (t) => String(t).replace(/(?<![a-z])log\(/g, 'ln(');

function numeric(text, variable, x) {
  try {
    // x^(2/3) is the real cube root squared, for negative x too.
    const v = math.evaluate(realOddRoots(toMath(fromAlgebrite(text))), variable ? { [variable]: x } : {});
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

// A bound as typed ("0", "pi/2", "-1", "e") → { x, text }.
export function readBound(text) {
  const x = numeric(String(text).trim());
  return Number.isFinite(x) ? { x, text: show(toMath(String(text).trim())) } : null;
}

// A value shown exactly when it is a simple one: a fraction, a multiple of π.
function exactNumber(x) {
  if (Math.abs(x - Math.round(x)) < 1e-12) return String(Math.round(x));
  for (let q = 2; q <= 24; q += 1) {
    const p = Math.round(x * q);
    if (Math.abs(x * q - p) < 1e-10) return `${p}/${q}`;
  }
  return piForm(x);
}

// ---------------------------------------------------------------------------
// Where an expression is 0 on [a, b], completely, or null.
// ---------------------------------------------------------------------------

// The solutions an equation solver lists, as { x, text }; [] for none;
// null when its answer is not a complete list it can stand behind.
async function solvedSolutions(equation, variable, a, b, solve) {
  const topic = TRIG_CALL.test(equation) ? 'trigonometry' : 'algebra';
  const r = await solve(equation, topic);
  const answer = String(r?.answer || '');
  if (/no real solution/i.test(answer)) return [];
  if (r?.status !== 'solved') return null;
  if (/all real numbers|every real/i.test(answer)) return null;
  const out = [];
  // "x = π/2 + πn (n ∈ ℤ);  on [0, 2π): …": each family enumerated on [a, b].
  if (/n ∈ ℤ/.test(answer)) {
    const families = answer.split(';')[0].replace(/\(n ∈ ℤ\)/g, '').split(/\s+or\s+/);
    for (const fam of families) {
      const m = fam.trim().match(new RegExp(`^${variable}\\s*=\\s*(.+)$`));
      if (!m) return null;
      const body = toMath(m[1]).replace(/(\d|\)|pi)\s*n\b/g, '$1*n').replace(/(\d|\))\s*\(/g, '$1*(').replace(/pi\s*\*?\s*n/g, 'pi*n');
      let code;
      try {
        code = math.parse(body).compile();
      } catch {
        return null;
      }
      const at = (n) => code.evaluate({ n });
      const g0 = at(0);
      const step = at(1) - g0;
      if (!Number.isFinite(g0) || !Number.isFinite(step) || step === 0) return null;
      const lo = Math.ceil((Math.min(a, b) - g0) / Math.abs(step) - 1e-9);
      const hi = Math.floor((Math.max(a, b) - g0) / Math.abs(step) + 1e-9);
      for (let k = lo; k <= hi && k - lo < 1000; k += 1) {
        const x = g0 + k * Math.abs(step);
        out.push({ x, text: exactNumber(x) || `≈ ${formatNumber(x)}` });
      }
    }
    return out;
  }
  for (const part of answer.replace(/\s*\(multiplicity \d+\)/g, '').replace(/\s*\(repeated root[^)]*\)/g, '').split(/\s+or\s+/)) {
    const m = part.trim().match(new RegExp(`^${variable}\\s*([=≈])\\s*(.+?)(?:\\s*\\((?:≈|=)\\s*([^)]+)\\))?$`));
    if (!m) return null;
    const [, sign, expr, approx] = m;
    if (/(?<![a-z])i(?![a-z])/.test(expr)) continue; // a complex root
    let x = numeric(expr);
    if (!Number.isFinite(x) && approx) x = Number(approx);
    if (!Number.isFinite(x)) return null;
    out.push({ x, text: sign === '≈' ? `≈ ${expr}` : expr });
  }
  return out;
}

// Every x in [a, b] where `expr` (engine syntax) is 0: { points } with
// { x, text }, { everywhere: true } for an expression that is identically 0,
// or null when the list cannot be shown complete.
async function zerosIn(expr, variable, a, b, solve) {
  const inside = (p) => p.x >= a - 1e-12 && p.x <= b + 1e-12;
  const mathText = toMath(fromAlgebrite(expr));
  const poly = readPolynomial(mathText, variable);
  if (poly && !poly.tooHigh) {
    if (poly.degree < 1) return poly.coefficients[0].equals(0) ? { everywhere: true } : { points: [] };
    const { real } = allRoots(poly);
    const wanted = real.filter((r) => r.value >= a - 1e-12 && r.value <= b + 1e-12);
    // Irrational roots in the solver's exact form (√2), matched by value.
    const forms = wanted.some((r) => !r.exact) ? (await solvedSolutions(`${mathText} = 0`, variable, a, b, solve)) || [] : [];
    return {
      points: wanted.map((r) => {
        if (r.exact) return { x: r.value, text: r.exact.d === 1n ? String(r.exact.m) : `${r.exact.m}/${r.exact.d}` };
        const form = forms.find((f) => Math.abs(f.x - r.value) < 1e-7 * (1 + Math.abs(r.value)));
        return { x: r.value, text: form ? form.text : `≈ ${formatNumber(r.value)}` };
      }),
    };
  }
  const found = await solvedSolutions(`${mathText} = 0`, variable, a, b, solve);
  if (found === null) return null;
  // Each must be a zero: the solver's list is checked, not trusted.
  for (const p of found) {
    const v = numeric(mathText, variable, p.x);
    if (!(Math.abs(v) < 1e-7)) return null;
  }
  return { points: found.filter(inside) };
}

// ---------------------------------------------------------------------------
// Continuity on [a, b], from the parts of f.
// ---------------------------------------------------------------------------

// null when f is continuous on [a, b]; { reason } when it is not;
// { unknown } when it cannot be shown either way.
async function discontinuity(expr, variable, a, b, solve) {
  let tree;
  try {
    tree = math.parse(toMath(expr));
  } catch {
    return { unknown: true };
  }
  const hasVar = (node) => node.filter((n) => n.type === 'SymbolNode' && n.name === variable).length > 0;
  const checks = [];
  tree.traverse((node) => {
    if (node.type === 'OperatorNode' && node.fn === 'divide' && hasVar(node.args[1])) checks.push({ kind: 'nonzero', of: node.args[1] });
    if (node.type === 'OperatorNode' && node.fn === 'pow' && hasVar(node.args[0])) {
      let k;
      try { k = node.args[1].evaluate(); } catch { k = NaN; }
      // p/q with q odd (x^(2/3)): a real odd root, defined for every x.
      const oddRoot = Number.isFinite(k) && !Number.isInteger(k) && [3, 5, 7, 9].some((q) => Number.isInteger(Math.round(k * q * 1e9) / 1e9));
      if (!Number.isFinite(k)) checks.push({ kind: 'unknown' });
      else if (oddRoot) { if (k < 0) checks.push({ kind: 'nonzero', of: node.args[0] }); }
      else if (!Number.isInteger(k)) checks.push({ kind: k < 0 ? 'positive' : 'nonnegative', of: node.args[0] });
      else if (k < 0) checks.push({ kind: 'nonzero', of: node.args[0] });
    }
    if (node.type === 'FunctionNode' && node.args.some(hasVar)) {
      const name = node.fn?.name;
      const arg = node.args[0];
      if (['ln', 'log', 'log10', 'log2'].includes(name)) checks.push({ kind: 'positive', of: arg });
      else if (name === 'sqrt') checks.push({ kind: 'nonnegative', of: arg });
      else if (name === 'tan' || name === 'sec') checks.push({ kind: 'nonzero', of: math.parse(`cos(${arg.toString()})`) });
      else if (name === 'cot' || name === 'csc') checks.push({ kind: 'nonzero', of: math.parse(`sin(${arg.toString()})`) });
      else if (!['sin', 'cos', 'exp', 'abs', 'cbrt', 'sinh', 'cosh', 'tanh', 'arctan', 'atan'].includes(name)) checks.push({ kind: 'unknown' });
    }
  });
  for (const c of checks) {
    if (c.kind === 'unknown') return { unknown: true };
    const text = c.of.toString();
    const zeros = await zerosIn(toAlgebrite(text), variable, a, b, solve);
    if (zeros === null) return { unknown: true };
    if (zeros.everywhere) return { reason: `${mark(show(text))} is ${mark('0')} on the whole interval` };
    if (c.kind === 'nonzero' && zeros.points.length) {
      const z = zeros.points[0];
      return { reason: `${mark(`${show(text)} = 0`)} at ${mark(`${variable} = ${z.text}`)}, so ${mark('f')} is undefined there` };
    }
    if (c.kind !== 'nonzero') {
      // The sign between consecutive zeros (and the ends) is constant.
      const cuts = [a, ...zeros.points.map((p) => p.x), b].sort((p, q) => p - q);
      for (let i = 0; i + 1 < cuts.length; i += 1) {
        if (cuts[i + 1] - cuts[i] < 1e-12) continue;
        const mid = (cuts[i] + cuts[i + 1]) / 2;
        const v = numeric(text, variable, mid);
        if (!(v > 0)) return { reason: `${mark(show(text))} is negative between ${mark(formatNumber(cuts[i]))} and ${mark(formatNumber(cuts[i + 1]))}, so ${mark('f')} is undefined there` };
      }
      if (c.kind === 'positive' && zeros.points.length) {
        return { reason: `${mark(`${show(text)} = 0`)} at ${mark(`${variable} = ${zeros.points[0].text}`)}, where the logarithm is undefined` };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Average value.
// ---------------------------------------------------------------------------

export async function averageValue(expr, variable, aText, bText, solve) {
  const a = readBound(aText);
  const b = readBound(bText);
  const shown = show(expr);
  const input = `the average value of ${shown} on [${aText}, ${bText}]`;
  if (!a || !b) return unsupported({ input, reason: `The interval ${mark(`[${aText}, ${bText}]`)} could not be read as two numbers.`, answer: 'This interval could not be read' });
  if (!(b.x > a.x)) return unsupported({ input, reason: `An interval ${mark('[a, b]')} needs ${mark('a < b')}; here ${mark(`a = ${a.text}`)} and ${mark(`b = ${b.text}`)}.`, answer: 'The interval is empty' });
  const wrapBound = (t) => (/^-?[\w.]+$/.test(t) ? t : `(${t})`);
  const integral = await solve(`∫_${wrapBound(toMath(aText))}^${wrapBound(toMath(bText))} ${expr} d${variable}`, 'integrals');
  if (integral?.status === 'diverges') {
    return unsupported({ input, reason: `${mark(`∫_${a.text}^${b.text} ${shown} d${variable}`)} diverges, so ${mark(shown)} has no average value on ${mark(`[${a.text}, ${b.text}]`)}.`, answer: 'No average value: the integral diverges' });
  }
  if (integral?.status !== 'solved') {
    return unsupported({ input, reason: `The integral ${mark(`∫_${a.text}^${b.text} ${shown} d${variable}`)} could not be evaluated, so neither can the average.`, answer: 'This average value is beyond what this solver can compute' });
  }
  const valueText = String(integral.answer).split(' = ').pop().replace(/\s*\((?:≈|=)[^)]*\)\s*$/, '').trim();
  const integralNum = numeric(valueText);
  if (!Number.isFinite(integralNum)) return unsupported({ input, reason: 'The integral\'s value could not be read.', answer: 'This average value is beyond what this solver can compute' });
  const width = b.x - a.x;
  const avgNum = integralNum / width;
  const Algebrite = await loadAlgebrite();
  const widthRaw = String(Algebrite.run(`simplify((${toAlgebrite(bText)}) - (${toAlgebrite(aText)}))`)).trim();
  const avgRaw = String(Algebrite.run(`simplify((${toAlgebrite(valueText)})/(${widthRaw}))`)).trim();
  const exactOk = (raw, value) => raw && !isAlgebriteFailure(raw) && Math.abs(numeric(raw) - value) < 1e-9 * (1 + Math.abs(value));
  const widthText = exactOk(widthRaw, width) ? show(fromAlgebrite(widthRaw)) : formatNumber(width);
  const avgExact = exactOk(avgRaw, avgNum) ? show(fromAlgebrite(avgRaw)) : null;
  const decimal = formatNumber(avgNum);
  const avgText = avgExact ? (avgExact === decimal || /^-?\d+$/.test(avgExact) ? avgExact : `${avgExact} ≈ ${decimal}`) : `≈ ${decimal}`;
  const answerText = avgExact ? (avgExact === decimal || /^-?\d+$/.test(avgExact) ? avgExact : `${avgExact} (≈ ${decimal})`) : `≈ ${decimal}`;
  const steps = [
    `The average value of ${mark('f')} on ${mark('[a, b]')} is ${mark('(1/(b − a))·∫_a^b f(x) dx')}: the height of the rectangle on ${mark('[a, b]')} with the same area as the region under ${mark('f')}.`,
    `Here ${mark(`f(${variable}) = ${shown}`)}, ${mark(`a = ${a.text}`)} and ${mark(`b = ${b.text}`)}. First the integral:`,
    ...integral.steps,
    `Divide by the width ${mark(`b − a = ${widthText}`)}: the average value is ${mark(`(${show(valueText)})/${/^[\w.π]+$/.test(widthText) ? widthText : `(${widthText})`} ${/^≈/.test(avgText) ? avgText : `= ${avgText}`}`)}.`,
  ];
  const pad = Math.max(0.5, width * 0.25);
  return {
    steps,
    answer: `The average value is ${answerText}`,
    tips: [
      `The average value is ${mark('(1/(b − a))·∫_a^b f(x) dx')}: integrate, then divide by the length of the interval.`,
      `By the Mean Value Theorem for integrals, a continuous ${mark('f')} takes its average value somewhere in ${mark('[a, b]')}.`,
      `The rectangle on ${mark('[a, b]')} whose height is the average value has the same area as the region under the curve.`,
    ],
    common_mistakes: [
      `Averaging ${mark('f(a)')} and ${mark('f(b)')}: that is the average of two values, not of the function.`,
      `Forgetting to divide by ${mark('b − a')}: the integral alone is the area, not the average.`,
    ],
    graph: {
      points: sampleFunction(toMath(expr), variable, { min: a.x - pad, max: b.x + pad, step: (width + 2 * pad) / 200 }),
      expression: toMath(expr),
      secondaryExpression: String(avgNum),
      secondaryLabel: `average: y = ${avgText}`,
      variable,
      sharedAxis: true,
      initialWindow: { xMin: a.x - pad, xMax: b.x + pad },
      annotations: { shaded: { from: a.x, to: b.x, fromLabel: a.text, toLabel: b.text } },
      title: `Graph of f(${variable}) = ${shown} and its average value on [${a.text}, ${b.text}]`,
      description: `Indigo: f(${variable}) = ${shown}  |  Green: the average value y = ${avgText}  |  Shaded: [${a.text}, ${b.text}]`,
    },
  };
}

// ---------------------------------------------------------------------------
// Absolute maximum and minimum on [a, b].
// ---------------------------------------------------------------------------

export async function extremaOnInterval(expr, variable, aText, bText, which, solve) {
  const a = readBound(aText);
  const b = readBound(bText);
  const shown = show(expr);
  const wanted = which === 'maximum' ? 'maximum' : which === 'minimum' ? 'minimum' : 'maximum and minimum';
  const input = `the ${wanted} of ${shown} on [${aText}, ${bText}]`;
  const refuse = (reason, answer = `This ${wanted} is beyond what this solver can find exactly`) => unsupported({ input, reason, answer });
  if (!a || !b) return refuse(`The interval ${mark(`[${aText}, ${bText}]`)} could not be read as two numbers.`, 'This interval could not be read');
  if (!(b.x > a.x)) return refuse(`An interval ${mark('[a, b]')} needs ${mark('a < b')}; here ${mark(`a = ${a.text}`)} and ${mark(`b = ${b.text}`)}.`, 'The interval is empty');
  const interval = `[${a.text}, ${b.text}]`;

  const broken = await discontinuity(expr, variable, a.x, b.x, solve);
  if (broken?.unknown) return refuse(`MasterMath could not show that ${mark(shown)} is continuous on ${mark(interval)}, which the closed interval method needs, so it does not guess a ${wanted}.`);
  if (broken) {
    return refuse(`${mark(shown)} is not continuous on ${mark(interval)}: ${broken.reason}. The Extreme Value Theorem needs a continuous function on a closed interval, so an absolute ${wanted} need not exist.`, `No guaranteed ${wanted}: f is not continuous on ${interval}`);
  }

  const Algebrite = await loadAlgebrite();
  const algExpr = toAlgebrite(expr);
  const derivative = String(Algebrite.run(`simplify(d(${algExpr}, ${variable}))`)).trim();
  if (!derivative || isAlgebriteFailure(derivative) || /\bd\(/.test(derivative)) return refuse(`The derivative of ${mark(shown)} could not be found.`);
  // Algebrite writes d|u| as u′·sgn(u): a sign factor is ±1 where it is
  // defined, so it does not change where f′ is 0; where u = 0, f′ does not
  // exist (a corner), found below.
  const forZeros = derivative.replace(/(?<![a-z])sgn\(((?:[^()]|\([^()]*\))*)\)/g, '1');
  const numer = String(Algebrite.run(`numerator(${forZeros})`)).trim();
  const denom = String(Algebrite.run(`denominator(${derivative})`)).trim();
  const fprimeShown = show(fromAlgebrite(derivative)).replace(/(?<![a-z])sgn\(/g, 'sgn(');

  const stationary = await zerosIn(numer, variable, a.x, b.x, solve);
  if (stationary === null) return refuse(`MasterMath could not show it has every solution of ${mark(`f′(${variable}) = ${fprimeShown} = 0`)} on ${mark(interval)}, so it does not guess a ${wanted}.`);
  // Where f′ does not exist inside the interval: its denominator's zeros,
  // and the corners of each absolute value.
  const corners = [];
  if (denom && denom !== '1' && /[a-z]/.test(denom)) {
    const z = await zerosIn(denom, variable, a.x, b.x, solve);
    if (z === null) return refuse(`MasterMath could not show where ${mark(`f′(${variable}) = ${fprimeShown}`)} is undefined on ${mark(interval)}.`);
    corners.push(...(z.points || []));
  }
  for (const m of derivative.matchAll(/(?<![a-z])sgn\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const z = await zerosIn(m[1], variable, a.x, b.x, solve);
    if (z === null) return refuse(`MasterMath could not find where ${mark(show(fromAlgebrite(m[1])))} changes sign on ${mark(interval)}.`);
    corners.push(...(z.points || []));
  }
  const strictlyInside = (p) => p.x > a.x + 1e-12 && p.x < b.x - 1e-12;
  const constant = Boolean(stationary.everywhere);
  const critical = constant ? [] : stationary.points.filter(strictlyInside);
  const undefinedAt = corners.filter(strictlyInside).filter((p) => !critical.some((c) => Math.abs(c.x - p.x) < 1e-9));

  // f at every candidate, exactly where it can be.
  const valueAt = (p) => {
    const x = numeric(toMath(p.text.replace(/^≈ /, '')), null);
    const at = Number.isFinite(x) && !/^≈/.test(p.text) ? p.text : String(p.x);
    const raw = String(Algebrite.run(`simplify(subst((${toAlgebrite(at)}), ${variable}, ${algExpr}))`)).trim();
    const y = numeric(toMath(expr), variable, p.x);
    const exact = raw && !isAlgebriteFailure(raw) && Math.abs(numeric(raw) - y) < 1e-9 * (1 + Math.abs(y)) && !/^≈/.test(p.text) ? show(fromAlgebrite(raw)) : null;
    const decimal = formatNumber(y);
    const text = exact ? (exact === decimal || /^-?\d+$/.test(exact) ? exact : `${exact} ≈ ${decimal}`) : `≈ ${decimal}`;
    return { ...p, y, valueText: text };
  };
  const candidates = [a, ...critical, ...undefinedAt, b].map((p) => valueAt({ x: p.x, text: p.text }));
  if (candidates.some((c) => !Number.isFinite(c.y))) return refuse(`${mark(shown)} could not be evaluated at every candidate.`);
  const top = Math.max(...candidates.map((c) => c.y));
  const bottom = Math.min(...candidates.map((c) => c.y));
  const near = (u, v) => Math.abs(u - v) <= 1e-9 * (1 + Math.abs(v));
  const maxima = candidates.filter((c) => near(c.y, top));
  const minima = candidates.filter((c) => near(c.y, bottom));

  const steps = [
    `${mark(shown)} is continuous on the closed interval ${mark(interval)}, so by the Extreme Value Theorem it has an absolute maximum and an absolute minimum there. Each is at an endpoint or at a critical point inside the interval (where ${mark('f′ = 0')} or ${mark('f′')} does not exist), so those are the only candidates.`,
    `Differentiate: ${mark(`f′(${variable}) = ${fprimeShown}`)}.`,
  ];
  if (constant) steps.push(`${mark(`f′(${variable}) = 0`)} everywhere: ${mark('f')} is constant, so every point gives the same value.`);
  else if (critical.length) steps.push(`${mark(`f′(${variable}) = 0`)} inside ${mark(`(${a.text}, ${b.text})`)} at ${critical.map((c) => mark(`${variable} = ${c.text}`)).join(', ')}.`);
  else steps.push(`${mark(`f′(${variable}) = 0`)} has no solution inside ${mark(`(${a.text}, ${b.text})`)}.`);
  if (undefinedAt.length) steps.push(`${mark('f′')} does not exist at ${undefinedAt.map((c) => mark(`${variable} = ${c.text}`)).join(', ')} (a corner or a vertical tangent): ${undefinedAt.length === 1 ? 'a critical point' : 'critical points'} too.`);
  steps.push(`Evaluate ${mark('f')} at the endpoints and the critical points: ${candidates.map((c) => mark(`f(${c.text.replace(/^≈ /, '')}) = ${c.valueText}`)).join(', ')}.`);
  const where = (list) => list.map((c) => mark(`${variable} = ${c.text}`)).join(' and ');
  if (constant) steps.push(`Every value is ${mark(maxima[0].valueText)}: the maximum and the minimum are both ${mark(maxima[0].valueText)}, at every point of ${mark(interval)}.`);
  else if (which !== 'minimum') steps.push(`The largest value is ${mark(maxima[0].valueText)}: the absolute maximum, at ${where(maxima)}.`);
  if (!constant && which !== 'maximum') steps.push(`The smallest value is ${mark(minima[0].valueText)}: the absolute minimum, at ${where(minima)}.`);

  const atText = (list) => list.map((c) => `${variable} = ${c.text}`).join(' and ');
  const plain = (t) => t.replace(/ ≈ .*$/, '');
  const maxAnswer = `maximum ${maxima[0].valueText.includes('≈') && !maxima[0].valueText.startsWith('≈') ? `${plain(maxima[0].valueText)} (≈ ${maxima[0].valueText.split('≈ ')[1]})` : maxima[0].valueText} at ${atText(maxima)}`;
  const minAnswer = `minimum ${minima[0].valueText.includes('≈') && !minima[0].valueText.startsWith('≈') ? `${plain(minima[0].valueText)} (≈ ${minima[0].valueText.split('≈ ')[1]})` : minima[0].valueText} at ${atText(minima)}`;
  const answer = constant
    ? `${maxima[0].valueText} everywhere: f is constant on ${interval}, so its maximum and minimum are both ${maxima[0].valueText}`
    : which === 'maximum' ? `Absolute ${maxAnswer}` : which === 'minimum' ? `Absolute ${minAnswer}` : `Absolute ${maxAnswer}; absolute ${minAnswer}`;

  const pad = Math.max(0.5, (b.x - a.x) * 0.2);
  const marks = [
    ...(which !== 'minimum' ? maxima.map((c) => ({ x: c.x, y: c.y, kind: 'max' })) : []),
    ...(which !== 'maximum' ? minima.map((c) => ({ x: c.x, y: c.y, kind: 'min' })) : []),
  ];
  return {
    steps,
    answer,
    tips: [
      'The closed interval method: find the critical points inside the interval, evaluate f there and at both endpoints, and compare. The largest value is the absolute maximum, the smallest the absolute minimum.',
      `A critical point is only a candidate: ${mark("f′(c) = 0")} does not by itself make ${mark('c')} a maximum or a minimum.`,
      'The endpoints count: on a closed interval the extreme values are often there.',
    ],
    common_mistakes: [
      'Forgetting to evaluate f at the endpoints.',
      'Keeping a critical point that lies outside the interval.',
      `Giving the ${mark(variable)} where the extreme occurs as the extreme value: the maximum is ${mark('f(c)')}, reached at ${mark(`${variable} = c`)}.`,
    ],
    graph: {
      points: sampleFunction(toMath(expr), variable, { min: a.x - pad, max: b.x + pad, step: (b.x - a.x + 2 * pad) / 200 }),
      expression: toMath(expr),
      variable,
      initialWindow: { xMin: a.x - pad, xMax: b.x + pad },
      annotations: { extrema: marks, shaded: { from: a.x, to: b.x, fromLabel: a.text, toLabel: b.text } },
      title: `Graph of f(${variable}) = ${shown} on [${a.text}, ${b.text}]`,
      description: `Indigo: f(${variable}) = ${shown}  |  Shaded: the interval [${a.text}, ${b.text}]  |  Marked: the absolute ${wanted}`,
    },
  };
}
