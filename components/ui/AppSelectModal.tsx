import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { ChevronDown, Check, Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppBottomSheet } from './AppBottomSheet';

export interface AppSelectOption<T = string> {
  value: T;
  label: string;
  subLabel?: string;
  badge?: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface AppSelectModalProps<T = string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: AppSelectOption<T>[];
  selectedValue?: T;
  onSelect: (value: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
}

export function AppSelectModal<T = string>({
  visible,
  onClose,
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  searchable,
  searchPlaceholder = 'Search options...',
  allowClear = false,
  clearLabel = 'None / Clear',
}: AppSelectModalProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');

  const showSearch = searchable ?? options.length > 7;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const handleSelect = (val: T) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onSelect(val);
    onClose();
  };

  const handleClear = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onSelect('' as unknown as T);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      scrollable={true}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.container}>
        {/* Optional Search Bar */}
        {showSearch && (
          <View style={styles.searchWrapper}>
            <Search size={16} color="#71717A" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#A1A1AA"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {!!searchQuery && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color="#71717A" />
              </Pressable>
            )}
          </View>
        )}

        {/* Optional Clear Option */}
        {allowClear && (
          <Pressable
            onPress={handleClear}
            style={[
              styles.optionItem,
              !selectedValue && styles.optionItemSelected,
            ]}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.colorDot, { backgroundColor: '#D4D4D8' }]} />
              <Text
                style={[
                  styles.optionLabel,
                  !selectedValue
                    ? styles.optionLabelSelected
                    : styles.optionLabelMuted,
                ]}
              >
                {clearLabel}
              </Text>
            </View>
            {!selectedValue && <Check size={18} color="#6366F1" strokeWidth={2.4} />}
          </Pressable>
        )}

        {/* Options List */}
        {filteredOptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching options found</Text>
          </View>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = selectedValue === opt.value;
            return (
              <Pressable
                key={String(opt.value)}
                onPress={() => handleSelect(opt.value)}
                style={[
                  styles.optionItem,
                  isSelected && styles.optionItemSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  {opt.color ? (
                    <View
                      style={[styles.colorDot, { backgroundColor: opt.color }]}
                    />
                  ) : opt.icon ? (
                    <View style={styles.iconContainer}>{opt.icon}</View>
                  ) : null}

                  <View style={styles.labelCol}>
                    <View style={styles.labelRow}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                      {opt.badge && (
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{opt.badge}</Text>
                        </View>
                      )}
                    </View>
                    {opt.subLabel && (
                      <Text style={styles.optionSubLabel} numberOfLines={1}>
                        {opt.subLabel}
                      </Text>
                    )}
                  </View>
                </View>

                {isSelected && (
                  <Check size={18} color="#6366F1" strokeWidth={2.4} />
                )}
              </Pressable>
            );
          })
        )}
      </View>
    </AppBottomSheet>
  );
}

export interface AppSelectFieldProps<T = string> {
  label?: string;
  value?: T;
  options: AppSelectOption<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  containerClassName?: string;
}

export function AppSelectField<T = string>({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select an option',
  title,
  subtitle,
  searchable,
  searchPlaceholder,
  allowClear,
  clearLabel,
  disabled = false,
  containerClassName,
}: AppSelectFieldProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpen = () => {
    if (disabled) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setModalOpen(true);
  };

  return (
    <View style={styles.fieldContainer} className={containerClassName}>
      {!!label && (
        <Text style={styles.fieldLabel}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        style={[
          styles.fieldTrigger,
          disabled && styles.fieldTriggerDisabled,
        ]}
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
      >
        <View style={styles.triggerContent}>
          {selectedOption?.color ? (
            <View
              style={[
                styles.triggerColorDot,
                { backgroundColor: selectedOption.color },
              ]}
            />
          ) : selectedOption?.icon ? (
            <View style={styles.triggerIcon}>{selectedOption.icon}</View>
          ) : null}

          <Text
            style={[
              styles.triggerText,
              !selectedOption && styles.triggerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>

        <ChevronDown size={18} color="#71717A" />
      </Pressable>

      <AppSelectModal<T>
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title || label || 'Select Option'}
        subtitle={subtitle}
        options={options}
        selectedValue={value}
        onSelect={onSelect}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        allowClear={allowClear}
        clearLabel={clearLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  container: {
    width: '100%',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#09090B',
    height: '100%',
    paddingVertical: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F4F4F5',
  },
  optionItemSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCol: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
  },
  optionLabelSelected: {
    fontWeight: '700',
    color: '#312E81',
  },
  optionLabelMuted: {
    color: '#71717A',
  },
  optionSubLabel: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  badgeContainer: {
    marginLeft: 8,
    backgroundColor: '#E4E4E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#52525B',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 16,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  fieldTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 16,
  },
  fieldTriggerDisabled: {
    opacity: 0.5,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  triggerColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  triggerIcon: {
    marginRight: 10,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  triggerPlaceholder: {
    fontWeight: '400',
    color: '#A1A1AA',
  },
});
