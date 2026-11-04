import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLockGate } from '../components/AppLockGate';
import { AnimatedSplashScreen } from '../components/splash/AnimatedSplashScreen';
import { deepLinkService } from '../lib/notifications/deep-link.service';
import { notificationService } from '../lib/notifications/notification.service';
import { financialAnalyticsEngine } from '../lib/finance/analyticsEngine';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { QuickExpenseModal } from '../components/QuickExpenseModal';
import { AppUpdateModal } from '../components/AppUpdateModal';
import { useUpdateStore } from '../lib/stores/updateStore';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'POCKETWISE_OFFLINE_CACHE_V1',
  throttleTime: 1000,
});

/**
 * Guard scheduleOfflineSummaryAlarms so it runs at most once per calendar day.
 * Prevents duplicate pending notifications from being stacked on every app open.
 */
async function scheduleSummaryAlarmsOnce() {
  try {
    const TODAY_KEY = 'pocketwise_summary_alarm_date';
    const today = new Date().toISOString().substring(0, 10); // e.g. "2026-09-11"
    const lastScheduled = await AsyncStorage.getItem(TODAY_KEY);
    if (lastScheduled === today) return; // Already scheduled today
    await financialAnalyticsEngine.scheduleOfflineSummaryAlarms();
    await AsyncStorage.setItem(TODAY_KEY, today);
  } catch (err) {
    console.warn('[Layout] Failed to schedule summary alarms:', err);
  }
}

function GlobalRealtimeSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Start global native SMS listener immediately on app boot
    smsListenerService.startListening();

    // Idempotently initialize OS notification channels & permissions
    notificationService.init();

    // Schedule daily summary notification (guarded: once per day max)
    scheduleSummaryAlarmsOnce();

    // Register notification response listener for deep linking when clicking phone tray notifications
    const cleanupListener = deepLinkService.registerNotificationListener();
    deepLinkService.checkColdStartNotification();

    // Silently check for live app updates in background (4h cooldown)
    const updateTimer = setTimeout(() => {
      useUpdateStore.getState().checkForUpdates(false).catch(() => {});
    }, 4000);

    // Setup FCM Push Notification Listeners for live & background updates
    let unsubscribeFcm: (() => void) | undefined;
    let unsubscribeFcmOpen: (() => void) | undefined;

    try {
      const messaging = require('@react-native-firebase/messaging').default;

      // 1. Foreground FCM message listener
      unsubscribeFcm = messaging().onMessage(async (remoteMessage: any) => {
        const data = remoteMessage?.data || {};
        const notification = remoteMessage?.notification;

        const isUpdate =
          data.type === 'app_update' ||
          data.update === 'true' ||
          notification?.title?.toLowerCase().includes('update') ||
          notification?.body?.toLowerCase().includes('update');

        if (isUpdate) {
          const version = data.version || data.tag_name || '';
          // Trigger the update store to fetch and prompt modal
          useUpdateStore.getState().checkForUpdates(true).catch(() => {});

          // Display a high priority system alert in Android notification tray
          await notificationService.sendSystemAlert({
            id: `fcm_update_${Date.now()}`,
            category: 'system',
            title: notification?.title || 'PocketWise Update Available 🚀',
            body: notification?.body || (version ? `PocketWise v${version} is ready. Tap to install.` : 'A new update is available. Tap to install.'),
            priority: 'high',
            data: { type: 'app_update', version },
          }).catch(() => {});
        }
      });

      // 2. Notification opened app from background (user tapped FCM tray notification)
      unsubscribeFcmOpen = messaging().onNotificationOpenedApp((remoteMessage: any) => {
        const data = remoteMessage?.data || {};
        const notification = remoteMessage?.notification;
        const isUpdate =
          data.type === 'app_update' ||
          data.type === 'update' ||
          data.update === 'true' ||
          notification?.title?.toLowerCase().includes('update');

        if (isUpdate) {
          deepLinkService.triggerAppUpdateFlow();
        } else if (data.type || data.route) {
          deepLinkService.handleNotificationResponse({
            notification: { request: { content: { data } } },
          });
        }
      });

      // 3. Initial notification (app opened from killed state by tapping FCM notification)
      messaging()
        .getInitialNotification()
        .then((remoteMessage: any) => {
          if (remoteMessage) {
            const data = remoteMessage?.data || {};
            const notification = remoteMessage?.notification;
            const isUpdate =
              data.type === 'app_update' ||
              data.type === 'update' ||
              data.update === 'true' ||
              notification?.title?.toLowerCase().includes('update');

            if (isUpdate) {
              setTimeout(() => {
                deepLinkService.triggerAppUpdateFlow();
              }, 1000);
            } else if (data.type || data.route) {
              setTimeout(() => {
                deepLinkService.handleNotificationResponse({
                  notification: { request: { content: { data } } },
                });
              }, 1000);
            }
          }
        })
        .catch(() => {});
    } catch {
      // Firebase messaging unavailable on web/mock
    }

    // Handle deep links like pocketwise://more?update=true or pocketwise://update
    const handleDeepLinkUrl = (event: { url: string }) => {
      const url = event?.url || '';
      if (url.includes('update') || url.includes('app_update')) {
        deepLinkService.triggerAppUpdateFlow();
      }
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && (initialUrl.includes('update') || initialUrl.includes('app_update'))) {
        setTimeout(() => {
          deepLinkService.triggerAppUpdateFlow();
        }, 1000);
      }
    }).catch(() => {});

    const linkingSub = Linking.addEventListener('url', handleDeepLinkUrl);

    if (!user?.id) return () => {
      clearTimeout(updateTimer);
      if (cleanupListener) cleanupListener();
      if (unsubscribeFcm) unsubscribeFcm();
      if (unsubscribeFcmOpen) unsubscribeFcmOpen();
      linkingSub.remove();
    };

    // Force revalidation of all queries whenever an authenticated user session mounts
    queryClient.invalidateQueries();

    // Listen to real-time postgres changes across all financial tables for the user
    const channel = supabase
      .channel('realtime_financial_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          queryClient.invalidateQueries();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(updateTimer);
      if (cleanupListener) cleanupListener();
      if (unsubscribeFcm) unsubscribeFcm();
      if (unsubscribeFcmOpen) unsubscribeFcmOpen();
      linkingSub.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}

