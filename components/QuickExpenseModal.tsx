import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, Check, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { transactionService } from '../lib/services/transaction.service';
import { accountService } from '../lib/services/account.service';
import { categoryService } from '../lib/services/category.service';
import { parseMoneyToMinor } from '../lib/finance/core';
import { shakeService } from '../lib/shake/shakeService';

export function QuickExpenseModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => categoryService.getCategories(user?.id || ''),
    enabled: !!user?.id,
  });

  // Ensure 'Others' option is always available in category list
  const expenseCategories = React.useMemo(() => {
    const list = categories.filter((c) => c.type === 'expense');
    if (!list.some((c) => c.name.toLowerCase().includes('other'))) {
      return [...list, { id: 'cat_others', name: 'Others', type: 'expense' as const, user_id: user?.id || '' }];
    }
    return list;
  }, [categories, user?.id]);

  useEffect(() => {
    // Subscribe to in-app shake events
    const unsubscribe = shakeService.subscribeToShake(() => {
      openModal();
    });
    return () => unsubscribe();
  }, [accounts]);

  const openModal = () => {
    setAmount('');
    setDescription('');
    setCustomReason('');
    setErrorMessage('');
    setSelectedAccountId(accounts[0]?.id || '');
    setSelectedCategoryId(expenseCategories[0]?.id || '');
    setAccountDropdownOpen(false);
    setCategoryDropdownOpen(false);
    setVisible(true);
    shakeService.setModalOpen(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 150);
  };

  const closeModal = () => {
    setVisible(false);
    shakeService.setModalOpen(false);
  };

  const selectedCat = expenseCategories.find((c) => c.id === selectedCategoryId) || expenseCategories[0];
  const isOtherSelected = selectedCat?.name?.toLowerCase().includes('other') || selectedCategoryId === 'cat_others';

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage('');
      const minorAmount = parseMoneyToMinor(amount);
      if (minorAmount <= 0) {
        throw new Error('Please enter an amount greater than ₹0');
      }

      const finalDesc = isOtherSelected && customReason.trim()
        ? customReason.trim()
        : description.trim() || selectedCat?.name || 'Quick Expense';

      if (!finalDesc) {
        throw new Error('Please enter a description or reason');
      }

      const targetAccountId = selectedAccountId || accounts[0]?.id;
      if (!targetAccountId) {
        throw new Error('No account found. Please create an account first.');
      }

      return transactionService.createTransaction({
        user_id: user!.id,
        account_id: targetAccountId,
        type: 'expense',
        amount_minor: minorAmount,
        currency: 'INR',
        category_id: selectedCategoryId && selectedCategoryId !== 'cat_others' ? selectedCategoryId : undefined,
        description: finalDesc,
        notes: customReason.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to save expense');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    },
  });

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={closeModal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 justify-end bg-black/60" onPress={closeModal}>
          <Pressable
            className="bg-zinc-900 rounded-t-3xl p-6 border-t border-zinc-800"
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 items-center justify-center">
                    <Zap size={18} color="#10B981" />
                  </View>
                  <Text className="text-xl font-extrabold text-white">Quick Expense</Text>
                </View>
                <Pressable onPress={closeModal} className="p-1">
                  <X size={20} color="#A1A1AA" />
                </Pressable>
              </View>

              {/* Amount Input */}
              <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Amount (₹)</Text>
              <View className="flex-row items-center bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 mb-4">
                <Text className="text-xl font-black text-emerald-400 mr-2">₹</Text>
                <TextInput
                  ref={amountInputRef}
                  placeholder="500"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  className="flex-1 text-2xl font-black text-white p-0"
                />
              </View>

              {/* Description Input */}
              <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Description</Text>
              <View className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 mb-4">
                <TextInput
                  placeholder="e.g. Petrol, Groceries, Coffee"
                  placeholderTextColor="#71717A"
                  value={description}
                  onChangeText={setDescription}
                  className="text-sm font-medium text-white p-0"
                />
              </View>

              {/* Account Dropdown */}
              <View className="mb-4">
                <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Account</Text>
                <Pressable
                  onPress={() => {
                    setAccountDropdownOpen(!accountDropdownOpen);
                    setCategoryDropdownOpen(false);
                  }}
                  className="flex-row justify-between items-center p-3.5 bg-zinc-800 border border-zinc-700 rounded-2xl"
                >
                  <Text className="text-sm font-bold text-white">
                    {selectedAcc ? selectedAcc.name : 'Select Account'}
                  </Text>
                  <ChevronDown size={18} color="#A1A1AA" />
                </Pressable>

                {accountDropdownOpen && (
                  <View className="mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl max-h-36 overflow-hidden">
                    <ScrollView nestedScrollEnabled className="p-1">
                      {accounts.map((acc) => (
                        <Pressable
                          key={acc.id}
                          onPress={() => {
                            setSelectedAccountId(acc.id);
                            setAccountDropdownOpen(false);
                          }}
                          className={`flex-row justify-between items-center p-3 rounded-xl ${
                            selectedAccountId === acc.id ? 'bg-zinc-700' : ''
                          }`}
                        >
                          <Text className="text-sm font-medium text-white">{acc.name}</Text>
                          {selectedAccountId === acc.id && <Check size={16} color="#10B981" />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Category Dropdown */}
              {expenseCategories.length > 0 && (
                <View className="mb-4">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Category</Text>
                  <Pressable
                    onPress={() => {
                      setCategoryDropdownOpen(!categoryDropdownOpen);
                      setAccountDropdownOpen(false);
                    }}
                    className="flex-row justify-between items-center p-3.5 bg-zinc-800 border border-zinc-700 rounded-2xl"
                  >
                    <Text className="text-sm font-bold text-white">
                      {selectedCat ? selectedCat.name : 'General'}
                    </Text>
                    <ChevronDown size={18} color="#A1A1AA" />
                  </Pressable>

                  {categoryDropdownOpen && (
                    <View className="mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl max-h-36 overflow-hidden">
                      <ScrollView nestedScrollEnabled className="p-1">
                        {expenseCategories.map((cat) => (
                          <Pressable
                            key={cat.id}
                            onPress={() => {
                              setSelectedCategoryId(cat.id);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`flex-row justify-between items-center p-3 rounded-xl ${
                              selectedCategoryId === cat.id ? 'bg-zinc-700' : ''
                            }`}
                          >
                            <Text className="text-sm font-medium text-white">{cat.name}</Text>
                            {selectedCategoryId === cat.id && <Check size={16} color="#10B981" />}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Custom Reason Field when 'Others' is selected */}
              {isOtherSelected && (
                <View className="mb-4">
                  <Text className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">Custom Reason / Note</Text>
                  <View className="bg-zinc-800 border border-amber-500/50 rounded-2xl px-4 py-3">
                    <TextInput
                      placeholder="e.g. Doctor fees, Bike service, Gift"
                      placeholderTextColor="#71717A"
                      value={customReason}
                      onChangeText={setCustomReason}
                      className="text-sm font-medium text-white p-0"
                      autoFocus
                    />
                  </View>
                </View>
              )}

              {/* Inline Error Message */}
              {errorMessage ? (
                <Text className="text-xs text-rose-400 font-bold mb-3 text-center">
                  {errorMessage}
                </Text>
              ) : null}

              {/* Done Button */}
              <Pressable
                disabled={createExpenseMutation.isPending}
                onPress={() => createExpenseMutation.mutate()}
                className={`w-full py-4 rounded-2xl items-center justify-center mb-3 ${
                  createExpenseMutation.isPending ? 'bg-emerald-700' : 'bg-emerald-500 active:bg-emerald-600'
                }`}
              >
                {createExpenseMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-black text-white tracking-wider">DONE</Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
