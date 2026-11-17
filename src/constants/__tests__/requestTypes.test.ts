import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getRequestTypeAppearance } from '../requestTypes'
import { lightColors } from '../../theme/tokens'

describe('request type appearances', () => {
  it.each([
    ['leave', 'إجازة', 'palm-tree', lightColors.brandText],
    ['advance', 'سلفة', 'cash-fast', lightColors.warningText],
    ['permission', 'إذن', 'clock-out', lightColors.infoText],
    ['penalty', 'جزاء', 'gavel', lightColors.crimson],
    ['repeated_lateness', 'تأخير متكرر', 'clock-alert-outline', lightColors.crimson],
  ])('maps %s to a verified themed icon', (type, label, icon, color) => {
    const appearance = getRequestTypeAppearance(type, lightColors)

    expect(appearance).toMatchObject({ label, icon, color })
    expect(MaterialCommunityIcons.glyphMap).toHaveProperty(icon)
    expect(appearance.tintBg).toMatch(/^rgba\(/)
  })

  it('uses the document fallback for unrecognized request types', () => {
    const appearance = getRequestTypeAppearance('future_request', lightColors)

    expect(appearance).toMatchObject({
      label: 'طلب',
      icon: 'file-document-outline',
      color: lightColors.textMuted,
    })
    expect(MaterialCommunityIcons.glyphMap).toHaveProperty(appearance.icon)
  })
})
