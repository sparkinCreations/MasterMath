// A limit with a parameter (1.74.0): lim x→0 sin(a·x)/x = a,
// lim x→∞ (a·x + 1)/(x + 2) = a, lim x→a (x² − a²)/(x − a) = 2a,
// lim x→0 (1 + a·x)^(1/x) = e^a. The parameter is held fixed and the limit
// found in it: by substitution where the expression is defined at the point
// (with the condition that it is), by L'Hôpital's rule where top and bottom
// are both 0 for every value of the parameter, through logarithms for 1^∞,
// and by leading coefficients at ±∞ for a ratio of polynomials. Every answer
// is compared with the function's own values near the point at several
// values of the parameter, both signs; the value is never read off samples.

import { math, beautify, mark, splitTopLevel, stripOuterParens } from '../solverUtils.js';
import { nonzeroCondition, tidyCondition } from '../algebra/undoOuter.js';
import { constantRequirements } from '../utils/conditions.js';
import { parseRootsList, IMAGINARY } from '../algebra/rootsFormat.js';

// a + 1 ≥ 0 reads a ≥ -1, synchronously: one letter, coefficient 1.
function tidyConditionSync(c) {
  const m = String(c).replace(/\s+/g, '').match(/^(?:([a-z])([+-]\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\+([a-z]))(≥|>|≠)0$/i);
  if (!m) return c;
  const letter = m[1] || m[4];
  const k = m[2] ? Number(m[2]) : Number(m[3]);
  return `${letter} ${m[5]} ${-k}`;
}
const hasLetter = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(t);
const FUNCTION_NAMES = /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|abs|log|ln|exp|pi|e|infinity|inf)(?![a-z])/gi;
const wrap = (t) => (/[+\-*/ ]/.test(String(t).replace(/^-/, '')) || /^-/.test(String(t)) ? `(${t})` : String(t));

export function parameterLetters(text, variable) {
  return [...new Set((String(text).replace(FUNCTION_NAMES, ' ').match(/(?<![a-z])[a-z](?![a-z])/gi) || []).map((c) => c.toLowerCase()))].filter((c) => c !== variable).sort();
}

