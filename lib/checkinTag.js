const PREFIX = 'anchor-location:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function locationTagText(token) {
  if (!UUID.test(token || '')) throw new Error('Invalid place token');
  return `${PREFIX}${token.toLowerCase()}`;
}

function tokenFromLocationTag(text) {
  if (typeof text !== 'string' || !text.startsWith(PREFIX)) throw new Error('This is not an Anchor check-in sticker.');
  const token = text.slice(PREFIX.length);
  if (!UUID.test(token)) throw new Error('This sticker has an invalid place code.');
  return token.toLowerCase();
}

module.exports = { locationTagText, tokenFromLocationTag };
