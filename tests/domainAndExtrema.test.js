import test from 'node:test';
import assert from 'node:assert/strict';

import { solveProblem } from '../src/lib/api.js';
import { findUndefinedRegions, formatRestriction } from '../src/lib/solvers/solverUtils.js';
import { describeGraphFeatures } from '../src/lib/graphDescription.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

const stepsText = (r) => r.steps.join('\n');

// ── The shared domain helper.

test('findUndefinedRegions: poles, radicands, logs — with open/closed edges', () => {
  const pole = findUndefinedRegions('1/(x-1)', 'x');
  assert.equal(pole.length, 1);
  assert.ok(Math.abs(pole[0].from - 1) < 1e-6 && Math.abs(pole[0].to - 1) < 1e-6);

  const root = findUndefinedRegions('sqrt(x-2)', 'x');
  assert.equal(root.length, 1);
  assert.equal(root[0].from, -Infinity);
  assert.ok(Math.abs(root[0].to - 2) < 1e-6);
  assert.equal(root[0].toClosed, false, 'sqrt(x-2) IS defined at 2');

  const log = findUndefinedRegions('log(x)', 'x');
  assert.equal(log.length, 1);
  assert.ok(Math.abs(log[0].to - 0) < 1e-6);
  assert.equal(log[0].toClosed, true, 'ln(x) is NOT defined at 0');

  assert.deepEqual(findUndefinedRegions('x^2 + 1', 'x'), []);
});

test('formatRestriction: undefined-set vs allowed-set wording', () => {
  const pt = { from: 1, to: 1, fromClosed: true, toClosed: true };
  assert.equal(formatRestriction(pt, 'x'), 'x = 1');
  assert.equal(formatRestriction(pt, 'x', { allowed: true }), 'x ≠ 1');
  const sq = { from: -Infinity, to: 2, fromClosed: false, toClosed: false };
  assert.equal(formatRestriction(sq, 'x'), 'x < 2');
  assert.equal(formatRestriction(sq, 'x', { allowed: true }), 'x ≥ 2');
  const ln = { from: -Infinity, to: 0, fromClosed: false, toClosed: true };
  assert.equal(formatRestriction(ln, 'x'), 'x ≤ 0');
  assert.equal(formatRestriction(ln, 'x', { allowed: true }), 'x > 0');
});

// ── QA report (High): identities lost their domain.

