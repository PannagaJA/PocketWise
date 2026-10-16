import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { AppBottomSheet } from '../components/ui/AppBottomSheet';
import { AppDialog } from '../components/ui/AppDialog';
import { AppLoadingIndicator } from '../components/ui/AppLoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { billService } from '../lib/services/bill.service';
import { accountService } from '../lib/services/account.service';
import { categoryService } from '../lib/services/category.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../lib/finance/core';
import { notificationService } from '../lib/notifications/notification.service';
import { Plus, X, ArrowLeft, Calendar, CheckCircle2, Clock, AlertCircle, ShieldAlert, ChevronLeft, ChevronRight, Check, Pencil, Trash2, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TimePickerModal, format12HourTime } from '../components/ui/TimePickerModal';
import { useModuleBack } from '../lib/navigation/moduleBack';

export default function BillsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const goBack = useModuleBack();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [billToPay, setBillToPay] = useState<any | null>(null);

  // Edit Bill State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editFrequency, setEditFrequency] = useState<'monthly' | 'yearly' | 'one_time'>('monthly');

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly' | 'one_time'>('monthly');

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

      const timePart = dueTime.trim() || '09:00';
      const finalDueDate = `${dueDate}T${timePart}:00`;

      return billService.createBill({
        user_id: user!.id,
        name,
        expected_amount_minor: minorAmount,
        due_date: finalDueDate,
        frequency,
        category_id: selectedCategoryId || undefined,
        account_id: selectedAccountId || accounts[0]?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });

      setModalVisible(false);
      setName('');
      setAmount('');
      setDueTime('09:00');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create bill');
    },
  });

  const updateBillMutation = useMutation({
    mutationFn: async () => {
      if (!editingBill) return;
      const minorAmount = parseMoneyToMinor(editAmount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');
      if (!editName.trim()) throw new Error('Bill name is required');

      return billService.updateBill(editingBill.id, {
        name: editName.trim(),
        expected_amount_minor: minorAmount,
        due_date: editDueDate || editingBill.due_date,
        frequency: editFrequency,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
      setEditModalVisible(false);
      setEditingBill(null);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update bill');
    },
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      return billService.deleteBill(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', user?.id] });
      setEditModalVisible(false);
      setEditingBill(null);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete bill');
    },
  });

  const confirmDeleteBill = () => {
    if (!editingBill) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    Alert.alert(
      'Delete Bill?',
      `Are you sure you want to delete "${editingBill.name}"? Scheduled reminders for this bill will be canceled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBillMutation.mutate(editingBill.id),
        },
      ]
    );
  };

  const handleOpenEditBill = (bill: any) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEditingBill(bill);
    setEditName(bill.name);
    setEditAmount((bill.expected_amount_minor / 100).toString());
    setEditDueDate(bill.due_date ? bill.due_date.substring(0, 10) : '');
    setEditFrequency(bill.frequency || 'monthly');
    setEditModalVisible(true);
  };

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
      setBillToPay(null);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to mark bill as paid');
    },
  });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F9FE' }} edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center flex-1 mr-3">
            <Pressable onPress={goBack} className="mr-3 p-1">
              <ArrowLeft size={22} color="#09090B" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-[22px] font-extrabold text-zinc-950 tracking-tight">Upcoming Bills</Text>
              <Text className="text-xs font-medium text-zinc-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">Automated bill reminders & status</Text>
            </View>
          </View>

          <Button
            variant="primary"
            size="sm"
            style={{ flexShrink: 0 }}
            className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-zinc-950 shadow-xs"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-bold text-xs">Add Bill</Text>
          </Button>
        </View>

        {/* Unique Outstanding Bill Commitment Card */}
        <Card className="bg-white border border-zinc-100 p-5 mb-4 rounded-3xl shadow-xs">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Total Unpaid Commitment
              </Text>
              <Text className="text-[24px] font-extrabold text-zinc-950 tracking-tight mt-1">
                {formatMoney(totalUnpaidMinor)}
              </Text>
            </View>

            {overdueCount > 0 ? (
              <View className="bg-rose-50 px-2.5 py-1 rounded-full flex-row items-center border border-rose-200/60 gap-1">
                <ShieldAlert size={12} color="#EF4444" />
                <Text className="text-[11px] font-bold text-rose-600">{overdueCount} Overdue</Text>
              </View>
            ) : (
              <View className="bg-emerald-50 px-2.5 py-1 rounded-full flex-row items-center border border-emerald-200/60 gap-1">
                <CheckCircle2 size={12} color="#10B981" />
                <Text className="text-[11px] font-bold text-emerald-600">On Track</Text>
              </View>
            )}
          </View>

          <View className="pt-3 border-t border-zinc-100 flex-row justify-between items-center">
            <Text className="text-xs text-zinc-500">Pending Bills: <Text className="font-bold text-zinc-900">{unpaidBills.length}</Text></Text>
            <Text className="text-xs text-zinc-500">Auto Reminders: <Text className="font-bold text-emerald-600">Active</Text></Text>
          </View>
        </Card>

        {/* Bills List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
          {loadingBills ? (
            <View className="py-8">
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : bills.length === 0 ? (
            <Card className="p-8 bg-white border border-zinc-100 items-center mt-2 rounded-3xl shadow-xs">
              <View className="w-14 h-14 rounded-full bg-amber-50 items-center justify-center mb-3">
                <Calendar size={24} color="#D97706" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">No upcoming bills</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                Add your recurring electricity, internet, or card bills to get push alerts.
              </Text>
              <Button size="sm" variant="primary" className="px-6 py-2.5 rounded-full" onPress={() => setModalVisible(true)}>
                Add Bill
              </Button>
            </Card>
          ) : (
            bills.map((b) => {
              const isPaid = b.is_paid;
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = !isPaid && b.due_date < today;

              return (
                <Card key={b.id} className="mb-3 p-4.5 bg-white border border-zinc-100 rounded-3xl shadow-xs">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        isPaid ? 'bg-emerald-50' : isOverdue ? 'bg-rose-50' : 'bg-amber-50'
                      }`}>
                        {isPaid ? (
                          <CheckCircle2 size={18} color="#10B981" />
                        ) : isOverdue ? (
                          <AlertCircle size={18} color="#EF4444" />
                        ) : (
                          <Clock size={18} color="#D97706" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-[16px] font-bold text-zinc-950" numberOfLines={1}>{b.name}</Text>
                        <Text className="text-xs font-medium text-zinc-500 mt-0.5">
                          Due {formatDate(b.due_date)} • {b.category_name || 'General'}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end gap-1">
                      <Text className="text-[16px] font-extrabold text-zinc-950">{formatMoney(b.expected_amount_minor)}</Text>
                      <View className="flex-row items-center gap-1.5">
                        {b.frequency && b.frequency !== 'one_time' && (
                          <Badge label={b.frequency} variant="subscription" />
                        )}
                        <Badge
                          label={isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Upcoming'}
                          variant={isPaid ? 'income' : isOverdue ? 'expense' : 'budget'}
                        />
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2 mt-1">
                    {!isPaid && (
                      <Pressable
                        className="flex-1 py-2 px-3 bg-emerald-50 border border-emerald-200/60 rounded-full active:bg-emerald-100 items-center justify-center"
                        onPress={() => {
                          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                          setBillToPay(b);
                        }}
                      >
                        <Text className="text-emerald-700 font-bold text-xs">Mark as Paid</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => handleOpenEditBill(b)}
                      className="p-2 rounded-full bg-zinc-100 active:bg-zinc-200 border border-zinc-200/60 items-center justify-center"
                    >
                      <Pencil size={13} color="#27272A" />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Custom Edit Bill Modal */}
      <AppBottomSheet
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit Bill"
        subtitle="Update bill and due date"
        scrollable={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {updateBillMutation.isPending || deleteBillMutation.isPending ? (
          <View className="py-12 items-center justify-center">
            <AppLoadingIndicator message={deleteBillMutation.isPending ? "Deleting bill..." : "Updating bill..."} />
          </View>
        ) : (
          <View>
            <Input
              label="Bill Name"
              placeholder="e.g. Electricity, Internet"
              value={editName}
              onChangeText={setEditName}
            />

            <Input
              label="Expected Amount (₹)"
              placeholder="1500.00"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />

            {/* Frequency Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">Frequency</Text>
              <View className="flex-row gap-2">
                {(['monthly', 'yearly', 'one_time'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setEditFrequency(f)}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      editFrequency === f
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold capitalize ${editFrequency === f ? 'text-white' : 'text-zinc-700'}`}>
                      {f === 'one_time' ? 'One Time' : f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Input
              label="Due Date (YYYY-MM-DD)"
              placeholder="YYYY-MM-DD"
              value={editDueDate}
              onChangeText={setEditDueDate}
            />

            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                size="lg"
                loading={deleteBillMutation.isPending}
                className="flex-1 border-rose-200 bg-rose-50/50"
                onPress={confirmDeleteBill}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text className="text-rose-600 font-bold ml-1.5">Delete</Text>
              </Button>

              <Button
                variant="primary"
                size="lg"
                loading={updateBillMutation.isPending}
                className="flex-1"
                onPress={() => updateBillMutation.mutate()}
              >
                <Text className="text-white font-bold">Save</Text>
              </Button>
            </View>
          </View>
        )}
      </AppBottomSheet>

      {/* Custom Mark as Paid Confirmation Dialog */}
      <AppDialog
        visible={!!billToPay}
        onClose={() => setBillToPay(null)}
        title="Confirm Bill Payment"
        description={`Mark ${billToPay?.name} as paid for ${formatMoney(billToPay?.expected_amount_minor || 0)}? An expense transaction will be logged to your account.`}
        confirmLabel="Confirm Payment"
        isLoading={markPaidMutation.isPending}
        loadingMessage="Recording payment transaction..."
        onConfirm={() => billToPay && markPaidMutation.mutate(billToPay)}
      />

      {/* Add Bill Modal */}
      <AppBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Add Bill"
        subtitle="Track upcoming dues"
        scrollable={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {createBillMutation.isPending ? (
          <View className="py-12 items-center justify-center">
            <AppLoadingIndicator message="Saving bill..." subMessage="Setting reminder notifications" />
          </View>
        ) : (
          <View>
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

            {/* Reminder Time Selection */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Reminder Time</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setTimePickerVisible(true);
                }}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
              >
                <View className="flex-row items-center gap-2">
                  <Clock size={18} color="#6366F1" />
                  <Text className="text-sm font-bold text-zinc-900">{format12HourTime(dueTime)}</Text>
                </View>
                <Text className="text-xs font-bold text-indigo-600">Pick Time</Text>
              </Pressable>
            </View>

            <Button
              variant="primary"
              size="lg"
              loading={createBillMutation.isPending}
              className="mt-2"
              onPress={() => createBillMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Bill & Enable Reminder</Text>
            </Button>
          </View>
        )}
      </AppBottomSheet>

      {/* Visual Interactive Calendar Modal */}
      <AppBottomSheet
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        title="Select Due Date"
        subtitle="Choose bill deadline"
      >
        <View className="p-5 w-full">
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
      </AppBottomSheet>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        selectedTime24={dueTime}
        onSelectTime={(t24) => setDueTime(t24)}
      />
    </SafeAreaView>
  );
}
