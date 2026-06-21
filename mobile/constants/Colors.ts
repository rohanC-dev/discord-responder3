/**
 * Premium dark theme color palette for Discord DM Responder.
 * Inspired by Discord's dark theme with vibrant accents.
 */

const palette = {
  // Core brand colors
  brand: {
    primary: '#7B6FF0',      // Soft purple (Discord-inspired)
    primaryLight: '#9B8FF8',
    primaryDark: '#5B4FD0',
    secondary: '#5865F2',    // Discord blurple
    accent: '#00D4AA',       // Mint green for success/approve
    warning: '#FFA94D',      // Warm orange
    danger: '#FF6B6B',       // Soft red for skip/delete
  },

  // Dark theme surfaces
  dark: {
    background: '#0D0D1A',   // Deep navy-black
    surface: '#161625',      // Elevated surface
    surfaceLight: '#1E1E32', // Cards, inputs
    surfaceHover: '#262640', // Hover state
    border: '#2A2A45',       // Subtle borders
    borderLight: '#383860',  // Active borders
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0C0',
    tertiary: '#6B6B90',
    inverse: '#0D0D1A',
  },

  // Semantic colors
  status: {
    pending: '#FFA94D',
    approved: '#00D4AA',
    sent: '#5865F2',
    skipped: '#6B6B90',
    expired: '#FF6B6B',
  },

  // Gradient stops
  gradients: {
    brandStart: '#7B6FF0',
    brandEnd: '#5865F2',
    surfaceStart: '#1E1E32',
    surfaceEnd: '#161625',
    accentStart: '#00D4AA',
    accentEnd: '#00B894',
  },
};

export default {
  light: {
    text: palette.text.primary,
    textSecondary: palette.text.secondary,
    textTertiary: palette.text.tertiary,
    background: palette.dark.background,
    surface: palette.dark.surface,
    surfaceLight: palette.dark.surfaceLight,
    surfaceHover: palette.dark.surfaceHover,
    border: palette.dark.border,
    borderLight: palette.dark.borderLight,
    tint: palette.brand.primary,
    primary: palette.brand.primary,
    primaryLight: palette.brand.primaryLight,
    secondary: palette.brand.secondary,
    accent: palette.brand.accent,
    warning: palette.brand.warning,
    danger: palette.brand.danger,
    tabIconDefault: palette.text.tertiary,
    tabIconSelected: palette.brand.primary,
    ...palette.status,
  },
  dark: {
    text: palette.text.primary,
    textSecondary: palette.text.secondary,
    textTertiary: palette.text.tertiary,
    background: palette.dark.background,
    surface: palette.dark.surface,
    surfaceLight: palette.dark.surfaceLight,
    surfaceHover: palette.dark.surfaceHover,
    border: palette.dark.border,
    borderLight: palette.dark.borderLight,
    tint: palette.brand.primary,
    primary: palette.brand.primary,
    primaryLight: palette.brand.primaryLight,
    secondary: palette.brand.secondary,
    accent: palette.brand.accent,
    warning: palette.brand.warning,
    danger: palette.brand.danger,
    tabIconDefault: palette.text.tertiary,
    tabIconSelected: palette.brand.primary,
    ...palette.status,
  },
};

export { palette };
