import { supabase } from '../supabase';
import { parseMoneyToMinor } from '../finance/core';
import { reminderService } from './reminder.service';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category_name?: string;
  category_color?: string;
  amount_minor: number;
  period: 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  amount_spent?: number;
  created_at?: string;
  updated_at?: string;
}

export const budgetService = {
  async getBudgets(userId: string): Promise<Budget[]> {
    const { data: budgets, error: bErr } = await supabase
      .from('budgets')
      .select('*, categories(name, color)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bErr) throw bErr;
    if (!budgets) return [];

    // Calculate actual spending per budget from transactions
    const enrichedBudgets = await Promise.all(
      budgets.map(async (b) => {
        const { data: txs, error: tErr } = await supabase
          .from('transactions')
          .select('amount_minor')
          .eq('user_id', userId)
          .eq('category_id', b.category_id)
          .eq('type', 'expense')
          .gte('date', b.start_date)
          .lte('date', b.end_date)
          .is('deleted_at', null);

        if (tErr) throw tErr;

        const amount_spent = (txs || []).reduce((sum, t) => sum + Number(t.amount_minor), 0);
        const category_name = b.categories?.name || 'Category';
        const category_color = b.categories?.color || '#6366F1';

        // Check & create threshold reminders (80% and 100%) deterministically
        await this.checkThresholdReminders(userId, b.id, category_name, b.amount_minor, amount_spent, b.start_date);

        return {
          ...b,
          category_name,
          category_color,
          amount_spent,
        };
      })
    );

    return enrichedBudgets;
  },

  async createBudget(budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>): Promise<Budget> {
    // Prevent duplicate active budget for same user/category/start_date
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', budget.user_id)
      .eq('category_id', budget.category_id)
      .eq('start_date', budget.start_date)
      .single();

    if (existing) {
      throw new Error('A budget already exists for this category in the selected period');
    }

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: budget.user_id,
        category_id: budget.category_id,
        amount_minor: budget.amount_minor,
        period: budget.period || 'monthly',
        start_date: budget.start_date,
        end_date: budget.end_date,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async checkThresholdReminders(
    userId: string,
    budgetId: string,
    categoryName: string,
    limitMinor: number,
    spentMinor: number,
    startDate: string
  ): Promise<void> {
    if (limitMinor <= 0) return;
    const percentage = (spentMinor / limitMinor) * 100;
    const monthKey = startDate.substring(0, 7); // e.g. 2026-08

    if (percentage >= 100) {
      const title = `🚨 ${categoryName} budget exceeded`;
      const body = `You've spent 100%+ of your ₹${(limitMinor / 100).toLocaleString('en-IN')} ${categoryName} budget for ${monthKey}.`;
      await this.ensureReminderExists(userId, budgetId, title, body, 'budget_100_' + monthKey, 'budget_exceeded');
    } else if (percentage >= 80) {
      const title = `⚠️ ${categoryName} budget warning`;
      const body = `You've used ${Math.round(percentage)}% of your ₹${(limitMinor / 100).toLocaleString('en-IN')} ${categoryName} budget for ${monthKey}.`;
      await this.ensureReminderExists(userId, budgetId, title, body, 'budget_80_' + monthKey, 'budget');
    }
  },

  async ensureReminderExists(
    userId: string,
    budgetId: string,
    title: string,
    body: string,
    key: string,
    categoryType: 'budget' | 'budget_exceeded'
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', budgetId)
      .eq('title', title)
      .limit(1);

    if (existing && existing.length > 0) return;

    const createdReminder = await reminderService.createReminder({
      user_id: userId,
      type: 'budget',
      reference_id: budgetId,
      title,
      body,
      scheduled_at: new Date().toISOString(),
    });

    // Fire immediate Android system alert via NotificationEngine
    try {
      const { notificationEngine } = await import('../notifications/notification.engine');
      await notificationEngine.notify({
        eventId: `budget_alert_${budgetId}_${key}`,
        category: categoryType,
        title,
        body,
        priority: categoryType === 'budget_exceeded' ? 'high' : 'medium',
        data: { budgetId, type: 'budget' },
      });
    } catch (err) {
      console.warn('[BudgetService] Failed to dispatch OS alert:', err);
    }
  },
};
