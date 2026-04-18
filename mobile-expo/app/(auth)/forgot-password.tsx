import { useState } from 'react';
import {
    View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Pressable, TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { forgotPasswordRequestOtp, forgotPasswordVerifyOtp, resetPassword } from '@/services/authService';
import CountryCodePicker, { countries, Country, isIndianCountry } from '@/components/CountryCodePicker';
import { useRef, useEffect } from 'react';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen() {
    const [step, setStep] = useState<Step>('email');
    const [identifier, setIdentifier] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // India
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const otpRef = useRef<RNTextInput>(null);

    const router = useRouter();
    const { colors } = useTheme();

    useEffect(() => {
        let interval: any;
        if (step === 'otp' && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const getNormalizedIdentifier = () => {
        const isEmail = identifier.includes('@');
        const isDigitsOnly = /^\d+$/.test(identifier.trim());
        const cleanIdentifier = identifier.trim().replace(selectedCountry.code, "").trim();
        
        if (isEmail) return { email: identifier.trim().toLowerCase() };
        
        if (isDigitsOnly || identifier.includes('+') || (identifier.length > 0 && /^\d/.test(identifier))) {
            if (!isIndianCountry(selectedCountry)) {
                return { error: "Phone OTP is only available for Indian numbers (+91). Please use your email address or an Indian phone number." };
            }
            if (!/^\d{10}$/.test(cleanIdentifier)) {
                return { error: "Please enter a valid 10-digit phone number." };
            }
            return { phone: `${selectedCountry.code}${cleanIdentifier}` };
        }
        
        return { error: "Please enter a valid email or phone number." };
    };

    const handleRequestOtp = async () => {
        if (!identifier) {
            Alert.alert("Error", "Please enter your email or phone number");
            return;
        }

        const authData = getNormalizedIdentifier();
        if (authData.error) {
            Alert.alert("Error", authData.error);
            return;
        }

        setIsLoading(true);
        try {
            await forgotPasswordRequestOtp({ ...authData, role: 'admin' });
            setStep('otp');
            setTimer(60);
            setCanResend(false);
            setOtp('');
            Alert.alert("Success", `OTP sent to your ${authData.email ? 'email' : 'phone number'}`);
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

        const authData = getNormalizedIdentifier();
        if (authData.error) {
            Alert.alert("Error", authData.error);
            return;
        }

        setIsLoading(true);
        try {
            const res = await forgotPasswordVerifyOtp({ ...authData, otp });
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
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
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
                                ? "Enter your registered email or phone number to receive a verification code."
                                : step === 'otp'
                                    ? `Enter the 6-digit code sent to ${identifier}`
                                    : "Create a new secure password for your account."}
                        </Text>
                    </View>

                    {step === 'email' && (
                        <View>
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Email or Phone Number
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {(identifier.length > 0 && /^\d/.test(identifier)) && (
                                        <CountryCodePicker 
                                            selectedCountry={selectedCountry} 
                                            onSelect={setSelectedCountry} 
                                        />
                                    )}
                                    <TextInput
                                        value={identifier}
                                        onChangeText={setIdentifier}
                                        placeholder="Email or Phone Number"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType={identifier.includes('@') ? "email-address" : "default"}
                                        autoCapitalize="none"
                                        style={{
                                            flex: 1,
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
                                {identifier.length > 0 && !identifier.includes('@') && !isIndianCountry(selectedCountry) && (
                                    <View style={{ marginTop: 8, backgroundColor: colors.surface, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}>
                                            📧 Phone OTP is only available for Indian numbers. Please use email or an Indian number.
                                        </Text>
                                    </View>
                                )}
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
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, textAlign: 'center', marginBottom: 12 }}>
                                    Verification Code
                                </Text>
                                
                                <Pressable 
                                    onPress={() => otpRef.current?.focus()}
                                    style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}
                                >
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <View 
                                            key={i} 
                                            pointerEvents="none" 
                                            style={{ 
                                                width: 44, 
                                                height: 52, 
                                                borderRadius: 10, 
                                                backgroundColor: colors.surface, 
                                                borderWidth: 2, 
                                                borderColor: otp[i] ? colors.primary : colors.border, 
                                                alignItems: 'center', 
                                                justifyContent: 'center' 
                                            }}
                                        >
                                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{otp[i] || ''}</Text>
                                        </View>
                                    ))}
                                    <RNTextInput 
                                        ref={otpRef}
                                        value={otp} 
                                        onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))} 
                                        keyboardType="number-pad" 
                                        maxLength={6} 
                                        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }} 
                                        autoFocus 
                                    />
                                </Pressable>
                            </View>

                            <TouchableOpacity
                                onPress={handleVerifyOtp}
                                disabled={otp.length !== 6 || isLoading}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: otp.length === 6 ? colors.primary : colors.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLoading ? 0.7 : 1,
                                }}
                            >
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: otp.length === 6 ? '#fff' : colors.textMuted }}>Verify Code</Text>}
                            </TouchableOpacity>

                            <View style={{ alignItems: 'center', gap: 14, marginTop: 20 }}>
                                <TouchableOpacity 
                                    onPress={handleRequestOtp} 
                                    disabled={!canResend || isLoading}
                                >
                                    <Text style={{ 
                                        fontSize: 14, 
                                        color: (canResend && !isLoading) ? colors.primary : colors.textMuted,
                                        fontWeight: '600'
                                    }}>
                                        {isLoading ? "Resending..." : (canResend ? "Resend Code" : `Resend Code in ${timer}s`)}
                                    </Text>
                                </TouchableOpacity>

                                {!identifier.includes('@') && (
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setStep('email');
                                            setIdentifier('');
                                            Alert.alert("Switch to Email", "Please enter your registered email address.");
                                        }}
                                        disabled={isLoading}
                                    >
                                        <Text style={{ fontSize: 13, color: colors.textMuted }}>
                                            Didn't receive? <Text style={{ color: colors.primary, fontWeight: '600' }}>Receive via Mail</Text>
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity onPress={() => setStep('email')} style={{ alignItems: 'center' }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>Use a different account</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {step === 'reset' && (
                        <View>
                            <View style={{ marginBottom: 12, alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>Account</Text>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{identifier}</Text>
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
                                        <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} />
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
