import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { solveProblem } from '../src/lib/api.js';
import { primeSettings } from '../src/lib/settings.js';
import { solvePlain } from './helpers/solvePlain.js';

// The October 2026 accuracy test list (docs/evaluations/2026-10/
// test-cases.json, 95 cases, expected values checked with SymPy; its results
// file was written against v1.47.1). Every case runs through the app's entry
// point. A REFUSE case must not be marked solved; every other case gives the
// answer below, each checked against the list's expected value when it was
// recorded (1.53.2). Case 21 is a page behaviour (tips do not carry over),
// covered by the smoke test.

const cases = JSON.parse(readFileSync(new URL('../docs/evaluations/2026-10/test-cases.json', import.meta.url), 'utf8'));

// "sin(30) (degrees)": the angle unit rides on the input.
async function run(c) {
  const unit = c.input.match(/\((degrees|radians)(?: setting)?\)\s*$/);
  const input = unit ? c.input.replace(unit[0], '').trim() : c.input;
  primeSettings(unit ? { angleUnit: unit[1] } : null);
  try {
    return await solveProblem(input, c.topic);
  } finally {
    primeSettings(null);
  }
}

const ANSWERS = {
  13: "∫(1/(x^2 - 1)) dx = 1/2*(ln|x - 1| - ln|x + 1|) + C",
  14: "lim (x→∞) (1 + 1/x)^x = e (≈ 2.7183)",
  15: "∫(2x + 1) dx = x^2 + x + C",
  16: "x = 32",
  17: "f'(x) = 1/(x*ln(2)), x > 0",
  18: "∫(log_2(x)) dx = x*log_2(x) - x/ln(2) + C",
  19: "x = -i  or  x = i",
  20: "-2 < x < 3",
  22: "All real numbers (identity — true for every x)",
  23: "No solution (the two sides are never equal)",
  24: "x = 1 - √2  or  x = 1 + √2",
  25: "x = 3 (repeated root, multiplicity 2)",
  26: "x = -2  or  x = -1  or  x = 1  or  x = 2",
  27: "x = 2  or  x = -1 - i√3  or  x = -1 + i√3",
  28: "x = 9",
  29: "All real numbers with x ≠ 1 (identity on its domain)",
  30: "No solution (the two sides are never equal)",
  31: "x = 3",
  32: "x < -2  or  x > 2",
  33: "x < -2  or  x ≥ 1",
  34: "No solution — no value satisfies the inequality",
  35: "All real numbers satisfy the inequality",
  36: "-2 < x ≤ 3",
  37: "x < -3",
  38: "x = -2  or  x = 8",
  39: "No real solution — an absolute value is never negative",
  40: "x ≤ -1  or  x ≥ 5",
  41: "x = 1  or  x = 5",
  42: "x = 2,  y = 1",
  43: "Infinitely many solutions — the two equations describe the same line: (x, y) = (3 − 2t, t), t any real number",
  44: "No solution — the two lines are parallel",
  45: "x = 1,  y = 1,  z = 4",
  46: "(x, y) = (-1, 1)  or  (2, 4)",
  47: "x = 5",
  48: "x = 1",
  49: "x = ln(7)/2 (≈ 0.973)",
  50: "x = 2",
  51: "x = 1/9 (≈ 0.1111)",
  52: "x = 1/e (≈ 0.3679)",
  53: "x = -100",
  54: "x = 30° + 360°n  or  x = 150° + 360°n (n ∈ ℤ);  on [0°, 360°): 30°, 150°",
  55: "x = π/6 + 2πn  or  x = 5π/6 + 2πn (n ∈ ℤ);  on [0, 2π): π/6, 5π/6",
  56: "1/2 (≈ 0.5)",
  57: "-0.988",
  58: "x = 2π/3 + 2πn  or  x = 4π/3 + 2πn  or  x = 2πn (n ∈ ℤ);  on [0, 2π): 0, 2π/3, 4π/3",
  59: "x = π/4 + πn (n ∈ ℤ);  on [0, 2π): π/4, 5π/4",
  60: "No real solution (sin(θ) is never outside [−1, 1])",
  61: "x = π/6 + (2π/3)n  or  x = π/2 + 2πn (n ∈ ℤ);  on [0, 2π): π/6, π/2, 5π/6, 3π/2",
  62: "f'(x) = 2x*cos(x^2)",
  63: "f'(x) = x*e^x*(x + 2)",
  64: "f'(x) = (x^2 - 2x - 1)/((x - 1)^2), x ≠ 1",
  65: "f'(x) = -1 for x < 0, 1 for x > 0; f'(0) does not exist",
  66: "f''(x) = 12x^2",
  67: "f'(x) = 1/√(1 - x^2)",
  68: "f'(x) = -tan(x)",
  69: "f'(x) = 0",
  70: "f'(2) = 12",
  71: "f'(y) = x",
  72: "∫_0^π (sin(x)) dx = 2",
  73: "∫_1^e (1/x) dx = 1",
  74: "∫(x*e^x) dx = e^x*(x - 1) + C",
  75: "∫_1^∞ (1/x^2) dx = 1",
  76: "∫_1^∞ (1/x) dx diverges",
  77: "Diverges — the integral has no finite value (unbounded at x = 0 inside the interval)",
  78: "∫_0^∞ (e^(-x)) dx = 1",
  79: "∫_0^1 (1/sqrt(x)) dx = 2",
  80: "∫(2x/(x^2 + 1)) dx = ln(x^2 + 1) + C",
  81: "∫((3x + 5)/((x + 1)*(x + 2))) dx = 2ln|x + 1| + ln|x + 2| + C",
  82: "∫_2^2 (x) dx = 0",
  83: "∫_3^0 (x^2) dx = -9",
  84: "lim (x→0⁺) 1/x = ∞",
  85: "lim (x→0⁻) 1/x = -∞",
  86: "lim (x→0) 1/x does not exist",
  87: "lim (x→0) |x|/x does not exist",
  88: "lim (x→0) sin(1/x) does not exist",
  89: "lim (x→3) (x^2 - 9)/(x - 3) = 6",
  90: "lim (x→∞) (3x^2 + 1)/(2x^2 - x) = 3/2 (≈ 1.5)",
  91: "lim (x→∞) sqrt(x^2 + x) - x = 1/2 (≈ 0.5)",
  92: "lim (x→0) x*sin(1/x) = 0",
  93: "lim (x→0) (1 - cos(x))/x^2 = 1/2",
  94: "lim (x→-∞) e^x = 0",
  95: "lim (x→∞) x^(1/x) = 1",
};

