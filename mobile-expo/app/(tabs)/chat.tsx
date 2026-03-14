import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Image, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { listRooms } from '@/services/chatService';
import NewChatModal from '@/components/chat/NewChatModal';
import { useSocket } from '@/contexts/SocketContext';

export default function ChatListScreen() {
    const { user } = (useAuth() as any) || {};
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();
    const { socket } = useSocket();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<number | string>>(new Set());
    const [typingRooms, setTypingRooms] = useState<Record<string, string>>({});
    const typingTimeoutsRef = useRef<Record<string, any>>({});
    const pulseAnim = useRef(new Animated.Value(0.4)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);




    if (user?.role === 'superadmin') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <Feather name="lock" size={48} color={colors.textMuted} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16 }}>Access Denied</Text>
                <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
                    Superadmins do not have access to the chat feature.
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    style={{
                        marginTop: 24,
                        backgroundColor: '#f97316',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10
                    }}
                >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Back to Dashboard</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRooms = async () => {
        try {
            const data = await listRooms();
            setRooms(data);
        } catch (error) {
            console.error("fetchRooms error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('new-message-global', (data: any) => {
            setRooms(prevRooms => {
                const room_id = data.room_id || data.roomId;
                const roomIndex = prevRooms.findIndex(r => String(r.id) === String(room_id));
                if (roomIndex === -1) {
                    fetchRooms(); // New room, re-fetch all
                    return prevRooms;
                }

                const updatedRooms = [...prevRooms];
                const room = { ...updatedRooms[roomIndex] };
                room.chat_messages = [data.message];
                room.updatedAt = data.message.createdAt || new Date().toISOString();

                updatedRooms.splice(roomIndex, 1);
                updatedRooms.unshift(room);
                return updatedRooms;
            });
        });

        socket.on('user-status-changed', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(String(userId));
                else next.delete(String(userId));
                return next;
            });
        });

        // Check status of all members and join rooms
        rooms.forEach((room: any) => {
            socket.emit('join-room', room.id);

            room.room_members?.forEach((m: any) => {
                if (m.user?.id && m.user.id !== user?.id) {
                    socket.emit('check-user-status', m.user.id);
                }
            });
        });

        const handleTyping = ({ roomId, userName }: { roomId: string | number, userName: string }) => {
            const rid = String(roomId);

            setTypingRooms(prev => {
                // If it's the first person typing, start the animation
                if (Object.keys(prev).length === 0) {
                    animationRef.current = Animated.loop(
                        Animated.sequence([
                            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                            Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true })
                        ])
                    );
                    animationRef.current.start();
                }
                return { ...prev, [rid]: userName };
            });

            if (typingTimeoutsRef.current[rid]) clearTimeout(typingTimeoutsRef.current[rid]);
            typingTimeoutsRef.current[rid] = setTimeout(() => {
                setTypingRooms(prev => {
                    const next = { ...prev };
                    delete next[rid];
                    if (Object.keys(next).length === 0) {
                        animationRef.current?.stop();
                        animationRef.current = null;
                        pulseAnim.setValue(0.4);
                    }
                    return next;
                });
            }, 3000);
        };



        socket.on('user-status-response', ({ userId, status }: { userId: number | string, status: 'online' | 'offline' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'online') next.add(String(userId));
                else next.delete(String(userId));
                return next;
            });
        });

        socket.on('user-typing', handleTyping);

        return () => {
            socket.off('new-message-global');
            socket.off('user-status-changed');
            socket.off('user-status-response');
            socket.off('user-typing');
            Object.values(typingTimeoutsRef.current).forEach(t => clearTimeout(t));
        };
    }, [socket, rooms.length]);



    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    const filteredChats = rooms
        .filter(c => {
            const name = c.name || (c.room_members?.[0]?.user?.name) || 'Chat';
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
        });

    const renderChatItem = ({ item }: { item: any }) => {
        const otherMember = item.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id));
        const displayLabel = item.name || otherMember?.user?.name || 'Chat';
        const displayAvatarKey = otherMember?.user?.profile_pic;

        const isOnline = otherMember?.user?.id && onlineUsers.has(String(otherMember.user.id));
        const lastMsg = item.chat_messages?.[0];
        const lastMsgText = lastMsg ? lastMsg.text : 'No messages yet';
        const time = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const unreadCount = item.unread_count || 0;

        return (
            <TouchableOpacity
                onPress={() => router.push(`/chat/${item.id}`)}
                style={{
                    flexDirection: 'row',
                    padding: 16,
                    backgroundColor: colors.surface,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border
                }}
            >
                {/* Avatar */}
                <View style={{ position: 'relative' }}>
                    {item.type === 'group' ? (
                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="users" size={24} color="#fff" />
                        </View>
                    ) : (
                        <SecureAvatar
                            fileKey={displayAvatarKey}
                            name={displayLabel}
                            size={50}
                        />
                    )}
                    {isOnline && (
                        <View style={{ position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#25D366', borderWidth: 2, borderColor: colors.surface }} />
                    )}
                    {unreadCount > 0 && !isOnline && (
                        <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2, borderColor: colors.surface }} />
                    )}
                </View>

                {/* Chat Info */}
                <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                            {displayLabel}
                        </Text>
                        <Text style={{ fontSize: 12, color: unreadCount > 0 ? '#25D366' : colors.textMuted }}>
                            {time}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        {typingRooms[String(item.id)] ? (
                            <Animated.Text
                                style={{
                                    fontSize: 14,
                                    color: '#f97316',
                                    fontStyle: 'italic',
                                    fontWeight: '500',
                                    flex: 1,
                                    marginRight: 10,
                                    opacity: pulseAnim
                                }}
                                numberOfLines={1}
                            >
                                {typingRooms[String(item.id)]} is typing...
                            </Animated.Text>
                        ) : (

                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.textMuted,
                                    flex: 1,
                                    marginRight: 10
                                }}
                                numberOfLines={1}
                            >
                                {lastMsgText}
                            </Text>
                        )}


                        {unreadCount > 0 && (
                            <View style={{ backgroundColor: '#25D366', borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>Chats</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={() => setIsModalOpen(true)}>
                        <Feather name="plus-circle" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            <View style={{ padding: 12, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, height: 36, borderWidth: 1, borderColor: colors.border }}>
                    <Feather name="search" size={16} color={colors.textMuted} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search chats..."
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, color: colors.text, marginLeft: 8, fontSize: 15 }}
                    />
                </View>
            </View>

            {/* Chat List */}
            <FlatList
                data={filteredChats}
                keyExtractor={item => String(item.id)}
                renderItem={renderChatItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
                        <Feather name="message-square" size={48} color={colors.border} />
                        <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 16 }}>
                            {loading ? 'Loading chats...' : 'No chats found'}
                        </Text>
                    </View>
                }
            />

            {/* Floating Action Button */}
            {/* <TouchableOpacity
                style={{
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 90 : 80,
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#f97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#f97316',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 5
                }}
            >
                <Feather name="message-square" size={24} color="#fff" />
            </TouchableOpacity> */}

            <NewChatModal
                visible={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={(room) => router.push(`/chat/${room.id}`)}
            />
        </SafeAreaView>
    );
}
