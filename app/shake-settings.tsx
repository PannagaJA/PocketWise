import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Pressable, AppState, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { shakeService, ShakeDiagnostics, NativeServiceDiagnostics, SensorSelfTestResult } from '../lib/shake/shakeService';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';
import { ArrowLeft, Zap, Shield, Smartphone, Layers, Play, CheckCircle2, AlertCircle, Cpu, RefreshCw, Activity, Check } from 'lucide-react-native';
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
  const [isTestingSensor, setIsTestingSensor] = useState(false);
  const [sensorTestResult, setSensorTestResult] = useState<SensorSelfTestResult | null>(null);

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

  const handleToggleEnabled = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnabled(val);
    await shakeStorage.saveSettings({ enabled: val });

    if (val) {
      const ok = await shakeService.startService();
      setServiceRunning(ok);
    } else {
      await shakeService.stopService();
      setServiceRunning(false);
    }
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const handleToggleBackground = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBackgroundEnabled(val);
    await shakeService.setBackgroundEnabled(val);

    // If enabling background detection and overlay permission is missing, prompt user
    if (val && !overlayGranted) {
      Alert.alert(
        'Display Over Other Apps Required',
        'To show the Quick Expense popup over your home screen or other apps after a shake, PocketWise needs overlay permission.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Grant Permission', onPress: handleRequestOverlay },
        ]
      );
    }
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const handleSelectSensitivity = async (s: ShakeSensitivity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSensitivity(s);
    await shakeService.setSensitivity(s);
    const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setServiceDiagnostics(sDiag);
  };

  const handleRequestOverlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await shakeService.requestOverlayPermission();
    } catch (e: any) {
      Alert.alert('Permission Request Error', e?.message || 'Unable to open overlay settings.');
    }
  };

  const handleSimulateShake = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await shakeService.simulateShake();
    } catch (e: any) {
      Alert.alert('Simulate Shake Error', e?.message || 'Unable to simulate shake event.');
    }
  };

  const handleRunSensorTest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsTestingSensor(true);
    setSensorTestResult(null);
    try {
      const res = await shakeService.runSensorSelfTest(2000);
      setSensorTestResult(res);
      // Also refresh background service diagnostics
      const sDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
      setServiceDiagnostics(sDiag);
    } catch (e: any) {
      Alert.alert('Sensor Self-Test Error', e?.message || 'Failed to run test.');
    } finally {
      setIsTestingSensor(false);
    }
  };

  const refreshDiagnostics = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDiagnostics(shakeService.getDiagnostics());
    const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);
    const isRunning = await shakeService.isServiceRunning().catch(() => false);
    const serviceDiag = await shakeService.getNativeServiceDiagnostics().catch(() => null);
    setOverlayGranted(isOverlayOk);
    setServiceRunning(isRunning);
    setServiceDiagnostics(serviceDiag);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50 items-center justify-center">
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-zinc-200 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-100 active:bg-zinc-200"
        >
          <ArrowLeft size={20} color="#18181B" />
        </Pressable>
        <Text className="text-lg font-bold text-zinc-900">Shake to Add Expense</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Main Toggle Card */}
        <Card className="mb-4 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-4">
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
                <Zap size={22} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-zinc-900">Shake to Add Expense</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  Shake your device to instantly trigger the quick expense recording modal.
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: '#E4E4E7', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Background Detection Toggle Card */}
        <Card className="mb-4 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-4">
              <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                <Layers size={22} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-zinc-900">Background Shake Detection</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  Detect shakes even when PocketWise is minimized or in the background.
                </Text>
              </View>
            </View>
            <Switch
              value={backgroundEnabled && enabled}
              disabled={!enabled}
              onValueChange={handleToggleBackground}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Sensitivity Selector */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Motion Sensitivity</Text>
        <Card className="mb-4 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center gap-2 mb-3">
            <Smartphone size={16} color="#71717A" />
            <Text className="text-xs text-zinc-500">
              Adjust how firmly you need to shake the device to trigger the modal.
            </Text>
          </View>

          <View className="flex-row gap-2">
            {(['low', 'normal', 'high'] as ShakeSensitivity[]).map((level) => {
              const isSelected = sensitivity === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => handleSelectSensitivity(level)}
                  className={`flex-1 py-3 px-2 rounded-xl items-center justify-center border ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-900 shadow-sm'
                      : 'bg-zinc-50 border-zinc-200 active:bg-zinc-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold capitalize ${
                      isSelected ? 'text-white' : 'text-zinc-700'
                    }`}
                  >
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Overlay Permission Status Card */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Android System Permission</Text>
        <Card className="mb-4 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Shield size={18} color={overlayGranted ? '#10B981' : '#F59E0B'} />
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

        {/* Hardware Self-Test & Simulation Section */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Hardware Sensor Self-Test</Text>
        <Card className="mb-5 p-4 bg-white border border-zinc-200 rounded-2xl">
          <Text className="text-xs text-zinc-500 mb-3 leading-relaxed">
            Run a direct 2-second native accelerometer hardware test to verify real physical sensor event delivery on this device.
          </Text>

          <View className="flex-row gap-2 mb-3">
            <Button
              variant="primary"
              size="md"
              className="flex-1 bg-emerald-600 active:bg-emerald-700"
              onPress={handleRunSensorTest}
              disabled={isTestingSensor}
            >
              {isTestingSensor ? (
                <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
              ) : (
                <Activity size={16} color="#FFFFFF" className="mr-2" />
              )}
              <Text className="text-white font-bold text-xs">
                {isTestingSensor ? 'Testing Accelerometer...' : 'Run 2s Sensor Self-Test'}
              </Text>
            </Button>

            <Button
              variant="outline"
              size="md"
              className="bg-zinc-900 border-zinc-900"
              onPress={handleSimulateShake}
            >
              <Play size={16} color="#FFFFFF" className="mr-1.5" />
              <Text className="text-white font-bold text-xs">Simulate Popup</Text>
            </Button>
          </View>

          {sensorTestResult && (
            <View className={`p-3.5 rounded-xl border ${sensorTestResult.eventsReceived > 0 ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/30'}`}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`text-xs font-bold ${sensorTestResult.eventsReceived > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sensorTestResult.eventsReceived > 0 ? '✓ Hardware Accelerometer Active' : '✕ No Sensor Events Received'}
                </Text>
                <Badge
                  label={sensorTestResult.registrationSuccess ? 'Registration: SUCCESS' : 'Registration: FAILED'}
                  variant={sensorTestResult.registrationSuccess ? 'income' : 'expense'}
                />
              </View>

              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-zinc-500">Events received:</Text>
                  <Text className={`text-[11px] font-mono font-bold ${sensorTestResult.eventsReceived > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {sensorTestResult.eventsReceived} events in {sensorTestResult.durationMs}ms
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-zinc-500">Sensor name:</Text>
                  <Text className="text-[11px] font-semibold text-zinc-300">
                    {sensorTestResult.sensorName}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-zinc-500">Sensor vendor:</Text>
                  <Text className="text-[11px] font-semibold text-zinc-300">
                    {sensorTestResult.sensorVendor}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Native Bridge & Sensor Diagnostics Card */}
        <View className="flex-row items-center justify-between mb-2.5 ml-1">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Native Bridge & Persisted Telemetry</Text>
          <Pressable onPress={refreshDiagnostics} className="flex-row items-center gap-1 active:opacity-60">
            <RefreshCw size={12} color="#71717A" />
            <Text className="text-[11px] font-semibold text-zinc-500">Refresh</Text>
          </Pressable>
        </View>
        <Card className="mb-5 p-4 bg-zinc-900 border-zinc-800 rounded-2xl">
          <View className="flex-row items-center gap-2 mb-3">
            <Cpu size={16} color="#A1A1AA" />
            <Text className="text-xs font-bold text-white">Installed APK Native Telemetry</Text>
          </View>

          <View className="divide-y divide-zinc-800">
            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Native module available:</Text>
              <Text className={`text-xs font-bold ${diagnostics?.moduleAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {diagnostics?.moduleAvailable ? 'YES' : 'NO'}
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
              <Text className="text-xs text-zinc-400">Sensor available (hardware):</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.sensorAvailable ?? true ? 'text-emerald-400' : 'text-rose-400'}`}>
                {serviceDiagnostics?.sensorAvailable ?? true ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Sensor registration successful:</Text>
              <Text className={`text-xs font-bold ${serviceDiagnostics?.sensorRegistrationResult ?? serviceDiagnostics?.sensorListening ?? serviceRunning ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {serviceDiagnostics?.sensorRegistrationResult ?? serviceDiagnostics?.sensorListening ?? serviceRunning ? 'YES' : 'NO'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Hardware Sensor Name:</Text>
              <Text className="text-xs font-semibold text-zinc-300">
                {serviceDiagnostics?.sensorName || 'Accelerometer'}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Sensor events actually received:</Text>
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
              <Text className="text-xs text-zinc-400">Service start count:</Text>
              <Text className="text-xs font-mono text-zinc-300">
                {serviceDiagnostics?.serviceStartCount ?? 1}
              </Text>
            </View>

            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Service Instance ID:</Text>
              <Text className="text-[11px] font-mono text-zinc-400">
                {serviceDiagnostics?.serviceInstanceId ? serviceDiagnostics.serviceInstanceId.slice(0, 8) + '...' : 'Active'}
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
            <Text className="font-bold text-zinc-700">Task Continuity & CPU WakeLock: </Text>
            Shake detection runs via an isolated background HandlerThread with a safe <Text className="font-semibold text-zinc-800">PARTIAL_WAKE_LOCK</Text> and persistent telemetry to maintain sensor delivery without draining battery.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
