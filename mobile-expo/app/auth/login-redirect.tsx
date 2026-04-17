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
    // Wait until auth state is fully loaded from SecureStore before acting.
    if (isLoading || handled.current) return;
    handled.current = true;

    const handle = async () => {
      // Unconditionally log the user out here in the redirector screen
      if (isLoggedIn) {
        logout();
        // Give SecureStore time to clear before we shift over to login
        await new Promise(r => setTimeout(r, 400));
      }
      
      router.replace({
        pathname: '/(auth)/login',
        params: { code, role },
      });
    };

    handle();
  }, [isLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
