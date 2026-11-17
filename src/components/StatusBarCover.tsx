import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'

export function StatusBarCover() {
  const { top } = useSafeAreaInsets()
  const { colors } = useTheme()

  if (top <= 0) return null

  return <View pointerEvents="none" style={[styles.cover, { height: top, backgroundColor: colors.background }]} />
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
})
