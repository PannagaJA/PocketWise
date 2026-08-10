import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { Wallet } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-6">
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-3xl bg-zinc-900 items-center justify-center mb-3 shadow-sm">
          <Wallet size={32} color="#FFFFFF" />
        </View>
        <Text className="text-3xl font-black text-zinc-900">PocketWise</Text>
        <Text className="text-sm text-zinc-500 mt-1">Sign in to manage your finances</Text>
      </View>

      <Card className="p-6 bg-white border border-zinc-200 shadow-sm mb-4">
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
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          variant="primary"
          size="lg"
          loading={loading}
          className="mt-2"
          onPress={handleLogin}
        >
          <Text className="text-white font-bold">Sign In</Text>
        </Button>
      </Card>

      <View className="flex-row justify-center items-center mt-4">
        <Text className="text-sm text-zinc-500">Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text className="text-sm font-bold text-zinc-900">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
