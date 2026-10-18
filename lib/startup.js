const { needsCaregiverTutorial } = require('./caregiverTutorial');

function withTimeout(operation, timeoutMs = 15000) {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Loading took too long. Check your connection and try again.')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function initialDestination(client, session) {
  if (!session) return { route: 'Landing', patientId: null };
  const lookupPatient = async () => {
    const { data, error } = await client.from('patients').select('id').eq('paired_user_id', session.user.id).maybeSingle();
    if (error) throw error;
    return { route: data ? 'PatientHome' : 'Landing', patientId: data?.id || null };
  };
  if (session.user.is_anonymous) return lookupPatient();
  const { data, error } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  if (data?.role === 'patient') return lookupPatient();
  if (needsCaregiverTutorial(session.user)) return { route: 'CaregiverTutorial', patientId: null };
  return { route: 'CaregiverHome', patientId: null };
}
module.exports = { withTimeout, initialDestination };
