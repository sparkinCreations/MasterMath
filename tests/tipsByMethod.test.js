import test from 'node:test';
import assert from 'node:assert/strict';

import { solvePlain } from './helpers/solvePlain.js';

// Tips are chosen by the method that produced the result (roadmap P3,
// October 2026). For each solver, one problem per method: no two methods may
// lead with the same tip. A generic list shared across methods ("check
// symmetry", "for limits at infinity…" on a limit at 0) fails here.
const METHODS = {
  limits: [
    ['direct substitution', 'lim x->2 x^2 + 1'], ['factor and cancel', 'lim x->1 (x^2-1)/(x-1)'],
    ['conjugate', 'lim x->0 (sqrt(x+1)-1)/x'], ['squeeze', 'lim x->0 x*sin(1/x)'],
    ['Taylor series', 'lim x->0 (e^x - 1 - x)/x^2'], ['standard limit', 'lim x->0 sin(3x)/x'],
    ['logarithms', 'lim x->inf (1 + 1/x)^x'], ['at infinity', 'lim x->inf (3x^2+1)/(2x^2-5)'],
    ['does not exist', 'lim x->0 1/x'], ['oscillation', 'lim x->0 sin(1/x)'],
  ],
  functions: [
    ['quadratic', 'x^2 - 4x + 3'], ['rational', '1/(x-2)'], ['periodic', 'sin(2x)'], ['logarithm', 'ln(x)'],
    ['exponential', 'e^x'], ['root', 'sqrt(x-2)'], ['polynomial', 'x^3 - x'],
  ],
  other: [
    ['order of operations', '(5 + 3) * 4 - 2^3'], ['fractions', '3/4 + 5/6'], ['percent', '15% of 80'],
    ['factorial', '7!'], ['negative exponent', '2^-3'], ['root', 'sqrt(50)'], ['logarithm', 'log(8)'],
  ],
  algebra: [
    ['linear', '2x + 5 = 11'], ['factoring', 'x^2 - 5x + 6 = 0'], ['formula', 'x^2 + x - 1 = 0'],
    ['square roots', 'x^2 = 9'], ['absolute value', 'abs(2x-3) = 5'], ['radical', 'sqrt(x+2) = x'],
    ['logarithm', 'ln(x) = 1'], ['exponential', '2^x = 10'], ['rational', 'x/(x-1) = 2'],
    ['rational root theorem', 'x^3 - 6x^2 + 11x - 6 = 0'], ['simplify', '3(x-2)+4'], ['cancel', '(x^2-1)/(x-1)'],
  ],
  derivatives: [
    ['power', 'x^3'], ['chain', 'sin(3x^2)'], ['product', 'x^2*sin(x)'], ['quotient', '(x+1)/(x-1)'],
    ['trig', 'sin(x)'], ['inverse trig', 'arcsin(x)'], ['hyperbolic', 'sinh(x)'], ['exponential', 'e^x'],
    ['logarithm', 'ln(x)'], ['error function', 'erf(x)'],
  ],
  integrals: [
    ['power', 'x^3'], ['substitution', 'x*cos(x^2)'], ['by parts', 'x*e^x'], ['partial fractions', '1/(x^2 - 1)'],
    ['trig substitution', 'sqrt(1 - x^2)'], ['definite', '∫_0^1 x^2 dx'],
  ],
};

for (const [topic, cases] of Object.entries(METHODS)) {
  test(`${topic}: each method leads with its own tip`, async () => {
    const seen = new Map();
    for (const [method, problem] of cases) {
      const r = await solvePlain(problem, topic);
      assert.ok(r.tips?.length > 0, `${topic} / ${method}: no tips`);
      const first = r.tips[0];
      assert.ok(!seen.has(first), `${topic}: "${method}" (${problem}) and "${seen.get(first)}" share the tip "${first}"`);
      seen.set(first, method);
    }
  });
}
