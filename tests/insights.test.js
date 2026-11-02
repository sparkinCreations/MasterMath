import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { finalizeResult } from '../src/lib/api/finalize.js';
import { SHOWN_AT_FIRST, SOURCE_HOSTS, isAllowedLink, splitGuidance, sourceOf } from '../src/lib/guidance.js';
import { LEARN_MORE, LEARN_MORE_HOSTS, learnMoreFor } from '../src/lib/learnMore.js';
import { sheetBlocks } from '../src/lib/pdfTypeset.js';

// 1.60.0 (docs/future-work/PLAN-INSIGHTS-AND-RESOURCES.md): ranked lists with
// the rest behind "Show more", a source where one is due, and "Learn more"
// links chosen by topic.

test('an item with a source becomes text, and its source moves to result.sources', () => {
  const r = finalizeResult({
    steps: ['s'], answer: 'a', status: 'solved',
    tips: [{ text: 'LIATE', source: { title: 'Kasube 1983', url: 'https://doi.org/10.1080/00029890.1983.11971195' } }, 'plain'],
    common_mistakes: ['m'],
  }, 'x');
  assert.deepEqual(r.tips, ['LIATE', 'plain']);
  assert.deepEqual(sourceOf(r, 'LIATE'), { title: 'Kasube 1983', url: 'https://doi.org/10.1080/00029890.1983.11971195' });
  assert.equal(sourceOf(r, 'plain'), null);
});

test('a source must be an https link to a publisher or a DOI', () => {
  const { texts, sources } = splitGuidance([
    { text: 'a', source: { title: 't', url: 'http://doi.org/10.1/x' } },
    { text: 'b', source: { title: 't', url: 'https://example.com/x' } },
    { text: 'c', source: { title: '', url: 'https://doi.org/10.1/x' } },
    { text: 'd', source: { title: 't', url: 'javascript:alert(1)' } },
  ]);
  assert.deepEqual(texts, ['a', 'b', 'c', 'd']);
  assert.deepEqual(sources, {});
  assert.ok(SOURCE_HOSTS.every((h) => !h.includes('/')));
});

test('a solution with no sourced item carries no sources field', async () => {
  assert.equal((await solveProblem('x^3', 'integrals')).sources, undefined);
});

test('integration by parts cites LIATE (Kasube 1983)', async () => {
  const r = await solveProblem('x*e^x', 'integrals');
  const liate = r.tips.find((t) => /LIATE/.test(t));
  assert.ok(liate);
  const source = sourceOf(r, liate);
  assert.match(source.title, /Kasube/);
  assert.ok(isAllowedLink(source.url, SOURCE_HOSTS));
});

test('every Learn more link is https, on an approved site, and listed once', () => {
  const seen = new Set();
  for (const [topic, links] of Object.entries(LEARN_MORE)) {
    assert.ok(links.length > 0, topic);
    for (const link of links) {
      assert.ok(isAllowedLink(link.url, LEARN_MORE_HOSTS), `${topic}: ${link.url}`);
      assert.ok(link.site && link.title, `${topic}: ${link.url}`);
      assert.ok(!seen.has(link.url), `listed twice: ${link.url}`);
      seen.add(link.url);
    }
  }
  for (const topic of ['derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'algebra', 'other']) {
    assert.ok(learnMoreFor(topic).length > 0, topic);
  }
  assert.deepEqual(learnMoreFor('auto'), []);
});

// The integrals pilot: one problem per method. Each method has more than the
// three shown at first, no list repeats an item, and no two methods lead
// with the same insight.
const INTEGRAL_METHODS = [
  ['power', 'x^3'], ['trig', 'sin(x)'], ['exponential', 'e^(2x)'], ['exponential base', '2^x'], ['reciprocal', '1/x'],
  ['linear substitution', '1/(2x+1)'], ['linear inside', 'cos(3x)'], ['half-angle', 'sin(x)^2'], ['trig identity', 'sin(x)^2*cos(x)^2'],
  ['trig quotient', 'tan(x)'], ['hyperbolic', 'sinh(x)'], ['inverse trig', '1/(1+x^2)'], ['substitution', 'x*cos(x^2)'],
  ['by parts', 'x*e^x'], ['by parts, ln', 'ln(x)'], ['by parts, cyclic', 'e^x*sin(x)'], ['by parts, repeated', 'x^2*sin(x)'],
  ['partial fractions', '1/(x^2 - 1)'], ['divide first', '(x^3+1)/(x-1)'], ['trig substitution', 'sqrt(1 - x^2)'],
  ['trig power', 'sin(x)^3'], ['reduction', 'sec(x)^3'], ['tan reduction', 'tan(x)^2'], ['form substitution', '1/(1+e^x)'],
  ['absolute value', 'abs(x)'], ['erf', 'e^(-x^2)'], ['definite', '∫_0^1 x^2 dx'], ['improper', '∫_1^∞ 1/x^2 dx'],
];

test('integrals: every method has more to show, no repeats, and its own first insight', async () => {
  const leads = new Map();
  for (const [method, problem] of INTEGRAL_METHODS) {
    const r = await solveProblem(problem, 'integrals');
    assert.equal(r.status, 'solved', `${method}: ${problem}`);
    assert.ok(r.tips.length > SHOWN_AT_FIRST, `${method}: only ${r.tips.length} insights`);
    assert.equal(new Set(r.tips).size, r.tips.length, `${method}: a repeated insight`);
    assert.equal(new Set(r.common_mistakes).size, r.common_mistakes.length, `${method}: a repeated mistake`);
    assert.ok(!leads.has(r.tips[0]), `${method} and ${leads.get(r.tips[0])} lead with the same insight`);
    leads.set(r.tips[0], method);
  }
});

test('the wrong-method insights found in the pilot are gone', async () => {
  // 2^x and sinh(x) led with ∫tan, ∫cot, ∫sec; tan²(x) with the sec^n reduction formula.
  assert.doesNotMatch((await solveProblem('2^x', 'integrals')).tips[0], /tan/);
  assert.doesNotMatch((await solveProblem('sinh(x)', 'integrals')).tips[0], /tan/);
  assert.doesNotMatch((await solveProblem('tan(x)^2', 'integrals')).tips[0], /sec\^n/);
  // Forgetting +C stays a visible mistake for every indefinite method.
  for (const [, problem] of INTEGRAL_METHODS.filter(([m]) => !['definite', 'improper'].includes(m))) {
    const r = await solveProblem(problem, 'integrals');
    assert.ok(r.common_mistakes.slice(0, SHOWN_AT_FIRST).some((m) => /constant of integration/.test(m)), problem);
  }
});

test('the typeset PDF prints a source under its insight', async () => {
  const r = await solveProblem('x*e^x', 'integrals');
  const blocks = sheetBlocks({ title: 'Integrals', problem: 'x*e^x', status: {}, solution: r, graph: null });
  assert.ok(blocks.some((b) => /Source: Herbert E\. Kasube/.test(b.text)));
});

// 1.61.0, derivatives: one problem per rule. As for integrals, every rule has
// more than three insights, nothing repeats, and no two rules lead alike.
const DERIVATIVE_METHODS = [
  ['power', 'x^3'], ['negative power', '1/x^2'], ['chain', 'sin(3x^2)'], ['product', 'x^2*sin(x)'], ['quotient', '(x+1)/(x-1)'],
  ['trig', 'sin(x)'], ['inverse trig', 'arcsin(x)'], ['hyperbolic', 'sinh(x)'], ['exponential', 'e^x'], ['logarithm', 'ln(x)'],
  ['logarithmic differentiation', 'x^x'], ['error function', 'erf(x)'], ['absolute value', 'abs(2x-4)'], ['implicit', 'x^2 + y^2 = 25'],
];

test('derivatives: every rule has more to show, no repeats, and its own first insight', async () => {
  const leads = new Map();
  for (const [method, problem] of DERIVATIVE_METHODS) {
    const r = await solveProblem(problem, 'derivatives');
    assert.equal(r.status, 'solved', `${method}: ${problem}`);
    assert.ok(r.tips.length > SHOWN_AT_FIRST, `${method}: only ${r.tips.length} insights`);
    assert.ok(r.common_mistakes.length >= 2, `${method}: only ${r.common_mistakes.length} mistakes`);
    assert.equal(new Set(r.tips).size, r.tips.length, `${method}: a repeated insight`);
    assert.equal(new Set(r.common_mistakes).size, r.common_mistakes.length, `${method}: a repeated mistake`);
    assert.ok(!leads.has(r.tips[0]), `${method} and ${leads.get(r.tips[0])} lead with the same insight`);
    leads.set(r.tips[0], method);
  }
});

test('derivatives: the chain rule names the outer function, and a second derivative says what f″ means', async () => {
  // The rule applied to the problem is second, the outer function's formula third.
  assert.match((await solveProblem('e^(3x)', 'derivatives')).tips[2], /e\^u·u′/);
  assert.match((await solveProblem('ln(x^2+1)', 'derivatives')).tips[2], /u′\/u/);
  assert.match((await solveProblem('(2x+1)^5', 'derivatives')).tips[2], /u\^\(n−1\)·u′/);
  const second = await solveProblem('second derivative of x*e^x', 'derivatives');
  assert.ok(second.tips.slice(0, SHOWN_AT_FIRST).some((t) => /derivative of the derivative/.test(t)));
  // A product with a chain inside: the product rule leads, the chain rule follows.
  const mixed = await solveProblem('x^2*e^(3x)', 'derivatives');
  assert.match(mixed.tips[0], /Product rule/);
});

// Outside review of 1.61.0 (docs/evaluations/2026-10/REVIEW-LOG-2026-10.md):
// its spot-check cases, the insight each should lead with, and what the sweep
// of the same class found.
const plainOf = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'derivatives');
  return { ...r, answer: stripMathMarkers(r.answer), tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};

