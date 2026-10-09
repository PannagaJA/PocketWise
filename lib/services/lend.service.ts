import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { notificationService } from '../notifications/notification.service';

export type LendStatus = 'active' | 'collected' | 'overdue';
export type LendType = 'lend' | 'borrow';

export interface LendRecord {
  id: string;
  user_id?: string;
  personName: string;
  amountMinor: number; // in paise (e.g. ₹500 = 50000)
  type?: LendType;
  notes?: string;
  lentDate: string; // ISO date string "YYYY-MM-DD"
  dueDate: string; // ISO date string — when to collect
  status: LendStatus;
  notificationId?: string;
  createdAt: string;
  collectedAt?: string;
}

const STORAGE_KEY = 'pocketwise_lend_records_v1';
let hasMigratedLocal = false;

function mapFromSupabase(row: any): LendRecord {
  const now = new Date().toISOString().substring(0, 10);
  const status: LendStatus =
    row.status === 'active' && row.due_date < now ? 'overdue' : row.status;

  return {
    id: row.id,
    user_id: row.user_id,
    personName: row.person_name,
    amountMinor: Number(row.amount_minor),
    type: row.type || 'lend',
    notes: row.notes || undefined,
    lentDate: row.lent_date,
    dueDate: row.due_date,
    status,
    notificationId: row.notification_id || undefined,
    createdAt: row.created_at,
    collectedAt: row.collected_at || undefined,
  };
}

async function loadLocal(): Promise<LendRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const records: LendRecord[] = JSON.parse(raw);
    const now = new Date().toISOString().substring(0, 10);
    return records.map((r) => ({
      ...r,
      status: r.status === 'active' && r.dueDate < now ? 'overdue' : r.status,
    }));
  } catch {
    return [];
  }
}

