import { Tabs } from 'expo-router';
import React from 'react';
import { CustomBottomTabBar } from '../../components/CustomBottomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
