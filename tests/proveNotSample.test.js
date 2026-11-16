// 1.76.4: a property is proved or not claimed — samples may refute it, never
// establish it (CLAUDE.md). Three paths decided convergence, an asymptote or
// an identity from a handful of samples, and each was fooled: a function
// with a whole-number period is the same at every power of ten, and a small
// extra term hides between seven sample points. Each case below was a
// confidently wrong answer on 1.76.3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';

const steps = (r) => r.steps.join('\n');
const horizontal = (r) => r.steps.filter((s) => /Horizontal asymptote:/.test(s));

test('an improper integral of an oscillation with a whole-number period diverges (it was "= 0")', async () => {
  for (const p of ['∫_0^∞ cos(pi*x) dx', '∫_1^∞ sin(2*pi*x) dx', '∫_0^∞ sin(pi*x+1) dx', '∫_0^∞ cos(2*pi*x+0.3) dx',
    '∫_0^∞ (sin(pi*x)+cos(pi*x)) dx', '∫_-∞^0 cos(pi*x) dx', '∫_0^∞ cos(x) dx']) {
    const r = await solvePlain(p, 'integrals');
    assert.equal(r.status, 'diverges', `${p}: ${r.answer}`);
    assert.match(steps(r), /keeps oscillating: it has no limit/, p);
  }
  // A periodic part beside a part that grows: it runs off to ∞.
  const r = await solvePlain('∫_0^∞ (1+cos(pi*x)) dx', 'integrals');
  assert.equal(r.status, 'diverges');
  assert.match(steps(r), /periodic and bounded/);
});

test('convergent improper integrals are still worked, each limit proved', async () => {
  for (const [p, answer] of [
    ['∫_1^∞ 1/x^2 dx', '= 1'], ['∫_0^∞ e^(-x) dx', '= 1'], ['∫_0^∞ x*e^(-x) dx', '= 1'], ['∫_0^∞ x^2*e^(-x) dx', '= 2'],
    ['∫_0^∞ e^(-x)*sin(x) dx', '= 1/2'], ['∫_0^∞ e^(-2*x)*cos(3*x) dx', '= 2/13'], ['∫_0^∞ 1/(1+x^2) dx', '= π/2'],
    ['∫_-∞^∞ e^(-x^2) dx', '= √π'], ['∫_-∞^0 e^x dx', '= 1'],
  ]) {
    const r = await solvePlain(p, 'integrals');
    assert.equal(r.status, 'solved', `${p}: ${r.answer}`);
    assert.ok(r.answer.includes(answer), `${p}: ${r.answer}`);
    assert.doesNotMatch(steps(r), /samples at/, p);
  }
  for (const p of ['∫_1^∞ 1/x dx', '∫_2^∞ 1/(x*ln(x)) dx', '∫_0^∞ 1/sqrt(x+1) dx']) {
    assert.equal((await solvePlain(p, 'integrals')).status, 'diverges', p);
  }
  // The squeeze theorem is said for e^(−x)·sin(x).
  assert.match(steps(await solvePlain('∫_0^∞ e^(-x)*sin(x) dx', 'integrals')), /squeezed to/);
});

test('an oscillation has no horizontal asymptote, whatever its period or phase', async () => {
  for (const p of ['sin(pi*x)', 'cos(2*pi*x)', 'sin(pi*x+1)', 'cos(2*pi*x+0.3)+sin(pi*x)', 'cos(pi*x/2)+1/x',
    'cos(x)^2+sin(x)^2+0.0000001*sin(x)', 'cos(x)^2+sin(x)^2+0.001*sin(x)']) {
    const r = await solvePlain(p, 'functions');
    assert.deepEqual(horizontal(r), [], `${p}: ${horizontal(r).join(' | ')}`);
    assert.doesNotMatch(r.answer, /horizontal asymptote/, p);
  }
});

test('true horizontal asymptotes are kept, proved, and exact', async () => {
  for (const [p, want] of [
    ['1/x', /y = 0 as x → ±∞/], ['e^(-x^2)', /y = 0 as x → ±∞/], ['sin(x)/x', /y = 0 as x → ±∞/], ['sin(pi*x)/x', /y = 0 as x → ±∞/],
    ['(2x^2+1)/(x^2-4)', /y = 2 as x → ±∞/], ['e^x - 2', /y = -2 as x → −∞ only/], ['1/(1+e^(-x))', /y = 1 as x → ∞ only/],
    ['x/sqrt(x^2+1)', /y = -1 as x → −∞ only/], ['tanh(x)', /y = 1 as x → ∞ only/],
    // Proved by the squeeze theorem for any bounded factor (sin(x²) is not
    // periodic), and through a quotient over something that grows.
    ['1/(x^2+sin(x)+2)', /y = 0 as x → ±∞/], ['sin(x^2)*e^x', /y = 0 as x → −∞ only/], ['cos(x)/(x^2+1)', /y = 0 as x → ±∞/],
    ['atan(x)/x', /y = 0 as x → ±∞/], ['sqrt(x)/(x-1)', /y = 0 as x → ∞ only/],
    // Exact first: ±π/2, not ±1.5708.
    ['atan(x)', /y = π\/2 \(≈ 1\.5708\) as x → ∞ only/],
  ]) {
    const shown = horizontal(await solvePlain(p, 'functions')).join(' | ').replace(/⟦|⟧/g, '');
    assert.match(shown, want, `${p}: ${shown}`);
  }
});

