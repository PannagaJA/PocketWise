import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { billService } from '../lib/services/bill.service';
import { accountService } from '../lib/services/account.service';
import { categoryService } from '../lib/services/category.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../lib/finance/core';
import { Plus, X, ArrowLeft, Calendar, CheckCircle2, Clock, AlertCircle, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function BillsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Interactive Calendar State
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(calendarMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const formattedDate = `${calendarYear}-${formattedMonth}-${formattedDay}`;
    setDueDate(formattedDate);
    setCalendarModalVisible(false);
    try { Haptics.selectionAsync(); } catch {}
  };

  const { data: bills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['bills', user?.id],
    queryFn: () => billService.getBills(user?.id || ''),
    enabled: !!user?.id,
  });

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

  // Calculate Bill Summary Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const unpaidBills = bills.filter((b) => !b.is_paid);
  const totalUnpaidMinor = unpaidBills.reduce((sum, b) => sum + (b.expected_amount_minor || 0), 0);
  const overdueCount = unpaidBills.filter((b) => b.due_date < todayStr).length;

  const createBillMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Bill name is required');
      const minorAmount = parseMoneyToMinor(amount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');

      return billService.createBill({
        user_id: user!.id,
        name,
        expected_amount_minor: minorAmount,
        due_date: dueDate,
        frequency: 'monthly',
        category_id: selectedCategoryId || undefined,
        account_id: selectedAccountId || accounts[0]?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
      setModalVisible(false);
      setName('');
      setAmount('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create bill');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (bill: any) => {
      const targetAccountId = bill.account_id || accounts[0]?.id;
      if (!targetAccountId) throw new Error('An account must exist to process bill payment');
      return billService.markBillPaid(bill.id, targetAccountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to mark bill as paid');
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="mr-3 p-1">
              <ArrowLeft size={22} color="#09090B" />
            </Pressable>
            <View>
              <Text className="text-2xl font-black text-zinc-900">Upcoming Bills</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">Automated bill reminders & status</Text>
            </View>
          </View>

          <Button
            variant="primary"
            size="sm"
            className="flex-row space-x-1"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add Bill</Text>
          </Button>
        </View>

        {/* Unique Outstanding Bill Commitment Card */}
        <Card className="bg-zinc-900 border-zinc-800 p-5 mb-4 rounded-3xl shadow-md">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                Total Unpaid Commitment
              </Text>
              <Text className="text-2xl font-black text-white mt-1">
                {formatMoney(totalUnpaidMinor)}
              </Text>
            </View>

            {overdueCount > 0 ? (
              <View className="bg-rose-500/20 px-2.5 py-1 rounded-full flex-row items-center border border-rose-500/30 gap-1">
                <ShieldAlert size={12} color="#EF4444" />
                <Text className="text-[11px] font-bold text-rose-400">{overdueCount} Overdue</Text>
              </View>
            ) : (
              <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full flex-row items-center border border-emerald-500/30 gap-1">
                <CheckCircle2 size={12} color="#10B981" />
                <Text className="text-[11px] font-bold text-emerald-400">On Track</Text>
              </View>
            )}
          </View>

          <View className="pt-3 border-t border-zinc-800 flex-row justify-between items-center">
            <Text className="text-xs text-zinc-400">Pending Bills: <Text className="font-bold text-white">{unpaidBills.length}</Text></Text>
            <Text className="text-xs text-zinc-400">Auto Reminders: <Text className="font-bold text-emerald-400">Active</Text></Text>
          </View>
        </Card>

        {/* Bills List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
          {loadingBills ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : bills.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-2 rounded-2xl">
              <View className="w-12 h-12 rounded-2xl bg-amber-50 items-center justify-center mb-3">
                <Calendar size={24} color="#F59E0B" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">No upcoming bills</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                Add your recurring electricity, internet, or card bills to get push alerts.
              </Text>
              <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
                <Text className="text-white font-semibold text-xs">Add Bill</Text>
              </Button>
            </Card>
          ) : (
            bills.map((b) => {
              const isPaid = b.is_paid;
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = !isPaid && b.due_date < today;

              return (
                <Card key={b.id} className="mb-3 p-4 bg-white border border-zinc-200 rounded-2xl">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                        isPaid ? 'bg-emerald-50' : isOverdue ? 'bg-rose-50' : 'bg-indigo-50'
                      }`}>
                        {isPaid ? (
                          <CheckCircle2 size={20} color="#10B981" />
                        ) : isOverdue ? (
                          <AlertCircle size={20} color="#EF4444" />
                        ) : (
                          <Clock size={20} color="#6366F1" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-zinc-900">{b.name}</Text>
                        <Text className="text-xs text-zinc-500 mt-0.5">
                          Due {formatDate(b.due_date)} • {b.category_name || 'General'}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end gap-1">
                      <Text className="text-base font-extrabold text-zinc-900">{formatMoney(b.expected_amount_minor)}</Text>
                      <Badge
                        label={isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Upcoming'}
                        variant={isPaid ? 'income' : isOverdue ? 'expense' : 'budget'}
                      />
                    </View>
                  </View>

                  {!isPaid && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={markPaidMutation.isPending}
                      className="mt-1 border-emerald-300 bg-emerald-50/40"
                      onPress={() => markPaidMutation.mutate(b)}
                    >
                      <Text className="text-emerald-700 font-bold text-xs">Mark as Paid</Text>
                    </Button>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add Bill Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Add Bill</Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <Input
              label="Bill Name"
              placeholder="e.g. Electricity Bill, Wifi"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Expected Amount (₹)"
              placeholder="1450.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            {/* Interactive Calendar Date Picker Button */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Due Date</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setCalendarModalVisible(true);
                }}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
              >
                <View className="flex-row items-center gap-2">
                  <Calendar size={18} color="#6366F1" />
                  <Text className="text-sm font-medium text-zinc-900">{formatDate(dueDate)}</Text>
                </View>
                <Text className="text-xs font-bold text-indigo-600">Pick Date</Text>
              </Pressable>
            </View>

            <Button
              variant="primary"
              size="lg"
              loading={createBillMutation.isPending}
              className="mt-2 mb-4"
              onPress={() => createBillMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Bill & Enable Reminder</Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* Visual Interactive Calendar Modal */}
      <Modal visible={calendarModalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/50 px-5">
          <View className="bg-white rounded-3xl p-5 w-full border border-zinc-200 shadow-xl">
            {/* Calendar Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Pressable
                onPress={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                }}
                className="p-2 rounded-full active:bg-zinc-100"
              >
                <ChevronLeft size={20} color="#09090B" />
              </Pressable>

              <Text className="text-base font-bold text-zinc-900">
                {monthNames[calendarMonth]} {calendarYear}
              </Text>

              <Pressable
                onPress={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                }}
                className="p-2 rounded-full active:bg-zinc-100"
              >
                <ChevronRight size={20} color="#09090B" />
              </Pressable>
            </View>

            {/* Days of Week Header */}
            <View className="flex-row justify-between mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} className="w-9 text-center text-xs font-bold text-zinc-400">{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap">
              {Array.from({ length: firstDayOfMonth(calendarMonth, calendarYear) }).map((_, i) => (
                <View key={`empty-${i}`} className="w-[14.28%] h-9" />
              ))}

              {Array.from({ length: daysInMonth(calendarMonth, calendarYear) }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = dueDate === dateStr;

                return (
                  <Pressable
                    key={day}
                    onPress={() => handleSelectDay(day)}
                    className={`w-[14.28%] h-9 items-center justify-center rounded-xl mb-1 ${
                      isSelected ? 'bg-indigo-600' : 'active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-zinc-200"
              onPress={() => setCalendarModalVisible(false)}
            >
              <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
