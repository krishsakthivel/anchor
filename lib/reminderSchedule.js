const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function medicationReminderTriggers(time, days, minutesBefore) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(time || ''));
  if (!match) return [];
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return [];

  let selectedDays = days;
  if (typeof selectedDays === 'string') {
    try { selectedDays = JSON.parse(selectedDays); } catch { selectedDays = []; }
  }
  if (!Array.isArray(selectedDays)) return [];
  const dayIndexes = [...new Set(selectedDays.map((day) => WEEKDAYS.indexOf(String(day).toLowerCase())))].filter((index) => index >= 0);
  if (!dayIndexes.length) return [];

  const reminderMinutes = hour * 60 + minute - minutesBefore;
  const reminderHour = Math.floor((reminderMinutes + 1440) % 1440 / 60);
  const reminderMinute = (reminderMinutes + 1440) % 60;
  if (dayIndexes.length === 7) return [{ type: 'daily', hour: reminderHour, minute: reminderMinute }];

  return dayIndexes.map((index) => ({
    type: 'weekly',
    weekday: ((index + (reminderMinutes < 0 ? 6 : 0)) % 7) + 1,
    hour: reminderHour,
    minute: reminderMinute,
  }));
}

module.exports = { medicationReminderTriggers };
