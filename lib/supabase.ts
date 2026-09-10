import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://tqmxwsctrendyxlyabjf.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbXh3c2N0cmVuZHl4bHlhYmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTIzOTEsImV4cCI6MjEwMTkyODM5MX0.jFsmdRTY3KTbjj8haT8zueLN9diQ4DDl7Qt9NTBBEmE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
