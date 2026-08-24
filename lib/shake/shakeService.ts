import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { supabase } from '../supabase';
import { transactionService } from '../services/transaction.service';
import { accountService } from '../services/account.service';
import { categoryService } from '../services/category.service';
import { shakeStorage, ShakeSensitivity, ShakeSettings } from './storage/shakeStore';
import { useAppStore } from '../../store/useAppStore';

const { PocketWiseShakeModule } = NativeModules;

type ShakeCallback = () => void;

class ShakeService {
  private isInitialized = false;
  private shakeCallbacks: Set<ShakeCallback> = new Set();
  private isModalOpen = false;

  /**
   * Check if native Android shake module is available in the current runtime.
   */
  isNativeAvailable(): boolean {
    return Platform.OS === 'android' && !!PocketWiseShakeModule;
  }

  /**
   * Initialize Shake Service, event listeners, and user session sync.
   */
  async init(userId?: string): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!PocketWiseShakeModule) {
      console.warn('[ShakeService] PocketWiseShakeModule is not available in NativeModules.');
      return;
    }

    if (!this.isInitialized) {
      this.isInitialized = true;
      this.registerEventListeners();
    }

    // Load persisted settings
    const settings = await shakeStorage.getSettings();

    // Sync background preference to native SharedPreferences
    await this.setBackgroundEnabled(settings.backgroundEnabled);

    if (settings.enabled) {
      await this.startService();
    } else {
      await this.stopService();
    }

    if (settings.sensitivity) {
      await this.setSensitivity(settings.sensitivity);
    }

    if (userId) {
      await this.syncUserAndAccounts(userId);
    }
  }

  /**
   * Register native event listeners.
   */
  private registerEventListeners() {
    // 1. Shake detected while app is in foreground
    DeviceEventEmitter.addListener('onShakeDetected', () => {
      if (this.isModalOpen) return;
      this.shakeCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.warn('[ShakeService] Error in shake callback:', e);
        }
      });
    });

    // 2. Native QuickExpenseActivity submitted an expense -> execute via single source of truth
    DeviceEventEmitter.addListener('onQuickExpenseSubmitted', async (event: any) => {
      if (!event || !event.amount_minor || !event.description) return;

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) {
          console.warn('[ShakeService] Cannot save expense: No authenticated user session');
          return;
        }

        const dateStr = event.date || new Date().toISOString().split('T')[0];

        // Call the central transaction creation service
        await transactionService.createTransaction({
          user_id: userId,
          account_id: event.account_id,
          type: 'expense',
          amount_minor: Math.round(event.amount_minor),
          currency: 'INR',
          category_id: event.category_id || undefined,
          description: event.description,
          date: dateStr,
        });

        console.log('[ShakeService] Successfully created transaction via transactionService:', event.id);
      } catch (err) {
        console.error('[ShakeService] Failed to create transaction from native submission:', err);
      }
    });

    // 3. Native direct Supabase REST created an expense in background -> sync store
    DeviceEventEmitter.addListener('onQuickExpenseCreated', (tx: any) => {
      if (!tx) return;
      try {
        const store = useAppStore.getState();
        const account = store.accounts.find((a) => a.id === tx.account_id);
        store.addTransaction({
          id: tx.id || `tx_${Date.now()}`,
          account_id: tx.account_id,
          account_name: account?.name || 'Account',
          type: 'expense',
          amount: Math.round(tx.amount_minor),
          currency: tx.currency || 'INR',
          description: tx.description || 'Quick Expense',
          date: tx.date || new Date().toISOString().split('T')[0],
        });
      } catch (e) {
        console.warn('[ShakeService] Error syncing background created expense:', e);
      }
    });
  }

  /**
   * Subscribe to in-app shake events to open the React Native modal.
   */
  subscribeToShake(callback: ShakeCallback): () => void {
    this.shakeCallbacks.add(callback);
    return () => {
      this.shakeCallbacks.delete(callback);
    };
  }

  setModalOpen(open: boolean) {
    this.isModalOpen = open;
  }

  /**
   * Sync active user session, accounts, and categories to native SharedPreferences.
   */
  async syncUserAndAccounts(userId: string): Promise<void> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.syncUserData) {
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

      const [accounts, categories] = await Promise.all([
        accountService.getAccounts(userId).catch(() => []),
        categoryService.getCategories(userId).catch(() => []),
      ]);

      await PocketWiseShakeModule.syncUserData(
        userId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        JSON.stringify(accounts),
        JSON.stringify(categories)
      );

      console.log(`[ShakeService] Synced user session, ${accounts.length} accounts & ${categories.length} categories to native layer`);
    } catch (error) {
      console.warn('[ShakeService] Error syncing user session to native:', error);
    }
  }

  /**
   * Clear user session from native SharedPreferences on logout.
   */
  async clearUserSession(): Promise<void> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.clearUserData) {
      return;
    }
    try {
      await this.stopService();
      await PocketWiseShakeModule.clearUserData();
      console.log('[ShakeService] Cleared native cached user session.');
    } catch (error) {
      console.warn('[ShakeService] Error clearing native session:', error);
    }
  }

  /**
   * Start background shake detection service.
   */
  async startService(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!PocketWiseShakeModule?.startShakeService) {
      console.warn('[ShakeService] startService unavailable: PocketWiseShakeModule is not registered');
      return false;
    }
    try {
      const result = await PocketWiseShakeModule.startShakeService();
      console.log('[ShakeService] Native shake service started:', result);
      return Boolean(result);
    } catch (e) {
      console.warn('[ShakeService] Error starting service:', e);
      return false;
    }
  }

  /**
   * Stop background shake detection service.
   */
  async stopService(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!PocketWiseShakeModule?.stopShakeService) {
      console.warn('[ShakeService] stopService unavailable: PocketWiseShakeModule is not registered');
      return false;
    }
    try {
      const result = await PocketWiseShakeModule.stopShakeService();
      console.log('[ShakeService] Native shake service stopped:', result);
      return Boolean(result);
    } catch (e) {
      console.warn('[ShakeService] Error stopping service:', e);
      return false;
    }
  }

  /**
   * Check if shake detection service is currently running.
   */
  async isServiceRunning(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.isShakeServiceRunning) {
      return false;
    }
    try {
      return await PocketWiseShakeModule.isShakeServiceRunning();
    } catch {
      return false;
    }
  }

  /**
   * Set background shake detection enabled in native layer.
   */
  async setBackgroundEnabled(enabled: boolean): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.setBackgroundShakeEnabled) {
      return false;
    }
    try {
      await PocketWiseShakeModule.setBackgroundShakeEnabled(enabled);
      return true;
    } catch (e) {
      console.warn('[ShakeService] Error setting background enabled:', e);
      return false;
    }
  }

  /**
   * Update shake sensitivity (LOW, NORMAL, HIGH).
   */
  async setSensitivity(sensitivity: ShakeSensitivity): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.setShakeSensitivity) {
      return false;
    }
    try {
      await shakeStorage.saveSettings({ sensitivity });
      return await PocketWiseShakeModule.setShakeSensitivity(sensitivity.toUpperCase());
    } catch (e) {
      console.warn('[ShakeService] Error setting sensitivity:', e);
      return false;
    }
  }

  /**
   * Check if SYSTEM_ALERT_WINDOW (display over other apps) permission is granted.
   * Returns false if not on Android or if permission is not granted.
   */
  async checkOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    if (!PocketWiseShakeModule?.checkOverlayPermission) {
      console.warn('[ShakeService] checkOverlayPermission unavailable: PocketWiseShakeModule is not registered');
      return false;
    }
    try {
      const granted = await PocketWiseShakeModule.checkOverlayPermission();
      return Boolean(granted);
    } catch {
      return false;
    }
  }

  /**
   * Open Android Display Over Other Apps settings screen.
   */
  async requestOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.requestOverlayPermission) {
      return false;
    }
    try {
      return await PocketWiseShakeModule.requestOverlayPermission();
    } catch (e) {
      console.warn('[ShakeService] Error requesting overlay permission:', e);
      return false;
    }
  }

  /**
   * Simulate a shake event for testing.
   */
  async simulateShake(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseShakeModule?.simulateShake) {
      // In web/dev mode, trigger callbacks directly
      this.shakeCallbacks.forEach((cb) => cb());
      return true;
    }
    try {
      return await PocketWiseShakeModule.simulateShake();
    } catch (e) {
      console.warn('[ShakeService] Error simulating shake:', e);
      return false;
    }
  }
}

export const shakeService = new ShakeService();

