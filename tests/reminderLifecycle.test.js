const test = require('node:test');
const assert = require('node:assert/strict');
const { createReminderLifecycle } = require('../lib/reminderLifecycle');
const { settleReminderOperations } = require('../lib/reminderLifecycle');

test('failed native scheduling waits for its other pending calls before logout clears', async () => {
  const events=[];
  let finishLate;
  const lifecycle=createReminderLifecycle(async()=>events.push('clear'));
  await lifecycle.setUser('a');
  const scheduling=lifecycle.run('a',()=>settleReminderOperations([
    Promise.reject(new Error('native failure')),
    new Promise(resolve=>{finishLate=()=>{events.push('scheduled');resolve();};}),
  ]));
  const rejection=assert.rejects(scheduling,/native failure/);
  await new Promise(resolve=>setImmediate(resolve));
  const logout=lifecycle.setUser(null);
  finishLate();
  await rejection;
  await logout;
  assert.deepEqual(events,['clear','scheduled','clear']);
});

test('sign-out cleanup finishes after an in-flight scheduler, and ignores late old-user requests', async () => {
  const events = [];
  const lifecycle = createReminderLifecycle(async () => events.push('clear'));
  await lifecycle.setUser('caregiver');
  let finish;
  const blocked = new Promise(resolve => { finish = resolve; });
  const scheduling = lifecycle.run('caregiver', async () => { events.push('start'); await blocked; events.push('schedule'); });
  await new Promise(resolve => setImmediate(resolve));
  const cleanup = lifecycle.setUser(null);
  finish();
  await scheduling;
  await cleanup;
  await lifecycle.run('caregiver', async () => events.push('unexpected old reminder'));
  assert.deepEqual(events, ['clear', 'start', 'schedule', 'clear']);
});

test('switching accounts clears previous reminders and only accepts the new account', async () => {
  const events = [];
  const lifecycle = createReminderLifecycle(async () => events.push('clear'));
  await lifecycle.setUser('one');
  await lifecycle.setUser('two');
  await lifecycle.run('one', async () => events.push('wrong user'));
  await lifecycle.run('two', async () => events.push('new reminder'));
  assert.deepEqual(events, ['clear', 'clear', 'new reminder']);
});

test('a failed native cleanup can be retried', async () => {
  let attempts = 0;
  const lifecycle = createReminderLifecycle(async () => { if (++attempts === 1) throw new Error('native failure'); });
  await assert.rejects(lifecycle.setUser(null));
  await lifecycle.setUser(null);
  assert.equal(attempts, 2);
});
