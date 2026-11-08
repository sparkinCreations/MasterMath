// Two or three letters side by side are a product (1.71.0): "nx" is n·x,
// as a textbook writes it, and the answer says how the word was read. An
// English word ("box", "it") and a differential ("dx") are never split.
// Found from an r/mathematics report: "lim x->0 (sin(nx)/x)".
import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePlain } from './helpers/solvePlain.js';
import { lettersAsProduct, rewriteAsProduct } from '../src/lib/api/words.js';

const read = (r, word, product) => r.warnings?.some((w) => w.startsWith(`Read "${word}" as ${product}`));

test('which words are read as a product', () => {
  for (const [w, p] of [['nx', 'n*x'], ['ab', 'a*b'], ['kx', 'k*x'], ['axy', 'a*x*y'], ['xyz', 'x*y*z']]) {
    assert.equal(lettersAsProduct(w), p, w);
  }
  for (const w of ['box', 'tax', 'abc', 'it', 'is', 'go', 'dx', 'dy', 'hello']) {
    assert.equal(lettersAsProduct(w), null, w);
  }
  // An English pair is a product where it touches the maths, a word where
  // it stands alone.
  assert.equal(lettersAsProduct('at', 'd/dt at^2'), 'a*t');
  assert.equal(lettersAsProduct('at', 'sin(at)'), 'a*t');
  assert.equal(lettersAsProduct('be', 'be^(-x)'), 'b*e');
  assert.equal(lettersAsProduct('at', 'x^2 at x = 2'), null);
  assert.equal(rewriteAsProduct('at', 'at^2 at t = 1'), 'a*t^2 at t = 1');
});

test('letters side by side are solved as a product, and said so', async () => {
  for (const [p, answer, word, product] of [
    ['d/dx ax^2', "f'(x) = 2a*x", 'ax', 'a·x'],
    ['d/dx sin(kx)', "f'(x) = k*cos(k*x)", 'kx', 'k·x'],
    ['ax + b = 0', 'x = -b/a, for a ≠ 0', 'ax', 'a·x'],
    ['solve kx = 5', 'x = 5/k, for k ≠ 0', 'kx', 'k·x'],
    ['factor a^2 + 2ab + b^2', '(a + b)^2', 'ab', 'a·b'],
    ['integral of kx dx', '∫(k*x) dx = 1/2*k*x^2 + C', 'kx', 'k·x'],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'solved', p);
    assert.equal(r.answer, answer, p);
    assert.ok(read(r, word, product), `${p}: ${r.warnings}`);
  }
});

test('a pair that is also a word is a product where it touches the maths', async () => {
  for (const [p, answer] of [
    ['d/dt at^2', "f'(t) = 2a*t"],
    ['d/dt sin(at)', "f'(t) = a*cos(a*t)"],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
    assert.ok(read(r, 'at', 'a·t'), p);
  }
});

test('a function with a parameter is refused, not given an empty domain', async () => {
  // "y = m*x + b" was "domain: no real numbers; no x-intercepts".
  for (const [p, letter] of [['y = mx + b', 'm'], ['y = m*x + b', 'm'], ['a*x^2 + b*x + c', 'a'], ['sin(k*x)', 'k']]) {
    const r = await solvePlain(p, 'functions');
    assert.equal(r.status, 'unsupported', p);
    assert.equal(r.answer, `Analysing a function with a parameter (${letter}) is not supported yet`, p);
    assert.ok(r.tips[0].includes(`Give ${letter} a number`), p);
  }
});

test('a quadratic with letter coefficients takes the formula', async () => {
  const r = await solvePlain('x^2 + bx + c = 0', 'auto');
  assert.equal(r.status, 'solved');
  assert.match(r.answer, /√\(b\^2 - 4c\)/);
  assert.ok(read(r, 'bx', 'b·x'));
});

test('a limit with nx is refused for its parameter, not for the word', async () => {
  const r = await solvePlain('lim x->0 (sin(nx)/x)', 'auto');
  assert.equal(r.status, 'unsupported');
  assert.equal(r.answer, 'Limits with a parameter (n) are not supported yet');
  assert.ok(read(r, 'nx', 'n·x'));
});

test('a derivative at a point checks its words (was f\'(0) = 0)', async () => {
  for (const [p, answer] of [
    ['d/dx sin(kx) at x = 0', "f'(0) = k"],
    ['derivative of sin(kx) at x = 0', "f'(0) = k"],
    ['d/dx kx^2 at x = 1', "f'(1) = 2k"],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.answer, answer, p);
  }
  const w = await solvePlain('d/dx box at x = 1', 'auto');
  assert.equal(w.status, 'parse_error');
});

test('English words and differentials stay unknown words', async () => {
  for (const p of ['box + 1', 'solve it', 'go x + 1', 'x^2 dx', 'hello']) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, 'parse_error', p);
    assert.doesNotMatch(r.answer, /If you meant a product/, p);
    assert.ok(!r.warnings?.some((w) => w.startsWith('Read "')), p);
  }
});

// Paired cases (review of PR #62): the same letters as a product and as a
// word or a reserved name, each read the way it was meant.
test('pairs: a product where it touches the maths, a word or a name elsewhere', async () => {
  for (const [p, status, answer, note] of [
    ['d/dt at^2', 'solved', "f'(t) = 2a*t", true],
    ['x^2 at x = 2', 'solved', 'f(2) = 4', false],
    ['d/dx be^(-x)', 'solved', "f'(x) = -b*e^(-x)", true],
    ['as^2 + 1', 'solved', 'a*s^2 + 1', true],
    ['lim sin(x)/x as x -> 0', 'solved', 'lim (x→0) sin(x)/x = 1', false],
    // Was "does not exist" on every release before 1.71.0.
    ['lim as^2 as x -> 0', 'solved', 'lim (x→0) a*s^2 = a*s^2', true],
    ['lim x->0 as^2', 'solved', 'lim (x→0) a*s^2 = a*s^2', true],
    ['pi + 1', 'solved', 'π + 1 ≈ 4.1416', false],
    ['p*i + 1', 'solved', 'p*i + 1', false],
    ['ln(x) + 1', 'solved', 'ln(x) + 1', false],
    ['l*n + 1', 'solved', 'l*n + 1', false],
    ['d/dx x^2', 'solved', "f'(x) = 2x", false],
    ['integral of x^2 dx', 'solved', '∫(x^2) dx = 1/3*x^3 + C', false],
    ['find dy/dx if x^2 + y^2 = 25', 'solved', 'dy/dx = -x/y', false],
    ['(a+b)c', 'solved', '(a + b)*c', false],
    ['expand (a+b)c', 'solved', 'a*c + b*c', false],
  ]) {
    const r = await solvePlain(p, 'auto');
    assert.equal(r.status, status, p);
    assert.equal(r.answer, answer, p);
    assert.equal(Boolean(r.warnings?.some((w) => w.startsWith('Read "'))), note, p);
  }
  // A word before prose stays a word; "ln" alone asks for its argument.
  assert.equal((await solvePlain('be careful x^2 + 1', 'auto')).status, 'parse_error');
  assert.match((await solvePlain('ln + 1', 'auto')).answer, /^ln needs an argument/);
});

test('pairs: y = mx + b and y = m*x + b give the same refusal', async () => {
  for (const topic of ['auto', 'functions']) {
    const [a, b] = [await solvePlain('y = mx + b', topic), await solvePlain('y = m*x + b', topic)];
    assert.equal(a.status, 'unsupported', topic);
    assert.equal(a.answer, b.answer, topic);
    assert.deepEqual(a.steps, b.steps, topic);
  }
});
