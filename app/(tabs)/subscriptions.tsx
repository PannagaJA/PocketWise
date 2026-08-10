import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { Plus, Bell, Calendar, CreditCard, RefreshCw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function SubscriptionsScreen() {
  const { subscriptions, addSubscription } = useAppStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const totalMonthlySpend = subscriptions.reduce((sum, sub) => {
    if (sub.billing_cycle === 'monthly') return sum + sub.amount;
    return sum + Math.round(sub.amount / 12);
  }, 0);

  const handleSave = () => {
    if (!name || !amount) return;
    const newSub = {
      id: `sub_${Date.now()}`,
      name,
      amount: Math.round(parseFloat(amount) * 100),
      currency: 'INR',
      billing_cycle: cycle,
      next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      color: '#6366F1',
      auto_renew: true,
    };
    addSubscription(newSub);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    setName('');
    setAmount('');
  };

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
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="mb-3 p-4 bg-white border border-zinc-200">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <View 
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                    style={{ backgroundColor: (sub.color || '#6366F1') + '15' }}
                  >
                    <Text className="font-extrabold text-lg" style={{ color: sub.color || '#6366F1' }}>{sub.name[0]}</Text>
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
                  <Text className="text-base font-extrabold text-zinc-900">{formatCurrency(sub.amount)}</Text>
                  <View className="flex-row items-center mt-1">
                    <Bell size={12} color="#6366F1" />
                    <Text className="text-[10px] font-semibold text-indigo-600 ml-1">FCM Active</Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-zinc-900">Add Subscription</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#71717A" />
              </TouchableOpacity>
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
              <TouchableOpacity 
                onPress={() => setCycle('monthly')} 
                className={`flex-1 py-2.5 rounded-xl items-center ${cycle === 'monthly' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-semibold ${cycle === 'monthly' ? 'text-zinc-900' : 'text-zinc-500'}`}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setCycle('yearly')} 
                className={`flex-1 py-2.5 rounded-xl items-center ${cycle === 'yearly' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-semibold ${cycle === 'yearly' ? 'text-zinc-900' : 'text-zinc-500'}`}>Yearly</Text>
              </TouchableOpacity>
            </View>

            <Button variant="primary" size="lg" onPress={handleSave}>
              Save & Enable FCM Reminder
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
