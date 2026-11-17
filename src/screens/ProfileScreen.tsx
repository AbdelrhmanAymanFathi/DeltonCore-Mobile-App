import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { Card, ScreenHeader } from '../components/ui'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing } from '../theme/tokens'

interface Props {
  onBack: () => void
}

export default function ProfileScreen({ onBack }: Props) {
  const { colors } = useTheme()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()
  const name = session?.employee.full_name_ar || session?.user.full_name || 'المستخدم'
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')

  const fields = [
    { label: 'اسم المستخدم', value: session?.user.username, icon: 'user' },
    { label: 'الرقم الوظيفي', value: session?.employee.employee_number, icon: 'hash' },
    { label: 'المسمى الوظيفي', value: session?.employee.job_title, icon: 'briefcase' },
    { label: 'القسم', value: session?.employee.department, icon: 'layers' },
    { label: 'موقع العمل', value: session?.site?.name_ar, icon: 'map-pin' },
    { label: 'الشركة', value: session?.company?.name_ar || session?.company?.name, icon: 'home' },
  ].filter((field): field is typeof field & { value: string } => Boolean(field.value))

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="الملف الشخصي" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={s.identityCard}>
          <View style={[s.avatar, { backgroundColor: colors.tintBrand }]}>
            <Text style={[s.initials, { color: colors.brandText }]}>{initials}</Text>
          </View>
          <Text style={[s.name, { color: colors.textPrimary }]}>{name}</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {session?.employee.job_title || 'بيانات الحساب'}
          </Text>
        </Card>

        <Card style={s.detailsCard}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>بيانات الحساب</Text>
          {fields.map((field) => (
            <View key={field.label} style={[s.field, { borderBottomColor: colors.border }]}>
              <View style={[s.fieldIcon, { backgroundColor: colors.tintBrand }]}>
                <Icon name={field.icon} size={18} color={colors.brandText} accessible={false} />
              </View>
              <View style={s.fieldContent}>
                <Text style={[s.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
                <Text style={[s.fieldValue, { color: colors.textPrimary }]}>{field.value}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  identityCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 26,
    fontFamily: font.familyBold,
  },
  name: {
    fontSize: font.size.title,
    fontFamily: font.familyBold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
  },
  detailsCard: {
    padding: spacing.lg,
  },
  sectionTitle: {
    width: '100%',
    writingDirection: 'rtl',
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    direction: 'rtl',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
    direction: 'ltr',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  fieldLabel: {
    width: '100%',
    writingDirection: 'rtl',
    fontSize: font.size.xs,
    fontFamily: font.family,
    textAlign: 'right',
  },
  fieldValue: {
    width: '100%',
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
})
