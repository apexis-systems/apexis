import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl, BackHandler, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { useRouter, useFocusEffect } from 'expo-router';
import { navigateFromNotification } from '@/utils/navigation';
import { getProjects } from '@/services/projectService';
import { getOrgUsers } from '@/services/userService';

interface Notification {
    id: number;
    title: string;
    body: string;
    type: string;
    data: any;
    is_read: boolean;
    createdAt: string;
    organizationName?: string;
    sender_id?: number;
    userId?: number;
    user_id?: number;
}

export default function NotificationsScreen() {
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const { socket, setUnreadNotificationCount } = useSocket();
    const { isTourActive } = require('@/contexts/TourContext').useTour();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Multi-select: empty array = "all"
    const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('all');
    const [showHistory, setShowHistory] = useState(false);

    // Modal state
    const [activeModal, setActiveModal] = useState<'project' | 'user' | null>(null);

    const filterTypes = [
        { label: 'All', value: 'all' },
        { label: 'Chat', value: 'chat' },
        { label: 'Files', value: 'file' },
        { label: 'Photos', value: 'photo' },
        { label: 'Snags', value: 'snag' },
        { label: 'RFI', value: 'rfi' },
        { label: 'Members', value: 'member' },
    ];

    const matchesTypeFilter = (notif: Notification, type: string) => {
        if (type === 'all') return true;
        const categories: Record<string, string[]> = {
            chat: ['chat', 'group_creation'],
            file: ['file_upload', 'file_upload_admin', 'file_visibility', 'folder_visibility'],
            photo: ['photo_upload', 'photo_comment'],
            snag: ['snag_assigned', 'snag_creation_admin', 'snag_status_update'],
            rfi: ['rfi_created', 'rfi_assigned', 'rfi_status_update', 'rfi_comment'],
            member: ['member_joined'],
        };
        return (categories[type] || [type]).includes(notif.type);
    };

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (showHistory) {
                    setShowHistory(false);
                    return true;
                }
                router.back();
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [router, showHistory])
    );

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [projectsData, usersData] = await Promise.all([
                    getProjects(undefined),
                    getOrgUsers(),
                ]);
                setProjects(projectsData.projects || []);
                setUsersList(usersData || []);
            } catch (error) {
                console.error('Failed to fetch filters:', error);
            }
        };
        fetchFilters();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const params: string[] = [];
            if (showHistory) params.push('hours=48');
            if (selectedProjectIds.length === 1) params.push(`project_id=${selectedProjectIds[0]}`);
            else if (selectedProjectIds.length > 1) params.push(`project_ids=${selectedProjectIds.join(',')}`);
            if (selectedType !== 'all') params.push(`type=${selectedType}`);

            const url = params.length > 0 ? `/notifications?${params.join('&')}` : '/notifications';
            const res = await PrivateAxios.get(url);
            const data = res.data.notifications || [];

            let unread = showHistory ? data : data.filter((n: any) => !n.is_read);
            unread = unread.filter((n: any) => matchesTypeFilter(n, selectedType));

            // Filter by user if multi-select is active
            if (selectedUserIds.length > 0) {
                unread = unread.filter((n: any) =>
                    selectedUserIds.includes(String(n.sender_id ?? n.userId ?? n.user_id ?? ''))
                );
            }

            setNotifications(unread);

            if (!showHistory && selectedProjectIds.length === 0 && selectedType === 'all' && selectedUserIds.length === 0) {
                setUnreadNotificationCount(data.filter((n: any) => !n.is_read).length);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAllRead = async () => {
        try {
            await PrivateAxios.patch('/notifications/read-all');
            setUnreadNotificationCount(0);
            setNotifications([]);
        } catch (error) {
            console.error('Failed to mark all read:', error);
        }
    };

    const bellRef = useRef<View>(null);
    const { registerSpotlight } = require('@/contexts/TourContext').useTour();

    useEffect(() => {
        if (isTourActive) {
            setTimeout(() => {
                bellRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
                    registerSpotlight('notificationsIcon', { x: x + w / 2, y: y + h / 2, r: 35 });
                });
            }, 1000);
        }
    }, [isTourActive, registerSpotlight]);

    useEffect(() => {
        fetchNotifications();
    }, [selectedProjectIds, selectedUserIds, selectedType, showHistory]);

    useEffect(() => {
        if (socket) {
            const handleNewNotif = (notif: Notification) => {
                const matchesProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(notif.data?.projectId);
                const matchesType = matchesTypeFilter(notif, selectedType);
                const matchesUser = selectedUserIds.length === 0 ||
                    selectedUserIds.includes(String(notif.sender_id ?? notif.userId ?? notif.user_id ?? ''));

                if (matchesProject && matchesType && matchesUser) {
                    setNotifications(prev => showHistory ? [notif, ...prev] : [notif, ...prev].filter(n => !n.is_read));
                }
            };
            socket.on('new-notification', handleNewNotif);
            return () => { socket.off('new-notification', handleNewNotif); };
        }
    }, [socket, selectedProjectIds, selectedUserIds, selectedType, showHistory]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const markRead = async (id: number) => {
        try {
            await PrivateAxios.patch(`/notifications/${id}/read`);
            setNotifications(prev => showHistory
                ? prev.map(n => n.id === id ? { ...n, is_read: true } : n)
                : prev.filter(n => n.id !== id)
            );
            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    const DUMMY_NOTIFICATIONS = [
        { id: 1, title: 'Project Status Updated', body: 'The foundation work for Site A has been approved.', type: 'snag_status_update', is_read: false, createdAt: new Date().toISOString(), data: {} },
        { id: 2, title: 'New Document Uploaded', body: 'Sarah uploaded "Borehole Test Results".', type: 'file_upload', is_read: false, createdAt: new Date().toISOString(), data: {} },
    ];

    const displayNotifications = isTourActive ? DUMMY_NOTIFICATIONS : notifications;
    const historyButton = (
        <TouchableOpacity
            onPress={() => setShowHistory(prev => !prev)}
            style={{
                alignSelf: 'center',
                marginTop: 16,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
            }}
        >
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                {showHistory ? 'Back to unread' : 'History'}
            </Text>
        </TouchableOpacity>
    );

    const toggleProject = (id: number) => {
        setSelectedProjectIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };
    const toggleUser = (id: string) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };

    const projectLabel = selectedProjectIds.length === 0
        ? 'All Projects'
        : selectedProjectIds.length === 1
            ? (projects.find(p => p.id === selectedProjectIds[0])?.name || '...')
            : `${selectedProjectIds.length} selected`;

    const userLabel = selectedUserIds.length === 0
        ? 'All Users'
        : selectedUserIds.length === 1
            ? (usersList.find(u => String(u.id) === selectedUserIds[0])?.name || '...')
            : `${selectedUserIds.length} selected`;

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[
                styles.notificationItem,
                {
                    backgroundColor: item.is_read ? colors.surface : 'rgba(249,115,22,0.05)',
                    borderColor: item.is_read ? colors.border : 'rgba(249,115,22,0.2)',
                }
            ]}
            onPress={() => {
                markRead(item.id);
                navigateFromNotification(String(item.id), item.type, item.data, router);
            }}
        >
            <View style={[styles.iconContainer, {
                backgroundColor: item.is_read ? colors.background : 'rgba(249,115,22,0.1)',
            }]}>
                <Ionicons
                    name={getIconName(item.type)}
                    size={20}
                    color={item.is_read ? colors.textMuted : colors.primary}
                />
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                    {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.body, { color: colors.textMuted }]}>{item.body}</Text>
                <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                    <Text style={styles.timeText}>
                        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {item.organizationName ? ` • ${item.organizationName}` : ''}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const getIconName = (type: string): any => {
        switch (type) {
            case 'chat': return 'chatbubble-ellipses';
            case 'group_creation': return 'people';
            case 'file_upload':
            case 'file_visibility':
            case 'folder_visibility':
            case 'file_upload_admin': return 'document-text';
            case 'photo_upload':
            case 'photo_comment': return 'camera';
            case 'snag_assigned':
            case 'snag_creation_admin': return 'warning';
            case 'snag_status_update': return 'checkmark-circle';
            case 'rfi_created':
            case 'rfi_assigned':
            case 'rfi_status_update':
            case 'rfi_comment': return 'help-circle';
            case 'member_joined': return 'person-add';
            default: return 'notifications';
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                    {isTourActive && (
                        <View ref={bellRef} style={{ padding: 6, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                            <Ionicons name="notifications" size={20} color={colors.primary} />
                        </View>
                    )}
                </View>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Type Filter Chips */}
            <View style={{ paddingTop: 10 }}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={filterTypes}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8 }}
                    keyExtractor={item => item.value}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setSelectedType(item.value)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: selectedType === item.value ? colors.primary : colors.surface,
                                    borderColor: colors.border,
                                }
                            ]}
                        >
                            <Text style={[styles.chipText, { color: selectedType === item.value ? '#fff' : colors.textMuted }]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                />

                {/* Project + User dropdown filter buttons */}
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}>
                    {/* Project filter */}
                    <TouchableOpacity
                        onPress={() => setActiveModal('project')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: selectedProjectIds.length > 0 ? colors.primary : colors.border,
                            backgroundColor: selectedProjectIds.length > 0 ? colors.primary + '12' : colors.surface,
                        }}
                    >
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: selectedProjectIds.length > 0 ? colors.primary : colors.textMuted, flex: 1 }}>
                            {projectLabel}
                        </Text>
                        <Feather name="chevron-down" size={11} color={selectedProjectIds.length > 0 ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>

                    {/* User filter */}
                    <TouchableOpacity
                        onPress={() => setActiveModal('user')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: selectedUserIds.length > 0 ? colors.primary : colors.border,
                            backgroundColor: selectedUserIds.length > 0 ? colors.primary + '12' : colors.surface,
                        }}
                    >
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: selectedUserIds.length > 0 ? colors.primary : colors.textMuted, flex: 1 }}>
                            {userLabel}
                        </Text>
                        <Feather name="chevron-down" size={11} color={selectedUserIds.length > 0 ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={displayNotifications as any[]}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} style={{ opacity: 0.3 }} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                {showHistory ? 'No notifications in History' : 'No notifications yet'}
                            </Text>
                            {historyButton}
                        </View>
                    }
                    ListFooterComponent={
                        notifications.length > 0 ? (
                            <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 24 }}>
                                {historyButton}
                            </View>
                        ) : null
                    }
                />
            )}

            {/* Multi-select Modal for Project/User */}
            <Modal visible={activeModal !== null} animationType="fade" transparent>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setActiveModal(null)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                    <View style={{
                        position: 'absolute',
                        top: 170,
                        left: 14,
                        right: 14,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 4,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>
                                {activeModal === 'project' ? 'Select Projects' : 'Select Users'}
                            </Text>
                        </View>
                        <ScrollView style={{ maxHeight: 340 }}>
                            {/* All option */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (activeModal === 'project') setSelectedProjectIds([]);
                                    else setSelectedUserIds([]);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                            >
                                <View style={{
                                    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                    borderColor: (activeModal === 'project' ? selectedProjectIds.length === 0 : selectedUserIds.length === 0) ? colors.primary : colors.border,
                                    backgroundColor: (activeModal === 'project' ? selectedProjectIds.length === 0 : selectedUserIds.length === 0) ? colors.primary : 'transparent',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {(activeModal === 'project' ? selectedProjectIds.length === 0 : selectedUserIds.length === 0) && (
                                        <Feather name="check" size={11} color="#fff" />
                                    )}
                                </View>
                                <Text style={{ fontSize: 14, color: colors.text }}>
                                    {activeModal === 'project' ? 'All Projects' : 'All Users'}
                                </Text>
                            </TouchableOpacity>

                            {activeModal === 'project' && projects.map((p) => {
                                const isSelected = selectedProjectIds.includes(p.id);
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => toggleProject(p.id)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            backgroundColor: isSelected ? colors.primary : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: colors.text }}>{p.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {activeModal === 'user' && usersList.map((u) => {
                                const isSelected = selectedUserIds.includes(String(u.id));
                                return (
                                    <TouchableOpacity
                                        key={u.id}
                                        onPress={() => toggleUser(String(u.id))}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12 }}
                                    >
                                        <View style={{
                                            width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            backgroundColor: isSelected ? colors.primary : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {isSelected && <Feather name="check" size={11} color="#fff" />}
                                        </View>
                                        <Text style={{ fontSize: 14, color: colors.text }}>{u.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Done */}
                        <TouchableOpacity
                            onPress={() => setActiveModal(null)}
                            style={{ margin: 10, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    markAll: {
        fontSize: 14,
        fontWeight: '600',
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        marginHorizontal: 14,
        marginBottom: 8,
        borderWidth: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    body: {
        fontSize: 11,
        marginTop: 2,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    timeText: {
        fontSize: 10,
        color: '#999',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
