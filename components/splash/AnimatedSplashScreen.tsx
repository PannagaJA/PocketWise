import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import {
  LogoSquircleBase,
  LogoMonogramP,
  LogoGrowthChart,
  LogoArrowHead,
} from './PocketWiseLogoSplit';

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

const TRACK_WIDTH = 144;
const LOGO_SIZE = 136;

export function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  // Master container fade
  const containerOpacity = useSharedValue(1);

  // Frame 1: Base Squircle
  const baseScale = useSharedValue(0.65);
  const baseOpacity = useSharedValue(0);

  // Frame 2: Monogram "P"
  const pOpacity = useSharedValue(0);
  const pTranslateY = useSharedValue(-26);
  const pScale = useSharedValue(0.85);

  // Frame 3: Growth Chart Zigzag
  const chartOpacity = useSharedValue(0);
  const chartTranslateX = useSharedValue(-20);
  const chartTranslateY = useSharedValue(20);
  const chartScale = useSharedValue(0.8);

  // Frame 4: Arrowhead Burst
  const arrowOpacity = useSharedValue(0);
  const arrowScale = useSharedValue(0);

  // Frame 5: Branding & Tagline
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(12);

  // Frame 6: Progress Bar (0 to 1)
  const progress = useSharedValue(0);

  useEffect(() => {
    // === FRAME 1 (0ms - 350ms): Base squircle springs in ===
    baseOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });
    baseScale.value = withSpring(1, { damping: 13, stiffness: 100 });

    // === FRAME 2 (280ms - 650ms): White 3D "P" monogram descends into place ===
    pOpacity.value = withDelay(
      280,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) })
    );
    pTranslateY.value = withDelay(
      280,
      withSpring(0, { damping: 14, stiffness: 110 })
    );
    pScale.value = withDelay(
      280,
      withSpring(1, { damping: 14, stiffness: 110 })
    );

    // === FRAME 3 (500ms - 900ms): Turquoise growth chart surges from bottom-left ===
    chartOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) })
    );
    chartTranslateX.value = withDelay(
      500,
      withSpring(0, { damping: 14, stiffness: 120 })
    );
    chartTranslateY.value = withDelay(
      500,
      withSpring(0, { damping: 14, stiffness: 120 })
    );
    chartScale.value = withDelay(
      500,
      withSpring(1, { damping: 14, stiffness: 120 })
    );

    // === FRAME 4 (720ms - 1050ms): Arrowhead bursts into apex ===
    arrowOpacity.value = withDelay(
      720,
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) })
    );
    arrowScale.value = withDelay(
      720,
      withSequence(
        withSpring(1.35, { damping: 10, stiffness: 160 }),
        withSpring(1.0, { damping: 12, stiffness: 140 })
      )
    );

    // === FRAME 5 (900ms - 1300ms): PocketWise wordmark & tagline reveal ===
    textOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) })
    );
    textTranslateY.value = withDelay(
      900,
      withSpring(0, { damping: 16, stiffness: 120 })
    );

    // === FRAME 6 (200ms - 1800ms): Progress bar smoothly fills to 100% ===
    progress.value = withDelay(
      200,
      withTiming(
        1,
        {
          duration: 1650,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        (finished) => {
          if (finished) {
            // === FRAME 7 (1950ms+): Seamless fade-out to Dashboard ===
            containerOpacity.value = withDelay(
              150,
              withTiming(
                0,
                { duration: 320, easing: Easing.out(Easing.quad) },
                (fadeFinished) => {
                  if (fadeFinished) {
                    runOnJS(onAnimationComplete)();
                  }
                }
              )
            );
          }
        }
      )
    );
  }, []);

  // Frame 1 style
  const baseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity.value,
    transform: [{ scale: baseScale.value }],
  }));

  // Frame 2 style
  const pAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pOpacity.value,
    transform: [
      { scale: pScale.value },
      { translateY: pTranslateY.value },
    ],
  }));

  // Frame 3 style
  const chartAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [
      { scale: chartScale.value },
      { translateX: chartTranslateX.value },
      { translateY: chartTranslateY.value },
    ],
  }));

  // Frame 4 style
  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ scale: arrowScale.value }],
  }));

  // Frame 5 style
  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  // Frame 6 style (GPU scaleX & translateX)
  const progressFillStyle = useAnimatedStyle(() => {
    const p = Math.max(0.001, Math.min(1, progress.value));
    return {
      transform: [
        { translateX: (p - 1) * (TRACK_WIDTH / 2) },
        { scaleX: p },
      ],
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Centered Brand & Split Animated Logo Area */}
      <View style={styles.content}>
        {/* Layered Split Logo Stage */}
        <View style={styles.logoStage}>
          {/* Layer 1: Base Squircle */}
          <Animated.View style={[StyleSheet.absoluteFill, baseAnimatedStyle]}>
            <LogoSquircleBase size={LOGO_SIZE} />
          </Animated.View>

          {/* Layer 2: White 3D "P" Monogram */}
          <Animated.View style={[StyleSheet.absoluteFill, pAnimatedStyle]}>
            <LogoMonogramP size={LOGO_SIZE} />
          </Animated.View>

          {/* Layer 3: Turquoise Growth Chart Line */}
          <Animated.View style={[StyleSheet.absoluteFill, chartAnimatedStyle]}>
            <LogoGrowthChart size={LOGO_SIZE} />
          </Animated.View>

          {/* Layer 4: Arrowhead Burst */}
          <Animated.View style={[StyleSheet.absoluteFill, arrowAnimatedStyle]}>
            <LogoArrowHead size={LOGO_SIZE} />
          </Animated.View>
        </View>

        {/* PocketWise Wordmark & Tagline */}
        <Animated.View style={[styles.brandContainer, textAnimatedStyle]}>
          <Text style={styles.brandText}>
            Pocket<Text style={styles.brandAccent}>Wise</Text>
          </Text>
          <Text style={styles.taglineText}>Smart wealth, effortless flow</Text>
        </Animated.View>
      </View>

      {/* Slim Lavender Progress Track with Purple Fill near bottom */}
      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressFillStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAF8FD', // Warm near-white with subtle lavender tint
    zIndex: 99999,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  logoStage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#071120',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  brandContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  brandText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#09090B', // Bold black
    letterSpacing: -0.6,
  },
  brandAccent: {
    color: '#059669', // Subtle emerald tie-in to logo growth arrow
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#71717A', // Muted slate
    letterSpacing: 0.2,
    marginTop: 6,
  },
  footer: {
    paddingBottom: 48,
    alignItems: 'center',
  },
  progressTrack: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDE9FE', // Slim lavender track
    overflow: 'hidden',
  },
  progressFill: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7C3AED', // Vibrant purple fill
  },
});
