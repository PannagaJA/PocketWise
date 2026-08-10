import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { Shield, Fingerprint, Bell, Database, HelpCircle, LogOut, ChevronRight, Moon, UserCheck } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';

export default function MoreScreen() {
  const { profile } = useAppStore();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Supported', 'Biometric authentication is not configured on this device.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
      });
      if (result.success) {
        setBiometricsEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      setBiometricsEnabled(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card className="mb-6 p-5 flex-row items-center bg-white border border-zinc-200">
          <View className="w-14 h-14 rounded-full bg-zinc-900 items-center justify-center mr-4">
            <Text className="text-xl font-bold text-white">{profile.display_name[0]}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-zinc-900">{profile.display_name}</Text>
            <Text className="text-xs text-zinc-500 mt-0.5">Primary Currency: {profile.currency} (₹)</Text>
            <View className="mt-2">
              <Badge label="Cloud Sync Enabled" variant="income" />
            </View>
          </View>
        </Card>

        {/* Preferences & Security */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">App Security & Sync</Text>
        
        <Card className="mb-6 p-0 bg-white border border-zinc-200 divide-y divide-zinc-100">
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Fingerprint size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Biometric App Lock</Text>
                <Text className="text-xs text-zinc-500">Require Face ID / Touch ID</Text>
              </View>
            </View>
            <Switch 
              value={biometricsEnabled} 
              onValueChange={toggleBiometrics} 
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Bell size={20} color="#10B981" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Push Notifications</Text>
                <Text className="text-xs text-zinc-500">FCM Push Reminders</Text>
              </View>
            </View>
            <Switch 
              value={pushEnabled} 
              onValueChange={setPushEnabled} 
              trackColor={{ false: '#E4E4E7', true: '#10B981' }}
            />
          </View>
        </Card>

        {/* Database & Cloud */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Infrastructure</Text>
        <Card className="mb-6 p-4 bg-white border border-zinc-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-zinc-100 items-center justify-center mr-3">
                <Database size={20} color="#09090B" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Supabase Source of Truth</Text>
                <Text className="text-xs text-zinc-500">PostgreSQL Cloud DB Connected</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </View>
        </Card>

        <Button variant="outline" size="lg" className="mb-8 border-rose-200 bg-rose-50/50" onPress={() => {}}>
          <LogOut size={18} color="#EF4444" className="mr-2" />
          <Text className="text-rose-600 font-bold">Sign Out</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
