// Expressions with no equals sign: simplify (cancelling stated with its
// restriction), expand and factor.

import { isEquation, extractVariable, parseMathExpression } from '../../mathParser.js';
import { parseError } from '../../solutionEnvelope.js';
import {
  math,
  loadAlgebrite,
  isAlgebriteFailure,
  beautify,
  hasVariable,
  sampleFunction,
  expressionsNumericallyEqual,
  expressionsEqualInAllLetters,
  splitTerms,
  splitTopLevel,
  mark,
  stripOuterParens,
} from '../solverUtils.js';
import { CANCEL_TIPS, SIMPLIFY_TIPS, CANCEL_MISTAKES, SIMPLIFY_MISTAKES } from './guidance.js';
import { parseRootsList, IMAGINARY } from './rootsFormat.js';
import { exactRadicalForm } from './radicals.js';

// "expand (x+1)^2" → x^2 + 2x + 1. Algebrite's expand, verified numerically.
// Terms in descending lexicographic order (1.70.6), the textbook style:
// highest power of x first when the expression has an x, then of each other
// letter alphabetically (with no x, every letter alphabetically), keeping
// the engine's order for ties. Algebrite wrote (a + b)^2 as
// 2a*b + a^2 + b^2; this gives a^2 + 2ab + b^2, and (b + a)^2 the same.
function textbookOrder(expanded, Algebrite) {
  const terms = splitTerms(expanded);
  if (terms.length < 2) return expanded;
  const degree = (t, v) => {
    try { const d = Number(String(Algebrite.run(`deg(${t}, ${v})`)).trim()); return Number.isFinite(d) ? d : 0; } catch { return 0; }
  };
  // Each term's powers in that letter order, compared highest first
  // (a^2, 2ab, 2ac, b^2, 2bc, c^2).
  const letters = [...new Set(expanded.match(/(?<![a-z])[a-z](?![a-z])/gi) || [])].filter((c) => !['e', 'i'].includes(c)).sort();
  const order = letters.includes('x') ? ['x', ...letters.filter((c) => c !== 'x')] : letters;
  const ranked = terms.map((t, i) => ({ t, i, powers: order.map((v) => degree(t.term, v)) }));
  ranked.sort((p, q) => {
    for (let k = 0; k < order.length; k += 1) if (q.powers[k] !== p.powers[k]) return q.powers[k] - p.powers[k];
    return p.i - q.i;
  });
  const text = ranked.map(({ t }, k) => (k === 0 ? t.signed : t.sign === '-' ? ` - ${t.term}` : ` + ${t.term}`)).join('');
  return text;
}

