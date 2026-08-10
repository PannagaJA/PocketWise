import { supabase } from '../supabase';
import { accountService } from './account.service';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  currency: string;
  category_id?: string;
  description: string;
  date: string;
  notes?: string;
  transfer_group_id?: string;
  category?: { name: string; color?: string };
  account?: { name: string };
}

export const transactionService = {
  async getTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color), account:accounts(name)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async createTransaction(
    tx: Omit<Transaction, 'id'>,
    transferDestinationAccountId?: string
  ): Promise<Transaction> {
    if (tx.type === 'transfer') {
      if (!transferDestinationAccountId || tx.account_id === transferDestinationAccountId) {
        throw new Error('Transfer requires different source and destination accounts');
      }

      const transferGroupId = crypto.randomUUID();

      // Source deduction
      const { data: sourceTx, error: err1 } = await supabase
        .from('transactions')
        .insert({
          ...tx,
          type: 'transfer',
          transfer_group_id: transferGroupId,
          description: `Transfer to ${transferDestinationAccountId}`,
        })
        .select()
        .single();

      if (err1) throw err1;

      // Update source balance
      const { data: sourceAcc } = await supabase.from('accounts').select('balance').eq('id', tx.account_id).single();
      if (sourceAcc) {
        await accountService.updateAccountBalance(tx.account_id, sourceAcc.balance - tx.amount_minor);
      }

      // Destination addition
      const { error: err2 } = await supabase
        .from('transactions')
        .insert({
          ...tx,
          account_id: transferDestinationAccountId,
          type: 'transfer',
          transfer_group_id: transferGroupId,
          description: `Transfer from ${tx.account_id}`,
        });

      if (err2) throw err2;

      // Update destination balance
      const { data: destAcc } = await supabase.from('accounts').select('balance').eq('id', transferDestinationAccountId).single();
      if (destAcc) {
        await accountService.updateAccountBalance(transferDestinationAccountId, destAcc.balance + tx.amount_minor);
      }

      return sourceTx;
    } else {
      // Normal Income or Expense
      const { data, error } = await supabase
        .from('transactions')
        .insert(tx)
        .select()
        .single();

      if (error) throw error;

      // Update account balance
      const { data: acc } = await supabase.from('accounts').select('balance').eq('id', tx.account_id).single();
      if (acc) {
        const newBalance = tx.type === 'income' ? acc.balance + tx.amount_minor : acc.balance - tx.amount_minor;
        await accountService.updateAccountBalance(tx.account_id, newBalance);
      }

      return data;
    }
  },
};
