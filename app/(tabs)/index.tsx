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
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet, Calendar, Target, ChevronRight } from 'lucide-react-native';
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

        {/* Action Buttons */}
        <View className="flex-row space-x-3 mb-6">
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
            <Card className="p-4 bg-white border border-zinc-200">
              <Text className="text-xs text-zinc-500 text-center">No upcoming bills right now.</Text>
            </Card>
          ) : (
            upcomingBills.map((b) => (
              <Card key={b.id} className="mb-2 p-3 bg-white border border-zinc-200">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Calendar size={16} color="#F59E0B" className="mr-2.5" />
                    <Text className="text-sm font-bold text-zinc-900">{b.name}</Text>
                  </View>
                  <Text className="text-sm font-extrabold text-zinc-900">{formatMoney(b.expected_amount_minor)}</Text>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Savings Goals Widget */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Savings Goals</Text>
            <Pressable onPress={() => router.push('/goals')}>
              <Text className="text-xs font-bold text-indigo-600">See All</Text>
            </Pressable>
          </View>
          {activeGoals.length === 0 ? (
            <Card className="p-4 bg-white border border-zinc-200">
              <Text className="text-xs text-zinc-500 text-center">No savings goals created yet.</Text>
            </Card>
          ) : (
            activeGoals.map((g) => {
              const target = g.target_amount_minor || 1;
              const current = g.current_amount_minor || 0;
              const pct = Math.min(Math.round((current / target) * 100), 100);

              return (
                <Card key={g.id} className="mb-2 p-3.5 bg-white border border-zinc-200">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <View className="flex-row items-center">
                      <Target size={16} color="#6366F1" className="mr-2" />
                      <Text className="text-sm font-bold text-zinc-900">{g.name}</Text>
                    </View>
                    <Text className="text-xs font-bold text-zinc-600">{pct}%</Text>
                  </View>
                  <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <View className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        {/* Recent Transactions */}
        <View className="mb-8">
          <Text className="text-base font-bold text-zinc-900 mb-3">Recent Activity</Text>
          {loadingTx ? (
            <ActivityIndicator color="#09090B" size="small" />
          ) : transactions.length === 0 ? (
            <Card className="p-4 bg-white border border-zinc-200">
              <Text className="text-xs text-zinc-500 text-center">No transactions recorded yet.</Text>
            </Card>
          ) : (
            transactions.slice(0, 5).map((tx) => (
              <Card key={tx.id} className="mb-2 p-3.5 bg-white border border-zinc-200">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                      tx.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'
                    }`}>
                      {tx.type === 'income' ? (
                        <ArrowDownLeft size={18} color="#10B981" />
                      ) : (
                        <ArrowUpRight size={18} color="#EF4444" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>{tx.description}</Text>
                      <Text className="text-xs text-zinc-500">{formatDate(tx.date)}</Text>
                    </View>
                  </View>
                  <Text className={`text-sm font-bold ${
                    tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount_minor)}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
