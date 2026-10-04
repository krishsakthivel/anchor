function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function advanceCalendarSelection(selected, previousToday, today) {
  const lastDay = new Date(`${today}T12:00:00`);
  lastDay.setDate(lastDay.getDate() + 6);
  if (selected === previousToday || selected < today || selected > localDateKey(lastDay)) return today;
  return selected;
}

module.exports = { localDateKey, advanceCalendarSelection };
