import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';

export interface AppLoadingIndicatorProps {
  message?: string;
  subMessage?: string;
  compact?: boolean;
}

export const AppLoadingIndicator: React.FC<AppLoadingIndicatorProps> = ({
  message = 'Loading...',
  subMessage,
  compact = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 440,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 440,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Dot 1: Scale 1.0 -> 1.55, Opacity 0.35 -> 1.0
  const dot1Scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.55],
  });
  const dot1Opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1.0],
  });

  // Dot 2: Inverted alternating phase! Scale 1.55 -> 1.0, Opacity 1.0 -> 0.35
  const dot2Scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.55, 1.0],
  });
  const dot2Opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 0.35],
  });

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {/* Signature Magpie Alternating Two-Dot Electric Blue Animation */}
      <View style={styles.dotsRow}>
        <Animated.View
          style={[
            styles.dot,
            compact && styles.dotCompact,
            {
              transform: [{ scale: dot1Scale }],
              opacity: dot1Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            compact && styles.dotCompact,
            {
              transform: [{ scale: dot2Scale }],
              opacity: dot2Opacity,
            },
          ]}
        />
      </View>

      {/* Status Typography */}
      {!!message && (
        <Text style={[styles.message, compact && styles.compactMessage]}>
          {message}
        </Text>
      )}

      {!!subMessage && (
        <Text style={styles.subMessage}>
          {subMessage}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  compactContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6', // Reference electric blue
    marginHorizontal: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  dotCompact: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  compactMessage: {
    fontSize: 13,
    marginTop: 8,
  },
  subMessage: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
});
