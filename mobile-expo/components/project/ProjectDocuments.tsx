import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { FlatList, TouchableOpacity as GestureTouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, TouchableOpacity, Alert, Modal, Share, ScrollView, BackHandler, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, RefreshControl, KeyboardAvoidingView, Keyboard, PanResponder } from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility, bulkUpdateFiles, toggleDoNotFollow, toggleOnlyForReference, updateFile, archiveFile, unarchiveFile, downloadFile, markFileSeen, getLinkedItems, linkFiles, deleteLink } from '@/services/fileService';
import { setActiveProjectContext } from '@/utils/projectSelection';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import LinkFileModal from '../shared/LinkFileModal';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { WebView } from 'react-native-webview';
import { getFolderRFIs, getRFIAssignees, createRFI } from '@/services/rfiService';
import { getFolderSnags, getAssignees as getSnagAssignees, createSnag } from '@/services/snagService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getComments, addComment as addCommentApi, type CommentThread } from '@/services/commentService';
import { getMemberForTag } from '@/services/projectService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocket } from '@/contexts/SocketContext';

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
import FileInformationModal from '../shared/FileInformationModal';
import { groupItemsByMonth } from '@/helpers/grouping';
import FileActionMenu from './FileActionMenu';
import FolderActionMenu from './FolderActionMenu';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectDocuments({ project, user, initialFolderId, initialFileId, searchQuery, onFolderChange }: { project: any, user: any, initialFolderId?: string, initialFileId?: string, searchQuery?: string, onFolderChange?: (folderId: string | null) => void }) {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const { socket } = useSocket();

    const router = useRouter();
    const searchParams = useLocalSearchParams();
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null);

    useEffect(() => {
        if (onFolderChange) {
            onFolderChange(selectedFolder);
        }
    }, [selectedFolder, onFolderChange]);

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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest' | 'size'>('name');
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [monthOffsets, setMonthOffsets] = useState<{ [key: string]: number }>({});
    const [tempMonth, setTempMonth] = useState('');
    const [tempYear, setTempYear] = useState('');

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
    const [viewerActiveTab, setViewerActiveTab] = useState<'discussion' | 'links'>('discussion');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [linkedItems, setLinkedItems] = useState<any[]>([]);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [sharing, setSharing] = useState(false);

    // View state helpers for nested modals on iOS
    const restoreViewerUrlRef = useRef<string | null>(null);

    const openSubModalFromViewer = (openSubModalFn: () => void) => {
        if (pdfViewerUrl) {
            restoreViewerUrlRef.current = pdfViewerUrl;
            setPdfViewerUrl(null);
            if (Platform.OS === 'ios') {
                setTimeout(() => {
                    openSubModalFn();
                }, 350);
            } else {
                openSubModalFn();
            }
        } else {
            openSubModalFn();
        }
    };

    const checkAndRestoreViewer = () => {
        if (restoreViewerUrlRef.current) {
            const url = restoreViewerUrlRef.current;
            restoreViewerUrlRef.current = null;
            if (Platform.OS === 'ios') {
                setTimeout(() => {
                    setPdfViewerUrl(url);
                }, 350);
            } else {
                setPdfViewerUrl(url);
            }
        }
    };

    const closeCreateSnagModal = () => {
        setShowCreateSnagModal(false);
        checkAndRestoreViewer();
    };

    const closeCreateRfiModal = () => {
        setShowCreateRfiModal(false);
        checkAndRestoreViewer();
    };

    const closeRenameFileModal = () => {
        setShowRenameFile(false);
        checkAndRestoreViewer();
    };

    const [refreshing, setRefreshing] = useState(false);

    // Action Menu state
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [activeActionFile, setActiveActionFile] = useState<any>(null);

    // RFI & Snag creation from Docs
    const [showCreateSnagModal, setShowCreateSnagModal] = useState(false);
    const [snagTitle, setSnagTitle] = useState('');
    const [snagDesc, setSnagDesc] = useState('');
    const [snagAssignedToId, setSnagAssignedToId] = useState<number | null>(null);
    const [snagAssignees, setSnagAssignees] = useState<any[]>([]);
    const [showSnagAssigneeDropdown, setShowSnagAssigneeDropdown] = useState(false);

    const [showCreateRfiModal, setShowCreateRfiModal] = useState(false);
    const [rfiTitle, setRfiTitle] = useState('');
    const [rfiDesc, setRfiDesc] = useState('');
    const [rfiAssignedToId, setRfiAssignedToId] = useState<number | null>(null);
    const [rfiAssignees, setRfiAssignees] = useState<any[]>([]);
    const [showRfiAssigneeDropdown, setShowRfiAssigneeDropdown] = useState(false);
    const [rfiExpiryDate, setRfiExpiryDate] = useState<Date | null>(null);
    const [showRfiDatePicker, setShowRfiDatePicker] = useState(false);

    const [submittingEntity, setSubmittingEntity] = useState(false);

    useEffect(() => {
        if (showCreateSnagModal && project?.id) {
            getSnagAssignees(project.id)
                .then(setSnagAssignees)
                .catch(err => console.error("Error fetching snag assignees", err));
        }
    }, [showCreateSnagModal, project?.id]);

    useEffect(() => {
        if (showCreateRfiModal && project?.id) {
            getRFIAssignees(project.id)
                .then(setRfiAssignees)
                .catch(err => console.error("Error fetching RFI assignees", err));
        }
    }, [showCreateRfiModal, project?.id]);

    const handleStartCreateSnag = (file: any) => {
        setActiveActionFile(file);
        setSnagTitle('');
        setSnagDesc('');
        setSnagAssignedToId(null);
        openSubModalFromViewer(() => setShowCreateSnagModal(true));
    };

    const handleStartCreateRfi = (file: any) => {
        setActiveActionFile(file);
        setRfiTitle('');
        setRfiDesc('');
        setRfiAssignedToId(null);
        setRfiExpiryDate(null);
        openSubModalFromViewer(() => setShowCreateRfiModal(true));
    };

    const handleCreateSnagFromDoc = async () => {
        if (!snagTitle.trim()) {
            Alert.alert("Error", "Title is required");
            return;
        }
        if (!snagAssignedToId) {
            Alert.alert("Error", "Assignee is required");
            return;
        }
        if (!activeActionFile) return;

        setSubmittingEntity(true);
        try {
            const formData = new FormData();
            formData.append('project_id', String(project.id));
            formData.append('title', snagTitle.trim());
            if (snagDesc.trim()) {
                formData.append('description', snagDesc.trim());
            }
            formData.append('assigned_to', String(snagAssignedToId));
            formData.append('photo_key', activeActionFile.file_url);
            formData.append('source_file_id', String(activeActionFile.id));

            await createSnag(formData);
            Alert.alert("Success", "Snag created successfully");
            closeCreateSnagModal();
        } catch (error: any) {
            console.error("Create Snag from doc error", error);
            const errMsg = error.response?.data?.error || "Failed to create snag";
            Alert.alert("Error", errMsg);
        } finally {
            setSubmittingEntity(false);
        }
    };

    const handleCreateRfiFromDoc = async () => {
        if (!rfiTitle.trim()) {
            Alert.alert("Error", "Title is required");
            return;
        }
        if (!rfiAssignedToId) {
            Alert.alert("Error", "Assignee is required");
            return;
        }
        if (!activeActionFile) return;

        setSubmittingEntity(true);
        try {
            const formData = new FormData();
            formData.append('project_id', String(project.id));
            formData.append('title', rfiTitle.trim());
            if (rfiDesc.trim()) {
                formData.append('description', rfiDesc.trim());
            }
            formData.append('assigned_to', String(rfiAssignedToId));
            if (rfiExpiryDate) {
                formData.append('expiry_date', rfiExpiryDate.toISOString());
            }
            formData.append('photo_key', activeActionFile.file_url);
            formData.append('source_file_id', String(activeActionFile.id));

            await createRFI(formData);
            Alert.alert("Success", "RFI created successfully");
            closeCreateRfiModal();
        } catch (error: any) {
            console.error("Create RFI from doc error", error);
            const errMsg = error.response?.data?.error || "Failed to create RFI";
            Alert.alert("Error", errMsg);
        } finally {
            setSubmittingEntity(false);
        }
    };

    const [folderMenuVisible, setFolderMenuVisible] = useState(false);
    const [activeActionFolder, setActiveActionFolder] = useState<any>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const mainScrollRef = useRef<ScrollView>(null);

    const [showRenameFile, setShowRenameFile] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState<number | null>(null);
    const [renamingFileName, setRenamingFileName] = useState('');
    const [isUnarchiving, setIsUnarchiving] = useState(false);
    const [activeFolderTab, setActiveFolderTab] = useState<'files' | 'rfis'>('files');
    const [activeLinkedSubTab, setActiveLinkedSubTab] = useState<'rfis' | 'snags'>('rfis');
    const [linkedRFIs, setLinkedRFIs] = useState<any[]>([]);
    const [linkedSnags, setLinkedSnags] = useState<any[]>([]);
    const [loadingRFIs, setLoadingRFIs] = useState(false);
    const insets = useSafeAreaInsets();

    // Comment state
    const commentInputRef = useRef<any>(null);
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
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    useEffect(() => {
        if (!socket) return;

        socket.on('file-seen', (data: { fileId: string | number, seen_at: string }) => {
            setDocs((prev) => prev.map((d) => String(d.id) === String(data.fileId) ? { ...d, seen_at: data.seen_at } : d));
        });

        return () => {
            socket.off('file-seen');
        };
    }, [socket]);

    const fetchLinkedItems = useCallback(async () => {
        if (pdfViewerUrl && currentDoc?.id) {
            try {
                const data = await getLinkedItems(currentDoc.id);
                setLinkedItems(data.links || []);
            } catch (err) {
                console.error(err);
            }
        }
    }, [pdfViewerUrl, currentDoc]);

    useEffect(() => {
        if (pdfViewerUrl) {
            fetchLinkedItems();
        }
    }, [pdfViewerUrl, fetchLinkedItems]);

    const handleLinkFile = async (targetId: number) => {
        if (!currentDoc?.id) return;
        try {
            await linkFiles(currentDoc.id, targetId);
            setShowLinkModal(false);
            checkAndRestoreViewer();
            fetchLinkedItems();
            Alert.alert(t('projectDocuments.success'), 'File linked successfully.');
        } catch (e: any) {
            Alert.alert(t('projectDocuments.error'), e.response?.data?.error || 'Failed to link file.');
        }
    };

    const handleRemoveLink = async (targetType: string, targetId: number) => {
        if (!currentDoc?.id) return;
        try {
            await deleteLink(currentDoc.id, targetType, targetId);
            fetchLinkedItems();
        } catch (e: any) {
            Alert.alert(t('projectDocuments.error'), e.response?.data?.error || 'Failed to remove link.');
        }
    };

    const handleLinkItemClick = async (item: any) => {
        setShowLinkModal(false);
        checkAndRestoreViewer();

        const itemType = item.type || item.target_type;
        const itemId = item.target_id || item.id;
        if (!itemType || !itemId) return;

        // Parse folderId from the S3 file_url path (e.g. "projects/1/folders/23/filename.pdf")
        let targetFolderId: string | null = item.folder_id ? String(item.folder_id) : null;
        if (!targetFolderId && item.file_url) {
            const parts = item.file_url.split('/');
            const folderIdx = parts.indexOf('folders');
            if (folderIdx !== -1 && folderIdx + 1 < parts.length) {
                targetFolderId = parts[folderIdx + 1];
            }
        }

        const returnContext = {
            returnTab: 'documents',
            returnFolderId: selectedFolder ? String(selectedFolder) : '',
            returnFileId: currentDoc?.id ? String(currentDoc.id) : '',
            // Tell the viewer to reopen on the links tab when returning
            returnViewerTab: 'links',
        };

        const executeClick = () => {
            if (itemType === 'file') {
                const fileName = (item.title || item.file_name || item.name || '').toLowerCase();
                const isPhoto = item.file_type?.startsWith('image/') ||
                    fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg') ||
                    fileName.endsWith('.gif') || fileName.endsWith('.webp');

                if (isPhoto) {
                    setPdfViewerUrl(null);
                    setCurrentDoc(null);
                    setShowComments(false);
                    setDocComments([]);
                    if (Platform.OS === 'ios') {
                        setTimeout(() => {
                            router.setParams({
                                tab: 'photos',
                                folderId: String(targetFolderId || ''),
                                fileId: String(itemId),
                                ...returnContext
                            });
                        }, 450);
                    } else {
                        router.setParams({
                            tab: 'photos',
                            folderId: String(targetFolderId || ''),
                            fileId: String(itemId),
                            ...returnContext
                        });
                    }
                } else {
                    const targetDoc = docs.find(d => String(d.id) === String(itemId));
                    if (targetDoc && String(targetDoc.folder_id ?? 'null') === String(selectedFolder ?? 'null')) {
                        openDoc(targetDoc);
                    } else {
                        setPdfViewerUrl(null);
                        setCurrentDoc(null);
                        setShowComments(false);
                        setDocComments([]);
                        if (Platform.OS === 'ios') {
                            setTimeout(() => {
                                router.setParams({
                                    tab: 'documents',
                                    folderId: String(targetFolderId || ''),
                                    fileId: String(itemId),
                                    ...returnContext
                                });
                            }, 450);
                        } else {
                            router.setParams({
                                tab: 'documents',
                                folderId: String(targetFolderId || ''),
                                fileId: String(itemId),
                                ...returnContext
                            });
                        }
                    }
                }
            } else {
                setPdfViewerUrl(null);
                setCurrentDoc(null);
                setShowComments(false);
                setDocComments([]);
                const triggerNav = () => {
                    if (itemType === 'rfi') {
                        router.setParams({ tab: 'rfi', rfiId: String(itemId), ...returnContext });
                    } else if (itemType === 'snag') {
                        router.setParams({ tab: 'snags', snagId: String(itemId), ...returnContext });
                    }
                };
                if (Platform.OS === 'ios') {
                    setTimeout(triggerNav, 450);
                } else {
                    triggerNav();
                }
            }
        };

        if (Platform.OS === 'ios') {
            setTimeout(executeClick, 450);
        } else {
            executeClick();
        }
    };

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
            setLinkedSnags([]);
            fetchLinkedRFIs();
        } else {
            setSortBy('name');
            setActiveFolderTab('files');
            setLinkedRFIs([]);
            setLinkedSnags([]);
        }
    }, [selectedFolder]);

    // Auto-switch folder tab when returning from an RFI/Snag opened from the folder's linked section
    useEffect(() => {
        const folderActiveTab = searchParams?.folderActiveTab as string;
        if (folderActiveTab && selectedFolder) {
            setActiveFolderTab('rfis');
            setTimeout(() => {
                router.setParams({ folderActiveTab: '' });
            }, 100);
        }
    }, [searchParams?.folderActiveTab, selectedFolder]);

    const fetchLinkedRFIs = async () => {
        if (!selectedFolder) return;
        setLoadingRFIs(true);
        try {
            const [rfiData, snagData] = await Promise.all([
                getFolderRFIs(selectedFolder).catch(() => []),
                getFolderSnags(selectedFolder).catch(() => [])
            ]);
            setLinkedRFIs(rfiData);
            setLinkedSnags(snagData);
            if (rfiData.length === 0 && snagData.length > 0) {
                setActiveLinkedSubTab('snags');
            } else {
                setActiveLinkedSubTab('rfis');
            }
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

        // Refocus the input to keep the keyboard open and the cursor active
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
        if (!currentDoc?.id || !commentText.trim() || addingComment) return;
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
            const folderToUse = initialFolderId || selectedFolder;
            const currentFolderDocsForInit = docs.filter((d) => String(d.folder_id ?? 'null') === String(folderToUse ?? 'null'));
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
                // If returning from an RFI/Snag that was opened from the links tab, reopen on links tab
                if (searchParams?.viewerTab === 'links') {
                    setViewerActiveTab('links');
                    if (Platform.OS === 'android') {
                        setTimeout(() => {
                            setShowLinkModal(true);
                        }, 500);
                    } else {
                        setShowLinkModal(true);
                    }
                }
                if (Platform.OS === 'android') {
                    setTimeout(() => {
                        router.setParams({ fileId: '', documentId: '', viewerTab: '' });
                    }, 500);
                } else {
                    router.setParams({ fileId: '', documentId: '', viewerTab: '' });
                }
            }
        }
    }, [initialFileId, docs, selectedFolder, initialFolderId, sortBy, user.role, router]);


    const currentFolders = useMemo(() => folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null')), [folders, selectedFolder]);
    const currentFolderDocs = useMemo(() => docs.filter((d) => String(d.folder_id ?? 'null') === String(selectedFolder ?? 'null')), [docs, selectedFolder]);
    const visibleDocs = useMemo(() => user.role === 'client' ? currentFolderDocs.filter((d) => d.client_visible !== false) : currentFolderDocs, [currentFolderDocs, user.role]);

    const sortItems = (items: any[], type: 'folder' | 'file') => {
        return [...items].sort((a: any, b: any) => {
            if (sortBy === 'name') {
                const nameA = type === 'folder' ? a.name : a.file_name;
                const nameB = type === 'folder' ? b.name : b.file_name;
                return (nameA || '').localeCompare(nameB || '');
            }
            if (sortBy === 'newest') {
                return new Date(b.createdAt || b.created_at || b.createdAt).getTime() - new Date(a.createdAt || a.created_at || a.createdAt).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.createdAt || a.created_at || a.createdAt).getTime() - new Date(b.createdAt || b.created_at || b.createdAt).getTime();
            }
            if (sortBy === 'size') {
                if (type === 'folder') return (a.name || '').localeCompare(b.name || '');
                return (b.file_size_mb || 0) - (a.file_size_mb || 0);
            }
            return 0;
        });
    };

    const sortedFolders = useMemo(() => sortItems(currentFolders, 'folder'), [currentFolders, sortBy]);
    const sortedDocs = useMemo(() => sortItems(visibleDocs, 'file'), [visibleDocs, sortBy]);

    const groups = useMemo(() => {
        if (sortBy === 'newest' || sortBy === 'oldest') {
            return groupItemsByMonth(sortedDocs, t);
        }
        return [];
    }, [sortedDocs, sortBy, t]);

    const availableMonthsByYear = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        groups.forEach(g => {
            const parts = g.title.split(' ');
            const year = parts[parts.length - 1];
            const month = parts.slice(0, parts.length - 1).join(' ');
            if (!map[year]) map[year] = new Set();
            map[year].add(month);
        });
        return map;
    }, [groups]);

    const availableYears = useMemo(() => Object.keys(availableMonthsByYear).sort((a, b) => b.localeCompare(a)), [availableMonthsByYear]);

    const prevShowMonthPicker = useRef(false);
    useEffect(() => {
        prevShowMonthPicker.current = showMonthPicker;
    }, [showMonthPicker]);

    const allMonths = useMemo(() => [
        t('months.january'), t('months.february'), t('months.march'), t('months.april'),
        t('months.may'), t('months.june'), t('months.july'), t('months.august'),
        t('months.september'), t('months.october'), t('months.november'), t('months.december')
    ], [t]);

    // Auto-correct month if year change makes it invalid
    useEffect(() => {
        if (showMonthPicker && tempYear && tempMonth && availableMonthsByYear[tempYear]) {
            if (!availableMonthsByYear[tempYear].has(tempMonth)) {
                const firstAvailable = Array.from(availableMonthsByYear[tempYear])[0];
                if (firstAvailable) setTempMonth(firstAvailable);
            }
        }
    }, [tempYear, availableMonthsByYear, showMonthPicker]);

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
                    <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: colors.text, textAlign: 'center', paddingHorizontal: 2 }}>{doc.file_name}</Text>
                    {doc.assignee && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                            <Text numberOfLines={1} style={{ fontSize: 7, color: colors.textMuted }}>{doc.assignee.name}</Text>
                            {doc.seen_at && (
                                <Feather name="check-circle" size={8} color="#f97316" />
                            )}
                        </View>
                    )}
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
                    {doc.only_for_reference && (
                        <View style={{
                            position: 'absolute',
                            top: '15%',
                            left: '20%',
                            right: '20%',
                            backgroundColor: 'rgba(59, 130, 246, 0.9)',
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20,
                            transform: [{ rotate: '10deg' }]
                        }}>
                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>OFR</Text>
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
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 9, color: colors.textMuted }}>{formatFileSize(doc.file_size_mb)}</Text>
                            {doc.assignee && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                                    <Feather name="user" size={8} color={colors.textMuted} />
                                    <Text style={{ fontSize: 8, color: colors.textMuted }}>{doc.assignee.name}</Text>
                                    {doc.seen_at && (
                                        <Feather name="check-circle" size={10} color="#f97316" />
                                    )}
                                </View>
                            )}
                        </View>
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

    const renderDocuments = () => {
        if (sortBy === 'newest' || sortBy === 'oldest') {
            const scrollToMonth = (title: string) => {
                const offset = monthOffsets[title];
                if (offset !== undefined) {
                    mainScrollRef.current?.scrollTo({ y: offset, animated: true });
                }
                setShowMonthPicker(false);
            };

            return (
                <>
                    {groups.map((group) => (
                        <View
                            key={group.title}
                            style={{ marginBottom: 20 }}
                            onLayout={(e) => {
                                const { y } = e.nativeEvent.layout;
                                setMonthOffsets(prev => ({ ...prev, [group.title]: y }));
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => {
                                    const parts = group.title.split(' ');
                                    setTempYear(parts[parts.length - 1]);
                                    setTempMonth(parts.slice(0, parts.length - 1).join(' '));
                                    setShowMonthPicker(true);
                                }}
                                style={{
                                    paddingVertical: 12,
                                    backgroundColor: 'transparent',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{group.title}</Text>
                                    <Feather name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 4, opacity: 0.7 }} />
                                </View>
                                <View style={{ height: 1, flex: 1, backgroundColor: colors.border, marginLeft: 12, opacity: 0.3 }} />
                            </TouchableOpacity>
                            <View style={{
                                flexDirection: viewMode === 'grid' ? 'row' : 'column',
                                flexWrap: viewMode === 'grid' ? 'wrap' : 'nowrap',
                                gap: viewMode === 'grid' ? 4 : 4
                            }}>
                                {group.data.map(renderDocItem)}
                            </View>
                        </View>
                    ))}

                    <Modal visible={showMonthPicker} transparent animationType="slide">
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                            <View style={{
                                backgroundColor: colors.surface,
                                borderTopLeftRadius: 24,
                                borderTopRightRadius: 24,
                                padding: 24,
                                paddingBottom: insets.bottom + 10,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: -4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 10,
                                elevation: 20
                            }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                                        <Text style={{ fontSize: 16, color: colors.primary }}>{t('projectDocuments.cancel')}</Text>
                                    </TouchableOpacity>
                                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('projectDocuments.selectMonth')}</Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const title = `${tempMonth} ${tempYear}`;
                                            scrollToMonth(title);
                                        }}
                                    >
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{t('projectDocuments.ok')}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Picker
                                        selectedValue={tempMonth}
                                        style={{ flex: 1.2, height: 200 }}
                                        itemStyle={{ fontSize: 18, color: colors.text }}
                                        onValueChange={(itemValue) => setTempMonth(itemValue)}
                                    >
                                        {allMonths.map(m => {
                                            const isAvailable = availableMonthsByYear[tempYear]?.has(m);
                                            if (!isAvailable) return null;
                                            return (
                                                <Picker.Item
                                                    key={m}
                                                    label={m}
                                                    value={m}
                                                    color={colors.text}
                                                />
                                            );
                                        })}
                                    </Picker>
                                    <Picker
                                        selectedValue={tempYear}
                                        style={{ flex: 0.8, height: 200 }}
                                        itemStyle={{ fontSize: 18, color: colors.text }}
                                        onValueChange={(itemValue) => setTempYear(itemValue)}
                                    >
                                        {availableYears.map(y => (
                                            <Picker.Item key={y} label={y} value={y} color={colors.text} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </>
            );
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
    };

    const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

    const goBack = useCallback(() => {
        if (!selectedFolder) return;
        const parentId = currentFolder?.parent_id != null ? String(currentFolder.parent_id) : null;
        setSelectedFolder(parentId);
        // Clear the deep-link folderId param so the useEffect sync doesn't override this navigation
        const returnTab = searchParams?.returnTab as string;
        if (returnTab) {
            const rParams: any = { tab: returnTab };
            if (searchParams.returnRfiId) rParams.rfiId = String(searchParams.returnRfiId);
            if (searchParams.returnSnagId) rParams.snagId = String(searchParams.returnSnagId);
            if (searchParams.returnFolderId) rParams.folderId = String(searchParams.returnFolderId);
            if (searchParams.returnFileId) rParams.fileId = String(searchParams.returnFileId);

            // Clear the return params by passing empty strings to router.setParams
            rParams.returnTab = '';
            rParams.returnRfiId = '';
            rParams.returnSnagId = '';
            rParams.returnFolderId = '';
            rParams.returnFileId = '';
            rParams.returnViewerTab = '';

            if (Platform.OS === 'ios') {
                setTimeout(() => {
                    router.setParams(rParams);
                }, 450);
            } else {
                router.setParams(rParams);
            }
        }

        // Clear the deep-link folderId param so the useEffect sync doesn't override this navigation
        router.setParams({ folderId: '' });


    }, [selectedFolder, currentFolder, router]);

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
            Alert.alert(t('projectDocuments.success'), t('projectDocuments.visibilityMarked', { status: !doc.client_visible ? t('projectDocuments.visible') : t('projectDocuments.hidden') }));
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateVisibility'));
        }
    };

    const toggleDocDoNotFollow = async (doc: any) => {
        try {
            await toggleDoNotFollow(doc.id, !doc.do_not_follow);
            setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, do_not_follow: !doc.do_not_follow } : d)));
            Alert.alert(t('projectDocuments.success'), t('projectDocuments.dnfMarked', { status: !doc.do_not_follow ? t('projectDocuments.marked') : t('projectDocuments.unmarked') }));
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateDnf'));
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
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateVisibility'));
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
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateDnf'));
            await fetchFolders(true);
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleOnlyForReference = async (file: any) => {
        try {
            setProcessing('ofr');
            await toggleOnlyForReference(file.id, !file.only_for_reference);

            // Local update
            setDocs((prev) => prev.map((d) => (d.id === file.id ? { ...d, only_for_reference: !file.only_for_reference } : d)));

            // Sync current doc in viewer
            if (currentDoc?.id === file.id) {
                setCurrentDoc((prev: any) => ({ ...prev, only_for_reference: !file.only_for_reference }));
            }

            setActionMenuVisible(false);
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateOfr') || 'Failed to update Only for Reference status');
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
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateVisibility'));
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
        openSubModalFromViewer(() => setShowRenameFile(true));
    };

    const handleArchiveFileAction = async (file: any) => {
        Alert.alert(
            t('projectDocuments.archive'),
            t('projectDocuments.archiveConfirm'),
            [
                { text: t('projectDocuments.cancel'), style: "cancel" },
                {
                    text: t('projectDocuments.archive'),
                    onPress: async () => {
                        try {
                            setProcessing('archive');
                            await archiveFile(file.id);
                            await fetchFolders(true);
                            setActionMenuVisible(false);
                            Alert.alert(t('projectDocuments.success'), t('projectDocuments.archiveSuccess'));
                        } catch (e) {
                            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToArchive'));
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
            checkAndRestoreViewer();
            setRenamingFileId(null);
            setRenamingFileName('');
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateFileName'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteFolderAction = async (folder: any) => {
        confirmDeleteFolder(folder);
    };

    const handleDeleteFile = async (file: any) => {
        Alert.alert(
            t('projectDocuments.deleteFile'),
            t('projectDocuments.deleteFileConfirm', { name: file.file_name }),
            [
                { text: t('projectDocuments.cancel'), style: "cancel" },
                {
                    text: t('projectDocuments.moveToTrash'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setProcessing('delete');
                            await deleteFile(file.id);
                            await fetchFolders(true);
                            setActionMenuVisible(false);
                        } catch (e) {
                            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToDeleteFile'));
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
                setShowInfoModal(false);

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

        // Mark as seen if assigned to current user
        if (doc.assigned_to && String(doc.assigned_to) === String(user?.id) && !doc.seen_at) {
            markFileSeen(doc.id).catch(console.error);
        }
    };

    const handleShare = async (doc: any) => {
        try {
            if (!doc.downloadUrl) return;
            console.log(doc);

            setSharing(true);

            // For files, we download to cache then share the local URI
            const ext = doc.file_name?.split('.').pop() || 'tmp';
            const localUri = `${(FileSystem as any).cacheDirectory}${doc.file_name || `file_${Date.now()}.${ext}`}`;

            // If it's a PDF and marked as 'Do Not Follow', download via backend to apply watermark
            let urlToDownload = doc.downloadUrl;
            let uri = '';

            if ((doc.do_not_follow || doc.only_for_reference) && (doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf'))) {
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
                    message: Platform.OS === 'android' ? `${doc.file_name}\n${urlToDownload}` : doc.file_name,
                    url: urlToDownload,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToShareDocument'));
        } finally {
            setSharing(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const lname = newFolderName.trim().toLowerCase();
        if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
            Alert.alert(t('projectDocuments.error'), "The name '" + newFolderName.trim() + "' is reserved for system use");
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
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToCreateFolder'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateFolder = async () => {
        if (!editFolderName.trim() || !editingFolderId) return;
        const lname = editFolderName.trim().toLowerCase();
        if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
            Alert.alert(t('projectDocuments.error'), "The name '" + editFolderName.trim() + "' is reserved for system use");
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
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateFolder'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (folder: any, force = false) => {
        try {
            setProcessing('delete_folder');
            const data = await deleteFolder(folder.id, force);
            setFolders(prev => prev.filter(f => f.id !== folder.id));
            setFolderMenuVisible(false);
            if (selectedFolder === String(folder.id)) {
                setSelectedFolder(folder.parent_id ? String(folder.parent_id) : null);
            }
            Alert.alert(
                t('projectDocuments.success'),
                data?.message || t('projectDocuments.folderDeletedSuccess'),
                [
                    {
                        text: t('projectDocuments.ok'),
                        onPress: () => {
                            if (selectedFolder === folder.id) setSelectedFolder(null);
                        }
                    }
                ]
            );
        } catch (e: any) {
            const data = e.response?.data;
            if (data?.hasContent) {
                Alert.alert(
                    t('projectDocuments.folderNotEmpty'),
                    t('projectDocuments.folderNotEmptyMessage', { name: folder.name }),
                    [
                        { text: t('projectDocuments.cancel'), style: 'cancel' },
                        {
                            text: t('projectDocuments.moveContents'),
                            onPress: () => {
                                const childFolders = folders.filter(f => String(f.parent_id) === String(folder.id));
                                const childFiles = docs.filter(p => String(p.folder_id) === String(folder.id));

                                if (childFolders.length === 0 && childFiles.length === 0) {
                                    Alert.alert(t('projectDocuments.info'), t('projectDocuments.folderAlreadyEmpty'));
                                    return;
                                }

                                setMovingContentsOf(folder);
                                setMovingItem(null);
                                setShowMoveDialog(true);
                            }
                        },
                        {
                            text: t('projectDocuments.deleteEverything'),
                            style: 'destructive',
                            onPress: () => handleDelete(folder, true)
                        }
                    ]
                );
            } else {
                const msg = data?.error || t('projectDocuments.failedToDeleteFolder');
                Alert.alert(t('projectDocuments.error'), msg);
            }
        } finally {
            setProcessing(null);
        }
    };

    const confirmDeleteFolder = (folder: any) => {
        Alert.alert(
            t('projectDocuments.deleteFolder'),
            t('projectDocuments.deleteFolderConfirm', { name: folder.name }),
            [
                { text: t('projectDocuments.cancel'), style: 'cancel' },
                {
                    text: t('projectDocuments.moveToTrash'),
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
            Alert.alert(t('projectDocuments.success'), t('projectDocuments.visibilityUpdated'));
            // Refresh
            const data = await getProjectFiles(project.id, 'document');
            if (data.folderData) setFolders(data.folderData);
            if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
            clearSelection();
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateVisibility'));
        } finally {
            setProcessing(null);
        }
    };

    const handleBulkDoNotFollow = async (value: boolean) => {
        try {
            if (selectedFiles.size > 0) {
                setProcessing('bulk_dnf');
                await bulkUpdateFiles({ ids: Array.from(selectedFiles), do_not_follow: value });
                Alert.alert(t('projectDocuments.success'), t('projectDocuments.dnfStatusUpdated'));
                // Refresh
                const data = await getProjectFiles(project.id);
                if (data.folderData) setFolders(data.folderData);
                if (data.fileData) setDocs(data.fileData.filter((file: any) => !file.file_type?.startsWith('image/')));
                clearSelection();
            }
        } catch (e) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUpdateDnf'));
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
            Alert.alert(t('projectDocuments.info'), t('projectDocuments.selectAtLeastOneShare'));
        }
    };

    const handleShareProject = async () => {
        try {
            const { getProjectShareLinks } = require('@/services/projectService');
            const links = await getProjectShareLinks(project.id, user.role);
            const link = user.role === 'client' ? links.clientLink : links.contributorLink;
            if (link) {
                await Share.share({
                    message: t('projectDocuments.joinProjectMessage', { projectName: project.name, link }),
                });
            } else {
                Alert.alert(t('projectDocuments.info'), t('projectDocuments.shareLinkNotAvailable'));
            }
        } catch (error) {
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToGetShareLink'));
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

            if ((doc.do_not_follow || doc.only_for_reference) && (doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf'))) {
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
                    dialogTitle: doc.file_name || t('projectDocuments.document')
                });
            } else {
                await Share.share({
                    title: doc.file_name,
                    url: urlToDownload,
                });
            }
        } catch (e) {
            console.error('Share error:', e);
            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToShareDocument'));
        } finally {
            setProcessing(null);
        }
    };

    const goBackRef = useRef(goBack);
    const clearSelectionRef = useRef(clearSelection);
    const selectedFolderRef = useRef(selectedFolder);
    const isSelectionModeRef = useRef(isSelectionMode);
    const isViewerOpenRef = useRef(!!pdfViewerUrl);

    useEffect(() => {
        goBackRef.current = goBack;
        clearSelectionRef.current = clearSelection;
        selectedFolderRef.current = selectedFolder;
        isSelectionModeRef.current = isSelectionMode;
        isViewerOpenRef.current = !!pdfViewerUrl;
    }, [goBack, clearSelection, selectedFolder, isSelectionMode, pdfViewerUrl]);

    const edgePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (Platform.OS !== 'ios' || !selectedFolderRef.current || isViewerOpenRef.current) {
                    return false;
                }
                const isEdgeStart = gestureState.x0 < 40;
                const isHorizontalSwipeRight = gestureState.dx > 20 && Math.abs(gestureState.dy) < 20;
                return isEdgeStart && isHorizontalSwipeRight;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 40) {
                    if (isSelectionModeRef.current) {
                        clearSelectionRef.current();
                    } else {
                        goBackRef.current();
                    }
                }
            },
            onPanResponderTerminationRequest: () => false,
        })
    ).current;

    // Unified View
    return (
        <View style={{ flex: 1 }} {...(Platform.OS === 'ios' && selectedFolder ? edgePanResponder.panHandlers : {})}>
            <ScrollView
                ref={mainScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 14 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'contributor') ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder || ''}`)}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>{t('projectDocuments.uploadDocument')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>{t('projectDocuments.newFolder')}</Text>
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
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{t(`projectDocuments.sortBy.${sortBy}`)}</Text>
                    </TouchableOpacity>
                </View>

                {selectedFolder && (linkedRFIs.length > 0 || linkedSnags.length > 0) && (
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
                            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'files' ? colors.primary : colors.textMuted }}>{t('projectDocuments.filesCount', { count: sortedFolders.length + sortedDocs.length })}</Text>
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
                            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'rfis' ? colors.primary : colors.textMuted }}>{t('projectDocuments.linkedItemsCount', { count: linkedRFIs.length + linkedSnags.length }) || `Linked RFIs & Snags (${linkedRFIs.length + linkedSnags.length})`}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activeFolderTab === 'rfis' ? (
                    <View style={{ gap: 16 }}>
                        {loadingRFIs ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <>
                                {/* Sub-tab selector */}
                                <View style={{
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    gap: 32,
                                    marginBottom: 16,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                    paddingHorizontal: 16
                                }}>
                                    <TouchableOpacity
                                        onPress={() => setActiveLinkedSubTab('rfis')}
                                        style={{
                                            paddingVertical: 10,
                                            paddingHorizontal: 8,
                                            position: 'relative'
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 13,
                                            fontWeight: '700',
                                            color: activeLinkedSubTab === 'rfis' ? colors.primary : colors.textMuted
                                        }}>
                                            RFIs ({linkedRFIs.length})
                                        </Text>
                                        {activeLinkedSubTab === 'rfis' && (
                                            <View style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: 3,
                                                backgroundColor: colors.primary,
                                                borderTopLeftRadius: 3,
                                                borderTopRightRadius: 3
                                            }} />
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setActiveLinkedSubTab('snags')}
                                        style={{
                                            paddingVertical: 10,
                                            paddingHorizontal: 8,
                                            position: 'relative'
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 13,
                                            fontWeight: '700',
                                            color: activeLinkedSubTab === 'snags' ? colors.primary : colors.textMuted
                                        }}>
                                            Snags ({linkedSnags.length})
                                        </Text>
                                        {activeLinkedSubTab === 'snags' && (
                                            <View style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                height: 3,
                                                backgroundColor: colors.primary,
                                                borderTopLeftRadius: 3,
                                                borderTopRightRadius: 3
                                            }} />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Linked RFIs Section */}
                                {activeLinkedSubTab === 'rfis' && (
                                    linkedRFIs.length > 0 ? (
                                        <View style={{ gap: 10 }}>
                                            {linkedRFIs.map((rfi) => (
                                                <TouchableOpacity
                                                    key={rfi.id}
                                                    onPress={() => {
                                                        const returnContext = {
                                                            returnTab: 'documents',
                                                            returnFolderId: selectedFolder ? String(selectedFolder) : '',
                                                            returnFolderActiveTab: 'rfis',
                                                        };
                                                        router.setParams({ tab: 'rfi', rfiId: String(rfi.id), fileId: '', ...returnContext });
                                                    }}
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
                                                                <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{rfi.assignee?.name || t('projectDocuments.unassigned')}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                            <Feather name="link-2" size={32} color={colors.border} />
                                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t('projectDocuments.noRfisLinked')}</Text>
                                        </View>
                                    )
                                )}

                                {/* Linked Snags Section */}
                                {activeLinkedSubTab === 'snags' && (
                                    linkedSnags.length > 0 ? (
                                        <View style={{ gap: 10 }}>
                                            {linkedSnags.map((snag) => (
                                                <TouchableOpacity
                                                    key={snag.id}
                                                    onPress={() => {
                                                        const returnContext = {
                                                            returnTab: 'documents',
                                                            returnFolderId: selectedFolder ? String(selectedFolder) : '',
                                                            returnFolderActiveTab: 'rfis',
                                                        };
                                                        router.setParams({ tab: 'snags', snagId: String(snag.id), fileId: '', ...returnContext });
                                                    }}
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
                                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{snag.title}</Text>
                                                            <View style={{
                                                                paddingHorizontal: 8,
                                                                paddingVertical: 2,
                                                                borderRadius: 6,
                                                                backgroundColor: snag.status === 'amber' ? 'rgba(245,158,11,0.1)' : snag.status === 'green' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                                                            }}>
                                                                <Text style={{
                                                                    fontSize: 9,
                                                                    fontWeight: '800',
                                                                    textTransform: 'uppercase',
                                                                    color: snag.status === 'amber' ? '#f59e0b' : snag.status === 'green' ? '#22c55e' : '#ef4444'
                                                                }}>
                                                                    {snag.status === 'amber' ? t('projectSnags.status.waiting') :
                                                                        snag.status === 'green' ? t('projectSnags.status.completed') :
                                                                            t('projectSnags.status.noAction')}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Feather name="calendar" size={10} color={colors.textMuted} />
                                                                <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(snag.createdAt).toLocaleDateString()}</Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Feather name="user" size={10} color={colors.textMuted} />
                                                                <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{snag.assignee?.name || t('projectDocuments.unassigned')}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                            <Feather name="link-2" size={32} color={colors.border} />
                                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>No Snags Linked</Text>
                                        </View>
                                    )
                                )}
                            </>
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
                                const isConfirmationFolder = folder.name.toLowerCase() === 'confirmation' || folder.name.toLowerCase() === 'confirmations';
                                const isConfidentialFolder = folder.name.toLowerCase() === 'confidential';
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
                                            <Feather
                                                name={isArchiveFolder ? "archive" : isConfirmationFolder ? "check-circle" : isConfidentialFolder ? "shield" : "folder"}
                                                size={(isConfirmationFolder || isConfidentialFolder) ? 32 : 36}
                                                color={isArchiveFolder ? '#94a3b8' : (isConfirmationFolder ? '#fb923c' : (isConfidentialFolder ? '#f43f5e' : colors.primary))}
                                            />
                                        </View>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.primary, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: isArchiveFolder ? '#64748b' : (isConfirmationFolder ? '#f97316' : (isConfidentialFolder ? '#e11d48' : colors.text)), textAlign: 'center' }}>{isArchiveFolder ? t('projectDocuments.archive') : (isConfirmationFolder ? "Confirmations" : folder.name)}</Text>
                                        <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>
                                            {subcount > 0
                                                ? t('projectDocuments.filesFoldersCount', { fileCount: count, folderCount: subcount })
                                                : t('projectDocuments.filesOnlyCount', { count: count })}
                                        </Text>
                                        {/* Folder Action Menu - Hidden for Clients */}
                                        {!isSelectionMode && user.role !== 'client' && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                            <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}>
                                                {!isConfirmationFolder && !isArchiveFolder && !isConfidentialFolder && (
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
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {!loading && currentFolders.length === 0 && visibleDocs.length === 0 && (
                            <View style={{ marginTop: 20, marginBottom: 10, alignItems: 'center' }}>
                                <Feather name="folder" size={32} color={colors.border} />
                                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>{t('projectDocuments.noFoldersDocs')}</Text>
                            </View>
                        )}

                        <View style={{ marginTop: sortedFolders.length > 0 ? 12 : 0 }}>
                            {renderDocuments()}
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
                    setShowInfoModal(false);
                    const returnTab = searchParams?.returnTab as string;
                    if (returnTab) {
                        const rParams: any = { tab: returnTab };
                        if (searchParams.returnRfiId) rParams.rfiId = String(searchParams.returnRfiId);
                        if (searchParams.returnSnagId) rParams.snagId = String(searchParams.returnSnagId);
                        if (searchParams.returnFolderId) rParams.folderId = String(searchParams.returnFolderId);
                        if (searchParams.returnFileId) {
                            rParams.fileId = String(searchParams.returnFileId);
                            rParams.viewerTab = 'links';
                        } else {
                            rParams.fileId = '';
                            if (searchParams.returnFolderActiveTab) rParams.returnFolderActiveTab = String(searchParams.returnFolderActiveTab);
                        }
                        // Clear the return params from the query state
                        rParams.returnTab = '';
                        rParams.returnRfiId = '';
                        rParams.returnSnagId = '';
                        rParams.returnFolderId = '';
                        rParams.returnFileId = '';
                        rParams.returnFolderActiveTab = '';


                        if (Platform.OS === 'ios') {
                            setTimeout(() => {
                                router.setParams(rParams);
                            }, 450);
                        } else {
                            router.setParams(rParams);
                        }
                    }
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
                                setShowInfoModal(false);
                                const returnTab = searchParams?.returnTab as string;
                                if (returnTab) {
                                    const rParams: any = { tab: returnTab };
                                    if (searchParams.returnRfiId) rParams.rfiId = String(searchParams.returnRfiId);
                                    if (searchParams.returnSnagId) rParams.snagId = String(searchParams.returnSnagId);
                                    if (searchParams.returnFolderId) rParams.folderId = String(searchParams.returnFolderId);
                                    if (searchParams.returnViewerTab) {
                                        rParams.viewerTab = 'links';
                                    }
                                    if (searchParams.returnFileId) {
                                        rParams.fileId = String(searchParams.returnFileId);

                                    } else {
                                        rParams.fileId = '';
                                        if (searchParams.returnFolderActiveTab) rParams.returnFolderActiveTab = String(searchParams.returnFolderActiveTab);
                                    }

                                    // Clear the return params from the query state
                                    rParams.returnTab = '';
                                    rParams.returnRfiId = '';
                                    rParams.returnSnagId = '';
                                    rParams.returnFolderId = '';
                                    rParams.returnFileId = '';
                                    rParams.returnFolderActiveTab = '';
                                    if (Platform.OS === 'ios') {
                                        setTimeout(() => {
                                            router.setParams(rParams);
                                        }, 450);
                                    } else {
                                        router.setParams(rParams);
                                    }
                                }
                            }}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        >
                            <Feather name="x" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text numberOfLines={1} style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', marginHorizontal: 12 }}>
                            {pdfViewerName}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={() => openSubModalFromViewer(() => setShowInfoModal(true))} style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                <Feather name="info" size={18} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openSubModalFromViewer(() => setShowLinkModal(true))} style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                <Feather name="link" size={18} color="#fff" />
                            </TouchableOpacity>
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
                            {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setActiveActionFile(currentDoc);
                                        setActionMenuVisible(true);
                                    }}
                                    style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <Feather name="more-vertical" size={18} color="#fff" />
                                </TouchableOpacity>
                            )}
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

                    <View pointerEvents={keyboardHeight > 0 ? 'none' : 'auto'} style={{ flex: 1, position: 'relative' }}>
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
                                                {t('projectDocuments.optimizingView')}
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
                                        <Text style={{ color: '#fff' }}>{t('projectDocuments.viewerNotAvailable')}</Text>
                                    </View>
                                )
                            )
                        )}

                        {/* Watermark Overlays */}
                        {(currentDoc?.do_not_follow || currentDoc?.only_for_reference) && (
                            <View
                                pointerEvents="none"
                                style={{
                                    ...StyleSheet.absoluteFillObject,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    zIndex: 100, // Very high zIndex to ensure it's above native components
                                    gap: 40 // Add spacing if both are present
                                }}
                            >
                                {currentDoc?.do_not_follow && (
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
                                            {t('projectDocuments.doNotFollow')}
                                        </Text>
                                    </View>
                                )}
                                {currentDoc?.only_for_reference && (
                                    <View style={{
                                        transform: [{ rotate: '-30deg' }],
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        paddingHorizontal: 30,
                                        paddingVertical: 15,
                                        borderRadius: 8,
                                        borderWidth: 3,
                                        borderColor: 'rgba(59, 130, 246, 0.3)',
                                        borderStyle: 'dashed'
                                    }}>
                                        <Text style={{
                                            color: 'rgba(59, 130, 246, 0.4)',
                                            fontSize: 48,
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            letterSpacing: 2,
                                            textAlign: 'center'
                                        }}>
                                            {t('projectDocuments.onlyForReference')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Comments Overlay Panel */}
                    {showComments && (
                        <View
                            style={{
                                position: 'absolute',
                                bottom: Platform.OS === 'ios' ? keyboardHeight : 0,
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
                            <ScrollView
                                keyboardShouldPersistTaps="always"
                                scrollEnabled={true}
                                bounces={false}
                                alwaysBounceVertical={false}
                                contentContainerStyle={{ padding: 16 }}
                            >
                                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>
                                        💬 {t('projectDocuments.discussion')} ({docComments.length})
                                    </Text>
                                </View>

                                {commentLoading ? (
                                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                                ) : (
                                    <ScrollView
                                        style={{ maxHeight: SCREEN_H * 0.35 }}
                                        contentContainerStyle={{ paddingBottom: 10 }}
                                        showsVerticalScrollIndicator={true}
                                        keyboardShouldPersistTaps="always"
                                    >
                                        {docComments.length === 0 && (
                                            <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginVertical: 20 }}>{t('projectDocuments.noComments')}</Text>
                                        )}
                                        {docComments.map((c: any) => (
                                            <View key={c.id} style={{ marginBottom: 12 }}>
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{c.user?.name || t('projectDocuments.user')}</Text>
                                                        <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                                            <Text style={{ color: '#888', fontSize: 10 }}>↩ {t('projectDocuments.reply')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <Text style={{ color: '#eee', fontSize: 12, lineHeight: 18 }}>
                                                        {renderCommentText(c.text)}
                                                    </Text>
                                                </View>
                                                {c.replies?.map((r: any) => (
                                                    <View key={r.id} style={{ marginLeft: 16, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 8, borderLeftWidth: 2, borderLeftColor: colors.primary }}>
                                                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{r.user?.name || t('projectDocuments.user')}</Text>
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
                                        <Text style={{ color: colors.primary, fontSize: 10 }}>{t('projectDocuments.replyingTo')}</Text>
                                        <TouchableOpacity onPress={() => setReplyTo(null)}>
                                            <Feather name="x-circle" size={12} color="#888" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showMentions && (
                                    <View style={{ position: 'absolute', bottom: 65, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 }}>
                                        <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="always">
                                            {projectMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).map((m) => (
                                                <GestureTouchableOpacity
                                                    key={m.id}
                                                    onPress={() => handleSelectMention(m)}
                                                >
                                                    <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{m.name.substring(0, 1).toUpperCase()}</Text>
                                                        </View>
                                                        <Text style={{ color: '#fff', fontSize: 12 }}>{m.name}</Text>
                                                    </View>
                                                </GestureTouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <ScrollView
                                    keyboardShouldPersistTaps="always"
                                    scrollEnabled={false}
                                    style={{ width: '100%', flexGrow: 0 }}
                                >

                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 }}>
                                        <TextInput
                                            ref={commentInputRef}
                                            value={commentText}
                                            onChangeText={handleInputChange}
                                            placeholder={t('projectDocuments.addCommentPlaceholder')}
                                            placeholderTextColor="#666"
                                            style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, color: '#fff', fontSize: 13 }}
                                        />
                                        <GestureTouchableOpacity
                                            onPress={handleAddComment}
                                            disabled={addingComment || !commentText.trim()}
                                        >
                                            <View style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: colors.primary,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: (!commentText.trim() || addingComment) ? 0.5 : 1
                                            }}>
                                                {addingComment
                                                    ? <ActivityIndicator size="small" color="#fff" />
                                                    : <Feather name="send" size={16} color="#fff" />
                                                }
                                            </View>
                                        </GestureTouchableOpacity>
                                    </View>
                                </ScrollView>
                                <View style={{ height: Math.max(insets.bottom, 10) }} />
                            </ScrollView>
                        </View>
                    )}


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
                                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('projectDocuments.preparing')}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('projectDocuments.downloadingToShare')}</Text>
                            </View>
                        </View>
                    )}

                    <FileActionMenu
                        isVisible={actionMenuVisible && !!pdfViewerUrl}
                        onClose={() => setActionMenuVisible(false)}
                        onHideUnhide={() => handleToggleVisibility(activeActionFile)}
                        onDoNotFollow={() => handleToggleDoNotFollow(activeActionFile)}
                        onOnlyForReference={() => handleToggleOnlyForReference(activeActionFile)}
                        onDelete={() => handleDeleteFile(activeActionFile)}
                        onArchive={() => handleArchiveFileAction(activeActionFile)}
                        onUnarchive={() => handleUnarchiveFile(activeActionFile)}
                        onShare={() => handleShareDoc(activeActionFile)}
                        onRename={() => handleRenameFileAction(activeActionFile)}
                        onCreateRfi={() => handleStartCreateRfi(activeActionFile)}
                        clientVisible={activeActionFile?.client_visible !== false}
                        doNotFollow={activeActionFile?.do_not_follow === true}
                        onlyForReference={activeActionFile?.only_for_reference === true}
                        canDelete={false}
                        showArchive={!currentFolder?.name.toLowerCase().includes('archive')}
                        isArchived={folders.find(f => f.id === activeActionFile?.folder_id)?.name.toLowerCase() === 'archive'}
                        canRename={['admin', 'superadmin', 'contributor'].includes(user.role) && !currentFolder?.name.toLowerCase().includes('archive')}
                        isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                        isContributor={user.role === 'contributor'}
                        isUploader={activeActionFile && String(activeActionFile.created_by) === String(user.id)}
                        fileName={activeActionFile?.file_name || ''}
                        processingAction={processing}
                        useView={Platform.OS === 'ios'}
                    />
                </View>
            </Modal>

            {showLinkModal && currentDoc?.id && (
                <LinkFileModal
                    visible={showLinkModal}
                    onClose={() => { setShowLinkModal(false); checkAndRestoreViewer(); }}
                    onLink={handleLinkFile}
                    projectId={project.id}
                    currentFileId={currentDoc.id}
                    handleLinkItemClick={handleLinkItemClick}
                />
            )}

            <FileInformationModal
                visible={showInfoModal}
                onClose={() => { setShowInfoModal(false); checkAndRestoreViewer(); }}
                file={currentDoc}
                folders={folders}
                projectName={project?.name || ''}
            />

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
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('projectDocuments.preparing')}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('projectDocuments.downloadingToShare')}</Text>
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
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('projectDocuments.openingDocument')}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('projectDocuments.downloadingForPreview')}</Text>
                    </View>
                </View>
            )}

            {/* New Folder Modal */}
            <Modal visible={showCreateFolder} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectDocuments.newFolder')}</Text>
                        <TextInput
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            placeholder={t('projectDocuments.folderNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectDocuments.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectDocuments.creating') : t('projectDocuments.create')}</Text>
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

                                {/* Visibility Toggle - Admin */}
                                {(user.role === 'admin' || user.role === 'superadmin') && (
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
                                {(user.role === 'admin' || user.role === 'superadmin' || (user.role === 'contributor' && Array.from(selectedFiles).every(id => {
                                    const file = docs.find(d => d.id === id);
                                    return file && String(file.created_by) === String(user.id);
                                }))) && selectedFiles.size > 0 && (
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
                                {((selectedFolders.size > 0 && (user.role === 'admin' || user.role === 'superadmin')) || (selectedFiles.size > 0)) && !currentFolder?.name.toLowerCase().includes('archive') && (
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
                            Alert.alert(t('projectDocuments.success'), t('projectDocuments.unarchiveSuccess'));
                        } catch (e) {
                            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToUnarchive'));
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
                            Alert.alert(t('projectDocuments.success'), t('projectDocuments.folderDeletedMovingContents', { name: movingContentsOf.name }));
                        } catch (err) {
                            Alert.alert(t('projectDocuments.error'), t('projectDocuments.failedToDeleteEmptyFolder'));
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
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectDocuments.renameFolder')}</Text>
                        <TextInput
                            value={editFolderName}
                            onChangeText={setEditFolderName}
                            placeholder={t('projectDocuments.folderNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowEditFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectDocuments.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectDocuments.updating') : t('projectDocuments.update')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Rename File Modal */}
            <Modal visible={showRenameFile} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectDocuments.renameFile')}</Text>
                        <TextInput
                            value={renamingFileName}
                            onChangeText={setRenamingFileName}
                            placeholder={t('projectDocuments.fileNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={closeRenameFileModal} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectDocuments.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFile} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectDocuments.updating') : t('projectDocuments.update')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


            <FileActionMenu
                isVisible={actionMenuVisible && !pdfViewerUrl}
                onClose={() => setActionMenuVisible(false)}
                onHideUnhide={() => handleToggleVisibility(activeActionFile)}
                onDoNotFollow={() => handleToggleDoNotFollow(activeActionFile)}
                onOnlyForReference={() => handleToggleOnlyForReference(activeActionFile)}
                onDelete={() => handleDeleteFile(activeActionFile)}
                onArchive={() => handleArchiveFileAction(activeActionFile)}
                onUnarchive={() => handleUnarchiveFile(activeActionFile)}
                onShare={() => handleShareDoc(activeActionFile)}
                onRename={() => handleRenameFileAction(activeActionFile)}
                onCreateRfi={() => handleStartCreateRfi(activeActionFile)}
                clientVisible={activeActionFile?.client_visible !== false}
                doNotFollow={activeActionFile?.do_not_follow === true}
                onlyForReference={activeActionFile?.only_for_reference === true}
                canDelete={false} // Disable delete in Docs
                showArchive={!currentFolder?.name.toLowerCase().includes('archive')}
                isArchived={folders.find(f => f.id === activeActionFile?.folder_id)?.name.toLowerCase() === 'archive'}
                canRename={['admin', 'superadmin', 'contributor'].includes(user.role) && !currentFolder?.name.toLowerCase().includes('archive')}
                isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                isContributor={user.role === 'contributor'}
                isUploader={activeActionFile && String(activeActionFile.created_by) === String(user.id)}
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

            {/* Create RFI Modal */}
            <Modal visible={showCreateRfiModal} transparent animationType="slide" onRequestClose={closeCreateRfiModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Create RFI from Document</Text>
                                <TouchableOpacity onPress={closeCreateRfiModal}>
                                    <Feather name="x" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Title <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <TextInput
                                    value={rfiTitle}
                                    onChangeText={setRfiTitle}
                                    placeholder="Enter RFI title"
                                    placeholderTextColor={colors.textMuted}
                                    style={{ height: 44, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13 }}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Description</Text>
                                <TextInput
                                    value={rfiDesc}
                                    onChangeText={setRfiDesc}
                                    placeholder="Enter RFI description (optional)"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    style={{ minHeight: 80, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 13, textAlignVertical: 'top' }}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Assignee <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <TouchableOpacity
                                    onPress={() => setShowRfiAssigneeDropdown(true)}
                                    style={{
                                        height: 44,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: rfiAssignedToId ? colors.primary : colors.border,
                                        paddingHorizontal: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: rfiAssignedToId ? colors.text : colors.textMuted }}>
                                        {rfiAssignedToId
                                            ? rfiAssignees.find(a => a.id === rfiAssignedToId)?.name || "Select Assignee"
                                            : "Select Assignee"}
                                    </Text>
                                    <Feather name="chevron-down" size={18} color={rfiAssignedToId ? colors.primary : colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Expiry Date</Text>
                                <TouchableOpacity
                                    onPress={() => setShowRfiDatePicker(true)}
                                    style={{
                                        height: 44,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        paddingHorizontal: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: rfiExpiryDate ? rfiExpiryDate.toLocaleDateString() : "Select Date" }}>
                                        {rfiExpiryDate ? rfiExpiryDate.toLocaleDateString() : "Select Date"}
                                    </Text>
                                    <Feather name="calendar" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                                {showRfiDatePicker && (
                                    <DateTimePicker
                                        value={rfiExpiryDate || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => {
                                            setShowRfiDatePicker(Platform.OS === 'ios');
                                            if (date) {
                                                setRfiExpiryDate(date);
                                            }
                                        }}
                                    />
                                )}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <TouchableOpacity
                                    onPress={closeCreateRfiModal}
                                    style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleCreateRfiFromDoc}
                                    disabled={submittingEntity}
                                    style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                                        {submittingEntity ? "Creating..." : "Create RFI"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {/* RFI Assignee Dropdown Picker Modal */}
                            <Modal visible={showRfiAssigneeDropdown} animationType="fade" transparent onRequestClose={() => setShowRfiAssigneeDropdown(false)}>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
                                    onPress={() => setShowRfiAssigneeDropdown(false)}
                                >
                                    <TouchableOpacity activeOpacity={1} onPress={() => { }} style={{ maxHeight: '70%' }}>
                                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Assign To</Text>
                                            </View>
                                            <ScrollView keyboardShouldPersistTaps="handled">
                                                {rfiAssignees.map((a) => (
                                                    <TouchableOpacity
                                                        key={a.id}
                                                        onPress={() => { setRfiAssignedToId(a.id); setShowRfiAssigneeDropdown(false); }}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            paddingHorizontal: 16,
                                                            paddingVertical: 14,
                                                            borderBottomWidth: 1,
                                                            borderBottomColor: colors.border,
                                                            backgroundColor: rfiAssignedToId === a.id ? colors.primary + '10' : 'transparent',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 14, color: colors.text, fontWeight: rfiAssignedToId === a.id ? '600' : '400' }}>
                                                            {a.name} ({a.role})
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </Modal>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Create Snag Modal */}
            <Modal visible={showCreateSnagModal} transparent animationType="slide" onRequestClose={closeCreateSnagModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Create Snag from Document</Text>
                                <TouchableOpacity onPress={closeCreateSnagModal}>
                                    <Feather name="x" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Title <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <TextInput
                                    value={snagTitle}
                                    onChangeText={setSnagTitle}
                                    placeholder="Enter snag title"
                                    placeholderTextColor={colors.textMuted}
                                    style={{ height: 44, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13 }}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Description</Text>
                                <TextInput
                                    value={snagDesc}
                                    onChangeText={setSnagDesc}
                                    placeholder="Enter snag description (optional)"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    style={{ minHeight: 80, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 13, textAlignVertical: 'top' }}
                                />
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Assignee <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <TouchableOpacity
                                    onPress={() => setShowSnagAssigneeDropdown(true)}
                                    style={{
                                        height: 44,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: snagAssignedToId ? colors.primary : colors.border,
                                        paddingHorizontal: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: snagAssignedToId ? colors.text : colors.textMuted }}>
                                        {snagAssignedToId
                                            ? snagAssignees.find(a => a.id === snagAssignedToId)?.name || "Select Assignee"
                                            : "Select Assignee"}
                                    </Text>
                                    <Feather name="chevron-down" size={18} color={snagAssignedToId ? colors.primary : colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <TouchableOpacity
                                    onPress={closeCreateSnagModal}
                                    style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleCreateSnagFromDoc}
                                    disabled={submittingEntity}
                                    style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                                        {submittingEntity ? "Creating..." : "Create Snag"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {/* Snag Assignee Dropdown Picker Modal */}
                            <Modal visible={showSnagAssigneeDropdown} animationType="fade" transparent onRequestClose={() => setShowSnagAssigneeDropdown(false)}>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
                                    onPress={() => setShowSnagAssigneeDropdown(false)}
                                >
                                    <TouchableOpacity activeOpacity={1} onPress={() => { }} style={{ maxHeight: '70%' }}>
                                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Assign To</Text>
                                            </View>
                                            <ScrollView keyboardShouldPersistTaps="handled">
                                                {snagAssignees.map((a) => (
                                                    <TouchableOpacity
                                                        key={a.id}
                                                        onPress={() => { setSnagAssignedToId(a.id); setShowSnagAssigneeDropdown(false); }}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            paddingHorizontal: 16,
                                                            paddingVertical: 14,
                                                            borderBottomWidth: 1,
                                                            borderBottomColor: colors.border,
                                                            backgroundColor: snagAssignedToId === a.id ? colors.primary + '10' : 'transparent',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 14, color: colors.text, fontWeight: snagAssignedToId === a.id ? '600' : '400' }}>
                                                            {a.name} ({a.role})
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </Modal>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

        </View>
    );
}
