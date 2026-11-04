import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AppBottomSheet } from '../components/ui/AppBottomSheet';
import { AppLoadingIndicator } from '../components/ui/AppLoadingIndicator';
import { RecordRow } from '../components/ui/RecordRow';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { useAuth } from '../context/AuthContext';
import { reportService, CategorySpending } from '../lib/services/report.service';
import { budgetService, Budget } from '../lib/services/budget.service';
import { goalService, Goal } from '../lib/services/goal.service';
import { transactionService } from '../lib/services/transaction.service';
import { exportService } from '../lib/services/export.service';
import { formatMoney, formatDate } from '../lib/finance/core';
import { ArrowLeft, TrendingUp, PieChart as PieIcon, CreditCard, Calendar, Target, Share2, FileSpreadsheet, FileText, X, ChevronRight, ArrowRight, ArrowRightLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useModuleBack } from '../lib/navigation/moduleBack';
import { useTabStore } from '../lib/stores/tabStore';

type PeriodOption = 'this_month' | '3_months' | '6_months' | 'this_year';

export default function ReportsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const goBack = useModuleBack();
  const [period, setPeriod] = useState<PeriodOption>('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingMessage, setExportingMessage] = useState('Preparing export statement...');

  // Category transactions drilldown modal
  const [selectedCategory, setSelectedCategory] = useState<CategorySpending | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [detailTx, setDetailTx] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

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

    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(now),
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

  const { data: periodTransactions = [], isLoading: loadingPeriodTxs, refetch: refetchPeriodTxs } = useQuery({
    queryKey: ['reports', 'periodTransactions', user?.id, startDate, endDate],
    queryFn: () => transactionService.getTransactionsByDateRange(user?.id || '', startDate, endDate),
    enabled: !!user?.id,
  });

  // Filter transactions for the selected category modal
  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    const targetCatId = selectedCategory.categoryId;
    const targetCatName = (selectedCategory.categoryName || '').toLowerCase().trim();

    return periodTransactions.filter((tx: any) => {
      const txCatId = tx.category_id;
      const txCatName = (
        tx.category?.name ||
        (Array.isArray(tx.category) && (tx.category as any)[0]?.name) ||
        ''
      ).toLowerCase().trim();

      // Explicit category id match
      if (targetCatId && targetCatId !== 'unassigned' && txCatId === targetCatId) return true;

      // Explicit category name match
      if (txCatName && txCatName === targetCatName) return true;

      // Transfer handling
      if (targetCatName === 'transfer') {
        if (tx.type === 'transfer') return true;
        if (tx.description?.toLowerCase().includes('transfer') || /\btrf\b/i.test(tx.description || '')) return true;
      }

      // Fallback Personal (uncategorized expenses)
      if (targetCatName === 'personal' && (!txCatId || !txCatName) && tx.type === 'expense') {
        return true;
      }

      return false;
    });
  }, [periodTransactions, selectedCategory]);

  const handleOpenCategory = (cat: CategorySpending) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSelectedCategory(cat);
    setCategoryModalVisible(true);
  };

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
      refetchPeriodTxs(),
      refetchSubs(),
      refetchCommitments(),
      refetchBudgets(),
      refetchGoals(),
    ]);
    setRefreshing(false);
  };

  const handleExportPDF = async () => {
    if (!summary || !user?.id) return;
    setIsExporting(true);
    setExportingMessage('Generating your PDF statement...');
    try {
      const txs = await transactionService.getTransactionsByDateRange(user.id, startDate, endDate);
      setExportModalVisible(false);
      await exportService.exportPDFStatement({
        periodName: period.replace('_', ' '),
        startDate,
        endDate,
        summary,
        categories,
        transactions: txs,
        userName: (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || 'Account Holder',
        userEmail: user?.email,
      });
    } catch (err: any) {
      if (
        err?.name !== 'AbortError' &&
        !err?.message?.includes('canceled') &&
        !err?.message?.includes('cancelled') &&
        !err?.message?.includes('dismissed')
      ) {
        Alert.alert('Export Error', 'Failed to generate PDF statement. Please try again.');
      }
    } finally {
      setIsExporting(false);
      setExportingMessage('Preparing export statement...');
    }
  };

  const handleExportCSV = async () => {
    if (!user?.id) return;
    setIsExporting(true);
    setExportingMessage('Preparing CSV spreadsheet...');
    try {
      const txs = await transactionService.getTransactionsByDateRange(user.id, startDate, endDate);
      setExportModalVisible(false);
      const filename = `PocketWise_Transactions_${startDate}_to_${endDate}.csv`;
      await exportService.exportTransactionsCSV(txs, filename);
    } catch (err: any) {
      if (
        err?.name !== 'AbortError' &&
        !err?.message?.includes('canceled') &&
        !err?.message?.includes('cancelled') &&
        !err?.message?.includes('dismissed')
      ) {
        Alert.alert('Export Error', 'Failed to export CSV statement.');
      }
    } finally {
      setIsExporting(false);
      setExportingMessage('Preparing export statement...');
    }
  };

  const handleExportSummary = async () => {
    if (!summary) return;
    setIsExporting(true);
    setExportingMessage('Preparing text summary...');
    try {
      const summaryText = exportService.generateFinancialSummaryText({
        periodName: period.replace('_', ' '),
        startDate,
        endDate,
        summary,
        categories,
      });
      setExportModalVisible(false);
      await exportService.shareContent(summaryText, 'PocketWise Financial Summary');
    } catch (err: any) {
      if (
        err?.name !== 'AbortError' &&
        !err?.message?.includes('canceled') &&
        !err?.message?.includes('cancelled') &&
        !err?.message?.includes('dismissed')
      ) {
        Alert.alert('Export Error', 'Failed to export summary report.');
      }
    } finally {
      setIsExporting(false);
      setExportingMessage('Preparing export statement...');
    }
  };

  const hasNoData = !summary || (summary.totalIncome === 0 && summary.totalExpense === 0);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F9FE' }} edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={goBack}
              className="p-2 -ml-2 mr-2 rounded-full"
            >
              <ArrowLeft size={20} color="#09090B" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[22px] font-extrabold text-zinc-950 tracking-tight">Financial Analytics</Text>
              <Text className="text-xs font-medium text-zinc-500 mt-0.5">Real-time spending & performance breakdown</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setExportModalVisible(true);
            }}
            className="w-10 h-10 rounded-full bg-white border border-zinc-100 items-center justify-center ml-2 shadow-xs"
          >
            <Share2 size={18} color="#09090B" />
          </TouchableOpacity>
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
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setPeriod(item.id as PeriodOption);
                  }}
                  style={{
                    backgroundColor: isSelected ? '#09090B' : '#ffffff',
                    borderColor: isSelected ? '#09090B' : '#F4F4F5',
                  }}
                  className="px-4 py-2 rounded-full border shadow-xs"
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: isSelected ? '#ffffff' : '#52525b' }}
                    className="text-xs font-bold"
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
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
            <Card className="p-8 bg-white border border-zinc-100 items-center mt-4 rounded-3xl shadow-xs">
              <View className="w-14 h-14 rounded-full bg-zinc-50 items-center justify-center mb-3 border border-zinc-100">
                <PieIcon size={26} color="#A1A1AA" />
              </View>
              <Text className="text-base font-bold text-zinc-900 text-center">No financial data yet</Text>
              <Text className="text-xs text-zinc-500 mt-1 text-center">
                Add income and expense transactions to unlock your spending insights.
              </Text>
            </Card>
          ) : (
            <>
              {/* Financial Summary Card */}
              <Card className="bg-white border border-zinc-100 p-5 mb-5 rounded-3xl shadow-xs">
                {/* Hero Top: Net Savings & Savings Rate */}
                <View className="flex-row justify-between items-center mb-4">
                  <View>
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Period Summary
                    </Text>
                    <Text
                      className="text-[24px] font-extrabold text-zinc-950 tracking-tight mt-1"
                      style={{ lineHeight: 32 }}
                    >
                      {formatMoney(summary?.savings || 0)}
                    </Text>
                    <Text className="text-xs font-medium text-zinc-500 mt-0.5">Net Period Savings</Text>
                  </View>

                  <View className="bg-emerald-50 px-3.5 py-2 rounded-2xl flex-row items-center gap-2 border border-emerald-100/60">
                    <TrendingUp size={16} color="#10B981" />
                    <View>
                      <Text className="text-[9px] font-bold text-zinc-500 uppercase">Savings Rate</Text>
                      <Text className="text-sm font-extrabold text-emerald-600">{summary?.savingsRate || 0}%</Text>
                    </View>
                  </View>
                </View>

                {/* 2-Column Full-Width Breakdown: Income & Expenses */}
                <View className="flex-row gap-3 pt-3.5 border-t border-zinc-100">
                  {/* Income */}
                  <View className="flex-1 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/50">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <View className="w-2 h-2 rounded-full bg-emerald-500" />
                      <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Income</Text>
                    </View>
                    <Text className="text-base font-extrabold text-emerald-600">
                      +{formatMoney(summary?.totalIncome || 0)}
                    </Text>
                  </View>

                  {/* Expenses */}
                  <View className="flex-1 bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100/50">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <View className="w-2 h-2 rounded-full bg-rose-500" />
                      <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Expenses</Text>
                    </View>
                    <Text className="text-base font-extrabold text-zinc-950">
                      -{formatMoney(summary?.totalExpense || 0)}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Category Ranking */}
              <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                Top Expense Categories
              </Text>
              <Card className="p-5 bg-white border border-zinc-100 mb-5 rounded-3xl shadow-xs">
                {categories.length === 0 ? (
                  <Text className="text-xs text-zinc-400 text-center py-2">No category expenses recorded</Text>
                ) : (
                  categories.slice(0, 5).map((cat, idx) => (
                    <TouchableOpacity
                      key={cat.categoryId}
                      activeOpacity={0.7}
                      onPress={() => handleOpenCategory(cat)}
                      className="mb-4 last:mb-0 p-2.5 -mx-2.5 rounded-2xl active:bg-zinc-50"
                    >
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
                        <View className="flex-row items-center gap-2">
                          <View className="items-end">
                            <Text className="text-sm font-black text-zinc-900">
                              {formatMoney(cat.amountMinor)}
                            </Text>
                            <Text className="text-[10px] font-bold text-zinc-400">
                              {cat.percentage}% of total
                            </Text>
                          </View>
                          <ChevronRight size={14} color="#A1A1AA" />
                        </View>
                      </View>
                      <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.categoryColor || '#6366F1',
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </Card>

              {/* Subscription & Commitments */}
              <Text className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                Subscription & Upcoming Commitments
              </Text>
              <View className="flex-row gap-3 mb-5">
                <Card className="flex-1 p-4.5 bg-white border border-zinc-100 rounded-3xl shadow-xs">
                  <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center mb-2">
                    <CreditCard size={16} color="#6366F1" />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase">Monthly Subs</Text>
                  <Text className="text-[16px] font-extrabold text-zinc-950 mt-0.5">
                    {formatMoney(subsAnalytics?.monthlyTotalMinor || 0)}
                  </Text>
                  <Text className="text-[10px] font-medium text-zinc-400 mt-1">
                    Annual: {formatMoney(subsAnalytics?.annualTotalMinor || 0)}
                  </Text>
                </Card>

                <Card className="flex-1 p-4.5 bg-white border border-zinc-100 rounded-3xl shadow-xs">
                  <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center mb-2">
                    <Calendar size={16} color="#D97706" />
                  </View>
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase">Upcoming Bills</Text>
                  <Text className="text-[16px] font-extrabold text-zinc-950 mt-0.5">
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
      <AppBottomSheet
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        title="Export Statement"
        subtitle={`${period.replace('_', ' ').toUpperCase()} (${startDate} to ${endDate})`}
        scrollable={true}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {isExporting ? (
          <View className="py-12">
            <AppLoadingIndicator message={exportingMessage} />
          </View>
        ) : (
          <View>
            <View className="gap-3 mb-4">
              {/* Option 1: PDF Document (Primary / Recommended) */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isExporting}
                onPress={handleExportPDF}
                className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 flex-row items-center active:bg-indigo-100/80"
              >
                <View className="w-11 h-11 rounded-2xl bg-indigo-600 items-center justify-center mr-3 shadow-sm shadow-indigo-300">
                  <FileText size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-zinc-950">Financial Statement (PDF)</Text>
                    <View className="bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200/60">
                      <Text className="text-[9px] font-extrabold text-indigo-700 tracking-wider">RECOMMENDED</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-medium text-zinc-500 mt-0.5">
                    Beautiful executive statement with summary cards, charts & itemized ledger
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: CSV Spreadsheet */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isExporting}
                onPress={handleExportCSV}
                className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 flex-row items-center active:bg-zinc-100"
              >
                <View className="w-11 h-11 rounded-2xl bg-emerald-50 items-center justify-center mr-3 border border-emerald-100/60">
                  <FileSpreadsheet size={22} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-zinc-950">Transactions Spreadsheet (CSV)</Text>
                  <Text className="text-xs font-medium text-zinc-500 mt-0.5">
                    Itemized raw statement file compatible with Excel, Sheets & bookkeeping
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Quick Summary Plain Text */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isExporting}
                onPress={handleExportSummary}
                className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 flex-row items-center active:bg-zinc-100"
              >
                <View className="w-11 h-11 rounded-2xl bg-zinc-100 items-center justify-center mr-3 border border-zinc-200/60">
                  <Share2 size={20} color="#64748B" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-zinc-950">Quick Summary (Plain Text)</Text>
                  <Text className="text-xs font-medium text-zinc-500 mt-0.5">
                    Lightweight text breakdown for quick sharing or copy
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Button
              variant="outline"
              size="lg"
              className="mt-2 rounded-2xl border-zinc-200/90"
              onPress={() => setExportModalVisible(false)}
            >
              <Text className="text-zinc-700 font-bold text-sm">Cancel</Text>
            </Button>
          </View>
        )}
      </AppBottomSheet>

      {/* Category Breakdown Transactions Drilldown Modal */}
      <AppBottomSheet
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        title={selectedCategory ? `${selectedCategory.categoryName} Expenses` : 'Category Expenses'}
        subtitle={
          selectedCategory
            ? `${formatMoney(selectedCategory.amountMinor)} • ${selectedCategory.percentage}% of total expenses`
            : undefined
        }
        scrollable={true}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View>
          {loadingPeriodTxs ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="small" color="#09090B" />
              <Text className="text-xs text-zinc-400 font-medium mt-2">Loading transactions...</Text>
            </View>
          ) : categoryTransactions.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Text className="text-sm font-bold text-zinc-800">No transactions found</Text>
              <Text className="text-xs text-zinc-400 mt-1 text-center">
                No matching transactions recorded for this period.
              </Text>
            </View>
          ) : (
            <View className="mb-4">
              {categoryTransactions.map((tx: any) => {
                const accountName =
                  tx.account?.name ||
                  (Array.isArray(tx.account) && (tx.account as any)[0]?.name) ||
                  'Account';
                const isTransfer =
                  tx.type === 'transfer' ||
                  selectedCategory?.categoryName?.toLowerCase() === 'transfer';

                return (
                  <View key={tx.id} className="mb-2.5 bg-white rounded-2xl px-3.5 py-0.5 border border-zinc-100 shadow-xs">
                    <RecordRow
                      title={tx.description || 'Transaction'}
                      subtitle={`${formatDate(tx.date)} • ${accountName}`}
                      amount={`-${formatMoney(tx.amount_minor)}`}
                      isCredit={false}
                      icon={
                        isTransfer ? (
                          <ArrowRightLeft size={16} color="#4F46E5" strokeWidth={2.5} />
                        ) : undefined
                      }
                      iconBgColor={isTransfer ? '#EEF2FF' : selectedCategory?.categoryColor ? `${selectedCategory.categoryColor}15` : undefined}
                      iconColor={isTransfer ? '#4F46E5' : selectedCategory?.categoryColor || '#EF4444'}
                      onPress={() => {
                        setDetailTx(tx);
                        setDetailModalVisible(true);
                      }}
                      showDivider={false}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Action button to jump to Transactions screen */}
          <Button
            variant="outline"
            size="md"
            className="w-full rounded-2xl flex-row items-center justify-center border-zinc-200 mt-2"
            onPress={() => {
              const catName = selectedCategory?.categoryName;
              setCategoryModalVisible(false);
              if (catName) {
                useTabStore.getState().setPendingCategoryFilter(catName);
              }
              useTabStore.getState().requestScrollToTab(1);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
          >
            <Text className="text-zinc-900 font-bold text-xs mr-1.5">View in Transactions Tab</Text>
            <ArrowRight size={14} color="#18181B" />
          </Button>
        </View>
      </AppBottomSheet>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        visible={detailModalVisible}
        transaction={detailTx}
        account={detailTx?.account}
        category={selectedCategory ? { name: selectedCategory.categoryName, color: selectedCategory.categoryColor } : detailTx?.category}
        onClose={() => setDetailModalVisible(false)}
      />
    </SafeAreaView>
  );
}

