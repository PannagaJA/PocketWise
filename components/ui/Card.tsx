import React from 'react';
import { View, Text, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <View
      className={`bg-white rounded-3xl p-5 border border-zinc-100 shadow-xs ${className}`}
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
  <Text className={`text-[17px] font-extrabold text-zinc-950 tracking-tight ${className}`}>{children}</Text>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Text className={`text-xs font-medium text-zinc-500 mt-0.5 ${className}`}>{children}</Text>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <View className={className}>{children}</View>
);

