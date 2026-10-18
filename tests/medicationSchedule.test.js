const test = require('node:test');
const assert = require('node:assert/strict');
const { MEDICATION_DAYS, medicationDaysLabel, medicationScheduleError } = require('../lib/medicationSchedule');
const { medicationReminderTriggers } = require('../lib/reminderSchedule');
const { expectedMedicationSlots } = require('../lib/reportWindow');

test('weekday labels preserve selected days and legacy schedules', () => {
  assert.equal(medicationDaysLabel(MEDICATION_DAYS), 'Every day');
  assert.equal(medicationDaysLabel('["friday","monday","wednesday"]'), 'Mon, Wed, Fri');
  assert.equal(medicationDaysLabel([]), 'No days selected');
});
test('specific weekdays require a time while an untimed daily medicine stays supported', () => {
  assert.equal(medicationScheduleError(MEDICATION_DAYS, ''), '');
  assert.equal(medicationScheduleError(['monday','wednesday'], '08:30'), '');
  assert.match(medicationScheduleError(['monday'], ''), /time/);
  assert.match(medicationScheduleError([], '08:30'), /at least one/);
  assert.match(medicationScheduleError(['monday'], '25:00'), /valid/);
});
test('selected weekdays drive reminders and weekly expected doses', () => {
  const days = ['monday','wednesday','friday'];
  assert.deepEqual(medicationReminderTriggers('09:00', days, 15).map(item => item.weekday), [2,4,6]);
  assert.equal(expectedMedicationSlots([{id:'med'}],[{id:'slot',medication_id:'med',days}]),3);
});
