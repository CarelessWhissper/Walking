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
    background: '#0A0A0A',
    tint: '#00E676',
    icon: '#666',
    tabIconDefault: '#555',
    tabIconSelected: '#00E676',
  },
};

// Shared design tokens for the modern dark UI
export const Theme = {
  bg: '#0A0A0A',
  surface: '#161616',
  surfaceLight: '#1E1E1E',
  border: '#222',
  text: '#F5F5F5',
  textSecondary: '#888',
  textMuted: '#555',
  accent: '#00E676',      // vibrant green
  accentDim: '#00C853',
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
