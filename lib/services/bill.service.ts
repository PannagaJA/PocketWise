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

export function calculateNextBillDueDate(currentDueDate: string, frequency: 'monthly' | 'yearly' | 'one_time'): string {
  if (frequency === 'one_time') return currentDueDate;

  const hasTime = currentDueDate.includes('T') || currentDueDate.includes(' ');
  const separator = currentDueDate.includes('T') ? 'T' : ' ';
  const [datePart, timePart] = hasTime ? currentDueDate.split(separator) : [currentDueDate, ''];

  const [year, month, day] = datePart.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);

  if (frequency === 'monthly') {
    const originalDay = day;
    targetDate.setMonth(targetDate.getMonth() + 1);
    if (targetDate.getDate() !== originalDay) {
      targetDate.setDate(0); // Clamps to last day of month
    }
  } else if (frequency === 'yearly') {
    const originalDay = day;
    targetDate.setFullYear(targetDate.getFullYear() + 1);
    if (targetDate.getDate() !== originalDay) {
      targetDate.setDate(0);
    }
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const nextDateOnly = `${y}-${m}-${d}`;

  return timePart ? `${nextDateOnly}${separator}${timePart}` : nextDateOnly;
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

  async updateBill(id: string, updates: Partial<Omit<Bill, 'id' | 'user_id'>>): Promise<Bill> {
    const { data, error } = await supabase
      .from('bills')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, categories(name), accounts(name)')
      .single();

    if (error) throw error;

    if (updates.due_date && data && !data.is_paid) {
      try {
        await reminderService.cancelRemindersByReference(id);
        const dueDateObj = new Date(updates.due_date);
        await reminderService.createReminder({
          user_id: data.user_id,
          type: 'bill',
          reference_id: data.id,
          title: `🔔 ${data.name} due now`,
          body: `Expected amount: ₹${(data.expected_amount_minor / 100).toLocaleString('en-IN')}`,
          scheduled_at: dueDateObj.toISOString(),
        });
      } catch (remErr) {
        console.warn('Could not update bill reminder:', remErr);
      }
    }

    return {
      ...data,
      category_name: data.categories?.name,
      account_name: data.accounts?.name,
    };
  },

  async markBillPaid(billId: string, accountId: string): Promise<Bill | null> {
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
      return bill;
    }

    const now = new Date().toISOString();

    // 2. Mark current bill as paid
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

    // 4. Cancel pending reminders for this paid bill
    await reminderService.cancelRemindersByReference(billId);

    // 5. Automatic Recurrence Generation for monthly & yearly bills
    let nextBillInstance: Bill | null = null;
    if (bill.frequency && bill.frequency !== 'one_time') {
      const nextDueDate = calculateNextBillDueDate(bill.due_date, bill.frequency);
      try {
        nextBillInstance = await this.createBill({
          user_id: bill.user_id,
          name: bill.name,
          expected_amount_minor: bill.expected_amount_minor,
          due_date: nextDueDate,
          frequency: bill.frequency,
          category_id: bill.category_id || undefined,
          account_id: bill.account_id || undefined,
          notes: bill.notes || undefined,
        });
      } catch (recurErr) {
        console.warn('[BillService] Failed to generate next recurring bill:', recurErr);
        throw recurErr;
      }
    }

    return nextBillInstance;
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
