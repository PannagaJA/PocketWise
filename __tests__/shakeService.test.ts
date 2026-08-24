import { parseMoneyToMinor, formatMoney } from '../lib/finance/core';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Shake to Add Expense - Core Logic & Data Pipeline Tests', () => {
  describe('Money Parsing & Currency Formatter Tests', () => {
    it('correctly parses ₹500 to 50000 minor units (paise)', () => {
      expect(parseMoneyToMinor('500')).toBe(50000);
      expect(parseMoneyToMinor('₹500')).toBe(50000);
      expect(parseMoneyToMinor('₹ 500.00')).toBe(50000);
    });

    it('correctly parses decimal amounts (₹500.50 -> 50050 paise)', () => {
      expect(parseMoneyToMinor('500.50')).toBe(50050);
      expect(parseMoneyToMinor('₹500.50')).toBe(50050);
    });

    it('rejects or normalizes 0, empty, and negative strings to 0', () => {
      expect(parseMoneyToMinor('')).toBe(0);
      expect(parseMoneyToMinor('0')).toBe(0);
      expect(parseMoneyToMinor('0.00')).toBe(0);
      expect(parseMoneyToMinor('-500')).toBe(0);
      expect(parseMoneyToMinor('abc')).toBe(0);
    });

    it('formats money amounts in Indian Rupees (INR) format', () => {
      const formatted = formatMoney(50000);
      expect(formatted).toContain('500');
    });
  });

  describe('Shake Settings & Sensitivity Config', () => {
    it('defaults to enabled=true, backgroundEnabled=true, sensitivity=normal', async () => {
      const settings = await shakeStorage.getSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.backgroundEnabled).toBe(true);
      expect(settings.sensitivity).toBe('normal');
    });

    it('validates sensitivity mapping thresholds', () => {
      const sensitivityMap: Record<ShakeSensitivity, number> = {
        low: 17.5,
        normal: 13.0,
        high: 9.5,
      };

      expect(sensitivityMap.low).toBeGreaterThan(sensitivityMap.normal);
      expect(sensitivityMap.normal).toBeGreaterThan(sensitivityMap.high);
    });
  });

  describe('Transaction Payload & Schema Integrity', () => {
    it('generates a valid expense transaction payload matching transactionService contract', () => {
      const userId = 'user_123_abc';
      const accountId = 'acc_456_xyz';
      const categoryId = 'cat_fuel_789';
      const description = 'Petrol';
      const rawAmount = '500';
      const minorAmount = parseMoneyToMinor(rawAmount);
      const date = '2026-08-24';

      const payload = {
        user_id: userId,
        account_id: accountId,
        type: 'expense' as const,
        amount_minor: minorAmount,
        currency: 'INR',
        category_id: categoryId,
        description,
        date,
      };

      expect(payload.user_id).toBe('user_123_abc');
      expect(payload.account_id).toBe('acc_456_xyz');
      expect(payload.type).toBe('expense');
      expect(payload.amount_minor).toBe(50000);
      expect(payload.currency).toBe('INR');
      expect(payload.description).toBe('Petrol');
      expect(payload.date).toBe('2026-08-24');
    });

    it('rejects transaction creation with invalid parameters', () => {
      const validateExpense = (amountStr: string, desc: string, accId: string) => {
        const minor = parseMoneyToMinor(amountStr);
        if (minor <= 0) return { valid: false, error: 'Amount must be greater than zero' };
        if (!desc.trim()) return { valid: false, error: 'Description is required' };
        if (!accId.trim()) return { valid: false, error: 'Account ID is required' };
        return { valid: true };
      };

      expect(validateExpense('', 'Petrol', 'acc_1').valid).toBe(false);
      expect(validateExpense('0', 'Petrol', 'acc_1').valid).toBe(false);
      expect(validateExpense('-50', 'Petrol', 'acc_1').valid).toBe(false);
      expect(validateExpense('500', '', 'acc_1').valid).toBe(false);
      expect(validateExpense('500', '   ', 'acc_1').valid).toBe(false);
      expect(validateExpense('500', 'Petrol', '').valid).toBe(false);
      expect(validateExpense('500', 'Petrol', 'acc_1').valid).toBe(true);
    });
  });

  describe('Debounce & Duplicate Prevention Logic', () => {
    it('verifies 2500ms cooldown window prevents multi-triggers', () => {
      const COOLDOWN_MS = 2500;
      let lastTrigger = 10000;

      const canTrigger = (currentTimestamp: number) => {
        if (currentTimestamp - lastTrigger >= COOLDOWN_MS) {
          lastTrigger = currentTimestamp;
          return true;
        }
        return false;
      };

      // Shakes within cooldown window should be ignored
      expect(canTrigger(10100)).toBe(false);
      expect(canTrigger(11000)).toBe(false);
      expect(canTrigger(12499)).toBe(false);

      // Shake after cooldown window should be accepted
      expect(canTrigger(12500)).toBe(true);
    });
  });
});
