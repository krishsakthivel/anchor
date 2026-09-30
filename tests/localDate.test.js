const test = require('node:test');
const assert = require('node:assert/strict');
const { localDateKey } = require('../lib/localDate');

test('daily logs use the device date across local midnight', () => {
  assert.equal(localDateKey(new Date(2026, 8, 29, 23, 59)), '2026-09-29');
  assert.equal(localDateKey(new Date(2026, 8, 30, 0, 1)), '2026-09-30');
});
