// Polynomial equations: the Rational Root Theorem with synthetic division,
// Algebrite's roots checked for completeness against the degree, and the
// exact root finder (polynomialRoots.js) past Algebrite's limit.

import { unsupported } from '../../solutionEnvelope.js';
import {
  readPolynomial,
  allRoots,
  valueAtDecimal,
  factorByRationalRoots,
  MAX_POLYNOMIAL_DEGREE,
} from '../polynomialRoots.js';
import { getSettings } from '../../settings.js';
import { loadAlgebrite, beautify, formatNumber, mark } from '../solverUtils.js';
import {
  rootsViaComplexEvaluate,
  parseRootsList,
  formatSolutions,
  prettyRadicals,
  formatComplexRoot,
  cleanNumber,
  splitRootsList,
} from './rootsFormat.js';
import { quadraticDerivation } from './radicals.js';

// A known function name that is NOT followed by an argument list — "sin^2*x",
// "ln + 3". Always a mis-read, never mathematics a solver should act on.
const BARE_FUNCTION_NAME = /(?<![a-z])(?:arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|sqrt|abs|ln|log|exp)(?![a-z])\s*(?!\()/i;

export async function solveWithAlgebriteRoots(equation, variable) {
  try {
    const Algebrite = await loadAlgebrite();
    const [left, right] = equation.split('=');
    if (right === undefined) return null;

    // Move everything to one side: (left) - (right) = 0.
    const polynomial = `(${left.trim()}) - (${right.trim()})`;

    // A function name with no argument list is not something Algebrite can be
    // trusted with: a bare name there is applied to its PREVIOUS result, so
    // the "roots" of a mis-parsed `sin^2*x - 1/2` came back as
    // `1/(2*sin([-2,2])^2)` — the last problem's answer, embedded, nesting one
    // level deeper per solve. Nothing well-formed reaches here in that shape
    // (the parser rewrites sin^2(x) to (sin(x))^2), so refuse rather than
    // hand a leaked value to the formatter.
    if (BARE_FUNCTION_NAME.test(polynomial)) return null;

    // A rational equation — the variable in a denominator, as in
    // 1/(x−1) + 1/(x+1) = 1 — used to skip straight to the numeric scan and
    // print −0.4142 for 1 − √2. Clear the denominators first and find the
    // roots of the numerator; solveEquation's extraneous-root check then
    // drops any root that makes an original denominator zero.
    // (September 2026 audit row G06.)
    let target = polynomial;
    const clearingSteps = [];
    if (new RegExp(`/\\s*\\(?[^()]*\\b${variable}\\b`).test(polynomial)) {
      const numerator = String(Algebrite.run(`numerator(rationalize(${polynomial}))`)).trim();
      if (numerator && !/stop|error|nil/i.test(numerator) && new RegExp(`\\b${variable}\\b`).test(numerator)) {
        target = numerator;
        clearingSteps.push(`Multiply through by the denominators to clear the fractions: ${beautify(numerator)} = 0`);
      }
    }

    // Above degree 12 Algebrite's exact forms are not readable (x^50 = 2 came
    // back as 2^(1/50)·cos(π/50)… and was evaluated numerically anyway), and
    // a dense polynomial makes it grind for seconds before it fails
    // (x^41 − x − 1: ten seconds). Go straight to the exact root finder,
    // which also refuses at once above its own limit.
    const read = readPolynomial(target, variable);
    if (read && (read.tooHigh || read.degree > ALGEBRITE_DEGREE_LIMIT)) {
      const exact = rootsViaPolynomialRoot(Algebrite, target, variable, clearingSteps);
      if (exact) return exact;
    }

    // A cubic or higher is worked the way a course does it: the Rational
    // Root Theorem, synthetic division by each root found, then the
    // quadratic that remains — and whatever has no rational root goes to
    // the exact root finder without a call to Algebrite, whose roots() ground
    // for three seconds on an irreducible quintic before giving up.
    if (read && !read.tooHigh && read.degree >= 3) {
      const leading = [
        ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
        ...clearingSteps,
      ];
      const viaRational = solveByRationalRoots(Algebrite, target, variable, read, leading);
      if (viaRational) return viaRational;
    }

    // Algebrite throws "not factorable" for x^5 − x + 1: every root is
    // still found numerically rather than left to the zero-crossing scan.
    let rootsRaw;
    try {
      rootsRaw = Algebrite.roots(target, variable).toString();
    } catch {
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    // Algebrite mangles many cubics: rather than a clean real root like x = 2
    // for x^3 - 8, it emits terms like "-2*(-1)^(1/3)", the *principal complex*
    // cube root, which is both unreadable and numerically wrong for the real
    // solution. Detect that signature and recompute the roots numerically from
    // the polynomial's coefficients, which yields clean, correct values.
    if (/\(-1\)\^\(1\/\d+\)|\(-\d+\)\^\(1\/\d+\)/.test(rootsRaw)) {
      const numericRoots = rootsViaPolynomialRoot(Algebrite, target, variable);
      if (numericRoots && !numericRoots.envelope) return numericRoots;
      // Past the exact reader's degree limit, Algebrite's own list is still
      // usable when it is complete (x^50 = 2): evaluate it below.
      if (numericRoots?.envelope && !rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) return numericRoots;
      // polynomialRoot caps at cubics. For higher degrees (x^4 - 16), evaluate
      // each symbolic root numerically instead — mathjs handles the complex
      // arithmetic — so students see ±2, ±2i, not (-1)^(1/4) soup.
      const evaluated = rootsViaComplexEvaluate(rootsRaw, target, variable);
      if (evaluated) return evaluated;
    }

    // Algebrite can return only the roots it could factor out and say nothing
    // about the rest: for x(x − 1)(x − 2)(x + 3)(7x − 1)(3x − 5) + x it
    // answers [0] and drops the quintic. A degree-n polynomial has n roots
    // counted with multiplicity; if the listed ones fall short, the list is
    // partial and the numeric scan below must answer instead (October 2026).
    if (!rootsAccountForDegree(Algebrite, target, variable, rootsRaw)) {
      return rootsViaPolynomialRoot(Algebrite, target, variable);
    }

    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;

    let answer = formatSolutions(roots, variable);
    // Algebrite lists a double root once; a quadratic with a single root has
    // it twice, and the answer says so.
    if (roots.length === 1 && !/multiplicity/.test(answer) && String(Algebrite.run(`deg(${target}, ${variable})`)).trim() === '2') {
      answer += ' (repeated root, multiplicity 2)';
    }
    const numericSolutions = roots
      .map((r) => r.numeric)
      .filter((n) => Number.isFinite(n));

    const derivation = quadraticDerivation(Algebrite, target, variable);
    const steps = [
      // Already "… = 0": no rewrite to show.
      ...(/^0$/.test(right.trim()) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
      ...clearingSteps,
      ...(derivation || [`Solve for ${variable} by finding the roots.`]),
      `Solution: ${answer}`,
    ];

    return { steps, answer, solutions: numericSolutions };
  } catch (e) {
    return null;
  }
}

/**
 * Every root of a polynomial, for when Algebrite's symbolic output is
 * malformed, partial or missing. polynomialRoots.js reads the polynomial
 * exactly, counts its real roots by Sturm's theorem (so none can be missed,
 * however close together), locates each by exact bisection, and lists the
 * non-real ones only if they verify. Returns { steps, answer, solutions },
 * { envelope } (an honest refusal) past the supported degree, or null when
 * the input is not a polynomial with rational coefficients.
 */
// Past this degree a polynomial equation skips Algebrite (see solveWithAlgebriteRoots).
const ALGEBRITE_DEGREE_LIMIT = 12;

// Highest-first coefficient strings → "x^3 - 6x^2 + 11x - 6".
function polynomialText(coeffs, v) {
  const n = coeffs.length - 1;
  const parts = [];
  coeffs.forEach((c, i) => {
    const text = String(c);
    if (text === '0') return;
    const power = n - i;
    const neg = text.startsWith('-');
    const mag = neg ? text.slice(1) : text;
    const coef = mag === '1' && power > 0 ? '' : mag;
    const term = power === 0 ? mag : `${coef}${v}${power > 1 ? `^${power}` : ''}`;
    parts.push(parts.length === 0 ? `${neg ? '-' : ''}${term}` : `${neg ? '- ' : '+ '}${term}`);
  });
  return parts.length ? parts.join(' ') : '0';
}
const signedList = (items) => items.map((t) => (String(t).startsWith('-') ? `(${t})` : String(t)));

// x³ − 6x² + 11x − 6 = 0, worked: factor out x if the constant term is 0,
// list the Rational Root Theorem candidates, test them by substitution,
// divide synthetically by each root found, and solve what remains — a
// quadratic by the formula (exactly, surds and complex pairs kept), or a
// factor with no rational root by the exact numeric finder. Returns
// { steps, answer, solutions } or null when the shape is not suitable.
function solveByRationalRoots(Algebrite, target, v, read, leadingSteps) {
  const fac = factorByRationalRoots(read);
  if (!fac) return null;
  const steps = [...leadingSteps];
  const shown = []; // { display, numeric, sign }
  const pow = (k) => (k === 1 ? v : `${v}^${k}`);
  const afterX = polynomialText(fac.coefficients, v);
  if (fac.xPower > 0) {
    steps.push(`Every term has a factor of ${pow(fac.xPower)}: factor it out — ${pow(fac.xPower)}·(${afterX}) = 0 — so ${v} = 0 is a root${fac.xPower > 1 ? ` (multiplicity ${fac.xPower})` : ''}, and the other factor is solved on its own.`);
    shown.push({ display: '0', numeric: 0, sign: '=', multiplicity: fac.xPower });
  }
  if (fac.degree >= 3) {
    const name = fac.degree === 3 ? 'a cubic' : fac.degree === 4 ? 'a quartic' : `degree ${fac.degree}`;
    const list = fac.candidates.length > 16 ? `${fac.candidates.slice(0, 16).join(', ')}, …` : fac.candidates.join(', ');
    steps.push(`${mark(`${afterX} = 0`)} is ${name}. Rational Root Theorem: any rational root ${mark('p/q')} has ${mark('p')} dividing the constant term ${mark(fac.constant)} and ${mark('q')} dividing the leading coefficient ${mark(fac.leading)}, so the only possible rational roots are ${mark(list)}.`);
    let currentText = afterX;
    for (const round of fac.rounds) {
      const failed = round.trials.filter((t) => !t.isRoot);
      const shownFailed = failed.slice(0, 5).map((t) => `p(${t.text}) = ${t.value}`);
      const more = failed.length > 5 ? `, … (${failed.length - 5} more fail)` : '';
      const r = round.root.text;
      // (x − r) reads as (x + 3) for r = −3.
      const factorText = r.startsWith('-') ? `(${v} + ${r.slice(1)})` : `(${v} − ${r})`;
      steps.push(`Test the candidates in ${mark(`p(${v}) = ${currentText}`)}: ${shownFailed.length ? `${shownFailed.map(mark).join(', ')}${more}; ` : ''}${mark(`p(${r}) = 0`)} ✓ — so ${mark(`${v} = ${r}`)} is a root and ${mark(factorText)} is a factor.`);
      const work = round.products.map((prod, i) => `${mark(`${signedList([r])[0]}·${signedList([round.bottom[i]])[0]} = ${prod}`)}, then ${mark(`${signedList([round.top[i + 1]])[0]} + ${signedList([prod])[0]} = ${round.bottom[i + 1]}`)}`);
      const quotientText = polynomialText(round.quotient, v);
      steps.push(`Synthetic division by ${mark(factorText)}, using ${mark(`r = ${r}`)}: write the coefficients ${mark(signedList(round.top).join(', '))}; bring down ${mark(round.top[0])}; ${work.join('; ')}. The last number is the remainder, ${mark('0')} ✓, and the rest are the quotient: ${mark(quotientText)}.`);
      shown.push({ display: round.root.text, numeric: Number(round.root.m) / Number(round.root.d), sign: '=' });
      currentText = quotientText;
    }
  }
  // What is left after x^k and the rational roots: solved whatever its
  // degree. Only a remainder of degree 3 or more was solved before, so
  // x^3 - 4x = 0 (x·(x² − 4)) was answered x = 0 alone (October 26).
  const remDegree = fac.remaining.length - 1;
  const remText = polynomialText(fac.remaining.map((f) => (f.d === 1n ? String(f.s * f.n) : `${f.s < 0 ? '-' : ''}${f.n}/${f.d}`)), v);
  if (remDegree === 2) {
    steps.push(`The remaining factor is a quadratic: ${mark(`${remText} = 0`)}.`);
    let rootsRaw = '';
    try { rootsRaw = Algebrite.roots(remText, v).toString(); } catch { rootsRaw = ''; }
    const derivation = quadraticDerivation(Algebrite, remText, v);
    if (derivation) steps.push(...derivation);
    const roots = parseRootsList(rootsRaw);
    if (roots.length === 0) return null;
    // i*√3 reads as i√3.
    const tidy = (d) => prettyRadicals(d).replace(/i\*√/g, 'i√');
    // A double root (zero discriminant) is reported once: it counts twice.
    for (const root of roots) shown.push({ display: tidy(root.display), numeric: root.numeric, sign: '=', multiplicity: roots.length === 1 ? 2 : 1 });
    const names = roots.map((root) => `${v} = ${tidy(root.display)}`).join(' or ');
    steps.push(`So the quadratic gives ${names}.`);
  } else if (remDegree === 1) {
    const [b, c] = fac.remaining;
    const root = c.neg().div(b);
    const rootText = root.d === 1n ? String(root.s * root.n) : `${root.s < 0 ? '-' : ''}${root.n}/${root.d}`;
    steps.push(`The remaining factor is linear: ${remText} = 0, so ${v} = ${rootText}.`);
    shown.push({ display: rootText, numeric: Number(root.valueOf()), sign: '=' });
  } else if (remDegree >= 3) {
    steps.push(`No rational root remains: every candidate fails for ${remText}. Its roots cannot be written in a closed form here, so they are found numerically.`);
    const numeric = rootsViaPolynomialRoot(Algebrite, `(${remText}) - (0)`, v);
    if (!numeric || numeric.envelope) return null;
    // Its own "degree-n polynomial … Sturm …" steps, minus the solution line.
    steps.push(...numeric.steps.filter((line) => !/^Solution:/.test(line)));
    // The finder's own answer may open with "no real solutions;" when
    // every remaining root is complex — the rational ones already listed
    // are the real solutions, so only its count clause is kept.
    const rest = numeric.answer.replace(/^no real solutions;\s*/, '');
    const sortedShown = mergeRepeated(shown).sort((a, b) => a.numeric - b.numeric);
    const answer = /^plus \d+ complex/.test(rest)
      ? `${sortedShown.map(line).join('  or  ')};  ${rest}`
      : [...sortedShown.map(line), rest].join('  or  ');
    steps.push(`Solution: ${answer}`);
    return { steps, answer, solutions: [...shown.map((r) => r.numeric).filter(Number.isFinite), ...(numeric.solutions || [])] };
  }
  if (shown.length === 0) return null;
  // Real roots in ascending order, then the complex pair(s); a root found
  // twice (x = 2 from two rounds of division) is one root of multiplicity 2.
  const merged = mergeRepeated(shown);
  const reals = merged.filter((r) => Number.isFinite(r.numeric)).sort((a, b) => a.numeric - b.numeric);
  const others = merged.filter((r) => !Number.isFinite(r.numeric));
  const answer = [...reals, ...others].map(line).join('  or  ');
  steps.push(`Solution: ${answer}`);
  return { steps, answer, solutions: reals.map((r) => r.numeric) };

  function line(r) {
    return `${v} ${r.sign} ${r.display}${r.multiplicity > 1 ? ` (multiplicity ${r.multiplicity})` : ''}`;
  }
}

// The same root listed more than once — "x = 2 or x = 2" — is one root with
// its multiplicities added.
function mergeRepeated(shown) {
  const out = [];
  for (const r of shown) {
    const same = out.find((o) => o.display === r.display || (Number.isFinite(o.numeric) && Number.isFinite(r.numeric) && Math.abs(o.numeric - r.numeric) < 1e-12 && o.sign === '=' && r.sign === '='));
    if (same) same.multiplicity = (same.multiplicity || 1) + (r.multiplicity || 1);
    else out.push({ ...r });
  }
  return out;
}

export function rootsViaPolynomialRoot(Algebrite, polynomial, variable, extraSteps = []) {
  const poly = readPolynomial(polynomial, variable);
  if (!poly) return null;
  if (poly.tooHigh) {
    return {
      envelope: unsupported({
        input: polynomial,
        reason: `This polynomial has degree ${poly.degree}. MasterMath finds every root of polynomials up to degree ${MAX_POLYNOMIAL_DEGREE}; past that it cannot guarantee a complete list, so it gives none rather than a partial one.`,
        answer: `Degree ${poly.degree} is above the supported limit (${MAX_POLYNOMIAL_DEGREE}) for a guaranteed-complete list of roots`,
        tips: ['Factor out any common factor first, or check whether the equation simplifies to a lower degree.'],
      }),
    };
  }
  if (poly.degree < 1) return null;
  const { real, complex, complexCount, degree } = allRoots(poly);
  const multiplicity = (m) => (m > 1 ? ` (multiplicity ${m})` : '');
  // A root that is exactly a rational is shown as one ("x = 1/3"); a root
  // only located numerically is marked ≈ — x(x−1)⋯(x−20) + x has a root at
  // 20 − 7×10⁻¹², and "x = 20" would be false (outside review, October 2026).
  const rational = ({ m, d }) => (d === 1n ? String(m) : `${m}/${d}`);
  const realShown = real.map((r) => (r.exact
    ? { display: rational(r.exact), sign: '=', multiplicity: r.multiplicity, numeric: r.value }
    : { display: formatNumber(r.value), sign: '≈', multiplicity: r.multiplicity, numeric: r.value }));
  const gaussian = ({ re, im }) => {
    const rePart = re.m === 0n ? '' : rational(re);
    const imAbs = { m: im.m < 0n ? -im.m : im.m, d: im.d };
    const imPart = `${imAbs.m === 1n && imAbs.d === 1n ? '' : rational(imAbs)}i`;
    return rePart ? `${rePart} ${im.m < 0n ? '-' : '+'} ${imPart}` : `${im.m < 0n ? '-' : ''}${imPart}`;
  };
  const complexShown = (complex || []).map((z) => (z.exact
    ? { display: gaussian(z.exact), sign: '=', multiplicity: z.multiplicity }
    : { ...formatComplexRoot(z), sign: '≈', multiplicity: z.multiplicity }));
  const line = (r) => `${variable} ${r.sign} ${r.display}${multiplicity(r.multiplicity)}`;
  // As formatSolutions: past a handful of complex roots, list the real ones
  // and count the rest — 98 decimal pairs is not an answer anyone can read.
  const listComplex = complex !== null && complexShown.length <= 4 && realShown.length + complexShown.length <= 8;
  let answer;
  if (complexCount === 0 || listComplex) {
    const parts = [...realShown, ...complexShown].map(line);
    if (parts.length === 0) return null;
    answer = parts.join('  or  ');
  } else {
    const realText = realShown.length ? realShown.map(line).join('  or  ') : 'no real solutions';
    answer = `${realText};  plus ${complexCount} complex solutions (not listed)`;
  }
  const realCount = real.reduce((n, r) => n + r.multiplicity, 0);
  const counted = `${real.length === 0 ? 'no' : real.length} distinct real root${real.length === 1 ? '' : 's'}${realCount > real.length ? ` (${realCount} counting multiplicity)` : ''}`;
  // The first approximate root whose decimal display reads as a simple
  // number: say what that number actually gives, so ≈ is not read as =.
  const approxNote = (() => {
    const shown = realShown.find((r) => r.sign === '≈' && /^-?\d+(?:\.\d+)?$/.test(r.display));
    if (!shown) return [];
    const at = valueAtDecimal(poly, shown.display);
    if (!at || at.equals(0)) return [];
    const v = Number(at.valueOf());
    // Small values in scientific notation, so "0.00000012" never rounds to "0".
    const sup = (t) => String(t).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
    const shownValue = Math.abs(v) >= 1e-3 && Math.abs(v) < 1e6
      ? (at.d === 1n ? String(at.s * at.n) : formatNumber(v))
      : v.toExponential(2).replace(/e([+-]?\d+)/, (_, e) => `×10${sup(Number(e))}`);
    return [`Roots marked ≈ were located numerically and are not exactly the number shown: substituting ${variable} = ${shown.display} gives ${shownValue}, not 0. The number shown is rounded to ${getSettings().decimalPlaces} decimals; MasterMath located the root itself to within 10⁻¹².`];
  })();
  const steps = [
    ...(/\)\s*-\s*\(0\)$/.test(polynomial) ? [] : [`Rewrite as an equation set to zero: ${beautify(polynomial)} = 0`]),
    ...extraSteps,
    `This is a degree-${degree} polynomial, so it has exactly ${degree} roots counted with multiplicity. MasterMath cannot write them in exact form, so they are found numerically.`,
    `Real roots: Sturm's theorem counts them exactly — ${counted} — and each is located by bisection to 12 significant digits, so none is missed even when roots lie very close together.${real.some((r) => r.exact) ? ' A root shown with = was confirmed exact by substitution.' : ''}`,
    ...approxNote,
    ...(complexCount === 0 ? [] : [complex === null
      ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real; ${complexCount === 1 ? 'it' : 'they'} could not be computed to a value MasterMath can verify, so only the count is given.`
      : listComplex
        ? `The remaining ${complexCount} root${complexCount === 1 ? ' is' : 's are'} non-real, found by Durand–Kerner iteration and each checked by substitution.`
        : `The remaining ${complexCount} roots are non-real (found by Durand–Kerner iteration and each checked by substitution); that many decimal pairs would not be a readable answer, so they are counted rather than listed.`]),
    `Solution: ${answer}`,
  ];
  return { steps, answer, solutions: real.map((r) => cleanNumber(r.value)) };
}

// Do the listed roots, with their multiplicities, add up to the polynomial's
// degree? A root's multiplicity is the number of successive derivatives that
// vanish there, checked exactly by Algebrite; the degree comes from an exact
// read of the polynomial (polynomialRoots.js), with no cap that silently
// passes a higher degree. Degree ≤ 2 is not checked (Algebrite's quadratic
// roots are complete), nor is anything that is not a polynomial (the other
// paths verify their own answers). A shortfall sends the polynomial to
// rootsViaPolynomialRoot, which finds every root; a multiplicity Algebrite
// cannot simplify to zero is undercounted, which errs the same safe way.
export function rootsAccountForDegree(Algebrite, poly, variable, rootsRaw) {
  const read = readPolynomial(poly, variable);
  if (!read) return true;
  // Past the exact reader's limit the degree is the parse-tree bound — an
  // upper bound, so a list that reaches it is certainly complete
  // (x^100 = 1: all 100 roots of unity).
  const { degree } = read;
  if (degree <= 2) return true;
  const roots = [...new Set(splitRootsList(rootsRaw).map((r) => r.trim()))];
  // As many distinct roots as the degree: complete by counting alone, with no
  // multiplicity to check (a polynomial cannot have more roots than that).
  if (roots.length >= degree) return true;
  let counted = 0;
  for (const r of roots) {
    let multiplicity = 0;
    let derivative = poly;
    while (multiplicity < degree) {
      let value;
      try { value = String(Algebrite.run(`simplify(subst((${r}), ${variable}, ${derivative}))`)).trim(); } catch { break; }
      if (value !== '0') break;
      multiplicity += 1;
      derivative = `d(${derivative}, ${variable})`;
    }
    counted += Math.max(multiplicity, 1);
  }
  return counted >= degree;
}
