import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Clock, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTime24: string; // "09:00", "14:30"
  onSelectTime: (time24: string) => void;
}

export function TimePickerModal({ visible, onClose, selectedTime24, onSelectTime }: TimePickerModalProps) {
  // Parse initial 24h time into 12h format
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

  const presets = [
    { label: '09:00 AM (Morning)', h: 9, m: 0, p: 'AM' as const },
    { label: '12:00 PM (Noon)', h: 12, m: 0, p: 'PM' as const },
    { label: '03:00 PM (Afternoon)', h: 3, m: 0, p: 'PM' as const },
    { label: '06:00 PM (Evening)', h: 6, m: 0, p: 'PM' as const },
    { label: '09:00 PM (Night)', h: 9, m: 0, p: 'PM' as const },
  ];

  const formattedDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center bg-black/60 px-5">
        <View className="bg-white rounded-3xl p-6 border border-zinc-200 w-full max-w-sm shadow-xl">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                <Clock size={18} color="#6366F1" />
              </View>
              <Text className="text-lg font-bold text-zinc-900">Select Reminder Time</Text>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          {/* Time Display Badge */}
          <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 items-center mb-5">
            <Text className="text-3xl font-black text-indigo-600 tracking-wider">
              {formattedDisplay}
            </Text>
          </View>

          {/* Quick Presets */}
          <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Quick Presets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {presets.map((preset, idx) => {
                const isSelected = hour === preset.h && minute === preset.m && period === preset.p;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setHour(preset.h);
                      setMinute(preset.m);
                      setPeriod(preset.p);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    }}
                    className={`px-3 py-2 rounded-xl border ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-700'}`}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Hour Selector */}
          <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Select Hour</Text>
          <View className="flex-row flex-wrap justify-between mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
              const isSelected = hour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => {
                    setHour(h);
                    try { Haptics.selectionAsync(); } catch {}
                  }}
                  className={`w-11 h-10 rounded-xl items-center justify-center mb-2 ${
                    isSelected ? 'bg-indigo-600' : 'bg-zinc-100'
                  }`}
                >
                  <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-800'}`}>{h}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Minute & AM/PM Selector */}
          <View className="flex-row justify-between items-center mb-6">
            {/* Minutes */}
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Minutes</Text>
              <View className="flex-row gap-1">
                {[0, 15, 30, 45].map((m) => {
                  const isSelected = minute === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setMinute(m);
                        try { Haptics.selectionAsync(); } catch {}
                      }}
                      className={`flex-1 py-2 rounded-xl items-center ${
                        isSelected ? 'bg-indigo-600' : 'bg-zinc-100'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                        :{String(m).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* AM / PM */}
            <View className="w-24">
              <Text className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Period</Text>
              <View className="flex-row bg-zinc-100 p-1 rounded-xl">
                {(['AM', 'PM'] as const).map((p) => {
                  const isSelected = period === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => {
                        setPeriod(p);
                        try { Haptics.selectionAsync(); } catch {}
                      }}
                      className={`flex-1 py-1.5 rounded-lg items-center ${
                        isSelected ? 'bg-white shadow-xs' : ''
                      }`}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Button variant="outline" size="md" className="flex-1" onPress={onClose}>
              <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
            </Button>

            <Button variant="primary" size="md" className="flex-1 bg-indigo-600 active:bg-indigo-700" onPress={handleConfirm}>
              <Check size={16} color="#FFFFFF" className="mr-1" />
              <Text className="text-white font-bold text-xs">Set Time</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
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
