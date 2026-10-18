import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const TOKEN_KEY = 'anchor.caregiver-push-token';

export async function registerCaregiverPushToken() {
  if (Platform.OS === 'web') throw new Error('Help notifications need the installed phone app.');
  if (!Device.isDevice) throw new Error('Use a physical phone to enable help notifications.');
  if (Constants.executionEnvironment === 'storeClient') throw new Error('Help notifications need an Anchor development or production build, rather than Expo Go.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('care-help', { name: 'Help requests', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') throw new Error('Notification permission was not granted.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('This build has no Expo project ID.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Please sign in again.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.from('caregiver_push_tokens').upsert({
    expo_push_token: token, user_id: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'expo_push_token' });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeCaregiverPushToken() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const { error } = await supabase.from('caregiver_push_tokens').delete().eq('expo_push_token', token);
  if (error) throw error;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function dispatchHelpNotification(checkinId) {
  const { data, error } = await supabase.functions.invoke('send-safety-notifications', { body: { checkinId } });
  return !error && data?.accepted > 0;
}
