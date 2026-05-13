import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Platform, Image, ActivityIndicator, AppState, Animated, ScrollView, Alert, AlertButton, StatusBar, Keyboard, KeyboardAvoidingView, StyleSheet, Modal } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import SecureAvatar from '@/components/shared/SecureAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { getRoomMessages, sendChatMessage, markMessageSeen, listRooms, uploadChatFile, getChatProjects, updateRoom, addRoomMembers, removeRoomMember, updateChatMessage, deleteChatMessage } from '@/services/chatService';
import { getChatUsers } from '@/services/userService';
import { uploadConfirmationScreenshot } from '@/services/fileService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import ChatCameraModal from '@/components/chat/ChatCameraModal';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import VoiceNoteRecorder from '@/components/chat/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/chat/VoiceNotePlayer';
import ViewShot from 'react-native-view-shot';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const insets = useSafeAreaInsets();

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
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    const [attachment, setAttachment] = useState<any>(null);
    const [annotatingImage, setAnnotatingImage] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);
    const [isCameraVisible, setIsCameraVisible] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<any>(null);
    const inputRef = useRef<TextInput>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [playingAudioUri, setPlayingAudioUri] = useState<string | null>(null);
    const viewShotRef = useRef<any>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [projectsList, setProjectsList] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectingProject, setSelectingProject] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    const commonEmojis = ['😊', '😂', '❤️', '👍', '🔥', '🙌', '😮', '😢', '😍', '🤔', '✅', '❌', '🚀', '✨'];




    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const data = await getRoomMessages(id as string);

                // Fetch room details to show correct header
                const allRooms = await listRooms();
                const currentRoom = allRooms.find((r: any) => String(r.id) === String(id));
                setRoom(currentRoom);
                setMessages([...data].reverse());

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
                        const exists = prev.some(m => String(m.id) === String(payload.id));
                        if (exists) {
                            return prev.map(m => String(m.id) === String(payload.id) ? payload : m);
                        }
                        return [payload, ...prev];
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
                    if (status === 'online') {
                        next.add(String(userId));
                    } else {
                        next.delete(String(userId));
                    }
                    return next;
                });
            };

            const handleTyping = ({ roomId: tid, userName }: { roomId: string | number, userName: string }) => {
                if (String(tid) === String(id)) {
                    setTypingUser(prev => {
                        if (!prev) {
                            if (animationRef.current) animationRef.current.stop();
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






            socket.on('room-updated', ({ roomId: rid, name }: any) => {
                if (String(rid) === String(id)) {
                    setRoom((prev: any) => ({ ...prev, name }));
                }
            });

            socket.on('members-added', ({ roomId: rid }: any) => {
                if (String(rid) === String(id)) {
                    listRooms().then(rooms => {
                        const currentRoom = rooms.find((r: any) => String(r.id) === String(id));
                        if (currentRoom) setRoom(currentRoom);
                    });
                }
            });

            socket.on('member-removed', ({ roomId: rid, userId: uid }: any) => {
                if (String(rid) === String(id)) {
                    if (String(uid) === String(user?.id)) {
                        router.back();
                    } else {
                        setRoom((prev: any) => ({
                            ...prev,
                            room_members: prev.room_members.filter((m: any) => String(m.user?.id) !== String(uid))
                        }));
                    }
                }
            });

            socket.on('message-updated', ({ messageId, text }: any) => {
                setMessages(prev => prev.map(m => String(m.id) === String(messageId) ? { ...m, text } : m));
            });

            socket.on('message-deleted', ({ messageId }: any) => {
                setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
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
                socket.off('room-updated');
                socket.off('members-added');
                socket.off('member-removed');
                socket.off('message-updated');
                socket.off('message-deleted');
            };
        }
    }, [id, socket, user?.id]);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            try {
                if (!id) return;
                const projects = await getChatProjects(id as string);
                if (projects) {
                    setProjectsList(projects);
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            } finally {
                setLoadingProjects(false);
            }
        };

        if (showProjectPicker) {
            fetchProjects();
        }
    }, [showProjectPicker]);

    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        if (!loading && messages.length > 0) {
            // In an inverted list, offset 0 is the bottom (latest message)
            if (isInitialLoadRef.current) {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                isInitialLoadRef.current = false;
            } else {
                // Scroll to latest message when new ones arrive
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
        }
    }, [messages.length, loading]);
    // Removed room?.id from dependencies as it's for status check below

    // Active status check when room members are loaded
    useEffect(() => {
        if (socket && isConnected && room?.room_members) {
            const timer = setTimeout(() => {
                room.room_members.forEach((m: any) => {
                    const strangerId = m.user?.id || m.userId;
                    if (strangerId && String(strangerId) !== String(user?.id)) {
                        socket.emit('check-user-status', strangerId);
                    }
                });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [socket, isConnected, room?.id, user?.id]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent as any, () => {
            setIsKeyboardVisible(true);
        });
        const hideSub = Keyboard.addListener(hideEvent as any, () => {
            setIsKeyboardVisible(false);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const handleSend = async (overrideFile?: any) => {
        if (editingMessage && !overrideFile) {
            handleUpdateMessage();
            return;
        }

        setIsSending(true);
        const fileToUpload = overrideFile || attachment;
        if (!message.trim() && !fileToUpload) {
            setIsSending(false);
            return;
        }

        const textToSubmit = message.trim();

        if (!overrideFile) {
            setMessage('');
            setAttachment(null);
            setShowEmojis(false);
        }


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
                type: fileData ? (
                    fileData.file_type?.startsWith('image/') ? 'image' :
                        fileData.file_type?.startsWith('audio/') ? 'audio' : 'file'
                ) : 'text',
                file_url: fileData?.file_url,
                file_name: fileData?.file_name,
                file_type: fileData?.file_type,
                file_size: fileData?.file_size,
                parent_id: replyTo?.id ? Number(replyTo.id) : null
            };
            if (textToSubmit) payload.text = textToSubmit;

            console.log("[CHAT] Sending payload:", payload);
            setReplyTo(null);

            const res = await sendChatMessage(payload);
            console.log("[CHAT] Response from server:", res);

            if (res.success && res.message) {
                setMessages(prev => {
                    const exists = prev.some(m => String(m.id) === String(res.message.id));
                    if (exists) {
                        return prev.map(m => String(m.id) === String(res.message.id) ? res.message : m);
                    }
                    return [res.message, ...prev];
                });
            }
        } catch (error) {
            console.error("handleSend error:", error);
        } finally {
            setIsUploading(false);
            setIsSending(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.9,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            let uri = asset.uri;
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 1920 } }],
                    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                );
                uri = manipulated.uri;
            } catch (e) { }

            setAnnotatingImage({
                uri,
                name: asset.fileName || `image_${Date.now()}.jpg`,
                type: 'image/jpeg',
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
            let uri = asset.uri;
            let mimeType = asset.mimeType || 'application/octet-stream';

            // If it's an image picked from files, enforce the same 1280px resolution
            if (mimeType.startsWith('image/')) {
                try {
                    const manipulated = await ImageManipulator.manipulateAsync(
                        uri,
                        [{ resize: { width: 1920 } }],
                        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                    );
                    uri = manipulated.uri;
                    mimeType = 'image/jpeg'; // Standardize to JPEG after manipulation
                } catch (e) {
                    console.error('Document image manipulation error:', e);
                }
            }

            setAttachment({
                uri,
                name: asset.name,
                type: mimeType,
                size: asset.size || 0
            });
        }
    };

    const scrollToMessage = React.useCallback((messageId: number) => {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.5 // Center the message
            });
        }
    }, [messages]);

    const handleDownload = React.useCallback(async (msg: any) => {
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
    }, []);

    const getActiveProjectId = () => {
        if (room?.project_id) return room.project_id;

        // Fallback: If it's a direct chat, see if the users share exactly one project
        if (room?.room_members && room.room_members.length >= 2) {
            const memberProjects = room.room_members.map((m: any) =>
                m.user?.project_members?.map((pm: any) => pm.project_id) || []
            );

            const intersection = memberProjects.reduce((a: any[], b: any[]) =>
                a.filter(x => b.includes(x))
            );

            if (intersection.length === 1) return intersection[0];
        }
        return null;
    };

    const handleProjectSelected = useCallback(async (projectId: string | number, uriOverride?: string) => {
        const uriToUpload = uriOverride || capturedUri;
        if (!uriToUpload) return;

        setSelectingProject(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: uriToUpload,
                name: `confirmation_${Date.now()}.jpg`,
                type: 'image/jpeg'
            } as any);
            formData.append('project_id', String(projectId));
            formData.append('skipActivity', 'false');

            const response = await uploadConfirmationScreenshot(formData);
            if (response.status === 200) {
                Alert.alert('Success', 'Confirmation screenshot saved to photos folder');
                setShowProjectPicker(false);
                setCapturedUri(null);
            } else {
                Alert.alert('Error', 'Failed to save confirmation');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Failed to save confirmation screenshot');
        } finally {
            setSelectingProject(false);
        }
    }, [capturedUri]);

    const takeConfirmationScreenshot = useCallback(async () => {
        if (!viewShotRef.current) return;

        setIsCapturing(true);
        try {
            const uri = await viewShotRef.current.capture();
            setCapturedUri(uri);

            const initialProjectId = getActiveProjectId();
            if (initialProjectId) {
                await handleProjectSelected(initialProjectId, uri);
            } else {
                setShowProjectPicker(true);
            }
        } catch (error) {
            console.error('Screenshot capture error:', error);
            Alert.alert('Error', 'Failed to take confirmation screenshot');
        } finally {
            setIsCapturing(false);
        }
    }, [room, getActiveProjectId, handleProjectSelected]);

    const handleUpdateMessage = async () => {
        if (!editingMessage || !message.trim()) return;
        try {
            await updateChatMessage(editingMessage.id, message.trim());
            setEditingMessage(null);
            setMessage('');
        } catch (err) {
            Alert.alert('Error', 'Failed to edit message');
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        Alert.alert('Delete Message', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await deleteChatMessage(messageId);
                } catch (err) {
                    Alert.alert('Error', 'Failed to delete message');
                }
            }}
        ]);
    };

    const handleUpdateRoomName = async (newName: string) => {
        if (!newName.trim() || newName === room.name) return;
        setIsUpdatingRoom(true);
        try {
            await updateRoom(id as string, { name: newName.trim() });
        } catch (err) {
            Alert.alert('Error', 'Failed to update group name');
        } finally {
            setIsUpdatingRoom(false);
        }
    };

    const handleAddMember = async (uid: number) => {
        try {
            await addRoomMembers(id as string, [uid]);
        } catch (err) {
            Alert.alert('Error', 'Failed to add member');
        }
    };

    const handleRemoveMember = async (uid: number) => {
        Alert.alert('Remove Member', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: async () => {
                try {
                    await removeRoomMember(id as string, uid);
                } catch (err) {
                    Alert.alert('Error', 'Failed to remove member');
                }
            }}
        ]);
    };

    const handleLeaveRoom = async () => {
        Alert.alert('Leave Group', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: async () => {
                try {
                    if (user?.id) {
                        await removeRoomMember(id as string, user.id);
                        router.back();
                    }
                } catch (err) {
                    Alert.alert('Error', 'Failed to leave group');
                }
            }}
        ]);
    };

    useEffect(() => {
        if (detailsModalVisible) {
            setLoadingUsers(true);
            getChatUsers().then(users => {
                setAllUsers(users.filter((u: any) => u.id !== user?.id && u.role !== 'superadmin'));
                setLoadingUsers(false);
            }).catch(e => {
                console.error(e);
                setLoadingUsers(false);
            });
        }
    }, [detailsModalVisible, user?.id]);

    const MessageItem = React.memo(({ item, isMe, time, setReplyTo, focusInput, scrollToMessage, setFullScreenImage, handleDownload, isDownloading, colors, isDark, playingAudioUri, setPlayingAudioUri, onLongPress }: any) => {
        const swipeableRef = useRef<any>(null);

        const renderLeftActions = () => {
            return (
                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                    <Feather name="corner-up-left" size={22} color={colors.primary} />
                </View>
            );
        };

        return (
            <ReanimatedSwipeable
                ref={swipeableRef}
                renderLeftActions={renderLeftActions}
                onSwipeableWillOpen={() => {
                    setReplyTo(item);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    focusInput?.();
                    setTimeout(() => {
                        swipeableRef.current?.close();
                    }, 0);
                }}
                friction={1.5}
                enableTrackpadTwoFingerGesture
                leftThreshold={20}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={() => onLongPress?.(item)}
                    delayLongPress={500}
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
                        overflow: 'visible',
                        elevation: 1,
                    }}>
                        {!isMe && (
                            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 2 }}>{item.sender?.name || 'User'}</Text>
                        )}

                        {(item.parent || item.parent_id) && (
                            <TouchableOpacity
                                onPress={() => scrollToMessage(item.parent_id || item.parent?.id)}
                                style={{
                                    backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                                    padding: 8,
                                    borderRadius: 8,
                                    borderLeftWidth: 4,
                                    borderLeftColor: colors.primary,
                                    marginBottom: 8
                                }}
                            >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: isMe ? '#fff' : colors.primary, marginBottom: 2 }}>
                                    {item.parent?.sender?.name || 'User'}
                                </Text>
                                <Text numberOfLines={2} style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.8)' : colors.textMuted }}>
                                    {item.parent ? (
                                        (item.parent.type === 'audio' || item.parent.file_type?.startsWith('audio/')) ? '🎤 Voice Note' : item.parent.type === 'image' ? '📷 Photo' : item.parent.type === 'file' ? '📄 File' : item.parent.text
                                    ) : 'Replied to message'}
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

                        {(item.type === 'audio' || item.file_type?.startsWith('audio/')) && item.downloadUrl && (
                            <View style={{ minWidth: 220 }}>
                                <VoiceNotePlayer
                                    uri={item.downloadUrl}
                                    isMe={isMe}
                                    colors={colors}
                                    playingUri={playingAudioUri}
                                    onPlay={setPlayingAudioUri}
                                />
                            </View>
                        )}

                        {item.type === 'file' && !item.file_type?.startsWith('audio/') && item.downloadUrl && (
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
                                <TouchableOpacity onPress={() => {
                                    setReplyTo(item);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    focusInput?.();
                                }}>
                                    <Feather name="corner-up-left" size={14} color={isMe ? "rgba(255,255,255,0.7)" : colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </ReanimatedSwipeable>
        );
    });

    const renderMessage = React.useCallback(({ item }: { item: any }) => {
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
            <MessageItem
                item={item}
                isMe={isMe}
                time={time}
                setReplyTo={setReplyTo}
                focusInput={() => inputRef.current?.focus()}
                scrollToMessage={scrollToMessage}
                setFullScreenImage={setFullScreenImage}
                handleDownload={handleDownload}
                isDownloading={isDownloading}
                colors={colors}
                isDark={isDark}
                playingAudioUri={playingAudioUri}
                setPlayingAudioUri={setPlayingAudioUri}
                onLongPress={(msg: any) => {
                    const options: AlertButton[] = [];
                    if (isMe && msg.type === 'text') options.push({ text: 'Edit Message', onPress: () => { setEditingMessage(msg); setMessage(msg.text); inputRef.current?.focus(); } });
                    if (isMe) options.push({ text: 'Delete Message', style: 'destructive', onPress: () => handleDeleteMessage(msg.id) });
                    options.push({ text: 'Take as Confirmation', onPress: takeConfirmationScreenshot });
                    options.push({ text: 'Cancel', style: 'cancel' });

                    Alert.alert('Message Options', '', options);
                }}
            />
        );
    }, [user?.id, colors, isDark, isDownloading, scrollToMessage, handleDownload, playingAudioUri, takeConfirmationScreenshot, editingMessage, message]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ flex: 1, backgroundColor: colors.surface }}>
                {/* Header */}
                <SafeAreaView
                    edges={['top']}
                    style={{
                        backgroundColor: colors.surface,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}
                >
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 8,
                        paddingBottom: 10,
                        minHeight: 52
                    }}>
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

                        <TouchableOpacity 
                            style={{ flex: 1, marginLeft: 10 }}
                            onPress={() => setDetailsModalVisible(true)}
                        >
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                {(room?.type === 'direct' ? room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.name : room?.name) || 'Loading...'}
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
                </SafeAreaView>


                {/* Chat Area */}
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: isDark ? '#0b141a' : '#efeae2' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : isKeyboardVisible ? 0 : -insets.bottom - 27.5} // Adjust for Android status bar when keyboard is hidden
                >
                    {loading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                                <FlatList
                                    ref={flatListRef}
                                    style={{ flex: 1 }}
                                    data={messages}
                                    inverted={true}
                                    keyExtractor={item => String(item.id)}
                                    renderItem={renderMessage}
                                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 20, paddingTop: 10 }}
                                    keyboardShouldPersistTaps="handled"
                                    keyboardDismissMode="on-drag"
                                />
                        </View>
                    )}

                    <View style={{ backgroundColor: colors.background }}>
                        {typingUser && (
                            <Animated.View style={{ paddingHorizontal: 20, paddingVertical: 8, opacity: pulseAnim, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', fontStyle: 'italic' }}>
                                    {typingUser} is typing...
                                </Text>
                            </Animated.View>
                        )}

                        <View style={{ backgroundColor: colors.background }}>
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

                            {editingMessage && (
                                <View style={{ 
                                    backgroundColor: colors.primary + '10', 
                                    borderTopWidth: 1, 
                                    borderTopColor: colors.border, 
                                    padding: 12, 
                                    borderLeftWidth: 4, 
                                    borderLeftColor: colors.primary, 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 12 
                                }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 2 }}>Editing Message</Text>
                                        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted }}>{editingMessage.text}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setEditingMessage(null); setMessage(''); }} style={{ padding: 4 }}>
                                        <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {replyTo && (
                                <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 2 }}>{replyTo.sender?.name}</Text>
                                        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textMuted }}>
                                            {(replyTo.type === 'audio' || replyTo.file_type?.startsWith('audio/')) ? '🎤 Voice Note' : replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'file' ? '📄 File' : replyTo.text}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
                                        <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: (isKeyboardVisible ? 8 : Math.max(8, insets.bottom) + 2), flexDirection: 'row', alignItems: 'flex-end' }}>
                                {!isRecordingVoice && (
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 4, minHeight: 44 }}>
                                        <TextInput
                                            ref={inputRef}
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
                                            textAlignVertical="center"
                                            style={{
                                                flex: 1,
                                                color: colors.text,
                                                fontSize: 16,
                                                marginHorizontal: 8,
                                                maxHeight: 120,
                                                paddingVertical: Platform.OS === 'ios' ? 8 : 4,
                                                minHeight: 36,
                                                lineHeight: 20
                                            }}
                                        />

                                        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingBottom: 4 }}>
                                            <TouchableOpacity onPress={pickDocument} style={{ padding: 4 }}>
                                                <Feather name="paperclip" size={22} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={pickImage} style={{ padding: 4, marginLeft: 2 }}>
                                                <Feather name="image" size={22} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => takePhoto()} style={{ padding: 4, marginLeft: 2 }}>
                                                <Feather name="camera" size={22} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {(!message.trim() && !attachment) || isRecordingVoice ? (
                                    <View style={{ flex: isRecordingVoice ? 1 : 0, height: isRecordingVoice ? 50 : 35 }}>
                                        <VoiceNoteRecorder
                                            colors={colors}
                                            onRecordingStateChange={setIsRecordingVoice}
                                            onSend={(uri, duration) => {
                                                handleSend({
                                                    uri,
                                                    name: `VoiceNote_${Date.now()}.m4a`,
                                                    type: 'audio/mp4',
                                                    size: 1024
                                                });
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => handleSend()}
                                        disabled={isSending || isUploading}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            backgroundColor: colors.primary,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginLeft: 8,
                                            opacity: (isSending || isUploading) ? 0.6 : 1,
                                            alignSelf: 'flex-end'
                                        }}
                                    >
                                        {isSending || isUploading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Feather name="send" size={20} color="#fff" style={{ transform: [{ translateY: 1 }, { translateX: -1 }] }} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    <FullScreenImageModal
                        visible={!!fullScreenImage}
                        onClose={() => setFullScreenImage(null)}
                        uri={fullScreenImage}
                    />

                    <ChatCameraModal
                        visible={isCameraVisible}
                        onClose={() => setIsCameraVisible(false)}
                        onCapture={(asset) => {
                            setAnnotatingImage(asset);
                        }}
                    />
                </KeyboardAvoidingView>
            </ViewShot>

            {isCapturing && (
                <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 10, fontWeight: '600' }}>Capturing confirmation...</Text>
                </View>
            )}

            {annotatingImage && (
                <ImageAnnotator
                    uri={annotatingImage.uri}
                    onSave={(newUri: string) => {
                        setAttachment({ ...annotatingImage, uri: newUri });
                        setAnnotatingImage(null);
                    }}
                    onCancel={() => {
                        setAttachment(annotatingImage);
                        setAnnotatingImage(null);
                    }}
                />
            )}

            {/* Project Selection Modal */}
            <Modal
                visible={showProjectPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowProjectPicker(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={{ flex: 1 }} 
                        onPress={() => setShowProjectPicker(false)} 
                    />
                    <View style={{
                        backgroundColor: colors.surface,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        padding: 24,
                        paddingBottom: Math.max(40, insets.bottom + 20),
                        maxHeight: '80%'
                    }}>
                        <View style={{ width: 40, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Select Project</Text>
                            <TouchableOpacity onPress={() => setShowProjectPicker(false)} style={{ padding: 4 }}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 24 }}>
                            Select the project where this confirmation should be indexed.
                        </Text>

                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            {loadingProjects ? (
                                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>Fetching your projects...</Text>
                                </View>
                            ) : projectsList.length > 0 ? (
                                projectsList.map((p) => (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => handleProjectSelected(p.id)}
                                        disabled={selectingProject}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 16,
                                            borderRadius: 20,
                                            backgroundColor: colors.background,
                                            marginBottom: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 2,
                                            elevation: 1
                                        }}
                                    >
                                        <View style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 14,
                                            backgroundColor: (p.color || colors.primary) + '20',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1,
                                            borderColor: (p.color || colors.primary) + '40'
                                        }}>
                                            <Text style={{ color: p.color || colors.primary, fontWeight: '800', fontSize: 20 }}>
                                                {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                                            </Text>
                                        </View>
                                        
                                        <View style={{ flex: 1, marginLeft: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{p.name || 'Untitled Project'}</Text>
                                                {p.user_role && (
                                                    <View style={{ 
                                                        backgroundColor: colors.primary + '11', 
                                                        paddingHorizontal: 6, 
                                                        paddingVertical: 1, 
                                                        borderRadius: 4,
                                                        borderWidth: 0.5,
                                                        borderColor: colors.primary + '22'
                                                    }}>
                                                        <Text style={{ 
                                                            fontSize: 8, 
                                                            color: colors.primary, 
                                                            fontWeight: '800', 
                                                            textTransform: 'uppercase' 
                                                        }}>
                                                            {p.user_role}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                                                {p.description || 'No project description'}
                                            </Text>
                                        </View>
                                        
                                        {selectingProject ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                                        <Feather name="folder" size={32} color={colors.border} />
                                    </View>
                                    <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text }}>No projects found</Text>
                                    <Text style={{ textAlign: 'center', fontSize: 13, color: colors.textMuted, marginTop: 4 }}>You are not a member of any projects.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Room Details Modal */}
            <Modal
                visible={detailsModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDetailsModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={{ flex: 1 }} 
                        onPress={() => setDetailsModalVisible(false)} 
                    />
                    <View style={{
                        backgroundColor: colors.surface,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        padding: 24,
                        paddingBottom: Math.max(40, insets.bottom + 20),
                        maxHeight: '90%'
                    }}>
                        <View style={{ width: 40, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
                                {room?.type === 'group' ? 'Group Information' : 'User Profile'}
                            </Text>
                            <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={{ padding: 4 }}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {room?.type === 'direct' ? (
                                <View style={{ alignItems: 'center', paddingBottom: 20 }}>
                                    <SecureAvatar 
                                        fileKey={room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.profile_pic}
                                        name={room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.name}
                                        size={100}
                                        style={{ marginBottom: 16 }}
                                    />
                                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
                                        {room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.name}
                                    </Text>
                                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', marginTop: 4, letterSpacing: 1 }}>
                                        {room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.role}
                                    </Text>
                                    <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4 }}>
                                        {room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.organization?.name}
                                    </Text>

                                    <View style={{ width: '100%', marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Project Roles</Text>
                                        <View style={{ gap: 12 }}>
                                            {room?.room_members?.find((m: any) => String(m.user?.id) !== String(user?.id))?.user?.project_members?.map((pm: any, idx: number) => (
                                                <View key={idx} style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between', 
                                                    backgroundColor: colors.background, 
                                                    padding: 14, 
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border
                                                }}>
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 }}>{pm.project?.name}</Text>
                                                    <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>{pm.role}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ gap: 24 }}>
                                    <View>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Group Name</Text>
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TextInput 
                                                defaultValue={room?.name}
                                                onEndEditing={(e) => handleUpdateRoomName(e.nativeEvent.text)}
                                                style={{ 
                                                    flex: 1, 
                                                    backgroundColor: colors.background, 
                                                    padding: 14, 
                                                    borderRadius: 16, 
                                                    color: colors.text, 
                                                    fontSize: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                Members ({room?.room_members?.length})
                                            </Text>
                                            <TouchableOpacity onPress={handleLeaveRoom}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#ff4444' }}>Leave Group</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ gap: 8 }}>
                                            {room?.room_members?.map((member: any) => (
                                                <View key={member.user?.id} style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    gap: 12, 
                                                    backgroundColor: colors.background, 
                                                    padding: 10, 
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    borderColor: colors.border
                                                }}>
                                                    <SecureAvatar 
                                                        fileKey={member.user?.profile_pic}
                                                        name={member.user?.name}
                                                        size={40}
                                                    />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                                                            {member.user?.name} {member.user?.id === user?.id && '(You)'}
                                                        </Text>
                                                        <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600' }}>{member.user?.role}</Text>
                                                    </View>
                                                    {member.user?.id !== user?.id && (
                                                        <TouchableOpacity onPress={() => handleRemoveMember(member.user?.id)} style={{ padding: 8 }}>
                                                            <Feather name="x-circle" size={20} color="#ff4444" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                    <View style={{ marginTop: 8, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Add New Member</Text>
                                        <TextInput 
                                            placeholder="Search members to add..."
                                            placeholderTextColor={colors.textMuted}
                                            value={userSearchQuery}
                                            onChangeText={setUserSearchQuery}
                                            style={{
                                                backgroundColor: colors.background,
                                                padding: 12,
                                                borderRadius: 16,
                                                color: colors.text,
                                                fontSize: 14,
                                                marginBottom: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border
                                            }}
                                        />
                                        <View style={{ gap: 10 }}>
                                            {loadingUsers ? (
                                                <ActivityIndicator color={colors.primary} />
                                            ) : (
                                                allUsers
                                                    .filter(u => !room?.room_members?.some((m: any) => m.user?.id === u.id))
                                                    .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                                    .slice(0, 5)
                                                    .map(u => (
                                                        <View key={u.id} style={{ 
                                                            flexDirection: 'row', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'space-between',
                                                            backgroundColor: colors.background,
                                                            padding: 12,
                                                            borderRadius: 16,
                                                            borderWidth: 1,
                                                            borderColor: colors.border
                                                        }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.name.charAt(0)}</Text>
                                                                </View>
                                                                <View>
                                                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{u.name}</Text>
                                                                    <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>{u.organization?.name}</Text>
                                                                </View>
                                                            </View>
                                                            <TouchableOpacity onPress={() => handleAddMember(u.id)} style={{ padding: 8 }}>
                                                                <Feather name="plus-circle" size={20} color={colors.primary} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
