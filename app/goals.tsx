import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { AppBottomSheet } from '../components/ui/AppBottomSheet';
import { AppDialog } from '../components/ui/AppDialog';
import { AppLoadingIndicator } from '../components/ui/AppLoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { goalService, Goal } from '../lib/services/goal.service';
import { formatMoney, parseMoneyToMinor } from '../lib/finance/core';
import { supabase } from '../lib/supabase';
import { Plus, X, ArrowLeft, Target, Trash2, Bookmark, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useModuleBack } from '../lib/navigation/moduleBack';

export default function GoalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const goBack = useModuleBack();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [contribModalVisible, setContribModalVisible] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Form state
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentSaved, setCurrentSaved] = useState('');
  const [contribAmount, setContribAmount] = useState('');

  const { data: goals = [], isLoading: loadingGoals, refetch: refetchGoals } = useQuery({
    queryKey: ['goals', user?.id],
    queryFn: () => goalService.getGoals(user?.id || ''),
    enabled: !!user?.id,
  });

  // Automatically refresh goals on mount or user change
  useEffect(() => {
    if (user?.id) {
      refetchGoals();
    }
  }, [user?.id, refetchGoals]);

  // Summary Metrics for Dynamic Donut Overview
  const totalTargetMinor = goals.reduce((sum, g) => sum + (g.target_amount_minor || 0), 0);
  const totalSavedMinor = goals.reduce((sum, g) => sum + (g.current_amount_minor || 0), 0);
  const overallPercentage = totalTargetMinor > 0
    ? Math.min(100, Math.round((totalSavedMinor / totalTargetMinor) * 100))
    : 0;

  // Donut SVG Setup
  const donutSize = 100;
  const strokeWidth = 10;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * overallPercentage) / 100;

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Goal name is required');
      const targetMinor = parseMoneyToMinor(targetAmount);
      if (targetMinor <= 0) throw new Error('Target amount must be greater than zero');
      const savedMinor = currentSaved ? parseMoneyToMinor(currentSaved) : 0;

      const [res] = await Promise.all([
        goalService.createGoal({
          user_id: user!.id,
          name,
          target_amount_minor: targetMinor,
          current_amount_minor: savedMinor,
        }),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      setModalVisible(false);
      setName('');
      setTargetAmount('');
      setCurrentSaved('');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create goal');
    },
  });

  const contribMutation = useMutation({
    mutationFn: async () => {
      const contribMinor = parseMoneyToMinor(contribAmount);
      if (contribMinor <= 0) throw new Error('Contribution must be greater than zero');
      const [res] = await Promise.all([
        goalService.addContribution(selectedGoalId, contribMinor),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      setContribModalVisible(false);
      setContribAmount('');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to add contribution');
    },
  });

  // Delete Goal Mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return goalService.deleteGoal(goalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete goal');
    },
  });

  // Save to History Mutation
  const saveHistoryMutation = useMutation({
    mutationFn: async (goal: Goal) => {
      const existingNotes = goal.notes || '';
      if (existingNotes.includes('[History]')) return;
      const updatedNotes = existingNotes ? `${existingNotes} [History]` : '[History]';

      const { error } = await supabase
        .from('goals')
        .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
        .eq('id', goal.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.id] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Alert.alert('Saved to History! 🎉', 'This goal has been saved to your goal history.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to save to history');
    },
  });

  const confirmDeleteGoal = (goalId: string, goalName: string) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setGoalToDelete({ id: goalId, name: goalName });
  };

  // Filter Active vs History goals
  const activeGoals = goals.filter((g) => !(g.notes || '').includes('[History]'));
  const historyGoals = goals.filter((g) => (g.notes || '').includes('[History]'));

  const displayedGoals = activeTab === 'active' ? activeGoals : historyGoals;

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
              <Text className="text-[22px] font-extrabold text-zinc-950 tracking-tight">Savings Goals</Text>
              <Text className="text-xs font-medium text-zinc-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">Track real-time target milestones</Text>
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
            <Text className="text-white font-bold text-xs">Add Goal</Text>
          </Button>
        </View>

        {/* Dynamic Real-Time Donut Summary Card */}
        {goals.length > 0 && (
          <Card className="bg-white border border-zinc-100 p-5 mb-3.5 rounded-3xl shadow-xs flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <View className="w-6 h-6 rounded-full bg-purple-50 items-center justify-center">
                  <Target size={13} color="#7C3AED" />
                </View>
                <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Overall Savings Target
                </Text>
              </View>

              <Text className="text-[24px] font-extrabold text-zinc-950 tracking-tight">
                {formatMoney(totalSavedMinor)}
              </Text>
              <Text className="text-xs font-medium text-zinc-500 mt-0.5">
                Target: <Text className="font-bold text-zinc-900">{formatMoney(totalTargetMinor)}</Text>
              </Text>

              <View className="mt-3 flex-row items-center gap-2">
                <View className="bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100/60">
                  <Text className="text-[11px] font-bold text-purple-700">
                    {goals.filter(g => (g.current_amount_minor || 0) >= (g.target_amount_minor || 1)).length} / {goals.length} Completed
                  </Text>
                </View>
              </View>
            </View>

            {/* Circular Radial Donut Progress Chart */}
            <View className="items-center justify-center relative">
              <Svg width={donutSize} height={donutSize}>
                <Circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={radius}
                  stroke="#F4F4F5"
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                <Circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={radius}
                  stroke="#7C3AED"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                />
              </Svg>
              <View className="absolute items-center justify-center">
                <Text className="text-base font-extrabold text-zinc-950">{overallPercentage}%</Text>
                <Text className="text-[9px] font-bold text-zinc-400 uppercase">Saved</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Tab Pills: Active Goals vs Goal History */}
        <View className="flex-row bg-zinc-100/80 p-1 rounded-2xl mb-3">
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('active');
            }}
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'active' ? 'bg-white shadow-xs' : ''}`}
          >
            <Text className={`font-bold text-xs ${activeTab === 'active' ? 'text-zinc-950' : 'text-zinc-500'}`}>
              Active Goals ({activeGoals.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('history');
            }}
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'history' ? 'bg-white shadow-xs' : ''}`}
          >
            <Text className={`font-bold text-xs ${activeTab === 'history' ? 'text-indigo-600' : 'text-zinc-500'}`}>
              Goal History ({historyGoals.length})
            </Text>
          </Pressable>
        </View>

        {/* Goals List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
          {loadingGoals ? (
            <View className="py-8">
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : displayedGoals.length === 0 ? (
            <Card className="p-8 bg-white border border-zinc-100 items-center mt-2 rounded-3xl shadow-xs">
              <View className="w-14 h-14 rounded-full bg-purple-50 items-center justify-center mb-3">
                <Target size={24} color="#7C3AED" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">
                {activeTab === 'active' ? 'No active savings goals' : 'No goals saved in history yet'}
              </Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                {activeTab === 'active'
                  ? 'Start planning for something you want to achieve!'
                  : 'Completed goals saved to history will appear here.'}
              </Text>
              {activeTab === 'active' && (
                <Button size="sm" variant="primary" className="px-6 py-2.5 rounded-full" onPress={() => setModalVisible(true)}>
                  Create Goal
                </Button>
              )}
            </Card>
          ) : (
            displayedGoals.map((g) => {
              const target = g.target_amount_minor || 1;
              const current = g.current_amount_minor || 0;
              const percentage = Math.min(Math.round((current / target) * 100), 100);
              const isCompleted = percentage >= 100;
              const isSavedInHistory = (g.notes || '').includes('[History]');

              return (
                <Card key={g.id} className="mb-3.5 p-4.5 bg-white border border-zinc-100 rounded-3xl shadow-xs">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mr-2.5">
                        <Target size={18} color="#7C3AED" />
                      </View>
                      <Text className="text-[16px] font-bold text-zinc-950" numberOfLines={1}>{g.name}</Text>
                    </View>

                    <Badge
                      label={isCompleted ? '100% Completed' : `${percentage}%`}
                      variant={isCompleted ? 'income' : 'budget'}
                    />
                  </View>

                  {/* Modern Slim Progress Bar */}
                  <View className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden my-3">
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

                  {/* Completed Goal Actions: Save to History & Delete Goal */}
                  {isCompleted ? (
                    <View className="flex-row gap-2 mt-1">
                      {/* Save to History Button */}
                      {!isSavedInHistory ? (
                        <Pressable
                          onPress={() => {
                            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                            saveHistoryMutation.mutate(g);
                          }}
                          className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-emerald-600 rounded-full active:bg-emerald-700 shadow-xs"
                        >
                          <Bookmark size={15} color="#FFF" />
                          <Text className="text-white font-bold text-xs ml-1.5">Save to History</Text>
                        </Pressable>
                      ) : (
                        <View className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-emerald-50 border border-emerald-200/60 rounded-full">
                          <CheckCircle2 size={15} color="#10B981" />
                          <Text className="text-emerald-700 font-bold text-xs ml-1.5">Saved in History</Text>
                        </View>
                      )}

                      {/* Delete Goal Button */}
                      <Pressable
                        onPress={() => {
                          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                          confirmDeleteGoal(g.id, g.name);
                        }}
                        className="flex-1 flex-row items-center justify-center py-2.5 px-3 bg-rose-50 border border-rose-200/60 rounded-full active:bg-rose-100 shadow-xs"
                      >
                        <Trash2 size={15} color="#EF4444" />
                        <Text className="text-rose-600 font-bold text-xs ml-1.5">Delete Goal</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      className="mt-1 py-2.5 px-4 bg-zinc-950 rounded-full active:bg-zinc-800 items-center justify-center shadow-xs"
                      onPress={() => {
                        setSelectedGoalId(g.id);
                        setContribModalVisible(true);
                      }}
                    >
                      <Text className="text-white font-bold text-xs">+ Add Money</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add Goal Modal */}
      <AppBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Create Goal"
        subtitle="Set a new savings target"
        scrollable={true}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {createGoalMutation.isPending ? (
          <View className="py-14 items-center justify-center">
            <AppLoadingIndicator
              message="Creating your goal..."
              subMessage="Setting up your target savings milestone"
            />
          </View>
        ) : (
          <View>
            <Input
              label="Goal Name"
              placeholder="e.g. New iPhone, Vacation, Emergency Fund"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Target Amount (₹)"
              placeholder="50000.00"
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />

            <Input
              label="Initial Amount Saved (₹) (Optional)"
              placeholder="5000.00"
              keyboardType="numeric"
              value={currentSaved}
              onChangeText={setCurrentSaved}
            />

            <Button
              variant="primary"
              size="lg"
              className="mt-2"
              loading={createGoalMutation.isPending}
              onPress={() => createGoalMutation.mutate()}
            >
              Save Goal
            </Button>
          </View>
        )}
      </AppBottomSheet>

      {/* Add Contribution Modal */}
      <AppBottomSheet
        visible={contribModalVisible}
        onClose={() => setContribModalVisible(false)}
        title="Add Contribution"
        subtitle="Deposit funds toward your goal"
        scrollable={true}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {contribMutation.isPending ? (
          <View className="py-14 items-center justify-center">
            <AppLoadingIndicator
              message="Adding contribution..."
              subMessage="Depositing funds to your savings goal"
            />
          </View>
        ) : (
          <View>
            <Input
              label="Contribution Amount (₹)"
              placeholder="1000.00"
              keyboardType="numeric"
              value={contribAmount}
              onChangeText={setContribAmount}
            />

            <Button
              variant="primary"
              size="lg"
              className="mt-2"
              loading={contribMutation.isPending}
              onPress={() => contribMutation.mutate()}
            >
              Add Contribution
            </Button>
          </View>
        )}
      </AppBottomSheet>

      {/* Delete Goal Confirmation Dialog */}
      <AppDialog
        visible={!!goalToDelete}
        onClose={() => setGoalToDelete(null)}
        title="Delete Goal"
        description={`Are you sure you want to delete "${goalToDelete?.name}"? All progress will be removed.`}
        confirmLabel="Delete"
        destructive={true}
        isLoading={deleteGoalMutation.isPending}
        onConfirm={() => {
          if (goalToDelete) {
            deleteGoalMutation.mutate(goalToDelete.id);
          }
        }}
      />
    </SafeAreaView>
  );
}
