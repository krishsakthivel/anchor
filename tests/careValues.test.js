const test = require('node:test');
const assert = require('node:assert/strict');
const { MOODS, normalizeDays, isValidVitalValue } = require('../lib/careValues');

test('legacy string schedules and native arrays produce the same weekdays', () => {
  const days = ['monday', 'friday'];
  assert.deepEqual(normalizeDays(days), days);
  assert.deepEqual(normalizeDays(JSON.stringify(days)), days);
  for (const invalid of [null, 'broken', '{}', 'null', 4]) assert.deepEqual(normalizeDays(invalid), []);
});

test('patient and caregiver use the same meaning for stored moods', () => {
  assert.equal(MOODS.find(mood => mood.value === 3).label, 'Not great');
  assert.equal(MOODS.find(mood => mood.value === 4).label, 'Okay');
});

test('vital formats reject malformed and nonpositive values', () => {
  assert.equal(isValidVitalValue('blood_pressure', '120/80'), true);
  assert.equal(isValidVitalValue('blood_pressure', ' 120 / 80 '), true);
  for (const value of ['abc', '120', '00/80', '120/-80']) assert.equal(isValidVitalValue('blood_pressure', value), false);
  for (const value of ['abc', '-1', '0', '1e2', 'Infinity']) assert.equal(isValidVitalValue('oxygen', value), false);
  assert.equal(isValidVitalValue('temperature', '98.6'), true);
});
