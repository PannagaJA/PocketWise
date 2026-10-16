import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AppModal } from './AppModal';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import * as Haptics from 'expo-haptics';

export interface AppDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'destructive';
  destructive?: boolean;
  cancelLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
}

export const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  onClose,
  title,
  description,
  icon,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  destructive,
  cancelLabel = 'Cancel',
  onConfirm,
  isLoading = false,
  loadingMessage,
}) => {
  const isDestructive = destructive || confirmVariant === 'destructive';

  const handleConfirm = () => {
    try {
      Haptics.impactAsync(
        isDestructive
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
    } catch {}
    onConfirm();
  };

  const handleCancel = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      animationType="fade"
      dismissOnBackdrop={!isLoading}
    >
      <Pressable
        style={styles.dialogCard}
        onPress={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <AppLoadingIndicator
            message={loadingMessage || 'Processing...'}
            compact
          />
        ) : (
          <>
            {/* Optional Icon Header Badge */}
            {!!icon && <View style={styles.iconContainer}>{icon}</View>}

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleCancel}
                style={[styles.button, styles.cancelButton]}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                style={[
                  styles.button,
                  isDestructive
                    ? styles.destructiveButton
                    : styles.primaryButton,
                ]}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
              >
                <Text
                  style={[
                    styles.confirmText,
                    isDestructive && styles.destructiveText,
                  ]}
                >
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </Pressable>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '88%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090B',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F4F4F5',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
  },
  primaryButton: {
    backgroundColor: '#09090B',
  },
  destructiveButton: {
    backgroundColor: '#FEE2E2',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  destructiveText: {
    color: '#DC2626',
  },
});
