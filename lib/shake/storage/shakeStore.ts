import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShakeSensitivity = 'low' | 'normal' | 'high';

export interface ShakeSettings {
  enabled: boolean;
  backgroundEnabled: boolean;
  sensitivity: ShakeSensitivity;
}

const STORAGE_KEYS = {
  SETTINGS: 'pocketwise_shake_settings_v1',
};

const DEFAULT_SETTINGS: ShakeSettings = {
  enabled: true,
  backgroundEnabled: true,
  sensitivity: 'normal',
};

export const shakeStorage = {
  async getSettings(): Promise<ShakeSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(partial: Partial<ShakeSettings>): Promise<ShakeSettings> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...partial };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
};
