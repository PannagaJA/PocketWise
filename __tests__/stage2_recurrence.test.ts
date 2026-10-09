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

import { calculateNextBillingDate } from '../lib/services/subscription.service';
import { calculateNextBillDueDate } from '../lib/services/bill.service';

describe('Stage 2 Recurrence Automation & Date Arithmetic', () => {
  describe('Subscription Billing Cycle Date Calculations', () => {
    test('Weekly cycle advances by exactly 7 days', () => {
      const next = calculateNextBillingDate('2026-10-01', 'weekly');
      expect(next).toBe('2026-10-08');
    });

    test('Monthly cycle advances by 1 month for standard days', () => {
      const next = calculateNextBillingDate('2026-03-15', 'monthly');
      expect(next).toBe('2026-04-15');
    });

    test('Monthly cycle clamps month-end overflow (Jan 31 -> Feb 28)', () => {
      const next = calculateNextBillingDate('2026-01-31', 'monthly');
      expect(next).toBe('2026-02-28');
    });

    test('Monthly cycle clamps month-end overflow (Aug 31 -> Sep 30)', () => {
      const next = calculateNextBillingDate('2026-08-31', 'monthly');
      expect(next).toBe('2026-09-30');
    });

    test('Quarterly cycle advances by 3 months', () => {
      const next = calculateNextBillingDate('2026-01-15', 'quarterly');
      expect(next).toBe('2026-04-15');
    });

    test('Half-yearly cycle advances by 6 months', () => {
      const next = calculateNextBillingDate('2026-01-15', 'half_yearly');
      expect(next).toBe('2026-07-15');
    });

    test('Yearly cycle advances by 1 year', () => {
      const next = calculateNextBillingDate('2026-10-09', 'yearly');
      expect(next).toBe('2027-10-09');
    });
  });

  describe('Bill Due Date Recurrence Calculations', () => {
    test('One-time bill returns unchanged due date', () => {
      const next = calculateNextBillDueDate('2026-11-20', 'one_time');
      expect(next).toBe('2026-11-20');
    });

    test('Monthly recurring bill advances by 1 month', () => {
      const next = calculateNextBillDueDate('2026-05-10', 'monthly');
      expect(next).toBe('2026-06-10');
    });

    test('Monthly recurring bill clamps month-end (May 31 -> Jun 30)', () => {
      const next = calculateNextBillDueDate('2026-05-31', 'monthly');
      expect(next).toBe('2026-06-30');
    });

    test('Yearly recurring bill advances by 1 year', () => {
      const next = calculateNextBillDueDate('2026-12-25', 'yearly');
      expect(next).toBe('2027-12-25');
    });
  });
});
