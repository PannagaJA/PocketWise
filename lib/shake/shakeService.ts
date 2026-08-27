import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { supabase } from '../supabase';
import { transactionService } from '../services/transaction.service';
import { accountService } from '../services/account.service';
import { categoryService } from '../services/category.service';
import { shakeStorage, ShakeSensitivity } from './storage/shakeStore';

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

export interface SensorSelfTestResult {
  eventsReceived: number;
  durationMs: number;
  sensorAvailable: boolean;
  sensorName: string;
  sensorVendor: string;
  registrationSuccess: boolean;
  lastEventTimeMs: number;
}

export interface NativeServiceDiagnostics {
  serviceRunning: boolean;
  sensorAvailable: boolean;
  sensorListening: boolean;
  detectorActive: boolean;
  serviceEnabled: boolean;
  backgroundEnabled: boolean;
  sensitivity: string;
  linearThreshold?: number;
  gForceThreshold?: number;
  sensorEventsReceived: number;
  thresholdCrossings?: number;
  peaksDetected?: number;
  confirmedShakes?: number;
  lastSensorEventTimestamp: number;
  lastShakeTimestamp: number;
  shakeCount: number;
  popupActive: boolean;
  lastLinearMagnitude: number;
  maxLinearMagnitude?: number;
  lastGForce: number;
  maxGForce?: number;
  lastEventDeltaMs?: number;
  maxEventDeltaMs?: number;
  serviceInstanceId?: string;
  serviceStartCount?: number;
  serviceStartTimestamp?: number;
  sensorRegistrationTimestamp?: number;
  sensorRegistrationResult?: boolean;
  sensorName?: string;
  sensorVendor?: string;
  // Background popup & lifecycle telemetry
  backgroundShakeCallbacks?: number;
  popupLaunchAttempts?: number;
  popupLaunchSuccesses?: number;
  popupLaunchFailures?: number;
  lastPopupLaunchAttempt?: number;
  lastPopupLaunchSuccess?: number;
  lastPopupLaunchError?: string;
  popupOnCreate?: number;
  popupOnStart?: number;
  popupOnResume?: number;
  popupOnPause?: number;
  popupOnStop?: number;
  popupOnDestroy?: number;
  lastPopupOnCreateTimestamp?: number;
  lastPopupOnResumeTimestamp?: number;
  lastPopupOnDestroyTimestamp?: number;
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
      moduleAvailable: !!mod,
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
   * Query deep native service state (service running, sensor listening, detector active, telemetry).
   */
  async getNativeServiceDiagnostics(): Promise<NativeServiceDiagnostics | null> {
    if (!this.isNativeAvailable()) return null;
    const mod = this.nativeModule;
    if (typeof mod?.getServiceDiagnostics !== 'function') return null;
    try {
      const res = await mod.getServiceDiagnostics();
      return {
        serviceRunning: Boolean(res?.serviceRunning),
        sensorAvailable: Boolean(res?.sensorAvailable),
        sensorListening: Boolean(res?.sensorListening),
        detectorActive: Boolean(res?.detectorActive),
        serviceEnabled: Boolean(res?.serviceEnabled),
        backgroundEnabled: Boolean(res?.backgroundEnabled),
        sensitivity: String(res?.sensitivity || 'NORMAL'),
        linearThreshold: Number(res?.linearThreshold || 8.0),
        gForceThreshold: Number(res?.gForceThreshold || 1.50),
        sensorEventsReceived: Number(res?.sensorEventsReceived || 0),
        thresholdCrossings: Number(res?.thresholdCrossings || 0),
        peaksDetected: Number(res?.peaksDetected || 0),
        confirmedShakes: Number(res?.confirmedShakes || 0),
        lastSensorEventTimestamp: Number(res?.lastSensorEventTimestamp || 0),
        lastShakeTimestamp: Number(res?.lastShakeTimestamp || 0),
        shakeCount: Number(res?.shakeCount || res?.confirmedShakes || 0),
        popupActive: Boolean(res?.popupActive),
        lastLinearMagnitude: Number(res?.lastLinearMagnitude || 0),
        maxLinearMagnitude: Number(res?.maxLinearMagnitude || 0),
        lastGForce: Number(res?.lastGForce || 0),
        maxGForce: Number(res?.maxGForce || 0),
        lastEventDeltaMs: Number(res?.lastEventDeltaMs || 0),
        maxEventDeltaMs: Number(res?.maxEventDeltaMs || 0),
        serviceInstanceId: String(res?.serviceInstanceId || ''),
        serviceStartCount: Number(res?.serviceStartCount || 0),
        serviceStartTimestamp: Number(res?.serviceStartTimestamp || 0),
        sensorRegistrationTimestamp: Number(res?.sensorRegistrationTimestamp || 0),
        sensorRegistrationResult: Boolean(res?.sensorRegistrationResult),
        sensorName: String(res?.sensorName || 'Unknown'),
        sensorVendor: String(res?.sensorVendor || 'Unknown'),
        // Background popup & lifecycle telemetry
        backgroundShakeCallbacks: Number(res?.backgroundShakeCallbacks || 0),
        popupLaunchAttempts: Number(res?.popupLaunchAttempts || 0),
        popupLaunchSuccesses: Number(res?.popupLaunchSuccesses || 0),
        popupLaunchFailures: Number(res?.popupLaunchFailures || 0),
        lastPopupLaunchAttempt: Number(res?.lastPopupLaunchAttempt || 0),
        lastPopupLaunchSuccess: Number(res?.lastPopupLaunchSuccess || 0),
        lastPopupLaunchError: String(res?.lastPopupLaunchError || 'None'),
        popupOnCreate: Number(res?.popupOnCreate || 0),
        popupOnStart: Number(res?.popupOnStart || 0),
        popupOnResume: Number(res?.popupOnResume || 0),
        popupOnPause: Number(res?.popupOnPause || 0),
        popupOnStop: Number(res?.popupOnStop || 0),
        popupOnDestroy: Number(res?.popupOnDestroy || 0),
        lastPopupOnCreateTimestamp: Number(res?.lastPopupOnCreateTimestamp || 0),
        lastPopupOnResumeTimestamp: Number(res?.lastPopupOnResumeTimestamp || 0),
        lastPopupOnDestroyTimestamp: Number(res?.lastPopupOnDestroyTimestamp || 0),
      };
    } catch {
      return null;
    }
  }

