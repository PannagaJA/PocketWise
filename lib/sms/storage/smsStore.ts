import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountMapping, LearnedCategoryMapping, ParsedSmsTransaction, SmsTrackingSettings } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'pocketwise_sms_settings_v1',
  ACCOUNT_MAPPINGS: 'pocketwise_sms_account_mappings_v1',
  LEARNED_CATEGORIES: 'pocketwise_sms_learned_categories_v1',
  PENDING_REVIEWS: 'pocketwise_sms_pending_reviews_v1',
  PROCESSED_REF_IDS: 'pocketwise_sms_processed_refs_v1',
};

export const smsStorage = {
  // Settings
  async getSettings(): Promise<SmsTrackingSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore fallback
    }
    return {
      autoTrackingEnabled: false,
      permissionGranted: false,
      totalDetectedCount: 0,
    };
  },

  async saveSettings(settings: Partial<SmsTrackingSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  },

  // Account Mappings (e.g. XX1234 -> HDFC)
  async getAccountMappings(): Promise<AccountMapping[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_MAPPINGS);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return [];
  },

  async saveAccountMapping(mapping: AccountMapping): Promise<void> {
    const current = await this.getAccountMappings();
    const filtered = current.filter((m) => m.maskedAccount !== mapping.maskedAccount);
    filtered.push(mapping);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_MAPPINGS, JSON.stringify(filtered));
  },

  // Learned Categories (e.g., SWIGGY -> Food & Dining)
  async getLearnedCategories(): Promise<LearnedCategoryMapping[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LEARNED_CATEGORIES);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return [];
  },

  async saveLearnedCategory(merchantKey: string, categoryName: string): Promise<void> {
    const current = await this.getLearnedCategories();
    const upperKey = merchantKey.toUpperCase();
    const filtered = current.filter((lc) => lc.merchantKey !== upperKey);
    filtered.push({
      merchantKey: upperKey,
      categoryName,
      updatedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(STORAGE_KEYS.LEARNED_CATEGORIES, JSON.stringify(filtered));
  },

  // Pending Reviews Queue
  async getPendingReviews(): Promise<ParsedSmsTransaction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REVIEWS);
      if (data) return JSON.parse(data);
    } catch {
      // Ignore
    }
    return [];
  },

  async addPendingReview(tx: ParsedSmsTransaction): Promise<void> {
    const current = await this.getPendingReviews();
    current.unshift(tx);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REVIEWS, JSON.stringify(current));
  },

  async removePendingReview(sourceMessageId: string): Promise<void> {
    const current = await this.getPendingReviews();
    const filtered = current.filter((t) => t.sourceMessageId !== sourceMessageId);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REVIEWS, JSON.stringify(filtered));
  },

  // Increment Detected Count
  async incrementDetectedCount(): Promise<number> {
    const settings = await this.getSettings();
    const newCount = (settings.totalDetectedCount || 0) + 1;
    await this.saveSettings({ totalDetectedCount: newCount });
    return newCount;
  },
};
