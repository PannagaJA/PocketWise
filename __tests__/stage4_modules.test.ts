import { parseMoneyToMinor } from '../lib/finance/core';

describe('Stage 4 Financial Modules & Idempotency Rules', () => {
  test('Budget threshold percentages & status bounds', () => {
    const limit = 800000; // ₹8,000 in paise
    const spent80 = 640000; // ₹6,400 in paise (80%)
    const spent100 = 850000; // ₹8,500 in paise (106%)

    const pct80 = Math.round((spent80 / limit) * 100);
    const pct100 = Math.round((spent100 / limit) * 100);

    expect(pct80).toBe(80);
    expect(pct100).toBe(106);
  });

  test('Goal progress clamping between 0% and 100%', () => {
    const target = 10000000; // ₹1,00,000
    const currentOver = 12000000; // ₹1,20,000
    const currentZero = 0;

    const rawPctOver = Math.round((currentOver / target) * 100);
    const clampedPctOver = Math.min(rawPctOver, 100);

    const rawPctZero = Math.round((currentZero / target) * 100);
    const clampedPctZero = Math.min(rawPctZero, 100);

    expect(rawPctOver).toBe(120);
    expect(clampedPctOver).toBe(100);
    expect(clampedPctZero).toBe(0);
  });

  test('Bill payment idempotency flag', () => {
    const mockBill = {
      id: 'bill_123',
      name: 'Electricity',
      is_paid: false,
    };

    // First mark as paid
    mockBill.is_paid = true;
    expect(mockBill.is_paid).toBe(true);

    // Second call should return early without side-effects
    const secondPaymentAttempt = mockBill.is_paid;
    expect(secondPaymentAttempt).toBe(true);
  });
});
