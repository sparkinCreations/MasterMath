// The solve router: solveProblem reads plain English, refuses malformed
// input, picks the topic under Auto-detect and routes by intent, then passes
// every result through finalizeResult. The pieces it uses are in ./api/:
//
// - topic.js: Auto-detect and the routing tests
// - words.js: unknown words, their hints, word problems
// - requests.js: request phrases, "at x = a", f'(x), dy/dx of an equation
// - finalize.js: the result gate and the routing note

import { extractFunctionFromProblem, parseMathExpression, extractVariable } from './mathParser.js';
import { STATUS, parseError, solved, unsupported } from './solutionEnvelope.js';
import { bareFunctionName, bareFunctionRefusal, beautify } from './solvers/solverUtils.js';
import { mark } from './mathMarkers.js';
import { readPlainEnglish } from './plainEnglish.js';
import { syntaxProblem } from './syntaxCheck.js';
import {
  detectTopic,
  detectCalculusIntent,
  looksLikeInequality,
  looksLikeSystem,
  isPlainEquationForAlgebra,
  isComplexNumberInput,
  isAlgebraUnderArithmetic,
  GRAPH_VERB,
  graphVerb,
  constantDividesByZero,
  isConstantInput,
  isArithmeticUnderTrigonometry,
  isSingleTrigEquation,
} from './api/topic.js';
import {
  unknownWord,
  unknownWordHint,
  looksLikeWordProblem,
  wordProblemRefusal,
  unknownWordInProblem,
  unknownWordError,
} from './api/words.js';
import {
  readRequestPhrases,
  implicitDerivativeRequest,
  primedFunctionRequest,
  renameFunction,
  extractEvalPoint,
} from './api/requests.js';
import { finalizeResult, noteRouting, TOPIC_NAMES } from './api/finalize.js';

export { detectTopic, isComplexNumberInput } from './api/topic.js';
export { isPresentable, COMMON_LOG_TIP, finalizeResult } from './api/finalize.js';

async function loadSolver(topic) {
  switch (topic) {
    case 'algebra':
      return (await import('./solvers/algebraSolver.js')).solveAlgebra;
    case 'derivatives':
      return (await import('./solvers/derivativesSolver.js')).solveDerivative;
    case 'integrals':
      return (await import('./solvers/integralsSolver.js')).solveIntegral;
    case 'limits':
      return (await import('./solvers/limitsSolver.js')).solveLimit;
    case 'trigonometry':
      return (await import('./solvers/trigonometrySolver.js')).solveTrigonometry;
    case 'functions':
      return (await import('./solvers/functionsSolver.js')).solveFunctions;
    case 'other':
      return (await import('./solvers/arithmeticSolver.js')).solveArithmetic;
    default:
      return null;
  }
}

async function resolveSolver(problem, topic) {
  const solver = await loadSolver(topic);
  if (solver) {
    return solver;
  }

  const lower = problem.toLowerCase();
  if (lower.includes('derivative') || lower.includes('differentiate')) {
    return loadSolver('derivatives').then((fn) => fn);
  }
  if (lower.includes('integral') || lower.includes('integrate')) {
    return loadSolver('integrals').then((fn) => fn);
  }
  if (lower.includes('limit') || lower.includes('lim')) {
    return loadSolver('limits').then((fn) => fn);
  }

  const expression = extractFunctionFromProblem(problem);
  if (lower.includes('graph') || expression.includes('f(')) {
    return loadSolver('functions').then((fn) => fn);
  }

  return loadSolver('algebra').then((fn) => fn);
}

