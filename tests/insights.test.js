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
