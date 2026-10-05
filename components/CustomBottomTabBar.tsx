import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LayoutDashboard, ArrowLeftRight, CreditCard, PieChart, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useModalStore } from '../lib/stores/modalStore';
import { useTabStore } from '../lib/stores/tabStore';

export interface CustomBottomTabBarProps {
  state?: {
    index: number;
    routes: Array<{
      key: string;
      name: string;
      params?: any;
    }>;
  };
  descriptors?: any;
  navigation?: {
    emit: (event: any) => any;
    navigate: (name: string, params?: any) => void;
  };
  insets?: any;
}

const TABS = [
  { name: 'index', label: 'Dashboard', icon: LayoutDashboard },
  { name: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { name: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { name: 'budgets', label: 'Budgets', icon: PieChart },
  { name: 'more', label: 'More', icon: User },
];

export function CustomBottomTabBar({ state, navigation }: CustomBottomTabBarProps = {}) {
  const isModalOpen = useModalStore((s) => s.activeModalCount > 0);
  const activeTabIndex = useTabStore((s) => s.activeTabIndex);
  const setActiveTabIndex = useTabStore((s) => s.setActiveTabIndex);
  const requestScrollToTab = useTabStore((s) => s.requestScrollToTab);

  if (isModalOpen) {
    return null;
  }

  const currentIndex = state ? state.index : activeTabIndex;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          const isFocused = currentIndex === index;
          const Icon = tab.icon;

          const onPress = () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}

            // INSTANTLY update active state for 0ms latency UI highlight
            setActiveTabIndex(index);
            requestScrollToTab(index);

            if (navigation && state) {
              const route = state.routes[index];
              if (route) {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
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
        })}
      </View>
    </View>
  );
}

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
