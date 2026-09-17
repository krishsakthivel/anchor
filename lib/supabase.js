import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const configuredExtra = Constants.expoConfig?.extra || {};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || configuredExtra.supabaseUrl || 'https://vwanrqrseclejahwghwv.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || configuredExtra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YW5ycXJzZWNsZWphaHdnaHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTI0NDEsImV4cCI6MjEwMTg2ODQ0MX0.OrBvrbdjVfORARymXyXTd03zN0H0uzNqa_JRrE3LuVg';

const webStorage = {
  getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key, value) => {
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
