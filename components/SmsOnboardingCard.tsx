import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { AppLoadingIndicator } from './ui/AppLoadingIndicator';
import { ShieldCheck, Smartphone, CheckCircle, X } from 'lucide-react-native';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { smsStorage } from '../lib/sms/storage/smsStore';

interface SmsOnboardingProps {
  visible: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}

export function SmsOnboardingModal({ visible, onClose, onEnabled }: SmsOnboardingProps) {
  const [loading, setLoading] = useState(false);

  const handleEnableTracking = async () => {
    setLoading(true);
    try {
      const granted = await smsListenerService.requestSmsPermissions();
      await smsStorage.saveSettings({
        autoTrackingEnabled: true,
        permissionGranted: granted,
      });

      if (onEnabled) onEnabled();
      onClose();
    } catch {
      // Ignore failure
    } finally {
      setLoading(false);
    }
  };

  const handleMaybeLater = async () => {
    await smsStorage.saveSettings({ autoTrackingEnabled: false });
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title="Automatic SMS Tracking"
      subtitle="Privacy-first on-device tracking"
      scrollable={true}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
    >
      {loading ? (
        <View className="py-12 items-center justify-center">
          <AppLoadingIndicator
            message="Requesting SMS permissions..."
            subMessage="Setting up your private on-device scanner"
          />
        </View>
      ) : (
        <View>
          <Text className="text-xl font-black text-zinc-900 mb-2">
            Automatically track bank transactions?
          </Text>

          <Text className="text-xs text-zinc-600 leading-5 mb-5">
            PocketWise can read incoming bank SMS messages on this device and automatically log eligible expenses, income, refunds, and transfers into your financial history.
          </Text>

          {/* Privacy Guarantee Box */}
          <View className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 mb-6">
            <View className="flex-row items-center gap-2 mb-1.5">
              <ShieldCheck size={18} color="#10B981" />
              <Text className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                100% On-Device Privacy Guaranteed
              </Text>
            </View>
            <Text className="text-[11px] text-emerald-800 leading-4">
              All SMS processing is performed locally on your device. PocketWise NEVER uploads raw SMS content, full bank messages, account numbers, or personal text messages to any cloud server.
            </Text>
          </View>

          <View className="gap-3">
            <Button
              variant="primary"
              size="lg"
              onPress={handleEnableTracking}
              disabled={loading}
              className="bg-indigo-600 active:bg-indigo-700 flex-row items-center justify-center gap-2.5 shadow-sm"
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-sm">Enable Automatic Tracking</Text>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={handleMaybeLater}
              className="border-zinc-200 bg-zinc-50"
            >
              <Text className="text-zinc-700 font-bold text-sm">Maybe Later</Text>
            </Button>
          </View>
        </View>
      )}
    </AppBottomSheet>
  );
}
