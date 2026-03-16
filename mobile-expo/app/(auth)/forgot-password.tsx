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
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { forgotPasswordRequestOtp, forgotPasswordVerifyOtp, resetPassword } from '@/services/authService';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen() {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const { colors } = useTheme();

    const handleRequestOtp = async () => {
        if (!email) {
            Alert.alert("Error", "Please enter your email");
            return;
        }
        setIsLoading(true);
        try {
            await forgotPasswordRequestOtp(email, 'admin');
            setStep('otp');
            Alert.alert("Success", "OTP sent to your email");
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Failed to send OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            Alert.alert("Error", "Please enter verification code");
            return;
        }
        setIsLoading(true);
        try {
            const res = await forgotPasswordVerifyOtp(email, otp);
            setResetToken(res.resetToken);
            setStep('reset');
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Invalid OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }
        setIsLoading(true);
        try {
            await resetPassword(resetToken, newPassword);
            Alert.alert("Success", "Password reset successful", [
                { text: "OK", onPress: () => router.replace('/(auth)/login') }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Failed to reset password");
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
                <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="arrow-back" size={20} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Back</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
                            {step === 'email' ? 'Forgot Password?' : step === 'otp' ? 'Verify OTP' : 'Reset Password'}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
                            {step === 'email'
                                ? "Enter your registered email to receive a verification code."
                                : step === 'otp'
                                    ? `Enter the 6-digit code sent to ${email}`
                                    : "Create a new secure password for your account."}
                        </Text>
                    </View>

                    {step === 'email' && (
                        <View>
                            <View style={{ marginBottom: 20 }}>
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
                            <TouchableOpacity
                                onPress={handleRequestOtp}
                                disabled={isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Send Code</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 'otp' && (
                        <View>
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Verification Code
                                </Text>
                                <TextInput
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder="123456"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    style={{
                                        height: 56,
                                        borderRadius: 12,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        color: colors.text,
                                        paddingHorizontal: 14,
                                        fontSize: 24,
                                        textAlign: 'center',
                                        letterSpacing: 8,
                                        fontWeight: 'bold',
                                    }}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleVerifyOtp}
                                disabled={isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Verify Code</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStep('email')} style={{ marginTop: 16, alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Use a different email</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 'reset' && (
                        <View>
                            <View style={{ marginBottom: 12, alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>Account</Text>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{email}</Text>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    New Password
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
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={{ flex: 1, color: colors.text, fontSize: 15 }}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Confirm New Password
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
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry={!showPassword}
                                        style={{ flex: 1, color: colors.text, fontSize: 15 }}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleResetPassword}
                                disabled={isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Reset Password</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
