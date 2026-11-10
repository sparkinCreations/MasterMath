// Several absolute values of linear insides (1.76.0): the number line split
// where each inside is 0, the equation solved on each piece, a root kept only
// in its own piece, and a piece true for every x kept whole. |x| + |x − 2| = 4
// fell to the numeric search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('|x| + |x − 2| = 4 and its family, piece by piece', async () => {
  for (const [p, answer] of [
    ['abs(x) + abs(x-2) = 4', 'x = -1  or  x = 3'],
    ['abs(x) + abs(x-2) = 2', '0 ≤ x ≤ 2'],
    ['abs(x) + abs(x-2) = 1', 'No real solution'],
    ['abs(x) - abs(x-2) = 2', 'x ≥ 2'],
    ['abs(x-1) - abs(2x+3) = x', 'x = -1/2'],
    ['abs(x+1) + abs(x-1) = x^2', 'x = -2  or  x = 2'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(!r.steps.some((s) => /found numerically|crosses zero/.test(s)), `${p}: still the numeric search`);
  }
  const r = await solvePlain('abs(x) + abs(x-2) = 4', 'auto');
  assert.ok(r.steps.includes('For x < 0: |x| = −x, |x - 2| = −(x - 2), so the equation is -2x + 2 = 4. It gives x = -1, in this piece ✓'), r.steps.join('\n'));
  assert.ok(r.steps.includes('For 0 ≤ x < 2: |x| = x, |x - 2| = −(x - 2), so the equation is 2 = 4. That is false, so there is no solution here.'), r.steps.join('\n'));
  const out = await solvePlain('abs(x+1) + abs(x-1) = x^2', 'auto');
  assert.ok(out.steps.some((s) => /x = 0, not in this piece, so rejected/.test(s)), out.steps.join('\n'));
});

test('|A| = |B| and |g| = S keep their own methods', async () => {
  assert.equal((await solvePlain('abs(x+2) = abs(2x-1)', 'auto')).answer, 'x = -1/3  or  x = 3');
  assert.equal((await solvePlain('abs(2x-3) = x+1', 'auto')).answer, 'x = 2/3  or  x = 4');
});

// Found in review of 1.76.0: each of these answered wrongly or echoed the
// equation, where the numeric search had been right or had refused.
const answerOf = async (p) => solvePlain(p, 'auto');

test('a value where the equation is undefined is never part of a stretch', async () => {
  for (const p of [
    'abs(x) + abs(x-2) + 1/(x-1) = 2 + 1/(x-1)',
    'abs(x) + abs(x-2) + 1/x = 2 + 1/x',
    'abs(x) + abs(x-2) + x/x = 3',
    'abs(x) + abs(x-2) + x^(-1) = 2 + x^(-1)',
  ]) {
    const r = await answerOf(p);
    assert.doesNotMatch(String(r.answer), /≤ x ≤/, p);
    assert.ok(!r.steps?.some((s) => /Each absolute value changes form/.test(s)), `${p}: split into pieces`);
  }
  // A variable under a division between the absolute values keeps its own path.
  assert.equal((await answerOf('abs(x)/abs(x) = 1')).answer, 'All real numbers with x ≠ 0 (identity on its domain)');
  assert.equal((await answerOf('abs(x)/abs(x-1) = 2')).answer, 'x = 2/3  or  x = 2');
});

test('a root with pi in it is a real root', async () => {
  for (const [p, answer] of [
    ['abs(x) + abs(x-2) = 4*pi', 'x = 1 - 2π  or  x = 1 + 2π'],
    ['abs(x-pi) + abs(x+pi) = 4*pi', 'x = -2π  or  x = 2π'],
    ['abs(x-pi) + abs(x+pi) = 2*pi', '-π ≤ x ≤ π'],
  ]) {
    const r = await answerOf(p);
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => /Each absolute value changes form/.test(s)), `${p}: not split into pieces`);
  }
  // A genuinely complex root is still set aside.
  assert.equal((await answerOf('abs(x) + abs(x-1) = -x^2 - 5')).answer, 'No real solution');
});

test('an equation true on every piece is all real numbers', async () => {
  for (const p of ['abs(x) + abs(-x) = 2*abs(x)', 'abs(x) - abs(-x) = 0', 'abs(x-1) + abs(1-x) = 2*abs(x-1)', 'abs(2*x) = 2*abs(x)']) {
    const r = await answerOf(p);
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, 'All real numbers (identity — true for every x)', p);
  }
});

test('decimals are worked as the fractions they are', async () => {
  for (const [p, answer] of [
    ['abs(x-0.1) + abs(x-0.3) = 0.2', '1/10 ≤ x ≤ 3/10'],
    ['abs(x-1/10) + abs(x-3/10) = 1/5', '1/10 ≤ x ≤ 3/10'],
    ['abs(x-0.1) + abs(x-0.2) = 0.1', '1/10 ≤ x ≤ 1/5'],
    ['abs(x) + abs(x-0.1) = 0.1', '0 ≤ x ≤ 1/10'],
    ['abs(x-0.5) + abs(x-1.5) = 1', '1/2 ≤ x ≤ 3/2'],
    ['abs(x-0.1) + abs(x-0.3) = 1', 'x = -3/10  or  x = 7/10'],
    ['abs(x/0.5) + abs(x-1) = 4', 'x = -1  or  x = 5/3'],
  ]) {
    const r = await answerOf(p);
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
});

test('a polynomial may stand in front of the absolute values', async () => {
  for (const [p, answer] of [
    ['x^2 + abs(x) + abs(x-1) = 4', 'x = -1  or  x = √6 - 1'],
    ['abs(x)^2 + abs(x-1) = 3', 'x = -1  or  x = (√17 - 1)/2'],
    ['x^2 + abs(x) + abs(x-5) = 36', 'x = 1 - 4√2  or  x = √42 - 1'],
  ]) {
    const r = await answerOf(p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => /Each absolute value changes form/.test(s)), r.steps.join('\n'));
  }
});
