/**
 * Input validation utilities for MasterMath
 */

/**
 * Validates mathematical input
 * @param {string} input - The user's input
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateMathInput(input) {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Please enter a math problem' };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Please enter a math problem' };
  }

  if (trimmed.length > 1000) {
    return { isValid: false, error: 'Input is too long (maximum 1000 characters)' };
  }

  // There is deliberately no HTML/script pattern check here.
  //
  // It blocked nothing reachable. React escapes every value it renders, and
  // the exports are plain text. The app's one HTML sink is KaTeX via
  // MathText, and raw input *can* reach it — a parse error embeds the input
  // in the step text, which SolutionDisplay renders through MathText — but
  // two things stand between that and live markup: latex.js classifies a
  // fragment containing unknown words as text, so a tag or script payload
  // renders as escaped text and never reaches the HTML path at all, and
  // MathText passes `trust: false` explicitly, which blocks KaTeX's
  // HTML-extension commands for anything that does parse as maths.
  //
  // What the check did do was reject legitimate maths — the event-handler
  // pattern `/on\w+\s*=/i` matched the "on" inside "constant", so
  // "constant = 5" came back as "Invalid input detected" with no hint why.

  // LaTeX markup is not an input format here. Without this, "\\int x^2 dx"
  // lost its backslash and its space downstream and came back as
  // '"intx" is not a known function', which explains nothing.
  const latexCommand = trimmed.match(/\\([a-zA-Z]+)/);
  if (latexCommand) {
    return { isValid: false, error: `LaTeX commands such as \\${latexCommand[1]} are not supported. Type the math directly: 1/2 for a fraction, sqrt(x) for a root, x^2 for a power, ∫_0^1 x^2 dx or "integral of x^2 from 0 to 1" for an integral.` };
  }

  // Check if input contains at least one mathematical character or word
  const hasMathContent = /[0-9+\-*/^()=.xyzabc]|sin|cos|tan|log|ln|sqrt|derivative|integral|limit|solve/i.test(trimmed);

  if (!hasMathContent) {
    return { isValid: false, error: 'Please enter a valid math problem' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates topic selection
 * @param {string} topic - The selected topic
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateTopic(topic) {
  const validTopics = [
    'derivatives',
    'integrals',
    'limits',
    'functions',
    'trigonometry',
    'algebra',
    'other'
  ];

  if (!topic) {
    return { isValid: false, error: 'Please select a topic' };
  }

  if (!validTopics.includes(topic)) {
    return { isValid: false, error: 'Invalid topic selected' };
  }

  return { isValid: true, error: null };
}

/**
 * Normalizes user input into the form the solvers are given: no null bytes,
 * single-spaced, trimmed. This is the string that actually gets solved and
 * saved, so it must never change the meaning of the maths.
 *
 * HTML tags are deliberately not stripped. The old `<[^>]*>` pass was
 * unnecessary for the reasons given in validateMathInput above, and it was
 * actively harmful here: it deleted everything between a `<` and a later `>`,
 * silently turning the inequality "x < 5 and x > 1" into "x  1". Quietly
 * rewriting one valid problem into a different valid problem is a worse
 * outcome than any tag it removed.
 *
 * @param {string} input - The input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Null bytes can truncate strings in downstream consumers (file exports,
    // IndexedDB values).
    .replace(/\0/g, '')
    // Collapse runs of whitespace, including newlines, to a single space so
    // the solvers see a predictable expression.
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates export format
 * @param {string} format - The export format
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateExportFormat(format) {
  const validFormats = ['pdf', 'csv', 'json', 'markdown'];

  if (!format) {
    return { isValid: false, error: 'Please select an export format' };
  }

  if (!validFormats.includes(format.toLowerCase())) {
    return { isValid: false, error: 'Invalid export format' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates problem history data before saving
 * @param {Object} data - Problem history data
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateProblemHistory(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Invalid problem data' };
  }

  if (!data.problem || typeof data.problem !== 'string') {
    return { isValid: false, error: 'Problem is required' };
  }

  if (!data.topic || typeof data.topic !== 'string') {
    return { isValid: false, error: 'Topic is required' };
  }

  const topicValidation = validateTopic(data.topic);
  if (!topicValidation.isValid) {
    return topicValidation;
  }

  if (!data.solution || typeof data.solution !== 'object') {
    return { isValid: false, error: 'Solution is required' };
  }

  // Validate solution structure
  if (!Array.isArray(data.solution.steps)) {
    return { isValid: false, error: 'Solution must include steps' };
  }

  if (!data.solution.answer) {
    return { isValid: false, error: 'Solution must include an answer' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates numerical range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateRange(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    return { isValid: false, error: 'Invalid number' };
  }

  if (value < min || value > max) {
    return { isValid: false, error: `Value must be between ${min} and ${max}` };
  }

  return { isValid: true, error: null };
}
