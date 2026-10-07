import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, BackHandler, Alert, Dimensions, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { AppModal } from '../../components/ui/AppModal';
import { useAuth } from '../../context/AuthContext';
import { useAppLock } from '../../components/AppLockGate';
import { accountService, Account } from '../../lib/services/account.service';
import { transactionService, cleanTransactionDescription } from '../../lib/services/transaction.service';
import { billService } from '../../lib/services/bill.service';
import { goalService } from '../../lib/services/goal.service';
import { reminderService, Reminder } from '../../lib/services/reminder.service';
import { financialAnalyticsEngine } from '../../lib/finance/analyticsEngine';
import { formatMoney, formatDate, formatDateTime, parseSignedMoneyToMinor } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet, Calendar, Target, ChevronRight, ChevronDown, Check, Building2, ShieldCheck, TrendingUp, TrendingDown, ArrowRightLeft, X, Clock, Trash2, LogOut, Pencil, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { SmsOnboardingModal } from '../../components/SmsOnboardingCard';
import { SmsTransactionReviewModal } from '../../components/SmsTransactionReviewModal';
import { RecordTransactionModal } from '../../components/RecordTransactionModal';
import { smsStorage } from '../../lib/sms/storage/smsStore';
import { smsListenerService } from '../../lib/sms/service/smsListenerService';
import { ParsedSmsTransaction } from '../../lib/sms/types';
import { NetBalanceChartCard } from '../../components/NetBalanceChartCard';