test('review cases: the answers', async () => {
  const cases = [
    ['1/x^2', "f'(x) = -2/(x^3), x ≠ 0"], ['sin(3x^2)', "f'(x) = 6x*cos(3x^2)"], ['(2x+1)^5', "f'(x) = 10(2x + 1)^4"],
    ['arctan(2x)', "f'(x) = 2/(4x^2 + 1)"], ['(x+1)/(x-1)', "f'(x) = -2/((x - 1)^2), x ≠ 1"], ['2^x', "f'(x) = 2^x*ln(2)"],
    ['x^x', "f'(x) = x^x*(1 + ln(x)), x > 0"], ['second derivative of x*e^x', "f''(x) = e^x*(x + 2)"], ['x^3 at x = 2', "f'(2) = 12"],
    ['x*y = 1', 'dy/dx = -y/x'],
  ];
  for (const [p, answer] of cases) assert.equal((await plainOf(p)).answer, answer, p);
  assert.match((await plainOf('x^2*e^(3x)')).answer, /e\^\(3x\)/);
  assert.match((await plainOf('abs(2x-4)')).answer, /f'\(2\) does not exist/);
  assert.match((await plainOf('x^2 + y^2 = 25 at (3, 4)')).answer, /-3\/4/);
  assert.match((await plainOf('x^2 + y^2 = 25 at (5, 0)')).answer, /vertical/);
});

test('review cases: the rule applied to the problem comes second', async () => {
  assert.match((await plainOf('sin(3x^2)')).tips[1], /u = 3x\^2, with u′ = 6x: d\/dx sin\(3x\^2\) = cos\(3x\^2\)·6x/);
  assert.match((await plainOf('arctan(2x)')).tips[1], /1\/\(1 \+ \(2x\)²\)·2/);
  assert.match((await plainOf('x^2*sin(x)')).tips[1], /u = x\^2 and w = sin\(x\)/);
  assert.match((await plainOf('x^2*e^(3x)')).tips[1], /w′ = 3e\^\(3x\) \(one factor needs the chain rule\)/);
  assert.match((await plainOf('(x+1)/(x-1)')).tips[1], /u = x \+ 1 and w = x - 1/);
  assert.match((await plainOf('abs(2x-4)')).tips[1], /-2 for x < 2, f'\(x\) = 2 for x > 2/);
  assert.match((await plainOf('3x^4 - 2x + 7')).tips[0], /term by term/);
  assert.match((await plainOf('sec(x)')).tips[0], /sec\(x\)·tan\(x\)/);
  assert.match((await plainOf('2^x')).tips[0], /2\^x·ln\(2\)/);
  assert.ok((await plainOf('log(x)')).tips.slice(0, 2).some((t) => /1\/\(x·ln\(10\)\)/.test(t)));
  assert.match((await plainOf('x*y = 1')).tips[1], /d\/dx\(xy\) = y \+ x·dy\/dx/);
});

test('review cases: a task leads its insights and mistakes', async () => {
  const second = await plainOf('second derivative of x*e^x');
  assert.match(second.tips[0], /derivative of the derivative/);
  assert.match(second.mistakes[0], /Stopping at f′/);
  assert.match((await plainOf('x^3 at x = 2')).mistakes[0], /Differentiate first, then substitute/);
});

test('review: the qualified statements say where they hold', async () => {
  assert.ok((await plainOf('ln(x)')).tips.some((t) => /for x > 0, ln\(x³·\(x \+ 1\)\)/.test(t)));
  assert.ok((await plainOf('x^2 + y^2 = 25')).tips.some((t) => /wherever F_y ≠ 0/.test(t)));
  assert.ok((await plainOf('x^3')).tips.some((t) => /^Where the derivative exists/.test(t) && /stationary point/.test(t)));
  assert.ok(!(await plainOf('sin(3x^2)')).tips.some((t) => /expanded first/.test(t)));
  assert.ok((await plainOf('(2x+1)^5')).tips.some((t) => /expanded first/.test(t)));
  assert.ok((await plainOf('e^x')).tips.some((t) => /constant base a > 0/.test(t)));
  assert.match((await plainOf('x^x')).tips[0], /real-valued for x > 0/);
  assert.ok((await plainOf('erf(x)')).mistakes.some((m) => /Leaving out u′/.test(m)));
  // One warning about the inside's derivative, not two.
  const both = await plainOf('x^2*e^(3x) + sin(2x)');
  assert.equal(both.mistakes.filter((m) => /inside|chain rule inside/i.test(m)).length, 1);
});

test('review sweep: f′(a) needs f defined at a, and odd roots are real', async () => {
  const outside = await plainOf('ln(x) at x = -1');
  assert.equal(outside.answer, "f'(-1) does not exist: x = -1 is outside the domain of f");
  assert.match(outside.tips[0], /only where f itself is defined/);
  assert.match((await plainOf('log(x) at x = -2')).answer, /outside the domain/);
  assert.match((await plainOf('sqrt(x) at x = -4')).answer, /outside the domain/);
  assert.match((await plainOf('arcsin(x) at x = 2')).answer, /outside the domain/);
  assert.equal((await plainOf('x^(1/3) at x = -8')).answer, "f'(-8) = 1/12 ≈ 0.0833");
  assert.equal((await plainOf('x^(2/3) at x = -8')).answer, "f'(-8) = -1/3 ≈ -0.3333");
  assert.equal((await plainOf('ln(abs(x)) at x = -1')).answer, "f'(-1) = -1");
  assert.equal((await plainOf('(3x-1)^4')).answer, "f'(x) = 12(3x - 1)^3");
});

// The same reviewer's second pass (Round 22, second part): four fixes and two
// optional ones, each reproduced first.
test('second review: the most relevant mistake and the worked numbers lead', async () => {
  const outside = await plainOf('ln(x) at x = -1');
  assert.match(outside.mistakes[0], /^Applying the derivative's formula outside the domain of f/);
  assert.ok(!outside.mistakes.some((m) => /Substituting the point before differentiating/.test(m)));

  const second = await plainOf('second derivative of x*e^x');
  assert.ok(second.tips.slice(0, 3).some((t) => t === "Apply the rules once per order: f′(x) = e^x*(x + 1), then f″(x) = e^x*(x + 2)."));
  assert.match(second.mistakes[0], /f′\(x\) = e\^x\*\(x \+ 1\) is only the first round/);
  assert.match((await plainOf('third derivative of sin(2x)')).mistakes[0], /f‴ needs 2 more/);

  const point = await plainOf('x^3 at x = 2');
  assert.equal(point.tips[2], 'Differentiate first, then evaluate: f′(x) = 3x^2, so f′(2) = 12.');

  assert.match((await plainOf('sec(x)')).mistakes[0], /^Confusing the derivative of sec\(x\) with sec²\(x\)/);
  assert.match((await plainOf('x^2 + y^2 = 25 at (3, 4)')).tips[1], /dy\/dx = -x\/y, so at \(3, 4\) it is -3\/4/);
  assert.ok((await plainOf('x^x')).mistakes.some((m) => /f\(x\)\^g\(x\) with f\(x\) > 0, d\/dx f\^g = g·f\^\(g−1\)·f′ \+ f\^g·ln\(f\)·g′/.test(m)));

  // The factoring example is the student's own answer, or none.
  assert.match((await plainOf('x^2*e^(3x)')).tips[2], /here it becomes x\*e\^\(3x\)\*\(3x \+ 2\)/);
  assert.doesNotMatch((await plainOf('x^2*sin(x)')).tips[2], /e\^\(3x\)/);
});

// Third pass (Round 22): a polynomial's own mistakes first, no repeated f″,
// and the f^g formula's domain.
test('third review: polynomial mistakes, no repeated f″, f > 0 for f^g', async () => {
  const poly = await plainOf('3x^4 - 2x + 7');
  assert.ok(poly.mistakes.slice(0, 3).some((m) => /lone constant/.test(m)));
  assert.ok(poly.mistakes.slice(0, 3).some((m) => /Sign slips/.test(m)));
  assert.equal(poly.mistakes.filter((m) => /Sign slips/.test(m)).length, 1);
  const second = await plainOf('second derivative of x*e^x');
  assert.equal(second.tips.filter((t) => /e\^x\*\(x \+ 2\)/.test(t)).length, 1);
  assert.ok((await plainOf('x^x')).mistakes.some((m) => /f\(x\)\^g\(x\) with f\(x\) > 0/.test(m)));
});

// Outside review of the integrals pilot (Round 23): each claim reproduced,
// then fixed.
const plainInt = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'integrals');
  return { ...r, tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};

test('integrals review: the second insight works the student\'s integral', async () => {
  const second = async (p) => (await plainInt(p)).tips[1];
  assert.equal(await second('x^3'), 'Here: ∫(x^3) dx = 1/4*x^4 + C.');
  assert.equal(await second('e^(2x)'), 'Here: ∫(e^(2x)) dx = 1/2*e^(2x) + C.');
  assert.equal(await second('cos(3x)'), 'Here: ∫(cos(3x)) dx = 1/3*sin(3x) + C.');
  assert.equal(await second('x*cos(x^2)'), 'Here: u = x^2, du = 2x dx, so ∫(x*cos(x^2)) dx = 1/2*sin(x^2) + C.');
  assert.equal(await second('x*e^x'), 'Here: u = x, dv = e^x dx, so ∫(x*e^x) dx = e^x*(x - 1) + C.');
  assert.match(await second('e^x*sin(x)'), /the integral comes back: 2I = e\^x\*\(-cos\(x\) \+ sin\(x\)\)/);
  assert.match(await second('x^2*sin(x)'), /and 2 rounds, so .* = 2cos\(x\) \+ 2x\*sin\(x\) - x\^2\*cos\(x\) \+ C/);
  assert.match(await second('1/(x^2-1)'), /^Here: 1\/\(x\^2 - 1\) = -1\/2·1\/\(x \+ 1\) \+ 1\/2·1\/\(x - 1\), so/);
  assert.equal(await second('(2x+3)/(x^2+1)'), 'Here: ∫((2x + 3)/(x^2 + 1)) dx = ln(x^2 + 1) + 3arctan(x) + C.');
  assert.match(await second('sqrt(1-x^2)'), /^Here: x = sin θ, dx = cos θ dθ, so .* = 1\/2\*arcsin\(x\) \+ 1\/2\*x\*√\(1 - x\^2\) \+ C\.$/);
  assert.equal((await plainInt('tan(x)^2')).tips[0], 'Here: ∫(tan(x)^2) dx = tan(x) - x + C.');
  assert.match((await plainInt('∫_1^∞ 1/x^2 dx')).tips[1], /= 1: an infinite interval can still have a finite area/);
  assert.match((await plainInt('∫_0^1 1/sqrt(x) dx')).tips[1], /= 2: the curve is unbounded, but the integral is not/);
});

test('integrals review: the five corrections and the smaller qualifications', async () => {
  const erf = await plainInt('e^(-x^2)');
  assert.match(erf.tips[0], /^∫e\^\(−x²\) dx = \(√π\/2\)·erf\(x\) \+ C/);
  assert.match(erf.tips[erf.tips.length - 1], /^Check any antiderivative by differentiating it/);
  assert.ok((await plainInt('1/(1+x^2)')).tips.some((t) => /for a > 0: ∫1\/\(a² \+ x²\)/.test(t)));
  const sub = await plainInt('x*cos(x^2)');
  assert.ok(!sub.mistakes.some((m) => /divide by g′\(x\)/.test(m)));
  assert.match(sub.mistakes[0], /^Forgetting to account for du = g′\(x\) dx/);
  assert.match((await plainInt('sin(x)^3')).tips[0], /keep a factor sec²θ for u = tan θ .* sec θ·tan θ for u = sec θ/);
  assert.ok((await plainInt('e^x')).tips.some((t) => /a\^x\/ln\(a\) for a > 0, a ≠ 1/.test(t)));
  assert.ok((await plainInt('∫_0^∞ e^(-x) dx')).tips.some((t) => /for whole numbers n ≥ 0/.test(t)));
  assert.match((await plainInt('∫_0^1 sqrt(1+x^4) dx')).tips[0], /a check on the accuracy rather than a proof of it/);
  assert.match((await plainInt('x*e^x')).tips[0], /a rule of thumb: the best u is the one that makes ∫v du simpler/);
  assert.match((await plainInt('1/(x^2-1)')).tips[0], /an irreducible quadratic a logarithm, an arctan or both/);
});

// Second pass on the integrals (Round 23): two corrections, three optional.
test('integrals second review: antiderivatives exist, repeated factors, the worked definite and divergent cases', async () => {
  const numeric = await plainInt('∫_0^1 sqrt(1+x^4) dx');
  assert.ok(!numeric.tips.some((t) => /there is no antiderivative/.test(t)));
  assert.match(numeric.tips[1], /continuous on an interval has an antiderivative there, but it may have no formula in elementary functions/);
  assert.match((await plainInt('1/(x^2-1)')).tips[0], /a repeated factor one term per power: its first power a logarithm, the higher powers a power/);
  assert.equal((await plainInt('∫_0^1 x^2 dx')).tips[1], 'Here F(x) = 1/3*x^3, so ∫_0^1 (x^2) dx = 1/3 (≈ 0.3333).');
  const diverges = await plainInt('∫_1^∞ 1/x dx');
  assert.equal(diverges.status, 'diverges');
  assert.equal(diverges.tips[1], 'Here F(x) = ln|x|, and F(t) → ∞ as t → ∞: the limit is not a finite number, so the integral diverges.');
  assert.match((await plainInt('e^x*sin(x)')).mistakes[0], /^Not recognising the original integral when it comes back/);
  assert.match((await plainInt('x^2*sin(x)')).mistakes[0], /^Stopping after one round/);
  assert.match((await plainInt('x*e^x')).mistakes[0], /^Choosing u and dv the wrong way round/);
});

// 1.62.0, algebra equations: the lessons of Rounds 22–23 built in. One
// equation per method: more than three insights, its own first insight,
// nothing repeated, and the equation's own working right after the method.
const plainAlg = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'algebra');
  return { ...r, answer: stripMathMarkers(r.answer), tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};
const EQUATION_METHODS = [
  ['linear', '2x + 5 = 11', 'Here: 2x + 5 = 11 → 2x = 6 → x = 6/2 = 3.'],
  ['fractions', 'x/3 + 1/2 = 5/6', 'Here: x/3 + 1/2 = 5/6 → 2x + 3 = 5 → 2x = 2 → x = 2/2 = 1.'],
  ['contradiction', '5x - 7 = 5x + 2', 'Here the x terms cancel and the two sides always differ by -9, never 0: no x is a solution.'],
  ['identity', '2(x+3) = 2x+6', 'Here the x terms cancel and the two sides are the same expression: every x is a solution.'],
  ['factoring', 'x^2 - 5x + 6 = 0', 'Here: x^2 - 5x + 6 = (x - 2)(x - 3) = 0, so x = 2 or x = 3.'],
  ['common factor', 'x^2 - 3x = 0', 'Here: x(x - 3) = 0, so x = 0 or x = 3.'],
  ['formula', 'x^2 + x - 1 = 0', 'Here a = 1, b = 1, c = -1 and b² − 4ac = 5, positive, so two real roots: x = (-1 - √5)/2 or x = (-1 + √5)/2.'],
  ['square roots', 'x^2 = 9', 'Here: x = ±√(9) = ±3, so x = -3 or x = 3.'],
  ['absolute value', 'abs(2x-3) = 5', 'Here: 2x - 3 = 5 or 2x - 3 = -5, so x = -1 or x = 4.'],
  ['radical', 'sqrt(x+2) = x', 'Here squaring gives x + 2 = (x)² = x^2, with candidates x = -1 or x = 2; x = -1 is extraneous, so x = 2.'],
  ['logarithm', 'ln(x) = 1', 'Here: x = e^1, so x = e.'],
  ['exponential', '2^x = 10', 'Here, taking a logarithm of both sides: x = ln(10)/ln(2) ≈ 3.3219.'],
  ['rational', 'x/(x-1) = 2', 'Here: clearing the denominators gives -x + 2 = 0, so x = 2.'],
  ['rational roots', 'x^3 - 6x^2 + 11x - 6 = 0', 'Here p(1) = 0, and dividing leaves x^2 - 5x + 6 = 0: x = 1 or x = 2 or x = 3.'],
  ['fractional power', 'x^(2/3) = 4', 'Here: (∛x)^2 = 4, so ∛x = ±2 and x = (±2)^3 = ±8.'],
];

test('algebra: every method has more to show, its own first insight, and the equation worked second', async () => {
  const leads = new Map();
  for (const [method, problem, worked] of EQUATION_METHODS) {
    const r = await plainAlg(problem);
    assert.ok(r.tips.length > SHOWN_AT_FIRST, `${method}: only ${r.tips.length} insights`);
    assert.equal(new Set(r.tips).size, r.tips.length, `${method}: a repeated insight`);
    assert.equal(r.tips[1], worked, method);
    if (!['contradiction', 'identity', 'common factor'].includes(method)) {
      assert.ok(!leads.has(r.tips[0]), `${method} and ${leads.get(r.tips[0])} lead with the same insight`);
      leads.set(r.tips[0], method);
    }
  }
  // Behind the base-10 note, the log case works its own equation.
  const logs = await plainAlg('log(x) + log(x - 3) = 1');
  assert.match(logs.tips[2], /^Here, combined and in exponential form: x\(x - 3\) = 10\^1, with candidates x = -2 or x = 5; x = -2 is rejected/);
  assert.match((await plainAlg('e^x + e^(-x) = 3')).tips[1], /^Here u = e\^x turns it into 1 - 3u \+ u\^2 = 0/);
  assert.equal((await plainAlg('x^2 - 6x + 9 = 0')).tips[1], 'Here: x^2 - 6x + 9 = (x - 3)^2 = 0, so x = 3.');
});

test('algebra: statements say where they hold', async () => {
  assert.ok((await plainAlg('ln(x) = 1')).tips.some((t) => /for a, b > 0\)/.test(t)));
  assert.match((await plainAlg('2^x = 10')).tips[0], /with a > 0, a ≠ 1 and b > 0/);
  assert.match((await plainAlg('x^3 - 6x^2 + 11x - 6 = 0')).tips[0], /for a polynomial with integer coefficients/);
  assert.ok((await plainAlg('x^2 + x + 1 = 0')).tips.some((t) => /^With real coefficients, the discriminant/.test(t)));
  assert.ok((await plainAlg('x^(2/3) = 4')).tips.some((t) => /undoing an even power gives ± \(when the right side is positive\)/.test(t)));
  assert.ok((await plainAlg('5x - 7 = 5x + 2')).tips.some((t) => /^For a linear equation two values settle it/.test(t)));
  assert.ok((await plainAlg('sqrt(72)')).tips.some((t) => /√\(a·b\) = √a · √b for a, b ≥ 0/.test(t)));
});

