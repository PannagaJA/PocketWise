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
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      Alert.alert('Missing Fields', 'Please fill in all fields to create your account.');
      return;
    }

    if (password.length < 6) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);

    if (error) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Registration Failed', error.message);
    } else if (data.session) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert('Account Created', 'Welcome to PocketWise!', [
        { text: 'Continue', onPress: () => router.replace('/(tabs)') },
      ]);
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        'Check Your Email',
        'A confirmation link has been sent to your email. Confirm your email to sign in.',
        [{ text: 'Go to Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
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
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(auth)/login');
              }
            }}
            className="mb-4 flex-row items-center self-start gap-1.5 py-1.5 px-3 rounded-full bg-zinc-100 border border-zinc-200"
            activeOpacity={0.7}
          >
            <ArrowLeft size={16} color="#09090B" />
            <Text className="text-xs font-bold text-zinc-900">Sign In</Text>
          </TouchableOpacity>

          {/* Top Brand Header */}
          <View className="items-center mb-6">
            <View className="w-14 h-14 rounded-3xl bg-zinc-900 items-center justify-center mb-3 shadow-sm border border-zinc-800">
              <Wallet size={24} color="#FFFFFF" strokeWidth={2} />
            </View>

            <Text className="text-2xl font-black tracking-tight text-zinc-950 text-center">
              Create Account
            </Text>
            <Text className="text-xs font-medium text-zinc-500 mt-1 text-center">
              Start tracking your personal wealth effortlessly
            </Text>
          </View>

          {/* Form Container Card */}
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
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
                  placeholder="John Doe"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="words"
                  className="flex-1 ml-3 text-sm font-medium text-zinc-900"
                />
              </View>
            </View>

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
              <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5">
                Password
              </Text>
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
                  placeholder="At least 6 characters"
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
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.replace('/(auth)/login');
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-bold text-zinc-900 underline">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Footer */}
          <View className="items-center mt-6">
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
