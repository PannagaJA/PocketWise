const mockShare = jest.fn().mockResolvedValue({ action: 'sharedAction' });

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: {
    share: (...args: any[]) => mockShare(...args),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
}));


jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import { exportService } from '../lib/services/export.service';
import { Transaction } from '../lib/services/transaction.service';
import { FinancialSummary, CategorySpending } from '../lib/services/report.service';

describe('Stage 5: Financial Reports Export & Release Gate', () => {
  describe('Transactions CSV Generation', () => {
    test('Generates RFC 4180 compliant CSV header and data rows', () => {
      const mockTxs: Transaction[] = [
        {
          id: 'tx_1',
          user_id: 'user_1',
          account_id: 'acc_1',
          type: 'expense',
          amount_minor: 45000,
          currency: 'INR',
          description: 'Grocery Shopping, Supermarket',
          date: '2026-10-01',
          notes: 'Bought organic "apples" & milk',
          category: { name: 'Food & Dining' },
          account: { name: 'HDFC Bank' },
        },
        {
          id: 'tx_2',
          user_id: 'user_1',
          account_id: 'acc_1',
          type: 'income',
          amount_minor: 120000,
          currency: 'INR',
          description: 'Salary Bonus',
          date: '2026-10-05',
          category: { name: 'Salary' },
          account: { name: 'HDFC Bank' },
        },
      ];

      const csv = exportService.generateTransactionsCSV(mockTxs);
      const lines = csv.split('\n');

      expect(lines.length).toBe(3); // Header + 2 rows
      expect(lines[0]).toBe('"Date","Description","Category","Type","Amount","Currency","Account","Notes"');

      // Check row 1 with quotes escaping
      expect(lines[1]).toContain('"2026-10-01"');
      expect(lines[1]).toContain('"Grocery Shopping, Supermarket"');
      expect(lines[1]).toContain('"Food & Dining"');
      expect(lines[1]).toContain('"EXPENSE"');
      expect(lines[1]).toContain('"450.00"');
      expect(lines[1]).toContain('"Bought organic ""apples"" & milk"');

      // Check row 2
      expect(lines[2]).toContain('"2026-10-05"');
      expect(lines[2]).toContain('"Salary Bonus"');
      expect(lines[2]).toContain('"INCOME"');
      expect(lines[2]).toContain('"1200.00"');
    });

    test('Handles empty transaction lists with headers only', () => {
      const csv = exportService.generateTransactionsCSV([]);
      expect(csv).toBe('"Date","Description","Category","Type","Amount","Currency","Account","Notes"');
    });
  });

  describe('Financial Summary Statement Generation', () => {
    test('Formats full summary statement with category distribution', () => {
      const summary: FinancialSummary = {
        totalIncome: 1000000,
        totalExpense: 400000,
        savings: 600000,
        savingsRate: 60,
      };

      const categories: CategorySpending[] = [
        {
          categoryId: 'c1',
          categoryName: 'Dining',
          categoryColor: '#EF4444',
          amountMinor: 250000,
          percentage: 63,
        },
        {
          categoryId: 'c2',
          categoryName: 'Utilities',
          categoryColor: '#3B82F6',
          amountMinor: 150000,
          percentage: 37,
        },
      ];

      const text = exportService.generateFinancialSummaryText({
        periodName: 'this month',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        summary,
        categories,
        currency: 'INR',
      });

      expect(text).toContain('POCKETWISE FINANCIAL REPORT');
      expect(text).toContain('Period:     THIS MONTH (2026-10-01 to 2026-10-31)');
      expect(text).toContain('Savings Rate:   60%');
      expect(text).toContain('1. Dining');
      expect(text).toContain('63%');
      expect(text).toContain('2. Utilities');
      expect(text).toContain('37%');
    });

    test('Handles empty category spending gracefully', () => {
      const summary: FinancialSummary = {
        totalIncome: 0,
        totalExpense: 0,
        savings: 0,
        savingsRate: 0,
      };

      const text = exportService.generateFinancialSummaryText({
        periodName: '3 months',
        startDate: '2026-07-01',
        endDate: '2026-10-01',
        summary,
        categories: [],
      });

      expect(text).toContain('(No expenses recorded in this period)');
    });
  });

  describe('Share Content Integration', () => {
    test('Invokes Native Share API with content and title', async () => {
      const result = await exportService.shareContent('CSV data here', 'PocketWise Statement');
      expect(mockShare).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});

