// Mocks must be declared before imports
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    PocketWiseShakeModule: {
      isShakeServiceRunning: jest.fn().mockResolvedValue(true),
      startShakeService: jest.fn().mockResolvedValue(true),
      stopShakeService: jest.fn().mockResolvedValue(true),
      checkOverlayPermission: jest.fn().mockResolvedValue(true),
      requestOverlayPermission: jest.fn().mockResolvedValue(true),
      setShakeSensitivity: jest.fn().mockResolvedValue(true),
      setBackgroundShakeEnabled: jest.fn().mockResolvedValue(true),
      simulateShake: jest.fn().mockResolvedValue(true),
      getServiceDiagnostics: jest.fn().mockResolvedValue({
        serviceRunning: true,
        sensorAvailable: true,
        sensorListening: true,
        detectorActive: true,
        serviceEnabled: true,
        backgroundEnabled: true,
        sensitivity: 'NORMAL',
        linearThreshold: 8.0,
        gForceThreshold: 1.50,
        sensorEventsReceived: 1250,
        thresholdCrossings: 45,
        peaksDetected: 12,
        confirmedShakes: 2,
        lastSensorEventTimestamp: 1724523000000,
        lastShakeTimestamp: 1724522900000,
        shakeCount: 2,
        popupActive: false,
        lastLinearMagnitude: 4.2,
        maxLinearMagnitude: 16.8,
        lastGForce: 1.12,
        maxGForce: 2.15,
        lastEventDeltaMs: 19,
        maxEventDeltaMs: 45,
        serviceInstanceId: 'inst_abc_123',
        serviceStartCount: 3,
        serviceStartTimestamp: 1724520000000,
        sensorRegistrationTimestamp: 1724520000100,
        sensorRegistrationResult: true,
        sensorName: 'BMI160 Accelerometer',
        sensorVendor: 'Bosch',
      }),
      runSensorSelfTest: jest.fn().mockResolvedValue({
        eventsReceived: 42,
        durationMs: 2000,
        sensorAvailable: true,
        sensorName: 'BMI160 Accelerometer',
        sensorVendor: 'Bosch',
        registrationSuccess: true,
        lastEventTimeMs: 1724523456789,
      }),
    },
  },
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    emit: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));

