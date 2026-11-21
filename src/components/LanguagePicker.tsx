import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LANGUAGES, LANGUAGE_OPTIONS, type LanguageCode } from '@/lib/languages';

interface LanguagePickerProps {
  label: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
}

export function LanguagePicker({ label, value, onChange }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedName = LANGUAGES[value];

  const selectLanguage = (code: LanguageCode) => {
    setOpen(false);
    if (code !== value) {
      onChange(code);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedName}. Change language.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="language-outline" size={18} color="#111111" />
        <Text numberOfLines={1} style={styles.value}>
          {selectedName}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666666" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close language picker"
            onPress={() => setOpen(false)}
          />

          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.cardTitle}>Select language</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close language picker"
                hitSlop={12}
                onPress={() => setOpen(false)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={22} color="#111111" />
              </Pressable>
            </View>

            <ScrollView style={styles.list}>
              {LANGUAGE_OPTIONS.map((language) => {
                const selected = language.code === value;

                return (
                  <Pressable
                    key={language.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectLanguage(language.code)}
                    style={({ pressed }) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Text style={[styles.rowName, selected && styles.rowNameSelected]}>
                      {language.name}
                    </Text>
                    <Text style={styles.rowCode}>{language.code}</Text>
                    <View style={styles.checkSlot}>
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color="#1a6ed8" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  trigger: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  pressed: {
    opacity: 0.6,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  rowSelected: {
    backgroundColor: '#e8f0fe',
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  rowNameSelected: {
    fontWeight: '600',
  },
  rowCode: {
    fontSize: 12,
    color: '#888888',
  },
  checkSlot: {
    width: 20,
    alignItems: 'center',
  },
});
