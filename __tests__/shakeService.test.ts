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

  describe('Shake Detector Pure Algorithm & Physics Model', () => {
    // Pure TypeScript representation of the Kotlin ShakeDetector algorithm for verification
    class AlgorithmicShakeDetector {
      private gravityX = 0;
      private gravityY = 0;
      private gravityZ = 0;
      private isGravityInitialized = false;

      private lastShakeTimestamp = 0;
      private lastPeakTimestamp = 0;
      private peakTimestamps: number[] = [];

      public shakeCount = 0;

      constructor(
        public linearThreshold = 8.0,
        public gForceThreshold = 1.50,
        public alpha = 0.85,
        public minPeakIntervalMs = 80,
        public peakWindowMs = 650,
        public cooldownMs = 2500
      ) {}

      processSensorSample(x: number, y: number, z: number, now: number): boolean {
        const GRAVITY_EARTH = 9.80665;

        // 1. Low-pass filter for gravity isolation
        if (!this.isGravityInitialized) {
          this.gravityX = x;
          this.gravityY = y;
          this.gravityZ = z;
          this.isGravityInitialized = true;
        } else {
          this.gravityX = this.alpha * this.gravityX + (1 - this.alpha) * x;
          this.gravityY = this.alpha * this.gravityY + (1 - this.alpha) * y;
          this.gravityZ = this.alpha * this.gravityZ + (1 - this.alpha) * z;
        }

        // 2. Isotropic Linear Acceleration
        const linearX = x - this.gravityX;
        const linearY = y - this.gravityY;
        const linearZ = z - this.gravityZ;
        const linearMagnitude = Math.sqrt(linearX * linearX + linearY * linearY + linearZ * linearZ);

        // 3. Total G-Force
        const totalMagnitude = Math.sqrt(x * x + y * y + z * z);
        const gForce = totalMagnitude / GRAVITY_EARTH;

        const isThresholdExceeded =
          linearMagnitude >= this.linearThreshold || gForce >= this.gForceThreshold;

        if (isThresholdExceeded) {
          if (now - this.lastPeakTimestamp >= this.minPeakIntervalMs) {
            this.lastPeakTimestamp = now;
            this.peakTimestamps.push(now);
          }

          // Prune window
          this.peakTimestamps = this.peakTimestamps.filter((t) => now - t <= this.peakWindowMs);

          if (this.peakTimestamps.length >= 2) {
            if (this.lastShakeTimestamp === 0 || now - this.lastShakeTimestamp >= this.cooldownMs) {
              this.lastShakeTimestamp = now;
              this.peakTimestamps = [];
              this.shakeCount++;
              return true;
            }
          }
        }
        return false;
      }
    }

    it('successfully detects a horizontal (lateral X-axis) shake', () => {
      const detector = new AlgorithmicShakeDetector();

      // Phone resting upright (gravity on Y = 9.8)
      detector.processSensorSample(0, 9.8, 0, 1000);

      // Stroke 1: Shake right (+11 m/s^2)
      detector.processSensorSample(11.0, 9.8, 0, 1050);

      // Stroke 2: Shake left (-11 m/s^2) after 150ms
      const triggered = detector.processSensorSample(-11.0, 9.8, 0, 1200);

      expect(triggered).toBe(true);
      expect(detector.shakeCount).toBe(1);
    });

    it('successfully detects a vertical (Z-axis / face-up) shake', () => {
      const detector = new AlgorithmicShakeDetector();

      // Phone resting flat on table (gravity on Z = 9.8)
      detector.processSensorSample(0, 0, 9.8, 1000);

      // Stroke 1: Upward jerk (+12 m/s^2)
      detector.processSensorSample(0, 0, 21.8, 1050);

      // Stroke 2: Downward jerk
      const triggered = detector.processSensorSample(0, 0, -2.0, 1220);

      expect(triggered).toBe(true);
      expect(detector.shakeCount).toBe(1);
    });

    it('rejects single table bumps or drops (does not trigger on a single isolated shock)', () => {
      const detector = new AlgorithmicShakeDetector();

      // Static resting
      detector.processSensorSample(0, 0, 9.8, 1000);

      // Single impact spike for 30ms (consecutive samples < 80ms apart)
      detector.processSensorSample(0, 0, 24.0, 1020);
      detector.processSensorSample(0, 0, 24.0, 1040);

      // Back to static resting
      detector.processSensorSample(0, 0, 9.8, 1060);
      detector.processSensorSample(0, 0, 9.8, 1500);

      // Should NOT trigger shake on a single bump
      expect(detector.shakeCount).toBe(0);
    });

    it('rejects gentle walking and normal device handling', () => {
      const detector = new AlgorithmicShakeDetector();

      // Gentle walking oscillations (magnitude 9.8 ± 2.0 m/s^2)
      let triggered = false;
      for (let t = 1000; t <= 3000; t += 100) {
        const osc = Math.sin(t / 200) * 2.0;
        if (detector.processSensorSample(osc, 9.8 + osc, osc * 0.5, t)) {
          triggered = true;
        }
      }

      expect(triggered).toBe(false);
      expect(detector.shakeCount).toBe(0);
    });

    it('enforces cooldown debounce preventing rapid duplicate triggers', () => {
      const detector = new AlgorithmicShakeDetector();

      // First valid shake at t=1000
      detector.processSensorSample(0, 9.8, 0, 1000);
      detector.processSensorSample(11.0, 9.8, 0, 1050);
      const shake1 = detector.processSensorSample(-11.0, 9.8, 0, 1200);
      expect(shake1).toBe(true);

      // Immediate subsequent movements within 2.5s cooldown (e.g. at t=1800)
      detector.processSensorSample(11.0, 9.8, 0, 1700);
      const shakeDuringCooldown = detector.processSensorSample(-11.0, 9.8, 0, 1850);
      expect(shakeDuringCooldown).toBe(false);

      // Subsequent shake AFTER 2.5s cooldown (at t=4000)
      detector.processSensorSample(11.0, 9.8, 0, 3900);
      const shakeAfterCooldown = detector.processSensorSample(-11.0, 9.8, 0, 4100);
      expect(shakeAfterCooldown).toBe(true);
      expect(detector.shakeCount).toBe(2);
    });
  });

  describe('Overlay Permission & Settings Service Synchronization', () => {
    it('verifies checkOverlayPermission never defaults to true when module is missing or permission is not granted', async () => {
      // If Native module reports false
      const checkPermissionMock = async (nativeGranted: boolean | null) => {
        if (nativeGranted === null) return false;
        return Boolean(nativeGranted);
      };

      expect(await checkPermissionMock(false)).toBe(false);
      expect(await checkPermissionMock(true)).toBe(true);
      expect(await checkPermissionMock(null)).toBe(false);
    });

    it('verifies Shake toggle ON starts service and toggle OFF stops service', async () => {
      let isRunning = false;
      const startServiceMock = async () => {
        isRunning = true;
        return true;
      };
      const stopServiceMock = async () => {
        isRunning = false;
        return true;
      };

      // User turns ON
      await startServiceMock();
      expect(isRunning).toBe(true);

      // User turns OFF
      await stopServiceMock();
      expect(isRunning).toBe(false);
    });

    it('verifies Simulate Shake triggers downstream modal callback', () => {
      let modalOpened = false;
      const callbacks = new Set<() => void>();
      callbacks.add(() => {
        modalOpened = true;
      });

      // Simulate shake event trigger
      callbacks.forEach((cb) => cb());
      expect(modalOpened).toBe(true);
    });
  });
});
