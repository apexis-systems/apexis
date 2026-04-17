import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateUserName } from '@/services/userService';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SetupNameScreen() {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const router = useRouter();
    const { colors } = useTheme();
    const { user, updateUser } = useAuth();

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter your full name');
            return;
        }

        setIsLoading(true);
        setError('');

        // Safety check: Ensure token is committed to SecureStore
        // This helps avoid race conditions where navigation to setup-name
        // happens faster than SecureStore's async write.
        let token = null;
        for (let i = 0; i < 5; i++) {
            token = await SecureStore.getItemAsync('token');
            if (token) break;
            await new Promise(r => setTimeout(r, 300)); // 300ms * 5 = 1.5s total wait if needed
        }

        if (!token) {
            setError('Session sync error. Please try signing in again.');
            setIsLoading(false);
            return;
        }

        try {
            await updateUserName({ name: name.trim() });

            if (updateUser && user) {
                updateUser({ name: name.trim() });
            }
            router.replace('/(tabs)');
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to save name. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <Image source={require('../../assets/images/app-icon.png')} style={{ width: 80, height: 80, marginBottom: 20 }} resizeMode="contain" />
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                            Welcome to <Text className="font-angelica" style={{ color: colors.primary, fontFamily: 'Angelica', fontWeight: 'normal' }}>APEXIS</Text><Text className="font-angelica" style={{ fontSize: 13, color: colors.primary, fontFamily: 'Angelica', fontWeight: 'normal' }}>PRO™</Text>
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>Please enter your full name to continue.</Text>
                    </View>

                    <View style={{ gap: 16, marginBottom: 32 }}>
                        <View>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Full Name</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. John Doe"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="words"
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                                style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }}
                            />
                        </View>
                    </View>

                    {error ? <Text style={{ color: '#ef4444', textAlign: 'center', marginVertical: 12, fontSize: 13 }}>{error}</Text> : null}

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isLoading}
                        style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.7 : 1 }}
                    >
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Continue</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
