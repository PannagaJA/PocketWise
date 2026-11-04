import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, AppState, AppStateStatus, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appLockService } from '../lib/security/app-lock.service';
import { deepLinkService } from '../lib/notifications/deep-link.service';
import { ShieldCheck, Fingerprint, Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export const AppLockContext = React.createContext<{ isLocked: boolean }>({ isLocked: false });
export const useAppLock = () => React.useContext(AppLockContext);

interface AppLockGateProps {
  children: React.ReactNode;
}

export function AppLockGate({ children }: AppLockGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const backgroundTimestampRef = useRef<number | null>(null);
  const isAuthenticatingRef = useRef(false);
  const lockEnabledRef = useRef(false);
  const lockTimeoutRef = useRef(30);

  useEffect(() => {
    checkAppLockState();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Intercept Android hardware back button cleanly while app is locked
  useEffect(() => {
    if (!isLocked) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => {
      backHandler.remove();
    };
  }, [isLocked]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Do not count biometric prompt system dialog or system picker appearance as app background
      if (isAuthenticatingRef.current || appLockService.isSystemPickerActive()) return;
      if (backgroundTimestampRef.current === null) {
        backgroundTimestampRef.current = Date.now();
      }
      // If immediate lock is configured (timeout = 0), lock immediately upon leaving
      if (lockEnabledRef.current && lockTimeoutRef.current === 0) {
        setIsLocked(true);
        deepLinkService.setLockedState(true);
      }
    } else if (nextAppState === 'active') {
      if (appLockService.isSystemPickerActive()) {
        backgroundTimestampRef.current = null;
        return;
      }
      if (backgroundTimestampRef.current !== null) {
        const elapsed = (Date.now() - backgroundTimestampRef.current) / 1000;
        // Fast-path synchronous lock check to prevent any flash of dashboard or dialogs
        if (lockEnabledRef.current && (lockTimeoutRef.current === 0 || (lockTimeoutRef.current > 0 && elapsed >= lockTimeoutRef.current))) {
          setIsLocked(true);
          deepLinkService.setLockedState(true);
        }

        const needsRelock = await appLockService.shouldRelock(backgroundTimestampRef.current);
        if (needsRelock) {
          setIsLocked(true);
          deepLinkService.setLockedState(true);
          const bioEnabled = await appLockService.isBiometricsEnabled();
          if (bioEnabled) {
            setBiometricsAvailable(true);
            setTimeout(() => {
              triggerBiometricUnlock();
            }, 300);
          }
        }
        backgroundTimestampRef.current = null;
      }
    }
  };

  const checkAppLockState = async () => {
    const enabled = await appLockService.isAppLockEnabled();
    const timeout = await appLockService.getLockTimeout();
    lockEnabledRef.current = enabled;
    lockTimeoutRef.current = timeout;

    if (enabled) {
      setIsLocked(true);
      deepLinkService.setLockedState(true);

      const bioEnabled = await appLockService.isBiometricsEnabled();
      if (bioEnabled) {
        setBiometricsAvailable(true);
        setTimeout(() => {
          triggerBiometricUnlock();
        }, 300);
      }
    } else {
      setIsLocked(false);
      deepLinkService.setLockedState(false);
    }
  };

  const triggerBiometricUnlock = async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    try {
      const success = await appLockService.authenticateBiometrics();
      if (success) {
        handleUnlockSuccess();
      }
    } finally {
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 500);
    }
  };


  const handleKeyPress = (num: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

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
      } catch {}
      setErrorMessage('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const handleUnlockSuccess = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setIsLocked(false);
    setPinInput('');
    setErrorMessage('');
    deepLinkService.setLockedState(false);
  };

  return (
    <AppLockContext.Provider value={{ isLocked }}>
      {children}
      {isLocked && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]} className="flex-1 bg-white">
          <SafeAreaView className="flex-1 bg-white justify-between px-6 py-8">
              {/* Header */}
              <View className="items-center pt-6">
                <View className="w-18 h-18 rounded-3xl bg-indigo-50 border border-indigo-100 items-center justify-center mb-5 p-4">
                  <ShieldCheck size={36} color="#6366F1" />
                </View>
                <Text className="text-2xl font-black text-zinc-900 tracking-tight">PocketWise Security</Text>
                <Text className="text-xs font-semibold text-zinc-500 mt-1">Enter your 4-digit security PIN</Text>
              </View>

              {/* Dots Indicator & Error Message */}
              <View className="items-center my-auto">
                <View className="flex-row gap-5 mb-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <View
                      key={idx}
                      className={`w-4 h-4 rounded-full ${
                        pinInput.length > idx
                          ? 'bg-zinc-900 shadow-md shadow-zinc-900/30 scale-110'
                          : 'bg-zinc-100 border border-zinc-300'
                      }`}
                    />
                  ))}
                </View>

                {errorMessage ? (
                  <View className="bg-rose-50 border border-rose-200 px-4 py-1.5 rounded-full mt-2">
                    <Text className="text-xs font-bold text-rose-600">{errorMessage}</Text>
                  </View>
                ) : null}
              </View>

              {/* Keypad */}
              <View className="w-full max-w-xs mx-auto pb-4">
                <View className="flex-row justify-between mb-5">
                  {['1', '2', '3'].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => handleKeyPress(num)}
                      className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 items-center justify-center active:bg-zinc-200"
                    >
                      <Text className="text-2xl font-extrabold text-zinc-900">{num}</Text>
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row justify-between mb-5">
                  {['4', '5', '6'].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => handleKeyPress(num)}
                      className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 items-center justify-center active:bg-zinc-200"
                    >
                      <Text className="text-2xl font-extrabold text-zinc-900">{num}</Text>
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row justify-between mb-5">
                  {['7', '8', '9'].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => handleKeyPress(num)}
                      className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 items-center justify-center active:bg-zinc-200"
                    >
                      <Text className="text-2xl font-extrabold text-zinc-900">{num}</Text>
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row justify-between items-center">
                  {biometricsAvailable ? (
                    <Pressable
                      onPress={triggerBiometricUnlock}
                      className="w-20 h-20 rounded-full bg-indigo-50 border border-indigo-200 items-center justify-center active:bg-indigo-100"
                    >
                      <Fingerprint size={28} color="#6366F1" />
                    </Pressable>
                  ) : (
                    <View className="w-20 h-20" />
                  )}

                  <Pressable
                    onPress={() => handleKeyPress('0')}
                    className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 items-center justify-center active:bg-zinc-200"
                  >
                    <Text className="text-2xl font-extrabold text-zinc-900">0</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleDelete}
                    className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-200 items-center justify-center active:bg-zinc-200"
                  >
                    <Delete size={24} color="#71717A" />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
        </View>
      )}
    </AppLockContext.Provider>
  );
}
