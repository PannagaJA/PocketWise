import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';

export interface RecordRowProps {
  title: string;
  subtitle?: string;
  amount: number | string;
  isCredit?: boolean;
  date?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  badge?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const RecordRow: React.FC<RecordRowProps> = ({
  title,
  subtitle,
  amount,
  isCredit = false,
  date,
  icon,
  iconBgColor,
  iconColor,
  badge,
  onPress,
  showDivider = false,
  style,
  testID,
}) => {
  // Determine icon & background based on credit/debit or custom override
  const defaultBg = isCredit ? '#ECFDF5' : '#FEF2F2';
  const defaultIconColor = isCredit ? '#10B981' : '#EF4444';
  const bg = iconBgColor || defaultBg;
  const icColor = iconColor || defaultIconColor;

  const content = (
    <View
      className={`flex-row items-center py-3.5 ${showDivider ? 'border-b border-zinc-100/70' : ''}`}
      style={style}
      testID={testID}
    >
      {/* 44x44 Circular Icon Container */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        {icon ? (
          icon
        ) : isCredit ? (
          <ArrowDownLeft size={18} color={icColor} strokeWidth={2.5} />
        ) : (
          <ArrowUpRight size={18} color={icColor} strokeWidth={2.5} />
        )}
      </View>

      {/* Middle Text: Title & Subtitle */}
      <View className="flex-1 justify-center mr-3">
        <Text
          numberOfLines={1}
          className="text-[15px] font-bold text-zinc-950 tracking-tight"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            className="text-[12px] font-medium text-zinc-500 mt-0.5"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right Content: Amount, Date, Badge */}
      <View className="items-end justify-center">
        {typeof amount === 'string' ? (
          <Text
            numberOfLines={1}
            className={`text-[15px] font-extrabold tracking-tight ${
              isCredit ? 'text-emerald-600' : 'text-zinc-950'
            }`}
          >
            {amount}
          </Text>
        ) : (
          <Text
            numberOfLines={1}
            className={`text-[15px] font-extrabold tracking-tight ${
              isCredit ? 'text-emerald-600' : 'text-zinc-950'
            }`}
          >
            {isCredit ? `+₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Text>
        )}

        {date ? (
          <Text className="text-[11px] font-medium text-zinc-500 mt-0.5">
            {date}
          </Text>
        ) : null}

        {badge ? <View className="mt-1">{badge}</View> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};
