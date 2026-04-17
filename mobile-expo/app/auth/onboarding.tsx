import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Universal link handler for https://web.apexis.in/auth/onboarding?publicToken=...
export default function OnboardingRedirect() {
  const router = useRouter();
  const { publicToken } = useLocalSearchParams<{ publicToken?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/(auth)/signup',
      params: publicToken ? { publicToken } : {},
    });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
