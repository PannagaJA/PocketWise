import { supabase } from '../supabase';

export interface Reminder {
  id?: string;
  user_id: string;
  type: 'subscription' | 'bill' | 'budget' | 'goal' | 'custom';
  reference_id?: string;
  title: string;
  body: string;
  scheduled_at: string;
  timezone?: string;
  status?: 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed';
}

export const reminderService = {
  async getReminders(userId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createReminder(reminder: Reminder): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        ...reminder,
        timezone: reminder.timezone || 'Asia/Kolkata',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async cancelReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId);

    if (error) throw error;
  },

  async cancelRemindersByReference(referenceId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('reference_id', referenceId)
      .eq('status', 'pending');

    if (error) throw error;
  },
};
