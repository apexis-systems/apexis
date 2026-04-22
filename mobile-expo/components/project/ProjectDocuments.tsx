import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { View, TouchableOpacity, Alert, Modal, Share, ScrollView, BackHandler, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, RefreshControl } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles, toggleDoNotFollow, updateFile, archiveFile, unarchiveFile } from '@/services/fileService';
import { setActiveProjectContext } from '@/utils/projectSelection';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { WebView } from 'react-native-webview';

// Detect if we are running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Safe require for native PDF to prevent crashing Expo Go
let Pdf: any = null;
if (!isExpoGo) {
    try {
        Pdf = require('react-native-pdf').default;
    } catch (e) {
        // Fallback handled in UI
    }
}
import { formatFileSize } from '@/helpers/format';
import { groupItemsByMonth } from '@/helpers/grouping';
import * as ScreenCapture from 'expo-screen-capture';
import FileActionMenu from './FileActionMenu';
import FolderActionMenu from './FolderActionMenu';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectDocuments({ project, user, initialFolderId, initialFileId }: { project: any, user: any, initialFolderId?: string, initialFileId?: string }) {
    const { colors, isDark } = useTheme();

    const { isScreenCaptureProtected } = useAuth();
    useFocusEffect(
        useCallback(() => {
                if (isScreenCaptureProtected) {
                ScreenCapture.preventScreenCaptureAsync('docs-section');
                    }
            return () => {
                ScreenCapture.allowScreenCaptureAsync('docs-section');
            };
        }, [isScreenCaptureProtected])
    );

    const router = useRouter();
    const [docs, setDocs] = useState<any[]>([]);
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
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showEditFolder, setShowEditFolder] = useState(false);
    const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    // View Mode: 'grid' or 'list'
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest' | 'size'>('name');

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFolders, setSelectedFolders] = useState<Set<string | number>>(new Set());
    const [selectedFiles, setSelectedFiles] = useState<Set<string | number>>(new Set());
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [movingItem, setMovingItem] = useState<{ type: 'file' | 'folder', id: string | number } | null>(null);
    const [movingContentsOf, setMovingContentsOf] = useState<any | null>(null);

    // PDF Viewer state
    const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
    const [pdfViewerName, setPdfViewerName] = useState('');
    const [currentDoc, setCurrentDoc] = useState<any | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [sharing, setSharing] = useState(false);

    const [refreshing, setRefreshing] = useState(false);

    // Action Menu state
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [activeActionFile, setActiveActionFile] = useState<any>(null);
    const [folderMenuVisible, setFolderMenuVisible] = useState(false);
    const [activeActionFolder, setActiveActionFolder] = useState<any>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const [showRenameFile, setShowRenameFile] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState<number | null>(null);
    const [renamingFileName, setRenamingFileName] = useState('');
    const [isUnarchiving, setIsUnarchiving] = useState(false);

    const fetchFolders = async (isRefetch = false) => {
        if (!project?.id) return;
        if (!isRefetch && folders.length === 0 && docs.length === 0) setLoading(true);
        try {
            const data = await getProjectFiles(project.id, 'document');
            if (data.folderData) setFolders(data.folderData);
            if (data.fileData) {
                setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
            }
        } catch (error) {
            console.error("Error fetching folders:", error);
        } finally {
            if (!isRefetch) setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchFolders();
        }, [project?.id])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchFolders(true);
        setRefreshing(false);
    };

    useEffect(() => {
        setSelectedFolder(initialFolderId || null);
    }, [initialFolderId]);

    useEffect(() => {
        if (project?.id) {
            setActiveProjectContext(project.id, selectedFolder, 'document');
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
        if (initialFileId && docs.length > 0) {
            const currentFolderDocsForInit = docs.filter((d) => String(d.folder_id ?? 'null') === String(selectedFolder ?? 'null'));
            const visibleDocsInit = user.role === 'client' ? currentFolderDocsForInit.filter((d) => d.client_visible !== false) : currentFolderDocsForInit;
            const sortedInit = [...visibleDocsInit].sort((a: any, b: any) => {
                if (sortBy === 'name') return (a.file_name || '').localeCompare(b.file_name || '');
                if (sortBy === 'newest') return new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime();
                if (sortBy === 'oldest') return new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime();
                if (sortBy === 'size') return (b.file_size_mb || 0) - (a.file_size_mb || 0);
                return 0;
            });

            const index = sortedInit.findIndex(d => String(d.id) === String(initialFileId));
            if (index !== -1) {
                openDoc(sortedInit[index]);
                router.setParams({ fileId: undefined, documentId: undefined });
            }
        }
    }, [initialFileId, docs, selectedFolder, sortBy, user.role, router]);


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

    const handleToggleVisibility = async (file: any) => {
        try {
            setProcessing('visibility');
            await toggleFileVisibility(file.id, !file.client_visible);
            
            // Local update for immediate feedback
            setDocs((prev) => prev.map((d) => (d.id === file.id ? { ...d, client_visible: !file.client_visible } : d)));
            
            setActionMenuVisible(false);
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
            await fetchFolders(true); // Sync back on error
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleDoNotFollow = async (file: any) => {
        try {
            setProcessing('dnf');
            await toggleDoNotFollow(file.id, !file.do_not_follow);
            
            // Local update
            setDocs((prev) => prev.map((d) => (d.id === file.id ? { ...d, do_not_follow: !file.do_not_follow } : d)));
            
            setActionMenuVisible(false);
        } catch (e) {
            Alert.alert("Error", "Failed to update 'Do Not Follow' status");
            await fetchFolders(true);
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleFolderVis = async (folder: any) => {
        try {
            setProcessing('visibility');
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            await fetchFolders(true);
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

    const handleRenameFileAction = async (file: any) => {
        setRenamingFileId(file.id);
        setRenamingFileName(file.file_name);
        setShowRenameFile(true);
    };

    const handleArchiveFileAction = async (file: any) => {
        Alert.alert(
            "Archive Document",
            'Are you sure you want to archive this document? It will be moved to the Archive folder and set to "Do Not Follow".',
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Archive",
                    onPress: async () => {
                        try {
                            setProcessing('archive');
                            await archiveFile(file.id);
                            await fetchFolders(true);
                            setActionMenuVisible(false);
                            Alert.alert("Success", "Document archived");
                        } catch (e) {
                            Alert.alert("Error", "Failed to archive document");
                        } finally {
                            setProcessing(null);
                        }
                    }
                }
            ]
        );
    };

    const handleUnarchiveFile = async (file: any) => {
        setMovingItem({ type: 'file', id: file.id });
        setIsUnarchiving(true);
        setActiveActionFile(file);
        setActionMenuVisible(false);
        setShowMoveDialog(true);
    };

    const handleUpdateFile = async () => {
        if (!renamingFileName.trim() || !renamingFileId) return;
        setSubmitting(true);
        try {
            await updateFile(renamingFileId, { file_name: renamingFileName.trim() });
            await fetchFolders(true);
            setShowRenameFile(false);
            setRenamingFileId(null);
            setRenamingFileName('');
        } catch (e) {
            Alert.alert("Error", "Failed to update file name");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteFolderAction = async (folder: any) => {
        confirmDeleteFolder(folder);
    };

    const handleDeleteFile = async (file: any) => {
        Alert.alert(
            "Delete File",
            `Are you sure you want to delete "${file.file_name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setProcessing('delete');
                            await deleteFile(file.id);
                            await fetchFolders(true);
                            setActionMenuVisible(false);
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete file");
                        } finally {
                            setProcessing(null);
                        }
                    }
                }
            ]
        );
    };

    // Optimized Open Doc: Stay in-app, but use native power for speed
    const openDoc = async (doc: any) => {
        if (!doc.downloadUrl) return;

        const isPdf = doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            try {
                setPdfLoading(true);
                setPdfViewerName(doc.file_name || 'Document');
                setCurrentDoc(doc);

                // 1. Prepare clean local path in cache (unique by ID to prevent collisions)
                const ext = doc.file_name?.split('.').pop() || 'pdf';
                const sanitizedName = (doc.file_name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
                const cleanName = `${doc.id}_${sanitizedName}${sanitizedName.includes('.') ? '' : '.' + ext}`;
                const localUri = `${FileSystem.cacheDirectory}${cleanName}`;

                // 2. Local Cache Logic
                const fileInfo = await FileSystem.getInfoAsync(localUri);
                let uriToOpen = localUri;

                if (!fileInfo.exists) {
                    const downloadResult = await FileSystem.downloadAsync(doc.downloadUrl, localUri);
                    uriToOpen = downloadResult.uri;
                }

                // 3. Selection of Viewer
                if (Platform.OS === 'ios') {
                    // EXTREMELY FAST: iOS Webview renders local PDFs natively
                    setPdfViewerUrl(uriToOpen);

                } else {
                    // Android: Use local URI if native viewer is available (Builds), 
                    // otherwise use Google View URL for Expo Go compatibility
                    if (!isExpoGo) {
                        setPdfViewerUrl(uriToOpen);
                    } else {
                        const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(doc.downloadUrl)}`;
                        setPdfViewerUrl(viewerUrl);
                    }
                }
            } catch (error) {
                console.error("[PDF] Optimization failed:", error);
                setPdfLoading(false);
                // Fallback to basic browser if everything fails
                await WebBrowser.openBrowserAsync(doc.downloadUrl);
            } finally {
                setPdfLoading(false);
            }
        } else {
            WebBrowser.openBrowserAsync(doc.downloadUrl);
        }
    };

    const handleShare = async (doc: any) => {
        try {
            if (!doc.downloadUrl) return;

            setSharing(true);

            // For files, we download to cache then share the local URI
            const ext = doc.file_name?.split('.').pop() || 'tmp';
            const localUri = `${(FileSystem as any).cacheDirectory}${doc.file_name || `file_${Date.now()}.${ext}`}`;

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
        } finally {
            setSharing(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        if (newFolderName.trim().toLowerCase() === 'archive') {
            Alert.alert("Error", "The name 'Archive' is reserved for system use");
            return;
        }
        setSubmitting(true);
        try {
            await createFolder({
                name: newFolderName.trim(),
                project_id: project.id,
                parent_id: selectedFolder,
                folder_type: 'document',
            });
            await fetchFolders(true);
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
        if (editFolderName.trim().toLowerCase() === 'archive') {
            Alert.alert("Error", "The name 'Archive' is reserved for system use");
            return;
        }
        setSubmitting(true);
        try {
            await updateFolder(editingFolderId, { name: editFolderName.trim() });
            await fetchFolders(true);
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
            if (force) {
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
            } else {
                await deleteFolder(folder.id, force);
                setFolders(prev => prev.filter(f => f.id !== folder.id));
                if (selectedFolder === String(folder.id)) {
                    setSelectedFolder(folder.parent_id ? String(folder.parent_id) : null);
                }
            }
        } catch (e: any) {
            const data = e.response?.data;
            if (data?.hasContent) {
                Alert.alert(
                    'Folder Not Empty',
                    `"${folder.name}" contains files or subfolders. How would you like to proceed?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Move Contents',
                            onPress: () => {
                                const childFolders = folders.filter(f => String(f.parent_id) === String(folder.id));
                                const childFiles = docs.filter(p => String(p.folder_id) === String(folder.id));

                                if (childFolders.length === 0 && childFiles.length === 0) {
                                    Alert.alert("Info", "Folder is already empty");
                                    return;
                                }

                                setMovingContentsOf(folder);
                                setMovingItem(null);
                                setShowMoveDialog(true);
                            }
                        },
                        {
                            text: 'Delete Everything',
                            style: 'destructive',
                            onPress: () => handleDelete(folder, true)
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
            const data = await getProjectFiles(project.id, 'document');
            if (data.folderData) setFolders(data.folderData);
            if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
            clearSelection();
        } catch (e) {
            Alert.alert("Error", "Failed to update visibility");
        } finally {
            setProcessing(null);
        }
    };

    const handleBulkDoNotFollow = async (value: boolean) => {
        try {
            if (selectedFiles.size > 0) {
                setProcessing('bulk_dnf');
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
        } finally {
            setProcessing(null);
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

    const handleShareProject = async () => {
        try {
            const { getProjectShareLinks } = require('@/services/projectService');
            const links = await getProjectShareLinks(project.id, user.role);
            const link = user.role === 'client' ? links.clientLink : links.contributorLink;
            if (link) {
                await Share.share({
                    message: `Join ${project.name} on Apexis: ${link}`,
                });
            } else {
                Alert.alert("Info", "Share link not available");
            }
        } catch (error) {
            Alert.alert("Error", "Failed to get share link");
        }
    };

    const handleShareDoc = async (doc: any) => {
        if (!doc) return;
        try {
            setProcessing('sharing');
            const ext = doc.file_name?.split('.').pop() || 'pdf';
            const localUri = `${(FileSystem as any).cacheDirectory}${doc.file_name || `doc_${Date.now()}.${ext}`}`;

            const { uri } = await FileSystem.downloadAsync(doc.downloadUrl, localUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: doc.file_type || 'application/pdf',
                    dialogTitle: doc.file_name || 'Site Document'
                });
            } else {
                await Share.share({
                    title: doc.file_name,
                    url: doc.downloadUrl,
                });
            }
        } catch (e) {
            Alert.alert("Error", "Failed to share document");
        } finally {
            setProcessing(null);
        }
    };

    // Unified View
    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder || ''}`)}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Document</Text>
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
                        const count = docs.filter((d) => d.folder_id === folder.id).length;
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
                                    padding: 8, // Standardized to match Photos
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 1,
                                    position: 'relative',
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
                                <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>{count} files{subcount > 0 ? ` · ${subcount} folders` : ''}</Text>
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

                {!loading && currentFolders.length === 0 && visibleDocs.length === 0 && (
                    <View style={{ marginTop: 20, marginBottom: 10, alignItems: 'center' }}>
                        <Feather name="folder" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders or documents yet</Text>
                    </View>
                )}

                <View style={{ marginTop: sortedFolders.length > 0 ? 12 : 0 }}>
                    {(() => {
                        const renderDocItem = (doc: any) => {
                            const isSelected = selectedFiles.has(doc.id);
                            if (viewMode === 'grid') {
                                return (
                                    <View
                                        key={doc.id}
                                        style={{
                                            width: '23.8%',
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
                                        <Feather name="file-text" size={32} color={doc.file_type?.includes('pdf') ? '#ef4444' : '#3b82f6'} style={{ marginBottom: 12 }} />
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary, borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: colors.text, textAlign: 'center', paddingHorizontal: 2 }}>{doc.file_name}</Text>
                                        {!isSelectionMode && user.role !== 'client' && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                            <View style={{ position: 'absolute', top: 4, right: 4, zIndex: 30 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveActionFile(doc);
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
                                            marginVertical: 4,
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
                                                backgroundColor: doc.file_type?.includes('pdf') ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Feather name="file-text" size={16} color={doc.file_type?.includes('pdf') ? '#ef4444' : '#3b82f6'} />
                                        </View>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 2, left: 2, backgroundColor: colors.primary, borderRadius: 12, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
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
                                            <Text style={{ fontSize: 9, color: colors.textMuted }}>{formatFileSize(doc.file_size_mb)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', zIndex: 10 }}>
                                            {!isSelectionMode && user.role !== 'client' && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setActiveActionFile(doc);
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
                            const groups = groupItemsByMonth(sortedDocs);
                            return groups.map((group) => (
                                <View key={group.title} style={{ marginBottom: 20 }}>
                                    <View style={{
                                        paddingVertical: 12,
                                        backgroundColor: colors.background,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{group.title}</Text>
                                        <View style={{ height: 1, flex: 1, backgroundColor: colors.border, marginLeft: 12, opacity: 0.5 }} />
                                    </View>
                                    <View style={{
                                        flexDirection: viewMode === 'grid' ? 'row' : 'column',
                                        flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
                                        gap: viewMode === 'grid' ? 4 : 4
                                    }}>
                                        {group.data.map(renderDocItem)}
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
                                {sortedDocs.map(renderDocItem)}
                            </View>
                        );
                    })()}
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
                onRequestClose={() => {
                    setPdfViewerUrl(null);
                    setCurrentDoc(null);
                }}
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
                            onPress={() => {
                                setPdfViewerUrl(null);
                                setCurrentDoc(null);
                            }}
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
                                    if (currentDoc) handleShareDoc(currentDoc);
                                }}
                                style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                            >
                                <Feather name="share-2" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Metadata Strip */}
                    {(currentDoc?.location || currentDoc?.tags) && (
                        <View style={{ backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {currentDoc.location && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Feather name="map-pin" size={12} color="#f97316" />
                                        <Text style={{ color: '#eee', fontSize: 11, fontWeight: '500' }}>{currentDoc.location}</Text>
                                    </View>
                                )}
                                {currentDoc.tags && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Feather name="tag" size={12} color="#aaa" />
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            {currentDoc.tags.split(',').map((tag: string, tidx: number) => (
                                                <View key={tidx} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                                    <Text style={{ color: '#fff', fontSize: 9 }}>{tag.trim()}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* WebView PDF Rendering Layer */}
                    {pdfViewerUrl && (
                        (Platform.OS === 'ios' || (isExpoGo && Platform.OS === 'android')) ? (
                            <WebView
                                key={pdfViewerUrl}
                                source={{ uri: pdfViewerUrl }}
                                style={{ flex: 1, backgroundColor: '#111' }}
                                startInLoadingState
                                scalesPageToFit
                                allowsInlineMediaPlayback
                                javaScriptEnabled
                                domStorageEnabled
                                originWhitelist={['*']}
                                onLoadStart={() => setPdfLoading(true)}
                                onLoadEnd={() => setPdfLoading(false)}
                                renderLoading={() => (
                                    <View style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        justifyContent: 'center', alignItems: 'center', backgroundColor: '#111'
                                    }}>
                                        <ActivityIndicator size="large" color={colors.primary} />
                                        <Text style={{ color: '#aaa', fontSize: 12, marginTop: 12 }}>
                                            {isExpoGo ? 'Fetching from Google...' : 'Optimizing View…'}
                                        </Text>
                                    </View>
                                )}
                            />
                        ) : (
                            Pdf ? (
                                <Pdf
                                    source={{ uri: pdfViewerUrl, cache: true }}
                                    style={{ flex: 1, backgroundColor: '#111' }}
                                    trustAllCerts={false}
                                    onLoadComplete={() => setPdfLoading(false)}
                                    onError={(error: any) => {
                                        console.error("PDF Load Error:", error);
                                        setPdfLoading(false);
                                    }}
                                />
                            ) : (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#fff' }}>Viewer not available in this environment</Text>
                                </View>
                            )
                        )
                    )}
                </View>

                {/* Sharing Overlay (Inside the PDF Viewer) */}
                {sharing && (
                    <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999
                    }}>
                        <View style={{ backgroundColor: colors.surface, padding: 30, borderRadius: 20, alignItems: 'center', gap: 15 }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Preparing...</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Downloading file to share...</Text>
                        </View>
                    </View>
                )}
            </Modal>

            {/* Sharing Overlay (For cases where viewer isn't open) */}
            {sharing && !pdfViewerUrl && (
                <View style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999
                }}>
                    <View style={{ backgroundColor: colors.surface, padding: 30, borderRadius: 20, alignItems: 'center', gap: 15 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Preparing...</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Downloading file to share...</Text>
                    </View>
                </View>
            )}

            {/* Opening Document Overlay (During Download Phase) */}
            {pdfLoading && !pdfViewerUrl && (
                <View style={{
                    ...StyleSheet.absoluteFillObject,
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000
                }}>
                    <View style={{ backgroundColor: colors.surface, padding: 30, borderRadius: 20, alignItems: 'center', gap: 15 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Opening Document</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Downloading file for preview...</Text>
                    </View>
                </View>
            )}

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
                                        onPress={handleBulkShare}
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
                                        const file = docs.find(d => d.id === fileId);
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

                                {/* Don't Follow - Admin/Contributor */}
                                {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && selectedFiles.size > 0 && (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => handleBulkDoNotFollow(true)}
                                            style={{ padding: 4 }}
                                            disabled={processing !== null}
                                        >
                                            {processing === 'bulk_dnf' ? (
                                                <ActivityIndicator size="small" color="#ef4444" />
                                            ) : (
                                                <Feather name="shield" size={18} color="#ef4444" />
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleBulkDoNotFollow(false)}
                                            style={{ padding: 4 }}
                                            disabled={processing !== null}
                                        >
                                            {processing === 'bulk_dnf' ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : (
                                                <Feather name="shield-off" size={18} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}

                                {/* Move Option - Admin only for folders, Admin/Contributor for files */}
                                {((selectedFolders.size > 0 && (user.role === 'admin' || user.role === 'superadmin')) || (selectedFiles.size > 0)) && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (selectedFolders.size === 1 && selectedFiles.size === 0) {
                                                const folderId = Array.from(selectedFolders)[0];
                                                setMovingItem({ type: 'folder', id: folderId });
                                                setShowMoveDialog(true);
                                            } else if (selectedFiles.size === 1 && selectedFolders.size === 0) {
                                                const fileId = Array.from(selectedFiles)[0];
                                                setMovingItem({ type: 'file', id: fileId });
                                                setShowMoveDialog(true);
                                            } else {
                                                Alert.alert("Info", "Select a single item to move");
                                            }
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
                    setIsUnarchiving(false);
                }}
                project={project}
                item={movingItem}
                selectedItems={movingContentsOf ? {
                    folders: folders.filter(f => String(f.parent_id) === String(movingContentsOf.id)).map(f => f.id),
                    files: docs.filter(p => String(p.folder_id) === String(movingContentsOf.id)).map(p => p.id)
                } : {
                    folders: Array.from(selectedFolders),
                    files: Array.from(selectedFiles)
                }}
                hideSuccessAlert={isUnarchiving}
                onConfirm={isUnarchiving ? async (selectedSubFolderId) => {
                    if (activeActionFile) {
                        try {
                            setProcessing('unarchive');
                            await unarchiveFile(activeActionFile.id, selectedSubFolderId === 'root' ? null : selectedSubFolderId);
                            Alert.alert("Success", "Document unarchived successfully");
                        } catch (e) {
                            Alert.alert("Error", "Failed to unarchive document");
                            throw e; // Rethrow to let dialog handle error state if needed
                        } finally {
                            setProcessing(null);
                            setIsUnarchiving(false);
                        }
                    }
                } : undefined}
                onMoveComplete={async (selectedSubFolderId) => {
                    if (!isUnarchiving && movingContentsOf) {
                        try {
                            await deleteFolder(movingContentsOf.id, false);
                            Alert.alert("Success", `Folder "${movingContentsOf.name}" deleted after moving contents`);
                        } catch (err) {
                            Alert.alert("Error", "Contents moved, but failed to delete empty folder");
                        }
                    }
                    const data = await getProjectFiles(project.id, 'document');
                    if (data.folderData) setFolders(data.folderData);
                    if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
                    clearSelection();
                    setMovingContentsOf(null);
                }}
                type="document"
            />

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

            {/* Rename File Modal */}
            <Modal visible={showRenameFile} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>Rename File</Text>
                        <TextInput
                            value={renamingFileName}
                            onChangeText={setRenamingFileName}
                            placeholder="File name"
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

            <FileActionMenu
                isVisible={actionMenuVisible}
                onClose={() => setActionMenuVisible(false)}
                onHideUnhide={() => handleToggleVisibility(activeActionFile)}
                onDoNotFollow={() => handleToggleDoNotFollow(activeActionFile)}
                onDelete={() => handleDeleteFile(activeActionFile)}
                onArchive={() => handleArchiveFileAction(activeActionFile)}
                onUnarchive={() => handleUnarchiveFile(activeActionFile)}
                onShare={() => handleShareDoc(activeActionFile)}
                onRename={() => handleRenameFileAction(activeActionFile)}
                clientVisible={activeActionFile?.client_visible !== false}
                doNotFollow={activeActionFile?.do_not_follow === true}
                canDelete={false} // Disable delete in Docs
                showArchive={true}
                isArchived={folders.find(f => f.id === activeActionFile?.folder_id)?.name.toLowerCase() === 'archive'}
                canRename={['admin', 'superadmin', 'contributor'].includes(user.role)}
                isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                fileName={activeActionFile?.file_name || ''}
                processingAction={processing}
            />

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

