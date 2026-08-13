import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
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

let isInitialized = false;

export const notificationService = {
  /**
   * Idempotently initialize notification channel and permissions on app boot.
   */
  async init(): Promise<boolean> {
    if (isInitialized) return true;
    if (isExpoGo || !Notifications) {
      console.log('[NotificationService] Running in Expo Go or module unavailable.');
      return false;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pocketwise-reminders', {
          name: 'PocketWise Reminders',
          description: 'Scheduled reminders for upcoming bills, subscriptions, and financial alerts.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
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
        trigger: targetDate,
      });

      console.log(`[NotificationService] Successfully scheduled local notification (ID: ${id}) for ${targetDate.toISOString()}`);
      return notifId;
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule local due date reminder:', err);
      return null;
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
      const triggerDate = new Date(Date.now() + delaySeconds * 1000);
      await Notifications.scheduleNotificationAsync({
        identifier: `test_${Date.now()}`,
        content: {
          title: 'PocketWise Scheduled Test',
          body: `This scheduled notification fired after ${delaySeconds} seconds.`,
          sound: 'default',
          channelId: 'pocketwise-reminders',
          data: { type: 'test' },
        },
        trigger: triggerDate,
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

