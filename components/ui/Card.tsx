import React from 'react';
import { View, Text, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <View
      className={`bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <View className={`mb-3 ${className}`}>{children}</View>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Text className={`text-lg font-bold text-zinc-900 ${className}`}>{children}</Text>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Text className={`text-sm text-zinc-500 mt-0.5 ${className}`}>{children}</Text>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <View className={className}>{children}</View>
);
