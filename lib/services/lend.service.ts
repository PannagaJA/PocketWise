import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../notifications/notification.service';

export type LendStatus = 'active' | 'collected' | 'overdue';

export interface LendRecord {
  id: string;
  personName: string;
  amountMinor: number; // in paise (e.g. ₹500 = 50000)
  notes?: string;
  lentDate: string; // ISO date string
  dueDate: string; // ISO date string — when to collect
  status: LendStatus;
  notificationId?: string;
  createdAt: string;
  collectedAt?: string;
}

const STORAGE_KEY = 'pocketwise_lend_records_v1';

async function loadAll(): Promise<LendRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const records: LendRecord[] = JSON.parse(raw);
    // Auto-update overdue status on every load
    const now = new Date().toISOString().substring(0, 10);
    return records.map((r) => ({
      ...r,
      status:
        r.status === 'active' && r.dueDate < now ? 'overdue' : r.status,
    }));
  } catch {
    return [];
  }
}

async function saveAll(records: LendRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export const lendService = {
  async getAll(): Promise<LendRecord[]> {
    return loadAll();
  },

  async getActive(): Promise<LendRecord[]> {
    const all = await loadAll();
    return all.filter((r) => r.status === 'active' || r.status === 'overdue');
  },

  async getCollected(): Promise<LendRecord[]> {
    const all = await loadAll();
    return all.filter((r) => r.status === 'collected');
  },

  /**
   * Add a new lend record and schedule a local notification for the due date.
   */
  async createLend(params: {
    personName: string;
    amountMinor: number;
    notes?: string;
    lentDate: string;
    dueDate: string; // "YYYY-MM-DD"
  }): Promise<LendRecord> {
    const records = await loadAll();

    const id = `lend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const amountFormatted = `₹${(params.amountMinor / 100).toLocaleString('en-IN')}`;

    // Schedule local notification at 9 AM on due date
    let notificationId: string | undefined;
    try {
      // Build trigger date: dueDate at 09:00 local time
      const [year, month, day] = params.dueDate.split('-').map(Number);
      const triggerDate = new Date(year, month - 1, day, 9, 0, 0, 0);

      const notifId = await notificationService.scheduleDueDateReminder(
        id,
        `💸 Collect ${amountFormatted} from ${params.personName}`,
        `You lent ${amountFormatted} to ${params.personName}. Today is the due date — time to collect!`,
        triggerDate,
        'transaction'
      );
      notificationId = notifId ?? undefined;
    } catch (err) {
      console.warn('[LendService] Could not schedule notification:', err);
    }

    const record: LendRecord = {
      id,
      personName: params.personName.trim(),
      amountMinor: params.amountMinor,
      notes: params.notes?.trim() || undefined,
      lentDate: params.lentDate,
      dueDate: params.dueDate,
      status: 'active',
      notificationId,
      createdAt: new Date().toISOString(),
    };

    records.push(record);
    await saveAll(records);
    return record;
  },

  /**
   * Mark a lend as collected and cancel its pending notification.
   */
  async markCollected(id: string): Promise<void> {
    const records = await loadAll();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const record = records[idx];
    records[idx] = {
      ...record,
      status: 'collected',
      collectedAt: new Date().toISOString(),
    };

    // Cancel the scheduled notification
    if (record.notificationId) {
      try {
        await notificationService.cancelScheduledNotification(record.notificationId);
      } catch {}
    }

    await saveAll(records);
  },

  /**
   * Delete a lend record and cancel its notification.
   */
  async deleteLend(id: string): Promise<void> {
    const records = await loadAll();
    const record = records.find((r) => r.id === id);

    if (record?.notificationId) {
      try {
        await notificationService.cancelScheduledNotification(record.notificationId);
      } catch {}
    }

    await saveAll(records.filter((r) => r.id !== id));
  },

  /**
   * Update the due date of an existing lend and reschedule its notification.
   */
  async updateDueDate(id: string, newDueDate: string): Promise<void> {
    const records = await loadAll();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const record = records[idx];

    // Cancel old notification
    if (record.notificationId) {
      try {
        await notificationService.cancelScheduledNotification(record.notificationId);
      } catch {}
    }

    // Schedule new notification
    let notificationId: string | undefined;
    try {
      const amountFormatted = `₹${(record.amountMinor / 100).toLocaleString('en-IN')}`;
      const [year, month, day] = newDueDate.split('-').map(Number);
      const triggerDate = new Date(year, month - 1, day, 9, 0, 0, 0);

      const notifId = await notificationService.scheduleDueDateReminder(
        id,
        `💸 Collect ${amountFormatted} from ${record.personName}`,
        `You lent ${amountFormatted} to ${record.personName}. Today is the due date — time to collect!`,
        triggerDate,
        'transaction'
      );
      notificationId = notifId ?? undefined;
    } catch {}

    const now = new Date().toISOString().substring(0, 10);
    records[idx] = {
      ...record,
      dueDate: newDueDate,
      status: newDueDate < now ? 'overdue' : 'active',
      notificationId,
    };

    await saveAll(records);
  },
};
