import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Pressable, Modal, BackHandler, Alert, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useAppLock } from '../../components/AppLockGate';
import { accountService } from '../../lib/services/account.service';
import { transactionService } from '../../lib/services/transaction.service';
import { billService } from '../../lib/services/bill.service';
import { goalService } from '../../lib/services/goal.service';
import { reminderService, Reminder } from '../../lib/services/reminder.service';
import { financialAnalyticsEngine } from '../../lib/finance/analyticsEngine';
import { formatMoney, formatDate, formatDateTime } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet, Calendar, Target, ChevronRight, ShieldCheck, TrendingUp, TrendingDown, ArrowRightLeft, X, Clock, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { SmsOnboardingModal } from '../../components/SmsOnboardingCard';
import { SmsTransactionReviewModal } from '../../components/SmsTransactionReviewModal';
import { smsStorage } from '../../lib/sms/storage/smsStore';
import { smsListenerService } from '../../lib/sms/service/smsListenerService';
import { ParsedSmsTransaction } from '../../lib/sms/types';
import { NetBalanceChartCard } from '../../components/NetBalanceChartCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function SwipeableNotificationItem({
  item,
  onDismiss,
}: {
  item: Reminder;
  onDismiss: (id: string) => void;
}) {
  const isDismissedRef = useRef(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    if ((offsetX < 70 || offsetX > 230) && !isDismissedRef.current) {
      isDismissedRef.current = true;
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      if (item.id) onDismiss(item.id);
    }
  };

  return (
    <View className="mb-3 overflow-hidden rounded-2xl">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: 150, y: 0 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        decelerationRate="fast"
      >
        {/* Left Transparent Spacer */}
        <View className="w-[150px] bg-transparent" />

        {/* Main Clean Full-Width Notification Card Container */}
        <View
          style={{ width: SCREEN_WIDTH - 48 }}
          className="p-4 bg-white rounded-2xl shadow-sm border border-zinc-200 justify-between"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              <View className="w-7 h-7 rounded-xl bg-indigo-50 items-center justify-center">
                <Bell size={14} color="#6366F1" />
              </View>
              <Text className="text-sm font-extrabold text-zinc-900 flex-1" numberOfLines={1}>
                {item.title}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-full">
              <Clock size={11} color="#71717A" />
              <Text className="text-[10px] font-bold text-zinc-600">{formatDateTime(item.scheduled_at)}</Text>
            </View>
          </View>

          <Text className="text-xs text-zinc-600 leading-relaxed pl-0.5">{item.body}</Text>
        </View>

        {/* Right Transparent Spacer */}
        <View className="w-[150px] bg-transparent" />
      </ScrollView>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isLocked } = useAppLock();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [smsOnboardingVisible, setSmsOnboardingVisible] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<ParsedSmsTransaction[]>([]);
  const [selectedReviewTx, setSelectedReviewTx] = useState<ParsedSmsTransaction | null>(null);

  const checkSmsOnboarding = async () => {
    if (!user?.id || isLocked) return;
    const settings = await smsStorage.getSettings();
    if (!settings.autoTrackingEnabled && !settings.permissionGranted) {
      setSmsOnboardingVisible(true);
    }
    const pending = await smsStorage.getPendingReviews();
    setPendingReviews(pending);
  };

  useEffect(() => {
    if (!user?.id || isLocked) return;
    checkSmsOnboarding();
    smsListenerService.startListening(() => {
      checkSmsOnboarding();
      refetchAcc();
      refetchTx();
    });
  }, [user?.id, isLocked]);

  const { data: accounts = [], isLoading: loadingAcc, refetch: refetchAcc } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: transactions = [], refetch: refetchTx } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => transactionService.getTransactions(user?.id || '', 500),
    enabled: !!user?.id,
  });

  const { data: bills = [], refetch: refetchBills } = useQuery({
    queryKey: ['bills', user?.id],
    queryFn: () => billService.getBills(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: goals = [], refetch: refetchGoals } = useQuery({
    queryKey: ['goals', user?.id],
    queryFn: () => goalService.getGoals(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: reminders = [], refetch: refetchReminders } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: () => reminderService.getReminders(user?.id || ''),
    enabled: !!user?.id,
  });

  // Automatically refresh queries whenever returning to the Dashboard tab
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetchAcc();
        refetchTx();
        refetchBills();
        refetchGoals();
        refetchReminders();

        if (transactions.length > 0) {
          const currentMonth = new Date().toISOString().substring(0, 7);
          const currentMonthTxs = transactions.filter((t) => t.date && t.date.startsWith(currentMonth));
          const prevMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7);
          const prevMonthTxs = transactions.filter((t) => t.date && t.date.startsWith(prevMonth));
          financialAnalyticsEngine.evaluateMonthlyAnalytics(currentMonthTxs, prevMonthTxs);
        }
      }
    }, [user?.id, refetchAcc, refetchTx, refetchBills, refetchGoals, refetchReminders, transactions])
  );



  const upcomingBills = bills.filter((b) => !b.is_paid).slice(0, 3);
  const activeGoals = goals.slice(0, 2);

  // Calculate Net Totals & Realtime Cashflow Trend
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_minor, 0);
  const monthlyExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_minor, 0);



  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Welcome back</Text>
            <Text className="text-2xl font-black text-zinc-900 mt-0.5">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'} 👋
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setNotifModalVisible(true);
            }}
            className="w-10 h-10 bg-white border border-zinc-200 rounded-full items-center justify-center shadow-sm relative"
          >
            <Bell size={18} color="#09090B" />
            {reminders.length > 0 && (
              <View className="w-2.5 h-2.5 bg-indigo-600 rounded-full absolute top-1.5 right-1.5 border border-white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Net Total Balance Interactive Live Growth Chart Card */}
        <NetBalanceChartCard accounts={accounts} transactions={transactions} isLoading={loadingAcc} />

        {/* Pending SMS Transaction Review Alert Banner */}
        {pendingReviews.length > 0 && (
          <Pressable
            onPress={() => setSelectedReviewTx(pendingReviews[0])}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center">
                <Clock size={20} color="#D97706" />
              </View>
              <View>
                <Text className="text-sm font-extrabold text-amber-950">
                  {pendingReviews.length} Transaction{pendingReviews.length > 1 ? 's' : ''} Awaiting Review
                </Text>
                <Text className="text-xs text-amber-800">
                  {pendingReviews[0].bankName}: ₹{pendingReviews[0].amount} • Tap to confirm
                </Text>
              </View>
            </View>
            <View className="px-3 py-1.5 bg-amber-600 rounded-xl">
              <Text className="text-xs font-bold text-white">Review</Text>
            </View>
          </Pressable>
        )}

        {/* Action Buttons */}
        <View className="flex-row gap-3 mb-6">
          <Button
            variant="outline"
            size="md"
            className="flex-1 flex-row items-center justify-center gap-2 bg-white border-zinc-200"
            onPress={() => router.push('/reports' as any)}
          >
            <TrendingUp size={18} color="#09090B" />
            <Text className="text-zinc-900 font-bold text-xs">Analytics</Text>
          </Button>

          <Button
            variant="primary"
            size="md"
            className="flex-1 flex-row items-center justify-center gap-2"
            onPress={() => router.push('/(tabs)/transactions' as any)}
          >
            <Plus size={18} color="#FFF" />
            <Text className="text-white font-bold text-xs">Add Transaction</Text>
          </Button>
        </View>

        {/* Recent 5 Transactions Widget */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(tabs)/transactions' as any)}>
              <Text className="text-xs font-bold text-indigo-600">See All</Text>
            </Pressable>
          </View>
          {transactions.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center rounded-2xl">
              <Text className="text-sm font-semibold text-zinc-700">No recent transactions</Text>
              <Text className="text-xs text-zinc-400 mt-0.5 mb-3 text-center">Your latest 5 financial activities will show here.</Text>
              <Button size="sm" variant="primary" onPress={() => router.push('/(tabs)/transactions' as any)}>
                <Text className="text-white font-semibold text-xs">Add Transaction</Text>
              </Button>
            </Card>
          ) : (
            transactions.slice(0, 5).map((tx) => (
              <Card key={tx.id} className="mb-2.5 p-3.5 bg-white border border-zinc-200 rounded-2xl">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                      tx.type === 'income' ? 'bg-emerald-50' : tx.type === 'expense' ? 'bg-rose-50' : 'bg-indigo-50'
                    }`}>
                      {tx.type === 'income' ? (
                        <ArrowDownLeft size={18} color="#10B981" />
                      ) : tx.type === 'expense' ? (
                        <ArrowUpRight size={18} color="#EF4444" />
                      ) : (
                        <ArrowRightLeft size={18} color="#6366F1" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>{tx.description}</Text>
                      <Text className="text-[11px] text-zinc-500 mt-0.5">
                        {tx.category?.name || 'General'} • {tx.account?.name || 'Account'}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className={`text-sm font-extrabold ${
                      tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-zinc-900' : 'text-indigo-600'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatMoney(tx.amount_minor)}
                    </Text>
                    <Text className="text-[10px] text-zinc-400 mt-0.5">{formatDate(tx.date)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Upcoming Bills Widget */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Upcoming Bills</Text>
            <Pressable onPress={() => router.push('/bills')}>
              <Text className="text-xs font-bold text-indigo-600">See All</Text>
            </Pressable>
          </View>
          {upcomingBills.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center rounded-2xl">
              <View className="w-12 h-12 rounded-full bg-amber-50 items-center justify-center mb-2">
                <ShieldCheck size={24} color="#F59E0B" />
              </View>
              <Text className="text-sm font-bold text-zinc-800">All caught up!</Text>
              <Text className="text-xs text-zinc-400 mt-0.5">No upcoming pending bills due soon.</Text>
            </Card>
          ) : (
            upcomingBills.map((b) => (
              <Card key={b.id} className="mb-2.5 p-4 bg-white border border-zinc-200 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center mr-3">
                    <Calendar size={18} color="#F59E0B" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-zinc-900">{b.name}</Text>
                    <Text className="text-xs text-zinc-400">Due {formatDate(b.due_date)}</Text>
                  </View>
                </View>
                <Text className="text-sm font-extrabold text-zinc-900">{formatMoney(b.expected_amount_minor)}</Text>
              </Card>
            ))
          )}
        </View>

        {/* Savings Goals Summary Widget */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Savings Goals</Text>
            <Pressable onPress={() => router.push('/goals')}>
              <Text className="text-xs font-bold text-indigo-600">See All</Text>
            </Pressable>
          </View>
          {activeGoals.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center rounded-2xl">
              <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mb-2">
                <Target size={24} color="#6366F1" />
              </View>
              <Text className="text-sm font-bold text-zinc-800">No active goals</Text>
              <Text className="text-xs text-zinc-400 mt-0.5">Create a target goal to start saving!</Text>
            </Card>
          ) : (
            activeGoals.map((g) => {
              const pct = g.target_amount_minor > 0
                ? Math.min(100, Math.round((g.current_amount_minor / g.target_amount_minor) * 100))
                : 0;
              return (
                <Card key={g.id} className="mb-2.5 p-4 bg-white border border-zinc-200">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center mr-2.5">
                        <Target size={16} color="#6366F1" />
                      </View>
                      <Text className="text-sm font-bold text-zinc-900">{g.name}</Text>
                    </View>
                    <Text className="text-xs font-black text-indigo-600">{pct}%</Text>
                  </View>
                  <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <View className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Notifications Drawer Modal */}
      <Modal visible={notifModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                  <Bell size={18} color="#6366F1" />
                </View>
                <View>
                  <Text className="text-xl font-extrabold text-zinc-900">Notifications</Text>
                  <Text className="text-xs text-zinc-500">Recent push alerts & reminders</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                {reminders.length > 0 && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (user?.id) {
                        await reminderService.clearAllReminders(user.id);
                        refetchReminders();
                      }
                    }}
                    className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200"
                  >
                    <Text className="text-xs font-bold text-rose-600">Clear All</Text>
                  </TouchableOpacity>
                )}
                <Pressable
                  onPress={() => setNotifModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
                >
                  <X size={18} color="#71717A" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              {reminders.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-12 h-12 rounded-full bg-zinc-100 items-center justify-center mb-2">
                    <Bell size={22} color="#A1A1AA" />
                  </View>
                  <Text className="text-sm font-bold text-zinc-800">No recent notifications</Text>
                  <Text className="text-xs text-zinc-400 mt-1 text-center">Your upcoming bill & budget push notifications will appear here.</Text>
                </View>
              ) : (
                reminders.map((r) => (
                  <SwipeableNotificationItem
                    key={r.id}
                    item={r}
                    onDismiss={async (id) => {
                      await reminderService.deleteReminder(id);
                      refetchReminders();
                    }}
                  />
                ))
              )}
            </ScrollView>

            <Button
              variant="outline"
              size="md"
              className="border-zinc-200"
              onPress={() => setNotifModalVisible(false)}
            >
              <Text className="text-zinc-800 font-bold text-xs">Close</Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* SMS Onboarding Modal */}
      <SmsOnboardingModal
        visible={smsOnboardingVisible && !!user?.id && !isLocked}
        onClose={() => setSmsOnboardingVisible(false)}
        onEnabled={() => checkSmsOnboarding()}
      />

      {/* SMS Pending Review Modal */}
      <SmsTransactionReviewModal
        visible={!!selectedReviewTx}
        transaction={selectedReviewTx}
        onClose={() => setSelectedReviewTx(null)}
        onConfirm={() => {
          setSelectedReviewTx(null);
          checkSmsOnboarding();
          refetchTx();
        }}
      />
    </SafeAreaView>
  );
}
