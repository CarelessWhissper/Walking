import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#F5F5F5',
    background: '#121214',
    tint: '#00D9FF',
    icon: '#6E6E73',
    tabIconDefault: '#5C5C61',
    tabIconSelected: '#00D9FF',
  },
};

// Shared design tokens for the modern dark UI
export const Theme = {
  bg: '#121214',
  surface: '#1C1C1F',
  surfaceLight: '#242428',
  border: '#2A2A2E',
  text: '#F5F5F5',
  textSecondary: '#909095',
  textMuted: '#5C5C61',
  accent: '#00D9FF',      // electric cyan
  accentDim: '#00ACC1',
  danger: '#FF5252',
  dangerDim: '#D32F2F',
  white: '#FFF',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
