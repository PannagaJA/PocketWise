import * as SplashScreen from 'expo-splash-screen';

// Hold native splash screen immediately on app boot to prevent any white screen flash
SplashScreen.preventAutoHideAsync().catch(() => {});

import 'expo-router/entry';

// Register background headless handler for Firebase Cloud Messaging (FCM) when app is closed / killed
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('[FCM Headless] Push notification received while app closed:', remoteMessage?.notification?.title || remoteMessage?.data);
  });
} catch {
  // Headless messaging not linked or running in web
}
