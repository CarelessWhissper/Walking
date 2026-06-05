import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { ToastHost } from '@/components/Toast';
import { ConfirmHost } from '@/components/ConfirmSheet';
import { Theme } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Custom dark theme matching our design tokens
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Theme.bg,
    card: Theme.bg,
    text: Theme.text,
    border: Theme.border,
    primary: Theme.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="share"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <ConfirmHost />
      <ToastHost />
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
