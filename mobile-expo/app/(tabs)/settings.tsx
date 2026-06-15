import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, Platform, KeyboardAvoidingView, RefreshControl, Switch, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';


import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchSecureLogo, updateOrganization } from '@/services/organizationService';
import { updateNotificationSettings, updateUserProfilePic, updateUserName } from '@/services/userService';
import { getMyMemberships, switchContext } from '@/services/authService';
import LogoPreviewModal from '@/components/shared/LogoPreviewModal';
import { Text, TextInput } from '@/components/ui/AppText';

// const roles: { value: UserRole; label: string }[] = [
//     { value: 'admin', label: 'Admin' },
//     { value: 'contributor', label: 'Contributor' },
//     { value: 'client', label: 'Client' },
//     { value: 'superadmin', label: 'Super Admin' },
// ];


const roleSwitcherDefs = [
    { id: 'admin', label: 'Admin', icon: 'shield' as const },
    { id: 'contributor', label: 'Contributor', icon: 'edit-3' as const },
    { id: 'client', label: 'Client', icon: 'user' as const },
];

export default function ProfileScreen() {
    const { t } = useTranslation();
    const { user, login, logout, updateUser, isScreenCaptureProtected, setScreenCaptureProtection } = useAuth();

    const router = useRouter();
    const { colors } = useTheme();

    const [memberships, setMemberships] = useState<any[]>([]);
    const [isSwitchingRole, setIsSwitchingRole] = useState<string | null>(null);

    const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [nameLoading, setNameLoading] = useState(false);
    const [notificationSettingsLoading, setNotificationSettingsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setEditNameValue(user.name || '');
        }
    }, [user?.name]);

    const [refreshing, setRefreshing] = useState(false);

    const loadMemberships = async () => {
        if (!user) return;
        try {
            const res = await getMyMemberships();
            if (res.memberships) setMemberships(res.memberships);
        } catch (err) {
            console.error("Load memberships error:", err);
        }
    };

    useEffect(() => {
        loadMemberships();
    }, [user?.id, user?.project_id, user?.role]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadMemberships();
        // Since other data is either static or updated differently, this is sufficient to test pulling logic
        setRefreshing(false);
    };
    // const handleSwitchContext = async ({ projectId, organizationId, role }: { projectId?: number | null; organizationId?: number | null; role: string }) => {
    //     if (isSwitching) return;
    //     setIsSwitching(true);
    //     try {
    //         const res = await switchContext({ project_id: projectId ?? null, organization_id: organizationId ?? null, role });
    //         if (res.token) {
    //             await login(res.token);
    //             Alert.alert(
    //                 'Success',
    //                 `Switched to ${role} role.`,
    //                 [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
    //             );
    //         }
    //     } catch (error) {
    //         Alert.alert('Error', 'Failed to switch project context.');
    //     } finally {
    //         setIsSwitching(false);
    //     }
    // };

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

    // const groupMembershipsByOrganization = (items: any[]) => {
    //     const organizationMap = new Map<number | string, any>();

    //     items.forEach((membership) => {
    //         const organizationId = membership.organization_id ?? membership.project?.organization_id ?? 'unknown';
    //         const organizationName = membership.organization?.name || membership.project?.organization?.name || 'Organization';
    //         const projectId = membership.project_id ?? `org-${organizationId}`;
    //
    //         if (!organizationMap.has(organizationId)) {
    //             organizationMap.set(organizationId, {
    //                 organizationId,
    //                 organizationName,
    //                 projects: new Map<number | string, any>(),
    //             });
    //         }
    //
    //         const organizationGroup = organizationMap.get(organizationId);
    //         if (!organizationGroup.projects.has(projectId)) {
    //             organizationGroup.projects.set(projectId, {
    //                 project: membership.project,
    //                 organization: membership.organization || membership.project?.organization || null,
    //                 organization_id: organizationId,
    //                 context_type: membership.context_type || (membership.project ? 'project' : 'organization'),
    //                 roles: [],
    //             });
    //         }
    //
    //         const projectGroup = organizationGroup.projects.get(projectId);
    //         if (!projectGroup.roles.includes(membership.role)) {
    //             projectGroup.roles.push(membership.role);
    //         }
    //     });
    //
    //     const roleOrder = ['admin', 'contributor', 'client', 'superadmin'];
    //
    //     return Array.from(organizationMap.values())
    //         .map((organizationGroup) => ({
    //             ...organizationGroup,
    //             projects: Array.from(organizationGroup.projects.values())
    //                 .map((projectGroup: any) => ({
    //                     ...projectGroup,
    //                     roles: projectGroup.roles.sort((a: string, b: string) => roleOrder.indexOf(a) - roleOrder.indexOf(b)),
    //                 }))
    //                 .sort((a: any, b: any) => (a.project?.name || a.organization?.name || '').localeCompare(b.project?.name || b.organization?.name || '')),
    //         }))
    //         .sort((a, b) => a.organizationName.localeCompare(b.organizationName));
    // };

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

    const handleSwitchRole = async (roleId: string) => {
        if (user.role === roleId || isSwitchingRole || !login) return;
        setIsSwitchingRole(roleId);
        try {
            const res = await switchContext({ role: roleId });
            if (res.token) {
                await login(res.token);
            }
        } catch (err: any) {
            Alert.alert('Role Switch Failed', err?.response?.data?.error || 'You do not have access to this role.');
        } finally {
            setIsSwitchingRole(null);
        }
    };
    const handleLogout = () => {
        Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmMessage'), [
            { text: t('settings.cancel'), style: 'cancel' },
            {
                text: t('settings.signOut'),
                style: 'destructive',
                onPress: () => {
                    logout();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    const handleToggleMuteNotifications = async (value: boolean) => {
        if (notificationSettingsLoading) return;
        setNotificationSettingsLoading(true);
        try {
            await updateNotificationSettings({ mute_general_notifications: value });
            updateUser({ mute_general_notifications: value });
        } catch (e) {
            Alert.alert('Error', 'Failed to update notification preference');
        } finally {
            setNotificationSettingsLoading(false);
        }
    };


    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
                <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                        {/* Role Switcher — same as Home */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {roleSwitcherDefs.map((role) => {
                                const isActive = user.role === role.id;
                                return (
                                    <TouchableOpacity
                                        key={role.id}
                                        onPress={() => handleSwitchRole(role.id)}
                                        disabled={!!isSwitchingRole}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6,
                                            backgroundColor: isActive ? colors.primary : colors.surface,
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: isActive ? colors.primary : colors.border,
                                            opacity: isSwitchingRole && !isActive ? 0.6 : 1
                                        }}
                                    >
                                        {isSwitchingRole === role.id ? (
                                            <ActivityIndicator size={12} color={isActive ? '#fff' : colors.primary} />
                                        ) : (
                                            <Feather name={role.icon} size={12} color={isActive ? '#fff' : colors.textMuted} />
                                        )}
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#fff' : colors.textMuted }}>
                                            {role.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
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
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.companySettings')}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.companySettingsSubtitle')}</Text>
                                </View>
                                <Feather name="chevron-right" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}


                        {(user.role === 'admin' || user.role === 'superadmin') && (
                            <>
                                <TouchableOpacity
                                    onPress={() => router.push('/usage')}
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
                                        <Feather name="activity" size={20} color={colors.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.resourceUsage')}</Text>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.resourceUsageSubtitle')}</Text>
                                    </View>
                                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                                </TouchableOpacity>


                                {/* <TouchableOpacity
                                    onPress={() => router.push('/subscription')}
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
                                        <Feather name="credit-card" size={20} color={colors.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.manageSubscription')}</Text>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.manageSubscriptionSubtitle')}</Text>
                                    </View>
                                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                                </TouchableOpacity> */}

                            </>
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
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.linkedDevices')}</Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.linkedDevicesSubtitle')}</Text>
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
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.changePassword')}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.changePasswordSubtitle')}</Text>
                                </View>
                                <Feather name="chevron-right" size={18} color={colors.textMuted} />
                            </TouchableOpacity>

                        )}

                        {(user.role === 'admin' || user.role === 'superadmin') && (
                            <TouchableOpacity
                                onPress={() => router.push('/trash')}
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
                                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name="trash-2" size={20} color="#ef4444" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.trashManagement')}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.trashManagementSubtitle')}</Text>
                                </View>
                                <Feather name="chevron-right" size={18} color={colors.textMuted} />
                            </TouchableOpacity>

                        )}
                    </View>

                    {user.role === 'admin' && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
                                {t('settings.notifications')}
                            </Text>

                            <View style={{ gap: 12 }}>
                                <View
                                    style={{
                                        borderRadius: 16,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        padding: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 14,
                                        opacity: notificationSettingsLoading ? 0.7 : 1
                                    }}
                                >
                                    <View style={{ backgroundColor: colors.background, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="bell-off" size={20} color={colors.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.muteNotifications')}</Text>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.muteNotificationsSubtitle')}</Text>
                                    </View>

                                    <Switch
                                        value={!!user.mute_general_notifications}
                                        onValueChange={handleToggleMuteNotifications}
                                        disabled={notificationSettingsLoading}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor={Platform.OS === 'ios' ? undefined : (user.mute_general_notifications ? '#fff' : '#f4f3f4')}
                                    />
                                </View>

                                <View
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
                                        <Feather name="user-check" size={20} color={colors.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Restrict Onboarding</Text>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Only admins can invite contributors/clients</Text>
                                    </View>

                                    <Switch
                                        value={!!user.organization?.restrict_onboarding}
                                        onValueChange={async (value) => {
                                            try {
                                                await updateOrganization({ restrict_onboarding: value });
                                                updateUser({
                                                    organization: {
                                                        ...user.organization,
                                                        restrict_onboarding: value
                                                    }
                                                });
                                                Alert.alert('Success', value ? 'Onboarding restricted to Admins' : 'Onboarding restriction removed');
                                            } catch (error) {
                                                Alert.alert('Error', 'Failed to update onboarding preference');
                                            }
                                        }}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor={Platform.OS === 'ios' ? undefined : (user.organization?.restrict_onboarding ? '#fff' : '#f4f3f4')}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Security Group */}
                    {(user.email && require('@/constants/security').MARKETING_EMAILS.some((e: string) => e.toLowerCase() === user.email?.toLowerCase())) && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>{t('settings.securityPrivacy')}</Text>

                            <View
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
                                    <Feather name="shield" size={20} color={colors.text} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.screenCaptureProtection')}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('settings.screenCaptureProtectionSubtitle')}</Text>
                                </View>

                                <Switch
                                    value={isScreenCaptureProtected}
                                    onValueChange={setScreenCaptureProtection}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor={Platform.OS === 'ios' ? undefined : (isScreenCaptureProtected ? '#fff' : '#f4f3f4')}
                                />
                            </View>
                        </View>
                    )}



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
                        <Text style={{ fontSize: 15, color: '#ef4444', fontWeight: '700' }}>{t('settings.signOut')}</Text>
                    </TouchableOpacity>


                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => Linking.openURL('https://rhinonlabs.com')}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 20,
                            marginBottom: 10,
                            opacity: 0.6
                        }}
                    >
                        <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 }}>Developed by </Text>
                        <Image
                            source={require('@/assets/images/rhinon_tech.png')}
                            style={{
                                width: 69,
                                height: 25,
                                resizeMode: 'contain',
                                marginLeft: 2
                            }}
                        />
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
                isCircular={true}
                title="Profile Picture"
                subtitle="This photo is visible to your team members and clients."
                buttonText="Change Photo"
            />

        </SafeAreaView>
    );
}
