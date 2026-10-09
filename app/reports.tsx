import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AppModal } from '../components/ui/AppModal';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../lib/services/report.service';
import { budgetService, Budget } from '../lib/services/budget.service';
import { goalService, Goal } from '../lib/services/goal.service';
import { transactionService } from '../lib/services/transaction.service';
import { exportService } from '../lib/services/export.service';
import { formatMoney } from '../lib/finance/core';
import { ArrowLeft, TrendingUp, PieChart as PieIcon, CreditCard, Calendar, Target, Share2, FileSpreadsheet, FileText, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type PeriodOption = 'this_month' | '3_months' | '6_months' | 'this_year';

export default function ReportsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodOption>('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = (selectedPeriod: PeriodOption) => {
    const now = new Date();
    let start = new Date();

    if (selectedPeriod === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (selectedPeriod === '3_months') {
      start.setMonth(now.getMonth() - 3);
    } else if (selectedPeriod === '6_months') {
      start.setMonth(now.getMonth() - 6);
    } else if (selectedPeriod === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  };

  const { startDate, endDate } = getDateRange(period);

  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['reports', 'summary', user?.id, period],
    queryFn: () => reportService.getFinancialSummary(user?.id || '', startDate, endDate),
    enabled: !!user?.id,
  });

  const { data: categories = [], isLoading: loadingCats, refetch: refetchCats } = useQuery({
    queryKey: ['reports', 'categories', user?.id, period],
    queryFn: () => reportService.getCategorySpending(user?.id || '', startDate, endDate),
    enabled: !!user?.id,
  });

  const { data: subsAnalytics, refetch: refetchSubs } = useQuery({
    queryKey: ['reports', 'subscriptions', user?.id],
    queryFn: () => reportService.getSubscriptionAnalytics(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: commitments, refetch: refetchCommitments } = useQuery({
    queryKey: ['reports', 'commitments', user?.id],
    queryFn: () => reportService.getUpcomingCommitments(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: budgets = [], refetch: refetchBudgets } = useQuery({
    queryKey: ['reports', 'budgets', user?.id],
    queryFn: () => budgetService.getBudgets(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: goals = [], refetch: refetchGoals } = useQuery({
    queryKey: ['reports', 'goals', user?.id],
    queryFn: () => goalService.getGoals(user?.id || ''),
    enabled: !!user?.id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSummary(),
      refetchCats(),
      refetchSubs(),
      refetchCommitments(),
      refetchBudgets(),
      refetchGoals(),
    ]);
    setRefreshing(false);
  };

  const handleExportCSV = async () => {
    if (!user?.id) return;
    setIsExporting(true);
    try {
      const txs = await transactionService.getTransactionsByDateRange(user.id, startDate, endDate);
      const csvData = exportService.generateTransactionsCSV(txs);
      await exportService.shareContent(csvData, 'PocketWise Transactions Statement');
      setExportModalVisible(false);
    } catch {
      Alert.alert('Export Error', 'Failed to export CSV statement.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummary = async () => {
    if (!summary) return;
    setIsExporting(true);
    try {
      const summaryText = exportService.generateFinancialSummaryText({
        periodName: period.replace('_', ' '),
        startDate,
        endDate,
        summary,
        categories,
      });
      await exportService.shareContent(summaryText, 'PocketWise Financial Summary');
      setExportModalVisible(false);
    } catch {
      Alert.alert('Export Error', 'Failed to export summary report.');
    } finally {
      setIsExporting(false);
    }
  };

  const hasNoData = !summary || (summary.totalIncome === 0 && summary.totalExpense === 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)/'); } }} className="p-2 -ml-2 mr-2 rounded-full active:bg-zinc-100">
              <ArrowLeft size={20} color="#09090B" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-black text-zinc-900">Financial Analytics</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">Real-time spending & performance breakdown</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setExportModalVisible(true);
            }}
            className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 items-center justify-center active:bg-indigo-100 ml-2"
          >
            <Share2 size={18} color="#6366F1" />
          </Pressable>
        </View>

        {/* Period Selector */}
        <View className="mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            {[
              { id: 'this_month', label: 'This Month' },
              { id: '3_months', label: '3 Months' },
              { id: '6_months', label: '6 Months' },
              { id: 'this_year', label: 'This Year' },
            ].map((item) => {
              const isSelected = period === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setPeriod(item.id as PeriodOption);
                  }}
                  className={`px-4 py-2.5 rounded-2xl border ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-900 shadow-sm'
                      : 'bg-white border-zinc-200 active:bg-zinc-50'
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-zinc-600'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#09090B']} />
          }
        >
          {loadingSummary || loadingCats ? (
            <View className="py-12">
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : hasNoData ? (
            <Card className="p-8 bg-white border border-zinc-200 items-center mt-4 rounded-3xl">
              <View className="w-14 h-14 rounded-full bg-zinc-100 items-center justify-center mb-3">
                <PieIcon size={28} color="#A1A1AA" />
              </View>
              <Text className="text-base font-bold text-zinc-900 text-center">No financial data yet</Text>
              <Text className="text-xs text-zinc-500 mt-1 text-center">
                Add income and expense transactions to unlock your spending insights.
              </Text>
            </Card>
          ) : (
            <>
              {/* Financial Summary Card */}
              <Card className="bg-zinc-900 border-zinc-800 p-5 mb-5 rounded-3xl shadow-md">
                {/* Hero Top: Net Savings & Savings Rate */}
                <View className="flex-row justify-between items-center mb-4">
                  <View>
                    <Text className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-widest">
                      Period Summary
                    </Text>
                    <Text className="text-2xl font-black text-white mt-1">
                      {formatMoney(summary?.savings || 0)}
                    </Text>
                    <Text className="text-xs font-semibold text-zinc-400 mt-0.5">Net Period Savings</Text>
                  </View>

                  <View className="bg-zinc-800/90 px-3.5 py-2 rounded-2xl flex-row items-center gap-2 border border-zinc-700/60">
                    <TrendingUp size={16} color="#10B981" />
                    <View>
                      <Text className="text-[9px] font-bold text-zinc-400 uppercase">Savings Rate</Text>
                      <Text className="text-sm font-black text-emerald-400">{summary?.savingsRate || 0}%</Text>
                    </View>
                  </View>
                </View>

                {/* 2-Column Full-Width Breakdown: Income & Expenses */}
                <View className="flex-row gap-3 pt-3.5 border-t border-zinc-800">
                  {/* Income */}
                  <View className="flex-1 bg-zinc-800/80 p-3.5 rounded-2xl border border-zinc-700/50">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <View className="w-2 h-2 rounded-full bg-emerald-400" />
                      <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Income</Text>
                    </View>
                    <Text className="text-base font-black text-emerald-400">
                      +{formatMoney(summary?.totalIncome || 0)}
                    </Text>
                  </View>

                  {/* Expenses */}
                  <View className="flex-1 bg-zinc-800/80 p-3.5 rounded-2xl border border-zinc-700/50">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <View className="w-2 h-2 rounded-full bg-rose-400" />
                      <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Expenses</Text>
                    </View>
                    <Text className="text-base font-black text-rose-400">
                      -{formatMoney(summary?.totalExpense || 0)}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Category Ranking */}
              <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                Top Expense Categories
              </Text>
              <Card className="p-5 bg-white border border-zinc-200 mb-5 rounded-3xl shadow-sm">
                {categories.length === 0 ? (
                  <Text className="text-xs text-zinc-400 text-center py-2">No category expenses recorded</Text>
                ) : (
                  categories.slice(0, 5).map((cat, idx) => (
                    <View key={cat.categoryId} className="mb-4 last:mb-0">
                      <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                          <View className="w-6 h-6 rounded-full bg-zinc-100 items-center justify-center">
                            <Text className="text-[11px] font-black text-zinc-600">{idx + 1}</Text>
                          </View>
                          <View className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.categoryColor || '#6366F1' }} />
                          <Text className="text-sm font-bold text-zinc-900 flex-1" numberOfLines={1}>
                            {cat.categoryName}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sm font-black text-zinc-900">
                            {formatMoney(cat.amountMinor)}
                          </Text>
                          <Text className="text-[10px] font-bold text-zinc-400">
                            {cat.percentage}% of total
                          </Text>
                        </View>
                      </View>
                      <View className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50 p-0.5">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.categoryColor || '#6366F1',
                          }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </Card>

              {/* Subscription & Commitments */}
              <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                Subscription & Upcoming Commitments
              </Text>
              <View className="flex-row gap-3 mb-5">
                <Card className="flex-1 p-4 bg-white border border-zinc-200 rounded-3xl">
                  <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center mb-2">
                    <CreditCard size={18} color="#6366F1" />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-400 uppercase">Monthly Subs</Text>
                  <Text className="text-base font-black text-zinc-900 mt-0.5">
                    {formatMoney(subsAnalytics?.monthlyTotalMinor || 0)}
                  </Text>
                  <Text className="text-[10px] font-medium text-zinc-400 mt-1">
                    Annual: {formatMoney(subsAnalytics?.annualTotalMinor || 0)}
                  </Text>
                </Card>

                <Card className="flex-1 p-4 bg-white border border-zinc-200 rounded-3xl">
                  <View className="w-8 h-8 rounded-xl bg-amber-50 items-center justify-center mb-2">
                    <Calendar size={18} color="#F59E0B" />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-400 uppercase">Upcoming Bills</Text>
                  <Text className="text-base font-black text-zinc-900 mt-0.5">
                    {formatMoney(commitments?.billsMinor || 0)}
                  </Text>
                  <Text className="text-[10px] font-medium text-zinc-400 mt-1">Unpaid commitments</Text>
                </Card>
              </View>

              {/* Budget Performance */}
              {budgets.length > 0 && (
                <>
                  <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                    Budget Performance
                  </Text>
                  <Card className="p-5 bg-white border border-zinc-200 mb-5 rounded-3xl shadow-sm">
                    {budgets.map((b: Budget, idx: number) => {
                      const spent = b.amount_spent || 0;
                      const limit = b.amount_minor || 1;
                      const pct = Math.round((spent / limit) * 100);
                      const isExceeded = pct >= 100;
                      const isWarning = pct >= 80 && pct < 100;

                      return (
                        <View
                          key={b.id}
                          className={`pb-4 border-b border-zinc-100 last:border-b-0 last:pb-0 ${
                            idx > 0 ? 'pt-4' : 'pt-0'
                          }`}
                        >
                          <View className="flex-row justify-between items-center mb-2">
                            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                              <View className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: b.category_color || '#6366F1' }} />
                              <Text className="text-sm font-bold text-zinc-900 flex-1" numberOfLines={1}>
                                {b.category_name || 'Category'}
                              </Text>
                            </View>

                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs font-extrabold text-zinc-900">
                                {formatMoney(spent)} <Text className="font-medium text-zinc-400">/ {formatMoney(limit)}</Text>
                              </Text>

                              <View className={`px-2 py-0.5 rounded-full ${
                                isExceeded ? 'bg-rose-50 border border-rose-100' : isWarning ? 'bg-amber-50 border border-amber-100' : 'bg-emerald-50 border border-emerald-100'
                              }`}>
                                <Text className={`text-[10px] font-extrabold ${
                                  isExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {pct}%
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50 p-0.5">
                            <View
                              className={`h-full rounded-full ${
                                isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : ''
                              }`}
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                backgroundColor: isExceeded ? '#EF4444' : isWarning ? '#F59E0B' : (b.category_color || '#10B981'),
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}

              {/* Goal Progress */}
              {goals.length > 0 && (
                <>
                  <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                    Savings Goals Overview
                  </Text>
                  <Card className="p-4 bg-white border border-zinc-200 mb-6 rounded-3xl">
                    {goals.map((g: Goal) => {
                      const pct = g.target_amount_minor > 0
                        ? Math.min(100, Math.round((g.current_amount_minor / g.target_amount_minor) * 100))
                        : 0;
                      return (
                        <View key={g.id} className="mb-3.5 last:mb-0">
                          <View className="flex-row justify-between items-center mb-1">
                            <View className="flex-row items-center gap-1.5">
                              <Target size={14} color="#6366F1" />
                              <Text className="text-xs font-bold text-zinc-900">{g.name}</Text>
                            </View>
                            <Text className="text-xs font-extrabold text-indigo-600">{pct}%</Text>
                          </View>
                          <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <View className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Export Statement Modal */}
      <AppModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          className="bg-white rounded-t-3xl p-6 pb-6 border-t border-zinc-200"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-xl font-bold text-zinc-900">Export Financial Statement</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">
                {period.replace('_', ' ').toUpperCase()} ({startDate} to {endDate})
              </Text>
            </View>
            <Pressable onPress={() => setExportModalVisible(false)} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <View className="gap-3 my-3">
            <Pressable
              disabled={isExporting}
              onPress={handleExportCSV}
              className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex-row items-center active:bg-zinc-100"
            >
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3 border border-emerald-100">
                <FileSpreadsheet size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Transactions Spreadsheet (CSV)</Text>
                <Text className="text-xs text-zinc-500">Full itemized statement with dates, categories & amounts</Text>
              </View>
            </Pressable>

            <Pressable
              disabled={isExporting}
              onPress={handleExportSummary}
              className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex-row items-center active:bg-zinc-100"
            >
              <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center mr-3 border border-indigo-100">
                <FileText size={20} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Financial Summary Report (Text)</Text>
                <Text className="text-xs text-zinc-500">Savings rate, income/expense breakdown & totals</Text>
              </View>
            </Pressable>
          </View>

          {isExporting && (
            <View className="py-2 items-center flex-row justify-center gap-2">
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-xs font-semibold text-zinc-500">Preparing export statement...</Text>
            </View>
          )}

          <Button
            variant="outline"
            size="lg"
            className="mt-2 mb-2"
            onPress={() => setExportModalVisible(false)}
          >
            <Text className="text-zinc-700 font-semibold">Cancel</Text>
          </Button>
        </Pressable>
      </AppModal>
    </SafeAreaView>
  );
}

