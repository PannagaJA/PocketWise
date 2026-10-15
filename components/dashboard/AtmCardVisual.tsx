import React from 'react';
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
  ClipPath,
} from 'react-native-svg';
import { ChevronDown, CreditCard, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { AtmCardTheme, CardNetwork } from '../../lib/dashboard/atmCardThemes';

interface AtmCardVisualProps {
  theme: AtmCardTheme;
  accountName: string;
  balance: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  last4Digits: string;
  cardholderName?: string;
  formatMoney: (amount: number) => string;
  isHero?: boolean;
  onPressPill?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AtmCardVisual({
  theme,
  accountName,
  balance,
  monthlyIncome,
  monthlyExpense,
  last4Digits,
  cardholderName = 'CARDHOLDER',
  formatMoney,
  isHero = true,
  onPressPill,
  style,
}: AtmCardVisualProps) {
  const [c1, c2, c3] = theme.gradientColors;

  return (
    <View style={[styles.cardOuter, style]}>
      {/* --- SVG Background: Multi-Stop Gradient + Metallic Sheen + Background Curves --- */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`cardGrad_${theme.bankId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="50%" stopColor={c2} />
            <Stop offset="100%" stopColor={c3} />
          </LinearGradient>

          {/* Holographic / Metallic Diagonal Sheen */}
          <LinearGradient id={`sheenGrad_${theme.bankId}`} x1="0%" y1="0%" x2="100%" y2="70%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
          </LinearGradient>

          {/* Radial Corner Specular Highlight */}
          <LinearGradient id={`radialSpec_${theme.bankId}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Base Gradient Surface */}
        <Rect width="100%" height="100%" rx={24} fill={`url(#cardGrad_${theme.bankId})`} />

        {/* Subtle Geometric / Wave Pattern based on Bank Theme */}
        {theme.patternType === 'waves' && (
          <G opacity={0.12}>
            <Path
              d="M -40 80 Q 80 0 240 60 T 450 40"
              stroke="#FFFFFF"
              strokeWidth="18"
              fill="none"
            />
            <Path
              d="M -30 130 Q 120 40 280 110 T 480 90"
              stroke="#FFFFFF"
              strokeWidth="12"
              fill="none"
            />
            <Circle cx="88%" cy="22%" r="80" stroke="#FFFFFF" strokeWidth="2" fill="none" />
          </G>
        )}

        {theme.patternType === 'geometric' && (
          <G opacity={0.1}>
            <Path
              d="M 120 -20 L 260 220 L 320 220 L 180 -20 Z"
              fill="#FFFFFF"
            />
            <Path
              d="M 180 -20 L 320 220 L 350 220 L 210 -20 Z"
              fill="#FFFFFF"
            />
          </G>
        )}

        {theme.patternType === 'mesh' && (
          <G opacity={0.08}>
            <Circle cx="90%" cy="15%" r="110" fill={`url(#sheenGrad_${theme.bankId})`} />
            <Path
              d="M -20 160 Q 140 40 380 120"
              stroke="#FFFFFF"
              strokeWidth="24"
              fill="none"
            />
          </G>
        )}

        {/* Diagonal Luster Sheen */}
        <Rect width="100%" height="100%" rx={24} fill={`url(#sheenGrad_${theme.bankId})`} />
        <Circle cx="95%" cy="8%" r="130" fill={`url(#radialSpec_${theme.bankId})`} />
      </Svg>

      {/* --- Card Face Foreground Layout --- */}
      <View style={styles.contentContainer}>
        {/* Row 1: Bank Branding & Account Selector Badge */}
        <View style={styles.topRow}>
          <View style={styles.bankNameGroup}>
            <Text style={styles.bankTitleText} numberOfLines={1}>
              {theme.bankName}
            </Text>
            <Text style={styles.cardTierText} numberOfLines={1}>
              {theme.cardTier}
            </Text>
          </View>

          {/* Account selector badge / pill */}
          <View style={styles.accountBadgePill}>
            <CreditCard size={12} color="#FFFFFF" opacity={0.9} />
            <Text style={styles.accountBadgeText} numberOfLines={1}>
              {accountName}
            </Text>
            <ChevronDown size={13} color="#FFFFFF" opacity={0.8} />
          </View>
        </View>

        {/* Row 2: Authentic EMV Smart Chip + Contactless Waves & Balance */}
        <View style={styles.midRow}>
          {/* Chip + Contactless waves */}
          <View style={styles.chipAndNfcRow}>
            {/* 5-segment metallic EMV Smart Chip */}
            <View style={styles.emvChip}>
              <View style={styles.emvChipCore} />
              <View style={styles.emvChipHLine} />
              <View style={styles.emvChipVLine} />
            </View>

            {/* Contactless NFC Waves Icon (4 concentric arcs) */}
            <View style={styles.contactlessContainer}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M 5 4 A 14 14 0 0 1 5 20"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity={0.4}
                />
                <Path
                  d="M 9 7 A 10 10 0 0 1 9 17"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity={0.65}
                />
                <Path
                  d="M 13 10 A 6 6 0 0 1 13 14"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity={0.9}
                />
              </Svg>
            </View>
          </View>

          {/* Live Balance Amount */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(balance)}
            </Text>
          </View>
        </View>

        {/* Row 3: Embossed 16-Digit Card Number */}
        <View style={styles.cardNumberRow}>
          <Text style={styles.embossedCardNumber}>
            ••••   ••••   ••••   {last4Digits}
          </Text>
        </View>

        {/* Row 4: Cardholder Name, Expiry & Card Network Badge */}
        <View style={styles.bottomRow}>
          {/* Cardholder & Expiry */}
          <View style={styles.holderAndExpiryGroup}>
            <View style={styles.expiryRow}>
              <Text style={styles.validThruLabel}>VALID{'\n'}THRU</Text>
              <Text style={styles.expiryValue}>10/29</Text>
            </View>
            <Text style={styles.cardholderNameText} numberOfLines={1}>
              {cardholderName.toUpperCase()}
            </Text>
          </View>

          {/* Network Badge: Visa / Mastercard / RuPay */}
          <View style={styles.networkBadgeWrapper}>
            {theme.cardNetwork === 'visa' && <VisaLogo />}
            {theme.cardNetwork === 'mastercard' && <MastercardLogo />}
            {theme.cardNetwork === 'rupay' && <RuPayLogo />}
            {theme.cardNetwork === 'pocketwise' && <PocketWiseLogo />}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Authentic Visa Wordmark
 */
function VisaLogo() {
  return (
    <View style={styles.networkLogoContainer}>
      <Text style={styles.visaText}>VISA</Text>
    </View>
  );
}

/**
 * Authentic Mastercard Dual Intersecting Circles
 */
function MastercardLogo() {
  return (
    <View style={styles.mcContainer}>
      <Svg width={38} height={24} viewBox="0 0 38 24">
        {/* Red circle (left) */}
        <Circle cx="12" cy="12" r="10.5" fill="#EB001B" />
        {/* Yellow circle (right) */}
        <Circle cx="24" cy="12" r="10.5" fill="#F79E1B" />
        {/* Intersecting translucent overlay */}
        <Circle cx="12" cy="12" r="10.5" fill="#FF5F00" opacity={0.65} />
      </Svg>
    </View>
  );
}

/**
 * Authentic RuPay Logo
 */
function RuPayLogo() {
  return (
    <View style={styles.rupayContainer}>
      <Svg width={46} height={20} viewBox="0 0 52 22">
        <Text style={styles.rupayText}>RuPay</Text>
        {/* Modern Orange & Cyan dual Chevrons */}
        <Path d="M 38 4 L 43 11 L 38 18 L 41 18 L 46 11 L 41 4 Z" fill="#F37021" />
        <Path d="M 44 4 L 49 11 L 44 18 L 47 18 L 52 11 L 47 4 Z" fill="#00A0E3" />
      </Svg>
    </View>
  );
}

/**
 * PocketWise Asset Mark
 */
function PocketWiseLogo() {
  return (
    <View style={styles.pwBadge}>
      <Text style={styles.pwBadgeText}>POCKETWISE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    height: 204,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.38,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bankNameGroup: {
    flex: 1,
    marginRight: 10,
  },
  bankTitleText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTierText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.72)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  accountBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    maxWidth: '48%',
  },
  accountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  midRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  chipAndNfcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emvChip: {
    width: 35,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#FDE047',
    borderWidth: 1,
    borderColor: '#CA8A04',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emvChipCore: {
    width: 13,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#B45309',
    backgroundColor: '#FEF08A',
  },
  emvChipHLine: {
    position: 'absolute',
    width: 35,
    height: 1,
    backgroundColor: '#B45309',
  },
  emvChipVLine: {
    position: 'absolute',
    height: 26,
    width: 1,
    backgroundColor: '#B45309',
  },
  contactlessContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  cardNumberRow: {
    marginVertical: 1,
  },
  embossedCardNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2.8,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderAndExpiryGroup: {
    flex: 1,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  validThruLabel: {
    fontSize: 6,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.5,
    lineHeight: 7,
  },
  expiryValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  cardholderNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.95,
  },
  networkBadgeWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  networkLogoContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  visaText: {
    fontSize: 19,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mcContainer: {
    width: 38,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rupayContainer: {
    height: 22,
    justifyContent: 'center',
  },
  rupayText: {
    fontSize: 13,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pwBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pwBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
