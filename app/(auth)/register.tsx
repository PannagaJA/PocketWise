import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { Wallet, ArrowLeft } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Registration Failed', error.message);
    } else if (data.session) {
      Alert.alert('Account Created', 'Welcome to PocketWise!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } else {
      Alert.alert(
        'Confirm Your Email',
        'A confirmation link has been sent to your email address. Please confirm your email to sign in, or disable "Confirm Email" in your Supabase Auth settings for instant sign-up during development.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-6">
      <TouchableOpacity
        onPress={() => router.back()}
        className="mb-6 flex-row items-center space-x-1"
      >
        <ArrowLeft size={20} color="#09090B" />
        <Text className="text-sm font-semibold text-zinc-900">Back to Sign In</Text>
      </TouchableOpacity>

      <View className="items-center mb-6">
        <View className="w-14 h-14 rounded-2xl bg-zinc-900 items-center justify-center mb-2 shadow-sm">
          <Wallet size={28} color="#FFFFFF" />
        </View>
        <Text className="text-2xl font-black text-zinc-900">Create Account</Text>
        <Text className="text-xs text-zinc-500 mt-0.5">Start tracking your personal wealth</Text>
      </View>

      <Card className="p-6 bg-white border border-zinc-200 shadow-sm">
        <Input
          label="Full Name"
          placeholder="John Doe"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Email"
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          placeholder="At least 6 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          variant="primary"
          size="lg"
          loading={loading}
          className="mt-2"
          onPress={handleRegister}
        >
          <Text className="text-white font-bold">Sign Up</Text>
        </Button>
      </Card>
    </SafeAreaView>
  );
}
