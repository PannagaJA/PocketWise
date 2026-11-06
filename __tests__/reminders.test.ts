jest.mock('expo-constants', () => ({
  executionEnvironment: 'standalone',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));

const mockUpdate = jest.fn(() => ({
  eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
}));

const mockInsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: jest.fn(() =>
      Promise.resolve({
        data: {
          id: 'rem_123',
          user_id: 'user_test',
          type: 'bill',
          title: 'Electricity Bill',
          body: 'Pay by tomorrow',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          status: 'pending',
        },
        error: null,
      })
    ),
  })),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => ({
      update: mockUpdate,
      insert: mockInsert,
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

jest.mock('../lib/notifications/notification.engine', () => ({
  notificationEngine: {
    notify: jest.fn(async () => true),
  },
}));

jest.mock('../lib/notifications/notification.service', () => ({
  notificationService: {
    scheduleLocalNotification: jest.fn(async () => 'notif_scheduled_1'),
    cancelScheduledNotification: jest.fn(async () => {}),
  },
}));

import { reminderService } from '../lib/services/reminder.service';
import { notificationEngine } from '../lib/notifications/notification.engine';
import { notificationService } from '../lib/notifications/notification.service';

describe('ReminderService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createReminder inserts reminder into supabase and dispatches via notificationEngine', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const result = await reminderService.createReminder({
      user_id: 'user_test',
      type: 'bill',
      title: 'Electricity Bill',
      body: 'Pay by tomorrow',
      scheduled_at: futureDate,
    });

    expect(result.id).toBe('rem_123');
    expect(mockInsert).toHaveBeenCalled();
    expect(notificationEngine.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'rem_123',
        title: 'Electricity Bill',
      })
    );
  });

  test('completeReminder marks status as sent and cancels pending OS notification', async () => {
    await reminderService.completeReminder('rem_123');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
      })
    );
    expect(notificationService.cancelScheduledNotification).toHaveBeenCalledWith('rem_123');
  });

  test('cancelReminder marks status as cancelled and cancels pending OS notification', async () => {
    await reminderService.cancelReminder('rem_123');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
      })
    );
    expect(notificationService.cancelScheduledNotification).toHaveBeenCalledWith('rem_123');
  });
});
