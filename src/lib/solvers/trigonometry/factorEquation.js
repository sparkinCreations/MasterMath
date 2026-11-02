// Trig equations in sin, cos, tan, sec, csc and cot of one argument, solved
// exactly by the textbook route: write every function in sin and cos (each
// tan, sec, cot or csc excludes the angles where its denominator is 0),
// clear the fractions, move everything to one side and factor. Each factor
// is then a polynomial in sin and cos:
//
//   only sin, or only cos   its roots in [−1, 1] give sin θ = s or cos θ = c;
//   one total degree        (sin² − 3cos²) divided by cos^d, a polynomial in
//                           tan θ (cos θ = 0 checked first, never divided by);
//   anything else           P(cos) + sin·Q(cos) after sin² = 1 − cos²; where
//                           Q ≠ 0, sin = −P/Q, so P² = (1 − cos²)Q², whose
//                           roots each fix one angle, checked unsquared.
//
// Every polynomial goes to the exact root finder, so every factor's angles
// are all of them. The angles of one period are joined, the excluded ones
// removed, and the set written as the fewest families: tan(x) = sin(x) is
// sin(x)·(1 − cos(x)) = 0, so sin(x) = 0 (x = πn) or cos(x) = 1 (x = 2πn),
// together x = πn. It was solved numerically: five roots nearest 0, the two
// at ±2π wrong in the third decimal (1.67.2).
//
// solveTrigEquationExact is the entry the callers use: the reductions in
// trigEquationSolver.js first, then this.

import { math, beautify, formatNumber, mark, linearCoefficients, loadAlgebrite } from '../solverUtils.js';
import { parseMathExpression } from '../../mathParser.js';
import { getSettings } from '../../settings.js';
import { STATUS, undefinedValue } from '../../solutionEnvelope.js';
import { solveTrigEquation, angleText, familyText } from '../trigEquationSolver.js';
import { realRoots, safeRun } from '../inequalities/roots.js';
import { equationGuidance } from './guidance.js';

const TWO_PI = 2 * Math.PI;
const TINY = 1e-9;
const TRIG = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
const IN_SIN_COS = { sin: 'S', cos: 'C', tan: '(S/C)', sec: '(1/C)', csc: '(1/S)', cot: '(C/S)' };

export async function solveTrigEquationExact(rawEquation, variable = 'x', settingsOverride) {
  const exact = solveTrigEquation(rawEquation, variable, settingsOverride);
  if (exact.status !== STATUS.UNSUPPORTED) return exact;
  let factored = null;
  try {
    factored = await solveByFactoring(rawEquation, variable, (settingsOverride?.angleUnit ?? getSettings().angleUnit) === 'degrees');
  } catch {
    factored = null;
  }
  if (!factored) return exact;
  const guidance = equationGuidance(factored);
  const out = guidance ? { ...factored, ...guidance } : factored;
  return out.status === STATUS.UNDEFINED ? { ...out, status: STATUS.SOLVED } : out;
}

const mod2pi = (t) => ((t % TWO_PI) + TWO_PI) % TWO_PI;
const sameAngle = (a, b) => Math.abs(a - b) < TINY || Math.abs(Math.abs(a - b) - TWO_PI) < TINY;
const addAngle = (list, t) => { const a = mod2pi(t); if (!list.some((b) => sameAngle(a, b))) list.push(a); };

// The equation read as F(sin u, cos u) = 0 with u = kx + d: { expr (in S and
// C), arg, k, d, fns }, or null when it is not of that form.
function readForm(equation, v) {
  const [lhs, rhs, extra] = equation.split('=');
  if (!lhs || rhs === undefined || extra !== undefined) return null;
  let tree;
  try { tree = math.parse(`(${lhs}) - (${rhs})`); } catch { return null; }
  let arg = null;
  let ok = true;
  const fns = new Set();
  const hasV = (n) => n.filter((m) => m.type === 'SymbolNode' && m.name === v).length > 0;
  tree.traverse((n) => {
    if (n.type !== 'FunctionNode') return;
    const name = n.fn?.name;
    if (!TRIG.includes(name)) { if (hasV(n)) ok = false; return; }
    const a = n.args[0]?.toString();
    if (arg === null) arg = a; else if (a !== arg) ok = false;
    fns.add(name);
  });
  if (!ok || arg === null) return null;
  const line = linearCoefficients(arg, v);
  if (!line || line.k === 0) return null;
  let bad = false;
  const inSC = tree.transform((n) => {
    if (n.type === 'FunctionNode' && TRIG.includes(n.fn?.name)) return math.parse(IN_SIN_COS[n.fn.name]);
    return n;
  });
  inSC.traverse((n) => {
    if (n.type === 'SymbolNode' && n.name === v) bad = true; // x outside the trig calls
    if (n.type === 'OperatorNode' && n.op === '^') {
      const e = n.args[1];
      let p = null;
      try { p = e.evaluate({}); } catch { p = null; }
      if (!(Number.isInteger(p) && p >= 0 && p <= 12)) bad = true;
    }
  });
  // A trig expression divided by another (1/(1 + cos x)) is not this form.
  tree.traverse((n) => {
    if (n.type === 'OperatorNode' && n.op === '/' && n.args[1].filter((m) => m.type === 'FunctionNode' && TRIG.includes(m.fn?.name)).length) bad = true;
  });
  if (bad) return null;
  return { expr: inSC.toString(), arg, k: line.k, d: line.d, fns };
}

