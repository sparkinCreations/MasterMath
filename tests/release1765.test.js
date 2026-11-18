// 1.76.5: guidance worked on the problem typed — the division tip and
// mistakes (they always used 100/8 = 25/2), the Auto-degrees tip at 0
// (it said cos(0) is "a different number" in radians), and the topic's
// name in JSON exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { buildProgressJSON } from '../src/lib/exportUtils.js';

const all = (r) => [...r.tips, ...r.common_mistakes].join(' ');

test('a division is worked on its own numbers, not 100/8', async () => {
  const r = await solvePlain('12/18', 'other');
  assert.match(r.tips[0], /common factor 6 of 12 and 18 to get 12\/18 = 2\/3; as a decimal it repeats \(0\.6666…\)/);
  assert.doesNotMatch(all(r), /100\/8|12\.5|25\/2/);
  assert.match(r.common_mistakes[0], /12\/18 is 12 ÷ 18/);
  assert.match(r.common_mistakes[1], /0\.67 as if it were exact: 2\/3 is exact/);
  // A terminating decimal, a whole quotient, decimals cleared, a sign, 0.
  assert.match((await solvePlain('100/8', 'other')).tips[0], /common factor 4 .* 25\/2; as a decimal, 12\.5/);
  assert.match((await solvePlain('9/3', 'other')).tips[0], /3 goes into 9 exactly 3 times/);
  assert.match((await solvePlain('2.5/0.5', 'other')).tips[0], /multiply both numbers by 10, so 2\.5\/0\.5 = 25\/5/);
  assert.match((await solvePlain('-12/18', 'other')).tips[0], /−12\/18 = −2\/3/);
  assert.match((await solvePlain('0/5', 'other')).tips[0], /0\/5 = 0/);
  // Multiplication keeps its own tips.
  assert.doesNotMatch(all(await solvePlain('6*7', 'other')), /100\/8/);
});

test('the Auto-degrees tip at 0 does not claim the radian value differs', async () => {
  for (const fn of ['cos', 'sin']) {
    const tip = (await solvePlain(`${fn}(0)`, 'trigonometry')).tips[0];
    assert.match(tip, /Here it makes no difference/, fn);
    assert.doesNotMatch(tip, /is a different number/, fn);
  }
  assert.match((await solvePlain('cos(60)', 'trigonometry')).tips[0], /in radians, cos\(60\) is a different number/);
});

test('JSON exports keep the stored topic and add the name the page shows', () => {
  const rows = JSON.parse(buildProgressJSON([{ problem: '6*7', topic: 'other' }, { problem: 'x', topic: 'mystery' }], { other: 'Arithmetic' }));
  assert.equal(rows[0].topic, 'other');
  assert.equal(rows[0].topicLabel, 'Arithmetic');
  assert.equal(rows[1].topicLabel, undefined);
});