const toAlg = (t) => String(t).replace(/(?<![a-z])ln\(/g, 'log(').replace(/π/g, 'pi');
const toMathjs = (t) => String(t).replace(/(?<![a-z])ln\(/g, 'log(').replace(/π/g, 'pi');
const failed = (o) => !o || /nil|stop|error|infinity|undefined/i.test(o);

// The function's values near the point, at one value of the parameters: the
// two sides at shrinking steps (or growing x at ±∞), settled to 1e-4.
function nearValue(func, variable, target, scope) {
  const at = (x) => {
    try {
      const v = math.evaluate(toMathjs(func), { ...scope, [variable]: x, e: Math.E });
      return typeof v === 'number' ? v : v && typeof v.re === 'number' && Math.abs(v.im) < 1e-12 ? v.re : NaN;
    } catch { return NaN; }
  };
  if (!Number.isFinite(target)) {
    const s = Math.sign(target);
    const ladder = [1e3, 1e4, 1e5, 1e6].map((x) => at(s * x));
    if (ladder.some((v) => !Number.isFinite(v))) {
      const big = ladder.filter(Number.isFinite);
      return big.length >= 2 && Math.abs(big.at(-1)) > 1e8 ? Math.sign(big.at(-1)) * Infinity : NaN;
    }
    const [, , p, q] = ladder;
    if (Math.abs(q) > 1e5 && Math.abs(q) > 5 * Math.abs(p) * 0.99 && Math.sign(p) === Math.sign(q)) return Math.sign(q) * Infinity;
    return Math.abs(p - q) <= 1e-4 * (1 + Math.abs(q)) ? q : NaN;
  }
  const sides = [1, -1].map((s) => [1e-4, 1e-5, 1e-6].map((h) => at(target + s * h * (1 + Math.abs(target)))));
  const settled = sides.map((ladder) => (ladder.every(Number.isFinite) && Math.abs(ladder[1] - ladder[2]) <= 1e-4 * (1 + Math.abs(ladder[2])) ? ladder[2] : NaN));
  const usable = settled.filter(Number.isFinite);
  if (!usable.length) return NaN;
  if (usable.length === 2 && Math.abs(usable[0] - usable[1]) > 1e-3 * (1 + Math.abs(usable[0]))) return NaN;
  return usable[0];
}

// The value at several values of the parameters where the conditions hold:
// at least three comparisons, none failing.
function agreesNearby(func, variable, targetText, valueText, letters, conditions = []) {
  const vals = [0.7, -1.3, 1.9, -0.45, 2.6, -2.2, 0.35, 1.15, -0.8, 3.1];
  let compared = 0;
  for (let k = 0; k < 12; k += 1) {
    const scope = Object.fromEntries(letters.map((c, j) => [c, vals[(k * 3 + j * 7) % vals.length] * (1 + 0.09 * j)]));
    if (!conditions.every((c) => conditionTrue(c, scope))) continue;
    let target;
    try { target = /^[+-]?∞$|infinity/i.test(targetText) ? (/-/.test(targetText) ? -Infinity : Infinity) : Number(math.evaluate(toMathjs(targetText), scope)); } catch { continue; }
    let value;
    try { value = valueText === '∞' ? Infinity : valueText === '-∞' ? -Infinity : Number(math.evaluate(toMathjs(valueText), { ...scope, e: Math.E })); } catch { return false; }
    const near = nearValue(func, variable, target, scope);
    if (Number.isNaN(near)) continue; // not settled here: decides nothing
    if (!Number.isFinite(value) || !Number.isFinite(near)) {
      if (value !== near) return false;
    } else if (Math.abs(near - value) > 1e-3 * (1 + Math.abs(value))) return false;
    compared += 1;
  }
  return compared >= 3;
}

function conditionTrue(cond, scope) {
  const m = String(cond).match(/^(.+?)\s*(≠|>|<|≥|≤)\s*(.+)$/);
  if (!m) return true;
  try {
    const [p, q] = [Number(math.evaluate(toMathjs(m[1]), scope)), Number(math.evaluate(toMathjs(m[3]), scope))];
    return m[2] === '≠' ? Math.abs(p - q) > 1e-9 : m[2] === '>' ? p > q : m[2] === '<' ? p < q : m[2] === '≥' ? p >= q : p <= q;
  } catch { return false; }
}

// "D ≠ 0" for a constant expression D, as conditions on the letters: each
// real root of a one-letter D excluded (a ≠ 3), else factor by factor.
function nonzeroConditions(D, letters, run) {
  if (!/[a-z]/i.test(D)) return [];
  if (letters.length === 1 && hasLetter(D, letters[0])) {
    try {
      const roots = parseRootsList(run(`roots(${D}, ${letters[0]})`)).filter((rt) => !IMAGINARY.test(rt.display) && Number.isFinite(rt.numeric));
      if (roots.length) return roots.map((rt) => `${letters[0]} ≠ ${rt.display}`);
    } catch { /* fall through */ }
  }
  return [nonzeroCondition(D)];
}

// i is the imaginary unit, never a real parameter: sampled as a real number
// it "verified" lim x→0 sin(i·x)/x = i. Complex-valued limits are refused.
export const hasImaginaryUnit = (text) => /(?<![a-z])i(?![a-z])/i.test(String(text));

export async function limitWithParameter({ Algebrite, func, variable, target, targetText, side = 0, letters, solveCase }) {
  if (letters.includes('i') || hasImaginaryUnit(func) || hasImaginaryUnit(targetText)) return null;
  const run = (e) => { const o = String(Algebrite.run(e)).trim(); if (failed(o) && o !== '0') throw new Error(o); return o; };
  const f = toAlg(func);
  // (sin(n·x)/x) with brackets round the whole: read inside them.
  const inner = stripOuterParens(String(func).trim());
  const at = (expr, t = targetText) => run(`simplify(subst((${t}), ${variable}, ${expr}))`);
  const shownTarget = Number.isFinite(target) || target === undefined ? beautify(targetText) : target > 0 ? '∞' : '-∞';
  const intro = letters.length === 1
    ? `The letter ${mark(letters[0])} is a parameter: a fixed number. Find the limit with it held fixed.`
    : `The letters ${letters.slice(0, -1).map((c) => mark(c)).join(', ')} and ${mark(letters.at(-1))} are parameters: fixed numbers. Find the limit with them held fixed.`;
  const lim = `lim (${variable}→${shownTarget}${side > 0 ? '⁺' : side < 0 ? '⁻' : ''}) ${beautify(func)}`;
  const tidy = (t) => beautify(t)
    .replace(/(?<![a-z])log\(/g, 'ln(')
    .replace(/\(([^()]*)\)\^\(1\/2\)/g, (m0, a) => `√(${a})`).replace(/(?<![a-z)])([a-z]|\d+(?:\.\d+)?)\^\(1\/2\)/gi, '√$1')
    .replace(/(?<![\w^/.)])1\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$2/$1')
    .replace(/(?<![\w^/.)])(\d+)\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$1$3/$2')
    .replace(/\bexp\(([^()]*)\)/g, (m0, a) => (/^[a-z0-9]+$/i.test(a) ? `e^${a}` : `e^(${a})`));
  const finish = (value, steps, given = [], technique = '') => {
    // What the value itself needs: 1/(2√x) needs x > 0 … read off it.
    const own = constantRequirements(tidy(value).replace(/√\(/g, 'sqrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)'), variable)
      .map((c) => c.replace(/^sqrt\(([^()]*)\) ≠ 0$/, '$1 ≠ 0'))
      .map((c) => tidyConditionSync(c))
      .map((c) => (/ ≠ 0$/.test(c) ? nonzeroCondition(c.replace(/ ≠ 0$/, '')) : c));
    // x ≥ 0 and x ≠ 0 is x > 0; a ≥ −1 is implied by a > −1.
    let conditions = [...new Set([...given, ...own])];
    conditions = conditions.filter((c) => {
      const m = c.match(/^(.+) ≥ (.+)$/);
      return !(m && conditions.includes(`${m[1]} > ${m[2]}`));
    }).map((c) => {
      const m = c.match(/^(.+) ≥ (.+)$/);
      return m && conditions.includes(`${m[1]} ≠ ${m[2]}`) ? `${m[1]} > ${m[2]}` : c;
    });
    conditions = conditions.filter((c) => {
      const m = c.match(/^(.+) ≠ (.+)$/);
      return !(m && conditions.includes(`${m[1]} > ${m[2]}`));
    });
    if (!agreesNearby(func, variable, Number.isFinite(target) || target === undefined ? targetText : (target > 0 ? '∞' : '-∞'), toMathjs(value).replace(/\bexp\(/g, 'exp('), letters, conditions)) return null;
    const shown = tidy(value);
    return {
      steps: [
        intro,
        ...steps,
        ...(conditions.length ? [`This holds for ${conditions.map((c) => mark(c)).join(' and ')}.`] : []),
        `Check: compared with the function's values near ${mark(`${variable} = ${shownTarget}`)} at several values of ${letters.length === 1 ? 'the parameter' : 'the parameters'}, both signs ✓`,
      ],
      answer: `${lim} = ${shown}${conditions.length ? `, for ${conditions.join(' and ')}` : ''}`,
      technique,
      tips: [
        `A parameter is a fixed number: the limit is found exactly as with a number in its place, and the answer is in terms of it.`,
        `Check one case by putting a number in for ${letters.map((c) => mark(c)).join(' and ')}.`,
      ],
      common_mistakes: [`Treating the parameter as a second variable that also moves: only ${mark(variable)} approaches ${mark(shownTarget)}.`],
      graph: null,
    };
  };

  // At ±∞: a ratio of polynomials in x, by leading coefficients.
  if (target !== undefined && !Number.isFinite(target)) {
    try {
      const parts = splitTopLevel(inner, '/');
      const [N, D] = parts.length === 2 ? parts.map((p) => toAlg(stripOuterParens(p))) : [f, '1'];
      const isPoly = (p) => !/[a-z]{2,}/i.test(p.replace(/\bpi\b/g, '')) && !new RegExp(`${variable}\\s*\\^\\s*\\(?[^\\d(]`).test(p) && !/\//.test(p);
      if (!isPoly(N) || !isPoly(D)) return null;
      const dn = Number(run(`deg(${N}, ${variable})`));
      const dd = Number(run(`deg(${D}, ${variable})`));
      const ln = run(`simplify(coeff(${N}, ${variable}, ${dn}))`);
      const ld = run(`simplify(coeff(${D}, ${variable}, ${dd}))`);
      if (!Number.isInteger(dn) || !Number.isInteger(dd)) return null;
      const conditions = nonzeroConditions(ld, letters, run);
      const divide = `Divide the top and the bottom by ${mark(`${variable}^${Math.max(dn, dd)}`)}, the highest power: every lower power goes to ${mark('0')}, and the leading terms decide.`;
      if (dn < dd) return finish('0', [divide, `The bottom has the higher degree, so the limit is ${mark('0')}.`], conditions, 'leading terms');
      if (dn === dd) {
        const value = run(`simplify((${ln})/(${ld}))`);
        return finish(value, [divide, `Equal degrees: the limit is the ratio of the leading coefficients, ${mark(`${tidy(ln)}/${tidy(ld)} = ${tidy(value)}`)}.`], conditions, 'leading terms');
      }
      // The top wins: ±∞ by the sign of the leading ratio, case by case.
      if (/[a-z]/i.test(ld)) return null;
      const ratio = run(`simplify((${ln})/(${ld}))`);
      const odd = (dn - dd) % 2 === 1 && target < 0;
      const posText = await tidyCondition(`${tidy(ratio)} > 0`);
      const negText = await tidyCondition(`${tidy(ratio)} < 0`);
      const [up, down] = odd ? ['-∞', '∞'] : ['∞', '-∞'];
      if (!/[a-z]/i.test(ratio)) return finish(Number(math.evaluate(ratio)) > 0 ? up : down, [divide, `The top has the higher degree, so the limit is infinite, with the sign of ${mark(tidy(ratio))}${odd ? `, reversed because ${mark(`${variable}^${dn - dd}`)} is negative as ${mark(`${variable} → -∞`)}` : ''}.`], [], 'leading terms');
      const okPos = agreesNearby(func, variable, target > 0 ? '∞' : '-∞', up, letters, [posText]);
      const okNeg = agreesNearby(func, variable, target > 0 ? '∞' : '-∞', down, letters, [negText]);
      if (!okPos || !okNeg) return null;
      // Where the leading coefficient is 0 the expression is a different one,
      // worked as such.
      const zeroCase = solveCase && letters.length === 1 && /^[a-z] [<>] -?\d+(?:\/\d+)?$/.test(posText) ? posText.replace(/[<>]/, '=') : null;
      let zeroText = '';
      if (zeroCase) {
        const [L, val] = zeroCase.split(' = ');
        const sub = String(func).replace(new RegExp(`(?<![a-z])${L}(?![a-z])`, 'g'), `(${val})`);
        const r = await solveCase(sub);
        const v = String(r?.answer || '').match(/=\s*([^=]+)$/);
        if (r && (!r.status || r.status === 'solved') && v && !/[a-z]{3,}/i.test(v[1])) zeroText = `${v[1].trim()} if ${zeroCase}`;
      }
      return {
        steps: [
          intro,
          divide,
          `The top has the higher degree, so the limit is infinite, with the sign of ${mark(tidy(ratio))}${odd ? `, reversed because ${mark(`${variable}^${dn - dd}`)} is negative as ${mark(`${variable} → -∞`)}` : ''}: it depends on the sign of the parameter.`,
          `If ${mark(posText)}: ${mark(up)}. If ${mark(negText)}: ${mark(down)}.`,
          ...(zeroText ? [`If ${mark(zeroCase)}, the leading term is gone and the limit is ${mark(zeroText.replace(/ if .*$/, ''))}.`] : []),
          `Check: compared with the function's values for large ${mark(variable)} at several values of the parameter ✓`,
        ],
        answer: `${lim} = ${up} if ${posText};  ${down} if ${negText}${zeroText ? `;  ${zeroText}` : ''}`,
        technique: 'leading terms',
        tips: [`With a parameter in the leading coefficient, its sign decides the direction: split into cases.`],
        common_mistakes: [`Writing ${mark('∞')} without asking whether the leading coefficient could be negative.`],
        graph: null,
      };
    } catch { return null; }
  }

  // At a point. 1. The expression is defined there: substitute.
  const substituteIn = async (expr, preface = []) => {
    const denominators = [];
    try {
      math.parse(toMathjs(expr)).traverse((node) => {
        if (node.type === 'OperatorNode' && node.op === '/' && hasLetter(node.args[1].toString(), variable)) denominators.push(node.args[1].toString());
        if (node.type === 'OperatorNode' && node.op === '^' && /\//.test(node.args[1].toString()) && hasLetter(node.args[1].toString(), variable)) denominators.push('pole-in-exponent');
      });
    } catch { return null; }
    // A function with poles (tan, sec, …) can be undefined at the point for
    // some values of the parameter: not substituted.
    const poles = /(?<![a-z])(?:tan|sec|csc|cot)\(/.test(expr) || /\^\s*\(?\s*1\s*\//.test(expr);
    // ln(u) and √u with x in u are continuous where u > 0: that condition, at
    // the point, is stated (lim x→1 ln(a·x) = ln(a), for a > 0).
    const insideArgs = [];
    try {
      math.parse(toMathjs(expr)).traverse((node) => {
        if (node.type === 'FunctionNode' && ['log', 'sqrt', 'log10'].includes(node.fn.name) && node.args.length === 1 && hasLetter(node.args[0].toString(), variable)) insideArgs.push(node.args[0].toString());
        // x^a, a parameter: real and continuous only where the base is > 0.
        if (node.type === 'OperatorNode' && node.op === '^' && hasLetter(node.args[0].toString(), variable) && /[a-z]/i.test(node.args[1].toString().replace(/\bpi\b/g, ''))) insideArgs.push(node.args[0].toString());
      });
    } catch { return null; }
    try {
      const denAtTarget = denominators.filter((d) => d !== 'pole-in-exponent').map((d) => at(toAlg(d)));
      const argsAtTarget = insideArgs.map((u) => at(toAlg(u)));
      const argsOk = argsAtTarget.every((u) => /[a-z]/i.test(u) || Number(math.evaluate(u)) > 0);
      if (denominators.includes('pole-in-exponent') || poles || !argsOk || denAtTarget.some((d) => d === '0')) return null;
      const value = at(toAlg(expr));
      if (hasLetter(value, variable)) return null;
      // a^x needs a > 0; a constant divisor, ≠ 0 (constantRequirements).
      const argConditions = [];
      for (const u of argsAtTarget.filter((t) => /[a-z]/i.test(t))) argConditions.push(await tidyCondition(`${tidy(u)} > 0`));
      const conditions = [...argConditions, ...constantRequirements(expr, variable).filter((c) => !c.replace(/(?<![a-z])(?:ln|sqrt|log)(?![a-z])/g, '').includes(variable)), ...denAtTarget.flatMap((d) => nonzeroConditions(d, letters, run))];
      return finish(value, [
        ...preface,
        `${preface.length ? 'That' : 'The expression'} is defined at ${mark(`${variable} = ${shownTarget}`)}${denAtTarget.length ? ' (no denominator is 0 there)' : ''}, so substitute: ${mark(tidy(value))}.`,
      ], [...new Set(conditions)], preface.length ? 'simplify then substitute' : 'direct substitution');
    } catch { return null; }
  };
  const direct = await substituteIn(func);
  if (direct) return direct;
  // 1b. A ratio of polynomials that is 0/0: cancel the common factor, as a
  // textbook does with ((x + h)² − x²)/h, then substitute.
  if (!/[a-z]{2,}/i.test(String(func).replace(/\bpi\b/g, ''))) {
    try {
      const simplified = run(`simplify(${f})`);
      if (simplified.replace(/\s+/g, '') !== f.replace(/\s+/g, '') && !/[a-z]{2,}/i.test(simplified)) {
        const cancelled = await substituteIn(simplified, [`At ${mark(`${variable} = ${shownTarget}`)} the expression is ${mark('0/0')}. Simplify first, cancelling the common factor: ${mark(`${beautify(func)} = ${tidy(simplified)}`)}, for ${mark(`${variable} ≠ ${shownTarget}`)}.`]);
        if (cancelled) return cancelled;
      }
    } catch { /* go on to L'Hôpital's rule */ }
  }

  // 2. 0/0 for every value of the parameter: L'Hôpital's rule, up to three times.
  const parts = splitTopLevel(inner, '/');
  if (parts.length === 2) {
    let [N, D] = parts.map((p) => toAlg(stripOuterParens(p)));
    const steps = [];
    try {
      for (let round = 0; round < 3; round += 1) {
        const [n0, d0] = [at(N), at(D)];
        if (!(n0 === '0' && d0 === '0')) break;
        steps.push(`${round === 0 ? 'At' : 'Still, at'} ${mark(`${variable} = ${shownTarget}`)} the top and the bottom are both ${mark('0')} for every value of the parameter${letters.length > 1 ? 's' : ''}${round === 0 ? ` (the form ${mark('0/0')})` : ''}: differentiate each (L'Hôpital's rule).`);
        N = run(`d(${N}, ${variable})`);
        D = run(`d(${D}, ${variable})`);
        steps.push(`${mark(D === '1' ? tidy(N) : `(${tidy(N)})/(${tidy(D)})`)}`);
        const [n1, d1] = [at(N), at(D)];
        if (d1 !== '0' && !hasLetter(n1 + d1, variable)) {
          const value = run(`simplify((${n1})/(${d1}))`);
          const quotient = `${wrap(tidy(n1))}/${wrap(tidy(d1))}`;
          steps.push(`Substitute ${mark(`${variable} = ${shownTarget}`)}: ${mark(d1 === '1' ? tidy(value) : quotient === tidy(value) ? quotient : `${quotient} = ${tidy(value)}`)}`);
          return finish(value, steps, nonzeroConditions(d1, letters, run), "L'Hôpital's rule");
        }
      }
    } catch { /* not this way */ }
  }

  // 3. 1^∞: B^E with B → 1 and E → ±∞, through logarithms.
  const power = inner.match(/^\((.*)\)\^\((.*)\)$/);
  if (power) {
    try {
      const [B, E] = [toAlg(power[1]), toAlg(power[2])];
      if (at(B) === '1') {
        const top = `log(${B})`;
        const bottom = run(`simplify(1/(${E}))`);
        if (at(top) === '0' && at(bottom) === '0') {
          const n1 = at(run(`d(${top}, ${variable})`));
          const d1 = at(run(`d(${bottom}, ${variable})`));
          if (d1 !== '0' && !hasLetter(n1 + d1, variable)) {
            const v = run(`simplify((${n1})/(${d1}))`);
            const value = `exp(${v})`;
            return finish(value, [
              `At ${mark(`${variable} = ${shownTarget}`)} the base is ${mark('1')} and the exponent grows without bound: the form ${mark('1^∞')}. Take logarithms: ${mark(`ln L = lim ${tidy(top.replace(/^log/, 'ln'))}/(${tidy(bottom)})`)}, a ${mark('0/0')} form.`,
              `L'Hôpital's rule: ${mark(`ln L = ${tidy(n1)}/${tidy(d1)} = ${tidy(v)}`)}, so ${mark(`L = e^${wrap(tidy(v))}`)}.`,
            ], nonzeroConditions(d1, letters, run), 'logarithms (1^∞)');
          }
        }
      }
    } catch { /* not this form */ }
  }
  return null;
}
