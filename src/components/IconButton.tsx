import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { IconName } from './Button';

interface IconButtonProps {
  name: IconName;
  accessibilityLabel: string;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  active?: boolean;
  variant?: 'primary' | 'secondary';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  disabled = false,
  active = false,
  variant = 'secondary',
  size = 22,
  style,
}: IconButtonProps) {
  const foreground =
    variant === 'primary' ? '#ffffff' : active ? '#1a6ed8' : '#111111';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        active && styles.active,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  primary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  active: {
    backgroundColor: '#e8f0fe',
    borderColor: '#1a6ed8',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});
