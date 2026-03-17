import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePassword } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';

export default function ChangePasswordScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        setPasswordLoading(true);
        try {
            await changePassword({ currentPassword, newPassword });
            Alert.alert('Success', 'Password updated successfully', [
                { text: 'OK', onPress: () => router.push('/(tabs)/settings') }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        <View style={{ paddingTop: 20, paddingHorizontal: 24, marginBottom: 30 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{ marginRight: 16 }}>
                                    <Feather name="arrow-left" size={24} color={colors.text} />
                                </TouchableOpacity>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Change Password</Text>
                            </View>
                        </View>

                        <ScrollView
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 20 }}>
                                To protect your account, make sure your new password is at least 8 characters long and includes a mix of letters and numbers.
                            </Text>

                            <View style={{ gap: 20 }}>
                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Password</Text>
                                    <View style={{ height: 56, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                                        <RNTextInput
                                            style={{ flex: 1, color: colors.text, fontSize: 16 }}
                                            secureTextEntry={!showCurrent}
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={{ padding: 4 }}>
                                            <Feather name={showCurrent ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>New Password</Text>
                                    <View style={{ height: 56, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                                        <RNTextInput
                                            style={{ flex: 1, color: colors.text, fontSize: 16 }}
                                            secureTextEntry={!showNew}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        <TouchableOpacity onPress={() => setShowNew(!showNew)} style={{ padding: 4 }}>
                                            <Feather name={showNew ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirm New Password</Text>
                                    <View style={{ height: 56, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                                        <RNTextInput
                                            style={{ flex: 1, color: colors.text, fontSize: 16 }}
                                            secureTextEntry={!showConfirm}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                                            <Feather name={showConfirm ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={handleChangePassword}
                                    disabled={passwordLoading}
                                    style={{
                                        height: 56,
                                        borderRadius: 16,
                                        backgroundColor: colors.primary,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginTop: 10,
                                        opacity: passwordLoading ? 0.7 : 1,
                                        shadowColor: colors.primary,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 8,
                                        elevation: 4
                                    }}
                                >
                                    {passwordLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Update Password</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
