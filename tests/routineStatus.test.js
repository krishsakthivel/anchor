const test = require('node:test');
const assert = require('node:assert/strict');
const { getRoutineStatus } = require('../lib/routineStatus');

test('an untouched medicine remains actionable', () => {
  assert.deepEqual(getRoutineStatus('medicine'), {
    handled: false,
    complete: false,
    label: 'Medicine',
  });
});

test('taken medicine is completed', () => {
  assert.deepEqual(getRoutineStatus('medicine', 'taken'), {
    handled: true,
    complete: true,
    label: 'Completed',
  });
});

test('skipped and missed medicine are handled without being completed', () => {
  assert.deepEqual(getRoutineStatus('medicine', 'skipped'), {
    handled: true,
    complete: false,
    label: 'Skipped',
  });
  assert.deepEqual(getRoutineStatus('medicine', 'missed'), {
    handled: true,
    complete: false,
    label: 'Missed',
  });
});

test('task completion states use the same patient-facing language', () => {
  assert.deepEqual(getRoutineStatus('task', 'completed'), {
    handled: true,
    complete: true,
    label: 'Completed',
  });
  assert.deepEqual(getRoutineStatus('task', 'skipped'), {
    handled: true,
    complete: false,
    label: 'Skipped',
  });
});
