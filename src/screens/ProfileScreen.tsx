import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { PressableScale } from '../components/ui/PressableScale'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { Card, ScreenHeader } from '../components/ui'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t, localeStyles, useLocale, type Locale } from '../i18n'

const LANGUAGES: { locale: Locale; label: () => string }[] = [
  { locale: 'ar', label: () => t('common.languageArabic') },
  { locale: 'en', label: () => t('common.languageEnglish') },
]

interface Props {
  onBack: () => void
}

export default function ProfileScreen({ onBack }: Props) {
  const { colors } = useTheme()
  const { session } = useAuth()
  const { locale, setLocale } = useLocale()
  const insets = useSafeAreaInsets()
  const name = session?.employee.full_name_ar || session?.user.full_name || t('common.defaultName')
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')

  const fields = [
    { label: t("login.usernameLabel"), value: session?.user.username, icon: 'user' },
    { label: t("common.employeeNumber"), value: session?.employee.employee_number, icon: 'hash' },
    { label: t("common.jobTitle"), value: session?.employee.job_title, icon: 'briefcase' },
    { label: t("common.department"), value: session?.employee.department, icon: 'layers' },
    { label: t("common.workSite"), value: session?.site?.name_ar, icon: 'map-pin' },
    { label: t("common.company"), value: session?.company?.name_ar || session?.company?.name, icon: 'home' },
  ].filter((field): field is typeof field & { value: string } => Boolean(field.value))

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t("home.profile")} onBack={onBack} />
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
            {session?.employee.job_title || t("common.accountData")}
          </Text>
        </Card>

        <Card style={s.detailsCard}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t("common.accountData")}</Text>
          {fields.map((field) => (
            <View key={field.label} style={[s.field, { borderBottomColor: colors.border }]}>
              <View style={[s.fieldIcon, { backgroundColor: colors.tintBrand }]}>
                <Icon name={field.icon} size={18} color={colors.brandText} accessible={false} />
              </View>
              <View style={s.fieldContent}>
                <Text style={[s.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
                <Text
                  style={[
                    s.fieldValue,
                    {
                      color: colors.textPrimary,
                      writingDirection: /[\u0600-\u06FF]/.test(field.value) ? 'rtl' : 'ltr',
                    },
                  ]}
                >
                  {field.value}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={s.detailsCard}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t("common.language")}</Text>
          <View style={[s.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {LANGUAGES.map((option) => {
              const selected = locale === option.locale
              return (
                <PressableScale
                  key={option.locale}
                  onPress={() => setLocale(option.locale)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label()}
                  style={[s.segment, selected && { backgroundColor: colors.brand }]}
                >
                  <Text style={[s.segmentText, { color: selected ? colors.onBrand : colors.textSecondary }]}>
                    {option.label()}
                  </Text>
                </PressableScale>
              )
            })}
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}

const s = localeStyles((L) => ({
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
    lineHeight: lineHeightFor(26),
    ...baseText,
  },
  name: {
    fontSize: font.size.title,
    fontFamily: font.familyBold,
    textAlign: 'center',
    lineHeight: lineHeightFor(font.size.title),
    ...baseText,
  },
  subtitle: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: lineHeightFor(font.size.base),
    ...baseText,
  },
  detailsCard: {
    padding: spacing.lg,
  },
  sectionTitle: {
    width: '100%',
    writingDirection: L.dir,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: L.align,
    marginBottom: spacing.sm,
    lineHeight: lineHeightFor(font.size.lg),
    ...baseText,
  },
  field: {
    flexDirection: 'row',
    direction: L.dir,
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
    writingDirection: L.dir,
    fontSize: font.size.xs,
    fontFamily: font.family,
    textAlign: L.align,
    lineHeight: lineHeightFor(font.size.xs),
    ...baseText,
  },
  fieldValue: {
    width: '100%',
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
    textAlign: L.align,
    writingDirection: L.dir,
    lineHeight: lineHeightFor(font.size.base),
    ...baseText,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
    lineHeight: lineHeightFor(font.size.base),
    ...baseText,
  },
}))
