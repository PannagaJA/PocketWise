let mockStorage: Record<string, string> = {};
let mockSecureStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, val: string) => {
    mockStorage[key] = val;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage = {};
    return Promise.resolve();
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] || null)),
  setItemAsync: jest.fn((key: string, val: string) => {
    mockSecureStore[key] = val;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null }),
});
const mockDelete = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null }),
});

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
      upsert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

import { outboxService } from '../lib/services/outbox.service';
import { appLockService } from '../lib/security/app-lock.service';

describe('Stage 4: Offline Outbox & Security Hardening', () => {
  beforeEach(() => {
    mockStorage = {};
    mockSecureStore = {};
    jest.clearAllMocks();
  });

  describe('Outbox Queue Storage & Execution', () => {
    test('Enqueues mutations and persists them to AsyncStorage', async () => {
      const mutation = await outboxService.enqueueMutation('CREATE_TRANSACTION', {
        amount_minor: 5000,
        description: 'Offline Coffee',
      });

      expect(mutation.id).toBeDefined();
      expect(mutation.type).toBe('CREATE_TRANSACTION');
      expect(mutation.payload.description).toBe('Offline Coffee');

      const pending = await outboxService.getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0].payload.amount_minor).toBe(5000);
    });

    test('Processes outbox mutations in FIFO order and removes on success', async () => {
      await outboxService.enqueueMutation('CREATE_TRANSACTION', { description: 'Item 1' });
      await outboxService.enqueueMutation('CREATE_LEND', { borrower_name: 'Alex', amount_minor: 10000 });

      let synced = false;
      const result = await outboxService.processOutbox(() => {
        synced = true;
      });

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(synced).toBe(true);

      const remaining = await outboxService.getPendingMutations();
      expect(remaining.length).toBe(0);
    });

    test('Retains mutation and increments attempt count when execution fails', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Network Timeout' } });

      await outboxService.enqueueMutation('CREATE_TRANSACTION', { description: 'Failing Item' });
      const result = await outboxService.processOutbox();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);

      const remaining = await outboxService.getPendingMutations();
      expect(remaining.length).toBe(1);
      expect(remaining[0].attempts).toBe(1);
    });

    test('Moves mutations to dead-letter queue after 5 failed attempts with error message', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'Permanent Server Failure' } });

      const mut = await outboxService.enqueueMutation('CREATE_TRANSACTION', { description: 'Doomed Tx' });
      // Simulate 5 prior attempts
      const pending = await outboxService.getPendingMutations();
      pending[0].attempts = 5;
      await (outboxService as any).clearOutbox();
      const mockStorageKey = 'POCKETWISE_MUTATION_OUTBOX_V1';
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(mockStorageKey, JSON.stringify(pending));

      // 6th attempt should push to dead-letter queue
      await outboxService.processOutbox();

      const deadLetter = await outboxService.getDeadLetterMutations();
      expect(deadLetter.length).toBe(1);
      expect(deadLetter[0].lastError).toBe('Permanent Server Failure');
    });

    test('Assigns distinct mutation IDs for multiple mutations of the same entity', async () => {
      const mut1 = await outboxService.enqueueMutation('CREATE_TRANSACTION', { id: 'tx-100', amount: 50 });
      const mut2 = await outboxService.enqueueMutation('UPDATE_TRANSACTION', { id: 'tx-100', amount: 75 });

      expect(mut1.id).not.toBe(mut2.id);
      expect(mut1.id).not.toBe('tx-100');
    });
  });

  describe('Security & App Lock Timer Mechanics', () => {
    test('Sets and verifies 4-digit PIN verifier hash', async () => {
      await appLockService.setPin('1234');

      const isEnabled = await appLockService.isAppLockEnabled();
      expect(isEnabled).toBe(true);

      const valid = await appLockService.verifyPin('1234');
      expect(valid).toBe(true);

      const invalid = await appLockService.verifyPin('9999');
      expect(invalid).toBe(false);
    });

    test('Stores and retrieves custom lock timeout settings', async () => {
      // Default timeout is 30s
      let timeout = await appLockService.getLockTimeout();
      expect(timeout).toBe(30);

      await appLockService.setLockTimeout(60);
      timeout = await appLockService.getLockTimeout();
      expect(timeout).toBe(60);
    });

    test('Calculates background relock decision accurately based on elapsed seconds', async () => {
      await appLockService.setPin('5678');
      await appLockService.setLockTimeout(30); // 30s timeout

      const now = Date.now();

      // Case 1: Less than 30 seconds in background (e.g. 10s) -> should NOT relock
      const tenSecondsAgo = now - 10 * 1000;
      let shouldLock = await appLockService.shouldRelock(tenSecondsAgo);
      expect(shouldLock).toBe(false);

      // Case 2: Greater than 30 seconds in background (e.g. 35s) -> SHOULD relock
      const thirtyFiveSecondsAgo = now - 35 * 1000;
      shouldLock = await appLockService.shouldRelock(thirtyFiveSecondsAgo);
      expect(shouldLock).toBe(true);

      // Case 3: Timeout is immediate (0s) -> always relocks
      await appLockService.setLockTimeout(0);
      shouldLock = await appLockService.shouldRelock(now - 1000);
      expect(shouldLock).toBe(true);

      // Case 4: Timeout is never (-1) -> does not relock
      await appLockService.setLockTimeout(-1);
      shouldLock = await appLockService.shouldRelock(now - 100000);
      expect(shouldLock).toBe(false);
    });
  });
});
