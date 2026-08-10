import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { budgetService } from '../../lib/services/budget.service';
import { categoryService } from '../../lib/services/category.service';
import { formatMoney, parseMoneyToMinor } from '../../lib/finance/core';
import { Plus, X, PieChart, AlertTriangle, ChevronDown, Check } from 'lucide-react-native';

export default function BudgetsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  // Current month bounds
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets', user?.id],
    queryFn: () => budgetService.getBudgets(user?.id || ''),
    enabled: !!user?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => categoryService.getCategories(user?.id || ''),
    enabled: !!user?.id,
  });

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const selectedCatObj = expenseCategories.find((c) => c.id === selectedCategoryId);

  const createBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCategoryId) throw new Error('Please select a category');
      const minorLimit = parseMoneyToMinor(monthlyLimit);
      if (minorLimit <= 0) throw new Error('Monthly limit must be greater than zero');

      return budgetService.createBudget({
        user_id: user!.id,
        category_id: selectedCategoryId,
        amount_minor: minorLimit,
        period: 'monthly',
        start_date: startDate,
        end_date: endDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id] });
      setModalVisible(false);
      setSelectedCategoryId('');
      setMonthlyLimit('');
      setCategoryDropdownOpen(false);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create budget');
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-2xl font-black text-zinc-900">Budgets</Text>
            <Text className="text-xs text-zinc-500 mt-0.5">Control category-wise spending targets</Text>
          </View>

          <Button
            variant="primary"
            size="sm"
            className="flex-row space-x-1"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add Budget</Text>
          </Button>
        </View>

        {/* Budgets List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {loadingBudgets ? (
            <ActivityIndicator size="small" color="#09090B" className="py-8" />
          ) : budgets.length === 0 ? (
            <Card className="p-6 bg-white border border-zinc-200 items-center mt-4">
              <View className="w-12 h-12 rounded-2xl bg-zinc-100 items-center justify-center mb-3">
                <PieChart size={24} color="#09090B" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">No budgets yet</Text>
              <Text className="text-xs text-zinc-500 mt-1 mb-4 text-center">
                Set a monthly spending limit to stay on track.
              </Text>
              <Button size="sm" variant="primary" onPress={() => setModalVisible(true)}>
                <Text className="text-white font-semibold text-xs">Add Budget</Text>
              </Button>
            </Card>
          ) : (
            budgets.map((b) => {
              const limit = b.amount_minor || 1;
              const spent = b.amount_spent || 0;
              const percentage = Math.round((spent / limit) * 100);
              const isWarning = percentage >= 80 && percentage < 100;
              const isExceeded = percentage >= 100;

              return (
                <Card key={b.id} className="mb-4 p-4 bg-white border border-zinc-200">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center">
                      <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: b.category_color }} />
                      <Text className="text-base font-bold text-zinc-900">{b.category_name}</Text>
                    </View>
                    <Badge
                      label={isExceeded ? `${percentage}% Exceeded` : `${percentage}% Used`}
                      variant={isExceeded ? 'expense' : isWarning ? 'income' : 'budget'}
                    />
                  </View>

                  {/* Progress Bar */}
                  <View className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden my-3">
                    <View
                      className={`h-full rounded-full ${isExceeded ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-zinc-500">
                      Spent: <Text className="font-bold text-zinc-900">{formatMoney(spent)}</Text>
                    </Text>
                    <Text className="text-xs text-zinc-500">
                      Limit: <Text className="font-bold text-zinc-900">{formatMoney(limit)}</Text>
                    </Text>
                  </View>

                  {isExceeded && (
                    <View className="mt-2 pt-2 border-t border-rose-100 flex-row items-center">
                      <AlertTriangle size={14} color="#EF4444" className="mr-1" />
                      <Text className="text-xs font-semibold text-rose-600">
                        Over budget by {formatMoney(spent - limit)}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add Budget Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Create Budget</Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            {/* Category Dropdown */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Category</Text>
              <Pressable
                onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
              >
                <Text className={`text-sm ${selectedCatObj ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                  {selectedCatObj ? selectedCatObj.name : 'Select a Category'}
                </Text>
                <ChevronDown size={18} color="#71717A" />
              </Pressable>

              {categoryDropdownOpen && (
                <View className="mt-1 bg-white border border-zinc-200 rounded-xl max-h-48 overflow-hidden shadow-sm">
                  <ScrollView nestedScrollEnabled className="p-1">
                    {expenseCategories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          setSelectedCategoryId(cat.id);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`flex-row justify-between items-center p-3 rounded-lg ${selectedCategoryId === cat.id ? 'bg-zinc-100' : ''}`}
                      >
                        <Text className={`text-sm ${selectedCategoryId === cat.id ? 'font-bold text-zinc-900' : 'text-zinc-700'}`}>{cat.name}</Text>
                        {selectedCategoryId === cat.id && <Check size={16} color="#09090B" />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Input
              label="Monthly Limit (₹)"
              placeholder="8000.00"
              keyboardType="numeric"
              value={monthlyLimit}
              onChangeText={setMonthlyLimit}
            />

            <Button
              variant="primary"
              size="lg"
              loading={createBudgetMutation.isPending}
              className="mt-2 mb-4"
              onPress={() => createBudgetMutation.mutate()}
            >
              <Text className="text-white font-semibold">Save Budget</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
