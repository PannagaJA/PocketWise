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
    if (!budgets || budgets.length === 0) return [];

    const minDate = budgets.reduce((min, b) => (b.start_date < min ? b.start_date : min), budgets[0].start_date);
    const maxDate = budgets.reduce((max, b) => (b.end_date > max ? b.end_date : max), budgets[0].end_date);

    // Paginate through all matching rows within the date window so row limits cannot truncate amount_spent
    const pageSize = 1000;
    let page = 0;
    let allTxs: Array<{ category_id: string; amount_minor: number; date: string }> = [];
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: txBatch, error: tErr } = await supabase
        .from('transactions')
        .select('id, category_id, amount_minor, date')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', minDate)
        .lte('date', maxDate)
        .is('deleted_at', null)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);

      if (tErr) throw tErr;

      if (txBatch && txBatch.length > 0) {
        allTxs = allTxs.concat(txBatch);
        if (txBatch.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const enrichedBudgets: Budget[] = [];

    for (const b of budgets) {
      const amount_spent = allTxs
        .filter((t) => t.category_id === b.category_id && t.date >= b.start_date && t.date <= b.end_date)
        .reduce((sum, t) => sum + Number(t.amount_minor), 0);

      const category_name = b.categories?.name || 'Category';
      const category_color = b.categories?.color || '#6366F1';

      try {
        await this.checkThresholdReminders(userId, b.id, category_name, b.amount_minor, amount_spent, b.start_date);
      } catch (remErr) {
        console.warn(`[BudgetService] Reminder check failed for budget ${b.id}:`, remErr);
      }

      enrichedBudgets.push({
        ...b,
        category_name,
        category_color,
        amount_spent,
      });
    }

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
