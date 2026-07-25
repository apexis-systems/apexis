import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
    setFolderPassword,
    changeFolderPassword,
    verifyFolderPassword,
    removeFolderPassword,
    forgotFolderPasswordReset
} from '@/services/folderService';

interface FolderPasswordModalProps {
    visible: boolean;
    folder: any;
    user: any;
    initialMode?: 'unlock' | 'set' | 'change' | 'forgot' | 'remove';
    onClose: () => void;
    onSuccess: (action: 'unlocked' | 'updated' | 'removed') => void;
}

export default function FolderPasswordModal({
    visible,
    folder,
    user,
    initialMode = 'unlock',
    onClose,
    onSuccess
}: FolderPasswordModalProps) {
    const { colors, isDark } = useTheme();
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    const [mode, setMode] = useState<'unlock' | 'set' | 'change' | 'forgot' | 'remove'>(initialMode);
    
    // Form fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [email, setEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [removeSecurity, setRemoveSecurity] = useState(false);

    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showLoginPass, setShowLoginPass] = useState(false);

    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        setMode(initialMode);
        resetForm();
    }, [initialMode, visible]);

    const resetForm = () => {
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        setEmail(user?.email || '');
        setLoginPassword('');
        setRemoveSecurity(false);
        setShowPass(false);
        setShowConfirmPass(false);
        setShowCurrentPass(false);
        setShowLoginPass(false);
    };

    const handleUnlock = async () => {
        if (!password.trim()) {
            Alert.alert('Error', 'Please enter the folder password.');
            return;
        }
        setLoading(true);
        try {
            const res = await verifyFolderPassword(folder.id, password.trim());
            if (res.success) {
                resetForm();
                onSuccess('unlocked');
            } else {
                Alert.alert('Error', res.error || 'Incorrect password.');
            }
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.error || 'Failed to verify password.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async () => {
        if (!password.trim()) {
            Alert.alert('Error', 'Please enter a password.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await setFolderPassword(folder.id, password.trim());
            Alert.alert('Success', 'Confidential folder password set successfully.');
            resetForm();
            onSuccess('updated');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.error || 'Failed to set password.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all password fields.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await changeFolderPassword(folder.id, currentPassword.trim(), password.trim());
            Alert.alert('Success', 'Confidential folder password changed successfully.');
            resetForm();
            onSuccess('updated');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.error || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePassword = async () => {
        setLoading(true);
        try {
            await removeFolderPassword(folder.id, currentPassword.trim());
            Alert.alert('Success', 'Password protection removed.');
            resetForm();
            onSuccess('removed');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.error || 'Failed to remove password protection.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordReset = async () => {
        if (!email.trim() || !loginPassword.trim()) {
            Alert.alert('Error', 'Please provide your account login email and password.');
            return;
        }
        if (!removeSecurity) {
            if (!password.trim()) {
                Alert.alert('Error', 'Please enter a new folder password.');
                return;
            }
            if (password !== confirmPassword) {
                Alert.alert('Error', 'New folder passwords do not match.');
                return;
            }
        }

        setLoading(true);
        try {
            await forgotFolderPasswordReset(folder.id, {
                email: email.trim(),
                loginPassword: loginPassword.trim(),
                newPassword: removeSecurity ? undefined : password.trim(),
                removeSecurity
            });
            Alert.alert(
                'Success',
                removeSecurity ? 'Folder password security removed.' : 'Folder password reset successfully.'
            );
            resetForm();
            onSuccess(removeSecurity ? 'removed' : 'updated');
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.error || 'Account verification failed.');
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerTitleContainer}>
                                <Feather name="shield" size={22} color="#f43f5e" />
                                <Text style={[styles.title, { color: colors.text }]}>
                                    {mode === 'unlock' && 'Protected Folder'}
                                    {mode === 'set' && 'Set Folder Password'}
                                    {mode === 'change' && 'Change Folder Password'}
                                    {mode === 'forgot' && 'Reset Folder Password'}
                                    {mode === 'remove' && 'Remove Password'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                            {mode === 'unlock' && `Enter the password to access "${folder?.name || 'Confidential'}"`}
                            {mode === 'set' && `Set a security password for "${folder?.name || 'Confidential'}"`}
                            {mode === 'change' && `Update the password for "${folder?.name || 'Confidential'}"`}
                            {mode === 'forgot' && 'Verify your admin account credentials to reset folder password'}
                            {mode === 'remove' && `Remove password protection from "${folder?.name || 'Confidential'}"`}
                        </Text>

                        {/* MODE: UNLOCK */}
                        {mode === 'unlock' && (
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Folder Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showPass}
                                        placeholder="Enter folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                        <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {isAdmin && (
                                    <TouchableOpacity
                                        onPress={() => setMode('forgot')}
                                        style={styles.linkButton}
                                    >
                                        <Text style={styles.linkText}>Forgot Folder Password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* MODE: SET */}
                        {mode === 'set' && (
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>New Folder Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showPass}
                                        placeholder="Create folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                        <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Confirm Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showConfirmPass}
                                        placeholder="Confirm folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                                        <Feather name={showConfirmPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* MODE: CHANGE */}
                        {mode === 'change' && (
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Current Folder Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showCurrentPass}
                                        placeholder="Current folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                                        <Feather name={showCurrentPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>New Folder Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showPass}
                                        placeholder="New folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                        <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Confirm New Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showConfirmPass}
                                        placeholder="Confirm new folder password"
                                        placeholderTextColor={colors.textMuted}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                                        <Feather name={showConfirmPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {isAdmin && (
                                    <TouchableOpacity
                                        onPress={() => setMode('forgot')}
                                        style={styles.linkButton}
                                    >
                                        <Text style={styles.linkText}>Forgot Folder Password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* MODE: FORGOT */}
                        {mode === 'forgot' && (
                            <View style={styles.formGroup}>
                                <Text style={[styles.infoBox, { backgroundColor: isDark ? '#1e293b' : '#eff6ff', color: isDark ? '#93c5fd' : '#1e40af' }]}>
                                    Enter your Admin account email and app login password to authenticate and reset the folder security.
                                </Text>

                                <Text style={[styles.label, { color: colors.text, marginTop: 10 }]}>Admin Account Email</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="Your login email"
                                        placeholderTextColor={colors.textMuted}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>

                                <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Admin Login Password</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showLoginPass}
                                        placeholder="Your app login password"
                                        placeholderTextColor={colors.textMuted}
                                        value={loginPassword}
                                        onChangeText={setLoginPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowLoginPass(!showLoginPass)}>
                                        <Feather name={showLoginPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setRemoveSecurity(!removeSecurity)}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}
                                >
                                    <Feather
                                        name={removeSecurity ? 'check-square' : 'square'}
                                        size={18}
                                        color={removeSecurity ? '#f43f5e' : colors.textMuted}
                                    />
                                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: '500' }}>
                                        Completely remove password protection
                                    </Text>
                                </TouchableOpacity>

                                {!removeSecurity && (
                                    <>
                                        <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>New Folder Password</Text>
                                        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                            <TextInput
                                                style={[styles.input, { color: colors.text }]}
                                                secureTextEntry={!showPass}
                                                placeholder="Enter new folder password"
                                                placeholderTextColor={colors.textMuted}
                                                value={password}
                                                onChangeText={setPassword}
                                                autoCapitalize="none"
                                            />
                                            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Confirm New Password</Text>
                                        <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                            <TextInput
                                                style={[styles.input, { color: colors.text }]}
                                                secureTextEntry={!showConfirmPass}
                                                placeholder="Confirm new folder password"
                                                placeholderTextColor={colors.textMuted}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                autoCapitalize="none"
                                            />
                                            <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                                                <Feather name={showConfirmPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        )}

                        {/* MODE: REMOVE */}
                        {mode === 'remove' && (
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Current Folder Password (Optional for Admin)</Text>
                                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        secureTextEntry={!showCurrentPass}
                                        placeholder="Current password"
                                        placeholderTextColor={colors.textMuted}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                                        <Feather name={showCurrentPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {isAdmin && (
                                    <TouchableOpacity
                                        onPress={() => setMode('forgot')}
                                        style={styles.linkButton}
                                    >
                                        <Text style={styles.linkText}>Forgot Folder Password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actions}>
                            {mode === 'unlock' && (
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#f43f5e' }]}
                                    onPress={handleUnlock}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.btnText}>Unlock Folder</Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {mode === 'set' && (
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#f43f5e' }]}
                                    onPress={handleSetPassword}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.btnText}>Set Password</Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {mode === 'change' && (
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#f43f5e' }]}
                                    onPress={handleChangePassword}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.btnText}>Update Password</Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {mode === 'forgot' && (
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#f43f5e' }]}
                                    onPress={handleForgotPasswordReset}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.btnText}>Verify & Reset Password</Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {mode === 'remove' && (
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#ef4444' }]}
                                    onPress={handleRemovePassword}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.btnText}>Confirm Remove Security</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        borderWidth: 1,
        maxHeight: '90%',
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    title: {
        fontSize: 17,
        fontWeight: '700'
    },
    closeBtn: {
        padding: 4
    },
    subtitle: {
        fontSize: 12,
        marginBottom: 16
    },
    formGroup: {
        marginBottom: 16
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44
    },
    input: {
        flex: 1,
        fontSize: 14
    },
    linkButton: {
        marginTop: 10,
        alignSelf: 'flex-start'
    },
    linkText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#f43f5e'
    },
    infoBox: {
        fontSize: 12,
        padding: 10,
        borderRadius: 8,
        lineHeight: 16
    },
    actions: {
        marginTop: 10
    },
    btn: {
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14
    }
});
