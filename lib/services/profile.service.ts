import { supabase } from '../supabase';

export interface Profile {
  id: string;
  display_name: string;
  currency: string;
  timezone: string;
  created_at?: string;
}

export const profileService = {
  async getProfile(userId: string, retries = 2): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        if (error.code === 'PGRST303' && retries > 0) {
          console.warn('[ProfileService] PGRST303 clock skew detected, retrying in 1s...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.getProfile(userId, retries - 1);
        }
        console.error('Error fetching profile:', error);
        throw error;
      }
      return data;
    } catch (err: any) {
      if (err?.code === 'PGRST303' && retries > 0) {
        console.warn('[ProfileService] Caught PGRST303, retrying in 1s...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.getProfile(userId, retries - 1);
      }
      throw err;
    }
  },

  async ensureProfile(userId: string, displayName?: string): Promise<Profile> {
    const existing = await this.getProfile(userId);
    if (existing) return existing;

    const newProfile = {
      id: userId,
      display_name: displayName || 'User',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
