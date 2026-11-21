import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface ButtonProps {
  label: string;
  icon?: IconName;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  icon,
  onPress,
  disabled = false,
  variant = 'secondary',
  style,
}: ButtonProps) {
  const foreground = variant === 'primary' ? '#ffffff' : '#111111';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
        <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  primary: {
    backgroundColor: '#111111',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
  },
});
