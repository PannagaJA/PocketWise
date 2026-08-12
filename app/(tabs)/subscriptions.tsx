import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService, Subscription } from '../../lib/services/subscription.service';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, Bell, CreditCard, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ShieldCheck, Trash2, AlertTriangle, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TimePickerModal, format12HourTime } from '../../components/ui/TimePickerModal';

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [renewalTime, setRenewalTime] = useState('09:00');

  // Delete Confirmation Modal state
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);

  // Native Calendar & Time Picker Modal state
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-indexed

  const { data: subscriptions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['subscriptions', user?.id],
    queryFn: () => subscriptionService.getSubscriptions(user?.id || ''),
    enabled: !!user?.id,
  });

  const createSubMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Subscription name is required');
      const minorAmount = parseMoneyToMinor(amount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');

      let finalBillingDate = nextBillingDate.trim();
      if (!finalBillingDate) {
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + (cycle === 'monthly' ? 30 : 365));
        finalBillingDate = nextBilling.toISOString().split('T')[0];
      }
      const timePart = renewalTime.trim() || '09:00';
      const fullBillingTimestamp = `${finalBillingDate}T${timePart}:00`;

      return subscriptionService.createSubscription({
        user_id: user!.id,
        name,
        amount_minor: minorAmount,
        currency: 'INR',
        billing_cycle: cycle,
        next_billing_date: fullBillingTimestamp,
        status: 'active',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Ignore haptics
      }
      setModalVisible(false);
      setName('');
      setAmount('');
      setNextBillingDate('');
      setRenewalTime('09:00');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create subscription');
    },
  });

  const deleteSubMutation = useMutation({
    mutationFn: (subId: string) => subscriptionService.deleteSubscription(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', user?.id] });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Ignore haptics
      }
      setSubToDelete(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete subscription');
    },
  });

  const totalMonthlySpend = subscriptions.reduce((sum, sub) => {
    if (sub.billing_cycle === 'monthly') return sum + sub.amount_minor;
    return sum + Math.round(sub.amount_minor / 12);
  }, 0);

  const activeCount = subscriptions.length;
  const yearlySpend = totalMonthlySpend * 12;

  // Calendar Helper Functions
  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(calendarMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    setNextBillingDate(`${calendarYear}-${formattedMonth}-${formattedDay}`);
    setCalendarPickerVisible(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-2xl font-black text-zinc-900">Subscriptions</Text>
            <Text className="text-xs text-zinc-500 mt-0.5">Push notifications alert before renewal</Text>
          </View>

          <Button
            variant="primary"
            size="sm"
            className="flex-row space-x-1"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add Sub</Text>
          </Button>
        </View>

        {/* Clean Subscriptions Card */}
        <Card className="bg-zinc-900 border-zinc-800 p-6 mb-5 rounded-3xl overflow-hidden relative shadow-lg">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">
                Recurring Subscriptions
              </Text>
              <Text className="text-3xl font-black text-white">
                {formatCurrency(totalMonthlySpend)}
                <Text className="text-xs font-bold text-zinc-400"> /mo</Text>
              </Text>
            </View>

            <View className="bg-indigo-500/20 px-3 py-1.5 rounded-2xl border border-indigo-500/30">
              <Text className="text-xs font-extrabold text-indigo-300">{activeCount} Active</Text>
            </View>
          </View>

          {/* Metrics Pill Bar */}
          <View className="flex-row pt-4 mt-2 border-t border-zinc-800 justify-between items-center">
            <View>
              <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Est. Annual Cost</Text>
              <Text className="text-sm font-extrabold text-indigo-300 mt-0.5">{formatCurrency(yearlySpend)}/yr</Text>
            </View>

            <View className="h-6 w-[1px] bg-zinc-800" />

            <View>
              <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Renewal Alerts</Text>
              <View className="flex-row items-center mt-0.5">
                <ShieldCheck size={14} color="#10B981" className="mr-1" />
                <Text className="text-xs font-bold text-emerald-400">24h Prior Alert</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Subscriptions List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {loadingSubs ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : subscriptions.length === 0 ? (
            <Card className="p-8 bg-white border border-zinc-200 items-center mt-2 rounded-3xl">
              <View className="w-14 h-14 rounded-full bg-indigo-50 items-center justify-center mb-3">
                <CreditCard size={28} color="#6366F1" />
              </View>
              <Text className="text-base font-bold text-zinc-900 text-center">No active subscriptions</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-5 text-center px-4 leading-5">
                Track your Netflix, Spotify, iCloud or gym plans and get push reminders before your card is billed!
              </Text>
              <Button size="md" variant="primary" className="px-6" onPress={() => setModalVisible(true)}>
                <Text className="text-white font-semibold text-xs">+ Add Subscription</Text>
              </Button>
            </Card>
          ) : (
            subscriptions.map((sub) => (
              <Card key={sub.id} className="mb-3 p-4 bg-white border border-zinc-200">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
                      <Text className="font-extrabold text-lg text-indigo-600">{sub.name[0]}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-zinc-900">{sub.name}</Text>
                      <View className="flex-row items-center mt-1 space-x-2">
                        <Badge label={sub.billing_cycle} variant="subscription" />
                        <Text className="text-xs text-zinc-500 ml-2">Due {formatDate(sub.next_billing_date)}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="items-end flex-row items-center gap-3">
                    <View className="items-end">
                      <Text className="text-base font-extrabold text-zinc-900">{formatCurrency(sub.amount_minor)}</Text>
                      <View className="flex-row items-center mt-0.5">
                        <Bell size={12} color="#6366F1" />
                        <Text className="text-[10px] font-semibold text-indigo-600 ml-1">Auto Reminder</Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
                        setSubToDelete(sub);
                      }}
                      className="p-2 rounded-xl bg-rose-50 active:bg-rose-100 border border-rose-100"
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      {/* Custom Delete Confirmation Modal */}
      <Modal visible={!!subToDelete} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/60 px-5">
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 w-full max-w-sm items-center shadow-xl">
            <View className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 items-center justify-center mb-4">
              <AlertTriangle size={30} color="#EF4444" />
            </View>

            <Text className="text-xl font-black text-zinc-900 text-center">Delete Subscription</Text>
            <Text className="text-xs text-zinc-500 text-center mt-1.5 mb-6 px-2 leading-5">
              Are you sure you want to delete <Text className="font-bold text-zinc-900">{subToDelete?.name}</Text>? This action cannot be undone.
            </Text>

            <View className="flex-row gap-3 w-full">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onPress={() => setSubToDelete(null)}
              >
                <Text className="text-zinc-900 font-semibold text-xs">Cancel</Text>
              </Button>

              <Button
                variant="destructive"
                size="md"
                className="flex-1 bg-rose-600 active:bg-rose-700"
                loading={deleteSubMutation.isPending}
                onPress={() => subToDelete && deleteSubMutation.mutate(subToDelete.id)}
              >
                <Text className="text-white font-semibold text-xs">Delete</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Add Subscription Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-zinc-900">Add Subscription</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="Service Name"
                placeholder="e.g. Netflix, Spotify, iCloud"
                value={name}
                onChangeText={setName}
              />

              <Input
                label="Amount (₹)"
                placeholder="649.00"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Renewal Date Picker Button with Perfect Spacing */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Renewal Date</Text>
                  <Text className="text-xs font-medium text-indigo-600">Optional</Text>
                </View>
                <Pressable
                  onPress={() => setCalendarPickerVisible(true)}
                  className="flex-row items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5"
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center">
                      <CalendarIcon size={18} color="#6366F1" />
                    </View>
                    <Text className={`text-sm ${nextBillingDate ? 'text-zinc-900 font-bold' : 'text-zinc-400 font-medium'}`}>
                      {nextBillingDate ? formatDate(nextBillingDate) : 'Select renewal date (defaults to +1 cycle)'}
                    </Text>
                  </View>

                  {nextBillingDate ? (
                    <Pressable
                      onPress={() => setNextBillingDate('')}
                      className="w-7 h-7 rounded-full bg-zinc-200 items-center justify-center"
                    >
                      <X size={14} color="#3F3F46" />
                    </Pressable>
                  ) : null}
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
                  className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center">
                      <Clock size={18} color="#6366F1" />
                    </View>
                    <Text className="text-sm font-bold text-zinc-900">{format12HourTime(renewalTime)}</Text>
                  </View>
                  <Text className="text-xs font-bold text-indigo-600">Pick Time</Text>
                </Pressable>
              </View>

              {/* Cycle */}
              <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-6">
                <Pressable
                  onPress={() => setCycle('monthly')}
                  className={`flex-1 py-2.5 rounded-xl items-center ${cycle === 'monthly' ? 'bg-white' : ''}`}
                >
                  <Text className={`font-semibold ${cycle === 'monthly' ? 'text-zinc-900' : 'text-zinc-500'}`}>Monthly</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCycle('yearly')}
                  className={`flex-1 py-2.5 rounded-xl items-center ${cycle === 'yearly' ? 'bg-white' : ''}`}
                >
                  <Text className={`font-semibold ${cycle === 'yearly' ? 'text-zinc-900' : 'text-zinc-500'}`}>Yearly</Text>
                </Pressable>
              </View>

              <Button
                variant="primary"
                size="lg"
                loading={createSubMutation.isPending}
                onPress={() => createSubMutation.mutate()}
              >
                <Text className="text-white font-semibold">Save Subscription</Text>
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar Picker Sub-Modal */}
      <Modal visible={calendarPickerVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/50 px-4">
          <View className="bg-white rounded-3xl p-5 border border-zinc-200 w-full max-w-sm">
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

              <Text className="text-base font-extrabold text-zinc-900">
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
              {/* Empty leading slots */}
              {Array.from({ length: firstDayOfMonth(calendarMonth, calendarYear) }).map((_, i) => (
                <View key={`empty-${i}`} className="w-[14.28%] h-9" />
              ))}

              {/* Day numbers */}
              {Array.from({ length: daysInMonth(calendarMonth, calendarYear) }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = nextBillingDate === dateStr;

                return (
                  <Pressable
                    key={day}
                    onPress={() => handleSelectDay(day)}
                    className={`w-[14.28%] h-9 items-center justify-center rounded-xl mb-1 ${isSelected ? 'bg-indigo-600' : 'active:bg-zinc-100'
                      }`}
                  >
                    <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onPress={() => setCalendarPickerVisible(false)}
            >
              <Text className="text-zinc-900 font-semibold text-xs">Cancel</Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        selectedTime24={renewalTime}
        onSelectTime={(t24) => setRenewalTime(t24)}
      />
    </SafeAreaView>
  );
}
