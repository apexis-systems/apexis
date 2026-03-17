import { View, Text, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchSecureLogo } from '@/services/organizationService';
import { updateUserProfilePic } from '@/services/userService';
import { changePassword } from '@/services/authService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';
import { Modal, TextInput as RNTextInput } from 'react-native';

// const roles: { value: UserRole; label: string }[] = [
//     { value: 'admin', label: 'Admin' },
//     { value: 'contributor', label: 'Contributor' },
//     { value: 'client', label: 'Client' },
//     { value: 'superadmin', label: 'Super Admin' },
// ];

const roleBadgeColor: Record<UserRole, { bg: string; text: string }> = {
    admin: { bg: '#f97316', text: '#fff' },
    contributor: { bg: '#3b3b3b', text: '#fff' },
    client: { bg: '#1e1e1e', text: '#888' },
    superadmin: { bg: '#ef4444', text: '#fff' },
};

export default function ProfileScreen() {
    const { user, switchRole, logout, updateUser } = useAuth() as any;
    const router = useRouter();
    const { colors } = useTheme();

    const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    useEffect(() => {
        const loadProfilePic = async () => {
            if (user?.profile_pic) {
                const uri = await fetchSecureLogo(user.profile_pic);
                setProfilePicUri(uri);
            }
        };
        loadProfilePic();
    }, [user?.profile_pic]);

    if (!user) return null;

    const handleProfilePicUpload = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;

            setIsUploading(true);
            const asset = result.assets[0];
            const formData = new FormData();
            formData.append('profile_pic', {
                uri: asset.uri,
                type: asset.mimeType || 'image/jpeg',
                name: asset.fileName || 'profile.jpg',
            } as any);

            const res = await updateUserProfilePic(formData);
            if (res.profile_pic) {
                updateUser({ profile_pic: res.profile_pic });
                const uri = await fetchSecureLogo(res.profile_pic);
                setProfilePicUri(uri);
            }
            setIsPreviewOpen(false);
            Alert.alert('Success', 'Profile picture updated successfully');
        } catch (e) {
            console.error("Profile pic upload error:", e);
            Alert.alert('Error', 'Failed to upload profile picture');
        } finally {
            setIsUploading(false);
        }
    };

    const badge = { ...roleBadgeColor[user.role as UserRole] };
    if (user.role === 'client') {
        badge.bg = colors.surface;
        badge.text = colors.textMuted;
    }

    const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => {
                    logout();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

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
            Alert.alert('Success', 'Password updated successfully');
            setIsPasswordModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update password');
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Avatar + Info */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                    <TouchableOpacity
                        onPress={() => setIsPreviewOpen(true)}
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            position: 'relative'
                        }}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : profilePicUri ? (
                            <Image source={{ uri: profilePicUri }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                        ) : (
                            <Feather name="user" size={40} color={colors.textMuted} />
                        )}
                        <View style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
                            alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background
                        }}>
                            <Feather name="camera" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{user.name}</Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{user.email}</Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 12,
                            borderRadius: 20,
                            backgroundColor: badge.bg,
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                        }}
                    >
                        <Feather name="shield" size={12} color={badge.text} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: badge.text }}>{roleLabel}</Text>
                    </View>
                </View>

                {/* Navigation Group */}
                <View style={{ gap: 12, marginBottom: 24 }}>
                    {user.role === 'admin' && (
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)')} // Corrected navigation path
                            style={{
                                borderRadius: 16,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 14
                            }}
                        >
                            <View style={{ backgroundColor: colors.background, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="briefcase" size={20} color={colors.text} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Company Settings</Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Manage logo and branding</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/linked-devices')}
                        style={{
                            borderRadius: 16,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14
                        }}
                    >
                        <View style={{ backgroundColor: colors.background, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="smartphone" size={20} color={colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Linked Devices</Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Scan QR to log in on Web</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsPasswordModalVisible(true)}
                        style={{
                            borderRadius: 16,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14
                        }}
                    >
                        <View style={{ backgroundColor: colors.background, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="lock" size={20} color={colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Change Password</Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Update your account security</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Role Switcher */}
                <View
                    style={{
                        borderRadius: 16,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 16,
                        marginBottom: 24,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Feather name="edit-3" size={16} color={colors.textMuted} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Switch Demo Role</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['admin', 'contributor', 'client'].map((r) => (
                            <TouchableOpacity
                                key={r}
                                onPress={() => switchRole(r as UserRole)}
                                style={{
                                    flex: 1,
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: user.role === r ? colors.primary : colors.border,
                                    backgroundColor: user.role === r ? 'rgba(249,115,22,0.1)' : colors.background,
                                    paddingVertical: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: user.role === r ? colors.primary : colors.textMuted,
                                    }}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Sign Out */}
                <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                        height: 52,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: 'rgba(239,68,68,0.05)'
                    }}
                >
                    <Feather name="log-out" size={18} color="#ef4444" />
                    <Text style={{ fontSize: 15, color: '#ef4444', fontWeight: '700' }}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            <LogoPreviewModal
                visible={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                logoSource={profilePicUri ? { uri: profilePicUri } : null}
                canChange={true}
                onChangePress={handleProfilePicUpload}
                uploading={isUploading}
                isCircular={false}
                title="Profile Picture"
                subtitle="This photo is visible to your team members and clients."
                buttonText="Change Photo"
            />

            {/* Change Password Modal */}
            <Modal
                visible={isPasswordModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsPasswordModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Change Password</Text>
                            <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Current Password</Text>
                                <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                                    <RNTextInput
                                        style={{ flex: 1, color: colors.text, fontSize: 15 }}
                                        secureTextEntry={!showPasswords}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    <TouchableOpacity onPress={() => setShowPasswords(!showPasswords)}>
                                        <Feather name={showPasswords ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>New Password</Text>
                                <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, justifyContent: 'center' }}>
                                    <RNTextInput
                                        style={{ color: colors.text, fontSize: 15 }}
                                        secureTextEntry={!showPasswords}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Confirm New Password</Text>
                                <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, justifyContent: 'center' }}>
                                    <RNTextInput
                                        style={{ color: colors.text, fontSize: 15 }}
                                        secureTextEntry={!showPasswords}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleChangePassword}
                                disabled={passwordLoading}
                                style={{
                                    height: 52,
                                    borderRadius: 14,
                                    backgroundColor: colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                    opacity: passwordLoading ? 0.7 : 1
                                }}
                            >
                                {passwordLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Update Password</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
