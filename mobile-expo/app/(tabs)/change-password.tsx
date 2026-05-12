import { useState, useCallback } from 'react';
import { View, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, BackHandler, RefreshControl } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePassword } from '@/services/authService';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';


export default function ChangePasswordScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();


    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.push('/settings');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert(t('changePassword.errorTitle') as string, t('changePassword.fillAllFields') as string);
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert(t('changePassword.errorTitle') as string, t('changePassword.passwordsDoNotMatch') as string);
            return;
        }


        setPasswordLoading(true);
        try {
            await changePassword({ currentPassword, newPassword });
            Alert.alert(t('changePassword.successTitle') as string, t('changePassword.successMessage') as string, [
                { text: t('changePassword.ok') as string || 'OK', onPress: () => router.push('/settings') }
            ]);
        } catch (error: any) {
            Alert.alert(t('changePassword.errorTitle') as string, error.response?.data?.error || t('changePassword.failedUpdate') as string);
        } finally {

            setPasswordLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1 }}>
                        <View style={{ paddingTop: 20, paddingHorizontal: 24, marginBottom: 30 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
                                    <Feather name="arrow-left" size={24} color={colors.text} />
                                </TouchableOpacity>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>{t('changePassword.title')}</Text>
                            </View>

                        </View>

                        <ScrollView
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        >
                            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 20 }}>
                                {t('changePassword.description')}
                            </Text>


                            <View style={{ gap: 20 }}>
                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('changePassword.currentPassword')}</Text>

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
                                            <Feather name={showCurrent ? "eye" : "eye-off"} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('changePassword.newPassword')}</Text>

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
                                            <Feather name={showNew ? "eye" : "eye-off"} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('changePassword.confirmPassword')}</Text>

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
                                            <Feather name={showConfirm ? "eye" : "eye-off"} size={20} color={colors.textMuted} />
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
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{t('changePassword.updateButton')}</Text>
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