test('algebra sweep: edge cases answered correctly', async () => {
  const cases = [
    ['sqrt(x) = -2', /^No solution/], ['abs(x-1) = -3', /^No real solution/], ['x/(x-2) = 2/(x-2)', /^No solution/],
    ['1/(x-1) = 0', /^No real solution/], ['ln(x-1) + ln(x+1) = ln(3)', /^x = 2$/], ['e^x = -2', /^No real solution/],
    ['3^(2x) = 27', /^x = 3\/2$/], ['sqrt(x) + sqrt(x-5) = 5', /^x = 9$/], ['x^4 - 5x^2 + 4 = 0', /^x = -2 {2}or {2}x = -1 {2}or {2}x = 1 {2}or {2}x = 2$/],
    ['x/(x+1) + 1/x = 1', /^No real solution/], ['e^(2x) - 3e^x + 2 = 0', /^x = 0 {2}or {2}x = ln\(2\)/],
  ];
  for (const [p, re] of cases) assert.match((await plainAlg(p)).answer, re, p);
});

// Outside review of the algebra content (Round 24): each claim reproduced,
// and the sweep of the same class.
test('algebra review: fractional powers in lowest terms, through the root', async () => {
  for (const p of ['x^(2/3) = 4', 'x^(4/6) = 4', 'x^(6/9) = 4', 'x^(4/3) = 16']) assert.equal((await plainAlg(p)).answer, 'x = -8  or  x = 8', p);
  assert.equal((await plainAlg('x^(2/4) = 3')).answer, 'x = 9');
  assert.match((await plainAlg('x^(1/2) = -3')).answer, /^No real solution/);
  const r = await plainAlg('x^(4/6) = 4');
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  assert.equal(stripMathMarkers(r.steps[0]), 'The exponent 4/6 is 2/3 in lowest terms.');
  assert.equal(r.tips[1], 'Here: (∛x)^2 = 4, so ∛x = ±2 and x = (±2)^3 = ±8.');
  assert.match(r.tips[0], /^Read x\^\(p\/q\) as a root, then a power, with p\/q in lowest terms/);
  // A rejected candidate is one that leaves the original undefined, said so.
  const { solveProblem: sp } = await import('../src/lib/api.js');
  const ext = await sp('x^2/(x-1) = 1/(x-1) + 1', 'algebra');
  assert.match(ext.steps.join('\n'), /leaves the original equation undefined/);
});

test('algebra review: exact roots of x^n = c', async () => {
  assert.equal((await plainAlg('x^3 = 2')).answer, 'x = ∛2 (≈ 1.2599)  or  x = ∛2·(−1 − i√3)/2  or  x = ∛2·(−1 + i√3)/2');
  assert.equal((await plainAlg('x^4 + 1 = 0')).answer, 'x = (−1 − i)/√2  or  x = (−1 + i)/√2  or  x = (1 − i)/√2  or  x = (1 + i)/√2');
  assert.match((await plainAlg('x^4 = 5')).answer, /x = −∜5 \(≈ -1\.4953\)  or  x = ∜5/);
  assert.match((await plainAlg('x^3 = 2')).tips[0], /^x\^n = c is solved by an n-th root/);
  // Perfect powers keep the Rational Root Theorem's working.
  assert.equal((await plainAlg('x^3 = 8')).answer, 'x = 2  or  x = -1 - i√3  or  x = -1 + i√3');
});

test('algebra review: mistakes fit the case, common logs in base 10, Lambert W', async () => {
  const factor = await plainAlg('x^2 - 3x = 0');
  assert.equal(factor.mistakes.filter((m) => /Dividing both sides by x/.test(m)).length, 1);
  const abs = await plainAlg('abs(x-1) = -3');
  assert.match(abs.tips[0], /^An absolute value is never negative/);
  assert.match(abs.mistakes[0], /^Splitting \|x − 1\| = −3 into cases anyway/);
  assert.ok(!abs.mistakes.some((m) => /1\/x|logarithm/.test(m)));
  assert.match((await plainAlg('e^x = -2')).tips[0], /^a\^x with a > 0 is always positive/);
  const logs = await plainAlg('log(x) + log(x - 3) = 1');
  assert.match(logs.tips[1], /^log\(x\) = c means x = 10\^c/);
  assert.ok(!logs.tips.some((t) => /ln\(x\) = c means x = e\^c/.test(t)));
  assert.ok((await plainAlg('x*e^x = 1')).tips.some((t) => /x = W\(c\), the Lambert W function/.test(t)));
});

test('algebra review: factor, expand, simplify and radicals show their own result second', async () => {
  assert.equal((await plainAlg('factor x^2 - 9')).tips[1], 'Here: x^2 - 9 = (x - 3)(x + 3).');
  assert.equal((await plainAlg('sqrt(72)')).tips[1], 'Here: √72 = 6√2.');
  assert.equal((await plainAlg('expand (x+1)^2')).tips[1], 'Here: (x + 1)^2 = x^2 + 2x + 1.');
  assert.equal((await plainAlg('(x^2-1)/(x-1)')).tips[1], 'Here: (x^2 - 1)/(x - 1) = x + 1, for x ≠ 1.');
});

// 1.63.0: limits. Growth rates, the conjugate at infinity, one-sided domains
// and 0⁰ are worked, not sampled; each method's first insight is followed
// by the same insight applied to the limit.
const plainLim = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'limits');
  return { ...r, steps: r.steps.map(stripMathMarkers), tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};

test('limits: growth rates are worked by L\'Hôpital\'s rule, not sampled', async () => {
  for (const [p, answer] of [
    ['lim x->infinity x/e^x', '0'], ['lim x->infinity x^3/e^(2x)', '0'], ['lim x->infinity x^2*e^(-x)', '0'],
    ['lim x->infinity (x^2+1)/e^x', '0'], ['lim x->infinity e^x/x^2', '∞'], ['lim x->infinity x/e^(x/2)', '0'],
    ['lim x->infinity ln(x)/x', '0'], ['lim x->infinity ln(x)^2/sqrt(x)', '0'], ['lim x->infinity x/ln(x)', '∞'],
    ['lim x->0+ sqrt(x)*ln(x)', '0'], ['lim x->0 x*ln(x)', '0'],
  ]) {
    const r = await plainLim(p);
    assert.equal(r.answer.split(' = ').pop(), answer, p);
    assert.ok(!r.steps.some((s) => /^Samples:|^Sample ever closer/.test(s)), `${p} was sampled`);
  }
  const r = await plainLim('lim x->infinity x^3/e^(2x)');
  assert.match(r.steps.join('\n'), /3x\^2\/\(2e\^\(2x\)\), then 6x\/\(4e\^\(2x\)\), then 6\/\(8e\^\(2x\)\)/);
  assert.match(r.tips[0], /^An exponential outgrows every power/);
  assert.match(r.tips[1], /^Here: 3 rounds of L'Hôpital's rule, one per power of x/);
  const zero = await plainLim('lim x->0 x*ln(x)');
  assert.match(zero.steps[1], /not defined just to the left of x = 0/);
  assert.match(zero.steps.join('\n'), /Rewrite the product as a quotient, ln\(x\)\/x\^\(-1\), which is ∞\/∞/);
  assert.match(zero.tips[0], /^0·∞ is indeterminate/);
});

test('limits: what pulls one way is read off; ln(x) and x·sin(x) at ∞ were wrong', async () => {
  // ln(x) → ∞ "did not exist"; x·sin(x) "= ∞" from the sign of the last sample.
  assert.equal((await plainLim('lim x->infinity ln(x)')).answer, 'lim (x→∞) ln(x) = ∞');
  assert.equal((await plainLim('lim x->infinity x*sin(x)')).answer, 'lim (x→∞) x*sin(x) does not exist');
  assert.equal((await plainLim('lim x->infinity x*sin(x)')).tips[1], 'Here: x_n = π/2 + 2πn and y_n = 3π/2 + 2πn both → ∞, but x*sin(x) → ∞ along one and → -∞ along the other.');
  const decay = await plainLim('lim x->infinity e^(-x)/x');
  assert.equal(decay.answer, 'lim (x→∞) e^(-x)/x = 0');
  assert.match(decay.steps[1], /^Write it as 1\/\(x·e\^x\)/);
  assert.equal((await plainLim('lim x->infinity -2e^x')).answer, 'lim (x→∞) -2e^x = -∞');
  // A bare polynomial is its leading term, not "divide by x^0".
  const poly = await plainLim('lim x->-infinity x^3-2x');
  assert.match(poly.steps[1], /behaves like its highest-power term, x\^3/);
  assert.ok(!poly.steps.some((s) => /x\^0/.test(s)));
});

