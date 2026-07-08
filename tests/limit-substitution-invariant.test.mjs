// Invariant test standing in for the "suspicious quotient" guard.
//
// The direct-substitution rung in evaluateFiniteLimit trusts a finite value at
// the exact target. A reviewer worried a 0/0 quotient might slip a finite-but-
// wrong value past that guard via floating-point cancellation. This test pins
// down why that cannot happen: math.evaluate divides an independently computed
// numerator and denominator, so a genuine 0/0 AT the point is IEEE 0/0 = NaN,
// which fails the Number.isFinite guard and falls through to the symbolic
// ladder. We assert that invariant directly rather than adding a guard for a
// case the language already forecloses. If a future math.js change ever breaks
// it, this test fails loudly and the guard discussion reopens with evidence.
import { create, all } from 'mathjs';
import assert from 'node:assert';

const math = create(all);
const evalAt = (f, x) => {
  try { const y = math.evaluate(f, { x }); return typeof y === 'number' ? y : Number(y); }
  catch { return NaN; }
};

const zeroOverZeroForms = [
  ['(1-cos(x))/x^2', 0], ['(sin(x)-x)/x^3', 0], ['(tan(x)-sin(x))/x^3', 0],
  ['(exp(x)-1-x)/x^2', 0], ['(1-cos(x))/(x*sin(x))', 0], ['sin(x)^2/x^2', 0],
  ['(x^2-1)/(x-1)', 1], ['(x^10-1)/(x-1)', 1], ['(x^2-4)/(x-2)', 2],
  ['(sqrt(1+x)-1)/x', 0], ['(cos(x)-cos(3*x))/x^2', 0], ['(log(x))/(x-1)', 1],
];

let passed = 0;
for (const [f, t] of zeroOverZeroForms) {
  const v = evalAt(f, t);
  assert.ok(!Number.isFinite(v), `${f} @ x=${t} returned finite ${v}; the substitution guard could be bypassed`);
  passed += 1;
}
console.log(`invariant holds: ${passed}/${zeroOverZeroForms.length} 0/0 forms are non-finite at the exact target`);
