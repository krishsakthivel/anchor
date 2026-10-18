function pairingCodeStatus(patient, codeRow, now = new Date()) {
  if (patient.paired_user_id) return { state: 'connected', label: 'Connected' };
  if (!patient.pair_code) return { state: 'missing', label: 'No pairing code' };
  if (!codeRow || codeRow.code !== patient.pair_code) {
    return { state: 'unavailable', label: 'Code status unavailable' };
  }
  if (codeRow.used === true) return { state: 'used', label: 'Code already used' };
  const expiresAt = typeof codeRow.expires_at === 'string' && codeRow.expires_at.trim()
    ? new Date(codeRow.expires_at) : null;
  if (!expiresAt || !Number.isFinite(expiresAt.getTime())) {
    return { state: 'unavailable', label: 'Code status unavailable' };
  }
  if (expiresAt <= now) return { state: 'expired', label: 'Code expired', expiresAt: expiresAt.toISOString() };
  return { state: 'valid', label: `Code ${patient.pair_code}`, expiresAt: expiresAt.toISOString() };
}
module.exports = { pairingCodeStatus };
