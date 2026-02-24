import { Redirect } from 'expo-router';

export default function Index() {
    // Hardcoded to unauthenticated for demo purposes
    const isAuthenticated = false;

    if (isAuthenticated) {
        return <Redirect href="/(tabs)" />;
    } else {
        return <Redirect href="/(auth)/onboarding" />;
    }
}
