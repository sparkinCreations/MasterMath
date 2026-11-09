// One equation with constants whose unknown sits inside a single function
// (1.74.0): ln(x + a) = b, sqrt(x) = a, |x − a| = b, a^x = b, sin(a·x) = 1/2,
// 1/x = a. The function is undone (with the condition that makes undoing it
// valid), the inside solved for x by solveForVariable, and every root checked
// in the original at many values of the constants, both signs. Before this,
// each was refused as "could not be rearranged with the constant left as a
// letter".

import { matchingParen } from '../../mathParser.js';
import { math, beautify, splitTerms, stripOuterParens, mark, loadAlgebrite } from '../solverUtils.js';
import { getSettings } from '../../settings.js';
import { solveTrigEquation } from '../trigEquationSolver.js';

const hasLetter = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(t);
const wrap = (t) => (splitTerms(String(t)).length > 1 || /^-/.test(String(t)) || /[*/]/.test(String(t)) ? `(${t})` : String(t));
const letterSymbol = (text) => ['w', 'q', 'u', 'v', 'p'].find((v) => !hasLetter(text, v));

// Positive terms first: "-a + b" reads "b - a".
function positiveFirst(expr) {
  const terms = splitTerms(String(expr).replace(/\s+/g, ''));
  const k = terms.findIndex((t) => !t.signed.startsWith('-'));
  if (k <= 0) return beautify(expr);
  const ordered = [terms[k], ...terms.filter((_, i) => i !== k)];
  return beautify(ordered.map((t, i) => (i === 0 ? t.term : t.signed.startsWith('-') ? ` - ${t.signed.slice(1)}` : ` + ${t.term}`)).join(''));
}

// The single term with the unknown in it, as coefficient · f(arg), with what
// the other side minus the other terms is: (R − rest)/c. Null when the unknown
// is in more than one term, on both sides, or not inside one function.
const FUNCTIONS = ['ln', 'log10', 'sqrt', 'abs', 'sin', 'cos', 'tan'];
function isolate(l, r, target) {
  const terms = (side) => splitTerms(String(side).replace(/\s+/g, ''));
  for (const [a, b] of [[l, r], [r, l]]) {
    const own = terms(a);
    const withTarget = own.filter((t) => hasLetter(t.signed, target));
    if (withTarget.length !== 1 || hasLetter(String(b), target)) continue;
    let t = withTarget[0].signed;
    // A common logarithm arrives as (log(u)/log(10)).
    const common = t.match(/^(-)?(?:(.+?)\*)?\(log\((.*)\)\/log\(10\)\)$/i);
    if (common && matchingParen(`(${common[3]})`, 0) === common[3].length + 1) t = `${common[1] || ''}${common[2] ? `${common[2]}*` : ''}log10(${common[3]})`;
    let m = t.match(/^(-)?(?:(.+?)\*)?(ln|log10|sqrt|abs|sin|cos|tan)(\(.*\))$/i);
    let kind = m && m[3].toLowerCase();
    let arg = m && m[4];
    let base = null;
    if (!m) {
      // A power with a constant base: 2^x, a^(x + 1).
      m = t.match(/^(-)?(?:(.+?)\*)?(\d+(?:\.\d+)?|[a-z]|\([^()]*\))\^(\(.*\)|[a-z0-9]+)$/i);
      if (!m || hasLetter(m[3], target) || /^e$/i.test(m[3])) continue;
      kind = 'power';
      base = stripOuterParens(m[3]);
      arg = m[4];
    }
    if (arg.startsWith('(') && matchingParen(arg, 0) !== arg.length - 1) continue;
    const coefRaw = m[2] || '1';
    if (hasLetter(coefRaw, target) || !hasLetter(arg, target)) continue;
    if (!FUNCTIONS.includes(kind) && kind !== 'power') continue;
    const coef = m[1] ? `-(${coefRaw})` : coefRaw;
    const rest = own.filter((x) => x !== withTarget[0]);
    const moved = [String(b).trim() === '0' && rest.length ? '' : String(b).trim(), ...rest.filter((x) => x.signed !== '0').map((x) => (x.signed.startsWith('-') ? `+${x.signed.slice(1)}` : `-${x.signed}`))].join('');
    const top = positiveFirst(moved.replace(/^\+/, ''));
    const single = splitTerms(top).length === 1;
    const value = coef === '1' ? top : coef === '-(1)' ? positiveFirst(`-(${top})`)
      : single && top.startsWith('-') ? `-${top.slice(1)}/${wrap(beautify(coef))}` : `${wrap(top)}/${wrap(beautify(coef))}`;
    return { kind, base, arg: stripOuterParens(arg), value: beautify(value), coef };
  }
  return null;
}

