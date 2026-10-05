import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AppModal } from './ui/AppModal';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../lib/services/account.service';
import { formatMoney } from '../lib/finance/core';
import { ParsedSmsTransaction } from '../lib/sms/types';
import { smsStorage } from '../lib/sms/storage/smsStore';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { AlertCircle, CheckCircle, X, Building2 } from 'lucide-react-native';

interface ReviewModalProps {
  transaction: ParsedSmsTransaction | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SmsTransactionReviewModal({
  transaction,
  visible,
  onClose,
  onConfirm,
}: ReviewModalProps) {
  if (!transaction) return null;

  const { user } = useAuth();
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
    enabled: !!user?.id,
  });

  const [selectedBankId, setSelectedBankId] = useState<string>(transaction.bankId);
  const [selectedBankName, setSelectedBankName] = useState<string>(
    transaction.bankName !== 'Unknown Bank' ? transaction.bankName : ''
  );
  const [merchant, setMerchant] = useState<string>(transaction.merchant || '');
  const [category, setCategory] = useState<string>(transaction.category || 'Other');
  const [step, setStep] = useState<'review' | 'select_bank'>('review');

  const handleConfirm = async () => {
    const selectedAccount = accounts.find((a) => a.id === selectedBankId || a.name === selectedBankName);
    const resolvedBankName = selectedAccount?.name || selectedBankName || transaction.bankName;

    // Save learned account mapping if account was present
    if (transaction.maskedAccount) {
      await smsStorage.saveAccountMapping({
        maskedAccount: transaction.maskedAccount,
        bankId: selectedAccount?.id || selectedBankId,
        bankName: resolvedBankName,
        updatedAt: new Date().toISOString(),
      });
    }

    // Save learned category preference
    if (merchant && category) {
      await smsStorage.saveLearnedCategory(merchant, category);
    }

    // Construct final transaction object
    const finalTx: ParsedSmsTransaction = {
      ...transaction,
      bankId: selectedAccount?.id || selectedBankId,
      bankName: resolvedBankName,
      merchant,
      category,
      needsReview: false,
    };

    // Remove from pending reviews queue & save to main App Store
    await smsStorage.removePendingReview(transaction.sourceMessageId || '');
    await smsListenerService.saveTransactionToStore(finalTx);

    onConfirm();
    onClose();
  };

  const handleIgnore = async () => {
    await smsStorage.removePendingReview(transaction.sourceMessageId || '');
    onClose();
  };

  return (
    <AppModal visible={visible} animationType="slide" onClose={onClose}>
      <Pressable className="flex-col w-full px-6 pt-3" onPress={(e) => e.stopPropagation()}>
        {/* Subtle Drag Indicator */}
        <View className="w-12 h-1 bg-zinc-300 rounded-full self-center mb-3" />

        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2.5">
            <View className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 items-center justify-center">
              <AlertCircle size={18} color="#D97706" />
            </View>
            <View>
              <Text className="text-xl font-extrabold text-zinc-900">Transaction Review</Text>
              <Text className="text-xs text-zinc-500">Auto-detected SMS transaction</Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center active:bg-zinc-200"
          >
            <X size={18} color="#71717A" />
          </Pressable>
        </View>

        {step === 'review' ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 mb-4 items-center">
              <Text className="text-xs text-zinc-500 font-medium uppercase tracking-widest mb-1">
                {transaction.type.toUpperCase()} DETECTED
              </Text>
              <Text className="text-3xl font-black text-zinc-900 mb-1">
                ₹{transaction.amount.toLocaleString('en-IN')}
              </Text>
              <Text className="text-xs text-zinc-500">
                {transaction.transactionDate.split('T')[0]} • {transaction.paymentMethod}
              </Text>
            </View>

            {/* Bank Identification Warning / Selector */}
            {transaction.bankId === 'unknown' && !selectedBankName ? (
              <Pressable
                onPress={() => setStep('select_bank')}
                className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-4 flex-row items-center justify-between active:bg-rose-100"
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-lg bg-rose-100 items-center justify-center">
                    <Building2 size={16} color="#EF4444" />
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-rose-900">Bank Not Identified</Text>
                    <Text className="text-xs text-rose-700">Account: {transaction.maskedAccount || 'Unknown'}</Text>
                  </View>
                </View>
                <Text className="text-xs font-bold text-indigo-600">Select Bank →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setStep('select_bank')}
                className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 mb-4 flex-row items-center justify-between active:bg-indigo-100"
              >
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-lg bg-indigo-100 items-center justify-center">
                    <Building2 size={16} color="#4F46E5" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Bank & Account</Text>
                    <Text className="text-xs font-bold text-indigo-700" numberOfLines={1}>
                      {selectedBankName || transaction.bankName} {transaction.maskedAccount ? `(${transaction.maskedAccount})` : ''}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs font-bold text-indigo-600">Change →</Text>
              </Pressable>
            )}

            <Input
              label="Merchant / Payee"
              value={merchant}
              onChangeText={setMerchant}
              placeholder="e.g. Swiggy, Amazon"
            />

            <Input
              label="Category"
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Food & Dining"
            />

            <View className="flex-row gap-3 mt-5">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 border-zinc-200 bg-zinc-50"
                onPress={handleIgnore}
              >
                <Text className="text-zinc-700 font-bold text-sm">Ignore</Text>
              </Button>

              <Button
                variant="primary"
                size="lg"
                className="flex-1 bg-indigo-600 active:bg-indigo-700 flex-row items-center justify-center gap-2 shadow-sm"
                onPress={handleConfirm}
              >
                <CheckCircle size={18} color="#FFFFFF" />
                <Text className="text-white font-bold text-sm">Confirm</Text>
              </Button>
            </View>
          </ScrollView>
        ) : (
          // Select Bank Step - Show only available user bank accounts
          <View style={{ flexShrink: 1 }} className="pb-4">
            <Text className="text-sm font-bold text-zinc-900 mb-1">Select Bank Account</Text>
            <Text className="text-xs text-zinc-500 mb-3">Choose one of your available accounts to link this transaction</Text>

            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              className="mb-4"
            >
              {accounts.length > 0 ? (
                accounts.map((acc) => {
                  const isSelected = selectedBankId === acc.id || selectedBankName === acc.name;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => {
                        setSelectedBankId(acc.id);
                        setSelectedBankName(acc.name);
                        setStep('review');
                      }}
                      className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                        isSelected ? 'bg-indigo-50 border-indigo-600' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <View
                          style={{ backgroundColor: acc.color || '#6366F1' }}
                          className="w-9 h-9 rounded-xl items-center justify-center shadow-sm"
                        >
                          <Building2 size={16} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-zinc-900" numberOfLines={1}>{acc.name}</Text>
                          <Text className="text-xs text-zinc-500 capitalize">{acc.type} • {formatMoney(acc.balance || 0)}</Text>
                        </View>
                      </View>
                      {isSelected && <CheckCircle size={18} color="#4F46E5" />}
                    </Pressable>
                  );
                })
              ) : (
                <View className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200 items-center justify-center mb-2">
                  <Building2 size={24} color="#A1A1AA" />
                  <Text className="text-sm font-bold text-zinc-800 mt-2">No bank accounts found</Text>
                  <Text className="text-xs text-zinc-500 text-center mt-1">Please create a bank account first in your Accounts settings.</Text>
                </View>
              )}
            </ScrollView>
            <Button variant="outline" size="lg" className="border-zinc-200" onPress={() => setStep('review')}>
              <Text className="text-zinc-700 font-bold text-sm">Back</Text>
            </Button>
          </View>
        )}
      </Pressable>
    </AppModal>
  );
}
