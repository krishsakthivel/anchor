function medicationLogError(error) {
  if (error?.code === '42501') {
    return 'Medication recording was blocked by database permissions. If you own this care plan, ask the app administrator to apply the medication access update. Otherwise, ask the owner to check your access.';
  }
  if (error?.code === '23505') return 'This dose has already been recorded. Refresh the care plan to see its status.';
  return error?.message || 'Could not record this medicine. Please try again.';
}
module.exports = { medicationLogError };
