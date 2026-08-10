import { supabase } from '../supabase';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount_minor: number;
  currency: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
  next_billing_date: string;
  status: 'active' | 'paused' | 'cancelled';
  notes?: string;
}

export const subscriptionService = {
  async getSubscriptions(userId: string): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('next_billing_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createSubscription(sub: Omit<Subscription, 'id'>): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(sub)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
