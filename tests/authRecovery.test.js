const test = require('node:test');
const assert = require('node:assert/strict');
const { recoveryParams, establishRecoverySession } = require('../lib/authRecovery');

test('recovery links preserve token padding and decode errors safely', () => {
  assert.equal(recoveryParams('anchor://reset-password#access_token=abc%3D%3D').access_token, 'abc==');
  assert.throws(() => recoveryParams('anchor://reset-password#error_description=%E0'), /invalid/);
});
test('recovery installs implicit tokens and verifies the resulting session', async () => {
  let received;
  const auth = { setSession: async tokens => { received=tokens;return {}; }, getSession: async()=>({ data:{session:{user:{id:'test'}}} }) };
  assert.equal(await establishRecoverySession(auth,'anchor://reset-password#access_token=a&refresh_token=b&type=recovery'),true);
  assert.deepEqual(received,{access_token:'a',refresh_token:'b'});
});
test('PKCE recovery exchanges the code before checking the session', async () => {
  const calls=[];
  const auth = { exchangeCodeForSession: async code=>{calls.push(code);return {};},getSession:async()=>{calls.push('session');return {data:{session:{}}};} };
  assert.equal(await establishRecoverySession(auth,'https://example.test/reset-password?code=test-code'),true);
  assert.deepEqual(calls,['test-code','session']);
});
test('expired, incomplete and failed recovery links reject without using an old session', async () => {
  const auth = {getSession:()=>{throw Error('must not use old session');},setSession:async()=>({error:Error('Session rejected')})};
  await assert.rejects(establishRecoverySession(auth,'anchor://reset-password#error=expired&error_description=Link+expired'),/Link expired/);
  await assert.rejects(establishRecoverySession(auth,'anchor://reset-password#access_token=a'),/incomplete/);
  await assert.rejects(establishRecoverySession(auth,'anchor://reset-password#access_token=a&refresh_token=b'),/Session rejected/);
});
