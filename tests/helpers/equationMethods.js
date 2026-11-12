// Every file in src/lib/solvers/algebra/ is here: a method with seeded families
// of equations that exercise it, or an exemption with its reason. A new file
// that is neither fails tests/equationCrossCheck.test.js.
//
// A family's `make(r, n)` returns { lhs, rhs, holes?, corners?, window? },
// where n.text(k) writes the number k in that family's kind of number.
// `answered` is the share of cases that must be solved by the method and not
// by the numeric search, or the family would test nothing.

import { int, nonzero } from './crossCheck.js';

export const NUMBERS = {
  'whole numbers': { text: (n) => `${n}`, of: (n) => n },
  decimals: { text: (n) => (n / 10).toFixed(1), of: (n) => n / 10 },
  fractions: { text: (n) => `${n}/7`, of: (n) => n / 7 },
  pi: { text: (n) => `${n}*pi`, of: (n) => n * Math.PI },
  e: { text: (n) => `${n}*e`, of: (n) => n * Math.E },
  'square roots': { text: (n) => `${n}*sqrt(2)`, of: (n) => n * Math.SQRT2 },
  // A decimal beside an irrational: Algebrite floats the lot.
  'decimals with pi': { text: (n) => `${(n / 10).toFixed(1)}*pi`, of: (n) => (n / 10) * Math.PI },
};

const signed = (n, k) => (k < 0 ? `-${n.text(-k)}` : n.text(k));
const plus = (n, k) => `${k < 0 ? '-' : '+'} ${n.text(Math.abs(k))}`;
const inner = (a, n, k) => `${a}*x ${plus(n, k)}`;
const shift = (n, k) => `x ${plus(n, k)}`;

// ---------------------------------------------------------------------------
// Several absolute values: the families the review of 1.76.0 called for.

function absGeneral(r, n) {
  const terms = Array.from({ length: int(r, 2, 3) }, () => ({ k: nonzero(r, -3, 3), a: nonzero(r, -3, 3), b: int(r, -6, 6) }));
  return { lhs: terms.map((t) => `${t.k}*abs(${inner(t.a, n, t.b)})`).join(' + '), rhs: signed(n, int(r, -8, 8)), corners: terms.map((t) => -n.of(t.b) / t.a) };
}
function absStretch(r, n) {
  const p = int(r, -6, 4);
  const q = p + int(r, 1, 6);
  const at = (k) => `abs(x ${k < 0 ? '+' : '-'} ${n.text(Math.abs(k))})`;
  return { lhs: `${at(p)} + ${at(q)}`, rhs: n.text(q - p), corners: [n.of(p), n.of(q)] };
}
const WHOLE = NUMBERS['whole numbers'];
const absPiecewise = {
  marker: /Each absolute value changes form/,
  perFamily: 12,
  families: [
    ...Object.entries(NUMBERS).map(([name, n]) => ({ name, make: (r) => (r() < 0.75 ? absGeneral(r, n) : absStretch(r, n)), answered: 0.8 })),
    {
      name: 'x in a denominator',
      make: (r) => {
        const p = int(r, -4, 2);
        const q = p + int(r, 2, 6);
        const h = p + 1;
        const extra = [`1/(x - (${h}))`, `(x - (${h}))/(x - (${h}))`, `1/(x - (${h}))^2`][int(r, 0, 2)];
        return { lhs: `abs(x - (${p})) + abs(x - (${q})) + ${extra}`, rhs: `${q - p} + ${extra}`, holes: [h], corners: [p, q] };
      },
    },
    {
      name: 'a denominator that cancels at a root',
      make: (r) => {
        const h = int(r, 1, 6);
        const k = int(r, 1, 3);
        return { lhs: `abs(x) + ${k}*abs(x - 1) + (x - ${h})/(x - ${h})`, rhs: `${h + k * Math.abs(h - 1) + 1}`, holes: [h], corners: [0, 1] };
      },
      marker: null,
    },
    {
      name: 'true everywhere',
      make: (r) => {
        const a = nonzero(r, -3, 3);
        const b = int(r, -5, 5);
        const u = `${a}*x + (${b})`;
        return { lhs: `abs(${u}) + abs(${-a}*x + (${-b}))`, rhs: `2*abs(${u})`, corners: [-b / a] };
      },
      answered: 0.8,
    },
    {
      name: 'true nowhere',
      make: (r) => {
        const p = int(r, -5, 5);
        const gap = int(r, 2, 6);
        return { lhs: `abs(x - (${p})) + abs(x - (${p + gap}))`, rhs: `${gap - 1}`, corners: [p, p + gap] };
      },
      answered: 0.8,
    },
    {
      name: 'a constant that hides a 0',
      make: (r) => {
        const p = int(r, -4, 2);
        // √(3 + 2√2) − √2 is exactly 1, and Algebrite does not reduce it.
        if (r() < 0.5) return { lhs: `abs(x - (${p})) + abs(x - (${p + 2}))`, rhs: 'sqrt(3 + 2*sqrt(2)) - sqrt(2) + 1', corners: [p, p + 2] };
        return { lhs: `abs(x - (${p})) - abs(${p} - x)`, rhs: 'sqrt(3 + 2*sqrt(2)) - sqrt(2) - 1', corners: [p] };
      },
    },
    {
      name: 'a quadratic on the other side',
      make: (r) => {
        const terms = Array.from({ length: 2 }, () => ({ a: nonzero(r, -2, 2), b: int(r, -5, 5) }));
        const [c, d, q] = [int(r, -8, 8), int(r, -6, 6), nonzero(r, -2, 2)];
        return { lhs: terms.map((t) => `abs(${t.a}*x + (${t.b}))`).join(' + '), rhs: `${q}*x^2 + (${d})*x + (${c})`, corners: terms.map((t) => -t.b / t.a) };
      },
      answered: 0.8,
    },
  ],
};

