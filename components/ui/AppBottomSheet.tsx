import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { AppModal } from './AppModal';
import * as Haptics from 'expo-haptics';

export interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  showDragHandle?: boolean;
  dismissOnBackdrop?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: any;
  footer?: React.ReactNode;
}

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  showDragHandle = true,
  dismissOnBackdrop = true,
  headerRight,
  children,
  scrollable = false,
  contentContainerStyle,
  footer,
}) => {
  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      animationType="slide"
      dismissOnBackdrop={dismissOnBackdrop}
    >
      <Pressable
        style={styles.sheetContainer}
        onPress={(e) => e.stopPropagation()}
      >
        {/* Standardized Header */}
        {(!!title || !!headerRight) && (
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrapper}>
              {!!title && <Text style={styles.title}>{title}</Text>}
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            <View style={styles.headerActions}>
              {headerRight}
              <Pressable
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <X size={18} color="#71717A" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Body Content */}
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            bounces={true}
            contentContainerStyle={[
              styles.scrollContent,
              contentContainerStyle,
              !footer && { paddingBottom: 44 },
            ]}
            style={styles.scrollView}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.content,
              contentContainerStyle,
              !footer && { paddingBottom: 32 },
            ]}
          >
            {children}
          </View>
        )}

        {/* Optional Standard Sticky Bottom Action Footer */}
        {!!footer && (
          <View style={styles.footerContainer}>
            {footer}
          </View>
        )}
      </Pressable>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: 'transparent',
    width: '100%',
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  headerTextWrapper: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#09090B',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    width: '100%',
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  footerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    backgroundColor: '#FFFFFF',
  },
});
