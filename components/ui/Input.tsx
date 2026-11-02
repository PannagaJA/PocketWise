import React, { useState, useRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, Pressable } from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(({
  label,
  error,
  containerClassName = '',
  className = '',
  onFocus,
  onBlur,
  style,
  ...props
}, ref) => {
  const localInputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => localInputRef.current as TextInput);
  const [isFocused, setIsFocused] = useState(false);

  const focusInput = () => {
    localInputRef.current?.focus();
  };

  return (
    <View className={`w-full mb-3.5 ${containerClassName}`}>
      {!!label && (
        <Pressable onPress={focusInput} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Text className="text-[13px] font-semibold text-zinc-700 mb-1.5 ml-0.5">
            {label}
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={focusInput}
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        <TextInput
          ref={localInputRef}
          placeholderTextColor="#A1A1AA"
          underlineColorAndroid="transparent"
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
      </Pressable>
      {!!error && (
        <Text className="text-xs text-rose-500 mt-1.5 ml-1 font-medium">{error}</Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';

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
