import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '../supabase';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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

export const notificationService = {
  async requestPermissions(): Promise<boolean> {
    if (isExpoGo || !Notifications) {
      console.log('Expo Go detected: Remote Push Notifications require a Development Build or standalone APK.');
      return false;
    }

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

    if (!isGranted) {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    return true;
  },

  async registerDeviceToken(userId: string): Promise<string | null> {
    if (isExpoGo || !Notifications) {
      console.log('Skipping remote device token registration in Expo Go.');
      return null;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      // Try obtaining native FCM messaging token, fallback to Expo device token
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
      } else {
        console.log('Successfully registered FCM token for user:', userId);
      }

      return token;
    } catch (err) {
      console.warn('Push token registration skipped or unavailable:', err);
      return null;
    }
  },

  /**
   * Schedule a local push notification on the device for upcoming bill/subscription due dates.
   */
  async scheduleDueDateReminder(id: string, title: string, body: string, triggerDate: Date): Promise<string | null> {
    if (isExpoGo || !Notifications) return null;

    try {
      await this.requestPermissions();

      const now = new Date();
      if (triggerDate <= now) {
        // If due time has passed, trigger in 10 seconds for testing/immediate visibility
        triggerDate = new Date(now.getTime() + 10000);
      }

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: { reminderId: id, type: 'due_date' },
        },
        trigger: triggerDate,
      });

      return notifId;
    } catch (err) {
      console.warn('Failed to schedule local due date reminder:', err);
      return null;
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
