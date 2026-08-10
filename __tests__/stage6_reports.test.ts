import { reportService } from '../lib/services/report.service';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabase';

describe('Stage 6 Reports & Analytics Unit Tests', () => {
  test('Financial summary calculation with zero division safety', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({
        data: [
          { type: 'income', amount_minor: 5000000 },
          { type: 'expense', amount_minor: 3000000 },
          { type: 'transfer', amount_minor: 1000000 }, // Transfers must be ignored
        ],
        error: null,
      }),
    });

    const summary = await reportService.getFinancialSummary('user_123', '2026-08-01', '2026-08-31');
    expect(summary.totalIncome).toBe(5000000);
    expect(summary.totalExpense).toBe(3000000);
    expect(summary.savings).toBe(2000000);
    expect(summary.savingsRate).toBe(40); // 2,000,000 / 5,000,000 * 100
  });

  test('Zero income produces 0% savings rate without throwing', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({
        data: [{ type: 'expense', amount_minor: 100000 }],
        error: null,
      }),
    });

    const summary = await reportService.getFinancialSummary('user_123', '2026-08-01', '2026-08-31');
    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpense).toBe(100000);
    expect(summary.savings).toBe(-100000);
    expect(summary.savingsRate).toBe(0);
  });

  test('Subscription annualization logic', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({
        data: [
          { amount_minor: 64900, billing_cycle: 'monthly', status: 'active' },
          { amount_minor: 1200000, billing_cycle: 'yearly', status: 'active' },
        ],
        error: null,
      }),
    });

    const analytics = await reportService.getSubscriptionAnalytics('user_123');
    expect(analytics.activeCount).toBe(2);
    expect(analytics.monthlyTotalMinor).toBe(64900 + 100000); // 64900 + 1200000/12
    expect(analytics.annualTotalMinor).toBe(64900 * 12 + 1200000);
  });
});
