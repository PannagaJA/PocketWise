import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  Animated,
  BackHandler,
  StyleSheet,
  Dimensions,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';

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
}) => {
  const handleClose = onClose || onRequestClose;
  const [rendered, setRendered] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  const useDriver = Platform.OS !== 'web';

  // Smoothly lift the modal sheet when the soft keyboard appears (Android APK, iOS, Expo)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      Animated.timing(keyboardHeightAnim, {
        toValue: height,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 180,
        useNativeDriver: false,
      }).start();
    };

    const onKeyboardHide = (e: any) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 200) : 150,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: useDriver,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 26,
            stiffness: 280,
            useNativeDriver: useDriver,
          }),
        ]).start();
      } else if (animationType === 'fade') {
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
        handleClose();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [visible, handleClose]);

  if (!rendered) return null;

  const isSlide = animationType === 'slide';

  return (
    <Modal
      visible={rendered}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              opacity: fadeAnim,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              if (dismissOnBackdrop && handleClose) {
                Keyboard.dismiss();
                handleClose();
              }
            }}
          />
        </Animated.View>

        {/* Dynamic Keyboard-Avoiding Animated Container */}
        <Animated.View
          style={[
            styles.container,
            isSlide ? styles.slideContainer : styles.fadeContainer,
            {
              paddingBottom: keyboardHeightAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          {isSlide ? (
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
              pointerEvents="auto"
            >
              {children}
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                styles.dialog,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
              pointerEvents="auto"
            >
              {children}
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  container: {
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: 24,
    overflow: 'hidden',
  },
});


