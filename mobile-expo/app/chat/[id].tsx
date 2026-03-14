import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, AppState, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms } from '@/services/chatService';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const { socket } = useSocket();
    const router = useRouter();

    if (user?.role === 'superadmin') {
        router.replace('/(tabs)');
        return null;
    }

    const [message, setMessage] = useState('');
    const [room, setRoom] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const typingTimeoutRef = useRef<any>(null);
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);
    const flatListRef = useRef<FlatList>(null);




    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const data = await getRoomMessages(id as string);

                // Fetch room details to show correct header
                const allRooms = await listRooms();
                const currentRoom = allRooms.find((r: any) => String(r.id) === String(id));
                setRoom(currentRoom);
                setMessages(data);

                // Mark unread messages as seen only if app is active and we know user
                if (AppState.currentState === 'active' && user?.id) {
                    // Create a copy before reversing for finding the last unread
                    const lastUnread = [...data].reverse().find((m: any) => !m.seen && m.sender_id !== user.id);
                    if (lastUnread) {
                        await markMessageSeen(lastUnread.id);
                    }
                }
            } catch (error) {
                console.error("fetchMessages error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        if (socket) {
            console.log(`[SOCKET] Mobile emitting join-room: ${id}`);
            socket.emit('join-room', id);


            const handleNewMessage = (payload: any) => {
                console.log('[SOCKET] Mobile received new-message:', payload);
                if (String(payload.room_id || payload.roomId) === String(id)) {

                    setMessages(prev => {
                        // Better deduplication using string IDs
                        if (prev.find(m => String(m.id) === String(payload.id))) return prev;
                        return [...prev, payload];
                    });
                    // Auto mark as seen if we are in the room and app is active and know user
                    if (AppState.currentState === 'active' && user?.id && payload.sender_id !== user.id && payload.senderId !== user.id) {
                        markMessageSeen(payload.id).catch(console.error);
                    }
                }
            };

            const handleMessageSeen = ({ messageId }: { messageId: number }) => {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, seen: true } : m));
            };

            const handleStatusChange = ({ userId, status }: { userId: string | number; status: 'online' | 'offline' }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    if (status === 'online') next.add(String(userId));
                    else next.delete(String(userId));
                    return next;
                });
            };

            const handleTyping = ({ roomId: tid, userName }: { roomId: string | number, userName: string }) => {
                if (String(tid) === String(id)) {
                    setTypingUser(prev => {
                        if (!prev) {
                            animationRef.current = Animated.loop(
                                Animated.sequence([
                                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true })
                                ])
                            );
                            animationRef.current.start();
                        }
                        return userName;
                    });

                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                        setTypingUser(null);
                        animationRef.current?.stop();
                        animationRef.current = null;
                        pulseAnim.setValue(0.3);
                    }, 3000);
                }
            };






            // Check member status
            room?.room_members?.forEach((m: any) => {
                if (m.user?.id && String(m.user.id) !== String(user?.id)) {
                    socket.emit('check-user-status', m.user.id);
                }
            });

            socket.on('new-message', handleNewMessage);
            socket.on('message-seen-update', handleMessageSeen);
            socket.on('user-status-changed', handleStatusChange);
            socket.on('user-status-response', handleStatusChange);
            socket.on('user-typing', handleTyping);

            return () => {
                socket.off('new-message', handleNewMessage);
                socket.off('message-seen-update', handleMessageSeen);
                socket.off('user-status-changed', handleStatusChange);
                socket.off('user-status-response', handleStatusChange);
                socket.off('user-typing', handleTyping);
            };
        }
    }, [id, socket, user?.id, room?.id]);


    const handleSend = async () => {
        if (!message.trim()) return;
        const textToSubmit = message.trim();
        setMessage('');

        try {
            // 1. Send via API (persists and broadcasts to others)
            const res = await sendChatMessage({
                roomId: id as string,
                text: textToSubmit
            });

            // 2. Immediate local update if successful
            if (res.success && res.message) {
                setMessages(prev => {
                    if (prev.find(m => String(m.id) === String(res.message.id))) return prev;
                    return [...prev, res.message];
                });
            }

            // 3. REMOVED: Redundant manual socket emit. 
            // The backend controller already broadcasts 'new-message' to the room.
            /*
            if (socket) {
                socket.emit('send-message', {
                    roomId: id,
                    text: textToSubmit,
                    senderId: user?.id,
                    senderName: user?.name,
                    createdAt: new Date()
                });
            }
            */
        } catch (error) {
            console.error("handleSend error:", error);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        if (item.type === 'system') {
            return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: isDark ? colors.surface : '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? colors.border : '#FFE0B2' }}>
                        <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '500', textAlign: 'center' }}>
                            {item.text}
                        </Text>
                    </View>
                </View>
            );
        }

        const isMe = item.sender_id === user?.id;
        const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
                <View style={{
                    maxWidth: '80%',
                    backgroundColor: isMe ? '#f97316' : colors.surface,
                    borderWidth: isMe ? 0 : 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                }}>
                    {!isMe && (
                        <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '600', marginBottom: 2 }}>{item.sender?.name || 'User'}</Text>
                    )}
                    <Text style={{ fontSize: 15, color: isMe ? '#fff' : colors.text, lineHeight: 20 }}>
                        {item.text}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>
                            {time}
                        </Text>
                        {isMe && (
                            <Ionicons
                                name="checkmark-done"
                                size={14}
                                color={item.seen ? "#25D366" : "rgba(255,255,255,0.7)"}
                                style={{ marginLeft: 4 }}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="chevron-left" size={28} color="#f97316" style={{ marginLeft: -8 }} />
                    {room?.type === 'group' ? (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                            <Feather name="users" size={18} color="#fff" />
                        </View>
                    ) : (
                        <SecureAvatar
                            fileKey={room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.profile_pic}
                            name={room?.name || room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.name}
                            size={36}
                            style={{ marginLeft: 4 }}
                        />
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                        {room?.name || room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.name || 'Loading...'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {room?.type === 'group'
                            ? `${room.room_members?.length || 0} members`
                            : (onlineUsers.has(String(room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.id)) ? 'Online' : 'Offline')}
                    </Text>
                </TouchableOpacity>


                <View style={{ flexDirection: 'row', gap: 16, paddingRight: 8 }}>
                    <TouchableOpacity>
                        <Feather name="video" size={22} color="#f97316" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Feather name="phone" size={20} color="#f97316" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: isDark ? '#0b141a' : '#efeae2' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 70}
            >
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#f97316" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => String(item.id)}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 16 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    />
                )}


                {typingUser && (
                    <Animated.View style={{ paddingHorizontal: 20, paddingVertical: 4, opacity: pulseAnim }}>
                        <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '600', fontStyle: 'italic' }}>
                            {typingUser} is typing...
                        </Text>
                    </Animated.View>
                )}

                {/* Input Area */}


                <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-end' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, minHeight: 48 }}>
                        <TouchableOpacity style={{ padding: 4 }}>
                            <Feather name="smile" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TextInput
                            value={message}
                            onChangeText={(text) => {
                                setMessage(text);
                                if (socket && id && user?.name) {
                                    socket.emit('typing', { roomId: id, userName: user.name });
                                }
                            }}
                            placeholder="Message..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={{ flex: 1, color: colors.text, fontSize: 16, marginHorizontal: 8, maxHeight: 100, paddingTop: Platform.OS === 'ios' ? 4 : 0 }}
                        />

                        <TouchableOpacity style={{ padding: 4 }}>
                            <Feather name="paperclip" size={22} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} />
                        </TouchableOpacity>
                        {!message && (
                            <TouchableOpacity style={{ padding: 4, marginLeft: 4 }}>
                                <Feather name="camera" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={handleSend}
                        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                    >
                        {message ? (
                            <Feather name="send" size={20} color="#fff" style={{ marginLeft: 2, marginTop: 2 }} />
                        ) : (
                            <Feather name="mic" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
