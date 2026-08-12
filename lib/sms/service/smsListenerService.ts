import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { RawSMS, ParsedSmsTransaction } from '../types';
import { parseBankSms } from '../parser';
import { isDuplicateTransaction } from '../parser/duplicateDetector';
import { smsStorage } from '../storage/smsStore';
import { useAppStore } from '../../store/useAppStore';

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
      return isGranted;
    } catch (error) {
      console.warn('[SMS Permissions Error]:', error);
      return false;
    }
  }

  /**
   * Check if SMS permission is currently granted.
   */
  async checkSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
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

    if (this.isListening) return;
    this.isListening = true;

    const hasPermission = await this.checkSmsPermissions();
    if (!hasPermission) {
      console.log('[SMS Listener] Running in standby mode (Permission not granted or iOS/Expo Go)');
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

    // High confidence (Score >= 80 & identified bank/account) -> Auto save directly into App Store
    if (parsedTx.confidenceScore >= 80 && !parsedTx.needsReview) {
      this.saveTransactionToStore(parsedTx);
    } else {
      // Low/Medium confidence -> Add to pending review queue
      await smsStorage.addPendingReview(parsedTx);
    }

    // Trigger callbacks
    this.callbacks.forEach((cb) => cb(parsedTx));

    return parsedTx;
  }

  /**
   * Automatically convert parsed transaction into App Store transaction & account format.
   */
  saveTransactionToStore(parsedTx: ParsedSmsTransaction) {
    const store = useAppStore.getState();
    let account = store.accounts.find(
      (acc) =>
        acc.name.toLowerCase().includes(parsedTx.bankName.toLowerCase()) ||
        (parsedTx.maskedAccount && acc.name.includes(parsedTx.maskedAccount.slice(-4)))
    );

    if (!account) {
      account = store.accounts[0]; // fallback to primary account
    }

    store.addTransaction({
      id: parsedTx.sourceMessageId || `tx_${Date.now()}`,
      account_id: account?.id || 'acc_1',
      account_name: account?.name || `${parsedTx.bankName} ${parsedTx.maskedAccount || ''}`,
      type: parsedTx.type === 'income' ? 'income' : 'expense',
      amount: parsedTx.amountMinor,
      currency: parsedTx.currency,
      category_name: parsedTx.category,
      category_color: parsedTx.type === 'income' ? '#10B981' : '#EF4444',
      description: `${parsedTx.merchant || 'Bank Transaction'} (${parsedTx.paymentMethod}) [Auto detected]`,
      date: parsedTx.transactionDate.split('T')[0],
    });
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
