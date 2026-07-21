// The solution envelope: every solver result carries a typed `status` so the
// pipeline (api.js → Solver.jsx → toast → history → exports) can distinguish
// outcomes without inspecting answer text. Solvers build results through
// these constructors rather than hand-rolling objects, so a failure always
// arrives with steps and tips specific to what actually went wrong.
// Design: docs/future-work/MATH-STATE-SEMANTICS.md (Component 1).

export const STATUS = {
  SOLVED: 'solved',               // computed and verified — the only green state
  PARSE_ERROR: 'parse_error',     // input could not be read as math
  UNSUPPORTED: 'unsupported',     // valid math, beyond the engine
  UNDEFINED: 'undefined',         // valid math, no defined value (1/0)
  INDETERMINATE: 'indeterminate', // 0/0, ∞−∞, 0^0 — forms, not values
  OVERFLOW: 'overflow',           // valid math, exceeds double-precision range
};

export const ALL_STATUSES = Object.values(STATUS);

export function isValidStatus(status) {
  return ALL_STATUSES.includes(status);
}

// Human-readable labels for badges, toasts, history feedback, and exports.
const STATUS_LABELS = {
  [STATUS.SOLVED]: 'Solved',
  [STATUS.PARSE_ERROR]: "Couldn't read input",
  [STATUS.UNSUPPORTED]: 'Beyond this solver',
  [STATUS.UNDEFINED]: 'Undefined',
  [STATUS.INDETERMINATE]: 'Indeterminate form',
  [STATUS.OVERFLOW]: 'Number too large',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS[STATUS.PARSE_ERROR];
}

// Everything except a clean solve.
export function isFailureStatus(status) {
  return status !== STATUS.SOLVED;
}

function baseResult(status, { steps, answer, tips, common_mistakes, graph, interpretation, warnings }) {
  const result = {
    status,
    steps: Array.isArray(steps) ? steps : [],
    answer: answer || '',
    tips: Array.isArray(tips) ? tips : [],
    common_mistakes: Array.isArray(common_mistakes) ? common_mistakes : [],
    graph: graph || null,
  };
  if (interpretation) result.interpretation = interpretation;
  if (Array.isArray(warnings) && warnings.length > 0) result.warnings = warnings;
  return result;
}

// A successful solve. Passes the caller's fields through unchanged; only the
// status is added.
export function solved(fields) {
  if (!fields || !fields.answer) {
    throw new Error('solved() requires an answer');
  }
  return baseResult(STATUS.SOLVED, fields);
}

// Input could not be read as math. `hint` should say what is wrong with THIS
// input ("unmatched opening parenthesis"), never generic syntax advice —
// generic tips on specific failures are the bug class this module removes.
export function parseError({ input, hint, steps, answer, tips, common_mistakes }) {
  const builtSteps = [`Could not read ${quoted(input)} as a math expression.`];
  if (hint) builtSteps.push(hint);
  return baseResult(STATUS.PARSE_ERROR, {
    steps: steps || builtSteps,
    answer: answer || hint || 'This input could not be read as a math expression',
    tips: tips || (hint ? [hint] : []),
    common_mistakes: common_mistakes || [],
  });
}

// Valid math the engine cannot do (e.g. a non-elementary integral). The
// message must not blame formatting — the input parsed fine.
export function unsupported({ input, reason, steps, answer, tips, common_mistakes }) {
  const allSteps = steps || [
    `${quoted(input)} is valid mathematical input.`,
    reason || 'It is beyond what this solver can compute.',
  ];
  return baseResult(STATUS.UNSUPPORTED, {
    steps: allSteps,
    answer: answer || reason || 'This problem is beyond what this solver can compute',
    tips: tips || ['The input itself is valid — this is a limitation of the solver, not your notation.'],
    common_mistakes: common_mistakes || [],
  });
}

// Valid math with no defined value (division by zero as a quotient).
export function undefinedValue({ input, reason, steps, tips, common_mistakes, graph }) {
  return baseResult(STATUS.UNDEFINED, {
    steps: steps || [`Evaluate: ${input}`, reason || 'This expression has no defined value.'],
    answer: reason ? `Undefined — ${reason}` : 'Undefined',
    tips: tips || [],
    common_mistakes: common_mistakes || [],
    graph,
  });
}

// An indeterminate form (0/0, ∞−∞, 0^0 in analysis contexts): a form that
// needs more context, not a value.
export function indeterminate({ input, form, note, steps, tips, common_mistakes }) {
  const formText = form ? `${form} is an indeterminate form` : 'This is an indeterminate form';
  return baseResult(STATUS.INDETERMINATE, {
    steps: steps || [`Evaluate: ${input}`, `${formText} — it does not have a single defined value.`],
    answer: `Indeterminate${form ? ` (${form})` : ''}`,
    tips: tips || (note ? [note] : []),
    common_mistakes: common_mistakes || [],
  });
}

// Valid math whose value exceeds double-precision range.
export function overflow({ input, steps, tips }) {
  return baseResult(STATUS.OVERFLOW, {
    steps: steps || [
      `Evaluate: ${input}`,
      'The result exceeds the largest number this solver can represent (about 1.8 × 10^308).',
    ],
    answer: 'Too large to represent (exceeds ~1.8 × 10^308)',
    tips: tips || ['The input is valid — the value is simply outside double-precision floating-point range.'],
    common_mistakes: [],
  });
}

function quoted(input) {
  const text = String(input ?? '').trim();
  if (!text) return 'the input';
  const shown = text.length > 60 ? `${text.slice(0, 57)}...` : text;
  return `"${shown}"`;
}
