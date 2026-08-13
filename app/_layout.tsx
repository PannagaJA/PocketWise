import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLockGate } from '../components/AppLockGate';
import { deepLinkService } from '../lib/notifications/deep-link.service';
import { notificationService } from '../lib/notifications/notification.service';
import { financialAnalyticsEngine } from '../lib/finance/analyticsEngine';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { supabase } from '../lib/supabase';
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

function GlobalRealtimeSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Start global native SMS listener immediately on app boot
    smsListenerService.startListening();

    // Idempotently initialize OS notification channels & permissions
    notificationService.init();
    financialAnalyticsEngine.scheduleOfflineSummaryAlarms();

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLockGate>
          <GlobalRealtimeSync />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </AppLockGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
