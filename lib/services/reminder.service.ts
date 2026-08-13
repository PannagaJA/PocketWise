import { supabase } from '../supabase';
import { notificationService } from '../notifications/notification.service';

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
    // 1. Save reminder to database
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

    // 2. Schedule local Android/iOS OS notification safely AFTER database success
    if (data && data.scheduled_at) {
      try {
        const triggerDate = new Date(data.scheduled_at);
        await notificationService.scheduleDueDateReminder(
          data.id,
          data.title,
          data.body,
          triggerDate,
          data.type
        );
      } catch (notifErr) {
        console.warn('[ReminderService] Non-fatal error scheduling local notification:', notifErr);
      }
    }

    return data;
  },

  async cancelReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId);

    if (error) throw error;

    // Cancel local OS notification
    await notificationService.cancelScheduledNotification(reminderId);
  },

  async cancelRemindersByReference(referenceId: string): Promise<void> {
    const { data: matchingReminders } = await supabase
      .from('reminders')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('status', 'pending');

    const { error } = await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('reference_id', referenceId)
      .eq('status', 'pending');

    if (error) throw error;

    if (matchingReminders && matchingReminders.length > 0) {
      for (const r of matchingReminders) {
        await notificationService.cancelScheduledNotification(r.id);
      }
    }
  },

  async deleteReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    if (error) throw error;

    // Cancel local OS notification
    await notificationService.cancelScheduledNotification(reminderId);
  },

  async clearAllReminders(userId: string): Promise<void> {
    const { data: allReminders } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', userId);

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    if (allReminders && allReminders.length > 0) {
      for (const r of allReminders) {
        await notificationService.cancelScheduledNotification(r.id);
      }
    }
  },
};
