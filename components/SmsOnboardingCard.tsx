import React, { useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
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
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50 p-4">
        <Card className="bg-white rounded-3xl p-6 border border-zinc-200">
          <View className="flex-row justify-between items-center mb-4">
            <View className="w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center">
              <Smartphone size={24} color="#6366F1" />
            </View>
            <Pressable onPress={onClose} className="p-2">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          <Text className="text-2xl font-extrabold text-zinc-900 mb-2">
            Automatically track bank transactions?
          </Text>

          <Text className="text-sm text-zinc-600 leading-6 mb-6">
            PocketWise can read incoming bank SMS messages on this device and automatically log eligible expenses, income, refunds, and transfers into your financial history.
          </Text>

          {/* Privacy Guarantee Box */}
          <View className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 mb-6">
            <View className="flex-row items-center mb-2">
              <ShieldCheck size={20} color="#10B981" className="mr-2" />
              <Text className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                100% On-Device Privacy Guaranteed
              </Text>
            </View>
            <Text className="text-xs text-emerald-800 leading-5">
              All SMS processing is performed locally on your device. PocketWise NEVER uploads raw SMS content, full bank messages, account numbers, or personal text messages to any cloud server.
            </Text>
          </View>

          <View className="gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onPress={handleEnableTracking}
              disabled={loading}
              className="bg-indigo-600 active:bg-indigo-700"
            >
              <CheckCircle size={18} color="#FFFFFF" className="mr-2" />
              <Text className="text-white font-bold text-base">Enable Automatic Tracking</Text>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={handleMaybeLater}
              className="border-zinc-200"
            >
              <Text className="text-zinc-700 font-semibold text-base">Maybe Later</Text>
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
