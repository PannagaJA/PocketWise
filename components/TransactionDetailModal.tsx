import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { formatMoney, formatDate, formatDateTime } from '../lib/finance/core';
import { cleanTransactionDescription } from '../lib/services/transaction.service';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Calendar,
  Clock,
  Wallet,
  Building2,
  Tag,
  FileText,
  Pencil,
  Trash2,
  X,
  Hash,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export interface TransactionDetailModalProps {
  visible: boolean;
  transaction: any | null;
  account?: { id?: string; name?: string; balance?: number; color?: string; type?: string } | null;
  category?: { id?: string; name?: string; color?: string; icon?: string } | null;
  onClose: () => void;
  onEdit?: (tx: any) => void;
  onDelete?: (tx: any) => void;
}

export function TransactionDetailModal({
  visible,
  transaction: propTx,
  account: propAccount,
  category: propCategory,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailModalProps) {
  const [cachedTx, setCachedTx] = useState(propTx);
  const [cachedAccount, setCachedAccount] = useState(propAccount);
  const [cachedCategory, setCachedCategory] = useState(propCategory);

  useEffect(() => {
    if (propTx) {
      if (propTx.id !== cachedTx?.id) {
        setCachedTx(propTx);
        setCachedAccount(propAccount || null);
        setCachedCategory(propCategory || null);
      } else {
        setCachedTx(propTx);
        if (propAccount !== undefined) setCachedAccount(propAccount);
        if (propCategory !== undefined) setCachedCategory(propCategory);
      }
    }
  }, [propTx, propAccount, propCategory, cachedTx?.id]);

  const tx = propTx || cachedTx;
  const isSameTx = tx && (!propTx || propTx.id === tx.id);
  const account = propAccount !== undefined ? propAccount : (isSameTx ? cachedAccount : null);
  const category = propCategory !== undefined ? propCategory : (isSameTx ? cachedCategory : null);

  if (!tx) return null;

  const isIncome = tx.type === 'income';
  const isExpense = tx.type === 'expense';
  const isTransfer = tx.type === 'transfer';

  const categoryName =
    category?.name ||
    tx.category?.name ||
    (Array.isArray(tx.category) && (tx.category as any)[0]?.name) ||
    'General';

  const accountName =
    account?.name ||
    tx.account?.name ||
    (Array.isArray(tx.account) && (tx.account as any)[0]?.name) ||
    'Account';

  const accountBalance = account?.balance !== undefined ? account.balance : null;
  const isAccNeg = (accountBalance || 0) < 0;

  const cleanedDescription = cleanTransactionDescription(tx.description, categoryName, tx.type);

  // Exact timestamp handling
  const exactTimeString = tx.created_at
    ? (() => {
        try {
          const d = new Date(tx.created_at);
          if (isNaN(d.getTime())) return null;
          return formatDateTime(tx.created_at);
        } catch {
          return null;
        }
      })()
    : null;

  const handleEdit = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (onEdit) {
      onEdit(tx);
    }
  };

  const handleDelete = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    if (onDelete) {
      onDelete(tx);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} animationType="slide">
      <Pressable className="flex-col w-full" onPress={(e) => e.stopPropagation()}>
        {/* Subtle Drag Indicator */}
        <View className="w-12 h-1 bg-zinc-300 rounded-full self-center mt-3 mb-1" />

        {/* Modal Header */}
        <View className="flex-row items-center justify-between px-6 py-3 border-b border-zinc-100">
          <View className="flex-row items-center gap-2.5">
            <View
              className={`w-9 h-9 rounded-xl items-center justify-center ${
                isIncome ? 'bg-emerald-50' : isExpense ? 'bg-rose-50' : 'bg-indigo-50'
              }`}
            >
              {isIncome ? (
                <ArrowDownLeft size={18} color="#10B981" />
              ) : isExpense ? (
                <ArrowUpRight size={18} color="#EF4444" />
              ) : (
                <ArrowRightLeft size={18} color="#6366F1" />
              )}
            </View>
            <View>
              <Text className="text-lg font-extrabold text-zinc-900">Transaction Details</Text>
              <Text className="text-xs text-zinc-500">
                {isIncome ? 'Income Received' : isExpense ? 'Expense Paid' : 'Account Transfer'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              onClose();
            }}
            activeOpacity={0.7}
            className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
          >
            <X size={16} color="#71717A" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          className="px-6 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Hero Amount Box */}
          <View className="items-center justify-center py-5 px-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 mb-5">
            <View className="flex-row items-center gap-1.5 mb-2">
              <Badge
                variant={isIncome ? 'income' : isExpense ? 'expense' : 'subscription'}
                label={isIncome ? 'CREDIT / RECEIVED' : isExpense ? 'DEBIT / PAID' : 'INTERNAL TRANSFER'}
                className="px-2.5 py-0.5"
              />
            </View>

            <Text
              className={`text-3xl font-black tracking-tight ${
                isIncome ? 'text-emerald-600' : isExpense ? 'text-zinc-900' : 'text-indigo-600'
              }`}
            >
              {isIncome ? '+' : isExpense ? '-' : ''}
              {formatMoney(tx.amount_minor)}
            </Text>

            <Text className="text-sm font-semibold text-zinc-600 mt-1 text-center" numberOfLines={2}>
              {cleanedDescription}
            </Text>
          </View>

          {/* Details Breakdown */}
          <View className="bg-white rounded-2xl border border-zinc-200 overflow-hidden mb-5 divide-y divide-zinc-100">
            {/* To / From / Party */}
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="w-8 h-8 rounded-lg bg-zinc-100 items-center justify-center">
                  <FileText size={16} color="#52525B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {isIncome ? 'Received From' : isExpense ? 'Paid To' : 'Description'}
                  </Text>
                  <Text className="text-sm font-bold text-zinc-900 mt-0.5" numberOfLines={2}>
                    {cleanedDescription}
                  </Text>
                </View>
              </View>
            </View>

            {/* Account & Live Balance */}
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View
                  style={{ backgroundColor: account?.color || '#4F46E5' }}
                  className="w-8 h-8 rounded-lg items-center justify-center shadow-sm"
                >
                  <Building2 size={16} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Account & Balance
                  </Text>
                  <Text className="text-sm font-bold text-zinc-900 mt-0.5" numberOfLines={1}>
                    {accountName}
                  </Text>
                </View>
              </View>

              {accountBalance !== null && (
                <View className="items-end">
                  <Text className="text-[10px] font-semibold text-zinc-400">Current Balance</Text>
                  <View
                    className={`mt-0.5 px-2 py-0.5 rounded-md ${
                      isAccNeg ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        isAccNeg ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatMoney(accountBalance)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Transaction Date */}
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center">
                  <Calendar size={16} color="#6366F1" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Transaction Date
                  </Text>
                  <Text className="text-sm font-bold text-zinc-900 mt-0.5">
                    {formatDate(tx.date)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recorded At Timestamp (only shown when timestamp is available) */}
            {exactTimeString ? (
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-lg bg-zinc-100 items-center justify-center">
                    <Clock size={16} color="#71717A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Recorded at
                    </Text>
                    <Text className="text-sm font-semibold text-zinc-800 mt-0.5">
                      {exactTimeString}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Category */}
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="w-8 h-8 rounded-lg bg-amber-50 items-center justify-center">
                  <Tag size={16} color="#D97706" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Category
                  </Text>
                  <Text className="text-sm font-bold text-zinc-900 mt-0.5">
                    {categoryName}
                  </Text>
                </View>
              </View>

              <View className="px-2.5 py-1 bg-zinc-100 rounded-lg">
                <Text className="text-xs font-bold text-zinc-800">{categoryName}</Text>
              </View>
            </View>

            {/* Notes or Ref ID if available */}
            {(tx.notes || tx.id) && (
              <View className="p-4 flex-row items-start justify-between">
                <View className="flex-row items-start gap-3 flex-1">
                  <View className="w-8 h-8 rounded-lg bg-zinc-100 items-center justify-center mt-0.5">
                    <Hash size={16} color="#71717A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Reference / Notes
                    </Text>
                    {tx.notes ? (
                      <Text className="text-xs text-zinc-700 font-medium mt-1 leading-relaxed">
                        {tx.notes}
                      </Text>
                    ) : null}
                    <Text className="text-[10px] text-zinc-400 font-mono mt-1">
                      ID: {tx.id}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            {onDelete && (
              <TouchableOpacity
                onPress={handleDelete}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 bg-rose-50 border border-rose-200 rounded-xl"
              >
                <Trash2 size={16} color="#E11D48" />
                <Text className="text-rose-700 font-bold text-sm">Delete</Text>
              </TouchableOpacity>
            )}

            {onEdit && (
              <TouchableOpacity
                onPress={handleEdit}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-4 bg-zinc-900 rounded-xl shadow-sm"
              >
                <Pencil size={16} color="#FFFFFF" />
                <Text className="text-white font-bold text-sm">Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Pressable>
    </AppModal>
  );
}
