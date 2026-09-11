import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLockGate } from '../components/AppLockGate';
import { deepLinkService } from '../lib/notifications/deep-link.service';
import { notificationService } from '../lib/notifications/notification.service';
import { financialAnalyticsEngine } from '../lib/finance/analyticsEngine';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { QuickExpenseModal } from '../components/QuickExpenseModal';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[Query Error] [${query.queryKey.join('/')}]:`, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('[Mutation Error]:', error);
    },
    onSuccess: () => {
      // Invalidate all TanStack Query caches instantly on ANY mutation across the app
      queryClient.invalidateQueries();
    },
  }),
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

    if (!user?.id) return;

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
      supabase.removeChannel(channel);
      if (cleanupListener) cleanupListener();
    };
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppLockGate>
            <GlobalRealtimeSync />
            <StatusBar style="dark" translucent={true} backgroundColor="transparent" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#FAFAFA' },
                animation: 'none',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="shake-settings" />
              <Stack.Screen name="sms-settings" />
              <Stack.Screen name="notification-settings" />
              <Stack.Screen name="bills" />
              <Stack.Screen name="goals" />
              <Stack.Screen name="reports" />
            </Stack>
            {/* QuickExpenseModal is a screen-agnostic overlay — rendered after Stack so it floats above all screens */}
            <QuickExpenseModal />
          </AppLockGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
