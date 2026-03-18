import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchSecureLogo } from '@/services/organizationService';
import { updateUserProfilePic } from '@/services/userService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';

// const roles: { value: UserRole; label: string }[] = [
//     { value: 'admin', label: 'Admin' },
//     { value: 'contributor', label: 'Contributor' },
//     { value: 'client', label: 'Client' },
//     { value: 'superadmin', label: 'Super Admin' },
// ];

const roleBadgeColor: Record<UserRole, { bg: string; text: string }> = {
    admin: { bg: '#f97415', text: '#fff' },
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

    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
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
                            onPress={() => router.push('/(tabs)/company-settings')}
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
                        onPress={() => router.push('/(tabs)/change-password')}
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
                {/* <View
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
                </View> */}

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

        </SafeAreaView>
    );
}
