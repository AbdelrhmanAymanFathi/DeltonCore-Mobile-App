import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { ThemeColors } from '../theme/tokens'

export interface RequestTypeAppearance {
  label: string
  icon: string
  color: string
  tintBg: string
}

const requestTypes: Record<string, { label: string; icon: string; color: keyof ThemeColors }> = {
  leave: { label: 'إجازة', icon: 'palm-tree', color: 'brandText' },
  loan: { label: 'سلفة', icon: 'cash-fast', color: 'warningText' },
  advance: { label: 'سلفة', icon: 'cash-fast', color: 'warningText' },
  mission: { label: 'إذن انصراف', icon: 'clock-out', color: 'infoText' },
  permission: { label: 'إذن انصراف', icon: 'clock-out', color: 'infoText' },
  penalty: { label: 'جزاء', icon: 'gavel', color: 'crimson' },
  repeated_lateness: { label: 'تأخير متكرر', icon: 'clock-alert-outline', color: 'crimson' },
  'repeated-lateness': { label: 'تأخير متكرر', icon: 'clock-alert-outline', color: 'crimson' },
}

const FALLBACK_ICON = 'file-document-outline'

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '')
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    return color
  }
  const [red, green, blue] = normalized.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16))
  return `rgba(${red},${green},${blue},${opacity})`
}

export function getRequestTypeAppearance(type: string, colors: ThemeColors): RequestTypeAppearance {
  const definition = requestTypes[type]
  const icon = definition?.icon ?? FALLBACK_ICON
  const safeIcon = Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, icon)
    ? icon
    : 'help-circle-outline'
  const color = definition ? colors[definition.color] : colors.textMuted

  return {
    label: definition?.label ?? 'طلب',
    icon: safeIcon,
    color,
    tintBg: colorWithOpacity(color, 0.15),
  }
}
