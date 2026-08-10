import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'income';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
}) => {
  const handlePress = () => {
    if (disabled || loading) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptics errors if unavailable
    }
    onPress();
  };

  let baseStyle = "flex-row items-center justify-center rounded-2xl active:opacity-80 ";
  
  if (size === 'sm') baseStyle += "px-3 py-2 ";
  else if (size === 'md') baseStyle += "px-4 py-3 ";
  else if (size === 'lg') baseStyle += "px-6 py-4 ";

  if (variant === 'primary') baseStyle += "bg-zinc-900 ";
  else if (variant === 'secondary') baseStyle += "bg-zinc-100 ";
  else if (variant === 'outline') baseStyle += "bg-white border border-zinc-200 ";
  else if (variant === 'ghost') baseStyle += "bg-transparent ";
  else if (variant === 'destructive') baseStyle += "bg-red-500 ";
  else if (variant === 'income') baseStyle += "bg-emerald-600 ";

  if (disabled || loading) baseStyle += "opacity-50 ";

  let textStyle = "font-semibold text-center ";
  if (variant === 'primary' || variant === 'destructive' || variant === 'income') {
    textStyle += "text-white ";
  } else if (variant === 'outline' || variant === 'secondary') {
    textStyle += "text-zinc-900 ";
  } else if (variant === 'ghost') {
    textStyle += "text-zinc-600 ";
  }

  if (size === 'sm') textStyle += "text-sm ";
  else if (size === 'md') textStyle += "text-base ";
  else if (size === 'lg') textStyle += "text-lg ";

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={variant === 'primary' || variant === 'destructive' || variant === 'income' ? "#FFF" : "#09090B"} />;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      return <Text className={textStyle}>{children}</Text>;
    }
    return children;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      className={`${baseStyle} ${className}`}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};
