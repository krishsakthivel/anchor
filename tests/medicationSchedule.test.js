const test = require('node:test');
const assert = require('node:assert/strict');
const { MEDICATION_DAYS, medicationDaysLabel, medicationScheduleError, medicationDoseTimesError } = require('../lib/medicationSchedule');
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

test('twice daily requires two valid distinct times while keeping optional daily doses', () => {
  assert.equal(medicationDoseTimesError(MEDICATION_DAYS, '08:00', '20:00'), '');
  assert.equal(medicationDoseTimesError(MEDICATION_DAYS, '', null), '');
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '', '20:00'), /first/);
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '08:00', ''), /second/);
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '08:00', '25:00'), /second/);
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '08:00', '08:00'), /different/);
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '08:00', '20:00', ['20:00']), /different/);
  assert.match(medicationDoseTimesError(MEDICATION_DAYS, '20:00', null, ['20:00']), /different/);
});

test('two daily schedules count as fourteen weekly doses for a single medicine', () => {
  assert.equal(expectedMedicationSlots([{ id: 'med' }], [
    { id: 'morning', medication_id: 'med', days: MEDICATION_DAYS },
    { id: 'evening', medication_id: 'med', days: MEDICATION_DAYS },
  ]), 14);
});
