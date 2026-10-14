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
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Mail,
  KeyRound,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { phoneAuthService } from '../../lib/auth/phone-auth.service';

export default function LoginScreen() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');

  // Phone mode states
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [countryCode] = useState('+91');

  // Email mode states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'identifier' | 'secret' | null>(null);

  const handlePhoneChange = (text: string) => {
    const formatted = phoneAuthService.formatInput(text);
    setPhone(formatted);
  };

  const handleLogin = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);

    try {
      if (authMode === 'phone') {
        const rawDigits = phone.replace(/\D/g, '');
        if (!rawDigits) {
          throw new Error('Please enter your 10-digit mobile number.');
        }
        if (rawDigits.length !== 10) {
          throw new Error('Mobile number must be exactly 10 digits.');
        }
        if (!pin.trim()) {
          throw new Error('Please enter your 4-digit PIN.');
        }
        if (pin.trim().length < 4) {
          throw new Error('Security PIN must be at least 4 digits.');
        }

        await phoneAuthService.signInWithPhone(rawDigits, pin.trim(), countryCode);
      } else {
        if (!email.trim() || !password) {
          throw new Error('Please enter both your email and password.');
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      router.replace('/(tabs)');
    } catch (err: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Sign In Failed', err?.message || 'Could not sign in. Please verify your details.');
    } finally {
      setLoading(false);
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
          <View className="items-center mb-7">
            <View className="w-16 h-16 rounded-3xl bg-zinc-900 items-center justify-center mb-3.5 shadow-sm border border-zinc-800">
              <Wallet size={28} color="#FFFFFF" strokeWidth={2} />
            </View>

            <Text className="text-3xl font-black tracking-tight text-zinc-950 text-center">
              PocketWise
            </Text>
            <Text className="text-xs font-semibold text-zinc-500 mt-1 text-center">
              Intelligent Personal Wealth & Money Manager
            </Text>
          </View>

          {/* Form Container Card */}
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
            {/* Header with Title and Mode Switcher */}
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="text-xl font-black text-zinc-900">Sign In</Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {authMode === 'phone' ? 'Enter your mobile number & PIN' : 'Sign in using your registered email'}
                </Text>
              </View>
            </View>

            {/* Mode Switcher Tabs */}
            <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-5">
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setAuthMode('phone');
                }}
                className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
                  authMode === 'phone' ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Phone size={13} color={authMode === 'phone' ? '#09090B' : '#71717A'} />
                <Text
                  className={`text-xs font-bold ${
                    authMode === 'phone' ? 'text-zinc-900' : 'text-zinc-500'
                  }`}
                >
                  Mobile Number
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setAuthMode('email');
                }}
                className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
                  authMode === 'email' ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Mail size={13} color={authMode === 'email' ? '#09090B' : '#71717A'} />
                <Text
                  className={`text-xs font-bold ${
                    authMode === 'email' ? 'text-zinc-900' : 'text-zinc-500'
                  }`}
                >
                  Email Address
                </Text>
              </Pressable>
            </View>

            {authMode === 'phone' ? (
              <>
                {/* Mobile Number Field */}
                <View className="mb-4">
                  <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                    Mobile Number
                  </Text>
                  <View
                    className="flex-row items-center rounded-2xl border bg-white overflow-hidden"
                    style={{
                      borderColor: focusedField === 'identifier' ? '#09090b' : '#e4e4e7',
                      backgroundColor: focusedField === 'identifier' ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    {/* Country Code Pill */}
                    <View className="flex-row items-center bg-zinc-100 px-3 py-3.5 border-r border-zinc-200 gap-1">
                      <Text className="text-sm font-black text-zinc-900">🇮🇳 {countryCode}</Text>
                    </View>

                    <TextInput
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="98765 43210"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="phone-pad"
                      maxLength={11} // 10 digits + 1 space
                      className="flex-1 px-3.5 py-3 text-base font-bold text-zinc-900 tracking-wider"
                    />
                  </View>
                </View>

                {/* Security PIN Field */}
                <View className="mb-3">
                  <View className="flex-row justify-between items-center mb-1.5 ml-0.5">
                    <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Security PIN
                    </Text>
                    <Text className="text-[11px] text-zinc-400 font-medium">4 digits</Text>
                  </View>
                  <View
                    className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                    style={{
                      borderColor: focusedField === 'secret' ? '#09090b' : '#e4e4e7',
                      backgroundColor: focusedField === 'secret' ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <KeyRound size={18} color={focusedField === 'secret' ? '#09090B' : '#A1A1AA'} />
                    <TextInput
                      value={pin}
                      onChangeText={setPin}
                      onFocus={() => setFocusedField('secret')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••"
                      placeholderTextColor="#A1A1AA"
                      secureTextEntry={!showSecret}
                      keyboardType="numeric"
                      maxLength={6}
                      className="flex-1 ml-3 text-base font-bold text-zinc-900 tracking-widest"
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setShowSecret(!showSecret);
                      }}
                      className="p-1"
                      hitSlop={8}
                    >
                      {showSecret ? <EyeOff size={18} color="#71717A" /> : <Eye size={18} color="#71717A" />}
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Email Field */}
                <View className="mb-4">
                  <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                    Email Address
                  </Text>
                  <View
                    className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                    style={{
                      borderColor: focusedField === 'identifier' ? '#09090b' : '#e4e4e7',
                      backgroundColor: focusedField === 'identifier' ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <Mail size={18} color={focusedField === 'identifier' ? '#09090B' : '#A1A1AA'} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('identifier')}
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
                  <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                    Password
                  </Text>
                  <View
                    className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                    style={{
                      borderColor: focusedField === 'secret' ? '#09090b' : '#e4e4e7',
                      backgroundColor: focusedField === 'secret' ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <Lock size={18} color={focusedField === 'secret' ? '#09090B' : '#A1A1AA'} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('secret')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••••••"
                      placeholderTextColor="#A1A1AA"
                      secureTextEntry={!showSecret}
                      autoCapitalize="none"
                      className="flex-1 ml-3 text-sm font-medium text-zinc-900"
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setShowSecret(!showSecret);
                      }}
                      className="p-1"
                      hitSlop={8}
                    >
                      {showSecret ? <EyeOff size={18} color="#71717A" /> : <Eye size={18} color="#71717A" />}
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {/* Submit Button */}
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-4 bg-zinc-900 active:bg-zinc-800 py-3.5"
              onPress={handleLogin}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-white font-bold text-base">
                  {authMode === 'phone' ? 'Sign In with Mobile' : 'Sign In with Email'}
                </Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Button>
          </View>

          {/* Switch to Register */}
          <View className="flex-row justify-center items-center mt-6 py-2">
            <Text className="text-sm font-medium text-zinc-500">
              New to PocketWise?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                router.push('/(auth)/register');
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-black text-indigo-600 underline">
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Footer */}
          <View className="items-center mt-6">
            <View className="flex-row items-center gap-1.5 opacity-60">
              <ShieldCheck size={14} color="#71717A" />
              <Text className="text-xs text-zinc-500 font-medium">
                Zero SMS fees • Instant PIN verification • Secure cloud sync
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
