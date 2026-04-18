import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

// Universal link entry point for https://web.apexis.in/auth/login-redirect?role=...&code=...
// Waits for auth to resolve, logs out if needed, then forwards to login with code pre-filled.
export default function LoginRedirect() {
  const router = useRouter();
  const { role, code } = useLocalSearchParams<{ role?: string; code?: string }>();
  const { isLoggedIn, isLoading, logout } = useAuth();
  const handled = useRef(false);

  useEffect(() => {

    if (handled.current) return;
    handled.current = true;

    const handle = async () => {
      console.log('[NAV] Instant logout triggered by deep-link redirector');

      // Force an immediate logout regardless of current loading state
      await logout();

      // Small buffer to ensure SecureStore and Context state are fully cleared
      await new Promise(r => setTimeout(r, 200));

      router.replace({
        pathname: '/(auth)/login',
        params: { code, role },
      });
    };

    handle();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