// The request read by readRequestPhrases, solved by requestSolver.js and
// finalized. An unknown word in the expression is a parse error, as on
// every other path.
async function solveRequest(request, problem) {
  const solvers = await import('./solvers/requestSolver.js');
  if (request.kind === 'angle') return finalizeResult(asResult(solvers.convertAngle(request.value, request.from)), problem);
  if (['prime', 'factorization', 'round'].includes(request.kind)) {
    const numbers = await import('./solvers/numberSolver.js');
    const result = request.kind === 'prime' ? numbers.primeCheck(request.value)
      : request.kind === 'factorization' ? numbers.primeFactorization(request.value)
        : numbers.roundNumber(request.value, request.spec);
    return finalizeResult(asResult(result), problem);
  }
  const expression = parseMathExpression(extractFunctionFromProblem(request.expression));
  const word = unknownWord(expression);
  if (word) return finalizeResult(parseError({ input: request.expression, hint: unknownWordHint(word) }), problem);
  const variable = request.variable || extractVariable(expression);
  let result;
  if (request.kind === 'period') result = solvers.periodOf(expression, variable);
  else if (request.kind === 'amplitude') result = solvers.amplitudeOf(expression, variable);
  else if (request.kind === 'tangent') result = await solvers.tangentLine(expression, variable, request.point, request.givenY);
  else if (request.kind === 'average' || request.kind === 'extrema') {
    const interval = await import('./solvers/intervalSolver.js');
    result = request.kind === 'average'
      ? await interval.averageValue(expression, variable, request.a, request.b, solveProblem)
      : await interval.extremaOnInterval(expression, variable, request.a, request.b, request.which, solveProblem);
  } else {
    const { solveAlgebra } = await import('./solvers/algebraSolver.js');
    result = await solvers.inverseOf(expression, variable, solveAlgebra);
  }
  return finalizeResult(asResult(result), problem);
}
const asResult = (r) => (r.status ? r : solved(r));

// Real math solver using local libraries
// "x^2 + 1 at x = 3": substitute the value and evaluate as arithmetic, with
// the substitution shown as a step.
async function evaluateAtPoint({ rest, variable, valueText }) {
  // parseMathExpression is imported statically at the top of this file.
  const expression = parseMathExpression(extractFunctionFromProblem(rest));
  const substituted = expression.replace(new RegExp(`(?<![a-z])${variable}(?![a-z(])`, 'gi'), `(${valueText})`);
  const { solveArithmetic } = await import('./solvers/arithmeticSolver.js');
  const result = await solveArithmetic(substituted);
  if (result.status && result.status !== STATUS.SOLVED) return result;
  const shownExpr = beautifyText(expression);
  return {
    ...result,
    steps: [
      `Evaluate f(${variable}) = ${shownExpr} at ${variable} = ${valueText}.`,
      `Substitute ${variable} = ${valueText}: ${beautifyText(substituted)}`,
      ...(result.steps || []),
    ],
    answer: `f(${valueText}) = ${result.answer}`,
  };
}

const beautifyText = (s) => String(s).replace(/\*/g, '·').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³');

