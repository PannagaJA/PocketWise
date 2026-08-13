let Platform: any = { OS: 'android' };
let Constants: any = null;
let ExecutionEnvironment: any = { StoreClient: 'storeClient' };

try {
  Platform = require('react-native').Platform;
  Constants = require('expo-constants').default || require('expo-constants');
  ExecutionEnvironment = require('expo-constants').ExecutionEnvironment || ExecutionEnvironment;
} catch {
  Platform = { OS: 'android' };
  Constants = { executionEnvironment: 'bare' };
}

import { supabase } from '../supabase';

const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    Notifications = null;
  }
}

export type NotificationCategory =
  | 'transaction'
  | 'income'
  | 'expense'
  | 'large_transaction'
  | 'bill'
  | 'subscription'
  | 'budget'
  | 'budget_exceeded'
  | 'savings'
  | 'savings_completed'
  | 'analytics'
  | 'unusual_spending'
  | 'summary'
  | 'reminder'
  | 'system';

let isInitialized = false;

export const notificationService = {
  /**
   * Idempotently initialize notification channels and permissions on app boot.
   */
  async init(): Promise<boolean> {
    if (isInitialized) return true;
    if (isExpoGo || !Notifications) {
      console.log('[NotificationService] Running in Expo Go or module unavailable.');
      return false;
    }

    try {
      if (Platform.OS === 'android') {
        // High priority channel for transactions, bills, reminders, and alerts
        await Notifications.setNotificationChannelAsync('pocketwise-reminders', {
          name: 'PocketWise Alerts & Reminders',
          description: 'Scheduled reminders for upcoming bills, subscriptions, transactions, and urgent alerts.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
          sound: 'default',
        });

        // Medium priority channel for summary updates & insights
        await Notifications.setNotificationChannelAsync('pocketwise-insights', {
          name: 'PocketWise Insights & Summaries',
          description: 'Financial analytics, weekly digests, and savings milestone updates.',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 150],
          lightColor: '#10B981',
          sound: 'default',
        });
      }

      await this.requestPermissions();
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[NotificationService] Error initializing notifications:', err);
      return false;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (isExpoGo || !Notifications) {
      return false;
    }

    try {
      const settings: any = await Notifications.getPermissionsAsync();
      let isGranted = settings.granted || settings.status === 'granted';

      if (!isGranted) {
        const newSettings: any = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        isGranted = newSettings.granted || newSettings.status === 'granted';
      }

      if (isGranted && Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pocketwise-reminders', {
          name: 'PocketWise Reminders',
          description: 'Scheduled reminders for upcoming bills, subscriptions, and financial alerts.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
          sound: 'default',
        });
      }

      return isGranted;
    } catch (err) {
      console.warn('[NotificationService] Error requesting notification permissions:', err);
      return false;
    }
  },

  async checkPermissions(): Promise<boolean> {
    if (isExpoGo || !Notifications) return false;
    try {
      const settings: any = await Notifications.getPermissionsAsync();
      return !!(settings.granted || settings.status === 'granted');
    } catch {
      return false;
    }
  },

  async registerDeviceToken(userId: string): Promise<string | null> {
    if (isExpoGo || !Notifications) return null;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      let token: string | null = null;
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        token = await messaging().getToken();
      } catch {
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = typeof tokenData === 'string' ? tokenData : tokenData?.data;
      }

      if (!token) return null;

      const { error } = await supabase
        .from('devices')
        .upsert({
          user_id: userId,
          fcm_token: token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          device_name: `${Platform.OS.toUpperCase()} Device`,
          is_active: true,
          last_used_at: new Date().toISOString(),
        }, { onConflict: 'fcm_token' });

      if (error) {
        console.error('Error saving device token to Supabase:', error);
      }
      return token;
    } catch (err) {
      console.warn('Push token registration skipped or unavailable:', err);
      return null;
    }
  },

  /**
   * Schedule a local push notification on the device for upcoming bill/subscription due dates.
   * Cancels existing notification for the same ID to prevent duplicates.
   */
  async scheduleDueDateReminder(
    id: string,
    title: string,
    body: string,
    triggerDate: Date,
    type: 'bill' | 'subscription' | 'budget' | 'goal' | 'transaction' = 'bill'
  ): Promise<string | null> {
    if (!Notifications) return null;

    try {
      await this.init();

      // Normalize triggerDate to prevent invalid dates or past dates
      let now = new Date();
      let targetDate = new Date(triggerDate);

      if (isNaN(targetDate.getTime())) {
        console.warn('[NotificationService] Invalid date supplied to scheduleDueDateReminder:', triggerDate);
        return null;
      }

      // If scheduled time has already passed, schedule 10 seconds in future for immediate visibility
      if (targetDate <= now) {
        targetDate = new Date(now.getTime() + 10000);
      }

      // Prevent duplicates by cancelling existing notification with same identifier if supported
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Identifier match might fail if not found; safe to ignore
      }

      const notifId = await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title,
          body,
          sound: 'default',
          channelId: 'pocketwise-reminders',
          data: {
            reminderId: id,
            type: type,
            reference_id: id,
          },
        },
        trigger: Platform.OS === 'android' ? { type: 'date', date: targetDate } : targetDate,
      });

      console.log(`[NotificationService] Successfully scheduled local notification (ID: ${id}) for ${targetDate.toISOString()}`);
      return notifId;
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule local due date reminder:', err);
      // Fallback try with seconds offset if Date object trigger fails on Android
      try {
        const diffSeconds = Math.max(5, Math.floor((triggerDate.getTime() - Date.now()) / 1000));
        const fallbackId = await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title,
            body,
            sound: 'default',
            channelId: 'pocketwise-reminders',
            data: { reminderId: id, type: type, reference_id: id },
          },
          trigger: { seconds: diffSeconds, channelId: 'pocketwise-reminders' },
        });
        return fallbackId;
      } catch (fallbackErr) {
        console.warn('[NotificationService] Fallback trigger also failed:', fallbackErr);
        return null;
      }
    }
  },

  /**
   * Cancel a scheduled local notification by ID.
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    if (!Notifications || !id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      console.log(`[NotificationService] Cancelled scheduled notification (ID: ${id})`);
    } catch (err) {
      console.warn('[NotificationService] Error cancelling notification:', err);
    }
  },

  /**
   * Immediately dispatch a real Android system notification for instant financial events (transactions, budget warnings, etc.).
   */
  async sendSystemAlert(params: {
    id: string;
    category: NotificationCategory;
    title: string;
    body: string;
    priority?: 'high' | 'medium' | 'low';
    data?: Record<string, any>;
  }): Promise<string | null> {
    if (!Notifications) return null;
    try {
      await this.init();
      const channel = params.priority === 'low' ? 'pocketwise-insights' : 'pocketwise-reminders';

      const notifId = await Notifications.scheduleNotificationAsync({
        identifier: params.id,
        content: {
          title: params.title,
          body: params.body,
          sound: 'default',
          channelId: channel,
          data: {
            ...params.data,
            type: params.category,
            reference_id: params.id,
          },
        },
        trigger: null, // Null trigger presents immediately on OS
      });
      console.log(`[NotificationService] Dispatched system alert (${params.category}): ${params.title}`);
      return notifId;
    } catch (err) {
      console.warn('[NotificationService] Error sending system alert:', err);
      return null;
    }
  },

  /**
   * Immediately trigger a test notification for developer verification.
   */
  async sendTestNotification(): Promise<boolean> {
    if (!Notifications) return false;
    try {
      await this.init();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'PocketWise System Test',
          body: 'Local Android notifications are fully working!',
          sound: 'default',
          channelId: 'pocketwise-reminders',
          data: { type: 'test' },
        },
        trigger: null, // null trigger presents immediately
      });
      return true;
    } catch (err) {
      console.warn('[NotificationService] Failed to send test notification:', err);
      return false;
    }
  },

  /**
   * Schedule a test notification 1 minute in the future for testing while phone is locked/closed.
   */
  async scheduleTestNotification(delaySeconds: number = 60): Promise<boolean> {
    if (!Notifications) return false;
    try {
      await this.init();
      await Notifications.scheduleNotificationAsync({
        identifier: `test_${Date.now()}`,
        content: {
          title: 'PocketWise Scheduled Test',
          body: `This scheduled notification fired after ${delaySeconds} seconds.`,
          sound: 'default',
          channelId: 'pocketwise-reminders',
          data: { type: 'test' },
        },
        trigger: { seconds: delaySeconds, channelId: 'pocketwise-reminders' },
      });
      return true;
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule test notification:', err);
      return false;
    }
  },

  async deactivateDeviceToken(token: string): Promise<void> {
    if (!token) return;
    await supabase
      .from('devices')
      .update({ is_active: false })
      .eq('fcm_token', token);
  },
};

