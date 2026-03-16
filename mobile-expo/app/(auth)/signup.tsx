import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { requestAdminOtp, verifyAdminOtp, verifyInvitation, completeOnboarding } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

type Step = 'details' | 'otp' | 'onboarding';

export default function SignUpScreen() {
    const { token } = useLocalSearchParams();
    const [step, setStep] = useState<Step>(token ? 'onboarding' : 'details');

    // Details / Onboarding
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [orgName, setOrgName] = useState('');
    const [password, setPassword] = useState('');

    // OTP
    const [otp, setOtp] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

    useEffect(() => {
        if (token && typeof token === 'string') {
            handleVerifyToken(token);
        }
    }, [token]);

    const handleVerifyToken = async (t: string) => {
        setIsLoading(true);
        try {
            const res = await verifyInvitation(t);
            setEmail(res.email);
            setStep('onboarding');
        } catch (err: any) {
            Alert.alert("Invalid Link", "This invitation link is invalid or expired.");
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!name || !email || !orgName || password.length < 6) {
            setError('Please fill all fields and ensure password is >= 6 chars');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await requestAdminOtp({ name, email, password, organization_name: orgName });
            setStep('otp');
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to send OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            setError('Please enter the 6-digit OTP');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const res = await verifyAdminOtp({ email, otp });
            if (res?.token) {
                await login(res.token);
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Invalid OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteOnboarding = async () => {
        if (!name || password.length < 6) {
            setError('Please enter your name and a password (at least 6 chars)');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await completeOnboarding({ token: token as string, name, password });

            // Auto Login
            try {
                // If the user setup their account, we can try logging them in immediately
                // Note: The completeOnboarding might not return a token in our current backend, 
                // so we might need a separate login call if backend doesn't change.
                // However, the user request says "it should remove already loged in user and login again"
                // So we'll perform a login here.

                // We need a login service that works for admins/superadmins.
                // Let's check what service to use. The current file uses login from useAuth which takes a token.
                // We'll need to fetch the token first.

                // Assuming loginAdmin or loginSuperAdmin would work based on the role.
                // Since this is signup.tsx (typically for admins), we'll try loginAdmin or similar.
                // Actually, let's use the provided credentials to login.

                const { loginAdmin } = require('@/services/authService');
                const logRes = await loginAdmin({ email, password });
                if (logRes?.token) {
                    await login(logRes.token);
                    Alert.alert(
                        "Success",
                        "Account setup complete! You are now logged in.",
                        [{ text: "OK", onPress: () => router.replace('/(tabs)') }]
                    );
                    return;
                }
            } catch (loginErr) {
                console.error("Auto login failed", loginErr);
            }

            Alert.alert(
                "Account Setup",
                "Your account is ready! Please log in to continue.",
                [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
            );
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to complete setup.");
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
                    {/* Branding */}
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <View
                            style={{
                                height: 64,
                                width: 64,
                                borderRadius: 16,
                                backgroundColor: colors.primary,
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
                            {step === 'onboarding' ? 'COMPLETE YOUR ACCOUNT' : 'CREATE ADMIN ACCOUNT'}
                        </Text>
                    </View>

                    {/* Step indicators (Hide for onboarding) */}
                    {step !== 'onboarding' && (
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
                            {(['details', 'otp'] as Step[]).map((s, i) => (
                                <View
                                    key={s}
                                    style={{
                                        width: step === s ? 24 : 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: step === s ? colors.primary :
                                            (['details', 'otp'].indexOf(step) > i) ? `${colors.primary}66` : colors.border,
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    {/* Onboarding Flow (Invited Admin) */}
                    {step === 'onboarding' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Email Address
                                </Text>
                                <TextInput
                                    value={email}
                                    editable={false}
                                    style={{
                                        height: 48,
                                        borderRadius: 12,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        color: colors.textMuted,
                                        paddingHorizontal: 14,
                                        fontSize: 15,
                                    }}
                                />
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Full Name
                                </Text>
                                <TextInput
                                    value={name}
                                    onChangeText={(val) => { setName(val); setError(''); }}
                                    placeholder="John Doe"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="words"
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

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Create Password
                                </Text>
                                <View style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                }}>
                                    <TextInput
                                        value={password}
                                        onChangeText={(val) => { setPassword(val); setError(''); }}
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
                            </View>

                            {error ? (
                                <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 4, fontSize: 13 }}>
                                    {error}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                onPress={handleCompleteOnboarding}
                                disabled={isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                                        Complete Setup
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 1: Details (Registration) */}
                    {step === 'details' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Full Name
                                </Text>
                                <TextInput
                                    value={name}
                                    onChangeText={(val) => { setName(val); setError(''); }}
                                    placeholder="John Doe"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="words"
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

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Work Email
                                </Text>
                                <TextInput
                                    value={email}
                                    onChangeText={(val) => { setEmail(val); setError(''); }}
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

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Organization Name
                                </Text>
                                <TextInput
                                    value={orgName}
                                    onChangeText={(val) => { setOrgName(val); setError(''); }}
                                    placeholder="Acme Corp"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="words"
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

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Password
                                </Text>
                                <View style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                }}>
                                    <TextInput
                                        value={password}
                                        onChangeText={(val) => { setPassword(val); setError(''); }}
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
                            </View>

                            {error ? (
                                <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 4, fontSize: 13 }}>
                                    {error}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                onPress={handleSendOtp}
                                disabled={isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                                        Send OTP
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 2: OTP (Registration) */}
                    {step === 'otp' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 4 }}>
                                    Enter 6-digit OTP
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>
                                    Sent to {email}
                                </Text>

                                {/* OTP boxes */}
                                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                width: 44,
                                                height: 52,
                                                borderRadius: 10,
                                                backgroundColor: colors.surface,
                                                borderWidth: 2,
                                                borderColor: otp[i] ? colors.primary : colors.border,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
                                                {otp[i] || ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Hidden OTP input */}
                                <TextInput
                                    value={otp}
                                    onChangeText={(val) => { setOtp(val.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0,
                                        height: 52,
                                        width: '100%',
                                    }}
                                    autoFocus
                                />
                            </View>

                            {error ? (
                                <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 4, fontSize: 13 }}>
                                    {error}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                onPress={handleVerifyOtp}
                                disabled={otp.length !== 6 || isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: otp.length === 6 ? colors.primary : colors.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: otp.length === 6 ? '#fff' : colors.textMuted }}>
                                        Verify OTP & Create Account
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { setStep('details'); setOtp(''); setError(''); }}
                                style={{ alignItems: 'center', paddingVertical: 4 }}
                            >
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                                    ← Change Details
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Back to Sign In */}
                    <TouchableOpacity
                        onPress={() => router.replace('/(auth)/login')}
                        style={{ alignItems: 'center', marginTop: 28 }}
                    >
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>
                            Already have an account?{' '}
                            <Text style={{ fontWeight: '600', color: colors.primary }}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
