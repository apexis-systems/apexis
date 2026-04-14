import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { DeviceEventEmitter, LogBox, TextInput } from 'react-native';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useUsage } from '@/contexts/UsageContext';
import * as Notifications from 'expo-notifications';
import { handleNotificationNavigation } from '@/utils/navigation';

function RootLayoutNav() {
  const { isLoggedIn, isLoading: isAuthLoading, user, isPendingName } = useAuth();
  const { usageData } = useUsage();
  const segments = useSegments();
  const router = useRouter();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [subscriptionLocked, setSubscriptionLocked] = useState(false);
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (response && isLoggedIn && !isAuthLoading && hasSeenOnboarding && !subscriptionLocked) {
      const data = response.notification.request.content.data;
      const type = data.type as string;

      setTimeout(() => {
        handleNotificationNavigation(type, data, router);
      }, 500);
    }
  }, [response, isLoggedIn, isAuthLoading, hasSeenOnboarding, subscriptionLocked]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const value = await AsyncStorage.getItem('hasSeenOnboarding');
      setHasSeenOnboarding(value === 'true');
    };
    checkOnboarding();
  }, [segments]); // Re-check when route changes to catch updates from onboarding screen

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
    const loadSubscriptionLock = async () => {
      const value = await SecureStore.getItemAsync('subscriptionLocked');
      setSubscriptionLocked(value === 'true');
    };
    loadSubscriptionLock();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('subscription-locked', () => {
      setSubscriptionLocked(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const fromProfile = !!user?.organization?.subscription_locked;
    const fromUsage = !!usageData?.plan?.access?.isLocked;
    const nextLocked = fromProfile || fromUsage;
    setSubscriptionLocked(nextLocked);
    if (nextLocked) {
      SecureStore.setItemAsync('subscriptionLocked', 'true').catch(() => { });
    } else {
      SecureStore.deleteItemAsync('subscriptionLocked').catch(() => { });
    }
  }, [user?.organization?.subscription_locked, usageData?.plan?.access?.isLocked]);

  useEffect(() => {
    if (isLoggedIn && user) {
      // Notification registration moved to Dashboard (index.tsx) to ensure it triggers on home screen
    }
  }, [isLoggedIn, user]);

  const { code, role } = useGlobalSearchParams();

  useEffect(() => {
    const checkAndRedirect = async () => {
      // Don't run until initial auth check (getMe) has resolved
      if (isAuthLoading) return;

      const inAuthGroup = segments[0] === '(auth)';
      const isSignupWithToken = segments[0] === '(auth)' && segments[1] === 'signup';
      const isSetupName = segments[0] === '(auth)' && segments[1] === 'setup-name';
      const isOnboarding = segments[0] === 'onboarding';
      const isSubscription = segments[0] === 'subscription';
      const isInvitation = !!code;

      // Double-check storage if state says false, to avoid race conditions during transitions
      let currentOnboardingDone = hasSeenOnboarding;
      if (!currentOnboardingDone) {
        const value = await AsyncStorage.getItem('hasSeenOnboarding');
        currentOnboardingDone = value === 'true';
        if (currentOnboardingDone) setHasSeenOnboarding(true);
      }

      if (!currentOnboardingDone && !isOnboarding) {
        router.replace({
          pathname: '/onboarding',
          params: code ? { code, role } : {}
        });
        return;
      }

      if (isLoggedIn && subscriptionLocked && !isSubscription) {
        router.replace('/subscription');
        return;
      }

      if (!isLoggedIn && !inAuthGroup && !isOnboarding) {
        router.replace({
          pathname: '/(auth)/login',
          params: code ? { code, role } : {}
        });
      } else if (isLoggedIn && code && !inAuthGroup && !isOnboarding) {
        // If logged in but clicked an invitation link, we redirect to login
        // login.tsx handles the actual logout to avoid split-second state flickers
        router.replace({
          pathname: '/(auth)/login',
          params: { code, role }
        });
      } else if (isLoggedIn && isPendingName && !isSetupName) {
        router.replace('/(auth)/setup-name');
      } else if (isLoggedIn && inAuthGroup && !isSignupWithToken && !isSetupName && !isInvitation) {
        router.replace('/(tabs)');
      }
    };

    checkAndRedirect();
  }, [isLoggedIn, isAuthLoading, isPendingName, segments, code, hasSeenOnboarding, subscriptionLocked]);

  if (isAuthLoading || !fontsLoaded) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ headerShown: false }} />
    </Stack>
  );
}

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TourProvider } from '@/contexts/TourContext';
import { UsageProvider } from '@/contexts/UsageContext';
import TourOverlay from '@/components/tour/TourOverlay';

function ThemedLayout() {
  const { isDark } = useTheme();
  return (
    <GluestackUIProvider mode={isDark ? "dark" : "light"}>
      <AuthProvider>
        <SocketProvider>
          <TourProvider>
            <UsageProvider>
              <RootLayoutNav />
              <TourOverlay />
            </UsageProvider>
          </TourProvider>
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
