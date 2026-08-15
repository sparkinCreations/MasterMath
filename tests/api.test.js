// The storage layer's error contract: the message a caller shows the user is
// generic, but the specific cause is never thrown away — and a bad argument is
// reported as itself rather than as a storage failure.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createProblemHistory, updateProblemHistory } from '../src/lib/api.js';

const VALID = {
  problem: '2*x + 5 = 11',
  topic: 'algebra',
  solution: { steps: ['Subtract 5'], answer: 'x = 3' },
};

test('createProblemHistory reports validation failures specifically', async () => {
  await assert.rejects(
    () => createProblemHistory({ ...VALID, topic: 'geometry' }),
    { message: 'Invalid topic selected' }
  );

  await assert.rejects(
    () => createProblemHistory({ ...VALID, solution: { steps: [] } }),
    { message: 'Solution must include an answer' }
  );

  await assert.rejects(
    () => createProblemHistory({ ...VALID, problem: '' }),
    { message: 'Problem is required' }
  );
});

test('updateProblemHistory reports a missing id specifically', async () => {
  await assert.rejects(() => updateProblemHistory(undefined, {}), {
    message: 'Invalid entity ID',
  });
});

test('createProblemHistory keeps the underlying storage error as cause', async () => {
  const underlying = new Error('QuotaExceededError');
  const original = globalThis.indexedDB;
  globalThis.indexedDB = {
    open() {
      const request = { error: underlying, onerror: null, onsuccess: null, onupgradeneeded: null };
      setTimeout(() => request.onerror && request.onerror(), 0);
      return request;
    },
  };

  try {
    await assert.rejects(() => createProblemHistory(VALID), (error) => {
      // The user-facing message stays generic...
      assert.equal(error.message, 'Failed to save problem. Please try again.');
      // ...while the real reason remains reachable for debugging.
      assert.equal(error.cause, underlying);
      return true;
    });
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
