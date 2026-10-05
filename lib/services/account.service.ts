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
  opening_balance?: number;
}

export type UpdateAccountInput = Partial<Omit<Account, 'id' | 'user_id'>>;

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

  async updateAccount(accountId: string, updates: UpdateAccountInput): Promise<Account> {
    const allowedUpdates: Record<string, any> = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name;
    if (updates.type !== undefined) allowedUpdates.type = updates.type;
    if (updates.balance !== undefined) allowedUpdates.balance = updates.balance;
    if (updates.currency !== undefined) allowedUpdates.currency = updates.currency;
    if (updates.icon !== undefined) allowedUpdates.icon = updates.icon;
    if (updates.color !== undefined) allowedUpdates.color = updates.color;
    if (updates.is_archived !== undefined) allowedUpdates.is_archived = updates.is_archived;
    if (updates.opening_balance !== undefined) allowedUpdates.opening_balance = updates.opening_balance;

    const { data, error } = await supabase
      .from('accounts')
      .update({ ...allowedUpdates, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAccount(accountId: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', accountId);

    if (error) throw error;
  },
};
