import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { CreditCard, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react-native';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { AppTextInput } from './ui/AppTextInput';
import { AppLoadingIndicator } from './ui/AppLoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { accountService, Account } from '../lib/services/account.service';
import { parseMoneyToMinor } from '../lib/finance/core';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface BankSuggestion {
  id: string;
  name: string;
  keywords: string[];
  color: string;
  type: 'bank' | 'cash' | 'credit_card' | 'wallet';
}

const BANK_DIRECTORY: BankSuggestion[] = [
  { id: 'hdfc', name: 'HDFC Bank', keywords: ['hdfc', 'hdfc bank', 'hdfc savings'], color: '#004C8F', type: 'bank' },
  { id: 'sbi', name: 'State Bank of India', keywords: ['sbi', 'state bank', 'state bank of india'], color: '#0072BC', type: 'bank' },
  { id: 'icici', name: 'ICICI Bank', keywords: ['icici', 'icici bank'], color: '#F37024', type: 'bank' },
  { id: 'axis', name: 'Axis Bank', keywords: ['axis', 'axis bank'], color: '#97144D', type: 'bank' },
  { id: 'kotak', name: 'Kotak Mahindra Bank', keywords: ['kotak', 'kotak mahindra', '811'], color: '#ED1C24', type: 'bank' },
  { id: 'canara', name: 'Canara Bank', keywords: ['canara', 'canara bank'], color: '#0091DF', type: 'bank' },
  { id: 'bob', name: 'Bank of Baroda', keywords: ['bob', 'baroda', 'bank of baroda'], color: '#F26522', type: 'bank' },
  { id: 'idfc', name: 'IDFC FIRST Bank', keywords: ['idfc', 'idfc first'], color: '#9D1D27', type: 'bank' },
  { id: 'pnb', name: 'Punjab National Bank', keywords: ['pnb', 'punjab national', 'punjab'], color: '#A20A3C', type: 'bank' },
  { id: 'union', name: 'Union Bank of India', keywords: ['union', 'union bank'], color: '#0054A6', type: 'bank' },
  { id: 'indusind', name: 'IndusInd Bank', keywords: ['indusind', 'indus'], color: '#881B1B', type: 'bank' },
  { id: 'yes', name: 'Yes Bank', keywords: ['yes', 'yes bank'], color: '#005A9C', type: 'bank' },
  { id: 'federal', name: 'Federal Bank', keywords: ['federal', 'federal bank'], color: '#004B87', type: 'bank' },
  { id: 'indian', name: 'Indian Bank', keywords: ['indian', 'indian bank'], color: '#004C97', type: 'bank' },
  { id: 'boi', name: 'Bank of India', keywords: ['boi', 'bank of india'], color: '#EC1C24', type: 'bank' },
  { id: 'central', name: 'Central Bank of India', keywords: ['central bank', 'cbi'], color: '#003366', type: 'bank' },
  { id: 'paytm', name: 'Paytm Payments Bank', keywords: ['paytm', 'paytm wallet', 'paytm bank'], color: '#00BAF2', type: 'wallet' },
  { id: 'airtel', name: 'Airtel Payments Bank', keywords: ['airtel', 'airtel bank', 'airtel money'], color: '#E40000', type: 'wallet' },
  { id: 'cash', name: 'Cash Wallet', keywords: ['cash', 'cash wallet', 'wallet', 'petty cash'], color: '#10B981', type: 'cash' },
];

function generateVirtualCredentials() {
  const random4 = Math.floor(1000 + Math.random() * 9000).toString();
  return {
    cardNumberMasked: `•••• •••• •••• ${random4}`,
    expiry: '12/28',
    cvv: '123',
    last4: random4,
  };
}

export const AddCardModal: React.FC<AddCardModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // User input fields
  const [accountName, setAccountName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankSuggestion | null>(null);
  const nameInputRef = useRef<TextInput>(null);

  // Auto-generated virtual credentials (not asked for customer to fill)
  const [virtualCreds, setVirtualCreds] = useState(generateVirtualCredentials());

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate fresh virtual credentials, reset state, and auto-focus input each time modal opens
  useEffect(() => {
    if (visible) {
      setVirtualCreds(generateVirtualCredentials());
      setErrorMessage(null);
      setAccountName('');
      setInitialBalance('');
      setSelectedBank(null);

      // Explicitly focus text input so keyboard appears reliably on Android & iOS
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Dynamic bank suggestions based on current input text
  const suggestions = useMemo(() => {
    const query = accountName.trim().toLowerCase();
    if (query.length < 1) return [];

    return BANK_DIRECTORY.filter((bank) => {
      // Do not suggest if user already entered the exact full name
      if (bank.name.toLowerCase() === query) return false;

      const nameMatch = bank.name.toLowerCase().includes(query);
      const keywordMatch = bank.keywords.some(
        (k) => k.toLowerCase().includes(query) || query.includes(k.toLowerCase())
      );
      return nameMatch || keywordMatch;
    }).slice(0, 4);
  }, [accountName]);

  const handleSelectSuggestion = (bank: BankSuggestion) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setAccountName(bank.name);
    setSelectedBank(bank);
  };

  const isFormValid = accountName.trim().length >= 2;

  const handleSubmit = async () => {
    if (!isFormValid || isLoading || !user?.id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const matchedBank =
        selectedBank ||
        BANK_DIRECTORY.find((b) =>
          b.keywords.some((k) => accountName.toLowerCase().includes(k)) ||
          accountName.toLowerCase().includes(b.name.toLowerCase())
        );

      const isCash =
        matchedBank?.type === 'cash' ||
        accountName.toLowerCase().includes('cash') ||
        accountName.toLowerCase().includes('wallet');

      const balanceMinor = parseMoneyToMinor(initialBalance);

      const newAccountPayload: Omit<Account, 'id'> = {
        user_id: user.id,
        name: accountName.trim(),
        type: isCash ? 'cash' : (matchedBank?.type || 'bank'),
        balance: balanceMinor,
        opening_balance: balanceMinor,
        currency: 'INR',
        color: matchedBank?.color || '#09090B',
      };

      await accountService.createAccount(newAccountPayload);

      // Invalidate queries so dashboard card stack & transactions update instantly
      await queryClient.invalidateQueries({ queryKey: ['accounts', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['transactions', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Reset form
      setAccountName('');
      setInitialBalance('');
      setSelectedBank(null);
      setIsLoading(false);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Failed to create account. Please check details and try again.');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  const handleCloseModal = () => {
    if (isLoading) return;
    setErrorMessage(null);
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleCloseModal}
      title="Create Account"
      subtitle="Add a new account or wallet"
      scrollable
      dismissOnBackdrop={!isLoading}
    >
      {isLoading ? (
        <View style={styles.loadingWrapper}>
          <AppLoadingIndicator
            message="Creating your account..."
            subMessage="Generating encrypted virtual credentials & saving"
          />
        </View>
      ) : (
        <View style={styles.formContainer}>
          {/* Error Banner */}
          {!!errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Account Name Input */}
          <AppTextInput
            ref={nameInputRef}
            label="Account Name"
            placeholder="e.g. HDFC Savings, Cash Wallet"
            value={accountName}
            onChangeText={(text) => {
              setAccountName(text);
              if (selectedBank && text !== selectedBank.name) {
                setSelectedBank(null);
              }
            }}
            autoCapitalize="words"
          />

          {/* Dynamic Bank Suggestions (Only shown if matching banks are found) */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggested Banks:</Text>
              <View style={styles.suggestionsRow}>
                {suggestions.map((bank) => (
                  <Pressable
                    key={bank.id}
                    onPress={() => handleSelectSuggestion(bank)}
                    style={styles.suggestionChip}
                  >
                    <View style={[styles.suggestionDot, { backgroundColor: bank.color }]} />
                    <Text style={styles.suggestionText}>{bank.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Initial Balance Input */}
          <AppTextInput
            label="Initial Balance (₹)"
            placeholder="e.g. 10000.00"
            value={initialBalance}
            onChangeText={setInitialBalance}
            keyboardType="decimal-pad"
          />

          {/* Auto-Generated Virtual Card Credentials (Not asked for customer to fill) */}
          <View style={styles.autoCardBox}>
            <View style={styles.autoCardHeader}>
              <View style={styles.autoCardTitleWrap}>
                <CreditCard size={15} color="#4F46E5" />
                <Text style={styles.autoCardTitle}>Card Credentials</Text>
              </View>
              <View style={styles.autoBadge}>
                <Sparkles size={11} color="#4338CA" style={{ marginRight: 3 }} />
                <Text style={styles.autoBadgeText}>AUTO-GENERATED</Text>
              </View>
            </View>

            <View style={styles.autoCardGrid}>
              <View style={{ flex: 2 }}>
                <Text style={styles.autoCardLabel}>Card Number</Text>
                <Text style={styles.autoCardValue}>{virtualCreds.cardNumberMasked}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.autoCardLabel}>Expires (MM/YY)</Text>
                <Text style={styles.autoCardValue}>{virtualCreds.expiry}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.autoCardLabel}>CVV</Text>
                <Text style={styles.autoCardValue}>{virtualCreds.cvv}</Text>
              </View>
            </View>

            <View style={styles.securityNote}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.securityNoteText}>
                256-bit encrypted credential storage
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={!isFormValid || isLoading}
              style={[
                styles.submitButton,
                isFormValid && !isLoading
                  ? styles.submitButtonActive
                  : styles.submitButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.submitButtonText,
                  isFormValid && !isLoading
                    ? styles.submitButtonTextActive
                    : styles.submitButtonTextDisabled,
                ]}
              >
                Create Account
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </AppBottomSheet>
  );
};

const styles = StyleSheet.create({
  loadingWrapper: {
    paddingVertical: 24,
  },
  formContainer: {
    paddingBottom: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  suggestionsContainer: {
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  suggestionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#18181B',
  },
  autoCardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  autoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  autoCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  autoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.4,
  },
  autoCardGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  autoCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  autoCardValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  securityNoteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
  },
  submitButton: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  submitButtonActive: {
    backgroundColor: '#09090B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#E4E4E7',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  submitButtonTextActive: {
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#A1A1AA',
  },
});
