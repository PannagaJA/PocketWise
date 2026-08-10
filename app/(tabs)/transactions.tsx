import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { transactionService } from '../../lib/services/transaction.service';
import { accountService } from '../../lib/services/account.service';
import { categoryService } from '../../lib/services/category.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, ArrowUpRight, ArrowDownLeft, X, ArrowRightLeft, ChevronDown, Check } from 'lucide-react-native';
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
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-2xl font-black text-zinc-900">Transactions</Text>
            <Text className="text-xs text-zinc-500 mt-0.5">Real-time financial activity</Text>
          </View>

          <View className="flex-row space-x-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setAccModalVisible(true)}
            >
              <Text className="text-zinc-900 font-semibold text-xs">+ Account</Text>
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-row space-x-1"
              onPress={() => {
                setSelectedAccountId(accounts[0]?.id || '');
                setModalVisible(true);
              }}
            >
              <Plus size={16} color="#FFF" />
              <Text className="text-white font-semibold text-xs">Add New</Text>
            </Button>
          </View>
        </View>

        {/* Transactions List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
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
                placeholder="e.g. Salary credited"
                value={description}
                onChangeText={setDescription}
              />

              <Input
                label="Amount (₹)"
                placeholder="0.00"
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
              placeholder="0.00"
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
