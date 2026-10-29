// 1.59.0: the Progress page narrows the history by a search and a topic, a
// page at a time, and shows how many problems each topic holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterHistory, topicCounts, HISTORY_PAGE_SIZE } from '../src/lib/historyView.js';
import { historyTotalsText } from '../src/lib/historyStats.js';

const entry = (problem, topic, answer) => ({ problem, topic, solution: { status: 'solved', answer } });
const history = [
  entry('∫ x^2 dx', 'integrals', '∫(x^2) dx = 1/3*x^3 + C'),
  entry('x^2 + 1 = 0', 'algebra', 'x = -i or x = i'),
  entry('d/dx sin(x)', 'derivatives', "f'(x) = cos(x)"),
  entry('∫ sin(x) dx', 'integrals', '∫(sin(x)) dx = -cos(x) + C'),
];

test('a search matches the problem or its answer, ignoring case and spacing', () => {
  assert.deepEqual(filterHistory(history, { query: 'x^2+1' }).map((p) => p.problem), ['x^2 + 1 = 0']);
  assert.deepEqual(filterHistory(history, { query: 'COS' }).map((p) => p.problem), ['d/dx sin(x)', '∫ sin(x) dx']);
  assert.equal(filterHistory(history, { query: '  ' }).length, 4);
  assert.equal(filterHistory(history, { query: 'tan' }).length, 0);
});

test('a topic narrows the list, and combines with a search; order is kept', () => {
  assert.deepEqual(filterHistory(history, { topic: 'integrals' }).map((p) => p.problem), ['∫ x^2 dx', '∫ sin(x) dx']);
  assert.deepEqual(filterHistory(history, { topic: 'integrals', query: 'sin' }).map((p) => p.problem), ['∫ sin(x) dx']);
  assert.equal(filterHistory(history, { topic: 'all' }).length, 4);
});

test('entries saved before statuses (a bare string solution) are still searchable', () => {
  assert.equal(filterHistory([{ problem: '2+2', topic: 'other', solution: '4' }], { query: '4' }).length, 1);
});

test('topics are counted, most first, ties by label', () => {
  assert.deepEqual(topicCounts(history, { integrals: 'Integrals', algebra: 'Algebra', derivatives: 'Derivatives' }), [
    { topic: 'integrals', count: 2, label: 'Integrals' },
    { topic: 'algebra', count: 1, label: 'Algebra' },
    { topic: 'derivatives', count: 1, label: 'Derivatives' },
  ]);
  assert.deepEqual(topicCounts([]), []);
});

test('a page is twenty problems, and the totals say "worked through", not "solved"', () => {
  assert.equal(HISTORY_PAGE_SIZE, 20);
  assert.equal(historyTotalsText(history), 'Problems worked through: 4');
});