// ---------------------------------------------------------------------------
// One family per kind of number from a method's own shapes, then the three
// awkward wrappers every method must survive.

function awkward(base, { answered = 0.7 } = {}) {
  const hole = (r) => {
    const e = base(r, WHOLE);
    const h = int(r, -4, 4);
    const f = r() < 0.5 ? [`1/(x - (${h}))`, `1/(x - (${h}))`] : [`(x - (${h}))/(x - (${h}))`, '1'];
    return { ...e, lhs: `${e.lhs} + ${f[0]}`, typed: e.typed && `${e.typed} + ${f[0]}`, rhs: `${e.rhs} + ${f[1]}`, holes: [...(e.holes || []), h] };
  };
  return [
    ...Object.entries(NUMBERS).map(([name, n]) => ({ name, make: (r) => base(r, n), answered: name === 'whole numbers' ? answered : 0 })),
    { name: 'x in a denominator', make: hole },
    { name: 'true everywhere', make: (r) => { const e = base(r, WHOLE); return { ...e, rhs: e.lhs, typedRhs: e.typed ?? e.lhs }; } },
    { name: 'true nowhere', make: (r) => { const e = base(r, WHOLE); return { ...e, rhs: `${e.lhs} + 1`, typedRhs: `${e.typed ?? e.lhs} + 1` }; } },
  ];
}
const oneOf = (r, list) => list[int(r, 0, list.length - 1)];

