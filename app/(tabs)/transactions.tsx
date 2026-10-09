import React, { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, RefreshControl, TextInput, KeyboardAvoidingView, Platform, Keyboard, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AppModal } from '../../components/ui/AppModal';
import { useAuth } from '../../context/AuthContext';
import { transactionService, cleanTransactionDescription } from '../../lib/services/transaction.service';
import { supabase } from '../../lib/supabase';
import { accountService } from '../../lib/services/account.service';
import { categoryService } from '../../lib/services/category.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../../lib/finance/core';
import { DatePickerButton } from '../../components/ui/DatePickerModal';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { Plus, ArrowUpRight, ArrowDownLeft, X, ArrowRightLeft, ChevronDown, Check, Wallet, BarChart2, Filter, Search, Calendar, SlidersHorizontal, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type DateFilterMode = 'all' | 'today' | 'this_month' | 'last_month' | 'custom_month' | 'custom_range';

const TransactionItem = memo(function TransactionItem({
  tx,
  accountName,
  categoryName,
  onPress,
}: {
  tx: any;
  accountName: string;
  categoryName: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card className="mb-3 p-4 bg-white border border-zinc-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-3">
            <View
              className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${
                tx.type === 'income' ? 'bg-emerald-50' : tx.type === 'expense' ? 'bg-rose-50' : 'bg-indigo-50'
              }`}
            >
              {tx.type === 'income' ? (
                <ArrowDownLeft size={20} color="#10B981" />
              ) : tx.type === 'expense' ? (
                <ArrowUpRight size={20} color="#EF4444" />
              ) : (
                <ArrowRightLeft size={20} color="#6366F1" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-zinc-900" numberOfLines={1}>
                {cleanTransactionDescription(tx.description, categoryName, tx.type)}
              </Text>
              <Text className="text-xs text-zinc-500 mt-0.5">
                {categoryName} • {accountName}
              </Text>
            </View>
          </View>

          <View className="items-end">
            <Text
              className={`text-base font-extrabold ${
                tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-zinc-900' : 'text-indigo-600'
              }`}
            >
              {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
              {formatMoney(tx.amount_minor)}
            </Text>
            <Text className="text-xs text-zinc-400 mt-0.5">{formatDate(tx.date)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
});

export default function TransactionsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ add?: string; editId?: string }>();

  const [modalVisible, setModalVisible] = useState(false);
  const [accModalVisible, setAccModalVisible] = useState(false);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);

  useEffect(() => {
    if (params?.add === 'true') {
      setModalVisible(true);
    }
  }, [params?.add]);

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [destAccountDropdownOpen, setDestAccountDropdownOpen] = useState(false);

  // Search, Type, & Bank Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [selectedAccountFilterId, setSelectedAccountFilterId] = useState<string>('all');

  // Custom Date / Month Filter State
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [selectedCustomMonth, setSelectedCustomMonth] = useState<string>(''); // e.g. "2026-08"
  const [customStartDate, setCustomStartDate] = useState<string>(''); // e.g. "2026-08-01"
  const [customEndDate, setCustomEndDate] = useState<string>(''); // e.g. "2026-08-31"

  // Form state
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedDestAccountId, setSelectedDestAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Account creation state
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');

  // Data Queries
  const { data: transactions = [], isLoading: loadingTx, refetch: refetchTx } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => transactionService.getTransactions(user?.id || '', 500),
    enabled: !!user?.id,
  });

  const { data: accounts = [], isLoading: loadingAcc, refetch: refetchAcc } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => categoryService.getCategories(user?.id || ''),
    enabled: !!user?.id,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTx(), refetchAcc()]);
    setRefreshing(false);
  };



  // Apply search query, type filter, bank filter, and custom date/month filter (Memoized for high performance)
  const displayedTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesFilter = activeFilter === 'all' || t.type === activeFilter;
      const matchesAccountFilter = selectedAccountFilterId === 'all' || t.account_id === selectedAccountFilterId;

      // Date/Month Filtering
      let matchesDate = true;
      if (t.date && dateFilterMode !== 'all') {
        const txDateStr = t.date.substring(0, 10);
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const thisMonthStr = now.toISOString().substring(0, 7);

        if (dateFilterMode === 'today') {
          matchesDate = txDateStr === todayStr;
        } else if (dateFilterMode === 'this_month') {
          matchesDate = txDateStr.startsWith(thisMonthStr);
        } else if (dateFilterMode === 'last_month') {
          const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthStr = `${lastM.getFullYear()}-${String(lastM.getMonth() + 1).padStart(2, '0')}`;
          matchesDate = txDateStr.startsWith(lastMonthStr);
        } else if (dateFilterMode === 'custom_month' && selectedCustomMonth) {
          matchesDate = txDateStr.startsWith(selectedCustomMonth);
        } else if (dateFilterMode === 'custom_range') {
          if (customStartDate && txDateStr < customStartDate) matchesDate = false;
          if (customEndDate && txDateStr > customEndDate) matchesDate = false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesFilter && matchesDate && matchesAccountFilter;

      const matchesDesc = t.description.toLowerCase().includes(q);
      const categoryName = t.category?.name || (Array.isArray(t.category) && (t.category as any)[0]?.name) || '';
      const matchesCat = categoryName.toLowerCase().includes(q);
      const accountName =
        t.account?.name ||
        (Array.isArray(t.account) && (t.account as any)[0]?.name) ||
        accounts.find((a) => a.id === t.account_id)?.name ||
        '';
      const matchesAcc = accountName.toLowerCase().includes(q);

      const rupeesAmount = (t.amount_minor / 100).toString();
      const formattedMoneyStr = formatMoney(t.amount_minor).toLowerCase();
      const matchesAmount = rupeesAmount.includes(q) || formattedMoneyStr.includes(q);

      return matchesFilter && matchesDate && matchesAccountFilter && (matchesDesc || matchesCat || matchesAcc || matchesAmount);
    });
  }, [transactions, activeFilter, selectedAccountFilterId, dateFilterMode, selectedCustomMonth, customStartDate, customEndDate, searchQuery, accounts]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (type === 'transfer' ? 'expense' : type)),
    [categories, type]
  );
  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);
  const selectedAccObj = accounts.find((a) => a.id === selectedAccountId);
  const selectedDestAccObj = accounts.find((a) => a.id === selectedDestAccountId);

  // Calculate Breakdown for Unique Cashflow Bar Graph (Derived after active account and date filters)
  const { incomeTotal, expenseTotal, maxBar, incomeHeight, expenseHeight } = useMemo(() => {
    const relevantTxs = transactions.filter((t) => {
      if (selectedAccountFilterId !== 'all' && t.account_id !== selectedAccountFilterId) {
        return false;
      }
      if (dateFilterMode !== 'all' && t.date) {
        const txDateStr = t.date.substring(0, 10);
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const thisMonthStr = now.toISOString().substring(0, 7);
        if (dateFilterMode === 'today' && txDateStr !== todayStr) return false;
        if (dateFilterMode === 'this_month' && !txDateStr.startsWith(thisMonthStr)) return false;
        if (dateFilterMode === 'last_month') {
          const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthStr = `${lastM.getFullYear()}-${String(lastM.getMonth() + 1).padStart(2, '0')}`;
          if (!txDateStr.startsWith(lastMonthStr)) return false;
        }
        if (dateFilterMode === 'custom_month' && selectedCustomMonth && !txDateStr.startsWith(selectedCustomMonth)) return false;
        if (dateFilterMode === 'custom_range') {
          if (customStartDate && txDateStr < customStartDate) return false;
          if (customEndDate && txDateStr > customEndDate) return false;
        }
      }
      return true;
    });

    const inc = relevantTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount_minor, 0);
    const exp = relevantTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_minor, 0);
    const mb = Math.max(inc, exp, 1);
    const ih = Math.max(12, Math.round((inc / mb) * 44));
    const eh = Math.max(12, Math.round((exp / mb) * 44));
    return { incomeTotal: inc, expenseTotal: exp, maxBar: mb, incomeHeight: ih, expenseHeight: eh };
  }, [transactions, selectedAccountFilterId, dateFilterMode, selectedCustomMonth, customStartDate, customEndDate]);

  // View Transaction Detail State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<any>(null);

  // Edit & Delete Transaction State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editCategoryDropdownOpen, setEditCategoryDropdownOpen] = useState(false);
  const [editAccountDropdownOpen, setEditAccountDropdownOpen] = useState(false);

  const handleOpenDetailTx = useCallback((tx: any) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSelectedDetailTx(tx);
    setDetailModalVisible(true);
  }, []);

  const handleOpenEditTx = useCallback((tx: any) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEditingTx(tx);
    setEditDescription(tx.description || '');
    setEditAmount((tx.amount_minor / 100).toString());
    setEditDate(tx.date || new Date().toISOString().substring(0, 10));
    setEditAccountId(tx.account_id || '');
    setEditCategoryId(tx.category_id || '');
    setEditCategoryDropdownOpen(false);
    setEditAccountDropdownOpen(false);
    setEditModalVisible(true);
  }, []);

  const handledEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (params?.editId && params.editId !== handledEditIdRef.current && transactions.length > 0) {
      const txToEdit = transactions.find((t) => t.id === params.editId);
      if (txToEdit) {
        handledEditIdRef.current = params.editId;
        handleOpenEditTx(txToEdit);
      }
    } else if (!params?.editId) {
      handledEditIdRef.current = null;
    }
  }, [params?.editId, transactions, handleOpenEditTx]);

  const renderItem = useCallback(
    ({ item: tx }: { item: any }) => {
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
        <TransactionItem
          tx={tx}
          accountName={accountName}
          categoryName={categoryName}
          onPress={() => handleOpenDetailTx(tx)}
        />
      );
    },
    [accounts, handleOpenDetailTx]
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  const getPlaceholders = () => {
    switch (type) {
      case 'expense':
        return {
          description: 'e.g. Groceries at Supermarket, Coffee, Uber ride',
          amount: 'e.g. 450.00',
        };
      case 'income':
        return {
          description: 'e.g. Monthly Salary, Freelance Payment, Dividend',
          amount: 'e.g. 55,000.00',
        };
      case 'transfer':
        return {
          description: 'e.g. Transfer to Savings, ATM Cash Withdrawal',
          amount: 'e.g. 5,000.00',
        };
    }
  };

  const updateTxMutation = useMutation({
    mutationFn: async () => {
      if (!editingTx) return;
      const minorAmount = parseMoneyToMinor(editAmount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');
      if (!editDescription.trim()) throw new Error('Description is required');

      if (editingTx.transfer_group_id) {
        if (minorAmount !== editingTx.amount_minor || (editAccountId && editAccountId !== editingTx.account_id)) {
          throw new Error('Transfer amount and accounts cannot be modified individually. Please delete and recreate the transfer.');
        }
        return transactionService.updateTransaction(editingTx.id, {
          description: editDescription.trim(),
          category_id: editCategoryId || undefined,
          date: editDate,
        });
      }

      return transactionService.updateTransaction(editingTx.id, {
        description: editDescription.trim(),
        amount_minor: minorAmount,
        category_id: editCategoryId || undefined,
        account_id: editAccountId || editingTx.account_id,
        date: editDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setEditModalVisible(false);
      setEditingTx(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update transaction');
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      if (editingTx?.transfer_group_id) {
        const { data, error } = await supabase
          .from('transactions')
          .delete()
          .eq('transfer_group_id', editingTx.transfer_group_id)
          .select('id');
        if (error) {
          throw new Error(error.message);
        }
        if (!data || data.length === 0) {
          throw new Error('No transactions found to delete');
        }
        return data.map((d: any) => d.id);
      }
      await transactionService.deleteTransaction(id, true);
      return [id];
    },
    onSuccess: (deletedIds) => {
      if (!deletedIds || deletedIds.length === 0) return;
      queryClient.invalidateQueries();
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setEditModalVisible(false);
      setDetailModalVisible(false);
      setEditingTx(null);
      setSelectedDetailTx(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete transaction');
    },
  });

  const confirmDeleteTx = (txToDel?: any) => {
    const target = txToDel || editingTx;
    if (!target) return;
    setEditingTx(target);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    Alert.alert(
      'Delete Transaction?',
      `Are you sure you want to delete this ${formatMoney(target.amount_minor)} transaction? Account balance will be restored automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTxMutation.mutate(target.id),
        },
      ]
    );
  };

  const currentPlaceholders = getPlaceholders();

  // Label Helper for Filter Button
  const isFilterActive = dateFilterMode !== 'all' || selectedAccountFilterId !== 'all';

  const getDateFilterLabel = () => {
    switch (dateFilterMode) {
      case 'today':
        return 'Today';
      case 'this_month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'custom_range':
        return 'Custom Range';
      default:
        return 'Date Filter';
    }
  };

  const getFilterButtonLabel = () => {
    const selectedAcc = accounts.find((a) => a.id === selectedAccountFilterId);
    const dateLabel = dateFilterMode !== 'all' ? getDateFilterLabel() : null;
    const accLabel = selectedAccountFilterId !== 'all' ? (selectedAcc ? selectedAcc.name : 'Bank') : null;

    if (dateLabel && accLabel) {
      return `${dateLabel} • ${accLabel}`;
    }
    if (dateLabel) return dateLabel;
    if (accLabel) return accLabel;
    return 'Filter';
  };

  // Mutations
  const createTxMutation = useMutation({
    mutationFn: async () => {
      const minorAmount = parseMoneyToMinor(amount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');
      if (!description.trim()) throw new Error('Description is required');
      if (!selectedAccountId) throw new Error('Source account must be selected');

      if (type === 'transfer') {
        if (!selectedDestAccountId || selectedAccountId === selectedDestAccountId) {
          throw new Error('Transfer requires different destination account');
        }
      }

      return transactionService.createTransaction(
        {
          user_id: user!.id,
          account_id: selectedAccountId,
          type,
          amount_minor: minorAmount,
          currency: 'INR',
          category_id: selectedCategoryId || undefined,
          description,
          date: new Date().toISOString().split('T')[0],
        },
        selectedDestAccountId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setModalVisible(false);
      resetForm();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create transaction');
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!accName.trim()) throw new Error('Account name is required');
      const minorBalance = parseMoneyToMinor(accBalance);
      return accountService.createAccount({
        user_id: user!.id,
        name: accName,
        type: 'bank',
        balance: minorBalance,
        currency: 'INR',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setAccModalVisible(false);
      setAccName('');
      setAccBalance('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create account');
    },
  });

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSelectedAccountId(accounts[0]?.id || '');
    setSelectedDestAccountId('');
    setSelectedCategoryId('');
    setCategoryDropdownOpen(false);
    setAccountDropdownOpen(false);
    setDestAccountDropdownOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="mb-3">
          <Text className="text-2xl font-black text-zinc-900">Transactions</Text>
          <Text className="text-xs text-zinc-500 mt-0.5 mb-3">Real-time financial activity</Text>

          {/* Unique Cashflow Breakdown Card with Dual Bar Chart */}
          <Card className="bg-zinc-900 border-zinc-800 p-5 mb-3.5 rounded-3xl overflow-hidden shadow-md">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 items-center justify-center">
                  <BarChart2 size={16} color="#818CF8" />
                </View>
                <Text className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                  Cashflow Ratio
                </Text>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-[11px] font-bold text-emerald-400">Income</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <Text className="text-[11px] font-bold text-rose-400">Expenses</Text>
                </View>
              </View>
            </View>

            {/* Custom SVG Dual Volume Bar Chart */}
            <View className="flex-row items-center justify-between bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80 gap-3">
              <View className="flex-1 pr-2">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Inflow vs Outflow</Text>
                <View className="flex-row justify-between items-center gap-2">
                  <View>
                    <Text className="text-[10px] text-zinc-500">Inflow</Text>
                    <Text className="text-sm font-black text-emerald-400">{formatMoney(incomeTotal)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-zinc-500">Outflow</Text>
                    <Text className="text-sm font-black text-rose-400">{formatMoney(expenseTotal)}</Text>
                  </View>
                </View>
              </View>

              <View className="w-24 h-12 flex-row justify-around items-end">
                <Svg height="48" width="80" viewBox="0 0 80 48">
                  <Defs>
                    <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#10B981" stopOpacity="1" />
                      <Stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
                    </LinearGradient>
                    <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#EF4444" stopOpacity="1" />
                      <Stop offset="100%" stopColor="#DC2626" stopOpacity="0.8" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="12" y={48 - incomeHeight} width="22" height={incomeHeight} rx="6" fill="url(#incomeGrad)" />
                  <Rect x="46" y={48 - expenseHeight} width="22" height={expenseHeight} rx="6" fill="url(#expenseGrad)" />
                </Svg>
              </View>
            </View>
          </Card>

          {/* Search Bar Input & Custom Date/Month Filter Button on the Same Line */}
          <View className="flex-row items-center gap-2 mb-3">
            {/* Search Bar */}
            <View className="flex-1 flex-row items-center bg-white border border-zinc-200 rounded-2xl px-3.5 py-2.5 shadow-sm">
              <Search size={18} color="#71717A" />
              <TextInput
                placeholder="Search description, category..."
                placeholderTextColor="#A1A1AA"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-sm font-medium text-zinc-900 p-0 ml-2"
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} className="p-1">
                  <X size={16} color="#71717A" />
                </Pressable>
              ) : null}
            </View>

            {/* Custom Filter Button */}
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setDateFilterModalVisible(true);
              }}
              style={{ maxWidth: 140 }}
              className={`flex-row items-center gap-1.5 py-2.5 px-3 rounded-2xl border ${
                isFilterActive
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <SlidersHorizontal size={16} color={isFilterActive ? '#FFF' : '#09090B'} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className={`text-xs font-bold shrink ${isFilterActive ? 'text-white' : 'text-zinc-900'}`}
              >
                {getFilterButtonLabel()}
              </Text>
              {isFilterActive ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setDateFilterMode('all');
                    setSelectedAccountFilterId('all');
                  }}
                  className="ml-0.5"
                >
                  <X size={14} color="#FFF" />
                </Pressable>
              ) : (
                <ChevronDown size={14} color="#71717A" />
              )}
            </Pressable>
          </View>

          {/* Filter Pills */}
          <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-3">
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveFilter('all');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeFilter === 'all' ? 'bg-white' : ''}`}
            >
              <Text className={`font-semibold text-xs ${activeFilter === 'all' ? 'text-zinc-900' : 'text-zinc-500'}`}>All</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveFilter('income');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeFilter === 'income' ? 'bg-white' : ''}`}
            >
              <Text className={`font-semibold text-xs ${activeFilter === 'income' ? 'text-emerald-600' : 'text-zinc-500'}`}>Income</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveFilter('expense');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeFilter === 'expense' ? 'bg-white' : ''}`}
            >
              <Text className={`font-semibold text-xs ${activeFilter === 'expense' ? 'text-rose-600' : 'text-zinc-500'}`}>Expense</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveFilter('transfer');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeFilter === 'transfer' ? 'bg-white' : ''}`}
            >
              <Text className={`font-semibold text-xs ${activeFilter === 'transfer' ? 'text-indigo-600' : 'text-zinc-500'}`}>Transfer</Text>
            </Pressable>
          </View>

          {/* Action Row */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setAccModalVisible(true);
              }}
              className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-white border border-zinc-200 rounded-xl active:bg-zinc-100 shadow-sm"
            >
              <Wallet size={16} color="#09090B" />
              <Text className="text-zinc-900 font-bold text-xs ml-1.5">Account</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setSelectedAccountId(accounts[0]?.id || '');
                setModalVisible(true);
              }}
              className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-zinc-900 rounded-xl active:bg-zinc-800 shadow-sm"
            >
              <Plus size={16} color="#FFF" />
              <Text className="text-white font-bold text-xs ml-1.5">Transaction</Text>
            </Pressable>
          </View>
        </View>

        {/* Transactions Virtualized List */}
        {loadingTx ? (
          <View className="py-8">
            <ActivityIndicator size="small" color="#09090B" />
          </View>
        ) : (
          <FlatList
            data={displayedTransactions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 110 }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#09090B']} />
            }
            ListEmptyComponent={
              <Card className="p-6 bg-white border border-zinc-200 items-center mt-2 rounded-2xl">
                <View className="w-12 h-12 rounded-full bg-zinc-100 items-center justify-center mb-2">
                  <Filter size={20} color="#71717A" />
                </View>
                <Text className="text-sm font-bold text-zinc-800">
                  {searchQuery || isFilterActive ? 'No matching transactions' : `No ${activeFilter === 'all' ? '' : activeFilter} transactions found`}
                </Text>
                <Text className="text-xs text-zinc-400 mt-0.5 mb-4 text-center">
                  {searchQuery
                    ? `No transactions matched "${searchQuery}".`
                    : isFilterActive
                    ? `No transactions match the selected filter criteria.`
                    : activeFilter === 'all'
                    ? 'Record your first transaction to get started!'
                    : `No transactions matched the "${activeFilter}" filter.`}
                </Text>
                {searchQuery || activeFilter !== 'all' || isFilterActive ? (
                  <Button size="sm" variant="outline" onPress={() => { setSearchQuery(''); setActiveFilter('all'); setDateFilterMode('all'); setSelectedAccountFilterId('all'); }}>
                    <Text className="text-zinc-900 font-semibold text-xs">Clear Search & Filters</Text>
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
                    <Text className="text-white font-semibold text-xs">Record Transaction</Text>
                  </Button>
                )}
              </Card>
            }
          />
        )}
      </View>

      {/* Custom Date / Month / Bank Filter Modal */}
      <AppModal
        visible={dateFilterModalVisible}
        onClose={() => setDateFilterModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          style={{ width: '100%', padding: 24, paddingBottom: 12 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                <SlidersHorizontal size={18} color="#6366F1" />
              </View>
              <Text className="text-xl font-bold text-zinc-900">Filter Transactions</Text>
            </View>
            <Pressable onPress={() => setDateFilterModalVisible(false)} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {/* Presets Section */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Quick Presets</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {[
                { mode: 'all', label: 'All Time' },
                { mode: 'today', label: 'Today' },
                { mode: 'this_month', label: 'This Month' },
                { mode: 'last_month', label: 'Last Month' },
              ].map((item) => {
                const isSelected = dateFilterMode === item.mode;
                return (
                  <Pressable
                    key={item.mode}
                    onPress={() => {
                      try { Haptics.selectionAsync(); } catch {}
                      setDateFilterMode(item.mode as DateFilterMode);
                    }}
                    className={`px-4 py-2.5 rounded-xl border ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-900'
                        : 'bg-zinc-50 border-zinc-200 active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Date Range Section */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Custom Date Range</Text>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <DatePickerButton
                  label="Start Date"
                  value={customStartDate}
                  placeholder="Pick a start date"
                  onSelectDate={(val) => {
                    setCustomStartDate(val);
                    if (val) setDateFilterMode('custom_range');
                  }}
                />
              </View>
              <View className="flex-1">
                <DatePickerButton
                  label="End Date"
                  value={customEndDate}
                  placeholder="Pick an end date"
                  onSelectDate={(val) => {
                    setCustomEndDate(val);
                    if (val) setDateFilterMode('custom_range');
                  }}
                />
              </View>
            </View>

            {/* Bank / Account Filter Section */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Bank / Account</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              <Pressable
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setSelectedAccountFilterId('all');
                }}
                className={`px-4 py-2.5 rounded-xl border ${
                  selectedAccountFilterId === 'all'
                    ? 'bg-zinc-900 border-zinc-900'
                    : 'bg-zinc-50 border-zinc-200 active:bg-zinc-100'
                }`}
              >
                <Text className={`text-xs font-bold ${selectedAccountFilterId === 'all' ? 'text-white' : 'text-zinc-800'}`}>
                  All Accounts
                </Text>
              </Pressable>
              {accounts.map((acc) => {
                const isSelected = selectedAccountFilterId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      try { Haptics.selectionAsync(); } catch {}
                      setSelectedAccountFilterId(acc.id);
                    }}
                    className={`px-4 py-2.5 rounded-xl border ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-900'
                        : 'bg-zinc-50 border-zinc-200 active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {acc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Modal Actions */}
          <View className="flex-row gap-3 mt-3">
            <Button
              variant="outline"
              size="md"
              className="flex-1 border-zinc-200"
              onPress={() => {
                setDateFilterMode('all');
                setSelectedCustomMonth('');
                setCustomStartDate('');
                setCustomEndDate('');
                setSelectedAccountFilterId('all');
                setDateFilterModalVisible(false);
              }}
            >
              <Text className="text-zinc-800 font-bold text-xs">Reset All</Text>
            </Button>

            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onPress={() => {
                setDateFilterModalVisible(false);
              }}
            >
              <Text className="text-white font-bold text-xs">Apply Filter</Text>
            </Button>
          </View>
        </Pressable>
      </AppModal>

      {/* Transaction Creation Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          style={{ width: '100%', padding: 24, paddingBottom: 12 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-zinc-900">Record Transaction</Text>
            <Pressable onPress={() => setModalVisible(false)} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-4">
              <Pressable
                onPress={() => setType('expense')}
                className={`flex-1 py-2 rounded-xl items-center ${type === 'expense' ? 'bg-white' : ''}`}
              >
                <Text className={`font-semibold text-xs ${type === 'expense' ? 'text-rose-600' : 'text-zinc-500'}`}>Expense</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('income')}
                className={`flex-1 py-2 rounded-xl items-center ${type === 'income' ? 'bg-white' : ''}`}
              >
                <Text className={`font-semibold text-xs ${type === 'income' ? 'text-emerald-600' : 'text-zinc-500'}`}>Income</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('transfer')}
                className={`flex-1 py-2 rounded-xl items-center ${type === 'transfer' ? 'bg-white' : ''}`}
              >
                <Text className={`font-semibold text-xs ${type === 'transfer' ? 'text-indigo-600' : 'text-zinc-500'}`}>Transfer</Text>
              </Pressable>
            </View>

            <Input
              label="Description"
              placeholder={currentPlaceholders.description}
              value={description}
              onChangeText={setDescription}
            />

            <Input
              label="Amount (₹)"
              placeholder={currentPlaceholders.amount}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            {type !== 'transfer' && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Category</Text>
                <Pressable
                  onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
                >
                  <Text className={`text-sm ${selectedCatObj ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    {selectedCatObj ? selectedCatObj.name : 'Select a Category'}
                  </Text>
                  <ChevronDown size={18} color="#71717A" />
                </Pressable>

                {categoryDropdownOpen && (
                  <View className="mt-1 bg-white border border-zinc-200 rounded-xl max-h-48 overflow-hidden shadow-sm">
                    <ScrollView nestedScrollEnabled className="p-1">
                      {filteredCategories.map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => {
                            setSelectedCategoryId(cat.id);
                            setCategoryDropdownOpen(false);
                          }}
                          className={`flex-row justify-between items-center p-3 rounded-lg ${selectedCategoryId === cat.id ? 'bg-zinc-100' : ''}`}
                        >
                          <Text className={`text-sm ${selectedCategoryId === cat.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>{cat.name}</Text>
                          {selectedCategoryId === cat.id && <Check size={16} color="#09090B" />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">
                {type === 'transfer' ? 'From Account' : 'Account'}
              </Text>
              <Pressable
                onPress={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
              >
                <Text className={`text-sm ${selectedAccObj ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                  {selectedAccObj ? selectedAccObj.name : 'Select Account'}
                </Text>
                <ChevronDown size={18} color="#71717A" />
              </Pressable>

              {accountDropdownOpen && (
                <View className="mt-1 bg-white border border-zinc-200 rounded-xl max-h-48 overflow-hidden shadow-sm">
                  <ScrollView nestedScrollEnabled className="p-1">
                    {accounts.map((acc) => (
                      <Pressable
                        key={acc.id}
                        onPress={() => {
                          setSelectedAccountId(acc.id);
                          setAccountDropdownOpen(false);
                        }}
                        className={`flex-row justify-between items-center p-3 rounded-lg ${selectedAccountId === acc.id ? 'bg-zinc-100' : ''}`}
                      >
                        <Text className={`text-sm ${selectedAccountId === acc.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>{acc.name}</Text>
                        {selectedAccountId === acc.id && <Check size={16} color="#09090B" />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {type === 'transfer' && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">To Account</Text>
                <Pressable
                  onPress={() => setDestAccountDropdownOpen(!destAccountDropdownOpen)}
                  className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
                >
                  <Text className={`text-sm ${selectedDestAccObj ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    {selectedDestAccObj ? selectedDestAccObj.name : 'Select Destination Account'}
                  </Text>
                  <ChevronDown size={18} color="#71717A" />
                </Pressable>

                {destAccountDropdownOpen && (
                  <View className="mt-1 bg-white border border-zinc-200 rounded-xl max-h-48 overflow-hidden shadow-sm">
                    <ScrollView nestedScrollEnabled className="p-1">
                      {accounts.map((acc) => (
                        <Pressable
                          key={acc.id}
                          onPress={() => {
                            setSelectedDestAccountId(acc.id);
                            setDestAccountDropdownOpen(false);
                          }}
                          className={`flex-row justify-between items-center p-3 rounded-lg ${selectedDestAccountId === acc.id ? 'bg-zinc-100' : ''}`}
                        >
                          <Text className={`text-sm ${selectedDestAccountId === acc.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>{acc.name}</Text>
                          {selectedDestAccountId === acc.id && <Check size={16} color="#09090B" />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            <Button
              variant={type === 'income' ? 'income' : type === 'expense' ? 'destructive' : 'primary'}
              size="lg"
              loading={createTxMutation.isPending}
              className="mt-2 mb-4"
              onPress={() => createTxMutation.mutate()}
            >
              <Text className="text-white font-semibold">{type === 'income' ? 'Save INCOME' : type === 'expense' ? 'Save EXPENSE' : 'Save TRANSFER'}</Text>
            </Button>
          </ScrollView>
        </Pressable>
      </AppModal>

      {/* Account Creation Modal */}
      <AppModal
        visible={accModalVisible}
        onClose={() => setAccModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          style={{ width: '100%', padding: 24, paddingBottom: 12 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-zinc-900">Create Account</Text>
            <Pressable onPress={() => setAccModalVisible(false)} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            <Input
              label="Account Name"
              placeholder="e.g. HDFC Savings, Cash Wallet"
              value={accName}
              onChangeText={setAccName}
            />

            <Input
              label="Initial Balance (₹)"
              placeholder="e.g. 10000.00"
              keyboardType="numeric"
              value={accBalance}
              onChangeText={setAccBalance}
            />

            <Button
              variant="primary"
              size="lg"
              loading={createAccountMutation.isPending}
              className="mt-2"
              onPress={() => createAccountMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Account</Text>
            </Button>
          </ScrollView>
        </Pressable>
      </AppModal>

      {/* Edit & Delete Transaction Modal */}
      <AppModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        animationType="slide"
      >
        <Pressable
          style={{ width: '100%', padding: 24, paddingBottom: 12 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-zinc-100 items-center justify-center">
                <Pencil size={16} color="#18181B" />
              </View>
              <Text className="text-xl font-bold text-zinc-900">Edit Transaction</Text>
            </View>
            <Pressable onPress={() => setEditModalVisible(false)} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <Input
              label="Amount (₹)"
              placeholder="0.00"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />

            <Input
              label="Description"
              placeholder="e.g. Dinner, Grocery"
              value={editDescription}
              onChangeText={setEditDescription}
            />

            {/* Date Selector */}
            <View className="mb-4">
              <DatePickerButton
                label="Date"
                value={editDate}
                placeholder="Pick transaction date"
                onSelectDate={(val) => {
                  if (val) setEditDate(val);
                }}
              />
            </View>

            {/* Account Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Account</Text>
              <Pressable
                onPress={() => {
                  setEditAccountDropdownOpen(!editAccountDropdownOpen);
                  setEditCategoryDropdownOpen(false);
                }}
                className="flex-row items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl"
              >
                <Text className="text-sm font-semibold text-zinc-900">
                  {accounts.find((a) => a.id === editAccountId)?.name || 'Select Account'}
                </Text>
                <ChevronDown size={18} color="#71717A" />
              </Pressable>

              {editAccountDropdownOpen && (
                <View className="mt-2 p-2 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                  {accounts.map((acc) => (
                    <Pressable
                      key={acc.id}
                      onPress={() => {
                        setEditAccountId(acc.id);
                        setEditAccountDropdownOpen(false);
                      }}
                      className="flex-row items-center justify-between p-2.5 rounded-xl active:bg-zinc-50"
                    >
                      <Text className="text-sm font-medium text-zinc-800">{acc.name}</Text>
                      {editAccountId === acc.id && <Check size={16} color="#6366F1" />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Category Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Category</Text>
              <Pressable
                onPress={() => {
                  setEditCategoryDropdownOpen(!editCategoryDropdownOpen);
                  setEditAccountDropdownOpen(false);
                }}
                className="flex-row items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl"
              >
                <Text className="text-sm font-semibold text-zinc-900">
                  {categories.find((c) => c.id === editCategoryId)?.name || 'General / Uncategorized'}
                </Text>
                <ChevronDown size={18} color="#71717A" />
              </Pressable>

              {editCategoryDropdownOpen && (
                <View className="mt-2 p-2 bg-white border border-zinc-200 rounded-2xl shadow-sm max-h-48">
                  <ScrollView nestedScrollEnabled>
                    {categories
                      .filter((cat) => !editingTx?.type || editingTx.type === 'transfer' || cat.type === editingTx.type)
                      .map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => {
                            setEditCategoryId(cat.id);
                            setEditCategoryDropdownOpen(false);
                          }}
                          className="flex-row items-center justify-between p-2.5 rounded-xl active:bg-zinc-50"
                        >
                          <Text className="text-sm font-medium text-zinc-800">{cat.name}</Text>
                          {editCategoryId === cat.id && <Check size={16} color="#6366F1" />}
                        </Pressable>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View className="flex-row gap-3 mt-3">
              <Button
                variant="outline"
                size="lg"
                loading={deleteTxMutation.isPending}
                className="flex-1 border-rose-200 bg-rose-50/50"
                onPress={confirmDeleteTx}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text className="text-rose-600 font-bold ml-1.5">Delete</Text>
              </Button>

              <Button
                variant="primary"
                size="lg"
                loading={updateTxMutation.isPending}
                className="flex-1"
                onPress={() => updateTxMutation.mutate()}
              >
                <Text className="text-white font-bold">Save</Text>
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </AppModal>

      {/* Transaction Details View Modal */}
      <TransactionDetailModal
        visible={detailModalVisible}
        transaction={selectedDetailTx}
        account={accounts.find((a) => a.id === selectedDetailTx?.account_id)}
        category={categories.find((c) => c.id === selectedDetailTx?.category_id)}
        onClose={() => setDetailModalVisible(false)}
        onEdit={(tx) => {
          setDetailModalVisible(false);
          handleOpenEditTx(tx);
        }}
        onDelete={(tx) => {
          setDetailModalVisible(false);
          confirmDeleteTx(tx);
        }}
      />
    </SafeAreaView>
  );
}
