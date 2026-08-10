import { formatMoney, parseMoneyToMinor, addMoney, subtractMoney } from '../lib/finance/core';

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
});
