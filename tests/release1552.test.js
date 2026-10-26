import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain } from './helpers/solvePlain.js';
import { exportSolutionAsJSON } from '../src/lib/exportUtils.js';

// 1.55.2: the October 25 deeper review (about 55 problems). Numbers a float
// cannot hold, complex arithmetic, a domain step's marks, export titles.

test('whole-number arithmetic past 2^53 is exact', async () => {
  for (const [p, answer] of [
    ['123456789*987654321', '121932631112635269 (≈ 1.2193 × 10^17)'], // was …260
    ['2^100', '1267650600228229401496703205376 (≈ 1.2677 × 10^30)'], // was 1.2676506002282294e+30
    ['2^53 + 1', '9007199254740993 (≈ 9.0072 × 10^15)'], // was 9007199254740992
    ['2^64', '18446744073709551616 (≈ 1.8447 × 10^19)'],
    ['25!', '15511210043330985984000000 (≈ 1.5511 × 10^25)'],
  ]) {
    const r = await solveProblem(p, 'other');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  const r = await solvePlain('2^53 + 1', 'other');
  assert.ok(r.steps.includes('Add: 9007199254740992 + 1 = 9007199254740993'), r.steps.join(' | '));
  // Past 100 digits the size is given, and that the exact value is longer.
  assert.equal((await solveProblem('100!', 'other')).answer, '≈ 9.3326 × 10^157');
  // Below 2^53 nothing changes.
  assert.equal((await solveProblem('123456*789', 'other')).answer, '97406784');
});

test('a result a float cannot show is approximate, never 0 or e-notation', async () => {
  // 1.55.3 keeps the exact fraction too (exact first): see release1553.
  const tiny = await solvePlain('2^-60', 'other');
  assert.match(tiny.answer, /≈ 8\.6736 × 10\^-19\)?$/); // was 0, Solved
  assert.match((await solveProblem('2^100/3', 'other')).answer, /≈ 4\.2255 × 10\^29\)?$/);
  // The working writes numbers as digits: 1000000, not 1e+6.
  const big = await solvePlain('1000000 + 2', 'other');
  assert.ok(big.steps.includes('Addition and subtraction last, left to right: 1000000 + 2 = 1000002'), big.steps.join(' | '));
  assert.doesNotMatch((await solvePlain('123456*789', 'other')).steps.join(' '), /e\+/);
});

test('complex arithmetic is worked and simplified', async () => {
  for (const [p, answer] of [
    ['(2+3i)*(1-i)', '5 + i'], // was "already in simplest form"
    ['(1+i)^2', '2i'],
    ['(3+4i)/(1-2i)', '-1 + 2i'],
    ['i^3', '-i'],
    ['1/i', '-i'],
    ['(1+i)/(1-i)', 'i'],
    ['i^2', '-1'],
    ['(2+3i)+(1-i)', '3 + 2i'],
    ['abs(3+4i)', '5'],
  ]) {
    const r = await solveProblem(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routedTopic, 'other', p);
  }
  const foil = await solvePlain('(2+3i)*(1-i)', 'other');
  assert.ok(foil.steps.includes('Multiply out (FOIL), then use i^2 = −1: (2 + 3i)(1 - i) = 2 − 2i + 3i − 3i^2 = 2 + 3 + i = 5 + i.'), foil.steps.join(' | '));
  const conj = await solvePlain('(3+4i)/(1-2i)', 'other');
  assert.match(conj.steps.join(' '), /conjugate 1 \+ 2i/);
  assert.match((await solvePlain('i^10', 'other')).steps.join(' '), /10 = 4·2 \+ 2, so i\^10 = i\^2 = -1/);
  // Under Algebra it is solved as arithmetic and says so.
  const r = await solveProblem('(2+3i)*(1-i)', 'algebra');
  assert.equal(r.answer, '5 + i');
  assert.equal(r.routing?.to, 'other');
  // A variable named i is not taken for a complex number when other letters are present.
  assert.equal((await solveProblem('x^2 = -4', 'auto')).answer, 'x = -2i  or  x = 2i');
});

test('the domain step marks each condition, not the words between them', async () => {
  const r = await solveProblem('(x^2-1)/(x^2-4)', 'functions');
  assert.ok(r.steps.includes('Domain restriction: ⟦f⟧ is undefined for ⟦x = -2⟧ and for ⟦x = 2⟧ — so the domain is ⟦x ≠ -2, 2⟧.'), r.steps.join(' | '));
  // A point inside an excluded interval is not named again.
  const ln = await solveProblem('ln(x)', 'functions');
  assert.ok(ln.steps.includes('Domain restriction: ⟦f⟧ is undefined for ⟦x ≤ 0⟧ — so the domain is ⟦x > 0⟧.'), ln.steps.join(' | '));
});

test('every export is titled by the topic the problem was solved as', async () => {
  let saved = null;
  const realURL = globalThis.URL;
  globalThis.document = { createElement: () => ({ click() {}, set href(v) {}, set download(v) {} }), body: { appendChild() {}, removeChild() {} } };
  globalThis.URL = { createObjectURL: () => 'blob:', revokeObjectURL() {} };
  const RealBlob = globalThis.Blob;
  globalThis.Blob = class { constructor(parts) { saved = parts.join(''); } };
  try {
    const solution = await solveProblem('2x + 5 = 11', 'functions');
    assert.equal(solution.routedTopic, 'algebra');
    exportSolutionAsJSON('2x + 5 = 11', 'functions', solution);
    const data = JSON.parse(saved);
    assert.equal(data.topic, 'algebra');
    assert.equal(data.chosenTopic, 'functions');
  } finally {
    delete globalThis.document;
    globalThis.URL = realURL;
    globalThis.Blob = RealBlob;
  }
});
