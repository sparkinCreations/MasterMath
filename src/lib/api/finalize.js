// The result gate (finalizeResult): every result's status enforced and
// anything that is not presentable text refused; the routing note.

import { usesCommonLog, matchingParen } from '../mathParser.js';
import { STATUS, isValidStatus, unsupported } from '../solutionEnvelope.js';
import { math, formatNumber } from '../solvers/solverUtils.js';
import { stripMathMarkers } from '../mathMarkers.js';
import { splitGuidance } from '../guidance.js';

export const TOPIC_NAMES = { auto: 'Auto-detect', derivatives: 'Derivatives', integrals: 'Integrals', limits: 'Limits', functions: 'Functions', trigonometry: 'Trigonometry', algebra: 'Algebra', other: 'Arithmetic' };

// A solved result that was routed away from the chosen topic says so, first.
export function noteRouting(result, from, to, why) {
  // Nothing was solved as anything when the input could not be read: no
  // "Solved as Arithmetic" notice above a parse error.
  if (result && Array.isArray(result.steps) && from !== to && result.status !== STATUS.PARSE_ERROR) {
    result.steps = [`Solved as ${TOPIC_NAMES[to]} (you chose ${TOPIC_NAMES[from]}): ${why}.`, ...result.steps];
    // For the page: SolutionDisplay shows this as a notice above the steps
    // (with a button to switch the topic) instead of the first step above,
    // which stays for exports and history, where there is no notice.
    result.routing = { from, to, reason: why };
    // The topic the problem was actually solved under — history and the
    // Progress stats file it there, not under the dropdown's guess.
    result.routedTopic = to;
  }
  return result;
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
// Shown whenever a solved input relied on the base-10 reading of a bare `log`.
export const COMMON_LOG_TIP = '"log(…)" is read as the common logarithm, base 10, as on a calculator. Write "ln(…)" for the natural logarithm, or "log(x, b)" / "log_b(x)" for another base.';

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
  // The ⟦…⟧ math markers (mathMarkers.js) belong to steps, tips and
  // mistakes, which the page typesets by them; the answer is graded, saved
  // to history and shown in Progress as text.
  result.answer = stripMathMarkers(result.answer);
  result.steps = result.steps.map((s) => (typeof s === 'string' ? s : String(s)));
  if (!result.tips || !Array.isArray(result.tips)) {
    result.tips = [];
  }
  if (!result.common_mistakes || !Array.isArray(result.common_mistakes)) {
    result.common_mistakes = [];
  }
  // Tips and mistakes keep their markers (1.53.0): the page typesets only
  // the marked runs ('marked' mode), and every export strips them. An item
  // with a source becomes its text, and the source moves to result.sources
  // (guidance.js).
  const sources = {};
  result.tips = splitGuidance(result.tips, sources).texts;
  result.common_mistakes = splitGuidance(result.common_mistakes, sources).texts;
  if (Object.keys(sources).length) result.sources = sources;
  else delete result.sources;
  if (Array.isArray(result.warnings)) result.warnings = result.warnings.map(stripMathMarkers);
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
  // Say which logarithm convention was applied, once, on solved results only.
  if (result.status === STATUS.SOLVED && usesCommonLog(input || '') && !result.tips.includes(COMMON_LOG_TIP)) {
    result.tips = [COMMON_LOG_TIP, ...result.tips];
  }
  // 8/2(2+2), 6/2x, 1/2pi: division followed by implicit multiplication is
  // read left to right (as every calculator and the parser do), but many
  // readers see the juxtaposed factor as part of the denominator. Solve it,
  // and say which reading was used (September 2026 review, batch 3).
  if (result.status === STATUS.SOLVED) {
    const warning = implicitDivisionWarning(input || '');
    if (warning && !(result.warnings || []).includes(warning)) result.warnings = [...(result.warnings || []), warning];
  }
  return result;
}

// The two readings of a/b(c) — MasterMath's (a/b)·(c) and the grouped
// a/(b·c) — with values when the input is purely numeric. Null when the
// input has no such juxtaposition, or the grouping is already explicit.
function implicitDivisionWarning(raw) {
  const text = String(raw).replace(/\s+/g, '');
  // number or single letter, slash, number, then a paren group or a letter
  // (a variable, or pi) — with no operator in between.
  const m = text.match(/(?<![\w.)])((?:\d+(?:\.\d+)?|[a-z]))\/(\d+(?:\.\d+)?)(\(|[a-z])/i);
  if (!m) return null;
  const tailStart = m.index + m[0].length - 1;
  let tail;
  if (m[3] === '(') {
    const close = matchingParen(text, tailStart);
    if (close < 0) return null;
    tail = text.slice(tailStart, close + 1);
  } else {
    const word = text.slice(tailStart).match(/^[a-z]+/i)[0];
    tail = word;
  }
  const num = m[1];
  const den = m[2];
  const asWritten = `(${num}/${den})·${tail}`;
  const grouped = `${num}/(${den}·${tail})`;
  let values = '';
  if (!/[a-z]/i.test(`${num}${tail}`.replace(/\bpi\b/gi, ''))) {
    try {
      const evalText = (t) => math.evaluate(t.replace(/·/g, '*').replace(/\bpi\b/gi, 'pi'));
      const a = evalText(asWritten);
      const b = evalText(grouped);
      if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-12) {
        values = ` = ${formatNumber(a)}`;
        return `"${num}/${den}${tail}" can be read two ways. MasterMath follows left-to-right precedence: ${asWritten}${values}. If you meant ${grouped} = ${formatNumber(b)}, write the grouping explicitly: ${num}/(${den}*${tail}).`;
      }
      return null;
    } catch {
      /* fall through to the symbolic wording */
    }
  }
  return `"${num}/${den}${tail}" can be read two ways. MasterMath follows left-to-right precedence: ${asWritten}. If you meant ${grouped}, write the grouping explicitly: ${num}/(${den}*${tail}).`;
}
