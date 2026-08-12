import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { INDIAN_BANKS } from '../lib/sms/banks/bankRegistry';
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

  const [selectedBankId, setSelectedBankId] = useState<string>(transaction.bankId);
  const [merchant, setMerchant] = useState<string>(transaction.merchant || '');
  const [category, setCategory] = useState<string>(transaction.category || 'Other');
  const [step, setStep] = useState<'review' | 'select_bank'>('review');

  const handleConfirm = async () => {
    const selectedBank = INDIAN_BANKS.find((b) => b.id === selectedBankId);

    // Save learned account mapping if account was present
    if (transaction.maskedAccount && selectedBank) {
      await smsStorage.saveAccountMapping({
        maskedAccount: transaction.maskedAccount,
        bankId: selectedBank.id,
        bankName: selectedBank.name,
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
      bankId: selectedBankId,
      bankName: selectedBank?.name || transaction.bankName,
      merchant,
      category,
      needsReview: false,
    };

    // Remove from pending reviews queue & save to main App Store
    await smsStorage.removePendingReview(transaction.sourceMessageId || '');
    smsListenerService.saveTransactionToStore(finalTx);

    onConfirm();
    onClose();
  };

  const handleIgnore = async () => {
    await smsStorage.removePendingReview(transaction.sourceMessageId || '');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50 p-4">
        <Card className="bg-white rounded-3xl p-6 border border-zinc-200">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                <AlertCircle size={18} color="#F59E0B" />
              </View>
              <Text className="text-lg font-bold text-zinc-900">Transaction Review</Text>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          {step === 'review' ? (
            <View>
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

              {/* Bank Identification Warning */}
              {transaction.bankId === 'unknown' ? (
                <Pressable
                  onPress={() => setStep('select_bank')}
                  className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2">
                    <Building2 size={18} color="#EF4444" />
                    <View>
                      <Text className="text-xs font-bold text-rose-900">Bank Not Identified</Text>
                      <Text className="text-xs text-rose-700">Account: {transaction.maskedAccount || 'Unknown'}</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-bold text-indigo-600">Select Bank →</Text>
                </Pressable>
              ) : (
                <View className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 mb-4 flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-indigo-900">Bank & Account</Text>
                  <Text className="text-xs font-bold text-indigo-700">
                    {transaction.bankName} {transaction.maskedAccount ? `(${transaction.maskedAccount})` : ''}
                  </Text>
                </View>
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

              <View className="flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 border-zinc-200"
                  onPress={handleIgnore}
                >
                  <Text className="text-zinc-600 font-semibold">Ignore</Text>
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 bg-indigo-600 flex-row items-center justify-center"
                  onPress={handleConfirm}
                >
                  <CheckCircle size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold">Confirm</Text>
                </Button>
              </View>
            </View>
          ) : (
            // Select Bank Step
            <View className="max-h-[350px]">
              <Text className="text-sm font-bold text-zinc-900 mb-3">Which bank is this account from?</Text>
              <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                {INDIAN_BANKS.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setSelectedBankId(b.id);
                      setStep('review');
                    }}
                    className={`p-3 rounded-xl border mb-2 flex-row items-center justify-between ${
                      selectedBankId === b.id ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <Text className="text-sm font-bold text-zinc-900">{b.name}</Text>
                    {selectedBankId === b.id && <CheckCircle size={16} color="#4F46E5" />}
                  </Pressable>
                ))}
              </ScrollView>
              <Button variant="outline" size="lg" onPress={() => setStep('review')}>
                <Text className="text-zinc-600 font-semibold">Back</Text>
              </Button>
            </View>
          )}
        </Card>
      </View>
    </Modal>
  );
}
