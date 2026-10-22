// The numbers on the Progress page, computed from the saved history. Pure so
// it can be tested without React.
//
// Only entries that count as solved are counted (see countsAsSolved): a
// history that holds a refusal or an error from before September 2026 must
// not report it as a problem the student solved, a topic they covered, or
// work done this week.

import { countsAsSolved } from './solutionEnvelope.js';

export function historyStats(problems, now = new Date()) {
  const list = Array.isArray(problems) ? problems : [];
  const solved = list.filter(countsAsSolved);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return {
    total: solved.length,
    thisWeek: solved.filter((p) => new Date(p.createdAt || now) > weekAgo).length,
    topics: new Set(solved.map((p) => p.topic)).size,
    notSolved: list.length - solved.length,
  };
}

// The count as words, the same on the Progress page and in every export. The
// page's card said "Total Problems: 1" while an export of the same history
// said "Total Problems: 2 (solved: 1)" — one name for two numbers (October
// 2026 release review). Now both count solves, and say how many saved
// entries are not solves (an "Undefined" or "Diverges" result, or an older
// refusal), which the history list shows with their status.
export function historyTotalsText(problems) {
  const list = Array.isArray(problems) ? problems : [];
  const { total, notSolved } = historyStats(list);
  return notSolved === 0
    ? `Problems solved: ${total}`
    : `Problems solved: ${total} of ${list.length} in history`;
}
