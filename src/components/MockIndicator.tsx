import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from './Icon'
import { colors, font, radius, spacing } from '../theme/tokens'

/**
 * Mock mode toast — appears once when the app opens and EXPO_PUBLIC_USE_MOCK
 * is true. Fades in with a slide-from-top animation, stays for 3 seconds,
 * then fades out and removes itself from the tree.
 */
export function MockIndicator() {
  const [visible, setVisible] = useState(false)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_USE_MOCK !== '1') return
    setVisible(true)
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start()
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => setVisible(false))
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        s.toast,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
      pointerEvents="none"
    >
      <View style={s.container}>
        <Icon name="info" size={14} color="#FBBF24" accessible={false} />
        <Text style={s.text}>وضع تجريبي · بيانات وهمية</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 200,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    color: colors.text,
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
})
