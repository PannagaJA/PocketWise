import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';

interface DatePickerModalProps {
  label: string;
  value: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  placeholder?: string;
}

export function DatePickerButton({ label, value, onSelectDate, placeholder = 'Pick a date' }: DatePickerModalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  // Parse YYYY-MM-DD or default to current date
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

  const initialDate = parseDateStr(value);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(value);

  const formattedDisplay = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
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
    try { Haptics.selectionAsync(); } catch {}
  };

  const handleConfirm = () => {
    onSelectDate(tempSelectedDate);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setModalVisible(false);
    setShowYearSelector(false);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate range of years: previous 10 years up to current year
  const currentYear = new Date().getFullYear();
  const yearsRange = Array.from({ length: 11 }, (_, i) => currentYear - 10 + i);

  return (
    <View className="mb-3">
      {label ? <Text className="text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">{label}</Text> : null}

      {/* DatePicker Trigger Button */}
      <Pressable
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          setShowYearSelector(false);
          setModalVisible(true);
        }}
        className="flex-row items-center justify-between bg-white border border-zinc-200 rounded-2xl px-4 py-3 shadow-xs active:bg-zinc-50"
      >
        <View className="flex-row items-center gap-2.5">
          <Calendar size={18} color={value ? '#6366F1' : '#71717A'} />
          <Text className={`text-sm font-medium ${value ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
            {formattedDisplay}
          </Text>
        </View>
        <ChevronDown size={16} color="#71717A" />
      </Pressable>

      {/* Interactive Calendar Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/60 px-5">
          <View className="bg-white rounded-3xl p-6 border border-zinc-200 w-full max-w-sm shadow-2xl">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                  <Calendar size={18} color="#6366F1" />
                </View>
                <Text className="text-lg font-bold text-zinc-900">Pick a Date</Text>
              </View>
              <Pressable onPress={() => { setModalVisible(false); setShowYearSelector(false); }} className="p-1">
                <X size={20} color="#71717A" />
              </Pressable>
            </View>

            {/* Month & Year Navigation Header Button */}
            <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2 mb-4">
              <Pressable onPress={handlePrevMonth} className="p-1.5 rounded-xl bg-white active:bg-zinc-100 shadow-xs">
                <ChevronLeft size={18} color="#09090B" />
              </Pressable>

              {/* Clickable Header for Year Selection */}
              <Pressable
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setShowYearSelector(!showYearSelector);
                }}
                className="flex-row items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-zinc-200 shadow-xs active:bg-indigo-50"
              >
                <Text className="text-sm font-black text-zinc-900">{monthLabel}</Text>
                <ChevronDown size={14} color="#6366F1" />
              </Pressable>

              <Pressable onPress={handleNextMonth} className="p-1.5 rounded-xl bg-white active:bg-zinc-100 shadow-xs">
                <ChevronRight size={18} color="#09090B" />
              </Pressable>
            </View>

            {showYearSelector ? (
              /* Year Selection View Only */
              <View className="mb-4">
                <Text className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 text-center">Select Year</Text>
                <View className="flex-row flex-wrap justify-between gap-2 mb-3">
                  {yearsRange.map((yr) => {
                    const isSelected = viewYear === yr;
                    return (
                      <Pressable
                        key={yr}
                        onPress={() => {
                          setViewYear(yr);
                          setShowYearSelector(false); // Automatically return back to normal date picker view after selecting year
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
              /* Normal Day Selection View */
              <>
                {/* Weekday Headers */}
                <View className="flex-row justify-around mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <Text key={i} className="text-xs font-extrabold text-zinc-400 text-center w-8">
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Day Grid */}
                <View className="flex-row flex-wrap mb-5">
                  {/* Empty leading padding slots */}
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <View key={`empty-${idx}`} className="w-[14.28%] h-10" />
                  ))}

                  {/* Days of month */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const mm = String(viewMonth + 1).padStart(2, '0');
                    const dd = String(dayNum).padStart(2, '0');
                    const dayStr = `${viewYear}-${mm}-${dd}`;
                    const isSelected = tempSelectedDate === dayStr;
                    const isToday = new Date().toISOString().substring(0, 10) === dayStr;

                    return (
                      <Pressable
                        key={dayNum}
                        onPress={() => handleSelectDay(dayNum)}
                        className="w-[14.28%] h-10 items-center justify-center p-0.5"
                      >
                        <View
                          className={`w-9 h-9 rounded-full items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600'
                              : isToday
                              ? 'border border-indigo-500 bg-indigo-50'
                              : 'bg-transparent'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? 'text-white' : isToday ? 'text-indigo-600' : 'text-zinc-800'
                            }`}
                          >
                            {dayNum}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Actions */}
            <View className="flex-row gap-3 pt-2 border-t border-zinc-100">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onPress={() => {
                  setTempSelectedDate('');
                  onSelectDate('');
                  setShowYearSelector(false);
                  setModalVisible(false);
                }}
              >
                <Text className="text-zinc-700 font-semibold text-xs">Clear</Text>
              </Button>

              <Button
                variant="primary"
                size="md"
                className="flex-1 bg-indigo-600 active:bg-indigo-700"
                onPress={handleConfirm}
              >
                <Check size={16} color="#FFFFFF" className="mr-1" />
                <Text className="text-white font-bold text-xs">Select Date</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
