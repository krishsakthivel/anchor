function recoveryParams(url) {
  if (!url) return {};
  const params = {};
  const text = String(url);
  const query = text.includes('?') ? text.split('?')[1].split('#')[0] : '';
  const hash = text.includes('#') ? text.split('#')[1] : '';
  for (const part of `${query}&${hash}`.split('&')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    try {
      params[decodeURIComponent(part.slice(0, separator))] = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, ' '));
    } catch { throw new Error('This reset link is invalid. Request a new one.'); }
  }
  return params;
}

async function establishRecoverySession(auth, url) {
  const params = recoveryParams(url);
  if (params.error || params.error_description) throw new Error(params.error_description || 'This reset link has expired. Request a new one.');
  if (params.code) {
    const { error } = await auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  } else if (params.access_token || params.refresh_token) {
    if (!params.access_token || !params.refresh_token) throw new Error('This reset link is incomplete. Request a new one.');
    const { error } = await auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    if (error) throw error;
  }
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return !!data?.session;
}
module.exports = { recoveryParams, establishRecoverySession };
