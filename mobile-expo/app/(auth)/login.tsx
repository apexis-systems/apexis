import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginAdmin, loginProject } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Full project control' },
    { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
    { value: 'client', label: 'Client', desc: 'View shared files only' },
];

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [clientName, setClientName] = useState('');

    const [selectedRole, setSelectedRole] = useState<Exclude<UserRole, 'superadmin'>>('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

    const handleLogin = async () => {
        setIsLoading(true);
        setError('');

        try {
            let res;
            if (selectedRole === 'admin') {
                console.log(email, password)
                res = await loginAdmin({ email, password });
                console.log(res)
            } else if (selectedRole === 'contributor') {
                res = await loginProject({ email, code: projectCode });
            } else if (selectedRole === 'client') {
                res = await loginProject({ name: clientName, code: projectCode });
            }

            if (res?.token) {
                const user = await login(res.token);
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo + Branding */}
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <View
                            style={{
                                height: 64,
                                width: 64,
                                borderRadius: 16,
                                backgroundColor: '#f97316',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}
                        >
                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>A</Text>
                        </View>
                        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
                            apexis
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, letterSpacing: 4 }}>
                            RECORD · REPORT · RELEASE
                        </Text>
                    </View>

                    {/* Dynamic Inputs Based on Role */}
                    {selectedRole === 'client' ? (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                Your Name
                            </Text>
                            <TextInput
                                value={clientName}
                                onChangeText={setClientName}
                                placeholder="John Doe"
                                placeholderTextColor={colors.textMuted}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    paddingHorizontal: 14,
                                    fontSize: 15,
                                }}
                            />
                        </View>
                    ) : (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                Work Email
                            </Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@company.com"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    paddingHorizontal: 14,
                                    fontSize: 15,
                                }}
                            />
                        </View>
                    )}

                    {selectedRole === 'admin' && (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                Password
                            </Text>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    paddingHorizontal: 14,
                                    fontSize: 15,
                                }}
                            />
                        </View>
                    )}

                    {(selectedRole === 'contributor' || selectedRole === 'client') && (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                Project Code
                            </Text>
                            <TextInput
                                value={projectCode}
                                onChangeText={setProjectCode}
                                placeholder="e.g. ABC123XYZ"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    color: colors.text,
                                    paddingHorizontal: 14,
                                    fontSize: 15,
                                }}
                            />
                        </View>
                    )}

                    {/* Role Selector */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
                            Select Role
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {roles.map((role) => (
                                <TouchableOpacity
                                    key={role.value}
                                    onPress={() => {
                                        setSelectedRole(role.value as Exclude<UserRole, 'superadmin'>);
                                        setError('');
                                    }}
                                    style={{
                                        flex: 1,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: selectedRole === role.value ? colors.primary : colors.border,
                                        backgroundColor: selectedRole === role.value ? 'rgba(249,115,22,0.1)' : colors.surface,
                                        padding: 8,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: selectedRole === role.value ? colors.primary : colors.text,
                                        }}
                                    >
                                        {role.label}
                                    </Text>
                                    <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>
                                        {role.desc}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {error ? (
                        <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12, fontSize: 13 }}>
                            {error}
                        </Text>
                    ) : null}

                    {/* Sign In Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={isLoading}
                        style={{
                            height: 48,
                            borderRadius: 12,
                            backgroundColor: '#f97316',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14,
                            opacity: isLoading ? 0.7 : 1,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    {/* Sign Up */}
                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>
                            Don't have an account?{' '}
                            <Text style={{ fontWeight: '600', color: colors.primary }}>Sign Up</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
