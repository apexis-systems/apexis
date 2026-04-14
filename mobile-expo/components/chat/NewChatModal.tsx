import React, { useState, useEffect } from 'react';
import {
    Modal, View, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, StatusBar, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getOrgUsers } from '@/services/userService';
import { createRoom } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import SecureAvatar from '@/components/shared/SecureAvatar';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: (room: any) => void;
}

export default function NewChatModal({ visible, onClose, onSuccess }: Props) {
    const { user: authUser } = (useAuth() as any) || {};
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [type, setType] = useState<'direct' | 'group'>('direct');
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submittingUserId, setSubmittingUserId] = useState<number | null>(null);

    useEffect(() => {
        if (visible) {
            const fetchUsers = async () => {
                setLoading(true);
                try {
                    const data = await getOrgUsers();
                    setUsers(data.filter((u: any) => u.id !== authUser?.id && u.role !== 'superadmin'));
                } catch (err) {
                    console.error("Failed to fetch users", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchUsers();
        } else {
            setSearchQuery('');
            setSelectedUsers([]);
            setGroupName('');
            setType('direct');
        }
    }, [visible, authUser?.id]);

    const filteredUsers = users.filter(u =>
        (u.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDirectSelect = async (userId: number) => {
        if (submitting) return;  // prevent double-tap
        setSubmitting(true);
        setSubmittingUserId(userId);
        try {
            const room = await createRoom({
                type: 'direct',
                memberIds: [userId]
            });
            // On iOS, router.push() is swallowed if the Modal is still animating.
            // We must close the modal first, then defer the navigation.
            onClose();
            setTimeout(() => {
                onSuccess(room);
            }, Platform.OS === 'ios' ? 350 : 50);
        } catch (err: any) {
            console.error("Failed to create direct chat", err);
            const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to start chat';
            Alert.alert('Unable to Start Chat', errorMsg);
        } finally {
            setSubmitting(false);
            setSubmittingUserId(null);
        }
    };

    const toggleUser = (userId: number) => {
        if (type === 'direct') {
            handleDirectSelect(userId);
        } else {
            setSelectedUsers(prev =>
                prev.includes(userId)
                    ? prev.filter(id => id !== userId)
                    : [...prev, userId]
            );
        }
    };

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;
        if (type === 'group' && !groupName.trim()) {
            alert('Please enter a group name');
            return;
        }

        setSubmitting(true);
        try {
            const room = await createRoom({
                type,
                name: type === 'group' ? groupName : undefined,
                memberIds: selectedUsers
            });
            // Same iOS modal-close-before-navigate pattern as direct chat
            onClose();
            setTimeout(() => {
                onSuccess(room);
            }, Platform.OS === 'ios' ? 350 : 50);
        } catch (err: any) {
            console.error("Failed to create chat", err);
            const errorMsg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to create chat';
            Alert.alert('Unable to Create Chat', errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const renderUser = ({ item }: { item: any }) => {
        const isSelected = selectedUsers.includes(item.id);
        const isLoadingThisRow = submittingUserId === item.id;
        return (
            <TouchableOpacity
                onPress={() => toggleUser(item.id)}
                disabled={submitting}
                style={[styles.userItem, { borderBottomColor: colors.border, opacity: submitting && !isLoadingThisRow ? 0.5 : 1 }]}
            >
                <SecureAvatar
                    fileKey={item.profile_pic}
                    name={item.name || '?'}
                    size={44}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
                        {item.role && item.role !== 'superadmin' && (
                            <View style={{ backgroundColor: colors.primary + '22', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '700', textTransform: 'capitalize' }}>{item.role}</Text>
                            </View>
                        )}
                        {item.organization?.name && (
                            <View style={{ backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700' }}>{item.organization.name}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.userEmail, { color: colors.textMuted }]}>{item.email}</Text>
                </View>
                {isLoadingThisRow ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : isSelected ? (
                    <View style={[styles.checkbox, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={12} color="#fff" />
                    </View>
                ) : null}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: colors.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={{ 
                        backgroundColor: colors.surface, 
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                        paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
                    }}>
                        <View style={[styles.header, { borderBottomWidth: 0 }]}>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>{type === 'group' ? 'New Group' : 'New Direct Chat'}</Text>
                            
                            {type === 'group' ? (
                                <TouchableOpacity
                                    onPress={handleCreate}
                                    disabled={submitting || selectedUsers.length === 0}
                                    style={{
                                        opacity: (submitting || selectedUsers.length === 0) ? 0.4 : 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    {submitting && <ActivityIndicator size="small" color={colors.primary} />}
                                    <Text style={[styles.createButtonText, { color: colors.primary }]}>Create</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: 40 }} />
                            )}
                        </View>
                    </View>

                {/* Type Selector */}
                <View style={[styles.typeSelector, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={() => { setType('direct'); setSelectedUsers([]); }}
                        style={[styles.typeTab, type === 'direct' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                    >
                        <Text style={[styles.typeTabText, { color: type === 'direct' ? colors.primary : colors.textMuted }]}>Direct</Text>
                    </TouchableOpacity>
                    {(authUser?.role === 'admin' || authUser?.role === 'contributor') && (
                        <TouchableOpacity
                            onPress={() => { setType('group'); setSelectedUsers([]); }}
                            style={[styles.typeTab, type === 'group' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        >
                            <Text style={[styles.typeTabText, { color: type === 'group' ? colors.primary : colors.textMuted }]}>Group</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Group Name Input */}
                {type === 'group' && (
                    <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
                        <TextInput
                            placeholder="Group Name"
                            placeholderTextColor={colors.textMuted}
                            value={groupName}
                            onChangeText={setGroupName}
                            style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
                        />
                    </View>
                )}

                {/* Search Input */}
                <View style={{ padding: 16, backgroundColor: colors.background }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 48,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 2,
                    }}>
                        <Feather name="search" size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
                        <TextInput
                            placeholder="Search people..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{ flex: 1, color: colors.text, fontSize: 16, height: '100%' }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Feather name="x-circle" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* User List */}
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredUsers}
                        keyExtractor={item => String(item.id)}
                        renderItem={renderUser}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Text style={{ color: colors.textMuted }}>No users found</Text>
                            </View>
                        }
                    />
                )}
                </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    typeSelector: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    typeTab: {
        flex: 1,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeTabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    inputContainer: {
        padding: 12,
        borderBottomWidth: 1,
    },
    input: {
        height: 44,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderBottomWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
    },
    userEmail: {
        fontSize: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    }
});
