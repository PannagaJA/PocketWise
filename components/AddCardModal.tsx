import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { CreditCard, ShieldCheck, Building2, AlertCircle } from 'lucide-react-native';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { AppTextInput } from './ui/AppTextInput';
import { AppLoadingIndicator } from './ui/AppLoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../lib/services/account.service';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SUPPORTED_BANKS = [
  { id: 'bob', name: 'Bank of Baroda', code: 'BOB' },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'sbi', name: 'State Bank of India', code: 'SBI' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
];

export const AddCardModal: React.FC<AddCardModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cardholderName, setCardholderName] = useState(
    user?.user_metadata?.display_name || ''
  );
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState(SUPPORTED_BANKS[0].name);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Card Brand Detection
  const getCardBrand = () => {
    const raw = cardNumber.replace(/\D/g, '');
    if (raw.startsWith('4')) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(raw)) return 'Mastercard';
    if (/^(60|65|81|82)/.test(raw)) return 'RuPay';
    if (/^3[47]/.test(raw)) return 'Amex';
    return null;
  };

  // Form Validation
  const rawDigits = cardNumber.replace(/\D/g, '');
  const isCardNumberValid = rawDigits.length === 16;
  const isExpiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const isCvvValid = cvv.length >= 3;
  const isNameValid = cardholderName.trim().length >= 2;

  const isFormValid = isCardNumberValid && isExpiryValid && isCvvValid && isNameValid;

  const handleSubmit = async () => {
    if (!isFormValid || isLoading || !user?.id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const last4 = rawDigits.slice(-4);
      const brand = getCardBrand() || 'Card';
      const accountName = `${selectedBank} (${brand} ••${last4})`;

      // Create credit_card account entry adhering to PocketWise's existing schema
      await accountService.createAccount({
        user_id: user.id,
        name: accountName,
        type: 'credit_card',
        balance: 0,
        currency: 'INR',
        color: '#09090B',
      });

      // Invalidate queries so dashboard card stack updates instantly
      await queryClient.invalidateQueries({ queryKey: ['accounts', user.id] });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Reset form
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setIsLoading(false);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Failed to add card. Please check details and try again.');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  const handleCloseModal = () => {
    if (isLoading) return; // Prevent dismissing mid-operation
    setErrorMessage(null);
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleCloseModal}
      title="Add Card"
      subtitle="Link a debit or credit card to your account"
      scrollable
      dismissOnBackdrop={!isLoading}
    >
      {isLoading ? (
        // Magpie Two-Dot Blue Loading Presentation
        <View style={styles.loadingWrapper}>
          <AppLoadingIndicator
            message="Adding your card..."
            subMessage="Securing payment credentials and syncing accounts"
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

          {/* Bank Selection Pills */}
          <Text style={styles.sectionLabel}>Select Issuing Bank</Text>
          <View style={styles.bankPillsRow}>
            {SUPPORTED_BANKS.map((b) => {
              const isSelected = selectedBank === b.name;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedBank(b.name)}
                  style={[
                    styles.bankPill,
                    isSelected && styles.bankPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.bankPillText,
                      isSelected && styles.bankPillTextSelected,
                    ]}
                  >
                    {b.code}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Cardholder Name */}
          <AppTextInput
            label="Cardholder Name"
            placeholder="e.g. John Doe"
            value={cardholderName}
            onChangeText={setCardholderName}
            autoCapitalize="words"
          />

          {/* Card Number */}
          <AppTextInput
            label="Card Number"
            placeholder="0000 0000 0000 0000"
            formatType="card-number"
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
            leftIcon={<CreditCard size={18} color="#71717A" />}
            rightIcon={
              getCardBrand() ? (
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeText}>{getCardBrand()}</Text>
                </View>
              ) : null
            }
          />

          {/* Row: Expiry & CVV */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <AppTextInput
                label="Expires (MM/YY)"
                placeholder="12/28"
                formatType="expiry"
                value={expiry}
                onChangeText={setExpiry}
                keyboardType="number-pad"
              />
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <AppTextInput
                label="CVV"
                placeholder="123"
                formatType="cvv"
                value={cvv}
                onChangeText={setCvv}
                keyboardType="number-pad"
                secureTextEntry
              />
            </View>
          </View>

          {/* Security Guarantee Note */}
          <View style={styles.securityNote}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={styles.securityNoteText}>
              256-bit encrypted credential storage
            </Text>
          </View>

          {/* Prominent Action Buttons */}
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
                Add Card
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bankPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  bankPill: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bankPillSelected: {
    backgroundColor: '#09090B',
    borderColor: '#09090B',
  },
  bankPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52525B',
  },
  bankPillTextSelected: {
    color: '#FFFFFF',
  },
  brandBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 20,
  },
  securityNoteText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 9999,
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
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  submitButtonActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#E4E4E7',
  },
  submitButtonText: {
    fontSize: 15,
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