import { shakeService } from '../../lib/shake/shakeService';

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
  const queryClient = useQueryClient();

  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [bankSelectModalVisible, setBankSelectModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [recordTxModalVisible, setRecordTxModalVisible] = useState(false);
  const [smsOnboardingVisible, setSmsOnboardingVisible] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<ParsedSmsTransaction[]>([]);
  const [selectedReviewTx, setSelectedReviewTx] = useState<ParsedSmsTransaction | null>(null);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // Edit / Adjust Account state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Focus-scoped Hardware Back Button Navigation Handler on Dashboard Tab
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
        setExitModalVisible(true);
        return true; // Handled exit dialog
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

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

  // Evaluate monthly analytics whenever transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const currentMonthTxs = transactions.filter((t) => t.date && t.date.startsWith(currentMonth));
      const prevMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7);
      const prevMonthTxs = transactions.filter((t) => t.date && t.date.startsWith(prevMonth));
      financialAnalyticsEngine.evaluateMonthlyAnalytics(currentMonthTxs, prevMonthTxs);
    }
  }, [transactions]);

  // Sync user data to native module when Dashboard mounts or user changes
  useEffect(() => {
    if (user?.id) {
      shakeService.syncUserDataToNative(user.id);
    }
  }, [user?.id]);

  const upcomingBills = bills.filter((b) => !b.is_paid).slice(0, 3);
  const activeGoals = goals.slice(0, 2);

  // Calculate Net Totals & Realtime Cashflow Trend (Memoized for high performance)
  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + (a.balance || 0), 0), [accounts]);
  const monthlyIncome = useMemo(
    () => transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount_minor, 0),
    [transactions]
  );
  const monthlyExpense = useMemo(
    () => transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_minor, 0),
    [transactions]
  );

  const handleOpenEditAccount = (acc: Account, e?: any) => {
    e?.stopPropagation?.();
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEditingAccount(acc);
    setEditAccName(acc.name);
    setEditAccBalance((acc.balance / 100).toString());
  };

  const handleRecalculateBalance = async () => {
    if (!editingAccount) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    try {
      const accountTxs = await transactionService.getAccountTransactions(editingAccount.id);
      const openingBalance = (editingAccount as any).opening_balance || 0;
      const calculatedMinor = accountTxs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount_minor;
        if (t.type === 'expense') return sum - t.amount_minor;
        if (t.type === 'transfer') {
          if (t.description?.startsWith('Transfer from')) return sum + t.amount_minor;
          return sum - t.amount_minor;
        }
        return sum;
      }, openingBalance);

      setEditAccBalance((calculatedMinor / 100).toString());
      Alert.alert(
        'Balance Calculated',
        `Calculated from opening balance (₹${(openingBalance / 100).toFixed(2)}) and ${accountTxs.length} transaction(s): ₹${(calculatedMinor / 100).toFixed(2)}. Tap "Save Changes" to apply.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to recalculate balance');
    }
  };

  const handleSaveAccount = async () => {
    if (!editingAccount) return;
    if (!editAccName.trim()) {
      Alert.alert('Validation Error', 'Account name cannot be empty.');
      return;
    }
    setIsSavingAccount(true);
    try {
      const minorBalance = parseSignedMoneyToMinor(editAccBalance);
      await accountService.updateAccount(editingAccount.id, {
        name: editAccName.trim(),
        balance: minorBalance,
      });
      await queryClient.invalidateQueries();
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setEditingAccount(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!editingAccount) return;
    Alert.alert(
      'Archive Account',
      `Are you sure you want to archive "${editingAccount.name}"? Transactions linked to this account will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await accountService.deleteAccount(editingAccount.id);
              if (selectedBankId === editingAccount.id) {
                setSelectedBankId('all');
              }
              await queryClient.invalidateQueries();
              setEditingAccount(null);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to archive account');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-5">
          <View>
            <Text className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Welcome back</Text>
            <Text className="text-2xl font-black text-zinc-900 mt-0.5">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setNotifModalVisible(true);
            }}
            className="w-10 h-10 bg-white border border-zinc-200 rounded-full items-center justify-center shadow-sm relative active:bg-zinc-50"
          >
            <Bell size={18} color="#09090B" />
            {reminders.length > 0 && (
              <View className="w-2.5 h-2.5 bg-indigo-600 rounded-full absolute top-1.5 right-1.5 border border-white" />
            )}
          </Pressable>
        </View>

        {/* Bank Account Dropdown Selector */}
        {accounts.length > 0 && (() => {
          const selectedAccount = accounts.find((a) => a.id === selectedBankId);
          return (
            <View className="mb-4">
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setBankSelectModalVisible(true);
                }}
                className="flex-row items-center justify-between p-3.5 bg-white border border-zinc-200 rounded-2xl shadow-sm active:bg-zinc-50"
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View
                    style={{ backgroundColor: selectedBankId === 'all' ? '#09090B' : (selectedAccount?.color || '#6366F1') }}
                    className="w-9 h-9 rounded-xl items-center justify-center shadow-sm"
                  >
                    {selectedBankId === 'all' ? (
                      <Wallet size={16} color="#10B981" />
                    ) : (
                      <Building2 size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Active Account Filter</Text>
                    <Text className="text-sm font-extrabold text-zinc-900" numberOfLines={1}>
                      {selectedBankId === 'all' ? 'All Accounts Combined' : selectedAccount?.name || 'Selected Bank'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <View
                    className={`px-2.5 py-1 ${
                      (selectedBankId === 'all' ? totalBalance : (selectedAccount?.balance || 0)) < 0
                        ? 'bg-rose-50 border border-rose-200'
                        : 'bg-emerald-50 border border-emerald-200'
                    } rounded-xl`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        (selectedBankId === 'all' ? totalBalance : (selectedAccount?.balance || 0)) < 0
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {formatMoney(selectedBankId === 'all' ? totalBalance : (selectedAccount?.balance || 0))}
                    </Text>
                  </View>
                  <ChevronDown size={18} color="#71717A" />
                </View>
              </Pressable>
            </View>
          );
        })()}

        {/* Net Total Balance Interactive Live Growth Chart Card */}
        <NetBalanceChartCard
          accounts={accounts}
          transactions={transactions}
          selectedAccountId={selectedBankId}
          isLoading={loadingAcc}
        />

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
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
              setRecordTxModalVisible(true);
            }}
          >
            <Plus size={18} color="#FFF" />
            <Text className="text-white font-bold text-xs">Add Transaction</Text>
          </Button>
        </View>

        {/* Recent 5 Transactions Widget */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-zinc-900">Recent Transactions</Text>
              {selectedBankId !== 'all' && (
                <View className="px-2 py-0.5 bg-zinc-100 rounded-full">
                  <Text className="text-[10px] font-bold text-zinc-600">
                    {accounts.find((a) => a.id === selectedBankId)?.name || 'Filtered'}
                  </Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push('/(tabs)/transactions')}>
              <Text className="text-xs font-bold text-indigo-600">See All</Text>
            </Pressable>
          </View>
          {(() => {
            const filteredTxs =
              selectedBankId === 'all'
                ? transactions
                : transactions.filter((t) => t.account_id === selectedBankId);

            if (filteredTxs.length === 0) {
              return (
                <Card className="p-6 bg-white border border-zinc-200 items-center rounded-2xl">
                  <Text className="text-sm font-semibold text-zinc-700">No transactions found</Text>
                  <Text className="text-xs text-zinc-400 mt-0.5 mb-3 text-center">
                    {selectedBankId === 'all'
                      ? 'Your latest financial activities will show here.'
                      : `No transactions recorded for ${accounts.find((a) => a.id === selectedBankId)?.name || 'this bank'}.`}
                  </Text>
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                      setRecordTxModalVisible(true);
                    }}
                  >
                    <Text className="text-white font-semibold text-xs">Add Transaction</Text>
                  </Button>
                </Card>
              );
            }

            return filteredTxs.slice(0, 5).map((tx) => {
              const accountName =
                tx.account?.name ||
                (Array.isArray(tx.account) && (tx.account as any)[0]?.name) ||
                accounts.find((a) => a.id === tx.account_id)?.name ||
                'Account';
              const categoryName =
                tx.category?.name ||
                (Array.isArray(tx.category) && (tx.category as any)[0]?.name) ||
                'General';

              return (
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
                        <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>
                          {cleanTransactionDescription(tx.description, categoryName, tx.type)}
                        </Text>
                        <Text className="text-[11px] text-zinc-500 mt-0.5">
                          {categoryName} • {accountName}
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
              );
            });
          })()}
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
      <AppModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="flex-col w-full"
        >
          {/* Subtle Drag Handle */}
          <View className="w-12 h-1 bg-zinc-300 rounded-full self-center mt-3 mb-1" />

          {/* Header */}
          <View className="flex-row justify-between items-center p-5 pb-3 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center">
                <Bell size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-xl font-extrabold text-zinc-900">Notifications</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">Recent push alerts & reminders</Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              {reminders.length > 0 && (
                <Pressable
                  onPress={async () => {
                    if (user?.id) {
                      await reminderService.clearAllReminders(user.id);
                      refetchReminders();
                    }
                  }}
                  className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 active:bg-rose-100"
                >
                  <Text className="text-xs font-bold text-rose-600">Clear All</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setNotifModalVisible(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center active:bg-zinc-200"
              >
                <X size={18} color="#71717A" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexShrink: 1 }}
            className="px-5 pt-3"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
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
        </Pressable>
      </AppModal>

      {/* Bank Selection Dropdown Modal */}
      <AppModal
        visible={bankSelectModalVisible}
        onClose={() => setBankSelectModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          className="flex-col w-full"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Subtle Drag Indicator */}
          <View className="w-12 h-1 bg-zinc-300 rounded-full self-center mt-3 mb-1" />

          {/* Fixed Header */}
          <View className="flex-row justify-between items-center px-5 py-3 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center">
                <Building2 size={20} color="#10B981" />
              </View>
              <View>
                <Text className="text-xl font-extrabold text-zinc-900">Select Account</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">Filter dashboard metrics, charts, & transactions</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setBankSelectModalVisible(false);
              }}
              className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center active:bg-zinc-200"
            >
              <X size={16} color="#71717A" />
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            className="px-5 pt-3"
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* All Accounts Option */}
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setSelectedBankId('all');
                setBankSelectModalVisible(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                marginBottom: 12,
                borderRadius: 16,
                borderWidth: 1,
                backgroundColor: selectedBankId === 'all' ? '#18181b' : '#fafafa',
                borderColor: selectedBankId === 'all' ? '#18181b' : '#e4e4e7',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: selectedBankId === 'all' ? '#ffffff' : '#09090b' }}>
                    All Accounts
                  </Text>
                  <Text style={{ fontSize: 12, marginTop: 2, color: selectedBankId === 'all' ? '#a1a1aa' : '#71717a' }}>
                    {accounts.length} linked bank{accounts.length !== 1 ? 's' : ''} combined
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '900',
                    color: selectedBankId === 'all'
                      ? (totalBalance < 0 ? '#f87171' : '#34d399')
                      : (totalBalance < 0 ? '#ef4444' : '#09090b'),
                  }}
                >
                  {formatMoney(totalBalance)}
                </Text>
                {selectedBankId === 'all' && <Check size={18} color="#10B981" />}
              </View>
            </Pressable>

            {/* Individual Banks */}
            {accounts.map((acc) => {
              const isSelected = selectedBankId === acc.id;
              const isAccNeg = (acc.balance || 0) < 0;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setSelectedBankId(acc.id);
                    setBankSelectModalVisible(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    marginBottom: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    backgroundColor: isSelected ? '#18181b' : '#fafafa',
                    borderColor: isSelected ? '#18181b' : '#e4e4e7',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: acc.color || '#6366F1',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building2 size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 14, fontWeight: '700', color: isSelected ? '#ffffff' : '#09090b' }}
                        numberOfLines={1}
                      >
                        {acc.name}
                      </Text>
                      <Text style={{ fontSize: 12, marginTop: 2, color: isSelected ? '#a1a1aa' : '#71717a' }}>
                        {acc.type ? acc.type.toUpperCase() : 'BANK'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '900',
                        color: isSelected
                          ? (isAccNeg ? '#f87171' : '#34d399')
                          : (isAccNeg ? '#ef4444' : '#09090b'),
                      }}
                    >
                      {formatMoney(acc.balance || 0)}
                    </Text>
                    {isSelected && <Check size={18} color="#10B981" />}
                    <Pressable
                      onPress={(e) => handleOpenEditAccount(acc, e)}
                      hitSlop={8}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: isSelected ? '#27272a' : '#f4f4f5',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 4,
                      }}
                    >
                      <Pencil size={13} color={isSelected ? '#ffffff' : '#71717a'} />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </AppModal>

      {/* Edit / Adjust Account Modal */}
      <AppModal
        visible={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        animationType="fade"
      >
        <Pressable
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: '#e4e4e7',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} color="#09090b" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#09090b' }}>Edit Account</Text>
                <Text style={{ fontSize: 12, color: '#71717a' }}>Adjust balance or account name</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setEditingAccount(null)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color="#71717a" />
            </Pressable>
          </View>

          <Input
            label="Account Name"
            value={editAccName}
            onChangeText={setEditAccName}
            placeholder="e.g. Bank of Baroda"
          />

          <Input
            label="Current Balance (₹)"
            value={editAccBalance}
            onChangeText={setEditAccBalance}
            placeholder="e.g. 10000 or -200"
            keyboardType="numbers-and-punctuation"
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 16 }}>
            <Pressable
              onPress={handleRecalculateBalance}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: '#f4f4f5',
                borderWidth: 1,
                borderColor: '#e4e4e7',
              }}
            >
              <RotateCcw size={13} color="#4f46e5" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#4f46e5' }}>Calculate from Transactions</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                size="md"
                onPress={handleDeleteAccount}
              >
                <Trash2 size={16} color="#ef4444" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444', marginLeft: 4 }}>Archive</Text>
              </Button>
            </View>

            <View style={{ flex: 2 }}>
              <Button
                variant="primary"
                size="md"
                loading={isSavingAccount}
                onPress={handleSaveAccount}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Save Changes</Text>
              </Button>
            </View>
          </View>
        </Pressable>
      </AppModal>

      {/* Direct Add Transaction Modal */}
      <RecordTransactionModal
        visible={recordTxModalVisible}
        onClose={() => setRecordTxModalVisible(false)}
        defaultAccountId={selectedBankId !== 'all' ? selectedBankId : undefined}
        onSuccess={() => {
          refetchTx();
          refetchAcc();
        }}
      />

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

      {/* Beautiful Bottom-Sheet Exit App Confirmation Modal */}
      <AppModal
        visible={exitModalVisible}
        onClose={() => setExitModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 shadow-2xl"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center my-2">
            <View className="w-14 h-14 rounded-full bg-rose-50 items-center justify-center mb-3.5 border border-rose-100">
              <LogOut size={26} color="#EF4444" />
            </View>
            <Text className="text-xl font-black text-zinc-900 text-center">Exit PocketWise?</Text>
            <Text className="text-xs text-zinc-500 mt-1.5 text-center px-4 leading-relaxed">
              Are you sure you want to close the application? All your financial transactions and goals are safely saved.
            </Text>
          </View>

          <View className="flex-row gap-3 mt-6 mb-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 border-zinc-200 bg-zinc-50"
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setExitModalVisible(false);
              }}
            >
              <Text className="text-zinc-800 font-bold text-sm">Stay in App</Text>
            </Button>

            <Button
              variant="destructive"
              size="lg"
              className="flex-1 bg-rose-600 active:bg-rose-700 shadow-sm"
              onPress={() => {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
                BackHandler.exitApp();
              }}
            >
              <Text className="text-white font-bold text-sm">Exit App</Text>
            </Button>
          </View>
        </Pressable>
      </AppModal>
    </SafeAreaView>
  );
}
