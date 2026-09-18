function getRoutineStatus(kind, status) {
  const handled = Boolean(status);
  const complete = kind === 'medicine' ? status === 'taken' : status === 'completed';

  let label = kind === 'medicine' ? 'Medicine' : 'To do';
  if (complete) label = 'Completed';
  else if (status === 'missed') label = 'Missed';
  else if (status === 'skipped') label = 'Skipped';

  return { handled, complete, label };
}

module.exports = { getRoutineStatus };
