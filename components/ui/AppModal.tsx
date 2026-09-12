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

  // Active keyboard listener to dynamically push sheet above the soft keyboard on Android APK & iOS
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
        useNativeDriver: false,
      }).start();
    });

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
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 26,
            stiffness: 260,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (animationType === 'fade') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 22,
            stiffness: 240,
            useNativeDriver: true,
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
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setRendered(false));
      } else if (animationType === 'fade') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 150,
            useNativeDriver: true,
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

        {/* Dynamic Animated Keyboard Padding Container */}
        <Animated.View
          style={[
            styles.container,
            isSlide ? styles.slideContainer : styles.fadeContainer,
            { paddingBottom: keyboardHeightAnim },
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
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  slideContainer: {
    justifyContent: 'flex-end',
  },
  fadeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
});

