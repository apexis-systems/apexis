import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, AppState, Animated, ScrollView, Alert } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms, uploadChatFile } from '@/services/chatService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ChatCameraModal from '@/components/chat/ChatCameraModal';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const { socket, isConnected } = useSocket();
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

    const [attachment, setAttachment] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);
    const [isCameraVisible, setIsCameraVisible] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    const commonEmojis = ['😊', '😂', '❤️', '👍', '🔥', '🙌', '😮', '😢', '😍', '🤔', '✅', '❌', '🚀', '✨'];




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
    }, [id, socket, user?.id]);
// Removed room?.id from dependencies as it's for status check below

    // Active status check when room members are loaded
    useEffect(() => {
        if (socket && isConnected && room?.room_members) {
            room.room_members.forEach((m: any) => {
                if (m.user?.id && String(m.user.id) !== String(user?.id)) {
                    socket.emit('check-user-status', m.user.id);
                }
            });
        }
    }, [socket, isConnected, room?.id, user?.id]);


    const handleSend = async () => {
        if (!message.trim() && !attachment) return;

        const textToSubmit = message.trim();
        const fileToUpload = attachment;

        setMessage('');
        setAttachment(null);
        setShowEmojis(false);

        try {
            let fileData = null;
            if (fileToUpload) {
                setIsUploading(true);
                const uploadRes = await uploadChatFile(
                    fileToUpload.uri,
                    fileToUpload.name,
                    fileToUpload.mimeType || fileToUpload.type || 'application/octet-stream'
                );
                if (uploadRes.success) {
                    fileData = uploadRes;
                }
                setIsUploading(false);
            }

            const payload: any = {
                roomId: id as string,
                type: fileData ? (fileData.file_type.startsWith('image/') ? 'image' : 'file') : 'text',
                file_url: fileData?.file_url,
                file_name: fileData?.file_name,
                file_type: fileData?.file_type,
                file_size: fileData?.file_size,
                parent_id: replyTo?.id || null
            };
            if (textToSubmit) payload.text = textToSubmit;
            
            setReplyTo(null);

            const res = await sendChatMessage(payload);

            if (res.success && res.message) {
                setMessages(prev => {
                    if (prev.find(m => String(m.id) === String(res.message.id))) return prev;
                    return [...prev, res.message];
                });
            }
        } catch (error) {
            console.error("handleSend error:", error);
            setIsUploading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setAttachment({
                uri: asset.uri,
                name: asset.fileName || `image_${Date.now()}.jpg`,
                type: asset.mimeType || 'image/jpeg',
                size: asset.fileSize || 0
            });
        }
    };

    const takePhoto = async () => {
        setIsCameraVisible(true);
    };

    const pickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setAttachment({
                uri: asset.uri,
                name: asset.name,
                type: asset.mimeType,
                size: asset.size || 0
            });
        }
    };

    const scrollToMessage = (messageId: number) => {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5 // Center the message
            });
        }
    };

    const handleDownload = async (msg: any) => {
        if (!msg.downloadUrl) return;
        setIsDownloading(String(msg.id));
        try {
            const fileName = msg.file_name || `chat_file_${msg.id}`;
            const fileUri = (FileSystem as any).cacheDirectory + fileName;

            const downloadRes = await FileSystem.downloadAsync(msg.downloadUrl, fileUri);
            if (downloadRes.status === 200) {
                await Sharing.shareAsync(downloadRes.uri);
            } else {
                Alert.alert('Error', 'Failed to download file');
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Error', 'An error occurred during download');
        } finally {
            setIsDownloading(null);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        if (item.type === 'system') {
            return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ backgroundColor: isDark ? colors.surface : '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? colors.border : '#FFE0B2' }}>
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500', textAlign: 'center' }}>
                            {item.text}
                        </Text>
                    </View>
                </View>
            );
        }

        const isMe = item.sender_id === user?.id;
        const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <TouchableOpacity 
                activeOpacity={0.9}
                onLongPress={() => setReplyTo(item)}
                style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginVertical: 4 }}
            >
                <View style={{
                    maxWidth: '80%',
                    backgroundColor: isMe ? colors.primary : colors.surface,
                    borderWidth: isMe ? 0 : 1,
                    borderColor: colors.border,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    marginHorizontal: 8,
                    borderRadius: 18,
                    borderBottomRightRadius: isMe ? 4 : 18,
                    borderBottomLeftRadius: isMe ? 18 : 4,
                    overflow: 'visible', // Ensure no cropping on Android
                    elevation: 1, // Subtle shadow for depth
                }}>
                    {!isMe && (
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 2 }}>{item.sender?.name || 'User'}</Text>
                    )}

                    {item.parent && (
                        <TouchableOpacity 
                            onPress={() => scrollToMessage(item.parent_id)}
                            style={{
                                backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                                padding: 8,
                                borderRadius: 8,
                                borderLeftWidth: 4,
                                borderLeftColor: colors.primary,
                                marginBottom: 8
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: isMe ? '#fff' : colors.primary, marginBottom: 2 }}>{item.parent.sender?.name}</Text>
                            <Text numberOfLines={2} style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.8)' : colors.textMuted }}>
                                {item.parent.type === 'image' ? '📷 Photo' : item.parent.type === 'file' ? '📄 File' : item.parent.text}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {item.type === 'image' && item.downloadUrl && (
                        <View>
                            <TouchableOpacity
                                onPress={() => setFullScreenImage(item.downloadUrl)}
                                style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)' }}
                            >
                                <Image
                                    source={{ uri: item.downloadUrl }}
                                    style={{ width: 240, height: 240, borderRadius: 12 }}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleDownload(item)}
                                disabled={isDownloading === String(item.id)}
                                style={{ position: 'absolute', bottom: 12, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 15 }}
                            >
                                {isDownloading === String(item.id) ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Feather name="download" size={16} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {item.type === 'file' && item.downloadUrl && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <TouchableOpacity
                                onPress={() => WebBrowser.openBrowserAsync(item.downloadUrl)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                    padding: 12,
                                    borderRadius: 12,
                                    gap: 12,
                                    flex: 1
                                }}
                            >
                                <View style={{ width: 44, height: 40, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name="file-text" size={20} color="#fff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: isMe ? '#fff' : colors.text }} numberOfLines={1}>{item.file_name}</Text>
                                    <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>{item.file_size || '0 KB'}</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleDownload(item)}
                                disabled={isDownloading === String(item.id)}
                                style={{ padding: 10, borderRadius: 12, backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                            >
                                {isDownloading === String(item.id) ? (
                                    <ActivityIndicator size="small" color={isMe ? '#fff' : colors.primary} />
                                ) : (
                                    <Feather name="download" size={20} color={isMe ? '#fff' : colors.primary} />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {item.text ? (
                        <Text style={{ fontSize: 15, color: isMe ? '#fff' : colors.text, lineHeight: 20 }}>
                            {item.text}
                        </Text>
                    ) : null}
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>
                                {time}
                            </Text>
                            {isMe && (
                                <Ionicons
                                    name="checkmark-done"
                                    size={14}
                                    color={item.seen ? "#25D366" : "rgba(255,255,255,0.7)"}
                                />
                            )}
                            {!isMe && (
                                <TouchableOpacity onPress={() => setReplyTo(item)}>
                                    <Feather name="corner-up-left" size={14} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="chevron-left" size={28} color={colors.primary} style={{ marginLeft: -8 }} />
                    {room?.type === 'group' ? (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
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
                    {/* Call icons removed as requested */}
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: isDark ? '#0b141a' : '#efeae2' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 90}
            >
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => String(item.id)}
                        renderItem={renderMessage}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        onContentSizeChange={() => {
                            if (messages.length > 0) {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }
                        }}
                        onLayout={() => {
                            if (messages.length > 0) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                        onScrollToIndexFailed={(info) => {
                            flatListRef.current?.scrollToOffset({
                                offset: info.averageItemLength * info.index,
                                animated: true
                            });
                        }}
                    />
                )}


                {typingUser && (
                    <Animated.View style={{ paddingHorizontal: 20, paddingVertical: 4, opacity: pulseAnim }}>
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', fontStyle: 'italic' }}>
                            {typingUser} is typing...
                        </Text>
                    </Animated.View>
                )}

                {/* Input Area */}


                <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, paddingHorizontal: 0, paddingVertical: 0 }}>
                    {/* Emoji Bar */}
                    {showEmojis && (
                        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10, paddingHorizontal: 16 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {commonEmojis.map(emoji => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => setMessage(prev => prev + emoji)}
                                        style={{ marginRight: 20 }}
                                    >
                                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Attachment Preview */}
                    {attachment && (
                        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {attachment.type?.startsWith('image/') ? (
                                    <Image source={{ uri: attachment.uri }} style={{ width: 44, height: 44 }} />
                                ) : (
                                    <Feather name="file" size={20} color={colors.textMuted} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{attachment.name}</Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted }}>{(attachment.size / 1024).toFixed(1)} KB</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAttachment(null)} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Reply Preview */}
                    {replyTo && (
                        <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 2 }}>{replyTo.sender?.name}</Text>
                                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted }}>
                                    {replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'file' ? '📄 File' : replyTo.text}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-end' }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, minHeight: 48 }}>
                            <TouchableOpacity
                                onPress={() => setShowEmojis(!showEmojis)}
                                style={{ padding: 4 }}
                            >
                                <Feather name="smile" size={24} color={showEmojis ? colors.primary : colors.textMuted} />
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

                            <TouchableOpacity onPress={pickDocument} style={{ padding: 4 }}>
                                <Feather name="paperclip" size={22} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={takePhoto} style={{ padding: 4, marginLeft: 4 }}>
                                <Feather name="camera" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={handleSend}
                            disabled={isUploading}
                            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8, opacity: isUploading ? 0.6 : 1 }}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Feather name="send" size={20} color="#fff" style={{ marginLeft: 2, marginTop: 2 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <ChatCameraModal
                    visible={isCameraVisible}
                    onClose={() => setIsCameraVisible(false)}
                    onCapture={(asset) => {
                        setAttachment(asset);
                    }}
                />

                <FullScreenImageModal
                    visible={!!fullScreenImage}
                    onClose={() => setFullScreenImage(null)}
                    uri={fullScreenImage}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
