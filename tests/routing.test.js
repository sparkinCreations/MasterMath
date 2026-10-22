import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { solvePlain, plain } from './helpers/solvePlain.js';

// 1.52.3: a routed solve carries { from, to, reason } for the page's
// "Solved as …" notice; trig under Arithmetic goes to Trigonometry; a limit
// with no approach point no longer claims the input could not be read.

test('a routed result says where it went and why, and keeps the step for exports', async () => {
  const r = await solveProblem('derivative of x^3', 'algebra');
  assert.deepEqual(r.routing, { from: 'algebra', to: 'derivatives', reason: 'the input uses derivative notation' });
  assert.equal(r.routedTopic, 'derivatives');
  assert.match(r.steps[0], /^Solved as Derivatives \(you chose Algebra\)/);
  // Not routed: no notice.
  assert.equal((await solveProblem('x^3', 'derivatives')).routing, undefined);
});

test('a trig function or a degree sign under Arithmetic is solved as Trigonometry, with the angle setting', async () => {
  for (const [p, answer] of [['sin(30)', '1/2 (≈ 0.5)'], ['sin(30°)', '1/2 (≈ 0.5)'], ['sin(pi/6)', '1/2 (≈ 0.5)'], ['2*sin(pi/4)', '√2 (≈ 1.4142)'], ['sin(x)^2 + cos(x)^2', '1']]) {
    const r = await solveProblem(p, 'other');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.equal(r.routing?.to, 'trigonometry', p);
  }
  // Plain numbers stay arithmetic, and pure numbers under Trigonometry still go to Arithmetic.
  assert.equal((await solveProblem('5 + 3', 'other')).routing, undefined);
  assert.equal((await solveProblem('(5+3)*4', 'trigonometry')).routing?.to, 'other');
});

test('an angle on its own is converted to radians, exactly where it can be', async () => {
  const cases = [
    ['90°', '90° = π/2 rad (≈ 1.5708)'], ['22.5°', '22.5° = π/8 rad (≈ 0.3927)'], ['50°', '50° = 5π/18 rad (≈ 0.8727)'],
    ['-30°', '-30° = -π/6 rad (≈ -0.5236)'], ['0°', '0° = 0 rad'], ['45° + 45°', '45° + 45° = 90° = π/2 rad (≈ 1.5708)'],
    ['0.1234567°', '0.1234567° ≈ 0.0022 rad'],
  ];
  for (const [p, answer] of cases) {
    const r = await solveProblem(p, 'trigonometry');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
  }
  // Under Arithmetic too — this bounced between the two topics until the
  // degree sign was kept by Trigonometry.
  assert.equal((await solveProblem('90°', 'other')).answer, '90° = π/2 rad (≈ 1.5708)');
});

test('a limit with no approach point says what is missing, not that the input was unreadable', async () => {
  const r = await solvePlain('x^2 + 3x', 'limits');
  assert.equal(r.status, 'parse_error');
  assert.doesNotMatch(r.steps.join('\n'), /Could not read/);
  assert.match(r.steps[0], /x\^2 \+ 3x reads fine as an expression, but no approach point was given/);
  assert.match(r.answer, /No approach point was given/);
});

test('with the angle unit on radians, sin(30) explains why it is not sin(30°) instead of listing sin(30°) = 1/2 beside −0.988', async () => {
  const { solveTrigonometry } = await import('../src/lib/solvers/trigonometrySolver.js');
  // (The tips' wording, without the ⟦…⟧ math markers.)
  const r = plain(await solveTrigonometry('sin(30)', { angleUnit: 'radians' }));
  assert.equal(r.answer, '-0.988');
  assert.equal(r.tips[0], 'Here sin(30) is 30 radians (about 1718.9°), not 30° — which is why the answer is not the value of sin(30°). For degrees, write sin(30°) or set the angle unit to Degrees in Settings.');
  // Only for a degree-looking angle read as radians: not sin(1), not degrees.
  assert.doesNotMatch((await solveTrigonometry('sin(1)', { angleUnit: 'radians' })).tips.join('\n'), /Here sin/);
  assert.doesNotMatch((await solveTrigonometry('sin(30)', { angleUnit: 'auto' })).tips.join('\n'), /Here sin/);
  assert.doesNotMatch((await solveTrigonometry('sin(30°)', { angleUnit: 'radians' })).tips.join('\n'), /Here sin/);
});
