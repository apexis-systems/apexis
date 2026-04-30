import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { DeviceEventEmitter, LogBox, Platform, TextInput, Modal, ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
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
import { navigateFromNotification } from '@/utils/navigation';
import Constants from 'expo-constants';
import { getSystemConfig } from '@/services/systemService';
import { isUpdateRequired } from '@/utils/versionHelper';
import ForceUpdateScreen from '@/components/ForceUpdateScreen';

function RootLayoutNav() {
  const { isLoggedIn, isLoading: isAuthLoading, user, logout, isPendingName } = useAuth();
  const { usageData } = useUsage();
  const segments = useSegments();
  const { colors } = useTheme();
  const router = useRouter();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [subscriptionLocked, setSubscriptionLocked] = useState(false);
  const [isProcessingInvitation, setIsProcessingInvitation] = useState(false);
  const nativeUrl = Linking.useURL();
  const [pendingNotification, setPendingNotification] = useState<any>(null);
  const lastProcessedUrl = useRef<string | null>(null);
  const lastProcessedNotifId = useRef<string | null>(null);

  const [versionConfig, setVersionConfig] = useState<{
    minAppVersion: string;
    androidStoreUrl: string;
    iosStoreUrl: string;
    isOutdated: boolean;
  } | null>(null);
  const [isVersionChecking, setIsVersionChecking] = useState(true);

  // Hardened Deep Link Watcher (Reacts to useURL changes on background resume)
  useEffect(() => {
    if (!nativeUrl) return;

    // LOOP GUARD: Stop if we've already handled this exact URL string
    if (nativeUrl === lastProcessedUrl.current) return;
    lastProcessedUrl.current = nativeUrl;

    const handleDeepLink = async (url: string) => {
      console.log('[DEBUG] Incoming URL detected:', url);

      const parsed = Linking.parse(url);
      const { code, role } = parsed.queryParams || {};

      const isInvitation = code && role && (url.includes('login-redirect') || url.includes('/login'));

      if (isInvitation) {
        console.log('[NAV] Invitation deep-link matched! Redirection starting...', { code, role });

        if (isLoggedIn) {
          setIsProcessingInvitation(true);
          try {
            await logout();
            // Critical: Give state time to settle
            await new Promise(r => setTimeout(r, 200));
          } catch (e) {
            console.error('[AUTH] Invitation logout failed:', e);
          } finally {
            setIsProcessingInvitation(false);
          }
        }

        router.replace({
          pathname: '/(auth)/login',
          params: { code, role }
        });
      }
    };

    handleDeepLink(nativeUrl);
  }, [nativeUrl, isLoggedIn, logout]);

  // 1. Listen for notification taps while the app is running (foreground/background)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const type = data?.type as string;
      const id = response.notification.request.identifier;

      // GUARD: Prevent double-fires
      if (id && id === lastProcessedNotifId.current) return;
      if (id) lastProcessedNotifId.current = id;

      console.log('[NAV] Notification received → queued', id);
      setPendingNotification({ id, data, type });
    });

    return () => subscription.remove();
  }, []);

  // 2. Check if the app was opened by a notification (cold start)
  useEffect(() => {
    const handleColdStart = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;

      const data = response.notification.request.content.data;
      const type = data?.type as string;
      const id = response.notification.request.identifier;

      // GUARD: Prevent double-fires from cold start catch-up
      if (id && id === lastProcessedNotifId.current) return;
      if (id) lastProcessedNotifId.current = id;

      console.log('[NAV] Cold start → queued', id);
      setPendingNotification({ id, data, type });
    };
    handleColdStart();
  }, []);

  // 3. Process the queued notification once auth state is ready
  useEffect(() => {
    if (!pendingNotification) return;
    if (isAuthLoading) return;
    if (!isLoggedIn) return;
    if (!hasSeenOnboarding) return;
    if (subscriptionLocked) return;

    console.log('[NAV] Processing notification', pendingNotification.id);
    navigateFromNotification(
      pendingNotification.id,
      pendingNotification.type,
      pendingNotification.data,
      router
    );

    // Clear the queue after processing
    setPendingNotification(null);
  }, [pendingNotification, isAuthLoading, isLoggedIn, hasSeenOnboarding, subscriptionLocked]);

  //   // Handles cold-boot (app killed) notification taps.
  //   useEffect(() => {
  //   const handleColdStart = async () => {
  //     const response = await Notifications.getLastNotificationResponseAsync();

  //     if (!response) return;

  //     const notifId = response.notification.request.identifier;
  //     const data = response.notification.request.content.data;
  //     const type = data?.type as string;

  //     console.log('[NAV] Cold start notification:', notifId);

  //     navigateFromNotification(notifId, type, data, router);
  //   };

  //   handleColdStart();
  // }, []);



  //   useEffect(() => {
  //     if (!response || !isLoggedIn || isAuthLoading || !hasSeenOnboarding || subscriptionLocked) return;

  //     const notifId = response.notification.request.identifier;
  //     const data = response.notification.request.content.data;
  //     const type = data?.type as string;

  //     // Increased delay for iOS cold-boot to ensure stack is fully ready
  //     const delay = Platform.OS === 'ios' ? 1500 : 800;

  //     setTimeout(() => {
  //       console.log(`[NAV] Cold boot navigation triggered for ${notifId}`);
  //       navigateFromNotification(notifId, type, data, router);
  //     }, delay);
  //   }, [response, isLoggedIn, isAuthLoading, hasSeenOnboarding, subscriptionLocked]);

  //   // Handles interaction (tap) when the app is in background or foreground
  //   useEffect(() => {
  //     if (!isLoggedIn || isAuthLoading || !hasSeenOnboarding || subscriptionLocked) return;

  //     const subscription = Notifications.addNotificationResponseReceivedListener(response => {
  //       const notifId = response.notification.request.identifier;
  //       const data = response.notification.request.content.data;
  //       const type = data?.type as string;

  //       console.log(`[NAV] Notification interaction detected: ${notifId}`);
  //       navigateFromNotification(notifId, type, data, router);
  //     });

  //     return () => subscription.remove();
  //   }, [isLoggedIn, isAuthLoading, hasSeenOnboarding, subscriptionLocked]);

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

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await getSystemConfig();``
        if (response.success && response.data) {
          const currentVersion = Constants.expoConfig?.version || '1.0.0';
          console.log(currentVersion);
          const minVersion = response.data.minAppVersion;
          const outdated = isUpdateRequired(currentVersion, minVersion);

          setVersionConfig({
            ...response.data,
            isOutdated: outdated
          });
        }
      } catch (error) {
        console.error("[VERSION] Check failed:", error);
      } finally {
        setIsVersionChecking(false);
      }
    };

    checkVersion();
  }, []);

  if (isAuthLoading || !fontsLoaded || isVersionChecking) {
    return null;
  }

  if (versionConfig?.isOutdated) {
    return (
      <ForceUpdateScreen
        minVersion={versionConfig.minAppVersion}
        currentVersion={Constants.expoConfig?.version || '1.0.0'}
        androidStoreUrl={versionConfig.androidStoreUrl}
        iosStoreUrl={versionConfig.iosStoreUrl}
      />
    );
  }

  if (isAuthLoading || !fontsLoaded) {
    return null;
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" options={{ headerShown: false }} />
      </Stack>
      <Modal visible={isProcessingInvitation} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surface, padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 20, fontSize: 16, fontWeight: '600', color: colors.text }}>Processing your invitation...</Text>
            <Text style={{ marginTop: 8, fontSize: 13, color: colors.textMuted }}>Please wait a moment</Text>
          </View>
        </View>
      </Modal>
    </>
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
