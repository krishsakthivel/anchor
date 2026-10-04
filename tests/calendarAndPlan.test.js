const test = require('node:test');
const assert = require('node:assert/strict');
const { advanceCalendarSelection } = require('../lib/localDate');
test('calendar follows today across midnight and preserves a valid future selection', () => {
  assert.equal(advanceCalendarSelection('2026-10-14','2026-10-14','2026-10-15'), '2026-10-15');
  assert.equal(advanceCalendarSelection('2026-10-17','2026-10-14','2026-10-15'), '2026-10-17');
  assert.equal(advanceCalendarSelection('2026-10-17','2026-10-14','2026-10-25'), '2026-10-25');
});
test('the three survey choices produce low, moderate and high-energy plans', async () => {
  const { buildDailyPlan } = await import('../lib/dailyPlan.js');
  const answers = { sleep: '3', feeling: '3', play: 'yes', needsCare: 'no' };
  assert.equal(buildDailyPlan({ ...answers, energy: '3' }).find(block => block.type === 'play').minutes, 120);
  assert.equal(buildDailyPlan({ ...answers, energy: '2' }).find(block => block.type === 'play').minutes, 60);
  assert.equal(buildDailyPlan({ ...answers, energy: '1' }).some(block => block.type === 'play'), false);
});
