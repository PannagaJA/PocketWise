jest.mock('expo-constants', () => ({
  executionEnvironment: 'standalone',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async ({ identifier }) => identifier || 'mock_notif_id_123'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
}));

import { financialAnalyticsEngine } from '../lib/finance/analyticsEngine';
import { notificationEngine } from '../lib/notifications/notification.engine';

describe('PocketWise Analytics & Unusual Spending System', () => {
  beforeEach(async () => {
    // Reset preferences and deduplication engine state before test run
    await notificationEngine.init();
  });

  test('1. Detects unusual spending when transaction is 2.5x higher than average', async () => {
    const historicalTxs = [
      { id: '1', amount_minor: 50000, type: 'expense', category_name: 'Food', date: '2026-08-01' },
      { id: '2', amount_minor: 60000, type: 'expense', category_name: 'Food', date: '2026-08-02' },
      { id: '3', amount_minor: 40000, type: 'expense', category_name: 'Food', date: '2026-08-03' },
    ]; // Avg = Rs 500

    const highTx = {
      id: 'tx_unusual_1',
      amount_minor: 250000, // Rs 2,500 (5x average)
      type: 'expense',
      category_name: 'Shopping',
      date: '2026-08-04',
    };

    const spy = jest.spyOn(notificationEngine, 'notify');
    await financialAnalyticsEngine.evaluateUnusualSpending(highTx, historicalTxs);

    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastCall.category).toBe('unusual_spending');
    expect(lastCall.eventId).toBe('unusual_spend_tx_unusual_1');
    spy.mockRestore();
  });

  test('2. Suppresses unusual spending alert for normal baseline expense', async () => {
    const historicalTxs = [
      { id: '1', amount_minor: 50000, type: 'expense', category_name: 'Food', date: '2026-08-01' },
      { id: '2', amount_minor: 60000, type: 'expense', category_name: 'Food', date: '2026-08-02' },
      { id: '3', amount_minor: 40000, type: 'expense', category_name: 'Food', date: '2026-08-03' },
    ];

    const normalTx = {
      id: 'tx_normal_1',
      amount_minor: 55000, // Rs 550 (close to average)
      type: 'expense',
      category_name: 'Food',
      date: '2026-08-04',
    };

    const spy = jest.spyOn(notificationEngine, 'notify');
    await financialAnalyticsEngine.evaluateUnusualSpending(normalTx, historicalTxs);

    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ eventId: 'unusual_spend_tx_normal_1' }));
    spy.mockRestore();
  });

  test('3. Prevents duplicate notifications for same event ID', async () => {
    const eventId = 'test_dedup_unique_event_99';
    const notif1 = await notificationEngine.notify({
      eventId,
      category: 'transaction',
      title: 'Test Notification 1',
      body: 'Body 1',
    });

    const notif2 = await notificationEngine.notify({
      eventId,
      category: 'transaction',
      title: 'Test Notification 2 (Duplicate)',
      body: 'Body 2',
    });

    expect(notif1).not.toBeNull();
    expect(notif2).toBeNull(); // Duplicate suppressed
  });

  test('4. Respects user preferences when category is disabled', async () => {
    await notificationEngine.savePreferences({ summaries: false });

    const summaryResult = await notificationEngine.notify({
      eventId: 'test_summary_disabled',
      category: 'summary',
      title: 'Summary Disabled',
      body: 'Body',
    });

    expect(summaryResult).toBeNull();
  });
});
