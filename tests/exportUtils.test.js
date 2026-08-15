import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProgressCSV } from '../src/lib/exportUtils.js';
import { STATUS } from '../src/lib/solutionEnvelope.js';

const TOPIC_LABELS = { algebra: 'Algebra', integrals: 'Integrals' };

function entry(overrides = {}) {
  return {
    createdAt: '2026-08-15T12:00:00.000Z',
    topic: 'algebra',
    problem: '2*x + 5 = 11',
    solution: { status: STATUS.SOLVED, steps: ['Subtract 5'], answer: 'x = 3' },
    ...overrides,
  };
}

function cells(line) {
  // Split on commas that sit between quoted fields, then unwrap the quotes.
  return line.split('","').map((c) => c.replace(/^"|"$/g, ''));
}

test('buildProgressCSV quotes every field and keeps the column order', () => {
  const csv = buildProgressCSV([entry()], TOPIC_LABELS);
  const [header, row] = csv.split('\n');

  assert.deepEqual(cells(header), ['Date', 'Topic', 'Problem', 'Status', 'Solution']);
  const values = cells(row);
  assert.equal(values[1], 'Algebra');
  assert.equal(values[2], '2*x + 5 = 11');
  assert.equal(values[3], 'Solved');
  assert.equal(values[4], 'x = 3');
});

test('buildProgressCSV neutralizes cells a spreadsheet would run as a formula', () => {
  const csv = buildProgressCSV(
    [entry({ problem: '=1+1', solution: { status: STATUS.SOLVED, steps: [], answer: '@SUM(A1)' } })],
    TOPIC_LABELS
  );
  const values = cells(csv.split('\n')[1]);

  assert.equal(values[2], "'=1+1");
  assert.equal(values[4], "'@SUM(A1)");
});

test('buildProgressCSV guards a legitimate leading minus too', () => {
  const csv = buildProgressCSV([entry({ problem: '-3 < x < 5' })], TOPIC_LABELS);
  assert.equal(cells(csv.split('\n')[1])[2], "'-3 < x < 5");
});

test('buildProgressCSV escapes embedded quotes without breaking the row', () => {
  const csv = buildProgressCSV([entry({ problem: 'solve "x" for 2*x = 4' })], TOPIC_LABELS);
  const row = csv.split('\n')[1];

  assert.ok(row.includes('solve ""x"" for 2*x = 4'));
  assert.equal(csv.split('\n').length, 2, 'row must not spill onto another line');
});

test('buildProgressCSV labels an outcome that was not solved', () => {
  const csv = buildProgressCSV(
    [
      entry({
        topic: 'integrals',
        problem: 'sin(x^2)',
        solution: {
          status: STATUS.UNSUPPORTED,
          steps: [],
          answer: 'This integral is non-elementary',
        },
      }),
    ],
    TOPIC_LABELS
  );

  assert.equal(cells(csv.split('\n')[1])[3], 'Beyond this solver');
});

test('buildProgressCSV treats pre-status history as solved', () => {
  // Entries saved before the solution envelope existed carry no status.
  const csv = buildProgressCSV([entry({ solution: { steps: [], answer: 'x = 3' } })], TOPIC_LABELS);
  assert.equal(cells(csv.split('\n')[1])[3], 'Solved');
});
