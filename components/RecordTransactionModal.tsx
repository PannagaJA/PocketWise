import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../context/AuthContext';
import { transactionService } from '../lib/services/transaction.service';
import { accountService } from '../lib/services/account.service';
import { categoryService } from '../lib/services/category.service';
import { parseMoneyToMinor } from '../lib/finance/core';

interface RecordTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  defaultAccountId?: string;
  onSuccess?: () => void;
}

export function RecordTransactionModal({
  visible,
  onClose,
  defaultAccountId,
  onSuccess,
}: RecordTransactionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedDestAccountId, setSelectedDestAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [destAccountDropdownOpen, setDestAccountDropdownOpen] = useState(false);

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id && visible,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => categoryService.getCategories(user?.id || ''),
    enabled: !!user?.id && visible,
  });

  useEffect(() => {
    if (visible) {
      if (defaultAccountId && accounts.some((a) => a.id === defaultAccountId)) {
        setSelectedAccountId(defaultAccountId);
      } else if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    }
  }, [visible, defaultAccountId, accounts, selectedAccountId]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (type === 'transfer' ? 'expense' : type)),
    [categories, type]
  );

  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);
  const selectedAccObj = accounts.find((a) => a.id === selectedAccountId);
  const selectedDestAccObj = accounts.find((a) => a.id === selectedDestAccountId);

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

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSelectedCategoryId('');
    setSelectedDestAccountId('');
    setCategoryDropdownOpen(false);
    setAccountDropdownOpen(false);
    setDestAccountDropdownOpen(false);
  };

  const createTxMutation = useMutation({
    mutationFn: async () => {
      const minorAmount = parseMoneyToMinor(amount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');
      if (!description.trim()) throw new Error('Description is required');
      if (!selectedAccountId) throw new Error('Source account must be selected');

      if (type === 'transfer') {
        if (!selectedDestAccountId || selectedAccountId === selectedDestAccountId) {
          throw new Error('Transfer requires a different destination account');
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
          description: description.trim(),
          date: new Date().toISOString().split('T')[0],
        },
        selectedDestAccountId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create transaction');
    },
  });

  return (
    <AppModal visible={visible} onClose={onClose} animationType="slide">
      <Pressable
        style={{ width: '100%', padding: 24, paddingBottom: 16 }}
        onPress={(e) => e.stopPropagation()}
      >
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-zinc-900">Record Transaction</Text>
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              onClose();
            }}
            className="p-1"
          >
            <X size={20} color="#71717A" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Type Selector */}
          <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-4">
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setType('expense');
                setSelectedCategoryId('');
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${type === 'expense' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-bold text-xs ${type === 'expense' ? 'text-rose-600' : 'text-zinc-500'}`}>
                Expense
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setType('income');
                setSelectedCategoryId('');
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${type === 'income' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-bold text-xs ${type === 'income' ? 'text-emerald-600' : 'text-zinc-500'}`}>
                Income
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setType('transfer');
                setSelectedCategoryId('');
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${type === 'transfer' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-bold text-xs ${type === 'transfer' ? 'text-indigo-600' : 'text-zinc-500'}`}>
                Transfer
              </Text>
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

          {/* Category Dropdown (Expense & Income) */}
          {type !== 'transfer' && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Category</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                }}
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
                          try { Haptics.selectionAsync(); } catch {}
                          setSelectedCategoryId(cat.id);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`flex-row justify-between items-center p-3 rounded-lg ${selectedCategoryId === cat.id ? 'bg-zinc-100' : ''}`}
                      >
                        <Text className={`text-sm ${selectedCategoryId === cat.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>
                          {cat.name}
                        </Text>
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
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setAccountDropdownOpen(!accountDropdownOpen);
              }}
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
                        try { Haptics.selectionAsync(); } catch {}
                        setSelectedAccountId(acc.id);
                        setAccountDropdownOpen(false);
                      }}
                      className={`flex-row justify-between items-center p-3 rounded-lg ${selectedAccountId === acc.id ? 'bg-zinc-100' : ''}`}
                    >
                      <Text className={`text-sm ${selectedAccountId === acc.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>
                        {acc.name}
                      </Text>
                      {selectedAccountId === acc.id && <Check size={16} color="#09090B" />}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Destination Account Dropdown for Transfer */}
          {type === 'transfer' && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">To Account</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setDestAccountDropdownOpen(!destAccountDropdownOpen);
                }}
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
                    {accounts
                      .filter((acc) => acc.id !== selectedAccountId)
                      .map((acc) => (
                        <Pressable
                          key={acc.id}
                          onPress={() => {
                            try { Haptics.selectionAsync(); } catch {}
                            setSelectedDestAccountId(acc.id);
                            setDestAccountDropdownOpen(false);
                          }}
                          className={`flex-row justify-between items-center p-3 rounded-lg ${selectedDestAccountId === acc.id ? 'bg-zinc-100' : ''}`}
                        >
                          <Text className={`text-sm ${selectedDestAccountId === acc.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>
                            {acc.name}
                          </Text>
                          {selectedDestAccountId === acc.id && <Check size={16} color="#09090B" />}
                        </Pressable>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Submit Button */}
          <View className="mt-2">
            <Button
              size="lg"
              variant={type === 'income' ? 'income' : 'primary'}
              onPress={() => createTxMutation.mutate()}
              loading={createTxMutation.isPending}
            >
              <Text className="text-white font-bold text-sm">
                Save {type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'}
              </Text>
            </Button>
          </View>
        </ScrollView>
      </Pressable>
    </AppModal>
  );
}
