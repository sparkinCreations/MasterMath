// Import IndexedDB functions (local storage - no API needed!)
import { getAllProblems, addProblem, updateProblem, clearAllProblems } from './indexedDB.js';
import { validateProblemHistory } from './validation.js';
import { extractFunctionFromProblem } from './mathParser.js';
import { STATUS, isValidStatus, parseError, unsupported } from './solutionEnvelope.js';
import { bareFunctionName } from './solvers/solverUtils.js';

// The storage wrappers below replace the underlying error with a message fit
// for a toast. That message is all the user should see, but it is not all a
// developer needs, so the original is attached as `cause` and logged rather
// than discarded.
//
// Argument and validation failures are deliberately NOT wrapped: they are
// already specific ("Topic is required", "Invalid entity ID"), they mean the
// caller passed something wrong rather than storage misbehaving, and
// flattening them into "Failed to save problem. Please try again." told
// nobody anything.

// Fetch all problem history from local IndexedDB
export async function fetchProblemHistory() {
  try {
    return await getAllProblems();
  } catch (error) {
    console.error('Error fetching problem history:', error);
    throw new Error('Failed to load problem history. Please try again.', { cause: error });
  }
}

// Create a new problem history entry in local IndexedDB
export async function createProblemHistory(problemData) {
  // Validate before the try, so a validation failure reaches the caller with
  // its own message instead of the generic storage one.
  const validation = validateProblemHistory(problemData);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    return await addProblem(problemData);
  } catch (error) {
    console.error('Error creating problem history:', error);
    throw new Error('Failed to save problem. Please try again.', { cause: error });
  }
}

// Update an existing problem history entity in local IndexedDB
export async function updateProblemHistory(entityId, updateData) {
  if (!entityId) {
    throw new Error('Invalid entity ID');
  }

  try {
    return await updateProblem(entityId, updateData);
  } catch (error) {
    console.error('Error updating problem history:', error);
    throw new Error('Failed to update problem. Please try again.', { cause: error });
  }
}

// Clear all problem history from local IndexedDB
export async function clearProblemHistory() {
  try {
    return await clearAllProblems();
  } catch (error) {
    console.error('Error clearing problem history:', error);
    throw new Error('Failed to clear history. Please try again.', { cause: error });
  }
}

