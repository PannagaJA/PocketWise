import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { supabase } from '../supabase';
import { transactionService } from '../services/transaction.service';
import { accountService } from '../services/account.service';
import { categoryService } from '../services/category.service';
import { shakeStorage, ShakeSensitivity } from './storage/shakeStore';
import { useAppStore } from '../../store/useAppStore';

type ShakeCallback = () => void;

export interface ShakeDiagnostics {
  isAndroid: boolean;
  moduleAvailable: boolean;
  moduleName: string;
  registeredModules: string[];
  hasPocketWiseShakeModule: boolean;
  overlayCheckCallable: boolean;
  requestOverlayCallable: boolean;
  startServiceCallable: boolean;
  stopServiceCallable: boolean;
  isServiceRunningCallable: boolean;
  simulateShakeCallable: boolean;
  setSensitivityCallable: boolean;
  setBackgroundCallable: boolean;
}

class ShakeService {
  private isInitialized = false;
  private shakeCallbacks: Set<ShakeCallback> = new Set();
  private isModalOpen = false;

  /**
   * Dynamically fetch PocketWiseShakeModule from NativeModules.
   * This ensures runtime availability is always fresh and avoids stale undefined bindings.
   */
  get nativeModule(): any {
    return NativeModules?.PocketWiseShakeModule ?? null;
  }

  /**
   * Check if native Android shake module is available in the current runtime.
   */
  isNativeAvailable(): boolean {
    return Platform.OS === 'android' && !!this.nativeModule;
  }

  /**
   * Diagnostic snapshot for UI and runtime bridge debugging.
   */
  getDiagnostics(): ShakeDiagnostics {
    const mod = this.nativeModule;
    const allModules = Object.keys(NativeModules || {});
    return {
      isAndroid: Platform.OS === 'android',
      moduleAvailable: Boolean(mod),
      moduleName: 'PocketWiseShakeModule',
      registeredModules: allModules,
      hasPocketWiseShakeModule: allModules.includes('PocketWiseShakeModule'),
      overlayCheckCallable: typeof mod?.checkOverlayPermission === 'function',
      requestOverlayCallable: typeof mod?.requestOverlayPermission === 'function',
      startServiceCallable: typeof mod?.startShakeService === 'function',
      stopServiceCallable: typeof mod?.stopShakeService === 'function',
      isServiceRunningCallable: typeof mod?.isShakeServiceRunning === 'function',
      simulateShakeCallable: typeof mod?.simulateShake === 'function',
      setSensitivityCallable: typeof mod?.setShakeSensitivity === 'function',
      setBackgroundCallable: typeof mod?.setBackgroundShakeEnabled === 'function',
    };
  }

  /**
   * Initialize Shake Service, event listeners, and user session sync.
   */
  async init(userId?: string): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    const mod = this.nativeModule;
    if (!mod) {
      console.warn('[ShakeService] PocketWiseShakeModule is not available in NativeModules at init.');
      return;
    }

    if (!this.isInitialized) {
      this.isInitialized = true;
      this.registerEventListeners();
    }

    // Load persisted settings
    const settings = await shakeStorage.getSettings();

    // Sync background preference to native SharedPreferences
    await this.setBackgroundEnabled(settings.backgroundEnabled).catch(() => {});

    if (settings.enabled) {
      await this.startService().catch((err) => {
        console.warn('[ShakeService] Failed to auto-start service during init:', err);
      });
    } else {
      await this.stopService().catch(() => {});
    }

    if (settings.sensitivity) {
      await this.setSensitivity(settings.sensitivity).catch(() => {});
    }

