import { Platform, PermissionsAndroid, Alert, NativeModules, DeviceEventEmitter } from 'react-native';
import { RawSMS, ParsedSmsTransaction } from '../types';
import { parseBankSms } from '../parser';
import { isDuplicateTransaction, createTransactionFingerprint } from '../parser/duplicateDetector';
import { smsStorage } from '../storage/smsStore';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../supabase';
import { queryClient } from '../../queryClient';
import { transactionService } from '../../services/transaction.service';
import { accountService } from '../../services/account.service';
import { categoryService, matchCategoryToUserCategories } from '../../services/category.service';
import { notificationEngine } from '../../notifications/notification.engine';
import { financialAnalyticsEngine } from '../../finance/analyticsEngine';

const { PocketWiseSmsModule } = NativeModules;

type SmsListenerCallback = (tx: ParsedSmsTransaction) => void;

let smsProcessLock: Promise<any> = Promise.resolve();
function runSmsProcessWithLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = smsProcessLock.then(fn, fn);
  smsProcessLock = next;
  return next;
}

export function isGenericDescription(desc?: string): boolean {
  if (!desc) return true;
  const d = desc.trim().toLowerCase();
  return (
    d === 'bank payment' ||
    d === 'bank payment (upi)' ||
    d === 'bank transaction' ||
    d === 'bank transaction (unknown)' ||
    d.startsWith('bank payment') ||
    d.startsWith('bank transaction') ||
    d.includes('@upi')
  );
}

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
    } else {
      // Sync recent inbox messages in background so past transactions aren't missed
      this.syncRecentInboxSms().catch((err) => console.log('[SMS Listener] Background inbox sync:', err));
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
   * Scan and sync recent bank transactions from the Android SMS Inbox (content://sms/inbox).
   */
  async syncRecentInboxSms(isManualScan: boolean = false): Promise<{ total: number; detected: number; saved: number }> {
    if (Platform.OS !== 'android' || !PocketWiseSmsModule?.readRecentInboxSms) {
      return { total: 0, detected: 0, saved: 0 };
    }

    const hasPermission = await this.checkSmsPermissions();
    if (!hasPermission) {
      return { total: 0, detected: 0, saved: 0 };
    }

    try {
      const messages: RawSMS[] = await PocketWiseSmsModule.readRecentInboxSms();
      if (!Array.isArray(messages) || messages.length === 0) {
        return { total: 0, detected: 0, saved: 0 };
      }

      let detectedCount = 0;
      let savedCount = 0;

      // Process oldest to newest so balances & ledger build chronologically
      const chronological = [...messages].reverse();

      for (const msg of chronological) {
        if (!msg.body) continue;
        const result = await this.processIncomingSms(msg, isManualScan);
        if (result) {
          detectedCount++;
          savedCount++;
        }
      }

      // Also run retroactive upgrade for any generic transactions ('Bank Payment (UPI)', etc.) in DB
      const upgradedCount = await this.upgradeGenericTransactions();

      if (detectedCount > 0 || upgradedCount > 0 || isManualScan) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }

      return { total: messages.length, detected: detectedCount + upgradedCount, saved: savedCount };
    } catch (err) {
      console.warn('[SMS Listener] Error syncing recent inbox SMS:', err);
      return { total: 0, detected: 0, saved: 0 };
    }
  }

  /**
   * Retroactively scan existing generic transactions ('Bank Payment', 'Bank Payment (UPI)', etc.)
   * in Supabase and upgrade their payee description if a matching SMS is found in the inbox.
   */
  async upgradeGenericTransactions(userId?: string): Promise<number> {
    if (Platform.OS !== 'android' || !PocketWiseSmsModule?.readRecentInboxSms) {
      return 0;
    }

    try {
      const activeUserId =
        userId ||
        (typeof supabase.auth?.getSession === 'function' ? (await supabase.auth.getSession()).data?.session?.user?.id : undefined) ||
        (typeof supabase.auth?.getUser === 'function' ? (await supabase.auth.getUser()).data?.user?.id : undefined);

      if (!activeUserId) return 0;

      const recentTxs = await transactionService.getTransactions(activeUserId, 100);
      const genericTxs = recentTxs.filter((t) => isGenericDescription(t.description));
      if (genericTxs.length === 0) return 0;

      const messages: RawSMS[] = await PocketWiseSmsModule.readRecentInboxSms();
      if (!Array.isArray(messages) || messages.length === 0) return 0;

      const accountMappings = await smsStorage.getAccountMappings();
      const learnedCategories = await smsStorage.getLearnedCategories();
      const userCategories = await categoryService.getCategories(activeUserId);

      let upgradedCount = 0;

      for (const msg of messages) {
        if (!msg.body) continue;
        const parsed = parseBankSms(msg, accountMappings, learnedCategories);
        if (!parsed || !parsed.merchant) continue;

        const cleanPayee = (parsed.merchant || '').replace(/@.*$/, '').trim();
        if (!cleanPayee || cleanPayee === 'Bank Transaction' || cleanPayee === 'Bank Payment') continue;

        const match = genericTxs.find(
          (t) =>
            (parsed.referenceNumber && t.notes?.includes(parsed.referenceNumber)) ||
            (parsed.upiReference && t.notes?.includes(parsed.upiReference)) ||
            (t.amount_minor === parsed.amountMinor &&
              (t.date || '').substring(0, 10) === parsed.transactionDate.split('T')[0] &&
              t.type === (parsed.type === 'income' ? 'income' : 'expense'))
        );

        if (match) {
          const matchedCat = matchCategoryToUserCategories(
            parsed.category,
            userCategories,
            parsed.type === 'income' ? 'income' : 'expense'
          );

          const updates: any = {};
          if (match.description !== cleanPayee) {
            updates.description = cleanPayee;
          }
          if (!match.category_id && matchedCat?.id) {
            updates.category_id = matchedCat.id;
          }

          if (Object.keys(updates).length > 0) {
            console.log(`[Retroactive Upgrade] Upgraded transaction ${match.id}:`, updates);
            await transactionService.updateTransaction(match.id, updates);
            upgradedCount++;
          }
        }
      }

      // Also run keyword/learned auto-categorization for any remaining uncategorized transactions
      await transactionService.autoCategorizeUncategorizedTransactions(activeUserId).catch(() => {});

      if (upgradedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
      }

      return upgradedCount;
    } catch (err) {
      console.warn('[Retroactive Upgrade] Error upgrading generic transactions:', err);
      return 0;
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
  async processIncomingSms(rawSms: RawSMS, isManualScan: boolean = false): Promise<ParsedSmsTransaction | null> {
    return runSmsProcessWithLock(async () => {
      // 1. In-memory exact SMS ID check (bypassed on manual scan so missed past transactions are evaluated)
      if (!isManualScan && rawSms.id && this.processedSmsIds.has(rawSms.id)) {
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

      // 2. Persistent Reference / UTR & Fingerprint deduplication check
      const txFingerprint = createTransactionFingerprint(parsedTx);
      if (!isManualScan) {
        if (parsedTx.referenceNumber && (await smsStorage.isRefIdProcessed(parsedTx.referenceNumber))) {
          console.log('[SMS Parser] Duplicate referenceNumber ignored:', parsedTx.referenceNumber);
          return null;
        }
        if (parsedTx.upiReference && (await smsStorage.isRefIdProcessed(parsedTx.upiReference))) {
          console.log('[SMS Parser] Duplicate upiReference ignored:', parsedTx.upiReference);
          return null;
        }
        if (txFingerprint && (await smsStorage.isRefIdProcessed(txFingerprint))) {
          console.log('[SMS Parser] Duplicate fingerprint ignored:', txFingerprint);
          return null;
        }
      }

      // 3. Check duplicate against pending reviews queue
      const pendingReviews = await smsStorage.getPendingReviews();
      if (!isManualScan && isDuplicateTransaction(parsedTx, pendingReviews)) {
        console.log('[SMS Parser] Duplicate pending review ignored:', parsedTx.referenceNumber || parsedTx.amount);
        if (txFingerprint) await smsStorage.markRefIdProcessed(txFingerprint);
        return null;
      }

      // 4. Check duplicate against active Supabase DB transactions for logged-in user
      try {
        const session = typeof supabase.auth?.getSession === 'function' ? (await supabase.auth.getSession()).data?.session : null;
        const userId = session?.user?.id || (typeof supabase.auth?.getUser === 'function' ? (await supabase.auth.getUser()).data?.user?.id : undefined);
        if (userId) {
          const recentTxs = await transactionService.getTransactions(userId, 100);
          if (isDuplicateTransaction(parsedTx, recentTxs)) {
            console.log('[SMS Parser] Duplicate Supabase transaction ignored:', parsedTx.referenceNumber || parsedTx.amount);
            if (parsedTx.referenceNumber) await smsStorage.markRefIdProcessed(parsedTx.referenceNumber);
            if (parsedTx.upiReference) await smsStorage.markRefIdProcessed(parsedTx.upiReference);
            if (txFingerprint) await smsStorage.markRefIdProcessed(txFingerprint);
            return null;
          }
        }
      } catch (e) {
        console.warn('[SMS Parser] Non-fatal DB duplicate check error:', e);
      }

      // Mark reference ID and fingerprint as processed
      if (parsedTx.referenceNumber) await smsStorage.markRefIdProcessed(parsedTx.referenceNumber);
      if (parsedTx.upiReference) await smsStorage.markRefIdProcessed(parsedTx.upiReference);
      if (txFingerprint) await smsStorage.markRefIdProcessed(txFingerprint);

      // Update statistics count
      await smsStorage.incrementDetectedCount();

      // Auto-save all valid financial transactions so user never misses payments in Transactions screen
      await this.saveTransactionToStore(parsedTx);

      // If confidence score is low or bank unknown, also track in pending review queue for user verification
      if (parsedTx.needsReview && !isManualScan) {
        await smsStorage.addPendingReview(parsedTx);
      }

      // Trigger callbacks
      this.callbacks.forEach((cb) => cb(parsedTx));

      return parsedTx;
    });
  }

  /**
   * Automatically convert parsed transaction into Supabase & Zustand store transaction & account format.
   * If the bank account does not exist, automatically creates it in both the Zustand store and Supabase DB.
   */
  async saveTransactionToStore(parsedTx: ParsedSmsTransaction) {
    const bankDisplayName = parsedTx.bankName && parsedTx.bankName !== 'Unknown Bank'
      ? parsedTx.bankName
      : (parsedTx.maskedAccount ? `Bank (${parsedTx.maskedAccount})` : 'Bank Account');

    const formattedAccountName = parsedTx.maskedAccount
      ? `${bankDisplayName} (${parsedTx.maskedAccount})`
      : bankDisplayName;

    const bankColor = parsedTx.type === 'income' ? '#10B981' : '#3B82F6';
    const deltaAmount = parsedTx.type === 'income' ? parsedTx.amountMinor : -parsedTx.amountMinor;
    const accountLookupName = bankDisplayName.toLowerCase();
    const cleanLastDigits = parsedTx.maskedAccount ? parsedTx.maskedAccount.replace(/\D/g, '') : '';

    // Clean merchant/payee formatting: Avoid 'Bank Transaction (Unknown)' label
    let merchantLabel = parsedTx.merchant && parsedTx.merchant !== 'Bank Transaction' ? parsedTx.merchant : '';
    if (!merchantLabel) {
      if (parsedTx.originalMerchant && parsedTx.originalMerchant.includes('@')) {
        merchantLabel = parsedTx.originalMerchant.split('@')[0].trim();
      } else {
        merchantLabel = parsedTx.type === 'income' ? 'Received Payment' : 'Bank Payment';
      }
    }

    // Strip any lingering @upi / @vpa suffixes so payee stays completely clean without '@upi'
    if (merchantLabel.includes('@')) {
      merchantLabel = merchantLabel.split('@')[0].trim();
    }

    const isNumericOrVpa = /^\d+$/.test(merchantLabel) || (parsedTx.originalMerchant && parsedTx.originalMerchant.includes('@'));
    const paymentTag = parsedTx.paymentMethod && parsedTx.paymentMethod !== 'Unknown' && !isNumericOrVpa ? ` (${parsedTx.paymentMethod})` : '';
    const cleanDescription = `${merchantLabel}${paymentTag}`;
    const txDateStr = parsedTx.transactionDate.split('T')[0];

    // 1. Resolve or Auto-Add Account in Zustand store (in-memory)
    const store = useAppStore.getState();
    let localAccount = store.accounts.find(
      (acc) =>
        (bankDisplayName !== 'Bank Account' && acc.name.toLowerCase().includes(accountLookupName)) ||
        (cleanLastDigits.length >= 3 && acc.name.includes(cleanLastDigits))
    );

    const existingLocalTx = localAccount
      ? store.transactions.find(
          (t) =>
            t.account_id === localAccount!.id &&
            t.type === (parsedTx.type === 'income' ? 'income' : 'expense') &&
            t.amount === parsedTx.amountMinor &&
            t.date === txDateStr &&
            t.description === cleanDescription
        )
      : null;

    if (!localAccount) {
      const newAccountId = `acc_auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      localAccount = {
        id: newAccountId,
        name: formattedAccountName,
        type: 'bank',
        balance: deltaAmount,
        currency: parsedTx.currency || 'INR',
        color: bankColor,
      };
      store.addAccount(localAccount);
    } else if (!existingLocalTx) {
      const newBalance = (localAccount.balance || 0) + deltaAmount;
      store.updateAccountBalance(localAccount.id, newBalance);
    }

    if (!existingLocalTx) {
      store.addTransaction({
        id: parsedTx.sourceMessageId || `tx_${Date.now()}`,
        account_id: localAccount.id,
        account_name: localAccount.name,
        type: parsedTx.type === 'income' ? 'income' : 'expense',
        amount: parsedTx.amountMinor,
        currency: parsedTx.currency,
        category_name: parsedTx.category,
        category_color: parsedTx.type === 'income' ? '#10B981' : '#EF4444',
        description: cleanDescription,
        date: txDateStr,
      });
    }

    // Auto-save account mapping for persistent linking
    if (parsedTx.maskedAccount && parsedTx.bankId && parsedTx.bankId !== 'unknown') {
      await smsStorage.saveAccountMapping({
        maskedAccount: parsedTx.maskedAccount,
        bankId: parsedTx.bankId,
        bankName: parsedTx.bankName,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // 2. Persist to Supabase Database for logged-in user
    try {
      const session = typeof supabase.auth?.getSession === 'function' ? (await supabase.auth.getSession()).data?.session : null;
      const userId = session?.user?.id || (typeof supabase.auth?.getUser === 'function' ? (await supabase.auth.getUser()).data?.user?.id : undefined);

      if (userId) {
        const userAccounts = await accountService.getAccounts(userId);
        let targetAccount = userAccounts.find(
          (acc) =>
            (bankDisplayName !== 'Bank Account' && acc.name.toLowerCase().includes(accountLookupName)) ||
            (cleanLastDigits.length >= 3 && acc.name.includes(cleanLastDigits))
        );

        if (!targetAccount) {
          targetAccount = await accountService.createAccount({
            user_id: userId,
            name: formattedAccountName,
            type: 'bank',
            balance: 0,
            currency: 'INR',
            color: bankColor,
          });
        }

        // Check if an exact match already exists in Supabase
        const recentAccountTxs = await transactionService.getTransactions(userId, 50, targetAccount.id);
        const alreadyExists = recentAccountTxs.some((t) => {
          if (t.type !== (parsedTx.type === 'income' ? 'income' : 'expense')) return false;
          if (t.amount_minor !== parsedTx.amountMinor) return false;
          if ((t.date || '').substring(0, 10) !== txDateStr) return false;

          const newRef = (parsedTx.referenceNumber || parsedTx.upiReference || '').trim();

          // If incoming transaction has a unique reference number:
          if (newRef) {
            // It is only a duplicate if an existing transaction already contains this exact reference number!
            return !!(t.notes && t.notes.includes(newRef));
          }

          // Fallback if no reference number exists on the SMS
          return (t.description || '').trim().toLowerCase() === cleanDescription.trim().toLowerCase();
        });

        if (alreadyExists) {
          console.log('[SMS Listener] Prevented duplicate Supabase transaction creation:', cleanDescription, parsedTx.amountMinor);
          return;
        }

        // Resolve target Category ID from user categories for accurate monthly budget tracking
        let targetCategoryId: string | undefined = undefined;
        try {
          const userCategories = await categoryService.getCategories(userId);
          const matchedCategory = matchCategoryToUserCategories(
            parsedTx.category,
            userCategories,
            parsedTx.type === 'income' ? 'income' : 'expense'
          );
          if (matchedCategory) {
            targetCategoryId = matchedCategory.id;
          } else if (parsedTx.type !== 'income') {
            const personalCat = userCategories.find(
              (c) => c.name.toLowerCase() === 'personal' && c.type === 'expense'
            );
            targetCategoryId = personalCat?.id;
          }
        } catch (catErr) {
          console.warn('[SMS Listener] Category resolution failed:', catErr);
        }

        await transactionService.createTransaction({
          user_id: userId,
          account_id: targetAccount.id,
          category_id: targetCategoryId,
          type: parsedTx.type === 'income' ? 'income' : 'expense',
          amount_minor: parsedTx.amountMinor,
          currency: parsedTx.currency,
          description: cleanDescription,
          date: txDateStr,
          notes: parsedTx.referenceNumber ? `Ref: ${parsedTx.referenceNumber}` : (parsedTx.upiReference ? `UPI Ref: ${parsedTx.upiReference}` : undefined),
        });

        // Clean up pending reviews queue if this transaction was previously waiting for review
        if (parsedTx.sourceMessageId) {
          await smsStorage.removePendingReview(parsedTx.sourceMessageId).catch(() => {});
        }

        // Instantly invalidate TanStack Query caches so dashboard, transactions & budgets update immediately
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
      }
    } catch (err) {
      console.warn('[SMS Listener] Error persisting to Supabase:', err);
    }

    // 3. Trigger Real Android System Notification via Central Notification Engine
    try {
      const isIncome = parsedTx.type === 'income';
      const formattedAmount = `₹${(parsedTx.amountMinor / 100).toLocaleString('en-IN')}`;
      const title = isIncome ? 'Money Received 💰' : 'Expense Recorded 💳';
      const cleanMerchantName = (parsedTx.merchant || '').replace(/@.*$/, '').trim();
      const merchantPart = cleanMerchantName && cleanMerchantName !== 'Bank Transaction'
        ? ` to ${cleanMerchantName}`
        : '';
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
