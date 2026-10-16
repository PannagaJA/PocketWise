import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { AppLoadingIndicator } from './ui/AppLoadingIndicator';
import { AppSelectField } from './ui/AppSelectModal';
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
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title="Record Transaction"
      subtitle="Track your income, expense or account transfer"
      scrollable
      dismissOnBackdrop={!createTxMutation.isPending}
    >
      {createTxMutation.isPending ? (
        <AppLoadingIndicator
          message={`Saving ${type === 'income' ? 'income' : type === 'expense' ? 'expense' : 'transfer'}...`}
          subMessage="Updating your balance and transactions"
        />
      ) : (
        <View style={{ paddingBottom: 24 }}>
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

          {/* Amount Input */}
          <Input
            label="Amount (₹)"
            placeholder={currentPlaceholders.amount}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            containerClassName="mb-4"
          />

          {/* Description Input */}
          <Input
            label="Description / Merchant"
            placeholder={currentPlaceholders.description}
            value={description}
            onChangeText={setDescription}
            containerClassName="mb-4"
          />

          {/* Category Selector (Not for transfers) */}
          {type !== 'transfer' && (
            <AppSelectField
              label="Category"
              title="Select Category"
              subtitle="Choose a category for this transaction"
              value={selectedCategoryId}
              placeholder="Select Category (Optional)"
              allowClear={true}
              clearLabel="None (Uncategorized)"
              options={filteredCategories.map((cat) => ({
                value: cat.id,
                label: cat.name,
                color: cat.color,
              }))}
              onSelect={(catId) => setSelectedCategoryId(catId)}
            />
          )}

          {/* Account Selector */}
          <AppSelectField
            label={type === 'transfer' ? 'From Account' : 'Account'}
            title="Select Account"
            subtitle="Choose account for this transaction"
            value={selectedAccountId}
            placeholder="Select Account"
            options={accounts.map((acc) => ({
              value: acc.id,
              label: acc.name,
              color: acc.color,
              subLabel: acc.type ? `${acc.type.toUpperCase()} • ₹${((acc.balance || 0) / 100).toLocaleString('en-IN')}` : undefined,
            }))}
            onSelect={(accId) => setSelectedAccountId(accId)}
          />

          {/* Destination Account Selector for Transfer */}
          {type === 'transfer' && (
            <AppSelectField
              label="To Account"
              title="Select Destination Account"
              subtitle="Choose recipient account for this transfer"
              value={selectedDestAccountId}
              placeholder="Select Destination Account"
              options={accounts
                .filter((acc) => acc.id !== selectedAccountId)
                .map((acc) => ({
                  value: acc.id,
                  label: acc.name,
                  color: acc.color,
                  subLabel: acc.type ? `${acc.type.toUpperCase()} • ₹${((acc.balance || 0) / 100).toLocaleString('en-IN')}` : undefined,
                }))}
              onSelect={(accId) => setSelectedDestAccountId(accId)}
            />
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 rounded-2xl border-zinc-200/90"
              onPress={onClose}
            >
              <Text className="text-zinc-700 font-bold text-sm">Cancel</Text>
            </Button>

            <Button
              size="lg"
              variant={type === 'income' ? 'income' : type === 'expense' ? 'purple' : 'primary'}
              className="flex-1 rounded-2xl shadow-xs"
              onPress={() => createTxMutation.mutate()}
              loading={createTxMutation.isPending}
              disabled={createTxMutation.isPending}
            >
              <Text className="text-white font-bold text-sm">
                Save {type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'}
              </Text>
            </Button>
          </View>
        </View>
      )}
    </AppBottomSheet>
  );
}
