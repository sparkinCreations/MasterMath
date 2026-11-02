// Negative angles inside a trig equation: cos(-2x) = 0 and its five siblings.
//
// Raised by an outside review of 1.68.1, which reported "no exact reduction"
// for cos(-2x) = 0 and recommended normalizing negative arguments through the
// even/odd identities. Reproducing it found the normalization already working
// in every shape tried — radians and degrees, all six functions, bare negation,
// a phase shift, and a negative leading coefficient. These tests pin that, so
// the class cannot quietly regress; they are the coverage the review asked for,
// not a fix.
//
//   even: cos(-u) = cos(u),  sec(-u) = sec(u)
//   odd:  sin(-u) = -sin(u), tan(-u) = -tan(u), csc(-u) = -csc(u), cot(-u) = -cot(u)

import { test } from 'node:test';
import assert from 'node:assert/strict';

// settings.js reads localStorage; give node one so saveSettings takes effect.
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

const { solveProblem } = await import('../src/lib/api.js');
const { saveSettings, resetSettings } = await import('../src/lib/settings.js');

const answerTo = async (problem) => {
  const r = await solveProblem(problem, 'trigonometry');
  assert.equal(r.status, 'solved', `${problem} should solve: got ${r.status} (${r.answer})`);
  return r.answer;
};

// The same solution set, however the two families happen to be ordered:
// "5π/6 + πn or π/6 + πn" and "π/6 + πn or 5π/6 + πn" are one answer.
const asSet = (answer) => {
  // "(n ∈ ℤ)" trails whichever family is written last, so it is dropped before
  // the families are sorted — otherwise the sort moves it and nothing matches.
  const [families, inOneTurn = ''] = String(answer).replace(/\(n ∈ ℤ\)/g, '').split(';');
  return {
    families: families.split(/\s+or\s+/).map((s) => s.trim()).sort().join(' | '),
    inOneTurn: inOneTurn.trim(),
  };
};

const sameAnswer = async (negative, positive) => {
  assert.deepEqual(asSet(await answerTo(negative)), asSet(await answerTo(positive)),
    `${negative} should solve exactly as ${positive}`);
};

test('even functions: cos(-u) and sec(-u) solve as cos(u) and sec(u)', async () => {
  resetSettings();
  await sameAnswer('cos(-2x) = 0', 'cos(2x) = 0');
  await sameAnswer('cos(-x) = 1/2', 'cos(x) = 1/2');
  await sameAnswer('sec(-2x) = 2', 'sec(2x) = 2');
});

test('odd functions: the sign comes out of the argument, not ignored', async () => {
  resetSettings();
  await sameAnswer('sin(-2x) = 1', 'sin(2x) = -1');
  await sameAnswer('sin(-x) = 1/2', 'sin(x) = -1/2');
  await sameAnswer('tan(-2x) = 1', 'tan(2x) = -1');
  await sameAnswer('csc(-x) = 2', 'csc(x) = -2');
  await sameAnswer('cot(-3x) = 1', 'cot(3x) = -1');

  // The point of the identity: an odd function must NOT give the same answer
  // as the positive argument. sin(-2x) = 1 is sin(2x) = -1, never sin(2x) = 1.
  assert.notEqual(await answerTo('sin(-2x) = 1'), await answerTo('sin(2x) = 1'));
});

test('negative arguments carry their domain restrictions', async () => {
  resetSettings();
  // tan, cot, sec and csc are undefined where their denominator vanishes;
  // x = π/2 is not a solution of tan(-x) + 1 = 0.
  const r = await solveProblem('tan(-x) + 1 = 0', 'trigonometry');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /π\/4 \+ πn/);
  assert.doesNotMatch(r.answer, /π\/2/);
});

test('a phase shift or a negative leading coefficient is handled too', async () => {
  resetSettings();
  await sameAnswer('cos(-2x + pi/3) = 0', 'cos(2x - pi/3) = 0');
  await sameAnswer('sin(-2x) = cos(-2x)', 'sin(2x) = -cos(2x)');
  // Exact where the angle divides exactly, ≈ where it does not — as in radians.
  const inexact = await answerTo('cos(3 - 2x) = 0');
  assert.match(inexact, /≈/);
});

test('in degrees, a negative argument gives the degree family', async () => {
  resetSettings();
  saveSettings({ angleUnit: 'degrees' });
  try {
    assert.match(await answerTo('cos(-2x) = 0'), /45°\s*\+\s*90°n/);
    assert.match(await answerTo('sin(-2x) = 1'), /135°\s*\+\s*180°n/);
    assert.match(await answerTo('tan(-2x) = 1'), /67\.5°\s*\+\s*90°n/);
    assert.match(await answerTo('cot(-3x) = 1'), /45°\s*\+\s*60°n/);
    await sameAnswer('sec(-2x) = 2', 'sec(2x) = 2');
    await sameAnswer('csc(-x) = 2', 'csc(x) = -2');
  } finally {
    resetSettings();
  }
});
