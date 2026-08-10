import { supabase } from '../supabase';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit_card' | 'wallet' | 'investment' | 'other';
  balance: number; // minor units e.g. paise
  currency: string;
  icon?: string;
  color?: string;
  is_archived?: boolean;
}

export const accountService = {
  async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert(account)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', accountId);

    if (error) throw error;
  },
};
