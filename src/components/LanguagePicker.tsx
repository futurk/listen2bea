import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/lib/languages';

interface LanguagePickerProps {
  label: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
}

export function LanguagePicker({ label, value, onChange }: LanguagePickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Picker
        selectedValue={value}
        onValueChange={(next) => onChange(next as LanguageCode)}
        style={styles.picker}
        mode="dropdown"
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <Picker.Item key={language.code} label={language.name} value={language.code} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: '#555555',
  },
  picker: {
    backgroundColor: '#ffffff',
  },
});
