import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { lendService, LendRecord } from '../lib/services/lend.service';
import { formatMoney, formatDate, parseMoneyToMinor } from '../lib/finance/core';
import {
  Plus,
  X,
  ArrowLeft,
  User,
  IndianRupee,
  Calendar,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  HandCoins,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

function getDaysLabel(
  dueDate: string,
  status: string
): { text: string; badgeVariant: 'income' | 'expense' | 'budget' | 'subscription' } {
  if (status === 'collected') return { text: 'Collected', badgeVariant: 'income' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, badgeVariant: 'expense' };
  if (diff === 0) return { text: 'Due Today!', badgeVariant: 'budget' };
  if (diff === 1) return { text: 'Due Tomorrow', badgeVariant: 'budget' };
  if (diff <= 3) return { text: `Due in ${diff}d`, badgeVariant: 'budget' };
  return { text: `${diff} days left`, badgeVariant: 'subscription' };
}

function getTodayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

const DATE_PRESETS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
];

export default function LendsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'collected'>('active');

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [lentDate, setLentDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState(addDays(getTodayISO(), 7));

  // Reschedule modal state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<LendRecord | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  // TanStack Query for reactive data loading
  const { data: lends = [], isLoading: loadingLends } = useQuery({
    queryKey: ['lends', user?.id],
    queryFn: () => lendService.getAll(),
  });

  const activeRecords = lends
    .filter((r) => r.status === 'active' || r.status === 'overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const collectedRecords = lends
    .filter((r) => r.status === 'collected')
    .sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''));

  const displayedRecords = activeTab === 'active' ? activeRecords : collectedRecords;
  const totalOutstanding = activeRecords.reduce((s, r) => s + r.amountMinor, 0);
  const overdueCount = activeRecords.filter((r) => r.status === 'overdue').length;

  const resetForm = () => {
    setPersonName('');
    setAmount('');
    setNotes('');
    setLentDate(getTodayISO());
    setDueDate(addDays(getTodayISO(), 7));
  };

  // Mutations
  const createLendMutation = useMutation({
    mutationFn: async () => {
      const name = personName.trim();
      if (!name) throw new Error("Please enter the person's name.");
      const amountMinor = parseMoneyToMinor(amount);
      if (amountMinor <= 0) throw new Error('Please enter a valid amount greater than ₹0.');
      if (!dueDate || dueDate < lentDate) throw new Error('Collection date must be on or after lent date.');
      return lendService.createLend({
        personName: name,
        amountMinor,
        notes: notes.trim() || undefined,
        lentDate,
        dueDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      setShowAdd(false);
      resetForm();
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Alert.alert(
        '✅ Lend Added',
        `A reminder notification is scheduled for ${formatDate(dueDate)} at 9:00 AM to collect the money.`
      );
    },
    onError: (err: any) => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      Alert.alert('Error', err.message || 'Could not save lend record.');
    },
  });

  const markCollectedMutation = useMutation({
    mutationFn: async (id: string) => {
      return lendService.markCollected(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: () => {
      Alert.alert('Error', 'Could not update record.');
    },
  });

  const deleteLendMutation = useMutation({
    mutationFn: async (id: string) => {
      return lendService.deleteLend(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: () => {
      Alert.alert('Error', 'Could not delete record.');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!rescheduleTarget || !newDueDate) return;
      return lendService.updateDueDate(rescheduleTarget.id, newDueDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      setShowReschedule(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: () => {
      Alert.alert('Error', 'Could not update collection date.');
    },
  });

  const confirmMarkCollected = (record: LendRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Alert.alert(
      'Mark as Collected?',
      `Confirm you have received ${formatMoney(record.amountMinor)} from ${record.personName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Collected ✓',
          onPress: () => markCollectedMutation.mutate(record.id),
        },
      ]
    );
  };

  const confirmDelete = (record: LendRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    Alert.alert(
      'Delete Record?',
      `Remove the lend record for ${record.personName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLendMutation.mutate(record.id),
        },
      ]
    );
  };

  const openReschedule = (record: LendRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setRescheduleTarget(record);
    setNewDueDate(record.dueDate);
    setShowReschedule(true);
  };

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
              <Text className="text-2xl font-black text-zinc-900">Money Lends</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">Track money given & collection reminders</Text>
            </View>
          </View>

          <Button
            variant="primary"
            size="sm"
            className="flex-row space-x-1"
            onPress={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add Lend</Text>
          </Button>
        </View>

        {/* Outstanding Commitment Summary Card */}
        {activeRecords.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 p-5 mb-3.5 rounded-3xl shadow-md flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <HandCoins size={14} color="#6366F1" />
                <Text className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Total Outstanding Lent
                </Text>
              </View>

              <Text className="text-2xl font-black text-white">
                {formatMoney(totalOutstanding)}
              </Text>
              <Text className="text-xs text-zinc-400 mt-0.5">
                {activeRecords.length} pending lend{activeRecords.length !== 1 ? 's' : ''} to collect
              </Text>

              {overdueCount > 0 && (
                <View className="mt-2.5 flex-row items-center">
                  <View className="bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30 flex-row items-center gap-1">
                    <AlertTriangle size={11} color="#EF4444" />
                    <Text className="text-[11px] font-bold text-rose-400">
                      {overdueCount} Overdue
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View className="w-14 h-14 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 items-center justify-center">
              <HandCoins size={28} color="#818CF8" />
            </View>
          </Card>
        )}

        {/* Tab Pills: Pending vs Collected */}
        <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-3">
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('active');
            }}
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'active' ? 'bg-white' : ''}`}
          >
            <Text className={`font-semibold text-xs ${activeTab === 'active' ? 'text-zinc-900 font-bold' : 'text-zinc-500'}`}>
              Pending ({activeRecords.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('collected');
            }}
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'collected' ? 'bg-white' : ''}`}
          >
            <Text className={`font-semibold text-xs ${activeTab === 'collected' ? 'text-emerald-600 font-bold' : 'text-zinc-500'}`}>
              Collected ({collectedRecords.length})
            </Text>
          </Pressable>
        </View>

        {/* Lends List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {loadingLends ? (
            <View className="py-8">
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : displayedRecords.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-2 rounded-2xl">
              <View
                className={`w-12 h-12 rounded-2xl items-center justify-center mb-3 ${
                  activeTab === 'active' ? 'bg-indigo-50' : 'bg-emerald-50'
                }`}
              >
                {activeTab === 'active' ? (
                  <HandCoins size={24} color="#6366F1" />
                ) : (
                  <CheckCircle2 size={24} color="#10B981" />
                )}
              </View>
              <Text className="text-sm font-bold text-zinc-900">
                {activeTab === 'active' ? 'No pending lends' : 'No collected lends'}
              </Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                {activeTab === 'active'
                  ? "Record money you've lent to friends or family and set reminders."
                  : 'Lends you mark as collected will appear here.'}
              </Text>
              {activeTab === 'active' && (
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => {
                    resetForm();
                    setShowAdd(true);
                  }}
                >
                  <Text className="text-white font-semibold text-xs">Record a Lend</Text>
                </Button>
              )}
            </Card>
          ) : (
            displayedRecords.map((record) => {
              const isOverdue = record.status === 'overdue';
              const isCollected = record.status === 'collected';
              const dayBadge = getDaysLabel(record.dueDate, record.status);

              return (
                <Card key={record.id} className="mb-3 p-4 bg-white border border-zinc-200 rounded-2xl">
                  {/* Top Row: Person & Amount */}
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View
                        className={`w-10 h-10 rounded-xl items-center justify-center mr-2.5 ${
                          isCollected ? 'bg-emerald-50' : isOverdue ? 'bg-rose-50' : 'bg-indigo-50'
                        }`}
                      >
                        {isCollected ? (
                          <CheckCircle2 size={20} color="#10B981" />
                        ) : isOverdue ? (
                          <AlertTriangle size={20} color="#EF4444" />
                        ) : (
                          <User size={20} color="#6366F1" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-zinc-900" numberOfLines={1}>
                          {record.personName}
                        </Text>
                        <Text className="text-xs text-zinc-500 mt-0.5">
                          Lent on {formatDate(record.lentDate)}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end gap-1">
                      <Text
                        className={`text-base font-extrabold ${
                          isCollected ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-zinc-900'
                        }`}
                      >
                        {formatMoney(record.amountMinor)}
                      </Text>
                      <Badge label={dayBadge.text} variant={dayBadge.badgeVariant} />
                    </View>
                  </View>

                  {/* Date information */}
                  <View className="flex-row items-center justify-between pt-2 pb-1 border-t border-zinc-100">
                    <View className="flex-row items-center gap-1.5">
                      <Calendar size={13} color="#71717A" />
                      <Text className="text-xs text-zinc-500">
                        {isCollected
                          ? `Collected ${record.collectedAt ? formatDate(record.collectedAt.substring(0, 10)) : ''}`
                          : `Due ${formatDate(record.dueDate)}`}
                      </Text>
                    </View>
                    {record.notes ? (
                      <View className="flex-row items-center gap-1 flex-1 justify-end ml-3">
                        <FileText size={12} color="#71717A" />
                        <Text className="text-xs text-zinc-500" numberOfLines={1}>
                          {record.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions */}
                  {!isCollected ? (
                    <View className="flex-row gap-2 mt-3 pt-2.5 border-t border-zinc-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-300 bg-emerald-50/40"
                        onPress={() => confirmMarkCollected(record)}
                      >
                        <CheckCircle2 size={14} color="#10B981" />
                        <Text className="text-emerald-700 font-bold text-xs ml-1.5">Mark Collected</Text>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-indigo-200 bg-indigo-50/40 px-3"
                        onPress={() => openReschedule(record)}
                      >
                        <RefreshCw size={14} color="#6366F1" />
                        <Text className="text-indigo-700 font-bold text-xs ml-1.5">Reschedule</Text>
                      </Button>

                      <Pressable
                        onPress={() => confirmDelete(record)}
                        className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 items-center justify-center active:bg-rose-100"
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row justify-end mt-2 pt-2 border-t border-zinc-100">
                      <Pressable
                        onPress={() => confirmDelete(record)}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:bg-zinc-100"
                      >
                        <Trash2 size={13} color="#A1A1AA" />
                        <Text className="text-xs text-zinc-400">Remove</Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ── Add Lend Modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable className="flex-1 justify-end bg-black/40" onPress={() => Keyboard.dismiss()}>
            <Pressable
              className="bg-white rounded-t-3xl p-6 border-t border-zinc-200 max-h-[85%]"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-zinc-900">Record a Lend</Text>
                <Pressable onPress={() => setShowAdd(false)} className="p-1">
                  <X size={20} color="#71717A" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Input
                  label="Person's Name"
                  placeholder="e.g. Rahul, Priya, Amit..."
                  value={personName}
                  onChangeText={setPersonName}
                />

                <Input
                  label="Amount Lent (₹)"
                  placeholder="500.00"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />

                <Input
                  label="Date Lent (YYYY-MM-DD)"
                  placeholder="YYYY-MM-DD"
                  value={lentDate}
                  onChangeText={setLentDate}
                />

                <Input
                  label="Collect Back By (YYYY-MM-DD)"
                  placeholder="YYYY-MM-DD"
                  value={dueDate}
                  onChangeText={setDueDate}
                />

                {/* Preset Pills */}
                <View className="flex-row gap-2 mb-4 flex-wrap">
                  {DATE_PRESETS.map((p) => {
                    const target = addDays(lentDate || getTodayISO(), p.days);
                    const isSelected = dueDate === target;
                    return (
                      <Pressable
                        key={p.label}
                        onPress={() => {
                          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                          setDueDate(target);
                        }}
                        className={`px-3 py-1.5 rounded-full border ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-zinc-50 border-zinc-200'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-600'}`}>
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Input
                  label="Notes (Optional)"
                  placeholder="e.g. Rent share, trip expenses..."
                  value={notes}
                  onChangeText={setNotes}
                />

                <View className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 flex-row gap-2 items-start">
                  <Text className="text-base">🔔</Text>
                  <Text className="text-xs text-indigo-700 flex-1 leading-relaxed">
                    A reminder notification will be sent at{' '}
                    <Text className="font-bold">9:00 AM on {dueDate ? formatDate(dueDate) : 'due date'}</Text>{' '}
                    to collect your money.
                  </Text>
                </View>

                <Button
                  variant="primary"
                  size="lg"
                  loading={createLendMutation.isPending}
                  className="mt-2 mb-4"
                  onPress={() => createLendMutation.mutate()}
                >
                  <Text className="text-white font-semibold">Save & Set Reminder</Text>
                </Button>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Reschedule Modal ── */}
      <Modal visible={showReschedule} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            className="flex-1 justify-center items-center bg-black/50 px-5"
            onPress={() => setShowReschedule(false)}
          >
            <Pressable
              className="bg-white rounded-3xl p-5 w-full border border-zinc-200 shadow-xl"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="text-lg font-black text-zinc-900 mb-1">Reschedule Collection</Text>
              {rescheduleTarget && (
                <Text className="text-xs text-zinc-500 mb-4">
                  {rescheduleTarget.personName} · {formatMoney(rescheduleTarget.amountMinor)}
                </Text>
              )}

              <Input
                label="New Collection Date (YYYY-MM-DD)"
                value={newDueDate}
                onChangeText={setNewDueDate}
                placeholder="YYYY-MM-DD"
              />

              <View className="flex-row gap-2 mb-5 flex-wrap">
                {DATE_PRESETS.map((p) => {
                  const target = addDays(getTodayISO(), p.days);
                  const isSelected = newDueDate === target;
                  return (
                    <Pressable
                      key={p.label}
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setNewDueDate(target);
                      }}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-600'}`}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  size="md"
                  className="flex-1 border-zinc-200"
                  onPress={() => setShowReschedule(false)}
                >
                  <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  loading={rescheduleMutation.isPending}
                  onPress={() => rescheduleMutation.mutate()}
                >
                  <Text className="text-white font-bold text-xs">Update Date</Text>
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
