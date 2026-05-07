import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { View, TouchableOpacity, Alert, Modal, Share, ScrollView, BackHandler, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, RefreshControl, KeyboardAvoidingView } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles, toggleDoNotFollow, updateFile, archiveFile, unarchiveFile, downloadFile } from '@/services/fileService';
import { setActiveProjectContext } from '@/utils/projectSelection';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { WebView } from 'react-native-webview';
import { getFolderRFIs } from '@/services/rfiService';
import { getComments, addComment as addCommentApi, type CommentThread } from '@/services/commentService';
import { getMemberForTag } from '@/services/projectService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import FileActionMenu from './FileActionMenu';
import FolderActionMenu from './FolderActionMenu';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectDocuments({ project, user, initialFolderId, initialFileId, searchQuery }: { project: any, user: any, initialFolderId?: string, initialFileId?: string, searchQuery?: string }) {
    const { colors, isDark } = useTheme();

    const router = useRouter();
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null);
    // Sync selectedFolder whenever the deep-link prop changes.
    // useState(initialFolderId) only runs on first mount — this effect handles
    // subsequent navigations while the component stays mounted in the FlatList.
    useEffect(() => {
        setSelectedFolder(initialFolderId || null);
    }, [initialFolderId, initialFileId, searchQuery]);
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
    const [activeFolderTab, setActiveFolderTab] = useState<'files' | 'rfis'>('files');
    const [linkedRFIs, setLinkedRFIs] = useState<any[]>([]);
    const [loadingRFIs, setLoadingRFIs] = useState(false);
    const insets = useSafeAreaInsets();

    // Comment state
    const [docComments, setDocComments] = useState<CommentThread[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [showMentions, setShowMentions] = useState(false);
    const [showComments, setShowComments] = useState(false);

    const fetchFolders = async (isRefetch = false) => {
        if (!project?.id) return;
        if (!isRefetch && folders.length === 0 && docs.length === 0) setLoading(true);
        try {
            const data = await getProjectFiles(project.id, 'document', searchQuery);
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
        }, [project?.id, searchQuery])
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchFolders(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
            setLinkedRFIs([]); // Reset immediately to prevent toggle glitch
            fetchLinkedRFIs();
        } else {
            setSortBy('name');
            setActiveFolderTab('files');
            setLinkedRFIs([]);
        }
    }, [selectedFolder]);

    const fetchLinkedRFIs = async () => {
        if (!selectedFolder) return;
        setLoadingRFIs(true);
        try {
            const data = await getFolderRFIs(selectedFolder);
            setLinkedRFIs(data);
        } catch (e) {
            console.error("fetchLinkedRFIs error", e);
        } finally {
            setLoadingRFIs(false);
        }
    };

    const loadComments = async (fileId: number) => {
        setCommentLoading(true);
        try {
            const data = await getComments(fileId);
            setDocComments(data);
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
        if (!currentDoc?.id || !commentText.trim()) return;
        setAddingComment(true);
        try {
            await addCommentApi(currentDoc.id, commentText.trim(), replyTo ?? undefined);
            setCommentText('');
            setReplyTo(null);
            await loadComments(currentDoc.id);
        } catch (e) {
            console.error('addComment error:', e);
        } finally {
            setAddingComment(false);
        }
    };

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
                router.setParams({ fileId: '', documentId: '' });
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

            // Sync current doc in viewer
            if (currentDoc?.id === file.id) {
                setCurrentDoc((prev: any) => ({ ...prev, do_not_follow: !file.do_not_follow }));
            }

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

                // Load comments and members
                loadComments(doc.id);
                loadMembers();
                setShowComments(false);
                setCommentText('');
                setReplyTo(null);

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

            // If it's a PDF and marked as 'Do Not Follow', download via backend to apply watermark
            let urlToDownload = doc.downloadUrl;
            let uri = '';

            if (doc.do_not_follow && (doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf'))) {
                const data = await downloadFile(doc.id);
                // Convert arraybuffer to base64 for FileSystem
                const base64 = btoa(
                    new Uint8Array(data).reduce(
                        (data, byte) => data + String.fromCharCode(byte),
                        '',
                    ),
                );
                await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                uri = localUri;
                urlToDownload = localUri; // For share fallback
            } else {
                const downloadResult = await FileSystem.downloadAsync(doc.downloadUrl, localUri);
                uri = downloadResult.uri;
            }

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
                    message: `${doc.file_name}\n${urlToDownload}`,
                    url: urlToDownload,
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

            // If it's a PDF and marked as 'Do Not Follow', download via backend to apply watermark
            let urlToDownload = doc.downloadUrl;
            let uri = '';

            if (doc.do_not_follow && (doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf'))) {
                const data = await downloadFile(doc.id);
                const base64 = btoa(
                    new Uint8Array(data).reduce(
                        (data, byte) => data + String.fromCharCode(byte),
                        '',
                    ),
                );
                await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                uri = localUri;
                urlToDownload = localUri;
            } else {
                const downloadResult = await FileSystem.downloadAsync(doc.downloadUrl, localUri);
                uri = downloadResult.uri;
            }

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: doc.file_type || 'application/pdf',
                    dialogTitle: doc.file_name || 'Site Document'
                });
            } else {
                await Share.share({
                    title: doc.file_name,
                    url: urlToDownload,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
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

                {selectedFolder && linkedRFIs.length > 0 && (
                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.border : '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => setActiveFolderTab('files')}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                alignItems: 'center',
                                backgroundColor: activeFolderTab === 'files' ? colors.surface : 'transparent',
                                ...(activeFolderTab === 'files' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 } : {})
                            }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'files' ? colors.primary : colors.textMuted }}>Files ({sortedFolders.length + sortedDocs.length})</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveFolderTab('rfis')}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                alignItems: 'center',
                                backgroundColor: activeFolderTab === 'rfis' ? colors.surface : 'transparent',
                                ...(activeFolderTab === 'rfis' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 } : {})
                            }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'rfis' ? colors.primary : colors.textMuted }}>Linked RFIs ({linkedRFIs.length})</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activeFolderTab === 'rfis' ? (
                    <View style={{ gap: 10 }}>
                        {loadingRFIs ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : linkedRFIs.length > 0 ? (
                            linkedRFIs.map((rfi) => (
                                <TouchableOpacity
                                    key={rfi.id}
                                    onPress={() => router.setParams({ tab: 'rfi', rfiId: String(rfi.id) })}
                                    style={{
                                        backgroundColor: colors.surface,
                                        borderRadius: 12,
                                        padding: 12,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{rfi.title}</Text>
                                            <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 6,
                                                backgroundColor: rfi.status === 'open' ? 'rgba(245,158,11,0.1)' : rfi.status === 'closed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                                            }}>
                                                <Text style={{
                                                    fontSize: 9,
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    color: rfi.status === 'open' ? '#f59e0b' : rfi.status === 'closed' ? '#22c55e' : '#ef4444'
                                                }}>{rfi.status}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="calendar" size={10} color={colors.textMuted} />
                                                <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(rfi.createdAt).toLocaleDateString()}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Feather name="user" size={10} color={colors.textMuted} />
                                                <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{rfi.assignee?.name || 'Unassigned'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                <Feather name="link-2" size={32} color={colors.border} />
                                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>No RFIs linked to this folder</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <>
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
                    </>
                )}

                {/* {sortedFolders.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="file-text" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders yet</Text>
                    </View>
                )} */}
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
                    setShowComments(false);
                    setDocComments([]);
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
                                setShowComments(false);
                                setDocComments([]);
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
                                onPress={() => setShowComments(!showComments)}
                                style={{ padding: 8, borderRadius: 20, backgroundColor: showComments ? colors.primary : 'rgba(255,255,255,0.1)' }}
                            >
                                <View style={{ position: 'relative' }}>
                                    <Feather name="message-square" size={18} color="#fff" />
                                    {docComments.length > 0 && (
                                        <View style={{ position: 'absolute', top: -4, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                                            <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>{docComments.length}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
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
                                {currentDoc?.location && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Feather name="map-pin" size={12} color="#f97316" />
                                        <Text style={{ color: '#eee', fontSize: 11, fontWeight: '500' }}>{currentDoc?.location}</Text>
                                    </View>
                                )}
                                {currentDoc?.tags && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Feather name="tag" size={12} color="#aaa" />
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            {currentDoc?.tags?.split(',').map((tag: string, tidx: number) => (
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

                    <View style={{ flex: 1, position: 'relative' }}>
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
                                                {isExpoGo ? 'Optimizing View…' : 'Optimizing View…'}
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

                        {/* Do Not Follow Watermark Overlay */}
                        {currentDoc?.do_not_follow && (
                            <View
                                pointerEvents="none"
                                style={{
                                    ...StyleSheet.absoluteFillObject,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    zIndex: 100, // Very high zIndex to ensure it's above native components
                                }}
                            >
                                <View style={{
                                    transform: [{ rotate: '-30deg' }],
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    paddingHorizontal: 30,
                                    paddingVertical: 15,
                                    borderRadius: 8,
                                    borderWidth: 3,
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    borderStyle: 'dashed'
                                }}>
                                    <Text style={{
                                        color: 'rgba(239, 68, 68, 0.4)',
                                        fontSize: 48,
                                        fontWeight: '900',
                                        textTransform: 'uppercase',
                                        letterSpacing: 2,
                                        textAlign: 'center'
                                    }}>
                                        Do Not Follow
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Comments Overlay Panel */}
                    {showComments && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: 'rgba(15,15,15,0.98)',
                                borderTopLeftRadius: 25,
                                borderTopRightRadius: 25,
                                borderTopWidth: 1,
                                borderTopColor: 'rgba(255,255,255,0.15)',
                                overflow: 'hidden',
                                zIndex: 2000,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: -10 },
                                shadowOpacity: 0.5,
                                shadowRadius: 15,
                                elevation: 24
                            }}
                        >
                            <View style={{ padding: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>💬 DISCUSSION ({docComments.length})</Text>
                                    <TouchableOpacity onPress={() => setShowComments(false)} style={{ padding: 4 }}>
                                        <Feather name="chevron-down" size={18} color="#aaa" />
                                    </TouchableOpacity>
                                </View>

                                {commentLoading ? (
                                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                                ) : (
                                    <ScrollView
                                        style={{ maxHeight: SCREEN_H * 0.35 }}
                                        contentContainerStyle={{ paddingBottom: 10 }}
                                        showsVerticalScrollIndicator={true}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {docComments.length === 0 && (
                                            <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginVertical: 20 }}>No comments yet. Start the conversation!</Text>
                                        )}
                                        {docComments.map((c: any) => (
                                            <View key={c.id} style={{ marginBottom: 12 }}>
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{c.user?.name || 'User'}</Text>
                                                        <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                                            <Text style={{ color: '#888', fontSize: 10 }}>↩ Reply</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <Text style={{ color: '#eee', fontSize: 12, lineHeight: 18 }}>
                                                        {renderCommentText(c.text)}
                                                    </Text>
                                                </View>
                                                {c.replies?.map((r: any) => (
                                                    <View key={r.id} style={{ marginLeft: 16, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 8, borderLeftWidth: 2, borderLeftColor: colors.primary }}>
                                                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{r.user?.name || 'User'}</Text>
                                                        <Text style={{ color: '#ccc', fontSize: 11, lineHeight: 16 }}>
                                                            {renderCommentText(r.text)}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}

                                {replyTo && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                                        <Text style={{ color: colors.primary, fontSize: 10 }}>Replying to comment</Text>
                                        <TouchableOpacity onPress={() => setReplyTo(null)}>
                                            <Feather name="x-circle" size={12} color="#888" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showMentions && (
                                    <View style={{ position: 'absolute', bottom: 65, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 }}>
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

                                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 }}>
                                    <TextInput
                                        value={commentText}
                                        onChangeText={handleInputChange}
                                        placeholder="Add a comment…"
                                        placeholderTextColor="#666"
                                        style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, color: '#fff', fontSize: 13 }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleAddComment}
                                        disabled={addingComment || !commentText.trim()}
                                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: (!commentText.trim() || addingComment) ? 0.5 : 1 }}
                                    >
                                        {addingComment
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <Feather name="send" size={16} color="#fff" />
                                        }
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: Math.max(insets.bottom, 10) }} />
                            </View>
                        </KeyboardAvoidingView>
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

