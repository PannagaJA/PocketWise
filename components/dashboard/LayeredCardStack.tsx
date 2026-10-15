import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, {
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Account } from '../../lib/services/account.service';
import { AtmCardVisual } from './AtmCardVisual';
import {
  getAtmCardTheme,
  getDeterministicCardLast4,
  AtmCardTheme,
} from '../../lib/dashboard/atmCardThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LayeredCardStackProps {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  selectedAccountName: string;
  accountCount: number;
  accounts?: Account[];
  selectedBankId?: string;
  userName?: string;
  onPressAccountSelect: () => void;
  onSelectAccount?: (bankId: string) => void;
  formatMoney: (amount: number) => string;
}

export function LayeredCardStack({
  totalBalance,
  monthlyIncome,
  monthlyExpense,
  selectedAccountName,
  accountCount,
  accounts = [],
  selectedBankId = 'all',
  userName,
  onPressAccountSelect,
  onSelectAccount,
  formatMoney,
}: LayeredCardStackProps) {
  // Staggered entrance animation values for the background accent cards
  const cardBackLeftScale = useSharedValue(0.88);
  const cardBackLeftTranslateY = useSharedValue(24);
  const cardBackLeftRotate = useSharedValue(0);

  const cardBackRightScale = useSharedValue(0.90);
  const cardBackRightTranslateY = useSharedValue(20);
  const cardBackRightRotate = useSharedValue(0);

  const cardBehindRotate = useSharedValue(0);
  const heroCardOpacity = useSharedValue(0);
  const heroCardScale = useSharedValue(0.94);
  const heroCardTranslateY = useSharedValue(16);

  // --- Physical Card Loop Animation Shared Values ---
  // Front Card (Active Bank)
  const frontCardX = useSharedValue(0);
  const frontCardY = useSharedValue(0);
  const frontCardRotate = useSharedValue(0);
  const frontCardScale = useSharedValue(1);
  const frontCardZIndex = useSharedValue(10);

  // Back Card (Upcoming Bank in sequence)
  const backCardScale = useSharedValue(0.93);
  const backCardTranslateY = useSharedValue(-14);
  const backCardZIndex = useSharedValue(5);
  const backCardOpacity = useSharedValue(0.96);

  const isSwiping = useSharedValue(false);
  const lastReportedDir = useSharedValue<'next' | 'prev'>('next');
  const isShufflingRef = useRef(false);
  const [swipeDirection, setSwipeDirection] = useState<'next' | 'prev'>('next');

  // Array of bank navigation options: ['all', ...accountIds]
  const bankOptions = useMemo(() => {
    if (accounts.length === 0) return ['all'];
    return ['all', ...accounts.map((a) => a.id)];
  }, [accounts]);

  const currentIndex = useMemo(() => {
    const idx = bankOptions.indexOf(selectedBankId);
    return idx >= 0 ? idx : 0;
  }, [bankOptions, selectedBankId]);

  const bankOptionsCount = bankOptions.length;

  useEffect(() => {
    // Staggered entrance physics on launch
    cardBackLeftScale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 100 }));
    cardBackLeftTranslateY.value = withDelay(100, withSpring(-10, { damping: 14, stiffness: 100 }));
    cardBackLeftRotate.value = withDelay(100, withSpring(-6, { damping: 13, stiffness: 90 }));

    cardBackRightScale.value = withDelay(170, withSpring(1, { damping: 14, stiffness: 100 }));
    cardBackRightTranslateY.value = withDelay(170, withSpring(-6, { damping: 14, stiffness: 100 }));
    cardBackRightRotate.value = withDelay(170, withSpring(5.5, { damping: 13, stiffness: 90 }));

    cardBehindRotate.value = withDelay(240, withSpring(-1.5, { damping: 14, stiffness: 95 }));

    heroCardOpacity.value = withDelay(280, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
    heroCardScale.value = withDelay(280, withSpring(1, { damping: 15, stiffness: 120 }));
    heroCardTranslateY.value = withDelay(280, withSpring(0, { damping: 15, stiffness: 120 }));
  }, []);

  const resetDeckLayers = () => {
    isShufflingRef.current = false;
    frontCardZIndex.value = 10;
    frontCardScale.value = 1;
    frontCardX.value = 0;
    frontCardY.value = 0;
    frontCardRotate.value = 0;

    backCardZIndex.value = 5;
    backCardScale.value = 0.93;
    backCardTranslateY.value = -14;
    backCardOpacity.value = 0.96;
    isSwiping.value = false;
  };

  // When selectedBankId updates in props, React has updated the cards in the DOM!
  // Slot 1 (frontCard) is now rendering the newly selected bank!
  // Now we can instantaneously reset the layer zIndexes with ZERO visual flash.
  useEffect(() => {
    if (isShufflingRef.current) {
      resetDeckLayers();
    }
  }, [selectedBankId]);

  // When card shuffle completes, commit state change and prepare seamless slot handover
  const finalizeSwipe = (direction: 'next' | 'prev') => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    const newIdx =
      direction === 'next'
        ? (currentIndex + 1) % bankOptions.length
        : (currentIndex - 1 + bankOptions.length) % bankOptions.length;

    const nextBankId = bankOptions[newIdx];

    // Hold frontCard in the rear (zIndex: 2) and backCard in front (zIndex: 10)
    // until React re-renders with the new selectedBankId.
    // This prevents the old front card from momentarily flashing back on top.
    isShufflingRef.current = true;

    if (onSelectAccount) {
      onSelectAccount(nextBankId);
    }

    // Safety timeout in case selectedBankId prop doesn't change
    setTimeout(() => {
      if (isShufflingRef.current) {
        resetDeckLayers();
      }
    }, 600);
  };

  // Pan Gesture: drag top card out, loop it to the back, bring back card to the front
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-25, 25])
    .onStart(() => {
      'worklet';
      isSwiping.value = true;
      lastReportedDir.value = 'next';
    })
    .onUpdate((event) => {
      'worklet';
      frontCardX.value = event.translationX;
      frontCardY.value = event.translationY * 0.12;
      frontCardRotate.value = (event.translationX / SCREEN_WIDTH) * 22;

      // Update back card direction if crossed threshold so correct card is displayed behind
      if (event.translationX < -15 && lastReportedDir.value !== 'next') {
        lastReportedDir.value = 'next';
        runOnJS(setSwipeDirection)('next');
      } else if (event.translationX > 15 && lastReportedDir.value !== 'prev') {
        lastReportedDir.value = 'prev';
        runOnJS(setSwipeDirection)('prev');
      }

      // As front card is dragged, back card visibly scales and moves forward
      const dragProgress = Math.min(Math.abs(event.translationX) / 140, 1);
      backCardScale.value = 0.93 + dragProgress * 0.07;
      backCardTranslateY.value = -14 + dragProgress * 14;
      backCardOpacity.value = 0.96 + dragProgress * 0.04;
    })
    .onEnd((event) => {
      'worklet';
      const shouldSwipe =
        Math.abs(event.translationX) > 70 || Math.abs(event.velocityX) > 420;

      if (shouldSwipe && bankOptionsCount > 1) {
        const direction =
          event.translationX < 0 || event.velocityX < -420 ? 'next' : 'prev';
        const flyOutX =
          direction === 'next' ? -SCREEN_WIDTH * 0.72 : SCREEN_WIDTH * 0.72;

        if (lastReportedDir.value !== direction) {
          lastReportedDir.value = direction;
          runOnJS(setSwipeDirection)(direction);
        }

        // 1. Slide front card out to the side
        frontCardX.value = withTiming(
          flyOutX,
          { duration: 160, easing: Easing.out(Easing.quad) },
          (finishedOut) => {
            'worklet';
            if (finishedOut) {
              // 2. Drop front card's zIndex behind back card
              frontCardZIndex.value = 2;
              frontCardScale.value = 0.90;

              // 3. Slide front card back into the rear of the deck
              frontCardX.value = withTiming(0, {
                duration: 200,
                easing: Easing.out(Easing.quad),
              });
              frontCardY.value = withTiming(0, { duration: 200 });
              frontCardRotate.value = withTiming(0, { duration: 200 }, (finishedIn) => {
                'worklet';
                if (finishedIn) {
                  // 4. Commit new active bank state on JS thread
                  runOnJS(finalizeSwipe)(direction);
                }
              });
            }
          }
        );

        // 5. Simultaneously, spring back card into front position
        backCardZIndex.value = 10;
        backCardScale.value = withSpring(1.0, { damping: 16, stiffness: 140 });
        backCardTranslateY.value = withSpring(0, { damping: 16, stiffness: 140 });
        backCardOpacity.value = withTiming(1.0, { duration: 180 });
      } else {
        // Snap back if threshold not met
        frontCardX.value = withSpring(0, { damping: 18, stiffness: 160 });
        frontCardY.value = withSpring(0, { damping: 18, stiffness: 160 });
        frontCardRotate.value = withSpring(0, { damping: 18, stiffness: 160 });
        backCardScale.value = withSpring(0.93, { damping: 14, stiffness: 110 });
        backCardTranslateY.value = withSpring(-14, { damping: 14, stiffness: 110 });
        backCardOpacity.value = withSpring(0.96);
        isSwiping.value = false;
      }
    });

  // Tap Gesture to open account picker
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      runOnJS(onPressAccountSelect)();
    });

  const cardGesture = Gesture.Race(panGesture, tapGesture);

  // Animated Styles
  const isAndroid = Platform.OS === 'android';

  const frontCardAnimatedStyle = useAnimatedStyle(() => ({
    zIndex: frontCardZIndex.value,
    opacity: heroCardOpacity.value,
    transform: [
      { translateX: frontCardX.value },
      { translateY: frontCardY.value + heroCardTranslateY.value },
      { scale: frontCardScale.value * heroCardScale.value },
      { rotate: `${frontCardRotate.value}deg` },
    ],
    elevation: isAndroid ? frontCardZIndex.value : 0,
  }));

  const backCardAnimatedStyle = useAnimatedStyle(() => ({
    zIndex: backCardZIndex.value,
    opacity: backCardOpacity.value,
    transform: [
      { translateY: backCardTranslateY.value },
      { scale: backCardScale.value },
      { rotate: `${cardBehindRotate.value}deg` },
    ],
    elevation: isAndroid ? backCardZIndex.value : 0,
  }));

  const backLeftStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardBackLeftScale.value },
      { translateY: cardBackLeftTranslateY.value },
      { rotate: `${cardBackLeftRotate.value}deg` },
    ],
  }));

  const backRightStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardBackRightScale.value },
      { translateY: cardBackRightTranslateY.value },
      { rotate: `${cardBackRightRotate.value}deg` },
    ],
  }));

  // Resolve Front Card (Currently active bank)
  const frontAccount =
    selectedBankId !== 'all'
      ? accounts.find((a) => a.id === selectedBankId)
      : accounts.length > 0
      ? accounts[0]
      : null;

  const frontTheme =
    selectedBankId === 'all'
      ? getAtmCardTheme('All Accounts Combined')
      : getAtmCardTheme(
          frontAccount?.name || selectedAccountName,
          frontAccount?.type,
          frontAccount?.color
        );

  const frontLast4 = frontAccount
    ? getDeterministicCardLast4(frontAccount.id || frontAccount.name)
    : '8892';

  // Resolve Back Card (Next or prev bank depending on swipe direction)
  const targetBackOptionId = useMemo(() => {
    if (bankOptionsCount <= 1) return selectedBankId;
    const targetIdx =
      swipeDirection === 'next'
        ? (currentIndex + 1) % bankOptions.length
        : (currentIndex - 1 + bankOptions.length) % bankOptions.length;
    return bankOptions[targetIdx];
  }, [bankOptions, bankOptionsCount, currentIndex, swipeDirection, selectedBankId]);

  const backAccount =
    targetBackOptionId !== 'all'
      ? accounts.find((a) => a.id === targetBackOptionId)
      : accounts.length > 0
      ? accounts[0]
      : null;

  const backTheme =
    targetBackOptionId === 'all'
      ? getAtmCardTheme('All Accounts Combined')
      : getAtmCardTheme(
          backAccount?.name || 'Selected Bank',
          backAccount?.type,
          backAccount?.color
        );

  const backBalance =
    targetBackOptionId === 'all' ? totalBalance : backAccount?.balance || 0;

  const backAccountName =
    targetBackOptionId === 'all' ? 'All Accounts Combined' : backAccount?.name || 'Bank';

  const backLast4 = backAccount
    ? getDeterministicCardLast4(backAccount.id || backAccount.name)
    : '4921';

  // Decorative Accent Cards behind (3rd & 4th in rotation)
  const otherAccounts = accounts.filter(
    (a) => a.id !== frontAccount?.id && a.id !== backAccount?.id
  );
  const layer2Account = otherAccounts[0] || null;
  const layer2Theme: AtmCardTheme = layer2Account
    ? getAtmCardTheme(layer2Account.name, layer2Account.type, layer2Account.color)
    : getAtmCardTheme('Axis Bank', 'bank');

  const layer3Account = otherAccounts[1] || null;
  const layer3Theme: AtmCardTheme = layer3Account
    ? getAtmCardTheme(layer3Account.name, layer3Account.type, layer3Account.color)
    : getAtmCardTheme('State Bank of India', 'bank');

  const handleCardPress = (account?: Account | null) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (account && onSelectAccount) {
      onSelectAccount(account.id);
    } else {
      onPressAccountSelect();
    }
  };

  return (
    <View style={styles.stackWrapper}>
      {/* Dedicated Card Deck Viewport */}
      <View style={styles.cardsDeckViewport}>
        {/* --- LAYER 4: Back-Left Accent Card --- */}
        <Animated.View style={[styles.backgroundCard, styles.layerCardShadow, backLeftStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => handleCardPress(layer3Account)}
          >
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="layer3Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={layer3Theme.gradientColors[0]} />
                  <Stop offset="60%" stopColor={layer3Theme.gradientColors[1]} />
                  <Stop offset="100%" stopColor={layer3Theme.gradientColors[2]} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" rx={24} fill="url(#layer3Grad)" />
              <Circle cx="32" cy="22" r="12" fill="rgba(255, 255, 255, 0.18)" />
              <Circle cx="48" cy="22" r="12" fill="rgba(255, 255, 255, 0.12)" />
            </Svg>
            <View style={styles.peekingLeftContent}>
              <Text style={styles.peekingBankText} numberOfLines={1}>
                {layer3Account?.name ? layer3Account.name.toUpperCase() : layer3Theme.shortName}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* --- LAYER 3: Back-Right Accent Card --- */}
        <Animated.View style={[styles.backgroundCard, styles.layerCardShadow, backRightStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => handleCardPress(layer2Account)}
          >
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="layer2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={layer2Theme.gradientColors[0]} />
                  <Stop offset="60%" stopColor={layer2Theme.gradientColors[1]} />
                  <Stop offset="100%" stopColor={layer2Theme.gradientColors[2]} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" rx={24} fill="url(#layer2Grad)" />
              <Circle cx="86%" cy="22" r="13" fill="rgba(255, 255, 255, 0.18)" />
              <Circle cx="93%" cy="22" r="13" fill="rgba(255, 255, 255, 0.12)" />
            </Svg>
            <View style={styles.peekingRightContent}>
              <Text style={styles.peekingBankText} numberOfLines={1}>
                {layer2Account?.name ? layer2Account.name.toUpperCase() : layer2Theme.shortName}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* --- LAYER 2: BACK CARD (Next Bank in Line) --- */}
        <Animated.View style={[styles.cardSlotContainer, backCardAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => handleCardPress(backAccount)}
          >
            <AtmCardVisual
              theme={backTheme}
              accountName={backAccountName}
              balance={backBalance}
              monthlyIncome={monthlyIncome}
              monthlyExpense={monthlyExpense}
              last4Digits={backLast4}
              cardholderName={userName || 'CARDHOLDER'}
              formatMoney={formatMoney}
              onPressPill={onPressAccountSelect}
              isHero={false}
            />
          </Pressable>
        </Animated.View>

        {/* --- LAYER 1: FRONT CARD (Active Bank) --- */}
        <GestureDetector gesture={cardGesture}>
          <Animated.View style={[styles.cardSlotContainer, frontCardAnimatedStyle]}>
            <AtmCardVisual
              theme={frontTheme}
              accountName={selectedAccountName}
              balance={totalBalance}
              monthlyIncome={monthlyIncome}
              monthlyExpense={monthlyExpense}
              last4Digits={frontLast4}
              cardholderName={userName || 'CARDHOLDER'}
              formatMoney={formatMoney}
              onPressPill={onPressAccountSelect}
              isHero
            />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* --- Pagination Indicator Dots (In Normal Flow) --- */}
      {bankOptions.length > 1 && (
        <View style={styles.paginationRow}>
          {bankOptions.map((opt, idx) => {
            const isActive = idx === currentIndex;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  onSelectAccount?.(opt);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <View
                  style={[
                    styles.paginationDot,
                    isActive && styles.paginationDotActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrapper: {
    width: '100%',
    marginVertical: 6,
    alignItems: 'center',
  },
  cardsDeckViewport: {
    width: '100%',
    height: 232,
    alignItems: 'center',
    position: 'relative',
  },
  backgroundCard: {
    position: 'absolute',
    width: '93%',
    height: 198,
    borderRadius: 24,
    top: 6,
    overflow: 'hidden',
  },
  cardSlotContainer: {
    position: 'absolute',
    width: '95%',
    height: 206,
    top: 22,
    borderRadius: 24,
  },
  layerCardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  peekingLeftContent: {
    position: 'absolute',
    top: 14,
    left: 18,
  },
  peekingRightContent: {
    position: 'absolute',
    top: 14,
    right: 18,
    alignItems: 'flex-end',
  },
  peekingBankText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E4E7',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#7C3AED',
  },
});