test('a limit at ∞ of a periodic part beside one that settles does not exist (was an estimate "≈ 1")', async () => {
  for (const p of ['lim x->inf (1 + 0.0000001*sin(x))', 'lim x->inf sin(pi*x)', 'lim x->inf cos(2*pi*x)', 'lim x->-inf cos(2*pi*x+0.3)']) {
    const r = await solvePlain(p, 'limits');
    assert.match(r.answer, /does not exist/, `${p}: ${r.answer}`);
    assert.doesNotMatch(r.answer, /estimate/, p);
  }
  assert.match((await solvePlain('lim x->inf sin(x)/x', 'limits')).answer, /= 0$/);
  const squeezed = await solvePlain('lim x->inf e^(-x)*sin(x)', 'limits');
  assert.match(squeezed.answer, /= 0$/);
  assert.doesNotMatch(squeezed.answer, /estimate/);
});

test('a trig simplification is proved or not made: a small extra term is never dropped', async () => {
  for (const [p, wrong] of [
    ['cos(x)^2+sin(x)^2+0.0000001*sin(x)', /^1\b/], ['2*sin(x)*cos(x) + 0.0000001*x', /^sin\(2x\)$/],
    ['cos(x)^2 - sin(x)^2 + 0.0000001*x^2', /^cos\(2x\)$/], ['sin(x)/cos(x) + 0.0000001*x^3', /^tan\(x\)$/],
    ['sin(x)^2+cos(x)^2+10^(-30)*x^40', /^1$/], ['sin(x)^2+cos(x)^2+10^(-12)*x', /^1/], ['sin(x)^2+cos(x)^2+0.001*x', /^1$/],
  ]) {
    for (const topic of ['trigonometry', 'auto']) {
      const r = await solvePlain(p, topic);
      assert.doesNotMatch(r.answer, wrong, `${p} [${topic}]: ${r.answer}`);
      assert.doesNotMatch(steps(r), /checked numerically/, p);
    }
  }
  // True identities still simplify.
  for (const [p, answer] of [['sin(x)^2+cos(x)^2', '1'], ['2*sin(x)*cos(x)', 'sin(2x)'], ['cos(x)^2-sin(x)^2', 'cos(2x)'], ['sin(x)/cos(x)', 'tan(x)'], ['tan(x)+cot(x)', '2/sin(2x)']]) {
    assert.equal((await solvePlain(p, 'trigonometry')).answer, answer, p);
  }
});

test('an identity is named by what the input is, not by where it lands', async () => {
  const second = async (p) => (await solvePlain(p, 'trigonometry')).steps[1].replace(/⟦|⟧/g, '');
  assert.match(await second('tan(x)*cot(x)'), /reciprocal identity cot\(θ\) = 1\/tan\(θ\)/);
  assert.doesNotMatch(await second('tan(x)*cot(x)'), /Pythagorean/);
  assert.match(await second('sec(x)*cos(x)'), /reciprocal identity sec\(θ\) = 1\/cos\(θ\)/);
  assert.match(await second('sec(x)^2-tan(x)^2'), /Pythagorean identity 1 \+ tan²\(θ\) = sec²\(θ\)/);
  assert.match(await second('csc(x)^2-cot(x)^2'), /Pythagorean identity 1 \+ cot²\(θ\) = csc²\(θ\)/);
  assert.match(await second('sin(x)^2+cos(x)^2'), /Pythagorean identity: sin²\(θ\) \+ cos²\(θ\) = 1/);
  assert.match(await second('2*sin(x)*cos(x)'), /double-angle identity/);
  // The tip teaches the identity the step names.
  const tc = await solvePlain('tan(x)*cot(x)', 'trigonometry');
  assert.match(tc.tips[0], /^Reciprocal identities/);
  assert.doesNotMatch(tc.tips[0], /Pythagorean/);
  // …and the mistakes are the reciprocal ones, not the double-angle warning.
  const mistakes = tc.common_mistakes.join(' ');
  assert.match(mistakes, /arctan/);
  assert.doesNotMatch(mistakes, /double-angle/);
  assert.match((await solvePlain('2*sin(x)*cos(x)', 'trigonometry')).common_mistakes.join(' '), /double-angle/);
});

