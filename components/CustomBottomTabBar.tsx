import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LayoutDashboard, ArrowLeftRight, CreditCard, PieChart, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface CustomBottomTabBarProps {
  state?: any;
  descriptors?: any;
  navigation?: any;
  insets?: any;
}

const TABS = [
  { name: 'index', label: 'Dashboard', icon: LayoutDashboard },
  { name: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { name: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { name: 'budgets', label: 'Budgets', icon: PieChart },
  { name: 'more', label: 'More', icon: User },
];

interface TabItemProps {
  tab: (typeof TABS)[0];
  isFocused: boolean;
  onPress: () => void;
}

const TabBarItem = memo(function TabBarItem({ tab, isFocused, onPress }: TabItemProps) {
  const Icon = tab.icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItem}
    >
      <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
        <Icon
          size={20}
          color={isFocused ? '#09090B' : '#71717A'}
          strokeWidth={isFocused ? 2.5 : 2}
        />
      </View>

      <Text style={[styles.tabLabel, isFocused ? styles.activeTabLabel : styles.inactiveTabLabel]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
});

export const CustomBottomTabBar = memo(function CustomBottomTabBar({
  state,
  navigation,
}: CustomBottomTabBarProps = {}) {
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

  const currentIndex = state?.index ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          const routeIndex = state?.routes?.findIndex((r: any) => r.name === tab.name) ?? -1;
          const targetIndex = routeIndex !== -1 ? routeIndex : index;
          const isFocused = currentIndex === targetIndex;
          return (
            <TabBarItem
              key={tab.name}
              tab={tab}
              isFocused={isFocused}
              onPress={() => handleTabPress(targetIndex, isFocused)}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  iconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeIconContainer: {
    backgroundColor: '#F4F4F5',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  activeTabLabel: {
    fontWeight: '700',
    color: '#09090B',
  },
  inactiveTabLabel: {
    fontWeight: '500',
    color: '#71717A',
  },
});
