import { supabase } from '../supabase';

export interface Profile {
  id: string;
  display_name: string;
  currency: string;
  timezone: string;
  created_at?: string;
}

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      throw error;
    }
    return data;
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
