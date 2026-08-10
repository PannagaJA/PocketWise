import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_VERIFIER_KEY = 'pocketwise_pin_verifier';
const APP_LOCK_ENABLED_KEY = 'pocketwise_app_lock_enabled';
const BIOMETRICS_ENABLED_KEY = 'pocketwise_biometrics_enabled';

// Simple salt derivation helper for PIN verification
async function hashPin(pin: string): Promise<string> {
  let hash = 0;
  const salted = `pocketwise_salt_${pin}_secure`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

export const appLockService = {
  async isAppLockEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setAppLockEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  async isBiometricsEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setBiometricsEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  async setPin(pin: string): Promise<void> {
    const verifier = await hashPin(pin);
    await SecureStore.setItemAsync(PIN_VERIFIER_KEY, verifier);
    await this.setAppLockEnabled(true);
  },

  async verifyPin(pin: string): Promise<boolean> {
    try {
      const storedVerifier = await SecureStore.getItemAsync(PIN_VERIFIER_KEY);
      if (!storedVerifier) return false;
      const computed = await hashPin(pin);
      return storedVerifier === computed;
    } catch {
      return false;
    }
  },

  async hasPinSet(): Promise<boolean> {
    try {
      const stored = await SecureStore.getItemAsync(PIN_VERIFIER_KEY);
      return !!stored;
    } catch {
      return false;
    }
  },

  async clearPin(): Promise<void> {
    await SecureStore.deleteItemAsync(PIN_VERIFIER_KEY);
    await this.setAppLockEnabled(false);
    await this.setBiometricsEnabled(false);
  },

  async authenticateBiometrics(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PocketWise',
        fallbackLabel: 'Use PIN',
      });

      return result.success;
    } catch {
      return false;
    }
  },
};
