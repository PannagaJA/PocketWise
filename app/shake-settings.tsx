import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Pressable, AppState, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { shakeService } from '../lib/shake/shakeService';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';
import { ArrowLeft, Zap, Shield, Smartphone, Layers, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ShakeSettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState<ShakeSensitivity>('normal');
  const [overlayGranted, setOverlayGranted] = useState(false);
  const [serviceRunning, setServiceRunning] = useState(false);

  useEffect(() => {
    loadSettings();

    // Re-check overlay permission and service state when returning from Android OS Settings
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        const isOverlayOk = await shakeService.checkOverlayPermission();
        const isRunning = await shakeService.isServiceRunning();
        setOverlayGranted(isOverlayOk);
        setServiceRunning(isRunning);
      }
    });

    return () => subscription.remove();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const settings = await shakeStorage.getSettings();
    const isOverlayOk = await shakeService.checkOverlayPermission();
    const isRunning = await shakeService.isServiceRunning();

    setEnabled(settings.enabled);
    setBackgroundEnabled(settings.backgroundEnabled);
    setSensitivity(settings.sensitivity);
    setOverlayGranted(isOverlayOk);
    setServiceRunning(isRunning);
    setLoading(false);
  };

  const toggleEnabled = async (value: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEnabled(value);
    await shakeStorage.saveSettings({ enabled: value });
    if (value) {
      const ok = await shakeService.startService();
      setServiceRunning(ok);
    } else {
      await shakeService.stopService();
      setServiceRunning(false);
    }
  };

  const toggleBackgroundEnabled = async (value: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setBackgroundEnabled(value);
    await shakeStorage.saveSettings({ backgroundEnabled: value });
    await shakeService.setBackgroundEnabled(value);
  };

  const changeSensitivity = async (newSens: ShakeSensitivity) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSensitivity(newSens);
    await shakeService.setSensitivity(newSens);
  };

  const handleRequestOverlay = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    await shakeService.requestOverlayPermission();
  };

  const handleSimulateShake = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    await shakeService.simulateShake();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#09090B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pt-2 pb-3 border-b border-zinc-200 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 rounded-xl active:bg-zinc-100">
          <ArrowLeft size={22} color="#09090B" />
        </Pressable>
        <Text className="text-base font-extrabold text-zinc-900">Quick Expense</Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Banner Card */}
        <Card className="mb-5 p-5 bg-zinc-900 border-zinc-800 rounded-3xl overflow-hidden shadow-md">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 items-center justify-center">
              <Zap size={20} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-black text-white">Shake to Add Expense</Text>
              <Text className="text-xs text-zinc-400">Record expenses instantly by shaking your phone</Text>
            </View>
          </View>
          <Text className="text-xs text-zinc-300 leading-relaxed">
            Whenever you make a payment, shake your device to open the compact Quick Expense popup. Enter the amount and description in seconds.
          </Text>
        </Card>

        {/* Master Toggle */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">General</Text>
        <Card className="mb-5 p-0 bg-white border border-zinc-200 divide-y divide-zinc-100 rounded-2xl">
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Smartphone size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Shake to Add Expense</Text>
                <Text className="text-xs text-zinc-500">Enable physical motion trigger</Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: '#E4E4E7', true: '#10B981' }}
            />
          </View>

          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Layers size={20} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Background Shake Detection</Text>
                <Text className="text-xs text-zinc-500">Detect shakes when app is closed or minimized</Text>
              </View>
            </View>
            <Switch
              disabled={!enabled}
              value={backgroundEnabled && enabled}
              onValueChange={toggleBackgroundEnabled}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>
        </Card>

        {/* Sensitivity Selector */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Shake Sensitivity</Text>
        <Card className="mb-5 p-4 bg-white border border-zinc-200 rounded-2xl">
          <Text className="text-xs text-zinc-500 mb-3">
            Choose how firmly you need to shake the device to open the expense popup.
          </Text>

          <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-3">
            {(['low', 'normal', 'high'] as ShakeSensitivity[]).map((level) => {
              const isSelected = sensitivity === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => changeSensitivity(level)}
                  className={`flex-1 py-2.5 rounded-xl items-center ${isSelected ? 'bg-zinc-900' : ''}`}
                >
                  <Text className={`text-xs font-bold capitalize ${isSelected ? 'text-white' : 'text-zinc-600'}`}>
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-[11px] text-zinc-400 text-center font-medium">
            {sensitivity === 'low' && 'Low: Requires a firmer, deliberate shake to avoid accidental triggers.'}
            {sensitivity === 'normal' && 'Normal (Default): Balanced detection for everyday physical hand shakes.'}
            {sensitivity === 'high' && 'High: Opens popup with a lighter shake.'}
          </Text>
        </Card>

        {/* Display Over Other Apps Permission Card */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Android Permissions</Text>
        <Card className="mb-5 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                <Shield size={18} color="#6366F1" />
              </View>
              <Text className="text-sm font-bold text-zinc-900">Display Over Other Apps</Text>
            </View>
            <Badge
              label={overlayGranted ? 'Granted' : 'Required'}
              variant={overlayGranted ? 'income' : 'expense'}
            />
          </View>

          <Text className="text-xs text-zinc-500 mb-3 leading-relaxed">
            Allows PocketWise to show the floating Quick Expense popup over other apps (e.g. while using UPI or shopping apps).
          </Text>

          {!overlayGranted && (
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-200 bg-indigo-50/50"
              onPress={handleRequestOverlay}
            >
              <Text className="text-indigo-600 font-bold text-xs">Grant Overlay Permission</Text>
            </Button>
          )}
        </Card>

        {/* Test Section */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Test & Verification</Text>
        <Card className="mb-6 p-4 bg-white border border-zinc-200 rounded-2xl">
          <Text className="text-xs text-zinc-500 mb-3">
            Simulate a physical shake event right now to verify the Quick Expense popup and submission flow.
          </Text>

          <Button
            variant="primary"
            size="md"
            className="bg-zinc-900"
            onPress={handleSimulateShake}
          >
            <Play size={16} color="#FFFFFF" className="mr-2" />
            <Text className="text-white font-bold text-xs">Simulate Shake Event</Text>
          </Button>
        </Card>

        {/* Battery & System Notice */}
        <View className="p-4 bg-zinc-100 rounded-2xl mb-8 flex-row items-start gap-2.5">
          <AlertCircle size={16} color="#71717A" className="mt-0.5" />
          <Text className="text-xs text-zinc-500 flex-1 leading-relaxed">
            <Text className="font-bold text-zinc-700">Battery Optimized: </Text>
            Shake detection uses minimal hardware accelerometer resources. Turning this setting OFF unregisters sensors and shuts down all background services immediately.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