export async function expandExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const raw = String(Algebrite.run(`expand(${expression})`)).trim();
    if (!raw || /stop|error|nil/i.test(raw)) return null;
    const expanded = textbookOrder(raw, Algebrite);
    // Every letter is checked, not only x: with a constant in it the
    // one-letter check could not evaluate, and the input came back unexpanded.
    if (!expressionsEqualInAllLetters(expression, expanded)) return null;
    return {
      steps: [
        `Expand: ${beautify(expression)}`,
        'Multiply out every product of sums, then collect like terms.',
        `Result: ${beautify(expanded)} (confirmed numerically at several values).`,
      ],
      answer: beautify(expanded),
      tips: ['Expanding is the reverse of factoring; each term of one bracket multiplies each term of the other.', `${mark('(a + b)² = a² + 2ab + b²')} — the middle term is the one students drop.`, `Collect like terms at the end, and check by substituting a value into both forms: at ${mark('x = 1')}, ${mark('(x + 1)² = 4')} and ${mark('x² + 2x + 1 = 4')}.`],
      common_mistakes: [`Writing ${mark('(a + b)²')} as ${mark('a² + b²')}.`, 'Losing a sign when a bracket is subtracted.'],
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

export async function factorExpression(expression) {
  try {
    const Algebrite = await loadAlgebrite();
    const variable = extractVariable(expression);
    let factored = String(Algebrite.run(`factor(${expression})`)).trim();
    if (!factored || /nil|error|stop/i.test(factored)) return null;
    if (!expressionsEqualInAllLetters(expression, factored)) return null;
    // factor() works in x: a^2 - b^2 came back whole and was called "no
    // simpler factors" (1.70.6). Without x, try each letter in turn, the
    // variable first, and keep the first that factors.
    const same = (f) => f.replace(/[\s*]/g, '') === String(expression).replace(/[\s*]/g, '');
    // A result that is not a product is only reordered (-a*b^2 + a^2*b).
    const isProduct = (f) => /\)\s*\*?\s*\(|\*\s*\(|^-?[\w.]+\s*\(|\)\s*\^/.test(f);
    if (same(factored) || !isProduct(factored)) {
      const letters = [...new Set([variable, ...(String(expression).replace(/(?<![a-z])(?:sin|cos|tan|sqrt|abs|log|ln|exp|pi|e)(?![a-z])/gi, '').match(/(?<![a-z])[a-z](?![a-z])/gi) || [])])];
      for (const v of letters) {
        let f = '';
        try { f = String(Algebrite.run(`factor(${expression}, ${v})`)).trim(); } catch { f = ''; }
        if (f && !/nil|error|stop/i.test(f) && !same(f) && expressionsEqualInAllLetters(expression, f)) { factored = f; break; }
      }
    }

    const changed = factored.replace(/[\s*]/g, '') !== String(expression).replace(/[\s*]/g, '');

    const tips = [
      'Always pull out the greatest common factor first.',
      `${mark('a² − b² = (a − b)(a + b)')} — the difference-of-squares pattern.`,
      'Check a factorization by expanding it back out.',
    ];
    const commonMistakes = [
      'Stopping before the expression is fully factored.',
      'Sign errors inside the factors — expand to verify.',
      `Treating a sum of squares like a difference: ${mark('a² + b²')} does not factor over the reals.`,
    ];

    if (!changed) {
      return {
        steps: [
          `Factor the expression: ${beautify(expression)}`,
          'No factorization over the integers exists — the expression is already fully factored.',
        ],
        answer: `${beautify(expression)} (no simpler factors over the integers)`,
        tips,
        common_mistakes: commonMistakes,
        graph: generateAlgebraGraph(expression),
      };
    }

    const display = formatFactoredForm(factored);
    const steps = [`Factor the expression: ${beautify(expression)}`];

    const squares = diffOfSquares(expression);
    if (squares) {
      steps.push(`Recognize a difference of squares: ${squares}`);
    } else {
      steps.push('Pull out common factors and match factoring patterns (difference of squares, trinomials).');
    }
    steps.push(`Factored form: ${display}`);

    // Genuinely recompute the expansion for the verification step.
    try {
      const expanded = String(Algebrite.run(`expand(${factored})`)).trim();
      if (expanded && !/nil|error|stop/i.test(expanded)) {
        steps.push(`Check by expanding: ${display} = ${beautify(expanded)}.`);
      }
    } catch {
      // The check step is optional; the numeric gate above already passed.
    }

    return {
      steps,
      answer: display,
      tips,
      common_mistakes: commonMistakes,
      graph: generateAlgebraGraph(expression),
    };
  } catch {
    return null;
  }
}

// Drop the explicit '*' between factors for display: (x-3)*(x+3) reads as
// (x - 3)(x + 3). beautify() already handles digit coefficients like 2*(…).
function formatFactoredForm(factored) {
  return beautify(factored).replace(/([a-z0-9)])\s*\*\s*\(/gi, '$1(');
}

// Textbook narration for the x^2 - N (perfect square N) shape.
function diffOfSquares(expression) {
  const m = String(expression).replace(/\s+/g, '').match(/^([a-z])\^2-(\d+)$/i);
  if (!m) return null;
  const n = Number(m[2]);
  const root = Math.round(Math.sqrt(n));
  if (root * root !== n) return null;
  const v = m[1];
  return `${v}² − ${n} = ${v}² − ${root}², so it factors as (${v} − ${root})(${v} + ${root}).`;
}

// Where cancelling changed the domain: (x^2 - 1)/(x - 1) = x + 1 only for
// x ≠ 1. The points where a denominator of the original is zero but the
// simplified form is defined, exactly (Algebrite roots, each confirmed by
// evaluating the denominator there). Empty when nothing was cancelled away.
async function cancelledPoints(original, simplified, variable) {
  if (!/\//.test(original)) return [];
  const denominators = [];
  try {
    math.parse(original).traverse((node) => {
      if (node.isOperatorNode && node.op === '/' && node.args[1]) denominators.push(node.args[1].toString());
    });
  } catch {
    return [];
  }
  const Algebrite = await loadAlgebrite();
  const points = [];
  for (const den of denominators) {
    if (!new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(den)) continue;
    let raw;
    try { raw = String(Algebrite.roots(den, variable)).trim(); } catch { continue; }
    if (!raw || /stop|error|nil|roots/i.test(raw)) continue;
    for (const { display, numeric } of parseRootsList(raw)) {
      if (!Number.isFinite(numeric) || IMAGINARY.test(display)) continue;
      let d;
      let v;
      try {
        d = math.evaluate(den, { [variable]: numeric });
        v = math.evaluate(simplified, { [variable]: numeric });
      } catch { continue; }
      if (typeof d !== 'number' || Math.abs(d) > 1e-9) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (!points.some((q) => Math.abs(q.numeric - numeric) < 1e-9)) points.push({ display, numeric });
    }
  }
  return points.sort((p1, p2) => p1.numeric - p2.numeric);
}

// The factors of an expression's denominators, as typed or as Algebrite
// factors a sum ((x^2 - a^2) → (x + a), (x − a)), numbers left out.
function denominatorFactors(expression, variable, Algebrite) {
  const out = [];
  const add = (t) => { const s = stripOuterParens(String(t).trim()); if (/[a-z]/i.test(s) && !out.includes(s)) out.push(s); };
  const split = (node) => {
    const m = node.type === 'ParenthesisNode' ? node.content : node;
    if (m.type === 'OperatorNode' && m.op === '*') { m.args.forEach(split); return; }
    if (m.type === 'OperatorNode' && m.op === '^' && m.args[1].type === 'ConstantNode') { split(m.args[0]); return; }
    if (m.type === 'OperatorNode' && (m.op === '+' || m.op === '-') && m.args.length === 2) {
      try {
        const f = String(Algebrite.run(`factor(${m.toString()}, ${variable})`)).trim();
        const parts = splitTopLevel(f, '*');
        if (parts.length > 1 && !/\//.test(f)) { parts.forEach((p) => split(math.parse(p))); return; }
      } catch { /* keep the sum whole */ }
    }
    if (m.type !== 'ConstantNode') add(m.toString());
  };
  try {
    math.parse(expression).traverse((n) => {
      if (n.type === 'OperatorNode' && n.op === '/' && n.args.length === 2) split(n.args[1]);
    });
  } catch { return []; }
  return out;
}

// A factor ≠ 0 as a textbook writes it: a ≠ 0 for a, 2a or a², x ≠ a for
// x − a, x ≠ −a for x + a.
function nonzeroText(factor) {
  const f = factor.replace(/\s+/g, '');
  const single = f.match(/^\d*\*?([a-z])(?:\^\d+)?$/i);
  if (single) return `${single[1]} ≠ 0`;
  const pair = f.match(/^([a-z])([+-])(\d*\*?[a-z]|\d+(?:\.\d+)?)$/i);
  if (pair) return `${pair[1]} ≠ ${pair[2] === '-' ? '' : '-'}${pair[3].replace('*', '')}`;
  return `${beautify(factor)} ≠ 0`;
}

// The factors a simplification cancelled: the original divides by them and
// the simplified form, where they are 0, does not. Each factor is solved for
// one of its letters (linear, a numeric coefficient) and the simplified form
// evaluated there at several values of the other letters.
function cancelledFactors(original, simplified, variable, Algebrite) {
  const out = [];
  for (const f of denominatorFactors(original, variable, Algebrite)) {
    let node;
    try { node = math.parse(f); } catch { continue; }
    const names = [...new Set(node.filter((n) => n.type === 'SymbolNode' && /^[a-z]$/i.test(n.name) && n.name !== 'e').map((n) => n.name))];
    // Solve f = 0 for a letter it is linear in: L = −(f at L = 0)/(coefficient).
    let solvedFor = null;
    for (const L of [variable, ...names.filter((n) => n !== variable)]) {
      if (!names.includes(L)) continue;
      try {
        const c = Number(String(Algebrite.run(`coeff(${f}, ${L}, 1)`)).trim());
        const d = String(Algebrite.run(`deg(${f}, ${L})`)).trim();
        if (d === '1' && Number.isFinite(c) && c !== 0) { solvedFor = { L, rest: String(Algebrite.run(`-(${f} - ${c}*${L})/(${c})`)).trim() }; break; }
      } catch { /* try the next letter */ }
    }
    if (!solvedFor) continue;
    const others = [...new Set(`${original} ${simplified}`.match(/(?<![a-z])[a-z](?![a-z])/gi) || [])].filter((n) => n !== solvedFor.L && n !== 'e');
    let finite = 0;
    for (const [k, base] of [0.7, -1.3, 2.1, -0.4].entries()) {
      const scope = Object.fromEntries(others.map((n, j) => [n, base + 0.53 * j + 0.17 * k * j]));
      try {
        scope[solvedFor.L] = Number(math.evaluate(solvedFor.rest, scope));
        const v = Number(math.evaluate(simplified, scope));
        if (Number.isFinite(v)) finite += 1;
      } catch { /* undefined there */ }
    }
    if (finite >= 3) { const t = nonzeroText(f); if (!out.includes(t)) out.push(t); }
  }
  return out;
}

// Simplify with constants in it ((a*x + a)/a, a*x + b*x, x/a + x/b): the
// one-letter equality check could not evaluate a second letter, so these
// came back unchanged. Algebrite's form is checked in every letter, kept when
// it is shorter or has fewer terms (collecting like terms, one fraction), and
// any factor it cancelled is stated: (a*x + a)/a = x + 1, for a ≠ 0.
async function simplifyWithConstants(expression, variable) {
  const Algebrite = await loadAlgebrite();
  const run = (e) => { const o = String(Algebrite.run(e)).trim(); if (!o || /nil|error|stop/i.test(o)) throw new Error(o); return o; };
  const termCount = (t) => splitTerms(String(t)).length;
  let raw;
  try { raw = run(`simplify(${expression})`); } catch { return null; }
  // A sum of reciprocals ((1/a + 1/b)x) reads as one fraction: (a + b)x/(ab).
  let combined = false;
  if (/\(1\/[a-z]/i.test(raw) || termCount(raw) > 1) {
    try {
      const num = run(`numerator(${raw})`);
      const den = run(`denominator(${raw})`);
      if (/[a-z]/i.test(den) && den !== '1') {
        const wrap = (t) => (termCount(t) > 1 || /\*/.test(t) ? `(${t})` : t);
        const one = `${num}/${wrap(den)}`;
        if (termCount(one) < termCount(raw) || /\(1\//.test(raw)) { raw = one; combined = true; }
      }
    } catch { /* keep Algebrite's form */ }
  }
  // Multiplied out, in textbook order, when that is as short: (x + a)² − x²
  // is 2ax + a², not a(2x + a).
  if (!combined && !/\//.test(raw)) {
    try {
      const expanded = textbookOrder(run(`expand(${expression})`), Algebrite);
      if (!/\//.test(expanded) && complexity(juxtapose(beautify(expanded))) <= complexity(juxtapose(beautify(raw)))) raw = expanded;
    } catch { /* keep the simplified form */ }
  }
  const answer = juxtapose(beautify(raw)
    .replace(/(?<![\w^/.)])1\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$2/$1')
    .replace(/(?<![\w^/.)])(\d+)\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$1$3/$2'));
  if (!expressionsEqualInAllLetters(expression, raw)) return null;
  const shorter = complexity(answer) < complexity(expression);
  if (!shorter && termCount(answer) >= termCount(expression)) return null;
  // Multiplying out a product is expanding, not simplifying: (a + b)c stays.
  if (!/\//.test(expression) && termCount(answer) > termCount(expression)) return null;
  const typed = beautify(expression);
  const fraction = /\//.test(expression);
  const cancelled = fraction ? cancelledFactors(expression, raw, variable, Algebrite) : [];
  let middle;
  if (combined) {
    let den = '';
    try { den = juxtapose(beautify(run(`denominator(${raw})`))); } catch { /* none */ }
    middle = [`Write every term over the common denominator ${mark(den)} and add the numerators.`];
  } else if (fraction) {
    middle = (await fractionFactoring(expression, variable)) || ['Factor the top and the bottom, and cancel the common factor.'];
  } else {
    middle = [termCount(answer) < termCount(expression) && /\(/.test(answer) && !/\(/.test(expression)
      ? `Collect the like terms: they share a factor, and their coefficients are added.`
      : 'Multiply out and combine like terms.'];
  }
  const steps = [
    `Original expression: ${mark(typed)}`,
    ...(constantNote(expression, variable) ? [constantNote(expression, variable)] : []),
    ...middle,
    `Simplified form: ${mark(answer)}`,
  ];
  if (cancelled.length) {
    steps.push(`The original divides by zero where ${cancelled.map((c) => mark(c.replace('≠', '='))).join(' or ')}, and the simplified form does not, so the two are equal only for ${cancelled.map((c) => mark(c)).join(' and ')}.`);
  }
  return {
    steps,
    answer: cancelled.length ? `${answer}, for ${cancelled.join(' and ')}` : answer,
    tips: cancelled.length || fraction ? CANCEL_TIPS : SIMPLIFY_TIPS,
    common_mistakes: cancelled.length || fraction ? CANCEL_MISTAKES : SIMPLIFY_MISTAKES,
    graph: null,
  };
}

// A product of letters as a textbook writes it: 4ab, (a + b)x, not 4a*b.
// A number after "/" keeps its "*" (1/2*x would read as 1/(2x)).
const juxtapose = (t) => String(t).replace(/(\d+(?:\.\d+)?|[a-z]+|\))\s*\*\s*(?=[a-z(])/gi, (m, left, at, all) => (
  (/^\d/.test(left) && all[at - 1] === '/') || /^[a-z]{2,}$/i.test(left) ? m : left));

// "The letters a and b are constants…": said only when there is an x, y or z
// to hold them apart from.
function constantNote(expression, variable) {
  if (!/^[xyz]$/.test(variable) || !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(expression)) return '';
  const list = constantList(expression, variable);
  if (!list) return '';
  return list.includes(' and ')
    ? `The letters ${list} are constants: they are simplified as numbers would be.`
    : `The letter ${list} is a constant: it is simplified as a number would be.`;
}

// "a and b" / "a, b and c": the constants, every letter but the variable.
function constantList(expression, variable) {
  const letters = [...new Set(String(expression).replace(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot|sqrt|abs|log|ln|exp|pi)(?![a-z])/gi, '').match(/(?<![a-z])[a-z](?![a-z])/gi) || [])]
    .filter((c) => c !== variable && c !== 'e' && c !== 'i').sort();
  const marked = letters.map((c) => mark(c));
  return marked.length > 1 ? `${marked.slice(0, -1).join(', ')} and ${marked.at(-1)}` : marked[0] || '';
}

export async function simplifyExpression(expression) {
  // Exact-radical rung: a constant expression containing a radical should
  // answer in exact simplified form (sqrt(50) → 5√2), not a decimal.
  const exact = await exactRadicalForm(expression);
  if (exact) return exact;

  const variable = extractVariable(expression);
  const otherLetters = String(expression).replace(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot|sqrt|abs|log|ln|exp|pi)(?![a-z])/gi, '')
    .match(/(?<![a-z])[a-z](?![a-z])/gi)?.filter((c) => c !== variable && c !== 'e' && c !== 'i') || [];
  if (otherLetters.length && !/[a-z]{2,}/i.test(expression.replace(/(?<![a-z])(?:pi)(?![a-z])/gi, ''))) {
    const lettered = await simplifyWithConstants(expression, variable);
    if (lettered) return lettered;
  }
  const inputLen = complexity(expression);

  // A constant expression that nothing above could simplify (sqrt(-4),
  // (-8)^(1/3)) is still worth a value: evaluate it as arithmetic rather
  // than echoing the input back as the "simplified" answer.
  if (!hasVariable(expression, variable)) {
    try {
      const { solveArithmetic } = await import('../arithmeticSolver.js');
      const arith = solveArithmetic(parseMathExpression(expression));
      if (arith && arith.answer && String(arith.answer).replace(/\s/g, '') !== String(expression).replace(/\s/g, '')) {
        return arith;
      }
    } catch { /* fall through to the symbolic candidates */ }
  }

  // Gather candidate simplifications and keep only those that are genuinely
  // equal to the input. An engine can "simplify" (x^2-9)/(x+3) into the
  // LONGER split form x^2/(x+3) - 9/(x+3) where Algebrite cancels it to x-3,
  // so we pick the SHORTEST verified-equivalent candidate and a result is
  // never longer than what the student typed. A polynomial's expanded form
  // wins ties: "simplify 2(x + 3) + 4x" means 6x + 6, not 6(x + 1).
  const candidates = [];
  const polynomial = await expandPolynomial(expression, variable);
  if (polynomial) candidates.push({ source: 'expand', answer: polynomial.answer, steps: polynomial.steps });
  const algebrite = await algebriteSimplify(expression, variable);
  if (algebrite) candidates.push({ source: 'algebrite', answer: algebrite });
  try {
    const mjs = beautify(math.simplify(expression).toString());
    if (mjs && equivalentOrConstant(expression, mjs, variable)) {
      candidates.push({ source: 'mathjs', answer: mjs });
    }
  } catch {
    // fall through
  }

  // No engine produced anything. If the input does not even parse, that is a
  // syntax problem and must be reported as one — echoing "x^2 + *3 is already
  // in simplest form" under a solved status was the July F1 class surviving in
  // this one path (September 2026 audit row A02).
  if (candidates.length === 0) {
    try {
      math.parse(expression);
    } catch (err) {
      const detail = String(err?.message || '').replace(/\s*\(char \d+\)\s*$/, '');
      return parseError({
        input: expression,
        hint: detail ? `${detail}.` : 'The expression contains an operator sequence that cannot be read.',
      });
    }
  }

  // Best = shortest; on a tie prefer the expanded polynomial and its steps.
  candidates.sort((a, b) => {
    const d = complexity(a.answer) - complexity(b.answer);
    if (d !== 0) return d;
    return (a.source === 'expand' ? -1 : 0) - (b.source === 'expand' ? -1 : 0);
  });
  const best = candidates[0];

  let steps;
  let answer;
  let cancelled = false;
  if (best && complexity(best.answer) < inputLen) {
    // A real simplification. A polynomial shows its expansion and combining;
    // anything else gets a clean three-line derivation.
    answer = best.answer;
    // A fraction whose denominator has the variable is simplified by
    // cancelling, whichever engine found the answer ((x^3 - x)/(x^2 - 1) was
    // "Multiply out the parentheses: x").
    const factoring = /\/\s*\(?[^)]*[a-z]/i.test(expression) ? await fractionFactoring(expression, variable) : null;
    if (factoring) cancelled = true;
    if (best.steps && !factoring) {
      steps = best.steps;
    } else {
      steps = [
        `Original expression: ${mark(beautify(expression))}`,
        ...(factoring || [/\//.test(expression)
          ? 'Factor and cancel the common factor(s).'
          : 'Combine like terms and simplify.']),
        `Simplified form: ${mark(answer)}`,
      ];
    }
    // A cancelled factor was zero somewhere: the original is undefined
    // there and the simplified form is not, so they are equal only away
    // from those points, as a textbook says.
    const excluded = await cancelledPoints(expression, answer, variable);
    if (excluded.length) {
      cancelled = true;
      const list = excluded.map((q) => `${variable} ≠ ${q.display}`).join(', ');
      steps.push(`The original divides by zero at ${excluded.map((q) => mark(`${variable} = ${q.display}`)).join(' and ')}, where the simplified form does not, so the two are equal only for ${excluded.map((q) => mark(`${variable} ≠ ${q.display}`)).join(' and ')}.`);
      answer = `${answer}, for ${list}`;
    }
  } else {
    // A polynomial that is already expanded may still factor, and that is
    // usually what a student typing x^2 - 5x + 6 under Algebra wants: it
    // was echoed back unchanged (October 2026 review). Both forms are given.
    const polynomial = !/[a-z]{2,}/i.test(expression) && !/\/\s*(?:\([^)]*[a-z]|[a-z])/i.test(expression) && /[a-z]\s*\^\s*\d/i.test(expression);
    const factored = polynomial ? await factorExpression(expression) : null;
    if (factored && !/no simpler factors/.test(factored.answer)) {
      return {
        ...factored,
        steps: [
          `${mark(beautify(expression))} is already simplified: expanded, with like terms combined. It does factor, though:`,
          ...factored.steps.slice(1),
        ],
        answer: `${beautify(expression)} = ${factored.answer}`,
      };
    }
    answer = beautify(expression);
    steps = [`The expression ${beautify(expression)} is already in simplest form.`];
  }

  return {
    steps,
    answer,
    tips: cancelled ? CANCEL_TIPS : SIMPLIFY_TIPS,
    common_mistakes: cancelled ? CANCEL_MISTAKES : SIMPLIFY_MISTAKES,
    graph: generateAlgebraGraph(expression),
  };
}

// N/D with polynomial N and D: each factored (Algebrite, degree ≤ 6), and the
// factors they share named, as the cancellation is taught. Null when the
// expression is not one such fraction, nothing is shared, or factoring fails.
async function fractionFactoring(expression, variable) {
  const parts = splitTopLevel(String(expression), '/');
  if (parts.length !== 2) return null;
  const [num, den] = parts.map((t) => stripOuterParens(t.trim()));
  const isPoly = (t) => /^[\d\s+\-*^().a-z]*$/i.test(t) && !/[a-z]{2,}/i.test(t);
  if (!isPoly(num) || !isPoly(den)) return null;
  try {
    const Algebrite = await loadAlgebrite();
    const degree = (t) => Number(String(Algebrite.run(`deg(${t}, ${variable})`)).trim());
    if (!(degree(num) <= 6 && degree(den) <= 6)) return null;
    const factorText = (t) => beautify(String(Algebrite.run(`factor(${t}, ${variable})`)).trim()).replace(/\)\*\(/g, ')(').replace(/(^|[^\w)])(\w+)\*\(/g, '$1$2(');
    const fn = factorText(num);
    const fd = factorText(den);
    const common = beautify(String(Algebrite.run(`gcd(${num}, ${den})`)).trim());
    if (isAlgebriteFailure(fn) || isAlgebriteFailure(fd) || !common || /^-?\d+$/.test(common)) return null;
    const show = (t) => (/[+\-]/.test(t.replace(/^-/, '')) && !/^\(.*\)$/.test(t) ? `(${t})` : t);
    return [
      beautify(num) === fn ? `The numerator ${mark(fn)} is already factored.` : `Factor the numerator: ${mark(`${beautify(num)} = ${fn}`)}.`,
      beautify(den) === fd ? `The denominator ${mark(fd)} is already factored.` : `Factor the denominator: ${mark(`${beautify(den)} = ${fd}`)}.`,
      `Cancel the common factor${/\)\s*\(|\)\^/.test(factorText(common)) ? 's' : ''} ${mark(show(factorText(common)))} from the top and the bottom.`,
    ];
  } catch {
    return null;
  }
}

// A polynomial in the variable (nothing but numbers in any denominator),
// expanded by Algebrite, with the working: each top-level term multiplied out,
// then like terms combined. Null for anything that is not a polynomial.
async function expandPolynomial(expression, variable) {
  if (/[a-z]{2,}/i.test(expression)) return null; // function calls
  if (/[a-z]/i.test(expression.replace(new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'gi'), ''))) return null; // other letters
  try {
    const Algebrite = await loadAlgebrite();
    const denominator = String(Algebrite.run(`denominator(${expression})`)).trim();
    if (hasVariable(denominator, variable) || /nil|error|stop/i.test(denominator)) return null;
    const expand = (e) => {
      const out = String(Algebrite.run(`expand(${e})`)).trim();
      if (!out || /nil|error|stop/i.test(out)) throw new Error('expand failed');
      return out;
    };
    const answer = beautify(expand(expression));
    if (!equivalentOrConstant(expression, answer, variable)) return null;
    const terms = splitTerms(expression);
    const multiplied = beautify(terms.map((t) => `(${t.signed.includes('(') ? expand(t.signed) : t.signed})`).join(' + ')
      .replace(/\(([^()]*)\)/g, '$1'));
    const steps = [];
    if (expression.includes('(')) {
      steps.push(`Multiply out the parentheses: ${multiplied}`);
      if (complexity(multiplied) !== complexity(answer)) steps.push(`Combine like terms: ${answer}`);
    } else {
      steps.push(`${terms.length > 1 ? 'Combine like terms' : 'Simplify'}: ${answer}`);
    }
    return { answer, steps };
  } catch {
    return null;
  }
}

// Normalized size of an expression for "is this actually simpler?" comparisons.
// Strips spaces and explicit '*' so 2*(x+2) and 2(x+2) compare equal.
function complexity(expr) {
  return String(expr).replace(/[\s*]/g, '').length;
}

// Algebrite simplify, beautified, or null if it errors / doesn't change / no
// longer matches the input numerically.
async function algebriteSimplify(expression, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const out = String(Algebrite.run(`simplify(${expression})`)).trim();
    if (!out || /nil|error|stop/i.test(out)) return null;
    // Algebrite writes x/2 as 1/2*x; show it the textbook way.
    const pretty = beautify(out)
      .replace(/(?<![\w^/.)])1\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$2/$1')
      .replace(/(?<![\w^/.)])(\d+)\/(\d+)\*([a-z](?:\^\d+)?)(?![\w^(])/gi, '$1$3/$2');
    if (!equivalentOrConstant(expression, pretty, variable)) return null;
    return pretty;
  } catch {
    return null;
  }
}

// expressionsNumericallyEqual, but tolerant of constant (variable-free)
// expressions, where the sampler has nothing to vary.
function equivalentOrConstant(a, b, variable) {
  if (expressionsNumericallyEqual(a, b, variable)) return true;
  try {
    const va = Number(math.evaluate(String(a)));
    const vb = Number(math.evaluate(String(b)));
    return Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-9 * (1 + Math.abs(va));
  } catch {
    return false;
  }
}

export function generateAlgebraGraph(expression) {
  try {
    if (isEquation(expression)) return null;
    const variable = extractVariable(expression);
    const points = sampleFunction(expression, variable);

    if (points.length > 0) {
      return {
        points,
        expression,
        variable,
        title: `Graph of ${beautify(expression)}`,
        description: 'Visual representation of the expression',
      };
    }
  } catch (error) {
    console.error('Graph generation error:', error);
  }
  return null;
}