// The factors of a polynomial in S and C (constants and repeats dropped).
function factorsOf(A, N) {
  const pick = [safeRun(A, `factor(${N},S)`), safeRun(A, `factor(${N},C)`)].filter(Boolean);
  const split = (text) => {
    let tree;
    try { tree = math.parse(text); } catch { return [text]; }
    const out = [];
    const walk = (n) => {
      if (n.type === 'ParenthesisNode') return walk(n.content);
      if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') return walk(n.args[0]);
      if (n.type === 'OperatorNode' && n.op === '*') return n.args.forEach(walk);
      if (n.type === 'OperatorNode' && n.op === '^') return walk(n.args[0]);
      if (n.filter((m) => m.type === 'SymbolNode' && (m.name === 'S' || m.name === 'C')).length === 0) return undefined;
      out.push(n.toString());
      return undefined;
    };
    walk(tree);
    return out;
  };
  const options = pick.map(split).filter((f) => f.length);
  if (!options.length) return [N];
  const best = options.sort((a, b) => b.length - a.length)[0];
  return [...new Set(best.map((f) => safeRun(A, `expand(${f})`) || f))];
}

const hasSym = (text, s) => new RegExp(`(?<![A-Za-z])${s}(?![A-Za-z])`).test(text);
// mathjs, not Algebrite's float(), which prints six digits: a true root
// then failed sin² + cos² = 1 (sin(x) + tan(x) = 1 came out "No solution").
const valueAt = (text, scope) => {
  try {
    const y = math.evaluate(String(text), scope);
    return typeof y === 'number' ? y : NaN;
  } catch { return NaN; }
};
// The real roots of a polynomial in one of S, C, T, with exact labels:
// Algebrite's roots() reads x, so the symbol is renamed first. A root finder
// that gives up is thrown, never read as "no roots": the factor's angles
// would be missing from an answer that looks complete.
class Incomplete extends Error {}
const rootsIn = (A, text, sym, labels) => {
  const roots = realRoots(A, String(text).replace(new RegExp(`(?<![A-Za-z])${sym}(?![A-Za-z])`, 'g'), 'x'), 'x', labels);
  if (!Array.isArray(roots)) throw new Incomplete();
  return roots;
};

