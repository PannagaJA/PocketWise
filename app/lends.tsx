import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
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
import { AppModal } from '../components/ui/AppModal';
import { DatePickerButton } from '../components/ui/DatePickerModal';
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
  Pencil,
  Phone,
  MessageSquare,
  Send,
  BookUser,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  pickContactFromDevice,
  getReminderMessage,
  openSmsComposer,
  openWhatsAppComposer,
} from '../lib/services/sms-reminder.service';
import { useModuleBack } from '../lib/navigation/moduleBack';

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
  const goBack = useModuleBack();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'collected'>('active');

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [personName, setPersonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pickingContact, setPickingContact] = useState(false);
  const [amount, setAmount] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [isCustomCollectAmount, setIsCustomCollectAmount] = useState(false);
  const [notes, setNotes] = useState('');
  const [lentDate, setLentDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState(addDays(getTodayISO(), 7));

  // Reschedule modal state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<LendRecord | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  // Edit Amount modal state
  const [showEditAmount, setShowEditAmount] = useState(false);
  const [editAmountTarget, setEditAmountTarget] = useState<LendRecord | null>(null);
  const [newCollectAmount, setNewCollectAmount] = useState('');

  // SMS Reminder modal state
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsTarget, setSmsTarget] = useState<LendRecord | null>(null);
  const [smsRecipientPhone, setSmsRecipientPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsTemplate, setSmsTemplate] = useState<'friendly' | 'due' | 'overdue'>('friendly');
  const [sendingSms, setSendingSms] = useState(false);

  // TanStack Query for reactive data loading
  const { data: lends = [], isLoading: loadingLends } = useQuery({
    queryKey: ['lends', user?.id],
    queryFn: () => lendService.getAll(user?.id),
    enabled: !!user?.id || true,
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
    setPhoneNumber('');
    setAmount('');
    setCollectAmount('');
    setIsCustomCollectAmount(false);
    setNotes('');
    setLentDate(getTodayISO());
    setDueDate(addDays(getTodayISO(), 7));
  };

  // Pick contact from phone address book
  const handlePickContactForAdd = async () => {
    try {
      setPickingContact(true);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      const result = await pickContactFromDevice();
      if (result.success) {
        if (result.name) setPersonName(result.name);
        if (result.phone) setPhoneNumber(result.phone);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      } else if (result.reason === 'permission_denied') {
        Alert.alert(
          'Contacts Permission',
          'PocketWise needs permission to access your contacts to pick names & numbers automatically. You can also type them in manually below.'
        );
      } else if (result.reason === 'unavailable') {
        Alert.alert(
          'Manual Entry',
          result.error || 'Contact picker requires a development build. You can enter the customer name and number manually below.'
        );
      } else if (result.reason === 'error') {
        Alert.alert('Contacts', result.error || 'Could not access contacts.');
      }
    } catch (err: any) {
      Alert.alert('Contacts', err?.message || 'Could not open contact picker.');
    } finally {
      setPickingContact(false);
    }
  };

  // Open SMS Reminder modal for a lend record
  const openSmsModal = (record: LendRecord) => {
    if (record.status === 'collected') {
      Alert.alert(
        'Already Collected',
        `This lend for ${record.personName} has already been marked as collected. Reminders cannot be sent for settled lends.`
      );
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSmsTarget(record);
    setSmsRecipientPhone(record.phoneNumber || '');

    const isOverdue = record.status === 'overdue';
    const isToday = record.dueDate === getTodayISO();
    const initialType: 'friendly' | 'due' | 'overdue' = isOverdue ? 'overdue' : isToday ? 'due' : 'friendly';
    setSmsTemplate(initialType);

    const msg = getReminderMessage(initialType, {
      personName: record.personName,
      amountMinor: record.amountMinor,
      dueDate: record.dueDate,
      lentDate: record.lentDate,
    });
    setSmsMessage(msg);
    setShowSmsModal(true);
  };

  const handleSelectTemplate = (type: 'friendly' | 'due' | 'overdue') => {
    if (!smsTarget) return;
    setSmsTemplate(type);
    const msg = getReminderMessage(type, {
      personName: smsTarget.personName,
      amountMinor: smsTarget.amountMinor,
      dueDate: smsTarget.dueDate,
      lentDate: smsTarget.lentDate,
    });
    setSmsMessage(msg);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const handlePickContactForSms = async () => {
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      const result = await pickContactFromDevice();
      if (result.success) {
        if (result.phone) setSmsRecipientPhone(result.phone);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      } else if (result.reason === 'permission_denied') {
        Alert.alert(
          'Contacts Permission',
          'Please allow contact access to pick a number, or enter the number manually.'
        );
      } else if (result.reason === 'unavailable') {
        Alert.alert(
          'Manual Entry',
          result.error || 'Contact picker requires a development build. You can enter the customer number manually below.'
        );
      }
    } catch (err: any) {
      Alert.alert('Contacts', err?.message || 'Could not open contacts.');
    }
  };

  const handleSendSms = async () => {
    if (!smsTarget) return;
    if (smsTarget.status === 'collected') {
      Alert.alert('Already Collected', 'This lend has already been marked as collected.');
      setShowSmsModal(false);
      return;
    }
    const phone = smsRecipientPhone.trim();
    if (!phone) {
      Alert.alert('Phone Number Required', 'Please enter a mobile number or choose from contacts to send an SMS reminder.');
      return;
    }
    if (!smsMessage.trim()) {
      Alert.alert('Message Required', 'Please enter a message to send.');
      return;
    }

    try {
      setSendingSms(true);
      // If phone number was added or changed, update the lend record so it is remembered
      if (phone !== smsTarget.phoneNumber) {
        await lendService.updatePhoneNumber(smsTarget.id, phone, user?.id);
        queryClient.invalidateQueries({ queryKey: ['lends'] });
      }

      await openSmsComposer(phone, smsMessage);
      setShowSmsModal(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (err: any) {
      Alert.alert('SMS Error', err?.message || 'Could not launch SMS composer.');
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!smsTarget) return;
    if (smsTarget.status === 'collected') {
      Alert.alert('Already Collected', 'This lend has already been marked as collected.');
      setShowSmsModal(false);
      return;
    }
    const phone = smsRecipientPhone.trim();
    if (!phone) {
      Alert.alert('Phone Number Required', 'Please enter a mobile number or choose from contacts.');
      return;
    }
    if (!smsMessage.trim()) {
      Alert.alert('Message Required', 'Please enter a message to send.');
      return;
    }

    try {
      setSendingSms(true);
      if (phone !== smsTarget.phoneNumber) {
        await lendService.updatePhoneNumber(smsTarget.id, phone, user?.id);
        queryClient.invalidateQueries({ queryKey: ['lends'] });
      }

      await openWhatsAppComposer(phone, smsMessage);
      setShowSmsModal(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err?.message || 'Could not launch WhatsApp.');
    } finally {
      setSendingSms(false);
    }
  };

  // Mutations
  const createLendMutation = useMutation({
    mutationFn: async () => {
      const name = personName.trim();
      if (!name) throw new Error("Please enter the person's name.");
      const finalCollectStr = collectAmount.trim() || amount.trim();
      const amountMinor = parseMoneyToMinor(finalCollectStr);
      if (amountMinor <= 0) throw new Error('Please enter a valid amount to be collected greater than ₹0.');
      if (!dueDate || dueDate < lentDate) throw new Error('Collection date must be on or after lent date.');

      let finalNotes = notes.trim();
      if (amount.trim() && collectAmount.trim() && amount.trim() !== collectAmount.trim()) {
        const lentNote = `Lent: ₹${amount.trim()}`;
        finalNotes = finalNotes ? `${finalNotes} • ${lentNote}` : lentNote;
      }

      return lendService.createLend({
        userId: user?.id,
        personName: name,
        phoneNumber: phoneNumber.trim() || undefined,
        amountMinor,
        notes: finalNotes || undefined,
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

  const updateAmountMutation = useMutation({
    mutationFn: async () => {
      if (!editAmountTarget) return;
      const amountMinor = parseMoneyToMinor(newCollectAmount);
      if (amountMinor <= 0) throw new Error('Please enter a valid amount greater than ₹0.');
      return lendService.updateAmount(editAmountTarget.id, amountMinor, user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      setShowEditAmount(false);
      setEditAmountTarget(null);
      setNewCollectAmount('');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Could not update amount to collect.');
    },
  });

  const openEditAmount = (record: LendRecord) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEditAmountTarget(record);
    setNewCollectAmount((record.amountMinor / 100).toString());
    setShowEditAmount(true);
  };

  const markCollectedMutation = useMutation({
    mutationFn: async (id: string) => {
      return lendService.markCollected(id, user?.id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['lends'] });
      if (smsTarget?.id === id) {
        setShowSmsModal(false);
        setSmsTarget(null);
      }
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: () => {
      Alert.alert('Error', 'Could not update record.');
    },
  });

  const deleteLendMutation = useMutation({
    mutationFn: async (id: string) => {
      return lendService.deleteLend(id, user?.id);
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
      return lendService.updateDueDate(rescheduleTarget.id, newDueDate, user?.id);
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
          <View className="flex-row items-center flex-1 mr-3">
            <Pressable onPress={goBack} className="mr-3 p-1">
              <ArrowLeft size={22} color="#09090B" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-black text-zinc-900">Money Lends</Text>
              <Text className="text-xs text-zinc-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">Track money given & collection reminders</Text>
            </View>
          </View>

          <Button
            variant="primary"
            size="sm"
            style={{ flexShrink: 0 }}
            className="flex-row items-center gap-1.5 px-3.5 py-2.5"
            onPress={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-bold text-xs">Add Lend</Text>
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
                        <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                          <Text className="text-xs text-zinc-500">
                            Lent on {formatDate(record.lentDate)}
                          </Text>
                          {record.phoneNumber ? (
                            !isCollected ? (
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => openSmsModal(record)}
                                className="flex-row items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full"
                              >
                                <Phone size={10} color="#6366F1" />
                                <Text className="text-[10px] font-bold text-indigo-700">{record.phoneNumber}</Text>
                              </TouchableOpacity>
                            ) : (
                              <View className="flex-row items-center gap-1 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                <Phone size={10} color="#71717A" />
                                <Text className="text-[10px] font-medium text-zinc-500">{record.phoneNumber}</Text>
                              </View>
                            )
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View className="items-end gap-0.5">
                      <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {isCollected ? 'Collected' : 'To Collect'}
                      </Text>
                      <Text
                        className={`text-base font-black ${
                          isCollected ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-indigo-600'
                        }`}
                      >
                        {formatMoney(record.amountMinor)}
                      </Text>
                      <Badge label={dayBadge.text} variant={dayBadge.badgeVariant} />
                    </View>
                  </View>

                  {/* Explicit Amount to Collect Callout Bar for active lends - Tappable to edit */}
                  {!isCollected && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openEditAmount(record)}
                      className="bg-indigo-50/80 border border-indigo-100 rounded-xl px-3 py-2.5 my-1.5 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-1.5">
                        <HandCoins size={14} color="#6366F1" />
                        <Text className="text-xs font-semibold text-indigo-950">Amount to be collected</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-sm font-black text-indigo-600">
                          {formatMoney(record.amountMinor)}
                        </Text>
                        <View className="w-5 h-5 rounded-full bg-indigo-100 items-center justify-center ml-0.5">
                          <Pencil size={11} color="#6366F1" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

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
                    <View className="flex-row gap-1.5 mt-3 pt-2.5 border-t border-zinc-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-300 bg-emerald-50/40 px-2"
                        onPress={() => confirmMarkCollected(record)}
                      >
                        <CheckCircle2 size={13} color="#10B981" />
                        <Text className="text-emerald-700 font-bold text-xs ml-1">Collected</Text>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-indigo-300 bg-indigo-50/50 px-2.5"
                        onPress={() => openSmsModal(record)}
                      >
                        <MessageSquare size={12} color="#6366F1" />
                        <Text className="text-indigo-700 font-bold text-xs ml-1">SMS</Text>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-indigo-200 bg-indigo-50/40 px-2"
                        onPress={() => openEditAmount(record)}
                      >
                        <Pencil size={12} color="#6366F1" />
                        <Text className="text-indigo-700 font-bold text-xs ml-1">Amount</Text>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-indigo-200 bg-indigo-50/40 px-2"
                        onPress={() => openReschedule(record)}
                      >
                        <RefreshCw size={12} color="#6366F1" />
                        <Text className="text-indigo-700 font-bold text-xs ml-1">Due</Text>
                      </Button>

                      <Pressable
                        onPress={() => confirmDelete(record)}
                        className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 items-center justify-center active:bg-rose-100"
                      >
                        <Trash2 size={14} color="#EF4444" />
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
      <AppModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        animationType="slide"
      >
        <Pressable
          className="bg-white rounded-t-3xl border-t border-zinc-200 flex-col"
          style={{ maxHeight: '100%' }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <View className="flex-row justify-between items-center p-5 pb-3 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 items-center justify-center">
                <HandCoins size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-xl font-extrabold text-zinc-900">Record a Lend</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">Track money lent and schedule reminders</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setShowAdd(false);
              }}
              className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
            >
              <X size={16} color="#71717A" />
            </Pressable>
          </View>

          {/* Scrollable Form Content */}
          <ScrollView 
            className="px-5 pt-3"
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Current Total Outstanding to Collect Context */}
            <View className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Currently to Collect
                </Text>
                <Text className="text-base font-black text-zinc-900 mt-0.5">
                  {formatMoney(totalOutstanding)}
                </Text>
              </View>
              <View className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl">
                <Text className="text-[11px] font-bold text-indigo-700">
                  {activeRecords.length} pending lend{activeRecords.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Person's Name with Contact Picker Button */}
            <View className="mb-1">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-semibold text-zinc-700">Person's Name</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePickContactForAdd}
                  disabled={pickingContact}
                  className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 active:bg-indigo-100"
                >
                  <BookUser size={12} color="#6366F1" />
                  <Text className="text-[11px] font-bold text-indigo-700">
                    {pickingContact ? 'Opening...' : 'Choose from Contacts'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Input
                placeholder="e.g. Rahul Sharma, Priya, Amit..."
                value={personName}
                onChangeText={setPersonName}
              />
            </View>

            {/* Mobile Number Input for manual entry or auto-filled */}
            <View className="mb-1">
              <Input
                label="Mobile Number (Optional — for SMS reminders)"
                placeholder="e.g. +91 98765 43210"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
              <Text className="text-[10px] text-zinc-400 -mt-2.5 mb-3 px-1">
                💡 Pick from phone contacts or enter any customer's name & number manually.
              </Text>
            </View>

            <Input
              label="Amount Lent (₹)"
              placeholder="e.g. 2,500.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={(val) => {
                setAmount(val);
                if (!isCustomCollectAmount) {
                  setCollectAmount(val);
                }
              }}
            />

            {/* Editable Amount to be Collected Input */}
            <View className="mb-1">
              <Input
                label="Amount to be Collected (₹)"
                placeholder="e.g. 2,500.00"
                keyboardType="numeric"
                value={collectAmount}
                onChangeText={(val) => {
                  setCollectAmount(val);
                  setIsCustomCollectAmount(true);
                }}
              />
              {isCustomCollectAmount && amount.trim() !== '' && collectAmount !== amount && (
                <TouchableOpacity
                  onPress={() => {
                    setCollectAmount(amount);
                    setIsCustomCollectAmount(false);
                  }}
                  className="flex-row items-center gap-1 -mt-2.5 mb-2.5 px-1"
                >
                  <Text className="text-[11px] text-indigo-600 font-bold">
                    ↺ Reset to match Amount Lent (₹{amount})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Live Amount to be Collected Display Card */}
            <View className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 mb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <HandCoins size={14} color="#059669" />
                    <Text className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      To Be Collected
                    </Text>
                  </View>
                  <Text className="text-2xl font-black text-emerald-700">
                    {parseMoneyToMinor(collectAmount || amount) > 0
                      ? formatMoney(parseMoneyToMinor(collectAmount || amount))
                      : '₹0.00'}
                  </Text>
                </View>
                {personName.trim() ? (
                  <View className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-xl items-end max-w-[50%]">
                    <Text className="text-[9px] font-bold text-emerald-600 uppercase">Debtor</Text>
                    <Text className="text-xs font-black text-emerald-950" numberOfLines={1}>
                      {personName.trim()}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-2.5 pt-2 border-t border-emerald-200/60 flex-row justify-between items-center">
                <Text className="text-[11px] text-emerald-800">
                  {parseMoneyToMinor(collectAmount || amount) > 0 ? (
                    <>
                      New Total to Collect:{' '}
                      <Text className="font-bold">
                        {formatMoney(totalOutstanding + parseMoneyToMinor(collectAmount || amount))}
                      </Text>
                    </>
                  ) : (
                    'Enter amount above to preview collection'
                  )}
                </Text>
                <Text className="text-[11px] font-semibold text-emerald-700">
                  Due: {dueDate ? formatDate(dueDate) : '—'}
                </Text>
              </View>
            </View>

            <DatePickerButton
              label="Date Lent"
              value={lentDate}
              onSelectDate={(d) => setLentDate(d || getTodayISO())}
              placeholder="Select date lent"
            />

            <DatePickerButton
              label="Collect Back By (Due Date)"
              value={dueDate}
              onSelectDate={(d) => setDueDate(d || addDays(getTodayISO(), 7))}
              placeholder="Select expected return date"
            />

            {/* Quick Preset Duration Pills */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">Quick Return Duration</Text>
              <View className="flex-row gap-2 flex-wrap">
                {DATE_PRESETS.map((p) => {
                  const target = addDays(lentDate || getTodayISO(), p.days);
                  const isSelected = dueDate === target;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      activeOpacity={0.7}
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setDueDate(target);
                      }}
                      style={{
                        backgroundColor: isSelected ? '#4F46E5' : '#FAFAFA',
                        borderColor: isSelected ? '#4F46E5' : '#E4E4E7',
                      }}
                      className="px-3.5 py-2 rounded-2xl border"
                    >
                      <Text
                        style={{ color: isSelected ? '#FFFFFF' : '#3F3F46' }}
                        className="text-xs font-bold"
                      >
                        +{p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Input
              label="Notes (Optional)"
              placeholder="e.g. Dinner bill split, trip advance, rent share..."
              value={notes}
              onChangeText={setNotes}
            />

            {/* Reminder Chime Alert Box */}
            <View className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 mb-2 flex-row gap-3 items-center">
              <View className="w-8 h-8 rounded-xl bg-indigo-100 items-center justify-center">
                <Text className="text-sm">🔔</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-indigo-950">Automatic Push Reminder</Text>
                <Text className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                  PocketWise will notify you at <Text className="font-extrabold">9:00 AM on {dueDate ? formatDate(dueDate) : 'due date'}</Text> to follow up and collect.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Fixed Bottom Action Bar */}
          <View className="p-5 pt-3 pb-8 border-t border-zinc-100 bg-white">
            <Button
              variant="primary"
              size="lg"
              loading={createLendMutation.isPending}
              className="bg-indigo-600 active:bg-indigo-700 shadow-sm"
              onPress={() => createLendMutation.mutate()}
            >
              <Text className="text-white font-bold text-sm">
                {parseMoneyToMinor(collectAmount || amount) > 0
                  ? `Save & Collect ${formatMoney(parseMoneyToMinor(collectAmount || amount))}`
                  : 'Save & Set Reminder'}
              </Text>
            </Button>
          </View>
        </Pressable>
      </AppModal>

      {/* ── Reschedule Modal ── */}
      <AppModal
        visible={showReschedule}
        onClose={() => setShowReschedule(false)}
        animationType="fade"
      >
        <Pressable
          className="p-6 w-full bg-white"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100">
                <RefreshCw size={16} color="#6366F1" />
              </View>
              <Text className="text-lg font-black text-zinc-900">Reschedule Collection</Text>
            </View>
            <Pressable
              onPress={() => setShowReschedule(false)}
              className="w-7 h-7 rounded-full bg-zinc-100 items-center justify-center"
            >
              <X size={14} color="#71717A" />
            </Pressable>
          </View>

          {rescheduleTarget && (
            <View className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Debtor</Text>
                <Text className="text-sm font-bold text-zinc-900 mt-0.5">{rescheduleTarget.personName}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Amount to Collect</Text>
                <Text className="text-base font-black text-indigo-600 mt-0.5">
                  {formatMoney(rescheduleTarget.amountMinor)}
                </Text>
              </View>
            </View>
          )}

          <DatePickerButton
            label="New Collection Date"
            value={newDueDate}
            onSelectDate={(d) => setNewDueDate(d || getTodayISO())}
            placeholder="Select new return date"
          />

          <View className="flex-row gap-2 mb-5 flex-wrap">
            {DATE_PRESETS.map((p) => {
              const target = addDays(getTodayISO(), p.days);
              const isSelected = newDueDate === target;
              return (
                <TouchableOpacity
                  key={p.label}
                  activeOpacity={0.7}
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setNewDueDate(target);
                  }}
                  style={{
                    backgroundColor: isSelected ? '#4F46E5' : '#FAFAFA',
                    borderColor: isSelected ? '#4F46E5' : '#E4E4E7',
                  }}
                  className="px-3 py-1.5 rounded-full border"
                >
                  <Text
                    style={{ color: isSelected ? '#FFFFFF' : '#52525B' }}
                    className="text-xs font-bold"
                  >
                    +{p.label}
                  </Text>
                </TouchableOpacity>
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
              className="flex-1 bg-indigo-600 active:bg-indigo-700"
              loading={rescheduleMutation.isPending}
              onPress={() => rescheduleMutation.mutate()}
            >
              <Text className="text-white font-bold text-xs">Update Date</Text>
            </Button>
          </View>
        </Pressable>
      </AppModal>

      {/* ── Edit Amount to Collect Modal ── */}
      <AppModal
        visible={showEditAmount}
        onClose={() => setShowEditAmount(false)}
        animationType="fade"
      >
        <Pressable
          className="p-6 w-full bg-white"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100">
                <HandCoins size={16} color="#6366F1" />
              </View>
              <Text className="text-lg font-black text-zinc-900">Edit Amount to Collect</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowEditAmount(false)}
              className="w-7 h-7 rounded-full bg-zinc-100 items-center justify-center"
            >
              <X size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          {editAmountTarget && (
            <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-bold text-zinc-400 uppercase">Debtor</Text>
                <Text className="text-xs font-bold text-zinc-800 mt-0.5">{editAmountTarget.personName}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase">Current Amount</Text>
                <Text className="text-xs font-extrabold text-zinc-600 mt-0.5">
                  {formatMoney(editAmountTarget.amountMinor)}
                </Text>
              </View>
            </View>
          )}

          <Input
            label="Amount to be Collected (₹)"
            placeholder="e.g. 2,500.00"
            keyboardType="numeric"
            value={newCollectAmount}
            onChangeText={setNewCollectAmount}
          />

          {parseMoneyToMinor(newCollectAmount) > 0 && (
            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-emerald-800">Updated Amount to Collect</Text>
              <Text className="text-base font-black text-emerald-700">
                {formatMoney(parseMoneyToMinor(newCollectAmount))}
              </Text>
            </View>
          )}

          <View className="flex-row gap-3">
            <Button
              variant="outline"
              size="md"
              className="flex-1 border-zinc-200"
              onPress={() => setShowEditAmount(false)}
            >
              <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
            </Button>

            <Button
              variant="primary"
              size="md"
              className="flex-1 bg-indigo-600 active:bg-indigo-700"
              loading={updateAmountMutation.isPending}
              onPress={() => updateAmountMutation.mutate()}
            >
              <Text className="text-white font-bold text-xs">Save Amount</Text>
            </Button>
          </View>
        </Pressable>
      </AppModal>

      {/* ── SMS Reminder Modal ── */}
      <AppModal
        visible={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        animationType="fade"
      >
        <Pressable
          className="p-5 w-full bg-white"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center border border-indigo-100">
                <MessageSquare size={16} color="#6366F1" />
              </View>
              <View>
                <Text className="text-lg font-black text-zinc-900">Send Reminder</Text>
                <Text className="text-[11px] text-zinc-500">Send notice via WhatsApp or SMS</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowSmsModal(false)}
              className="w-7 h-7 rounded-full bg-zinc-100 items-center justify-center"
            >
              <X size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          {/* Borrower & Amount Snapshot */}
          <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 mb-3 flex-row justify-between items-center">
            <View className="flex-1 pr-2">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">Borrower</Text>
              <Text className="text-xs font-bold text-zinc-900 mt-0.5" numberOfLines={1}>
                {smsTarget?.personName}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">To Collect</Text>
              <Text className="text-sm font-black text-indigo-600 mt-0.5">
                {smsTarget ? formatMoney(smsTarget.amountMinor) : '₹0'}
              </Text>
            </View>
          </View>

          {/* Recipient Phone Number */}
          <View className="mb-2.5">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs font-bold text-zinc-700">Mobile Number</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePickContactForSms}
                className="flex-row items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100"
              >
                <BookUser size={11} color="#6366F1" />
                <Text className="text-[10px] font-bold text-indigo-700">Choose from Contacts</Text>
              </TouchableOpacity>
            </View>
            <Input
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
              value={smsRecipientPhone}
              onChangeText={setSmsRecipientPhone}
            />
          </View>

          {/* Quick Template Presets */}
          <View className="mb-2.5">
            <Text className="text-xs font-bold text-zinc-700 mb-1.5">Template</Text>
            <View className="flex-row gap-1.5 flex-wrap">
              {[
                { id: 'friendly', emoji: '💬', label: 'Friendly' },
                { id: 'due', emoji: '⏰', label: 'Due Today' },
                { id: 'overdue', emoji: '⚠️', label: 'Overdue' },
              ].map((tmpl) => {
                const isSelected = smsTemplate === tmpl.id;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    activeOpacity={0.7}
                    onPress={() => handleSelectTemplate(tmpl.id as any)}
                    style={{
                      backgroundColor: isSelected ? '#EEF2FF' : '#F4F4F5',
                      borderColor: isSelected ? '#6366F1' : '#E4E4E7',
                    }}
                    className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                  >
                    <Text className="text-[11px]">{tmpl.emoji}</Text>
                    <Text
                      style={{ color: isSelected ? '#4F46E5' : '#52525B' }}
                      className="text-[11px] font-bold"
                    >
                      {tmpl.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Editable Message Content */}
          <View className="mb-3.5">
            <Text className="text-xs font-bold text-zinc-700 mb-1">Message</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={smsMessage}
              onChangeText={setSmsMessage}
              textAlignVertical="top"
              className="border border-zinc-200 rounded-xl p-2.5 text-zinc-900 text-xs bg-zinc-50 min-h-[72px]"
              placeholder="Type your reminder message..."
            />
          </View>

          {/* Bottom Action Bar */}
          <View className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="px-3.5 border-zinc-200 rounded-xl"
              onPress={() => setShowSmsModal(false)}
            >
              <Text className="text-zinc-700 font-bold text-xs">Cancel</Text>
            </Button>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={sendingSms}
              onPress={handleSendWhatsApp}
              className="flex-1 bg-[#25D366] active:bg-[#1EBE5D] py-3 px-2 rounded-xl flex-row items-center justify-center gap-1.5 shadow-xs"
            >
              <MessageSquare size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-white font-bold text-xs">
                {sendingSms ? 'Opening...' : 'WhatsApp'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={sendingSms}
              onPress={handleSendSms}
              className="flex-1 bg-indigo-600 active:bg-indigo-700 py-3 px-2 rounded-xl flex-row items-center justify-center gap-1.5 shadow-xs"
            >
              <Send size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text className="text-white font-bold text-xs">
                {sendingSms ? 'Opening...' : 'Send SMS'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </AppModal>
    </SafeAreaView>
  );
}
