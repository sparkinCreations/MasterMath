// The mathsteps seam (roadmap 2026-09 item 8). mathsteps is unmaintained and
// has been confidently wrong once; these tests prove that (a) the library can
// only be reached through the two guarded entry points in mathstepsUtils.js,
// (b) those entry points never throw, and (c) with mathsteps switched off every
// algebra path still produces an exact answer — so the day it breaks on a
// dependency upgrade, the app loses worked steps, not correctness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  setMathstepsEnabled,
  isMathstepsEnabled,
  mathstepsSolveEquation,
  mathstepsSimplify,
} from '../src/lib/mathstepsUtils.js';
import { solveProblem } from '../src/lib/api.js';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test('mathstepsUtils.js is the only file in src that imports mathsteps', () => {
  const src = path.resolve(process.cwd(), 'src');
  const importers = walk(src).filter((f) => /from\s+['"]mathsteps['"]|require\(\s*['"]mathsteps['"]\s*\)/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(importers.map((f) => path.relative(src, f)), ['lib/mathstepsUtils.js']);
});

test('the seam never throws: unusable input gives null', () => {
  assert.equal(mathstepsSolveEquation('x^2 +* 3 = ('), null);
  assert.equal(mathstepsSolveEquation(''), null);
  assert.equal(mathstepsSimplify(''), null);
  assert.equal(mathstepsSimplify('sin('), null);
});

test('with mathsteps on, a linear equation still gets its worked walkthrough', async () => {
  assert.equal(isMathstepsEnabled(), true);
  const r = await solveProblem('2x + 5 = 11', 'algebra');
  assert.match(r.answer, /x = 3/);
  assert.ok(r.steps.some((s) => /both sides/i.test(s)), r.steps.join(' | '));
});

test('with mathsteps switched off, every algebra path still answers exactly', async () => {
  setMathstepsEnabled(false);
  try {
    assert.equal(isMathstepsEnabled(), false);
    assert.equal(mathstepsSolveEquation('2x + 5 = 11'), null);
    assert.equal(mathstepsSimplify('2x + 3x'), null);

    const linear = await solveProblem('2x + 5 = 11', 'algebra');
    assert.equal(linear.status, 'solved');
    assert.match(linear.answer, /x = 3/);

    const quadratic = await solveProblem('x^2 - 5x + 6 = 0', 'algebra');
    assert.equal(quadratic.status, 'solved');
    assert.match(quadratic.answer, /x = 2/);
    assert.match(quadratic.answer, /x = 3/);

    const irrational = await solveProblem('x^2 - 2x - 1 = 0', 'algebra');
    assert.match(irrational.answer, /1 - √2/);
    assert.match(irrational.answer, /1 \+ √2/);

    const fraction = await solveProblem('x/3 + 1 = 4', 'algebra');
    assert.match(fraction.answer, /x = 9/);

    const simplified = await solveProblem('2x + 3x', 'algebra');
    assert.equal(simplified.status, 'solved');
    assert.match(simplified.answer.replace(/\s|\*/g, ''), /^5x$/);

    const cancelled = await solveProblem('(x^2 - 9)/(x + 3)', 'algebra');
    assert.match(cancelled.answer.replace(/\s/g, ''), /^x-3$/);
  } finally {
    setMathstepsEnabled(true);
  }
});
