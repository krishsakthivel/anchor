const clock = (hour, minute = 0) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export const planLabels = {
  care: 'Care time',
  play: 'Activity time',
  quiet: 'Quiet time',
  rest: 'Rest time',
  sleep: 'Wind-down',
};

export function buildDailyPlan(answers, medications = []) {
  const energy = Number(answers.energy || 3);
  const sleep = Number(answers.sleep || 3);
  const feeling = Number(answers.feeling || 3);
  const play = answers.play === 'yes';
  const needsCare = answers.needsCare === 'yes';
  const lowEnergy = energy <= 1 || sleep <= 1 || feeling <= 1;
  const blocks = [];

  if (needsCare || lowEnergy) blocks.push({ type: 'care', start: clock(9), minutes: lowEnergy ? 45 : 30 });
  if (play && !lowEnergy) blocks.push({ type: 'play', start: clock(10), minutes: energy >= 3 ? 120 : 60 });
  blocks.push({ type: 'quiet', start: clock(lowEnergy ? 11 : 13), minutes: lowEnergy ? 90 : 45 });
  if (lowEnergy) blocks.push({ type: 'rest', start: clock(14), minutes: 120 });
  blocks.push({ type: 'sleep', start: clock(lowEnergy ? 19 : 20), minutes: 45 });

  medications.forEach((medication) => {
    if (medication.schedule_time) blocks.push({ type: 'medicine', title: medication.name, start: medication.schedule_time.slice(0, 5), minutes: 15 });
  });

  return blocks.sort((a, b) => a.start.localeCompare(b.start));
}

export function displayTime(time) {
  const [hourText, minute = '00'] = String(time).split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}
