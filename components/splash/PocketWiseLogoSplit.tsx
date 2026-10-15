import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
  Circle,
} from 'react-native-svg';

interface PocketWiseLogoSplitProps {
  size?: number;
}

export function LogoSquircleBase({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Defs>
        <LinearGradient id="squircleBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#132B4F" />
          <Stop offset="45%" stopColor="#0B1B33" />
          <Stop offset="100%" stopColor="#071120" />
        </LinearGradient>
        <LinearGradient id="squircleStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#254B82" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#0E2342" stopOpacity="0.3" />
        </LinearGradient>
      </Defs>

      {/* Main Squircle Body */}
      <Rect
        x="10"
        y="10"
        width="140"
        height="140"
        rx="36"
        fill="url(#squircleBg)"
      />

      {/* Elegant Bevel Stroke */}
      <Rect
        x="10.5"
        y="10.5"
        width="139"
        height="139"
        rx="35.5"
        stroke="url(#squircleStroke)"
        strokeWidth="1.5"
      />
    </Svg>
  );
}

export function LogoMonogramP({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Defs>
        <LinearGradient id="monogramWhiteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="75%" stopColor="#F8FAFC" />
          <Stop offset="100%" stopColor="#E2E8F0" />
        </LinearGradient>
      </Defs>

      {/* 3D Stylized White "P" Monogram */}
      <Path
        d="M 44 54 C 44 41 53 34 68 34 L 98 34 C 114 34 124 44 124 58 C 124 72 114 82 98 82 L 68 82 L 68 116 C 68 118 64 120 60 119 L 46 114 C 44 113 44 111 44 109 Z M 68 50 L 68 66 L 94 66 C 101 66 106 63 106 58 C 106 53 101 50 94 50 Z"
        fill="url(#monogramWhiteGrad)"
      />
    </Svg>
  );
}

export function LogoGrowthChart({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Defs>
        <LinearGradient id="chartGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#06B6D4" />
          <Stop offset="55%" stopColor="#10B981" />
          <Stop offset="100%" stopColor="#34D399" />
        </LinearGradient>
      </Defs>

      {/* Upward Zigzag Financial Chart Line */}
      <Path
        d="M 38 130 L 58 108 L 74 120 L 100 92 L 114 102 L 126 84"
        stroke="url(#chartGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LogoArrowHead({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Defs>
        <LinearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#10B981" />
          <Stop offset="100%" stopColor="#34D399" />
        </LinearGradient>
      </Defs>

      {/* Sharp Arrowhead pointing up-right at apex */}
      <Path
        d="M 112 80 L 132 76 L 128 96 Z"
        fill="url(#arrowGrad)"
        stroke="url(#arrowGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
