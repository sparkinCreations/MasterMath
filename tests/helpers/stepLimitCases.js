// Limits that must stay SOLVED, with their answers (1.76.4). A refusal here
// is a failure: "not wrong" is not enough for a textbook case. The golden
// recorder (tests/golden/record.mjs) includes these and the generated
// cross-check family, so a later comparison against main sees them too.
//
// Each entry: [problem, answer ending] — the answer must end with it.
export const MUST_SOLVE = [
  // Step functions at a jump, beside one, and from one side.
  ['lim x->0 floor(x)', 'does not exist'],
  ['lim x->0+ floor(x)', '= 0'],
  ['lim x->0- floor(x)', '= -1'],
  ['lim x->0.5 floor(x)', '= 0'],
  ['lim x->2 ceil(x)', 'does not exist'],
  ['lim x->2+ ceil(x)', '= 3'],
  ['lim x->2- ceil(x)', '= 2'],
  ['lim x->0.5 round(x)', 'does not exist'],
  ['lim x->0.3 round(x)', '= 0'],
  ['lim x->-2.5 round(x)', 'does not exist'],
  ['lim x->0 sign(x)', 'does not exist'],
  ['lim x->0 sign(x)^2', '= 1'],
  ['lim x->1 sign(x)', '= 1'],
  ['lim x->3 mod(x,3)', 'does not exist'],
  ['lim x->3- mod(x,3)', '= 3'],
  ['lim x->1 x%2', '= 1'],
  ['lim x->2 x%2', 'does not exist'],
  // At a point given by a constant, or a fraction.
  ['lim x->pi floor(x)', '= 3'],
  ['lim x->e floor(x)', '= 2'],
  ['lim x->pi/2 floor(x)', '= 1'],
  ['lim x->sqrt(2) floor(x^2)', 'does not exist'],
  ['lim x->pi floor(x/pi)', 'does not exist'],
  ['lim x->1/3 floor(3*x)', 'does not exist'],
  ['lim x->0.1 floor(10*x)', 'does not exist'],
  // Around a step function.
  ['lim x->0+ floor(x)+sqrt(2)', '= √2 (≈ 1.4142)'],
  ['lim x->0+ sqrt(floor(x))', '= 0'],
  ['lim x->1 floor(x)+x', 'does not exist'],
  ['lim x->0 x*floor(x)', '= 0'],
  // At ±∞: proved, not sampled.
  ['lim x->inf x+sin(x)', '= ∞'],
  ['lim x->-inf x+cos(2*x)', '= -∞'],
  ['lim x->inf e^(-x)*sin(x)', '= 0'],
  ['lim x->inf 2+exp(-x)*sin(x)', '= 2'],
  ['lim x->inf sin(x)/x', '= 0'],
  ['lim x->inf x^2/(x^2+1)', '= 1'],
  ['lim x->inf (3*x^2+1)/(x^2-5)', '= 3'],
  ['lim x->inf sqrt(x^2+x)-x', '= 1/2 (= 0.5)'],
  ['lim x->inf tan(x)', 'does not exist'],
  ['lim x->inf sin(x)', 'does not exist'],
];

// A seeded family of step-function limits for the cross-check: S(a·x + b)
// combined with c·x + d, at points on and off the jumps. Every case is
// piecewise linear with small rational coefficients, so one-sided samples a
// little either side of the point are an exact oracle (in tests only).
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

export function stepCrossCases(seed = 20261118, count = 120) {
  const r = rng(seed);
  const out = [];
  const slopes = ['1', '2', '3', '-1', '-2', '1/2'];
  const points = ['0', '1', '-1', '2', '1/2', '-1/2', '1/3', '3/4', '0.25', '1.5', '-2.5', '0.1'];
  while (out.length < count) {
    const fn = pick(r, ['floor', 'ceil', 'round', 'sign', 'mod']);
    const a = pick(r, slopes);
    const b = pick(r, ['0', '1', '-1', '1/2', '1/4', '3']);
    const inner = b === '0' ? `${a}*x` : `${a}*x${b.startsWith('-') ? '' : '+'}${b}`;
    const step = fn === 'mod' ? `mod(${inner}, ${pick(r, ['1', '2', '3', '1/2'])})` : `${fn}(${inner})`;
    const shape = pick(r, ['s', 's+x', 's*2+1', 'x*s']);
    const f = { s: step, 's+x': `${step}+x`, 's*2+1': `2*${step}+1`, 'x*s': `x*${step}` }[shape];
    const side = pick(r, ['', '', '+', '-']);
    const p = pick(r, points);
    out.push({ problem: `lim x->${p}${side} ${f}`, f, point: p, side });
  }
  return out;
}