test('a limit through a step function is worked one side at a time, never by substituting the point', async () => {
  const lim = (p) => solvePlain(p, 'limits');
  // At a jump: the two sides differ.
  for (const p of ['lim x->0 floor(x)', 'lim x->1 floor(x)', 'lim x->2 ceil(x)', 'lim x->0 sign(x)', 'lim x->0.5 round(x)', 'lim x->-2.5 round(x)',
    'lim x->3 mod(x, 3)', 'lim x->0 floor(-x)', 'lim x->0 floor(x) + x', 'lim x->1 sqrt(floor(x))', 'lim x->2 ln(ceil(x))']) {
    const r = await lim(p);
    assert.match(r.answer, /does not exist$/, `${p}: ${r.answer}`);
    assert.match(steps(r), /From the left/, p);
  }
  // At a jump with equal sides: the limit exists, whatever the value there.
  assert.match((await lim('lim x->0 sign(x)^2')).answer, /= 1$/);
  assert.match((await lim('lim x->0 x*sign(x)')).answer, /= 0$/);
  // Away from a jump: constant near the point.
  for (const [p, v] of [['lim x->0.5 floor(x)', '0'], ['lim x->0 round(x)', '0'], ['lim x->1 mod(x, 3)', '1']]) {
    assert.match((await lim(p)).answer, new RegExp(`= ${v}$`), p);
  }
  // One-sided limits are proved, not estimated.
  for (const [p, v] of [['lim x->0- floor(x)', '-1'], ['lim x->0+ floor(x)', '0'], ['lim x->0- sign(x)', '-1'], ['lim x->1- floor(x^2)', '0'], ['lim x->1+ floor(x^2)', '1']]) {
    const r = await lim(p);
    assert.match(r.answer, new RegExp(`= ${v}$`), `${p}: ${r.answer}`);
    assert.doesNotMatch(r.answer, /estimate/, p);
  }
  // Not proved here, so not claimed: a flat inside at the jump (⌊x²⌋ at 0,
  // whose limit is 0), what is left not continuous, a step inside a step.
  for (const p of ['lim x->0 floor(x^2)', 'lim x->0 floor(x)/x', 'lim x->0 floor(floor(x))']) {
    const r = await lim(p);
    assert.equal(r.status, 'unsupported', `${p}: ${r.answer}`);
  }
  assert.match((await lim('lim x->0 floor(x^2)')).steps.join('\n'), /derivative there is 0/);
});

test('review of 1.76.4: no step-limit decision rests on a tolerance or a sample', async () => {
  const lim = (p) => solvePlain(p, 'limits');
  // Sides 10¹² − 1 and 10¹²: different, proved exactly.
  assert.match((await lim('lim x->0 (1000000000000+floor(x))')).answer, /does not exist$/);
  // Within rounding of a jump, not on it: refused, not "does not exist".
  // round(x, 1) has other jumps: refused. atan(1/x) is not continuous at 0,
  // and tan(x + π/2) has a pole there: refused, not given a value.
  for (const p of ['lim x->0 floor(x+0.0000000000001)', 'lim x->0.5 round(x,1)', 'lim x->0- (floor(x) + atan(1/x))', 'lim x->0 floor(x)*tan(x+pi/2)']) {
    assert.equal((await lim(p)).status, 'unsupported', p);
  }
  // A typed point within rounding of a jump is read from its digits, never
  // put on the jump (as doubles, 10⁻¹⁶ was rounded to 0, and
  // 0.99999999999999999 is 1): refused, not "does not exist".
  for (const p of ['lim x->0.0000000000000001 floor(x)', 'lim x->0.99999999999999999 floor(x)', 'lim x->1.0000000000000001 floor(x)', 'lim x->0.0000000000000001- floor(x)',
    'lim x->(0.99999999999999999) floor(x)', 'lim x->(1e-16) floor(x)',
    // …and so is a number inside the function with more digits than a double keeps.
    'lim x->0 floor(x+0.99999999999999999)', 'lim x->0 floor(x)+0.99999999999999999']) {
    assert.equal((await lim(p)).status, 'unsupported', p);
  }
  // A point exactly on a jump still is: 10·0.1 = 1, and 3·(1/3) = 1.
  for (const p of ['lim x->0.1 floor(10*x)', 'lim x->1/3 floor(3*x)', 'lim x->(1/3) floor(3*x)', 'lim x->0.25+0.25 round(x)']) {
    assert.match((await lim(p)).answer, /does not exist$/, p);
  }
  // Exact, not a bare decimal.
  assert.match((await lim('lim x->0+ (floor(x)+sqrt(2))')).answer, /= √2 \(≈ 1\.4142\)$/);
  // A constant left by the replacement is continuous: √0 near x = 1.
  assert.match((await lim('lim x->1 sqrt(floor(x))')).answer, /does not exist$/);
});