  /**
   * Run a native 2-3 second hardware accelerometer test directly on Android.
   */
  async runSensorSelfTest(durationMs: number = 2000): Promise<SensorSelfTestResult> {
    if (!this.isNativeAvailable()) {
      return {
        eventsReceived: 0,
        durationMs,
        sensorAvailable: false,
        sensorName: 'Not Available',
        sensorVendor: 'Not Available',
        registrationSuccess: false,
        lastEventTimeMs: 0,
      };
    }
    const mod = this.nativeModule;
    if (typeof mod?.runSensorSelfTest !== 'function') {
      return {
        eventsReceived: 0,
        durationMs,
        sensorAvailable: false,
        sensorName: 'Method Missing',
        sensorVendor: 'Method Missing',
        registrationSuccess: false,
        lastEventTimeMs: 0,
      };
    }
    try {
      const res = await mod.runSensorSelfTest(durationMs);
      return {
        eventsReceived: Number(res?.eventsReceived || 0),
        durationMs: Number(res?.durationMs || durationMs),
        sensorAvailable: Boolean(res?.sensorAvailable),
        sensorName: String(res?.sensorName || 'Unknown'),
        sensorVendor: String(res?.sensorVendor || 'Unknown'),
        registrationSuccess: Boolean(res?.registrationSuccess),
        lastEventTimeMs: Number(res?.lastEventTimeMs || 0),
      };
    } catch (e) {
      return {
        eventsReceived: 0,
        durationMs,
        sensorAvailable: false,
        sensorName: 'Error',
        sensorVendor: 'Error',
        registrationSuccess: false,
        lastEventTimeMs: 0,
      };
    }
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

    // Sync cached accounts and categories for offline/background popup
    if (userId) {
      await this.syncUserDataToNative(userId).catch((err) => {
        console.warn('[ShakeService] Failed to sync user data to native SharedPreferences:', err);
      });
    }
  }

