import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

// Suppress the non-critical expo-keep-awake warning from expo-camera in Expo Go
LogBox.ignoreLogs([
  'Unable to activate keep awake',
  'keep awake',
]);


import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import '@/i18n';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { registerForPushNotificationsAsync } from '@/services/notificationService';

function RootLayoutNav() {
  const { isLoggedIn, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && user) {
      registerForPushNotificationsAsync();
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    // Wait until initial API token profile fetch resolves
    if (isLoading) return;

    // Defer navigation by one tick so the Root Layout is fully mounted first
    const timer = setTimeout(() => {
      const inAuthGroup = segments[0] === '(auth)';
      if (!isLoggedIn && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (isLoggedIn && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoggedIn, isLoading, segments]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';

function ThemedLayout() {
  const { isDark } = useTheme();
  return (
    <GluestackUIProvider mode={isDark ? "dark" : "light"}>
      <AuthProvider>
        <SocketProvider>
          <RootLayoutNav />
        </SocketProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
      </AuthProvider>
    </GluestackUIProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedLayout />
    </ThemeProvider>
  );
}
