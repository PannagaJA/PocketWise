import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Clock, Check, X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';

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

  const [hourDropdownOpen, setHourDropdownOpen] = useState(false);
  const [minuteDropdownOpen, setMinuteDropdownOpen] = useState(false);

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
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  const formattedDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
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
            <Pressable onPress={() => { setHourDropdownOpen(false); setMinuteDropdownOpen(false); onClose(); }} className="p-1">
              <X size={20} color="#71717A" />
            </Pressable>
          </View>

          {/* Time Display Badge */}
          <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 items-center mb-5">
            <Text className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
              Selected Time (12-Hour)
            </Text>
            <Text className="text-3xl font-black text-indigo-600 tracking-wider">
              {formattedDisplay}
            </Text>
          </View>

          {/* 2 Dropdowns on the Same Row: Hour & Minute */}
          <View className="flex-row gap-3 mb-4">
            {/* Hour Dropdown */}
            <View className="flex-1">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Hour</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setHourDropdownOpen(!hourDropdownOpen);
                  setMinuteDropdownOpen(false);
                }}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl active:bg-zinc-100"
              >
                <Text className="text-sm font-bold text-zinc-900">{String(hour).padStart(2, '0')} Hr</Text>
                <ChevronDown size={16} color="#71717A" />
              </Pressable>
            </View>

            {/* Minute Dropdown */}
            <View className="flex-1">
              <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">Minute</Text>
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setMinuteDropdownOpen(!minuteDropdownOpen);
                  setHourDropdownOpen(false);
                }}
                className="flex-row justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl active:bg-zinc-100"
              >
                <Text className="text-sm font-bold text-zinc-900">:{String(minute).padStart(2, '0')} Min</Text>
                <ChevronDown size={16} color="#71717A" />
              </Pressable>
            </View>
          </View>

          {/* Dropdown Options List */}
          {hourDropdownOpen && (
            <View className="mb-4 bg-white border border-zinc-200 rounded-2xl max-h-48 overflow-hidden shadow-sm p-1">
              <ScrollView nestedScrollEnabled>
                {hoursList.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      setHour(h);
                      setHourDropdownOpen(false);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    className={`flex-row justify-between items-center p-3 rounded-xl ${hour === h ? 'bg-indigo-50' : 'active:bg-zinc-50'}`}
                  >
                    <Text className={`text-sm ${hour === h ? 'font-bold text-indigo-600' : 'text-zinc-800'}`}>
                      {String(h).padStart(2, '0')} Hour
                    </Text>
                    {hour === h && <Check size={16} color="#6366F1" />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {minuteDropdownOpen && (
            <View className="mb-4 bg-white border border-zinc-200 rounded-2xl max-h-48 overflow-hidden shadow-sm p-1">
              <ScrollView nestedScrollEnabled>
                {minutesList.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMinute(m);
                      setMinuteDropdownOpen(false);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    className={`flex-row justify-between items-center p-3 rounded-xl ${minute === m ? 'bg-indigo-50' : 'active:bg-zinc-50'}`}
                  >
                    <Text className={`text-sm ${minute === m ? 'font-bold text-indigo-600' : 'text-zinc-800'}`}>
                      :{String(m).padStart(2, '0')} Minutes
                    </Text>
                    {minute === m && <Check size={16} color="#6366F1" />}
                  </Pressable>
                ))}
              </ScrollView>
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
                setHourDropdownOpen(false);
                setMinuteDropdownOpen(false);
                onClose();
              }}
            >
              <Text className="text-zinc-700 font-semibold text-xs">Cancel</Text>
            </Button>

            <Button
              variant="primary"
              size="md"
              className="flex-1 bg-indigo-600 active:bg-indigo-700"
              onPress={handleConfirm}
            >
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