const absCases = (r, n) => oneOf(r, [
  () => { const [a, b] = [nonzero(r, -3, 3), nonzero(r, -6, 6)]; const c = int(r, -6, 8); return { lhs: `${nonzero(r, 1, 3)}*abs(${inner(a, n, b)})`, rhs: signed(n, c), corners: [-n.of(b) / a] }; },
  () => { const [a, b] = [nonzero(r, -3, 3), nonzero(r, -6, 6)]; return { lhs: `abs(${inner(a, n, b)})`, rhs: `${nonzero(r, -2, 2)}*x ${plus(n, nonzero(r, -6, 6))}`, corners: [-n.of(b) / a] }; },
])();
const oneRadical = (r, n) => oneOf(r, [
  () => ({ lhs: `sqrt(${inner(nonzero(r, 1, 3), n, nonzero(r, -6, 6))})`, rhs: signed(n, int(r, -2, 6)) }),
  () => ({ lhs: `sqrt(${shift(n, nonzero(r, -6, 6))})`, rhs: `x ${plus(n, nonzero(r, -5, 5))}` }),
])();
const fractionalPower = (r, n) => oneOf(r, [
  () => ({ lhs: `cbrt(x)^2`, typed: 'x^(2/3)', rhs: n.text(int(r, 1, 9)) }),
  () => ({ lhs: 'cbrt(x)', typed: 'x^(1/3)', rhs: signed(n, nonzero(r, -5, 5)) }),
  () => ({ lhs: 'x^(3/2)', rhs: n.text(int(r, 1, 9)) }),
])();
const singleExponential = (r, n) => oneOf(r, [
  () => ({ lhs: `${nonzero(r, 1, 4)}*2^(${inner(nonzero(r, -2, 2), WHOLE, nonzero(r, -3, 3))}) ${plus(n, nonzero(r, -5, 5))}`, rhs: signed(n, int(r, -4, 9)) }),
  () => ({ lhs: `e^(${nonzero(r, -2, 2)}*x)`, rhs: signed(n, nonzero(r, -2, 9)) }),
])();
const expSubstitution = (r, n) => ({ lhs: `e^(2*x) ${plus(n, nonzero(r, -6, 6))}*e^x ${plus(n, nonzero(r, -8, 8))}`, rhs: '0' });
const logSubstitution = (r, n) => oneOf(r, [
  () => ({ lhs: `ln(x)^2 ${plus(n, nonzero(r, -5, 5))}*ln(x) ${plus(n, nonzero(r, -6, 6))}`, rhs: '0', window: 30 }),
  () => ({ lhs: `ln(x) + ln(${shift(WHOLE, nonzero(r, -4, 4))})`, rhs: signed(n, nonzero(r, -2, 3)), window: 30 }),
])();
const twoBases = (r, n) => oneOf(r, [
  () => ({ lhs: `4^(x ${plus(WHOLE, nonzero(r, -3, 3))})`, rhs: `8^(x ${plus(n, nonzero(r, -3, 3))})`, window: 12 }),
  () => ({ lhs: '2^x', rhs: `3^(x ${plus(n, nonzero(r, -3, 3))})`, window: 12 }),
  () => ({ lhs: `9^x ${plus(n, nonzero(r, -5, 5))}*3^x ${plus(n, nonzero(r, -6, 6))}`, rhs: '0', window: 12 }),
])();
const polynomialEq = (r, n) => oneOf(r, [
  () => ({ lhs: `(x ${plus(WHOLE, nonzero(r, -5, 5))})*(x ${plus(n, nonzero(r, -5, 5))})*(x ${plus(WHOLE, nonzero(r, -5, 5))})`, rhs: '0' }),
  () => ({ lhs: `x^2 ${plus(n, nonzero(r, -6, 6))}*x ${plus(n, nonzero(r, -8, 8))}`, rhs: '0' }),
  () => ({ lhs: `x^3 ${plus(n, nonzero(r, -6, 6))}*x ${plus(n, nonzero(r, -8, 8))}`, rhs: '0' }),
])();
const powerSubstitution = (r, n) => oneOf(r, [
  () => { const [p, q] = [nonzero(r, -5, 5), nonzero(r, -6, 6)]; return { lhs: `cbrt(x)^2 ${plus(n, p)}*cbrt(x) ${plus(n, q)}`, typed: `x^(2/3) ${plus(n, p)}*x^(1/3) ${plus(n, q)}`, rhs: '0' }; },
  () => ({ lhs: `x^(-2) ${plus(n, nonzero(r, -3, 3))}*x^(-1) ${plus(n, nonzero(r, -3, 3))}`, rhs: '0', holes: [0] }),
  () => { const b = nonzero(r, -3, 3); return { lhs: `(x^2 ${plus(n, b)})^2 ${plus(n, nonzero(r, -5, 5))}*(x^2 ${plus(n, b)}) ${plus(n, nonzero(r, -6, 6))}`, rhs: '0' }; },
])();
const twoRadicals = (r, n) => ({ lhs: `sqrt(${shift(n, nonzero(r, -6, 6))}) ${r() < 0.5 ? '+' : '-'} sqrt(${shift(n, nonzero(r, -6, 6))})`, rhs: signed(n, int(r, 1, 6)) });
const zeroProduct = (r, n) => oneOf(r, [
  () => ({ lhs: `(x ${plus(n, nonzero(r, -5, 5))})*sqrt(${shift(n, nonzero(r, -5, 5))})`, rhs: '0', window: 12 }),
  () => ({ lhs: `(x ${plus(n, nonzero(r, -5, 5))})*e^(x)`, rhs: '0', window: 12 }),
  () => ({ lhs: `(x ${plus(n, nonzero(r, -5, 5))})*ln(${shift(n, nonzero(r, -5, 5))})`, rhs: '0', window: 12 }),
])();
const numericSearch = (r, n) => oneOf(r, [
  () => ({ lhs: 'x + e^x', rhs: signed(n, nonzero(r, -5, 9)), window: 12 }),
  () => ({ lhs: 'x^3 + e^x', rhs: signed(n, nonzero(r, -5, 9)), window: 12 }),
  () => ({ lhs: 'x*ln(x)', rhs: signed(n, nonzero(r, -2, 9)), window: 20 }),
  // Two roots, one on each side of 0, so a list cut short is seen.
  () => ({ lhs: 'e^x', rhs: `x ${plus(n, int(r, 2, 6))}`, window: 12 }),
  () => ({ lhs: 'e^x', rhs: `x ${plus(n, int(r, 2, 6))}`, window: 12 }),
])();