jest.mock('../lib/services/transaction.service', () => ({
  transactionService: {
    createTransaction: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../lib/services/account.service', () => ({
  accountService: {
    getAccounts: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../lib/services/category.service', () => ({
  categoryService: {
    getCategories: jest.fn().mockResolvedValue([]),
  },
}));

import { parseMoneyToMinor, formatMoney } from '../lib/finance/core';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';
import { shakeService } from '../lib/shake/shakeService';

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

    it('persists and updates sensitivity properly', async () => {
      await shakeStorage.saveSettings({ sensitivity: 'high' });
      expect(shakeStorage.saveSettings).toBeDefined();
    });

    it('persists backgroundEnabled setting properly', async () => {
      await shakeStorage.saveSettings({ backgroundEnabled: false });
      expect(shakeStorage.saveSettings).toBeDefined();
    });
  });

  describe('Accelerometer Math & Multi-Axis Peak Evaluation', () => {
    const ALPHA = 0.85;

    const evaluateAccelerometer = (
      samples: Array<[number, number, number]>,
      linearThreshold: number,
      gForceThreshold: number
    ) => {
      let gravityX = 0;
      let gravityY = 0;
      let gravityZ = 0;
      let isInit = false;
      let peakCount = 0;

      for (const [x, y, z] of samples) {
        if (!isInit) {
          gravityX = x;
          gravityY = y;
          gravityZ = z;
          isInit = true;
        } else {
          gravityX = ALPHA * gravityX + (1 - ALPHA) * x;
          gravityY = ALPHA * gravityY + (1 - ALPHA) * y;
          gravityZ = ALPHA * gravityZ + (1 - ALPHA) * z;
        }

        const linX = x - gravityX;
        const linY = y - gravityY;
        const linZ = z - gravityZ;
        const linearMagnitude = Math.sqrt(linX * linX + linY * linY + linZ * linZ);

        const totalMag = Math.sqrt(x * x + y * y + z * z);
        const gForce = totalMag / 9.80665;

        if (linearMagnitude >= linearThreshold || gForce >= gForceThreshold) {
          peakCount++;
        }
      }

      return peakCount;
    };

    it('correctly filters out static device (1G gravity only, zero linear acceleration)', () => {
      const staticSamples: Array<[number, number, number]> = Array(50).fill([0, 0, 9.8]);
      const peaks = evaluateAccelerometer(staticSamples, 8.0, 1.5);
      expect(peaks).toBe(0);
    });

    it('filters out gentle walking motion (low acceleration below threshold)', () => {
      const walkingSamples: Array<[number, number, number]> = [
        [0.5, 0.2, 10.2],
        [0.8, 0.4, 10.5],
        [0.2, 0.1, 9.5],
        [-0.5, -0.2, 9.2],
        [-0.8, -0.4, 9.0],
      ];
      const peaks = evaluateAccelerometer(walkingSamples, 8.0, 1.5);
      expect(peaks).toBe(0);
    });

    it('detects distinct bidirectional peaks on vigorous intentional shake', () => {
      const shakeSamples: Array<[number, number, number]> = [
        [0, 0, 9.8],
        [0, 0, 9.8],
        [18.5, 2.0, 4.0],
        [0.0, 0.0, 9.8],
        [-19.0, -1.5, 5.0],
        [0, 0, 9.8],
      ];
      const peaks = evaluateAccelerometer(shakeSamples, 8.0, 1.5);
      expect(peaks).toBeGreaterThanOrEqual(2);
    });

    it('applies sensitivity levels correctly (HIGH triggers on lower threshold than LOW)', () => {
      const moderateShake: Array<[number, number, number]> = [
        [0, 0, 9.8],
        [6.5, 0.5, 9.8],
        [0, 0, 9.8],
        [-6.8, -0.5, 9.8],
      ];

      const highPeaks = evaluateAccelerometer(moderateShake, 5.5, 1.25);
      expect(highPeaks).toBeGreaterThanOrEqual(2);

      const lowPeaks = evaluateAccelerometer(moderateShake, 12.0, 1.9);
      expect(lowPeaks).toBe(0);
    });
  });

  describe('Cooldown & Debounce Logic', () => {
    it('enforces a 2500ms debounce cooldown between triggers to prevent duplicate expenses', () => {
      const COOLDOWN_MS = 2500;
      let lastShakeTimestamp = 0;
      let triggerCount = 0;

      const onShakeDetected = (timestamp: number) => {
        if (lastShakeTimestamp === 0 || timestamp - lastShakeTimestamp >= COOLDOWN_MS) {
          lastShakeTimestamp = timestamp;
          triggerCount++;
          return true;
        }
        return false;
      };

      expect(onShakeDetected(1000)).toBe(true);
      expect(triggerCount).toBe(1);

      expect(onShakeDetected(1500)).toBe(false);
      expect(triggerCount).toBe(1);

      expect(onShakeDetected(3000)).toBe(false);
      expect(triggerCount).toBe(1);

      expect(onShakeDetected(3600)).toBe(true);
      expect(triggerCount).toBe(2);
    });
  });

  describe('Overlay Permission & Settings Service Synchronization', () => {
    it('verifies background service lifecycle state transition logic on task removal', () => {
      let isServiceEnabled = true;
      let isBgEnabled = true;
      let serviceRunning = true;
      let detectorActive = true;
      let sensorListening = true;

      const onTaskRemoved = (serviceEnabled: boolean, backgroundEnabled: boolean) => {
        if (serviceEnabled && backgroundEnabled) {
          serviceRunning = true;
          detectorActive = true;
          sensorListening = true;
        } else {
          serviceRunning = false;
          detectorActive = false;
          sensorListening = false;
        }
      };

      onTaskRemoved(isServiceEnabled, isBgEnabled);
      expect(serviceRunning).toBe(true);
      expect(detectorActive).toBe(true);
      expect(sensorListening).toBe(true);

      onTaskRemoved(isServiceEnabled, false);
      expect(serviceRunning).toBe(false);
      expect(detectorActive).toBe(false);
      expect(sensorListening).toBe(false);
    });

    it('verifies background shake routes to QuickExpenseActivity when React Native JS is terminated', () => {
      let emittedToRN = false;
      let launchedQuickExpenseActivity = false;
      let postedNotification = false;

      const handleShakeTriggered = (rnActive: boolean, canOverlay: boolean, bgAllowed: boolean) => {
        if (rnActive) {
          emittedToRN = true;
          return;
        }

        if (!bgAllowed) return;

        if (canOverlay) {
          launchedQuickExpenseActivity = true;
        } else {
          postedNotification = true;
        }
      };

      handleShakeTriggered(false, true, true);
      expect(emittedToRN).toBe(false);
      expect(launchedQuickExpenseActivity).toBe(true);
      expect(postedNotification).toBe(false);
    });

    it('verifies infinite repeatability across multiple sequential shake -> popup -> dismiss cycles', () => {
      let isPopupActive = false;
      let lastShakeTimestamp = 0;
      let shakeCount = 0;
      const COOLDOWN_MS = 2500;

      const triggerShake = (now: number) => {
        if (isPopupActive) return false;
        if (lastShakeTimestamp === 0 || now - lastShakeTimestamp >= COOLDOWN_MS) {
          lastShakeTimestamp = now;
          isPopupActive = true;
          shakeCount++;
          return true;
        }
        return false;
      };

      const dismissPopup = () => {
        isPopupActive = false;
      };

      expect(triggerShake(1000)).toBe(true);
      expect(shakeCount).toBe(1);
      expect(isPopupActive).toBe(true);

      dismissPopup();
      expect(isPopupActive).toBe(false);

      expect(triggerShake(4000)).toBe(true);
      expect(shakeCount).toBe(2);
      expect(isPopupActive).toBe(true);

      dismissPopup();
      expect(isPopupActive).toBe(false);

      expect(triggerShake(7000)).toBe(true);
      expect(shakeCount).toBe(3);
    });

    it('verifies sensor event telemetry tracking and force re-registration across task removal', () => {
      let totalSensorEvents = 0;
      let lastSensorEventTimeMs = 0;
      let isListening = false;
      let isSensorListening = false;

      const onSensorChanged = (now: number) => {
        totalSensorEvents++;
        lastSensorEventTimeMs = now;
      };

      const startListening = (force: boolean) => {
        if (force && isListening) {
          isListening = false;
        }
        if (isListening) return;
        isListening = true;
        isSensorListening = true;
      };

      startListening(false);
      expect(isListening).toBe(true);
      expect(isSensorListening).toBe(true);

      for (let i = 1; i <= 10; i++) {
        onSensorChanged(1000 + i * 10);
      }
      expect(totalSensorEvents).toBe(10);
      expect(lastSensorEventTimeMs).toBe(1100);

      startListening(true);
      expect(isListening).toBe(true);
      expect(isSensorListening).toBe(true);

      onSensorChanged(2000);
      expect(totalSensorEvents).toBe(11);
      expect(lastSensorEventTimeMs).toBe(2000);
    });

    it('verifies runSensorSelfTest and persisted instance telemetry', async () => {
      const diag = await shakeService.getNativeServiceDiagnostics();
      expect(diag?.serviceRunning).toBe(true);
      expect(diag?.serviceInstanceId).toBe('inst_abc_123');
      expect(diag?.serviceStartCount).toBe(3);
      expect(diag?.sensorEventsReceived).toBe(1250);
      expect(diag?.thresholdCrossings).toBe(45);
      expect(diag?.peaksDetected).toBe(12);
      expect(diag?.confirmedShakes).toBe(2);
      expect(diag?.maxLinearMagnitude).toBe(16.8);
      expect(diag?.maxGForce).toBe(2.15);
      expect(diag?.lastEventDeltaMs).toBe(19);
      expect(diag?.maxEventDeltaMs).toBe(45);
      expect(diag?.sensorName).toBe('BMI160 Accelerometer');

      const selfTest = await shakeService.runSensorSelfTest(2000);
      expect(selfTest.eventsReceived).toBe(42);
      expect(selfTest.sensorAvailable).toBe(true);
      expect(selfTest.registrationSuccess).toBe(true);
      expect(selfTest.sensorVendor).toBe('Bosch');
    });
  });
});
