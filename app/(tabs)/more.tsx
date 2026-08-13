import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Alert, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { appLockService } from '../../lib/security/app-lock.service';
import { Fingerprint, Bell, Database, LogOut, ChevronRight, Calendar, Target, Lock, PieChart, X, Smartphone } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Pin setup modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  useEffect(() => {
    loadSecurityState();
  }, []);

  const loadSecurityState = async () => {
    const lockOn = await appLockService.isAppLockEnabled();
    const bioOn = await appLockService.isBiometricsEnabled();
    setAppLockEnabled(lockOn);
    setBiometricsEnabled(bioOn);
  };

  const toggleAppLock = async (value: boolean) => {
    if (value) {
      setPinModalVisible(true);
    } else {
      await appLockService.clearPin();
      setAppLockEnabled(false);
      setBiometricsEnabled(false);
    }
  };

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Supported', 'Biometric authentication is not configured on this device.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable Biometric Unlock',
      });
      if (result.success) {
        await appLockService.setBiometricsEnabled(true);
        setBiometricsEnabled(true);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Ignore haptics
        }
      }
    } else {
      await appLockService.setBiometricsEnabled(false);
      setBiometricsEnabled(false);
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits');
      return;
    }
    if (pinInput !== confirmPinInput) {
      Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
      setPinInput('');
      setConfirmPinInput('');
      return;
    }

    await appLockService.setPin(pinInput);
    setAppLockEnabled(true);
    setPinModalVisible(false);
    setPinInput('');
    setConfirmPinInput('');
    Alert.alert('App Lock Enabled', 'PocketWise is now secured with your 4-digit PIN.');
  };

  const handleSignOut = async () => {
    await appLockService.clearPin();
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Card */}
        <Card className="mb-6 p-5 flex-row items-center bg-white border border-zinc-200">
          <View className="w-14 h-14 rounded-full bg-zinc-900 items-center justify-center mr-4">
            <Text className="text-xl font-bold text-white">
              {(user?.user_metadata?.display_name || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-zinc-900">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Authenticated User'}
            </Text>
            <Text className="text-xs text-zinc-500 mt-0.5" numberOfLines={1}>{user?.email}</Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Badge label="Verified Account" variant="income" />
            </View>
          </View>
        </Card>

        {/* Modules */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Financial Modules</Text>
        <Card className="mb-6 p-0 bg-white border border-zinc-200 divide-y divide-zinc-100">
          <Pressable onPress={() => router.push('/reports')} className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <PieChart size={20} color="#A855F7" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Financial Reports & Analytics</Text>
                <Text className="text-xs text-zinc-500">Spending rate, breakdown & performance</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push('/bills')} className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center mr-3">
                <Calendar size={20} color="#F59E0B" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Upcoming Bills</Text>
                <Text className="text-xs text-zinc-500">Track recurring bills & pay expenses</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push('/goals')} className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Target size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Savings Goals</Text>
                <Text className="text-xs text-zinc-500">Set target milestones & contributions</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>
        </Card>

        {/* Security */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">App Security & Sync</Text>
        <Card className="mb-6 p-0 bg-white border border-zinc-200 divide-y divide-zinc-100">
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Lock size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">App Lock (PIN)</Text>
                <Text className="text-xs text-zinc-500">Protect financial data with 4-digit PIN</Text>
              </View>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={toggleAppLock}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          {appLockEnabled && (
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                  <Fingerprint size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-zinc-900">Biometric Unlock</Text>
                  <Text className="text-xs text-zinc-500">Face ID / Touch ID unlock</Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={toggleBiometrics}
                trackColor={{ false: '#E4E4E7', true: '#10B981' }}
              />
            </View>
          )}

          <Pressable onPress={() => router.push('/sms-settings')} className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Smartphone size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Bank & SMS Tracking</Text>
                <Text className="text-xs text-zinc-500">Auto-detect bank transactions & SMS</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push('/notification-settings')} className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Bell size={20} color="#6366F1" />
              </View>
              <View>
                <Text className="text-sm font-bold text-zinc-900">Notification & Alert Settings</Text>
                <Text className="text-xs text-zinc-500">Customize push categories, limits & quiet hours</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>
        </Card>



        <Button
          variant="outline"
          size="lg"
          className="mb-12 border-rose-200 bg-rose-50/50"
          onPress={handleSignOut}
        >
          <LogOut size={18} color="#EF4444" className="mr-2" />
          <Text className="text-rose-600 font-bold">Sign Out</Text>
        </Button>
      </ScrollView>

      {/* Set PIN Modal */}
      <Modal visible={pinModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 border-t border-zinc-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-zinc-900">Set 4-Digit App PIN</Text>
              <Pressable onPress={() => setPinModalVisible(false)} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            <Input
              label="Enter 4-Digit PIN"
              placeholder="••••"
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
            />

            <Input
              label="Confirm 4-Digit PIN"
              placeholder="••••"
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={confirmPinInput}
              onChangeText={setConfirmPinInput}
            />

            <Button
              variant="primary"
              size="lg"
              className="mt-2 mb-4"
              onPress={handleSavePin}
            >
              <Text className="text-white font-semibold">Enable App Lock</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
