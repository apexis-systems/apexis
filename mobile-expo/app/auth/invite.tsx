import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Universal link handler for https://web.apexis.in/auth/invite?token=...
export default function InviteRedirect() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/(auth)/signup',
      params: token ? { token } : {},
    });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
