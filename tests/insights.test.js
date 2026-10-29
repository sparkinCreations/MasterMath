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