export async function solveProblem(problem, topic) {
  try {
    // Validate inputs
    if (!problem || typeof problem !== 'string') {
      throw new Error('Invalid problem input');
    }

    if (!topic || typeof topic !== 'string') {
      throw new Error('Invalid topic selection');
    }

    // "x squared", "e to the x", "is greater than", "x**3" → notation,
    // before routing reads it (plainEnglish.js).
    problem = readPlainEnglish(problem);
    // The request phrases students type around the maths: "the", "the
    // expression", "the quadratic equation", "the zeros of". Each word was
    // glued to the maths and refused as one unknown word, or worse:
    // "simplify the expression (x^2-1)/(x-1)" was answered
    // "theexpression(x^2 - 1)/(x - 1)", marked Solved; "calculate the definite
    // integral of x^2 from 0 to 3" was refused as improper (October 2026
    // review sweep).
    const request = readRequestPhrases(problem);
    // Malformed typing — "2+*", "x^2 +", "sin()", "2 # 3" — is refused here,
    // once, before any topic or request reads it (syntaxCheck.js). Each path
    // used to check for itself, and what one refused another answered,
    // marked Solved. After the word-problem test: that one reads prose.
    if (!looksLikeWordProblem(request.problem)) {
      const bad = syntaxProblem(request.problem);
      if (bad) return finalizeResult(parseError({ input: problem, hint: bad.hint, tips: bad.tips }), problem);
    }
    if (request.topic) {
      const routed = request.request ? await solveRequest(request.request, problem) : await solveProblem(request.problem, request.topic);
      if (topic === request.topic) return routed;
      if (topic !== 'auto') return noteRouting(routed, topic, request.topic, request.reason);
      // Under Auto-detect: the same notice and record as a detected topic.
      if (!routed || !Array.isArray(routed.steps) || routed.status === 'parse_error') return routed;
      const reason = request.reason.replace(/^the input\b/i, 'your input');
      routed.steps = [`Detected as ${TOPIC_NAMES[request.topic]}: ${reason}.`, ...routed.steps];
      routed.routing = { from: 'auto', to: request.topic, reason, detected: true };
      routed.routedTopic = request.topic;
      return routed;
    }
    problem = request.problem;

    // "area under the curve x^2 from 0 to 1" is the definite integral, with
    // a tip that it is the net area.
    const areaUnder = /^\s*(?:find\s+)?(?:the\s+)?area\s+under\s/i.test(problem);
    if (areaUnder) {
      const result = await solveProblem(problem.replace(/^\s*(?:find\s+)?(?:the\s+)?area\s+under\s+(?:the\s+)?(?:curve\s+|graph\s+)?(?:of\s+)?(?:y\s*=\s*|f\s*\(\s*x\s*\)\s*=\s*)?/i, 'integral of '), topic);
      if (result?.status === 'solved' && Array.isArray(result.tips)) {
        result.tips = ['The area under a curve is its definite integral. Where the curve dips below the x-axis, that part counts as negative, so the integral is the net area; for the total area, integrate the absolute value.', ...result.tips];
      }
      return result;
    }

    if (looksLikeWordProblem(problem)) return finalizeResult(wordProblemRefusal(problem), problem);

    // Auto-detect: solve under the topic the input asks for, and say which.
    // The detected topic's own routing may move it again (a verb, a constant
    // that divides by zero); the final topic is the one reported and saved.
    if (topic === 'auto') {
      const detected = detectTopic(problem);
      const result = await solveProblem(problem, detected.topic);
      // A parse error was not solved as anything: no notice.
      if (!result || !Array.isArray(result.steps) || result.status === 'parse_error') return result;
      const to = result.routing?.to || detected.topic;
      const reason = result.routing?.reason ? result.routing.reason.replace(/^the input\b/i, 'your input') : detected.reason;
      const steps = result.routing ? result.steps.slice(1) : result.steps;
      result.steps = [`Detected as ${TOPIC_NAMES[to]}: ${reason}.`, ...steps];
      result.routing = { from: 'auto', to, reason, detected: true };
      result.routedTopic = to;
      return result;
    }

    let result;

    // f(x) = … (or g, h, y = …) under Integrals integrates the right side, as
    // Derivatives differentiates it; it came back "x^2", marked Solved.
    if (topic === 'integrals') {
      const def = String(problem).match(/^\s*(?:[fgh]\s*\(\s*[a-z]\s*\)|y)\s*=(?!=)\s*(.+)$/i);
      if (def && !/[=<>≤≥]/.test(def[1]) && !/(?<![a-z])y(?![a-z])/i.test(def[1])) {
        return solveProblem(def[1], 'integrals');
      }
    }

    // Parametric and polar curves are outside every solver family. "derivative
    // of x = t^2, y = t^3" was answered f'(x) = 0, marked solved (October
    // 2026 sweep); "r = 2cos(theta)" was refused as an unknown word.
    {
      const t = String(problem);
      const param = t.match(/(?<![a-z])x\s*=\s*([^,;=]+?)\s*(?:,|;|\band\b)\s*y\s*=\s*([^,;=]+)/i);
      const usesParameter = (side) => /(?<![a-z])(?:t|θ|theta)(?![a-z])/i.test(side);
      if (param && usesParameter(param[1]) && usesParameter(param[2])) {
        return finalizeResult(unsupported({
          input: problem,
          reason: 'This is a parametric curve: x and y are both given in terms of a parameter. Parametric curves are not supported yet; the solver works with y as a function of x.',
          answer: 'Parametric curves are not supported yet',
          tips: [`For the slope of a parametric curve a textbook uses ${mark('dy/dx = (dy/dt)/(dx/dt)')}: each of those is a derivative you can enter here, "t^3" and "t^2" under Derivatives.`],
        }), problem);
      }
      if (/^\s*(?:(?:graph|plot|sketch)\s+)?r\s*=.*(?:θ|\btheta\b)/i.test(t)) {
        return finalizeResult(unsupported({
          input: problem,
          reason: 'This is a polar curve, r as a function of θ. Polar curves are not supported yet; the solver works with y as a function of x.',
          answer: 'Polar curves are not supported yet',
        }), problem);
      }
    }

    // dy/dx of an equation in x and y, before the differential-equation
    // check below: "find dy/dx if x^2 + y^2 = 25" names dy/dx but is not one.
    const implicit = implicitDerivativeRequest(problem, topic);
    if (implicit) {
      if (implicit.explicit) {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(implicit.explicit);
        const evalAt = implicit.point !== null ? { variable: implicit.variable, valueText: implicit.point } : undefined;
        result = await solveDerivative(expression, { variable: implicit.variable, evalAt });
      } else {
        const { solveImplicitDerivative } = await import('./solvers/implicitDerivativeSolver.js');
        result = await solveImplicitDerivative(implicit.lhs, implicit.rhs, implicit);
      }
      return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', `the input asks for the derivative of an equation in ${implicit.explicit ? implicit.variable : `${implicit.independent} and ${implicit.dependent}`}`), problem);
    }

    // Differential equations (y'' + y = 0, dy/dx = 2x) and matrices are
    // outside every solver family. Refused up front, honestly: the algebra
    // path read y'' + y = 0 as 0 and called it solved (October 2026 review).
    {
      const t = String(problem);
      // A primed call — f'(x), y''(t) — is read by primedFunctionRequest: a
      // derivative when the input defines the function, else an ODE or a
      // function that was never given. A bare prime (y'' + y = 0) is an ODE.
      // (The lookahead sits after the whole prime run, so the regex cannot
      // back off to a shorter run to dodge it.)
      const fn = primedFunctionRequest(t);
      if (fn?.kind === 'derivative') {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(fn.expression);
        const evalAt = fn.point !== null ? { variable: fn.variable, valueText: fn.point } : undefined;
        result = renameFunction(await solveDerivative(expression, { order: fn.order, variable: fn.variable, evalAt }), fn.name);
        return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input asks for a derivative'), problem);
      }
      if (fn?.kind === 'undefined') {
        const call = fn.call.replace(/\s+/g, '');
        const arg = (call.match(/\(([a-z])\)$/i) || [null, 'x'])[1];
        const example = `${fn.name}${"'".repeat(Math.max(1, fn.order))}(${arg}) where ${fn.name}(${arg}) = ${arg}^3`;
        return finalizeResult(unsupported({
          input: problem,
          reason: `${call} ${fn.order ? 'is a derivative of' : 'names'} a function ${fn.name}, and the input does not say what ${fn.name} is. Enter the function itself, or define it in the same input.`,
          answer: `The function ${fn.name} is not given`,
          tips: [
            'Under Derivatives, type the function itself: "x^3" gives its derivative, and "x^3 at x = 2" its value there.',
            `Or define it: "${example}".`,
          ],
        }), problem);
      }
      const primed = fn?.kind === 'ode' || /(?<![a-z])[a-z]\s*(?:'+|′+|″|‴)(?!['′″‴]|\s*\()/.test(t);
      const leibniz = /\bd[a-z]\s*\/\s*d[a-z]\b/i.test(t);
      if (primed || leibniz) {
        return finalizeResult(unsupported({
          input: problem,
          reason: `${beautify(t)} is a differential equation: it relates a function to its own derivative${primed ? " (the ' marks a derivative)" : ' (dy/dx is the derivative of y)'}. Solving differential equations is not supported; the solver differentiates and integrates functions you give it.`,
          answer: 'Differential equations are not supported',
          tips: [
            'To differentiate a function, enter it under Derivatives: "x^3", or "d/dx(x^3)".',
            fn?.rhs
              ? `This one only gives the derivative, so ${fn.name} is an antiderivative of the other side: integrate it under Integrals, "∫ ${fn.rhs} dx", and the answer is that plus a constant C.`
              : 'To find a function from its derivative, integrate it under Integrals: "∫ 2x dx".',
          ],
        }), problem);
      }
      // "[1, 2]" alone is a vector; it was echoed back as the answer, and
      // "integrated" to [x, 2x] + C.
      if (/^\s*\[[^\]]*\]\s*$|\[\s*\[|\b(?:matrix|matrices|determinant|eigenvalues?|eigenvectors?|transpose|vectors?)\b/i.test(t)) {
        return finalizeResult(unsupported({
          input: problem,
          reason: 'Vectors and matrices (determinants, inverses, eigenvalues, products) are not supported yet. The solver covers arithmetic, algebra, systems of equations, inequalities, trigonometry, functions, limits, derivatives and integrals.',
          answer: 'Vectors and matrices are not supported yet',
          tips: ['A system of linear equations can be solved as equations: "2x + 3y = 6; x - y = 4".'],
        }), problem);
      }
    }

    // Higher-order derivatives and "with respect to": read from the raw text
    // and handed to the derivative solver as options. "second derivative of
    // x^3" was answering the FIRST derivative; "d^2/dx^2 x^3" was garbage.
    const derivOpts = {};
    {
      const t = String(problem);
      const ord = t.match(/\b(second|third|fourth|2nd|3rd|4th)\s+derivative\b/i) || t.match(/\bd\s*(?:\^\s*(\d)|([²³])|(\d))\s*\/\s*d[a-z]\s*(?:\^\s*\d|[²³]|\d)/i) || t.match(/\b[a-z]('{2,}|′{2,}|″|‴)\s*\(/);
      if (ord) {
        const word = ord[1] || ord[2] || ord[3] || '';
        derivOpts.order = /^(second|2nd|2|²)$/i.test(word) ? 2 : /^(third|3rd|3|³)$/i.test(word) ? 3 : /^(fourth|4th|4)$/i.test(word) ? 4 : /^(''|′′|″)$/.test(word) ? 2 : /^('''|′′′|‴)$/.test(word) ? 3 : 1;
      }
      const wrt = t.match(/\bwith\s+respect\s+to\s+([a-z])\b/i);
      if (wrt) derivOpts.variable = wrt[1].toLowerCase();
    }
    const stripDerivPhrases = (t) => String(t)
      .replace(/\bwith\s+respect\s+to\s+[a-z]\b/i, '')
      .replace(/\b(second|third|fourth|2nd|3rd|4th)\s+derivative\b/i, 'derivative')
      .replace(/\bd\s*(?:\^\s*\d|[²³]|\d)\s*\/\s*d([a-z])\s*(?:\^\s*\d|[²³]|\d)/i, 'd/d$1')
      .replace(/\b([a-z])(?:'{2,}|′{2,}|″|‴)\s*\(([a-z])\)\s*(?:where|if|when|,)?\s*(?:\1\s*\(\2\)\s*=)?/i, (m, f, v, ) => (/=/.test(m) ? '' : m))
      .replace(/^\s*[a-z]'*\s*\(\s*[a-z]\s*\)\s*=\s*/i, '');
    if (derivOpts.order || derivOpts.variable) {
      const stripped = stripDerivPhrases(problem);
      const point = extractEvalPoint(stripped);
      const src = point ? point.rest : stripped;
      const { solveDerivative } = await import('./solvers/derivativesSolver.js');
      const expression = extractFunctionFromProblem(/\bderivative\b|d\/d[a-z]/i.test(src) ? src : `derivative of ${src}`);
      result = await solveDerivative(expression, { ...derivOpts, evalAt: point || undefined });
      return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input asks for a derivative'), problem);
    }

    // "f at x = a": strip the evaluation point first so the "=" in it is not
    // mistaken for an equation, then hand it to the solver as an option.
    const evalAt = extractEvalPoint(problem);
    if (evalAt) {
      const calculusRaw = detectCalculusIntent(problem);
      if (calculusRaw === 'derivatives' || (!calculusRaw && topic === 'derivatives')) {
        const { solveDerivative } = await import('./solvers/derivativesSolver.js');
        const expression = extractFunctionFromProblem(evalAt.rest);
        result = await solveDerivative(expression, { ...derivOpts, evalAt });
        return finalizeResult(topic === 'derivatives' ? result : noteRouting(result, topic, 'derivatives', 'the input uses derivative notation'), problem);
      }
      if (!calculusRaw && ['algebra', 'functions', 'other', 'trigonometry'].includes(topic) && !looksLikeInequality(evalAt.rest) && !/=/.test(evalAt.rest)) {
        return finalizeResult(await evaluateAtPoint(evalAt), problem);
      }
    }

    // The input's own intent wins over the dropdown. Calculus notation under
    // any topic goes to that solver; a plain equation in one unknown under a
    // non-algebra topic goes to Algebra. Each is labelled as routed.
    const calculus = detectCalculusIntent(problem);
    if (calculus && calculus !== topic) {
      const routed = await solveProblem(problem, calculus);
      return noteRouting(routed, topic, calculus, `the input uses ${calculus === 'limits' ? 'limit' : calculus === 'integrals' ? 'integral' : 'derivative'} notation`);
    }
    // An inequality is an algebra problem under any topic. Under Derivatives
    // "x^2 - 4 > 0" was refused outright ("beyond this engine") when the
    // sign-chart solver had the answer all along.
    if (!calculus && topic !== 'algebra' && looksLikeInequality(problem)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is an inequality');
    }
    // A system of equations is an algebra problem under any topic. Without
    // this, "2x + 3y = 6; x - y = 4" typed under Derivatives was fed to the
    // single-expression extractor, which kept the "6" of the first equation
    // and answered "f(x) = 4, f'(x) = 0" — silently, and marked Solved.
    if (!calculus && topic !== 'algebra' && looksLikeSystem(problem)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is a system of equations');
    }
    if (!calculus && isPlainEquationForAlgebra(problem, topic)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input is an equation to solve');
    }
    // A trig function or a degree sign under Arithmetic is a Trigonometry
    // problem: the arithmetic evaluator knows no angle units, so sin(30) was
    // -0.988 (radians) where the Trigonometry solver and the angle setting
    // say 1/2, sin(30°) was a syntax error, and sin(pi/6) lost its exact 1/2.
    if (!calculus && topic === 'other' && /(?<![a-z])(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan)\s*\(|°/i.test(problem)) {
      const routed = await solveProblem(problem, 'trigonometry');
      return noteRouting(routed, topic, 'trigonometry', 'the input uses a trig function, and angles are read with your angle setting there');
    }
    if (!calculus && topic === 'algebra' && isComplexNumberInput(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a calculation with complex numbers');
    }
    if (!calculus && isAlgebraUnderArithmetic(problem, topic)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input contains a variable, and arithmetic has none');
    }
    // "2 3": two numbers with only a space between them would be read as 23.
    // Any topic, not just Arithmetic: under Algebra "12 34" was answered
    // 1234, and under Derivatives f'(x) = 0 (corpus row, October 2026).
    const spaced = /[a-z=<>]/i.test(problem) ? null : problem.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (spaced) {
      const [, a, b] = spaced;
      return finalizeResult(parseError({
        input: problem,
        hint: `Two numbers with a space between them — did you mean to multiply (${a}*${b}) or to write one number (${a}${b})?`,
        tips: [`Use "*" for multiplication: "${a}*${b}". To write one number, remove the space.`],
      }), problem);
    }
    // "factor x^2-5x+6", "expand (x+1)^2", "simplify …", "solve …": the verb
    // is the intent, as "derivative of" is. Under Integrals "factor …" was
    // a parse error ("factor" is not a known function; October 2026 review).
    // With a trig function in it, the verb's home is Trigonometry, which
    // knows the identities: under Algebra "simplify tan(x)*cos(x)" came back
    // unchanged, where Trigonometry gives sin(x).
    const verb = !calculus && String(problem).match(/^\s*(factor(?:i[sz]e)?|expand|simplify|solve)\b/i);
    const verbHome = verb && (/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*[(^]/i.test(problem) ? 'trigonometry' : 'algebra');
    if (verb && topic !== verbHome) {
      const routed = await solveProblem(problem, verbHome);
      return noteRouting(routed, topic, verbHome, `the input asks to ${verb[1].toLowerCase().replace(/^factori[sz]e$/, 'factor')} it`);
    }
    if (!calculus && topic !== 'functions' && GRAPH_VERB.test(problem)) {
      const routed = await solveProblem(problem, 'functions');
      return noteRouting(routed, topic, 'functions', `the input asks to ${graphVerb(problem)} it`);
    }
    if (['integrals', 'derivatives', 'functions', 'limits'].includes(topic) && constantDividesByZero(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a number, not a function, and it divides by zero');
    }
    // "50% of 80" is a calculation whatever the topic: under Integrals it was
    // ∫(50%of80) do = 50o + C, marked Solved.
    if (!calculus && topic !== 'other' && /^\s*\d+(?:\.\d+)?\s*%\s*of\s+\d/i.test(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a percentage calculation');
    }
    if (topic === 'limits' && !calculus && isConstantInput(problem)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a number with no limit in it (a limit needs "lim x->a")');
    }
    if (!calculus && isArithmeticUnderTrigonometry(problem, topic)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a numeric expression, with no angle or trig function in it');
    }

    // Inequalities: a <, >, ≤, or ≥ operator. Routed from the raw text so the
    // operator and both sides stay intact for the sign-chart solver.
    if (topic === 'algebra' && looksLikeInequality(problem)) {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
      const { solveInequality } = await import('./solvers/inequalitiesSolver.js');
      result = await solveInequality(problem);
      return finalizeResult(result, problem);
    }

    // Systems of equations: two or more equations. Detected from the RAW
    // problem (before the single-expression extractor mangles the first
    // equation) and routed to the dedicated 2×2 linear solver.
    if (topic === 'algebra' && looksLikeSystem(problem)) {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
      const { solveSystem } = await import('./solvers/systemsSolver.js');
      result = await solveSystem(problem);
      return finalizeResult(result, problem);
    }

    // A single trig equation typed under Algebra (sin(x) = 1/2) gets the same
    // exact treatment as under Trigonometry — general solution and special
    // angles — instead of the algebra solver's numeric root scan. Only the
    // supported family is taken; anything else falls through to algebra.
    if (topic === 'algebra' && isSingleTrigEquation(problem)) {
      const { solveTrigEquation } = await import('./solvers/trigEquationSolver.js');
      const trig = solveTrigEquation(extractFunctionFromProblem(problem));
      if (trig.status !== STATUS.UNSUPPORTED) {
        return finalizeResult(trig, problem);
      }
    }

    if (topic === 'limits' || topic === 'integrals') {
      const word = unknownWordInProblem(problem);
      if (word) return finalizeResult(unknownWordError(problem, word), problem);
      // The same check as the single-expression path below: a function name
      // with nothing to apply it to. These paths skipped it, and the engines
      // read the name as a symbol ("∫ sec³x dx" = sec·x + C).
      const bare = bareFunctionName(parseMathExpression(problem));
      if (bare) return finalizeResult(parseError({ input: problem, ...bareFunctionRefusal(bare) }), problem);
    }

    const solver = await resolveSolver(problem, topic);
    if (!solver) {
      throw new Error('No solver available for this topic');
    }

    // Route to appropriate solver based on topic
    switch (topic) {
      case 'limits':
        // Pass raw problem text so the limit solver can extract the approach value
        result = await solver(problem);
        break;

      case 'integrals':
        // Pass raw problem text so the integral solver can read definite-
        // integral bounds before parseMathExpression collapses the spacing.
        result = await solver(problem);
        break;

      default: {
        // "d/dx" alone, "derivative of": the instruction with nothing to
        // work on ("dx" was refused as an unknown word).
        const expression = /^\s*(?:d\/d[a-z]|(?:find\s+)?(?:the\s+)?derivative(?:\s+of)?|differentiate)\s*$/i.test(problem) ? '' : extractFunctionFromProblem(problem);
        if (!expression || expression.trim().length === 0) {
          return finalizeResult(parseError({
            input: problem,
            hint: topic === 'derivatives'
              ? 'There is nothing to differentiate — write the function after d/dx: "d/dx (x^3)", or just "x^3".'
              : 'No expression was found in the input.',
          }), problem);
        }
        // "hello", "help me", "x x" (→ "xx"): a word the engines do not know.
        // Not a variable, not a function — a parse error with a hint, before
        // Algebrite treats it as a symbol and "solves" or echoes it.
        if (topic !== 'other') {
          const word = unknownWord(expression);
          if (word) {
            const twoLetters = /^[a-z] [a-z]$/i.test(word) || (word.length === 2 && word[0] === word[1]);
            return finalizeResult(parseError({
              input: problem,
              hint: twoLetters
                ? `"${word}" — two variables side by side. For a product, write ${word[0]}*${word[word.length - 1]}.`
                : unknownWordHint(word),
              tips: ['Type the mathematics itself — an expression or an equation, such as "2x + 5 = 11" or "x^2 - 4".'],
            }), problem);
          }
        }
        // Unbalanced parentheses: "sin(x", "sin(x))". Echoed back as "solved"
        // before; a parse error with the count is what a student needs.
        {
          const opens = (expression.match(/\(/g) || []).length;
          const closes = (expression.match(/\)/g) || []).length;
          if (opens !== closes) {
            return finalizeResult(parseError({
              input: problem,
              hint: `Unbalanced parentheses: ${opens} opening "(" and ${closes} closing ")".`,
              tips: ['Every "(" needs a matching ")": "sin(x)", "(x + 1)^2".'],
            }), problem);
          }
          if (/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i.test(expression)) {
            const fn = expression.match(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i)[1];
            return finalizeResult(parseError({
              input: problem,
              hint: `"${fn}()" has nothing inside it — ${fn} needs an argument: "${fn}(x)", "${fn}(30)".`,
            }), problem);
          }
        }
        // "sin^2", "ln + 3": a function name with nothing to apply it to.
        // Refused here with a usable hint; left alone, mathjs fails deep
        // inside pow ("Unexpected type of argument … actual: function").
        {
          // parseMathExpression is imported statically at the top of this file.
          const bare = bareFunctionName(parseMathExpression(expression));
          if (bare) return finalizeResult(parseError({ input: problem, ...bareFunctionRefusal(bare) }), problem);
        }
        // The extractor strips verbs, so intent has to ride alongside the
        // expression: "factor x^2 - 9" routes to the algebra solver's
        // factoring path instead of the (no-op) simplify path.
        if (topic === 'algebra' && /\b(?:factor|factorize|factorise)\b/i.test(problem)) {
          result = await solver(expression, { intent: 'factor' });
        } else if (topic === 'algebra' && /\b(?:expand|multiply out|distribute)\b/i.test(problem)) {
          result = await solver(expression, { intent: 'expand' });
        } else if (topic === 'algebra' && /\bsolve\s+for\s+([a-z])\b/i.test(problem)) {
          // "solve for y" — matters when the equation has two unknowns.
          result = await solver(expression, { solveFor: problem.match(/\bsolve\s+for\s+([a-z])\b/i)[1].toLowerCase() });
        } else {
          result = await solver(expression);
        }
        break;
      }
    }

    return finalizeResult(result, problem);

  } catch (error) {
    console.error('Solver error:', error);

    // Last-resort fallback: an error escaped every solver's own handling, so
    // the specific cause is unknown — the error message is the best hint we
    // have (parseError puts an engine's message into words). Solver-level
    // failures carry more specific envelopes than this. No generic tips:
    // "use * for multiplication" under an error about something else only
    // sends the student looking in the wrong place.
    return parseError({
      input: problem,
      hint: error.message || 'An unexpected error occurred',
    });
  }
}