test('limits: the conjugate at infinity, both signs and both directions', async () => {
  for (const [p, answer] of [
    ['lim x->infinity sqrt(x^2+x)-x', '1/2 (≈ 0.5)'], ['lim x->infinity x - sqrt(x^2 + 3x)', '-3/2 (≈ -1.5)'],
    ['lim x->-infinity sqrt(x^2+x)+x', '-1/2 (≈ -0.5)'], ['lim x->infinity sqrt(4x^2+x)-2x', '1/4 (≈ 0.25)'],
  ]) {
    const r = await plainLim(p);
    assert.equal(r.answer.split(' = ').pop(), answer, p);
    assert.match(r.steps.join('\n'), /the form ∞ − ∞/, p);
  }
  const r = await plainLim('lim x->infinity x - sqrt(x^2 + 3x)');
  assert.equal(r.tips[1], 'Here: x - sqrt(x^2 + 3x) = −3x/(√(x^2 + 3x) + x), a quotient whose top and bottom grow at the same rate.');
});

test('limits: a one-sided domain is said, and 0⁰ is never 1 by substitution', async () => {
  // ln(x) at 0: "the one-sided limits disagree", with −18.42 read as a value.
  const ln = await plainLim('lim x->0 ln(x)');
  assert.equal(ln.answer, 'lim (x→0⁺) ln(x) = -∞');
  assert.ok(!ln.steps.some((s) => /disagree/.test(s)));
  assert.match(ln.tips[1], /x → 0 can only mean x → 0⁺/);
  assert.ok(ln.tips.some((t) => /Courses differ on the plain two-sided notation/.test(t)));
  assert.match(ln.steps.at(-1), /depends on your course/);
  const root = await plainLim('lim x->0 sqrt(x)');
  assert.equal(root.answer, 'lim (x→0⁺) sqrt(x) = 0');
  assert.match(root.steps.join('\n'), /not defined just to the left of x = 0/);
  // x^x at 0 was "defined and equals 1", then "simplify: x^x, substitute: 1".
  const xx = await plainLim('lim x->0 x^x');
  assert.equal(xx.answer, 'lim (x→0⁺) x^x = 1');
  assert.match(xx.steps.join('\n'), /gives 0\^0: an indeterminate form, not 1/);
  assert.ok(!xx.steps.some((s) => /Simplify the expression|defined and equals 1/.test(s)));
  assert.equal(xx.tips[1], 'Here: x^x = e^(x·ln(x)) and x·ln(x) → 0, so the limit is e^0 = 1.');
});

test('limits: each technique\'s insight is applied to the limit second', async () => {
  for (const [p, here] of [
    ['lim x->2 x^2+1', 'Here: x^2 + 1 is defined at x = 2, and substituting gives 5, a number, so no technique is needed.'],
    ['lim x->1 (x^2-1)/(x-1)', 'Here: (x^2 - 1)/(x - 1) = x + 1 for x ≠ 1, and x + 1 → 2 as x → 1.'],
    ['lim x->0 sin(3x)/x', 'Here: sin(3x)/x = (3) · sin(3x)/(3x), and the fraction → 1, so the limit is 3.'],
    ['lim x->0 x*sin(1/x)', 'Here: −|x| ≤ x·sin(1/x) ≤ |x|, and both bounds → 0, so the limit is 0.'],
    ['lim x->infinity (1+1/x)^(2x)', 'Here: E·u = (2x)·(1/x) = 2, so ln L = 2 and the limit is e^2.'],
    ['lim x->0 (e^x-1-x)/x^2', 'Here: the numerator starts x^2/2 and the denominator x^2; after cancelling, the limit is 1/2.'],
    ['lim x->0 (tan(x)-x)/x^3', 'Here: the bottom goes 3x^2, then 6x, then 6; only after round 3 is it not 0 at x = 0, and substitution gives 1/3.'],
    ['lim x->infinity (3x^2+1)/(2x^2-5)', 'Here: top and bottom both have degree 2, so the limit is the ratio of the leading coefficients, 3/2.'],
    ['lim x->0 1/x', 'Here: from the left 1/x → -∞, from the right → ∞.'],
    ['lim x->0 abs(x)/x', 'Here: from the left |x|/x → -1, from the right → 1.'],
  ]) {
    assert.equal((await plainLim(p)).tips[1], here, p);
  }
  // The Taylor step reads lowest powers first, not 1/40320*x^8 + … + x.
  assert.match((await plainLim('lim x->0 (e^x-1)/x')).steps[2], /^Numerator ≈ x \+ x\^2\/2 \+ x\^3\/6 \+ …; denominator ≈ x\./);
  // Sampled limits say they were sampled.
  assert.match((await plainLim('lim x->infinity x/1.5^x')).tips[0], /estimated by sampling large values, not proved/);
});

// Round 25 (outside review of LIMITS.md): proof, not samples; a one-sided
// domain answered as the one-sided limit; the factor rule stated where true.
test('limits review: no limit is concluded from samples where a proof is at hand', async () => {
  // x^x by logarithms: x^x = e^(x·ln x), and x·ln x → 0 by L'Hôpital's rule.
  const xx = await plainLim('lim x->0 x^x');
  assert.ok(!xx.steps.some((s) => /Sample|samples/.test(s)), xx.steps.join('\n'));
  assert.match(xx.steps.join('\n'), /Take logarithms: for x > 0, x\^x = e\^\(x·ln\(x\)\)/);
  assert.equal((await plainLim('lim x->0+ x^(2x)')).answer, 'lim (x→0⁺) x^(2x) = 1');
  // Oscillation by two sequences: x·sin(x), sin(x), cos(2x) at ∞; sin(1/x) at 0.
  for (const [p, along] of [
    ['lim x->infinity x*sin(x)', /Along x_n = π\/2 \+ 2πn .*x_n\*sin\(x_n\) = x_n → ∞/],
    ['lim x->infinity sin(x)', /Along x_n = π\/2 \+ 2πn .*sin\(x_n\) = 1\./],
    ['lim x->infinity cos(2x)', /Along x_n = πn .*cos\(2x_n\) = 1\./],
    ['lim x->0 sin(1/x)', /Along x_n = 1\/\(π\/2 \+ 2πn\) \(x_n → 0⁺ as n → ∞\), sin\(1\/x_n\) = 1\./],
    ['lim x->infinity -3x^2*cos(x)', /cos\(x_n\) = 1, so -3x_n\^2\*cos\(x_n\) = -3x_n\^2 → -∞/],
  ]) {
    const r = await plainLim(p);
    assert.match(r.answer, / does not exist$/, p);
    assert.ok(r.steps.some((s) => along.test(s)), `${p}\n${r.steps.join('\n')}`);
    assert.ok(!r.steps.some((s) => /^Samples:|^Sampling ever closer/.test(s)), p);
  }
  // b^x is an exponential too: x/2^x is worked, with its ln(2) factors.
  const two = await plainLim('lim x->infinity x/2^x');
  assert.match(two.steps.join('\n'), /1\/\(ln\(2\)·2\^x\)/);
  assert.equal((await plainLim('lim x->infinity 3^x/x^2')).answer, 'lim (x→∞) 3^x/x^2 = ∞');
  // What is still sampled says it is an estimate.
  assert.match((await plainLim('lim x->infinity x^(1/x)')).steps.at(-1), /an estimate, not a proof/);
});

test('limits review: the wording fixes', async () => {
  const factor = await plainLim('lim x->1 (x^2-1)/(x-1)');
  assert.match(factor.tips[0], /^For a quotient of polynomials that gives 0\/0 at x = a, both have the factor \(x − a\)/);
  assert.ok(!factor.tips.some((t) => /0\/0 means a common factor/.test(t)));
  assert.ok((await plainLim('lim x->2 x^2+1')).tips.some((t) => /^When substitution gives a finite value by continuity, no other technique is needed/.test(t)));
  // The conjugate's insights are general; the worked line is the student's.
  const conj = await plainLim('lim x->infinity x - sqrt(x^2 + 3x)');
  assert.ok(!conj.tips.some((t) => /x² \+ x\b/.test(t)), conj.tips.join('\n'));
  assert.match(conj.tips[1], /x - sqrt\(x\^2 \+ 3x\)/);
  assert.equal((await plainLim('lim x->0 sin(x)/(x+x^2)')).tips[1], 'Here: after one round the bottom is 2x + 1, not 0 at x = 0, so substitution gives 1.');
});

test('limits review, swept: vertical asymptotes and ln(x) at 0⁺ by proof, not samples', async () => {
  for (const [p, answer, step] of [
    ['lim x->0 1/x', 'lim (x→0) 1/x does not exist', /From the left \(x → 0⁻\): x < 0, so the function diverges to -∞/],
    ['lim x->0 1/x^2', 'lim (x→0) 1/x^2 = ∞', /has the factor x twice/],
    ['lim x->2 (x+1)/(x-2)', 'lim (x→2) (x + 1)/(x - 2) does not exist', /behaves like 3\/\(x − 2\)/],
    ['lim x->2+ 1/(x^2-4)', 'lim (x→2⁺) 1/(x^2 - 4) = ∞', /behaves like 1\/\(4\(x − 2\)\)/],
    ['lim x->-1 x/(x+1)^2', 'lim (x→-1) x/(x + 1)^2 = -∞', /\(x \+ 1\)\^2 > 0/],
    ['lim x->0 ln(x)', 'lim (x→0⁺) ln(x) = -∞', /ln is increasing and ln\(e\^\(−M\)\) = −M/],
    ['lim x->0+ ln(x)/x', 'lim (x→0⁺) ln(x)/x = -∞', /both parts pull the same way/],
  ]) {
    const r = await plainLim(p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => step.test(s)), `${p}\n${r.steps.join('\n')}`);
    assert.ok(!r.steps.some((s) => /^Sample|^Samples:/.test(s)), p);
  }
  assert.equal((await plainLim('lim x->0 1/x')).tips[1], 'Here: from the left 1/x → -∞, from the right → ∞.');
});

// Round 26 (second outside review of LIMITS.md): the growth-rate wording, and
// limits at −∞ by t = −x; swept: outside the domain at ±∞, roots whose
// leading terms do not cancel, underflow with no earlier nonzero sample.
test('limits second review: growth rates at −∞ through t = −x, not samples', async () => {
  for (const [p, answer, side] of [
    ['lim x->-infinity x*e^x', '0', 'below'], ['lim x->-infinity x^2*e^x', '0', 'above'], ['lim x->-infinity e^x', '0', 'above'],
    ['lim x->-infinity x^3/e^(-x)', '0', 'below'], ['lim x->-infinity x*e^(-x)', '-∞', null],
  ]) {
    const r = await plainLim(p);
    assert.equal(r.answer.split(' = ').pop(), answer, p);
    assert.match(r.steps[1], /^Let t = −x: as x → −∞, t → ∞/, p);
    assert.ok(!r.steps.some((s) => /^Samples:/.test(s)), p);
    if (side) assert.match(r.steps.at(-1), new RegExp(`approaches 0 from ${side}`), p);
  }
  assert.equal((await plainLim('lim x->-infinity x*e^x')).tips[1], 'Here: with t = −x → ∞, x*e^x = -t*e^(-t); the exponential outgrows the power of t, so the limit is 0, approached from below.');
});