// The inverse of each function, as replacements for the inside: ln(u) = w is
// u = e^w. A trig function has families of solutions in n; a numeric value
// takes them from the trig solver (π/6 + 2πn), a letter from arcsin, arccos
// and arctan. `requires` is what the constants must satisfy, with its reason.
function inverse(kind, base, w) {
  const W = wrap(w);
  const numeric = !/[a-z]/i.test(w.replace(/\bpi\b|π/g, ''));
  switch (kind) {
    case 'ln': return { inside: [`e^${W}`], step: `Undo the natural logarithm: raise ${mark('e')} to both sides.` };
    case 'log10': return { inside: [`10^${W}`], step: `Undo the base-10 logarithm: raise ${mark('10')} to both sides.` };
    case 'power': return {
      inside: [`ln(${w})/ln(${base})`],
      step: null,
      requires: /[a-z]/i.test(base) ? [[`${base} > 0`, 'a power is defined for a positive base'], [`${base} ≠ 1`, `${mark(`1^x = 1`)} for every ${mark('x')}`]] : [],
    };
    case 'sqrt': return {
      inside: [/^\d+$/.test(w) ? String(Number(w) ** 2) : `${W}^2`],
      step: 'Square both sides.',
      requires: numeric ? [] : [[`${w} ≥ 0`, 'a square root is never negative']],
    };
    case 'abs': return {
      inside: [w, `-${W}`],
      step: `An absolute value equal to ${mark(w)} means the inside is ${mark(w)} or ${mark(`-${W}`)}.`,
      requires: numeric ? [] : [[`${w} ≥ 0`, 'an absolute value is never negative']],
      cases: true,
    };
    case 'sin':
    case 'cos':
    case 'tan': {
      if (numeric) {
        const r = solveTrigEquation(`${kind}(x) = ${w}`, 'x', { angleUnit: 'radians' });
        const text = String(r?.answer || '').split(';')[0];
        if (!r || (r.status && r.status !== 'solved') || !/n ∈ ℤ/.test(text)) return null;
        const families = text.replace(/\s*\(n ∈ ℤ\)\s*$/, '').split(/\s+or\s+/).map((f) => f.replace(/^\s*x\s*=\s*/, '').trim());
        if (families.some((f) => /[a-mo-z≈]/i.test(f.replace(/π/g, '')))) return null;
        return { inside: families, step: `Every solution of ${mark(`${kind}(u) = ${w}`)} is ${families.map((f) => mark(`u = ${f}`)).join(' or ')}, for every whole number ${mark('n')}.`, trig: true };
      }
      const inside = kind === 'sin' ? [`arcsin(${w}) + 2πn`, `π - arcsin(${w}) + 2πn`]
        : kind === 'cos' ? [`arccos(${w}) + 2πn`, `-arccos(${w}) + 2πn`] : [`arctan(${w}) + πn`];
      return {
        inside,
        step: `Every solution of ${mark(`${kind}(u) = ${w}`)} is ${inside.map((f) => mark(`u = ${f}`)).join(' or ')}, for every whole number ${mark('n')}.`,
        requires: kind === 'tan' ? [] : [[`-1 ≤ ${w} ≤ 1`, `${kind === 'sin' ? 'sine' : 'cosine'} takes values only from ${mark('-1')} to ${mark('1')}`]],
        trig: true,
      };
    }
    default: return null;
  }
}

