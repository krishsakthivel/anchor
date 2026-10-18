import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await request.json();
    const dispatchSecret = Deno.env.get('SAFETY_DISPATCH_SECRET');
    const isWorker = !!dispatchSecret && request.headers.get('x-dispatch-secret') === dispatchSecret;
    let checkinId: string | null = null;
    if (!isWorker) {
      const authorization = request.headers.get('Authorization');
      if (!authorization) return respond({ error: 'Authentication required' }, 401);
      const token = authorization.replace(/^Bearer\s+/i, '');
      const { data: { user }, error: userError } = await admin.auth.getUser(token);
      if (userError || !user) return respond({ error: 'Authentication required' }, 401);
      if (typeof body.checkinId !== 'string') return respond({ error: 'Check-in required' }, 400);
      const { data: checkin, error } = await admin.from('safety_checkins').select('patient_id').eq('id', body.checkinId).maybeSingle();
      if (error || !checkin) return respond({ error: 'Check-in not found' }, 404);
      const { data: patient } = await admin.from('patients').select('paired_user_id').eq('id', checkin.patient_id).single();
      if (patient?.paired_user_id !== user.id) return respond({ error: 'Not authorized' }, 403);
      checkinId = body.checkinId;
    }

    const { data: jobs, error: jobsError } = await admin.rpc('claim_safety_notification_jobs', { p_checkin_id: checkinId });
    if (jobsError) throw jobsError;
    const expoHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (expoAccessToken) expoHeaders.Authorization = `Bearer ${expoAccessToken}`;
    let accepted = 0;
    for (const job of jobs || []) {
      try {
        const { data: device } = await admin.from('caregiver_push_tokens').select('user_id').eq('expo_push_token', job.expo_push_token).maybeSingle();
        const { data: checkin } = await admin.from('safety_checkins').select('patient_id, status').eq('id', job.checkin_id).single();
        const { data: patient } = await admin.from('patients').select('created_by').eq('id', checkin?.patient_id).single();
        const { data: link } = await admin.from('caregiver_patient').select('permission_level').eq('patient_id', checkin?.patient_id).eq('caregiver_id', device?.user_id).maybeSingle();
        if (!device || !checkin || (patient?.created_by !== device.user_id && !['owner', 'editor'].includes(link?.permission_level))) {
          await admin.from('safety_notification_jobs').update({ state: 'failed', last_error: 'Caregiver access removed' }).eq('id', job.id);
          continue;
        }
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: expoHeaders, signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ to: job.expo_push_token, title: 'Anchor help request',
            body: 'Open Anchor to review a new help request.', sound: 'default', channelId: 'care-help',
            data: { kind: 'safety-checkin' } }),
        });
        if (!response.ok) throw new Error(`Push service returned ${response.status}`);
        const payload = await response.json();
        const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        if (ticket?.status !== 'ok' || !ticket.id) {
          if (ticket?.details?.error === 'DeviceNotRegistered') {
            await admin.from('caregiver_push_tokens').delete().eq('expo_push_token', job.expo_push_token);
            continue;
          }
          throw new Error(ticket?.message || 'Push service did not accept the request');
        }
        const { error: saveError } = await admin.from('safety_notification_jobs').update({ state: 'accepted', ticket_id: ticket.id, last_error: null, updated_at: new Date().toISOString() }).eq('id', job.id);
        if (saveError) throw saveError;
        accepted += 1;
      } catch (error) {
        await admin.from('safety_notification_jobs').update({ state: job.attempts >= 5 ? 'failed' : 'pending',
          last_error: String(error), available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id);
      }
    }

    if (isWorker) {
      const { data: receipts } = await admin.from('safety_notification_jobs').select('id, ticket_id, expo_push_token').eq('state', 'accepted')
        .lt('updated_at', new Date(Date.now() - 15 * 60000).toISOString()).limit(100);
      if (receipts?.length) {
        const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: expoHeaders,
          signal: AbortSignal.timeout(15000), body: JSON.stringify({ ids: receipts.map(job => job.ticket_id) }) });
        if (!response.ok) throw new Error(`Receipt service returned ${response.status}`);
        const payload = await response.json();
        for (const job of receipts) {
          const receipt = payload.data?.[job.ticket_id];
          if (!receipt) continue;
          await admin.from('safety_notification_jobs').update({ state: receipt.status === 'ok' ? 'delivered' : 'failed', last_error: receipt.message || null }).eq('id', job.id);
          if (receipt.details?.error === 'DeviceNotRegistered') await admin.from('caregiver_push_tokens').delete().eq('expo_push_token', job.expo_push_token);
        }
      }
      await admin.from('safety_notification_jobs').update({ state: 'failed', last_error: 'Retry limit reached' }).in('state', ['pending', 'sending']).gte('attempts', 5).lt('available_at', new Date().toISOString());
    }
    return respond({ accepted });
  } catch { return respond({ error: 'Could not dispatch notifications' }, 500); }
});
