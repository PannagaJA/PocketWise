import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Warning: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing from environment variables.');
}

/**
 * Custom fetch implementation that automatically retries when transient
 * clock skew (PGRST303: "JWT issued at future") occurs between Supabase Auth
 * and PostgREST.
 */
const customFetch: typeof fetch = async (input, init) => {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(input, init);

    // Check for PGRST303 clock drift error (HTTP 401)
    if (response.status === 401 && attempt < maxRetries) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        if (text.includes('PGRST303') || text.includes('JWT issued at future')) {
          const delay = (attempt + 1) * 800;
          console.warn(`[Supabase] Clock skew detected (PGRST303). Retrying after ${delay}ms...`);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
      } catch {
        // Fall back to returning original response
      }
    }

    return response;
  }
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: customFetch,
  },
});
