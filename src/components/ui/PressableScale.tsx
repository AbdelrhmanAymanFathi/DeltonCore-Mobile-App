import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>)
  children?: PressableProps['children']
  card?: boolean
  scaleTo?: number
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressableScale({
  style,
  card = false,
  scaleTo,
  disabled,
  android_ripple,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  children,
  accessibilityRole,
  accessibilityState,
  ...props
}: Props) {
  const { colors, isDark } = useTheme()
  const scale = useRef(new Animated.Value(1)).current
  const overlay = useRef(new Animated.Value(0)).current
  const [pressed, setPressed] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? (scaleTo ?? (card ? 0.985 : 0.97)) : 1,
        speed: 24,
        bounciness: 2,
        useNativeDriver: true,
      }),
      Animated.timing(overlay, {
        toValue: pressed ? 1 : 0,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start()
  }, [card, overlay, pressed, scale, scaleTo])

  const resolveStyle = (state: PressableStateCallbackType) => {
    const provided = typeof style === 'function' ? style(state) : style
    return [
      { minWidth: 44, minHeight: 44, position: 'relative' } as ViewStyle,
      card && { borderWidth: 1, borderRadius: 16, borderColor: colors.border },
      card && !isDark && {
        shadowColor: colors.brandDeep,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
      },
      provided,
      focused && {
        borderColor: colors.brand,
        borderWidth: 2,
      },
      card && pressed && { borderColor: colors.pressedBorder },
      { transform: [{ scale }] },
    ] as StyleProp<ViewStyle>
  }

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true)
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        setPressed(false)
        onPressOut?.(event)
      }}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled ?? accessibilityState?.disabled,
        busy: accessibilityState?.busy,
      }}
      android_ripple={android_ripple ?? { color: colors.rippleBrand, foreground: true }}
      style={resolveStyle({ pressed })}
    >
      {(state) => (
        <>
          {typeof children === 'function' ? children(state) : children}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: colors.pressOverlay,
              opacity: overlay,
            }}
          />
        </>
      )}
    </AnimatedPressable>
  )
}
