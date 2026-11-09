// An inequality in x with constants (1.74.0): a·x > b, x + a > b, x² < a.
// Dividing by a letter reverses the inequality when the letter is negative,
// so the answer is given case by case, on the sign of what was divided by,
// with the case where it is 0 worked; x² against a constant is split on the
// sign of the constant. Every case is checked at values of the constants of
// both signs and 0, against the inequality itself at many x. Anything else
// with a constant is refused, saying which forms are solved.

import { math, beautify, mark, loadAlgebrite } from '../solverUtils.js';
import { tidyCondition } from '../algebra/undoOuter.js';

const PRETTY = { '<': '<', '>': '>', '<=': '≤', '>=': '≥' };
const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
const hasLetter = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(t);
const wrap = (t) => (/[+\-*/ ]/.test(String(t).replace(/^-/, '')) || /^-/.test(String(t)) ? `(${t})` : String(t));
// b − a, not −a + b; (a − b)/2, not 1/2·(a − b); −2x, not (−2)·x.
function tidy(t) {
  let s = beautify(t).replace(/^1\/(\d+)\*\((.*)\)$/, '($2)/$1').replace(/\((-\d+(?:\.\d+)?)\)\*(?=[a-z])/gi, '$1');
  const terms = s.match(/^(-[a-z0-9]+) \+ ([a-z0-9]+)$/i);
  if (terms) s = `${terms[2]} - ${terms[1].slice(1)}`;
  s = s.replace(/\((-\d+) \+ ([a-z])\)/gi, (m0, k, v) => `(${v} - ${k.slice(1)})`).replace(/^-(\d+) \+ ([a-z])$/i, '$2 - $1');
  return s;
}
const toMathjs = (t) => String(t).replace(/√\(/g, 'sqrt(').replace(/√([a-z0-9]+)/gi, 'sqrt($1)').replace(/≤/g, '<=').replace(/≥/g, '>=');

// The letters other than the variable: an inequality in x and y is a region
// and stays refused.
export function inequalityConstants(text, variable) {
  const letters = [...new Set((String(text).replace(/(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp|pi|e)(?![a-z])/gi, ' ')
    .match(/(?<![a-z])[a-z](?![a-z])/gi) || []).map((c) => c.toLowerCase()))];
  if (!/^[xyz]$/.test(variable) || !letters.includes(variable)) return null;
  // A word left in the text is not a run of constants.
  if (/[a-z]{2,}/i.test(String(text).replace(/(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp|pi)(?![a-z])/gi, ' '))) return null;
  const others = letters.filter((c) => c !== variable);
  // i is the imaginary unit: an inequality with it is not about real constants.
  if (others.includes('i')) return null;
  if (!others.length || others.some((c) => /^[xyz]$/.test(c))) return null;
  return others.sort();
}

// "L op R", joined by " and " / " or " (and binds tighter), evaluated here:
// the app's mathjs is built without and/or.
function holds(text, scope) {
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text.split(' or ').some((alt) => alt.split(' and ').every((cmp) => {
    const m = cmp.match(/^(.*?)\s*(<=|>=|==|<|>)\s*(.*)$/);
    if (!m) throw new Error(`cannot read ${cmp}`);
    const [L, R] = [Number(math.evaluate(m[1], scope)), Number(math.evaluate(m[3], scope))];
    if (!Number.isFinite(L) || !Number.isFinite(R)) throw new Error('not real');
    const op = m[2];
    return op === '<' ? L < R : op === '>' ? L > R : op === '<=' ? L <= R : op === '>=' ? L >= R : Math.abs(L - R) < 1e-12;
  }));
}

// Each case: the condition on the constants (mathjs text, and as shown) and
// the solution set (mathjs text in x, and as shown).
function checkCases(fExpr, op, variable, cases, letters) {
  const vals = [1.7, -1.3, 0.6, -2.4, 2.9, -0.45, 0, 1.15, -3.1, 0];
  const xs = [-7.3, -4.1, -2.6, -1.4, -0.7, -0.15, 0.2, 0.55, 1.1, 1.9, 2.7, 3.6, 5.2, 8.8];
  let checked = 0;
  for (let k = 0; k < 16; k += 1) {
    const scope = Object.fromEntries(letters.map((c, j) => [c, vals[(k * 3 + j * 7) % vals.length] * (1 + 0.11 * j)]));
    const which = cases.filter((cs) => { try { return holds(cs.when, scope); } catch { return false; } });
    if (which.length !== 1) return false; // the cases must cover every value, once
    for (const x of xs) {
      const at = { ...scope, [variable]: x };
      let f;
      try { f = Number(math.evaluate(fExpr, at)); } catch { return false; }
      if (!Number.isFinite(f) || Math.abs(f) < 1e-9) continue; // on a boundary
      const truth = op === '<' ? f < 0 : op === '>' ? f > 0 : op === '<=' ? f <= 0 : f >= 0;
      let claimed;
      try { claimed = holds(which[0].set, at); } catch { return false; }
      if (claimed !== truth) return false;
      checked += 1;
    }
  }
  return checked >= 40;
}

export async function solveInequalityWithConstants(lhs, rhs, op, variable, letters) {
  const Algebrite = await loadAlgebrite();
  const run = (e) => { const o = String(Algebrite.run(e)).trim(); if (!o || /stop|error|nil/i.test(o)) throw new Error(o); return o; };
  const fExpr = `(${lhs}) - (${rhs})`;
  let expanded;
  let degree;
  try {
    expanded = run(`expand(${fExpr})`);
    if (/\//.test(run(`denominator(${expanded})`).replace(/^1$/, '')) || hasLetter(run(`denominator(${expanded})`), variable)) return null;
    degree = run(`deg(${expanded}, ${variable})`);
  } catch { return null; }
  const co = (k) => run(`simplify(coeff(${expanded}, ${variable}, ${k}))`);
  const shownOp = PRETTY[op];
  const typed = `${beautify(lhs)} ${shownOp} ${beautify(rhs)}`;
  const constantsLine = letters.length === 1
    ? `The letter ${mark(letters[0])} is a constant: treat it as a fixed number and solve for ${mark(variable)}.`
    : `The letters ${letters.slice(0, -1).map((c) => mark(c)).join(', ')} and ${mark(letters.at(-1))} are constants: treat them as fixed numbers and solve for ${mark(variable)}.`;
  const numeric = (t) => !/[a-z]/i.test(t);
  const sign = (t) => Number(math.evaluate(t));
  let cases;
  let steps;
  if (degree === '1') {
    const A = co(1);
    const B = co(0);
    const negB = tidy(run(`simplify(-(${B}))`));
    const ax = tidy(A === '1' ? variable : A === '-1' ? `-${variable}` : numeric(A) ? `${A}${variable}` : `${wrap(tidy(A))}*${variable}`);
    const boundary = () => tidy(run(`simplify(-(${B})/(${A}))`)).replace(/^\((.*)\)$/, '$1');
    if (numeric(A)) {
      // x + a > b: dividing by a number, the case is fixed.
      const finalOp = sign(A) < 0 ? FLIP[op] : op;
      const c = boundary();
      cases = [{ when: 'true', set: `${variable} ${finalOp} (${c})`, shown: `${variable} ${PRETTY[finalOp]} ${c}` }];
      steps = [
        constantsLine,
        `Collect the terms: ${mark(`${ax} ${shownOp} ${negB}`)}`,
        ...(A === '1' ? [] : [`Divide both sides by ${mark(A)}${sign(A) < 0 ? ', which is negative, so the inequality reverses' : ''}: ${mark(cases[0].shown)}`]),
      ];
    } else {
      // a·x > b: the sign of a decides the direction.
      const c = boundary();
      const pos = await tidyCondition(`${A} > 0`);
      const neg = await tidyCondition(`${A} < 0`);
      const zeroShown = /^[a-z]$/i.test(A) ? `${A} = 0` : pos.replace(/[<>≤≥]/, '=');
      // At A = 0 the inequality is B op 0, about the constants alone.
      const holdsAtZero = await tidyCondition(`${beautify(B)} ${PRETTY[op]} 0`);
      const zeroText = numeric(B)
        ? (sign(B) < 0 ? op === '<' || op === '<=' : sign(B) > 0 ? op === '>' || op === '>=' : op === '<=' || op === '>=') ? `every ${variable}` : `no ${variable}`
        : `every ${variable} when ${holdsAtZero}, no ${variable} otherwise`;
      const zeroMath = numeric(B) ? (zeroText.startsWith('every') ? 'true' : 'false') : `(${B}) ${op} 0`;
      cases = [
        { when: `(${A}) > 0`, set: `${variable} ${op} (${c})`, shown: `${variable} ${PRETTY[op]} ${c} if ${pos}` },
        { when: `(${A}) < 0`, set: `${variable} ${FLIP[op]} (${c})`, shown: `${variable} ${PRETTY[FLIP[op]]} ${c} if ${neg}` },
        { when: `(${A}) == 0`, set: zeroMath, shown: `if ${zeroShown}: ${zeroText}` },
      ];
      steps = [
        constantsLine,
        `Collect the terms: ${mark(`${ax} ${shownOp} ${negB}`)}`,
        `Dividing by ${mark(tidy(A))} keeps the inequality when ${mark(pos)} and reverses it when ${mark(neg)}, so the answer depends on the sign of ${mark(tidy(A))}.`,
        `If ${mark(pos)}: ${mark(`${variable} ${PRETTY[op]} ${c}`)}`,
        `If ${mark(neg)}: ${mark(`${variable} ${PRETTY[FLIP[op]]} ${c}`)}`,
        `If ${mark(zeroShown)}, the inequality is ${mark(`0 ${shownOp} ${negB}`)}, with no ${mark(variable)} in it: ${numeric(B) ? `${zeroText === `every ${variable}` ? 'it is true, so every' : 'it is false, so no'} ${mark(variable)} is a solution` : `every ${mark(variable)} is a solution when ${mark(holdsAtZero)}, and none is otherwise`}.`,
      ];
    }
  } else if (degree === '2' && co(1) === '0' && numeric(co(2))) {
    // k·x² + C op 0: x² against c = −C/k.
    const k = co(2);
    const kOp = sign(k) < 0 ? FLIP[op] : op;
    const c = tidy(run(`simplify(-(${co(0)})/(${k}))`));
    const root = /^[a-z]$/i.test(c) ? `√${c}` : `√(${c})`;
    const cm = `(${c})`;
    const r = `sqrt(${c})`;
    const cond = async (t) => tidyCondition(t);
    const [gt, ge, lt, le] = await Promise.all([cond(`${c} > 0`), cond(`${c} ≥ 0`), cond(`${c} < 0`), cond(`${c} ≤ 0`)]);
    const table = {
      '<': [{ when: `${cm} > 0`, set: `-${r} < ${variable} and ${variable} < ${r}`, shown: `-${root} < ${variable} < ${root} if ${gt}` }, { when: `${cm} <= 0`, set: 'false', shown: `no solution if ${le}` }],
      '<=': [{ when: `${cm} >= 0`, set: `-${r} <= ${variable} and ${variable} <= ${r}`, shown: `-${root} ≤ ${variable} ≤ ${root} if ${ge}` }, { when: `${cm} < 0`, set: 'false', shown: `no solution if ${lt}` }],
      '>': [{ when: `${cm} >= 0`, set: `${variable} < -${r} or ${variable} > ${r}`, shown: `${variable} < -${root} or ${variable} > ${root} if ${ge}` }, { when: `${cm} < 0`, set: 'true', shown: `every ${variable} if ${lt}` }],
      '>=': [{ when: `${cm} > 0`, set: `${variable} <= -${r} or ${variable} >= ${r}`, shown: `${variable} ≤ -${root} or ${variable} ≥ ${root} if ${gt}` }, { when: `${cm} <= 0`, set: 'true', shown: `every ${variable} if ${le}` }],
    };
    cases = table[kOp];
    steps = [
      constantsLine,
      `Collect the terms: ${mark(`${variable}^2 ${PRETTY[kOp]} ${c}`)}`,
      `A square is never negative, so the answer depends on the sign of ${mark(c)}.`,
      ...cases.map((cs) => `${cs.shown.replace(/^(.*) if (.*)$/, (m0, set, when) => `If ${mark(when)}: ${/^(every|no) /.test(set) ? set : mark(set)}`)}.`),
    ];
  } else {
    return null;
  }
  if (!checkCases(toMathjs(fExpr), op, variable, cases, letters)) return null;
  const answer = cases.map((cs) => cs.shown).join(';  ');
  steps.push(`Check: each case was tested against ${mark(typed)} at values of ${letters.length === 1 ? 'the constant' : 'the constants'} of both signs and 0 ✓`);
  return {
    steps,
    answer,
    tips: [
      `Dividing or multiplying an inequality by a negative number reverses it; by a letter, you do not know its sign, so split into cases.`,
      `Put numbers in place of ${letters.map((c) => mark(c)).join(' and ')} to check a case: the same steps give one interval.`,
    ],
    common_mistakes: [`Dividing by a letter without asking whether it is negative: ${mark('a·x > b')} is ${mark('x > b/a')} only when ${mark('a > 0')}.`],
    graph: null,
    withConstants: true,
  };
}

export const CONSTANTS_REFUSAL = (letters, variable) => ({
  reason: `The letter${letters.length > 1 ? 's' : ''} ${letters.map((c) => mark(c)).join(', ')} ${letters.length > 1 ? 'are constants' : 'is a constant'} here. An inequality with constants is solved when it is linear in ${mark(variable)} (${mark(`${variable} + a > b`)}, ${mark(`a·${variable} > b`)}) or ${mark(`${variable}^2`)} against a constant (${mark(`${variable}^2 < a`)}); this one is neither.`,
  hint: `Give ${letters.map((c) => mark(c)).join(' and ')} ${letters.length > 1 ? 'numbers' : 'a number'} to solve one case with a sign chart.`,
});
