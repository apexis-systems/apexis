import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

type Step = 'contact' | 'otp' | 'role';

const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Full project control' },
    { value: 'contributor', label: 'Contributor', desc: 'Upload & view assigned' },
    { value: 'client', label: 'Client', desc: 'View shared files only' },
];

export default function SignUpScreen() {
    const [step, setStep] = useState<Step>('contact');
    const [contact, setContact] = useState('');
    const [otp, setOtp] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>('contributor');
    const { login } = useAuth();
    const router = useRouter();

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isMobile = /^\d{10}$/.test(contact);
    const isValidContact = isEmail || isMobile;
    const contactType = isEmail ? 'email' : 'number';

    const handleSendOtp = () => {
        if (!isValidContact) {
            Alert.alert('Invalid', 'Please enter a valid email or 10-digit mobile number');
            return;
        }
        Alert.alert('OTP Sent', `OTP sent to ${contact}`);
        setStep('otp');
    };

    const handleVerifyOtp = () => {
        if (otp.length !== 6) {
            Alert.alert('Invalid', 'Please enter the 6-digit OTP');
            return;
        }
        // Mock: accept any 6-digit code
        setStep('role');
    };

    const handleCreateAccount = () => {
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
                        <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
                            apexis
                        </Text>
                        <Text style={{ fontSize: 11, color: '#888', marginTop: 4, letterSpacing: 4 }}>
                            CREATE YOUR ACCOUNT
                        </Text>
                    </View>

                    {/* Step indicators */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
                        {(['contact', 'otp', 'role'] as Step[]).map((s, i) => (
                            <View
                                key={s}
                                style={{
                                    width: step === s ? 24 : 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: step === s ? '#f97316' :
                                        (['contact', 'otp', 'role'].indexOf(step) > i) ? '#f9731666' : '#2a2a2a',
                                }}
                            />
                        ))}
                    </View>

                    {/* Step 1: Contact */}
                    {step === 'contact' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 6 }}>
                                    Email or Mobile Number
                                </Text>
                                <TextInput
                                    value={contact}
                                    onChangeText={setContact}
                                    placeholder="you@company.com or 9876543210"
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
                                {contact.length > 0 && !isValidContact && (
                                    <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>
                                        Enter a valid email or 10-digit mobile number
                                    </Text>
                                )}
                            </View>

                            <TouchableOpacity
                                onPress={handleSendOtp}
                                disabled={!isValidContact}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: isValidContact ? '#f97316' : '#2a2a2a',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: '600', color: isValidContact ? '#fff' : '#555' }}>
                                    Send OTP
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 2: OTP */}
                    {step === 'otp' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 4 }}>
                                    Enter 6-digit OTP
                                </Text>
                                <Text style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
                                    Sent to {contact}
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
                                                backgroundColor: '#1e1e1e',
                                                borderWidth: 2,
                                                borderColor: otp[i] ? '#f97316' : '#2a2a2a',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>
                                                {otp[i] || ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Hidden OTP input */}
                                <TextInput
                                    value={otp}
                                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
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

                            <TouchableOpacity
                                onPress={handleVerifyOtp}
                                disabled={otp.length !== 6}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: otp.length === 6 ? '#f97316' : '#2a2a2a',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: '600', color: otp.length === 6 ? '#fff' : '#555' }}>
                                    Verify OTP
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { setStep('contact'); setOtp(''); }}
                                style={{ alignItems: 'center', paddingVertical: 4 }}
                            >
                                <Text style={{ fontSize: 13, color: '#888' }}>
                                    ← Change {contactType}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 3: Role */}
                    {step === 'role' && (
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 10 }}>
                                    Select Your Role
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
                                                padding: 12,
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

                            <TouchableOpacity
                                onPress={handleCreateAccount}
                                style={{
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: '#f97316',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                                    Create Account
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Back to Sign In */}
                    <TouchableOpacity
                        onPress={() => router.replace('/(auth)/login')}
                        style={{ alignItems: 'center', marginTop: 28 }}
                    >
                        <Text style={{ fontSize: 13, color: '#888' }}>
                            Already have an account?{' '}
                            <Text style={{ fontWeight: '600', color: '#f97316' }}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
