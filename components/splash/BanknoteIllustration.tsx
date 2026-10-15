import React from 'react';
import { View } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
  Filter,
  FeDropShadow,
} from 'react-native-svg';

interface BanknoteIllustrationProps {
  size?: number;
  showRays?: boolean;
  rayOpacity?: number;
  rayScale?: number;
}

export function BanknoteIllustration({
  size = 140,
  showRays = true,
}: BanknoteIllustrationProps) {
  const width = size;
  const height = size * 1.05;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} viewBox="0 0 160 170" fill="none">
        <Defs>
          {/* Top Note Gradient */}
          <LinearGradient id="topNoteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#34D399" />
            <Stop offset="50%" stopColor="#10B981" />
            <Stop offset="100%" stopColor="#059669" />
          </LinearGradient>

          {/* Middle Note Gradient */}
          <LinearGradient id="midNoteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#10B981" />
            <Stop offset="100%" stopColor="#047857" />
          </LinearGradient>

          {/* Base Note Gradient */}
          <LinearGradient id="baseNoteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#059669" />
            <Stop offset="100%" stopColor="#064E3B" />
          </LinearGradient>

          {/* Ribbon / Emblem Gradient */}
          <LinearGradient id="emblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#6EE7B7" />
            <Stop offset="100%" stopColor="#10B981" />
          </LinearGradient>

          {/* Golden Orange Ray Gradient */}
          <LinearGradient id="rayGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </LinearGradient>
        </Defs>

        {/* --- BOTTOM SHADOW --- */}
        <Circle cx="80" cy="155" r="42" fill="#000000" fillOpacity="0.07" />

        {/* --- BANKNOTE 3 (Bottom Layer: Dark Forest Emerald) --- */}
        <G transform="translate(80, 118) rotate(-7) translate(-54, -28)">
          <Rect
            x="0"
            y="0"
            width="108"
            height="56"
            rx="8"
            fill="url(#baseNoteGrad)"
            opacity="0.9"
          />
          <Rect
            x="4"
            y="4"
            width="100"
            height="48"
            rx="6"
            stroke="#047857"
            strokeWidth="1.2"
            strokeDasharray="4 2"
            fill="none"
          />
        </G>

        {/* --- BANKNOTE 2 (Middle Layer: Jade Emerald) --- */}
        <G transform="translate(80, 108) rotate(5) translate(-54, -28)">
          <Rect
            x="0"
            y="0"
            width="108"
            height="56"
            rx="8"
            fill="url(#midNoteGrad)"
          />
          <Rect
            x="4"
            y="4"
            width="100"
            height="48"
            rx="6"
            stroke="#34D399"
            strokeWidth="1.2"
            strokeDasharray="4 2"
            fill="none"
          />
          {/* Subtle inner corner embellishments */}
          <Circle cx="12" cy="12" r="3" fill="#34D399" fillOpacity="0.6" />
          <Circle cx="96" cy="12" r="3" fill="#34D399" fillOpacity="0.6" />
          <Circle cx="12" cy="44" r="3" fill="#34D399" fillOpacity="0.6" />
          <Circle cx="96" cy="44" r="3" fill="#34D399" fillOpacity="0.6" />
        </G>

        {/* --- BANKNOTE 1 (Top Hero Layer: Vibrant Mint & Emerald with Medallion) --- */}
        <G transform="translate(80, 96) rotate(-1.5) translate(-54, -28)">
          {/* Main Banknote Body */}
          <Rect
            x="0"
            y="0"
            width="108"
            height="56"
            rx="8"
            fill="url(#topNoteGrad)"
          />

          {/* Outer Border Inset */}
          <Rect
            x="3.5"
            y="3.5"
            width="101"
            height="49"
            rx="6"
            stroke="#A7F3D0"
            strokeWidth="1.5"
            fill="none"
          />

          {/* Delicate Guilloche Dotted Outline */}
          <Rect
            x="6.5"
            y="6.5"
            width="95"
            height="43"
            rx="4.5"
            stroke="#065F46"
            strokeWidth="1"
            strokeDasharray="2.5 1.5"
            fill="none"
          />

          {/* Corner Pockets / Badges */}
          <Circle cx="12" cy="12" r="4.5" fill="#047857" />
          <Circle cx="12" cy="12" r="2.5" fill="#A7F3D0" />

          <Circle cx="96" cy="12" r="4.5" fill="#047857" />
          <Circle cx="96" cy="12" r="2.5" fill="#A7F3D0" />

          <Circle cx="12" cy="44" r="4.5" fill="#047857" />
          <Circle cx="12" cy="44" r="2.5" fill="#A7F3D0" />

          <Circle cx="96" cy="44" r="4.5" fill="#047857" />
          <Circle cx="96" cy="44" r="2.5" fill="#A7F3D0" />

          {/* Center Medallion Shield / Circle */}
          <Circle cx="54" cy="28" r="16" fill="#047857" fillOpacity="0.3" />
          <Circle cx="54" cy="28" r="13" fill="url(#emblemGrad)" />
          <Circle cx="54" cy="28" r="11" stroke="#065F46" strokeWidth="1" strokeDasharray="2 1" fill="none" />

          {/* PocketWise "P" Monogram / Currency Glyph inside medallion */}
          <Path
            d="M 50 20 L 55 20 C 57.5 20 59 21.5 59 24 C 59 26.5 57.5 28 55 28 L 50 28 Z M 50 28 L 50 36"
            stroke="#064E3B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Subtle Decorative Flow Lines */}
          <Path
            d="M 22 28 C 30 25 34 31 40 28"
            stroke="#A7F3D0"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 68 28 C 74 25 78 31 86 28"
            stroke="#A7F3D0"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
}

/**
 * Separate component for the 3 short orange accent rays
 * radiating above the banknote stack.
 * Allows independent animation (scale, opacity, pop).
 */
export function AccentRays({ size = 70 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.45} viewBox="0 0 70 32" fill="none">
      <Defs>
        <LinearGradient id="accentRayGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor="#FB923C" />
          <Stop offset="100%" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>

      {/* Left angled ray */}
      <Path
        d="M 16 28 L 10 8"
        stroke="url(#accentRayGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Center vertical ray */}
      <Path
        d="M 35 24 L 35 4"
        stroke="url(#accentRayGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Right angled ray */}
      <Path
        d="M 54 28 L 60 8"
        stroke="url(#accentRayGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Svg>
  );
}