test('review of 1.76.4: signs, exact cancellation and a remainder beside a squeezed term', async () => {
  const shown = async (p) => horizontal(await solvePlain(p, 'functions')).join(' | ').replace(/⟦|⟧/g, '');
  assert.match(await shown('-1/(2+sin(x)/x)'), /y = -0\.5 as x → ±∞/);
  // 10⁻¹³·ln(x) still grows without bound: no asymptote.
  assert.equal(await shown('ln(x+1)-ln(x+2)+0.0000000000001*ln(x+3)'), '');
  const r = await solvePlain('lim x->inf (2+exp(-x)*sin(x))', 'limits');
  assert.match(r.answer, /= 2$/);
  assert.match(steps(r), /Every other term has a limit of its own/);
  // An irrational leading coefficient: no "behaves like null" anywhere.
  const root = await solvePlain('lim x->inf sqrt(2*x)', 'limits');
  assert.match(root.answer, /= ∞$/);
  assert.doesNotMatch([...root.steps, ...root.tips].join('\n'), /null/);
});

test('a step-limit side whose exact value is not found is shown with ≈, never as a bare decimal', async () => {
  const { stepFunctionLimit } = await import('../src/lib/solvers/limits/steps.js');
  const { loadAlgebrite } = await import('../src/lib/solvers/solverUtils.js');
  const real = await loadAlgebrite();
  // Algebrite answers the derivative and the sides' difference, but not a
  // side's own value: the decimal must then carry ≈.
  const stub = { run: (s) => { if (/^simplify\(subst\(/.test(s) && !/\) - \(/.test(s)) throw new Error('no'); return real.run(s); } };
  const r = stepFunctionLimit('floor(x) + sqrt(2)', 'x', 0, { Algebrite: stub });
  assert.equal(r.same, false);
  assert.match(r.left.shown, /^≈ /);
  assert.match(r.right.shown, /^≈ /);
  // With the exact value found, it leads and the decimal follows with ≈.
  const exact = stepFunctionLimit('floor(x) + sqrt(2)', 'x', 0, { Algebrite: real });
  assert.match(exact.right.shown, /^√2 \(≈ 1\.414/);
});

test('review round 3: exponent literals, % as mod, exponents a double rounds, squeeze decimals', async () => {
  const lim = (p) => solvePlain(p, 'limits');
  // mathjs writes 0.0001 as 1e-4: a number, never the constant e.
  assert.match((await lim('lim x->0+ floor(x) + 0.0001')).answer, /= 1\/10000 \(= 0\.0001\)$/);
  assert.match((await lim('lim x->0 floor(x + 100000)')).answer, /does not exist$/);
  // x % m is mod(x, m): worked one side at a time, not substituted.
  for (const p of ['lim x->2 x%2', 'lim x->0 x % 3']) assert.match((await lim(p)).answer, /does not exist$/, p);
  assert.match((await lim('lim x->1 x%2')).answer, /= 1$/);
  // An exponent a double rounds (1 + 10⁻¹⁶ is 1) is not cancelled on: no
  // asymptote is claimed for a function that → ∞.
  // Nor when whole-ratio exponents combine into one (x·x^(1/10¹⁶)).
  for (const p of ['ln(x^(1+10^(-16))+1)-ln(x+1)', 'ln(x*x^(1/10000000000000000)+1)-ln(x+1)']) {
    assert.doesNotMatch((await solvePlain(p, 'functions')).answer, /horizontal asymptote/, p);
  }
  // Powers that do cancel exactly still give their asymptote.
  for (const p of ['ln(x^2+1)-2*ln(x+1)', 'ln(sqrt(x)+1)-ln(x+1)/2']) {
    assert.match((await solvePlain(p, 'functions')).answer, /horizontal asymptote y = 0 as x → ∞/, p);
  }
  // Whole-number powers still cancel exactly: the antiderivative's log terms
  // at ∞ in ∫₂^∞ 1/(x² − 1) dx.
  assert.match((await solvePlain('∫_2^∞ 1/(x^2-1) dx', 'integrals')).answer, /= 1\/2\*ln\(3\)/);
  // A squeeze whose rest is not a whole number is shown with ≈.
  assert.match((await lim('lim x->inf 1/3+exp(-x)*sin(x)')).answer, /≈ 0\.3333$/);
  assert.doesNotMatch((await lim('lim x->inf 1/3+exp(-x)*sin(x)')).answer, /= ≈/);
  assert.match((await lim('lim x->inf (2+exp(-x)*sin(x))')).answer, /= 2$/);
});
