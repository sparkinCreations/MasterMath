// A linear system in x and y (or x, y and z) with constants (1.74.0):
// x + y = a; x − y = b. Solved by Cramer's rule in the constants, each
// solution checked by substituting it back into every equation exactly
// (Algebrite), and stated with the condition that the determinant is not 0.
// Where that condition fails at one value of one constant, the system there
// has no constants left and is solved as usual, so the step says whether it
// has no solution or infinitely many. Before this, "This system has 4
// variables (x, y, a, b) but two equations."

import { beautify, mark, loadAlgebrite, splitTerms } from '../solverUtils.js';
import { nonzeroCondition } from '../algebra/undoOuter.js';
import { parseRootsList, IMAGINARY } from '../algebra/rootsFormat.js';

const hasLetter = (t, v) => new RegExp(`(?<![a-z])${v}(?![a-z])`).test(t);
const wrap = (t) => (splitTerms(String(t)).length > 1 || /^-/.test(String(t)) || /[*/]/.test(String(t)) ? `(${t})` : String(t));

// The unknowns (x, y, z present) and the constants (every other letter), or
// null when this is not a system with constants of the right size.
export function systemWithConstants(equations, variables) {
  // A word left in the text ("(system)") is not six constants.
  const names = /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sqrt|abs|log|ln|exp|pi)(?![a-z])/gi;
  if (/[a-z]{2,}/i.test(equations.join(' ').replace(names, ' '))) return null;
  const unknowns = ['x', 'y', 'z'].filter((v) => variables.includes(v));
  const constants = variables.filter((v) => !unknowns.includes(v)).sort();
  if (!constants.length || unknowns.length < 2 || unknowns.length !== equations.length) return null;
  return { unknowns, constants };
}

const listed = (vs) => (vs.length > 1 ? `${vs.slice(0, -1).map((v) => mark(v)).join(', ')} and ${mark(vs.at(-1))}` : mark(vs[0]));

// b − a, not −a + b; (a + b)/2, not 1/2·a + 1/2·b.
function tidy(expr, run) {
  let num;
  let den;
  try {
    const s = run(`simplify(rationalize(${expr}))`);
    num = run(`expand(numerator(${s}))`);
    den = run(`expand(denominator(${s}))`);
  } catch { return beautify(expr); }
  // A negative denominator's sign moves to the top: 1/(−a − 1) is −1/(a + 1).
  const negDen = splitTerms(den).every((t) => t.signed.startsWith('-'));
  if (negDen) {
    num = run(`expand(-(${num}))`);
    den = run(`expand(-(${den}))`);
  }
  const positiveFirst = (t) => {
    const terms = splitTerms(t);
    // Letters before numbers (a + 1), then a positive term first (b − a).
    const sorted = [...terms.filter((x) => /[a-z]/i.test(x.term)), ...terms.filter((x) => !/[a-z]/i.test(x.term))];
    const k = sorted.findIndex((x) => !x.signed.startsWith('-'));
    if (k < 0) return beautify(sorted.map((x, i) => (i === 0 ? x.signed : ` - ${x.signed.slice(1)}`)).join(''));
    const ordered = [sorted[k], ...sorted.filter((_, i) => i !== k)];
    return beautify(ordered.map((x, i) => (i === 0 ? x.term : x.signed.startsWith('-') ? ` - ${x.signed.slice(1)}` : ` + ${x.term}`)).join(''));
  };
  const top = positiveFirst(num);
  if (den === '1') return top;
  const single = splitTerms(top).length === 1;
  const shownTop = single && top.startsWith('-') ? `-${wrap(top.slice(1))}` : wrap(top);
  return `${shownTop}/${wrap(positiveFirst(den))}`;
}

