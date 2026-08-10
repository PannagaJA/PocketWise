import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'income' | 'expense' | 'subscription' | 'budget' | 'outline';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', className = '' }) => {
  let bgStyle = 'bg-zinc-100 border-zinc-200 text-zinc-800';

  if (variant === 'income') bgStyle = 'bg-emerald-50 border-emerald-200 text-emerald-700';
  else if (variant === 'expense') bgStyle = 'bg-rose-50 border-rose-200 text-rose-700';
  else if (variant === 'subscription') bgStyle = 'bg-indigo-50 border-indigo-200 text-indigo-700';
  else if (variant === 'budget') bgStyle = 'bg-amber-50 border-amber-200 text-amber-700';
  else if (variant === 'outline') bgStyle = 'bg-transparent border-zinc-300 text-zinc-700';

  return (
    <View className={`self-start px-2.5 py-1 rounded-full border ${bgStyle} ${className}`}>
      <Text className={`text-xs font-semibold ${bgStyle.split(' ').pop()}`}>{label}</Text>
    </View>
  );
};
