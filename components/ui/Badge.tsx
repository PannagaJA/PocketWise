import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'income' | 'expense' | 'subscription' | 'budget' | 'outline' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', className = '' }) => {
  let bgStyle = 'bg-zinc-100 border-zinc-200/60';
  let textStyle = 'text-zinc-800';

  if (variant === 'income') {
    bgStyle = 'bg-emerald-50 border-emerald-200/60';
    textStyle = 'text-emerald-700';
  } else if (variant === 'expense') {
    bgStyle = 'bg-rose-50 border-rose-200/60';
    textStyle = 'text-rose-700';
  } else if (variant === 'subscription') {
    bgStyle = 'bg-indigo-50 border-indigo-200/60';
    textStyle = 'text-indigo-700';
  } else if (variant === 'budget') {
    bgStyle = 'bg-amber-50 border-amber-200/60';
    textStyle = 'text-amber-700';
  } else if (variant === 'outline') {
    bgStyle = 'bg-transparent border-zinc-200';
    textStyle = 'text-zinc-700';
  } else if (variant === 'neutral') {
    bgStyle = 'bg-zinc-100 border-transparent';
    textStyle = 'text-zinc-600';
  }

  return (
    <View className={`self-start px-2.5 py-1 rounded-full border ${bgStyle} ${className}`}>
      <Text className={`text-[11px] font-semibold tracking-wide ${textStyle}`}>{label}</Text>
    </View>
  );
};

