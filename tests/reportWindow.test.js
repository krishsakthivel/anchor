const test = require('node:test');
const assert = require('node:assert/strict');
const { reportWindow, expectedMedicationSlots, expectedTaskSlots } = require('../lib/reportWindow');
const { reportTotals } = require('../lib/reportWindow');

test('historical logs for inactive tasks and schedules count in both reports without exceeding 100%', () => {
  const now = new Date(2026, 9, 15, 12);
  const log = { medication_id: 'old-med', schedule_id: 'old-slot', log_day: '2026-10-14', status: 'taken' };
  const task = { task_id: 'old-task', completion_day: '2026-10-14', status: 'completed' };
  const report = reportTotals([], [], [], [log, log], [task, task], now);
  assert.equal(report.medTaken, 1);
  assert.equal(report.totalMedSlots, 1);
  assert.equal(report.taskDone, 1);
  assert.equal(report.totalTaskSlots, 1);
});
test('report totals combine unrecorded current slots and recorded historical slots', () => {
  const now = new Date(2026, 9, 15, 12);
  const report = reportTotals([{ id: 'new', created_at: new Date(2026,9,15,9).toISOString() }], [], [],
    [{ medication_id: 'old', log_day: '2026-10-14', status: 'taken' },
     { medication_id: 'old', log_day: '2026-10-01', status: 'taken' }], [], now);
  assert.equal(report.totalMedSlots, 2);
  assert.equal(report.medTaken, 1);
});
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

test('both reports cover today plus six preceding calendar dates', () => {
  const range = reportWindow(new Date(2026, 9, 14, 20, 30));
  assert.equal(range.startDay, '2026-10-08');
  assert.equal(range.endDay, '2026-10-15');
  assert.equal(range.start.getHours(), 0);
  assert.equal(range.end.getHours(), 0);
  assert.equal(range.days.length, 7);
  assert.equal(new Set(range.days).size, 7);
});

test('a daily medication has seven expected doses even with legacy encoded JSON', () => {
  for (const scheduleDays of [days, JSON.stringify(days)]) {
    assert.equal(expectedMedicationSlots([{ id: 'med' }], [{ medication_id: 'med', days: scheduleDays }]), 7);
  }
});

test('multiple daily slots and selected-day tasks retain their actual counts', () => {
  assert.equal(expectedMedicationSlots([{ id: 'med' }], [
    { medication_id: 'med', days }, { medication_id: 'med', days },
  ]), 14);
  assert.equal(expectedTaskSlots([{ days: '["monday","friday"]' }, { days: null }, { days: [] }]), 9);
});

test('calendar arithmetic still yields seven dates around daylight-saving changes', () => {
  for (const now of [new Date(2026, 2, 10, 18), new Date(2026, 10, 3, 18)]) {
    const range = reportWindow(now);
    assert.equal(range.days.length, 7);
    assert.equal(new Set(range.days).size, 7);
  }
});

test('new medicines and tasks are not counted before their creation date', () => {
  const now = new Date(2026, 9, 15, 20);
  const today = new Date(2026, 9, 15, 10).toISOString();
  const future = new Date(2026, 9, 16, 10).toISOString();
  assert.equal(expectedMedicationSlots([{ id: 'new', created_at: today }], [{ medication_id: 'new', days }], now), 1);
  assert.equal(expectedMedicationSlots([{ id: 'new', created_at: today }], [], now), 1);
  assert.equal(expectedTaskSlots([{ created_at: today, days }], now), 1);
  assert.equal(expectedTaskSlots([{ created_at: future, days }], now), 0);
});

test('a newly added schedule does not create historical expected doses', () => {
  const now = new Date(2026, 9, 15, 20);
  const today = new Date(2026, 9, 15, 10).toISOString();
  assert.equal(expectedMedicationSlots([{ id: 'old' }], [{ medication_id: 'old', days, created_at: today }], now), 1);
});
