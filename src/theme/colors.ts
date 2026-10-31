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
  success: '#15803D',
  warning: '#B45309',
} as const;

/**
 * Shared visual tokens mirror the responsive web theme in erp-frontend.
 * Keeping the values here prevents individual native screens from drifting
 * away from the web experience again.
 */
export const ui = {
  controlHeight: 40,
  compactControlHeight: 30,
  headerHeight: 66,
  pagePaddingHorizontal: 12,
  pagePaddingTop: 14,
  pagePaddingBottom: 24,
  radius: 10,
  cardRadius: 14,
  smallRadius: 8,
  cardPadding: 14,
  gap: 12,
} as const;

export const shadows = {
  card: {
    shadowColor: colors.sidebar,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
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
