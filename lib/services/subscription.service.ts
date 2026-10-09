import { supabase } from '../supabase';
import { reminderService } from './reminder.service';
import { transactionService } from './transaction.service';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount_minor: number;
  currency: string;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  status: 'active' | 'paused' | 'cancelled';
  category_id?: string;
  account_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Calculates the next billing date for a given cycle, properly handling month overflows.
 */
export function calculateNextBillingDate(dateStr: string, cycle: BillingCycle): string {
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);

  switch (cycle) {
    case 'weekly': {
      targetDate.setDate(targetDate.getDate() + 7);
      break;
    }
    case 'monthly': {
      const originalDay = day;
      targetDate.setMonth(targetDate.getMonth() + 1);
      // Handle day overflow e.g. Jan 31 -> Feb 28
      if (targetDate.getDate() !== originalDay) {
        targetDate.setDate(0); // Last day of previous month
      }
      break;
    }
    case 'quarterly': {
      const originalDay = day;
      targetDate.setMonth(targetDate.getMonth() + 3);
      if (targetDate.getDate() !== originalDay) {
        targetDate.setDate(0);
      }
      break;
    }
    case 'half_yearly': {
      const originalDay = day;
      targetDate.setMonth(targetDate.getMonth() + 6);
      if (targetDate.getDate() !== originalDay) {
        targetDate.setDate(0);
      }
      break;
    }
    case 'yearly': {
      const originalDay = day;
      targetDate.setFullYear(targetDate.getFullYear() + 1);
      if (targetDate.getDate() !== originalDay) {
        targetDate.setDate(0);
      }
      break;
    }
    case 'custom':
    default: {
      targetDate.setMonth(targetDate.getMonth() + 1);
      break;
    }
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const subscriptionService = {
  async getSubscriptions(userId: string): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('next_billing_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createSubscription(sub: Omit<Subscription, 'id'>): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        ...sub,
        status: sub.status || 'active',
        currency: sub.currency || 'INR',
      })
      .select()
      .single();

    if (error) throw error;

    try {
      const billingDateObj = new Date(sub.next_billing_date);
      await reminderService.createReminder({
        user_id: sub.user_id,
        type: 'subscription',
        reference_id: data.id,
        title: `🔔 Subscription Renewal: ${sub.name}`,
        body: `Renewal amount: ₹${(sub.amount_minor / 100).toLocaleString('en-IN')}`,
        scheduled_at: billingDateObj.toISOString(),
      });
    } catch (remErr) {
      console.warn('Could not schedule subscription reminder:', remErr);
    }

    return data;
  },

  async updateSubscription(
    id: string,
    updates: Partial<Omit<Subscription, 'id' | 'user_id'>>
  ): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Reschedule reminder if next_billing_date changed
    if (updates.next_billing_date && data) {
      try {
        await reminderService.cancelRemindersByReference(id);
        const billingDateObj = new Date(updates.next_billing_date);
        await reminderService.createReminder({
          user_id: data.user_id,
          type: 'subscription',
          reference_id: data.id,
          title: `🔔 Subscription Renewal: ${data.name}`,
          body: `Renewal amount: ₹${(data.amount_minor / 100).toLocaleString('en-IN')}`,
          scheduled_at: billingDateObj.toISOString(),
        });
      } catch (remErr) {
        console.warn('Could not update subscription reminder:', remErr);
      }
    }

    return data;
  },

  /**
   * Renew subscription: Log expense transaction & advance next_billing_date to the subsequent cycle.
   */
  async renewSubscription(
    subId: string,
    accountId?: string
  ): Promise<{ subscription: Subscription; transactionId?: string }> {
    const { data: sub, error: fetchErr } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!sub) throw new Error('Subscription not found');

    const nextDate = calculateNextBillingDate(sub.next_billing_date, sub.billing_cycle);

    // 1. Advance next billing date conditionally so concurrent/duplicate renewals do not double-bill
    const { data: updatedSub, error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        next_billing_date: nextDate,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subId)
      .eq('next_billing_date', sub.next_billing_date)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updatedSub) {
      throw new Error('Duplicate renewal or subscription next billing date already modified');
    }

    let txId: string | undefined;

    // 2. Create payment transaction if account provided (or default account)
    const targetAccountId = accountId || sub.account_id;
    if (targetAccountId) {
      try {
        const todayISO = new Date().toISOString().substring(0, 10);
        const tx = await transactionService.createTransaction({
          user_id: sub.user_id,
          account_id: targetAccountId,
          type: 'expense',
          amount_minor: sub.amount_minor,
          currency: sub.currency || 'INR',
          category_id: sub.category_id || undefined,
          description: `Subscription: ${sub.name}`,
          date: todayISO,
          notes: `Automated renewal for cycle ${sub.billing_cycle}`,
        });
        txId = tx?.id;
      } catch (txErr: any) {
        // Revert next_billing_date conditionally if transaction creation fails
        const { data: revertedSub, error: rollbackErr } = await supabase
          .from('subscriptions')
          .update({
            next_billing_date: sub.next_billing_date,
            status: sub.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subId)
          .eq('next_billing_date', nextDate)
          .select()
          .maybeSingle();

        if (rollbackErr) {
          throw new Error(`Transaction failed (${txErr?.message || txErr}) and renewal rollback failed: ${rollbackErr.message}`);
        }
        if (!revertedSub) {
          throw new Error(`Transaction failed (${txErr?.message || txErr}) and renewal rollback conflicted (next_billing_date was modified)`);
        }
        throw txErr;
      }
    }

    return { subscription: updatedSub, transactionId: txId };
  },

  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await reminderService.cancelRemindersByReference(id);
  },
};
