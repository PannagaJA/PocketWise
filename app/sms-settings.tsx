import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ChevronLeft, ShieldCheck, Smartphone, Building2, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { smsStorage } from '../lib/sms/storage/smsStore';
import { smsListenerService } from '../lib/sms/service/smsListenerService';
import { AccountMapping, SmsTrackingSettings, ParsedSmsTransaction } from '../lib/sms/types';
import { SmsTransactionReviewModal } from '../components/SmsTransactionReviewModal';

export default function SmsSettingsScreen() {
  const router = useRouter();

  const [settings, setSettings] = useState<SmsTrackingSettings>({
    autoTrackingEnabled: false,
    permissionGranted: false,
    totalDetectedCount: 0,
  });

  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);
  const [pendingReviews, setPendingReviews] = useState<ParsedSmsTransaction[]>([]);
  const [selectedReviewTx, setSelectedReviewTx] = useState<ParsedSmsTransaction | null>(null);
  const [notificationListenerEnabled, setNotificationListenerEnabled] = useState(false);

  useEffect(() => {
    loadSmsSettings();
  }, []);

  const loadSmsSettings = async () => {
    const s = await smsStorage.getSettings();
    const isGranted = await smsListenerService.checkSmsPermissions();
    const isListenerEnabled = await smsListenerService.isNotificationListenerEnabled();
    setSettings({ ...s, permissionGranted: isGranted || isListenerEnabled });
    setNotificationListenerEnabled(isListenerEnabled);

    const mappings = await smsStorage.getAccountMappings();
    setAccountMappings(mappings);

    const pending = await smsStorage.getPendingReviews();
    setPendingReviews(pending);
  };

  const handleToggleAutoTracking = async (value: boolean) => {
    if (value) {
      const granted = await smsListenerService.requestSmsPermissions();
      await smsStorage.saveSettings({
        autoTrackingEnabled: granted,
        permissionGranted: granted,
      });
      setSettings((prev) => ({ ...prev, autoTrackingEnabled: granted, permissionGranted: granted }));
    } else {
      await smsStorage.saveSettings({ autoTrackingEnabled: false });
      setSettings((prev) => ({ ...prev, autoTrackingEnabled: false }));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-zinc-100 bg-white">
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)/'); } }} className="p-2 -ml-2 mr-2">
          <ChevronLeft size={24} color="#09090B" />
        </Pressable>
        <View>
          <Text className="text-lg font-extrabold text-zinc-900">Bank & SMS Tracking</Text>
          <Text className="text-xs text-zinc-500">Local automated transaction detection</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Master Switch Card */}
        <Card className="mb-6 p-5 bg-white border border-zinc-200">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
                <Smartphone size={22} color="#6366F1" />
              </View>
              <View>
                <Text className="text-base font-bold text-zinc-900">Automatic Bank Tracking</Text>
                <Text className="text-xs text-zinc-500">Detect incoming transaction SMS</Text>
              </View>
            </View>
            <Switch
              value={settings.autoTrackingEnabled}
              onValueChange={handleToggleAutoTracking}
              trackColor={{ false: '#E4E4E7', true: '#6366F1' }}
            />
          </View>

          {/* Status Indicators */}
          <View className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-zinc-600">Automatic Tracking Status</Text>
              <Badge
                label={settings.autoTrackingEnabled ? 'Enabled' : 'Disabled'}
                variant={settings.autoTrackingEnabled ? 'income' : 'expense'}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-zinc-600">SMS Permission</Text>
              <View className="flex-row items-center gap-1">
                {settings.permissionGranted ? (
                  <>
                    <CheckCircle2 size={14} color="#10B981" />
                    <Text className="text-xs font-bold text-emerald-600">Granted</Text>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} color="#EF4444" />
                    <Text className="text-xs font-bold text-rose-600">Denied / Not Requested</Text>
                  </>
                )}
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-zinc-600">Transactions Detected</Text>
              <Text className="text-xs font-black text-zinc-900">{settings.totalDetectedCount} total</Text>
            </View>
          </View>
        </Card>

        {/* Automatic SMS Detection via Google Messages Notifications */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Automatic SMS Detection</Text>
        <Card className="mb-6 p-4 bg-white border border-zinc-200">
          <Text className="text-xs font-medium text-zinc-600 leading-5 mb-3">
            PocketWise can read bank transaction notifications from Google Messages to automatically detect your transactions.
          </Text>
          <View className="flex-row items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 mb-3">
            <Text className="text-xs font-bold text-zinc-800">Notification Access</Text>
            <Badge
              label={notificationListenerEnabled ? 'Enabled' : 'Not Enabled'}
              variant={notificationListenerEnabled ? 'income' : 'expense'}
            />
          </View>
          <Button
            variant={notificationListenerEnabled ? 'outline' : 'primary'}
            size="sm"
            onPress={async () => {
              await smsListenerService.openNotificationListenerSettings();
            }}
          >
            <Text className={`text-xs font-bold ${notificationListenerEnabled ? 'text-zinc-800' : 'text-white'}`}>
              {notificationListenerEnabled ? 'Manage Notification Access' : 'Enable Notification Access'}
            </Text>
          </Button>
        </Card>

        {/* Pending Reviews Queue Section */}
        {pendingReviews.length > 0 && (
          <>
            <Text className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 ml-1">
              Pending Transactions Review ({pendingReviews.length})
            </Text>
            <Card className="mb-6 p-4 bg-amber-50/70 border border-amber-200 gap-3">
              {pendingReviews.map((item, idx) => (
                <View key={idx} className="flex-row items-center justify-between p-3 bg-white rounded-xl border border-amber-100">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-extrabold text-zinc-900">
                      {item.bankName} • ₹{item.amount}
                    </Text>
                    <Text className="text-[11px] text-zinc-500">{item.merchant || 'Bank Transaction'} ({item.type})</Text>
                  </View>
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-amber-600"
                    onPress={() => setSelectedReviewTx(item)}
                  >
                    <Text className="text-xs font-bold text-white">Review</Text>
                  </Button>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Known Accounts Mapping */}
        <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Connected Bank Accounts</Text>
        <Card className="mb-6 p-4 bg-white border border-zinc-200">
          {accountMappings.length === 0 ? (
            <View className="py-4 items-center">
              <View className="mb-2">
                <Building2 size={24} color="#A1A1AA" />
              </View>
              <Text className="text-xs font-medium text-zinc-500">No bank accounts linked yet.</Text>
              <Text className="text-[11px] text-zinc-400 text-center mt-1">
                When transaction SMS arrive, PocketWise will automatically learn your account numbers.
              </Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {accountMappings.map((m, idx) => (
                <View key={idx} className="flex-row items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-lg bg-indigo-100 items-center justify-center">
                      <Building2 size={16} color="#4F46E5" />
                    </View>
                    <View>
                      <Text className="text-xs font-bold text-zinc-900">{m.bankName}</Text>
                      <Text className="text-[11px] text-zinc-500">Account: {m.maskedAccount}</Text>
                    </View>
                  </View>
                  <Badge label="Active" variant="income" />
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Privacy Note */}
        <View className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex-row items-center gap-3">
          <ShieldCheck size={24} color="#059669" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-emerald-950">Local Privacy Guarantee</Text>
            <Text className="text-[11px] text-emerald-800 leading-4 mt-0.5">
              SMS parsing takes place 100% locally on your device processor. No financial SMS body content is ever uploaded to external servers.
            </Text>
          </View>
        </View>
      </ScrollView>

      <SmsTransactionReviewModal
        visible={!!selectedReviewTx}
        transaction={selectedReviewTx}
        onClose={() => setSelectedReviewTx(null)}
        onConfirm={() => {
          setSelectedReviewTx(null);
          loadSmsSettings();
        }}
      />
    </SafeAreaView>
  );
}
