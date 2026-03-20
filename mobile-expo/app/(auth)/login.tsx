import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
    View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginAdmin, loginProject } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Project Control' },
    { value: 'contributor', label: 'Contributor', desc: 'Field Work' },
    { value: 'client', label: 'Client', desc: 'View Only' },
];

export default function LoginScreen() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');

    const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

    const STORAGE_KEYS = {
        admin: 'remembered_admin_v2',
        contributor: 'remembered_contributor_v2',
        client: 'remembered_client_v2'
    };

    useEffect(() => {
        loadStoredCredentials();
    }, [selectedRole]);

    const loadStoredCredentials = async () => {
        try {
            const key = STORAGE_KEYS[selectedRole as keyof typeof STORAGE_KEYS];
            const stored = await SecureStore.getItemAsync(key);
            if (stored) {
                const data = JSON.parse(stored);
                setIdentifier(data.identifier || '');
                if (selectedRole === 'admin') setPassword(data.secret || '');
                else setProjectCode(data.secret || '');
                setRememberMe(true);
            } else {
                setIdentifier('');
                setPassword('');
                setProjectCode('');
                setRememberMe(false);
            }
        } catch (e) {
            console.error("Error loading credentials", e);
        }
    };

    const saveStoredCredentials = async () => {
        try {
            const key = STORAGE_KEYS[selectedRole as keyof typeof STORAGE_KEYS];
            if (rememberMe) {
                const data = {
                    identifier,
                    secret: selectedRole === 'admin' ? password : projectCode
                };
                await SecureStore.setItemAsync(key, JSON.stringify(data));
            } else {
                await SecureStore.deleteItemAsync(key);
            }
        } catch (e) {
            console.error("Error saving credentials", e);
        }
    };

    const handleLogin = async () => {
        if (!identifier || (selectedRole === 'admin' ? !password : !projectCode)) {
            setError(`Please enter ${selectedRole === 'admin' ? 'Email/Phone and Password' : 'Email/Phone and Project Code'}`);
            return;
        }

        setIsLoading(true);
        setError('');

        const isEmail = identifier.includes('@');
        const payload: any = {
            [isEmail ? 'email' : 'phone']: identifier,
            [selectedRole === 'admin' ? 'password' : 'code']: selectedRole === 'admin' ? password : projectCode
        };

        try {
            const res = selectedRole === 'admin'
                ? await loginAdmin(payload)
                : await loginProject(payload);

            if (res?.token) {
                await saveStoredCredentials();
                await login(res.token);
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Login failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">

                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <Image source={require('../../assets/images/app-icon.png')} style={{ width: 100, height: 100, marginBottom: 16 }} resizeMode="contain" />
                        <Text className="font-angelica" style={{ fontSize: 34, color: colors.primary }}>APEXIS</Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, letterSpacing: 4 }}>RECORD · REPORT · RELEASE</Text>
                    </View>

                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Select Role</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {roles.map((role) => (
                                <TouchableOpacity
                                    key={role.value}
                                    onPress={() => { setSelectedRole(role.value); setError(''); }}
                                    style={{
                                        flex: 1, borderRadius: 12, borderWidth: 2,
                                        borderColor: selectedRole === role.value ? colors.primary : colors.border,
                                        backgroundColor: selectedRole === role.value ? (colors.primary + '11') : colors.surface,
                                        padding: 10, alignItems: 'center', minHeight: 52, justifyContent: 'center'
                                    }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: selectedRole === role.value ? colors.primary : colors.text }}>{role.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ gap: 16 }}>
                        <View>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Email or Phone Number</Text>
                            <TextInput
                                value={identifier}
                                onChangeText={setIdentifier}
                                placeholder="you@example.com or +91..."
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }}
                            />
                        </View>

                        {selectedRole === 'admin' ? (
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Password</Text>
                                <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={{ flex: 1, color: colors.text }}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ marginTop: 6 }}>
                                    <Text style={{ fontSize: 11, color: colors.primary, marginTop: 4 }}>Forgot password?</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Project Code</Text>
                                <TextInput
                                    value={projectCode}
                                    onChangeText={setProjectCode}
                                    placeholder="Enter project code"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="characters"
                                    style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }}
                                />
                            </View>
                        )}
                    </View>

                    {error ? <Text style={{ color: '#ef4444', textAlign: 'center', marginVertical: 12, fontSize: 13 }}>{error}</Text> : <View style={{ height: 12 }} />}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <TouchableOpacity onPress={() => setRememberMe(!rememberMe)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: rememberMe ? colors.primary : colors.border, backgroundColor: rememberMe ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                            <Text style={{ fontSize: 13, color: colors.text }}>Remember Me</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleLogin} disabled={isLoading} style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20, opacity: isLoading ? 0.7 : 1 }}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Sign In</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>Don't have an account? <Text style={{ fontWeight: '600', color: colors.primary }}>Sign Up</Text></Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
