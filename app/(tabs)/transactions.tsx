import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { Plus, ArrowUpRight, ArrowDownLeft, X, Filter } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function TransactionsScreen() {
  const { transactions, accounts, addTransaction } = useAppStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');

  const handleCreate = () => {
    if (!description || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const minorAmount = Math.round(parseFloat(amount) * 100);
    const newTx = {
      id: `tx_${Date.now()}`,
      account_id: accounts[0]?.id || 'acc_1',
      account_name: accounts[0]?.name || 'Primary Account',
      type,
      amount: minorAmount,
      currency: 'INR',
      category_name: category,
      description,
      date: new Date().toISOString().split('T')[0],
    };

    addTransaction(newTx);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    setDescription('');
    setAmount('');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-2xl font-black text-zinc-900">Transactions</Text>
            <Text className="text-xs text-zinc-500 mt-0.5">Track your income and expenses</Text>
          </View>

          <Button 
            variant="primary" 
            size="sm" 
            className="flex-row space-x-1"
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-white font-semibold text-xs">Add New</Text>
          </Button>
        </View>

        {/* Transactions List */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {transactions.map((tx) => (
            <Card key={tx.id} className="mb-3 p-4 bg-white border border-zinc-200">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-3">
                  <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${tx.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    {tx.type === 'income' ? <ArrowDownLeft size={20} color="#10B981" /> : <ArrowUpRight size={20} color="#EF4444" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-zinc-900" numberOfLines={1}>{tx.description}</Text>
                    <Text className="text-xs text-zinc-500 mt-0.5">{tx.category_name} • {tx.account_name}</Text>
                  </View>
                </View>

                <View className="items-end">
                  <Text className={`text-base font-extrabold ${tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                  <Text className="text-xs text-zinc-400 mt-0.5">{formatDate(tx.date)}</Text>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>

      {/* Add Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-zinc-900">Add Transaction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Type selector */}
            <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-4">
              <TouchableOpacity 
                onPress={() => setType('expense')} 
                className={`flex-1 py-2.5 rounded-xl items-center ${type === 'expense' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-semibold ${type === 'expense' ? 'text-rose-600' : 'text-zinc-500'}`}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setType('income')} 
                className={`flex-1 py-2.5 rounded-xl items-center ${type === 'income' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-semibold ${type === 'income' ? 'text-emerald-600' : 'text-zinc-500'}`}>Income</Text>
              </TouchableOpacity>
            </View>

            <Input 
              label="Description" 
              placeholder="e.g. Grocery Store" 
              value={description} 
              onChangeText={setDescription} 
            />

            <Input 
              label="Amount (₹)" 
              placeholder="0.00" 
              keyboardType="numeric" 
              value={amount} 
              onChangeText={setAmount} 
            />

            <Input 
              label="Category" 
              placeholder="e.g. Groceries, Food, Travel" 
              value={category} 
              onChangeText={setCategory} 
            />

            <Button 
              variant={type === 'income' ? 'income' : 'primary'} 
              size="lg" 
              className="mt-4"
              onPress={handleCreate}
            >
              Save Transaction
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
