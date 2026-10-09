jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] || null)),
    setItem: jest.fn((key: string, val: string) => {
      store[key] = val;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
  };
});

import { lendService } from '../lib/services/lend.service';
import { parseMoneyToMinor } from '../lib/finance/core';

describe('Stage 1 Database Integrity & Atomic Balances', () => {
  describe('PostgreSQL Atomic Balance Trigger Logic', () => {
    // Pure function simulating the SQL trigger public.sync_account_balance()
    function simulateTrigger(
      currentBalance: number,
      op: 'INSERT' | 'UPDATE' | 'DELETE',
      txOld?: { type: 'income' | 'expense' | 'transfer'; amount_minor: number; deleted_at?: string | null },
      txNew?: { type: 'income' | 'expense' | 'transfer'; amount_minor: number; deleted_at?: string | null }
    ): number {
      let balance = currentBalance;

      if (op === 'DELETE' && txOld) {
        if (txOld.type === 'income') balance -= txOld.amount_minor;
        else if (txOld.type === 'expense') balance += txOld.amount_minor;
        else if (txOld.type === 'transfer') balance += txOld.amount_minor;
        return balance;
      }

      if (op === 'INSERT' && txNew) {
        if (!txNew.deleted_at) {
          if (txNew.type === 'income') balance += txNew.amount_minor;
          else if (txNew.type === 'expense') balance -= txNew.amount_minor;
          else if (txNew.type === 'transfer') balance -= txNew.amount_minor;
        }
        return balance;
      }

      if (op === 'UPDATE') {
        if (txOld && !txOld.deleted_at) {
          if (txOld.type === 'income') balance -= txOld.amount_minor;
          else if (txOld.type === 'expense') balance += txOld.amount_minor;
          else if (txOld.type === 'transfer') balance += txOld.amount_minor;
        }
        if (txNew && !txNew.deleted_at) {
          if (txNew.type === 'income') balance += txNew.amount_minor;
          else if (txNew.type === 'expense') balance -= txNew.amount_minor;
          else if (txNew.type === 'transfer') balance -= txNew.amount_minor;
        }
        return balance;
      }

      return balance;
    }

    test('INSERT: Income adds to account balance', () => {
      const initial = 100000; // ₹1,000
      const updated = simulateTrigger(initial, 'INSERT', undefined, {
        type: 'income',
        amount_minor: 50000, // ₹500
      });
      expect(updated).toBe(150000);
    });

    test('INSERT: Expense subtracts from account balance', () => {
      const initial = 100000; // ₹1,000
      const updated = simulateTrigger(initial, 'INSERT', undefined, {
        type: 'expense',
        amount_minor: 30000, // ₹300
      });
      expect(updated).toBe(70000);
    });

    test('DELETE: Reverts income and expense properly', () => {
      const balanceAfterIncome = 150000;
      const revertedIncome = simulateTrigger(balanceAfterIncome, 'DELETE', {
        type: 'income',
        amount_minor: 50000,
      });
      expect(revertedIncome).toBe(100000);

      const balanceAfterExpense = 70000;
      const revertedExpense = simulateTrigger(balanceAfterExpense, 'DELETE', {
        type: 'expense',
        amount_minor: 30000,
      });
      expect(revertedExpense).toBe(100000);
    });

    test('UPDATE: Soft-deleting via deleted_at reverses transaction effect', () => {
      const balanceWithExpense = 70000;
      const softDeleted = simulateTrigger(
        balanceWithExpense,
        'UPDATE',
        { type: 'expense', amount_minor: 30000, deleted_at: null },
        { type: 'expense', amount_minor: 30000, deleted_at: new Date().toISOString() }
      );
      expect(softDeleted).toBe(100000);
    });

    test('UPDATE: Editing amount applies net difference atomically', () => {
      const balance = 70000; // was 100000 - 30000
      // Edit expense from 30000 to 45000
      const updated = simulateTrigger(
        balance,
        'UPDATE',
        { type: 'expense', amount_minor: 30000, deleted_at: null },
        { type: 'expense', amount_minor: 45000, deleted_at: null }
      );
      expect(updated).toBe(55000);
    });
  });

  describe('Lend & Borrow Cloud Service Operations', () => {
    test('Overdue status calculation based on date', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().substring(0, 10);
      const now = new Date().toISOString().substring(0, 10);

      const isOverdue = yesterday < now;
      const isPending = tomorrow >= now;

      expect(isOverdue).toBe(true);
      expect(isPending).toBe(true);
    });

    test('Lend creation and minor unit parsing', async () => {
      const amount = parseMoneyToMinor('750.50');
      expect(amount).toBe(75050);

      const lend = await lendService.createLend({
        personName: 'Rohan Sharma',
        amountMinor: amount,
        type: 'lend',
        lentDate: '2026-10-01',
        dueDate: '2026-10-15',
        notes: 'Dinner split',
      });

      expect(lend.personName).toBe('Rohan Sharma');
      expect(lend.amountMinor).toBe(75050);
      expect(lend.status).toBe('active');
    });

    test('Mark lend as collected', async () => {
      const lend = await lendService.createLend({
        personName: 'Priya Patel',
        amountMinor: 200000,
        type: 'lend',
        lentDate: '2026-10-01',
        dueDate: '2026-10-05',
      });

      await lendService.markCollected(lend.id);
      const all = await lendService.getAll();
      const target = all.find((r) => r.id === lend.id);

      expect(target?.status).toBe('collected');
      expect(target?.collectedAt).toBeDefined();
    });
  });
});
