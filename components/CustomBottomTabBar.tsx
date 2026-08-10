import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ArrowLeftRight, CreditCard, PieChart, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export function CustomBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const icons: { [key: string]: any } = {
    index: LayoutDashboard,
    transactions: ArrowLeftRight,
    subscriptions: CreditCard,
    budgets: PieChart,
    more: User,
  };

  const labels: { [key: string]: string } = {
    index: 'Dashboard',
    transactions: 'Transactions',
    subscriptions: 'Subscriptions',
    budgets: 'Budgets',
    more: 'More',
  };

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = icons[route.name] || LayoutDashboard;
          const label = labels[route.name] || route.name;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
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
                {label}
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
