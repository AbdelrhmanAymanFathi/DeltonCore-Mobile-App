import React, { useEffect, useState } from 'react'
import type { SiteEmployee } from '../api/types'
import EmployeePickerScreen from './EmployeePickerScreen'
import PenaltyScreen from './PenaltyScreen'

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

  if (picking) {
    return (
      <EmployeePickerScreen
        title="اختر الموظف"
        onBack={() => setPicking(false)}
        onPick={(e) => {
          setEmployee(e)
          setPicking(false)
        }}
      />
    )
  }

  return (
    <PenaltyScreen
      onBack={onBack}
      onDone={onDone}
      onPickEmployee={() => setPicking(true)}
      pickedEmployee={employee}
      onUnsavedChange={onUnsavedChange}
    />
  )
}
