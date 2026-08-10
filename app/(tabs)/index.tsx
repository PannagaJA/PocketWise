import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { accountService } from '../../lib/services/account.service';
import { transactionService } from '../../lib/services/transaction.service';
import { subscriptionService } from '../../lib/services/subscription.service';
import { formatMoney, formatDate } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet } from 'lucide-react-native';
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

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', user?.id],
    queryFn: () => subscriptionService.getSubscriptions(user?.id || ''),
    enabled: !!user?.id,
  });

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

        {/* Accounts Carousel */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Your Accounts</Text>
          </View>

          {loadingAcc ? (
            <ActivityIndicator color="#09090B" size="small" />
          ) : accounts.length === 0 ? (
            <Card className="p-4 bg-white border border-zinc-200">
              <Text className="text-xs text-zinc-500 text-center">No accounts added yet. Create one in Transactions!</Text>
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-3">
              {accounts.map((acc) => (
                <Card key={acc.id} className="w-44 p-4 bg-white border border-zinc-200 mr-3">
                  <View className="w-8 h-8 rounded-xl bg-zinc-100 items-center justify-center mb-3">
                    <Wallet size={16} color="#09090B" />
                  </View>
                  <Text className="text-xs font-medium text-zinc-500">{acc.name}</Text>
                  <Text className="text-base font-extrabold text-zinc-900 mt-1">{formatMoney(acc.balance)}</Text>
                </Card>
              ))}
            </ScrollView>
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
