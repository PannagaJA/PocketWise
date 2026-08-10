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
import { goalService } from '../lib/services/goal.service';
import { formatMoney, parseMoneyToMinor } from '../lib/finance/core';
import { Plus, X, ArrowLeft, Target, Award } from 'lucide-react-native';

export default function GoalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);

  // Form state
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentSaved, setCurrentSaved] = useState('');
  const [contribAmount, setContribAmount] = useState('');

  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['goals', user?.id],
    queryFn: () => goalService.getGoals(user?.id || ''),
    enabled: !!user?.id,
  });

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Goal name is required');
      const targetMinor = parseMoneyToMinor(targetAmount);
      if (targetMinor <= 0) throw new Error('Target amount must be greater than zero');
      const savedMinor = currentSaved ? parseMoneyToMinor(currentSaved) : 0;

      return goalService.createGoal({
        user_id: user!.id,
        name,
        target_amount_minor: targetMinor,
        current_amount_minor: savedMinor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      setModalVisible(false);
      setName('');
      setTargetAmount('');
      setCurrentSaved('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create goal');
    },
  });

  const contribMutation = useMutation({
    mutationFn: async () => {
      const contribMinor = parseMoneyToMinor(contribAmount);
      if (contribMinor <= 0) throw new Error('Contribution must be greater than zero');
      return goalService.addContribution(selectedGoalId, contribMinor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      setContribModalVisible(false);
      setContribAmount('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to add contribution');
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
              <Text className="text-2xl font-black text-zinc-900">Savings Goals</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">Track target milestones</Text>
            </View>
          </View>

          <Button
            variant="primary"
            size="sm"
            className="flex-row space-x-1"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add Goal</Text>
          </Button>
        </View>

        {/* Goals List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {loadingGoals ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : goals.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-4">
              <View className="w-12 h-12 rounded-2xl bg-zinc-100 items-center justify-center mb-3">
                <Target size={24} color="#09090B" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">No savings goals yet</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                Start planning for something you want to achieve!
              </Text>
              <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
                <Text className="text-white font-semibold text-xs">Create Goal</Text>
              </Button>
            </Card>
          ) : (
            goals.map((g) => {
              const target = g.target_amount_minor || 1;
              const current = g.current_amount_minor || 0;
              const percentage = Math.min(Math.round((current / target) * 100), 100);
              const isCompleted = percentage >= 100;

              return (
                <Card key={g.id} className="mb-4 p-4 bg-white border border-zinc-200">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center">
                      <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-2.5">
                        <Target size={18} color="#6366F1" />
                      </View>
                      <Text className="text-base font-bold text-zinc-900">{g.name}</Text>
                    </View>
                    <Badge
                      label={isCompleted ? '100% Completed' : `${percentage}%`}
                      variant={isCompleted ? 'income' : 'budget'}
                    />
                  </View>

                  {/* Progress Bar */}
                  <View className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden my-3">
                    <View
                      className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </View>

                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-xs text-zinc-500">
                      Saved: <Text className="font-bold text-zinc-900">{formatMoney(current)}</Text>
                    </Text>
                    <Text className="text-xs text-zinc-500">
                      Target: <Text className="font-bold text-zinc-900">{formatMoney(target)}</Text>
                    </Text>
                  </View>

                  {isCompleted ? (
                    <View className="bg-emerald-50 p-2.5 rounded-xl flex-row items-center justify-center">
                      <Award size={16} color="#10B981" className="mr-1.5" />
                      <Text className="text-xs font-bold text-emerald-700">🎉 Goal Completed!</Text>
                    </View>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onPress={() => {
                        setSelectedGoalId(g.id);
                        setContribModalVisible(true);
                      }}
                    >
                      <Text className="text-zinc-900 font-semibold text-xs">+ Add Money</Text>
                    </Button>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Create Goal</Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <Input
              label="Goal Name"
              placeholder="e.g. MacBook, Emergency Fund"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Target Amount (₹)"
              placeholder="100000.00"
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />

            <Input
              label="Already Saved (₹)"
              placeholder="0.00"
              keyboardType="numeric"
              value={currentSaved}
              onChangeText={setCurrentSaved}
            />

            <Button
              variant="primary"
              size="lg"
              loading={createGoalMutation.isPending}
              className="mt-2 mb-4"
              onPress={() => createGoalMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Goal</Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* Contribution Modal */}
      <Modal visible={contribModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Add Money to Goal</Text>
              <Pressable onPress={() => setContribModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <Input
              label="Contribution Amount (₹)"
              placeholder="5000.00"
              keyboardType="numeric"
              value={contribAmount}
              onChangeText={setContribAmount}
            />

            <Button
              variant="primary"
              size="lg"
              loading={contribMutation.isPending}
              className="mt-2 mb-4"
              onPress={() => contribMutation.mutate()}
            >
              <Text className="text-white font-semibold">Add Contribution</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
