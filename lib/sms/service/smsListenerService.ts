import { Platform, PermissionsAndroid, Alert, NativeModules, DeviceEventEmitter } from 'react-native';
import { RawSMS, ParsedSmsTransaction } from '../types';
import { parseBankSms } from '../parser';
import { isDuplicateTransaction } from '../parser/duplicateDetector';
import { smsStorage } from '../storage/smsStore';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../supabase';
import { transactionService } from '../../services/transaction.service';
import { accountService } from '../../services/account.service';
import { notificationEngine } from '../../notifications/notification.engine';
import { financialAnalyticsEngine } from '../../finance/analyticsEngine';

const { PocketWiseSmsModule } = NativeModules;

type SmsListenerCallback = (tx: ParsedSmsTransaction) => void;

class SmsListenerService {
  private isListening = false;
  private callbacks: SmsListenerCallback[] = [];
  private processedSmsIds = new Set<string>();

  /**
   * Request Android READ_SMS and RECEIVE_SMS permissions.
   */
  async requestSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);

      const isGranted =
        granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

      await smsStorage.saveSettings({ permissionGranted: isGranted });

      if (!isGranted) {
        Alert.alert(
          'Permission Restricted by Android',
          'Android 13+ restricts sensitive SMS permissions for apps installed outside Google Play Store.\n\nTo enable automatic tracking:\n\n1. Open Phone Settings ⚙️ > Apps > PocketWise\n2. Tap the 3 dots (⋮) in the top-right corner\n3. Tap "Allow restricted settings"\n4. Open PocketWise and tap Enable again.',
          [{ text: 'Got it' }]
        );
      }

      return isGranted;
    } catch (error) {
      console.warn('[SMS Permissions Error]:', error);
      return false;
    }
  }

  /**
   * Check if Notification Listener permission is enabled for reading Google Messages notifications.
   */
  async isNotificationListenerEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseSmsModule?.isNotificationListenerEnabled) {
      return false;
    }
    try {
      return await PocketWiseSmsModule.isNotificationListenerEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Open Android Notification Listener Access settings screen.
   */
  async openNotificationListenerSettings(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PocketWiseSmsModule?.openNotificationListenerSettings) {
      return false;
    }
    try {
      return await PocketWiseSmsModule.openNotificationListenerSettings();
    } catch {
      return false;
    }
  }

  /**
   * Check if SMS permission or Notification Listener permission is currently granted.
   */
  async checkSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      if (PocketWiseSmsModule?.checkPermissionState) {
        const state = await PocketWiseSmsModule.checkPermissionState();
        await smsStorage.saveSettings({ permissionGranted: state.granted });
        return state.granted;
      }

      const receiveGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
      const readGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      const isGranted = receiveGranted && readGranted;

      await smsStorage.saveSettings({ permissionGranted: isGranted });
      return isGranted;
    } catch {
      return false;
    }
  }

  /**
   * Start listening for native SMS events or developer simulation.
   */
  async startListening(onTransactionDetected?: SmsListenerCallback): Promise<void> {
    if (onTransactionDetected) {
      this.callbacks.push(onTransactionDetected);
    }

    if (this.isListening) {
      this.flushBackgroundQueue();
      return;
    }
    this.isListening = true;

    const hasPermission = await this.checkSmsPermissions();
    if (!hasPermission) {
      console.log('[SMS Listener] Running in standby mode (Permission not granted or iOS/Expo Go)');
    }

    // Subscribe to real-time native SMS receiver events
    if (Platform.OS === 'android') {
      DeviceEventEmitter.addListener('onSmsReceived', (event: any) => {
        if (event && event.body) {
          const rawSms: RawSMS = {
            id: event.id || `sms_${Date.now()}`,
            sender: event.sender || 'Unknown',
            body: event.body,
            timestamp: event.timestamp || Date.now(),
          };
          this.processIncomingSms(rawSms);
        }
      });

      // Process any background queued SMS that arrived while app was closed
      this.flushBackgroundQueue();
    }
  }

  /**
   * Flush background queue from SharedPreferences.
   */
  async flushBackgroundQueue() {
    if (Platform.OS !== 'android') return;

    // Flush queued SMS from Receiver / Notification Listener SharedPreferences
    if (PocketWiseSmsModule?.getUnprocessedSms) {
      try {
        const queueJsonString = await PocketWiseSmsModule.getUnprocessedSms();
        if (queueJsonString && queueJsonString !== '[]') {
          const queue: RawSMS[] = JSON.parse(queueJsonString);
          for (const rawSms of queue) {
            await this.processIncomingSms(rawSms);
          }
          await PocketWiseSmsModule.clearUnprocessedSms();
        }
      } catch (err) {
        console.warn('[SMS Listener] Error flushing background queue:', err);
      }
    }
  }

  /**
   * Process an incoming raw SMS object through the local pipeline.
   */
  async processIncomingSms(rawSms: RawSMS): Promise<ParsedSmsTransaction | null> {
    // Avoid double processing exact same SMS ID
    if (rawSms.id && this.processedSmsIds.has(rawSms.id)) {
      return null;
    }
    if (rawSms.id) {
      this.processedSmsIds.add(rawSms.id);
    }

    // Load account mappings & learned categories
    const accountMappings = await smsStorage.getAccountMappings();
    const learnedCategories = await smsStorage.getLearnedCategories();

    // Parse SMS
    const parsedTx = parseBankSms(rawSms, accountMappings, learnedCategories);
    if (!parsedTx) return null;

    // Check duplicate against store transactions
    const appState = useAppStore.getState();
    const existingParsed = appState.transactions.map((t) => ({
      ...t,
      amountMinor: t.amount,
      transactionDate: t.date,
      bankId: t.account_id,
    })) as unknown as ParsedSmsTransaction[];

    if (isDuplicateTransaction(parsedTx, existingParsed)) {
      console.log('[SMS Parser] Duplicate transaction ignored:', parsedTx.referenceNumber || parsedTx.amount);
      return null;
    }

    // Update statistics count
    await smsStorage.incrementDetectedCount();

    // High/Medium confidence & identified bank -> Auto save directly into App Store & Supabase
    if (parsedTx.bankId !== 'unknown') {
      await this.saveTransactionToStore(parsedTx);
    } else {
      // Unknown bank -> Add to pending review queue for user selection
      await smsStorage.addPendingReview(parsedTx);
    }

    // Trigger callbacks
    this.callbacks.forEach((cb) => cb(parsedTx));

    return parsedTx;
  }

  /**
   * Automatically convert parsed transaction into Supabase & Zustand store transaction & account format.
   */
  async saveTransactionToStore(parsedTx: ParsedSmsTransaction) {
    // 1. Update Zustand store (in-memory)
    const store = useAppStore.getState();
    let localAccount = store.accounts.find(
      (acc) =>
        acc.name.toLowerCase().includes(parsedTx.bankName.toLowerCase()) ||
        (parsedTx.maskedAccount && acc.name.includes(parsedTx.maskedAccount.slice(-4)))
    );

    if (!localAccount) {
      localAccount = store.accounts[0]; // fallback to primary account
    }

    // Clean merchant/payee formatting: Avoid 'Bank Transaction (Unknown)' label
    let merchantLabel = parsedTx.merchant && parsedTx.merchant !== 'Bank Transaction' ? parsedTx.merchant : '';
    if (!merchantLabel) {
      merchantLabel = parsedTx.type === 'income' ? 'Received Payment' : 'Bank Payment';
    }

    const paymentTag = parsedTx.paymentMethod && parsedTx.paymentMethod !== 'Unknown' ? ` (${parsedTx.paymentMethod})` : '';
    const cleanDescription = `${merchantLabel}${paymentTag} [Auto detected]`;

    store.addTransaction({
      id: parsedTx.sourceMessageId || `tx_${Date.now()}`,
      account_id: localAccount?.id || 'acc_1',
      account_name: localAccount?.name || `${parsedTx.bankName} ${parsedTx.maskedAccount || ''}`,
      type: parsedTx.type === 'income' ? 'income' : 'expense',
      amount: parsedTx.amountMinor,
      currency: parsedTx.currency,
      category_name: parsedTx.category,
      category_color: parsedTx.type === 'income' ? '#10B981' : '#EF4444',
      description: cleanDescription,
      date: parsedTx.transactionDate.split('T')[0],
    });

    // 2. Persist to Supabase Database for logged-in user
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const userAccounts = await accountService.getAccounts(userId);
        let targetAccount = userAccounts.find(
          (acc) =>
            acc.name.toLowerCase().includes(parsedTx.bankName.toLowerCase()) ||
            (parsedTx.maskedAccount && acc.name.includes(parsedTx.maskedAccount.slice(-4)))
        );

        if (!targetAccount && userAccounts.length > 0) {
          targetAccount = userAccounts[0];
        }

        if (!targetAccount) {
          targetAccount = await accountService.createAccount({
            user_id: userId,
            name: `${parsedTx.bankName} ${parsedTx.maskedAccount ? `(${parsedTx.maskedAccount})` : ''}`.trim(),
            type: 'bank',
            balance: 0,
            currency: 'INR',
          });
        }

        await transactionService.createTransaction({
          user_id: userId,
          account_id: targetAccount.id,
          type: parsedTx.type === 'income' ? 'income' : 'expense',
          amount_minor: parsedTx.amountMinor,
          currency: parsedTx.currency,
          description: cleanDescription,
          date: parsedTx.transactionDate.split('T')[0],
        });
      }
    } catch (err) {
      console.warn('[SMS Listener] Error persisting to Supabase:', err);
    }

    // 3. Trigger Real Android System Notification via Central Notification Engine
    try {
      const isIncome = parsedTx.type === 'income';
      const formattedAmount = `₹${(parsedTx.amountMinor / 100).toLocaleString('en-IN')}`;
      const title = isIncome ? 'Money Received 💰' : 'Expense Recorded 💳';
      const merchantPart = parsedTx.merchant && parsedTx.merchant !== 'Bank Transaction' ? ` at ${parsedTx.merchant}` : '';
      const body = isIncome
        ? `${formattedAmount} received into your ${parsedTx.bankName} account.`
        : `${formattedAmount} spent${merchantPart} (${parsedTx.bankName}).`;

      const category = isIncome ? 'income' : parsedTx.amountMinor >= 1000000 ? 'large_transaction' : 'expense';

      await notificationEngine.notify({
        eventId: `tx_alert_${parsedTx.sourceMessageId}`,
        category: category,
        title: title,
        body: body,
        priority: category === 'large_transaction' ? 'high' : 'medium',
        data: {
          transactionId: parsedTx.sourceMessageId,
          type: 'transaction',
        },
      });

      // Evaluate Unusual Spending Anomaly Alert
      const storeState = useAppStore.getState();
      const existingTxs = storeState.transactions || [];
      await financialAnalyticsEngine.evaluateUnusualSpending({
        id: parsedTx.sourceMessageId || `tx_${Date.now()}`,
        amount_minor: parsedTx.amountMinor,
        category_name: parsedTx.category,
        description: cleanDescription,
        type: parsedTx.type === 'income' ? 'income' : 'expense',
      }, existingTxs);
    } catch (notifErr) {
      console.warn('[SMS Listener] Non-fatal notification error:', notifErr);
    }
  }

  /**
   * Developer / Demo SMS simulation trigger.
   */
  async simulateIncomingSms(sender: string, body: string): Promise<ParsedSmsTransaction | null> {
    const mockRaw: RawSMS = {
      id: `sim_${Date.now()}`,
      sender,
      body,
      timestamp: Date.now(),
    };
    return this.processIncomingSms(mockRaw);
  }
}

export const smsListenerService = new SmsListenerService();
