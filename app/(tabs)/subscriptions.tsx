import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService } from '../../lib/services/subscription.service';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, Bell, CreditCard, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

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

      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + (cycle === 'monthly' ? 30 : 365));

      return subscriptionService.createSubscription({
        user_id: user!.id,
        name,
        amount_minor: minorAmount,
        currency: 'INR',
        billing_cycle: cycle,
        next_billing_date: nextBilling.toISOString().split('T')[0],
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
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create subscription');
    },
  });

  const totalMonthlySpend = subscriptions.reduce((sum, sub) => {
    if (sub.billing_cycle === 'monthly') return sum + sub.amount_minor;
    return sum + Math.round(sub.amount_minor / 12);
  }, 0);

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

        {/* Monthly Cost Banner */}
        <Card className="bg-indigo-600 border-indigo-500 p-5 mb-5 rounded-3xl">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Est. Monthly Subscription Expense</Text>
              <Text className="text-3xl font-extrabold text-white mt-1">
                {formatCurrency(totalMonthlySpend)}
              </Text>
            </View>
            <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center">
              <CreditCard size={24} color="#FFF" />
            </View>
          </View>
        </Card>

        {/* Subscriptions List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {loadingSubs ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : subscriptions.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-4">
              <Text className="text-sm font-bold text-zinc-900">No active subscriptions</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                Add your Netflix, Spotify, or iCloud plan to track renewals.
              </Text>
              <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
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

                  <View className="items-end">
                    <Text className="text-base font-extrabold text-zinc-900">{formatCurrency(sub.amount_minor)}</Text>
                    <View className="flex-row items-center mt-1">
                      <Bell size={12} color="#6366F1" />
                      <Text className="text-[10px] font-semibold text-indigo-600 ml-1">FCM Active</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-zinc-900">Add Subscription</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

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
              <Text className="text-white font-semibold">Save & Enable FCM Reminder</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
