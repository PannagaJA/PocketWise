import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ChevronLeft, Bell, Shield, Moon, DollarSign, Wallet, TrendingUp, Calendar, Target } from 'lucide-react-native';
import { notificationEngine, NotificationPreferenceState } from '../lib/notifications/notification.engine';
import { notificationService } from '../lib/notifications/notification.service';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferenceState | null>(null);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    const p = await notificationEngine.getPreferences();
    setPrefs(p);
  };

  const updatePref = async (key: keyof NotificationPreferenceState, value: any) => {
    if (!prefs) return;
    const updated = await notificationEngine.savePreferences({ [key]: value });
    setPrefs(updated);
  };

  if (!prefs) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-zinc-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ChevronLeft size={24} color="#09090B" />
        </Pressable>
        <View>
          <Text className="text-lg font-extrabold text-zinc-900">Notification Preferences</Text>
          <Text className="text-xs text-zinc-500">Manage external Android system alerts</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Master Switch Card */}
        <Card className="mb-6 p-5 bg-white border border-zinc-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
                <Bell size={22} color="#6366F1" />
              </View>
              <View>
                <Text className="text-base font-bold text-zinc-900">Allow System Notifications</Text>
                <Text className="text-xs text-zinc-500">Master push toggle for PocketWise</Text>
              </View>
            </View>
            <Switch
              value={prefs.allNotifications}
              onValueChange={(val) => updatePref('allNotifications', val)}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>
        </Card>

        {/* Category Controls */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Notification Categories</Text>
        <Card className="mb-6 p-0 bg-white border border-zinc-200 divide-y divide-zinc-100">
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Wallet size={18} color="#10B981" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Transaction Alerts</Text>
                <Text className="text-xs text-zinc-500">Income, expenses & large transactions</Text>
              </View>
            </View>
            <Switch
              value={prefs.transactions}
              onValueChange={(val) => updatePref('transactions', val)}
              trackColor={{ false: '#E4E4E7', true: '#10B981' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-amber-50 items-center justify-center mr-3">
                <Calendar size={18} color="#F59E0B" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Upcoming Bills</Text>
                <Text className="text-xs text-zinc-500">Bill due date alerts & warnings</Text>
              </View>
            </View>
            <Switch
              value={prefs.bills}
              onValueChange={(val) => updatePref('bills', val)}
              trackColor={{ false: '#E4E4E7', true: '#F59E0B' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Calendar size={18} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Subscription Renewals</Text>
                <Text className="text-xs text-zinc-500">Renewal alerts before payment date</Text>
              </View>
            </View>
            <Switch
              value={prefs.subscriptions}
              onValueChange={(val) => updatePref('subscriptions', val)}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-rose-50 items-center justify-center mr-3">
                <DollarSign size={18} color="#EF4444" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Budget Limits & Warnings</Text>
                <Text className="text-xs text-zinc-500">80% warning & 100% exceeded alerts</Text>
              </View>
            </View>
            <Switch
              value={prefs.budgets}
              onValueChange={(val) => updatePref('budgets', val)}
              trackColor={{ false: '#E4E4E7', true: '#EF4444' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Target size={18} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Savings Milestones</Text>
                <Text className="text-xs text-zinc-500">Goal completion & savings updates</Text>
              </View>
            </View>
            <Switch
              value={prefs.savings}
              onValueChange={(val) => updatePref('savings', val)}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <TrendingUp size={18} color="#A855F7" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Financial Insights & Analytics</Text>
                <Text className="text-xs text-zinc-500">Spending rate & category breakdowns</Text>
              </View>
            </View>
            <Switch
              value={prefs.analytics}
              onValueChange={(val) => updatePref('analytics', val)}
              trackColor={{ false: '#E4E4E7', true: '#A855F7' }}
            />
          </View>
        </Card>

        {/* Quiet Hours */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Quiet Hours</Text>
        <Card className="mb-6 p-4 bg-white border border-zinc-200">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-zinc-100 items-center justify-center mr-3">
                <Moon size={18} color="#71717A" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Enable Quiet Hours</Text>
                <Text className="text-xs text-zinc-500">Suppress non-critical alerts (22:00 - 07:00)</Text>
              </View>
            </View>
            <Switch
              value={prefs.quietHoursEnabled}
              onValueChange={(val) => updatePref('quietHoursEnabled', val)}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
