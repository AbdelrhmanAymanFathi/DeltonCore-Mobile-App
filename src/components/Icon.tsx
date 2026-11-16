import React from 'react'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { colors, iconSize } from '../theme/tokens'

/**
 * Single icon component used across the app.
 * Wraps @expo/vector-icons so screens never import the library directly.
 * Sizes and colours come from the theme tokens.
 *
 * `family` defaults to 'feather'. Use 'material-community' for icons not
 * available in Feather (e.g. 'factory').
 *
 * `mirror` flips the icon horizontally (scaleX: -1) for directional icons
 * in RTL layouts — back, chevron, arrows, etc.
 */
export type IconFamily = 'feather' | 'material-community'

export function Icon({
  name,
  family = 'feather',
  size = iconSize.md,
  color = colors.text,
  accessibilityLabel,
  accessible = true,
  mirror = false,
  style,
}: {
  name: string
  family?: IconFamily
  size?: number
  color?: string
  accessibilityLabel?: string
  accessible?: boolean
  /** Mirror the icon horizontally (RTL directional icons). */
  mirror?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const IconComponent = family === 'material-community'
    ? MaterialCommunityIcons
    : Feather

  return (
    <IconComponent
      name={name as any}
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
