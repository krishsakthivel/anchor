const test = require('node:test');
const assert = require('node:assert/strict');
const { locationTagText, tokenFromLocationTag } = require('../lib/checkinTag');

test('a sticker written for a place can be decoded for check-in', () => {
  const token = 'C1BCDA7F-779D-447B-AD3C-246594BCA424';
  assert.equal(tokenFromLocationTag(locationTagText(token)), token.toLowerCase());
});

test('unrelated or damaged sticker content is rejected', () => {
  assert.throws(() => tokenFromLocationTag('Game room'), /not an Anchor/);
  assert.throws(() => tokenFromLocationTag('anchor-location:1234'), /invalid place/);
});