// The angles θ in [0, 2π) where one factor is 0, with how they were found:
// { angles, how, values } (values: the exact sin/cos/tan values, as text).
function factorAngles(A, F) {
  const angles = [];
  const labels = new Map();
  // A long nested surd reads worse than its decimal (sin(x) + tan(x) = 1).
  const shown = (r) => {
    const label = labels.get(Number(r).toFixed(9));
    return label && label.length <= 16 ? label : `≈ ${formatNumber(r)}`;
  };
  if (hasSym(F, 'S') && !hasSym(F, 'C')) {
    const roots = rootsIn(A, F, 'S', labels).filter((s) => Math.abs(s) <= 1 + TINY);
    for (const s of roots) { const t = Math.asin(Math.max(-1, Math.min(1, s))); addAngle(angles, t); addAngle(angles, Math.PI - t); }
    return { angles, how: 'sin', values: roots.map(shown) };
  }
  if (hasSym(F, 'C') && !hasSym(F, 'S')) {
    const roots = rootsIn(A, F, 'C', labels).filter((c) => Math.abs(c) <= 1 + TINY);
    for (const c of roots) { const t = Math.acos(Math.max(-1, Math.min(1, c))); addAngle(angles, t); addAngle(angles, -t); }
    return { angles, how: 'cos', values: roots.map(shown) };
  }
  // One total degree: F(λS, λC) = λ^d·F(S, C).
  const d = homogeneousDegree(A, F);
  if (d > 0) {
    // cos θ = 0 (sin θ = ±1) first: dividing by cos^d there would lose it.
    for (const t of [Math.PI / 2, 3 * Math.PI / 2]) if (Math.abs(valueAt(F, { S: Math.round(Math.sin(t)), C: 0 })) < TINY) addAngle(angles, t);
    const inTan = safeRun(A, `expand(subst(1,C,subst(T,S,${F})))`);
    const roots = inTan && hasSym(inTan, 'T') ? rootsIn(A, inTan, 'T', labels) : [];
    for (const t of roots) { addAngle(angles, Math.atan(t)); addAngle(angles, Math.atan(t) + Math.PI); }
    return { angles, how: 'tan', values: roots.map(shown), degree: d };
  }
  // P(C) + S·Q(C), with S² = 1 − C².
  const deg = Number(safeRun(A, `deg(${F},S)`));
  if (!Number.isInteger(deg) || deg < 1) return null;
  let P = '0';
  let Q = '0';
  for (let j = 0; j <= deg; j += 1) {
    const c = safeRun(A, `coeff(${F},S,${j})`);
    if (!c || c === '0') continue;
    if (j % 2 === 0) P = `(${P}) + (${c})*(1-C^2)^${j / 2}`;
    else Q = `(${Q}) + (${c})*(1-C^2)^${(j - 1) / 2}`;
  }
  P = safeRun(A, `expand(${P})`);
  Q = safeRun(A, `expand(${Q})`);
  if (P === null || Q === null) return null;
  if (Q === '0') {
    const roots = hasSym(P, 'C') ? rootsIn(A, P, 'C', labels).filter((c) => Math.abs(c) <= 1 + TINY) : [];
    for (const c of roots) { const t = Math.acos(Math.max(-1, Math.min(1, c))); addAngle(angles, t); addAngle(angles, -t); }
    return { angles, how: 'cos via sin²', values: roots.map(shown) };
  }
  const R = safeRun(A, `expand((${P})^2 - (1-C^2)*(${Q})^2)`);
  if (!R || !hasSym(R, 'C')) return null;
  const roots = rootsIn(A, R, 'C', labels).filter((c) => Math.abs(c) <= 1 + TINY);
  const at = (text, c) => valueAt(text, { C: c });
  for (const c of roots) {
    const cc = Math.max(-1, Math.min(1, c));
    const q = at(Q, cc);
    const p = at(P, cc);
    if (Math.abs(q) > TINY) {
      const s = -p / q;
      if (Math.abs(s * s + cc * cc - 1) < 1e-7) addAngle(angles, Math.atan2(s, cc));
    } else if (Math.abs(p) < TINY) {
      addAngle(angles, Math.acos(cc)); addAngle(angles, -Math.acos(cc));
    }
  }
  return { angles, how: 'squared', values: roots.map(shown), P, Q };
}

// The factors' families joined as a textbook writes them: one contained in
// another is dropped (2πn in πn), two half a period apart become one (0 + 2πn
// and π + 2πn are πn); the rest stay as found.
function joinFamilies(list) {
  const inside = (f, g) => {
    const r = f.period / g.period;
    return Math.abs(r - Math.round(r)) < TINY && Math.round(r) >= 1 && Math.abs(mod2pi(((f.base - g.base) % g.period + g.period) % g.period) % g.period) < TINY;
  };
  let out = [...list];
  for (let changed = true; changed;) {
    changed = false;
    out = out.filter((f, i) => !out.some((g, j) => j !== i && inside(f, g) && (!inside(g, f) || j < i)));
    for (let i = 0; i < out.length && !changed; i += 1) {
      for (let j = i + 1; j < out.length && !changed; j += 1) {
        const [f, g] = [out[i], out[j]];
        if (Math.abs(f.period - g.period) > TINY) continue;
        const gap = ((g.base - f.base) % f.period + f.period) % f.period;
        if (Math.abs(gap - f.period / 2) < TINY) {
          out.splice(j, 1);
          out[i] = { base: Math.min(f.base, g.base) % (f.period / 2), period: f.period / 2 };
          changed = true;
        }
      }
    }
  }
  return out.sort((p, q) => p.base - q.base || p.period - q.period);
}

