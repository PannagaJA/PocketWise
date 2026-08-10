import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, containerClassName = '', className = '', ...props }) => {
  return (
    <View className={`w-full mb-3 ${containerClassName}`}>
      {label && <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">{label}</Text>}
      <TextInput
        placeholderTextColor="#9CA3AF"
        className={`w-full bg-white border ${
          error ? 'border-red-500' : 'border-zinc-200'
        } rounded-xl px-4 py-3 text-base text-zinc-900 focus:border-zinc-900 ${className}`}
        {...props}
      />
      {error && <Text className="text-xs text-red-500 mt-1 font-medium">{error}</Text>}
    </View>
  );
};
