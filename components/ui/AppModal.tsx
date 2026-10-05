import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  Animated,
  BackHandler,
  StyleSheet,
  Dimensions,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalStore } from '../../lib/stores/modalStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AppModalProps {
  visible: boolean;
  onClose?: () => void;
  onRequestClose?: () => void;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'none';
  dismissOnBackdrop?: boolean;
  transparent?: boolean;
  statusBarTranslucent?: boolean;
}

export const AppModal: React.FC<AppModalProps> = ({
  visible,
  onClose,
  onRequestClose,
  children,
  animationType = 'slide',
  dismissOnBackdrop = true,
  statusBarTranslucent = true,
}) => {
  const insets = useSafeAreaInsets();
  const handleClose = onClose || onRequestClose;
  const [rendered, setRendered] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const keyboardOffsetAnim = useRef(new Animated.Value(0)).current;

  const useDriver = Platform.OS !== 'web';

  // Persist animated combinations across renders so native driver graph is stable and doesn't detach
  const combinedSheetTranslateY = useRef(
    Animated.subtract(slideAnim, keyboardOffsetAnim)
  ).current;

  // Coordinate modal visibility with global tab bar so floating navigation never overlaps modal
  useEffect(() => {
    if (rendered) {
      useModalStore.getState().openModal();
      return () => {
        useModalStore.getState().closeModal();
      };
    }
  }, [rendered]);

  // Smoothly slide the modal up on native UI thread when mobile keyboard appears
  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      if (height <= 0) return;
      setKeyboardHeight(height);

      Animated.timing(keyboardOffsetAnim, {
        toValue: height,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 200,
        useNativeDriver: useDriver,
      }).start();
    };

    const handleKeyboardHide = (e: any) => {
      setKeyboardHeight(0);
      Animated.timing(keyboardOffsetAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 200) : 180,
        useNativeDriver: useDriver,
      }).start();
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    const didShowSub = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const willHideSub = Keyboard.addListener('keyboardWillHide', handleKeyboardHide);
    const didHideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, [useDriver]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      keyboardOffsetAnim.setValue(0);
      if (animationType === 'slide') {
        slideAnim.setValue(SCREEN_HEIGHT);
        fadeAnim.setValue(0);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: useDriver,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 28,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: useDriver,
          }),
        ]).start();
      } else if (animationType === 'fade') {
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.92);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: useDriver,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 24,
            stiffness: 260,
            useNativeDriver: useDriver,
          }),
        ]).start();
      } else {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
        scaleAnim.setValue(1);
      }
    } else if (rendered) {
      Keyboard.dismiss();
      Animated.timing(keyboardOffsetAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: useDriver,
      }).start();
      if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: useDriver,
          }),
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: useDriver,
          }),
        ]).start(() => setRendered(false));
      } else if (animationType === 'fade') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: useDriver,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 150,
            useNativeDriver: useDriver,
          }),
        ]).start(() => setRendered(false));
      } else {
        setRendered(false);
      }
    }
  }, [visible]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (handleClose) {
        Keyboard.dismiss();
        handleClose();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [visible, handleClose]);

  if (!rendered) return null;

  const onModalRequestClose = () => {
    Keyboard.dismiss();
    if (handleClose) {
      handleClose();
    }
  };

  const isSlide = animationType === 'slide';
  const visibleSpaceAboveKeyboard = SCREEN_HEIGHT - keyboardHeight - insets.top - (Platform.OS === 'ios' ? 32 : 16);
  const maxDialogHeight = keyboardHeight > 0
    ? Math.min(SCREEN_HEIGHT * 0.85, Math.max(0, visibleSpaceAboveKeyboard))
    : SCREEN_HEIGHT * 0.85;

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onModalRequestClose}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        {/* Full-screen Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              opacity: fadeAnim,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (dismissOnBackdrop && handleClose) {
                Keyboard.dismiss();
                handleClose();
              }
            }}
          />
        </Animated.View>

        {/* Dynamic Container */}
        {isSlide ? (
          <View
            style={[styles.container, styles.slideContainer]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY: combinedSheetTranslateY }],
                  paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16),
                },
              ]}
              pointerEvents="auto"
            >
              {children}
            </Animated.View>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.container, styles.fadeContainer]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.dialog,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                  maxHeight: maxDialogHeight,
                },
              ]}
              pointerEvents="auto"
            >
              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ flexGrow: 0 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFill,
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    zIndex: 99999,
    elevation: 99999,
  },
  container: {
    ...StyleSheet.absoluteFill,
    flex: 1,
    width: '100%',
    height: '100%',
  },
  slideContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fadeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    height: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
});