async function loadSolver(topic) {
  switch (topic) {
    case 'algebra':
      return (await import('./solvers/algebraSolver.js')).solveAlgebra;
    case 'derivatives':
      return (await import('./solvers/derivativesSolver.js')).solveDerivative;
    case 'integrals':
      return (await import('./solvers/integralsSolver.js')).solveIntegral;
    case 'limits':
      return (await import('./solvers/otherSolvers.js')).solveLimit;
    case 'trigonometry':
      return (await import('./solvers/otherSolvers.js')).solveTrigonometry;
    case 'functions':
      return (await import('./solvers/otherSolvers.js')).solveFunctions;
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

// A system of equations has two or more equations (two or more '=' signs that
// aren't part of >=, <=, ==, !=). Detected on the raw text so the router can
// hand it to the systems solver before single-expression extraction.
function looksLikeSystem(problem) {
  const equalsCount = (String(problem).match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount >= 2;
}

// An inequality carries a <, >, ≤, or ≥ relation.
function looksLikeInequality(problem) {
  return /[<>≤≥]/.test(String(problem));
}

// What the INPUT says it is, regardless of the topic picked in the dropdown.
// A student who types "d/dx x^3" under Algebra means a derivative; the old
// behaviour stripped the "d/dx" and "simplified" x^3 to x^3, marked Solved.
// Returns 'derivatives' | 'integrals' | 'limits' | null.
function detectCalculusIntent(problem) {
  const t = String(problem);
  if (/\bd\/d[a-z]\b|\bderivative\b|\bdifferentiate\b|\bdy\/dx\b/i.test(t)) return 'derivatives';
  if (/∫|\bintegra(?:l|te)\b|\bantiderivative\b/i.test(t)) return 'integrals';
  if (/\blim(?:it)?\b|→|->|\bapproaches\b/i.test(t)) return 'limits';
  return null;
}

// One equation in one unknown, with no calculus intent, is an algebra
// problem whatever topic it was typed under — except where the topic has
// its own equation semantics: a trig equation under Trigonometry, and the
// f(x) = … / y = … definitions under Functions.
function isPlainEquationForAlgebra(problem, topic) {
  const t = String(problem);
  const equalsCount = (t.match(/(?<![><!=])=(?!=)/g) || []).length;
  if (equalsCount !== 1) return false;
  if (!/[a-z]/i.test(t.replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sqrt|abs|log|ln|exp|pi|e)\b/gi, ''))) return false;
  if (topic === 'algebra') return false;
  // (?<![a-z]) not \b: "2cos(x) - 1 = 0" has no word boundary before "cos".
  if (topic === 'trigonometry' && /(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*[(a-z0-9]/i.test(t)) return false;
  if (topic === 'functions' && /(?<![a-z0-9])(?:f\(.\)|y)\s*=/i.test(t)) return false;
  return true;
}

// A variable expression typed under Arithmetic ("x^2 + 3x") is algebra —
// arithmetic has no unknowns, and mathjs would just say "Undefined symbol x".
function isAlgebraUnderArithmetic(problem, topic) {
  if (topic !== 'other') return false;
  const t = String(problem).replace(/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|asin|acos|atan|sqrt|abs|log|ln|exp|pi|e|mod|choose)\b/gi, '').replace(/\d+(?:\.\d+)?[eE][+-]?\d+/g, '');
  return /(?<![a-z])[a-df-z](?![a-z])/i.test(t) && !/^\s*\d+(?:\.\d+)?\s*x\s*\d/i.test(String(problem)); // "2 x 3" is multiplication
}

// An expression of pure numbers under Trigonometry — "(5+3)*4 - 2^3" — is
// arithmetic: there is no angle, no function call, nothing trigonometric to
// say about it. It used to be evaluated by the trig path and served with trig
// tips ("Remember: sin(30°) = 1/2") attached to a PEMDAS problem.
// Deliberately narrow: any letter at all (sin, pi, sqrt, e, x) means the
// topic may still have a legitimate claim on the input.
function isArithmeticUnderTrigonometry(problem, topic) {
  if (topic !== 'trigonometry') return false;
  const t = String(problem);
  if (/[a-z=<>≤≥]/i.test(t)) return false;
  return /\d/.test(t);
}

// Words the engines know. Anything else that is two or more letters long is
// not mathematics this app can read ("hello", "helpme", "xx").
const KNOWN_WORDS = new Set(['of', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sqrt', 'cbrt', 'nthroot', 'abs', 'log', 'ln', 'log10', 'log2', 'exp', 'pi', 'mod', 'choose', 'combinations', 'permutations', 'factorial', 'floor', 'ceil', 'round', 'sign', 'sgn', 'gamma', 'erf', 'infinity', 'inf', 'deg', 'degrees', 'rad']);
function unknownWord(expression) {
  const text = String(expression);
  // Two single letters with only a space between them: "x x".
  const pair = text.match(/(?<![a-z])([a-z])\s+([a-z])(?![a-z])/i);
  if (pair) return `${pair[1]} ${pair[2]}`;
  // A word followed by "(" is a function call; an unknown one (foo(x)) is
  // the engine's to refuse as unsupported, with its own message.
  const words = text.match(/[a-z]{2,}(?![a-z]|\s*\()/gi) || [];
  return words.find((w) => !KNOWN_WORDS.has(w.toLowerCase())) || null;
}

// "… at x = 2" / "… when x = π/4": an evaluation point tacked onto the end
// of a problem. Read on the raw text before any routing, because the "=" in
// it would otherwise make "x^2 at x = 1.5" look like an equation (in the
// unknowns a, t and x). Returns { rest, variable, valueText } or null.
function extractEvalPoint(problem) {
  const m = String(problem).match(/^(.*?)[\s,]+(?:at|when|where|for)\s+([a-z])\s*=\s*(-?[0-9a-z.\/*+^() π√]+?)\s*[.?!]?\s*$/i);
  if (!m || !m[1].trim()) return null;
  // The value must be a number, not another expression in the variable.
  const variable = m[2].toLowerCase();
  if (new RegExp(`(?<![a-z])${variable}(?![a-z])`, 'i').test(m[3].replace(/\b(?:pi|sqrt|e)\b/gi, ''))) return null;
  return { rest: m[1].trim(), variable, valueText: m[3].trim() };
}

const TOPIC_NAMES = { derivatives: 'Derivatives', integrals: 'Integrals', limits: 'Limits', functions: 'Functions', trigonometry: 'Trigonometry', algebra: 'Algebra', other: 'Arithmetic' };

// A solved result that was routed away from the chosen topic says so, first.
function noteRouting(result, from, to, why) {
  if (result && Array.isArray(result.steps) && from !== to) {
    result.steps = [`Solved as ${TOPIC_NAMES[to]} (you chose ${TOPIC_NAMES[from]}): ${why}.`, ...result.steps];
    // The topic the problem was actually solved under — history and the
    // Progress stats file it there, not under the dropdown's guess.
    result.routedTopic = to;
  }
  return result;
}

// One equation (exactly one '=') that contains a sin/cos/tan call.
function isSingleTrigEquation(problem) {
  const text = String(problem);
  const equalsCount = (text.match(/(?<![><!=])=(?!=)/g) || []).length;
  return equalsCount === 1 && /(?<![a-z])(sin|cos|tan)\s*[(a-z0-9]/i.test(text);
}

// Text that is program source rather than mathematics. The engines can hand
// back a live function or object — mathjs parses "sin(x) = 1/2" as a function
// *definition* and returns the function — and stringifying one yields its
// (minified) JavaScript. Nothing that matches these belongs in a solution.
// The shapes are deliberately code-specific (a `function` keyword with a
// parameter list and body, an arrow with a body, a native/object stringify)
// so ordinary prose — "return to the original variable", "the arguments of
// the trig functions" — is never mistaken for a leak.
const SOURCE_CODE_PATTERN = /\bfunction\b\s*[\w$]*\s*\([^)]*\)\s*\{|\)\s*=>\s*[{(\w]|\[native code\]|\[object \w+\]|\barguments\.length\b/;

// Is this value a legitimate piece of solution text — a string of maths or
// prose, or a finite/readable number? Anything else (functions, objects,
// arrays, symbols, code-shaped strings) is an engine internal that leaked.
export function isPresentable(value) {
  if (typeof value === 'number') return true; // formatNumber handles NaN/∞ text
  if (typeof value === 'bigint') return true;
  if (typeof value !== 'string') return false;
  return !SOURCE_CODE_PATTERN.test(value);
}

// Shared result validation — every solver's output passes through here.
// This is the envelope contract gate: a result must carry a valid `status`
// (see solutionEnvelope.js). The legacy shim below infers one for solvers
// not yet migrated; it is deleted at the end of the migration (Phase 2 of
// docs/future-work/MATH-STATE-SEMANTICS.md).
//
// It is also the last line of defence against engine internals reaching the
// screen: an answer or step that is not presentable text is replaced with an
// honest "unsupported" envelope, never rendered — and never marked solved.
export function finalizeResult(result, input) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid solver result');
  }
  if (!result.steps || !Array.isArray(result.steps)) {
    result.steps = ['Solution computed'];
  }
  if (result.answer === undefined || result.answer === null || result.answer === '') {
    throw new Error('No solution found');
  }

  const leaked = [result.answer, ...result.steps].find((v) => !isPresentable(v));
  if (leaked !== undefined) {
    console.error('Solver returned a non-presentable value; refusing to render it:', typeof leaked, String(leaked).slice(0, 120));
    return unsupported({
      input,
      reason: 'The maths engine returned an internal value instead of a result for this input. This is a limitation of the solver, not your notation.',
      answer: 'This problem is beyond what this solver can compute',
      tips: [
        'If this is an equation, try the Algebra topic — the Trigonometry topic evaluates and simplifies expressions.',
        'The input itself was read correctly; nothing needs reformatting.',
      ],
    });
  }
  // Numbers are fine as answers, but the UI and exports expect a string.
  if (typeof result.answer !== 'string') result.answer = String(result.answer);
  result.steps = result.steps.map((s) => (typeof s === 'string' ? s : String(s)));
  if (!result.tips || !Array.isArray(result.tips)) {
    result.tips = [];
  }
  if (!result.common_mistakes || !Array.isArray(result.common_mistakes)) {
    result.common_mistakes = [];
  }
  if (!isValidStatus(result.status)) {
    // Legacy shim: the pre-envelope failure convention was an answer string
    // starting with "Unable to". Anything else counts as solved. Only an
    // inferred failure gets a warning — it means a failure path somewhere
    // still isn't using the envelope constructors.
    if (/^unable to/i.test(String(result.answer))) {
      result.status = STATUS.PARSE_ERROR;
      console.warn(`Solver failure path returned no status — inferred "${result.status}" for answer: ${result.answer}`);
    } else {
      result.status = STATUS.SOLVED;
    }
  }
  return result;
}

// Real math solver using local libraries
// "x^2 + 1 at x = 3": substitute the value and evaluate as arithmetic, with
// the substitution shown as a step.
async function evaluateAtPoint({ rest, variable, valueText }) {
  const { parseMathExpression } = await import('./mathParser.js');
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

    let result;

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
    if (!calculus && isAlgebraUnderArithmetic(problem, topic)) {
      const routed = await solveProblem(problem, 'algebra');
      return noteRouting(routed, topic, 'algebra', 'the input contains a variable, and arithmetic has none');
    }
    // "2 3": two numbers with only a space between them would be read as 23.
    if (topic === 'other' && /\d\s+\d/.test(problem) && !/[a-z=<>]/i.test(problem)) {
      return finalizeResult(parseError({
        input: problem,
        hint: 'Two numbers with a space between them — did you mean to multiply (2*3) or to write one number (23)?',
        tips: ['Use * for multiplication: 2*3. To write one number, remove the space.'],
      }), problem);
    }
    if (!calculus && isArithmeticUnderTrigonometry(problem, topic)) {
      const routed = await solveProblem(problem, 'other');
      return noteRouting(routed, topic, 'other', 'the input is a numeric expression, with no angle or trig function in it');
    }

    // Inequalities: a <, >, ≤, or ≥ operator. Routed from the raw text so the
    // operator and both sides stay intact for the sign-chart solver.
    if (topic === 'algebra' && looksLikeInequality(problem)) {
      const { solveInequality } = await import('./solvers/inequalitiesSolver.js');
      result = await solveInequality(problem);
      return finalizeResult(result, problem);
    }

    // Systems of equations: two or more equations. Detected from the RAW
    // problem (before the single-expression extractor mangles the first
    // equation) and routed to the dedicated 2×2 linear solver.
    if (topic === 'algebra' && looksLikeSystem(problem)) {
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
        const expression = extractFunctionFromProblem(problem);
        if (!expression || expression.trim().length === 0) {
          throw new Error('Unable to extract mathematical expression from input');
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
                : `"${word}" is not a known function, constant or variable. Variables are single letters (x, t, y); functions are sin, cos, ln, sqrt, …`,
              tips: ['Type the mathematics itself — an expression or an equation, such as 2x + 5 = 11 or x^2 - 4.'],
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
              tips: ['Every "(" needs a matching ")": sin(x), (x + 1)^2.'],
            }), problem);
          }
          if (/\b(?:sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i.test(expression)) {
            const fn = expression.match(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|abs|ln|log|exp)\s*\(\s*\)/i)[1];
            return finalizeResult(parseError({
              input: problem,
              hint: `${fn}() has nothing inside it — ${fn} needs an argument: ${fn}(x), ${fn}(30).`,
            }), problem);
          }
        }
        // "sin^2", "ln + 3": a function name with nothing to apply it to.
        // Refused here with a usable hint; left alone, mathjs fails deep
        // inside pow ("Unexpected type of argument … actual: function").
        {
          const { parseMathExpression } = await import('./mathParser.js');
          const bare = bareFunctionName(parseMathExpression(expression));
          if (bare) {
            return finalizeResult(parseError({
              input: problem,
              hint: `${bare} needs an argument in parentheses — ${bare}(x), ${bare}(2), ${bare}^2(x).`,
              tips: [`Every function call needs parentheses: ${bare}(x), not ${bare} x or ${bare} alone.`],
            }), problem);
          }
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
    // have. Solver-level failures carry more specific envelopes than this.
    return parseError({
      input: problem,
      hint: error.message || 'An unexpected error occurred',
      tips: [
        'Use * for multiplication (e.g., 2*x instead of 2x)',
        'Use ^ for exponents (e.g., x^2 instead of x²)',
        'Check that all parentheses are balanced and function names are spelled out (sin, cos, sqrt, ...)',
      ],
    });
  }
}