    if (userId) {
      await this.syncUserAndAccounts(userId).catch(() => {});
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

    // 2. Native QuickExpenseActivity submitted an expense -> execute via central transaction service
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
    if (Platform.OS !== 'android') return;
    const mod = this.nativeModule;
    if (!mod || typeof mod.syncUserData !== 'function') return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

      const [accounts, categories] = await Promise.all([
        accountService.getAccounts(userId).catch(() => []),
        categoryService.getCategories(userId).catch(() => []),
      ]);

      await mod.syncUserData(
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
    if (Platform.OS !== 'android') return;
    const mod = this.nativeModule;
    if (!mod || typeof mod.clearUserData !== 'function') return;

    try {
      await this.stopService().catch(() => {});
      await mod.clearUserData();
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
    const mod = this.nativeModule;
    if (!mod || typeof mod.startShakeService !== 'function') {
      const errorMsg = 'startShakeService failed: PocketWiseShakeModule is not registered in NativeModules.';
      console.error('[ShakeService]', errorMsg);
      throw new Error(errorMsg);
    }
    try {
      const result = await mod.startShakeService();
      console.log('[ShakeService] Native shake service started:', result);
      return Boolean(result);
    } catch (e: any) {
      console.error('[ShakeService] Error starting native shake service:', e);
      throw e;
    }
  }

  /**
   * Stop background shake detection service.
   */
  async stopService(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const mod = this.nativeModule;
    if (!mod || typeof mod.stopShakeService !== 'function') {
      const errorMsg = 'stopShakeService failed: PocketWiseShakeModule is not registered in NativeModules.';
      console.error('[ShakeService]', errorMsg);
      throw new Error(errorMsg);
    }
    try {
      const result = await mod.stopShakeService();
      console.log('[ShakeService] Native shake service stopped:', result);
      return Boolean(result);
    } catch (e: any) {
      console.error('[ShakeService] Error stopping native shake service:', e);
      throw e;
    }
  }

  /**
   * Check if shake detection service is currently running.
   */
  async isServiceRunning(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const mod = this.nativeModule;
    if (!mod || typeof mod.isShakeServiceRunning !== 'function') {
      return false;
    }
    try {
      return await mod.isShakeServiceRunning();
    } catch {
      return false;
    }
  }

  /**
   * Set background shake detection enabled in native layer.
   */
  async setBackgroundEnabled(enabled: boolean): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const mod = this.nativeModule;
    if (!mod || typeof mod.setBackgroundShakeEnabled !== 'function') {
      return false;
    }
    try {
      await mod.setBackgroundShakeEnabled(enabled);
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
    await shakeStorage.saveSettings({ sensitivity });
    if (Platform.OS !== 'android') return true;
    const mod = this.nativeModule;
    if (!mod || typeof mod.setShakeSensitivity !== 'function') {
      return false;
    }
    try {
      return await mod.setShakeSensitivity(sensitivity.toUpperCase());
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
    const mod = this.nativeModule;
    if (!mod || typeof mod.checkOverlayPermission !== 'function') {
      console.warn('[ShakeService] checkOverlayPermission unavailable: PocketWiseShakeModule is not registered in NativeModules');
      return false;
    }
    try {
      const granted = await mod.checkOverlayPermission();
      return Boolean(granted);
    } catch (e) {
      console.error('[ShakeService] checkOverlayPermission error:', e);
      return false;
    }
  }

  /**
   * Open Android Display Over Other Apps settings screen.
   */
  async requestOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    const mod = this.nativeModule;
    if (!mod || typeof mod.requestOverlayPermission !== 'function') {
      const errorMsg = 'PocketWiseShakeModule is not registered in NativeModules. Registered modules: ' + Object.keys(NativeModules || {}).join(', ');
      console.error('[ShakeService] requestOverlayPermission failed:', errorMsg);
      throw new Error(errorMsg);
    }
    try {
      const result = await mod.requestOverlayPermission();
      return Boolean(result);
    } catch (e: any) {
      console.error('[ShakeService] Error requesting overlay permission:', e);
      throw e;
    }
  }

  /**
   * Simulate a shake event for testing.
   */
  async simulateShake(): Promise<boolean> {
    const mod = this.nativeModule;
    if (Platform.OS === 'android') {
      if (mod && typeof mod.simulateShake === 'function') {
        try {
          const result = await mod.simulateShake();
          return Boolean(result);
        } catch (e: any) {
          console.error('[ShakeService] Error in native simulateShake:', e);
          throw e;
        }
      } else {
        const errorMsg = 'simulateShake failed: PocketWiseShakeModule is not registered in NativeModules. Registered modules: ' + Object.keys(NativeModules || {}).join(', ');
        console.error('[ShakeService]', errorMsg);
        throw new Error(errorMsg);
      }
    }

    // Web / dev mode fallback
    this.shakeCallbacks.forEach((cb) => cb());
    return true;
  }
}

export const shakeService = new ShakeService();
