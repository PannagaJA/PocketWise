import * as SplashScreen from 'expo-splash-screen';

// Hold native splash screen immediately on app boot to prevent any white screen flash
SplashScreen.preventAutoHideAsync().catch(() => {});

import 'expo-router/entry';

// Register background headless handler for Firebase Cloud Messaging (FCM) when app is closed / killed
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('[FCM Headless] Push notification received while app closed:', remoteMessage?.notification?.title || remoteMessage?.data);
    const data = remoteMessage?.data || {};
    const notification = remoteMessage?.notification;

    // Detect if this FCM message is an App Update notification
    const isUpdate =
      data.type === 'app_update' ||
      data.update === 'true' ||
      notification?.title?.toLowerCase().includes('update') ||
      notification?.body?.toLowerCase().includes('update');

    if (isUpdate) {
      const version = data.version || data.tag_name || '';
      try {
        const Notifications = require('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          identifier: `fcm_update_${Date.now()}`,
          content: {
            title: notification?.title || 'PocketWise Update Available 🚀',
            body: notification?.body || (version ? `PocketWise v${version} is ready. Tap to install.` : 'A new update is available. Tap to install.'),
            sound: true,
            channelId: 'pocketwise-updates',
            data: {
              type: 'app_update',
              version: version,
              ...data,
            },
          },
          trigger: null,
        });
      } catch (e) {
        console.warn('[FCM Headless] Failed to present update notification:', e);
      }
    }
  });
} catch {
  // Headless messaging not linked or running in web
}
