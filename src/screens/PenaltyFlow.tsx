import React, { useEffect, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import type { SiteEmployee } from '../api/types'
import EmployeePickerScreen from './EmployeePickerScreen'
import PenaltyScreen from './PenaltyScreen'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { radius } from '../theme/tokens'
import { t } from '../i18n'

/**
 * The penalty form and its employee picker as one unit.
 *
 * Keeping the picked employee here rather than round-tripping it through
 * navigation params means the half-filled form survives the trip to the
 * picker and back — a supervisor who mistypes the days field does not lose
 * the reason they already wrote.
 */
export default function PenaltyFlow({
  onBack,
  onDone,
  backRef,
  onUnsavedChange,
}: {
  onBack: () => void
  onDone: () => void
  /** Lets the navigator close the nested employee picker on hardware back. */
  backRef?: React.MutableRefObject<(() => void) | null>
  /** Lets the navigator warn before a hardware back drops a written reason. */
  onUnsavedChange?: (dirty: boolean) => void
}) {
  const { colors } = useTheme()
  const [picking, setPicking] = useState(false)
  const [employee, setEmployee] = useState<SiteEmployee | null>(null)

  // While the picker is open it owns the hardware back button; it holds no
  // typed input, so it closes without the unsaved-edits question.
  useEffect(() => {
    if (!backRef) return
    backRef.current = picking ? () => setPicking(false) : null
    return () => {
      backRef.current = null
    }
  }, [picking, backRef])

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <PenaltyScreen
        onBack={onBack}
        onDone={onDone}
        onPickEmployee={() => setPicking(true)}
        pickedEmployee={employee}
        onUnsavedChange={onUnsavedChange}
      />
      <Modal
        visible={picking}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPicking(false)}
      >
        <View style={styles.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("employees.closePicker")}
            onPress={() => setPicking(false)}
            style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          />
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <EmployeePickerScreen
              title={t("employees.pickerTitle")}
              onBack={() => setPicking(false)}
              onPick={(picked) => {
                setEmployee(picked)
                setPicking(false)
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    height: '82%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
  },
})