const toMathjs = (s) => String(s).replace(/π(?=[a-z(\d])/gi, 'pi*').replace(/π/g, 'pi').replace(/√\(/g, 'sqrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)').replace(/∛\(/g, 'cbrt(').replace(/∛([a-z0-9]+)/gi, 'cbrt($1)')
  .replace(/\bln\(/g, 'log(').replace(/\barc(sin|cos|tan)\(/g, 'a$1(').replace(/(\d)\s*(?=[a-z(π])/gi, '$1*').replace(/·/g, '*').replace(/−/g, '-')
  .replace(/\)\s*(?=[a-z(])/gi, ')*').replace(/(?<![a-z])([a-z])\s*(?=\()/gi, '$1*');
const realValue = (v) => (typeof v === 'number' ? v : v && typeof v.re === 'number' && Math.abs(v.im) < 1e-12 ? v.re : NaN);

// Is "a ≥ 0", "-1 ≤ b ≤ 1", "a ≠ 1" true at these values?
export function conditionHolds(cond, scope) {
  const parts = String(cond).split(/\s*(≤|≥|<|>|≠)\s*/);
  try {
    const vals = parts.filter((_, i) => i % 2 === 0).map((p) => realValue(math.evaluate(toMathjs(p), { e: Math.E, ...scope })));
    const ops = parts.filter((_, i) => i % 2 === 1);
    if (vals.some((v) => !Number.isFinite(v))) return false;
    return ops.every((op, i) => {
      const [p, q] = [vals[i], vals[i + 1]];
      return op === '≤' ? p <= q + 1e-12 : op === '≥' ? p >= q - 1e-12 : op === '<' ? p < q : op === '>' ? p > q : Math.abs(p - q) > 1e-12;
    });
  } catch { return false; }
}

// Every root put back into the equation at values of the constants of both
// signs where the conditions hold (n = −1, 0, 1 for a family): at least three
// checks, and none may fail.
export function rootsHoldEverywhere(roots, equation, target, conditions = []) {
  const [l, r] = equation.split('=');
  const letters = [...new Set((equation.replace(/(?<![a-z])(?:sin|cos|tan|sqrt|abs|log10|log|ln|exp|pi|e)(?![a-z])/gi, '').match(/(?<![a-z])[a-z](?![a-z])/gi) || []))].filter((v) => v !== target && v !== 'n');
  const vals = [0.73, -0.41, 1.37, -1.9, 0.29, 2.6, -0.83, 0.55, -2.7, 1.12];
  let checked = 0;
  for (let k = 0; k < 14; k += 1) {
    const scope = Object.fromEntries(letters.map((v, i) => [v, vals[(k * 3 + i * 7) % vals.length] * (1 + 0.13 * i)]));
    if (!conditions.every((c) => conditionHolds(c, scope))) continue;
    // ±√(4 − a) is checked with each sign.
    const signed = roots.flatMap((root) => (root.includes('±') ? [root.replace('±', ''), root.replace('±', '-')] : [root]));
    for (const root of signed) {
      for (const n of /(?<![a-z])n(?![a-z])/.test(root) ? [-1, 0, 1] : [0]) {
        let value;
        try { value = realValue(math.evaluate(toMathjs(root), { ...scope, n, e: Math.E })); } catch { continue; }
        if (!Number.isFinite(value)) continue;
        const at = { ...scope, [target]: value, e: Math.E };
        let L; let R;
        try { L = realValue(math.evaluate(toMathjs(l), at)); R = realValue(math.evaluate(toMathjs(r), at)); } catch { return false; }
        if (!Number.isFinite(L) || !Number.isFinite(R)) return false;
        if (Math.abs(L - R) > 1e-7 * (1 + Math.abs(L) + Math.abs(R))) return false;
        checked += 1;
      }
    }
  }
  return checked >= 3;
}

// Undo the function the unknown sits in and solve its inside with `solve`
// (solveForVariable). Returns { relation, steps, requires, trig } or null.
export async function undoOuterFunction(l, r, target, solve) {
  const found = isolate(l, r, target);
  if (!found) return null;
  const inv = inverse(found.kind, found.base, found.value);
  if (!inv) return null;
  const symbol = letterSymbol(`${l}=${r}`);
  if (!symbol) return null;
  // The inside solved for x once, with a fresh letter for its value.
  const solved = await solve(`${found.arg} = ${symbol}`, target);
  if (!solved?.relation) return null;
  const rootsInSymbol = solved.relation.split(/\s+or\s+/).map((p) => p.replace(new RegExp(`^\\s*${target}\\s*=\\s*`), '').trim());
  const roots = [];
  // A linear inside, k·x + c: x = (w − c)/k as a textbook writes it, so
  // sin(2x + a) = 1 is x = (π/2 + 2πn − a)/2, not 1/2·(π/2 + 2πn) − 1/2·a.
  const linear = await linearInverse(found.arg, target);
  for (const inside of inv.inside) {
    if (linear) {
      const shown = tidy(linear(inside));
      if (!roots.includes(shown)) roots.push(shown);
      continue;
    }
    for (const root of rootsInSymbol) {
      const text = root.replace(new RegExp(`(?<![a-z])${symbol}(?![a-z])`, 'g'), root.trim() === symbol ? inside : wrap(inside));
      const shown = tidy(text);
      if (!roots.includes(shown)) roots.push(shown);
    }
  }
  const requires = inv.requires || [];
  const conditions = requires.map(([c]) => c);
  if (!rootsHoldEverywhere(roots, `${l}=${r}`, target, conditions)) return null;
  const degrees = getSettings().angleUnit === 'degrees';
  const show = (t) => (inv.trig && degrees ? t.replace(/2π/g, '360°').replace(/(?<![\d°])π/g, '180°') : t);
  const isolated = `${found.kind === 'power' ? `${wrap(found.base)}^${wrap(found.arg)}` : found.kind === 'log10' ? `log(${beautify(found.arg)})` : found.kind === 'abs' ? `|${beautify(found.arg)}|` : `${found.kind}(${beautify(found.arg)})`} = ${found.value}`;
  const arg = beautify(found.arg);
  const powerStep = found.kind === 'power' ? `Take the natural logarithm of both sides, and the exponent comes down: ${mark(`${wrap(arg)}·ln(${found.base}) = ln(${found.value})`)}` : null;
  const answered = found.arg.replace(/\s+/g, '') === target;
  const steps = [
    ...(found.coef !== '1' || beautify(`${l}`).trim() !== isolated.split(' = ')[0] ? [`Isolate the ${found.kind === 'power' ? 'power' : found.kind === 'abs' ? 'absolute value' : 'function'}: ${mark(isolated)}`] : []),
    powerStep || inv.step,
    ...(answered || found.kind === 'power' ? [] : inv.inside.map((inside) => `${mark(`${arg} = ${show(inside)}`)}`).map((s, i, all) => (all.length > 1 ? `${i === 0 ? 'So' : 'or'} ${s}` : `So ${s}`))),
  ];
  return {
    relation: roots.map((root) => `${target} = ${show(root)}`).join('  or  ') + (inv.trig ? ' (n ∈ ℤ)' : ''),
    steps,
    requires,
    trig: Boolean(inv.trig),
  };
}

// arg = k·x + c, k and c free of x: a function w ↦ (w − c)/k as text.
async function linearInverse(arg, target) {
  try {
    const Algebrite = await loadAlgebrite();
    const run = (e) => String(Algebrite.run(e)).trim();
    if (run(`deg(${arg}, ${target})`) !== '1') return null;
    const k = run(`simplify(coeff(${arg}, ${target}, 1))`);
    const c = run(`simplify(coeff(${arg}, ${target}, 0))`);
    if (/stop|error|nil/i.test(k + c) || hasLetter(k + c, target) || k === '0') return null;
    const cShown = beautify(c);
    return (w) => {
      // |x − a| = b: a + b and a − b, the constant first.
      const plain = /^-?[a-z]$/i.test(w) && /^-[a-z]$/i.test(cShown);
      const top = c === '0' ? w : plain ? `${cShown.slice(1)} ${w.startsWith('-') ? '-' : '+'} ${w.replace(/^-/, '')}`
        : cShown.startsWith('-') ? `${w} + ${cShown.slice(1)}` : `${w} - ${wrap(cShown)}`;
      if (k === '1') return top;
      if (k === '-1') return `-${wrap(top)}`;
      const recip = k.match(/^1\/(\d+|[a-z])$/i);
      if (recip) return `${recip[1]}${wrap(top)}`;
      return `${wrap(top)}/${wrap(beautify(k))}`;
    };
  } catch { return null; }
}

// A root as a textbook writes it: e^b - a, not -a + e^(b).
function tidy(text) {
  let t = beautify(text).replace(/\be\^\(([a-z0-9]+)\)/gi, 'e^$1').replace(/\b10\^\(([a-z0-9]+)\)/gi, '10^$1');
  t = positiveFirst(t).replace(/\+ \(-([^()]+)\)/g, '- $1').replace(/\+ -/g, '- ');
  // -a/(1 - a) reads a/(a - 1).
  t = t.replace(/^-([a-z0-9*^]+)\/\((\d+) - ([a-z])\)$/i, '$1/($3 - $2)');
  return t.replace(/\s+/g, ' ').trim();
}

// N/D = R with the unknown in a denominator: both sides times every such
// denominator gives one equation without fractions, solved by `solve`; a root
// that makes a denominator 0 for some constants is kept with that condition
// (x/(x + a) = b is x = ab/(1 − b), for b ≠ 1 and a ≠ 0).
export async function clearDenominators(l, r, target, Algebrite, solve) {
  const diff = `(${l.trim()}) - (${r.trim()})`;
  let num;
  let den;
  try {
    const together = String(Algebrite.run(`rationalize(${diff})`)).trim();
    num = String(Algebrite.run(`numerator(${together})`)).trim();
    den = String(Algebrite.run(`denominator(${together})`)).trim();
  } catch { return null; }
  // Each typed denominator with the unknown: Algebrite may already have
  // cancelled one ((x² − a²)/(x − a) to x + a), and at each root its
  // factors without the unknown must still not be 0.
  const dens = [];
  try {
    math.parse(diff).traverse((node) => {
      if (node.type === 'OperatorNode' && node.op === '/' && hasLetter(node.args[1].toString(), target)) dens.push(stripOuterParens(node.args[1].toString()));
    });
  } catch { return null; }
  if (!num || !den || /stop|error|nil/i.test(num + den) || !dens.length || !hasLetter(num, target)) return null;
  // Factored first, so x² − a² gives −a and a (not ±|a|), and the root
  // that is a denominator's zero can be seen and rejected.
  let roots = null;
  let divisor = null;
  try {
    const f = String(Algebrite.run(`factor(${num}, ${target})`)).trim();
    const factors = f.split(/\*(?![^()]*\))/).map((t) => stripOuterParens(t.trim().replace(/\^\d+$/, ''))).filter((t) => hasLetter(t, target));
    if (factors.length > 1 && !/\//.test(f)) {
      roots = [];
      for (const factor of factors) {
        const part = await solve(`${factor} = 0`, target);
        if (!part?.relation) { roots = null; break; }
        for (const p of part.relation.split(/\s+or\s+/)) {
          const root = p.replace(new RegExp(`^\\s*${target}\\s*=\\s*`), '').trim();
          if (!roots.includes(root)) roots.push(root);
        }
      }
    }
  } catch { roots = null; }
  if (!roots) {
    const solved = await solve(`${num} = 0`, target);
    if (!solved?.relation) return null;
    roots = solved.relation.split(/\s+or\s+/).map((p) => p.replace(new RegExp(`^\\s*${target}\\s*=\\s*`), '').trim());
    divisor = solved.divisor;
  }
  const requires = [];
  const rejected = [];
  for (const root of [...roots]) {
    for (const d of dens) {
      let at;
      try { at = String(Algebrite.run(`simplify(numerator(simplify(subst((${toAlgebrite(root)}), ${target}, ${d}))))`)).trim(); } catch { return null; }
      if (/stop|error|nil/i.test(at)) return null;
      // A root that makes a denominator 0 for every value of the constants
      // is not a solution: (x² − a²)/(x − a) = 0 keeps x = −a only.
      if (at === '0') { rejected.push(root); roots.splice(roots.indexOf(root), 1); break; }
      if (!/[a-z]/i.test(at)) continue;
      let factors = [];
      try { factors = String(Algebrite.run(`factor(${at})`)).trim().split(/\*(?![^()]*\))/); } catch { factors = [at]; }
      for (const f of factors.map((x) => stripOuterParens(x.trim())).filter((x) => /[a-z]/i.test(x))) {
        const c = nonzeroCondition(f);
        if (!requires.some(([q]) => q === c)) requires.push([c, `otherwise ${mark(`${target} = ${tidy(root)}`)} would make a denominator 0`, root]);
      }
    }
  }
  if (!roots.length) return { none: true };
  return {
    relation: roots.map((root) => `${target} = ${tidy(root)}`).join('  or  '),
    divisor,
    steps: [
      `Multiply both sides by the denominators to clear the fractions: ${mark(`${beautify(num)} = 0`)}`,
      ...rejected.map((root) => `${mark(`${target} = ${tidy(root)}`)} makes a denominator ${mark('0')}, so it is rejected.`),
    ],
    requires: requires.filter(([, , root]) => !rejected.includes(root)).map(([c, why]) => [c, why]),
  };
}
const toAlgebrite = (t) => String(t).replace(/√\(/g, 'sqrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)');

// f ≠ 0 as a textbook writes it: "a ≠ 0", "b ≠ 1" for 1 − b, "a ≠ -b" for a + b.
export function nonzeroCondition(f) {
  const s = String(f).replace(/\s+/g, '');
  const single = s.match(/^-?\d*\*?([a-z])(?:\^\d+)?$/i);
  if (single) return `${single[1]} ≠ 0`;
  let m = s.match(/^(-?\d+(?:\.\d+)?)([+-])([a-z])$/i);
  if (m) return `${m[3]} ≠ ${m[2] === '-' ? m[1] : String(-Number(m[1]))}`;
  m = s.match(/^-?([a-z])([+-])(\d+(?:\.\d+)?|[a-z])$/i);
  if (m) {
    const neg = s.startsWith('-');
    // a − b, −a + b → a ≠ b; a + b, −a − b → a ≠ −b.
    const same = (m[2] === '-') !== neg;
    return `${m[1]} ≠ ${same ? '' : '-'}${m[3]}`;
  }
  return `${beautify(f)} ≠ 0`;
}

// A condition on one constant as a textbook states it: −1 ≤ a + 2 ≤ 1 is
// −3 ≤ a ≤ −1, −a ≥ 0 is a ≤ 0, (b − a ≥ 0) is b ≥ a. Anything else as given.
export async function tidyCondition(cond) {
  const m = String(cond).match(/^(?:(-?\d+)\s*(≤|<)\s*)?(.+?)\s*(≥|>|≤|<)\s*(-?\d+)$/);
  if (!m || /≠/.test(cond)) return cond;
  const [, lowBound, lowOp, w, op, bound] = m;
  const letters = [...new Set(w.match(/(?<![a-z])[a-z](?![a-z])/gi) || [])];
  try {
    const Algebrite = await loadAlgebrite();
    const run = (e) => String(Algebrite.run(e)).trim();
    if (letters.length === 2 && !lowBound && bound === '0') {
      const pair = w.replace(/\s+/g, '').match(/^(-)?([a-z])([+-])([a-z])$/i);
      if (pair && (pair[1] ? '+' : '-') !== pair[3]) return cond;
      if (pair) return pair[1] ? `${pair[4]} ${op} ${pair[2]}` : `${pair[2]} ${op} ${pair[4]}`;
      return cond;
    }
    if (letters.length !== 1) return cond;
    const L = letters[0];
    if (run(`deg(${w.replace(/π/g, 'pi')}, ${L})`) !== '1') return cond;
    const k = run(`coeff(${w}, ${L}, 1)`);
    const c = run(`coeff(${w}, ${L}, 0)`);
    if (/[a-z]/i.test(k + c) || Number(math.evaluate(k)) === 0) return cond;
    const neg = Number(math.evaluate(k)) < 0;
    const at = (B) => beautify(run(`(${B} - (${c}))/(${k})`));
    const flip = { '≥': '≤', '≤': '≥', '>': '<', '<': '>' };
    if (lowBound) {
      const [p, q] = [at(lowBound), at(bound)];
      return neg ? `${q} ${lowOp} ${L} ${lowOp} ${p}` : `${p} ${lowOp} ${L} ${op} ${q}`;
    }
    return `${L} ${neg ? flip[op] : op} ${at(bound)}`;
  } catch { return cond; }
}
