import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AppModal } from './AppModal';
import { useAlertStore, AlertButton, AlertVariant } from '../../lib/stores/alertStore';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, Trash2 } from 'lucide-react-native';

let Haptics: any;
try {
  Haptics = require('expo-haptics');
} catch {}

export const AppAlertModal: React.FC = () => {
  const { visible, title, message, buttons, icon, variant, dismissOnBackdrop, hideAlert } =
    useAlertStore();

  if (!visible) return null;

  const handleButtonPress = (btn?: AlertButton) => {
    try {
      if (btn?.style === 'destructive') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}

    hideAlert();
    if (btn?.onPress) {
      // Execute after modal dismisses to prevent interaction conflicts
      setTimeout(() => {
        btn.onPress?.();
      }, 50);
    }
  };

  const renderIcon = () => {
    if (icon) return icon;

    switch (variant) {
      case 'destructive':
        return (
          <View style={[styles.iconWrapper, styles.iconDestructive]}>
            <AlertCircle size={24} color="#DC2626" strokeWidth={2.2} />
          </View>
        );
      case 'success':
        return (
          <View style={[styles.iconWrapper, styles.iconSuccess]}>
            <CheckCircle2 size={24} color="#16A34A" strokeWidth={2.2} />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconWrapper, styles.iconWarning]}>
            <AlertTriangle size={24} color="#D97706" strokeWidth={2.2} />
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[styles.iconWrapper, styles.iconPrimary]}>
            <Info size={24} color="#6366F1" strokeWidth={2.2} />
          </View>
        );
    }
  };

  const actionButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' as const }];
  const isTwoButtons = actionButtons.length === 2;

  return (
    <AppModal
      visible={visible}
      onClose={dismissOnBackdrop ? hideAlert : undefined}
      animationType="fade"
      dismissOnBackdrop={dismissOnBackdrop}
    >
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
        {/* Visual Badge Icon */}
        <View style={styles.iconContainer}>{renderIcon()}</View>

        {/* Title & Message */}
        {!!title && <Text style={styles.title}>{title}</Text>}
        {!!message && <Text style={styles.message}>{message}</Text>}

        {/* Buttons */}
        {isTwoButtons ? (
          <View style={styles.rowActions}>
            {actionButtons.map((btn, index) => {
              const isCancel = btn.style === 'cancel' || index === 0;
              const isDestructive = btn.style === 'destructive';

              return (
                <Pressable
                  key={`alert-btn-${index}`}
                  onPress={() => handleButtonPress(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    isCancel
                      ? styles.cancelButton
                      : isDestructive
                      ? styles.destructiveButton
                      : styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text || 'Action'}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.cancelButtonText
                        : isDestructive
                        ? styles.destructiveButtonText
                        : styles.primaryButtonText,
                    ]}
                  >
                    {btn.text || (isCancel ? 'Cancel' : 'Confirm')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.columnActions}>
            {actionButtons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              return (
                <Pressable
                  key={`alert-btn-${index}`}
                  onPress={() => handleButtonPress(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    styles.fullWidthButton,
                    isCancel
                      ? styles.cancelButton
                      : isDestructive
                      ? styles.destructiveButton
                      : styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text || 'OK'}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.cancelButtonText
                        : isDestructive
                        ? styles.destructiveButtonText
                        : styles.primaryButtonText,
                    ]}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Pressable>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: {
    backgroundColor: '#FEE2E2',
  },
  iconSuccess: {
    backgroundColor: '#DCFCE7',
  },
  iconWarning: {
    backgroundColor: '#FEF3C7',
  },
  iconPrimary: {
    backgroundColor: '#EEF2FF',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090B',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  columnActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 22,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButton: {
    flex: undefined,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cancelButton: {
    backgroundColor: '#F4F4F5',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
  },
  primaryButton: {
    backgroundColor: '#09090B',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  destructiveButton: {
    backgroundColor: '#FEE2E2',
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
