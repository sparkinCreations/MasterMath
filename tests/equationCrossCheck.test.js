import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import { solveProblem } from '../src/lib/api.js';
import { rng } from './helpers/crossCheck.js';
import { judge, problemOf } from './helpers/equationCrossCheck.js';
import { METHODS, EXEMPT, unregistered } from './helpers/equationMethods.js';

// Every file in src/lib/solvers/algebra/ is registered in
// tests/helpers/equationMethods.js with seeded families of awkward inputs
// (π, e, decimals, fractions, square roots, x in a denominator, true
// everywhere, true nowhere), or is exempt with its reason. Each answer is read
// back and compared with the equation on a dense grid, an oracle only.

const folder = new URL('../src/lib/solvers/algebra/', import.meta.url);
const modules = readdirSync(folder).filter((f) => f.endsWith('.js'));

test('every file in solvers/algebra is registered or exempt with named tests', () => {
  assert.deepEqual(unregistered(modules), [], 'add the new method to tests/helpers/equationMethods.js');
  for (const name of [...Object.keys(METHODS), ...Object.keys(EXEMPT)]) assert.ok(modules.includes(name), `${name} is registered, but there is no such file`);
  for (const [name, { why, tests }] of Object.entries(EXEMPT)) {
    assert.ok(why.length > 20, `${name}: say why it is exempt`);
    assert.ok(tests.length > 0, `${name}: name the tests that cover it`);
    for (const t of tests) assert.ok(existsSync(new URL(`../${t}`, import.meta.url)), `${name}: there is no ${t}`);
  }
  for (const [name, m] of Object.entries(METHODS)) {
    assert.ok(m.families.length > 0, `${name}: no families`);
    assert.ok(m.families.some((f) => f.answered > 0), `${name}: no family has to be answered by the method, so it could test nothing`);
  }
});

test('a method file that is not registered is reported', () => {
  assert.deepEqual(unregistered([...modules, 'brandNewMethod.js']), ['brandNewMethod.js']);
  assert.deepEqual(unregistered(['absPiecewise 2.js']), [], 'a copy left by a file manager is not a module');
});

for (const [file, method] of Object.entries(METHODS)) {
  for (const family of method.families) {
    test(`cross-check ${file}: ${family.name}`, async () => {
      const r = rng(20261110 + family.name.length);
      const marker = 'marker' in family ? family.marker : method.marker;
      let byMethod = 0;
      for (let i = 0; i < method.perFamily; i += 1) {
        const equation = family.make(r);
        const problem = problemOf(equation);
        const result = await solveProblem(problem, 'algebra');
        const verdict = judge(result, equation, marker);
        assert.notEqual(verdict.outcome, 'wrong', `${problem} → ${result.answer}: ${verdict.wrong}`);
        // Unread is allowed only for a long closed form this reader cannot
        // evaluate; anything else means the reader has fallen behind.
        if (verdict.outcome === 'unread') assert.ok(String(result.answer).length > 40, `${problem} → cannot read "${result.answer}"`);
        if (verdict.byMethod) byMethod += 1;
      }
      // A family the method handles has to be answered by it, or it tests nothing.
      assert.ok(byMethod >= method.perFamily * (family.answered ?? 0), `only ${byMethod} of ${method.perFamily} were answered by the method`);
    });
  }
}
