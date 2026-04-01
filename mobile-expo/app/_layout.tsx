import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox, TextInput } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

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
  const { isLoggedIn, isLoading: isAuthLoading, user, isPendingName } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'Angelica': require('../assets/fonts/Angelica-C.otf'),
    'Montserrat': require('../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-Medium': require('../assets/fonts/Montserrat-Medium.ttf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.ttf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.ttf'),
    'Montserrat-ExtraBold': require('../assets/fonts/Montserrat-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (isLoggedIn && user) {
      // Notification registration moved to Dashboard (index.tsx) to ensure it triggers on home screen
    }
  }, [isLoggedIn, user]);

  const { code } = useGlobalSearchParams();

  useEffect(() => {
    // Don't run until initial auth check (getMe) has resolved — navigator isn't mounted yet
    if (isAuthLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSignupWithToken = segments[0] === '(auth)' && segments[1] === 'signup';
    const isSetupName = segments[0] === '(auth)' && segments[1] === 'setup-name';

    const isInvitation = !!code;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && isPendingName && !isSetupName) {
      // New user (name is "Pending") — must complete name setup before accessing app
      router.replace('/(auth)/setup-name');
    } else if (isLoggedIn && inAuthGroup && !isSignupWithToken && !isSetupName && !isInvitation) {
      // Fully set-up user in auth group → go to tabs (unless it's an invitation)
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, isAuthLoading, isPendingName, segments, code]);

  if (isAuthLoading || !fontsLoaded) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ThemedLayout />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
