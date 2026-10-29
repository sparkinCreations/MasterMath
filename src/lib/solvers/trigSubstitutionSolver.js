// Trigonometric substitution for ∫ c·√(A − B·x²) dx (A, B > 0):
//   b·x = a·sin θ with a = √A, b = √B, −π/2 ≤ θ ≤ π/2, so
//   dx = (a/b)·cos θ dθ and √(A − B·x²) = a·cos θ (cos θ ≥ 0 there);
//   ∫ c·a cos θ·(a/b) cos θ dθ = c·(A/b)·∫cos²θ dθ = c·(A/(2b))·(θ + sin θ cos θ),
//   and back in x: c·(A/(2b))·arcsin(b·x/a) + c·(x/2)·√(A − B·x²).
// Algebrite integrates these on its own, but hands back
// 1/2·x·(−x²+1)^(1/2) labelled "u-substitution" with no working; this
// module shows the substitution a textbook shows and writes the root as a
// root. The caller differentiates the result back before trusting it.
//
// The general family, c·x^m·R^(k/2) with R = x² + a², x² − a² or a² − x²
// (a whole, k odd), by the three textbook substitutions:
//   x² + a²: x = a·tan θ, dx = a·sec²θ dθ, √R = a·sec θ
//   x² − a²: x = a·sec θ, dx = a·sec θ·tan θ dθ, √R = a·tan θ  (x > a)
//   a² − x²: x = a·sin θ, dx = a·cos θ dθ, √R = a·cos θ
// The θ-integral is a product of trig powers: the trig-power solver or
// Algebrite integrates it, the result is differentiated back in θ, and the
// right triangle turns it back into x (1/(x²√(x² + 9)) was answered in one
// line, "integrate in θ and convert back", October 2026 review).
import { beautify, gcd, mark, math, runAlgebrite, lnify, absBars } from './solverUtils.js';
import { derivativeMatchesNumerically } from './substitutionSolver.js';
import { integrateTrigPower } from './trigPowerSolver.js';

const NUM = '(\\d+(?:\\.\\d+)?)';

function readRadicand(inner, v) {
  const s = inner.replace(/\s+/g, '');
  // A − B·x²  |  A − x²  |  −B·x² + A  |  −x² + A
  let m = s.match(new RegExp(`^${NUM}-(?:${NUM}\\*?)?${v}\\^2$`));
  if (m) return { A: Number(m[1]), B: m[2] === undefined ? 1 : Number(m[2]) };
  m = s.match(new RegExp(`^-(?:${NUM}\\*?)?${v}\\^2\\+${NUM}$`));
  if (m) return { A: Number(m[2]), B: m[1] === undefined ? 1 : Number(m[1]) };
  return null;
}

