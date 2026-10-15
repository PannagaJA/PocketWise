import { useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTabStore } from '../stores/tabStore';

/**
 * Pure helper function to resolve which tab index to return to.
 * Prioritizes route params (from: 'dashboard' -> 0, from: 'more' -> 4, or explicit fromTab),
 * then falls back to current activeTabIndex in tabStore, and finally defaultTabIndex.
 */
export function resolveModuleBackTab(
  params?: { from?: string | string[]; fromTab?: string | string[] },
  activeTabIndex?: number,
  fallbackTabIndex = 4
): number {
  const rawFrom = Array.isArray(params?.from) ? params?.from[0] : params?.from;
  const rawFromTab = Array.isArray(params?.fromTab) ? params?.fromTab[0] : params?.fromTab;

  if (rawFrom === 'dashboard') {
    return 0;
  }
  if (rawFrom === 'more') {
    return 4;
  }
  if (rawFromTab !== undefined) {
    const parsed = parseInt(rawFromTab, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 4) {
      return parsed;
    }
  }
  if (typeof activeTabIndex === 'number' && activeTabIndex >= 0 && activeTabIndex <= 4) {
    return activeTabIndex;
  }
  return fallbackTabIndex;
}

/**
 * Hook to handle back navigation (both header button and Android hardware back button)
 * for subpages opened either from the "Dashboard" (tab index 0) or the "More" tab (tab index 4).
 *
 * If the screen was navigated to with `params: { from: 'dashboard' }`, it returns to Dashboard (tab 0).
 * If navigated to with `params: { from: 'more' }`, it returns to More (tab 4).
 * If neither is explicitly provided, it respects the active tab in `tabStore` or fallbackTabIndex.
 */
export function useModuleBack(defaultTabIndex?: number) {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; fromTab?: string }>();
  const activeTabIndex = useTabStore((s) => s.activeTabIndex);

  const resolvedTabIndex = resolveModuleBackTab(params, activeTabIndex, defaultTabIndex ?? 4);

  const goBackToModule = useCallback(() => {
    // Request tab store to activate target tab (Dashboard = 0, More = 4)
    useTabStore.getState().requestScrollToTab(resolvedTabIndex);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/');
    }
  }, [router, resolvedTabIndex]);

  useEffect(() => {
    const onBackPress = () => {
      goBackToModule();
      return true; // handled, prevent bubbling to Dashboard incorrectly
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [goBackToModule]);

  return goBackToModule;
}

