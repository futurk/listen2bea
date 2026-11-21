import { Host, Picker } from '@expo/ui';
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
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Picker
          selectedValue={value}
          onValueChange={(next) => onChange(next as LanguageCode)}
          appearance="menu"
          accessibilityLabel={`${label} language`}
        >
          {LANGUAGE_OPTIONS.map((language) => (
            <Picker.Item
              key={language.code}
              label={`${language.name} (${language.code})`}
              value={language.code}
            />
          ))}
        </Picker>
      </Host>
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
  host: {
    width: '100%',
  },
});
