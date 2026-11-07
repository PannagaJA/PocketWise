import { create } from 'zustand';
import React from 'react';

let Haptics: any;
try {
  Haptics = require('expo-haptics');
} catch {}

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export type AlertVariant = 'primary' | 'destructive' | 'success' | 'warning' | 'info';

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: React.ReactNode;
  variant?: AlertVariant;
  dismissOnBackdrop?: boolean;
}

interface AlertStoreState extends AlertConfig {
  visible: boolean;
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertStoreState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  icon: undefined,
  variant: 'primary',
  dismissOnBackdrop: true,

  showAlert: (config) => {
    // Determine auto-variant if not explicitly provided
    let variant = config.variant;
    if (!variant) {
      const lowerTitle = (config.title || '').toLowerCase();
      const hasDestructive = config.buttons?.some((b) => b.style === 'destructive');
      if (hasDestructive || lowerTitle.includes('delete') || lowerTitle.includes('remove')) {
        variant = 'destructive';
      } else if (
        lowerTitle.includes('error') ||
        lowerTitle.includes('failed') ||
        lowerTitle.includes('denied')
      ) {
        variant = 'destructive';
      } else if (
        lowerTitle.includes('success') ||
        lowerTitle.includes('saved') ||
        lowerTitle.includes('created') ||
        lowerTitle.includes('settled')
      ) {
        variant = 'success';
      } else if (
        lowerTitle.includes('warning') ||
        lowerTitle.includes('required') ||
        lowerTitle.includes('mismatch') ||
        lowerTitle.includes('invalid')
      ) {
        variant = 'warning';
      } else {
        variant = 'primary';
      }
    }

    try {
      if (variant === 'destructive') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (variant === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}

    set({
      visible: true,
      title: config.title || '',
      message: config.message || '',
      buttons: config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: 'OK', style: 'default' }],
      icon: config.icon,
      variant,
      dismissOnBackdrop: config.dismissOnBackdrop !== false,
    });
  },

  hideAlert: () => {
    set({
      visible: false,
      title: '',
      message: '',
      buttons: [],
      icon: undefined,
    });
  },
}));

/**
 * Universal drop-in alert service that replaces native Alert.alert
 * and provides typed helper methods.
 */
export const AppAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean; onDismiss?: () => void }
  ) => {
    useAlertStore.getState().showAlert({
      title,
      message,
      buttons,
      dismissOnBackdrop: options?.cancelable ?? true,
    });
  },

  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    options?: {
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      icon?: React.ReactNode;
    }
  ) => {
    useAlertStore.getState().showAlert({
      title,
      message,
      variant: options?.destructive ? 'destructive' : 'primary',
      icon: options?.icon,
      buttons: [
        {
          text: options?.cancelLabel || 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: options?.confirmLabel || 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    });
  },

  error: (title: string, message?: string, onOk?: () => void) => {
    useAlertStore.getState().showAlert({
      title,
      message,
      variant: 'destructive',
      buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
    });
  },

  success: (title: string, message?: string, onOk?: () => void) => {
    useAlertStore.getState().showAlert({
      title,
      message,
      variant: 'success',
      buttons: [{ text: 'Great', style: 'default', onPress: onOk }],
    });
  },

  dismiss: () => {
    useAlertStore.getState().hideAlert();
  },
};
