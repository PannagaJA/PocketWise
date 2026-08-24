import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Pressable, AppState, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { shakeService, ShakeDiagnostics, NativeServiceDiagnostics } from '../lib/shake/shakeService';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';
import { ArrowLeft, Zap, Shield, Smartphone, Layers, Play, CheckCircle2, AlertCircle, Cpu, RefreshCw, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ShakeSettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState<ShakeSensitivity>('normal');
  const [overlayGranted, setOverlayGranted] = useState(false);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ShakeDiagnostics | null>(null);
  const [serviceDiagnostics, setServiceDiagnostics] = useState<NativeServiceDiagnostics | null>(null);

  useEffect(() => {
    loadSettings();

    // Re-check overlay permission, service state, and diagnostics when returning from Android OS Settings
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);
        const isRunning = await shakeService.isServiceRunning().catch(() => false);
        const serviceDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
        setOverlayGranted(isOverlayOk);
        setServiceRunning(isRunning);
        setDiagnostics(shakeService.getDiagnostics());
        setServiceDiagnostics(serviceDiag);
      }
    });

    return () => subscription.remove();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const settings = await shakeStorage.getSettings();
    const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);
    const isRunning = await shakeService.isServiceRunning().catch(() => false);
    const diag = shakeService.getDiagnostics();
    const serviceDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);

    setEnabled(settings.enabled);
    setBackgroundEnabled(settings.backgroundEnabled);
    setSensitivity(settings.sensitivity);
    setOverlayGranted(isOverlayOk);
    setServiceRunning(isRunning);
    setDiagnostics(diag);
    setServiceDiagnostics(serviceDiag);
    setLoading(false);
  };

  const toggleEnabled = async (value: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEnabled(value);
    await shakeStorage.saveSettings({ enabled: value });
    try {
      if (value) {
        const ok = await shakeService.startService();
        setServiceRunning(ok);
      } else {
        await shakeService.stopService();
        setServiceRunning(false);
      }
    } catch (err: any) {
      Alert.alert(
        'Native Service Error',
        `Failed to ${value ? 'start' : 'stop'} shake service:\n\n${err?.message || err}`
      );
      // Revert UI state on failure
      setEnabled(!value);
      await shakeStorage.saveSettings({ enabled: !value });
    }
    setDiagnostics(shakeService.getDiagnostics());
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const toggleBackgroundEnabled = async (value: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setBackgroundEnabled(value);
    await shakeStorage.saveSettings({ backgroundEnabled: value });
    try {
      await shakeService.setBackgroundEnabled(value);
    } catch (err: any) {
      Alert.alert(
        'Native Background Preference Error',
        `Failed to set background preference:\n\n${err?.message || err}`
      );
    }
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const changeSensitivity = async (newSens: ShakeSensitivity) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setSensitivity(newSens);
    try {
      await shakeService.setSensitivity(newSens);
    } catch (err: any) {
      console.warn('[ShakeSettings] Failed to set sensitivity natively:', err);
    }
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const handleRequestOverlay = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    try {
      await shakeService.requestOverlayPermission();
    } catch (err: any) {
      Alert.alert(
        'Permission Request Error',
        `Unable to open Android overlay settings:\n\n${err?.message || err}`
      );
    }
    setDiagnostics(shakeService.getDiagnostics());
  };

  const handleSimulateShake = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    try {
      await shakeService.simulateShake();
    } catch (err: any) {
      Alert.alert(
        'Simulate Shake Error',
        `Native shake simulation failed:\n\n${err?.message || err}`
      );
    }
    setDiagnostics(shakeService.getDiagnostics());
  };

  const refreshDiagnostics = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);
    const isRunning = await shakeService.isServiceRunning().catch(() => false);
    const serviceDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setOverlayGranted(isOverlayOk);
    setServiceRunning(isRunning);
    setDiagnostics(shakeService.getDiagnostics());
    setServiceDiagnostics(serviceDiag);
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
                <Text className="text-xs text-zinc-500">Detect shakes when app is minimized or swiped from recents</Text>
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
              label={overlayGranted ? 'Granted ✓' : 'Required'}
              variant={overlayGranted ? 'income' : 'expense'}
            />
          </View>

          <Text className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Allows PocketWise to display the compact floating Quick Expense popup over other applications (such as UPI apps, shopping apps, or your home screen) when you shake your device.
          </Text>

          {!overlayGranted ? (
            <View className="gap-2.5">
              <Button
                variant="primary"
                size="md"
                className="bg-indigo-600 active:bg-indigo-700 w-full"
                onPress={handleRequestOverlay}
              >
                <Shield size={16} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-bold text-xs tracking-wide">Turn On Display Over Other Apps</Text>
              </Button>
              <Text className="text-[11px] text-zinc-400 italic text-center">
                After enabling the permission in Android Settings, return to PocketWise and the status will automatically update to Granted ✓.
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-between pt-1">
              <View className="flex-row items-center gap-1.5">
                <CheckCircle2 size={16} color="#10B981" />
                <Text className="text-xs font-semibold text-emerald-600">Overlay popup is active & ready</Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-200 bg-zinc-50"
                onPress={handleRequestOverlay}
              >
                <Shield size={14} color="#71717A" className="mr-1.5" />
                <Text className="text-zinc-700 font-bold text-xs">Manage Permission</Text>
              </Button>
            </View>
          )}
        </Card>

        {/* Test Section */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Test & Verification</Text>
        <Card className="mb-5 p-4 bg-white border border-zinc-200 rounded-2xl">
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

        {/* Native Bridge & Sensor Diagnostics Card */}
        <View className="flex-row items-center justify-between mb-2.5 ml-1">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Native Bridge & Sensor Diagnostics</Text>
          <Pressable onPress={refreshDiagnostics} className="flex-row items-center gap-1 active:opacity-60">
            <RefreshCw size={12} color="#71717A" />
            <Text className="text-[11px] font-semibold text-zinc-500">Refresh</Text>
          </Pressable>
        </View>
        <Card className="mb-5 p-4 bg-zinc-900 border-zinc-800 rounded-2xl">
          <View className="flex-row items-center gap-2 mb-3">
            <Cpu size={16} color="#A1A1AA" />
            <Text className="text-xs font-bold text-white">Installed APK Native Status</Text>
          </View>

          <View className="divide-y divide-zinc-800">
            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Native module available:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.moduleAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.moduleAvailable ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Overlay check callable:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.overlayCheckCallable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.overlayCheckCallable ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Start service callable:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.startServiceCallable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.startServiceCallable ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Stop service callable:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.stopServiceCallable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.stopServiceCallable ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Simulate shake callable:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.simulateShakeCallable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.simulateShakeCallable ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Service running:</Text>
              <Text className={`text-xs font-bold ${serviceRunning ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {serviceRunning ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Background enabled:</Text>
              <Text className={`text-xs font-bold ${backgroundEnabled && enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {backgroundEnabled && enabled ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Detector active:</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.detectorActive ?? serviceRunning ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {serviceDiagnostics?.detectorActive ?? serviceRunning ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Sensor available:</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.sensorAvailable ?? true ? 'text-emerald-400' : 'text-rose-400'}`}>
                {serviceDiagnostics?.sensorAvailable ?? true ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Sensor listening:</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.sensorListening ?? serviceRunning ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {serviceDiagnostics?.sensorListening ?? serviceRunning ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Sensor events received:</Text>
              <Text className="text-xs font-bold text-amber-300 font-mono">
                {serviceDiagnostics?.sensorEventsReceived !== undefined ? serviceDiagnostics.sensorEventsReceived.toLocaleString() : '0'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Last sensor event:</Text>
              <Text className="text-xs font-semibold text-zinc-300">
                {serviceDiagnostics?.lastSensorEventTimestamp && serviceDiagnostics.lastSensorEventTimestamp > 0
                  ? `${Math.max(0, Math.round((Date.now() - serviceDiagnostics.lastSensorEventTimestamp) / 1000))}s ago`
                  : 'Never'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Last shake detected:</Text>
              <Text className="text-xs font-semibold text-zinc-300">
                {serviceDiagnostics?.lastShakeTimestamp && serviceDiagnostics.lastShakeTimestamp > 0
                  ? `${Math.max(0, Math.round((Date.now() - serviceDiagnostics.lastShakeTimestamp) / 1000))}s ago`
                  : 'Never'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Popup active lock:</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.popupActive ? 'text-amber-400' : 'text-zinc-400'}`}>
                {serviceDiagnostics?.popupActive ? 'YES (locked)' : 'NO (ready)'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Battery & System Notice */}
        <View className="p-4 bg-zinc-100 rounded-2xl mb-8 flex-row items-start gap-2.5">
          <AlertCircle size={16} color="#71717A" className="mt-0.5" />
          <Text className="text-xs text-zinc-500 flex-1 leading-relaxed">
            <Text className="font-bold text-zinc-700">Task Continuity: </Text>
            Shake detection runs via an optimized foreground service with <Text className="font-semibold text-zinc-800">stopWithTask="false"</Text> and persistent restart policies so that motion detection continues reliably even when PocketWise is dismissed from Recent Apps.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
