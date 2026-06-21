/**
 * Premium dark theme color palette for Discord DM Responder.
 * Inspired by Discord's dark theme with vibrant accents.
 */

const palette = {
  // Core brand colors
  brand: {
    primary: '#5865F2',   // Discord Blurple
    secondary: '#EB459E', // Discord Fuchsia
    success: '#57F287',   // Discord Green
    warning: '#FEE75C',   // Discord Yellow
    error: '#ED4245',     // Discord Red
  },
  dark: {
    background: '#313338', // Main chat area
    surface: '#2B2D31',    // Sidebar / Header
    surfaceLight: '#383A40', // Hover states / Active item
    surfaceDark: '#1E1F22',  // Channels list background / Server list
    border: '#1E1F22',
  },
  text: {
    primary: '#F2F3F5',
    secondary: '#B5BAC1',
    tertiary: '#949BA4',
    inverse: '#111214',
  },
  // Semantic colors
  status: {
    pending: '#FEE75C',
    approved: '#57F287',
    sent: '#5865F2',
    skipped: '#949BA4',
    expired: '#ED4245',
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
    surfaceHover: palette.dark.surfaceLight,
    border: palette.dark.border,
    borderLight: palette.dark.surfaceLight,
    tint: palette.brand.primary,
    primary: palette.brand.primary,
    secondary: palette.brand.secondary,
    accent: palette.brand.success,
    warning: palette.brand.warning,
    danger: palette.brand.error,
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
    surfaceHover: palette.dark.surfaceLight,
    border: palette.dark.border,
    borderLight: palette.dark.surfaceLight,
    tint: palette.brand.primary,
    primary: palette.brand.primary,
    secondary: palette.brand.secondary,
    accent: palette.brand.success,
    warning: palette.brand.warning,
    danger: palette.brand.error,
    tabIconDefault: palette.text.tertiary,
    tabIconSelected: palette.brand.primary,
    ...palette.status,
  },
};

export { palette };
