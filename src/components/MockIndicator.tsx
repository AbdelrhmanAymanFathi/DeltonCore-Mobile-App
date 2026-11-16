import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { isMockActive } from '../api/mock'
import { colors, font, radius, spacing } from '../theme/tokens'

export function MockIndicator() {
  if (!isMockActive()) return null
  return (
    <Pressable style={s.banner} accessibilityRole="button" accessibilityLabel="نظام تجريبي">
      <Text style={s.text}>نظام تجريبي — البيانات وهمية</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    margin: spacing.sm,
  },
  text: {
    color: colors.warningText,
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
})
