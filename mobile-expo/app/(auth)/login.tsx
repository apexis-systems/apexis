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
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginAdmin, loginProject, loginSuperAdmin } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

const roles: { value: UserRole; label: string; desc: string }[] = [
    // { value: 'superadmin', label: 'Super Admin', desc: 'Full system control' },
    { value: 'admin', label: 'Admin', desc: 'Full project control' },
    { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
    { value: 'client', label: 'Client', desc: 'View shared files only' },
];

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [clientName, setClientName] = useState('');

    const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
                res = await loginAdmin({ email, password });
            } else if (selectedRole === 'superadmin') {
                res = await loginSuperAdmin({ email, password });
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
                                height: 128,
                                width: 128,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}
                        >
                            <Image
                                source={require('../../assets/images/app-icon.png')}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.primary, letterSpacing: -0.5, fontFamily: Platform.OS === 'ios' ? 'Angelica' : 'sans-serif' }}>
                            apexis
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, letterSpacing: 4 }}>
                            RECORD · REPORT · RELEASE
                        </Text>
                    </View>

                    {/* Role Selector */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
                            Select your role
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {roles.map((role) => (
                                <TouchableOpacity
                                    key={role.value}
                                    onPress={() => {
                                        setSelectedRole(role.value);
                                        setError('');
                                    }}
                                    style={{
                                        flex: 1,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: selectedRole === role.value ? colors.primary : colors.border,
                                        backgroundColor: selectedRole === role.value ? 'rgba(249,115,22,0.1)' : colors.surface,
                                        padding: 10,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 60,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: selectedRole === role.value ? colors.primary : colors.text,
                                            textAlign: 'center',
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

                    {/* Dynamic Inputs Based on Role */}
                    <View style={{ gap: 16 }}>
                        {selectedRole === 'client' ? (
                            <View>
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
                                        color: colors.text,
                                        paddingHorizontal: 14,
                                        fontSize: 15,
                                    }}
                                />
                            </View>
                        ) : (
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    {selectedRole === 'contributor' ? 'Email or Phone' : 'Work Email'}
                                </Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder={selectedRole === 'contributor' ? "email@example.com / +91..." : "you@company.com"}
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    style={{
                                        height: 48,
                                        borderRadius: 12,
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        paddingHorizontal: 14,
                                        fontSize: 15,
                                    }}
                                />
                            </View>
                        )}

                        {(selectedRole === 'admin' || selectedRole === 'superadmin') && (
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Password
                                </Text>
                                <View style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                }}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={{
                                            flex: 1,
                                            color: colors.text,
                                            fontSize: 15,
                                            height: '100%',
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={{ padding: 4 }}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                                            size={20}
                                            color={colors.textMuted}
                                        />
                                    </TouchableOpacity>
                                </View>
                                {/* Forgot Password - Functionality from snippet, UI from old code */}
                                {(selectedRole === 'admin' || selectedRole === 'superadmin') && (
                                    <TouchableOpacity
                                        onPress={() => router.push('/(auth)/forgot-password')}
                                        style={{ marginTop: 4 }}
                                    >
                                        <Text style={{ fontSize: 10, color: colors.primary }}>Forgot password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {(selectedRole === 'contributor' || selectedRole === 'client') && (
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Project Code
                                </Text>
                                <TextInput
                                    value={projectCode}
                                    onChangeText={setProjectCode}
                                    placeholder="Enter project code"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="characters"
                                    style={{
                                        height: 48,
                                        borderRadius: 12,
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        paddingHorizontal: 14,
                                        fontSize: 15,
                                    }}
                                />
                                <TouchableOpacity style={{ marginTop: 4 }}>
                                    <Text style={{ fontSize: 10, color: colors.primary }}>Forgot project code?</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {error ? (
                        <Text style={{ color: '#ef4444', textAlign: 'center', marginVertical: 12, fontSize: 13 }}>
                            {error}
                        </Text>
                    ) : <View style={{ height: 24 }} />}

                    {/* Sign In Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={isLoading}
                        style={{
                            height: 52,
                            borderRadius: 14,
                            backgroundColor: colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14,
                            opacity: isLoading ? 0.7 : 1,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    {/* SSO */}
                    {/* <TouchableOpacity style={{ alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>Login with SSO</Text>
                    </TouchableOpacity> */}

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
