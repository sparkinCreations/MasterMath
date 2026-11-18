// 1.76.5: guidance worked on the problem typed — the division tip and
// mistakes (they always used 100/8 = 25/2), the Auto-degrees tip at 0
// (it said cos(0) is "a different number" in radians), and the topic's
// name in JSON exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { buildProgressJSON } from '../src/lib/exportUtils.js';
import { saveSettings, resetSettings } from '../src/lib/settings.js';

// settings.js reads localStorage; give node one so saveSettings takes effect.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

const all = (r) => [...r.tips, ...r.common_mistakes].join(' ');

test('a division is worked on its own numbers, not 100/8', async () => {
  const r = await solvePlain('12/18', 'other');
  assert.match(r.tips[0], /common factor 6 of 12 and 18 to get 12\/18 = 2\/3; as a decimal it repeats \(0\.6666…\)/);
  assert.doesNotMatch(all(r), /100\/8|12\.5|25\/2/);
  assert.match(r.common_mistakes[0], /12\/18 is 12 ÷ 18/);
  assert.match(r.common_mistakes[1], /cut-off decimal such as 0\.6666 as if it were exact: 2\/3 is exact/);
  // A terminating decimal, a whole quotient, decimals cleared, a sign, 0.
  assert.match((await solvePlain('100/8', 'other')).tips[0], /common factor 4 .* 25\/2; as a decimal, 12\.5/);
  assert.match((await solvePlain('9/3', 'other')).tips[0], /3 goes into 9 exactly 3 times/);
  assert.match((await solvePlain('2.5/0.5', 'other')).tips[0], /multiply both numbers by 10, so 2\.5\/0\.5 = 25\/5/);
  assert.match((await solvePlain('-12/18', 'other')).tips[0], /−12\/18 = −2\/3/);
  assert.match((await solvePlain('0/5', 'other')).tips[0], /0\/5 = 0/);
  // A whole quotient is checked with its signs (−10/2 = −5: −5 × 2 = −10).
  for (const [p, check] of [['10/2', '5 × 2 = 10'], ['-10/2', '−5 × 2 = −10'], ['10/-2', '−5 × (−2) = 10'], ['-10/-2', '5 × (−2) = −10'], ['-2.5/0.5', '−5 × 5 = −25']]) {
    const tip = (await solvePlain(p, 'other')).tips[0];
    assert.ok(tip.includes(`check by multiplying back: ${check}`), `${p}: ${tip}`);
  }
  // Decimals come from long division on the integers, never from a double:
  // every digit of a terminating one, and the leading zeros of a small one.
  const big = await solvePlain('9007199254740991/25', 'other');
  assert.match(big.tips[0], /as a decimal, 360287970189639\.64\./);
  // …and the "Here" line: "=" only when four places are the whole value.
  assert.match(big.tips.find((t) => /^Here/.test(t)), /9007199254740991\/25 = 360287970189639\.64\.$/);
  assert.match((await solvePlain('12/18', 'other')).tips.find((t) => /^Here/.test(t)), /2\/3 ≈ 0\.6667\.$/);
  assert.match((await solvePlain('1/16', 'other')).tips.find((t) => /^Here/.test(t)), /1\/16 = 0\.0625\.$/);
  assert.match((await solvePlain('1/300', 'other')).tips[0], /repeats \(0\.003333…\)/);
  assert.match((await solvePlain('1/7', 'other')).tips[0], /repeats \(0\.1428…\)/);
  // At six places 1/1500000 reaches this tip; its size is kept (a double's
  // "6.666…e-7" cut short read as 6.666…).
  saveSettings({ decimalPlaces: 6 });
  try {
    assert.match((await solvePlain('1/1500000', 'other')).tips[0], /repeats \(0\.0000006666…\)/);
  } finally { resetSettings(); }
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
  // Never NaN when the first angle is not a plain number.
  assert.doesNotMatch((await solvePlain('sin(1-1)+cos(0)', 'trigonometry')).tips.join(' '), /NaN/);
});

test('JSON exports keep the stored topic and add the name the page shows', () => {
  const rows = JSON.parse(buildProgressJSON([{ problem: '6*7', topic: 'other' }, { problem: 'x', topic: 'mystery' }], { other: 'Arithmetic' }));
  assert.equal(rows[0].topic, 'other');
  assert.equal(rows[0].topicLabel, 'Arithmetic');
  assert.equal(rows[1].topicLabel, undefined);
});
