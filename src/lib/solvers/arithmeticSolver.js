import { createMath } from '../mathInstance.js';
import { math, formatNumber, beautify } from './solverUtils.js';
import { parseError, overflow, undefinedValue, indeterminate } from '../solutionEnvelope.js';

// A second mathjs instance that computes in exact rational arithmetic. Where
// the whole expression is rational (1/3 + 1/6), it yields the exact fraction;
// where it isn't (sqrt(2), e^2, factorials) it throws, and the float result
// stands. Used only for display: the float `math` result remains the value.
const exact = createMath({ number: 'Fraction' });

// Percent notation, the narrow forms students actually type: "50% of 80" and
// a bare "N%". This is notation, not natural language — "of" here is the
// arithmetic operator it always is in percentage work.
function rewritePercent(text) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/gi, '($1/100)*')
    .replace(/(\d+(?:\.\d+)?)\s*%(?![\w(])/g, '($1/100)');
}

export function solveArithmetic(expression) {
  try {
    const original = expression.trim();
    // Under Arithmetic there are no variables, so an "x" between two numbers
    // is the multiplication sign a student reached for: "2 x 3" → 2*3.
    // (parseMathExpression will have removed the spaces already: "2x3".)
    const cleanedBase = rewritePercent(original).replace(/(\d|\))\s*x\s*(\d|\()/gi, '$1*$2');
    let cleaned = cleanedBase;

    // ∞ is not a number, but students type it. Read it as mathjs's Infinity
    // so that ∞ − ∞ can be named an indeterminate form instead of a syntax
    // error (September 2026 audit).
    const usesInfinity = /∞|\binf(?:inity)?\b/i.test(cleaned);
    if (usesInfinity) cleaned = cleaned.replace(/∞|\binf(?:inity)?\b/gi, 'Infinity');

    // (−8)^(1/3): a negative base under an odd root has a real value, −2.
    // mathjs returns the principal complex root (1 + 1.7321i) — a cube root of
    // −8, but not the one a student means. Rewrite as −(8^(1/3)) (or
    // +(8^(2/3)) for an even numerator) and say so. (Audit row R01.)
    const ODD_ROOT = /\(\s*-\s*(\d+(?:\.\d+)?)\s*\)\s*\^\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g;
    const rootNotes = [];
    cleaned = cleaned.replace(ODD_ROOT, (whole, base, p, q) => {
      if (Number(q) % 2 === 0) return whole;
      let principal = '';
      try { principal = math.format(math.evaluate(whole), { precision: 5 }); } catch { /* no note */ }
      const real = Number(p) % 2 ? `-(${base}^(${p}/${q}))` : `(${base}^(${p}/${q}))`;
      rootNotes.push(`${whole}: the base is negative and the root is odd (${q}), so it has a real value — rewrite it as ${real}.${principal ? ` (A calculator that answers ${principal} is showing the principal complex root instead.)` : ''}`);
      return `(${real})`;
    });

    const result = math.evaluate(cleaned);

    if (usesInfinity && typeof result === 'number' && !Number.isFinite(result)) {
      if (Number.isNaN(result)) {
        const form = /Infinity\s*\/\s*Infinity/.test(cleaned)
          ? '∞/∞'
          : /(?:^|[^\d.])0\s*\*\s*Infinity|Infinity\s*\*\s*0(?![\d.])/.test(cleaned) ? '0·∞' : '∞ − ∞';
        return indeterminate({
          input: original,
          form,
          note: `${form} is not a number. ∞ is not a value arithmetic can subtract, divide or multiply — it describes a limit that grows without bound, and two such limits can differ by anything. In calculus ${form} is an indeterminate form: a limit can settle it, plain arithmetic cannot.`,
        });
      }
      return undefinedValue({
        input: original,
        reason: '∞ is not a number',
        steps: [
          `Evaluate: ${original}`,
          '∞ is not a real number, so it cannot be added to, multiplied or compared in arithmetic. It describes how a limit behaves — growing without bound — not a value.',
        ],
        tips: ['In a limit, ∞ + 1, 2·∞ and ∞² all "equal" ∞ — the quantity still grows without bound. As arithmetic, none of them has a value.'],
        common_mistakes: ['Treating ∞ as a very large number.'],
      });
    }


    if (typeof result === 'number' && Number.isFinite(result) && modsByZero(cleaned)) {
      return undefinedValue({
        input: original,
        reason: 'the modulus is zero',
        steps: [`Evaluate: ${original}`, 'a mod b asks for the remainder after dividing by b — and dividing by 0 has no value, so neither does the remainder.'],
        tips: ['A remainder only makes sense for a nonzero divisor.'],
        common_mistakes: ['Reading a mod 0 as a (some calculators return the dividend unchanged).'],
      });
    }

    // A non-finite result is never an answer. Which failure it is depends on
    // why: dividing by zero has no defined value (0/0 has no value even in
    // principle), while a finite calculation that runs off the end of
    // double precision (9999999999^9999) is an overflow.
    //
    // Division by zero used to be reported as the number ∞ — so
    // "(5+3)*4 - 2^3/0" was answered "-∞", marked Solved. In real arithmetic
    // 8/0 is undefined; ∞ is a statement about a limit, not a value.
    if (typeof result === 'number' && !Number.isFinite(result)) {
      // ln(0), log(0): undefined — the LIMIT is -∞, the value does not exist.
      if (logOfZero(cleaned)) {
        return undefinedValue({
          input: original,
          reason: 'the logarithm of 0 is undefined',
          steps: [`Evaluate: ${original}`, 'ln(0) asks for the power e must be raised to in order to give 0 — and no power of e is 0, so there is no such number.'],
          tips: ['ln(x) → −∞ as x → 0⁺: the values grow more and more negative, but ln(0) itself has no value.', 'The logarithm is only defined for positive numbers.'],
          common_mistakes: ['Reading ln(0) as −∞. Infinity describes how the limit behaves, not the value of ln at 0.'],
        });
      }
      if (dividesByZero(cleaned)) {
        if (Number.isNaN(result)) {
          return indeterminate({
            input: original,
            form: '0/0',
            note: '0/0 is not a number: every number times 0 gives 0, so no single value fits. In calculus it is an indeterminate form — a limit can settle it, plain arithmetic cannot.',
          });
        }
        return undefinedValue({
          input: original,
          reason: 'division by zero',
          steps: [
            `Evaluate: ${original}`,
            'This expression divides by zero. No number multiplied by 0 gives a nonzero result, so the quotient has no value.',
          ],
          tips: [
            'A limit may grow without bound — 1/x → ∞ as x → 0⁺ — but the arithmetic expression 1/0 has no value at all.',
            'Check for a denominator that works out to zero, such as 8/(3-3).',
          ],
          common_mistakes: ['Reading 1/0 as ∞. Infinity describes how a limit behaves, not the result of a division.'],
        });
      }
      if (!Number.isNaN(result)) {
        return overflow({ input: original });
      }
    }
    const steps = [`Evaluate: ${original}`, ...rootNotes];
    // 0^0 is a convention, not a computation. Say so rather than presenting
    // "1" as if it were forced.
    const zeroToZero = raisesZeroToZero(cleaned);
    if (zeroToZero) {
      steps.push('0^0 has no single forced value: x^0 = 1 for every other x, but 0^y = 0 for every positive y.');
      steps.push('This calculator follows the usual convention 0^0 = 1 (it is what makes the binomial theorem and power series work). In a limit, 0^0 is an indeterminate form.');
    }
    // A complex result (sqrt(-1), ln(-1)) has no real value; name what is shown.
    if (result && typeof result === 'object' && 'im' in result && Math.abs(result.im) > 0) {
      steps.push('There is no real number here — the result is a complex number, written with i = √(−1).');
    }
    if (/%/.test(original) && cleanedBase !== original) {
      steps.push(`Percent means "per hundred": rewrite ${original} as ${cleanedBase}.`);
    } else if (cleanedBase !== original) {
      steps.push(`Reading "x" between numbers as multiplication: ${cleanedBase}.`);
    }

    // Show the real reduction by collapsing the innermost parentheses one at a
    // time — this is genuine intermediate work, not a canned reminder. A group
    // that works out to a fraction is shown AS a fraction: (1/3) + (1/7) used
    // to show "0.3333 + 0.1429" and then answer 10/21 — work that was not
    // equivalent to the answer, teaching that rounding mid-way is exact method.
    let working = cleaned;
    let guard = 0;
    while (/\([^()]+\)/.test(working) && guard++ < 25) {
      // The innermost group that has something to work out. A group that is
      // just a signed number — the (-1) in sqrt(-1) — or an already-reduced
      // fraction — the (1/3) in (1/3)*6 — is left as it is; "working it out"
      // gave (-1) again, 25 times over.
      const match = [...working.matchAll(/\([^()]+\)/g)].find((m) => !isSettledGroup(m[0]));
      if (!match) break;
      let value;
      try {
        value = math.evaluate(match[0]);
      } catch {
        break;
      }
      const asFraction = exactFraction(match[0]);
      const shown = asFraction ? fractionText(asFraction) : formatNumber(value);
      const substitution = asFraction || Number(value) < 0 ? `(${shown})` : shown;
      const next = working.slice(0, match.index) + substitution + working.slice(match.index + match[0].length);
      if (next === working) break;
      steps.push(`Work inside the parentheses: ${match[0]} = ${shown}  →  ${next}`);
      working = next;
    }

    // A sum/difference of fractions, or a product/quotient of two, is taught
    // with common denominators and reciprocals — the exact method, never via
    // decimals (September 2026 teaching-quality review, top finding). For
    // everything else, do the work one operation at a time in PEMDAS order,
    // showing the expression after each — "Resolve the exponents" with
    // nothing worked out told a student nothing.
    const fractionWork = fractionSteps(working);
    if (fractionWork) {
      steps.push(...fractionWork.steps);
    } else if (!showWorking(working, steps)) {
      describeOrder(working, steps);
    }

    const shownAnswer = formatArithmeticResult(result, cleaned) + (zeroToZero && String(cleaned).replace(/\s/g, '') === '0^0' ? ' (by convention)' : '');
    steps.push(`Final answer: ${shownAnswer}`);

    return {
      steps,
      answer: shownAnswer,
      tips: fractionWork ? fractionWork.tips : [
        'PEMDAS/BODMAS order: Parentheses, Exponents, Multiplication & Division (left to right), Addition & Subtraction (left to right).',
        'Multiplication and division share a tier — resolve them left to right, not multiplication first.',
        'Use parentheses to force a different order of operations.',
      ],
      common_mistakes: fractionWork ? fractionWork.common_mistakes : [
        'Adding or subtracting before multiplying or dividing.',
        'Evaluating left to right while ignoring precedence.',
        'Sign errors when subtracting a negative number.',
      ],
      graph: null,
    };
  } catch (error) {
    console.error('Arithmetic solver error:', error);
    // mathjs error messages are specific ("Parenthesis ) expected (char 4)",
    // "Undefined symbol abc") — pass them through rather than generic tips.
    return parseError({
      input: expression,
      hint: error.message,
      tips: ['Use * for multiplication, / for division, and ^ for exponents (e.g., (2+3)*4^2).'],
      common_mistakes: ['Missing operators between numbers', 'Unbalanced parentheses'],
    });
  }
}

