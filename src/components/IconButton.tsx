import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { IconName } from './Button';

interface IconButtonProps {
  name: IconName;
  accessibilityLabel: string;
  tooltip?: string;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  active?: boolean;
  variant?: 'primary' | 'secondary';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const TOOLTIP_TIMEOUT_MS = 2500;

export function IconButton({
  name,
  accessibilityLabel,
  tooltip,
  onPress,
  disabled = false,
  active = false,
  variant = 'secondary',
  size = 22,
  style,
}: IconButtonProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  const showTooltip = () => {
    if (!tooltip || disabled) {
      return;
    }
    clearHideTimer();
    setTooltipVisible(true);
  };

  const showTooltipTemporarily = () => {
    showTooltip();
    if (tooltip && !disabled) {
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setTooltipVisible(false);
      }, TOOLTIP_TIMEOUT_MS);
    }
  };

  const hideTooltip = () => {
    clearHideTimer();
    setTooltipVisible(false);
  };

  const handlePressIn = () => {
    longPressRef.current = false;
  };

  const handleLongPress = () => {
    if (!tooltip || disabled) {
      return;
    }
    longPressRef.current = true;
    showTooltipTemporarily();
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }
    onPress?.(event);
  };

  const foreground =
    variant === 'primary' ? '#ffffff' : active ? '#1a6ed8' : '#111111';

  return (
    <View style={[styles.wrapper, style]}>
      {tooltip && tooltipVisible ? (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={tooltip}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onHoverIn={showTooltip}
        onHoverOut={hideTooltip}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.base,
          variant === 'primary' && styles.primary,
          active && styles.active,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Ionicons name={name} size={size} color={foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
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
  tooltip: {
    position: 'absolute',
    bottom: 56,
    left: -71,
    width: 190,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#111111',
    zIndex: 20,
    elevation: 8,
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
