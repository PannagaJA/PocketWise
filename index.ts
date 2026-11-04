import * as SplashScreen from 'expo-splash-screen';

// Hold native splash screen immediately on app boot to prevent any white screen flash
SplashScreen.preventAutoHideAsync().catch(() => {});

// Register background headless handler for Firebase Cloud Messaging (FCM) BEFORE mounting app entry
// Must be registered as early as possible so Android Headless JS service can find it when app is killed
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('[FCM Headless] Push notification received while app closed/killed:', remoteMessage);
    const data = remoteMessage?.data || {};
    const notification = remoteMessage?.notification;

    const title = notification?.title || data.title || (data.type === 'app_update' ? 'PocketWise Update Available 🚀' : 'PocketWise Alert');
    const body = notification?.body || data.body || data.message || '';

    // Detect if this FCM message is an App Update notification
    const isUpdate =
      data.type === 'app_update' ||
      data.update === 'true' ||
      title.toLowerCase().includes('update') ||
      body.toLowerCase().includes('update');

    const channelId = isUpdate ? 'pocketwise-updates' : 'pocketwise-reminders';

    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        identifier: `fcm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: {
          title,
          body: body || (isUpdate ? 'A new update is available. Tap to install.' : 'New update in PocketWise.'),
          sound: true,
          channelId,
          data: {
            ...data,
            type: isUpdate ? 'app_update' : (data.type || 'fcm_message'),
          },
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('[FCM Headless] Failed to present notification in system tray:', e);
    }
  });
} catch {
  // Headless messaging not linked or running in web
}

import 'expo-router/entry';