// ---------------------------------------------------------------------------
// Exact fraction work.
//
// The whole solver computes in floats (the value) and shows exact rationals
// where it can (the display). These helpers make the WORK exact too: a group
// that is a fraction is shown as one, and a flat chain of fractions is taught
// by the textbook method — common denominator for + and −, multiply across
// for ×, reciprocal for ÷ — so the intermediate steps are equivalent to the
// answer. Before this, (1/3) + (1/7) showed 0.3333 + 0.1429 and then 10/21.
// ---------------------------------------------------------------------------

const MAX_DENOMINATOR = 10000;

// The exact rational value of an expression as {n, d} with d > 1 (sign on n),
// or null when it isn't rational, is an integer, or has an unwieldy denominator.
function exactFraction(expr) {
  try {
    const r = exact.evaluate(expr);
    if (exact.typeOf(r) !== 'Fraction' || r.d <= 1 || r.d > MAX_DENOMINATOR) return null;
    return { n: Number(r.s < 0 ? -r.n : r.n), d: Number(r.d) };
  } catch {
    return null;
  }
}

function fractionText({ n, d }) {
  return d === 1 ? String(n) : `${n}/${d}`;
}

// A parenthesised group with nothing left to work out: a signed number, or a
// fraction already in lowest terms.
function isSettledGroup(group) {
  if (/^\(\s*-?\d+(?:\.\d+)?\s*\)$/.test(group)) return true;
  const m = group.match(/^\(\s*(-?\d+)\s*\/\s*(\d+)\s*\)$/);
  if (!m) return false;
  const f = exactFraction(group);
  return !!f && f.n === Number(m[1]) && f.d === Number(m[2]);
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// One term of a flat chain: an integer or a fraction, optionally negative,
// optionally in parentheses. Returns {n, d} or null.
function parseRationalTerm(text) {
  const raw = text.replace(/\s+/g, '');
  const wrapped = /^\(.*\)$/.test(raw);
  const t = raw.replace(/^\((.*)\)$/, '$1');
  const m = t.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const d = m[2] ? Number(m[2]) : 1;
  if (d === 0) return null;
  const n = Number(m[1]);
  // A bare p/q that is a whole number — the 8/2 in 8/2*4 — is a division
  // to perform in PEMDAS order, not a fraction to add or multiply.
  if (!wrapped && d > 1 && n % d === 0) return null;
  return { n, d };
}

// Split a flat expression into rational terms joined by the operators in
// `ops` (a character class). Returns { terms, operators } or null.
function splitRationalChain(expr, ops) {
  const t = expr.replace(/\s+/g, '');
  const term = '\\(?-?\\d+(?:/\\d+)?\\)?';
  const chain = new RegExp(`^(${term})((?:[${ops}]${term})+)$`);
  const m = t.match(chain);
  if (!m) return null;
  const terms = [parseRationalTerm(m[1])];
  const operators = [];
  const rest = new RegExp(`([${ops}])(${term})`, 'g');
  for (const part of m[2].matchAll(rest)) {
    operators.push(part[1]);
    terms.push(parseRationalTerm(part[2]));
  }
  if (terms.some((x) => !x) || terms.every((x) => x.d === 1)) return null;
  return { terms, operators };
}

function signedFraction(f) {
  return f.n < 0 ? `(${fractionText(f)})` : fractionText(f);
}

// Show a sum of signed fractions as "7/21 − 3/21 + 42/21".
function joinSigned(fractions) {
  return fractions
    .map((f, i) => {
      const body = fractionText({ n: Math.abs(f.n), d: f.d });
      if (i === 0) return f.n < 0 ? `-${body}` : body;
      return `${f.n < 0 ? ' - ' : ' + '}${body}`;
    })
    .join('');
}

function reduceStep(n, d, steps) {
  const g = gcd(n, d);
  if (g <= 1) return { n, d };
  const reduced = { n: n / g, d: d / g };
  steps.push(`Reduce by the common factor ${g}: ${fractionText({ n, d })} = ${fractionText(reduced)}${reduced.d === 1 ? ', a whole number' : ''}.`);
  return reduced;
}

// Teaching steps for a flat chain of fractions, or null when the expression
// isn't one. Sums and differences of any length; products and quotients of
// exactly two terms (longer mixed chains fall back to the PEMDAS narration).
function fractionSteps(expr) {
  const sum = splitRationalChain(expr, '+\\-');
  if (sum) {
    const { terms, operators } = sum;
    const signed = terms.map((f, i) => (i > 0 && operators[i - 1] === '-' ? { n: -f.n, d: f.d } : f));
    const denominators = [...new Set(signed.map((f) => f.d))];
    const lcd = denominators.reduce((acc, d) => (acc * d) / gcd(acc, d), 1);
    if (lcd > MAX_DENOMINATOR) return null;
    const steps = [];
    const converted = signed.map((f) => ({ n: f.n * (lcd / f.d), d: lcd }));
    if (denominators.length > 1) {
      const wholes = signed.filter((f) => f.d === 1);
      steps.push(`The denominators differ (${denominators.join(', ')}), so first rewrite every term over a common denominator.`);
      steps.push(`The least common denominator is ${lcd}${denominators.length === 2 && gcd(denominators[0], denominators[1]) === 1 && !wholes.length ? ` (${denominators[0]} × ${denominators[1]}, since they share no factor)` : ` (the least common multiple of ${denominators.join(' and ')})`}.`);
      const rewrites = signed
        .map((f, i) => (f.d === lcd ? null : `${signedFraction(f)} = ${signedFraction(converted[i])}`))
        .filter(Boolean);
      steps.push(`Rewrite each term over ${lcd}: ${rewrites.join(',  ')}.`);
    } else {
      steps.push(`The denominators are the same (${lcd}), so add or subtract the numerators and keep the denominator.`);
    }
    const total = converted.reduce((acc, f) => acc + f.n, 0);
    const numeratorWork = converted
      .map((f, i) => (i === 0 ? String(f.n) : `${f.n < 0 ? ' - ' : ' + '}${Math.abs(f.n)}`))
      .join('');
    steps.push(`Combine the numerators over ${lcd}: ${joinSigned(converted)} = (${numeratorWork})/${lcd} = ${fractionText({ n: total, d: lcd })}.`);
    reduceStep(total, lcd, steps);
    return {
      steps,
      tips: [
        'To add or subtract fractions, rewrite them over a common denominator first, then combine only the numerators.',
        'Work with the fractions exactly — 1/3 is not 0.3333, and rounding part-way through changes the answer.',
        'Reduce the result by dividing numerator and denominator by their greatest common factor.',
      ],
      common_mistakes: [
        'Adding the numerators and the denominators separately: 1/3 + 1/7 is not 2/10.',
        'Converting only some of the terms — a whole number must be rewritten over the common denominator too.',
        'Rounding a fraction to a decimal in the middle of exact work.',
      ],
    };
  }

  const product = splitRationalChain(expr, '*/');
  if (product && product.terms.length === 2) {
    const [a, b] = product.terms;
    const op = product.operators[0];
    const steps = [];
    let n;
    let d;
    if (op === '*') {
      n = a.n * b.n;
      d = a.d * b.d;
      steps.push(`To multiply fractions, multiply the numerators together and the denominators together: ${signedFraction(a)} × ${signedFraction(b)} = (${a.n} × ${b.n})/(${a.d} × ${b.d}) = ${fractionText({ n, d })}.`);
    } else {
      if (b.n === 0) return null;
      const reciprocal = b.n < 0 ? { n: -b.d, d: -b.n } : { n: b.d, d: b.n };
      steps.push(`Dividing by a fraction is the same as multiplying by its reciprocal: ${signedFraction(a)} ÷ ${signedFraction(b)} = ${signedFraction(a)} × ${signedFraction(reciprocal)}.`);
      n = a.n * reciprocal.n;
      d = a.d * reciprocal.d;
      steps.push(`Multiply the numerators together and the denominators together: (${a.n} × ${reciprocal.n})/(${a.d} × ${reciprocal.d}) = ${fractionText({ n, d })}.`);
    }
    if (d > MAX_DENOMINATOR) return null;
    reduceStep(n, d, steps);
    return {
      steps,
      tips: [
        'Multiplying fractions needs no common denominator: multiply straight across.',
        'To divide by a fraction, flip it (take its reciprocal) and multiply.',
        'Reduce the result by dividing numerator and denominator by their greatest common factor.',
      ],
      common_mistakes: [
        'Finding a common denominator before multiplying — that is only needed for adding and subtracting.',
        'Flipping the wrong fraction when dividing: only the divisor (the second fraction) is inverted.',
        'Rounding a fraction to a decimal in the middle of exact work.',
      ],
    };
  }
  return null;
}

// ln(0) / log(0) anywhere in the parse tree.
function logOfZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'FunctionNode' || !['log', 'ln', 'log10', 'log2'].includes(node.fn?.name)) return;
      try {
        if (node.args[0].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Is there a 0^0 anywhere in the parse tree?
function raisesZeroToZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode' || node.fn !== 'pow') return;
      try {
        if (node.args[0].evaluate() === 0 && node.args[1].evaluate() === 0) found = true;
      } catch { /* not constant */ }
    });
    return found;
  } catch {
    return false;
  }
}

