import React, { useRef, useState, useEffect } from 'react';
import { View, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { CustomBottomTabBar } from '../../components/CustomBottomTabBar';
import DashboardScreen from './index';
import TransactionsScreen from './transactions';
import SubscriptionsScreen from './subscriptions';
import BudgetsScreen from './budgets';
import MoreScreen from './more';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_NAMES = ['index', 'transactions', 'subscriptions', 'budgets', 'more'];

export default function TabLayout() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pathname = usePathname();

  // Sync route changes with active index if triggered externally within tab routes
  useEffect(() => {
    let idx = -1;
    if (pathname.includes('/transactions')) idx = 1;
    else if (pathname.includes('/subscriptions')) idx = 2;
    else if (pathname.includes('/budgets')) idx = 3;
    else if (pathname.includes('/more')) idx = 4;
    else if (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/') {
      // Preserve activeIndex when returning to tabs root (Dashboard stays Dashboard, Profile stays Profile)
      idx = activeIndex;
    }

    // Only scroll/switch tabs if pathname actually matches one of the tab screens
    if (idx !== -1 && idx !== activeIndex) {
      const isAdjacent = Math.abs(idx - activeIndex) === 1;
      setActiveIndex(idx);
      scrollViewRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: isAdjacent });
    }
  }, [pathname]);

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
        const isAdjacent = Math.abs(idx - activeIndex) === 1;
        setActiveIndex(idx); // Instant 100% stable highlight!
        scrollViewRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: isAdjacent });
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