function RootSplashOverlay() {
  const { loading: authLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide OS native splash screen once our React AnimatedSplashScreen is painted
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleAnimationComplete = React.useCallback(() => {
    // The splash container is already completely faded out (opacity 0) and pointerEvents is none.
    // We delay unmounting by 1200ms so that React does NOT unmount or garbage-collect views
    // during the visual handoff to the Dashboard!
    setTimeout(() => {
      setShowSplash(false);
    }, 1200);
  }, []);

  if (!showSplash) {
    return null;
  }

  return (
    <AnimatedSplashScreen
      isReady={!authLoading}
      onAnimationComplete={handleAnimationComplete}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.rootGestureHandler}>
      <View style={styles.webOuterContainer}>
        <View style={styles.mobileViewport}>
          <SafeAreaProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: asyncStoragePersister,
                maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days offline persistence
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) => query.state.status === 'success',
                },
              }}
            >
              <AuthProvider>
                <AppLockGate>
                  <GlobalRealtimeSync />
                  <StatusBar style="dark" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: '#FAF8FD' },
                      animation: 'none',
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="shake-settings" />
                    <Stack.Screen name="sms-settings" />
                    <Stack.Screen name="notification-settings" />
                    <Stack.Screen name="bills" />
                    <Stack.Screen name="goals" />
                    <Stack.Screen name="reports" />
                    <Stack.Screen name="lends" />
                  </Stack>
                  {/* QuickExpenseModal is a screen-agnostic overlay — rendered after Stack so it floats above all screens */}
                  <QuickExpenseModal />

                  {/* In-App APK Live Update Modal */}
                  <AppUpdateModal />
                </AppLockGate>

                {/* Seamless Animated Splash Screen Overlay: mounts immediately, covers route loading */}
                <RootSplashOverlay />
              </AuthProvider>
            </PersistQueryClientProvider>
          </SafeAreaProvider>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootGestureHandler: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#09090C' : '#FAF8FD',
  },
  webOuterContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: Platform.OS === 'web' ? '#09090C' : '#FAF8FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileViewport: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 440 : undefined,
    height: '100%',
    backgroundColor: '#FAF8FD',
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? {
          // Sleek bezel/shadow on desktop browser viewports
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.55), 0 20px 40px rgba(0, 0, 0, 0.35)',
        }
      : {}),
  },
});

