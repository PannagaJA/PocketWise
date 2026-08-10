import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appLockService } from '../lib/security/app-lock.service';
import { deepLinkService } from '../lib/notifications/deep-link.service';
import { Lock, Fingerprint, Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface AppLockGateProps {
  children: React.ReactNode;
}

export function AppLockGate({ children }: AppLockGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    checkAppLockState();
  }, []);

  const checkAppLockState = async () => {
    const enabled = await appLockService.isAppLockEnabled();
    if (enabled) {
      setIsLocked(true);
      deepLinkService.setLockedState(true);

      const bioEnabled = await appLockService.isBiometricsEnabled();
      if (bioEnabled) {
        setBiometricsAvailable(true);
        triggerBiometricUnlock();
      }
    } else {
      setIsLocked(false);
      deepLinkService.setLockedState(false);
    }
  };

  const triggerBiometricUnlock = async () => {
    const success = await appLockService.authenticateBiometrics();
    if (success) {
      handleUnlockSuccess();
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      setErrorMessage('');

      if (nextPin.length === 4) {
        verifyPinSubmission(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (pinInput.length > 0) {
      setPinInput(pinInput.slice(0, -1));
      setErrorMessage('');
    }
  };

  const verifyPinSubmission = async (pinToTest: string) => {
    const isValid = await appLockService.verifyPin(pinToTest);
    if (isValid) {
      handleUnlockSuccess();
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        // Ignore haptics
      }
      setErrorMessage('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const handleUnlockSuccess = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignore haptics
    }
    setIsLocked(false);
    setPinInput('');
    setErrorMessage('');
    deepLinkService.setLockedState(false);
  };

  return (
    <>
      {children}
      <Modal visible={isLocked} animationType="fade" transparent={false}>
        <SafeAreaView className="flex-1 bg-zinc-900 justify-between p-6">
          {/* Header */}
          <View className="items-center pt-8">
            <View className="w-16 h-16 rounded-3xl bg-zinc-800 border border-zinc-700 items-center justify-center mb-4">
              <Lock size={32} color="#6366F1" />
            </View>
            <Text className="text-2xl font-black text-white">PocketWise Locked</Text>
            <Text className="text-xs text-zinc-400 mt-1">Enter PIN or use biometrics to unlock</Text>
          </View>

          {/* Dots & Error Message */}
          <View className="items-center">
            <View className="flex-row space-x-4 mb-4">
              {[0, 1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  className={`w-4 h-4 rounded-full border ${
                    pinInput.length > idx ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-600'
                  }`}
                />
              ))}
            </View>

            {errorMessage ? (
              <Text className="text-xs font-bold text-rose-400 mt-2">{errorMessage}</Text>
            ) : null}
          </View>

          {/* Keypad */}
          <View className="px-6 pb-6">
            <View className="flex-row justify-between mb-4">
              {['1', '2', '3'].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => handleKeyPress(num)}
                  className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-2xl font-bold text-white">{num}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row justify-between mb-4">
              {['4', '5', '6'].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => handleKeyPress(num)}
                  className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-2xl font-bold text-white">{num}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row justify-between mb-4">
              {['7', '8', '9'].map((num) => (
                <Pressable
                  key={num}
                  onPress={() => handleKeyPress(num)}
                  className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Text className="text-2xl font-bold text-white">{num}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row justify-between items-center">
              {biometricsAvailable ? (
                <Pressable
                  onPress={triggerBiometricUnlock}
                  className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
                >
                  <Fingerprint size={28} color="#6366F1" />
                </Pressable>
              ) : (
                <View className="w-20 h-20" />
              )}

              <Pressable
                onPress={() => handleKeyPress('0')}
                className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
              >
                <Text className="text-2xl font-bold text-white">0</Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center active:bg-zinc-700"
              >
                <Delete size={24} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
