import { useState, useEffect } from 'react';
import {
    View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Pressable, TextInput as RNTextInput
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import {
    requestAdminOtp, verifyAdminOtp, verifyInvitation, completeOnboarding,
    verifyOnboardingToken, completePublicSignup
} from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';
import { useRef } from 'react';
import CountryCodePicker, { countries, Country, isIndianCountry } from '@/components/CountryCodePicker';

type Step = 'details' | 'otp' | 'onboarding' | 'public_onboarding';

export default function SignUpScreen() {
    const { token, publicToken } = useLocalSearchParams();
    const [step, setStep] = useState<Step>(token ? 'onboarding' : (publicToken ? 'public_onboarding' : 'details'));

    // Details / Onboarding / Public
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [orgName, setOrgName] = useState('');
    const [password, setPassword] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [role, setRole] = useState('');

    // OTP
    const [otp, setOtp] = useState('');
    const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // India
    const [error, setError] = useState('');

    // Derived: is the selected country India (the only one supporting phone OTP)
    const isIndian = isIndianCountry(selectedCountry);

    // When user changes to a non-Indian country, force email verification
    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        if (!isIndianCountry(country)) {
            setVerificationMethod('email');
        }
    };

    const { login } = useAuth();
    const router = useRouter();
    const otpRef = useRef<RNTextInput>(null);
    const { colors } = useTheme();

    useEffect(() => {
        if (token && typeof token === 'string') {
            handleVerifyToken(token);
        } else if (publicToken && typeof publicToken === 'string') {
            handleVerifyPublicToken(publicToken);
        }
    }, [token, publicToken]);

    const handleVerifyToken = async (t: string) => {
        setIsLoading(true);
        try {
            const res = await verifyInvitation(t);
            setEmail(res.email);
            setRole(res.role);
            setStep('onboarding');
        } catch (err: any) {
            Alert.alert("Invalid Link", "This invitation link is invalid or expired.");
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyPublicToken = async (t: string) => {
        setIsLoading(true);
        try {
            const res = await verifyOnboardingToken(t);
            setRole(res.role);
            setStep('public_onboarding');
        } catch (err: any) {
            Alert.alert("Invalid Link", "This onboarding link is invalid or expired.");
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOtp = async () => {
        // For non-Indian countries, email is required
        if (!isIndian && !email) {
            setError('Email is required for non-Indian phone numbers');
            return;
        }
        if (!name || (!email && !phone) || !orgName || password.length < 6) {
            setError('Please enter Name, Org Name, Password and (Email or Phone)');
            return;
        }

        setIsLoading(true);
        setError('');

        const digits = selectedCountry.phoneDigits;
        const cleanPhone = phone.trim().replace(selectedCountry.code, "").trim();

        if (phone && !new RegExp(`^\\d{${digits}}$`).test(cleanPhone)) {
            setError(`Please enter a valid ${digits}-digit phone number.`);
            setIsLoading(false);
            return;
        }

        const normalizedPhone = phone && new RegExp(`^\\d{${digits}}$`).test(cleanPhone)
            ? `${selectedCountry.code}${cleanPhone}`
            : phone?.trim();

        // Determine verification method: phone OTP only available for Indian numbers
        const effectiveMethod = isIndian
            ? ((email && phone) ? verificationMethod : (phone ? 'phone' : 'email'))
            : 'email';

        try {
            await requestAdminOtp({
                name,
                email: email || undefined,
                phone: normalizedPhone || undefined,
                password,
                organization_name: orgName,
                verification_method: effectiveMethod
            });
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

        const digits = selectedCountry.phoneDigits;
        const cleanPhone = phone.trim().replace(selectedCountry.code, "").trim();

        if (phone && !new RegExp(`^\\d{${digits}}$`).test(cleanPhone)) {
            setError(`Please enter a valid ${digits}-digit phone number.`);
            setIsLoading(false);
            return;
        }

        const normalizedPhone = phone && new RegExp(`^\\d{${digits}}$`).test(cleanPhone)
            ? `${selectedCountry.code}${cleanPhone}`
            : phone?.trim();

        const effectiveMethod = isIndian
            ? ((email && phone) ? verificationMethod : (phone ? 'phone' : 'email'))
            : 'email';

        try {
            const res = await verifyAdminOtp({
                email: email || undefined,
                phone: normalizedPhone || undefined,
                otp,
                verification_method: effectiveMethod
            });
            if (res?.token) {
                await login(res.token);
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to verify OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteOnboarding = async () => {
        // For private invitations
        const isProjectRole = role === 'contributor' || role === 'client';

        if (!name || (!isProjectRole && password.length < 6)) {
            setError('Please enter your name' + (!isProjectRole ? ' and a password' : ''));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await completeOnboarding({
                token: token as string,
                name,
                password: isProjectRole ? undefined : password
            });

            Alert.alert(
                "Account Setup",
                "Your account is ready! Please log in with your " + (isProjectRole ? "Project Code" : "Password") + " to continue.",
                [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
            );
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to complete setup.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompletePublicSignup = async () => {
        if (!name || (!email && !phone) || !projectCode) {
            setError('Name, Project Code and (Email or Phone) are required');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await completePublicSignup({
                token: publicToken as string,
                name,
                email: email || undefined,
                phone: (phone && /^\d{10}$/.test(phone.trim().replace(selectedCountry.code, "").trim())) ? `${selectedCountry.code}${phone.trim().replace(selectedCountry.code, "").trim()}` : phone?.trim(),
                project_code: projectCode
            });

            Alert.alert(
                "Signup Successful",
                "Your account has been created. You can now log in using your Project Code.",
                [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
            );
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to complete signup.");
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
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">

                    <View style={{ alignItems: 'center', marginBottom: 30 }}>
                        <Image source={require('../../assets/images/app-icon.png')} style={{ width: 80, height: 80, marginBottom: 12 }} resizeMode="contain" />
                        <Text className="font-angelica" style={{ fontSize: 30, color: colors.primary }}>APEXIS</Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, letterSpacing: 4 }}>
                            {step.includes('onboarding') ? 'ACCOUNT SETUP' : 'ADMIN REGISTRATION'}
                        </Text>
                    </View>

                    {/* Private Onboarding (Invitation) */}
                    {step === 'onboarding' && (
                        <View style={{ gap: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                                Welcome! Complete your profile
                            </Text>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Email Address</Text>
                                <TextInput value={email} editable={false} textContentType="emailAddress" autoComplete="email" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.textMuted, paddingHorizontal: 14 }} />
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Full Name</Text>
                                <TextInput value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.textMuted} autoCapitalize="words" textContentType="name" autoComplete="name" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>

                            {(role !== 'contributor' && role !== 'client') && (
                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Create Password</Text>
                                    <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                                        <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry={!showPassword} textContentType="newPassword" autoComplete="password-new" style={{ flex: 1, color: colors.text }} />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} /></TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {error ? <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 13 }}>{error}</Text> : null}

                            <TouchableOpacity onPress={handleCompleteOnboarding} disabled={isLoading} style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Complete Setup</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Public Onboarding Flow */}
                    {step === 'public_onboarding' && (
                        <View style={{ gap: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                                Join as {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Text>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Full Name</Text>
                                <TextInput value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.textMuted} autoCapitalize="words" textContentType="name" autoComplete="name" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Email Address</Text>
                                <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Phone Number (Optional)</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <CountryCodePicker selectedCountry={selectedCountry} onSelect={setSelectedCountry} />
                                    <TextInput value={phone} onChangeText={setPhone} placeholder="Phone Number (Optional)" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                                </View>
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Project Code</Text>
                                <TextInput value={projectCode} onChangeText={setProjectCode} placeholder="Enter your project code" placeholderTextColor={colors.textMuted} autoCapitalize="characters" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>

                            {error ? <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 13 }}>{error}</Text> : null}

                            <TouchableOpacity onPress={handleCompletePublicSignup} disabled={isLoading} style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Join Project</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Admin Registration Flow */}
                    {step === 'details' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Full Name</Text>
                                <TextInput value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.textMuted} autoCapitalize="words" textContentType="name" autoComplete="name" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Work Email{!isIndian ? <Text style={{ color: '#ef4444' }}> *</Text> : ''}
                                </Text>
                                <TextInput value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                                {!isIndian && (
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                                        Email is required for non-Indian numbers
                                    </Text>
                                )}
                            </View>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                    Phone Number{!isIndian ? ' (Optional)' : ''}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <CountryCodePicker selectedCountry={selectedCountry} onSelect={handleCountrySelect} />
                                    <TextInput
                                        value={phone}
                                        onChangeText={setPhone}
                                        placeholder={`${selectedCountry.phoneDigits}-digit number`}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="phone-pad"
                                        maxLength={selectedCountry.phoneDigits}
                                        style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }}
                                    />
                                </View>
                            </View>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Organization Name</Text>
                                <TextInput value={orgName} onChangeText={setOrgName} placeholder="Acme Corp" placeholderTextColor={colors.textMuted} autoCapitalize="words" style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14 }} />
                            </View>

                            {/* Show verify-via picker only for Indian numbers where both email & phone are filled */}
                            {isIndian && email && phone && (
                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 8 }}>Verify via</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {(['email', 'phone'] as const).map((m) => (
                                            <TouchableOpacity
                                                key={m}
                                                onPress={() => setVerificationMethod(m)}
                                                style={{
                                                    flex: 1, height: 44, borderRadius: 10, borderWidth: 2,
                                                    borderColor: verificationMethod === m ? colors.primary : colors.border,
                                                    backgroundColor: verificationMethod === m ? (colors.primary + '11') : colors.surface,
                                                    alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: verificationMethod === m ? colors.primary : colors.text }}>
                                                    {m.charAt(0).toUpperCase() + m.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {/* Non-Indian: show a note that email OTP will be sent */}
                            {!isIndian && email && phone && (
                                <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}>
                                        📧 OTP will be sent to your email – phone verification is only available for Indian numbers.
                                    </Text>
                                </View>
                            )}
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Password</Text>
                                <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                                    <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry={!showPassword} textContentType="password" autoComplete="password" style={{ flex: 1, color: colors.text }} />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} /></TouchableOpacity>
                                </View>
                            </View>
                            {error ? <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 13 }}>{error}</Text> : null}
                            <TouchableOpacity onPress={handleSendOtp} disabled={isLoading} style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Send OTP</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* OTP Step */}
                    {step === 'otp' && (
                        <View style={{ gap: 16 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, textAlign: 'center' }}>
                                Enter 6-digit OTP sent to {((email && phone) ? verificationMethod === 'email' : !phone) ? email : phone}
                            </Text>
                            <Pressable 
                                onPress={() => otpRef.current?.focus()}
                                style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 20 }}
                            >
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <View key={i} pointerEvents="none" style={{ width: 44, height: 52, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 2, borderColor: otp[i] ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{otp[i] || ''}</Text>
                                    </View>
                                ))}
                                <TextInput 
                                    ref={otpRef}
                                    value={otp} 
                                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))} 
                                    keyboardType="number-pad" 
                                    maxLength={6} 
                                    style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }} 
                                    autoFocus 
                                />
                            </Pressable>
                            {error ? <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 13 }}>{error}</Text> : null}
                            <TouchableOpacity onPress={handleVerifyOtp} disabled={otp.length !== 6 || isLoading} style={{ height: 52, borderRadius: 14, backgroundColor: otp.length === 6 ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.7 : 1 }}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: otp.length === 6 ? '#fff' : colors.textMuted }}>Verify & Sign Up</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStep('details')}><Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>← Change Details</Text></TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ alignItems: 'center', marginTop: 28 }}>
                        <Text style={{ fontSize: 14, color: colors.textMuted }}>Already have an account? <Text style={{ fontWeight: '600', color: colors.primary }}>Sign In</Text></Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
