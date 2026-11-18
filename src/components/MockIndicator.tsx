import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, StatusBar, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from './Icon'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t, localeStyles } from '../i18n'

export function MockIndicator() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_USE_MOCK !== '1') return
    setVisible(true)
    if (reduceMotion) anim.setValue(1)
    else Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false }).start()
    const timer = setTimeout(() => {
      if (reduceMotion) {
        setVisible(false)
        return
      }
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => setVisible(false))
    }, reduceMotion ? 3000 : 2750)
    return () => {
      clearTimeout(timer)
      anim.stopAnimation()
    }
  }, [anim, reduceMotion])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        s.toast,
        { top: (insets.top || (StatusBar.currentHeight ?? 0)) + 8 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
      pointerEvents="none"
    >
      <View style={[s.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="info" size={14} color={colors.warning} accessible={false} />
        <Text style={{ ...s.text, color: colors.textPrimary }}>{t("common.mockIndicator")}</Text>
      </View>
    </Animated.View>
  )
}

const s = localeStyles((L) => ({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 200,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
    textAlign: L.align,
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
}))