test('limits second review, swept: the domain at ±∞, roots that do not cancel, underflow', async () => {
  // ln(x) as x → −∞ was "−∞": every sample was undefined, shown as "±∞".
  for (const p of ['lim x->-infinity ln(x)', 'lim x->-infinity sqrt(x)', 'lim x->infinity sqrt(-x)']) {
    const r = await plainLim(p);
    assert.match(r.answer, / does not exist$/, p);
    assert.match(r.steps.join('\n'), /not defined for large (negative|positive) x/, p);
    assert.ok(!r.steps.some((s) => /±∞/.test(s)), p);
  }
  // √(4x²) − x: the leading terms do not cancel (it was sampled).
  for (const [p, answer] of [['lim x->infinity sqrt(4x^2)-x', '∞'], ['lim x->-infinity sqrt(x^2+x)-x', '∞'], ['lim x->infinity x - sqrt(9x^2+1)', '-∞']]) {
    const r = await plainLim(p);
    assert.equal(r.answer.split(' = ').pop(), answer, p);
    assert.match(r.steps.join('\n'), /the leading terms do not cancel/, p);
  }
  assert.ok((await plainLim('lim x->infinity x - sqrt(x^2 + 3x)')).tips.some((t) => t === 'When the leading growth does not cancel, there is no ∞ − ∞ to resolve and the difference diverges: as x → ∞, √(4x²) − x = 2x − x = x → ∞.'));
  // Seven bare zeros now say they are underflow.
  assert.match((await plainLim('lim x->infinity x*e^(-x^2)')).steps.find((s) => /^Samples:/.test(s)), /cannot be represented in double precision/);
});

// 1.64.0: functions. Exact values where they are proved, ≈ where a value was
// located numerically, whole-line patterns for sine and cosine waves, and the
// family's first insight applied to the function second.
const plainFn = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'functions');
  return { ...r, steps: r.steps.map(stripMathMarkers), tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};

test('functions: exact where proved, ≈ where located numerically', async () => {
  for (const [p, part] of [
    ['e^x - 2', 'x-intercept at x = ln(2)'], // was "x = 0.6931"
    ['x*ln(x)', 'local minimum (1/e, -1/e)'], // was (0.3679, -0.3679)
    ['(x^2+1)/(x-1)', 'local maximum (1 - √2, 2 - 2√2)'], // was (-0.4142, -0.8284)
    ['-2x^2 + 4x + 1', 'x-intercepts at x = 1 - √6/2, 1 + √6/2'], // was 1 - 1/2*√2*√3
    ['x^5 - x', 'local maximum (-1/∜5, 4/(5∜5))'],
    ['x^4 + x', 'local minimum (-1/∛4, -3/(4∛4))'],
    ['sin(x)/x', 'x-intercepts at x = nπ (n any nonzero integer)'], // Round 27: the pattern, not six window values
    ['(x^3+1)/(x^2-1)', 'hole at (-1, -3/2)'],
  ]) {
    assert.ok((await plainFn(p)).answer.includes(part), `${p}: ${(await plainFn(p)).answer}`);
  }
  assert.match((await plainFn('sin(x)/x')).answer, /local maximum ≈ \(-7\.7253, 0\.1284\)/);
  assert.match((await plainFn('x^5-x-1')).answer, /x-intercept at x ≈ 1\.1673/);
});

test('functions: wrong answers found in the sweep — touching roots, a slant asymptote that was a hole', async () => {
  // (x² − 3)² said "no x-intercepts" beside minima at (±√3, 0); |x² − 2| too.
  assert.match((await plainFn('(x^2-3)^2')).answer, /x-intercepts at x = -√3, √3/);
  assert.match((await plainFn('abs(x^2-2)')).answer, /x-intercepts at x = -√2, √2/);
  // (x² − 1)/(x − 1) is the line x + 1 with a hole: no asymptote.
  const hole = await plainFn('(x^2-1)/(x-1)');
  assert.doesNotMatch(hole.answer, /slant/);
  assert.match(hole.answer, /hole at \(1, 2\)/);
});

test('functions: sine and cosine waves give every intercept and extremum as a pattern', async () => {
  for (const [p, part] of [
    ['3cos(x)+1', 'x-intercepts at x = ±arccos(-1/3) + 2πn (≈ ±1.9106 + 2πn); maxima at x = 2πn (value 4), minima at x = π + 2πn (value -2), period 2π (n any integer)'],
    ['sin(2x)', 'maxima at x = π/4 + nπ (value 1), minima at x = -π/4 + nπ (value -1), period π'],
    ['2sin(x)+1', 'x-intercepts at x = -π/6 + 2πn or 7π/6 + 2πn'],
    ['-2sin(3x)+1', 'x-intercepts at x = π/18 + 2nπ/3 or 5π/18 + 2nπ/3'],
    ['sin(x)+2', 'no x-intercepts'],
    ['cos(x)-1', 'x-intercepts at x = 2πn'],
  ]) {
    assert.ok((await plainFn(p)).answer.includes(part), `${p}: ${(await plainFn(p)).answer}`);
  }
});

test('functions: domains, ranges and slant asymptotes proved', async () => {
  assert.match((await plainFn('x/(x^2+1)')).answer, /domain: all real numbers/); // was "no restrictions found"
  assert.match((await plainFn('(x^2+1)/(x-1)')).answer, /slant asymptote y = x \+ 1/);
  assert.ok((await plainFn('(x^2+1)/(x-1)')).steps.includes('Slant asymptote: y = x + 1. The top\'s degree is one more than the bottom\'s, so divide: f(x) = x + 1 + 2/(x - 1), and the fraction → 0 as x → ±∞.'));
  assert.match((await plainFn('x^3 - 3x')).answer, /range: all real numbers/);
  assert.match((await plainFn('x^4 - 2x^2')).answer, /range: y ≥ -1/);
  assert.match((await plainFn('-x^4+2x^2+3')).answer, /range: y ≤ 4/);
});

test('functions: each family\'s insight is applied to the function second', async () => {
  for (const [p, here] of [
    ['x^2 - 4x + 3', 'Here: a = 1 and b = -4, so x = −b/(2a) = 2, and f(2) = -1: the vertex is (2, -1), a minimum.'],
    ['abs(x-1)', 'Here: the corner is where x - 1 = 0, at x = 1: a minimum (1, 0).'],
    ['3cos(x)+1', 'Here: A = 3, k = 1 and d = 1, so the amplitude is 3, the period 2π and the midline y = 1.'],
    ['tan(x)', 'Here: the asymptotes nearest 0 are at x = -π/2, π/2, and the pattern repeats.'],
    ['ln(x-2)', 'Here: the inside x - 2 must be > 0, so the domain is x > 2 and the vertical asymptote is x = 2.'],
    ['(x^2+1)/(x-1)', 'Here: dividing, (x^2 + 1)/(x - 1) = x + 1 + 2/(x - 1), so the slant asymptote is y = x + 1.'],
    ['(x^2-1)/(x-1)', 'Here: (x^2 - 1)/(x - 1) = x + 1 for x ≠ 1, so there is a hole at (1, 2).'],
    ['1/(x-2)', 'Here: the denominator is 0 at x = 2 and nothing cancels, so that is a vertical asymptote; the degrees give y = 0.'],
    ['e^x - 2', 'Here: the horizontal asymptote is y = -2, the range is y > -2, and it crosses the x-axis at x = ln(2).'],
    ['sqrt(x-2)', 'Here: the radicand is ≥ 0 on the domain, and the graph starts at (2, 0), its minimum there.'],
    ['x^3 - 3x', 'Here: f′(x) = 3x^2 - 3 is 0 at x = -1, 1, and it changes sign at each: a maximum (-1, 2), a minimum (1, -2).'],
  ]) {
    assert.equal((await plainFn(p)).tips[1], here, p);
  }
  // sin(x)/x is not a rational function: no "factor the numerator".
  assert.doesNotMatch((await plainFn('sin(x)/x')).tips[0], /Factor the numerator/);
  // More than three insights in every family.
  for (const p of ['x^2 - 4x + 3', 'abs(x-1)', '3cos(x)+1', 'tan(x)', 'ln(x-2)', '1/(x-2)', 'x*e^(-x)', 'e^x - 2', 'sqrt(x-2)', 'x^3 - 3x']) {
    assert.ok((await plainFn(p)).tips.length > 3, p);
  }
});

// Round 27 (outside review of FUNCTIONS.md): four general statements made
// exact, infinite families given as patterns, and the ranges proved.
test('functions review: the general statements say where they hold', async () => {
  const poly = (await plainFn('x^3 - 3x')).tips.join('\n');
  assert.match(poly, /A root of even multiplicity touches the axis without crossing .*a root of odd multiplicity crosses, even when repeated/);
  assert.doesNotMatch(poly, /A repeated root touches the axis without crossing/);
  const abs = (await plainFn('abs(x-1)')).tips.join('\n');
  assert.match(abs, /\|x\^2\| = x\^2 is smooth at 0/);
  assert.match(abs, /The rest of the range depends on how large \|g\| gets: \|sin\(x\)\| stays between 0 and 1/);
  const rational = await plainFn('x/x^2');
  assert.match(rational.tips[0], /a zero of the simplified denominator is a vertical asymptote \(x\/x\^2 = 1\/x still has one at 0\)/);
  assert.equal(rational.tips[1], 'Here: x/x^2 = 1/x for x ≠ 0, and the simplified denominator is still 0 there, so that is a vertical asymptote, not a hole.');
  assert.match((await plainFn('sin(2x)')).tips[0], /period 2π\/\|k\|/);
  assert.match((await plainFn('tan(x)')).tips[0], /period π\/\|k\|/);
});

test('functions review: infinitely many features are patterns or labelled as the window', async () => {
  const sinc = await plainFn('sin(x)/x');
  assert.match(sinc.answer, /x-intercepts at x = nπ \(n any nonzero integer\)/);
  assert.match(sinc.answer, /no y-intercept/);
  assert.match(sinc.answer, /in -10 ≤ x ≤ 10: local maximum ≈ \(-7\.7253, 0\.1284\)/);
  assert.ok(sinc.steps.includes('y-intercept: none — x = 0 is not in the domain; the graph approaches (0, 1) without containing it.'));
  // |sin x| listed only x = 0; sin(−2x) fell back to a window list.
  assert.match((await plainFn('abs(sin(x))')).answer, /range: 0 ≤ y ≤ 1; y-intercept \(0, 0\); x-intercepts at x = nπ; maxima at x = π\/2 \+ nπ \(value 1\), minima at x = nπ \(value 0\), period π/);
  assert.match((await plainFn('sin(-2x)')).answer, /maxima at x = -π\/4 \+ nπ \(value 1\), minima at x = π\/4 \+ nπ \(value -1\), period π/);
  assert.match((await plainFn('sin(-2x)')).tips[1], /k = -2 .*the period 2π\/\|-2\| = π/);
  assert.match((await plainFn('sin(2x)/(x^2-1)')).answer, /x-intercepts at x = nπ\/2;/);
});

test('functions review: the ranges and asymptotes that follow from the analysis', async () => {
  for (const [p, part] of [
    ['abs(x^2-2)', 'range: y ≥ 0'], ['sqrt(4-x^2)', 'range: 0 ≤ y ≤ 2'], ['x*ln(x)', 'range: y ≥ -1/e'],
    ['x/(x^2+1)', 'range: -1/2 ≤ y ≤ 1/2'], ['x*e^(-x)', 'range: y ≤ 1/e'], ['(x^2-1)/(x^2+1)', 'range: -1 ≤ y < 1'],
    ['x^2*e^x', 'range: y ≥ 0'], ['sqrt(x^2+1)', 'range: y ≥ 1'],
    ['e^x - 2', 'horizontal asymptote y = -2 as x → −∞'], ['x*e^(-x)', 'horizontal asymptote y = 0 as x → ∞'],
  ]) {
    assert.ok((await plainFn(p)).answer.includes(part), `${p}: ${(await plainFn(p)).answer}`);
  }
  assert.match((await plainFn('sqrt(x^2+1)')).answer, /domain: all real numbers/);
  // x·ln x has its own list: no vertical asymptote at 0.
  const xlnx = await plainFn('x*ln(x)');
  assert.match(xlnx.tips[0], /so there is no vertical asymptote at 0, unlike ln\(x\) alone/);
  assert.equal(xlnx.tips[1], 'Here: f′(x) = 1 + ln(x) is 0 at x = 1/e, the minimum (1/e, -1/e), so the range is y ≥ -1/e.');
  assert.equal((await plainFn('sqrt(4-x^2)')).tips[1], 'Here: the graph runs from (-2, 0) up to its highest point (0, 2) and down to (2, 0), so the range is 0 ≤ y ≤ 2.');
});