  /**
   * Register device event emitters from native Android to React Native.
   */
  private registerEventListeners(): void {
    DeviceEventEmitter.addListener('onShakeDetected', () => {
      console.log('[ShakeService] onShakeDetected received from native layer');
      if (!this.isModalOpen) {
        this.notifyShakeCallbacks();
      }
    });

    DeviceEventEmitter.addListener('onQuickExpenseSubmitted', async (data: any) => {
      console.log('[ShakeService] onQuickExpenseSubmitted received:', data);
      await this.handleNativeExpenseSubmitted(data);
    });

    DeviceEventEmitter.addListener('onQuickExpenseCreated', (data: any) => {
      console.log('[ShakeService] onQuickExpenseCreated received:', data);
    });
  }

  /**
   * Start the foreground ShakeDetectionService.
   */
  async startService(): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error(
        `PocketWiseShakeModule is not registered in NativeModules. Registered modules: ${Object.keys(NativeModules || {}).join(', ')}`
      );
    }
    const mod = this.nativeModule;
    if (typeof mod.startShakeService !== 'function') {
      throw new Error('PocketWiseShakeModule.startShakeService is not a callable function on NativeModules.');
    }
    return await mod.startShakeService();
  }

  /**
   * Stop the foreground ShakeDetectionService.
   */
  async stopService(): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error(
        `PocketWiseShakeModule is not registered in NativeModules. Registered modules: ${Object.keys(NativeModules || {}).join(', ')}`
      );
    }
    const mod = this.nativeModule;
    if (typeof mod.stopShakeService !== 'function') {
      throw new Error('PocketWiseShakeModule.stopShakeService is not a callable function on NativeModules.');
    }
    return await mod.stopShakeService();
  }

  /**
   * Check if the foreground ShakeDetectionService is currently running.
   */
  async isServiceRunning(): Promise<boolean> {
    if (!this.isNativeAvailable()) return false;
    const mod = this.nativeModule;
    if (typeof mod.isShakeServiceRunning !== 'function') return false;
    try {
      return await mod.isShakeServiceRunning();
    } catch {
      return false;
    }
  }

  /**
   * Check SYSTEM_ALERT_WINDOW (overlay) permission state directly on Android.
   */
  async checkOverlayPermission(): Promise<boolean> {
    if (!this.isNativeAvailable()) return false;
    const mod = this.nativeModule;
    if (typeof mod.checkOverlayPermission !== 'function') return false;
    try {
      const isGranted = await mod.checkOverlayPermission();
      return Boolean(isGranted);
    } catch {
      return false;
    }
  }

  /**
   * Request SYSTEM_ALERT_WINDOW permission by launching Android system overlay settings.
   */
  async requestOverlayPermission(): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error(
        `PocketWiseShakeModule is not registered in NativeModules. Registered modules: ${Object.keys(NativeModules || {}).join(', ')}`
      );
    }
    const mod = this.nativeModule;
    if (typeof mod.requestOverlayPermission !== 'function') {
      throw new Error('PocketWiseShakeModule.requestOverlayPermission is not a callable function on NativeModules.');
    }
    return await mod.requestOverlayPermission();
  }

  /**
   * Set physical shake sensitivity (low, normal, high).
   */
  async setSensitivity(sensitivity: ShakeSensitivity): Promise<boolean> {
    await shakeStorage.saveSettings({ sensitivity });
    if (!this.isNativeAvailable()) return false;
    const mod = this.nativeModule;
    if (typeof mod.setShakeSensitivity !== 'function') return false;
    try {
      return await mod.setShakeSensitivity(sensitivity.toUpperCase());
    } catch {
      return false;
    }
  }

  /**
   * Toggle background shake detection preference.
   */
  async setBackgroundEnabled(enabled: boolean): Promise<boolean> {
    await shakeStorage.saveSettings({ backgroundEnabled: enabled });
    if (!this.isNativeAvailable()) return false;
    const mod = this.nativeModule;
    if (typeof mod.setBackgroundShakeEnabled !== 'function') return false;
    try {
      return await mod.setBackgroundShakeEnabled(enabled);
    } catch {
      return false;
    }
  }

  /**
   * Test/simulate shake event via native bridge.
   */
  async simulateShake(): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error(
        `PocketWiseShakeModule is not registered in NativeModules. Registered modules: ${Object.keys(NativeModules || {}).join(', ')}`
      );
    }
    const mod = this.nativeModule;
    if (typeof mod.simulateShake !== 'function') {
      throw new Error('PocketWiseShakeModule.simulateShake is not a callable function on NativeModules.');
    }
    return await mod.simulateShake();
  }

  /**
   * Sync accounts, categories, and auth session into native Android SharedPreferences
   * for seamless offline/background quick expense recording.
   */
  async syncUserDataToNative(userId: string): Promise<void> {
    if (!this.isNativeAvailable()) return;
    const mod = this.nativeModule;
    if (typeof mod.syncUserData !== 'function') return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const envObj: Record<string, string | undefined> = typeof process !== 'undefined' && process.env ? process.env : {};
      const supabaseUrl = envObj['EXPO_PUBLIC_SUPABASE_URL'] || '';
      const supabaseAnonKey = envObj['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '';

      const accounts = await accountService.getAccounts(userId).catch(() => []);
      const categories = await categoryService.getCategories(userId).catch(() => []);

      const accountsPayload = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: a.balance,
      }));

      const categoriesPayload = categories
        .filter((c) => c.type === 'expense')
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));

      await mod.syncUserData(
        userId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        JSON.stringify(accountsPayload),
        JSON.stringify(categoriesPayload)
      );
    } catch (e) {
      console.warn('[ShakeService] Error during syncUserDataToNative:', e);
    }
  }

  /**
   * Clear synced user data on logout.
   */
  async clearNativeUserData(): Promise<void> {
    if (!this.isNativeAvailable()) return;
    const mod = this.nativeModule;
    if (typeof mod.clearUserData !== 'function') return;
    try {
      await mod.clearUserData();
      await this.stopService().catch(() => {});
    } catch (e) {
      console.warn('[ShakeService] Error clearing native user data:', e);
    }
  }

  /**
   * Alias for clearNativeUserData.
   */
  async clearUserSession(): Promise<void> {
    return this.clearNativeUserData();
  }

  /**
   * Handle quick expense submission emitted from native layer.
   */
  private async handleNativeExpenseSubmitted(data: {
    id: string;
    amount_minor: number;
    description: string;
    account_id: string;
    category_id?: string;
    date: string;
  }): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        console.warn('[ShakeService] Cannot save expense: user not logged in');
        return;
      }

      await transactionService.createTransaction({
        user_id: userId,
        account_id: data.account_id,
        category_id: data.category_id,
        type: 'expense',
        amount_minor: data.amount_minor,
        currency: 'INR',
        description: data.description,
        date: data.date,
      });
    } catch (err) {
      console.error('[ShakeService] Failed to process native expense submission:', err);
    }
  }

  /**
   * Register modal open callback.
   */
  onShake(callback: ShakeCallback): () => void {
    this.shakeCallbacks.add(callback);
    return () => {
      this.shakeCallbacks.delete(callback);
    };
  }

  /**
   * Alias for onShake.
   */
  subscribeToShake(callback: ShakeCallback): () => void {
    return this.onShake(callback);
  }

  private notifyShakeCallbacks(): void {
    this.shakeCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('[ShakeService] Error in shake callback:', e);
      }
    });
  }

  setModalOpen(isOpen: boolean): void {
    this.isModalOpen = isOpen;
  }
}

export const shakeService = new ShakeService();