const isSquare = (n) => Number.isInteger(n) && Number.isInteger(Math.sqrt(n));
const rootText = (n) => (isSquare(n) ? String(Math.sqrt(n)) : `√${n}`);
const rootExpr = (n) => (isSquare(n) ? String(Math.sqrt(n)) : `sqrt(${n})`);
const frac = (p, q) => {
  if (Number.isInteger(p) && Number.isInteger(q)) {
    const g = gcd(Math.abs(p), Math.abs(q)) || 1;
    const [n, d] = [p / g, q / g];
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  return `${p}/${q}`;
};

export function integrateByTrigSubstitution(term, variable) {
  const v = variable;
  const t = String(term).trim();
  const m = t.match(new RegExp(`^(-)?(?:${NUM}\\s*\\*\\s*)?(?:sqrt\\(([^()]+)\\)|\\(([^()]+)\\)\\^\\(1/2\\))$`));
  if (!m) return null;
  const rad = readRadicand(m[3] ?? m[4], v);
  if (!rad || !(rad.A > 0) || !(rad.B > 0)) return null;
  const { A, B } = rad;
  const sign = m[1] ? -1 : 1;
  const c = sign * (m[2] === undefined ? 1 : Number(m[2]));
  const a = rootText(A);
  const b = rootText(B);
  const radical = `√(${beautify(`${A} - ${B === 1 ? '' : `${B}*`}${v}^2`)})`;
  const bx = B === 1 ? v : `${b}${v}`;
  const sub = B === 1 ? `${v} = ${a === '1' ? '' : `${a}·`}sin θ` : `${v} = (${a}/${b})·sin θ`;
  const dx = B === 1 ? `d${v} = ${a === '1' ? '' : `${a}·`}cos θ dθ` : `d${v} = (${a}/${b})·cos θ dθ`;
  const cText = c === 1 ? '' : c === -1 ? '−' : `${c}·`;
  // Coefficient of ∫cos²θ dθ: c·A/b, and of the final arcsin: c·A/(2b).
  const coef = isSquare(B) ? frac(c * A, Math.sqrt(B)) : `${c === 1 ? '' : `${c}·`}${A}/${b}`;
  const half = isSquare(B) ? frac(c * A, 2 * Math.sqrt(B)) : `${c === 1 ? '' : `${c}·`}${A}/(2${b})`;
  const xHalf = c === 1 ? `${v}/2` : c === -1 ? `−${v}/2` : `${frac(c, 2)}·${v}`;
  const asinArg = B === 1 ? (a === '1' ? v : `${v}/${a}`) : `${bx}/${a}`;
  const steps = [
    `The integrand has the form ${mark(`√(a² − ${B === 1 ? '' : 'b²'}${v}²)`)} with ${mark(`a = ${a}`)}${B === 1 ? '' : ` and ${mark(`b = ${b}`)}`}: substitute ${mark(sub)} (${mark('−π/2 ≤ θ ≤ π/2')}), so ${mark(dx)} and ${mark(`${radical} = √(${A} − ${A === 1 ? '' : `${A}·`}sin²θ) = ${a === '1' ? '' : `${a}·`}cos θ`)} (${mark('cos θ ≥ 0')} on that range).`,
    `Substitute: ${mark(`∫${cText}${radical} d${v} = ∫${cText}${a === '1' ? '' : `${a}·`}cos θ · ${B === 1 ? (a === '1' ? '' : `${a}·`) : `(${a}/${b})·`}cos θ dθ = ${coef === '1' ? '' : `${coef}·`}∫cos²θ dθ`)}.`,
    `Half-angle identity ${mark('cos²θ = (1 + cos 2θ)/2')}: ${mark('∫cos²θ dθ = θ/2 + sin(2θ)/4 = (θ + sin θ·cos θ)/2')}.`,
    `Back to ${mark(v)}: ${mark(`sin θ = ${asinArg}`)}, so ${mark(`θ = arcsin(${asinArg})`)}; from the right triangle (opposite ${mark(bx)}, hypotenuse ${mark(a)}) ${mark(`cos θ = ${radical}${a === '1' ? '' : `/${a}`}`)}, so ${mark(`sin θ·cos θ = ${bx}·${radical}${A === 1 ? '' : `/${A}`}`)}.`,
    `So ${mark(`∫${cText}${radical} d${v} = ${half === '1' ? '' : `${half}·`}arcsin(${asinArg}) + ${xHalf}·${radical}`)}.`,
  ];
  const antiderivative = `${half === '1' ? '' : `${half}*`}arcsin(${B === 1 ? (a === '1' ? v : `${v}/${rootExpr(A)}`) : `${rootExpr(B)}*${v}/${rootExpr(A)}`}) + ${frac(c, 2)}*${v}*sqrt(${A} - ${B === 1 ? '' : `${B}*`}${v}^2)`;
  return { antiderivative, steps };
}

// The factors of a product/quotient: { c, m (power of v), radicand, q (its
// power) }, or null for anything that is not c·v^m·R^q.
function readPowerProduct(node, v) {
  const acc = { c: 1, m: 0, radicand: null, q: 0 };
  const constant = (n) => {
    try {
      if (n.filter((x) => x.type === 'SymbolNode' && x.name !== 'pi').length) return null;
      const val = n.evaluate();
      return typeof val === 'number' && Number.isFinite(val) ? val : null;
    } catch { return null; }
  };
  const addRadicand = (base, power) => {
    const text = base.toString().replace(/\s+/g, '');
    if (acc.radicand !== null && acc.radicand !== text) return false;
    acc.radicand = text;
    acc.q += power;
    return true;
  };
  const walk = (n, sign) => {
    if (n.type === 'ParenthesisNode') return walk(n.content, sign);
    if (n.type === 'OperatorNode' && n.fn === 'unaryMinus') { acc.c = -acc.c; return walk(n.args[0], sign); }
    if (n.type === 'OperatorNode' && n.op === '*') return n.args.every((a) => walk(a, sign));
    if (n.type === 'OperatorNode' && n.op === '/') return walk(n.args[0], sign) && walk(n.args[1], -sign);
    const k = constant(n);
    if (k !== null) { if (k === 0) return false; acc.c *= sign > 0 ? k : 1 / k; return true; }
    if (n.type === 'SymbolNode' && n.name === v) { acc.m += sign; return true; }
    if (n.type === 'FunctionNode' && n.fn.name === 'sqrt' && n.args.length === 1) return addRadicand(n.args[0], sign / 2);
    if (n.type === 'OperatorNode' && n.op === '^') {
      const e = constant(n.args[1]);
      if (e === null) return false;
      let base = n.args[0];
      while (base.type === 'ParenthesisNode') base = base.content;
      if (base.type === 'SymbolNode' && base.name === v) {
        if (!Number.isInteger(e)) return false;
        acc.m += sign * e;
        return true;
      }
      if (base.type === 'FunctionNode' && base.fn.name === 'sqrt' && base.args.length === 1) return addRadicand(base.args[0], (sign * e) / 2);
      return addRadicand(base, sign * e);
    }
    return false;
  };
  return walk(node, 1) ? acc : null;
}

// x² + a², x² − a², a² − x² with a² a perfect square: { kind, a, a2 }.
function readTriangleRadicand(text, v) {
  const s = String(text).replace(/\s+/g, '');
  const sq = (n) => (Number.isInteger(Math.sqrt(n)) && n > 0 ? Math.sqrt(n) : null);
  let m = s.match(new RegExp(`^${v}\\^2([+-])(\\d+)$`)) || s.match(new RegExp(`^(\\d+)(\\+)${v}\\^2$`));
  if (m) {
    const a2 = Number(m[1] === '+' || m[1] === '-' ? m[2] : m[1]);
    const sign = m[1] === '+' || m[1] === '-' ? m[1] : m[2];
    const a = sq(a2);
    return a ? { kind: sign === '+' ? 'tan' : 'sec', a, a2 } : null;
  }
  m = s.match(new RegExp(`^(\\d+)-${v}\\^2$`)) || s.match(new RegExp(`^-${v}\\^2\\+(\\d+)$`));
  if (m) {
    const a = sq(Number(m[1]));
    return a ? { kind: 'sin', a, a2: Number(m[1]) } : null;
  }
  return null;
}

const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
const fnPow = (fn, p) => (p === 1 ? `${fn} θ` : SUP[p] ? `${fn}${SUP[p]}θ` : `${fn}^${p} θ`);
// [[fn, power], …] as a fraction of positive powers: sec θ/tan²θ.
function trigFraction(parts) {
  const top = parts.filter(([, p]) => p > 0).map(([fn, p]) => fnPow(fn, p));
  const bottom = parts.filter(([, p]) => p < 0).map(([fn, p]) => fnPow(fn, -p));
  const num = top.length ? top.join('·') : '1';
  if (!bottom.length) return num;
  return `${num}/${bottom.length > 1 ? `(${bottom.join('·')})` : bottom[0]}`;
}
const RECIPROCAL = { sin: 'csc', cos: 'sec', tan: 'cot', sec: 'cos', csc: 'sin', cot: 'tan' };
// The same product with every power positive (tan⁻² → cot²), for the
// trig-power solver, in the variable w.
function positivePowers(parts, w) {
  return parts.filter(([, p]) => p !== 0)
    .map(([fn, p]) => (p > 0 ? `${fn}(${w})^${p}` : `${RECIPROCAL[fn]}(${w})^${-p}`))
    .join('*');
}

const THETA_TABLE = {
  [`sec`]: (w) => `log(sec(${w})+tan(${w}))`,
  [`csc`]: (w) => `log(csc(${w})-cot(${w}))`,
};

// ∫ of a trig product in w: the trig-power solver, a table entry, or
// Algebrite on the sine-cosine form; whichever differentiates back.
function integrateInTheta(parts, sinCos, w, Algebrite) {
  const native = parts.filter(([, p]) => p !== 0);
  const integrand = positivePowers(native, w) || '1';
  const candidates = [];
  if (native.length === 1 && native[0][1] === 1 && THETA_TABLE[native[0][0]]) candidates.push(THETA_TABLE[native[0][0]](w));
  if (native.length === 1 && native[0][1] === -1 && THETA_TABLE[RECIPROCAL[native[0][0]]]) candidates.push(THETA_TABLE[RECIPROCAL[native[0][0]]](w));
  const viaPower = integrateTrigPower(integrand, w, Algebrite);
  if (viaPower) candidates.push(viaPower.antiderivative);
  // native: integrated as the product of tan/sec (or sin/cos) powers it is;
  // otherwise in sines and cosines, which the steps then show.
  const tries = [...candidates.map((F) => ({ F, native: true })), { F: runAlgebrite(Algebrite, `integral(${sinCos},${w})`), native: false }];
  for (const t of tries) {
    if (t.F && !/integral/.test(t.F) && derivativeMatchesNumerically(t.F, sinCos, w)) return t;
  }
  return null;
}

// K as an exact number: 1/9, not 0.1111.
function exactNumber(K) {
  if (Number.isInteger(K)) return String(K);
  for (let q = 2; q <= 100000; q += 1) {
    const p = Math.round(K * q);
    if (Math.abs(p / q - K) < 1e-12) return `${p}/${q}`;
  }
  return String(K);
}

export function integrateByTriangleSubstitution(term, variable, Algebrite) {
  if (!Algebrite) return null;
  const v = variable;
  let read;
  try { read = readPowerProduct(math.parse(String(term)), v); } catch { return null; }
  if (!read || read.radicand === null) return null;
  const { c, m } = read;
  const k = Math.round(read.q * 2); // R^(k/2), k odd
  if (Math.abs(read.q * 2 - k) > 1e-12 || k % 2 === 0 || Math.abs(k) > 5 || !Number.isInteger(m) || Math.abs(m) > 4) return null;
  const tri = readTriangleRadicand(read.radicand, v);
  if (!tri) return null;
  const { kind, a, a2 } = tri;
  const w = v === 'w' ? 'u' : 'w';
  // The θ-integrand K·Π fn^p and the same in sines and cosines.
  const K = c * a ** (m + k + 1);
  const parts = kind === 'tan' ? [['tan', m], ['sec', k + 2]]
    : kind === 'sec' ? [['sec', m + 1], ['tan', k + 1]]
      : [['sin', m], ['cos', k + 1]];
  const sinP = kind === 'tan' ? m : kind === 'sec' ? k + 1 : m;
  const cosP = kind === 'tan' ? -(m + k + 2) : kind === 'sec' ? -(m + k + 2) : k + 1;
  const sinCos = `sin(${w})^(${sinP})*cos(${w})^(${cosP})`;
  const theta = integrateInTheta(parts, sinCos, w, Algebrite);
  if (!theta) return null;
  const F = theta.F;

  // Back to x with the right triangle.
  const R = kind === 'tan' ? `(${v}^2+${a2})` : kind === 'sec' ? `(${v}^2-${a2})` : `(${a2}-${v}^2)`;
  const side = `sqrt${R}`;
  // x² − a²: the substitution covers x > a. θ is written arctan(√R/a), not
  // arcsec(x/a): the same angle there, even in x, so it holds for x < −a as
  // well, and Algebrite can differentiate it back (it cannot take abs).
  const X = v;
  const tri6 = kind === 'tan'
    ? { sin: `${v}/${side}`, cos: `${a}/${side}`, tan: `${v}/${a}`, sec: `${side}/${a}`, csc: `${side}/${v}`, cot: `${a}/${v}`, theta: `arctan(${v}/${a})` }
    : kind === 'sec'
      ? { sin: `${side}/${X}`, cos: `${a}/${X}`, tan: `${side}/${a}`, sec: `${X}/${a}`, csc: `${X}/${side}`, cot: `${a}/${side}`, theta: `arctan(${side}/${a})` }
      : { sin: `${v}/${a}`, cos: `${side}/${a}`, tan: `${v}/${side}`, sec: `${a}/${side}`, csc: `${a}/${v}`, cot: `${side}/${v}`, theta: `arcsin(${v}/${a})` };
  // sin(2w), cos(2w) from the half-angle results: double-angle first.
  let inX = String(F)
    .replace(new RegExp(`sin\\(2\\*?${w}\\)`, 'g'), `(2*sin(${w})*cos(${w}))`)
    .replace(new RegExp(`cos\\(2\\*?${w}\\)`, 'g'), `(cos(${w})^2-sin(${w})^2)`);
  if (new RegExp(`\\(\\d+\\*?${w}|${w}\\*\\d`).test(inX.replace(new RegExp(`\\(${w}\\)`, 'g'), ''))) return null; // another multiple angle
  // ln|sec θ + tan θ| = ln|x + √R| − ln a: the constant joins C.
  const secLog = new RegExp(`log\\(sec\\(${w}\\)\\+tan\\(${w}\\)\\)`, 'g');
  const dropsLnA = (kind === 'tan' || kind === 'sec') && secLog.test(inX) && a !== 1;
  inX = inX.replace(secLog, `log(${v}+${side})`);
  for (const fn of ['sin', 'cos', 'tan', 'sec', 'csc', 'cot']) inX = inX.replace(new RegExp(`(?<![a-z])${fn}\\(${w}\\)`, 'g'), `(${tri6[fn]})`);
  inX = inX.replace(new RegExp(`(?<![a-z])${w}(?![a-z])`, 'g'), `(${tri6.theta})`);
  const scaled = `(${exactNumber(K)})*(${inX})`;
  const simplified = runAlgebrite(Algebrite, `simplify(${scaled})`) || scaled;
  const antiderivative = derivativeMatchesNumerically(simplified, term, v) ? simplified : scaled;
  if (!derivativeMatchesNumerically(antiderivative, term, v)) return null;

  const Kt = K === 1 ? '' : K === -1 ? '−' : `${exactNumber(K).replace('-', '−')}·`;
  const Rshown = kind === 'tan' ? `${v}² + ${a2}` : kind === 'sec' ? `${v}² − ${a2}` : `${a2} − ${v}²`;
  const aT = a === 1 ? '' : `${a}`;
  const subs = kind === 'tan' ? `${v} = ${aT}tan θ` : kind === 'sec' ? `${v} = ${aT}sec θ` : `${v} = ${aT}sin θ`;
  const dx = kind === 'tan' ? `d${v} = ${aT}sec²θ dθ` : kind === 'sec' ? `d${v} = ${aT}sec θ·tan θ dθ` : `d${v} = ${aT}cos θ dθ`;
  const a2T = a2 === 1 ? '' : `${a2}`;
  const root = kind === 'tan' ? `√(${Rshown}) = √(${a2T}tan²θ + ${a2}) = ${aT}sec θ` : kind === 'sec' ? `√(${Rshown}) = √(${a2T}sec²θ − ${a2}) = ${aT}tan θ` : `√(${Rshown}) = √(${a2} − ${a2T}sin²θ) = ${aT}cos θ`;
  const range = kind === 'tan' ? '−π/2 < θ < π/2' : kind === 'sec' ? `0 ≤ θ < π/2` : '−π/2 ≤ θ ≤ π/2';
  const identity = kind === 'tan' ? '1 + tan²θ = sec²θ' : kind === 'sec' ? 'sec²θ − 1 = tan²θ' : '1 − sin²θ = cos²θ';
  const form = kind === 'tan' ? `√(${v}² + a²)` : kind === 'sec' ? `√(${v}² − a²)` : `√(a² − ${v}²)`;
  const shownTerm = lnify(term);
  const thetaIntegrand = trigFraction(parts.filter(([, p]) => p !== 0));
  const sinCosShown = trigFraction([['sin', sinP], ['cos', cosP]].filter(([, p]) => p !== 0));
  const Fshown = lnify(F).replace(new RegExp(`(?<![a-z])${w}(?![a-z])`, 'g'), 'θ').replace(/(sin|cos|tan|sec|csc|cot)\(θ\)/g, '$1 θ');
  const used = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].filter((fn) => new RegExp(`(?<![a-z])${fn}\\(${w}\\)|${fn}\\(2\\*?${w}\\)`).test(F) || (fn === 'sin' || fn === 'cos') && new RegExp(`(?:sin|cos)\\(2\\*?${w}\\)`).test(F));
  const triangle = kind === 'tan' ? `opposite ${v}, adjacent ${a}, hypotenuse √(${Rshown})`
    : kind === 'sec' ? `hypotenuse ${v}, adjacent ${a}, opposite √(${Rshown})`
      : `opposite ${v}, hypotenuse ${a}, adjacent √(${Rshown})`;
  const overA = a === 1 ? v : `${v}/${a}`;
  const ratio = kind === 'tan' ? `tan θ = ${overA}` : kind === 'sec' ? `sec θ = ${overA}` : `sin θ = ${overA}`;
  const shownBack = (fn) => beautify(tri6[fn]).replace(/sqrt\(([^()]+)\)/g, '√($1)').replace(/\^2/g, '²');
  const steps = [
    `The integrand contains ${mark(form)} with ${mark(`a = ${a}`)}: substitute ${mark(subs)} (${mark(range)}), so ${mark(dx)} and, by ${mark(identity)}, ${mark(root)}.`,
    `Substitute: ${mark(`∫${shownTerm} d${v} = ${Kt}∫${thetaIntegrand} dθ`)}${!theta.native && sinCosShown !== thetaIntegrand ? `, and in sines and cosines ${mark(`${thetaIntegrand} = ${sinCosShown}`)}` : ''}.`,
    `Integrate in ${mark('θ')}: ${mark(`∫${theta.native ? thetaIntegrand : sinCosShown} dθ = ${Fshown}`)}${!theta.native && viaThetaNote(sinP, cosP) ? ` (${viaThetaNote(sinP, cosP)})` : ''}.`,
    `Back to ${mark(v)} with the right triangle: ${mark(ratio)} gives ${triangle.split(', ').map((t) => t.replace(/^(\w+) (.+)$/, (mm, name, val) => `${name} ${mark(val)}`)).join(', ')}, so ${[...new Set(used)].map((fn) => mark(`${fn} θ = ${shownBack(fn)}`)).join(', ')}${new RegExp(`(?<![a-z])${w}(?![a-z(])`).test(F.replace(new RegExp(`\\w+\\(${w}\\)`, 'g'), '')) ? ` and ${mark(`θ = ${beautify(tri6.theta).replace(/sqrt\(([^()]+)\)/g, '√($1)').replace(/\^2/g, '²')}`)}${kind === 'sec' ? ` (for ${mark(`${v} > ${a}`)} this is ${mark(`arcsec(${overA})`)}; written with arctan, the answer holds for ${mark(`${v} < −${a}`)} as well)` : ''}` : ''}.`,
    `So ${mark(`∫${shownTerm} d${v} = ${absBars(lnify(antiderivative))}`)}${dropsLnA ? `: ${mark(`ln|sec θ + tan θ| = ln|${v} + √(${Rshown})| − ln ${a}`)}, and the constant ${mark(`−ln ${a}`)} joins ${mark('C')}` : ''}.`,
  ];
  return { antiderivative, steps };
}

// The substitution that does a sin^p·cos^q integral, for the step's note.
function viaThetaNote(p, q) {
  if (q === 1) return `${mark('u = sin θ')}, ${mark('du = cos θ dθ')}`;
  if (p === 1) return `${mark('u = cos θ')}, ${mark('du = −sin θ dθ')}`;
  return '';
}