test('the October 2026 test list: every refusal refuses', async () => {
  for (const c of cases.filter((k) => k.expected === 'REFUSE')) {
    const r = await run(c);
    // #7 x^2 + y^2 = 25 under Derivatives: "refuse or give dy/dx = -x/y".
    if (c.id === 7) {
      assert.equal(r.answer, 'dy/dx = -x/y');
      continue;
    }
    assert.notEqual(r.status, 'solved', `#${c.id} ${c.input} → ${r.answer}`);
    assert.doesNotMatch(String(r.answer), /^-?\d/, `#${c.id} gave a number`);
  }
});

test('the October 2026 test list: every other case gives its expected answer', async () => {
  for (const c of cases.filter((k) => k.expected !== 'REFUSE' && k.id !== 21)) {
    const r = await run(c);
    assert.equal(r.answer, ANSWERS[c.id], `#${c.id} ${c.input} (expected: ${c.expected})`);
  }
  assert.equal(Object.keys(ANSWERS).length, cases.length - 13);
});

test('the October 2026 test list: the method and the tips fit the problem', async () => {
  // #13: partial fractions, shown.
  assert.ok((await solvePlain('integral of 1/(x^2-1)', 'integrals')).steps.some((s) => /Partial fractions: 1\/\(x\^2 - 1\) = -1\/2·1\/\(x \+ 1\) \+ 1\/2·1\/\(x - 1\)/.test(s)));
  // #14: logarithms and the standard limit, not sampling.
  const e = await solvePlain('limit of (1+1/x)^x as x->infinity', 'limits');
  assert.ok(e.steps.some((s) => /1\^∞/.test(s)) && e.steps.some((s) => /ln L = 1/.test(s)), e.steps.join(' | '));
  // #19: about square roots and i, never another problem's numbers.
  const q = await solvePlain('x^2 + 1 = 0', 'algebra');
  assert.doesNotMatch([...q.tips, ...q.common_mistakes].join('\n'), /\(x − 2\)\(x − 3\)|x² = 9/);
  assert.match(q.tips.join('\n'), /i = √\(−1\)/);
  // #20: no numerators or denominators for an absolute value.
  const a = await solvePlain('|2x-1| < 5', 'algebra');
  assert.doesNotMatch([...a.tips, ...a.common_mistakes].join('\n'), /numerator|denominator/i);
  assert.ok(a.steps.includes('Move everything to one side: |2x - 1| - 5 < 0.'), a.steps.join(' | '));
  // #12: the refusal names the integral to type.
  assert.ok((await run({ input: "y'(x) = 3x^2", topic: 'derivatives' })).tips.some((t) => t.includes('"∫ 3x^2 dx"')));
  // #67: the rule named is the inverse trig rule, not the power rule.
  assert.ok((await solvePlain('derivative of arcsin(x)', 'derivatives')).steps.some((s) => /^Inverse trig rule/.test(s)));
});
