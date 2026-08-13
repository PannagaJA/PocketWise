import { supabase } from '../supabase';
import { reminderService } from './reminder.service';

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount_minor: number;
  current_amount_minor: number;
  target_date?: string;
  icon?: string;
  color?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const goalService = {
  async getGoals(userId: string): Promise<Goal[]> {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: goal.user_id,
        name: goal.name,
        target_amount_minor: goal.target_amount_minor,
        current_amount_minor: Math.min(goal.current_amount_minor || 0, goal.target_amount_minor),
        target_date: goal.target_date || null,
        icon: goal.icon || 'target',
        color: goal.color || '#6366F1',
        notes: goal.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (data.current_amount_minor >= data.target_amount_minor) {
      await this.ensureCompletionNotification(data.user_id, data.id, data.name);
    }

    return data;
  },

  async addContribution(goalId: string, contributionMinor: number): Promise<Goal> {
    const { data: currentGoal, error: fetchErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!currentGoal) throw new Error('Goal not found');

    const newSaved = Math.min(
      currentGoal.current_amount_minor + contributionMinor,
      currentGoal.target_amount_minor
    );

    const { data, error } = await supabase
      .from('goals')
      .update({
        current_amount_minor: newSaved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;

    if (newSaved >= currentGoal.target_amount_minor) {
      await this.ensureCompletionNotification(currentGoal.user_id, goalId, currentGoal.name);
    }

    return data;
  },

  async deleteGoal(id: string): Promise<void> {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async ensureCompletionNotification(userId: string, goalId: string, goalName: string): Promise<void> {
    const title = `🎉 Savings Goal Completed!`;
    const body = `Congratulations! You've reached 100% of your target for "${goalName}".`;
    const { data: existing } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', goalId)
      .eq('title', title)
      .limit(1);

    if (existing && existing.length > 0) return;

    await reminderService.createReminder({
      user_id: userId,
      type: 'goal',
      reference_id: goalId,
      title,
      body,
      scheduled_at: new Date().toISOString(),
    });

    try {
      const { notificationEngine } = await import('../notifications/notification.engine');
      await notificationEngine.notify({
        eventId: `goal_achieved_${goalId}`,
        category: 'savings_completed',
        title,
        body,
        priority: 'high',
        data: { goalId, type: 'goal' },
      });
    } catch (err) {
      console.warn('[GoalService] Failed to dispatch OS alert:', err);
    }
  },
};
