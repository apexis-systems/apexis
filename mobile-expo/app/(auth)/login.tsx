import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';

const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Full project control' },
    { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
    { value: 'client', label: 'Client', desc: 'View shared files only' },
];

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
    const { login } = useAuth();
    const router = useRouter();

    const handleLogin = () => {
        login(selectedRole);
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#111111' }}>
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
                        <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
                            apexis
                        </Text>
                        <Text style={{ fontSize: 11, color: '#888', marginTop: 4, letterSpacing: 4 }}>
                            RECORD · REPORT · RELEASE
                        </Text>
                    </View>

                    {/* Email */}
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 6 }}>
                            Work Email
                        </Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@company.com"
                            placeholderTextColor="#555"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={{
                                height: 48,
                                borderRadius: 12,
                                backgroundColor: '#1e1e1e',
                                color: '#fff',
                                paddingHorizontal: 14,
                                fontSize: 15,
                            }}
                        />
                    </View>

                    {/* Password */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 6 }}>
                            Password
                        </Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor="#555"
                            secureTextEntry
                            style={{
                                height: 48,
                                borderRadius: 12,
                                backgroundColor: '#1e1e1e',
                                color: '#fff',
                                paddingHorizontal: 14,
                                fontSize: 15,
                            }}
                        />
                    </View>

                    {/* Demo Role Selector */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 8 }}>
                            Demo Role
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {roles.map((role) => (
                                <TouchableOpacity
                                    key={role.value}
                                    onPress={() => setSelectedRole(role.value)}
                                    style={{
                                        flex: 1,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: selectedRole === role.value ? '#f97316' : '#2a2a2a',
                                        backgroundColor: selectedRole === role.value ? 'rgba(249,115,22,0.1)' : '#1e1e1e',
                                        padding: 10,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: selectedRole === role.value ? '#f97316' : '#fff',
                                        }}
                                    >
                                        {role.label}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' }}>
                                        {role.desc}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Sign In Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        style={{
                            height: 48,
                            borderRadius: 12,
                            backgroundColor: '#f97316',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Sign In</Text>
                    </TouchableOpacity>

                    {/* SSO */}
                    <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, color: '#888' }}>Sign in with SSO →</Text>
                    </TouchableOpacity>

                    {/* Sign Up */}
                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#888' }}>
                            Don't have an account?{' '}
                            <Text style={{ fontWeight: '600', color: '#f97316' }}>Sign Up</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
