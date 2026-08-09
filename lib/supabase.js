import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://vwanrqrseclejahwghwv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YW5ycXJzZWNsZWphaHdnaHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTI0NDEsImV4cCI6MjEwMTg2ODQ0MX0.OrBvrbdjVfORARymXyXTd03zN0H0uzNqa_JRrE3LuVg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});