export async function solveSystemWithConstants(equations, unknowns, constants, solveNumbers) {
  const Algebrite = await loadAlgebrite();
  const run = (e) => { const o = String(Algebrite.run(e)).trim(); if (!o || /stop|error|nil/i.test(o)) throw new Error(o); return o; };
  const n = unknowns.length;
  // Each equation as a row of coefficients and a right-hand side, linear in
  // the unknowns: no unknown left in any coefficient.
  const rows = [];
  try {
    for (const eq of equations) {
      const [l, r] = eq.split('=');
      if (r === undefined) return null;
      const g = run(`expand((${l}) - (${r}))`);
      const coeffs = unknowns.map((v) => run(`coeff(${g}, ${v}, 1)`));
      if (unknowns.some((v) => run(`deg(${g}, ${v})`) !== '1' && run(`deg(${g}, ${v})`) !== '0')) return null;
      let rest = g;
      unknowns.forEach((v, i) => { rest = run(`expand((${rest}) - (${coeffs[i]})*${v})`); });
      if (coeffs.some((c) => unknowns.some((v) => hasLetter(c, v))) || unknowns.some((v) => hasLetter(rest, v))) return null;
      rows.push({ coeffs, rhs: run(`expand(-(${rest}))`) });
    }
  } catch { return null; }
  const matrix = (cols) => `[${cols.map((row) => `[${row.join(',')}]`).join(',')}]`;
  let D;
  try { D = run(`expand(det(${matrix(rows.map((row) => row.coeffs))}))`); } catch { return null; }
  if (D === '0') return null;
  // With one constant, D's real roots are the values excluded, and a root
  // shared with D_x cancels from x (2(1 − a)/(1 − a²) is 2/(a + 1)).
  const single = constants.length === 1 && /[a-z]/i.test(D) ? constants[0] : null;
  let excluded = null;
  if (single) {
    try {
      const raw = run(`roots(${D}, ${single})`);
      excluded = parseRootsList(raw).filter((rt) => !IMAGINARY.test(rt.display) && Number.isFinite(rt.numeric));
    } catch { excluded = null; }
  }
  const solutions = [];
  const uncancelled = [];
  const dets = [];
  try {
    for (let i = 0; i < n; i += 1) {
      const Di = run(`expand(det(${matrix(rows.map((row) => row.coeffs.map((c, j) => (j === i ? row.rhs : c))))}))`);
      dets.push(Di);
      let [top, bottom] = [Di, D];
      for (const rt of excluded || []) {
        const lin = `(${single} - (${rt.display.replace(/√/g, 'sqrt')}))`;
        if (run(`simplify(subst(${rt.display.replace(/√/g, 'sqrt')}, ${single}, ${top}))`) === '0') {
          top = run(`quotient(${top}, ${lin}, ${single})`);
          bottom = run(`quotient(${bottom}, ${lin}, ${single})`);
        }
      }
      solutions.push(tidy(`(${top})/(${bottom})`, run));
      uncancelled.push(top === Di ? null : `${wrap(tidy(Di, run))}/${wrap(tidy(D, run))}`);
    }
  } catch { return null; }
  // Exact check: each solution put back into each equation.
  try {
    for (const eq of equations) {
      const [l, r] = eq.split('=');
      let g = `(${l}) - (${r})`;
      unknowns.forEach((v, i) => { g = `subst((${solutions[i].replace(/√/g, 'sqrt')}), ${v}, ${g})`; });
      if (run(`simplify(${g})`) !== '0') return null;
    }
  } catch { return null; }
  // D ≠ 0, factor by factor: −a − 1 is a ≠ −1.
  const conditions = [];
  if (excluded?.length) {
    for (const rt of excluded) conditions.push(`${single} ≠ ${rt.display}`);
  } else if (/[a-z]/i.test(D)) {
    let factors = [D];
    try {
      const f = run(`factor(${D})`);
      factors = splitTerms(f).length > 1 ? [f] : f.split(/\*(?![^()]*\))/);
    } catch { /* D whole */ }
    for (const f of factors.map((t) => t.trim().replace(/^\((.*)\)(\^\d+)?$/, '$1').replace(/^([a-z])\^\d+$/i, '$1')).filter((t) => /[a-z]/i.test(t))) {
      const c = nonzeroCondition(f);
      if (!conditions.includes(c)) conditions.push(c);
    }
  }
  const shownD = tidy(D, run);
  const eqShown = equations.map((e) => beautify(e).replace(/\s*=\s*/, ' = ')).join(';  ');
  const answerCore = unknowns.map((v, i) => `${v} = ${solutions[i]}`).join(',  ');
  const steps = [
    constants.length === 1
      ? `The letter ${mark(constants[0])} is a constant: treat it as a fixed number and solve for ${listed(unknowns)}.`
      : `The letters ${constants.slice(0, -1).map((c) => mark(c)).join(', ')} and ${mark(constants.at(-1))} are constants: treat them as fixed numbers and solve for ${listed(unknowns)}.`,
    `Write the system: ${mark(eqShown)}.`,
    n === 2
      ? `The determinant of the coefficients: ${mark(`D = ${wrap(beautify(rows[0].coeffs[0]))}·${wrap(beautify(rows[1].coeffs[1]))} - ${wrap(beautify(rows[0].coeffs[1]))}·${wrap(beautify(rows[1].coeffs[0]))} = ${shownD}`)}.`
      : `The determinant of the coefficients: ${mark(`D = ${shownD}`)}.`,
    `Cramer's rule: replace each column in turn by the right-hand sides, ${unknowns.map((v, i) => mark(`D_${v} = ${tidy(dets[i], run)}`)).join(', ')}, and divide by ${mark('D')}.`,
    ...unknowns.map((v, i) => `${mark(`${v} = D_${v}/D = ${uncancelled[i] ? `${uncancelled[i]} = ` : ''}${solutions[i]}`)}`),
  ];
  if (conditions.length) {
    steps.push(`This holds for ${conditions.map((c) => mark(c)).join(' and ')}: there ${mark('D ≠ 0')}, and Cramer's rule divides by ${mark('D')}.`);
    // One constant at one value: the system there has numbers only.
    for (const c of conditions) {
      const m = c.match(/^([a-z]) ≠ (-?\d+(?:\/\d+)?)$/i);
      if (!m || constants.length !== 1 || !solveNumbers) continue;
      const at = equations.map((e) => {
        const [l, r] = e.replace(new RegExp(`(?<![a-z])${m[1]}(?![a-z])`, 'g'), `(${m[2]})`).split('=');
        try { return `${run(`expand(${l})`)} = ${run(`expand(${r})`)}`; } catch { return `${l} = ${r}`; }
      }).join('; ');
      let verdict = null;
      try {
        const r = await solveNumbers(at);
        const text = String(r?.answer || '');
        if (/no solution|inconsistent|parallel/i.test(text)) verdict = 'there is no solution';
        else if (/infinitely many/i.test(text)) verdict = 'there are infinitely many solutions';
      } catch { /* leave the case unstated */ }
      if (verdict) steps.push(`If ${mark(`${m[1]} = ${m[2]}`)}, ${mark('D = 0')}: the system is ${mark(at.split('; ').map((e) => beautify(e).replace(/\s*=\s*/, ' = ')).join(';  '))}, and ${verdict}.`);
    }
  }
  steps.push(`Check: substituting into ${n === 2 ? 'both' : 'all three'} equations leaves ${mark('0')} exactly, for every value of ${constants.length === 1 ? 'the constant' : 'the constants'} ✓`);
  return {
    steps,
    answer: conditions.length ? `${answerCore}, for ${conditions.join(' and ')}` : answerCore,
    tips: [
      `Cramer's rule works with letters as well as numbers: each unknown is a ratio of determinants, ${mark('x = D_x/D')}.`,
      `The answer holds where ${mark('D ≠ 0')}; where ${mark('D = 0')} the equations are parallel or the same, and are solved on their own.`,
    ],
    common_mistakes: [`Dividing by ${mark('D')} without asking when it is 0.`],
    graph: null,
  };
}
