import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { transactionService } from '../../lib/services/transaction.service';
import { accountService } from '../../lib/services/account.service';
import { categoryService } from '../../lib/services/category.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, X, ArrowRightLeft, ChevronDown, Check, Wallet, BarChart2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function TransactionsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [accModalVisible, setAccModalVisible] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [destAccountDropdownOpen, setDestAccountDropdownOpen] = useState(false);

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
    queryFn: () => transactionService.getTransactions(user?.id || ''),
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

  const filteredCategories = categories.filter((c) => c.type === (type === 'transfer' ? 'expense' : type));
  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);
  const selectedAccObj = accounts.find((a) => a.id === selectedAccountId);
  const selectedDestAccObj = accounts.find((a) => a.id === selectedDestAccountId);

  // Calculate Breakdown for Unique Cashflow Bar Graph
  const incomeTotal = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount_minor, 0);
  const expenseTotal = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount_minor, 0);
  const maxBar = Math.max(incomeTotal, expenseTotal, 1);
  const incomeHeight = Math.max(12, Math.round((incomeTotal / maxBar) * 44));
  const expenseHeight = Math.max(12, Math.round((expenseTotal / maxBar) * 44));

  // Dynamic Placeholder Helper based on selected tab
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

  const currentPlaceholders = getPlaceholders();

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
      } catch {
        // Ignore haptics error if unavailable
      }
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
      } catch {
        // Ignore haptics error if unavailable
      }
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
        <View className="mb-4">
          <Text className="text-2xl font-black text-zinc-900">Transactions</Text>
          <Text className="text-xs text-zinc-500 mt-0.5 mb-3">Real-time financial activity</Text>

          {/* Unique Cashflow Breakdown Card with Dual Bar Chart */}
          <Card className="bg-zinc-900 border-zinc-800 p-5 mb-4 rounded-3xl overflow-hidden shadow-md">
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
                  {/* Income Bar */}
                  <Rect
                    x="12"
                    y={48 - incomeHeight}
                    width="22"
                    height={incomeHeight}
                    rx="6"
                    fill="url(#incomeGrad)"
                  />
                  {/* Expense Bar */}
                  <Rect
                    x="46"
                    y={48 - expenseHeight}
                    width="22"
                    height={expenseHeight}
                    rx="6"
                    fill="url(#expenseGrad)"
                  />
                </Svg>
              </View>
            </View>
          </Card>

          {/* Action Row */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
                setAccModalVisible(true);
              }}
              className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-white border border-zinc-200 rounded-xl active:bg-zinc-100 shadow-sm"
            >
              <Wallet size={16} color="#09090B" />
              <Text className="text-zinc-900 font-bold text-xs ml-1.5">+ Account</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
                setSelectedAccountId(accounts[0]?.id || '');
                setModalVisible(true);
              }}
              className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-zinc-900 rounded-xl active:bg-zinc-800 shadow-sm"
            >
              <Plus size={16} color="#FFF" />
              <Text className="text-white font-bold text-xs ml-1.5">+ Transaction</Text>
            </Pressable>
          </View>
        </View>

        {/* Transactions List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#09090B']} />
          }
        >
          {loadingTx ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : transactions.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-4">
              <Text className="text-sm font-semibold text-zinc-700">No transactions recorded</Text>
              <Text className="text-xs text-zinc-400 mt-1 mb-4 text-center">
                Create an account and record your first income or expense!
              </Text>
              <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
                <Text className="text-white font-semibold text-xs">+ Record Transaction</Text>
              </Button>
            </Card>
          ) : (
            transactions.map((tx) => (
              <Card key={tx.id} className="mb-3 p-4 bg-white border border-zinc-200">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${
                      tx.type === 'income' ? 'bg-emerald-50' : tx.type === 'expense' ? 'bg-rose-50' : 'bg-indigo-50'
                    }`}>
                      {tx.type === 'income' ? (
                        <ArrowDownLeft size={20} color="#10B981" />
                      ) : tx.type === 'expense' ? (
                        <ArrowUpRight size={20} color="#EF4444" />
                      ) : (
                        <ArrowRightLeft size={20} color="#6366F1" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-zinc-900" numberOfLines={1}>{tx.description}</Text>
                      <Text className="text-xs text-zinc-500 mt-0.5">
                        {tx.category?.name || 'General'} • {tx.account?.name || 'Account'}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className={`text-base font-extrabold ${
                      tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-zinc-900' : 'text-indigo-600'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatMoney(tx.amount_minor)}
                    </Text>
                    <Text className="text-xs text-zinc-400 mt-0.5">{formatDate(tx.date)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      {/* Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Record Transaction</Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type selector */}
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

              {/* Category Dropdown */}
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

              {/* Account Dropdown */}
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

              {/* Destination Account for Transfer */}
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
          </View>
        </View>
      </Modal>

      {/* Account Creation Modal */}
      <Modal visible={accModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Create Account</Text>
              <Pressable onPress={() => setAccModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

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
              className="mt-2 mb-4"
              onPress={() => createAccountMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Account</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
