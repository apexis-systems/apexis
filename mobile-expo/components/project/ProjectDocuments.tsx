import { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Alert, Modal, Share, ScrollView, BackHandler, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles, toggleDoNotFollow } from '@/services/fileService';
import { setActiveProjectContext } from '@/utils/projectSelection';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import { WebView } from 'react-native-webview';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectDocuments({ project, user, initialFolderId }: { project: any, user: any, initialFolderId?: string }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    // View Mode: 'grid' or 'list'
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
    const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);

    // PDF Viewer state
    const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
    const [pdfViewerName, setPdfViewerName] = useState('');
    const [pdfLoading, setPdfLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const fetchFolders = async () => {
                if (!project?.id) return;
                if (folders.length === 0 && docs.length === 0) setLoading(true);
                try {
                    const data = await getProjectFiles(project.id, 'document');
                    if (data.folderData) setFolders(data.folderData);
                    if (data.fileData) {
                        setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
                    }
                } catch (error) {
                    console.error("Error fetching folders:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchFolders();
        }, [project?.id])
    );

    useEffect(() => {
        setSelectedFolder(initialFolderId || null);
    }, [initialFolderId]);

    useEffect(() => {
        if (project?.id) {
            setActiveProjectContext(project.id, selectedFolder, 'document');
        }
    }, [project?.id, selectedFolder]);


    const currentFolders = folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null'));
    const currentFolderDocs = docs.filter((d) => String(d.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
    const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.client_visible !== false) : currentFolderDocs;

    const sortItems = (items: any[], type: 'folder' | 'file') => {
        return [...items].sort((a: any, b: any) => {
            if (sortBy === 'name') {
                const nameA = type === 'folder' ? a.name : a.file_name;
                const nameB = type === 'folder' ? b.name : b.file_name;
                return (nameA || '').localeCompare(nameB || '');
            }
            if (sortBy === 'date') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'size') {
                if (type === 'folder') return (a.name || '').localeCompare(b.name || '');
                return (b.file_size_mb || 0) - (a.file_size_mb || 0);
            }
            return 0;
        });
    };

    const sortedFolders = sortItems(currentFolders, 'folder');
    const sortedDocs = sortItems(visibleDocs, 'file');

    const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

    const goBack = useCallback(() => {
        if (!selectedFolder) return;
        const parentId = currentFolder?.parent_id != null ? String(currentFolder.parent_id) : null;
        setSelectedFolder(parentId);
    }, [selectedFolder, currentFolder]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
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
        }, [isSelectionMode, selectedFolder, goBack])
    );

    const toggleDocVisibility = async (doc: any) => {
        try {
            await toggleFileVisibility(doc.id, !doc.client_visible);
            setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, client_visible: !doc.client_visible } : d)));
            Alert.alert('Updated', `Document marked ${!doc.client_visible ? 'Visible' : 'Hidden'} for clients`);
        } catch (e) {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const toggleDocDoNotFollow = async (doc: any) => {
        try {
            await toggleDoNotFollow(doc.id, !doc.do_not_follow);
            setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, do_not_follow: !doc.do_not_follow } : d)));
            Alert.alert('Updated', `Document ${!doc.do_not_follow ? 'marked' : 'unmarked'} as 'Do Not Follow'`);
        } catch (e) {
            Alert.alert('Error', 'Failed to toggle Do Not Follow');
        }
    };

    const toggleFolderVis = async (folder: any) => {
        try {
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f)));
            Alert.alert('Updated', `Folder marked ${!folder.client_visible ? 'Visible' : 'Hidden'} for clients`);
        } catch (err) {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const deleteDoc = async (docId: number) => {
        Alert.alert('Delete', 'Delete this document?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteFile(docId);
                        setDocs((prev) => prev.filter((d) => d.id !== docId));
                    } catch (err) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            },
        ]);
    };

    // Open doc: PDF → in-app viewer, everything else → external browser
    const openDoc = (doc: any) => {
        const isPdf = doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf');
        if (isPdf && doc.downloadUrl) {
            // Use Google Docs viewer for reliable cross-platform PDF rendering
            const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(doc.downloadUrl)}`;
            setPdfViewerName(doc.file_name || 'Document');
            setPdfViewerUrl(viewerUrl);
        } else {
            WebBrowser.openBrowserAsync(doc.downloadUrl);
        }
    };

    const handleShare = async (doc: any) => {
        try {
            if (!doc.downloadUrl) return;

            // For files, we download to cache then share the local URI
            const ext = doc.file_name?.split('.').pop() || 'tmp';
            const localUri = `${(FileSystem as any).cacheDirectory}${doc.file_name || `file_${Date.now()}.${ext}`}`;

            Alert.alert("Preparing...", "Downloading file to share...");
            const { uri } = await FileSystem.downloadAsync(doc.downloadUrl, localUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: doc.file_type,
                    dialogTitle: doc.file_name,
                    UTI: doc.file_type // iOS specific
                });
            } else {
                // Fallback to link sharing if system sharing is unavailable
                await Share.share({
                    title: doc.file_name,
                    message: `${doc.file_name}\n${doc.downloadUrl}`,
                    url: doc.downloadUrl,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert("Error", "Failed to share file");
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmitting(true);
        try {
            const data = await createFolder({
                project_id: project.id,
                name: newFolderName.trim(),
                parent_id: selectedFolder,
                folder_type: 'document'
            });
            if (data.folder) {
                setFolders([...folders, data.folder]);
                setSelectedFolder(String(data.folder.id));
                setShowCreateFolder(false);
                setNewFolderName('');
            }
        } catch (error) {
            console.error("Failed to create folder:", error);
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setSubmitting(false);
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
            const data = await getProjectFiles(project.id, 'document');
            if (data.folderData) setFolders(data.folderData);
            if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
            clearSelection();
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
        }
    };

    const handleBulkDoNotFollow = async (value: boolean) => {
        try {
            if (selectedFiles.size > 0) {
                await bulkUpdateFiles({ ids: Array.from(selectedFiles), do_not_follow: value });
                Alert.alert("Success", "'Do Not Follow' status updated");
                // Refresh
                const data = await getProjectFiles(project.id);
                if (data.folderData) setFolders(data.folderData);
                if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
                clearSelection();
            }
        } catch (e) {
            Alert.alert("Error", "Failed to update 'Do Not Follow' status");
        }
    };

    const handleBulkShare = async () => {
        if (selectedFiles.size > 0) {
            const firstId = Array.from(selectedFiles)[0];
            const firstDoc = docs.find(d => d.id === firstId);
            if (firstDoc) handleShare(firstDoc);
        } else {
            Alert.alert("Info", "Select at least one file to share");
        }
    };

    // Unified View
    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder || ''}`)}
                            style={{
                                flex: 1,
                                height: 38,
                                borderRadius: 10,
                                backgroundColor: colors.primary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                            }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload File</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{
                                height: 38,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                                paddingHorizontal: 12,
                            }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>New Folder</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    {currentFolder && (
                        <TouchableOpacity onPress={goBack} style={{ padding: 6, borderRadius: 20 }}>
                            <Feather name="arrow-left" size={16} color={colors.text} />
                        </TouchableOpacity>
                    )}
                    <Feather name="folder" size={16} color={colors.primary} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={(() => setSelectedFolder(null))}>
                                <View style={{ paddingVertical: 4 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedFolder ? colors.primary : colors.textMuted }}>
                                        {project?.name}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            {getBreadcrumbs().map((b) => (
                                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginHorizontal: 4 }}>/</Text>
                                    <TouchableOpacity onPress={(() => setSelectedFolder(b.id))}>
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


                    {visibleDocs.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Feather name={viewMode === 'grid' ? 'list' : 'grid'} size={16} color={colors.text} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            const next: any = sortBy === 'name' ? 'date' : sortBy === 'date' ? 'size' : 'name';
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

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {sortedFolders.map((folder) => {
                        const count = docs.filter((d) => d.folder_id === folder.id).length;
                        const subcount = folders.filter((f) => f.parent_id === folder.id).length;
                        const isSelected = selectedFolders.has(folder.id);
                        return (
                            <View
                                key={folder.id}
                                style={{
                                    width: '31.5%',
                                    aspectRatio: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 16,
                                    backgroundColor: isSelected ? 'rgba(249,115,22,0.08)' : colors.surface,
                                    borderWidth: 1,
                                    borderColor: isSelected ? colors.primary : colors.border,
                                    padding: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 1,
                                    position: 'relative',
                                    overflow: 'hidden'
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
                                    <Feather name="folder" size={36} color={colors.primary} />
                                </View>
                                {isSelected && (
                                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.primary, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                        <Feather name="check" size={10} color="#fff" />
                                    </View>
                                )}
                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{folder.name}</Text>
                                <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>{count} files{subcount > 0 ? ` · ${subcount} folders` : ''}</Text>
                                {(user.role === 'admin' || user.role === 'superadmin') && !isSelectionMode && (
                                    <TouchableOpacity
                                        onPress={() => toggleFolderVis(folder)}
                                        style={{ position: 'absolute', bottom: 6, right: 6, padding: 4, zIndex: 10 }}
                                    >
                                        <Feather name={folder.client_visible !== false ? 'eye' : 'eye-off'} size={12} color={folder.client_visible !== false ? colors.primary : colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>

                {!loading && currentFolders.length === 0 && visibleDocs.length === 0 && (
                    <View style={{ marginTop: 20, marginBottom: 10, alignItems: 'center' }}>
                        <Feather name="folder" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders or documents yet</Text>
                    </View>
                )}

                <View style={{ flexDirection: viewMode === 'grid' ? 'row' : 'column', flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap', gap: viewMode === 'grid' ? 6 : 8, marginTop: sortedFolders.length > 0 ? 12 : 0 }}>
                    {sortedDocs.map((doc) => {
                        const isSelected = selectedFiles.has(doc.id);
                        if (viewMode === 'grid') {
                            return (
                                <View
                                    key={doc.id}
                                    style={{
                                        width: '23%',
                                        aspectRatio: 1,
                                        backgroundColor: isSelected ? 'rgba(249,115,22,0.1)' : colors.surface,
                                        borderRadius: 10,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: isSelected ? colors.primary : colors.border,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 8,
                                        position: 'relative'
                                    }}
                                >
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (isSelectionMode) toggleSelection('file', doc.id);
                                            else openDoc(doc);
                                        }}
                                        onLongPress={() => handleLongPress('file', doc.id)}
                                        style={{
                                            ...StyleSheet.absoluteFillObject,
                                            zIndex: 5,
                                        }}
                                    />
                                    <Feather name="file-text" size={32} color={doc.file_type.includes('pdf') ? '#ef4444' : '#3b82f6'} style={{ marginBottom: 12 }} />
                                    {isSelected && (
                                        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary, borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
                                            <Feather name="check" size={10} color="#fff" />
                                        </View>
                                    )}
                                    <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{doc.file_name}</Text>
                                    <View style={{ position: 'absolute', top: 2, right: 2, flexDirection: 'column', gap: 2, zIndex: 30 }}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity onPress={() => handleShare(doc)} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 }}>
                                                    <Feather name="share-2" size={9} color="#fff" />
                                                </TouchableOpacity>
                                                {(user.role === 'admin' || user.role === 'superadmin') && (
                                                    <>
                                                        <TouchableOpacity onPress={() => toggleDocVisibility(doc)} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 }}>
                                                            <Feather name={doc.client_visible !== false ? 'eye' : 'eye-off'} size={9} color={doc.client_visible !== false ? colors.primary : "#fff"} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => toggleDocDoNotFollow(doc)} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 }}>
                                                            <Feather name="shield" size={9} color={doc.do_not_follow ? '#ef4444' : "#fff"} />
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                                {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (String(doc.created_by) === String(user.id) || String(doc.creator?.id) === String(user.id)) && (
                                                    <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 }}>
                                                        <Feather name="trash-2" size={9} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {doc.do_not_follow && (
                                        <View style={{
                                            position: 'absolute',
                                            top: '30%',
                                            left: '20%',
                                            right: '20%',
                                            backgroundColor: 'rgba(239, 68, 68, 0.9)',
                                            borderRadius: 4,
                                            paddingHorizontal: 4,
                                            paddingVertical: 2,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 20,
                                            transform: [{ rotate: '-10deg' }]
                                        }}>
                                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>DNF</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        } else {
                            return (
                                <View
                                    key={doc.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderRadius: 10,
                                        backgroundColor: isSelected ? 'rgba(249,115,22,0.1)' : colors.background,
                                        borderWidth: 1,
                                        borderColor: isSelected ? colors.primary : colors.border,
                                        padding: 10,
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (isSelectionMode) toggleSelection('file', doc.id);
                                            else openDoc(doc);
                                        }}
                                        onLongPress={() => handleLongPress('file', doc.id)}
                                        style={{
                                            ...StyleSheet.absoluteFillObject,
                                            zIndex: 5,
                                        }}
                                    />
                                    <View
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 8,
                                            backgroundColor: doc.file_type.includes('pdf') ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Feather name="file-text" size={16} color={doc.file_type.includes('pdf') ? '#ef4444' : '#3b82f6'} />
                                    </View>
                                    {isSelected && (
                                        <View style={{ position: 'absolute', top: -5, left: -5, backgroundColor: colors.primary, borderRadius: 12, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                            <Feather name="check" size={10} color="#fff" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, marginRight: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: colors.text, flexShrink: 1 }}>{doc.file_name}</Text>
                                            {doc.do_not_follow && (
                                                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                    <Feather name="shield" size={8} color="#ef4444" />
                                                    <Text style={{ fontSize: 7, fontWeight: '800', color: '#ef4444' }}>DNF</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={{ fontSize: 9, color: colors.textMuted }}>{doc.file_size_mb} MB</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', zIndex: 10 }}>
                                        {!isSelectionMode && (
                                            <>
                                                <TouchableOpacity onPress={() => handleShare(doc)} style={{ padding: 4 }}>
                                                    <Feather name="share-2" size={14} color="#666" />
                                                </TouchableOpacity>
                                                {(user.role === 'admin' || user.role === 'superadmin') && (
                                                    <>
                                                        <TouchableOpacity onPress={() => toggleDocVisibility(doc)} style={{ padding: 4 }}>
                                                            <Feather name={doc.client_visible !== false ? 'eye' : 'eye-off'} size={14} color={doc.client_visible !== false ? colors.primary : colors.textMuted} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => toggleDocDoNotFollow(doc)} style={{ padding: 4 }}>
                                                            <Feather name="shield" size={14} color={doc.do_not_follow ? '#ef4444' : colors.textMuted} />
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') && String(doc.created_by) === String(user.id) && (
                                                    <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ padding: 4 }}>
                                                        <Feather name="trash-2" size={14} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        }
                    })}
                </View>

                {sortedDocs.length === 0 && sortedFolders.length > 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="file-text" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No documents yet</Text>
                    </View>
                )}
            </ScrollView>

            {/* ── PDF Viewer Modal ── */}
            <Modal
                visible={!!pdfViewerUrl}
                transparent={false}
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setPdfViewerUrl(null)}
            >
                <StatusBar hidden />
                <View style={{ flex: 1, backgroundColor: '#111' }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingTop: Platform.OS === 'android' ? 40 : 52,
                        paddingBottom: 12,
                        backgroundColor: '#1a1a1a',
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(255,255,255,0.08)',
                    }}>
                        <TouchableOpacity
                            onPress={() => setPdfViewerUrl(null)}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >
                            <Feather name="x" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text numberOfLines={1} style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', marginHorizontal: 12 }}>
                            {pdfViewerName}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    const doc = docs.find(d => d.file_name === pdfViewerName);
                                    if (doc) handleShare(doc);
                                }}
                                style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <Feather name="share-2" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* WebView PDF */}
                    {pdfViewerUrl && (
                        <WebView
                            key={pdfViewerUrl}
                            source={{ uri: pdfViewerUrl }}
                            style={{ flex: 1, backgroundColor: '#111' }}
                            startInLoadingState
                            scalesPageToFit
                            allowsInlineMediaPlayback
                            javaScriptEnabled
                            domStorageEnabled
                            onLoadStart={() => setPdfLoading(true)}
                            onLoadEnd={() => setPdfLoading(false)}
                            renderLoading={() => (
                                <View style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    justifyContent: 'center', alignItems: 'center', backgroundColor: '#111'
                                }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 12 }}>Loading PDF…</Text>
                                </View>
                            )}
                        />
                    )}
                </View>
            </Modal>

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
                    <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                        <TouchableOpacity onPress={handleBulkShare} style={{ padding: 4 }}>
                            <Feather name="share-2" size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setMovingItem(null); setShowMoveDialog(true); }} style={{ padding: 4 }}>
                            <Feather name="move" size={18} color={colors.primary} />
                        </TouchableOpacity>
                        {user.role === 'admin' && (
                            <>
                                <View style={{ height: 20, width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
                                <TouchableOpacity onPress={() => handleBulkVisibility(true)} style={{ padding: 4 }}>
                                    <Feather name="eye" size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleBulkVisibility(false)} style={{ padding: 4 }}>
                                    <Feather name="eye-off" size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <View style={{ height: 20, width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
                                <TouchableOpacity onPress={() => handleBulkDoNotFollow(true)} style={{ padding: 4 }}>
                                    <Feather name="shield" size={18} color="#ef4444" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleBulkDoNotFollow(false)} style={{ padding: 4 }}>
                                    <Feather name="shield-off" size={18} color={colors.primary} />
                                </TouchableOpacity>
                            </>
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
                onMoveComplete={async () => {
                    const data = await getProjectFiles(project.id, 'document');
                    if (data.folderData) setFolders(data.folderData);
                    if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
                    clearSelection();
                }}
                type="document"
            />
        </View>
    );
}
