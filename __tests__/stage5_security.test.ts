jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-constants', () => ({
  executionEnvironment: 'standalone',
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import { deepLinkService } from '../lib/notifications/deep-link.service';
import { appLockService } from '../lib/security/app-lock.service';

describe('Stage 5 Notification Deep Link & Security Rules', () => {
  test('Route mapping for notification payload types', () => {
    expect(deepLinkService.getRouteFromPayload('subscription', 'sub_123')).toBe('/(tabs)/subscriptions');
    expect(deepLinkService.getRouteFromPayload('bill', 'bill_123')).toBe('/bills');
    expect(deepLinkService.getRouteFromPayload('budget', 'bud_123')).toBe('/(tabs)/budgets');
    expect(deepLinkService.getRouteFromPayload('goal', 'goal_123')).toBe('/goals');
    expect(deepLinkService.getRouteFromPayload('transaction', 'tx_123')).toBe('/(tabs)/transactions');
    expect(deepLinkService.getRouteFromPayload(undefined, undefined)).toBe('/(tabs)');
  });

  test('Notification routing queueing when app is locked', () => {
    deepLinkService.setLockedState(true);
    const mockResponse = {
      notification: {
        request: {
          content: {
            data: { type: 'bill', reference_id: 'bill_999' },
          },
        },
      },
    } as any;

    deepLinkService.handleNotificationResponse(mockResponse);

    // Route should be queued in pendingRoute, not dispatched
    expect(deepLinkService.getPendingRoute()).toBe('/bills');

    // Unlocking app should clear pending route
    deepLinkService.setLockedState(false);
    expect(deepLinkService.getPendingRoute()).toBeNull();
  });
});
