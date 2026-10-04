const test = require('node:test');
const assert = require('node:assert/strict');
const { medicationReminderTriggers } = require('../lib/reminderSchedule');

test('daily medicine has one daily reminder', () => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  assert.deepEqual(medicationReminderTriggers('08:30:00', days, 15), [{ type: 'daily', hour: 8, minute: 15 }]);
});

test('selected days do not create reminders on other days', () => {
  assert.deepEqual(medicationReminderTriggers('10:00', ['monday', 'wednesday'], 60), [
    { type: 'weekly', weekday: 2, hour: 9, minute: 0 },
    { type: 'weekly', weekday: 4, hour: 9, minute: 0 },
  ]);
});

test('reminder before midnight moves to the preceding weekday', () => {
  assert.deepEqual(medicationReminderTriggers('00:30', '["monday"]', 60), [
    { type: 'weekly', weekday: 1, hour: 23, minute: 30 },
  ]);
});
