const test = require('node:test');
const assert = require('node:assert/strict');
const { medicationLogError } = require('../lib/medicationLogError');
test('permission and duplicate-dose errors give actionable feedback', () => {
  assert.match(medicationLogError({ code: '42501' }), /permission/);
  assert.match(medicationLogError({ code: '42501' }), /If you own this care plan/);
  assert.match(medicationLogError({ code: '23505' }), /already been recorded/);
  assert.equal(medicationLogError({ message: 'Network failed' }), 'Network failed');
  assert.match(medicationLogError(null), /try again/i);
});
