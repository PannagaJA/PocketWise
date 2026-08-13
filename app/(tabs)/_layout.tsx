import React, { useRef, useState, useEffect } from 'react';
import { View, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
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
  const isNavigatingFromTabRef = useRef(false);

  // Sync external route changes with active index
  useEffect(() => {
    let idx = 0;
    if (pathname.includes('/transactions')) idx = 1;
    else if (pathname.includes('/subscriptions')) idx = 2;
    else if (pathname.includes('/budgets')) idx = 3;
    else if (pathname.includes('/more')) idx = 4;

    if (idx !== activeIndex && !isNavigatingFromTabRef.current) {
      const isAdjacent = Math.abs(idx - activeIndex) === 1;
      setActiveIndex(idx);
      scrollViewRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: isAdjacent });
    }
    isNavigatingFromTabRef.current = false;
  }, [pathname]);

  // Real-time 1:1 Scroll Event Handler (WhatsApp Paging Style)
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < TAB_NAMES.length) {
      setActiveIndex(index);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  // Mock Navigation Prop for CustomBottomTabBar
  const mockNavigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (routeName: string) => {
      const idx = TAB_NAMES.indexOf(routeName);
      if (idx !== -1 && idx !== activeIndex) {
        const isAdjacent = Math.abs(idx - activeIndex) === 1;
        isNavigatingFromTabRef.current = true;
        setActiveIndex(idx);
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
      {/* Real-time 1:1 Interactive WhatsApp-style Horizontal Page Slider */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
