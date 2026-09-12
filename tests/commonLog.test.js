import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMathExpression, rewriteCommonLog, usesCommonLog } from '../src/lib/mathParser.js';
import { solveProblem, COMMON_LOG_TIP } from '../src/lib/api.js';

// A bare `log` is the common (base-10) logarithm, as on a calculator; `ln` is
// the natural logarithm. Every engine here names the NATURAL log `log`, so
// before this the app answered log(100) = 4.6052 — confidently wrong by its
// own corpus standard — and "solved" log(x) + log(x − 3) = 1 at x ≈ 3.73.

test('parser: bare log(…) becomes the change-of-base quotient log(…)/log(10)', () => {
  assert.equal(parseMathExpression('log(100)'), '(log(100)/log(10))');
  assert.equal(parseMathExpression('x*log(x)'), 'x*(log(x)/log(10))');
  // Nested parentheses in the argument survive (paren matching, not a regex).
  assert.equal(parseMathExpression('log(x^2 + (x-1))'), '(log(x^2+(x-1))/log(10))');
  // A nested bare log is base 10 too.
  assert.equal(parseMathExpression('log(log(x))'), '(log((log(x)/log(10)))/log(10))');
  // Bars are the argument.
  assert.equal(parseMathExpression('log|x|'), '(log(abs(x))/log(10))');
});

test('parser: ln, explicit-base forms and change-of-base quotients are left alone', () => {
  assert.equal(parseMathExpression('ln(x)'), 'ln(x)');
  assert.equal(parseMathExpression('log(x, 2)'), '(log(x)/log(2))');
  assert.equal(parseMathExpression('log10(x)'), '(log(x)/log(10))');
  assert.equal(parseMathExpression('log2(x)'), '(log(x)/log(2))');
  assert.equal(parseMathExpression('log_3(x)'), '(log(x)/log(3))');
  // log(A)/log(B) is base B whatever base log is — never wrapped again.
  assert.equal(parseMathExpression('log(x)/log(10)'), 'log(x)/log(10)');
  assert.equal(parseMathExpression('(log(x)/log(10))'), '(log(x)/log(10))');
  // Unbalanced input is left exactly as typed for the caller to reject.
  assert.equal(rewriteCommonLog('log(x'), 'log(x');
});

test('parser: the rewrite is idempotent, so a re-parsed expression is unchanged', () => {
  for (const input of ['log(100)', 'log(x) + log(x-3) = 1', 'log10(x)', 'log(x, 2)', 'log(log(x))', '2*log(x)/log(3)']) {
    const once = parseMathExpression(input);
    assert.equal(parseMathExpression(once), once, input);
  }
});

test('usesCommonLog: true only when a bare log was read as base 10', () => {
  assert.equal(usesCommonLog('log(100)'), true);
  assert.equal(usesCommonLog('2 log(x) + 1'), true);
  assert.equal(usesCommonLog('ln(x)'), false);
  assert.equal(usesCommonLog('log10(x)'), false);
  assert.equal(usesCommonLog('log(x, 2)'), false);
  assert.equal(usesCommonLog('log(x)/log(10)'), false);
  assert.equal(usesCommonLog('x^2 + 1'), false);
});

test('log(100) = 2 and log(0.001) = -3 (arithmetic)', async () => {
  const a = await solveProblem('log(100)', 'other');
  assert.equal(a.status, 'solved');
  assert.equal(a.answer, '2');
  assert.ok(a.tips.includes(COMMON_LOG_TIP), 'the convention is stated');
  const b = await solveProblem('log(0.001)', 'other');
  assert.equal(b.answer, '-3');
});

test('log(x) + log(x-3) = 1 solves to x = 5 (base 10), rejecting x = -2', async () => {
  const r = await solveProblem('log(x) + log(x-3) = 1', 'algebra');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /x\s*=\s*5(?!\d)/);
  assert.doesNotMatch(r.answer, /-2/);
  assert.doesNotMatch(r.answer, /3\.7/);
});

test('log(x) = 2 → x = 100; ln keeps its natural-log meaning', async () => {
  const r = await solveProblem('log(x) = 2', 'algebra');
  assert.match(r.answer, /x\s*=\s*100(?!\d)/);
  const n = await solveProblem('ln(x) = 1', 'algebra');
  // The algebra solver reports this root as a decimal today; either form is e.
  assert.match(n.answer, /x\s*=\s*(?:e(?![a-z])|2\.7183)/);
  assert.ok(!n.tips.includes(COMMON_LOG_TIP), 'no base-10 note when only ln was used');
});

test('d/dx log(x) = 1/(x·ln(10)); d/dx ln(x) = 1/x', async () => {
  const c = await solveProblem('d/dx log(x)', 'derivatives');
  assert.match(c.answer, /ln\(10\)/);
  assert.match(c.answer, /1\/\(x\*ln\(10\)\)|1\/\(ln\(10\)\*x\)/);
  const n = await solveProblem('d/dx ln(x)', 'derivatives');
  assert.match(n.answer, /=\s*1\/x$/);
});

test('lim x->1 log(x)/(x-1) = 1/ln(10) ≈ 0.4343, not 1', async () => {
  const r = await solveProblem('lim x->1 log(x)/(x-1)', 'limits');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /0\.4343/);
});

test('explicit-base logs still work and carry no base-10 note', async () => {
  const r = await solveProblem('log(8, 2)', 'other');
  assert.equal(r.answer, '3');
  assert.ok(!r.tips.includes(COMMON_LOG_TIP));
  const t = await solveProblem('log_2(32)', 'other');
  assert.equal(t.answer, '5');
});