// d when every term of F has total degree d in S and C, else 0.
function homogeneousDegree(A, F) {
  const scaled = safeRun(A, `expand(subst(L*C,C,subst(L*S,S,${F})))`);
  const d = scaled ? Number(safeRun(A, `deg(${scaled},L)`)) : NaN;
  return Number.isInteger(d) && d > 0 && safeRun(A, `expand(${scaled} - L^${d}*(${F}))`) === '0' ? d : 0;
}

// F with every sin² written 1 − cos²: P(C) + S·Q(C) expanded, or null.
function reducePythagorean(A, F) {
  const deg = Number(safeRun(A, `deg(${F},S)`));
  if (!Number.isInteger(deg) || deg < 2) return F;
  let out = '0';
  for (let j = 0; j <= deg; j += 1) {
    const c = safeRun(A, `coeff(${F},S,${j})`);
    if (!c || c === '0') continue;
    out = `(${out}) + (${c})*(1-C^2)^${Math.floor(j / 2)}*S^${j % 2}`;
  }
  return safeRun(A, `expand(${out})`);
}

// A set of angles in [0, 2π) as the fewest families base + (2π/m)·n:
// whole orbits first, largest first ({0, π/3, π, 5π/3} is πn, π/3 + 2πn and
// 5π/3 + 2πn, not four families of 2π).
function families(angles) {
  const all = [...angles].sort((p, q) => p - q);
  const inSet = (t) => all.some((b) => sameAngle(mod2pi(t), b));
  let left = [...all];
  const out = [];
  for (let m = all.length; m >= 1 && left.length; m -= 1) {
    const step = TWO_PI / m;
    for (const a of [...left]) {
      if (!left.some((b) => sameAngle(a, b))) continue;
      const orbit = Array.from({ length: m }, (_, j) => mod2pi(a + j * step));
      if (!orbit.every(inSet)) continue;
      out.push({ base: Math.min(...orbit.filter((t) => t < step - TINY)), period: step });
      left = left.filter((b) => !orbit.some((t) => sameAngle(t, b)));
    }
  }
  return out.sort((p, q) => p.base - q.base);
}

const isExactAngle = (text) => /π|^-?0$|°$/.test(text) && !/\.\d{3,}/.test(text);

