import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabStore } from '../stores/tabStore';

/**
 * Hook to handle back navigation (both header button and Android hardware back button)
 * for subpages opened from the "More" tab (tab index 4).
 * Ensures navigation reliably returns to the More tab instead of the Dashboard.
 */
export function useModuleBack(targetTabIndex = 4) {
  const router = useRouter();

  const goBackToModule = () => {
    // Request tab store to activate target tab (More = 4)
    useTabStore.getState().requestScrollToTab(targetTabIndex);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      goBackToModule();
      return true; // handled, prevent bubbling to Dashboard
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [targetTabIndex]);

  return goBackToModule;
}
