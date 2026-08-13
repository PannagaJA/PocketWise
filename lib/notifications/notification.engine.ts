import { notificationService, NotificationCategory } from './notification.service';

export interface NotificationPreferenceState {
  allNotifications: boolean;
  transactions: boolean;
  bills: boolean;
  subscriptions: boolean;
  budgets: boolean;
  savings: boolean;
  analytics: boolean;
  summaries: boolean;
  reminders: boolean;
  unusualSpending: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string;   // e.g. "07:00"
  largeTransactionThreshold: number; // e.g. 1000000 (Rs 10,000 in minor units)
}

const PREF_STORAGE_KEY = 'pocketwise_notification_preferences';
const EVENT_HISTORY_KEY = 'pocketwise_notification_event_history';

export const DEFAULT_PREFERENCES: NotificationPreferenceState = {
  allNotifications: true,
  transactions: true,
  bills: true,
  subscriptions: true,
  budgets: true,
  savings: true,
  analytics: true,
  summaries: false,
  reminders: true,
  unusualSpending: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  largeTransactionThreshold: 1000000, // Rs 10,000.00
};

interface EventRecord {
  eventId: string;
  category: NotificationCategory;
  sentAt: number;
}

class NotificationEngine {
  private preferences: NotificationPreferenceState = { ...DEFAULT_PREFERENCES };
  private sentEventIds = new Set<string>();
  private isLoaded = false;

  async init(): Promise<void> {
    if (this.isLoaded) return;
    await this.loadPreferences();
    await this.loadEventHistory();
    this.isLoaded = true;
  }

  async getPreferences(): Promise<NotificationPreferenceState> {
    await this.init();
    return { ...this.preferences };
  }

  async savePreferences(newPrefs: Partial<NotificationPreferenceState>): Promise<NotificationPreferenceState> {
    await this.init();
    this.preferences = { ...this.preferences, ...newPrefs };
    try {
      const storage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
      await storage.setItem(PREF_STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      // Fallback in-memory
    }
    return { ...this.preferences };
  }

  private async loadPreferences(): Promise<void> {
    try {
      const storage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
      const raw = await storage.getItem(PREF_STORAGE_KEY);
      if (raw) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
      }
    } catch {
      this.preferences = { ...DEFAULT_PREFERENCES };
    }
  }

  private async loadEventHistory(): Promise<void> {
    try {
      const storage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
      const raw = await storage.getItem(EVENT_HISTORY_KEY);
      if (raw) {
        const records: EventRecord[] = JSON.parse(raw);
        const now = Date.now();
        // Keep events sent within last 14 days for deduplication
        const valid = records.filter((r) => now - r.sentAt < 14 * 24 * 60 * 60 * 1000);
        valid.forEach((r) => this.sentEventIds.add(r.eventId));
      }
    } catch {
      // In-memory set fallback
    }
  }

  private async markEventSent(eventId: string, category: NotificationCategory): Promise<void> {
    this.sentEventIds.add(eventId);
    try {
      const storage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
      const raw = await storage.getItem(EVENT_HISTORY_KEY);
      const records: EventRecord[] = raw ? JSON.parse(raw) : [];
      records.push({ eventId, category, sentAt: Date.now() });
      // Retain last 200 events
      const trimmed = records.slice(-200);
      await storage.setItem(EVENT_HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      // Silent catch
    }
  }

  public isCategoryEnabled(category: NotificationCategory): boolean {
    if (!this.preferences.allNotifications) return false;

    switch (category) {
      case 'transaction':
      case 'income':
      case 'expense':
      case 'large_transaction':
        return this.preferences.transactions;
      case 'bill':
        return this.preferences.bills;
      case 'subscription':
        return this.preferences.subscriptions;
      case 'budget':
      case 'budget_exceeded':
        return this.preferences.budgets;
      case 'savings':
      case 'savings_completed':
        return this.preferences.savings;
      case 'analytics':
      case 'unusual_spending':
        return this.preferences.analytics || this.preferences.unusualSpending;
      case 'summary':
        return this.preferences.summaries;
      case 'reminder':
      case 'system':
      default:
        return this.preferences.reminders;
    }
  }

  public isQuietHoursActive(): boolean {
    if (!this.preferences.quietHoursEnabled) return false;
    try {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = this.preferences.quietHoursStart.split(':').map(Number);
      const [endH, endM] = this.preferences.quietHoursEnd.split(':').map(Number);

      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      if (startMin < endMin) {
        return currentMin >= startMin && currentMin < endMin;
      } else {
        // Overnight quiet hours e.g. 22:00 to 07:00
        return currentMin >= startMin || currentMin < endMin;
      }
    } catch {
      return false;
    }
  }

  /**
   * Centralized method to trigger or schedule a real Android System Notification with full deduplication & user preferences.
   */
  async notify(params: {
    eventId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    triggerDate?: Date | null;
    priority?: 'high' | 'medium' | 'low';
    data?: Record<string, any>;
  }): Promise<string | null> {
    await this.init();

    const { eventId, category, title, body, triggerDate, priority = 'medium', data = {} } = params;

    // 1. Preference Check
    if (!this.isCategoryEnabled(category)) {
      console.log(`[NotificationEngine] Suppressed event ${eventId}: Category '${category}' is disabled in user preferences.`);
      return null;
    }

    // 2. Quiet Hours Check (for non-HIGH priority alerts)
    if (priority !== 'high' && this.isQuietHoursActive()) {
      console.log(`[NotificationEngine] Suppressed event ${eventId}: Quiet Hours active.`);
      return null;
    }

    // 3. Persistent Event Deduplication (Synchronous lock to prevent concurrent races)
    if (this.sentEventIds.has(eventId)) {
      console.log(`[NotificationEngine] Duplicate event ${eventId} suppressed.`);
      return null;
    }
    this.sentEventIds.add(eventId);

    // 4. Send/Schedule via Native Notification Service
    const payload = {
      id: eventId,
      category,
      title,
      body,
      triggerDate: triggerDate || null,
      priority,
      data: { ...data, category, eventId },
    };

    let resultId: string | null = null;
    if (triggerDate) {
      resultId = await notificationService.scheduleDueDateReminder(
        eventId,
        title,
        body,
        triggerDate,
        category === 'subscription' ? 'subscription' : category === 'bill' ? 'bill' : 'transaction'
      );
    } else {
      resultId = await notificationService.sendSystemAlert(payload);
    }

    if (resultId) {
      await this.markEventSent(eventId, category);
    } else {
      // Revert in-memory mark if scheduling failed completely
      this.sentEventIds.delete(eventId);
    }

    return resultId;
  }
}

export const notificationEngine = new NotificationEngine();
