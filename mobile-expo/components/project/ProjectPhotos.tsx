import {
    View, Text, TouchableOpacity, Alert, Modal, Share,
    TextInput, Image, FlatList, Dimensions, StatusBar,
    ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles } from '@/services/fileService';
import { getComments, addComment as addCommentApi, type CommentThread } from '@/services/commentService';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { setActiveProjectContext } from '@/utils/projectSelection';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectPhotos({ project, user, initialFolderId }: { project: any; user: any; initialFolderId?: string }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // View Mode: 'grid' or 'list'
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
    const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);

    // Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Comment state
    const [photoComments, setPhotoComments] = useState<CommentThread[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (!project?.id) return;
            if (folders.length === 0 && photos.length === 0) setLoading(true);
            getProjectFiles(project.id)
                .then((data) => {
                    if (data.folderData) setFolders(data.folderData);
                    if (data.fileData) {
                        setPhotos(data.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
                    }
                })
                .catch((e) => console.error('fetchFiles', e))
                .finally(() => setLoading(false));

            // cleanup function placeholder if needed for focus blur
            return () => { };
        }, [project?.id])
    );

    useEffect(() => {
        if (initialFolderId !== undefined) {
            setSelectedFolder(initialFolderId || null);
        }
    }, [initialFolderId]);

    useEffect(() => {
        if (project?.id) {
            setActiveProjectContext(project.id, selectedFolder);
        }
    }, [project?.id, selectedFolder]);

    const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
    const currentFolderPhotos = photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
    const visiblePhotos = user.role === 'client'
        ? currentFolderPhotos.filter((p) => p.client_visible !== false)
        : currentFolderPhotos;
    const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

    const goBack = () => {
        if (!selectedFolder) return;
        const parentId = currentFolder?.parent_id != null ? String(currentFolder.parent_id) : null;
        setSelectedFolder(parentId);
    };

    // ── Viewer helpers ────────────────────────────────────────────────────────

    // ── Scroll viewer to correct index when opened ──────────────────────────
    useEffect(() => {
        if (viewerOpen) {
            // Small delay to ensure FlatList is mounted
            const t = setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
            }, 50);
            return () => clearTimeout(t);
        }
    }, [viewerOpen]);

    // ── Reload comments when swiping to a new photo ───────────────────────────
    useEffect(() => {
        if (viewerOpen && visiblePhotos[viewerIndex]?.id) {
            loadComments(visiblePhotos[viewerIndex].id);
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

    const handleAddComment = async () => {
        const photo = visiblePhotos[viewerIndex];
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
        setViewerOpen(true);
    };

    const closeViewer = () => setViewerOpen(false);

    const goNext = () => {
        const next = Math.min(viewerIndex + 1, visiblePhotos.length - 1);
        setViewerIndex(next);
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
    };

    const goPrev = () => {
        const prev = Math.max(viewerIndex - 1, 0);
        setViewerIndex(prev);
        flatListRef.current?.scrollToIndex({ index: prev, animated: true });
    };

    const handleSharePhoto = async () => {
        const photo = visiblePhotos[viewerIndex];
        if (!photo?.downloadUrl) return;
        try {
            await Share.share({
                title: photo.file_name || 'Site Photo',
                message: `${photo.file_name || 'Site Photo'}\n${photo.downloadUrl}`,
                url: photo.downloadUrl, // iOS only
            });
        } catch (e) {
            console.error('Share error:', e);
        }
    };

    const downloadToGallery = async () => {
        const photo = visiblePhotos[viewerIndex];
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
        confirmDeletePhoto(visiblePhotos[viewerIndex]);
    };

    // ── Toggle helpers ────────────────────────────────────────────────────────

    const togglePhotoVisibility = async (photo: any) => {
        try {
            await toggleFileVisibility(photo.id, !photo.client_visible);
            setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, client_visible: !photo.client_visible } : p));
        } catch {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const toggleFolderVis = async (folder: any) => {
        try {
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            setFolders((prev) => prev.map((f) => f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f));
        } catch {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmitting(true);
        try {
            const data = await createFolder({ project_id: project.id, name: newFolderName.trim(), parent_id: selectedFolder, type: 'photos' });
            if (data.folder) {
                setFolders([...folders, data.folder]);
                setSelectedFolder(String(data.folder.id));
                setShowCreateFolder(false);
                setNewFolderName('');
            }
        } catch {
            Alert.alert('Error', 'Failed to create folder');
        } finally {
            setSubmitting(false);
        }
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
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') {
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
            getProjectFiles(project.id)
                .then((data) => {
                    if (data.folderData) setFolders(data.folderData);
                    if (data.fileData) {
                        setPhotos(data.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
                    }
                });
            clearSelection();
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
        }
    };

    const handleBulkShare = async () => {
        if (selectedFiles.size > 0) {
            const firstId = Array.from(selectedFiles)[0];
            const firstPhoto = photos.find(p => p.id === firstId);
            if (firstPhoto) {
                try {
                    await Share.share({
                        title: firstPhoto.file_name,
                        message: `${firstPhoto.file_name}\n${firstPhoto.downloadUrl}`,
                        url: firstPhoto.downloadUrl,
                    });
                } catch (e) { }
            }
        } else {
            Alert.alert("Info", "Select at least one photo to share");
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
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder || ''}`)}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
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
                )}

                {loading ? (
                    <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
                ) : (
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            {currentFolder && (
                                <TouchableOpacity onPress={goBack} style={{ padding: 6, borderRadius: 20 }}>
                                    <Feather name="arrow-left" size={16} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            <Feather name="folder" size={16} color="#f97316" />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => setSelectedFolder(null)}>
                                        <View style={{ paddingVertical: 4 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedFolder ? '#f97316' : colors.textMuted }}>
                                                {project?.name}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    {getBreadcrumbs().map((b) => (
                                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: colors.textMuted, marginHorizontal: 4 }}>/</Text>
                                            <TouchableOpacity onPress={() => setSelectedFolder(b.id)}>
                                                <View style={{ paddingVertical: 4 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedFolder === b.id ? '#f97316' : colors.textMuted }}>
                                                        {b.name}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* View Mode Toggle */}
                            <TouchableOpacity
                                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                            >
                                <Feather name={viewMode === 'grid' ? 'list' : 'grid'} size={16} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {currentFolders.map((folder) => {
                                const count = photos.filter((p) => p.folder_id === folder.id).length;
                                const subcount = folders.filter((f) => f.parent_id === folder.id).length;
                                const isSelected = selectedFolders.has(folder.id);
                                return (
                                    <TouchableOpacity
                                        key={folder.id}
                                        onPress={() => {
                                            if (isSelectionMode) toggleSelection('folder', folder.id);
                                            else setSelectedFolder(folder.id);
                                        }}
                                        onLongPress={() => handleLongPress('folder', folder.id)}
                                        style={{
                                            width: '31.5%',
                                            aspectRatio: 1,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 16,
                                            backgroundColor: isSelected ? 'rgba(249,115,22,0.08)' : colors.surface,
                                            borderWidth: 1,
                                            borderColor: isSelected ? '#f97316' : colors.border,
                                            padding: 12,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 4,
                                            elevation: 1,
                                        }}
                                    >
                                        <View style={{ marginBottom: 8 }}>
                                            <Feather name="folder" size={36} color="#f97316" />
                                        </View>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#f97316', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{folder.name}</Text>
                                        <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>
                                            {count} photos{subcount > 0 ? ` · ${subcount} folders` : ''}
                                        </Text>

                                        {(user.role === 'admin' || user.role === 'superadmin') && !isSelectionMode && (
                                            <TouchableOpacity
                                                onPress={(e) => { e.stopPropagation(); toggleFolderVis(folder); }}
                                                style={{ position: 'absolute', bottom: 6, right: 6, padding: 4 }}
                                            >
                                                <Feather name={folder.client_visible !== false ? 'eye' : 'eye-off'} size={12} color={folder.client_visible !== false ? '#f97316' : colors.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
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

                <View style={{ flexDirection: viewMode === 'grid' ? 'row' : 'column', flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap', gap: viewMode === 'grid' ? 6 : 8, marginTop: currentFolders.length > 0 ? 12 : 0 }}>
                    {visiblePhotos.map((photo, index) => {
                        const isSelected = selectedFiles.has(photo.id);
                        if (viewMode === 'grid') {
                            return (
                                <TouchableOpacity
                                    key={photo.id}
                                    onPress={() => {
                                        if (isSelectionMode) toggleSelection('file', photo.id);
                                        else openViewer(index);
                                    }}
                                    onLongPress={() => handleLongPress('file', photo.id)}
                                    style={{
                                        width: '23%',
                                        aspectRatio: 1,
                                        backgroundColor: isSelected ? 'rgba(249,115,22,0.1)' : colors.surface,
                                        borderRadius: 10,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: isSelected ? '#f97316' : colors.border
                                    }}
                                >
                                    <Image source={{ uri: photo.downloadUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    {isSelected && (
                                        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#f97316', borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name="check" size={10} color="#fff" />
                                        </View>
                                    )}
                                    <View style={{ position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 4 }}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity
                                                    onPress={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await Share.share({
                                                                title: photo.file_name || 'Site Photo',
                                                                message: `${photo.file_name || 'Site Photo'}\n${photo.downloadUrl}`,
                                                                url: photo.downloadUrl,
                                                            });
                                                        } catch { }
                                                    }}
                                                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                                                >
                                                    <Feather name="share-2" size={12} color="#fff" />
                                                </TouchableOpacity>
                                                {(user.role === 'admin' || user.role === 'superadmin') && (
                                                    <TouchableOpacity
                                                        onPress={(e) => { e.stopPropagation(); togglePhotoVisibility(photo); }}
                                                        style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                                                    >
                                                        <Feather name={photo.client_visible !== false ? 'eye' : 'eye-off'} size={12} color={photo.client_visible !== false ? '#f97316' : '#fff'} />
                                                    </TouchableOpacity>
                                                )}
                                                {(String(photo.created_by) === String(user.id) || String(photo.creator?.id) === String(user.id)) && (
                                                    <TouchableOpacity
                                                        onPress={(e) => { e.stopPropagation(); confirmDeletePhoto(photo); }}
                                                        style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                                                    >
                                                        <Feather name="trash-2" size={12} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {/* Filename overlay at bottom */}
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, paddingHorizontal: 6 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 9, color: '#fff', textAlign: 'center' }}>{photo.file_name}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        } else {
                            // List View Mode
                            return (
                                <TouchableOpacity
                                    key={photo.id}
                                    onPress={() => {
                                        if (isSelectionMode) toggleSelection('file', photo.id);
                                        else openViewer(index);
                                    }}
                                    onLongPress={() => handleLongPress('file', photo.id)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                        borderRadius: 12,
                                        backgroundColor: isSelected ? 'rgba(249,115,22,0.1)' : colors.background,
                                        borderWidth: 1,
                                        borderColor: isSelected ? '#f97316' : colors.border,
                                        padding: 10,
                                    }}
                                >
                                    <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface }}>
                                        <Image source={{ uri: photo.downloadUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    </View>
                                    {isSelected && (
                                        <View style={{ position: 'absolute', top: -5, left: -5, backgroundColor: '#f97316', borderRadius: 12, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                            <Feather name="check" size={10} color="#fff" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{photo.file_name}</Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{photo.file_size_mb} MB</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity
                                                    onPress={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await Share.share({
                                                                title: photo.file_name || 'Site Photo',
                                                                message: `${photo.file_name || 'Site Photo'}\n${photo.downloadUrl}`,
                                                                url: photo.downloadUrl,
                                                            });
                                                        } catch { }
                                                    }}
                                                    style={{ padding: 6 }}
                                                >
                                                    <Feather name="share-2" size={16} color="#666" />
                                                </TouchableOpacity>
                                                {(user.role === 'admin' || user.role === 'superadmin') && (
                                                    <TouchableOpacity
                                                        onPress={(e) => { e.stopPropagation(); togglePhotoVisibility(photo); }}
                                                        style={{ padding: 6 }}
                                                    >
                                                        <Feather name={photo.client_visible !== false ? 'eye' : 'eye-off'} size={16} color={photo.client_visible !== false ? '#f97316' : colors.textMuted} />
                                                    </TouchableOpacity>
                                                )}
                                                {(String(photo.created_by) === String(user.id) || String(photo.creator?.id) === String(user.id)) && (
                                                    <TouchableOpacity
                                                        onPress={(e) => { e.stopPropagation(); confirmDeletePhoto(photo); }}
                                                        style={{ padding: 6 }}
                                                    >
                                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }
                    })}
                </View>

                {visiblePhotos.length === 0 && currentFolders.length > 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="camera" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No photos yet</Text>
                    </View>
                )}
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
                            <TouchableOpacity onPress={handleCreateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? 'Creating…' : 'Create'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Bulk Action Bar */}
            {isSelectionMode && (selectedFolders.size > 0 || selectedFiles.size > 0) && (
                <View style={{
                    position: 'absolute',
                    bottom: 15,
                    left: 20,
                    right: 20,
                    backgroundColor: colors.surface,
                    borderRadius: 35,
                    height: 64,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    zIndex: 1000,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <TouchableOpacity onPress={clearSelection} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="x" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{selectedFolders.size + selectedFiles.size} selected</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 20 }}>
                        <TouchableOpacity onPress={handleBulkShare} style={{ padding: 4 }}>
                            <Feather name="share-2" size={20} color="#f97316" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setMovingItem(null); setShowMoveDialog(true); }} style={{ padding: 4 }}>
                            <Feather name="move" size={20} color="#f97316" />
                        </TouchableOpacity>
                        {user.role === 'admin' && (
                            <View style={{ flexDirection: 'row', gap: 20 }}>
                                <TouchableOpacity onPress={() => handleBulkVisibility(true)} style={{ padding: 4 }}>
                                    <Feather name="eye" size={20} color="#f97316" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleBulkVisibility(false)} style={{ padding: 4 }}>
                                    <Feather name="eye-off" size={20} color="#f97316" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            )}

            <MobileMoveToFolderDialog
                visible={showMoveDialog}
                onClose={() => setShowMoveDialog(false)}
                project={project}
                item={movingItem}
                selectedItems={{ folders: Array.from(selectedFolders), files: Array.from(selectedFiles) }}
                onMoveComplete={() => {
                    getProjectFiles(project.id)
                        .then((data) => {
                            if (data.folderData) setFolders(data.folderData);
                            if (data.fileData) {
                                setPhotos(data.fileData.filter((file: any) => file.file_type?.startsWith('image/')));
                            }
                        });
                    clearSelection();
                }}
            />

            {/* ── Full-screen viewer modal (inlined) ── */}
            <Modal visible={viewerOpen} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={closeViewer}>
                <StatusBar hidden />
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {/* Top bar */}
                    <View style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                    }}>
                        <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}>
                            <Feather name="x" size={22} color="#fff" />
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                            {viewerIndex + 1} / {visiblePhotos.length}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={handleSharePhoto} style={{ padding: 8 }}>
                                <Feather name="share-2" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={downloadToGallery} style={{ padding: 8 }} disabled={downloading}>
                                {downloading
                                    ? <ActivityIndicator size="small" color="#f97316" />
                                    : <Feather name="download" size={20} color="#f97316" />
                                }
                            </TouchableOpacity>
                            {(String(visiblePhotos[viewerIndex]?.created_by) === String(user?.id) || String(visiblePhotos[viewerIndex]?.creator?.id) === String(user?.id)) && (
                                <TouchableOpacity onPress={handleDeletePhoto} style={{ padding: 8 }}>
                                    <Feather name="trash-2" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Photo pager */}
                    <FlatList
                        ref={flatListRef}
                        data={visiblePhotos}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.id.toString()}
                        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                            if (idx !== viewerIndex) setViewerIndex(idx);
                        }}
                        renderItem={({ item }) => (
                            <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
                                <Image
                                    source={{ uri: item.downloadUrl }}
                                    style={{ width: SCREEN_W, height: SCREEN_H }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                    />

                    {/* Prev / Next arrows */}
                    {viewerIndex > 0 && (
                        <TouchableOpacity
                            onPress={goPrev}
                            style={{ position: 'absolute', left: 12, top: '50%', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24, padding: 10 }}
                        >
                            <Feather name="chevron-left" size={26} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {viewerIndex < visiblePhotos.length - 1 && (
                        <TouchableOpacity
                            onPress={goNext}
                            style={{ position: 'absolute', right: 12, top: '50%', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24, padding: 10 }}
                        >
                            <Feather name="chevron-right" size={26} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {/* Bottom panel: info + comments */}
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
                    >
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 10 }}>
                            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                                    {visiblePhotos[viewerIndex]?.file_name || 'Photo'}
                                </Text>
                                {visiblePhotos[viewerIndex]?.location
                                    ? <Text style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>📍 {visiblePhotos[viewerIndex].location}</Text>
                                    : null
                                }
                            </View>

                            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingTop: 8, maxHeight: 200 }}>
                                <Text style={{ color: '#aaa', fontSize: 10, fontWeight: '700', marginBottom: 6 }}>
                                    💬 COMMENTS ({photoComments.length})
                                </Text>
                                {commentLoading ? (
                                    <ActivityIndicator size="small" color="#f97316" style={{ marginBottom: 8 }} />
                                ) : (
                                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                                        {photoComments.length === 0 && (
                                            <Text style={{ color: '#666', fontSize: 10, marginBottom: 8 }}>No comments yet. Be the first!</Text>
                                        )}
                                        {photoComments.map((c: any) => (
                                            <View key={c.id} style={{ marginBottom: 8 }}>
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 8 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                        <Text style={{ color: '#f97316', fontSize: 10, fontWeight: '700' }}>{c.user?.name || 'User'}</Text>
                                                        <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                                            <Text style={{ color: '#888', fontSize: 9 }}>↩ Reply</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <Text style={{ color: '#ddd', fontSize: 11 }}>{c.text}</Text>
                                                </View>
                                                {c.replies?.map((r: any) => (
                                                    <View key={r.id} style={{ marginLeft: 12, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 6 }}>
                                                        <Text style={{ color: '#f97316', fontSize: 9, fontWeight: '700', marginBottom: 1 }}>{r.user?.name || 'User'}</Text>
                                                        <Text style={{ color: '#ccc', fontSize: 10 }}>{r.text}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                                {replyTo && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Text style={{ color: '#f97316', fontSize: 9 }}>Replying to comment</Text>
                                        <TouchableOpacity onPress={() => setReplyTo(null)}>
                                            <Text style={{ color: '#888', fontSize: 9 }}>✕ Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 16 : 32, marginTop: 6 }}>
                                    <TextInput
                                        value={commentText}
                                        onChangeText={setCommentText}
                                        placeholder="Add a comment…"
                                        placeholderTextColor="#555"
                                        style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, color: '#fff', fontSize: 12 }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleAddComment}
                                        disabled={addingComment || !commentText.trim()}
                                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {addingComment
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <Feather name="send" size={14} color="#fff" />
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}
