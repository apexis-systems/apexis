import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl, BackHandler, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { useRouter, useFocusEffect } from 'expo-router';
import { handleNotificationNavigation } from '@/utils/navigation';

interface Notification {
    id: number;
    title: string;
    body: string;
    type: string;
    data: any;
    is_read: boolean;
    createdAt: string;
}

export default function NotificationsScreen() {
    const { colors, isDark } = useTheme();
    const router = useRouter();
    const { socket, setUnreadNotificationCount } = useSocket();
    const { isTourActive } = require('@/contexts/TourContext').useTour();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
    const [selectedType, setSelectedType] = useState<string | 'all'>('all');

    const filterTypes = [
        { label: 'All', value: 'all' },
        { label: 'Chat', value: 'chat' },
        { label: 'Files', value: 'file' },
        { label: 'Photos', value: 'photo' },
        { label: 'Snags', value: 'snag' },
        { label: 'RFI', value: 'rfi' },
    ];

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.back();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [router])
    );

    const fetchProjects = async () => {
        try {
            const res = await PrivateAxios.get('/projects');
            setProjects(res.data.projects || []);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            let url = '/notifications';
            const params: string[] = [];
            if (selectedProjectId !== 'all') params.push(`project_id=${selectedProjectId}`);
            if (selectedType !== 'all') params.push(`type=${selectedType}`);
            
            if (params.length > 0) url += `?${params.join('&')}`;

            const res = await PrivateAxios.get(url);
            const data = res.data.notifications || [];
            const unread = data.filter((n: any) => !n.is_read);
            setNotifications(unread);
            
            if (selectedProjectId === 'all' && selectedType === 'all') {
                setUnreadNotificationCount(unread.length);
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
        fetchProjects();
    }, []);

    const DUMMY_NOTIFICATIONS = [
        { id: 1, title: 'Project Status Updated', body: 'The foundation work for Site A has been approved.', type: 'snag_status_update', is_read: false, createdAt: new Date().toISOString(), data: {} },
        { id: 2, title: 'New Document Uploaded', body: 'Sarah uploaded "Borehole Test Results".', type: 'file_upload', is_read: false, createdAt: new Date().toISOString(), data: {} },
    ];

    const displayNotifications = isTourActive ? DUMMY_NOTIFICATIONS : notifications;

    useEffect(() => {
        fetchNotifications();
    }, [selectedProjectId, selectedType]);

    useEffect(() => {
        if (socket) {
            const handleNewNotif = (notif: Notification) => {
                const matchesProject = selectedProjectId === 'all' || notif.data?.projectId == selectedProjectId;
                const matchesType = selectedType === 'all' || notif.type === selectedType;
                
                if (matchesProject && matchesType) {
                    setNotifications(prev => [notif, ...prev]);
                }
            };
            socket.on('new-notification', handleNewNotif);
            return () => {
                socket.off('new-notification', handleNewNotif);
            };
        }
    }, [socket, selectedProjectId, selectedType]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const markRead = async (id: number) => {
        try {
            await PrivateAxios.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
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
                handleNotificationNavigation(item.type, item.data, router);
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
                    <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
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
            case 'file_upload_admin': return 'document-text';
            case 'photo_upload':
            case 'photo_comment': return 'camera';
            case 'snag_assigned':
            case 'snag_creation_admin': return 'warning';
            case 'snag_status_update': return 'checkmark-circle';
            case 'rfi_created':
            case 'rfi_assigned':
            case 'rfi_status_update': return 'help-circle';
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

            <View style={{ paddingTop: 10 }}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={filterTypes}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 10 }}
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

                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[{ id: 'all', name: 'All Projects' }, ...projects]}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setSelectedProjectId(item.id === 'all' ? 'all' : item.id)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: (item.id === 'all' ? selectedProjectId === 'all' : selectedProjectId === item.id) ? colors.primary : colors.surface,
                                    borderColor: colors.border,
                                }
                            ]}
                        >
                            <Text style={[styles.chipText, { color: (item.id === 'all' ? selectedProjectId === 'all' : selectedProjectId === item.id) ? '#fff' : colors.textMuted }]}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={displayNotifications as Notification[]}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} style={{ opacity: 0.3 }} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No notifications yet</Text>
                        </View>
                    }
                />
            )}
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
