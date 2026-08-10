import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { accountService } from '../../lib/services/account.service';
import { transactionService } from '../../lib/services/transaction.service';
import { billService } from '../../lib/services/bill.service';
import { goalService } from '../../lib/services/goal.service';
import { formatMoney, formatDate } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet, Calendar, Target, ChevronRight, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: accounts = [], isLoading: loadingAcc } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => transactionService.getTransactions(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', user?.id],
    queryFn: () => billService.getBills(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', user?.id],
    queryFn: () => goalService.getGoals(user?.id || ''),
    enabled: !!user?.id,
  });

  const upcomingBills = bills.filter((b) => !b.is_paid).slice(0, 3);
  const activeGoals = goals.slice(0, 2);

  // Calculate Net Totals
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_minor, 0);
  const monthlyExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_minor, 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Welcome back</Text>
            <Text className="text-2xl font-black text-zinc-900 mt-0.5">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'} 👋
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            className="w-10 h-10 bg-white border border-zinc-200 rounded-full items-center justify-center shadow-sm"
          >
            <Bell size={18} color="#09090B" />
          </TouchableOpacity>
        </View>

        {/* Net Worth Card */}
        <Card className="bg-zinc-900 border-zinc-800 p-6 mb-6 rounded-3xl">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Net Total Balance</Text>
          <Text className="text-3xl font-extrabold text-white mt-1 mb-4">
            {formatMoney(totalBalance)}
          </Text>

          <View className="flex-row pt-4 border-t border-zinc-800 justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center mr-2.5">
                <ArrowDownLeft size={16} color="#10B981" />
              </View>
              <View>
                <Text className="text-xs text-zinc-400">Income</Text>
                <Text className="text-sm font-bold text-emerald-400">{formatMoney(monthlyIncome)}</Text>
              </View>
            </View>

            <View className="h-8 w-[1px] bg-zinc-800" />

            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-rose-500/20 items-center justify-center mr-2.5">
                <ArrowUpRight size={16} color="#EF4444" />
              </View>
              <View>
                <Text className="text-xs text-zinc-400">Expenses</Text>
                <Text className="text-sm font-bold text-rose-400">{formatMoney(monthlyExpense)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Action Buttons with Gap */}
        <View className="flex-row gap-4 mb-6">
          <Button
            variant="primary"
            size="md"
            className="flex-1 flex-row space-x-2"
            onPress={() => router.push('/(tabs)/transactions' as any)}
          >
            <Plus size={18} color="#FFF" />
            <Text className="text-white font-semibold">Log Income</Text>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="flex-1 flex-row space-x-2"
            onPress={() => router.push('/(tabs)/transactions' as any)}
          >
            <Plus size={18} color="#EF4444" />
            <Text className="text-rose-600 font-semibold">Log Expense</Text>
          </Button>
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
    </SafeAreaView>
  );
}
