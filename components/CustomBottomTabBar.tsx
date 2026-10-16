import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  Home,
  ArrowLeftRight,
  CreditCard,
  PieChart,
  User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface CustomBottomTabBarProps {
  state?: any;
  descriptors?: any;
  navigation?: any;
  insets?: any;
}

const TABS = [
  { name: 'index', label: 'Dashboard', icon: Home },
  { name: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { name: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { name: 'budgets', label: 'Budgets', icon: PieChart },
  { name: 'more', label: 'More', icon: User },
];

// Exact geometric symmetry: 5 slots of 56px each = 280px pill dock
const SLOT_WIDTH = 56;
const DOCK_HEIGHT = 56;
const DOCK_WIDTH = SLOT_WIDTH * TABS.length; // 280px
const INDICATOR_SIZE = 44;
const TOP_OFFSET = (DOCK_HEIGHT - INDICATOR_SIZE) / 2; // 6px
const LEFT_OFFSET = (SLOT_WIDTH - INDICATOR_SIZE) / 2; // 6px

interface TabBarSlotProps {
  tab: (typeof TABS)[0];
  isFocused: boolean;
  onPress: () => void;
}

const TabBarSlot = memo(function TabBarSlot({
  tab,
  isFocused,
  onPress,
}: TabBarSlotProps) {
  const Icon = tab.icon;
  const pressScale = useSharedValue(1);
  const activeScale = useSharedValue(isFocused ? 1 : 0.94);

  useEffect(() => {
    if (isFocused) {
      activeScale.value = withSpring(1, { damping: 14, stiffness: 300 });
    } else {
      activeScale.value = withTiming(0.94, { duration: 120 });
    }
  }, [isFocused, activeScale]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * activeScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.88, { duration: 70 });
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 340 });
  }, [pressScale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isFocused }}
      style={styles.slot}
    >
      <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
        <Icon
          size={20}
          color={isFocused ? '#09090B' : '#CBD5E1'}
          strokeWidth={isFocused ? 2.3 : 1.9}
          style={{ opacity: isFocused ? 1 : 0.78 }}
        />
      </Animated.View>
    </Pressable>
  );
});

export const CustomBottomTabBar = memo(function CustomBottomTabBar({
  state,
  navigation,
}: CustomBottomTabBarProps = {}) {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const currentIndex = state?.index ?? 0;

  // Exact target X calculation: concentric with semicircular caps and aligned with slot centers
  const getTargetX = useCallback((idx: number) => {
    return idx * SLOT_WIDTH + LEFT_OFFSET;
  }, []);

  const indicatorX = useSharedValue(getTargetX(currentIndex));
  const keyboardTranslateY = useSharedValue(0);
  const keyboardOpacity = useSharedValue(1);

  // Buttery-smooth spring glide when active tab changes
  useEffect(() => {
    indicatorX.value = withSpring(getTargetX(currentIndex), {
      damping: 20,
      stiffness: 280,
      mass: 0.55,
    });
  }, [currentIndex, getTargetX, indicatorX]);

  // Dismiss smoothly on software keyboard so inputs are never covered
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        keyboardTranslateY.value = withTiming(100, { duration: 180 });
        keyboardOpacity.value = withTiming(0, { duration: 140 });
      }
    );

    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        keyboardTranslateY.value = withTiming(0, { duration: 220 });
        keyboardOpacity.value = withTiming(1, { duration: 180 });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardTranslateY, keyboardOpacity]);

  const handleTabPress = useCallback(
    (index: number, isFocused: boolean) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      if (navigation && state) {
        const route = state.routes[index];
        if (route) {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event?.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }
      }
    },
    [navigation, state]
  );

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardTranslateY.value }],
    opacity: keyboardOpacity.value,
  }));

  // Bottom safe-area anchoring: elevates gracefully above home bar or navigation chin
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 6 : Platform.OS === 'ios' ? 20 : 16;

  return (
    <>
      {/* Soft Bottom Scrim: Fades scrolling content smoothly behind the floating dock */}
      <View
        pointerEvents="none"
        style={[
          styles.scrimContainer,
          { opacity: isKeyboardVisible ? 0 : 1 },
        ]}
      >
        <Svg width="100%" height={120}>
          <Defs>
            <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FAF8FD" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#FAF8FD" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#FAF8FD" stopOpacity="0.98" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={120} fill="url(#bottomFade)" />
        </Svg>
      </View>

      {/* Floating Magpie Obsidian Capsule Dock */}
      <Animated.View
        pointerEvents={isKeyboardVisible ? 'none' : 'auto'}
        style={[
          styles.wrapper,
          { bottom: bottomOffset },
          animatedContainerStyle,
        ]}
      >
        <View style={styles.pillContainer}>
          {/* Subtle Top Specular Glass Reflection */}
          <View pointerEvents="none" style={styles.specularHighlight} />

          {/* Animated Pure Ceramic White Circular Disc (Centric 6px border margin) */}
          <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />

          {/* 5 Perfectly Centered Navigation Slots (56x56 each) */}
          {TABS.map((tab, index) => {
            const routeIndex = state?.routes?.findIndex((r: any) => r.name === tab.name) ?? -1;
            const targetIndex = routeIndex !== -1 ? routeIndex : index;
            const isFocused = currentIndex === targetIndex;

            return (
              <TabBarSlot
                key={tab.name}
                tab={tab}
                isFocused={isFocused}
                onPress={() => handleTabPress(targetIndex, isFocused)}
              />
            );
          })}
        </View>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  scrimContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    zIndex: 9,
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pillContainer: {
    width: DOCK_WIDTH,
    height: DOCK_HEIGHT,
    borderRadius: DOCK_HEIGHT / 2,
    backgroundColor: '#09090C',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 1,
    zIndex: 3,
  },
  indicator: {
    position: 'absolute',
    top: TOP_OFFSET,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1,
  },
  slot: {
    width: SLOT_WIDTH,
    height: DOCK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWrapper: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
