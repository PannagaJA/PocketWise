import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/formatters';
import { PieChart, TrendingUp, AlertTriangle } from 'lucide-react-native';

export default function BudgetsScreen() {
  const { budgets } = useAppStore();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        <View className="mb-4">
          <Text className="text-2xl font-black text-zinc-900">Budgets</Text>
          <Text className="text-xs text-zinc-500 mt-0.5">Control category-wise spending targets</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {budgets.map((b) => {
            const percentage = Math.min(Math.round((b.amount_spent / b.amount_limit) * 100), 100);
            const isWarning = percentage >= 80;

            return (
              <Card key={b.id} className="mb-4 p-4 bg-white border border-zinc-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-zinc-900">{b.category_name}</Text>
                  <Badge 
                    label={`${percentage}% Used`} 
                    variant={isWarning ? 'expense' : 'budget'} 
                  />
                </View>

                {/* Progress Bar */}
                <View className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden my-3">
                  <View 
                    className={`h-full rounded-full ${isWarning ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </View>

                <View className="flex-row justify-between items-center text-xs">
                  <Text className="text-xs text-zinc-500">
                    Spent: <Text className="font-bold text-zinc-900">{formatCurrency(b.amount_spent)}</Text>
                  </Text>
                  <Text className="text-xs text-zinc-500">
                    Limit: <Text className="font-bold text-zinc-900">{formatCurrency(b.amount_limit)}</Text>
                  </Text>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
