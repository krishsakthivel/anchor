const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPatientExport, buildPatientExportHtml, EXPORT_TABLES } = require('../lib/patientExport');
function clientFor(tables, failedTable, pageCap = Infinity) {
  const calls = [];
  return { calls, from(table) {
    const filters = []; let start = 0, end = Infinity;
    const query = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, order() { return this; }, range(from, to) { start = from; end = to; return this; },
      async single() { calls.push({ table, filters }); return { data: (tables[table] || []).find(row => filters.every(([key, value]) => row[key] === value)), error: null }; },
      then(resolve, reject) { calls.push({ table, filters, start, end }); const matching = (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value)).sort((a, b) => String(a.id).localeCompare(String(b.id))); const data = matching.slice(start, Math.min(end + 1, start + pageCap)); return Promise.resolve({ data, count: matching.length, error: table === failedTable ? { message: 'denied' } : null }).then(resolve, reject); },
    }; return query;
  } };
}
test('export pages through history and scopes every query to the selected patient', async () => {
  const tables = { patients: [{ id: 'p', name: 'Alex' }], medication_log: Array.from({ length: 1001 }, (_, index) => ({ id: String(index).padStart(5, '0'), patient_id: 'p', status: 'taken' })) };
  tables.medication_log.push({ id: 'other', patient_id: 'someone-else', status: 'missed' });
  const client = clientFor(tables);
  const data = await loadPatientExport(client, 'p');
  assert.equal(data.medication_log.length, 1001);
  assert.equal(client.calls.filter(call => call.table === 'medication_log').length, 3);
  for (const call of client.calls) assert.deepEqual(call.filters, [[call.table === 'patients' ? 'id' : 'patient_id', 'p']]);
  assert.equal(Object.keys(data).length, Object.keys(EXPORT_TABLES).length + 2);
});
test('denied reads stop the export instead of producing an incomplete report', async () => {
  const client = clientFor({ patients: [{ id: 'p', name: 'Alex' }] }, 'vital_signs');
  await assert.rejects(loadPatientExport(client, 'p'), /Could not export vital signs.*No PDF was created/);
  await assert.rejects(loadPatientExport(client, 'no-access'), /Check your access/);
});
test('leaving the patient cancels pending export work', async () => {
  const client = clientFor({ patients: [{ id: 'p', name: 'Alex' }] });
  let checks = 0;
  await assert.rejects(loadPatientExport(client, 'p', () => ++checks < 3), /cancelled/);
  assert.equal(client.calls.length, 1);
});
test('PDF HTML escapes patient content and excludes access codes, tokens and internal identifiers', () => {
  const html = buildPatientExportHtml({ patient: { id: 'PRIVATE-ID', name: 'Zoë 李 <script>alert(1)</script>', pair_code: 'SECRET-CODE', paired_user_id: 'SECRET-USER' }, generatedAt: '2026-10-25T12:00:00Z', care_notes: [{ title: '<img src=x onerror=alert(2)>', body: 'A & B\nSecond line', pinned: true }], daily_plans: [{ plan_date: '2026-10-25', blocks: [{ title: 'Read', start: '13:00', minutes: 30, tag_token: 'SECRET-TOKEN' }] }] });
  assert.match(html, /Zoë 李 &lt;script&gt;/);
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  for (const secret of ['PRIVATE-ID', 'SECRET-CODE', 'SECRET-USER', 'SECRET-TOKEN']) assert.ok(!html.includes(secret));
  assert.match(html, /A &amp; B<br>Second line/);
});
test('report includes both dose times, zero stock, history, notes, and removed activities', () => {
  const html = buildPatientExportHtml({ patient: { name: 'Alex' }, medications: [{ id: 'm', name: 'Example medicine', pills_remaining: 0, total_pills: 30 }], medication_schedule: [{ id: 'morning', medication_id: 'm', time: '08:00', days: ['monday'] }, { id: 'evening', medication_id: 'm', time: '20:00', days: ['monday'] }], medication_log: [{ medication_id: 'm', schedule_id: 'evening', status: 'taken', log_day: '2026-10-25' }], mood_logs: [{ mood: 1 }], daily_plans: [{ plan_date: '2026-10-25', blocks: JSON.stringify([{ type: 'play', start: '10:00', minutes: 20, removed: true }]) }] });
  for (const text of ['8:00 AM - Mon', '8:00 PM - Mon', '0 remaining', 'Medication history', 'Very unwell', 'Activity time', 'Removed from schedule', 'Emergency contacts', 'Other reminders']) assert.ok(html.includes(text), text);
});

test('export still fetches every record when the server caps pages below the requested size', async () => {
  const tables = { patients: [{ id: 'p', name: 'Alex' }], care_notes: Array.from({ length: 9 }, (_, i) => ({ id: String(i), patient_id: 'p', body: 'Note' })) };
  const client = clientFor(tables, null, 4);
  const data = await loadPatientExport(client, 'p');
  assert.equal(data.care_notes.length, 9);
  assert.deepEqual(client.calls.filter(call => call.table === 'care_notes').map(call => call.start), [0, 4, 8]);
});
