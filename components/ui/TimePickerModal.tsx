import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Clock, Check, X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { AppBottomSheet } from './AppBottomSheet';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTime24: string; // "09:00", "14:30"
  onSelectTime: (time24: string) => void;
}

export function TimePickerModal({ visible, onClose, selectedTime24, onSelectTime }: TimePickerModalProps) {
  // Parse initial 24h time string into 12h representation
  const parseTime = (timeStr: string) => {
    const parts = (timeStr || '09:00').split(':');
    let h = parseInt(parts[0] || '9', 10);
    const m = parseInt(parts[1] || '0', 10);
    const isPm = h >= 12;
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { hour: h, minute: m, isPm };
  };

  const initial = parseTime(selectedTime24);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.isPm ? 'PM' : 'AM');

  const [hourPickerOpen, setHourPickerOpen] = useState(false);
  const [minutePickerOpen, setMinutePickerOpen] = useState(false);

  const format24h = (h: number, m: number, p: 'AM' | 'PM'): string => {
    let h24 = h;
    if (p === 'PM' && h < 12) h24 += 12;
    if (p === 'AM' && h === 12) h24 = 0;
    const hStr = String(h24).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  const handleConfirm = () => {
    const time24 = format24h(hour, minute, period);
    onSelectTime(time24);
    try { Haptics.selectionAsync(); } catch {}
    onClose();
  };

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const commonMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const formattedDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <AppBottomSheet
      visible={visible}
      onClose={() => { setHourPickerOpen(false); setMinutePickerOpen(false); onClose(); }}
      title="Select Reminder Time"
      subtitle="Set daily reminder alert"
      scrollable={true}
    >
      <View className="w-full">

        {/* Time Display Badge */}
        <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 items-center mb-5">
          <Text className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            Selected Time (12-Hour)
          </Text>
          <Text className="text-3xl font-black text-indigo-600 tracking-wider">
            {formattedDisplay}
          </Text>
        </View>

        {/* 2 Selectors on the Same Row: Hour & Minute */}
        <View className="flex-row gap-3 mb-4">
          {/* Hour Selector */}
          <View className="flex-1">
            <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Hour</Text>
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setMinutePickerOpen(false);
                setHourPickerOpen(!hourPickerOpen);
              }}
              className={`flex-row justify-between items-center p-3.5 bg-zinc-50 border rounded-xl active:bg-zinc-100 ${
                hourPickerOpen ? 'border-indigo-600 bg-indigo-50/40' : 'border-zinc-200'
              }`}
            >
              <Text className="text-sm font-bold text-zinc-900">{String(hour).padStart(2, '0')} Hr</Text>
              <ChevronDown
                size={16}
                color={hourPickerOpen ? '#4F46E5' : '#71717A'}
                style={hourPickerOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>
          </View>

          {/* Minute Selector */}
          <View className="flex-1">
            <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Minute</Text>
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setHourPickerOpen(false);
                setMinutePickerOpen(!minutePickerOpen);
              }}
              className={`flex-row justify-between items-center p-3.5 bg-zinc-50 border rounded-xl active:bg-zinc-100 ${
                minutePickerOpen ? 'border-indigo-600 bg-indigo-50/40' : 'border-zinc-200'
              }`}
            >
              <Text className="text-sm font-bold text-zinc-900">:{String(minute).padStart(2, '0')} Min</Text>
              <ChevronDown
                size={16}
                color={minutePickerOpen ? '#4F46E5' : '#71717A'}
                style={minutePickerOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>
          </View>
        </View>

        {/* Inline Hour Grid Picker */}
        {hourPickerOpen && (
          <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 mb-4">
            <Text className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">
              Select Hour (1 - 12)
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {hoursList.map((h) => {
                const isSelected = hour === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => {
                      setHour(h);
                      setHourPickerOpen(false);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    className={`w-[22%] py-2.5 rounded-xl items-center justify-center ${
                      isSelected ? 'bg-indigo-600' : 'bg-white border border-zinc-200 active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Inline Minute Grid Picker */}
        {minutePickerOpen && (
          <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 mb-4">
            <Text className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">
              Select Minute
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {commonMinutes.map((m) => {
                const isSelected = minute === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMinute(m);
                      setMinutePickerOpen(false);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    className={`w-[22%] py-2.5 rounded-xl items-center justify-center ${
                      isSelected ? 'bg-indigo-600' : 'bg-white border border-zinc-200 active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      :{String(m).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* AM / PM Toggle */}
        <View className="mb-6">
          <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Period (AM / PM)</Text>
          <View className="flex-row bg-zinc-100 p-1.5 rounded-2xl">
            {(['AM', 'PM'] as const).map((p) => {
              const isSelected = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPeriod(p);
                    try { Haptics.selectionAsync(); } catch {}
                  }}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    isSelected ? 'bg-indigo-600' : ''
                  }`}
                >
                  <Text className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            size="md"
            className="flex-1"
            onPress={() => {
              setHourPickerOpen(false);
              setMinutePickerOpen(false);
              onClose();
            }}
          >
            <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
          </Button>

          <Button
            variant="primary"
            size="md"
            className="flex-1 bg-indigo-600 active:bg-indigo-700 flex-row items-center justify-center gap-1.5"
            onPress={handleConfirm}
          >
            <Check size={16} color="#FFFFFF" />
            <Text className="text-white font-bold text-xs">Set Time</Text>
          </Button>
        </View>
      </View>
    </AppBottomSheet>
  );
}

export function format12HourTime(time24: string): string {
  const parts = (time24 || '09:00').split(':');
  let h = parseInt(parts[0] || '9', 10);
  const m = parseInt(parts[1] || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}