// Roots in a + b√n: an exact square root in the field, and a repeated root.
const RADICANDS = [2, 3, 5];
const surdSquare = (r) => {
  const [p, q, n] = [nonzero(r, -4, 4), nonzero(r, -3, 3), RADICANDS[int(r, 0, 2)]];
  const constant = p * p + q * q * n;
  return { lhs: 'x^2', rhs: `${constant} ${2 * p * q < 0 ? '-' : '+'} ${Math.abs(2 * p * q)}*sqrt(${n})` };
};
const surdRepeated = (r) => {
  const [q, n, k] = [int(r, 1, 3), RADICANDS[int(r, 0, 2)], int(r, 4, 9)];
  const a = `(${q}*sqrt(${n}))`;
  return { lhs: `x^3 - (${a} + ${a} + ${k})*x^2 + (${a}*${a} + ${a}*${k} + ${k}*${a})*x - ${a}*${a}*${k}`, rhs: '0' };
};
const surdAnything = (r) => ({ lhs: 'x^2', rhs: `${int(r, 1, 9)} + ${int(r, 1, 3)}*sqrt(${RADICANDS[int(r, 0, 2)]})` });

export const METHODS = {
  'absPiecewise.js': absPiecewise,
  'specialForms.js': { perFamily: 4, families: [
    ...awkward(absCases).map((f) => ({ ...f, name: `one absolute value: ${f.name}` })),
    ...awkward(oneRadical).map((f) => ({ ...f, name: `one square root: ${f.name}` })),
  ] },
  'expLog.js': { perFamily: 4, families: [
    ...awkward(fractionalPower).map((f) => ({ ...f, name: `a fractional power: ${f.name}` })),
    ...awkward(singleExponential).map((f) => ({ ...f, name: `one exponential: ${f.name}` })),
    ...awkward(expSubstitution).map((f) => ({ ...f, name: `u = e^x: ${f.name}` })),
    ...awkward(logSubstitution).map((f) => ({ ...f, name: `logarithms: ${f.name}` })),
  ] },
  'exponentialBases.js': { perFamily: 4, families: awkward(twoBases) },
  'polynomial.js': { perFamily: 4, families: awkward(polynomialEq) },
  'surdRoots.js': { perFamily: 8, marker: /a \+ b√/, families: [
    { name: 'an exact square root in the field', make: surdSquare, answered: 0.7 },
    // Algebrite usually writes these well, so this checks the value; the exact
    // form is pinned in tests/equationFindings.test.js.
    { name: 'a repeated root', make: surdRepeated },
    { name: 'any nested root', make: surdAnything },
  ] },
  'powerSubstitution.js': { perFamily: 4, families: awkward(powerSubstitution) },
  'twoRadicals.js': { perFamily: 4, families: awkward(twoRadicals) },
  'zeroProduct.js': { perFamily: 4, families: awkward(zeroProduct) },
  'numeric.js': { perFamily: 4, marker: /found numerically|crosses zero/, families: awkward(numericSearch, { answered: 0.5 }) },
};

// An exemption names the tests that do cover the file. Each was checked by
// planting a bug in the file and seeing them fail.
export const EXEMPT = {
  'guidance.js': { why: 'tips and mistakes only: it solves nothing', tests: ['tests/tipsByMethod.test.js'] },
  'rootsFormat.js': { why: 'reads and formats root lists for the methods above', tests: ['tests/insights.test.js', 'tests/practice.test.js'] },
  'radicals.js': { why: 'radical form and the quadratic derivation shown in steps', tests: ['tests/reviewTwo.test.js'] },
  'expressions.js': { why: 'simplify, expand and factor: no equation to compare against a scan', tests: ['tests/regressions.test.js', 'tests/constantsSweep2.test.js'] },
  'twoVariables.js': { why: 'answers are expressions in another letter, which a grid in x cannot check', tests: ['tests/variableChoice.test.js', 'tests/tidyRelations.test.js'] },
  'undoOuter.js': { why: 'answers carry letter constants, which a grid in x cannot check', tests: ['tests/constantsSweep.test.js', 'tests/constantsSweep2.test.js'] },
};

// The files of a folder listing that are neither registered nor exempt. Copies
// a file manager leaves behind ("name 2.js") are not modules.
export const unregistered = (files) => files.filter((f) => /^[\w-]+\.js$/.test(f) && !METHODS[f] && !EXEMPT[f]);
