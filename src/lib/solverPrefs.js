// Small solver-page preferences kept on the device, and the one judgement
// the page makes about a result (the bare-expression nudge). Pure, so the
// unit suite covers them without a browser.

import { readPlainEnglish } from './plainEnglish.js';

export const SOLUTION_MODE_KEY = 'solutionMode';
export const LAST_TOPIC_KEY = 'lastTopic';
export const TOPICS = ['auto', 'derivatives', 'integrals', 'limits', 'functions', 'trigonometry', 'algebra', 'other'];

// 'step' (reveal one step at a time) is the default for a new visitor: the
// app is for learning the method, and the first thing a new user should see
// is the working unfolding. 'all' once they choose it.
export function readSolutionMode(storage) {
  try {
    return storage?.getItem(SOLUTION_MODE_KEY) === 'all' ? 'all' : 'step';
  } catch {
    return 'step';
  }
}

export function writeSolutionMode(storage, mode) {
  try {
    storage?.setItem(SOLUTION_MODE_KEY, mode === 'all' ? 'all' : 'step');
  } catch {
    // nothing to persist to
  }
}

// The topic the solver opens on: the last one used, else Auto-detect (1.53.0;
// it was Algebra). The page used to open with no topic and a disabled Solve
// button that said nothing.
export function readLastTopic(storage) {
  try {
    const t = storage?.getItem(LAST_TOPIC_KEY);
    return TOPICS.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeLastTopic(storage, topic) {
  if (!TOPICS.includes(topic)) return;
  try {
    storage?.setItem(LAST_TOPIC_KEY, topic);
  } catch {
    // nothing to persist to
  }
}

// A bare expression under Algebra or Arithmetic — "x^2 + 3x" with no "=",
// no comparison and no verb — comes back simplified, which is usually just
// the input echoed. Offer the three things the person probably meant. The
// router already sends equations, inequalities, systems and calculus
// notation to the right solver whatever the topic, so this is the one gap.
const VERB = /\b(?:factor|factori[sz]e|expand|multiply out|distribute|simplify|solve|evaluate|compute|calculate|find|derivative|differentiate|integra(?:l|te)|limit|lim|graph|analy[sz]e)\b/i;
export function expressionNudge(problem, topic, result) {
  // Under Auto-detect, a bare expression is detected as Algebra: the same
  // offer applies (it is the one case Auto does not decide).
  const autoAlgebra = topic === 'auto' && result?.routing?.to === 'algebra';
  if (!['algebra', 'other'].includes(topic) && !autoAlgebra) return null;
  if (!result || result.status !== 'solved' || (result.routedTopic && !autoAlgebra)) return null;
  // Read as the solver read it: "two x plus five equals eleven" is an
  // equation, and was nudged as "an expression" until 1.56.3 because the
  // raw text has no "=" (October 2026 review).
  const text = readPlainEnglish(String(problem || ''));
  if (/[=<>≤≥;]|∫|d\/d[a-z]|->|→/.test(text)) return null;
  if (VERB.test(text)) return null;
  if (!/(?<![a-z])[a-z](?![a-z])/i.test(text.replace(/\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|abs|exp|pi|e)\b/gi, ''))) return null;
  return {
    message: 'This looks like an expression rather than an equation, so it was only simplified (and factored where it can be). Did you want to',
    options: [
      { topic: 'derivatives', label: 'Differentiate it' },
      { topic: 'integrals', label: 'Integrate it' },
      { topic: 'functions', label: 'Analyse it as a function' },
    ],
  };
}