// Round 28 (second outside review of FUNCTIONS.md).
test('functions second review: the shared rational mistake, the triple root, k ≠ 0', async () => {
  for (const p of ['1/(x-2)', '(x^2-1)/(x-1)', 'x/x^2', '(x^2+1)/(x-1)']) {
    const mistakes = (await plainFn(p)).mistakes.join('\n');
    assert.doesNotMatch(mistakes, /that is a hole/, p);
    assert.match(mistakes, /Taking a zero shared by the numerator and the denominator as an x-intercept: the original function is undefined there\. Simplify, then check whether that point is a hole or a vertical asymptote\./, p);
  }
  assert.equal((await plainFn('(x-1)^3')).tips[1], 'Here: f′(x) = 3(x - 1)^2 is 0 at x = 1 but does not change sign there, so there is no maximum or minimum, and the graph crosses the x-axis at x = 1.');
  assert.match((await plainFn('sin(2x)')).tips[0], /\(with k ≠ 0\) have amplitude \|A\|, period 2π\/\|k\|/);
  assert.match((await plainFn('tan(x)')).tips[0], /period π\/\|k\| \(for k ≠ 0\)/);
});

// 1.65.0: trigonometry. Exact only when exact, identities proved, equations
// with exact names for non-special angles, and each method's worked line.
const plainTrig = async (p) => {
  const { stripMathMarkers } = await import('../src/lib/mathMarkers.js');
  const r = await solveProblem(p, 'trigonometry');
  return { ...r, steps: r.steps.map(stripMathMarkers), tips: r.tips.map(stripMathMarkers), mistakes: r.common_mistakes.map(stripMathMarkers) };
};

test('trigonometry: an exact value only when the angle is exact; ≈ otherwise', async () => {
  // sin(1.0472) was "√3/2" (matched to 1e-4); 1.0472 only approximates π/3.
  assert.equal((await plainTrig('sin(1.0472)')).answer, '≈ 0.866');
  assert.equal((await plainTrig('cos(0.7854)')).answer, '≈ 0.7071');
  assert.equal((await plainTrig('sin(pi/3)')).answer, '√3/2 (≈ 0.866)');
  assert.equal((await plainTrig('sin(1)')).answer, '≈ 0.8415');
  assert.equal((await plainTrig('tan(pi/4)')).answer, '1');
  assert.equal((await plainTrig('arcsin(0.3)')).answer, '≈ 0.3047');
});

test('trigonometry: identities are proved, and say where they hold', async () => {
  for (const [p, answer] of [
    ['sin(x)^2 + cos(x)^2', '1'], ['2sin(x)cos(x)', 'sin(2x)'], ['cos(x)^4 - sin(x)^4', 'cos(2x)'],
    ['sec(x)^2 - 1', 'tan(x)^2'], ['sin(x)*cos(x)', 'sin(2x)/2'], ['tan(x)+cot(x)', '2/sin(2x)'],
    ['tan(x)*cos(x)', 'sin(x) (for cos(x) ≠ 0)'], ['cot(x)*sin(x)', 'cos(x) (for sin(x) ≠ 0)'], ['sin(x)/cos(x)', 'tan(x)'],
  ]) {
    const r = await plainTrig(p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => /substituting t = tan\(x\/2\) turns them into the same rational function of t/.test(s)), `${p} not proved`);
  }
});

test('trigonometry: equations — exact names, simplified families, cases in order', async () => {
  for (const [p, answer] of [
    ['sin(x) = 0.3', 'x = arcsin(3/10) + 2πn  or  x = π − arcsin(3/10) + 2πn (n ∈ ℤ);  on [0, 2π): x ≈ 0.3047, 2.8369'],
    ['cos(x) = -0.4', 'x = ±arccos(-2/5) + 2πn (n ∈ ℤ);  on [0, 2π): x ≈ 1.9823, 4.3009'],
    ['tan(2x) = 1', 'x = π/8 + (π/2)n (n ∈ ℤ);  on [0, 2π): π/8, 5π/8, 9π/8, 13π/8'],
    ['cos(x/2) = 1', 'x = 4πn (n ∈ ℤ);  on [0, 2π): 0'],
    ['sin(x)^2 = 1/4', 'x = π/6 + 2πn  or  x = 5π/6 + 2πn  or  x = 7π/6 + 2πn  or  x = 11π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/6, 5π/6, 7π/6, 11π/6'],
  ]) {
    assert.equal((await plainTrig(p)).answer, answer, p);
  }
  // cos(x) = 1 said "x = 0 and x = −0 both work … 2π − 0 = 2π".
  const once = await plainTrig('cos(x) = 1');
  assert.ok(once.steps.includes('Cosine reaches 1 only once per period, at the top of the wave: x = 0.'));
  assert.ok(!once.steps.some((s) => /−0/.test(s)));
});

test('trigonometry: each method\'s insight is applied to the problem second', async () => {
  for (const [p, here] of [
    ['sin(5pi/6)', 'Here: 5π/6 = 150° is in quadrant II with reference angle 30°; sin is positive there, so sin(150°) = sin(30°) = 1/2.'],
    ['cos(210°)', 'Here: 210° is in quadrant III with reference angle 30°; cos is negative there, so cos(210°) = −cos(30°) = -√3/2.'],
    ['arcsin(1/2)', 'Here: arcsin(1/2) asks for the angle in [−π/2, π/2] whose sine is 1/2: π/6.'],
    ['sin(1)', 'Here: sin(1) is not a special angle (1 radian is about 57.3°), so its value is a decimal: ≈ 0.8415.'],
    ['tan(x)*cos(x)', 'Here: written in sin and cos, tan(x)*cos(x) = sin(x), for cos(x) ≠ 0.'],
    ['sin(x) = 1/2', 'Here: arcsin(1/2) = π/6, and the second solution in the period is π − π/6 = 5π/6: x = π/6 + 2πn  or  x = 5π/6 + 2πn.'],
    ['sin(x) = 0.3', 'Here: arcsin(3/10) ≈ 0.3047, and the second solution in the period is π − 0.3047 ≈ 2.8369: x = arcsin(3/10) + 2πn  or  x = π − arcsin(3/10) + 2πn.'],
    ['tan(2x) = 1', 'Here: arctan(1) = π/4, and tan repeats every π: x = π/8 + (π/2)n.'],
    ['sec(x) = 2', 'Here: the equation is cos(x) = 1/2, solved as usual: x = π/3 + 2πn  or  x = 5π/3 + 2πn.'],
    ['2sin(x)^2 - sin(x) - 1 = 0', 'Here: with u = sin(x), 2u² − u − 1 = 0 gives u = -1/2  or  u = 1; each value is solved for the angle.'],
    ['sin(x) + cos(x) = 1', 'Here: R = √2 and φ = π/4, so sin(x + π/4) = 1/√2 = √2/2.'],
    ['sin(x)cos(x) = 1/4', 'Here: the product is ½·sin(2x), so sin(2x) = 1/2.'],
  ]) {
    assert.equal((await plainTrig(p)).tips[1], here, p);
  }
  // The value-specific advice still leads (tests/tipsAudit.test.js).
  assert.match((await plainTrig('sin(2x) = 1')).tips[0], /^sin reaches 1 only once in each period/);
});

// Round 29 (outside review of TRIGONOMETRY.md).
test('trigonometry review: cot = 0, the phase quadrant, the Auto reading', async () => {
  // cot(x) = 0 was "No real solution" (from 1/0); it is cos(x) = 0.
  assert.equal((await plainTrig('cot(x) = 0')).answer, 'x = π/2 + πn (n ∈ ℤ);  on [0, 2π): π/2, 3π/2');
  assert.equal((await plainTrig('cot(2x) = 0')).answer, 'x = π/4 + (π/2)n (n ∈ ℤ);  on [0, 2π): π/4, 3π/4, 5π/4, 7π/4');
  assert.equal((await plainTrig('sec(x) = 0')).answer, 'No real solution');
  // φ in its quadrant: the step said "φ = arctan(b/a) = 3π/4" for a = −1.
  for (const [p, sols] of [
    ['sin(x) + cos(x) = 1', '0, π/2'], ['-sin(x) + cos(x) = 1', '0, 3π/2'],
    ['sin(x) - cos(x) = 1', 'π/2, π'], ['-sin(x) - cos(x) = 1', 'π, 3π/2'],
  ]) {
    const r = await plainTrig(p);
    assert.match(r.answer, new RegExp(`on \\[0, 2π\\): ${sols.replace(/[/()]/g, '\\$&')}$`), p);
    // arctan(b/a) is named only when a > 0 (sin x − cos x: −π/4 is right).
    if (/^-sin/.test(p)) assert.ok(!r.steps.some((s) => /φ = arctan\(b\/a\)/.test(s)), p);
  }
  assert.match((await plainTrig('-sin(x) + cos(x) = 1')).steps.join('\n'), /φ = 3π\/4 \(in quadrant II, since a < 0\)/);
  // A bare common angle under Auto: read as degrees, and the first insight says so.
  const auto = await plainTrig('sin(30)');
  assert.equal(auto.answer, '1/2 (≈ 0.5)');
  assert.match(auto.tips[0], /^The angle unit is on Auto, so a bare common angle such as 30 is read as degrees/);
  assert.ok(auto.steps.some((s) => /if you meant radians, the result would be -0\.988/.test(s)));
});

test('trigonometry review: the general statements say where they hold', async () => {
  assert.match((await plainTrig('sin(1)')).tips.join('\n'), /others have exact forms too \(sin\(15°\) = \(√6 − √2\)\/4, sin\(22\.5°\) = √\(2 − √2\)\/2\)/);
  assert.doesNotMatch((await plainTrig('sin(1)')).tips.join('\n'), /Only some angles have exact values/);
  const sec = (await plainTrig('sec(x) = 2')).tips.join('\n');
  assert.match(sec, /A reciprocal turns into a basic equation when c ≠ 0/);
  assert.match(sec, /cot\(θ\) = cos\(θ\)\/sin\(θ\) = 0 exactly where cos\(θ\) = 0/);
  // Reworded again in Round 31 (the general solution, then n for the interval).
  assert.match((await plainTrig('tan(2x) = 1')).tips.join('\n'), /For a nonzero integer k, tan\(kx\) = c has 2\|k\| solutions in \[0, 2π\)/);
  assert.match((await plainTrig('sin(x) = -1/2')).steps.join('\n'), /the principal value is arcsin\(-1\/2\) = -π\/6/);
  assert.ok(!(await plainTrig('sin(x) = -1/2')).steps.some((s) => /reference angle is arcsin/.test(s)));
  // The identity proof covers x = π + 2πn, where t = tan(x/2) is undefined.
  assert.match((await plainTrig('sin(x)^2 + cos(x)^2')).steps.join('\n'), /at x = π \+ 2πn, where t is undefined, the two sides are compared directly/);
});

// Round 30 (second outside review of TRIGONOMETRY.md).
test('trigonometry second review: a negative principal value, the angle unit in every mode', async () => {
  const neg = await plainTrig('sin(x) = -1/2');
  assert.ok(neg.steps.includes('The principal value -π/6 lies outside [0, 2π). Sine takes each value twice per period, so the two solutions on [0, 2π) are x = π − (-π/6) = 7π/6 and x = 2π + (-π/6) = 11π/6.'));
  assert.ok(!neg.steps.some((s) => /within one period: x = -π\/6/.test(s)));
  // sin(30) in every angle mode, and the explicit forms.
  // Set as the worker does (this file has no localStorage for saveSettings).
  const { primeSettings, autoDegreeAngle } = await import('../src/lib/settings.js');
  const at = async (p, unit) => { primeSettings(unit ? { angleUnit: unit } : null); try { return (await solveProblem(p, 'trigonometry')).answer; } finally { primeSettings(null); } };
  assert.equal(await at('sin(30)'), '1/2 (≈ 0.5)'); // Auto, the default
  assert.equal(await at('sin(30)', 'radians'), '≈ -0.988');
  assert.equal(await at('sin(30)', 'degrees'), '1/2 (≈ 0.5)');
  assert.equal(await at('sin(30°)', 'radians'), '1/2 (≈ 0.5)');
  assert.equal(await at('sin(pi/6)', 'degrees'), '1/2 (≈ 0.5)');
  // The note under the input names the bare common angle Auto will read as degrees.
  assert.equal(autoDegreeAngle('sin(30)'), 30);
  assert.equal(autoDegreeAngle('2*cos(60) + 1'), 60);
  for (const t of ['sin(30°)', 'sin(pi/6)', 'sin(1)', 'sin(0)', 'x^2']) assert.equal(autoDegreeAngle(t), null, t);
});

