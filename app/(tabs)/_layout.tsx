import React, { useState, useCallback } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import DashboardScreen from './index';
import TransactionsScreen from './transactions';
import SubscriptionsScreen from './subscriptions';
import BudgetsScreen from './budgets';
import MoreScreen from './more';
import { CustomBottomTabBar } from '../../components/CustomBottomTabBar';

const SCREENS = [
  { key: 'index', name: 'index', label: 'Dashboard', Component: DashboardScreen },
  { key: 'transactions', name: 'transactions', label: 'Transactions', Component: TransactionsScreen },
  { key: 'subscriptions', name: 'subscriptions', label: 'Subscriptions', Component: SubscriptionsScreen },
  { key: 'budgets', name: 'budgets', label: 'Budgets', Component: BudgetsScreen },
  { key: 'more', name: 'more', label: 'More', Component: MoreScreen },
];

export default function TabLayout() {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(() => new Set([0, 1]));

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const activeIndexShared = useSharedValue(0);

  const onTabChanged = useCallback((index: number) => {
    setActiveIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisitedTabs((prev) => {
      const next = new Set(prev);
      next.add(index);
      if (index > 0) next.add(index - 1);
      if (index < SCREENS.length - 1) next.add(index + 1);
      return next;
    });
  }, []);

  const goToTab = useCallback((index: number) => {
    activeIndexShared.value = index;
    setActiveIndex(index);
    setVisitedTabs((prev) => {
      const next = new Set(prev);
      next.add(index);
      if (index > 0) next.add(index - 1);
      if (index < SCREENS.length - 1) next.add(index + 1);
      return next;
    });
    translateX.value = withSpring(-index * screenWidth, {
      damping: 24,
      stiffness: 240,
      mass: 0.6,
      overshootClamping: false,
    });
  }, [screenWidth, activeIndexShared, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const rawOffset = startX.value + e.translationX;
      const maxOffset = 0;
      const minOffset = -((SCREENS.length - 1) * screenWidth);

      // WhatsApp-style subtle rubberband resistance at boundaries
      if (rawOffset > maxOffset) {
        translateX.value = maxOffset + (rawOffset - maxOffset) * 0.2;
      } else if (rawOffset < minOffset) {
        translateX.value = minOffset + (rawOffset - minOffset) * 0.2;
      } else {
        translateX.value = rawOffset;
      }
    })
    .onEnd((e) => {
      'worklet';
      const offset = translateX.value;
      const currentIndex = activeIndexShared.value;
      let targetIndex = Math.round(-offset / screenWidth);

      // Fling velocity recognition for natural flick transitions
      if (e.velocityX < -450 && targetIndex <= currentIndex) {
        targetIndex = Math.min(currentIndex + 1, SCREENS.length - 1);
      } else if (e.velocityX > 450 && targetIndex >= currentIndex) {
        targetIndex = Math.max(currentIndex - 1, 0);
      }

      targetIndex = Math.max(0, Math.min(targetIndex, SCREENS.length - 1));
      activeIndexShared.value = targetIndex;

      translateX.value = withSpring(-targetIndex * screenWidth, {
        damping: 24,
        stiffness: 240,
        mass: 0.6,
        overshootClamping: false,
      });

      runOnJS(onTabChanged)(targetIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bottomTabBarProps = {
    state: {
      index: activeIndex,
      routes: SCREENS.map((s) => ({ key: s.key, name: s.name })),
    },
    navigation: {
      emit: () => ({ defaultPrevented: false }),
      navigate: (name: string) => {
        const targetIdx = SCREENS.findIndex((s) => s.name === name);
        if (targetIdx !== -1) {
          goToTab(targetIdx);
        }
      },
    },
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.pagerContainer,
            { width: screenWidth * SCREENS.length },
            animatedStyle,
          ]}
        >
          {SCREENS.map((screen, index) => {
            const isVisited = visitedTabs.has(index);
            const ScreenComponent = screen.Component;

            return (
              <View key={screen.key} style={[styles.screenWrapper, { width: screenWidth }]}>
                {isVisited ? (
                  <ScreenComponent />
                ) : (
                  <View style={styles.screenPlaceholder} />
                )}
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>

      {/* Floating Bottom Tab Bar */}
      <CustomBottomTabBar {...bottomTabBarProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  pagerContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  screenWrapper: {
    flex: 1,
    height: '100%',
  },
  screenPlaceholder: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
});
