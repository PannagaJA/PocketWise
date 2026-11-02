import React, { useState, useRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';

export interface AppTextInputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?: string;
  error?: string;
  hint?: string;
  formatType?: 'card-number' | 'expiry' | 'cvv' | 'default';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  value?: string;
  onChangeText?: (text: string) => void;
  containerStyle?: any;
}

export const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>(({
  label,
  error,
  hint,
  formatType = 'default',
  leftIcon,
  rightIcon,
  value = '',
  onChangeText,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const localInputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => localInputRef.current as TextInput);
  const [isFocused, setIsFocused] = useState(false);

  const focusInput = () => {
    localInputRef.current?.focus();
  };

  const handleChangeText = (rawText: string) => {
    if (!onChangeText) return;

    if (formatType === 'card-number') {
      // Remove all non-digits, cap at 16 digits, insert space every 4 digits
      const digits = rawText.replace(/\D/g, '').slice(0, 16);
      const formatted = digits.match(/.{1,4}/g)?.join(' ') || digits;
      onChangeText(formatted);
    } else if (formatType === 'expiry') {
      // Remove non-digits, cap at 4 digits, format MM/YY
      const digits = rawText.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        onChangeText(`${digits.slice(0, 2)}/${digits.slice(2)}`);
      } else {
        onChangeText(digits);
      }
    } else if (formatType === 'cvv') {
      // Numbers only, max 4 digits
      const digits = rawText.replace(/\D/g, '').slice(0, 4);
      onChangeText(digits);
    } else {
      onChangeText(rawText);
    }
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {!!label && (
        <Pressable onPress={focusInput} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Text style={styles.label}>{label}</Text>
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
        {!!leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={localInputRef}
          value={value}
          onChangeText={handleChangeText}
          placeholderTextColor="#A1A1AA"
          underlineColorAndroid="transparent"
          style={styles.input}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {!!rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </Pressable>

      {!!error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : !!hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 52,
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
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 2,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 4,
    marginLeft: 2,
  },
});
