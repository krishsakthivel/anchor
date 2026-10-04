const test = require('node:test');
const assert = require('node:assert/strict');
const { withTimeout, initialDestination } = require('../lib/startup');
test('a stalled startup rejects instead of waiting forever', async () => {
  await assert.rejects(withTimeout(() => new Promise(() => {}), 10), /Loading took too long/);
});
test('a failed startup can be retried successfully', async () => {
  await assert.rejects(withTimeout(() => Promise.reject(new Error('offline')), 100), /offline/);
  assert.equal(await withTimeout(() => Promise.resolve('loaded'), 100), 'loaded');
});
test('startup propagates database errors rather than choosing the wrong home', async () => {
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: new Error('database unavailable') }; } };
  const client = { from() { return query; } };
  await assert.rejects(initialDestination(client, { user: { id: 'test' } }), /database unavailable/);
  assert.deepEqual(await initialDestination(client, null), { route: 'Landing', patientId: null });
});