// a mod 0 anywhere in the expression (mathjs quietly returns a).
function modsByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found) return;
      const isMod = (node.type === 'OperatorNode' && node.fn === 'mod') || (node.type === 'FunctionNode' && node.fn?.name === 'mod');
      if (!isMod) return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch { /* needs a scope: not a constant zero */ }
    });
    return found;
  } catch {
    return false;
  }
}

// Does this expression divide by something that works out to zero? Read off
// the parse tree rather than by pattern-matching "/0", so 8/(3-3) is
// recognised as division by zero instead of being reported as an overflow.
function dividesByZero(expr) {
  try {
    let found = false;
    math.parse(expr).traverse((node) => {
      if (found || node.type !== 'OperatorNode') return;
      // 0^(-n) is 1/0^n — division by zero as well.
      if (node.fn === 'pow') {
        try {
          if (node.args[0].evaluate() === 0 && node.args[1].evaluate() < 0) found = true;
        } catch { /* not constant */ }
        return;
      }
      if (node.fn !== 'divide' && node.fn !== 'mod') return;
      try {
        if (node.args[1].evaluate() === 0) found = true;
      } catch {
        // a denominator that needs a scope isn't a constant zero
      }
    });
    return found;
  } catch {
    return false;
  }
}

// Evaluate a parenthesis-free expression one operation at a time in PEMDAS
// order — functions, then exponents (right to left), then multiplication and
// division left to right, then addition and subtraction left to right —
// pushing a step per operation with the result and the expression that
// remains. Returns false (and pushes nothing) when the expression cannot be
// worked this way, so the caller falls back to the tier description.
function showWorking(expr, steps) {
  let tree;
  try {
    tree = math.parse(expr);
  } catch {
    return false;
  }
  const isConstant = (n) => n.type === 'ConstantNode'
    || (n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args.length === 1 && n.args[0].type === 'ConstantNode')
    || (n.type === 'ParenthesisNode' && isConstant(n.content));
  const VERBS = { pow: 'Resolve the exponent', multiply: 'Multiply', divide: 'Divide', mod: 'Take the remainder', add: 'Add', subtract: 'Subtract', unaryMinus: 'Apply the leading minus' };
  // A leading minus on a worked-out value: -2^2 is -(2^2), so the sign is
  // applied after the exponent. A (−4) this routine wrote itself is a value.
  const bareMinus = (n, parent) => n.type === 'OperatorNode' && n.fn === 'unaryMinus' && n.args[0].type === 'ConstantNode' && parent?.type !== 'ParenthesisNode';
  const tiers = [
    { intro: 'Evaluate the function', pick: 'first', test: (n) => n.type === 'FunctionNode' && n.args.length > 0 && n.args.every(isConstant) },
    { intro: 'Exponents first', pick: 'last', test: (n) => n.type === 'OperatorNode' && n.fn === 'pow' && n.args.every(isConstant) },
    { intro: 'The exponent binds tighter than a leading minus, so apply the sign afterwards', pick: 'first', test: bareMinus, root: true },
    { intro: 'Multiplication and division next, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['multiply', 'divide', 'mod'].includes(n.fn) && n.args.every(isConstant) },
    { intro: 'Addition and subtraction last, left to right', pick: 'first', test: (n) => n.type === 'OperatorNode' && ['add', 'subtract'].includes(n.fn) && n.args.every(isConstant) },
  ];
  const render = (node) => node.toString({ implicit: 'show' })
    .replace(/\b\d+\.\d{5,}\b/g, (t) => formatNumber(Number(t)));
  const lines = [];
  let lastTier = -1;
  for (let guard = 0; guard < 40; guard += 1) {
    if (tree.type === 'ConstantNode' || (isConstant(tree) && !bareMinus(tree, null))) break;
    let target = null;
    let tierIndex = -1;
    for (let t = 0; t < tiers.length && !target; t += 1) {
      const matches = [];
      // The leading-minus tier applies only to the whole expression.
      if (tiers[t].root) {
        if (tiers[t].test(tree, null)) matches.push(tree);
      } else {
        tree.traverse((n, path, parent) => { if (tiers[t].test(n, parent)) matches.push(n); });
      }
      if (matches.length > 0) {
        target = tiers[t].pick === 'first' ? matches[0] : matches[matches.length - 1];
        tierIndex = t;
      }
    }
    if (!target) return false;
    let value;
    try {
      value = target.evaluate();
    } catch {
      return false;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const replacement = value < 0 && target !== tree
      ? new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [new math.ConstantNode(-value)]))
      : new math.ConstantNode(value);
    tree = target === tree ? replacement : tree.transform((n) => (n === target ? replacement : n));
    const opText = target.type === 'OperatorNode' && target.fn === 'unaryMinus' ? `-(${render(target.args[0])})` : render(target);
    let valueText = formatNumber(value);
    if (!Number.isInteger(value)) {
      try {
        const fr = exact.evaluate(opText);
        if (exact.typeOf(fr) === 'Fraction' && fr.d > 1 && fr.d <= 10000) valueText = `${fr.s < 0 ? '-' : ''}${fr.n}/${fr.d} (≈ ${formatNumber(value)})`;
      } catch { /* not rational */ }
    }
    const verb = target.type === 'FunctionNode' ? `Evaluate ${target.fn.name}` : VERBS[target.fn] || 'Work out';
    const lead = tierIndex !== lastTier ? `${tiers[tierIndex].intro}: ` : `Then ${verb.toLowerCase()}: `;
    lastTier = tierIndex;
    const remaining = isConstant(tree) ? '' : `  →  ${render(tree)}`;
    lines.push(`${lead}${opText} = ${valueText}${remaining}`);
  }
  if (!isConstant(tree)) return false;
  for (const line of lines) steps.push(line);
  return true;
}

