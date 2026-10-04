const test = require('node:test');
const assert = require('node:assert/strict');
const { pairingCodeStatus } = require('../lib/pairingCodeStatus');
const patient = { pair_code: '00123456', paired_user_id: null };
const now = new Date('2026-10-17T14:00:00Z');
const row = { code: '00123456', used: false, expires_at: '2026-10-18T14:00:00Z' };

test('a valid code remains valid across reloads and preserves leading zeroes', () => {
  const original = JSON.stringify(row);
  for (let reload = 0; reload < 3; reload++) {
    const result = pairingCodeStatus({ ...patient }, { ...row }, new Date(now.getTime() + reload * 1000));
    assert.equal(result.state, 'valid');
    assert.equal(result.label, 'Code 00123456');
    assert.equal(result.expiresAt, new Date(row.expires_at).toISOString());
  }
  assert.equal(JSON.stringify(row), original);
});
test('only a confirmed passed expiration timestamp is marked expired', () => {
  assert.equal(pairingCodeStatus(patient, row, new Date(row.expires_at)).state, 'expired');
  for (const expires_at of [null, undefined, '', 'invalid']) {
    assert.equal(pairingCodeStatus(patient, { ...row, expires_at }, now).state, 'unavailable');
  }
  assert.equal(pairingCodeStatus(patient, null, now).state, 'unavailable');
  assert.equal(pairingCodeStatus(patient, { ...row, code: '99999999' }, now).state, 'unavailable');
});
test('used codes, missing codes and paired patients have distinct statuses', () => {
  assert.equal(pairingCodeStatus(patient, { ...row, used: true }, now).state, 'used');
  assert.equal(pairingCodeStatus({ pair_code: null }, null, now).state, 'missing');
  assert.equal(pairingCodeStatus({ ...patient, paired_user_id: 'patient-user' }, { ...row, used: true }, now).state, 'connected');
});
