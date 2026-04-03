import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';

import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchSecureLogo } from '@/services/organizationService';
import { updateUserProfilePic, updateUserName } from '@/services/userService';
import { getMyMemberships, switchContext } from '@/services/authService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';
import { Text, TextInput } from '@/components/ui/AppText';

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
    const { user, login, logout, updateUser } = useAuth() as any;
    const router = useRouter();
    const { colors } = useTheme();

    const [memberships, setMemberships] = useState<any[]>([]);
    const [isSwitching, setIsSwitching] = useState(false);

    const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [nameLoading, setNameLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setEditNameValue(user.name || '');
        }
    }, [user?.name]);

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            getMyMemberships().then(res => {
                if (res.memberships) setMemberships(res.memberships);
            }).catch(err => console.error("Load memberships error:", err));
        }
    }, [user?.id]);

    const handleSwitchContext = async (projectId: number, role: string) => {
        if (isSwitching) return;
        setIsSwitching(true);
        try {
            const res = await switchContext(projectId, role);
            if (res.token) {
                await login(res.token);
                Alert.alert('Success', `Switched to ${role} role.`);
                router.replace('/(tabs)');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to switch project context.');
        } finally {
            setIsSwitching(false);
        }
    };

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

    const handleSaveName = async () => {
        if (!editNameValue.trim() || editNameValue === user.name) {
            setIsEditingName(false);
            return;
        }
        setNameLoading(true);
        try {
            await updateUserName({ name: editNameValue });
            updateUser({ name: editNameValue.trim() });
            Alert.alert('Success', 'Name updated successfully');
            setIsEditingName(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to update name');
        } finally {
            setNameLoading(false);
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
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
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

                    {isEditingName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <TextInput
                                value={editNameValue}
                                onChangeText={setEditNameValue}
                                autoFocus
                                style={{
                                    height: 40,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 8,
                                    paddingHorizontal: 16,
                                    color: colors.text,
                                    fontSize: 18,
                                    minWidth: 150,
                                    textAlign: 'center'
                                }}
                            />
                            <TouchableOpacity onPress={handleSaveName} disabled={nameLoading} style={{ padding: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 20 }}>
                                {nameLoading ? <ActivityIndicator size="small" color="#22c55e" /> : <Feather name="check" size={20} color="#22c55e" />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setIsEditingName(false); setEditNameValue(user?.name); }} style={{ padding: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20 }}>
                                <Feather name="x" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => setIsEditingName(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{user.name}</Text>
                            <Feather name="edit-2" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}

                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{user.email || user.phone_number}</Text>
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
                            onPress={() => router.push('/company-settings')}
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
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => router.push('/linked-devices')}
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

                    {(user.role === 'admin' || user.role === 'superadmin') && (
                        <TouchableOpacity
                            onPress={() => router.push('/change-password')}
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
                    )}
                </View>

                {/* Switch Project / Role Section */}
                {(() => {
                    const filtered = memberships.filter(m => !(Number(m.project_id) === Number(user.project_id) && m.role === user.role));
                    if (filtered.length === 0) return null;

                    // Group by project_id
                    const groups: Record<number, any> = {};
                    filtered.forEach(m => {
                        if (!groups[m.project_id]) {
                            groups[m.project_id] = {
                                project: m.project,
                                roles: []
                            };
                        }
                        groups[m.project_id].roles.push(m.role);
                    });

                    return (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 }}>Switch Project / Role</Text>
                            <View style={{ gap: 12 }}>
                                {Object.values(groups).map((group: any, idx) => (
                                    <View
                                        key={idx}
                                        style={{
                                            borderRadius: 24,
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            padding: 16,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 10,
                                            elevation: 3
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                                            <View style={{ 
                                                backgroundColor: 'rgba(249,115,22,0.1)', 
                                                width: 44, 
                                                height: 44, 
                                                borderRadius: 14, 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                borderWidth: 1,
                                                borderColor: 'rgba(249,115,22,0.2)'
                                            }}>
                                                <Feather name="layers" size={22} color="#f97316" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>{group.project?.name || 'Project'}</Text>
                                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{group.project?.organization?.name}</Text>
                                            </View>
                                        </View>

                                        <View style={{ gap: 8 }}>
                                            {group.roles.map((r: string, rIdx: number) => (
                                                <TouchableOpacity
                                                    key={rIdx}
                                                    onPress={() => handleSwitchContext(group.project.id, r)}
                                                    disabled={isSwitching}
                                                    activeOpacity={0.7}
                                                    style={{
                                                        backgroundColor: r === 'admin' ? 'rgba(249,115,22,0.1)' : colors.surface,
                                                        borderWidth: 1,
                                                        borderColor: r === 'admin' ? '#f97316' : colors.border,
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 12,
                                                        borderRadius: 14,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <View style={{ backgroundColor: roleBadgeColor[r as UserRole]?.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff', textTransform: 'uppercase' }}>{r}</Text>
                                                        </View>
                                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Switch Role</Text>
                                                    </View>
                                                    {isSwitching ? (
                                                        <ActivityIndicator size={16} color="#f97316" />
                                                    ) : (
                                                        <Feather name="refresh-cw" size={16} color={r === 'admin' ? '#f97316' : colors.textMuted} />
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    );
                })()}

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
            </KeyboardAvoidingView>

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
