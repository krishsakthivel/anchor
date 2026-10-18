function createReminderLifecycle(clear) {
  let userId = null;
  let initialized = false;
  let version = 0;
  let pending = Promise.resolve();
  const enqueue = operation => {
    const result = pending.catch(() => {}).then(operation);
    pending = result;
    return result;
  };
  return {
    setUser(nextUserId) {
      if (initialized && nextUserId === userId) return pending.catch(() => enqueue(clear));
      initialized = true;
      userId = nextUserId;
      version += 1;
      return enqueue(clear);
    },
    run(expectedUserId, operation) {
      const requestedVersion = version;
      return enqueue(() => {
        if (!userId || expectedUserId !== userId || requestedVersion !== version) return;
        return operation();
      });
    },
  };
}
async function settleReminderOperations(operations) {
  const results = await Promise.allSettled(operations);
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.map(result => result.value);
}
module.exports = { createReminderLifecycle, settleReminderOperations };
