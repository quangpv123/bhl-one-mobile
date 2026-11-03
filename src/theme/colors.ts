export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryHover: '#1677FF',
  primarySoft: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  surfaceMuted: '#F1F5F9',
  text: '#172033',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textPlaceholder: '#98A2B3',
  border: '#E2E8F0',
  borderSubtle: '#EDF1F7',
  sidebar: '#0F172A',
  sidebarMuted: '#94A3B8',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FCA5A5',
  success: '#15803D',
  successSoft: '#F0FDF4',
  successBorder: '#86EFAC',
  warning: '#B45309',
} as const;

/**
 * Shared visual tokens mirror the responsive web theme in erp-frontend.
 * Keeping the values here prevents individual native screens from drifting
 * away from the web experience again.
 */
export const ui = {
  controlHeight: 34,
  compactControlHeight: 34,
  headerHeight: 66,
  pagePaddingHorizontal: 12,
  pagePaddingTop: 12,
  pagePaddingBottom: 24,
  radius: 10,
  cardRadius: 12,
  smallRadius: 8,
  cardPadding: 12,
  gap: 10,
} as const;

export const typography = {
  screenTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
  label: { fontSize: 12, lineHeight: 17, fontWeight: '600' as const },
  body: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const },
  value: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  button: { fontSize: 12, lineHeight: 17, fontWeight: '600' as const },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: colors.sidebar,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 1,
  },
  floating: {
    shadowColor: colors.sidebar,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
