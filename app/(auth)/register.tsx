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
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Mail,
  KeyRound,
  CheckCircle2,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { phoneAuthService } from '../../lib/auth/phone-auth.service';

export default function RegisterScreen() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');

  const [name, setName] = useState('');
  const [countryCode] = useState('+91');

  // Phone mode states
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Email mode states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<
    'name' | 'identifier' | 'secret' | 'confirmSecret' | null
  >(null);

  const handlePhoneChange = (text: string) => {
    const formatted = phoneAuthService.formatInput(text);
    setPhone(formatted);
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);

    try {
      if (authMode === 'phone') {
        const rawDigits = phone.replace(/\D/g, '');
        if (rawDigits.length !== 10) {
          throw new Error('Please enter a valid 10-digit mobile number.');
        }

        if (!pin || pin.length < 4) {
          throw new Error('Please enter a 4-digit Security PIN.');
        }

        if (pin !== confirmPin) {
          throw new Error('The Security PINs you entered do not match.');
        }

        const data = await phoneAuthService.signUpWithPhone(
          name.trim(),
          rawDigits,
          pin.trim(),
          countryCode
        );

        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

        if (data.session) {
          Alert.alert('Account Created!', `Welcome to PocketWise, ${name.trim()}!`, [
            { text: 'Get Started', onPress: () => router.replace('/(tabs)') },
          ]);
        } else {
          Alert.alert('Success', 'Account created! You can now sign in with your mobile number.', [
            { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
          ]);
        }
      } else {
        if (!email.trim() || !password) {
          throw new Error('Please enter both your email and password.');
        }

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });

        if (error) throw error;

        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

        if (data.session) {
          Alert.alert('Account Created', 'Welcome to PocketWise!', [
            { text: 'Continue', onPress: () => router.replace('/(tabs)') },
          ]);
        } else {
          Alert.alert(
            'Check Your Email',
            'A confirmation link has been sent to your email. Confirm your email to sign in.',
            [{ text: 'Go to Sign In', onPress: () => router.replace('/(auth)/login') }]
          );
        }
      }
    } catch (err: any) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      Alert.alert('Registration Failed', err?.message || 'Could not create account.');
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
          {/* Back to Sign In Link */}
          <TouchableOpacity
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(auth)/login');
              }
            }}
            className="mb-4 flex-row items-center self-start gap-1.5 py-1.5 px-3 rounded-full bg-zinc-100 border border-zinc-200"
            activeOpacity={0.7}
          >
            <ArrowLeft size={15} color="#09090B" />
            <Text className="text-xs font-bold text-zinc-900">Sign In</Text>
          </TouchableOpacity>

          {/* Top Brand Header */}
          <View className="items-center mb-6">
            <View className="w-14 h-14 rounded-3xl bg-zinc-900 items-center justify-center mb-2.5 shadow-sm border border-zinc-800">
              <Wallet size={24} color="#FFFFFF" strokeWidth={2} />
            </View>

            <Text className="text-2xl font-black tracking-tight text-zinc-950 text-center">
              Create Account
            </Text>
            <Text className="text-xs font-semibold text-zinc-500 mt-0.5 text-center">
              Start tracking your personal wealth effortlessly
            </Text>
          </View>

          {/* Form Container Card */}
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
            {/* Mode Switcher Tabs */}
            <View className="flex-row bg-zinc-100 p-1 rounded-2xl mb-4">
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
                  Email
                </Text>
              </Pressable>
            </View>

            {/* Full Name Field */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                Full Name
              </Text>
              <View
                className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                style={{
                  borderColor: focusedField === 'name' ? '#09090b' : '#e4e4e7',
                  backgroundColor: focusedField === 'name' ? '#ffffff' : '#f9fafb',
                }}
              >
                <User size={18} color={focusedField === 'name' ? '#09090B' : '#A1A1AA'} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. John Doe"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="words"
                  className="flex-1 ml-3 text-sm font-semibold text-zinc-900"
                />
              </View>
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
                      maxLength={11}
                      className="flex-1 px-3.5 py-3 text-base font-bold text-zinc-900 tracking-wider"
                    />
                  </View>
                </View>

                {/* Create Security PIN */}
                <View className="mb-3">
                  <View className="flex-row justify-between items-center mb-1.5 ml-0.5">
                    <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Create 4-Digit PIN
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

                {/* Confirm Security PIN */}
                <View className="mb-3">
                  <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                    Confirm 4-Digit PIN
                  </Text>
                  <View
                    className="flex-row items-center rounded-2xl px-3.5 py-3 border"
                    style={{
                      borderColor: focusedField === 'confirmSecret' ? '#09090b' : '#e4e4e7',
                      backgroundColor: focusedField === 'confirmSecret' ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <KeyRound
                      size={18}
                      color={
                        confirmPin && confirmPin === pin
                          ? '#10B981'
                          : focusedField === 'confirmSecret'
                          ? '#09090B'
                          : '#A1A1AA'
                      }
                    />
                    <TextInput
                      value={confirmPin}
                      onChangeText={setConfirmPin}
                      onFocus={() => setFocusedField('confirmSecret')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••"
                      placeholderTextColor="#A1A1AA"
                      secureTextEntry={!showSecret}
                      keyboardType="numeric"
                      maxLength={6}
                      className="flex-1 ml-3 text-base font-bold text-zinc-900 tracking-widest"
                    />
                    {confirmPin && confirmPin === pin ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : null}
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
                      className="flex-1 ml-3 text-sm font-semibold text-zinc-900"
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
                      placeholder="At least 6 characters"
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
              onPress={handleRegister}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-white font-bold text-base">Create Account</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Button>
          </View>

          {/* Switch to Login */}
          <View className="flex-row justify-center items-center mt-6 py-2">
            <Text className="text-sm font-medium text-zinc-500">
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                router.replace('/(auth)/login');
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-black text-indigo-600 underline">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Security Guarantee Footer */}
          <View className="items-center mt-6">
            <View className="flex-row items-center gap-1.5 opacity-60">
              <ShieldCheck size={14} color="#71717A" />
              <Text className="text-xs text-zinc-500 font-medium">
                Encrypted with PBKDF2 • Private & Offline-capable
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
