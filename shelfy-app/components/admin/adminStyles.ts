import { StyleSheet } from 'react-native';
import { FONTS, RADIUS } from '@/constants/theme';
import type { Theme } from '@/context/ThemeContext';

// Stili condivisi dai pannelli della dashboard admin (mobile e desktop).
// Il rilievo "plastilina" (SHADOW.card) va solo sulle card: liste, testi e
// intestazioni restano piatti.
export const createAdminStyles = ({ T, SHADOW, CLAY }: Theme) => StyleSheet.create({
  empty: { textAlign: 'center', color: T.mute, fontFamily: FONTS.sans, paddingVertical: 40 },
  section: { gap: 12 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.field,
    borderRadius: RADIUS.input, paddingHorizontal: 12, boxShadow: CLAY.inset,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: FONTS.sans, fontSize: 14, color: T.ink },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  clearBtnText: { color: T.mute, fontSize: 14, fontFamily: FONTS.sansSemiBold },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: RADIUS.md,
    backgroundColor: T.surface, boxShadow: CLAY.chip,
  },
  chipActive: { backgroundColor: T.primary },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink2 },
  chipTextActive: { color: T.onPrimary },

  resultCount: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },

  card: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 16, ...SHADOW.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink, flexShrink: 1 },
  email: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, marginTop: 2 },
  date: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
  subInfo: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.primary, marginTop: 4 },

  newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.tag, backgroundColor: T.okSoft },
  newBadgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 10, color: T.okInk },

  badges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.tag },
  badgePremium: { backgroundColor: T.warnSoft },
  badgeAdmin: { backgroundColor: T.primarySoft },
  badgeAiOff: { backgroundColor: T.urgentSoft },
  badgeGuest: { backgroundColor: T.field },
  badgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 11, color: T.primaryInk },
  badgeTextWarn: { color: T.warnInk },
  badgeTextUrgent: { color: T.urgentInk },
  badgeTextMute: { color: T.ink2 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  btnPrimary: { backgroundColor: T.primary },
  btnSecondary: { backgroundColor: T.primarySoft },
  btnDestructive: { backgroundColor: T.urgentSoft },
  btnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.onPrimary, textAlign: 'center' },
  btnTextSecondary: { color: T.primaryInk },
  btnTextDanger: { color: T.urgent },

  fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  fbTags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  fbTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.tag },
  fbTagText: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  fbRating: { fontSize: 12, color: T.warn, fontFamily: FONTS.sansSemiBold },
  fbMessage: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink, lineHeight: 20 },
  fbFrom: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 8 },

  cardTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  cardDesc: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 4, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { flex: 1, marginRight: 12 },
  groupLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2, marginTop: 8 },

  surveyInput: {
    backgroundColor: T.field, borderRadius: RADIUS.input, boxShadow: CLAY.inset,
    paddingVertical: 10, paddingHorizontal: 12, marginTop: 10,
    fontFamily: FONTS.sans, fontSize: 14, color: T.ink,
  },
  surveyOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  surveyRemoveBtn: {
    width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: T.urgentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  surveyRemoveText: { fontFamily: FONTS.sansBold, fontSize: 14, color: T.urgent },
  surveyActions: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
  smallBtn: { backgroundColor: T.primarySoft, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 14 },
  smallBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },
  primaryAction: {
    flex: 1, backgroundColor: T.primary, borderRadius: RADIUS.lg,
    paddingVertical: 11, alignItems: 'center',
  },
  primaryActionText: { fontFamily: FONTS.sansBold, fontSize: 14, color: T.onPrimary },
  surveyDeleteText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.urgent },
  surveyState: {
    alignSelf: 'flex-start', backgroundColor: T.field, borderRadius: RADIUS.tag,
    paddingVertical: 3, paddingHorizontal: 8, marginBottom: 6,
  },
  surveyStateOn: { backgroundColor: T.okSoft },
  surveyStateText: { fontFamily: FONTS.sansBold, fontSize: 11, color: T.ink2 },
  surveyStateTextOn: { color: T.okInk },

  resultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  resultLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: T.ink2 },
  resultValue: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink, fontVariant: ['tabular-nums'] },
  resultBarTrack: { height: 6, borderRadius: 3, backgroundColor: T.primarySoft, marginTop: 4, overflow: 'hidden' },
  resultBarFill: { height: 6, borderRadius: 3, backgroundColor: T.primary },
});

export type AdminStyles = ReturnType<typeof createAdminStyles>;
