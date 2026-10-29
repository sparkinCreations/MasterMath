// Algebra: equations, simplify, expand and factor. This file is the entry
// point (solveAlgebra) and the equation dispatch (solveEquation), which tries
// each method in turn; the methods live in ./algebra/:
//
// - guidance.js: tips and mistakes, chosen by the method the steps used
// - rootsFormat.js: reading, checking and displaying a list of roots
// - radicals.js: exact radical forms and the quadratic-formula working
// - polynomial.js: the Rational Root Theorem, Algebrite roots with the degree check
// - specialForms.js: absolute-value and radical-isolation equations
// - expLog.js: power, exponential and logarithmic equations
// - numeric.js: the numeric search, stated as one
// - twoVariables.js: one equation solved for one of two unknowns
// - expressions.js: simplify, expand, factor, cancel

import { isEquation, extractVariable, parseMathExpression } from '../mathParser.js';
import { solveLinearEquation } from './linearEquationSolver.js';
import { parseError, unsupported, undefinedValue } from '../solutionEnvelope.js';
import {
  math,
  neverZeroSide,
  loadAlgebrite,
  beautify,
  formatNumber,
  sampleFunction,
  mark,
  realOddRoots,
  absBars,
} from './solverUtils.js';
import { equationGuidance } from './algebra/guidance.js';
import { solveWithAlgebriteRoots, rootsViaPolynomialRoot } from './algebra/polynomial.js';
import { solveAbsoluteValueEquation, solveViaRadicalIsolation } from './algebra/specialForms.js';
import {
  solveSingleExponential,
  solveViaExpSubstitution,
  solveViaLogSubstitution,
  solvePowerEquation,
} from './algebra/expLog.js';
import { solveNumerically } from './algebra/numeric.js';
import { solveForVariable } from './algebra/twoVariables.js';
import {
  factorExpression,
  expandExpression,
  simplifyExpression,
  generateAlgebraGraph,
} from './algebra/expressions.js';

export { splitRootsList, parseRootsList, prettyRadicals } from './algebra/rootsFormat.js';

// A division whose denominator is the constant 0 (x/0, (x + 1)/(2 − 2)):
// undefined at every point, so the equation has no solution. Returns the
// offending term as text, or null. Without this, x/0 = 1 was "beyond what
// this solver can compute".
function divisionByZeroInEquation(expression) {
  let found = null;
  try {
    const tree = math.parse(parseMathExpression(expression).replace(/(?<![<>!=])=(?!=)/, '=='));
    tree.traverse((node) => {
      if (found || node.type !== 'OperatorNode' || node.op !== '/') return;
      const denominator = node.args[1];
      if (denominator.filter((n) => n.type === 'SymbolNode' && !['pi', 'e'].includes(n.name)).length) return;
      try {
        if (math.evaluate(denominator.toString()) === 0) found = beautify(node.toString()).replace(/\s*\/\s*/g, '/');
      } catch { /* not a number: leave it to the solver */ }
    });
  } catch {
    return null;
  }
  return found;
}

// The second insight of a factored, expanded or simplified expression is the
// student's own result (an outside review, 1.62.0: "factor x² − 9 should show
// (x − 3)(x + 3)"): the expression as typed, then the form it became.
function withWorkedExpression(result, expression) {
  if (!result || !Array.isArray(result.tips) || result.tips.length === 0 || result.status && result.status !== 'solved') return result;
  const typed = beautify(expression.replace(/^\s*(?:factor|expand|simplify)\s+/i, '').trim()).replace(/\bsqrt\((\d+)\)/g, '√$1').replace(/\bsqrt\(/g, '√(');
  const answer = String(result.answer || '').replace(/\s*\(≈[^)]*\)/, '').trim();
  const [form, condition] = answer.split(/,\s*for\s+/);
  if (!form || /[a-z]{4,}/i.test(form.replace(/\b(?:sqrt|ln|log|sin|cos|tan|exp)\b/g, '')) || form.replace(/\s+/g, '') === typed.replace(/\s+/g, '')) return result;
  const here = `Here: ${mark(`${typed} = ${form}`)}${condition ? `, for ${mark(condition)}` : ''}.`;
  return { ...result, tips: [result.tips[0], here, ...result.tips.slice(1)] };
}