async function saveLocal(records: LendRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export const lendService = {
  /**
   * Migrate any legacy local AsyncStorage records into Supabase.
   */
  async migrateLocalToCloud(userId: string): Promise<void> {
    if (hasMigratedLocal || !userId) return;
    try {
      const localRecords = await loadLocal();
      if (localRecords.length === 0) {
        hasMigratedLocal = true;
        return;
      }

      for (const rec of localRecords) {
        const { error } = await supabase.from('lends').upsert({
          id: rec.id,
          user_id: userId,
          person_name: rec.personName,
          amount_minor: rec.amountMinor,
          type: rec.type || 'lend',
          lent_date: rec.lentDate,
          due_date: rec.dueDate,
          status: rec.status,
          notes: rec.notes || null,
          notification_id: rec.notificationId || null,
          collected_at: rec.collectedAt || null,
        });
        if (error) throw error;
      }

      // Clear local storage after successful migration
      await AsyncStorage.removeItem(STORAGE_KEY);
      hasMigratedLocal = true;
    } catch (err) {
      console.warn('[LendService] Cloud migration deferred:', err);
    }
  },

  async getAll(userId?: string): Promise<LendRecord[]> {
    if (!userId) {
      return loadLocal();
    }

    try {
      await this.migrateLocalToCloud(userId);

      const { data, error } = await supabase
        .from('lends')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      const cloudRecords = (data || []).map(mapFromSupabase);
      const localRecords = await loadLocal();

      const cloudIds = new Set(cloudRecords.map((r) => r.id));
      const unsyncedLocal = localRecords.filter((r) => !r.user_id && !cloudIds.has(r.id));
      const merged = [...cloudRecords, ...unsyncedLocal];

      await saveLocal(merged);
      return merged;
    } catch {
      return loadLocal();
    }
  },

  async getActive(userId?: string): Promise<LendRecord[]> {
    const all = await this.getAll(userId);
    return all.filter((r) => r.status === 'active' || r.status === 'overdue');
  },

  async getCollected(userId?: string): Promise<LendRecord[]> {
    const all = await this.getAll(userId);
    return all.filter((r) => r.status === 'collected');
  },

  /**
   * Add a new lend record and schedule a local notification for the due date.
   */
  async createLend(params: {
    userId?: string;
    personName: string;
    amountMinor: number;
    type?: LendType;
    notes?: string;
    lentDate: string;
    dueDate: string; // "YYYY-MM-DD"
  }): Promise<LendRecord> {
    const amountFormatted = `₹${(params.amountMinor / 100).toLocaleString('en-IN')}`;
    const actionVerb = params.type === 'borrow' ? 'Repay' : 'Collect';

    let notificationId: string | undefined;
    try {
      const [year, month, day] = params.dueDate.split('-').map(Number);
      const triggerDate = new Date(year, month - 1, day, 9, 0, 0, 0);

      const notifId = await notificationService.scheduleDueDateReminder(
        `lend_${Date.now()}`,
        `💸 ${actionVerb} ${amountFormatted} ${params.type === 'borrow' ? 'to' : 'from'} ${params.personName}`,
        `Today is the due date for ${params.personName} (${amountFormatted}) — time to settle!`,
        triggerDate,
        'transaction'
      );
      notificationId = notifId ?? undefined;
    } catch (err) {
      console.warn('[LendService] Could not schedule notification:', err);
    }

    if (params.userId) {
      const { data, error } = await supabase
        .from('lends')
        .insert({
          user_id: params.userId,
          person_name: params.personName.trim(),
          amount_minor: params.amountMinor,
          type: params.type || 'lend',
          notes: params.notes?.trim() || null,
          lent_date: params.lentDate,
          due_date: params.dueDate,
          status: 'active',
          notification_id: notificationId || null,
        })
        .select()
        .single();

      if (!error && data) {
        return mapFromSupabase(data);
      }
    }

    // Fallback local storage
    const localList = await loadLocal();
    const fallbackRecord: LendRecord = {
      id: `lend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: params.userId,
      personName: params.personName.trim(),
      amountMinor: params.amountMinor,
      type: params.type || 'lend',
      notes: params.notes?.trim() || undefined,
      lentDate: params.lentDate,
      dueDate: params.dueDate,
      status: 'active',
      notificationId,
      createdAt: new Date().toISOString(),
    };
    localList.push(fallbackRecord);
    await saveLocal(localList);
    return fallbackRecord;
  },

  /**
   * Mark a lend as collected / repaid.
   */
  async markCollected(id: string, userId?: string): Promise<void> {
    const now = new Date().toISOString();

    if (userId) {
      const { error } = await supabase
        .from('lends')
        .update({
          status: 'collected',
          collected_at: now,
          updated_at: now,
        })
        .eq('id', id);

      if (error) throw error;
    }

    const records = await loadLocal();
    const idx = records.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const record = records[idx];
      records[idx] = {
        ...record,
        status: 'collected',
        collectedAt: now,
      };
      if (record.notificationId) {
        try {
          await notificationService.cancelScheduledNotification(record.notificationId);
        } catch {}
      }
      await saveLocal(records);
    }
  },

  /**
   * Delete a lend record.
   */
  async deleteLend(id: string, userId?: string): Promise<void> {
    if (userId) {
      const { error } = await supabase.from('lends').delete().eq('id', id);
      if (error) throw error;
    }

    const records = await loadLocal();
    const record = records.find((r) => r.id === id);
    if (record?.notificationId) {
      try {
        await notificationService.cancelScheduledNotification(record.notificationId);
      } catch {}
    }
    await saveLocal(records.filter((r) => r.id !== id));
  },

  /**
   * Update the due date of an existing lend and reschedule its notification.
   */
  async updateDueDate(id: string, newDueDate: string, userId?: string): Promise<void> {
    const now = new Date().toISOString().substring(0, 10);
    const newStatus: LendStatus = newDueDate < now ? 'overdue' : 'active';

    if (userId) {
      const { error } = await supabase
        .from('lends')
        .update({
          due_date: newDueDate,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    }

    const records = await loadLocal();
    const idx = records.findIndex((r) => r.id === id);
    if (idx !== -1) {
      records[idx] = {
        ...records[idx],
        dueDate: newDueDate,
        status: newStatus,
      };
      await saveLocal(records);
    }
  },
};

