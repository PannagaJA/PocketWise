import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { AppBottomSheet } from '../components/ui/AppBottomSheet';
import { AppDialog } from '../components/ui/AppDialog';
import { useAuth } from '../context/AuthContext';
import { reminderService, Reminder } from '../lib/services/reminder.service';
import { useModuleBack } from '../lib/navigation/moduleBack';
import { DatePickerModal } from '../components/ui/DatePickerModal';
import { TimePickerModal, format12HourTime } from '../components/ui/TimePickerModal';
import { Plus, X, ArrowLeft, Calendar, CheckCircle2, Clock, Bell, Trash2, Check, AlertCircle, Receipt, RotateCcw, Target, Sparkles, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function RemindersScreen() {
  const { user } = useAuth();
  const goBack = useModuleBack();
  const queryClient = useQueryClient();

  // Filter state
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'all'>('upcoming');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'custom' | 'bill' | 'subscription' | 'goal'>('custom');

  // Date and Time for "When to Remind"
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const [scheduledDate, setScheduledDate] = useState<string>(getTomorrowDateStr());
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');

  // Query reminders
  const { data: reminders = [], isLoading: loadingReminders, refetch } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: () => reminderService.getReminders(user?.id || ''),
    enabled: !!user?.id,
  });

  // Calculate upcoming and completed lists
  const now = new Date();
  const upcomingReminders = useMemo(() => {
    return reminders.filter((r) => r.status === 'pending');
  }, [reminders]);

  const completedReminders = useMemo(() => {
    return reminders.filter((r) => r.status === 'sent' || r.status === 'cancelled');
  }, [reminders]);

  const displayedReminders = useMemo(() => {
    if (activeTab === 'upcoming') return upcomingReminders;
    if (activeTab === 'completed') return completedReminders;
    return reminders;
  }, [activeTab, upcomingReminders, completedReminders, reminders]);

  // Next upcoming reminder banner
  const nextReminder = useMemo(() => {
    if (upcomingReminders.length === 0) return null;
    return upcomingReminders[0];
  }, [upcomingReminders]);

  // Quick preset helper
  const applyPreset = (preset: 'tomorrow_morning' | 'this_weekend' | 'next_monday' | 'month_end') => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const target = new Date();

    if (preset === 'tomorrow_morning') {
      target.setDate(target.getDate() + 1);
      setScheduledDate(target.toISOString().split('T')[0]);
      setScheduledTime('09:00');
    } else if (preset === 'this_weekend') {
      // Find upcoming Saturday
      const day = target.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      setScheduledDate(target.toISOString().split('T')[0]);
      setScheduledTime('10:00');
    } else if (preset === 'next_monday') {
      // Find upcoming Monday
      const day = target.getDay();
      const diff = (1 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      setScheduledDate(target.toISOString().split('T')[0]);
      setScheduledTime('09:00');
    } else if (preset === 'month_end') {
      // Last day of current month
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      setScheduledDate(lastDay.toISOString().split('T')[0]);
      setScheduledTime('18:00');
    }
  };

  // Human readable preview of scheduled time
  const scheduledPreviewText = useMemo(() => {
    try {
      const dt = new Date(`${scheduledDate}T${scheduledTime}:00`);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) + ` at ${format12HourTime(scheduledTime)}`;
    } catch {
      return `${scheduledDate} at ${scheduledTime}`;
    }
  }, [scheduledDate, scheduledTime]);

  // Mutations
  const createReminderMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Reminder title is required');
      if (!user?.id) throw new Error('User authentication required');

      const fullScheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      const scheduleTimeObj = new Date(fullScheduledAt);

      if (isNaN(scheduleTimeObj.getTime())) {
        throw new Error('Invalid scheduled date or time');
      }

      return reminderService.createReminder({
        user_id: user.id,
        type,
        title: title.trim(),
        body: body.trim(),
        scheduled_at: scheduleTimeObj.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setModalVisible(false);
      resetForm();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to schedule reminder');
    },
  });

  const completeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      await reminderService.completeReminder(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to complete reminder');
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      await reminderService.deleteReminder(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setReminderToDelete(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete reminder');
    },
  });

  const resetForm = () => {
    setTitle('');
    setBody('');
    setType('custom');
    setScheduledDate(getTomorrowDateStr());
    setScheduledTime('09:00');
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'bill':
        return <Receipt size={18} color="#D97706" />;
      case 'subscription':
        return <RotateCcw size={18} color="#7C3AED" />;
      case 'goal':
        return <Target size={18} color="#4F46E5" />;
      default:
        return <Bell size={18} color="#EA580C" />;
    }
  };

  const getTypeBg = (t: string) => {
    switch (t) {
      case 'bill':
        return 'bg-amber-50';
      case 'subscription':
        return 'bg-purple-50';
      case 'goal':
        return 'bg-indigo-50';
      default:
        return 'bg-orange-50';
    }
  };

  const formatReminderDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const isToday = new Date().toDateString() === d.toDateString();
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      const isTomorrow = tom.toDateString() === d.toDateString();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today at ${timeStr}`;
      if (isTomorrow) return `Tomorrow at ${timeStr}`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F9FE' }} edges={['top']}>
      {/* Header with Back Navigation */}
      <View style={{ backgroundColor: '#F8F9FE' }} className="px-4 pt-2 pb-2.5 flex-row items-center justify-between border-b border-zinc-100">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={goBack}
            className="w-10 h-10 rounded-2xl bg-white border border-zinc-200/80 items-center justify-center mr-3 active:bg-zinc-100 shadow-xs"
          >
            <ArrowLeft size={18} color="#09090B" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[20px] font-extrabold text-zinc-950 tracking-tight">Reminders & Alerts</Text>
            <Text className="text-xs font-medium text-zinc-500 mt-0.5">Schedule and manage custom financial alerts</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            resetForm();
            setModalVisible(true);
          }}
          className="w-10 h-10 rounded-2xl bg-zinc-950 items-center justify-center active:bg-zinc-800 shadow-xs"
        >
          <Plus size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        style={{ backgroundColor: '#F8F9FE' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="p-4">
          {/* Quick Stats Overview Banner */}
          <Card className="p-4 mb-4 bg-white border border-zinc-100 rounded-3xl shadow-xs">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-orange-100 items-center justify-center">
                  <Bell size={16} color="#EA580C" />
                </View>
                <Text className="text-sm font-bold text-zinc-950">Active Alerts</Text>
              </View>
              <Badge
                label={`${upcomingReminders.length} Scheduled`}
                variant={upcomingReminders.length > 0 ? 'budget' : 'neutral'}
              />
            </View>

            {nextReminder ? (
              <View className="bg-orange-50/70 border border-orange-100 rounded-2xl p-3 flex-row items-center justify-between">
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-bold text-orange-950 uppercase tracking-wide">Next Reminder</Text>
                  <Text className="text-sm font-extrabold text-zinc-900 mt-0.5" numberOfLines={1}>
                    {nextReminder.title}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    <Clock size={12} color="#D97706" />
                    <Text className="text-[11px] font-semibold text-orange-800">
                      {formatReminderDate(nextReminder.scheduled_at)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => completeReminderMutation.mutate(nextReminder.id!)}
                  className="px-3 py-1.5 bg-white rounded-xl border border-orange-200 items-center justify-center active:bg-orange-100 shadow-xs"
                >
                  <Text className="text-xs font-bold text-orange-900">Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="py-1">
                <Text className="text-xs text-zinc-500 font-medium">
                  No pending reminders. Schedule alerts for bills, SIP investments, rent, or custom tasks.
                </Text>
              </View>
            )}
          </Card>

          {/* Filter Pills */}
          <View className="flex-row bg-zinc-100/80 p-1 rounded-2xl mb-4">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveTab('upcoming');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'upcoming' ? 'bg-white shadow-xs' : ''}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'upcoming' ? 'text-zinc-950' : 'text-zinc-500'}`}>
                Upcoming ({upcomingReminders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveTab('completed');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'completed' ? 'bg-white shadow-xs' : ''}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'completed' ? 'text-zinc-950' : 'text-zinc-500'}`}>
                Completed ({completedReminders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setActiveTab('all');
              }}
              className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'all' ? 'bg-white shadow-xs' : ''}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'all' ? 'text-zinc-950' : 'text-zinc-500'}`}>
                All ({reminders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reminders List */}
          {loadingReminders ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="small" color="#09090B" />
              <Text className="text-xs text-zinc-400 font-medium mt-2">Loading reminders...</Text>
            </View>
          ) : displayedReminders.length === 0 ? (
            <Card className="p-8 bg-white border border-zinc-100 items-center justify-center rounded-3xl mt-2">
              <View className="w-14 h-14 rounded-full bg-orange-50 items-center justify-center mb-3">
                <Bell size={24} color="#EA580C" />
              </View>
              <Text className="text-sm font-bold text-zinc-900 text-center">
                {activeTab === 'upcoming'
                  ? 'No Upcoming Reminders'
                  : activeTab === 'completed'
                  ? 'No Completed Reminders'
                  : 'No Reminders Created Yet'}
              </Text>
              <Text className="text-xs text-zinc-400 text-center mt-1 mb-5 max-w-[260px]">
                {activeTab === 'upcoming'
                  ? 'Stay on top of payments, investments, and tasks by scheduling a custom reminder.'
                  : 'Reminders you mark as completed or sent will appear here in your history.'}
              </Text>
              <Button
                size="sm"
                variant="primary"
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  resetForm();
                  setModalVisible(true);
                }}
              >
                <Text className="text-white font-bold text-xs">+ Schedule Reminder</Text>
              </Button>
            </Card>
          ) : (
            displayedReminders.map((r) => {
              const isPending = r.status === 'pending';
              const isPast = new Date(r.scheduled_at).getTime() < Date.now();

              return (
                <View
                  key={r.id}
                  className="mb-3 bg-white border border-zinc-100 rounded-2xl p-4 shadow-xs flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className={`w-10 h-10 rounded-2xl ${getTypeBg(r.type)} items-center justify-center mr-3`}>
                      {getTypeIcon(r.type)}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-sm font-bold text-zinc-950" numberOfLines={1}>
                          {r.title}
                        </Text>
                        {!isPending ? (
                          <Badge label="Done" variant="income" />
                        ) : isPast ? (
                          <Badge label="Due" variant="expense" />
                        ) : null}
                      </View>

                      {r.body ? (
                        <Text className="text-xs font-medium text-zinc-500 mt-0.5" numberOfLines={2}>
                          {r.body}
                        </Text>
                      ) : null}

                      <View className="flex-row items-center gap-1.5 mt-2">
                        <Clock size={12} color="#71717A" />
                        <Text className="text-[11px] font-semibold text-zinc-600">
                          {formatReminderDate(r.scheduled_at)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View className="flex-row items-center gap-1.5">
                    {isPending ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => completeReminderMutation.mutate(r.id!)}
                        className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 items-center justify-center active:bg-emerald-100 shadow-xs"
                      >
                        <Check size={16} color="#059669" strokeWidth={2.5} />
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setReminderToDelete(r);
                      }}
                      className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-200/80 items-center justify-center active:bg-rose-50 shadow-xs"
                    >
                      <Trash2 size={15} color="#71717A" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Schedule Reminder Modal */}
      <AppBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Schedule Reminder"
        subtitle="Set when to receive a notification"
        scrollable={true}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="gap-4">
            {/* Title Input */}
            <Input
              label="Reminder Title *"
              placeholder="e.g. Pay HDFC Credit Card, Review SIP, Rent"
              value={title}
              onChangeText={setTitle}
            />

            {/* Note / Body */}
            <Input
              label="Notes (Optional)"
              placeholder="e.g. Account XX4521, check balance before debiting"
              value={body}
              onChangeText={setBody}
            />

            {/* Category Type Selection */}
            <View>
              <Text className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 ml-1">
                Category
              </Text>
              <View className="flex-row gap-2">
                {[
                  { key: 'custom', label: 'Custom', icon: Bell, color: '#EA580C' },
                  { key: 'bill', label: 'Bill', icon: Receipt, color: '#D97706' },
                  { key: 'subscription', label: 'Sub', icon: RotateCcw, color: '#7C3AED' },
                  { key: 'goal', label: 'Goal', icon: Target, color: '#4F46E5' },
                ].map((item) => {
                  const isSelected = type === item.key;
                  const IconComp = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.7}
                      onPress={() => {
                        try { Haptics.selectionAsync(); } catch {}
                        setType(item.key as any);
                      }}
                      className={`flex-1 py-2.5 px-2 rounded-2xl border items-center justify-center flex-row gap-1.5 ${
                        isSelected
                          ? 'bg-zinc-900 border-zinc-900'
                          : 'bg-white border-zinc-200 active:bg-zinc-50'
                      }`}
                    >
                      <IconComp size={14} color={isSelected ? '#FFF' : item.color} />
                      <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-700'}`}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Quick Presets for "When to Remind" */}
            <View>
              <Text className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 ml-1">
                When to Remind
              </Text>

              {/* Quick Presets Pills */}
              <View className="flex-row flex-wrap gap-2 mb-3">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => applyPreset('tomorrow_morning')}
                  className="py-2 px-3 rounded-xl bg-orange-50 border border-orange-200/60 active:bg-orange-100"
                >
                  <Text className="text-xs font-bold text-orange-950">Tomorrow 9 AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => applyPreset('this_weekend')}
                  className="py-2 px-3 rounded-xl bg-orange-50 border border-orange-200/60 active:bg-orange-100"
                >
                  <Text className="text-xs font-bold text-orange-950">This Weekend</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => applyPreset('next_monday')}
                  className="py-2 px-3 rounded-xl bg-orange-50 border border-orange-200/60 active:bg-orange-100"
                >
                  <Text className="text-xs font-bold text-orange-950">Next Monday</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => applyPreset('month_end')}
                  className="py-2 px-3 rounded-xl bg-orange-50 border border-orange-200/60 active:bg-orange-100"
                >
                  <Text className="text-xs font-bold text-orange-950">End of Month</Text>
                </TouchableOpacity>
              </View>

              {/* Custom Date & Time Controls */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 ml-1">
                    Reminder Date
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDatePickerVisible(true)}
                    className="flex-row items-center justify-between p-3.5 bg-white border border-zinc-200 rounded-2xl active:bg-zinc-50 shadow-xs"
                  >
                    <View className="flex-row items-center gap-2">
                      <Calendar size={16} color="#71717A" />
                      <Text className="text-sm font-bold text-zinc-900">
                        {formatDateDisplay(scheduledDate)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View className="flex-1">
                  <Text className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 ml-1">
                    Time
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setTimePickerVisible(true)}
                    className="flex-row items-center justify-between p-3.5 bg-white border border-zinc-200 rounded-2xl active:bg-zinc-50 shadow-xs"
                  >
                    <View className="flex-row items-center gap-2">
                      <Clock size={16} color="#71717A" />
                      <Text className="text-sm font-bold text-zinc-900">
                        {format12HourTime(scheduledTime)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Notification Preview Box */}
            <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                <Bell size={16} color="#EA580C" />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                  Scheduled Notification
                </Text>
                <Text className="text-xs font-extrabold text-zinc-900 mt-0.5">
                  {scheduledPreviewText}
                </Text>
              </View>
            </View>

            {/* Save Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={() => createReminderMutation.mutate()}
              loading={createReminderMutation.isPending}
              className="mt-2"
            >
              <Text className="text-white font-bold text-sm">Schedule Reminder</Text>
            </Button>
          </View>
        </KeyboardAvoidingView>
      </AppBottomSheet>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        selectedDate={scheduledDate}
        onSelectDate={(date) => {
          if (date) setScheduledDate(date);
        }}
        title="Select Reminder Date"
      />

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        selectedTime24={scheduledTime}
        onSelectTime={(t24) => setScheduledTime(t24)}
      />

      {/* Confirm Delete Dialog */}
      <AppDialog
        visible={!!reminderToDelete}
        onClose={() => setReminderToDelete(null)}
        title="Delete Reminder?"
        description={`Are you sure you want to remove the reminder "${reminderToDelete?.title}"? Scheduled notifications will be cancelled.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        confirmVariant="destructive"
        onConfirm={() => {
          if (reminderToDelete?.id) {
            deleteReminderMutation.mutate(reminderToDelete.id);
          }
        }}
        isLoading={deleteReminderMutation.isPending}
      />
    </SafeAreaView>
  );
}
