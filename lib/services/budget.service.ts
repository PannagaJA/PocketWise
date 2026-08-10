import { supabase } from '../supabase';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount_minor: number;
  period: 'monthly' | 'yearly';
  category?: { name: string };
}

export const budgetService = {
  async getBudgets(userId: string): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, category:categories(name)')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  },
};
