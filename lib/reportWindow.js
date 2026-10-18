const { localDateKey } = require('./localDate');
const { normalizeDays } = require('./careValues');
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function reportWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });
  const days = dates.map(date => WEEKDAYS[date.getDay()]);
  return { start, end, startDay: localDateKey(start), endDay: localDateKey(end), days, dates };
}

function existedOnDay(item, date) {
  if (!item?.created_at) return true;
  const created = new Date(item.created_at);
  if (!Number.isFinite(created.getTime())) return true;
  return localDateKey(created) <= localDateKey(date);
}

function expectedMedicationKeys(items, schedules, now = new Date()) {
  const { dates } = reportWindow(now);
  const keys = new Set();
  (items || []).forEach((item, itemIndex) => {
    const slots = (schedules || []).filter(schedule => schedule.medication_id === item.id);
    dates.forEach(date => {
      if (!existedOnDay(item, date)) return;
      const day = localDateKey(date);
      if (!slots.length) keys.add(`${item.id ?? itemIndex}:default:${day}`);
      else slots.filter(slot => existedOnDay(slot, date) && normalizeDays(slot.days).includes(WEEKDAYS[date.getDay()]))
        .forEach((slot, slotIndex) => keys.add(`${item.id ?? itemIndex}:${slot.id ?? slotIndex}:${day}`));
    });
  });
  return keys;
}

function expectedTaskKeys(tasks, now = new Date()) {
  const { dates } = reportWindow(now);
  const keys = new Set();
  (tasks || []).forEach((task, taskIndex) => {
    const configured = task.days == null ? WEEKDAYS : normalizeDays(task.days);
    dates.filter(date => existedOnDay(task, date) && configured.includes(WEEKDAYS[date.getDay()]))
      .forEach(date => keys.add(`${task.id ?? taskIndex}:${localDateKey(date)}`));
  });
  return keys;
}

const expectedMedicationSlots = (items, schedules, now) => expectedMedicationKeys(items, schedules, now).size;
const expectedTaskSlots = (tasks, now) => expectedTaskKeys(tasks, now).size;

function reportTotals(items, schedules, tasks, medLogs, taskCompletions, now = new Date()) {
  const { startDay, endDay } = reportWindow(now);
  const medicationKeys = expectedMedicationKeys(items, schedules, now);
  const taskKeys = expectedTaskKeys(tasks, now);
  const medicines = new Map();
  const completions = new Map();
  for (const log of medLogs || []) {
    if (log.log_day < startDay || log.log_day >= endDay || !log.log_day) continue;
    const key = `${log.medication_id}:${log.schedule_id || 'default'}:${log.log_day}`;
    medicationKeys.add(key);
    medicines.set(key, log.status);
  }
  for (const log of taskCompletions || []) {
    if (log.completion_day < startDay || log.completion_day >= endDay || !log.completion_day) continue;
    const key = `${log.task_id}:${log.completion_day}`;
    taskKeys.add(key);
    completions.set(key, log.status);
  }
  const count = (map, status) => [...map.values()].filter(value => value === status).length;
  return {
    totalMedSlots: medicationKeys.size, totalTaskSlots: taskKeys.size,
    medTaken: count(medicines, 'taken'), medMissed: count(medicines, 'missed'), medSkipped: count(medicines, 'skipped'),
    taskDone: count(completions, 'completed'), taskMissed: count(completions, 'missed'),
  };
}
module.exports = { reportWindow, expectedMedicationSlots, expectedTaskSlots, reportTotals };
