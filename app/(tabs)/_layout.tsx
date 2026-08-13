import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, StyleSheet, BackHandler, Modal } from 'react-native';
import { usePathname, useFocusEffect } from 'expo-router';
import { CustomBottomTabBar } from '../../components/CustomBottomTabBar';
import DashboardScreen from './index';
import TransactionsScreen from './transactions';
import SubscriptionsScreen from './subscriptions';
import BudgetsScreen from './budgets';
import MoreScreen from './more';
import { Button } from '../../components/ui/Button';
import { LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_NAMES = ['index', 'transactions', 'subscriptions', 'budgets', 'more'];

export default function TabLayout() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const pathname = usePathname();

  // Sync route changes with active index if triggered externally within tab routes
  useEffect(() => {
    let idx = -1;
    if (pathname.includes('/transactions')) idx = 1;
    else if (pathname.includes('/subscriptions')) idx = 2;
    else if (pathname.includes('/budgets')) idx = 3;
    else if (pathname.includes('/more')) idx = 4;
    else if (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/') {
      // Preserve activeIndex when returning to tabs root
      idx = activeIndex;
    }

    // Only scroll/switch tabs if pathname actually matches one of the tab screens
    if (idx !== -1 && idx !== activeIndex) {
      setActiveIndex(idx);
      scrollViewRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
    }
  }, [pathname]);

  // Hardware Back Button Navigation Handler (Exit App ONLY on Dashboard, otherwise return to Dashboard)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (activeIndex > 0) {
          // On non-Dashboard tabs (More, Budgets, Subscriptions, Transactions): Return to Dashboard
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          setActiveIndex(0);
          scrollViewRef.current?.scrollTo({ x: 0, animated: false });
          return true; // Handled
        } else {
          // On Dashboard tab: Open Beautiful Slide-Up Exit App Bottom Sheet
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
          setExitModalVisible(true);
          return true; // Handled
        }
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [activeIndex])
  );

  // Update active tab ONLY when manual swipe gesture finishes snapping
  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < TAB_NAMES.length && index !== activeIndex) {
      setActiveIndex(index);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  // Bottom Tab Bar Navigation handler: Instantly highlight selected tab without intermediate flickering
  const mockNavigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (routeName: string) => {
      const idx = TAB_NAMES.indexOf(routeName);
      if (idx !== -1 && idx !== activeIndex) {
        setActiveIndex(idx); // Instant 100% stable highlight!
        scrollViewRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
      }
    },
  };

  const mockState = {
    index: activeIndex,
    routes: TAB_NAMES.map((name, i) => ({ key: `tab-${i}`, name })),
  };

  return (
    <View style={styles.container}>
      {/* Real-time WhatsApp-style Horizontal Page Slider */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        decelerationRate="fast"
        bounces={false}
        style={styles.pager}
      >
        <View style={{ width: SCREEN_WIDTH }} className="flex-1">
          <DashboardScreen />
        </View>
        <View style={{ width: SCREEN_WIDTH }} className="flex-1">
          <TransactionsScreen />
        </View>
        <View style={{ width: SCREEN_WIDTH }} className="flex-1">
          <SubscriptionsScreen />
        </View>
        <View style={{ width: SCREEN_WIDTH }} className="flex-1">
          <BudgetsScreen />
        </View>
        <View style={{ width: SCREEN_WIDTH }} className="flex-1">
          <MoreScreen />
        </View>
      </ScrollView>

      {/* Floating Bottom Tab Bar */}
      <CustomBottomTabBar
        state={mockState as any}
        descriptors={{} as any}
        navigation={mockNavigation as any}
        insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      />

      {/* Beautiful Bottom-Sheet Exit App Confirmation Modal */}
      <Modal visible={exitModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 shadow-2xl">
            <View className="items-center my-2">
              <View className="w-14 h-14 rounded-full bg-rose-50 items-center justify-center mb-3.5 border border-rose-100">
                <LogOut size={26} color="#EF4444" />
              </View>
              <Text className="text-xl font-black text-zinc-900 text-center">Exit PocketWise?</Text>
              <Text className="text-xs text-zinc-500 mt-1.5 text-center px-4 leading-relaxed">
                Are you sure you want to close the application? All your financial transactions and goals are safely saved.
              </Text>
            </View>

            <View className="flex-row gap-3 mt-6 mb-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 border-zinc-200 bg-zinc-50"
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setExitModalVisible(false);
                }}
              >
                <Text className="text-zinc-800 font-bold text-sm">Stay in App</Text>
              </Button>

              <Button
                variant="destructive"
                size="lg"
                className="flex-1 bg-rose-600 active:bg-rose-700 shadow-sm"
                onPress={() => {
                  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
                  BackHandler.exitApp();
                }}
              >
                <Text className="text-white font-bold text-sm">Exit App</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  pager: {
    flex: 1,
  },
});
