import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { getRoomMessages, sendChatMessage, markMessageSeen } from '@/services/chatService';

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
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const data = await getRoomMessages(id as string);
                setMessages(data);

                // Mark unread messages as seen
                const lastUnread = data.reverse().find((m: any) => !m.seen && m.sender_id !== user?.id);
                if (lastUnread) {
                    await markMessageSeen(lastUnread.id);
                }
            } catch (error) {
                console.error("fetchMessages error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        if (socket) {
            socket.emit('join-room', id);

            const handleNewMessage = (payload: any) => {
                if (String(payload.room_id) === String(id)) {
                    setMessages(prev => [...prev, payload]);
                    // Auto mark as seen if we are in the room
                    if (payload.sender_id !== user?.id) {
                        markMessageSeen(payload.id).catch(console.error);
                    }
                }
            };

            const handleMessageSeen = ({ messageId }: { messageId: number }) => {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, seen: true } : m));
            };

            socket.on('new-message', handleNewMessage);
            socket.on('message-seen-update', handleMessageSeen);

            return () => {
                socket.off('new-message', handleNewMessage);
                socket.off('message-seen-update', handleMessageSeen);
            };
        }
    }, [id, socket, user?.id]);

    const handleSend = async () => {
        if (!message.trim()) return;
        const textToSubmit = message.trim();
        setMessage('');

        try {
            const res = await sendChatMessage({
                roomId: id as string,
                text: textToSubmit
            });
            // Socket will broadcast 'new-message', but we might want to update locally for responsiveness if not using broadcase-to-sender
            // The backend socket.ts broadcasts to room, so sender will also receive it.
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
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                        <Feather name="users" size={18} color="#fff" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>Chat Room</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Active Chat</Text>
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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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

                {/* Input Area */}
                <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-end' }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, minHeight: 48 }}>
                        <TouchableOpacity style={{ padding: 4 }}>
                            <Feather name="smile" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TextInput
                            value={message}
                            onChangeText={setMessage}
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
