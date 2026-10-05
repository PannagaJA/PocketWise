import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Wallet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      Alert.alert('Missing Details', 'Please enter your email and password to sign in.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Unable to Sign In', error.message);
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-zinc-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 }}
        >
          {/* Top Brand Header */}
          <View className="items-center mb-8">
            {/* Minimalist Icon Badge */}
            <View className="w-16 h-16 rounded-3xl bg-zinc-900 items-center justify-center mb-4 shadow-sm border border-zinc-800">
              <Wallet size={28} color="#FFFFFF" strokeWidth={2} />
            </View>

            {/* Typography */}
            <Text className="text-3xl font-black tracking-tight text-zinc-950 text-center">
              PocketWise
            </Text>
            <Text className="text-sm font-medium text-zinc-500 mt-1 text-center">
              Intelligent Personal Wealth & Finance
            </Text>

            {/* Security Badge */}
            <View className="flex-row items-center gap-1.5 bg-zinc-100 px-3 py-1 rounded-full mt-3 border border-zinc-200">
              <ShieldCheck size={12} color="#10B981" />
              <Text className="text-xs font-semibold text-zinc-600">
                End-to-End Encrypted & Private
              </Text>
            </View>
          </View>

          {/* Form Container Card */}
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
            <Text className="text-xl font-bold text-zinc-900 mb-4">Sign In</Text>

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                Email Address
              </Text>
              <View
                className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                style={{
                  borderColor: focusedField === 'email' ? '#09090b' : '#e4e4e7',
                  backgroundColor: focusedField === 'email' ? '#ffffff' : '#f9fafb',
                }}
              >
                <Mail size={18} color={focusedField === 'email' ? '#09090B' : '#A1A1AA'} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="name@example.com"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-3 text-sm font-medium text-zinc-900"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1.5 ml-0.5">
                <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Password
                </Text>
              </View>
              <View
                className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                style={{
                  borderColor: focusedField === 'password' ? '#09090b' : '#e4e4e7',
                  backgroundColor: focusedField === 'password' ? '#ffffff' : '#f9fafb',
                }}
              >
                <Lock size={18} color={focusedField === 'password' ? '#09090B' : '#A1A1AA'} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••••••"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  className="flex-1 ml-3 text-sm font-medium text-zinc-900"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setShowPassword(!showPassword);
                  }}
                  className="p-1"
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#71717A" />
                  ) : (
                    <Eye size={18} color="#71717A" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-4 bg-zinc-900 active:bg-zinc-800"
              onPress={handleLogin}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-white font-bold text-base">Sign In</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Button>
          </View>

          {/* Switch to Register */}
          <View className="flex-row justify-center items-center mt-6 py-2">
            <Text className="text-sm font-medium text-zinc-500">
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.push('/(auth)/register');
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-bold text-zinc-900 underline">
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Footer */}
          <View className="items-center mt-8">
            <View className="flex-row items-center gap-1.5 opacity-60">
              <ShieldCheck size={14} color="#71717A" />
              <Text className="text-xs text-zinc-500 font-medium">
                Secure Cloud Sync & Encrypted Storage via Supabase
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