// Round 31 (third outside review of TRIGONOMETRY.md).
test('trigonometry third review: tan with a negative value, the period of cot, a bounded scan', async () => {
  const neg = await plainTrig('tan(x) = -1');
  assert.equal(neg.answer, 'x = 3π/4 + πn (n ∈ ℤ);  on [0, 2π): 3π/4, 7π/4');
  assert.match(neg.tips.join('\n'), /The general solution is x = arctan\(c\) \+ πn, n any integer: choose the values of n that put x in the interval asked for \(tan\(x\) = −1 gives 3π\/4 and 7π\/4/);
  assert.ok(neg.mistakes.includes('Reporting the calculator\'s value arctan(-1) = -π/4 as a solution in [0, 2π): it lies outside; the general solution -π/4 + πn gives 3π/4 and 7π/4 there.'));
  assert.ok(!neg.mistakes.some((m) => /which is also in/.test(m)));
  // cot(x) = 0: cot's own period, and no sec advice.
  const cot = await plainTrig('cot(x) = 0');
  assert.match(cot.mistakes[0], /^Forgetting that cotangent repeats every π: the complete solution is x = π\/2 \+ πn/);
  assert.ok(!cot.mistakes.some((m) => /\+ 2πn|sec\(θ\) = 2/.test(m)), cot.mistakes.join('\n'));
  // sin = 0 and cos = 0 step by π, so the "+ …n" mistake says πn.
  for (const p of ['cos(x) = 0', 'sin(x) = 0']) assert.ok((await plainTrig(p)).mistakes.some((m) => /without the "\+ πn"/.test(m)), p);
  // |sin x| ≤ 1 bounds every root of sin(x) = x/2.
  const bounded = await plainTrig('sin(x) = x/2');
  // Round 32 and after: the bound, then the count by convexity, complete.
  assert.ok(bounded.steps.includes('Every solution is in -2 ≤ x ≤ 2: |sin(x)| ≤ 1, so x/2 must lie between -1 and 1. f(x) = sin(x) − x/2 has f″(x) = -1·sin(x), which keeps one sign between consecutive zeros of sin(x). On each of those 2 pieces f is concave or convex, so it rises then falls (or the reverse) and has at most two roots; the signs of f at the ends and at its turning point give exactly 3 in all, each located by bisection on its piece.'));
  assert.equal(bounded.tips[1], 'Here: sine is never beyond ±1, so every solution lies in -2 ≤ x ≤ 2: none can be outside it. And between consecutive zeros of sin the difference of the two sides is concave or convex, so each piece holds at most two roots; counting them piece by piece gives exactly 3, each located on its piece: the list is complete.');
  assert.match((await plainTrig('sin(x)cos(x) = 1/4')).mistakes.join('\n'), /here cos\(x\) = 0 makes the left side 0, so none are lost when c ≠ 0/);
});

// The convexity count (the task the fourth review asked for): every root of
// A·sin/cos(kx + c) + d = mx + b counted exactly and located; the scan, which
// steps by 0.5, had missed roots.
test('trigonometry: the roots of a wave equal to a line are counted and all found', async () => {
  const { countWaveLineRoots } = await import('../src/lib/solvers/trigonometry/rootCount.js');
  for (const [p, roots] of [
    ['sin(x) = x/2', ['-1.8955', '0', '1.8955']],
    ['sin(x) = 0.99x', ['-0.2453', '0', '0.2453']], // was x = 0 only
    ['sin(x) = x/10', ['-8.4232', '-7.0682', '-2.8523', '0', '2.8523', '7.0682', '8.4232']], // ±8.4232 were missed
    ['3sin(2x) = x - 1', ['-1.1672', '-0.207', '1.4889', '3.7024', '3.9819']], // 3.9819 was missed
    ['2cos(x) + 1 = x', ['1.3798']], ['cos(x) = x', ['0.7391']], ['cos(x) = x + 5', ['-4.8564']],
  ]) {
    const r = await plainTrig(p);
    const got = (r.answer.match(/-?\d+(?:\.\d+)?/g) || []);
    assert.deepEqual(got, roots, p);
    assert.match(r.steps.join('\n'), /give exactly \d+ in all, each located by bisection/, p);
    assert.equal(r.graph.solutions.length, roots.length, `${p}: graph marks`);
  }
  // The count itself: a tangency that cannot be told from two close roots is undecided.
  assert.equal(countWaveLineRoots({ A: 1, fn: 'sin', k: 1, c: 0, d: 0, m: 0.5, b: 0, lo: -2, hi: 2 }).count, 3);
  assert.equal(countWaveLineRoots({ A: 1, fn: 'sin', k: 1, c: 0, d: 0, m: 1, b: 0, lo: -1, hi: 1 }).decided, true); // sin x = x: 0 only
  assert.equal(countWaveLineRoots({ A: 1, fn: 'sin', k: 1, c: 0, d: 0, m: 1, b: 0, lo: -1, hi: 1 }).count, 1);
});

// Round 33 (the review of the root count): the precision said truthfully,
// and the hard cases — a tangent, two close roots, roots on the ends.
test('trigonometry: the root count at a tangent, at close roots and at the ends', async () => {
  const { countWaveLineRoots } = await import('../src/lib/solvers/trigonometry/rootCount.js');
  const ends = (m, b) => [(-1 - b) / m, (1 - b) / m].sort((p, q) => p - q);
  const count = (m, b) => { const [lo, hi] = ends(m, b); return countWaveLineRoots({ A: 1, fn: 'sin', k: 1, c: 0, d: 0, m, b, lo, hi }); };
  const m = Math.cos(2);
  const b = Math.sin(2) - 2 * Math.cos(2); // the tangent to sin at x = 2
  assert.equal(count(m, b).decided, false); // a touch: never claimed either way
  assert.equal(count(m, b - 1e-6).count, 3); // two roots 0.003 apart, both counted
  assert.equal(count(m, b + 1e-3).count, 1); // the line just misses the touch
  // sin(x) = 2x/π: roots at ±π/2, the ends of the interval, counted once.
  const edge = count(2 / Math.PI, 0);
  assert.equal(edge.count, 3);
  assert.ok(Math.abs(edge.roots[0].x + Math.PI / 2) < 1e-9 && Math.abs(edge.roots[2].x - Math.PI / 2) < 1e-9);
  assert.match((await plainTrig('sin(x) = 2x/pi')).answer, /^x ≈ -1\.5708  or  x = 0  or  x ≈ 1\.5708$/);
  // Two close roots the scan steps over are found by the count.
  const close = await plainTrig(`sin(x) = ${m.toFixed(12)}*x + ${(b - 1e-3).toFixed(12)}`);
  assert.match(close.answer, /x ≈ 1\.9533  or  x ≈ 2\.0471  or  x ≈ 5\.6345/);
  // At the tangent the count is undecided, so the scan's list is not claimed complete.
  const touch = await plainTrig(`sin(x) = ${m.toFixed(15)}*x + ${b.toFixed(15)}`);
  assert.ok(touch.steps.some((s) => /without proving the list complete/.test(s)), touch.steps.join('\n'));
  // The check says which values balance to 10^(−12): the unrounded ones.
  assert.ok((await plainTrig('sin(x) = x/2')).steps.some((s) => s === 'Check: each root was located to high precision, and substituting its unrounded value back makes the two sides agree to within 10^(−12). The values shown are rounded to 4 decimal places, so they balance only to about that many.'));
});

// --- Inequalities and systems (1.66.0) ------------------------------------------

const plainIneq = async (p) => (await import('./helpers/solvePlain.js')).solvePlain(p, 'algebra');


test('inequalities and systems: each method leads with its own insight, and the second works the problem', async () => {
  const cases = [
    ['linear', '-2x > 4', /dividing by -2, a negative number, reverses > to <: x < -2/],
    ['polynomial', 'x^2 - 4 > 0', /x\^2 - 4 is 0 at x = -2 and 2/],
    ['polynomial', '(x-1)^2*(x+2) >= 0', /does not change at x = 1, a zero of even multiplicity/],
    ['rational', '(x-1)/(x+2) <= 0', /numerator is 0 at x = 1 and the denominator at x = -2/],
    ['holes', '(x^2-1)/(x-1) > 0', /undefined at x = 1, even though that factor cancels/],
    ['absolute value', 'abs(2x-1) < 5', /\|2x - 1\| < 5 means −5 < 2x - 1 < 5/],
    ['absolute value, chart', 'abs(x) < x + 1', null],
    ['domain', 'ln(x) < 1', /defined only where x > 0/],
    ['transcendental', 'x - ln(x) > 2', /turns only at x = 1/],
    ['wave', 'sin(x) > x/2', /counting by convexity there gives exactly 3/],
    ['periodic', 'sin(x) > 1/2', /0 at π\/6 and 5π\/6/],
    ['compound', '-1 < 2x+1 <= 5', /part 1 gives x > -1 and part 2 gives x ≤ 2/],
    ['system, one point', '2x + 3y = 6; x - y = 4', /equation 1 gives x = \(6 - 3y\)\/2/],
    ['system, parallel', 'x + y = 1; x + y = 3', /subtracting leaves 0 = 2/],
    ['system, same line', 'x + y = 2; 2x + 2y = 4', /equation 2 is 2 × equation 1/],
    ['system, 3×3', 'x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2', /only z left, so z = 3/],
    ['system, 3×3 none', 'x+y+z=1; x+y+2z=2; x+y+3z=4', /contradict/],
    ['system, 3×3 many', 'x+y+z=1; x+y+2z=2; x+y+3z=3', /one variable is free/],
    ['system, curves', 'y = x + 1; x^2 + y^2 = 25', /y = x \+ 1 put into the other equation/],
  ];
  const seen = new Map();
  for (const [method, problem, here] of cases) {
    const r = await plainIneq(problem);
    const first = r.tips[0];
    assert.ok(!seen.has(first) || seen.get(first) === method, `"${method}" and "${seen.get(first)}" share the first insight "${first}"`);
    seen.set(first, method);
    if (here) assert.match(r.tips[1], here, `${method}: ${r.tips[1]}`);
  }
});

test('inequalities: zeros proved, not scanned; boundary points decided at the point', async () => {
  const answers = [
    // Found by the sweep (1.66.0): each was confidently wrong.
    ['x - ln(x) > 2', '0 < x < α  or  x > β, where α ≈ 0.1586 and β ≈ 3.1462 are zeros of x - ln(x) - 2'], // 0 < x < 0.1586 was lost next to the domain's edge
    ['e^(x/20) > x', 'x < α  or  x > β, where α ≈ 1.0541 and β ≈ 89.9951 are zeros of e^(x/20) - x'], // the zero past the ±50 window was lost
    ['(x^2-1)/(x-1) > 0', '-1 < x < 1  or  x > 1'], // x = 1 was kept: the factor cancelled
    ['x/x > 0', 'x < 0  or  x > 0'], // "No solution"
    ['x/x - 1 >= 0', 'x < 0  or  x > 0'],
    ['sqrt(x) > -1', 'x ≥ 0'], ['sqrt(x) >= 0', 'x ≥ 0'], ['sqrt(x-1) <= 0', 'x = 1'], ['sqrt(4-x^2) >= 0', '-2 ≤ x ≤ 2'],
    ['sqrt(x^2-2) >= 0', 'x ≤ -√2  or  x ≥ √2  (√2 ≈ 1.4142)'],
    ['sqrt(x^2-2) - 0.001 < 0', '-√2000001/1000 < x < -√2  or  √2 < x < √2000001/1000  (√2000001/1000 ≈ 1.4142139, √2 ≈ 1.4142136)'],
    ['sin(x) > 0.99x', 'x < α  or  0 < x < β, where α ≈ -0.2453 and β ≈ 0.2453 are zeros of sin(x) - 0.99x'],
    ['e^x > e*x', 'x < 1  or  x > 1'], ['e^x - x - 1 > 0', 'x < 0  or  x > 0'],
    ['x^5 - 4x > 0', '-√2 < x < 0  or  x > √2  (√2 ≈ 1.4142)'], ['x^6 > 8', 'x < -√2  or  x > √2  (√2 ≈ 1.4142)'],
    ['abs(x) < x + 1', 'x > -1/2'], ['abs(x) >= x', 'All real numbers satisfy the inequality'], ['abs(x) > x', 'x < 0'],
    ['x^2 - 1e-6 < 0', '-1/1000 < x < 1/1000'], // 1e-6 was read as 1·e − 6
    // Wrong before the sweep's second pass, too: log(x) < 2 was x > 0; ln(x) > x − 2 lost 0 < x < 0.1586.
    ['log(x) < 2', '0 < x < 100'], ['ln(x) > x - 2', 'α < x < β, where α ≈ 0.1586 and β ≈ 3.1462 are zeros of ln(x) - x + 2'], ['sqrt(x+3) > x + 1', '-3 ≤ x < 1'],
    // Exponentials of one rate: a polynomial in t = e^x (or 2^x), exact.
    ['e^(2x) - 3e^x + 2 > 0', 'x < 0  or  x > ln(2)  (ln(2) ≈ 0.6931)'], ['4^x - 3*2^x + 2 < 0', '0 < x < 1'],
    ['sinh(x) > 1', 'x > ln(1 + √2)  (ln(1 + √2) ≈ 0.8814)'], ['cosh(x) < 2', 'ln(2 - √3) < x < ln(2 + √3)  (ln(2 - √3) ≈ -1.317, ln(2 + √3) ≈ 1.317)'],
    // A derivative bounded away from 0 (2 + sin(x) ≥ 1; a sum of roots > 0) proves the turning points.
    ['x^2 > sin(x)', 'x < 0  or  x > α, where α ≈ 0.8767 is a zero of x^2 - sin(x)'], ['sqrt(x) + sqrt(x-1) > 1', 'x > 1'],
    // Periodic: every zero on one period, exactly, and the period exact.
    ['sin(10x) > 0', 'πn/5 < x < π/10 + πn/5, for every integer n'],
    ['cos(5x) <= 1/2', 'π/15 + 2πn/5 ≤ x ≤ π/3 + 2πn/5, for every integer n'],
    ['abs(sin(2x)) < 0.5', '-π/12 + πn < x < π/12 + πn  or  5π/12 + πn < x < 7π/12 + πn, for every integer n'],
    ['sin(x) > 0.9999999', 'α + 2πn < x < β + 2πn, for every integer n, where α ≈ 1.5703 and β ≈ 1.5712 are zeros of sin(x) - 0.9999999 in [0, 2π)'],
    ['sin(x) >= 0.99999999999', 'α + 2πn ≤ x ≤ β + 2πn, for every integer n, where α ≈ 1.57079 and β ≈ 1.57080 are zeros of sin(x) - 0.99999999999 in [0, 2π)'], // two places that round alike get more digits
  ];
  for (const [p, answer] of answers) assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  // The working says why the list of zeros is complete.
  assert.ok((await plainIneq('x - ln(x) > 2')).steps.some((s) => /^These are all of its zeros: its derivative is 0 only at x = 1/.test(s)));
  assert.ok((await plainIneq('sin(x) > 1/2')).steps.some((s) => /and nowhere else: written in the tangent of the half-angle it becomes a polynomial/.test(s)));
  // Numerically located zeros are named where they are found, and every
  // solution set in the working uses the names (Round 35).
  const far = await plainIneq('e^(x/20) > x');
  assert.ok(far.steps.some((s) => s.startsWith('Find where the expression is zero: x = α ≈ 1.0541, x = β ≈ 89.9951')), far.steps.join('\n'));
  assert.ok(far.steps.some((s) => s === 'In interval notation: (-∞, α) ∪ (β, ∞).'));
  for (const p of ['x - ln(x) > 2', 'x^2 > sin(x)', 'sin(x) > x/2', 'sin(x) > 0.9999999']) {
    const r = await plainIneq(p);
    const sets = r.steps.filter((s) => /^(?:Collect|In interval notation|Keep the|Test the sign between|  • On)/.test(s)).join('\n');
    assert.ok(sets.length > 0, p);
    assert.doesNotMatch(sets, /\d\.\d{4}/, `${p}: a rounded boundary in the working`);
  }
  // Beyond what can be proved, a refusal, never a scan's guess.
  const r = await solveProblem('x^7 > e^x', 'algebra');
  assert.equal(r.status, 'unsupported');
});

test('systems: linearity read off the parse tree, every real root of the substitution, the 3×3 rank', async () => {
  const answers = [
    // A term that is 0 at every whole-number sample made a quartic look like a line (1.66.0).
    ['x + y + x*(x-1)*(x-2)*(x+1) = 3; x - y = 1', '(x, y) = ≈ (-1.5214, -2.5214)  or  (2, 1)'],
    // Algebrite wrote the real roots with i and (−1)^(3/4) in them.
    ['y = x^5 - 3x; y = x', '(x, y) = (-√2, -√2)  or  (0, 0)  or  (√2, √2)'],
    ['x+y+z=1; x+y+2z=2; x+y+3z=4', 'No solution — the equations are inconsistent'], // was "not a 2×2 system"
    ['x+y+z=1; x+y+2z=2; x+y+3z=3', 'Infinitely many solutions — the equations are dependent (a line or plane of solutions)'],
    ['x + y = 1e-3; x - y = 0', 'x = 1/2000,  y = 1/2000'], // e was a third variable
    ['y = x + 1; x^2 + y^2 = 25', '(x, y) = (-4, -3)  or  (3, 4)'],
    ['2x + 3y = 6; x - y = 4', 'x = 18/5,  y = -2/5'],
  ];
  for (const [p, answer] of answers) assert.equal((await solveProblem(p, 'algebra')).answer, answer, p);
  assert.equal((await solveProblem('x + y + sin(pi*x) = 3; x - y = 1', 'algebra')).status, 'unsupported');
  // A substitution that leaves no polynomial is refused in those words.
  assert.match((await solveProblem('y = sqrt(x); y = x - 2', 'algebra')).answer, /not a polynomial equation/);
  const { linearCoefficientsIn } = await import('../src/lib/solvers/solverUtils.js');
  assert.deepEqual(linearCoefficientsIn('2*x - 3*y + 4', ['x', 'y']), { coeffs: [2, -3], d: 4 });
  assert.equal(linearCoefficientsIn('x + y + x*(x-1)*(x-2)*(x+1) - 3', ['x', 'y']), null);
  assert.equal(linearCoefficientsIn('x*y', ['x', 'y']), null);
});

test('scientific notation is read as a number on every path', async () => {
  assert.equal((await solveProblem('x^2 = 1e-6', 'algebra')).answer, 'x = -1/1000  or  x = 1/1000');
  assert.equal((await solveProblem('1e3 + 1', 'other')).answer, '1001');
  const { parseMathExpression, expandScientific } = await import('../src/lib/mathParser.js');
  assert.equal(parseMathExpression('x^2 - 1e-6'), 'x^2-0.000001');
  assert.equal(expandScientific('2.5e-4 + 1E3 + 6.02e23'), '0.00025 + 1000 + 602000000000000000000000');
});

test('decimals reach the engines as fractions: integrals and derivatives solve exactly', async () => {
  const cases = [
    // Algebrite turns to floating point on a decimal: ∫ 0.5x² dx was "could not solve", ∫ 0.001x dx was 0.0005x^2.0 + C.
    ['integrals', 'integral of 0.5*x^2 dx', '∫(0.5x^2) dx = 1/6*x^3 + C'],
    ['integrals', 'integral of 0.001*x dx', '∫(0.001x) dx = 1/2000*x^2 + C'],
    ['integrals', 'integral of 0.5*sin(x) dx', '∫(0.5sin(x)) dx = -1/2*cos(x) + C'],
    ['integrals', 'integral of e^(0.5x) dx', '∫(e^(0.5x)) dx = 2e^(1/2*x) + C'],
    ['integrals', 'integral of x^1.5 dx', '∫(x^1.5) dx = 2/5*x^(5/2) + C'],
    ['integrals', 'integral from 0 to 1.5 of x dx', '∫_0^1.5 (x) dx = 9/8 (≈ 1.125)'],
    // The exact value's natural log was shown as Algebrite's log after a digit: 2log(2).
    ['integrals', 'integral from 0.5 to 2 of 1/x dx', '∫_0.5^2 (1/x) dx = 2ln(2) (≈ 1.3863)'],
    ['integrals', 'integral from 1/2 to 2 of 1/x dx', '∫_1/2^2 (1/x) dx = 2ln(2) (≈ 1.3863)'],
    // An improper integral's limit at ∞ was read off samples: −2/√t "did not settle", so ∫_1^∞ x^(−3/2) dx "diverged".
    ['integrals', '∫_1^∞ x^(-3/2) dx', '∫_1^∞ (x^(-3/2)) dx = 2'],
    ['integrals', '∫_1^∞ 1/x^1.1 dx', '∫_1^∞ (1/x^1.1) dx = 10'],
    ['integrals', '∫_2^∞ 1/(x*ln(x)^2) dx', '∫_2^∞ (1/(x*ln(x)^2)) dx = 1/(ln(2)) (≈ 1.4427)'],
    ['integrals', '∫_1^∞ 1/sqrt(x) dx', '∫_1^∞ (1/sqrt(x)) dx diverges'],
    ['derivatives', 'x^1.5', "f'(x) = 3/2*√x, x ≥ 0"],
    ['derivatives', '3.5*sin(x)', "f'(x) = 7/2*cos(x)"],
  ];
  for (const [topic, p, answer] of cases) assert.equal((await solveProblem(p, topic)).answer, answer, p);
  // The function is shown as typed.
  const d = await solveProblem('0.5x^2', 'derivatives');
  assert.ok(d.steps.some((s) => /f\(x\) = 0\.5x\^2/.test(s)) && !d.steps.some((s) => /\(1\/2\)\*/.test(s)), d.steps.join('\n'));
  const { exactDecimals } = await import('../src/lib/solvers/solverUtils.js');
  assert.equal(exactDecimals('0.5*x^2 + 1.5 - 0.001x + 3.0 + x^2.25'), '(1/2)*x^2 + (3/2) - (1/1000)x + 3 + x^(9/4)');
});

test('inequalities and systems, Round 34: each shared statement says where it holds', async () => {
  const all = async (p) => { const r = await plainIneq(p); return [...r.steps, ...r.tips, ...r.common_mistakes].join('\n'); };
  // A numerator's zero is a solution of ≤ only where the denominator is not 0.
  assert.match(await all('(x-1)/(x+2) <= 0'), /a zero of the numerator is a solution where the denominator is not 0/);
  // t = tan(x/2) never reaches x = π: the step and the tip say it is checked on its own.
  const atPi = await all('cos(x) <= -1');
  assert.match(atPi, /except at the half-turn, where that tangent is undefined; that one angle is checked on its own/);
  assert.match(atPi, /The one angle t never reaches, θ = π, is checked on its own/);
  // The second inverse value only for −1 < c < 1, and for the function the inequality has.
  assert.match(await all('sin(x) >= 1'), /for −1 < c < 1, sin\(x\) = c has a second zero.*at c = ±1 the two are the same point/);
  assert.match(await all('cos(x) > 1/2'), /Using arccos alone/);
  assert.doesNotMatch(await all('cos(x) > 1/2'), /arcsin/);
  // A square root's domain gets the root's rule, not ln's.
  const root = await plainIneq('sqrt(x-1) <= 0');
  assert.match(root.tips[2], /A square root is never negative/);
  assert.doesNotMatch(root.tips.join('\n'), /ln\(x\) < 1 is x < e/);
  // The root count names the degree the substitution left.
  assert.match((await plainIneq('x + y + x*(x-1)*(x-2)*(x+1) = 3; x - y = 1')).tips[2], /degree 4, so the curves meet at most 4 times/);
  assert.match((await plainIneq('y = x + 1; x^2 + y^2 = 25')).tips[2], /A line can meet a parabola or a circle at 0, 1 or 2 points/);
  // A pivot with no equation to swap in: that variable is free.
  assert.match(await all('x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2'), /If none has it, that variable is free/);
});
