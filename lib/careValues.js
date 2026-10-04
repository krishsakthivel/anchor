const MOODS = [
  { value: 1, emoji: '🤒', label: 'Very unwell' },
  { value: 2, emoji: '😢', label: 'Sad' },
  { value: 3, emoji: '😟', label: 'Not great' },
  { value: 4, emoji: '😐', label: 'Okay' },
  { value: 5, emoji: '😊', label: 'Good' },
];

function normalizeDays(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

function isValidVitalValue(type, value) {
  const text = String(value || '').trim();
  if (type === 'blood_pressure') {
    const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(text);
    return !!match && Number(match[1]) > 0 && Number(match[2]) > 0;
  }
  return text.length <= 32 && /^\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && Number(text) > 0;
}

module.exports = { MOODS, normalizeDays, isValidVitalValue };
