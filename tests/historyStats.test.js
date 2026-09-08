// What the Progress history keeps and counts (v1.33.1). Until then every
// outcome except a parse error was saved — a "Beyond this solver" refusal sat
// in the history with its refusal text as the "solution" and counted as a
// solved problem, a topic covered, and work done this week.

import test from 'node:test';
import assert from 'node:assert/strict';

import { STATUS, shouldSaveToHistory, countsAsSolved } from '../src/lib/solutionEnvelope.js';
import { historyStats } from '../src/lib/historyStats.js';

test('history keeps solves and the honest mathematical non-values, not tool failures', () => {
  assert.equal(shouldSaveToHistory(STATUS.SOLVED), true);
  assert.equal(shouldSaveToHistory(STATUS.UNDEFINED), true);      // 1/0 — an answer about the maths
  assert.equal(shouldSaveToHistory(STATUS.INDETERMINATE), true);  // 0/0 — likewise
  assert.equal(shouldSaveToHistory(STATUS.UNSUPPORTED), false);   // the engine's limit, not the student's
  assert.equal(shouldSaveToHistory(STATUS.OVERFLOW), false);
  assert.equal(shouldSaveToHistory(STATUS.PARSE_ERROR), false);
  assert.equal(shouldSaveToHistory(undefined), false);
});

test('only solves count as solved; entries from before statuses existed count too', () => {
  assert.equal(countsAsSolved({ solution: { status: STATUS.SOLVED, answer: 'x = 3' } }), true);
  assert.equal(countsAsSolved({ solution: { answer: 'x = 3' } }), true);           // legacy, no status
  assert.equal(countsAsSolved({ solution: 'x = 3' }), true);                       // very old string form
  assert.equal(countsAsSolved({ solution: { status: STATUS.UNDEFINED } }), false);
  assert.equal(countsAsSolved({ solution: { status: STATUS.UNSUPPORTED } }), false);
});

test('Progress statistics count solved problems only', () => {
  const now = new Date('2026-09-08T12:00:00Z');
  const day = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  const problems = [
    { topic: 'algebra', createdAt: day(1), solution: { status: STATUS.SOLVED, answer: 'x = 3' } },
    { topic: 'derivatives', createdAt: day(2), solution: { status: STATUS.SOLVED, answer: '2x' } },
    { topic: 'limits', createdAt: day(10), solution: { answer: '1' } },                       // legacy solve, older than a week
    { topic: 'integrals', createdAt: day(1), solution: { status: STATUS.UNSUPPORTED, answer: 'Beyond this solver' } },
    { topic: 'other', createdAt: day(0), solution: { status: STATUS.UNDEFINED, answer: 'Undefined' } },
  ];
  const stats = historyStats(problems, now);
  assert.equal(stats.total, 3);      // not 5
  assert.equal(stats.thisWeek, 2);   // the legacy solve is 10 days old
  assert.equal(stats.topics, 3);     // integrals and "other" are not covered by a refusal or an undefined value
  assert.equal(stats.notSolved, 2);
  assert.deepEqual(historyStats([]), { total: 0, thisWeek: 0, topics: 0, notSolved: 0 });
});
