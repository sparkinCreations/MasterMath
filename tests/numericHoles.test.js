// A root the numeric search locates at a point where the equation is undefined
// (1.76.1). The bracket closes on 2.0000000000001, where (x - 2)/(x - 2) is
// still exactly 1, so substituting back passed: "x ≈ 2" was reported for an
// equation with no value at x = 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

test('a located root where a denominator is 0 is rejected, with the reason', async () => {
  for (const [p, answer, rejected] of [
    ['abs(x)+abs(x-1)+(x-2)/(x-2)=4', 'x = -1', 'x ≈ 2'],
    ['abs(x)*(x-3)/(x-3)=3', 'x = -3', 'x ≈ 3'],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(r.steps.some((s) => s.includes(rejected) && /undefined/.test(s)), r.steps.join('\n'));
    assert.ok(!r.steps.some((s) => /^Check in the original/.test(s) && s.includes(rejected.replace('≈', '='))), r.steps.join('\n'));
  }
  // At an irrational point too, where no rounded value would be exactly the hole.
  const surd = await solvePlain('abs(x-1)+(x-sqrt(2))/(x-sqrt(2))=sqrt(2)', 'algebra');
  assert.match(surd.answer, /0\.5858/);
  assert.doesNotMatch(surd.answer, /1\.4142/);
});

test('when the only candidate is undefined, no solution is claimed', async () => {
  for (const p of ['e^x+(x-1)/(x-1)=e+1', '2^x+(x-3)/(x-3)=9', 'ln(x)+(x-1)/(x-1)=1', 'sin(x)+x+(x-pi)/(x-pi)=pi+1']) {
    const r = await solvePlain(p, 'algebra');
    assert.doesNotMatch(String(r.answer), /≈/, p);
    assert.notEqual(r.status, 'solved', p);
    assert.match(JSON.stringify(r), /undefined/, p);
  }
});

test('tangent and secant are undefined where their cosine is 0', async () => {
  const r = await solvePlain('tan(x)*cos(x)+x=1+pi/2', 'algebra');
  assert.doesNotMatch(String(r.answer), /1\.5708/);
});

test('a real root beside a denominator is kept', async () => {
  for (const [p, shown] of [
    ['e^x+1/x=e+1', /x ≈ 1\b|x = 1\b/],
    ['abs(x)+abs(x-1)+1/x=5', /1\/4/],
    ['1/x+1/(x+1)=1', /√5/],
    // The root 6/5 is 0.00001 from the zero of the denominator, and is still a root.
    ['x-1.2+(x-1.20001)/(x-1.20001)=1', /6\/5|1\.2\b/],
    ['x*cos(x)/x=1', /6\.2832/],
  ]) {
    const r = await solvePlain(p, 'algebra');
    assert.equal(r.status, 'solved', p);
    assert.match(r.answer, shown, p);
  }
});
