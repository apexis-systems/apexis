import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    Keyboard,
    Platform,
    Dimensions,
    FlatList
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Share as RNShare } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    getComments,
    addComment as addCommentApi,
    deleteComment as deleteCommentApi,
    updateComment as updateCommentApi,
    type CommentThread
} from '@/services/commentService';
import { getMemberForTag } from '@/services/projectService';

import ZoomableImage from './ZoomableImage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onClose: () => void;
    uri?: string | null;
    photos?: any[];
    initialIndex?: number;
    onIndexChange?: (index: number) => void;
    title?: string;
    folderName?: string;
    fileId?: number | string;
    projectId?: number | string;
    location?: string;
    tags?: string;
    onEdit?: (uri: string) => void;
    onFolderPress?: (photo?: any) => void;
}

export default function FullScreenImageModal({
    visible,
    onClose,
    uri,
    photos,
    initialIndex = 0,
    onIndexChange,
    title,
    folderName,
    fileId,
    projectId,
    location,
    tags,
    onEdit,
    onFolderPress
}: Props) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useTranslation();

    // Prepare photos list: either use photos array or wrap single uri
    const photosList = useMemo(() => {
        if (photos && photos.length > 0) return photos;
        if (uri) {
            return [{
                id: fileId,
                downloadUrl: uri,
                file_url: uri,
                file_name: title,
                location,
                tags,
                folder: folderName ? { name: folderName } : undefined
            }];
        }
        return [];
    }, [photos, uri, fileId, title, location, tags, folderName]);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isZoomed, setIsZoomed] = useState(false);
    const flatListRef = useRef<FlatList<any>>(null);
    const isUserScrollingRef = useRef(false);

    const [sharing, setSharing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const tempFilesRef = useRef<Set<string>>(new Set());

    // Sync currentIndex with initialIndex when modal opens
    useEffect(() => {
        if (visible && photosList.length > 0) {
            const targetIdx = Math.max(0, Math.min(initialIndex ?? 0, photosList.length - 1));
            setCurrentIndex(targetIdx);
            setIsZoomed(false);
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: targetIdx, animated: false });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [visible, initialIndex, photosList.length]);

    // Active photo properties
    const activePhoto = photosList[currentIndex] || photosList[0] || null;

    const getPhotoUri = (photo: any): string | null => {
        if (!photo) return null;
        if (typeof photo === 'string') return photo;
        return photo.downloadUrl || photo.file_url || photo.uri || null;
    };

    const activeUri = getPhotoUri(activePhoto) || uri;
    const activeFolderName = activePhoto?.folder?.name || folderName;
    const activeTitle = activePhoto?.file_name || activePhoto?.name || title;
    const activeFileId = activePhoto?.id || fileId;
    const activeProjectId = projectId || activePhoto?.project?.id || activePhoto?.project_id;
    const activeLocation = activePhoto?.location || location;
    const activeTags = activePhoto?.tags || tags;

    // Comments State
    const commentInputRef = useRef<any>(null);
    const [comments, setComments] = useState<CommentThread[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const [editSending, setEditSending] = useState(false);

    // Mentions & Keyboard State
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [showMentions, setShowMentions] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Track keyboard height
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardHeight(0)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Clean up temporary files on modal close or unmount
    useEffect(() => {
        if (!visible) {
            const files = Array.from(tempFilesRef.current);
            tempFilesRef.current.clear();
            const { deleteFilesAsync } = require('@/services/cacheService');
            deleteFilesAsync(files).catch(() => { });
        }
    }, [visible]);

    useEffect(() => {
        return () => {
            const files = Array.from(tempFilesRef.current);
            const { deleteFilesAsync } = require('@/services/cacheService');
            deleteFilesAsync(files).catch(() => { });
        };
    }, []);

    // Load comments when activeFileId changes or modal opens
    const loadComments = async (fId: number | string) => {
        setCommentLoading(true);
        try {
            const data = await getComments(fId);
            setComments(data || []);
        } catch (e) {
            console.error('Failed to load photo comments:', e);
        } finally {
            setCommentLoading(false);
        }
    };

    useEffect(() => {
        if (visible && activeFileId) {
            loadComments(activeFileId);
        } else {
            setComments([]);
            setCommentText('');
            setReplyTo(null);
            setEditingCommentId(null);
        }
    }, [visible, activeFileId]);

    // Load project members for mentions
    useEffect(() => {
        if (visible && activeProjectId) {
            getMemberForTag(activeProjectId)
                .then((data: any) => {
                    if (data?.members) {
                        const uniqueUsers = data.members
                            .map((m: any) => m.user)
                            .filter((u: any, index: number, self: any[]) =>
                                u &&
                                String(u.id) !== String(user?.id) &&
                                self.findIndex(t => String(t.id) === String(u.id)) === index
                            );
                        setProjectMembers(uniqueUsers);
                    }
                })
                .catch(err => console.error('Failed to load project members for mentions:', err));
        }
    }, [visible, activeProjectId, user?.id]);

    if (!activeUri && photosList.length === 0) return null;

    const topOffset = Math.max(insets.top, 20);

    const getFileName = (url: string) => {
        try {
            const withoutQuery = url.split('?')[0];
            const parts = withoutQuery.split('/');
            return parts[parts.length - 1] || `photo_${Date.now()}.jpg`;
        } catch {
            return `photo_${Date.now()}.jpg`;
        }
    };

    const getLocalUri = async (url: string): Promise<string> => {
        if (url.startsWith('file://') || url.startsWith('/')) return url;
        const fileName = getFileName(url);
        const localUri = `${(FileSystem as any).cacheDirectory}fsm_${Date.now()}_${fileName}`;
        const { uri: downloaded } = await (FileSystem as any).downloadAsync(url, localUri);
        tempFilesRef.current.add(downloaded);
        return downloaded;
    };

    const handleDownload = async () => {
        if (downloading || sharing || !activeUri) return;
        setDownloading(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                Alert.alert(t('projectPhotos.galleryAccess', 'Permission required'), t('projectPhotos.galleryAccessMessage', 'Please allow access to your photo library to save images.'));
                return;
            }
            const localUri = await getLocalUri(activeUri);
            await MediaLibrary.saveToLibraryAsync(localUri);
            Alert.alert(t('projectPhotos.saved', 'Saved'), t('projectPhotos.photoSavedMessage', 'Photo saved to your gallery.'));
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert(t('projectPhotos.error', 'Error'), t('projectPhotos.failedToSavePhoto', 'Failed to save photo.'));
        } finally {
            setDownloading(false);
        }
    };

    const handleShare = async () => {
        if (sharing || downloading || !activeUri) return;
        setSharing(true);
        try {
            const localUri = await getLocalUri(activeUri);
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(localUri, {
                    mimeType: 'image/jpeg',
                    dialogTitle: getFileName(activeUri),
                });
            } else {
                await RNShare.share({ url: activeUri, title: getFileName(activeUri) });
            }
        } catch (err) {
            console.error('Share error:', err);
            Alert.alert(t('projectPhotos.error', 'Error'), 'Failed to share photo.');
        } finally {
            setSharing(false);
        }
    };

    // ── Comments Handling ──────────────────────────────────────────────
    const canEditOrDeleteComment = (c: CommentThread) => {
        if (!user || String(c.user_id) !== String(user.id)) return false;
        if (c.is_deleted) return false;
        const baseTime = c.edited_at ? new Date(c.edited_at) : new Date(c.createdAt);
        const diffMs = Date.now() - baseTime.getTime();
        return diffMs <= 5 * 60 * 1000;
    };

    const formatCommentTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    const handleAddComment = async () => {
        if (!activeFileId || !commentText.trim() || addingComment) return;
        setAddingComment(true);
        try {
            await addCommentApi(activeFileId, commentText.trim(), replyTo ?? undefined);
            setCommentText('');
            setReplyTo(null);
            await loadComments(activeFileId);
        } catch (e) {
            console.error('addComment error:', e);
        } finally {
            setAddingComment(false);
        }
    };

    const handleEditCommentSave = async (id: number) => {
        if (!editingCommentText.trim()) return;
        setEditSending(true);
        try {
            const updated = await updateCommentApi(id, editingCommentText.trim());
            const updateInList = (list: CommentThread[]): CommentThread[] => {
                return list.map(item => {
                    if (item.id === id) {
                        return { ...item, ...updated };
                    }
                    if (item.replies && item.replies.length > 0) {
                        return { ...item, replies: updateInList(item.replies) };
                    }
                    return item;
                });
            };
            setComments(prev => updateInList(prev));
            setEditingCommentId(null);
            setEditingCommentText('');
        } catch (e: any) {
            console.error('Failed to update comment:', e);
            Alert.alert(t('projectPhotos.error', 'Error'), e.response?.data?.error || 'Failed to update comment');
        } finally {
            setEditSending(false);
        }
    };

    const handleCommentDelete = async (id: number) => {
        Alert.alert(
            t('projectPhotos.deleteComment', 'Delete Comment'),
            t('projectPhotos.deleteCommentConfirm', 'Are you sure you want to delete this comment?'),
            [
                { text: t('projectPhotos.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('projectPhotos.delete', 'Delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updated = await deleteCommentApi(id);
                            const updateInList = (list: CommentThread[]): CommentThread[] => {
                                return list.map(item => {
                                    if (item.id === id) {
                                        return { ...item, ...updated };
                                    }
                                    if (item.replies && item.replies.length > 0) {
                                        return { ...item, replies: updateInList(item.replies) };
                                    }
                                    return item;
                                });
                            };
                            setComments(prev => updateInList(prev));
                        } catch (e: any) {
                            console.error('Failed to delete comment:', e);
                            Alert.alert(t('projectPhotos.error', 'Error'), e.response?.data?.error || 'Failed to delete comment');
                        }
                    }
                }
            ]
        );
    };

    const handleInputChange = (text: string) => {
        setCommentText(text);

        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || text[lastAtIndex - 1] === ' ')) {
            const query = text.substring(lastAtIndex + 1);
            if (!query.includes(' ')) {
                setMentionQuery(query);
                setShowMentions(true);
                setMentionStartIndex(lastAtIndex);
                return;
            }
        }
        setShowMentions(false);
        setMentionStartIndex(-1);
    };

    const handleSelectMention = (member: any) => {
        if (mentionStartIndex === -1) return;
        const before = commentText.substring(0, mentionStartIndex);
        const newText = `${before}@[${member.id}:${member.name}] `;
        setCommentText(newText);
        setShowMentions(false);
        setMentionStartIndex(-1);

        setTimeout(() => {
            commentInputRef.current?.focus();
        }, 50);
    };

    const renderCommentText = (text: string) => {
        if (!text) return null;
        const mentionRegex = /(@\[(\d+):([^\]]+)\])/g;
        const parts = text.split(mentionRegex);
        const result: any[] = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i % 4 === 1) continue;
            if (i % 4 === 2) continue;
            if (i % 4 === 3) {
                result.push(
                    <Text key={i} style={{ fontWeight: '800', color: colors.primary }}>
                        @{part}
                    </Text>
                );
                continue;
            }
            if (part) {
                result.push(part);
            }
        }
        return result;
    };

    const renderCommentBubble = (c: CommentThread, isReply = false) => {
        const isEditing = editingCommentId === c.id;
        const editable = canEditOrDeleteComment(c);

        return (
            <View
                key={c.id}
                style={{
                    backgroundColor: isReply ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: 8,
                    marginLeft: isReply ? 12 : 0,
                    marginTop: isReply ? 4 : 0,
                    marginBottom: isReply ? 0 : 8
                }}
            >
                {/* Name, time and actions row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>
                            {c.user?.name || t('projectPhotos.user', 'User')}
                        </Text>
                        <Text style={{ color: '#888', fontSize: 8 }}>{formatCommentTime(c.createdAt)}</Text>
                        {c.is_edited && (
                            <Text style={{ color: colors.primary, fontSize: 8, opacity: 0.7 }}>
                                ({t('projectPhotos.edited', 'Edited')})
                            </Text>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {!isReply && !c.is_deleted && (
                            <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                <Text style={{ color: '#888', fontSize: 9 }}>↩ {t('projectPhotos.reply', 'Reply')}</Text>
                            </TouchableOpacity>
                        )}
                        {editable && (
                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }}>
                                    <Feather name="edit-2" size={14} color="#aaa" />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => handleCommentDelete(c.id)}>
                                    <Feather name="trash-2" size={14} color="#ff6b6b" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Body / Edit input */}
                {isEditing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <TextInput
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            style={{
                                flex: 1,
                                height: 32,
                                borderRadius: 6,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                paddingHorizontal: 8,
                                color: '#fff',
                                fontSize: 12
                            }}
                            autoFocus
                        />
                        <TouchableOpacity style={{ padding: 6 }} onPress={() => handleEditCommentSave(c.id)} disabled={editSending}>
                            <Feather name="check" size={18} color="#4caf50" />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 6 }} onPress={() => { setEditingCommentId(null); setEditingCommentText(''); }}>
                            <Feather name="x" size={18} color="#f44336" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ marginTop: 2 }}>
                        {c.is_deleted ? (
                            <View>
                                <Text style={{ textDecorationLine: 'line-through', fontStyle: 'italic', color: '#666', fontSize: 11 }}>
                                    {renderCommentText(c.text)}
                                </Text>
                                <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(244,67,54,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginTop: 4 }}>
                                    <Text style={{ fontSize: 8, color: '#ff6b6b', fontWeight: 'bold' }}>
                                        Deleted • {formatCommentTime(c.deleted_at || c.createdAt)}
                                    </Text>
                                </View>
                            </View>
                        ) : c.is_edited && c.edit_history && c.edit_history.length > 0 ? (
                            <View style={{ borderLeftWidth: 1.5, borderLeftColor: 'rgba(255,165,0,0.3)', paddingLeft: 6, marginTop: 2 }}>
                                {c.edit_history.map((hist, idx) => (
                                    <View key={idx} style={{ marginBottom: 4 }}>
                                        <Text style={{ fontSize: 10, color: '#888' }}>
                                            Prev: {renderCommentText(hist.text)}
                                        </Text>
                                        <Text style={{ fontSize: 7, color: '#555', fontStyle: 'italic' }}>
                                            Edited at {formatCommentTime(hist.editedAt)}
                                        </Text>
                                    </View>
                                ))}
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                                    Current: {renderCommentText(c.text)}
                                </Text>
                                <Text style={{ fontSize: 7, color: '#777', fontStyle: 'italic', marginTop: 2 }}>
                                    Last updated at {formatCommentTime(c.edited_at || c.createdAt)}
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ color: '#ddd', fontSize: 11 }}>
                                {renderCommentText(c.text)}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={styles.container}>
                    {/* Photo Pager FlatList */}
                    <FlatList
                        ref={flatListRef}
                        data={photosList}
                        horizontal
                        pagingEnabled
                        scrollEnabled={!isZoomed && keyboardHeight === 0}
                        showsHorizontalScrollIndicator={false}
                        removeClippedSubviews={Platform.OS === 'android'}
                        keyboardShouldPersistTaps="handled"
                        windowSize={3}
                        initialNumToRender={1}
                        maxToRenderPerBatch={1}
                        keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_W,
                            offset: SCREEN_W * index,
                            index,
                        })}
                        onScrollBeginDrag={() => {
                            isUserScrollingRef.current = true;
                        }}
                        onMomentumScrollEnd={(e) => {
                            if (isUserScrollingRef.current) {
                                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                if (idx >= 0 && idx < photosList.length && idx !== currentIndex) {
                                    setCurrentIndex(idx);
                                    setIsZoomed(false);
                                    onIndexChange?.(idx);
                                }
                                isUserScrollingRef.current = false;
                            }
                        }}
                        onScrollEndDrag={(e) => {
                            const velocity = e.nativeEvent.velocity;
                            if (!velocity || (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1)) {
                                if (isUserScrollingRef.current) {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                    if (idx >= 0 && idx < photosList.length && idx !== currentIndex) {
                                        setCurrentIndex(idx);
                                        setIsZoomed(false);
                                        onIndexChange?.(idx);
                                    }
                                    isUserScrollingRef.current = false;
                                }
                            }
                        }}
                        renderItem={({ item }) => {
                            const itemUri = getPhotoUri(item);
                            const viewerHeight = SCREEN_H - insets.top - insets.bottom;
                            return (
                                <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                    <View style={{ width: SCREEN_W, height: viewerHeight, justifyContent: 'center', alignItems: 'center' }}>
                                        <ZoomableImage
                                            uri={itemUri || ''}
                                            width={SCREEN_W}
                                            height={viewerHeight}
                                            onZoomStateChange={setIsZoomed}
                                            onTap={() => setShowUI(prev => !prev)}
                                            onDismiss={onClose}
                                            gesturesEnabled={keyboardHeight === 0}
                                        />
                                    </View>
                                </View>
                            );
                        }}
                    />

                    {/* Top Controls Bar */}
                    {showUI && (
                        <>
                            {/* Close button — top left */}
                            <TouchableOpacity
                                onPress={onClose}
                                style={[styles.closeBtn, { top: topOffset }]}
                                accessibilityLabel="Close"
                            >
                                <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>

                            {/* Folder & Title Header — top center */}
                            {(activeFolderName || activeTitle || photosList.length > 1) && (
                                <View style={[styles.titleHeader, { top: topOffset }]} pointerEvents="box-none">
                                    {activeFolderName ? (
                                        onFolderPress ? (
                                            <TouchableOpacity
                                                onPress={() => onFolderPress(activePhoto)}
                                                activeOpacity={0.7}
                                                style={styles.folderBadge}
                                            >
                                                <Feather name="folder" size={14} color="#E2E8F0" style={{ marginRight: 6 }} />
                                                <Text style={styles.folderText} numberOfLines={1}>
                                                    {activeFolderName}
                                                </Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={styles.folderBadge}>
                                                <Feather name="folder" size={14} color="#E2E8F0" style={{ marginRight: 6 }} />
                                                <Text style={styles.folderText} numberOfLines={1}>
                                                    {activeFolderName}
                                                </Text>
                                            </View>
                                        )
                                    ) : null}

                                    {photosList.length > 1 && (
                                        <View style={styles.counterBadge}>
                                            <Text style={styles.counterText}>
                                                {currentIndex + 1} / {photosList.length}
                                            </Text>
                                        </View>
                                    )}

                                    {activeTitle && activeTitle !== activeFolderName && !activeFileId ? (
                                        <Text style={styles.titleText} numberOfLines={1}>
                                            {activeTitle}
                                        </Text>
                                    ) : null}
                                </View>
                            )}

                            {/* Download + Share — top right */}
                            <View style={[styles.topRight, { top: topOffset }]}>
                                <TouchableOpacity
                                    onPress={handleDownload}
                                    disabled={downloading || sharing}
                                    style={styles.iconBtn}
                                    accessibilityLabel="Save to gallery"
                                >
                                    {downloading
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Feather name="download" size={22} color="#fff" />
                                    }
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleShare}
                                    disabled={sharing || downloading}
                                    style={styles.iconBtn}
                                    accessibilityLabel="Share photo"
                                >
                                    {sharing
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Feather name="share-2" size={22} color="#fff" />
                                    }
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Bottom Panel: info + comments */}
                    {showUI && activeFileId && (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: Platform.OS === 'ios' ? keyboardHeight : keyboardHeight,
                                left: 0,
                                right: 0,
                                zIndex: 9999
                            }}
                        >
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 10 }}>
                                <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                        {activeTitle || t('projectPhotos.photo', 'Photo')}
                                    </Text>

                                    {(activeLocation || activeTags) && (
                                        <View style={{ marginTop: 6, gap: 6 }}>
                                            {activeLocation ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="map-pin" size={10} color="#f97316" />
                                                    </View>
                                                    <Text style={{ color: '#eee', fontSize: 11, fontWeight: '500' }}>{activeLocation}</Text>
                                                </View>
                                            ) : null}

                                            {activeTags ? (
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Feather name="tag" size={10} color="#fff" />
                                                    </View>
                                                    {activeTags.split(',').map((tag: string, tidx: number) => (
                                                        <View key={tidx} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>{tag.trim()}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : null}
                                        </View>
                                    )}
                                </View>

                                {/* Comments Section */}
                                <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingTop: 8, maxHeight: 200 }}>
                                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                            💬 {t('projectPhotos.comments', 'Comments')} ({comments.length})
                                        </Text>
                                    </View>

                                    {commentLoading ? (
                                        <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 8 }} />
                                    ) : (
                                        <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                                            {comments.length === 0 && (
                                                <Text style={{ color: '#666', fontSize: 10, marginBottom: 8 }}>
                                                    {t('projectPhotos.noComments', 'No comments yet')}
                                                </Text>
                                            )}
                                            {comments.map((c: any) => (
                                                <View key={c.id} style={{ marginBottom: 8 }}>
                                                    {renderCommentBubble(c, false)}
                                                    {c.replies?.map((r: any) => renderCommentBubble(r, true))}
                                                </View>
                                            ))}
                                        </ScrollView>
                                    )}

                                    {/* Replying indicator */}
                                    {replyTo && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <Text style={{ color: colors.primary, fontSize: 9 }}>{t('projectPhotos.replyingTo', 'Replying to comment')}</Text>
                                            <TouchableOpacity onPress={() => setReplyTo(null)}>
                                                <Text style={{ color: '#888', fontSize: 9 }}>✕ {t('projectPhotos.cancel', 'Cancel')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* Mentions autocomplete list */}
                                    {showMentions && (
                                        <View style={{ position: 'absolute', bottom: 50, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 1000 }}>
                                            <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="always">
                                                {projectMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).map((m) => (
                                                    <GestureTouchableOpacity
                                                        key={m.id}
                                                        onPress={() => handleSelectMention(m)}
                                                    >
                                                        <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                                                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{m.name.substring(0, 1).toUpperCase()}</Text>
                                                            </View>
                                                            <Text style={{ color: '#fff', fontSize: 12 }}>{m.name}</Text>
                                                        </View>
                                                    </GestureTouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* Add Comment Input Bar */}
                                    <ScrollView
                                        keyboardShouldPersistTaps="always"
                                        scrollEnabled={false}
                                        style={{ width: '100%', flexGrow: 0 }}
                                    >
                                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 8, marginTop: 4 }}>
                                            <TextInput
                                                ref={commentInputRef}
                                                value={commentText}
                                                onChangeText={handleInputChange}
                                                placeholder={t('projectPhotos.addCommentPlaceholder', 'Add a comment... (use @ to mention)')}
                                                placeholderTextColor="#555"
                                                style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, color: '#fff', fontSize: 12 }}
                                            />
                                            <GestureTouchableOpacity
                                                onPress={handleAddComment}
                                                disabled={addingComment || !commentText.trim()}
                                            >
                                                <View style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 18,
                                                    backgroundColor: colors.primary,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: (!commentText.trim() || addingComment) ? 0.5 : 1
                                                }}>
                                                    {addingComment
                                                        ? <ActivityIndicator size="small" color="#fff" />
                                                        : <Feather name="send" size={14} color="#fff" style={{ transform: [{ translateY: 1 }, { translateX: -1 }] }} />
                                                    }
                                                </View>
                                            </GestureTouchableOpacity>
                                        </View>
                                    </ScrollView>
                                </View>

                                {/* Safe-area spacer */}
                                <View style={{ height: Math.max(insets.bottom, 0) }} />
                            </View>
                        </View>
                    )}
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        left: 16,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topRight: {
        position: 'absolute',
        right: 16,
        flexDirection: 'row',
        gap: 8,
        zIndex: 100,
    },
    iconBtn: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleHeader: {
        position: 'absolute',
        left: 68,
        right: 116,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 90,
    },
    folderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        maxWidth: '100%',
    },
    folderText: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '600',
    },
    counterBadge: {
        marginTop: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    counterText: {
        color: '#E2E8F0',
        fontSize: 10,
        fontWeight: '600',
    },
    titleText: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
});
