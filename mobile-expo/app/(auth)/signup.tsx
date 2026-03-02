import { useState, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { requestAdminOtp, verifyAdminOtp } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

type Step = 'details' | 'otp';

export default function SignUpScreen() {
    const [step, setStep] = useState<Step>('details');

    // Details
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [orgName, setOrgName] = useState('');
    const [password, setPassword] = useState('');

    // OTP
    const [otp, setOtp] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

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
                            CREATE ADMIN ACCOUNT
                        </Text>
                    </View>

                    {/* Step indicators */}
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

                    {/* Step 1: Details */}
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
                                <TextInput
                                    value={password}
                                    onChangeText={(val) => { setPassword(val); setError(''); }}
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
                                    backgroundColor: '#f97316',
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

                    {/* Step 2: OTP */}
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
