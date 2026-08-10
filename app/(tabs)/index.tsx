import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { Plus, ArrowUpRight, ArrowDownLeft, Bell, Wallet, ShieldCheck, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen() {
  const { profile, accounts, transactions, subscriptions } = useAppStore();

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const monthlyExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false}>
        {/* Header Bar */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Welcome back</Text>
            <Text className="text-2xl font-black text-zinc-900 mt-0.5">{profile.display_name} 👋</Text>
          </View>
          <TouchableOpacity 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            className="w-10 h-10 bg-white border border-zinc-200 rounded-full items-center justify-center shadow-sm"
          >
            <Bell size={18} color="#09090B" />
          </TouchableOpacity>
        </View>

        {/* Main Net Worth / Total Balance Card */}
        <Card className="bg-zinc-900 border-zinc-800 p-6 mb-6 rounded-3xl">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Net Total Balance</Text>
          <Text className="text-3xl font-extrabold text-white mt-1 mb-4">
            {formatCurrency(totalBalance)}
          </Text>

          <View className="flex-row pt-4 border-t border-zinc-800 justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center mr-2.5">
                <ArrowDownLeft size={16} color="#10B981" />
              </View>
              <View>
                <Text className="text-xs text-zinc-400">Income</Text>
                <Text className="text-sm font-bold text-emerald-400">{formatCurrency(monthlyIncome)}</Text>
              </View>
            </View>

            <View className="h-8 w-[1px] bg-zinc-800" />

            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-rose-500/20 items-center justify-center mr-2.5">
                <ArrowUpRight size={16} color="#EF4444" />
              </View>
              <View>
                <Text className="text-xs text-zinc-400">Expenses</Text>
                <Text className="text-sm font-bold text-rose-400">{formatCurrency(monthlyExpense)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Quick Action Bar */}
        <View className="flex-row space-x-3 mb-6">
          <Button 
            variant="primary" 
            size="md" 
            className="flex-1 flex-row space-x-2"
            onPress={() => {}}
          >
            <Plus size={18} color="#FFF" />
            <Text className="text-white font-semibold">Add Income</Text>
          </Button>

          <Button 
            variant="outline" 
            size="md" 
            className="flex-1 flex-row space-x-2"
            onPress={() => {}}
          >
            <Plus size={18} color="#EF4444" />
            <Text className="text-rose-600 font-semibold">Add Expense</Text>
          </Button>
        </View>

        {/* Accounts Horizontal List */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Your Accounts</Text>
            <TouchableOpacity><Text className="text-xs font-semibold text-zinc-500">Manage</Text></TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 flex-row space-x-3">
            {accounts.map((acc) => (
              <Card key={acc.id} className="w-44 p-4 mr-3 bg-white border border-zinc-200">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="w-8 h-8 rounded-xl bg-zinc-100 items-center justify-center">
                    <Wallet size={16} color="#09090B" />
                  </View>
                  <Badge label={acc.type.replace('_', ' ')} variant="outline" />
                </View>
                <Text className="text-xs font-medium text-zinc-500" numberOfLines={1}>{acc.name}</Text>
                <Text className="text-base font-bold text-zinc-900 mt-1">{formatCurrency(acc.balance)}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Subscriptions Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Upcoming Subscriptions</Text>
            <TouchableOpacity><Text className="text-xs font-semibold text-indigo-600">View All</Text></TouchableOpacity>
          </View>

          {subscriptions.slice(0, 2).map((sub) => (
            <Card key={sub.id} className="mb-2.5 p-3.5 flex-row items-center justify-between bg-white border border-zinc-200">
              <View className="flex-row items-center flex-1">
                <View 
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                  style={{ backgroundColor: sub.color + '15' }}
                >
                  <Text className="font-bold text-base" style={{ color: sub.color }}>{sub.name[0]}</Text>
                </View>
                <View>
                  <Text className="text-sm font-bold text-zinc-900">{sub.name}</Text>
                  <Text className="text-xs text-zinc-500">Renews on {formatDate(sub.next_billing_date)}</Text>
                </View>
              </View>
              <Text className="text-sm font-bold text-zinc-900">{formatCurrency(sub.amount)}</Text>
            </Card>
          ))}
        </View>

        {/* Recent Activity List */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-zinc-900">Recent Transactions</Text>
            <TouchableOpacity><Text className="text-xs font-semibold text-zinc-500">See All</Text></TouchableOpacity>
          </View>

          {transactions.slice(0, 4).map((tx) => (
            <Card key={tx.id} className="mb-2.5 p-3.5 flex-row items-center justify-between bg-white border border-zinc-200">
              <View className="flex-row items-center flex-1">
                <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-3 ${tx.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={18} color="#10B981" /> : <ArrowUpRight size={18} color="#EF4444" />}
                </View>
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>{tx.description}</Text>
                  <Text className="text-xs text-zinc-500">{tx.category_name} • {formatDate(tx.date)}</Text>
                </View>
              </View>
              <Text className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
