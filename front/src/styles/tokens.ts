/*
 * Design tokens — mapped to the MZC PoC Funding Platform palette.
 *
 * Brand-legacy names (mzRed, mzNavy, bgPrimary…) are preserved so that
 * existing component imports keep working; their values now point at the
 * enterprise SaaS palette (see styles/mzc-theme.css for the raw CSS vars).
 */

export const color = {
  // Surfaces
  bgPrimary: '#f7f8fb',      // app background
  bgSurface: '#ffffff',      // card / panel surface
  bgSubtle: '#f1f4f8',       // soft surface for group headers & muted blocks
  border: '#e4e7ec',
  borderStrong: '#d0d5dd',

  // Text
  textPrimary: '#101828',
  textSecondary: '#475467',
  textMuted: '#667085',

  // Brand — kept as mz* names for backwards compatibility.
  // Primary action colour is the enterprise blue, not red, for this platform.
  mzRed: '#0057ff',          // (legacy name) → Primary Blue
  mzRedHover: '#0047d6',
  mzNavy: '#101828',         // (legacy name) → deep text / header
  mzNavySoft: '#1d2939',

  // Semantic
  aiBadgeBg: '#f2edff',
  aiBadgeText: '#6f3ff5',
  aiBadgeBorder: '#dbc9fc',
  success: '#12b76a',
  successSoft: '#ecfdf3',
  warning: '#f79009',
  warningSoft: '#fffaeb',
  error: '#f04438',
  errorSoft: '#fef3f2',
  info: '#2e90fa',
  infoSoft: '#eff8ff',

  // AI accent (purple) used for agent-generated content / suggestions.
  ai: '#6f3ff5',
  aiSoft: '#f2edff',

  // Primary alias for new components that want to be explicit.
  primary: '#0057ff',
  primaryHover: '#0047d6',
  primarySoft: '#eaf1ff',
} as const

export const font = {
  heading: "'Pretendard', 'Inter', -apple-system, system-ui, sans-serif",
  body: "'Pretendard', 'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

export const size = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 18,
  xl: 20,
  xxl: 24,
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const

export const shadow = {
  card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.04)',
  elevated: '0 8px 24px rgba(16, 24, 40, 0.08)',
} as const
