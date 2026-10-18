const { normalizeDays } = require('./careValues');

const MEDICATION_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function medicationDaysLabel(value) {
  const days = MEDICATION_DAYS.filter(day => normalizeDays(value).includes(day));
  if (days.length === 7) return 'Every day';
  if (!days.length) return 'No days selected';
  return days.map(day => day.slice(0, 3).replace(/^./, letter => letter.toUpperCase())).join(', ');
}

function medicationScheduleError(days, time) {
  const selected = MEDICATION_DAYS.filter(day => normalizeDays(days).includes(day));
  if (!selected.length) return 'Choose at least one day for this medication.';
  if (selected.length < 7 && !time.trim()) return 'Choose a medicine time to save a schedule for specific weekdays.';
  if (time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) return 'Choose a valid medicine time.';
  return '';
}

function medicationDoseTimesError(days, firstTime, secondTime = null, otherTimes = []) {
  const error = medicationScheduleError(days, firstTime);
  if (error) return error;
  if (secondTime !== null && !firstTime.trim()) return 'Choose the first dose time.';
  if (secondTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(secondTime.trim())) return 'Choose a valid second dose time.';
  const times = [firstTime.trim(), ...(secondTime === null ? [] : [secondTime.trim()])].filter(Boolean);
  if (new Set(times).size !== times.length || times.some(time => otherTimes.includes(time))) return 'Each dose needs a different time.';
  return '';
}

module.exports = { MEDICATION_DAYS, medicationDaysLabel, medicationScheduleError, medicationDoseTimesError };
