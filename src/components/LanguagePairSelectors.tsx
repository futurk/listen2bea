import { StyleSheet, View } from 'react-native';
import type { LanguageCode } from '@/lib/languages';
import { LanguagePicker } from './LanguagePicker';

interface LanguagePairSelectorsProps {
  from: LanguageCode;
  to: LanguageCode;
  onFromChange: (value: LanguageCode) => void;
  onToChange: (value: LanguageCode) => void;
}

export function LanguagePairSelectors({
  from,
  to,
  onFromChange,
  onToChange,
}: LanguagePairSelectorsProps) {
  return (
    <View style={styles.row}>
      <LanguagePicker label="Practice" value={from} onChange={onFromChange} />
      <LanguagePicker label="Translate" value={to} onChange={onToChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