test('1/(x-1) = 1/(x-1) is an identity on x ≠ 1, not on all reals', async () => {
  const r = await solveProblem('1/(x-1)=1/(x-1)', 'algebra');
  assert.equal(r.status, STATUS.SOLVED);
  assert.match(r.answer, /x ≠ 1/);
  assert.doesNotMatch(r.answer, /^All real numbers \(identity — true for every/);
  assert.match(stepsText(r), /undefined for x = 1/);
});

test('identities on restricted domains carry the restriction; unrestricted ones stay plain', async () => {
  const sq = await solveProblem('sqrt(x-2)=sqrt(x-2)', 'algebra');
  assert.match(sq.answer, /x ≥ 2/);
  assert.doesNotMatch(sq.answer, /x = 2\.5/, 'must not report grid points as solutions');
  const ln = await solveProblem('ln(x)=ln(x)', 'algebra');
  assert.match(ln.answer, /x > 0/);
  const two = await solveProblem('1/(x^2-4)=1/((x-2)*(x+2))', 'algebra');
  assert.match(two.answer, /x ≠ -2 and x ≠ 2/);
  const plain = await solveProblem('2*x+3=2*x+3', 'algebra');
  assert.match(plain.answer, /^All real numbers \(identity/);
  assert.doesNotMatch(plain.answer, /≠|≥|>/);
});

// ── QA report (High): abs(x) minimum is a cusp, not f′ = 0.

test('abs(x): the minimum at (0, 0) is reported as a corner/cusp, not from f′ = 0', async () => {
  const r = await solveProblem('abs(x)', 'functions');
  const line = r.steps.find((s) => /minimum at \(0, 0\)/i.test(s));
  assert.ok(line, 'minimum must be reported');
  assert.match(line, /cusp|corner/i);
  assert.match(line, /does not exist/);
  assert.doesNotMatch(line, /\(from f′\(x\) = 0\)/);
  assert.match(line, /NOT come from f′\(x\) = 0/);
});

test('smooth extrema still say f′ = 0', async () => {
  const r = await solveProblem('x^3 - 3*x', 'functions');
  const lines = r.steps.filter((s) => /Local (maximum|minimum)/.test(s));
  assert.equal(lines.length, 2);
  for (const l of lines) assert.match(l, /\(from f′\(x\) = 0\)/);
});

// ── QA report (Medium): sqrt(x-2) endpoint minimum.

test('sqrt(x-2): absolute minimum at the domain endpoint (2, 0)', async () => {
  const r = await solveProblem('sqrt(x-2)', 'functions');
  const line = r.steps.find((s) => /domain endpoint \(2, 0\)/.test(s));
  assert.ok(line, 'endpoint minimum must be reported');
  assert.match(line, /^Absolute minimum/);
  assert.match(line, /f′ ≠ 0/);
  assert.doesNotMatch(stepsText(r), /No local extrema found/);
  // and it is drawn
  assert.ok(r.graph.annotations.extrema.some((e) => e.x === 2 && e.y === 0 && e.kind === 'min'));
});

test('sqrt(4-x^2): stationary maximum plus two endpoint minima, neither claimed absolute', async () => {
  const r = await solveProblem('sqrt(4-x^2)', 'functions');
  assert.match(stepsText(r), /Local maximum at \(0, 2\) \(from f′\(x\) = 0\)/);
  assert.match(stepsText(r), /Minimum at the domain endpoint \(-2, 0\)/);
  assert.match(stepsText(r), /Minimum at the domain endpoint \(2, 0\)/);
  assert.doesNotMatch(stepsText(r), /Absolute minimum at the domain endpoint/);
});

// ── QA report (Medium): ln(x) domain wording.

test('ln(x): undefined for x ≤ 0, so the domain is x > 0', async () => {
  const r = await solveProblem('ln(x)', 'functions');
  assert.match(stepsText(r), /undefined for x ≤ 0/);
  assert.match(stepsText(r), /domain is x > 0/);
  assert.doesNotMatch(stepsText(r), /undefined for x < 0/);
});

test('sqrt(x-2): undefined for x < 2 (defined at the edge), so the domain is x ≥ 2', async () => {
  const r = await solveProblem('sqrt(x-2)', 'functions');
  assert.match(stepsText(r), /undefined for x < 2/);
  assert.match(stepsText(r), /domain is x ≥ 2/);
});

// ── QA report (Medium): removable discontinuity.

test('(x^2-1)/(x-1): hole at (1, 2), explained via the simplified form', async () => {
  const r = await solveProblem('(x^2-1)/(x-1)', 'functions');
  const line = r.steps.find((s) => /Hole/.test(s));
  assert.ok(line);
  assert.match(line, /\(1, 2\)/);
  assert.match(line, /x \+ 1/);
  assert.match(line, /x ≠ 1/);
  assert.deepEqual(r.graph.annotations.holes, [{ x: 1, y: 2 }]);
  // not mistaken for an asymptote
  assert.equal(r.graph.annotations.verticalAsymptotes.length, 0);
});

test('a real pole is an asymptote, not a hole', async () => {
  const r = await solveProblem('1/(x-2)', 'functions');
  assert.deepEqual(r.graph.annotations.holes, []);
  assert.deepEqual(r.graph.annotations.verticalAsymptotes, [2]);
});

test('the graph description mentions holes', () => {
  const f = describeGraphFeatures({ title: 't', points: [{ x: 0, y: 0 }], annotations: { holes: [{ x: 1, y: 2 }] } });
  assert.equal(f[0], 'A hole at (1, 2) — the function is undefined there but does not blow up.');
});
