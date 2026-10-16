import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Alert, Pressable, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { AppBottomSheet } from '../../components/ui/AppBottomSheet';
import { AppDialog } from '../../components/ui/AppDialog';
import { useAuth } from '../../context/AuthContext';
import { appLockService } from '../../lib/security/app-lock.service';
import { Fingerprint, Bell, Database, LogOut, ChevronRight, Calendar, Target, Lock, PieChart, X, Smartphone, Zap, HandCoins, Clock } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';

export default function MoreScreen() {
  const { user, signOut } = useAuth();

  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(30);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Pin setup modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  useEffect(() => {
    loadSecurityState();
  }, []);

  const loadSecurityState = async () => {
    const lockOn = await appLockService.isAppLockEnabled();
    const bioOn = await appLockService.isBiometricsEnabled();
    const timeout = await appLockService.getLockTimeout();
    setAppLockEnabled(lockOn);
    setBiometricsEnabled(bioOn);
    setLockTimeout(timeout);
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

  const handleSignOut = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setSignOutDialogVisible(true);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F9FE' }} edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Header */}
        <View className="mb-4">
          <Text className="text-[22px] font-extrabold text-zinc-950 tracking-tight">More & Settings</Text>
          <Text className="text-xs font-medium text-zinc-500 mt-0.5">Preferences, security & modules</Text>
        </View>

        {/* Profile Card */}
        <Card className="mb-6 p-5 flex-row items-center bg-white border border-zinc-100 rounded-3xl shadow-xs">
          <View className="w-14 h-14 rounded-full bg-violet-100 border border-violet-200/60 items-center justify-center mr-4">
            <Text className="text-xl font-extrabold text-violet-700">
              {(user?.user_metadata?.display_name || user?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[17px] font-extrabold text-zinc-950">
              {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Authenticated User'}
            </Text>
            <Text className="text-xs font-medium text-zinc-500 mt-0.5" numberOfLines={1}>
              {user?.user_metadata?.phone_number || (user?.email?.includes('@pocketwise.internal') ? 'Mobile Account' : user?.email)}
            </Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Badge label="Verified Account" variant="neutral" />
            </View>
          </View>
        </Card>

        {/* Modules */}
        <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5 ml-1">Financial Modules</Text>
        <Card className="mb-6 p-0 bg-white border border-zinc-100 rounded-3xl shadow-xs overflow-hidden divide-y divide-zinc-100/80">
          <Pressable onPress={() => router.push({ pathname: '/reports', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-purple-50 items-center justify-center mr-3.5">
                <PieChart size={20} color="#9333EA" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Financial Reports & Analytics</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Spending rate, breakdown & performance</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/bills', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center mr-3.5">
                <Calendar size={20} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Upcoming Bills</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Track recurring bills & pay expenses</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/goals', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3.5">
                <Target size={20} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Savings Goals</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Set target milestones & contributions</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/lends', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-teal-50 items-center justify-center mr-3.5">
                <HandCoins size={20} color="#0D9488" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Money Lends</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Track lent money & get reminded to collect</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>
        </Card>

        {/* Security */}
        <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5 ml-1">App Security & Sync</Text>
        <Card className="mb-6 p-0 bg-white border border-zinc-100 rounded-3xl shadow-xs overflow-hidden divide-y divide-zinc-100/80">
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3.5">
                <Lock size={20} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">App Lock (PIN)</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Protect financial data with 4-digit PIN</Text>
              </View>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={toggleAppLock}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          {appLockEnabled && (
            <>
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mr-3.5">
                    <Fingerprint size={20} color="#10B981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-zinc-950">Biometric Unlock</Text>
                    <Text className="text-xs font-medium text-zinc-500 mt-0.5">Face ID / Touch ID unlock</Text>
                  </View>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={toggleBiometrics}
                  trackColor={{ false: '#E4E4E7', true: '#10B981' }}
                />
              </View>

              <View className="p-4 bg-zinc-50/70 border-t border-zinc-100/80">
                <View className="flex-row items-center mb-2.5">
                  <Clock size={15} color="#6366F1" />
                  <Text className="text-xs font-bold text-zinc-700 ml-1.5">Auto-Lock When in Background</Text>
                </View>
                <View className="flex-row gap-2">
                  {[
                    { label: 'Immediately', value: 0 },
                    { label: '30s', value: 30 },
                    { label: '1m', value: 60 },
                    { label: '5m', value: 300 },
                  ].map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={async () => {
                        await appLockService.setLockTimeout(option.value);
                        setLockTimeout(option.value);
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                      }}
                      className={`flex-1 py-2.5 rounded-xl items-center border ${
                        lockTimeout === option.value
                          ? 'bg-zinc-950 border-zinc-950 shadow-xs'
                          : 'bg-white border-zinc-200/80'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          lockTimeout === option.value ? 'text-white' : 'text-zinc-700'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

          <Pressable onPress={() => router.push({ pathname: '/sms-settings', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mr-3.5">
                <Smartphone size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Bank & SMS Tracking</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Auto-detect bank transactions & SMS</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/shake-settings', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mr-3.5">
                <Zap size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Quick Expense (Shake to Add)</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Shake phone to immediately record expenses</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/notification-settings', params: { from: 'more' } } as any)} className="p-4 flex-row items-center justify-between active:bg-zinc-50">
            <View className="flex-row items-center flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-purple-50 items-center justify-center mr-3.5">
                <Bell size={20} color="#9333EA" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-zinc-950">Notification & Alert Settings</Text>
                <Text className="text-xs font-medium text-zinc-500 mt-0.5">Customize push categories, limits & quiet hours</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#A1A1AA" />
          </Pressable>
        </Card>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          className="mb-12 py-3.5 px-5 rounded-2xl bg-white border border-rose-200/80 shadow-xs flex-row items-center justify-center gap-2 active:bg-rose-50/40"
        >
          <LogOut size={17} color="#EF4444" />
          <Text className="text-rose-600 font-bold text-sm">Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* Set PIN Modal */}
      <AppBottomSheet
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        title="Set 4-Digit App PIN"
        subtitle="Protect PocketWise with a passcode"
        scrollable={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        <View>
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
      </AppBottomSheet>

      {/* Sign Out Confirmation Dialog */}
      <AppDialog
        visible={signOutDialogVisible}
        onClose={() => setSignOutDialogVisible(false)}
        title="Sign Out?"
        description="Are you sure you want to sign out of PocketWise? Your local app lock passcode will also be reset."
        confirmLabel="Sign Out"
        destructive={true}
        onConfirm={async () => {
          setSignOutDialogVisible(false);
          await appLockService.clearPin();
          await signOut();
          router.replace('/(auth)/login');
        }}
      />
    </SafeAreaView>
  );
}
