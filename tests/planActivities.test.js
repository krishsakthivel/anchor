const test = require('node:test');
const assert = require('node:assert/strict');
const { activePlanEntries, removePlanActivity } = require('../lib/planActivities');

test('removing an activity hides it while preserving check-in indices and other activities', () => {
  const blocks = [{ type: 'quiet', start: '13:00', minutes: 45, location_id: 'garden', location_name: 'Garden' }, { type: 'sleep', start: '20:00', minutes: 45 }];
  const removed = removePlanActivity(blocks, 0);
  assert.deepEqual(activePlanEntries(removed), [{ block: blocks[1], index: 1 }]);
  assert.equal(removed.length, 2);
  assert.equal(removed[0].location_id, null);
  assert.equal(removed[0].location_name, null);
  assert.equal(blocks[0].removed, undefined);
  assert.equal(blocks[0].location_id, 'garden');
  assert.equal(removed[1], blocks[1]);
});

test('removing the final visible activity leaves an empty schedule', () => {
  const blocks = [{ type: 'quiet', removed: true }, { type: 'sleep', start: '20:00', minutes: 45 }];
  assert.deepEqual(activePlanEntries(removePlanActivity(blocks, 1)), []);
  assert.deepEqual(activePlanEntries(), []);
});

test('invalid or already removed activities cannot delete another activity', () => {
  const blocks = [{ type: 'quiet', removed: true }, { type: 'sleep' }];
  for (const index of [-1, 0, 2, 0.5, '1']) assert.throws(() => removePlanActivity(blocks, index), /no longer available/);
});