async function solveByFactoring(rawEquation, v, degrees) {
  const equation = parseMathExpression(rawEquation);
  const form = readForm(equation, v);
  if (!form) return null;
  const A = await loadAlgebrite();
  const rational = safeRun(A, `rationalize(${form.expr})`);
  if (!rational) return null;
  const N = safeRun(A, `numerator(${rational})`);
  if (!N || !(hasSym(N, 'S') || hasSym(N, 'C'))) return null;
  if (!/^[SC\d\s+\-*^()/]+$/.test(N)) return null;
  // A factor that is not in one function, nor of one degree, is first
  // written with sin² = 1 − cos², then factored again: 1 − sin·cos − sin²
  // is cos·(cos − sin).
  const direct = (F) => !(hasSym(F, 'S') && hasSym(F, 'C')) || homogeneousDegree(A, F) > 0;
  let reduced = null;
  const factors = factorsOf(A, N).flatMap((F) => {
    if (direct(F)) return [F];
    const R = reducePythagorean(A, F);
    if (!R || R === F) return [F];
    reduced = reducePythagorean(A, N) || R;
    return factorsOf(A, R);
  });
  // Any factor not solved completely leaves the whole equation to the
  // numeric path, which says its list is partial.
  let solvedFactors;
  try {
    solvedFactors = factors.map((F) => ({ F, ...factorAngles(A, F) }));
  } catch (error) {
    if (error instanceof Incomplete) return null;
    throw error;
  }
  if (solvedFactors.some((f) => !f.angles)) return null;

  const { arg, k, d } = form;
  const theta = k === 1 && d === 0 ? v : 'θ';
  const argShown = beautify(arg);
  const inWords = (text) => beautify(String(text).replace(/(?<![A-Za-z])S(?![A-Za-z])/g, `sin(${argShown})`).replace(/(?<![A-Za-z])C(?![A-Za-z])/g, `cos(${argShown})`).replace(/(?<![A-Za-z])T(?![A-Za-z])/g, `tan(${argShown})`)).replace(/\s*\*\s*/g, '·');
  const bracket = (text) => (/[+-]/.test(text.replace(/^-/, '')) ? `(${text})` : text);
  // Angles where a denominator is 0: cos for tan and sec, sin for cot and csc.
  const cosOut = form.fns.has('tan') || form.fns.has('sec');
  const sinOut = form.fns.has('cot') || form.fns.has('csc');
  const excluded = (t) => (cosOut && Math.abs(Math.cos(t)) < TINY) || (sinOut && Math.abs(Math.sin(t)) < TINY);

  const all = [];
  for (const f of solvedFactors) for (const t of f.angles) addAngle(all, t);
  const removed = all.filter(excluded);
  const kept = all.filter((t) => !excluded(t));

  // Every angle checked in the original equation.
  const [lhs, rhs] = equation.split('=');
  const residual = (x) => {
    try {
      const y = math.evaluate(`(${lhs}) - (${rhs})`, { [v]: x });
      return typeof y === 'number' ? Math.abs(y) : NaN;
    } catch { return NaN; }
  };
  const toX = (t) => (t - d) / k;
  if (!kept.every((t) => residual(toX(t)) < 1e-7)) return null;

  const familyLine = (fams) => fams.map(({ base, period }) => {
    const bx = ((toX(base) % (period / Math.abs(k))) + period / Math.abs(k)) % (period / Math.abs(k));
    const text = familyText(v, bx, period / Math.abs(k), degrees);
    return isExactAngle(angleText(bx, degrees)) ? text : text.replace(`${v} = `, `${v} ≈ `);
  }).join('  or  ');
  const thetaLine = (fams) => fams.map(({ base, period }) => {
    const text = familyText(theta, base, period, degrees);
    return isExactAngle(angleText(base, degrees)) ? text : text.replace(`${theta} = `, `${theta} ≈ `);
  }).join('  or  ');

  const steps = [`Solve the equation: ${mark(beautify(rawEquation).replace(/\s*=\s*/, ' = '))}`];
  if (degrees) steps.push('Angle unit is set to degrees (Settings): angles are reported in degrees.');
  const rewrites = [...form.fns].filter((f) => !['sin', 'cos'].includes(f)).map((f) => ({
    tan: `tan(${argShown}) = sin(${argShown})/cos(${argShown})`,
    sec: `sec(${argShown}) = 1/cos(${argShown})`,
    csc: `csc(${argShown}) = 1/sin(${argShown})`,
    cot: `cot(${argShown}) = cos(${argShown})/sin(${argShown})`,
  })[f]);
  if (rewrites.length) {
    const outs = [cosOut && `cos(${argShown}) = 0`, sinOut && `sin(${argShown}) = 0`].filter(Boolean);
    steps.push(`Write each function in terms of sine and cosine: ${rewrites.map(mark).join(', ')}. These are undefined where ${outs.map(mark).join(' or ')}, so those angles are excluded.`);
    steps.push(`Multiply through to clear the fractions and move everything to one side: ${mark(`${inWords(N)} = 0`)}`);
  } else {
    steps.push(`Move everything to one side: ${mark(`${inWords(N)} = 0`)}`);
  }
  if (reduced) {
    steps.push(`Write ${mark(`sin(${argShown})^2 = 1 − cos(${argShown})^2`)}: ${mark(`${inWords(reduced)} = 0`)}`);
  }
  if (factors.length > 1) {
    steps.push(`Factor: ${mark(`${factors.map((F) => bracket(inWords(F))).join('·')} = 0`)}, so one of the factors is ${mark('0')}.`);
  }
  if (theta !== v) steps.push(`Let ${mark(`θ = ${argShown}`)} and solve for ${mark('θ')} first.`);
  // The factor lines are in θ once θ is named.
  const inTheta = (text) => (theta === v ? inWords(text) : inWords(text).split(`(${argShown})`).join('(θ)'));
  for (const f of solvedFactors) {
    const head = factors.length > 1 ? `${mark(`${inTheta(f.F)} = 0`)}: ` : '';
    const fams = families(f.angles);
    const sol = f.angles.length ? mark(thetaLine(fams)) : 'no real solution';
    const fnTheta = (fn) => `${fn}(${theta === v ? argShown : 'θ'})`;
    const list = (fn) => (f.values.length ? f.values.map((x) => mark(`${fnTheta(fn)} ${x.startsWith('≈') ? x : `= ${x}`}`)).join(' or ') : null);
    if (f.how === 'sin' || f.how === 'cos') {
      const values = list(f.how);
      const bare = inTheta(f.F) === fnTheta(f.how);
      const lead = factors.length > 1 ? mark(`${inTheta(f.F)} = 0`) : '';
      steps.push(values
        ? `${lead}${bare ? '' : `${lead ? ' means ' : ''}${values}`}, so ${sol}.`.replace(/^, so /, 'So ')
        : `${lead}${lead ? ': ' : ''}no value of ${mark(fnTheta(f.how))} in ${mark('[−1, 1]')} works, so ${sol}.`);
    } else if (f.how === 'tan') {
      steps.push(`${head}every term has degree ${mark(String(f.degree))} in sine and cosine, and ${mark(`${fnTheta('cos')} = 0`)} does not satisfy it${f.angles.some((t) => Math.abs(Math.cos(t)) < TINY) ? ' except where noted' : ''}, so divide by ${mark(f.degree === 1 ? fnTheta('cos') : `${fnTheta('cos')}^${f.degree}`)}: ${list('tan') ?? `no real value of ${mark(fnTheta('tan'))}`}, so ${sol}.`);
    } else if (f.how === 'cos via sin²') {
      steps.push(`${head}write ${mark(`${fnTheta('sin')}^2 = 1 − ${fnTheta('cos')}^2`)}: ${list('cos') ?? 'no value in range'}, so ${sol}.`);
    } else {
      steps.push(`${head}write ${mark(`${fnTheta('sin')}^2 = 1 − ${fnTheta('cos')}^2`)}, isolate ${mark(fnTheta('sin'))} and square; each root ${list('cos') ?? ''} is kept only where the unsquared factor is ${mark('0')}: ${sol}.`);
    }
  }
  if (removed.length) {
    steps.push(`Remove the excluded angles, where the original equation is undefined: ${mark(removed.map((t) => `${theta} = ${angleText(t, degrees)}`).join(', '))} (and every period after).`);
  }
  if (!kept.length) {
    const result = undefinedValue({ input: rawEquation, reason: 'No angle satisfies every factor condition and the domain.', steps });
    result.answer = 'No real solution';
    return result;
  }
  const fams = joinFamilies(solvedFactors.flatMap((f) => families(f.angles.filter((t) => !excluded(t)))));
  const general = familyLine(fams);
  if (solvedFactors.length > 1 || removed.length || theta !== v) {
    steps.push(`Together (${mark('n')} any integer): ${mark(general)}${solvedFactors.length > 1 ? ', each angle listed once' : ''}.`);
  } else {
    steps.push(`General solution (${mark('n')} any integer): ${mark(general)}`);
  }
  // One period's worth in x.
  const xs = [];
  for (const { base, period } of fams) {
    const px = period / Math.abs(k);
    const bx = ((toX(base) % px) + px) % px;
    for (let x = bx; x < TWO_PI - TINY; x += px) if (!xs.some((y) => Math.abs(y - x) < TINY)) xs.push(x);
  }
  xs.sort((p, q) => p - q);
  const exactAll = xs.every((x) => isExactAngle(angleText(x, degrees)));
  const range = degrees ? '[0°, 360°)' : '[0, 2π)';
  steps.push(`On ${mark(range)}: ${mark(xs.map((x) => `${v} ${isExactAngle(angleText(x, degrees)) ? '=' : '≈'} ${angleText(x, degrees)}`).join(',  '))}`);
  steps.push(`Check: substituting each value back into the original equation balances both sides.`);

  const toShown = (x) => (degrees ? (x * 180) / Math.PI : x);
  const graphPoints = (text) => {
    const pts = [];
    for (let x = -TWO_PI; x <= TWO_PI + 1e-9; x += 0.02) {
      let y;
      try { y = math.evaluate(text, { [v]: x }); } catch { y = NaN; }
      if (typeof y === 'number' && Number.isFinite(y) && Math.abs(y) <= 6) pts.push({ x: Math.round(toShown(x) * 1e6) / 1e6, y });
    }
    return pts;
  };
  return {
    steps,
    answer: `${general} (n ∈ ℤ);  on ${range}: ${exactAll ? '' : `${v} ≈ `}${xs.map((x) => angleText(x, degrees)).join(', ')}`,
    tips: [],
    common_mistakes: [],
    graph: {
      points: graphPoints(lhs),
      secondaryPoints: graphPoints(rhs),
      secondaryLabel: `y = ${beautify(rhs)}`,
      title: `Graph of y = ${beautify(lhs)} and y = ${beautify(rhs)}${degrees ? ` (${v} in degrees)` : ''}`,
      description: `Solutions are where the two curves meet. Marked: the solutions on ${range}.`,
      solutions: xs.map(toShown),
      initialWindow: { xMin: toShown(-TWO_PI), xMax: toShown(TWO_PI) },
    },
  };
}
