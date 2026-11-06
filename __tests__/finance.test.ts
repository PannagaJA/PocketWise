import { formatMoney, parseMoneyToMinor, addMoney, subtractMoney, getTransactionTimestamp } from '../lib/finance/core';

describe('Finance Core Unit Tests', () => {
  test('minor currency formatting for INR', () => {
    expect(formatMoney(45050)).toContain('450.50');
    expect(formatMoney(100000)).toContain('1,000.00');
  });

  test('parse string amount into integer minor units', () => {
    expect(parseMoneyToMinor('450.50')).toBe(45050);
    expect(parseMoneyToMinor('100')).toBe(10000);
    expect(parseMoneyToMinor('0.99')).toBe(99);
  });

  test('money addition and subtraction', () => {
    expect(addMoney(10000, 5000)).toBe(15000);
    expect(subtractMoney(15000, 5000)).toBe(10000);
  });

  test('getTransactionTimestamp correctly combines date with created_at time when dates mismatch', () => {
    // Yesterday's transaction detected today
    const bmtc = {
      date: '2026-11-05',
      created_at: '2026-11-06T05:34:00.000Z', // 11:04 AM local time
    };
    const poojary = {
      date: '2026-11-05',
      created_at: '2026-11-05T16:31:00.000Z', // 10:01 PM local time
    };
    const bakery = {
      date: '2026-11-05',
      created_at: '2026-11-05T04:51:00.000Z', // 10:21 AM local time
    };

    const bmtcTime = getTransactionTimestamp(bmtc);
    const poojaryTime = getTransactionTimestamp(poojary);
    const bakeryTime = getTransactionTimestamp(bakery);

    // Poojary (10:01 PM) > Bmtc (11:04 AM) > Bakery (10:21 AM)
    expect(poojaryTime).toBeGreaterThan(bmtcTime);
    expect(bmtcTime).toBeGreaterThan(bakeryTime);

    const sorted = [bakery, bmtc, poojary].sort((a, b) => getTransactionTimestamp(b) - getTransactionTimestamp(a));
    expect(sorted).toEqual([poojary, bmtc, bakery]);
  });
});
