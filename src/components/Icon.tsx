import React from 'react'
import { Feather } from '@expo/vector-icons'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { colors, iconSize } from '../theme/tokens'

/**
 * Single icon family used across the app: Feather.
 * Wraps @expo/vector-icons so screens never import the library directly.
 * Sizes and colours come from the theme tokens.
 *
 * `mirror` flips the icon horizontally (scaleX: -1) for directional icons
 * in RTL layouts — back, chevron, arrows, etc.
 */
export function Icon({
  name,
  size = iconSize.md,
  color = colors.text,
  accessibilityLabel,
  accessible = true,
  mirror = false,
  style,
}: {
  name: string
  size?: number
  color?: string
  accessibilityLabel?: string
  accessible?: boolean
  /** Mirror the icon horizontally (RTL directional icons). */
  mirror?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Feather
      name={name as keyof typeof Feather.glyphMap}
      size={size}
      color={color}
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
      style={[
        s.icon,
        mirror && { transform: [{ scaleX: -1 }] },
        style,
      ]}
    />
  )
}

const s = StyleSheet.create({
  icon: {},
})
