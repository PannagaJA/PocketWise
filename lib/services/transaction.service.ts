import { supabase } from '../supabase';
import { accountService } from './account.service';
import { outboxService } from './outbox.service';
import { generateUUID } from '../finance/core';

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
  created_at?: string;
  updated_at?: string;
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

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const name = err.name || '';
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('networkerror') ||
    msg.includes('timeout') ||
    msg.includes('offline') ||
    (name === 'TypeError' && (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')))
  );
}

function deduplicateTwinTransactions(list: Transaction[]): Transaction[] {
  const result: Transaction[] = [];
  for (let i = 0; i < list.length; i++) {
    const current = list[i];
    let isDuplicate = false;
    for (let j = 0; j < result.length; j++) {
      const prev = result[j];
      if (
        current.account_id === prev.account_id &&
        current.type === prev.type &&
        current.amount_minor === prev.amount_minor &&
        (current.date || '').substring(0, 10) === (prev.date || '').substring(0, 10) &&
        (current.description || '').trim().toLowerCase() === (prev.description || '').trim().toLowerCase() &&
        !current.transfer_group_id &&
        !prev.transfer_group_id
      ) {
        const t1 = current.created_at ? new Date(current.created_at).getTime() : NaN;
        const t2 = prev.created_at ? new Date(prev.created_at).getTime() : NaN;
        if (!isNaN(t1) && !isNaN(t2) && Math.abs(t1 - t2) <= 120000) {
          isDuplicate = true;
          break;
        }
      }
    }
    if (!isDuplicate) {
      result.push(current);
    }
  }
  return result;
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

    const deduplicated = deduplicateTwinTransactions(validList);

    return deduplicated.slice(0, limit).map((tx) => ({
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
    const deduplicated = deduplicateTwinTransactions(validList);

    return deduplicated.map((tx) => ({
      ...tx,
      description: cleanTransactionDescription(tx.description, tx.category?.name, tx.type),
    }));
  },

  async getTransactionsByDateRange(userId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color), account:accounts(name)')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rawList = data || [];
    const validList = rawList.filter((tx) => !isPromotionalOrSpamTransaction(tx));
    const deduplicated = deduplicateTwinTransactions(validList);

    return deduplicated.map((tx) => ({
      ...tx,
      description: cleanTransactionDescription(tx.description, tx.category?.name, tx.type),
    }));
  },

  async createTransaction(
    tx: Omit<Transaction, 'id'>,
    transferDestinationAccountId?: string
  ): Promise<Transaction> {
    const sourceId = (tx as any).id || generateUUID();
    const isTransfer = tx.type === 'transfer';
    const transferGroupId = isTransfer ? ((tx as any).transfer_group_id || generateUUID()) : undefined;
    const destinationTxId = (isTransfer && transferDestinationAccountId) ? generateUUID() : undefined;

    try {
      if (isTransfer) {
        if (!transferDestinationAccountId || tx.account_id === transferDestinationAccountId) {
          throw new Error('Transfer requires different source and destination accounts');
        }

        // Source deduction
        const { data: sourceTx, error: err1 } = await supabase
          .from('transactions')
          .insert({
            ...tx,
            id: sourceId,
            type: 'transfer',
            transfer_group_id: transferGroupId,
            description: tx.description || `Transfer to ${transferDestinationAccountId}`,
          })
          .select()
          .single();

        if (err1) throw err1;

        // Destination addition (for transfer counterpart)
        const { error: err2 } = await supabase
          .from('transactions')
          .insert({
            ...tx,
            id: destinationTxId,
            account_id: transferDestinationAccountId,
            type: 'income', // Treated as inflow into destination account
            transfer_group_id: transferGroupId,
            description: tx.description || `Transfer from ${tx.account_id}`,
          });

        if (err2) throw err2;

        return sourceTx;
      } else {
        // Normal Income or Expense - trigger atomically syncs balance
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            ...tx,
            id: sourceId,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (networkOrDbError: any) {
      if (isNetworkError(networkOrDbError)) {
        const payload = {
          ...tx,
          id: sourceId,
          transfer_group_id: transferGroupId,
          transferDestinationAccountId,
          transferDestinationTxId: destinationTxId,
        };
        await outboxService.enqueueMutation('CREATE_TRANSACTION', payload);
        return {
          ...tx,
          id: sourceId,
          transfer_group_id: transferGroupId,
        } as Transaction;
      }
      throw networkOrDbError;
    }
  },

  async updateTransaction(
    transactionId: string,
    updates: Partial<Omit<Transaction, 'id' | 'user_id'>>
  ): Promise<Transaction> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId)
        .select('*, category:categories(name, color), account:accounts(name)')
        .single();

      if (error) throw error;
      return data;
    } catch (networkOrDbError: any) {
      if (isNetworkError(networkOrDbError)) {
        await outboxService.enqueueMutation('UPDATE_TRANSACTION', { id: transactionId, updates });
        return {
          id: transactionId,
          ...updates,
        } as any;
      }
      throw networkOrDbError;
    }
  },

  async deleteTransaction(transactionId: string, softDelete: boolean = true): Promise<void> {
    try {
      if (softDelete) {
        const { error } = await supabase
          .from('transactions')
          .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId);

        if (error) throw error;
      }
    } catch (networkOrDbError: any) {
      if (isNetworkError(networkOrDbError)) {
        await outboxService.enqueueMutation('DELETE_TRANSACTION', { id: transactionId, softDelete });
        return;
      }
      throw networkOrDbError;
    }
  },
};


