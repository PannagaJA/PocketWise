import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: any = null;
if (!isExpoGo) {
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

      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;

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

  async deactivateDeviceToken(token: string): Promise<void> {
    if (!token) return;
    await supabase
      .from('devices')
      .update({ is_active: false })
      .eq('fcm_token', token);
  },
};
