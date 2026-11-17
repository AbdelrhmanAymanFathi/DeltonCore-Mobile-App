import React from 'react'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { iconSize } from '../theme/tokens'

export type IconFamily = 'feather' | 'material-community'

export function Icon({
  name,
  family = 'feather',
  size = iconSize.md,
  color,
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
  mirror?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useTheme()
  const IconComponent = family === 'material-community' ? MaterialCommunityIcons : Feather

  return (
    <IconComponent
      name={name as any}
      size={size}
      color={color ?? colors.textPrimary}
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
