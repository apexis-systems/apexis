import React, { useState, useEffect, useCallback } from 'react';
import {
    View, TouchableOpacity, ScrollView, FlatList,
    Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
    StyleSheet, useColorScheme, Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    getProjectsUsers, inviteUser, deleteUser,
    getBlockedUsers, unblockUser
} from '@/services/userService';
import { getProjects } from '@/services/projectService';
import { Text, TextInput } from '@/components/ui/AppText';
import { parseApiError } from '@/helpers/apiError';

type TabType = 'active' | 'blocked';
type UserRole = 'admin' | 'contributor' | 'client';

export default function UserManagementScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { colors } = useTheme();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { user } = useAuth();

    // Data lists
    const [users, setUsers] = useState<any[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [loadingBlocked, setLoadingBlocked] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [unblockingId, setUnblockingId] = useState<number | null>(null);

    // Screen states
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);

    // Invitation form inputs
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('contributor');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [showRoleSelector, setShowRoleSelector] = useState(false);
    const [showProjSelector, setShowProjSelector] = useState(false);

    // Delete Modal state
    const [deleteUserObj, setDeleteUserObj] = useState<any>(null);
    const [deleteStep, setDeleteStep] = useState<'confirm' | 'blockScope'>('confirm');

    // Filters
    const [filterProject, setFilterProject] = useState<string>('all');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [showFilterProjPicker, setShowFilterProjPicker] = useState(false);
    const [showFilterRolePicker, setShowFilterRolePicker] = useState(false);

    const isProjectRole = inviteRole === 'contributor' || inviteRole === 'client';

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProjectsUsers();
            // Sort primary admin first, then by role importance, then alphabet
            const sorted = (data || []).sort((a: any, b: any) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;
                const priority: Record<string, number> = { admin: 1, contributor: 2, client: 3 };
                const pA = priority[a.role] || 4;
                const pB = priority[b.role] || 4;
                if (pA !== pB) return pA - pB;
                return (a.name || '').localeCompare(b.name || '');
            });
            setUsers(sorted);
        } catch (error) {
            console.error("fetchUsers mobile error", error);
            Alert.alert(t('common.error'), t('load_users_error') || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [t]);

    const fetchBlockedUsers = useCallback(async () => {
        setLoadingBlocked(true);
        try {
            const data = await getBlockedUsers();
            setBlockedUsers(data || []);
        } catch (error) {
            console.error("fetchBlockedUsers mobile error", error);
        } finally {
            setLoadingBlocked(false);
        }
    }, []);

    const fetchProjectsList = useCallback(async () => {
        try {
            const data = await getProjects();
            setProjects(data.projects || []);
        } catch (error) {
            console.error("fetchProjects mobile error", error);
        }
    }, []);

    useEffect(() => {
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return;
        }
        fetchUsers();
        fetchProjectsList();
    }, [user, fetchUsers, fetchProjectsList]);

    useEffect(() => {
        if (activeTab === 'blocked') {
            fetchBlockedUsers();
        }
    }, [activeTab, fetchBlockedUsers]);

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textMuted }}>{t('no_permission')}</Text>
            </SafeAreaView>
        );
    }

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            Alert.alert(t('common.error'), t('invalid_email') || 'Please enter a valid email');
            return;
        }

        if (isProjectRole && !selectedProjectId) {
            Alert.alert(t('common.error'), t('select_project_role') || 'Please select a project for this role');
            return;
        }

        setInviting(true);
        try {
            await inviteUser({
                email: inviteEmail.trim(),
                role: inviteRole,
                project_id: isProjectRole ? selectedProjectId : undefined
            });

            Alert.alert(t('common.success'), t('invite_success') || 'Invitation sent successfully');
            setInviteEmail('');
            setInviteRole('contributor');
            setSelectedProjectId('');
            setShowInviteModal(false);
            fetchUsers();
        } catch (error) {
            console.error("Invite mobile error", error);
            const { message: errMsg } = parseApiError(error, t('invite_error') || 'Failed to send invitation');
            Alert.alert(t('common.error'), errMsg);
        } finally {
            setInviting(false);
        }
    };

    const handleDeleteUser = async (block: boolean, blockScope?: 'project' | 'org') => {
        if (!deleteUserObj) return;
        setDeleting(true);
        try {
            // Resolve project ID context if project blocking requested
            let targetProjectId = undefined;
            if (block && blockScope === 'project') {
                if (filterProject !== 'all') {
                    targetProjectId = filterProject;
                } else if (deleteUserObj.project_members?.length > 0) {
                    targetProjectId = deleteUserObj.project_members[0].project_id;
                }
            }

            await deleteUser(deleteUserObj.id, block, blockScope, targetProjectId);
            Alert.alert(t('common.success'), t('remove_access_success') || 'Access removed successfully');
            setDeleteUserObj(null);
            setDeleteStep('confirm');
            fetchUsers();
            if (activeTab === 'blocked') {
                fetchBlockedUsers();
            }
        } catch (error) {
            console.error("Delete user error", error);
            const { message: errMsg } = parseApiError(error, t('remove_access_error') || 'Failed to remove project access');
            Alert.alert(t('common.error'), errMsg);
        } finally {
            setDeleting(false);
        }
    };

    const handleUnblockUser = async (id: number) => {
        setUnblockingId(id);
        try {
            await unblockUser(id);
            Alert.alert(t('common.success'), t('unblock_success') || 'User unblocked successfully');
            fetchBlockedUsers();
            fetchUsers();
        } catch (error) {
            console.error("Unblock user error", error);
            const { message: errMsg } = parseApiError(error, t('unblock_error') || 'Failed to unblock user');
            Alert.alert(t('common.error'), errMsg);
        } finally {
            setUnblockingId(null);
        }
    };

    const copyToClipboard = async (code: string, type: string) => {
        const origin = 'https://apexispro.com'; // Fallback web domain
        const deepUrl = `${origin}/auth/login-redirect?role=${type.toLowerCase()}&code=${code}`;
        await Clipboard.setStringAsync(deepUrl);
        setCopiedLinkType(type);
        setTimeout(() => setCopiedLinkType(null), 2000);
    };

    // Filter rules
    const filteredUsers = users.filter(u => {
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        let matchesProject = true;
        if (filterProject !== 'all') {
            const isGlobalAdmin = u.role === 'admin' || u.role === 'superadmin';
            if (!isGlobalAdmin) {
                matchesProject = u.project_members?.some((pm: any) => String(pm.project_id) === String(filterProject));
            }
        }
        return matchesRole && matchesProject;
    });

    const activeProjectFilterObj = projects.find(p => String(p.id) === filterProject);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('user_mgmt') || 'User Management'}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{t('user_mgmt_subtitle') || 'Manage organization members and roles'}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowInviteModal(true)}
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                >
                    <Feather name="user-plus" size={16} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Tab switch */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => setActiveTab('active')}
                    style={[styles.tabItem, activeTab === 'active' && { borderBottomColor: colors.primary }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'active' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'active' ? '700' : '500' }]}>
                        Active Members
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('blocked')}
                    style={[styles.tabItem, activeTab === 'blocked' && { borderBottomColor: colors.primary }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'blocked' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'blocked' ? '700' : '500' }]}>
                        Blocked Users
                    </Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'active' ? (
                <View style={{ flex: 1 }}>
                    {/* Filters Section */}
                    <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowFilterProjPicker(true)}
                                style={[styles.filterSelector, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                                    {filterProject === 'all' ? 'All Projects' : projects.find(p => String(p.id) === filterProject)?.name || 'Project'}
                                </Text>
                                <Feather name="chevron-down" size={14} color={colors.textMuted} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowFilterRolePicker(true)}
                                style={[styles.filterSelector, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                                    {filterRole === 'all' ? 'All Roles' : filterRole.toUpperCase()}
                                </Text>
                                <Feather name="chevron-down" size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Reset Filter Button */}
                        {(filterProject !== 'all' || filterRole !== 'all') && (
                            <TouchableOpacity
                                onPress={() => { setFilterProject('all'); setFilterRole('all'); }}
                                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                            >
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Reset Filters</Text>
                            </TouchableOpacity>
                        )}

                        {/* Copy Deep Link Section */}
                        {filterProject !== 'all' && activeProjectFilterObj && (
                            <View style={[styles.deepLinkBox, { borderTopColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                                <Text style={[styles.deepLinkLabel, { color: colors.text }]}>Project Access Links</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(activeProjectFilterObj.contributor_code, 'Contributor')}
                                        style={[styles.copyButton, { borderColor: colors.primary + '33', backgroundColor: colors.primary + '08' }]}
                                    >
                                        <Feather name={copiedLinkType === 'Contributor' ? 'check' : 'copy'} size={12} color={colors.primary} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                                            {copiedLinkType === 'Contributor' ? 'Copied' : 'Copy Contributor'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(activeProjectFilterObj.client_code, 'Client')}
                                        style={[styles.copyButton, { borderColor: colors.primary + '33', backgroundColor: colors.primary + '08' }]}
                                    >
                                        <Feather name={copiedLinkType === 'Client' ? 'check' : 'copy'} size={12} color={colors.primary} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                                            {copiedLinkType === 'Client' ? 'Copied' : 'Copy Client'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={u => String(u.id)}
                            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.userName, { color: colors.text }]}>{item.name || 'Invited User'}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.email || item.phone_number || 'No contact details'}</Text>

                                        {/* Project and roles listing */}
                                        <View style={{ marginTop: 8, gap: 4 }}>
                                            {item.role === 'admin' || item.role === 'superadmin' ? (
                                                <View style={styles.roleRow}>
                                                    <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
                                                        <Text style={{ fontSize: 9, fontWeight: '900', color: colors.primary, textTransform: 'uppercase' }}>{item.role}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>All Projects</Text>
                                                </View>
                                            ) : (
                                                item.project_members && item.project_members.length > 0 ? (
                                                    item.project_members.map((pm: any, idx: number) => (
                                                        <View key={idx} style={styles.roleRow}>
                                                            <View style={[styles.roleBadge, { backgroundColor: colors.primary + '10' }]}>
                                                                <Text style={{ fontSize: 9, fontWeight: '900', color: colors.primary, textTransform: 'uppercase' }}>{pm.role}</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={1}>
                                                                {pm.project?.name || 'Project'}
                                                            </Text>
                                                        </View>
                                                    ))
                                                ) : (
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>No projects assigned</Text>
                                                )
                                            )}
                                        </View>
                                    </View>

                                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 8 }}>
                                        {/* Verified state */}
                                        <View style={[styles.statusPill, { backgroundColor: (item.email_verified || item.phone_verified) ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                                            <View style={[styles.statusDot, { backgroundColor: (item.email_verified || item.phone_verified) ? '#22c55e' : '#f59e0b' }]} />
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: (item.email_verified || item.phone_verified) ? '#22c55e' : '#f59e0b' }}>
                                                {(item.email_verified || item.phone_verified) ? 'Verified' : 'Pending'}
                                            </Text>
                                        </View>

                                        {/* Action buttons */}
                                        {!item.is_primary && item.id !== user.id && (item.base_role || item.role) !== 'admin' && (item.base_role || item.role) !== 'superadmin' && (
                                            <TouchableOpacity
                                                onPress={() => { setDeleteUserObj(item); setDeleteStep('confirm'); }}
                                                style={styles.deleteButton}
                                            >
                                                <Feather name="trash-2" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>
                                    No members found matching filters.
                                </Text>
                            }
                        />
                    )}
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {loadingBlocked ? (
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={blockedUsers}
                            keyExtractor={u => String(u.id)}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({ item }) => (
                                <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.userName, { color: colors.text }]}>{item.email || item.phone_number || 'Blocked User'}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                                            Blocked on {new Date(item.createdAt).toLocaleDateString()}
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                            <View style={{
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                borderColor: 'rgba(239, 68, 68, 0.2)',
                                                borderWidth: 1,
                                                borderRadius: 12,
                                                paddingHorizontal: 8,
                                                paddingVertical: 2
                                            }}>
                                                <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Blocked</Text>
                                            </View>
                                            {item.project_id ? (
                                                <View style={{
                                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                                    borderColor: 'rgba(245, 158, 11, 0.2)',
                                                    borderWidth: 1,
                                                    borderRadius: 12,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2
                                                }}>
                                                    <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>
                                                        Project: {item.project?.name || 'Project'}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={{
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                    borderColor: 'rgba(239, 68, 68, 0.2)',
                                                    borderWidth: 1,
                                                    borderRadius: 12,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2
                                                }}>
                                                    <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Full Org</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleUnblockUser(item.id)}
                                        disabled={unblockingId === item.id}
                                        style={[styles.unblockBtn, { borderColor: colors.primary }]}
                                    >
                                        {unblockingId === item.id ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Unblock</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>
                                    No blocked users found.
                                </Text>
                            }
                        />
                    )}
                </View>
            )}

            {/* Invitation Modal */}
            {showInviteModal && (
                <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setShowInviteModal(false)}
                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                        >
                            <TouchableOpacity
                                activeOpacity={1}
                                style={[styles.inviteSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}
                            >
                                <View style={styles.sheetHeader}>
                                    <Text style={[styles.sheetTitle, { color: colors.text }]}>Add New Member</Text>
                                    <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                                        <Feather name="x" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                                {/* Form */}
                                <View style={{ gap: 16, marginTop: 12 }}>
                                    <View>
                                        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email Address *</Text>
                                        <TextInput
                                            value={inviteEmail}
                                            onChangeText={setInviteEmail}
                                            placeholder="member@example.com"
                                            placeholderTextColor={colors.textMuted}
                                            style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    </View>

                                    {/* Role Selector Trigger */}
                                    <View>
                                        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Role *</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowRoleSelector(true)}
                                            style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                        >
                                            <Text style={{ color: colors.text, textTransform: 'capitalize' }}>{inviteRole}</Text>
                                            <Feather name="chevron-down" size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Project Selector Trigger */}
                                    {isProjectRole && (
                                        <View>
                                            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Assign Project *</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowProjSelector(true)}
                                                style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                            >
                                                <Text style={{ color: selectedProjectId ? colors.text : colors.textMuted }}>
                                                    {selectedProjectId ? projects.find(p => String(p.id) === selectedProjectId)?.name : 'Select Project'}
                                                </Text>
                                                <Feather name="chevron-down" size={16} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* Action Button */}
                                    <TouchableOpacity
                                        onPress={handleInvite}
                                        disabled={inviting}
                                        style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 12 }]}
                                    >
                                        {inviting ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Feather name="mail" size={16} color="#fff" />
                                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Invitation</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </Modal>
            )}

            {/* Custom Option Selector Modal (for Role and Projects) */}
            <Modal visible={showRoleSelector || showProjSelector} transparent animationType="fade" onRequestClose={() => { setShowRoleSelector(false); setShowProjSelector(false); }}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => { setShowRoleSelector(false); setShowProjSelector(false); }}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}
                >
                    <View style={[styles.pickerDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                {showRoleSelector ? 'Select Role' : 'Select Project'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowRoleSelector(false); setShowProjSelector(false); }}>
                                <Feather name="x" size={18} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 250, marginTop: 10 }}>
                            {showRoleSelector ? (
                                ['admin', 'contributor', 'client'].map((r) => (
                                    <TouchableOpacity
                                        key={r}
                                        onPress={() => { setInviteRole(r as UserRole); setShowRoleSelector(false); }}
                                        style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                    >
                                        <Text style={{ color: colors.text, textTransform: 'capitalize', fontWeight: inviteRole === r ? '700' : '400' }}>{r}</Text>
                                        {inviteRole === r && <Feather name="check" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                projects.map((p) => (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => { setSelectedProjectId(String(p.id)); setShowProjSelector(false); }}
                                        style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: selectedProjectId === String(p.id) ? '700' : '400' }}>{p.name}</Text>
                                        {selectedProjectId === String(p.id) && <Feather name="check" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Custom Filter Selectors */}
            <Modal visible={showFilterProjPicker || showFilterRolePicker} transparent animationType="fade" onRequestClose={() => { setShowFilterProjPicker(false); setShowFilterRolePicker(false); }}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => { setShowFilterProjPicker(false); setShowFilterRolePicker(false); }}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}
                >
                    <View style={[styles.pickerDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                {showFilterProjPicker ? 'Filter By Project' : 'Filter By Role'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowFilterProjPicker(false); setShowFilterRolePicker(false); }}>
                                <Feather name="x" size={18} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 250, marginTop: 10 }}>
                            {showFilterProjPicker ? (
                                <>
                                    <TouchableOpacity
                                        onPress={() => { setFilterProject('all'); setShowFilterProjPicker(false); }}
                                        style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: filterProject === 'all' ? '700' : '400' }}>All Projects</Text>
                                        {filterProject === 'all' && <Feather name="check" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                    {projects.map((p) => (
                                        <TouchableOpacity
                                            key={p.id}
                                            onPress={() => { setFilterProject(String(p.id)); setShowFilterProjPicker(false); }}
                                            style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: filterProject === String(p.id) ? '700' : '400' }}>{p.name}</Text>
                                            {filterProject === String(p.id) && <Feather name="check" size={16} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        onPress={() => { setFilterRole('all'); setShowFilterRolePicker(false); }}
                                        style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: filterRole === 'all' ? '700' : '400' }}>All Roles</Text>
                                        {filterRole === 'all' && <Feather name="check" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                    {['admin', 'contributor', 'client'].map((r) => (
                                        <TouchableOpacity
                                            key={r}
                                            onPress={() => { setFilterRole(r); setShowFilterRolePicker(false); }}
                                            style={[styles.pickerItem, { borderBottomColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                                        >
                                            <Text style={{ color: colors.text, textTransform: 'capitalize', fontWeight: filterRole === r ? '700' : '400' }}>{r}</Text>
                                            {filterRole === r && <Feather name="check" size={16} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Delete Confirmation Modal */}
            {deleteUserObj && (
                <Modal visible={!!deleteUserObj} transparent animationType="fade" onRequestClose={() => setDeleteUserObj(null)}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setDeleteUserObj(null)}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            {deleteStep === 'confirm' ? (
                                <>
                                    <Text style={[styles.dialogTitle, { color: colors.text }]}>Remove Project Access</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
                                        Are you sure you want to remove all access permissions for this user ({deleteUserObj.name || deleteUserObj.email})?
                                    </Text>

                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                                        <TouchableOpacity
                                            onPress={() => setDeleteUserObj(null)}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { backgroundColor: 'transparent' }]}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleDeleteUser(false)}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { borderColor: '#ef4444', borderWidth: 1 }]}
                                        >
                                            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Just Delete</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setDeleteStep('blockScope')}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { backgroundColor: '#ef4444' }]}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Block & Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.dialogTitle, { color: colors.text }]}>Block Scope Selection</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
                                        Do you want to block this user from this project only, or from the whole organization?
                                    </Text>

                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                                        <TouchableOpacity
                                            onPress={() => setDeleteStep('confirm')}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { backgroundColor: 'transparent' }]}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Back</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleDeleteUser(true, 'project')}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { borderColor: '#ef4444', borderWidth: 1 }]}
                                        >
                                            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>This Project Only</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => handleDeleteUser(true, 'org')}
                                            disabled={deleting}
                                            style={[styles.dialogBtn, { backgroundColor: '#ef4444' }]}
                                        >
                                            {deleting ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Whole Org</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        gap: 12
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800'
    },
    headerSubtitle: {
        fontSize: 11,
        marginTop: 2
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        borderBottomWidth: 1
    },
    tabItem: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent'
    },
    tabText: {
        fontSize: 14
    },
    filterCard: {
        margin: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    filterSelector: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    deepLinkBox: {
        marginTop: 14,
        borderTopWidth: 1,
        paddingTop: 14
    },
    deepLinkLabel: {
        fontSize: 12,
        fontWeight: '700'
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1
    },
    userCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        justifyContent: 'space-between'
    },
    userName: {
        fontSize: 14,
        fontWeight: '700'
    },
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    deleteButton: {
        padding: 6,
        borderRadius: 8
    },
    unblockBtn: {
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'center'
    },
    inviteSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 40,
        borderTopWidth: 1,
        width: '100%',
        maxHeight: Dimensions.get('window').height * 0.8
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '800'
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6
    },
    textInput: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 14
    },
    selectorButton: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    submitButton: {
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    pickerDialog: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        width: '100%',
        maxHeight: 320
    },
    pickerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1
    },
    dialogCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 20
    },
    dialogTitle: {
        fontSize: 16,
        fontWeight: '800'
    },
    dialogBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
