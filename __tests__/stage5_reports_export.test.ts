const mockShare = jest.fn().mockResolvedValue({ action: 'sharedAction' });
const mockPrintToFile = jest.fn().mockResolvedValue({ uri: 'file:///mock/statement.pdf' });
const mockShareAsync = jest.fn().mockResolvedValue(true);
const mockWriteAsString = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: {
    share: (...args: any[]) => mockShare(...args),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: (...args: any[]) => mockPrintToFile(...args),
  printAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: (...args: any[]) => mockShareAsync(...args),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: (...args: any[]) => mockWriteAsString(...args),
  EncodingType: { UTF8: 'utf8' },
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

  describe('PDF Statement Generation & Export', () => {
    const mockSummary: FinancialSummary = {
      totalIncome: 1500000,
      totalExpense: 650000,
      savings: 850000,
      savingsRate: 57,
    };

    const mockCategories: CategorySpending[] = [
      {
        categoryId: 'c1',
        categoryName: 'Food & Dining',
        categoryColor: '#EF4444',
        amountMinor: 400000,
        percentage: 62,
      },
      {
        categoryId: 'c2',
        categoryName: 'Transport',
        categoryColor: '#3B82F6',
        amountMinor: 250000,
        percentage: 38,
      },
    ];

    const mockTxs: Transaction[] = [
      {
        id: 'tx_1',
        user_id: 'user_1',
        account_id: 'acc_1',
        type: 'expense',
        amount_minor: 400000,
        currency: 'INR',
        description: 'Supermarket Groceries',
        date: '2026-09-15',
        category: { name: 'Food & Dining' },
        account: { name: 'HDFC Bank' },
      },
      {
        id: 'tx_2',
        user_id: 'user_1',
        account_id: 'acc_1',
        type: 'income',
        amount_minor: 1500000,
        currency: 'INR',
        description: 'Monthly Salary',
        date: '2026-09-01',
        category: { name: 'Salary' },
        account: { name: 'HDFC Bank' },
      },
    ];

    test('Generates executive HTML document for 3 Months statement', () => {
      const html = exportService.generateFinancialStatementHtml({
        periodName: '3 months',
        startDate: '2026-08-02',
        endDate: '2026-11-02',
        summary: mockSummary,
        categories: mockCategories,
        transactions: mockTxs,
        userName: 'Alex Johnson',
        userEmail: 'alex@example.com',
      });

      // Branding & Period
      expect(html).toContain('PocketWise');
      expect(html).toContain('3 MONTHS');
      expect(html).toContain('2026-08-02 &mdash; 2026-11-02');
      expect(html).toContain('Alex Johnson');
      expect(html).toContain('alex@example.com');

      // KPI Metrics
      expect(html).toContain('Total Income');
      expect(html).toContain('Total Expense');
      expect(html).toContain('Net Savings');
      expect(html).toContain('57%');

      // Category breakdown
      expect(html).toContain('Food &amp; Dining');
      expect(html).toContain('62%');
      expect(html).toContain('Transport');

      // Transactions Ledger
      expect(html).toContain('Supermarket Groceries');
      expect(html).toContain('Monthly Salary');
      expect(html).toContain('EXPENSE');
      expect(html).toContain('INCOME');
    });

    test('Handles empty statement data gracefully in HTML', () => {
      const emptyHtml = exportService.generateFinancialStatementHtml({
        periodName: 'this month',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        summary: { totalIncome: 0, totalExpense: 0, savings: 0, savingsRate: 0 },
        categories: [],
        transactions: [],
      });

      expect(emptyHtml).toContain('No categorized expenses recorded in this period.');
      expect(emptyHtml).not.toContain('<table class="tx-table">');
    });

    test('Invokes expo-print and expo-sharing on exportPDFStatement', async () => {
      mockPrintToFile.mockClear();
      mockShareAsync.mockClear();

      const result = await exportService.exportPDFStatement({
        periodName: '3 months',
        startDate: '2026-08-02',
        endDate: '2026-11-02',
        summary: mockSummary,
        categories: mockCategories,
        transactions: mockTxs,
      });

      expect(mockPrintToFile).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledWith('file:///mock/statement.pdf', {
        mimeType: 'application/pdf',
        dialogTitle: 'PocketWise Financial Statement (PDF)',
        UTI: 'com.adobe.pdf',
      });
      expect(result).toBe(true);
    });

    test('Writes CSV file and shares via expo-sharing on exportTransactionsCSV', async () => {
      mockWriteAsString.mockClear();
      mockShareAsync.mockClear();

      const result = await exportService.exportTransactionsCSV(
        mockTxs,
        'PocketWise_Transactions_2026-08-02_to_2026-11-02.csv'
      );

      expect(mockWriteAsString).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledWith(
        'file:///mock/cache/PocketWise_Transactions_2026-08-02_to_2026-11-02.csv',
        expect.objectContaining({
          mimeType: 'text/csv',
          dialogTitle: 'PocketWise Transactions Statement (CSV)',
        })
      );
      expect(result).toBe(true);
    });
  });
});