export async function solveAlgebra(expression, options = {}) {
  try {
    // Two-equation systems are handled upstream (api.js routes them to the
    // systems solver from the raw text). If a multi-equation string still
    // reaches here — e.g. a stray separator the router didn't count as a
    // system — refuse clearly rather than mangling it into one expression.
    // A trailing separator ("x^2 = 4;") is a typing habit, not a second
    // equation: drop it rather than refusing a perfectly good equation.
    // (September 2026 audit row A25.)
    expression = expression.replace(/[;\n\s]+$/, '');
    const equalsCount = (expression.match(/(?<![><!=])=(?!=)/g) || []).length;
    if (/[;\n]/.test(expression) || equalsCount >= 2) {
      // A refusal must carry a refusal status. This used to be a bare object,
      // which finalizeResult's legacy shim stamped "solved".
      return parseError({
        input: expression,
        hint: 'This looks like more than one equation.',
        steps: [
          'This looks like more than one equation.',
          'For a 2×2 system, use two equations separated by a semicolon, e.g. 2x + 3y = 6; x − y = 4.',
          'For a single equation, enter just one, e.g. 2x + 5 = 11.',
        ],
        answer: 'Please enter either one equation, or a 2×2 system as "eq1; eq2"',
        tips: ['A 2×2 system needs exactly two equations in two variables.'],
        common_mistakes: ['A stray semicolon or extra “=” in a single-equation entry.'],
      });
    }

    // "factor x^2 - 9": the expression extractor strips the verb, so the
    // intent arrives separately from the API layer. Without it, factoring
    // requests fell into the simplify path — and x^2 - 9 is already "simple",
    // so the input was just echoed back.
    if (options.intent === 'factor' && !isEquation(expression)) {
      const factored = await factorExpression(expression);
      if (factored) return withWorkedExpression(factored, expression);
    }
    if (options.intent === 'expand' && !isEquation(expression)) {
      const expanded = await expandExpression(expression);
      if (expanded) return withWorkedExpression(expanded, expression);
    }

    if (isEquation(expression)) {
      const zero = divisionByZeroInEquation(expression);
      if (zero) {
        // Undefined, as 1/0 is: the equation is not false at some x, it
        // has no meaning at any.
        const result = undefinedValue({
          input: expression,
          steps: [
            `Solve the equation: ${mark(beautify(expression).replace(/\s*=\s*/, ' = '))}`,
            `The term ${mark(zero)} divides by ${mark('0')}, and division by zero is undefined for every value of the variable.`,
            'An equation with an undefined side cannot be true, so no value satisfies it.',
          ],
          tips: [`Check the denominator: a ${mark('0')} there usually means a typing slip, such as ${mark('x/0')} for ${mark('x/10')}.`],
          common_mistakes: [`Multiplying both sides by ${mark('0')} to clear the fraction: that turns ${mark('x/0 = 1')} into ${mark('x = 0')}, a step that is not allowed.`],
        });
        result.answer = `Undefined — ${zero} divides by zero, so no value satisfies the equation`;
        return result;
      }
      return await solveEquation(expression, options);
    }
    return withWorkedExpression(await simplifyExpression(expression), expression);
  } catch (error) {
    console.error('Algebra solver error:', error);
    return {
      steps: [
        `Identify the expression: ${beautify(expression)}`,
        'Apply algebraic rules to simplify',
      ],
      answer: beautify(expression),
      tips: ['Use "*" for multiplication (e.g., "2*x")', 'Use "^" for exponents (e.g., "x^2")'],
      common_mistakes: ['Using incorrect notation', 'Missing operators'],
      graph: isEquation(expression) ? null : generateAlgebraGraph(expression),
    };
  }
}

