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

export function cleanTransactionDescription(
  description?: string,
  categoryName?: string,
  type?: string
): string {
  if (!description) {
    if (categoryName && categoryName !== 'Other') return categoryName;
    return type === 'income' ? 'Received Payment' : 'Bank Transaction';
  }

  let cleaned = description
    .replace(/\s*\[Auto[- ]?detected\]/gi, '')
    .replace(/\s*\(Unknown\)/gi, '')
    .trim();

  // If description is empty after removing tags
  if (!cleaned) {
    return categoryName && categoryName !== 'Other'
      ? categoryName
      : type === 'income'
      ? 'Received Payment'
      : 'Bank Transaction';
  }

  return cleaned;
}

export function isPromotionalOrSpamTransaction(tx: {
  description?: string;
  notes?: string;
}): boolean {
  const desc = (tx.description || '').toLowerCase();
  const notes = (tx.notes || '').toLowerCase();
  const combined = `${desc} ${notes}`;

  const promoPhrases = [
    'cashback on next',
    'cashback on your next',
    'cashback on recharge',
    'cashback of up to',
    'get up to rs',
    'get up to inr',
    'get upto rs',
    'win up to',
    'win upto',
    'win cash',
    'earn up to',
    'recharge now',
    'good news! get',
    'good news get',
    'special offer',
    'exclusive offer',
    'limited period offer',
    'promo code',
    'coupon code',
    'scratch card',
    'bonus cash',
    'pre-approved loan',
    'eligible for personal loan',
    'ax-airtel-p',
    'airtel-p',
    'airtel promo',
  ];

  return promoPhrases.some((phrase) => combined.includes(phrase));
}

export const transactionService = {
  async getTransactions(userId: string, limit: number = 50, accountId?: string): Promise<Transaction[]> {
    let validList: Transaction[] = [];
    const pageSize = Math.max(limit, 50);
    let offset = 0;
    let hasMore = true;

    while (validList.length < limit && hasMore) {
      let query = supabase
        .from('transactions')
        .select('*, category:categories(name, color), account:accounts(name)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (accountId && accountId !== 'all') {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawBatch = data || [];
      if (rawBatch.length === 0) {
        hasMore = false;
        break;
      }

      const validBatch = rawBatch.filter((tx) => !isPromotionalOrSpamTransaction(tx));
      validList = validList.concat(validBatch);

      if (rawBatch.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    return validList.slice(0, limit).map((tx) => ({
      ...tx,
      description: cleanTransactionDescription(tx.description, tx.category?.name, tx.type),
    }));
  },

  async getAccountTransactions(accountId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color), account:accounts(name)')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rawList = data || [];
    const validList = rawList.filter((tx) => !isPromotionalOrSpamTransaction(tx));

    return validList.map((tx) => ({
      ...tx,
      description: cleanTransactionDescription(tx.description, tx.category?.name, tx.type),
    }));
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
