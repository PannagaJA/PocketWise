import { supabase } from '../supabase';
import { reminderService } from './reminder.service';
import { transactionService } from './transaction.service';

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  expected_amount_minor: number;
  due_date: string;
  frequency: 'monthly' | 'yearly' | 'one_time';
  category_id?: string;
  category_name?: string;
  account_id?: string;
  account_name?: string;
  is_paid: boolean;
  paid_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const billService = {
  async getBills(userId: string): Promise<Bill[]> {
    const { data, error } = await supabase
      .from('bills')
      .select('*, categories(name), accounts(name)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map((b) => ({
      ...b,
      category_name: b.categories?.name,
      account_name: b.accounts?.name,
    }));
  },

  async createBill(bill: Omit<Bill, 'id' | 'is_paid' | 'created_at' | 'updated_at'>): Promise<Bill> {
    const { data, error } = await supabase
      .from('bills')
      .insert({
        user_id: bill.user_id,
        name: bill.name,
        expected_amount_minor: bill.expected_amount_minor,
        due_date: bill.due_date,
        frequency: bill.frequency || 'monthly',
        category_id: bill.category_id || null,
        account_id: bill.account_id || null,
        is_paid: false,
        notes: bill.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Create a reminder at the exact due date & time specified by the user
    try {
      const dueDateObj = new Date(bill.due_date);

      await reminderService.createReminder({
        user_id: bill.user_id,
        type: 'bill',
        reference_id: data.id,
        title: `🔔 ${bill.name} due now`,
        body: `Expected amount: ₹${(bill.expected_amount_minor / 100).toLocaleString('en-IN')}`,
        scheduled_at: dueDateObj.toISOString(),
      });
    } catch (remErr) {
      console.warn('Could not schedule bill reminder:', remErr);
    }

    return data;
  },

  async markBillPaid(billId: string, accountId: string): Promise<void> {
    // 1. Fetch current bill state to verify idempotency
    const { data: bill, error: fetchErr } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!bill) throw new Error('Bill not found');

    // Idempotency check: If already paid, do NOT create another transaction
    if (bill.is_paid) {
      return;
    }

    const now = new Date().toISOString();

    // 2. Mark bill as paid
    const { error: updateErr } = await supabase
      .from('bills')
      .update({
        is_paid: true,
        paid_at: now,
        updated_at: now,
      })
      .eq('id', billId)
      .eq('is_paid', false);

    if (updateErr) throw updateErr;

    // 3. Create expense transaction for payment
    await transactionService.createTransaction({
      user_id: bill.user_id,
      account_id: accountId || bill.account_id,
      type: 'expense',
      amount_minor: bill.expected_amount_minor,
      currency: 'INR',
      category_id: bill.category_id,
      description: `Bill Payment: ${bill.name}`,
      date: new Date().toISOString().split('T')[0],
    });

    // 4. Cancel pending reminders for this bill
    await reminderService.cancelRemindersByReference(billId);
  },

  async deleteBill(id: string): Promise<void> {
    const { error } = await supabase
      .from('bills')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    await reminderService.cancelRemindersByReference(id);
  },
};