async function solveEquation(expression, options = {}) {
  const variable = extractVariable(expression);
  let steps = [];
  let answer = '';
  let solutions = [];

  // An "=" with nothing on one side is not an equation ("=", "x =", "= 5"):
  // say so, rather than "No real solution found" from scanning () - () = 0.
  const [lhsRaw = '', rhsRaw = ''] = expression.split('=');
  if (!lhsRaw.trim() || !rhsRaw.trim()) {
    return parseError({
      input: expression,
      hint: 'An equation needs an expression on both sides of "=".',
      tips: [`For example: ${mark('2x + 5 = 11')}, or ${mark('x^2 - 4 = 0')}.`],
    });
  }

  // One equation in two (or more) unknowns — "2x + 3y = 6", "y - 3 = 2x
  // (solve for y)" — describes a relationship, not a number. Solve for the
  // requested unknown (or the first one) IN TERMS OF the others, and say so.
  // The old path took the first letter as "the" variable and, via the y=…
  // extractor, once answered "6".
  const letters = new Set(
    (expression.replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|nthRoot|nthroot|abs|log|log10|log2|ln|exp|pi|e)\b/gi, '')
      .match(/[a-z]/gi) || []).map((c) => c.toLowerCase())
  );
  if (letters.size >= 2) {
    // With no "solve for", an equation in x and y is solved for y, as a
    // textbook does: 2x + 3y = 6 reads as the line y = −2x/3 + 2, not
    // x = −3y/2 + 3. When y cannot be isolated, x is tried instead.
    const asked = options.solveFor && letters.has(options.solveFor) ? options.solveFor : null;
    const xy = letters.size === 2 && letters.has('x') && letters.has('y');
    let requested = asked || (xy ? 'y' : letters.has('y') && !letters.has('x') ? 'y' : variable);
    let solved = await solveForVariable(expression, requested);
    if (!solved?.relation && !asked && requested !== variable) {
      requested = variable;
      solved = await solveForVariable(expression, requested);
    }
    const others = [...letters].filter((v) => v !== requested).sort();
    const rel = solved?.relation;
    if (rel) {
      const vars = (list) => list.map((v) => mark(v)).join(' and ');
      return {
        steps: [
          `This is one equation in ${letters.size} unknowns (${[...letters].sort().map((v) => mark(v)).join(', ')}) — it has infinitely many solutions, one for every value of ${vars(others)}. So we solve for ${mark(requested)} in terms of ${vars(others)}.`,
          `Rewrite as an equation set to zero: ${mark(`${beautify(`(${lhsRaw.trim()}) - (${rhsRaw.trim()})`)} = 0`)}`,
          ...(solved.droppedComplex ? [`Over the real numbers, keep the real roots (the others involve ${mark('i')}, the imaginary unit).`] : []),
          `Isolate ${mark(requested)}: ${mark(rel)}`,
          `Check: substituting each root back into ${mark(beautify(expression))} balances both sides wherever the root is a real number ✓`,
        ],
        answer: rel,
        tips: [
          `To pin down a single value you need a second equation — enter both as a system, e.g. "${expression.trim()}; ${requested} - ${others[0]} = 1".`,
          'An equation in two unknowns is a curve (here a line if it is linear); solving for one variable gives the rule for that curve.',
        ],
        common_mistakes: ['Expecting a single number from an equation with more unknowns than equations.'],
        graph: null,
      };
    }
    return unsupported({
      input: expression,
      reason: `This is one equation in ${letters.size} unknowns (${[...letters].sort().join(', ')}) and it could not be rearranged for ${requested} symbolically.`,
      answer: `Infinitely many solutions — one equation cannot fix ${letters.size} unknowns`,
      tips: [`Add a second equation and enter both as a system: "${expression.trim()}; ${[...letters].sort()[0]} - ${[...letters].sort()[1]} = 1".`],
    });
  }

  // 0. |g(x)| = c: the two-case rule. The numeric root scan found x = −1 and
  // x = 4 for |2x − 3| = 5 but explained it as "search for where the
  // expression crosses zero" — the answer without the governing idea
  // (September 2026 review, batch 2).
  const viaAbs = await solveAbsoluteValueEquation(expression, variable);
  if (viaAbs) {
    ({ steps, answer, solutions } = viaAbs);
  }

  // 1. Linear equations: the textbook inverse-operations walkthrough in exact
  // fractions (clear fractions or distribute, collect, isolate, divide).
  // Quadratics go to the Algebrite path below, which shows the factoring or
  // the discriminant and formula.
  if (!answer) {
    const viaLinear = solveLinearEquation(expression, variable);
    if (viaLinear) {
      ({ steps, answer, solutions } = viaLinear);
    }
  }

  // 1a. One exponential with a linear exponent — e^(2x) = 7, 3·2^(x+1) − 4
  // = 20 — is isolated and both sides are logged: x = ln(7)/2, not ln(√7)
  // from the substitution below, nor 0.5365 from the numeric scan for
  // e^(3x) = 5 (October 2026 test list).
  if (!answer) {
    const viaLog = solveSingleExponential(expression, variable);
    if (viaLog) {
      ({ steps, answer, solutions } = viaLog);
    }
  }

  // 1b. A polynomial in e^x — e^(2x) − 3e^x + 2 = 0 — is solved by the
  // substitution u = e^x, so the answer is ln 2, not 0.6931 from the numeric
  // scan. (September 2026 audit row G09.)
  if (!answer) {
    const viaU = await solveViaExpSubstitution(expression, variable);
    if (viaU) {
      ({ steps, answer, solutions } = viaU);
    }
  }

  // 1c. An equation in logarithms — ln(x) = 1, ln(x)² = 4, log(x) + log(x − 3)
  // = 1 — is solved exactly by substituting u for the logarithm (one
  // argument) or combining the logarithms into one (several arguments), so
  // the answer is e, not 2.7183 from the numeric scan.
  if (!answer) {
    const viaLog = await solveViaLogSubstitution(expression, variable);
    if (viaLog) {
      ({ steps, answer, solutions } = viaLog);
    }
  }

  // 1d. One square root of the variable — sqrt(x + 2) = x — is isolated,
  // the domain stated, both sides squared, the polynomial solved, and every
  // candidate checked in the original so the extraneous root is rejected
  // with the reason shown (the numeric scan gave the answer with none of it).
  if (!answer) {
    const viaRadical = await solveViaRadicalIsolation(expression, variable);
    if (viaRadical) {
      ({ steps, answer, solutions } = viaRadical);
    }
  }

  // 1e. One power with a fractional exponent — x^(1/3) = −2, x^(2/3) = 4 —
  // isolated and raised to the reciprocal power, exactly. The zero-crossing
  // scan answered x^(1/3) = 0 and x^(1/3) = −2 "No real solution found"
  // (mathjs's cube root of a negative number is complex) and x^(2/3) = 4
  // with x = 8 alone (October 26).
  if (!answer) {
    const viaPower = solvePowerEquation(expression, variable);
    if (viaPower) {
      ({ steps, answer, solutions } = viaPower);
    }
  }

  // 2. Algebrite roots — exact solutions (integers, fractions, radicals, complex)
  // for anything the linear path did not take, e.g. x^2 = 9.
  if (!answer) {
    const viaAlgebrite = await solveWithAlgebriteRoots(expression, variable);
    if (viaAlgebrite?.envelope) return viaAlgebrite.envelope;
    if (viaAlgebrite) {
      ({ steps, answer, solutions } = viaAlgebrite);
    }
  }

  // 2b. A polynomial is never left to the zero-crossing scan, which can miss
  // roots lying close together: every root comes from the exact path.
  if (!answer && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    const viaExact = rootsViaPolynomialRoot(null, `(${lhs.trim()}) - (${rhs.trim()})`, variable);
    if (viaExact?.envelope) return viaExact.envelope;
    if (viaExact) ({ steps, answer, solutions } = viaExact);
  }

  // 2c. x/(x − 1) = 1: clearing the denominators leaves 1 = 0, a
  // contradiction — no solution, with the reason. It reached the numeric
  // scan and was answered "No real solution found", which proves nothing.
  // (Last before the scan: x/(x − 2) = 2/(x − 2) is taught above, its
  // candidate x = 2 rejected as extraneous; 1/x = 0 is "never 0" below.)
  if (!answer && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    if (new RegExp(`/\\s*\\(?[^()]*\\b${variable}\\b`).test(expression) && !neverZeroSide(lhs.trim(), rhs.trim(), variable)) {
      const Algebrite = await loadAlgebrite();
      let numerator = '';
      let difference = '';
      try {
        difference = String(Algebrite.run(`simplify((${lhs.trim()}) - (${rhs.trim()}))`)).trim();
        numerator = String(Algebrite.run(`numerator(rationalize((${lhs.trim()}) - (${rhs.trim()})))`)).trim();
      } catch { numerator = ''; }
      // A difference that is itself a constant (x/(x − 2) = 2/(x − 2)) has
      // its own wording below: the sides differ by 1 everywhere.
      const constantDifference = !new RegExp(`(?<![a-z])${variable}(?![a-z])`).test(difference);
      if (!constantDifference && /^-?\d+(?:\/\d+)?$/.test(numerator) && numerator !== '0') {
        steps = [`Multiply through by the denominators to clear the fractions: ${mark(`${beautify(numerator)} = 0`)}, which is false for every ${mark(variable)}.`, 'Solution: no real solution'];
        answer = `No real solution (clearing the denominators leaves ${beautify(numerator)} = 0)`;
        solutions = [];
      }
    }
  }

  // 3. Numeric root-finding — last resort.
  if (!answer) {
    const numeric = solveNumerically(expression, variable);
    // An expression that could not be evaluated anywhere is a refusal, not a
    // result; it is returned as its own envelope rather than an answer.
    if (numeric.envelope) return numeric.envelope;
    steps = numeric.steps;
    answer = numeric.answer;
    solutions = numeric.solutions;
  }

  // Extraneous roots. Clearing a denominator symbolically (Algebrite roots)
  // can manufacture a "solution" at which the ORIGINAL equation is undefined: x²/(x−1) = 1/(x−1) + 1
  // yields x = 0 or x = 1, and x = 1 makes both denominators zero. Every
  // real solution is substituted into the original sides; any that leaves a
  // side undefined is dropped, and the step says why.
  if (solutions.length > 0 && isEquation(expression)) {
    const [lhs, rhs] = expression.split('=');
    const definedAt = (side, x) => {
      try {
        // (−8)^(2/3) is 4: the real odd root, not mathjs's complex one.
        const v = math.evaluate(realOddRoots(side), { [variable]: x });
        return typeof v === 'number' && Number.isFinite(v);
      } catch {
        return false;
      }
    };
    const extraneous = solutions.filter((x) => Number.isFinite(x) && (!definedAt(lhs, x) || !definedAt(rhs, x)));
    if (extraneous.length > 0) {
      const keep = solutions.filter((x) => !extraneous.includes(x));
      const kept = keep.map((x) => `${variable} = ${formatNumber(x)}`);
      steps = [
        ...steps,
        `Check each candidate in the ORIGINAL equation: ${extraneous.map((x) => `${variable} = ${formatNumber(x)}`).join(', ')} leave${extraneous.length === 1 ? 's' : ''} the original equation undefined (a denominator of zero, or an even root or logarithm of a negative number), so ${extraneous.length === 1 ? 'it is' : 'they are'} extraneous and ${extraneous.length === 1 ? 'is' : 'are'} rejected.`,
        keep.length > 0 ? `Solution: ${kept.join('  or  ')}` : 'No solution: every candidate is extraneous.',
      ];
      answer = keep.length > 0 ? kept.join('  or  ') : 'No solution (every candidate makes the original equation undefined)';
      solutions = keep;
    }
  }

  // Verify by substitution, and show it: the check a student is expected to
  // do, and the proof that the listed solutions are solutions.
  if (solutions.length > 0 && solutions.length <= 4 && isEquation(expression) && !steps.some((st) => /^Check /.test(st))) {
    const [lhs, rhs] = expression.split('=');
    const at = (side, x) => {
      try {
        const y = math.evaluate(side, { [variable]: x });
        return typeof y === 'number' && Number.isFinite(y) ? y : null;
      } catch {
        return null;
      }
    };
    const checks = solutions
      .filter(Number.isFinite)
      .map((x) => ({ x, l: at(lhs, x), r: at(rhs, x) }))
      .filter((c) => c.l !== null && c.r !== null && Math.abs(c.l - c.r) <= 1e-6 * (1 + Math.abs(c.l)));
    if (checks.length === solutions.filter(Number.isFinite).length && checks.length > 0) {
      steps = [
        ...steps,
        `Check in the original equation: ${checks.map((c) => `${variable} = ${formatNumber(c.x)} gives ${absBars(beautify(lhs.trim()))} = ${formatNumber(c.l)} and ${absBars(beautify(rhs.trim()))} = ${formatNumber(c.r)}`).join('; ')} ✓`,
      ];
    }
  }

  const guidance = equationGuidance(steps, expression, answer);
  return {
    steps: steps.length > 0 ? steps : [`Solve ${beautify(expression)}`, `Result: ${answer}`],
    answer,
    tips: guidance.tips,
    common_mistakes: guidance.common_mistakes,
    graph: solutions.length > 0 ? generateEquationGraph(expression, solutions) : null,
  };
}

function generateEquationGraph(equation, solutions) {
  try {
    const [left, right = '0'] = equation.split('=');
    const variable = extractVariable(equation);
    const points = sampleFunction(left.trim(), variable);
    if (points.length === 0) return null;

    const solutionText =
      solutions.length === 1
        ? `Solution at ${variable} = ${formatNumber(solutions[0])}`
        : `Solutions at ${variable} = ${solutions.map((s) => formatNumber(s)).join(', ')}`;

    return {
      points,
      expression: left.trim(),
      variable,
      solutions,
      title: `Graph of ${beautify(left.trim())}`,
      description: `${solutionText} (where the curve crosses y = ${beautify(right.trim())})`,
    };
  } catch (error) {
    console.error('Equation graph generation error:', error);
    return null;
  }
}
