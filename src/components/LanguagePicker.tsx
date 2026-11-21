import { Host, Picker } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';
import { LANGUAGES, LANGUAGE_OPTIONS, type LanguageCode } from '@/lib/languages';
import { useAppTheme } from '@/lib/theme';

interface LanguagePickerProps {
  label: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
}

export function LanguagePicker({ label, value, onChange }: LanguagePickerProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <Host
        matchContents={{ vertical: true }}
        colorScheme={theme.scheme}
        seedColor={theme.accent}
        style={styles.host}
      >
        <Picker
          selectedValue={value}
          onValueChange={(next) => onChange(next as LanguageCode)}
          appearance="menu"
          accessibilityLabel={`${label}: ${LANGUAGES[value]}. Change language.`}
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
    marginBottom: 4,
  },
  host: {
    width: '100%',
  },
});
