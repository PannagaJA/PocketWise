import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { AppBottomSheet } from '../../components/ui/AppBottomSheet';
import { AppDialog } from '../../components/ui/AppDialog';
import { AppLoadingIndicator } from '../../components/ui/AppLoadingIndicator';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService, Subscription, BillingCycle } from '../../lib/services/subscription.service';
import { accountService } from '../../lib/services/account.service';
import { notificationService } from '../../lib/notifications/notification.service';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, Bell, CreditCard, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ShieldCheck, Trash2, AlertTriangle, Clock, RotateCcw, Pencil, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TimePickerModal, format12HourTime } from '../../components/ui/TimePickerModal';

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [renewalTime, setRenewalTime] = useState('09:00');

  // Edit Subscription Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCycle, setEditCycle] = useState<BillingCycle>('monthly');
  const [editNextBillingDate, setEditNextBillingDate] = useState('');

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

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAccounts(user?.id || ''),
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

  const renewSubMutation = useMutation({
    mutationFn: async (sub: Subscription) => {
      const accountId = sub.account_id || accounts[0]?.id;
      return subscriptionService.renewSubscription(sub.id, accountId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        '🎉 Subscription Renewed',
        `Renewed! Next billing date is set to ${formatDate(res.subscription.next_billing_date)}.`
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to renew subscription');
    },
  });

  const handleRenewSub = (sub: Subscription) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Alert.alert(
      'Renew Subscription',
      `Record renewal payment of ${formatCurrency(sub.amount_minor)} for "${sub.name}" and advance next billing date?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew Now',
          style: 'default',
          onPress: () => renewSubMutation.mutate(sub),
        },
      ]
    );
  };

  const updateSubMutation = useMutation({
    mutationFn: async () => {
      if (!editingSub) return;
      const minorAmount = parseMoneyToMinor(editAmount);
      if (minorAmount <= 0) throw new Error('Amount must be greater than zero');
      if (!editName.trim()) throw new Error('Name is required');

      let updatedBillingDate = editingSub.next_billing_date;
      if (editNextBillingDate && editNextBillingDate.trim()) {
        const trimmedDate = editNextBillingDate.trim();
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(trimmedDate)) {
          throw new Error('Next billing date must be in YYYY-MM-DD format');
        }
        const hasTime = editingSub.next_billing_date.includes('T') || editingSub.next_billing_date.includes(' ');
        const separator = editingSub.next_billing_date.includes('T') ? 'T' : ' ';
        const [, timePart] = hasTime ? editingSub.next_billing_date.split(separator) : ['', ''];
        updatedBillingDate = timePart ? `${trimmedDate}${separator}${timePart}` : trimmedDate;
      }

      return subscriptionService.updateSubscription(editingSub.id, {
        name: editName.trim(),
        amount_minor: minorAmount,
        billing_cycle: editCycle,
        next_billing_date: updatedBillingDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setEditModalVisible(false);
      setEditingSub(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update subscription');
    },
  });

  const handleOpenEditSub = (sub: Subscription) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEditingSub(sub);
    setEditName(sub.name);
    setEditAmount((sub.amount_minor / 100).toString());
    setEditCycle(sub.billing_cycle);
    setEditNextBillingDate(sub.next_billing_date ? sub.next_billing_date.substring(0, 10) : '');
    setEditModalVisible(true);
  };

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F9FE' }} edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1 mr-3">
            <Text className="text-[22px] font-extrabold text-zinc-950 tracking-tight">Subscriptions</Text>
            <Text className="text-xs font-medium text-zinc-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">Automated renewal tracking</Text>
          </View>

          <Button
            variant="primary"
            size="sm"
            style={{ flexShrink: 0 }}
            className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-zinc-950 shadow-xs"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-bold text-xs">Add Sub</Text>
          </Button>
        </View>

        {/* Clean Magpie Subscriptions Summary Card */}
        <Card className="bg-white border border-zinc-100 p-5 mb-5 rounded-3xl shadow-xs">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Monthly Subscriptions
              </Text>
              <Text className="text-[28px] font-extrabold text-zinc-950 tracking-tight">
                {formatCurrency(totalMonthlySpend)}
                <Text className="text-xs font-bold text-zinc-500"> /mo</Text>
              </Text>
            </View>

            <View className="bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100/60">
              <Text className="text-xs font-extrabold text-indigo-600">{activeCount} Active</Text>
            </View>
          </View>

          {/* Metrics Pill Bar */}
          <View className="flex-row pt-4 mt-2 border-t border-zinc-100 justify-between items-center">
            <View>
              <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Est. Annual Cost</Text>
              <Text className="text-sm font-extrabold text-zinc-900 mt-0.5">{formatCurrency(yearlySpend)}/yr</Text>
            </View>

            <View className="h-6 w-[1px] bg-zinc-100" />

            <View>
              <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Renewal Alerts</Text>
              <View className="flex-row items-center gap-1 mt-0.5">
                <ShieldCheck size={14} color="#10B981" />
                <Text className="text-xs font-bold text-emerald-600">24h Prior Alert</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Subscriptions List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
          {loadingSubs ? (
            <View className="py-8">
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : subscriptions.length === 0 ? (
            <Card className="p-8 bg-white border border-zinc-100 items-center mt-2 rounded-3xl shadow-xs">
              <View className="w-14 h-14 rounded-full bg-indigo-50 items-center justify-center mb-3">
                <CreditCard size={26} color="#6366F1" />
              </View>
              <Text className="text-base font-bold text-zinc-900 text-center">No active subscriptions</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-5 text-center px-4 leading-5">
                Track your Netflix, Spotify, iCloud or gym plans and get push reminders before your card is billed!
              </Text>
              <Button size="md" variant="primary" className="px-6 rounded-full" onPress={() => setModalVisible(true)}>
                + Add Subscription
              </Button>
            </Card>
          ) : (
            subscriptions.map((sub) => (
              <Card key={sub.id} className="mb-3 p-4.5 bg-white border border-zinc-100 rounded-3xl shadow-xs">
                {/* Top Section: Service Branding, Cycle Badge & Amount */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-3">
                    <View className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-100 items-center justify-center mr-3">
                      <Text className="font-extrabold text-base text-indigo-600">{sub.name[0]?.toUpperCase() || 'S'}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-bold text-zinc-950" numberOfLines={1}>
                        {sub.name}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Badge label={sub.billing_cycle} variant="subscription" />
                        <View className="flex-row items-center bg-indigo-50/80 px-2 py-0.5 rounded-full border border-indigo-100/60">
                          <Bell size={10} color="#6366F1" />
                          <Text className="text-[10px] font-bold text-indigo-600 ml-1">Auto Alert</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-[17px] font-extrabold text-zinc-950">{formatCurrency(sub.amount_minor)}</Text>
                    <Text className="text-[10px] font-semibold text-zinc-400 capitalize">per {sub.billing_cycle}</Text>
                  </View>
                </View>

                {/* Subtle Divider */}
                <View className="h-[1px] bg-zinc-100 w-full my-3" />

                {/* Bottom Section: Due Date & Action Buttons */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <CalendarIcon size={13} color="#71717A" />
                    <Text className="text-xs font-semibold text-zinc-500">
                      Due <Text className="font-bold text-zinc-800">{formatDate(sub.next_billing_date)}</Text>
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => handleRenewSub(sub)}
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 active:bg-emerald-100 border border-emerald-200/60"
                    >
                      <RotateCcw size={12} color="#059669" />
                      <Text className="text-xs font-bold text-emerald-700">Renew</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditSub(sub)}
                      className="p-2 rounded-full bg-zinc-100 active:bg-zinc-200 border border-zinc-200/60 items-center justify-center"
                    >
                      <Pencil size={12} color="#27272A" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
                        setSubToDelete(sub);
                      }}
                      className="p-2 rounded-full bg-rose-50 active:bg-rose-100 border border-rose-200/60 items-center justify-center"
                    >
                      <Trash2 size={12} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      {/* Custom Edit Subscription Modal */}
      <AppBottomSheet
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit Subscription"
        subtitle="Update subscription details"
        scrollable={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {updateSubMutation.isPending ? (
          <View className="py-12 items-center justify-center">
            <AppLoadingIndicator message="Updating subscription..." />
          </View>
        ) : (
          <View>
            <Input
              label="Service Name"
              placeholder="e.g. Netflix, Spotify"
              value={editName}
              onChangeText={setEditName}
            />

            <Input
              label="Amount (₹)"
              placeholder="649.00"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />

            {/* Cycle Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">Billing Cycle</Text>
              <View className="flex-row gap-2 flex-wrap">
                {(['weekly', 'monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setEditCycle(c)}
                    className={`py-2 px-3 rounded-xl border ${
                      editCycle === c
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold capitalize ${editCycle === c ? 'text-white' : 'text-zinc-700'}`}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Input
              label="Next Billing Date (YYYY-MM-DD)"
              placeholder="YYYY-MM-DD"
              value={editNextBillingDate}
              onChangeText={setEditNextBillingDate}
            />

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 rounded-2xl border-zinc-200/90"
                onPress={() => setEditModalVisible(false)}
              >
                <Text className="text-zinc-700 font-bold text-sm">Cancel</Text>
              </Button>

              <Button
                variant="purple"
                size="lg"
                className="flex-1 rounded-2xl shadow-xs"
                loading={updateSubMutation.isPending}
                disabled={updateSubMutation.isPending || !editName.trim() || !editAmount.trim()}
                onPress={() => updateSubMutation.mutate()}
              >
                <Text className="text-white font-bold text-sm">Save Changes</Text>
              </Button>
            </View>
          </View>
        )}
      </AppBottomSheet>

      {/* Custom Delete Confirmation Dialog */}
      <AppDialog
        visible={!!subToDelete}
        onClose={() => setSubToDelete(null)}
        title="Delete Subscription"
        description={`Are you sure you want to delete ${subToDelete?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive={true}
        isLoading={deleteSubMutation.isPending}
        loadingMessage="Deleting subscription..."
        onConfirm={() => subToDelete && deleteSubMutation.mutate(subToDelete.id)}
      />

      {/* Main Add Subscription Modal */}
      <AppBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Add Subscription"
        subtitle="Track recurring service"
        scrollable={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {createSubMutation.isPending ? (
          <View className="py-12 items-center justify-center">
            <AppLoadingIndicator message="Adding subscription..." subMessage="Setting up billing notifications" />
          </View>
        ) : (
          <View>
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

            {/* Renewal Date & Reminder Time on the Same Row */}
            <View className="flex-row gap-3 mb-4">
              {/* Renewal Date */}
              <View className="flex-1">
                <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Renewal Date</Text>
                <Pressable
                  onPress={() => setCalendarPickerVisible(true)}
                  className="flex-row items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3"
                >
                  <View className="flex-row items-center gap-2 flex-1 pr-1">
                    <CalendarIcon size={16} color="#6366F1" />
                    <Text className={`text-xs ${nextBillingDate ? 'text-zinc-900 font-bold' : 'text-zinc-400 font-medium'}`} numberOfLines={1}>
                      {nextBillingDate ? formatDate(nextBillingDate) : 'Auto (+1 cycle)'}
                    </Text>
                  </View>
                  {nextBillingDate ? (
                    <Pressable
                      onPress={() => setNextBillingDate('')}
                      className="w-5 h-5 rounded-full bg-zinc-200 items-center justify-center ml-1"
                    >
                      <X size={12} color="#3F3F46" />
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>

              {/* Reminder Time */}
              <View className="flex-1">
                <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Reminder Time</Text>
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setTimePickerVisible(true);
                  }}
                  className="flex-row items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3"
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <Clock size={16} color="#6366F1" />
                    <Text className="text-xs font-bold text-zinc-900" numberOfLines={1}>
                      {format12HourTime(renewalTime)}
                    </Text>
                  </View>
                </Pressable>
              </View>
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

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 rounded-2xl border-zinc-200/90"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-zinc-700 font-bold text-sm">Cancel</Text>
              </Button>

              <Button
                variant="purple"
                size="lg"
                className="flex-1 rounded-2xl shadow-xs"
                loading={createSubMutation.isPending}
                disabled={createSubMutation.isPending || !name.trim() || !amount.trim()}
                onPress={() => createSubMutation.mutate()}
              >
                <Text className="text-white font-bold text-sm">Save Subscription</Text>
              </Button>
            </View>
          </View>
        )}
      </AppBottomSheet>

      {/* Calendar Picker Sub-Modal */}
      <AppBottomSheet
        visible={calendarPickerVisible}
        onClose={() => setCalendarPickerVisible(false)}
        title="Select Billing Date"
        subtitle="Next renewal date"
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
                  className={`w-[14.28%] h-9 items-center justify-center rounded-xl mb-1 ${
                    isSelected ? 'bg-indigo-600' : 'active:bg-zinc-100'
                  }`}
                >
                  <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{day}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Close / Cancel Button */}
          <Pressable
            onPress={() => setCalendarPickerVisible(false)}
            className="mt-4 bg-white border border-zinc-200/90 py-3 rounded-2xl items-center active:bg-zinc-50 shadow-xs"
          >
            <Text className="text-zinc-700 font-bold text-xs">Cancel</Text>
          </Pressable>
        </View>
      </AppBottomSheet>

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
