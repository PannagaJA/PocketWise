import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { AppBottomSheet } from './AppBottomSheet';

export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  title?: string;
  subtitle?: string;
}

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  title = 'Select Date',
  subtitle,
}: DatePickerModalProps) {
  const parseDateStr = (str: string) => {
    if (str && str.length === 10) {
      const parts = str.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    return new Date();
  };

  const initialDate = parseDateStr(selectedDate);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(selectedDate);
  const [showYearSelector, setShowYearSelector] = useState(false);

  useEffect(() => {
    if (visible) {
      const dt = parseDateStr(selectedDate);
      setViewYear(dt.getFullYear());
      setViewMonth(dt.getMonth());
      setTempSelectedDate(selectedDate);
      setShowYearSelector(false);
    }
  }, [visible, selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const selectedStr = `${viewYear}-${mm}-${dd}`;
    setTempSelectedDate(selectedStr);
    onSelectDate(selectedStr);
    try { Haptics.selectionAsync(); } catch {}
    onClose();
  };

  const handleSelectToday = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${mm}-${dd}`;
    setTempSelectedDate(todayStr);
    onSelectDate(todayStr);
    try { Haptics.selectionAsync(); } catch {}
    onClose();
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const formattedSubtitle = tempSelectedDate
    ? new Date(tempSelectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : subtitle || 'Tap a date to select';

  // Support dates from past 5 years to next 10 years (suitable for history & upcoming reminders)
  const currentYear = new Date().getFullYear();
  const yearsRange = Array.from({ length: 16 }, (_, i) => currentYear - 5 + i);

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={formattedSubtitle}
      scrollable={true}
    >
      <View className="w-full">
        {/* Month & Year Navigation Bar */}
        <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 mb-4">
          <Pressable
            onPress={handlePrevMonth}
            className="p-2 rounded-xl bg-white border border-zinc-100 active:bg-zinc-100 shadow-xs"
          >
            <ChevronLeft size={18} color="#09090B" />
          </Pressable>

          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setShowYearSelector(!showYearSelector);
            }}
            className="flex-row items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-zinc-200 shadow-xs active:bg-indigo-50"
          >
            <Text className="text-sm font-black text-zinc-900">{monthLabel}</Text>
            <ChevronDown size={14} color="#6366F1" />
          </Pressable>

          <Pressable
            onPress={handleNextMonth}
            className="p-2 rounded-xl bg-white border border-zinc-100 active:bg-zinc-100 shadow-xs"
          >
            <ChevronRight size={18} color="#09090B" />
          </Pressable>
        </View>

        {showYearSelector ? (
          /* Year Picker Grid */
          <View className="mb-4">
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 text-center">
              Select Year
            </Text>
            <View className="flex-row flex-wrap justify-between gap-2">
              {yearsRange.map((yr) => {
                const isSelected = viewYear === yr;
                return (
                  <Pressable
                    key={yr}
                    onPress={() => {
                      setViewYear(yr);
                      setShowYearSelector(false);
                      try { Haptics.selectionAsync(); } catch {}
                    }}
                    className={`w-[30%] py-3 rounded-2xl items-center border ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-zinc-50 border-zinc-200 active:bg-zinc-100'
                    }`}
                  >
                    <Text className={`text-sm font-extrabold ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {yr}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          /* Day Calendar Grid */
          <View className="mb-4">
            {/* Weekday Names */}
            <View className="flex-row justify-around mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <Text key={i} className="text-xs font-extrabold text-zinc-400 text-center w-[14.28%]">
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View className="flex-row flex-wrap">
              {/* Empty padding cells for start of month */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <View key={`empty-${idx}`} className="w-[14.28%] h-11" />
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const mm = String(viewMonth + 1).padStart(2, '0');
                const dd = String(dayNum).padStart(2, '0');
                const dayStr = `${viewYear}-${mm}-${dd}`;
                const isSelected = tempSelectedDate === dayStr;
                const todayStr = new Date().toISOString().substring(0, 10);
                const isToday = todayStr === dayStr;

                return (
                  <Pressable
                    key={dayNum}
                    onPress={() => handleSelectDay(dayNum)}
                    className="w-[14.28%] h-11 items-center justify-center p-0.5"
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 shadow-xs'
                          : isToday
                          ? 'border border-indigo-500 bg-indigo-50'
                          : 'bg-transparent'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white font-extrabold' : isToday ? 'text-indigo-600 font-extrabold' : 'text-zinc-800'
                        }`}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick Actions Footer */}
        <View className="flex-row items-center justify-between pt-3 border-t border-zinc-100 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onPress={handleSelectToday}
          >
            <Text className="text-indigo-600 font-bold text-xs">Select Today</Text>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              onSelectDate('');
              onClose();
            }}
          >
            <Text className="text-zinc-600 font-bold text-xs">Clear Date</Text>
          </Button>
        </View>
      </View>
    </AppBottomSheet>
  );
}

export interface DatePickerButtonProps {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  placeholder?: string;
}

export function DatePickerButton({
  label,
  value,
  onSelectDate,
  placeholder = 'Pick a date',
}: DatePickerButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const formattedDisplay = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : placeholder;

  return (
    <View className="mb-3">
      {label ? (
        <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          setModalVisible(true);
        }}
        className="flex-row items-center justify-between bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-xs active:bg-zinc-50"
      >
        <View className="flex-row items-center gap-2.5">
          <Calendar size={18} color={value ? '#4F46E5' : '#71717A'} />
          <Text className={`text-sm font-medium ${value ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
            {formattedDisplay}
          </Text>
        </View>
        <ChevronDown size={16} color="#71717A" />
      </Pressable>

      <DatePickerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={value}
        onSelectDate={onSelectDate}
        title={label || 'Select Date'}
      />
    </View>
  );
}
