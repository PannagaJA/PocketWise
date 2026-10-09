import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

export type OutboxMutationType =
  | 'CREATE_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'CREATE_LEND'
  | 'CREATE_BILL';

export interface OutboxMutation {
  id: string;
  type: OutboxMutationType;
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const OUTBOX_STORAGE_KEY = 'POCKETWISE_MUTATION_OUTBOX_V1';
const DEAD_LETTER_STORAGE_KEY = 'POCKETWISE_MUTATION_DEAD_LETTER_V1';

let opLock: Promise<any> = Promise.resolve();
function runWithLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = opLock.then(fn, fn);
  opLock = next;
  return next;
}

let isProcessing = false;

export const outboxService = {
  async getPendingMutations(): Promise<OutboxMutation[]> {
    try {
      const raw = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async getDeadLetterMutations(): Promise<OutboxMutation[]> {
    try {
      const raw = await AsyncStorage.getItem(DEAD_LETTER_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async enqueueMutation(type: OutboxMutationType, payload: any): Promise<OutboxMutation> {
    return runWithLock(async () => {
      const queue = await this.getPendingMutations();
      const mutation: OutboxMutation = {
        id: `outbox_mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };

      queue.push(mutation);
      await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
      return mutation;
    });
  },

  async removeMutation(id: string): Promise<void> {
    return runWithLock(async () => {
      const queue = await this.getPendingMutations();
      const filtered = queue.filter((m) => m.id !== id);
      await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(filtered));
    });
  },

  async clearOutbox(): Promise<void> {
    return runWithLock(async () => {
      await AsyncStorage.removeItem(OUTBOX_STORAGE_KEY);
    });
  },

  /**
   * Process all queued offline mutations in FIFO order.
   */
  async processOutbox(onSyncSuccess?: () => void): Promise<{ processed: number; succeeded: number }> {
    if (isProcessing) {
      return { processed: 0, succeeded: 0 };
    }

    isProcessing = true;
    let succeededCount = 0;
    let processedCount = 0;

    try {
      const initialQueue = await this.getPendingMutations();
      if (initialQueue.length === 0) {
        return { processed: 0, succeeded: 0 };
      }

      const remainingQueue: OutboxMutation[] = [];
      const existingDeadLetter = await this.getDeadLetterMutations();
      const deadLetterMap = new Map(existingDeadLetter.map((m) => [m.id, m]));

      for (const item of initialQueue) {
        processedCount++;
        let success = false;
        let errorMessage: string | undefined;

        try {
          switch (item.type) {
            case 'CREATE_TRANSACTION': {
              const { transferDestinationAccountId, transferDestinationTxId, ...txData } = item.payload;
              if (txData.type === 'transfer' && transferDestinationAccountId) {
                const transferGroupId = txData.transfer_group_id || item.payload.transfer_group_id || crypto.randomUUID();
                const destTxId = transferDestinationTxId || item.payload.transferDestinationTxId || crypto.randomUUID();
                // Ensure IDs are preserved in payload for subsequent retries if an error happens
                item.payload.transfer_group_id = transferGroupId;
                item.payload.transferDestinationTxId = destTxId;

                const sourceRow = {
                  ...txData,
                  type: 'transfer',
                  transfer_group_id: transferGroupId,
                };
                const destRow = {
                  ...txData,
                  id: destTxId,
                  account_id: transferDestinationAccountId,
                  type: 'income',
                  transfer_group_id: transferGroupId,
                };

                const { error } = await supabase
                  .from('transactions')
                  .upsert([sourceRow, destRow], { onConflict: 'id' });

                if (!error) {
                  success = true;
                } else {
                  errorMessage = error.message;
                }
              } else {
                const { error } = await supabase
                  .from('transactions')
                  .upsert(txData, { onConflict: 'id' });
                if (!error) success = true;
                else errorMessage = error.message;
              }
              break;
            }
            case 'UPDATE_TRANSACTION': {
              const { id, updates } = item.payload;
              const { error } = await supabase
                .from('transactions')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);
              if (!error) success = true;
              else errorMessage = error?.message;
              break;
            }
            case 'DELETE_TRANSACTION': {
              const { id, softDelete } = item.payload;
              if (softDelete) {
                const { error } = await supabase
                  .from('transactions')
                  .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq('id', id);
                if (!error) success = true;
                else errorMessage = error?.message;
              } else {
                const { error } = await supabase
                  .from('transactions')
                  .delete()
                  .eq('id', id);
                if (!error) success = true;
                else errorMessage = error?.message;
              }
              break;
            }
            case 'CREATE_LEND': {
              const { error } = await supabase
                .from('lends')
                .upsert(item.payload, { onConflict: 'id' });
              if (!error) success = true;
              else errorMessage = error?.message;
              break;
            }
            case 'CREATE_BILL': {
              const { error } = await supabase
                .from('bills')
                .upsert(item.payload, { onConflict: 'id' });
              if (!error) success = true;
              else errorMessage = error?.message;
              break;
            }
          }
        } catch (execErr: any) {
          errorMessage = execErr?.message || String(execErr);
        }

        if (success) {
          succeededCount++;
        } else {
          item.attempts += 1;
          item.lastError = errorMessage;
          if (item.attempts <= 5) {
            remainingQueue.push(item);
          } else {
            deadLetterMap.set(item.id, item);
          }
        }
      }

      await runWithLock(async () => {
        // 1. Persist dead-letter items FIRST before removing from pending queue
        const deadLetterQueue = Array.from(deadLetterMap.values());
        if (deadLetterQueue.length > 0) {
          await AsyncStorage.setItem(
            DEAD_LETTER_STORAGE_KEY,
            JSON.stringify(deadLetterQueue)
          );
        }

        // 2. Reconcile remainingQueue with currentStored
        const currentStored = await this.getPendingMutations();
        const currentStoredIds = new Set(currentStored.map((m) => m.id));
        const initialIds = new Set(initialQueue.map((m) => m.id));

        // Retain remainingQueue items only if they are still present in currentStored (not cleared by clearOutbox)
        const validRemaining = remainingQueue.filter((m) => currentStoredIds.has(m.id));

        // Newly added mutations that were enqueued while processing
        const newlyAdded = currentStored.filter((m) => !initialIds.has(m.id));

        await AsyncStorage.setItem(
          OUTBOX_STORAGE_KEY,
          JSON.stringify([...validRemaining, ...newlyAdded])
        );
      });

      if (succeededCount > 0 && onSyncSuccess) {
        onSyncSuccess();
      }
    } finally {
      isProcessing = false;
    }

    return { processed: processedCount, succeeded: succeededCount };
  },
};

