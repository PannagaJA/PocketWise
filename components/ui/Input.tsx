import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerClassName = '',
  className = '',
  onFocus,
  onBlur,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={`w-full mb-3.5 ${containerClassName}`}>
      {!!label && (
        <Text className="text-[13px] font-semibold text-zinc-700 mb-1.5 ml-0.5">
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        <TextInput
          placeholderTextColor="#A1A1AA"
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...props}
        />
      </View>
      {!!error && (
        <Text className="text-xs text-rose-500 mt-1.5 ml-1 font-medium">{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    backgroundColor: '#F4F4F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  inputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
    height: '100%',
    width: '100%',
  },
});