// Describe which PEMDAS tiers remain in a parenthesis-free expression. The UI
// numbers the steps, so these read as ordered actions without "Step N" prefixes.
function describeOrder(expr, steps) {
  const hasExponent = /\^|\*\*/.test(expr);
  const hasMulDiv = /[*/×÷]/.test(expr);
  // A binary +/- between two operands (ignores a leading unary sign).
  const hasAddSub = /[\d)]\s*[-+]\s*[\d(]/.test(expr);

  if (hasExponent) steps.push('Resolve the exponents.');
  if (hasMulDiv) steps.push('Handle multiplication and division from left to right.');
  if (hasAddSub) steps.push('Add and subtract from left to right.');
}

// Exact-first display. A rational result is shown as the fraction with the
// decimal alongside ("1/2 (= 0.5)"); a constant expression in e or π keeps
// its exact form with the approximation alongside ("e^2 ≈ 7.3891"); anything
// else is the plain number. Integers stay integers.
function formatArithmeticResult(result, cleaned) {
  // Complex (sqrt(-1), ln(-1)): format each part to the decimal setting,
  // and write a clean multiple of π as such (ln(-1) = πi, not 3.14159…i).
  if (result && typeof result === 'object' && 'im' in result && typeof result.re === 'number') {
    const part = (v) => {
      const k = v / Math.PI;
      if (Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) !== 0) {
        const n = Math.round(k);
        return `${n === 1 ? '' : n === -1 ? '-' : n}π`;
      }
      return formatNumber(v);
    };
    const re = Math.abs(result.re) < 1e-12 ? '' : part(result.re);
    const imAbs = part(Math.abs(result.im));
    const im = `${result.im < 0 ? '-' : re ? '+' : ''}${imAbs === '1' ? '' : imAbs}i`;
    return re ? `${re} ${im[0]} ${im.slice(1)}` : im;
  }
  const formatted = formatNumber(result);
  if (typeof result !== 'number') return formatted;

  // Non-finite (1/0, 0/0): keep the offending quotient visible for context.
  if (!Number.isFinite(result)) {
    if (/^[^/]+\/[^/]+$/.test(cleaned) && !/[-+*×÷]/.test(cleaned.replace(/^-/, ''))) {
      return `${formatted} (${cleaned.replace(/\s+/g, '')})`;
    }
    return formatted;
  }
  if (Number.isInteger(result)) return formatted;

  // Exact rational?
  try {
    const r = exact.evaluate(cleaned);
    if (exact.typeOf(r) === 'Fraction' && r.d > 1 && r.d <= 10000) {
      const sign = r.s < 0 ? '-' : '';
      return `${sign}${r.n}/${r.d} (= ${formatted})`;
    }
  } catch {
    // not rational — fall through
  }

  // Constant expression built only from e, π, digits and operators (no
  // function calls — sin(π/6) has its own exact value, not "sin(π/6) ≈"):
  // keep the exact form, approximate alongside.
  if (/\b(?:e|pi)\b/.test(cleaned) && /^[\d\s+\-*/^().]*(?:\b(?:e|pi)\b[\d\s+\-*/^().]*)+$/.test(cleaned)) {
    return `${beautify(cleaned).replace(/pi/g, "π")} ≈ ${formatted}`;
  }

  return formatted;
}
