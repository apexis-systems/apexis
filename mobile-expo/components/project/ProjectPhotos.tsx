import {
    View, TouchableOpacity, Alert, Modal, Share as RNShare, Dimensions, StatusBar, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, BackHandler, StyleSheet, RefreshControl
} from 'react-native';
import { Image } from 'expo-image';
import { FlatList } from 'react-native-gesture-handler';
import { Text, TextInput } from '@/components/ui/AppText';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles } from '@/services/fileService';
import { getMemberForTag, getProjectMembers } from '@/services/projectService';
import { getComments, addComment as addCommentApi, type CommentThread } from '@/services/commentService';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { setActiveProjectContext } from '@/utils/projectSelection';
import { formatFileSize } from '@/helpers/format';
import { groupItemsByMonth } from '@/helpers/grouping';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ZoomableImage from '../shared/ZoomableImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FileActionMenu from './FileActionMenu';
import FolderActionMenu from './FolderActionMenu';

// Removed local ZoomableImage

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectPhotos({ project, user, initialFolderId, initialFileId }: { project: any; user: any; initialFolderId?: string; initialFileId?: string }) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null);
    // Sync selectedFolder whenever the deep-link prop changes.
    // useState(initialFolderId) only runs on first mount — this effect handles
    // subsequent navigations while the component stays mounted in the FlatList.
    useEffect(() => {
        setSelectedFolder(initialFolderId || null);
    }, [initialFolderId]);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showEditFolder, setShowEditFolder] = useState(false);
    const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    // View Mode: 'grid' or 'list'
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest' | 'size'>('name');

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
    const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);
    const [movingContentsOf, setMovingContentsOf] = useState<any | null>(null);
    const [showRenameFile, setShowRenameFile] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState<number | null>(null);
    const [renamingFileName, setRenamingFileName] = useState('');

    // Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [isViewerZoomed, setIsViewerZoomed] = useState(false);
    const [showViewerUI, setShowViewerUI] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Comment state
    const [photoComments, setPhotoComments] = useState<CommentThread[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [showMentions, setShowMentions] = useState(false);

    // Action Menu state
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [activeActionFile, setActiveActionFile] = useState<any>(null);
    const [folderMenuVisible, setFolderMenuVisible] = useState(false);
    const [activeActionFolder, setActiveActionFolder] = useState<any>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadFiles = async (isRefetch = false) => {
        if (!project?.id) return;
        if (!isRefetch && folders.length === 0 && photos.length === 0) setLoading(true);
        try {
            const data = await getProjectFiles(project.id, 'photo');
            if (data.folderData) setFolders(data.folderData);
            if (data.fileData) {
                setPhotos(data.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
            }
        } catch (e) {
            console.error('fetchFiles', e);
        } finally {
            if (!isRefetch) setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadFiles();
            return () => { };
        }, [project?.id])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFiles(true);
        setRefreshing(false);
    };

    useEffect(() => {
        setSelectedFolder(initialFolderId || null);
    }, [initialFolderId]);

    useEffect(() => {
        if (project?.id) {
            setActiveProjectContext(project.id, selectedFolder, 'photo');
        }
    }, [project?.id, selectedFolder]);

    useEffect(() => {
        if (selectedFolder) {
            setSortBy('newest');
        } else {
            setSortBy('name');
        }
    }, [selectedFolder]);

    useEffect(() => {
        if (initialFileId && photos.length > 0) {
            const currentFolderPhotosForInit = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
            const visiblePhotosInit = user.role === 'client' ? currentFolderPhotosForInit.filter((p) => p.client_visible !== false) : currentFolderPhotosForInit;
            const sortedInit = [...visiblePhotosInit].sort((a: any, b: any) => {
                if (sortBy === 'name') return (a.file_name || '').localeCompare(b.file_name || '');
                if (sortBy === 'newest') return new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime();
                if (sortBy === 'oldest') return new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime();
                if (sortBy === 'size') return (b.file_size_mb || 0) - (a.file_size_mb || 0);
                return 0;
            });

            const index = sortedInit.findIndex(p => String(p.id) === String(initialFileId));
            if (index !== -1) {
                openViewer(index);
                router.setParams({ fileId: '', photoId: ''});
                
            }
        }
    }, [initialFileId, photos, selectedFolder, sortBy, user.role, router]);


    const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
    const currentFolderPhotos = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
    const visiblePhotos = user.role === 'client'
        ? currentFolderPhotos.filter((p) => p.client_visible !== false)
        : currentFolderPhotos;

    const sortItems = (items: any[], type: 'folder' | 'file') => {
        return [...items].sort((a: any, b: any) => {
            if (sortBy === 'name') {
                const nameA = type === 'folder' ? a.name : a.file_name;
                const nameB = type === 'folder' ? b.name : b.file_name;
                return (nameA || '').localeCompare(nameB || '');
            }
            if (sortBy === 'newest') {
                return new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime();
            }
            if (sortBy === 'size') {
                if (type === 'folder') return (a.name || '').localeCompare(b.name || '');
                return (b.file_size_mb || 0) - (a.file_size_mb || 0);
            }
            return 0;
        });
    };

    const sortedFolders = sortItems(currentFolders, 'folder');
    const sortedPhotos = sortItems(visiblePhotos, 'file');

    const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

    const goBack = () => {
        if (!selectedFolder) return;
        const parentId = currentFolder?.parent_id != null ? String(currentFolder.parent_id) : null;
        setSelectedFolder(parentId);
    };

    // ── Viewer helpers ────────────────────────────────────────────────────────

    // ── Scroll viewer to correct index when opened ──────────────────────────
    useEffect(() => {
        if (viewerOpen && sortedPhotos.length > 0) {
            // Small delay to ensure FlatList is mounted
            const t = setTimeout(() => {
                if (viewerIndex >= 0 && viewerIndex < sortedPhotos.length) {
                    flatListRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
                }
            }, 50);
            return () => clearTimeout(t);
        }
    }, [viewerOpen]);

    // ── Reload comments when swiping to a new photo ───────────────────────────
    useEffect(() => {
        if (viewerOpen && sortedPhotos[viewerIndex]?.id) {
            loadComments(sortedPhotos[viewerIndex].id);
        }
    }, [viewerIndex, viewerOpen]);

    const loadComments = async (fileId: number) => {
        setCommentLoading(true);
        try {
            const data = await getComments(fileId);
            setPhotoComments(data);
        } catch (e) {
            console.error('loadComments error:', e);
        } finally {
            setCommentLoading(false);
        }
    };

    const loadMembers = async () => {
        if (!project?.id) return;
        try {
            const data = await getMemberForTag(project.id);
            if (data.members) {
                const uniqueUsers = data.members
                    .map((m: any) => m.user)
                    .filter((u: any, index: number, self: any[]) =>
                        u &&
                        String(u.id) !== String(user?.id) &&
                        self.findIndex(t => String(t.id) === String(u.id)) === index
                    );
                setProjectMembers(uniqueUsers);
            }
        } catch (e) {
            console.error('loadMembers error:', e);
        }
    };

    const handleInputChange = (text: string) => {
        setCommentText(text);

        // Find the last "@" at the start of a word
        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || text[lastAtIndex - 1] === ' ')) {
            const query = text.substring(lastAtIndex + 1);
            // Only trigger if no space after @
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
    };

    const renderCommentText = (text: string) => {
        if (!text) return null;
        const mentionRegex = /(@\[(\d+):([^\]]+)\])/g;
        const parts = text.split(mentionRegex);
        const result: any[] = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // The split with capturing group returns the matches in specific indices
            // [non-match, whole-match, id, name, non-match, ...]
            // Indexing:
            // 0: text before
            // 1: whole match @[id:name]
            // 2: id
            // 3: name
            // 4: text after ...

            if (i % 4 === 1) continue; // Skip whole match
            if (i % 4 === 2) continue; // Skip ID
            if (i % 4 === 3) {
                result.push(
                    <Text key={i} style={{ fontWeight: '800' }}>
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

    const handleAddComment = async () => {
        const photo = sortedPhotos[viewerIndex];
        if (!photo?.id || !commentText.trim()) return;
        setAddingComment(true);
        try {
            await addCommentApi(photo.id, commentText.trim(), replyTo ?? undefined);
            setCommentText('');
            setReplyTo(null);
            await loadComments(photo.id);
        } catch (e) {
            console.error('addComment error:', e);
        } finally {
            setAddingComment(false);
        }
    };

    const openViewer = (index: number) => {
        setViewerIndex(index);
        setPhotoComments([]);
        setReplyTo(null);
        setCommentText('');
        setIsViewerZoomed(false);
        setShowViewerUI(false);
        setViewerOpen(true);
        loadMembers();
    };

    const closeViewer = () => {
        setViewerOpen(false);
        setIsViewerZoomed(false);
        setViewerIndex(-1);
    };

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (viewerOpen) {
                    closeViewer();
                    return true;
                }
                if (isSelectionMode) {
                    clearSelection();
                    return true;
                }
                if (selectedFolder) {
                    goBack();
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [viewerOpen, isSelectionMode, selectedFolder, goBack])
    );

    // const handleSharePhoto = async () => {
    //     const photo = sortedPhotos[viewerIndex];
    //     if (!photo?.downloadUrl) return;
    //     try {
    //         const ext = photo.file_name?.split('.').pop() || 'jpg';
    //         const localUri = `${(FileSystem as any).cacheDirectory}${photo.file_name || `photo_${Date.now()}.${ext}`}`;

    //         setDownloading(true);
    //         const { uri } = await FileSystem.downloadAsync(photo.downloadUrl, localUri);

    //         if (await Sharing.isAvailableAsync()) {
    //             await Sharing.shareAsync(uri, {
    //                 mimeType: photo.file_type || 'image/jpeg',
    //                 dialogTitle: photo.file_name || 'Site Photo'
    //             });
    //         } else {
    //             await RNShare.share({
    //                 title: photo.file_name || 'Site Photo',
    //                 message: `${photo.file_name || 'Site Photo'}\n${photo.downloadUrl}`,
    //                 url: photo.downloadUrl,
    //             });
    //         }
    //     } catch (e) {
    //         console.error('Share error:', e);
    //         Alert.alert("Error", "Failed to share photo");
    //     } finally {
    //         setDownloading(false);
    //     }
    // };

    const downloadToGallery = async () => {
        const photo = sortedPhotos[viewerIndex];
        if (!photo?.downloadUrl) return;
        setDownloading(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Allow access to save photos to your gallery.');
                return;
            }
            const ext = photo.file_name?.split('.').pop() || 'jpg';
            const localUri = (FileSystem as any).cacheDirectory + `apexis_${Date.now()}.${ext}`;
            const { uri } = await FileSystem.downloadAsync(photo.downloadUrl, localUri);
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Saved!', 'Photo saved to your gallery.');
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Error', 'Failed to save photo.');
        } finally {
            setDownloading(false);
        }
    };

    const confirmDeletePhoto = (photo: any) => {
        if (!photo?.id) return;
        Alert.alert('Delete', `Remove "${photo.file_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteFile(photo.id);
                        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                        if (viewerOpen) closeViewer();
                    } catch { Alert.alert('Error', 'Failed to delete'); }
                }
            }
        ]);
    };

    const handleDeletePhoto = () => {
        confirmDeletePhoto(sortedPhotos[viewerIndex]);
    };

    // ── Toggle helpers ────────────────────────────────────────────────────────

    const handleToggleVisibility = async (file: any) => {
        try {
            setProcessing('visibility');
            await toggleFileVisibility(file.id, !file.client_visible);
            
            // Local update
            setPhotos((prev) => prev.map((p) => (p.id === file.id ? { ...p, client_visible: !file.client_visible } : p)));
            
            setActionMenuVisible(false);
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
            await loadFiles(true);
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleFolderVis = async (folder: any) => {
        try {
            setProcessing('visibility');
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            await loadFiles(true);
            setFolderMenuVisible(false);
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
        } finally {
            setProcessing(null);
        }
    };

    const handleRenameFolder = async (folder: any) => {
        setEditingFolderId(folder.id);
        setEditFolderName(folder.name);
        setShowEditFolder(true);
    };

    const handleDeleteFolderAction = async (folder: any) => {
        confirmDeleteFolder(folder);
    };

    const handleDeleteFile = async (file: any) => {
        Alert.alert(
            "Delete Photo",
            "Are you sure you want to delete this photo?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setProcessing('delete');
                            await deleteFile(file.id);
                            await loadFiles(true);
                            setActionMenuVisible(false);
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete photo");
                        } finally {
                            setProcessing(null);
                        }
                    }
                }
            ]
        );
    };

    const handleRenameFileAction = (file: any) => {
        setRenamingFileId(file.id);
        setRenamingFileName(file.file_name);
        setShowRenameFile(true);
    };

    const handleUpdateFile = async () => {
        if (!renamingFileName.trim() || !renamingFileId) return;
        setSubmitting(true);
        try {
            const { updateFile } = require('@/services/fileService');
            await updateFile(renamingFileId, { file_name: renamingFileName.trim() });
            await loadFiles(true);
            setShowRenameFile(false);
            setRenamingFileId(null);
            setRenamingFileName('');
        } catch (e) {
            Alert.alert("Error", "Failed to update file");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setSubmitting(true);
        try {
            await createFolder({
                name: newFolderName.trim(),
                project_id: project.id,
                parent_id: selectedFolder,
            });
            await loadFiles(true);
            setNewFolderName('');
            setShowCreateFolder(false);
        } catch (e) {
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateFolder = async () => {
        if (!editFolderName.trim() || !editingFolderId) return;
        setSubmitting(true);
        try {
            await updateFolder(editingFolderId, { name: editFolderName.trim() });
            await loadFiles(true);
            setShowEditFolder(false);
            setEditingFolderId(null);
            setEditFolderName('');
        } catch (e) {
            Alert.alert("Error", "Failed to update folder");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (folder: any, force = false) => {
        try {
            setProcessing('delete_folder');
            const data = await deleteFolder(folder.id);
            if (data.success) {
                setFolders(folders.filter((f) => f.id !== folder.id));
                setFolderMenuVisible(false);
                Alert.alert(
                    'Success',
                    data.message || 'Folder deleted successfully.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (selectedFolder === folder.id) setSelectedFolder(null);
                            }
                        }
                    ]
                );
            } else {
                const msg = data?.error || 'Failed to delete folder';
                Alert.alert('Error', msg);
            }
        } finally {
            setProcessing(null);
        }
    };

    const confirmDeleteFolder = (folder: any) => {
        Alert.alert(
            'Delete Folder',
            `Are you sure you want to delete "${folder.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDelete(folder)
                }
            ]
        );
    };

    const toggleSelection = (type: 'folder' | 'file', id: string | number) => {
        if (type === 'folder') {
            const newSet = new Set(selectedFolders);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedFolders(newSet);
        } else {
            const newSet = new Set(selectedFiles);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedFiles(newSet);
        }
    };

    const handleLongPress = (type: 'folder' | 'file', id: string | number) => {
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor' || user.role === 'client') {
            setIsSelectionMode(true);
            toggleSelection(type, id);
        }
    };

    const clearSelection = () => {
        setSelectedFolders(new Set());
        setSelectedFiles(new Set());
        setIsSelectionMode(false);
    };

    const handleBulkVisibility = async (visible: boolean) => {
        try {
            setProcessing('bulk_visibility');
            const promises = [];
            if (selectedFolders.size > 0) {
                promises.push(bulkUpdateFolders({ ids: Array.from(selectedFolders), client_visible: visible }));
            }
            if (selectedFiles.size > 0) {
                promises.push(bulkUpdateFiles({ ids: Array.from(selectedFiles), client_visible: visible }));
            }
            await Promise.all(promises);
            Alert.alert("Success", "Visibility updated");
            // Refresh
            await loadFiles(true);
            clearSelection();
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
        } finally {
            setProcessing(null);
        }
    };

    const handleBulkShare = async () => {
        if (selectedFiles.size > 0) {
            const firstId = Array.from(selectedFiles)[0];
            const firstPhoto = photos.find(p => p.id === firstId);
            if (firstPhoto && firstPhoto.downloadUrl) {
                try {
                    const ext = firstPhoto.file_name?.split('.').pop() || 'jpg';
                    const localUri = `${(FileSystem as any).cacheDirectory}${firstPhoto.file_name || `photo_${Date.now()}.${ext}`}`;

                    setDownloading(true);
                    const { uri } = await FileSystem.downloadAsync(firstPhoto.downloadUrl, localUri);

                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(uri, {
                            mimeType: firstPhoto.file_type || 'image/jpeg',
                            dialogTitle: firstPhoto.file_name || 'Site Photo'
                        });
                    } else {
                        await RNShare.share({
                            title: firstPhoto.file_name,
                            message: `${firstPhoto.file_name}\n${firstPhoto.downloadUrl}`,
                            url: firstPhoto.downloadUrl,
                        });
                    }
                } catch (e) {
                    console.error('Bulk share error:', e);
                    Alert.alert("Error", "Failed to share");
                } finally {
                    setDownloading(false);
                }
            }
        } else {
            Alert.alert("Info", "Select at least one photo to share");
        }
    };

    const handleShareProject = async () => {
        try {
            const { getProjectShareLinks } = require('@/services/projectService');
            const links = await getProjectShareLinks(project.id, user.role);
            const link = user.role === 'client' ? links.clientLink : links.contributorLink;
            if (link) {
                await RNShare.share({
                    message: `Join ${project.name} on Apexis: ${link}`,
                });
            } else {
                Alert.alert("Info", "Share link not available");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to get share link");
        }
    };


    const handleSharePhoto = async (photo?: any) => {
        const photoToShare = photo || (selectedFiles.size > 0 ? photos.find(p => p.id === Array.from(selectedFiles)[0]) : null);
        if (!photoToShare) return;

        try {
            setDownloading(true);
            const ext = photoToShare.file_name?.split('.').pop() || 'jpg';
            const localUri = `${(FileSystem as any).cacheDirectory}${photoToShare.file_name || `photo_${Date.now()}.${ext}`}`;

            const { uri } = await FileSystem.downloadAsync(photoToShare.downloadUrl, localUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: photoToShare.file_type || 'image/jpeg',
                    dialogTitle: photoToShare.file_name || 'Site Photo'
                });
            } else {
                await RNShare.share({
                    title: photoToShare.file_name,
                    url: photoToShare.downloadUrl,
                });
            }
        } catch (e) {
            Alert.alert("Error", "Failed to share photo");
        } finally {
            setDownloading(false);
        }
    };


    const getBreadcrumbs = () => {
        if (!currentFolder) return [];
        const path: any[] = [];
        let curr: any = currentFolder;
        while (curr) {
            path.unshift(curr);
            curr = folders.find((f) => f.id === curr.parent_id);
        }
        return path;
    };

    // ── Unified Layout ───────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder || ''}`)}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>New Folder</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                ) : (
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            {currentFolder && (
                                <TouchableOpacity onPress={goBack} style={{ padding: 6, borderRadius: 20 }}>
                                    <Feather name="arrow-left" size={16} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            <Feather name="folder" size={16} color={colors.primary} />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => setSelectedFolder(null)}>
                                        <View style={{ paddingVertical: 4 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedFolder ? colors.primary : colors.textMuted }}>
                                                {project?.name}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    {getBreadcrumbs().map((b) => (
                                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: colors.textMuted, marginHorizontal: 4 }}>/</Text>
                                            <TouchableOpacity onPress={() => setSelectedFolder(b.id)}>
                                                <View style={{ paddingVertical: 4 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedFolder === b.id ? colors.primary : colors.textMuted }}>
                                                        {b.name}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>


                            {visiblePhotos.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                                    style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Feather name={viewMode === 'grid' ? 'list' : 'grid'} size={16} color={colors.text} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => {
                                    let next: any = 'name';
                                    if (sortBy === 'name') next = 'newest';
                                    else if (sortBy === 'newest') next = 'oldest';
                                    else if (sortBy === 'oldest') next = 'size';
                                    else if (sortBy === 'size') next = 'name';
                                    setSortBy(next);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: colors.surface,
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}
                            >
                                <Feather name="bar-chart-2" size={14} color={colors.primary} style={{ transform: [{ rotate: '90deg' }] }} />
                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{sortBy}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                            {sortedFolders.map((folder) => {
                                const count = photos.filter((p) => p.folder_id === folder.id).length;
                                const subcount = folders.filter((f) => f.parent_id === folder.id).length;
                                const isSelected = selectedFolders.has(folder.id);
                                const isArchiveFolder = folder.name.toLowerCase() === 'archive';
                                return (
                                    <View
                                        key={folder.id}
                                        style={{
                                            width: '24%',
                                            aspectRatio: 1,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 16,
                                            backgroundColor: isSelected ? 'rgba(249,115,22,0.08)' : colors.surface,
                                            borderWidth: 1,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            padding: 8,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 4,
                                            elevation: 1,
                                            position: 'relative'
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isSelectionMode) toggleSelection('folder', folder.id);
                                                else setSelectedFolder(folder.id);
                                            }}
                                            onLongPress={() => handleLongPress('folder', folder.id)}
                                            style={{
                                                ...StyleSheet.absoluteFillObject,
                                                zIndex: 5,
                                            }}
                                        />
                                        <View style={{ marginBottom: 8 }}>
                                            <Feather name={isArchiveFolder ? "archive" : "folder"} size={36} color={isArchiveFolder ? '#64748b' : colors.primary} />
                                        </View>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.primary, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: isArchiveFolder ? '#64748b' : colors.text, textAlign: 'center' }}>{folder.name}</Text>
                                        <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>
                                            {count} photos{subcount > 0 ? ` · ${subcount} folders` : ''}
                                        </Text>
                                        {/* Folder Action Menu - Hidden for Clients */}
                                        {!isSelectionMode && user.role !== 'client' && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                            <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveActionFolder(folder);
                                                        setFolderMenuVisible(true);
                                                    }}
                                                >
                                                    <Feather
                                                        name="more-vertical"
                                                        size={14}
                                                        color={colors.textMuted}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {!loading && currentFolders.length === 0 && visiblePhotos.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="camera" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders or photos yet</Text>
                    </View>
                )}

                <View style={{ marginTop: sortedFolders.length > 0 ? 12 : 0 }}>
                    {(() => {
                        const renderPhotoItem = (photo: any, index: number) => {
                            const isSelected = selectedFiles.has(photo.id);
                            if (viewMode === 'grid') {
                                return (
                                    <View
                                        key={photo.id}
                                        style={{
                                            width: '23.8%',
                                            aspectRatio: 1,
                                            backgroundColor: isSelected ? 'rgba(249,115,22,0.1)' : colors.surface,
                                            borderRadius: 10,
                                            overflow: 'hidden',
                                            borderWidth: 1,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            position: 'relative'
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isSelectionMode) toggleSelection('file', photo.id);
                                                else openViewer(sortedPhotos.findIndex(p => p.id === photo.id));
                                            }}
                                            onLongPress={() => handleLongPress('file', photo.id)}
                                            style={{
                                                ...StyleSheet.absoluteFillObject,
                                                zIndex: 5,
                                            }}
                                        />
                                        <Image
                                            source={photo.downloadUrl}
                                            style={{ width: '100%', height: '100%' }}
                                            contentFit="cover"
                                            transition={200}
                                        />

                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary, borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        {!isSelectionMode && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                            <View style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveActionFile(photo);
                                                        setActionMenuVisible(true);
                                                    }}
                                                    style={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: 12,
                                                        backgroundColor: colors.surface,
                                                        borderWidth: 1,
                                                        borderColor: colors.border,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        shadowColor: '#000',
                                                        shadowOffset: { width: 0, height: 1 },
                                                        shadowOpacity: isDark ? 0.3 : 0.1,
                                                        shadowRadius: 1,
                                                        elevation: 2
                                                    }}
                                                >
                                                    <Feather
                                                        name="more-vertical"
                                                        size={14}
                                                        color={colors.text}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, paddingHorizontal: 6 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 9, color: '#fff', textAlign: 'center' }}>{photo.file_name}</Text>
                                        </View>
                                    </View>
                                );
                            } else {
                                // List View Mode
                                return (
                                    <View
                                        key={photo.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            borderRadius: 12,
                                            backgroundColor: isSelected ? (isDark ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.1)') : colors.surface,
                                            borderWidth: 1,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            padding: 10,
                                            marginVertical: 4,
                                            position: 'relative',
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isSelectionMode) toggleSelection('file', photo.id);
                                                else openViewer(sortedPhotos.findIndex(p => p.id === photo.id));
                                            }}
                                            onLongPress={() => handleLongPress('file', photo.id)}
                                            style={{
                                                ...StyleSheet.absoluteFillObject,
                                                zIndex: 5,
                                            }}
                                        />
                                        <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface }}>
                                            <Image source={{ uri: photo.downloadUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                        </View>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 2, left: 2, backgroundColor: colors.primary, borderRadius: 12, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{photo.file_name}</Text>
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{formatFileSize(photo.file_size_mb)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', zIndex: 10 }}>
                                            {!isSelectionMode && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveActionFile(photo);
                                                        setActionMenuVisible(true);
                                                    }}
                                                    style={{ padding: 4 }}
                                                >
                                                    <Feather
                                                        name="more-vertical"
                                                        size={16}
                                                        color={colors.textMuted}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            }
                        };

                        if (sortBy === 'newest' || sortBy === 'oldest') {
                            const groups = groupItemsByMonth(sortedPhotos);
                            return groups.map((group) => (
                                <View key={group.title} style={{ marginBottom: 20 }}>
                                    <View style={{
                                        paddingVertical: 12,
                                        backgroundColor: 'transparent',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{group.title}</Text>
                                        <View style={{ height: 1, flex: 1, backgroundColor: colors.border, marginLeft: 12, opacity: 0.3 }} />
                                    </View>
                                    <View style={{
                                        flexDirection: viewMode === 'grid' ? 'row' : 'column',
                                        flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
                                        gap: viewMode === 'grid' ? 4 : 8
                                    }}>
                                        {group.data.map((p, i) => renderPhotoItem(p, i))}
                                    </View>
                                </View>
                            ));
                        }

                        return (
                            <View style={{
                                flexDirection: viewMode === 'grid' ? 'row' : 'column',
                                flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
                                gap: viewMode === 'grid' ? 4 : 4
                            }}>
                                {sortedPhotos.map((photo, index) => renderPhotoItem(photo, index))}
                            </View>
                        );
                    })()}
                </View>

                {/* {sortedFolders.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="camera" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders yet</Text>
                    </View>
                )} */}
            </ScrollView>

            {/* New Folder Modal */}
            <Modal visible={showCreateFolder} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>New Folder</Text>
                        <TextInput
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            placeholder="Folder name"
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? 'Creating…' : 'Create'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Bulk Action Bar - Now enabled for Clients too */}
            {isSelectionMode && (selectedFolders.size > 0 || selectedFiles.size > 0) && (
                <View style={{
                    position: 'absolute', bottom: 15, left: 20, right: 20,
                    backgroundColor: colors.surface, borderRadius: 35, height: 64,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 20, elevation: 12, shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 8,
                    borderWidth: 1, borderColor: colors.border, zIndex: 1000,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <TouchableOpacity onPress={clearSelection} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="x" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{selectedFolders.size + selectedFiles.size}</Text>
                        <View style={{ flex: 1, marginLeft: 0 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 15, alignItems: 'center', paddingRight: 10, paddingLeft: 10, flex: 1, justifyContent: 'flex-end' }}>
                                {/* Share - Only if files selected */}
                                {selectedFiles.size > 0 && (
                                    <TouchableOpacity
                                        onPress={() => handleSharePhoto()}
                                        style={{ padding: 4 }}
                                        disabled={processing !== null}
                                    >
                                        <Feather name="share-2" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                )}

                                {/* Edit - Only if single folder selected */}
                                {selectedFolders.size === 1 && selectedFiles.size === 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const folderId = Array.from(selectedFolders)[0];
                                            const folder = folders.find(f => f.id === folderId);
                                            if (folder) {
                                                setEditingFolderId(folder.id);
                                                setEditFolderName(folder.name);
                                                setShowEditFolder(true);
                                            }
                                        }}
                                        style={{ padding: 4 }}
                                        disabled={processing !== null}
                                    >
                                        <Feather name="edit-2" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                )}

                                {/* Delete - ONLY for single folder or files you uploaded */}
                                {(() => {
                                    if (selectedFolders.size === 1 && selectedFiles.size === 0) {
                                        // Folder delete for admins only
                                        if (user.role === 'admin' || user.role === 'superadmin') {
                                            return (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        const folderId = Array.from(selectedFolders)[0];
                                                        const folder = folders.find(f => f.id === folderId);
                                                        if (folder) confirmDeleteFolder(folder);
                                                    }}
                                                    style={{ padding: 4 }}
                                                    disabled={processing !== null}
                                                >
                                                    {processing === 'delete_folder' ? (
                                                        <ActivityIndicator size="small" color="#ef4444" />
                                                    ) : (
                                                        <Feather name="trash-2" size={18} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        }
                                    } else if (selectedFiles.size === 1 && selectedFolders.size === 0) {
                                        // File delete ONLY for uploader
                                        const fileId = Array.from(selectedFiles)[0];
                                        const file = photos.find(p => p.id === fileId);
                                        if (file && (String(file.created_by) === String(user.id))) {
                                            return (
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteFile(file)}
                                                    style={{ padding: 4 }}
                                                    disabled={processing !== null}
                                                >
                                                    {processing === 'delete' ? (
                                                        <ActivityIndicator size="small" color="#ef4444" />
                                                    ) : (
                                                        <Feather name="trash-2" size={18} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        }
                                    }
                                    return null;
                                })()}

                                {/* Visibility Toggle - Admin, Contributor, and Client */}
                                {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor' || user.role === 'client') && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => handleBulkVisibility(true)}
                                            style={{ padding: 4 }}
                                            disabled={processing !== null}
                                        >
                                            {processing === 'bulk_visibility' ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : (
                                                <Feather name="eye" size={18} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleBulkVisibility(false)}
                                            style={{ padding: 4 }}
                                            disabled={processing !== null}
                                        >
                                            {processing === 'bulk_visibility' ? (
                                                <ActivityIndicator size="small" color={colors.textMuted} />
                                            ) : (
                                                <Feather name="eye-off" size={18} color={colors.textMuted} />
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}

                                {/* Move Option - Admin only for folders, Admin/Contributor for files */}
                                {((selectedFolders.size > 0 && (user.role === 'admin' || user.role === 'superadmin')) || (selectedFiles.size > 0)) && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setMovingItem(null);
                                            setShowMoveDialog(true);
                                        }}
                                        style={{ padding: 4 }}
                                        disabled={processing !== null}
                                    >
                                        <Feather name="folder-minus" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            )}

            <MobileMoveToFolderDialog
                visible={showMoveDialog}
                onClose={() => {
                    setShowMoveDialog(false);
                    setMovingContentsOf(null);
                    setMovingItem(null);
                }}
                project={project}
                item={movingItem}
                selectedItems={movingContentsOf ? {
                    folders: folders.filter(f => String(f.parent_id) === String(movingContentsOf.id)).map(f => f.id),
                    files: photos.filter(p => String(p.folder_id) === String(movingContentsOf.id)).map(p => p.id)
                } : {
                    folders: Array.from(selectedFolders),
                    files: Array.from(selectedFiles)
                }}
                onMoveComplete={async (selectedFolderId) => {
                    if (movingContentsOf) {
                        try {
                            await deleteFolder(movingContentsOf.id, false);
                            Alert.alert("Success", `Folder "${movingContentsOf.name}" deleted after moving contents`);
                        } catch (err) {
                            Alert.alert("Error", "Contents moved, but failed to delete empty folder");
                        }
                    }
                    getProjectFiles(project.id, 'photo')
                        .then((data) => {
                            if (data.folderData) setFolders(data.folderData);
                            if (data.fileData) {
                                setPhotos(data.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
                            }
                        });
                    clearSelection();
                    setMovingContentsOf(null);
                }}
                type="photo"
            />

            {/* ── Full-screen viewer modal (inlined) ── */}
            <Modal visible={viewerOpen} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={closeViewer}>
                <StatusBar hidden />
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                        {/* Top bar */}
                        {showViewerUI && (
                            <View style={{
                                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingHorizontal: 16, paddingTop: Math.max(insets.top, 20), paddingBottom: 12,
                                backgroundColor: 'rgba(0,0,0,0.5)',
                            }}>
                                <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}>
                                    <Feather name="x" size={22} color="#fff" />
                                </TouchableOpacity>
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                                    {viewerIndex + 1} / {sortedPhotos.length}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <TouchableOpacity onPress={handleSharePhoto} style={{ padding: 8 }}>
                                        <Feather name="share-2" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={downloadToGallery} style={{ padding: 8 }} disabled={downloading}>
                                        {downloading
                                            ? <ActivityIndicator size="small" color={colors.primary} />
                                            : <Feather name="download" size={20} color={colors.primary} />
                                        }
                                    </TouchableOpacity>
                                    {(String(sortedPhotos[viewerIndex]?.created_by) === String(user?.id) || String(sortedPhotos[viewerIndex]?.creator?.id) === String(user?.id)) && (
                                        <TouchableOpacity onPress={handleDeletePhoto} style={{ padding: 8 }}>
                                            <Feather name="trash-2" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Photo pager */}
                        <FlatList
                            ref={flatListRef}
                            data={sortedPhotos}
                            horizontal
                            pagingEnabled
                            scrollEnabled={!isViewerZoomed}
                            showsHorizontalScrollIndicator={false}
                            removeClippedSubviews={Platform.OS === 'android'}
                            windowSize={3}
                            initialNumToRender={1}
                            maxToRenderPerBatch={1}
                            keyExtractor={(item) => item.id.toString()}
                            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
                            onMomentumScrollEnd={(e) => {
                                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                if (idx !== viewerIndex) setViewerIndex(idx);
                            }}
                            renderItem={({ item }) => {
                                const viewerHeight = SCREEN_H - insets.top - insets.bottom;
                                return (
                                    <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                        <View style={{ width: SCREEN_W, height: viewerHeight, justifyContent: 'center', alignItems: 'center' }}>
                                            <ZoomableImage
                                                uri={item.downloadUrl}
                                                width={SCREEN_W}
                                                height={viewerHeight}
                                                onZoomStateChange={setIsViewerZoomed}
                                                onTap={() => setShowViewerUI(prev => !prev)}
                                                onDismiss={closeViewer}
                                            />
                                        </View>
                                    </View>
                                );
                            }}
                        />

                        {/* Bottom panel: info + comments */}
                        {showViewerUI && (
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                                style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
                                keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
                            >
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 10 }}>
                                    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                            {sortedPhotos[viewerIndex]?.file_name || 'Photo'}
                                        </Text>

                                        {(sortedPhotos[viewerIndex]?.location || sortedPhotos[viewerIndex]?.tags) && (
                                            <View style={{ marginTop: 8, gap: 8 }}>
                                                {sortedPhotos[viewerIndex]?.location && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Feather name="map-pin" size={11} color="#f97316" />
                                                        </View>
                                                        <Text style={{ color: '#eee', fontSize: 11, fontWeight: '500' }}>{sortedPhotos[viewerIndex].location}</Text>
                                                    </View>
                                                )}

                                                {sortedPhotos[viewerIndex]?.tags && (
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Feather name="tag" size={11} color="#fff" />
                                                        </View>
                                                        {sortedPhotos[viewerIndex].tags.split(',').map((tag: string, tidx: number) => (
                                                            <View key={tidx} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{tag.trim()}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingTop: 8, maxHeight: 200 }}>
                                        <Text style={{ color: '#aaa', fontSize: 10, fontWeight: '700', marginBottom: 6 }}>
                                            💬 COMMENTS ({photoComments.length})
                                        </Text>
                                        {commentLoading ? (
                                            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 8 }} />
                                        ) : (
                                            <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                                                {photoComments.length === 0 && (
                                                    <Text style={{ color: '#666', fontSize: 10, marginBottom: 8 }}>No comments yet. Be the first!</Text>
                                                )}
                                                {photoComments.map((c: any) => (
                                                    <View key={c.id} style={{ marginBottom: 8 }}>
                                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 8 }}>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>{c.user?.name || 'User'}</Text>
                                                                <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                                                    <Text style={{ color: '#888', fontSize: 9 }}>↩ Reply</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                            <Text style={{ color: '#ddd', fontSize: 11 }}>
                                                                {renderCommentText(c.text)}
                                                            </Text>
                                                        </View>
                                                        {c.replies?.map((r: any) => (
                                                            <View key={r.id} style={{ marginLeft: 12, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 6 }}>
                                                                <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '700', marginBottom: 1 }}>{r.user?.name || 'User'}</Text>
                                                                <Text style={{ color: '#ccc', fontSize: 10 }}>
                                                                    {renderCommentText(r.text)}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        )}
                                        {replyTo && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <Text style={{ color: colors.primary, fontSize: 9 }}>Replying to comment</Text>
                                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                                    <Text style={{ color: '#888', fontSize: 9 }}>✕ Cancel</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {showMentions && (
                                            <View style={{ position: 'absolute', bottom: 50, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 1000 }}>
                                                <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="always">
                                                    {projectMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).map((m) => (
                                                        <TouchableOpacity
                                                            key={m.id}
                                                            onPress={() => handleSelectMention(m)}
                                                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                                        >
                                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                                                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{m.name.substring(0, 1).toUpperCase()}</Text>
                                                            </View>
                                                            <Text style={{ color: '#fff', fontSize: 12 }}>{m.name}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 8, marginTop: 6 }}>
                                            <TextInput
                                                value={commentText}
                                                onChangeText={handleInputChange}
                                                placeholder="Add a comment…"
                                                placeholderTextColor="#555"
                                                style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, color: '#fff', fontSize: 12 }}
                                            />
                                            <TouchableOpacity
                                                onPress={handleAddComment}
                                                disabled={addingComment || !commentText.trim()}
                                                style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                {addingComment
                                                    ? <ActivityIndicator size="small" color="#fff" />
                                                    : <Feather name="send" size={14} color="#fff" style={{ transform: [{ translateY: 1 }, { translateX: -1 }] }} />
                                                }
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {/* Safe-area spacer: covers Android nav bar (gesture or 3-button) and iOS home indicator */}
                                    <View style={{ height: Math.max(insets.bottom, 0) }} />
                                </View>
                            </KeyboardAvoidingView>
                        )}
                    </View>
                </GestureHandlerRootView>
            </Modal>

            {/* Rename Folder Modal */}
            <Modal visible={showEditFolder} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>Rename Folder</Text>
                        <TextInput
                            value={editFolderName}
                            onChangeText={setEditFolderName}
                            placeholder="Folder name"
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowEditFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? 'Updating…' : 'Update'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* File Action Menu */}
            <FileActionMenu
                isVisible={actionMenuVisible}
                onClose={() => setActionMenuVisible(false)}
                onHideUnhide={() => handleToggleVisibility(activeActionFile)}
                onDoNotFollow={() => { }}
                onDelete={() => handleDeleteFile(activeActionFile)}
                onShare={() => handleSharePhoto(activeActionFile)}
                showDoNotFollow={false}
                isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                clientVisible={activeActionFile?.client_visible !== false}
                doNotFollow={false}
                canDelete={activeActionFile && (String(activeActionFile.created_by) === String(user.id))}
                canRename={['admin', 'superadmin', 'contributor'].includes(user.role)}
                onRename={() => handleRenameFileAction(activeActionFile)}
                fileName={activeActionFile?.file_name || ''}
                processingAction={processing}
            />

            {/* Rename File Modal */}
            <Modal visible={showRenameFile} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>Rename Photo</Text>
                        <TextInput
                            value={renamingFileName}
                            onChangeText={setRenamingFileName}
                            placeholder="Photo name"
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowRenameFile(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFile} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? 'Updating…' : 'Update'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <FolderActionMenu
                isVisible={folderMenuVisible}
                onClose={() => setFolderMenuVisible(false)}
                onHideUnhide={() => handleToggleFolderVis(activeActionFolder)}
                onRename={() => handleRenameFolder(activeActionFolder)}
                onDelete={() => handleDeleteFolderAction(activeActionFolder)}
                isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                clientVisible={activeActionFolder?.client_visible !== false}
                folderName={activeActionFolder?.name || ''}
                processingAction={processing}
            />
        </View>
    );
}
