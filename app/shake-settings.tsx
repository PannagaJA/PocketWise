import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, AppState, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { shakeService } from '../lib/shake/shakeService';
import { shakeStorage, ShakeSensitivity } from '../lib/shake/storage/shakeStore';
import { ArrowLeft, Zap, Shield, Smartphone, Layers, CheckCircle2, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ShakeSettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState<ShakeSensitivity>('3');
  const [overlayGranted, setOverlayGranted] = useState(false);

  useEffect(() => {
    loadSettings();

    // Re-check overlay permission when returning from Android OS Settings
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);
        setOverlayGranted(isOverlayOk);
      }
    });

    return () => subscription.remove();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const settings = await shakeStorage.getSettings();
    const isOverlayOk = await shakeService.checkOverlayPermission().catch(() => false);

    setEnabled(settings.enabled);
    setBackgroundEnabled(settings.backgroundEnabled);
    setSensitivity(settings.sensitivity);
    setOverlayGranted(isOverlayOk);
    setLoading(false);
  };

  const handleToggleEnabled = async (val: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setEnabled(val);
    await shakeStorage.saveSettings({ enabled: val });

    if (val) {
      await shakeService.startService();
    } else {
      await shakeService.stopService();
    }
  };

  const handleToggleBackground = async (val: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
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
  };

  const handleSelectSensitivity = async (s: ShakeSensitivity) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setSensitivity(s);
    await shakeService.setSensitivity(s);
  };

  const handleRequestOverlay = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    try {
      await shakeService.requestOverlayPermission();
    } catch (e: any) {
      Alert.alert('Permission Request Error', e?.message || 'Unable to open overlay settings.');
    }
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
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-100"
        >
          <ArrowLeft size={20} color="#18181B" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-zinc-900">Shake to Add Expense</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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

        {/* Shake Count Requirement Selector */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 ml-1">Shake Count Requirement</Text>
        <Card className="mb-4 p-4 bg-white border border-zinc-200 rounded-2xl">
          <View className="flex-row items-center gap-2 mb-3">
            <Smartphone size={16} color="#71717A" />
            <Text className="text-xs text-zinc-500">
              Select how many firm, deliberate physical shakes are required to open the popup.
            </Text>
          </View>

          <View className="flex-row gap-2">
            {[
              { id: '2' as ShakeSensitivity, label: '2 Shakes', sub: 'Quick' },
              { id: '3' as ShakeSensitivity, label: '3 Shakes', sub: 'Recommended' },
              { id: '5' as ShakeSensitivity, label: '5 Shakes', sub: 'Strict' },
            ].map((item) => {
              const isSelected =
                sensitivity === item.id ||
                (item.id === '3' && (sensitivity === 'normal' || !['2', '3', '5'].includes(sensitivity))) ||
                (item.id === '2' && sensitivity === 'high') ||
                (item.id === '5' && sensitivity === 'low');

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => handleSelectSensitivity(item.id)}
                  className={`flex-1 py-3 px-2 rounded-xl items-center justify-center border ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-900'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-zinc-800'
                    }`}
                  >
                    {item.label}
                  </Text>
                  <Text
                    className={`text-[10px] mt-0.5 ${
                      isSelected ? 'text-zinc-300' : 'text-zinc-400'
                    }`}
                  >
                    {item.sub}
                  </Text>
                </TouchableOpacity>
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
                className="bg-indigo-600 active:bg-indigo-700 w-full flex-row items-center justify-center gap-2"
                onPress={handleRequestOverlay}
              >
                <Shield size={16} color="#FFFFFF" />
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
                className="border-zinc-200 bg-zinc-50 flex-row items-center gap-1.5"
                onPress={handleRequestOverlay}
              >
                <Shield size={14} color="#71717A" />
                <Text className="text-zinc-700 font-bold text-xs">Manage Permission</Text>
              </Button>
            </View>
          )}
        </Card>

        {/* Battery & System Notice */}
        <View className="p-4 bg-zinc-100 rounded-2xl mb-8 flex-row items-start gap-2.5">
          <View className="mt-0.5">
            <AlertCircle size={16} color="#71717A" />
          </View>
          <Text className="text-xs text-zinc-500 flex-1 leading-relaxed">
            <Text className="font-bold text-zinc-700">Task Continuity & CPU WakeLock: </Text>
            Shake detection runs via an isolated background service to maintain responsive sensor delivery without draining battery.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
