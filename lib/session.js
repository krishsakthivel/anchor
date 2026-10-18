import { supabase } from './supabase';
import { setReminderUser } from './notifications';
import { removeCaregiverPushToken } from './helpNotifications';

export async function signOutWithCleanup() {
  try {
    await setReminderUser(null);
    await removeCaregiverPushToken();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    const { data } = await supabase.auth.getSession();
    await setReminderUser(data?.session?.user?.id || null).catch(() => {});
    throw error;
  }
}
