import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import * as SecureStore from 'expo-secure-store';

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
    const { colors } = useTheme();
    const { socket, setUnreadNotificationCount } = useSocket();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async () => {
        try {
            const res = await PrivateAxios.get('/notifications');
            const data = res.data.notifications || [];
            setNotifications(data);
            setUnreadNotificationCount(data.filter((n: any) => !n.is_read).length);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    const markAllRead = async () => {
        try {
            await PrivateAxios.patch('/notifications/read-all');
            setUnreadNotificationCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all read:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        markAllRead();

        if (socket) {
            socket.on('new-notification', (notif: Notification) => {
                setNotifications(prev => [notif, ...prev]);
            });

            return () => {
                socket.off('new-notification');
            };
        }
    }, [socket]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const markRead = async (id: number) => {
        try {
            const notif = notifications.find(n => n.id === id);
            if (notif && !notif.is_read) {
                await PrivateAxios.patch(`/notifications/${id}/read`);
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
                setUnreadNotificationCount(prev => Math.max(0, prev - 1));
            }
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
                    borderWidth: 1,
                    borderRadius: 12,
                    marginHorizontal: 14,
                    marginBottom: 8,
                    padding: 12,
                }
            ]}
            onPress={() => markRead(item.id)}
        >
            <View style={[styles.iconContainer, {
                backgroundColor: item.is_read ? colors.background : 'rgba(249,115,22,0.1)',
                width: 36,
                height: 36,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
            }]}>
                <Ionicons
                    name={getIconName(item.type)}
                    size={20}
                    color={item.is_read ? colors.textMuted : colors.primary}
                />
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: colors.text, fontSize: 13, fontWeight: '700' }]}>{item.title}</Text>
                    {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary, width: 8, height: 8, borderRadius: 4 }]} />}
                </View>
                <Text style={[styles.body, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>{item.body}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                    <Text style={[styles.time, { fontSize: 10 }]}>{new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const getIconName = (type: string): any => {
        switch (type) {
            case 'chat': return 'chatbubble-ellipses';
            case 'group_creation': return 'people';
            case 'file_upload': return 'document-text';
            case 'snag_assigned': return 'warning';
            case 'snag_status_update': return 'checkmark-circle';
            default: return 'notifications';
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                {notifications.some(n => !n.is_read) && (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={notifications}
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
        padding: 15,
        borderBottomWidth: 1,
    },
    iconContainer: {
        marginRight: 15,
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    body: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 4,
    },
    time: {
        fontSize: 11,
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
});
