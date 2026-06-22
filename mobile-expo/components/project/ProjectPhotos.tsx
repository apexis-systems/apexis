import {
    View, TouchableOpacity, Alert, Modal, Share as RNShare, Dimensions, StatusBar, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, BackHandler, StyleSheet, RefreshControl, Keyboard, PanResponder
} from 'react-native';
import { Image } from 'expo-image';
import { FlatList, TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import { Text, TextInput } from '@/components/ui/AppText';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility, bulkUpdateFolders, updateFolder, deleteFolder } from '@/services/folderService';
import { getProjectFiles, deleteFile, bulkDeleteFiles, toggleFileVisibility, bulkUpdateFiles, archiveFile, unarchiveFile, getLinkedItems, linkFiles, deleteLink } from '@/services/fileService';
import { getMemberForTag, getProjectMembers } from '@/services/projectService';
import { getComments, addComment as addCommentApi, deleteComment as deleteCommentApi, updateComment as updateCommentApi, type CommentThread } from '@/services/commentService';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { setActiveProjectContext } from '@/utils/projectSelection';
import { formatFileSize } from '@/helpers/format';
import { groupItemsByMonth } from '@/helpers/grouping';
import MobileMoveToFolderDialog from './MobileMoveToFolderDialog';
import LinkFileModal from '../shared/LinkFileModal';
import FileInformationModal from '../shared/FileInformationModal';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ZoomableImage from '../shared/ZoomableImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FileActionMenu from './FileActionMenu';
import FolderActionMenu from './FolderActionMenu';
import { getFolderRFIs, getRFIAssignees, createRFI } from '@/services/rfiService';
import { getFolderSnags, getAssignees as getSnagAssignees, createSnag } from '@/services/snagService';
import DateTimePicker from '@react-native-community/datetimepicker';

// Removed local ZoomableImage

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectPhotos({ project, user, initialFolderId, initialFileId, searchQuery, onFolderChange }: { project: any; user: any; initialFolderId?: string; initialFileId?: string; searchQuery?: string; onFolderChange?: (folderId: string | null) => void }) {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const searchParams = useLocalSearchParams();
    const [photos, setPhotos] = useState<any[]>([]);
    const [activeFolderTab, setActiveFolderTab] = useState<'files' | 'rfis'>('files');
    const [activeLinkedSubTab, setActiveLinkedSubTab] = useState<'rfis' | 'snags'>('rfis');
    const [linkedRFIs, setLinkedRFIs] = useState<any[]>([]);
    const [linkedSnags, setLinkedSnags] = useState<any[]>([]);
    const [loadingRFIs, setLoadingRFIs] = useState(false);
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
    }, [initialFileId, initialFileId, searchQuery]);
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
    const [showRenameFile, setShowRenameFile] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState<number | null>(null);
    const [renamingFileName, setRenamingFileName] = useState('');

    // Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const viewerOpenRef = useRef(viewerOpen);
    useEffect(() => {
        viewerOpenRef.current = viewerOpen;
    }, [viewerOpen]);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [isViewerZoomed, setIsViewerZoomed] = useState(false);
    const [showViewerUI, setShowViewerUI] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [sharing, setSharing] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const isUserScrollingRef = useRef(false);
    const [viewerActiveTab, setViewerActiveTab] = useState<'discussion' | 'links'>('discussion');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [linkedItems, setLinkedItems] = useState<any[]>([]);

    const restoreViewerIndexRef = useRef<number | null>(null);

    const openSubModalFromViewer = (openModalFn: () => void) => {
        restoreViewerIndexRef.current = viewerIndex;
        setViewerOpen(false);
        setTimeout(() => {
            openModalFn();
        }, Platform.OS === 'ios' ? 350 : 0);
    };

    const checkAndRestoreViewer = () => {
        if (restoreViewerIndexRef.current !== null) {
            const indexToRestore = restoreViewerIndexRef.current;
            restoreViewerIndexRef.current = null;
            setTimeout(() => {
                setViewerOpen(true);
                setViewerIndex(indexToRestore);
            }, Platform.OS === 'ios' ? 350 : 0);
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

    // Comment state
    const commentInputRef = useRef<any>(null);
    const [photoComments, setPhotoComments] = useState<CommentThread[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [addingComment, setAddingComment] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const [editSending, setEditSending] = useState(false);
    const [commentTick, setCommentTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setCommentTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    const canEditOrDeleteComment = (c: CommentThread) => {
        if (!user || String(c.user_id) !== String(user.id)) return false;
        if (c.is_deleted) return false;
        const baseTime = c.edited_at ? new Date(c.edited_at) : new Date(c.createdAt);
        const diffMs = Date.now() - baseTime.getTime();
        return diffMs <= 5 * 60 * 1000;
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
            setPhotoComments(prev => updateInList(prev));
            setEditingCommentId(null);
            setEditingCommentText('');
        } catch (e: any) {
            console.error('Failed to update comment:', e);
            Alert.alert("Error", e.response?.data?.error || "Failed to update comment");
        } finally {
            setEditSending(false);
        }
    };

    const handleCommentDelete = async (id: number) => {
        Alert.alert(
            "Delete Comment",
            "Are you sure you want to delete this comment?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
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
                            setPhotoComments(prev => updateInList(prev));
                        } catch (e: any) {
                            console.error('Failed to delete comment:', e);
                            Alert.alert("Error", e.response?.data?.error || "Failed to delete comment");
                        }
                    }
                }
            ]
        );
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
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [showMentions, setShowMentions] = useState(false);
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

    // Action Menu state
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [activeActionFile, setActiveActionFile] = useState<any>(null);
    const [folderMenuVisible, setFolderMenuVisible] = useState(false);
    const [activeActionFolder, setActiveActionFolder] = useState<any>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const mainScrollRef = useRef<ScrollView>(null);

    // Snag & RFI from existing photo creation states
    const [showCreateSnagModal, setShowCreateSnagModal] = useState(false);
    const [showCreateRfiModal, setShowCreateRfiModal] = useState(false);
    const [snagTitle, setSnagTitle] = useState('');
    const [snagDesc, setSnagDesc] = useState('');
    const [snagAssignedToId, setSnagAssignedToId] = useState<number | null>(null);
    const [showSnagAssigneeDropdown, setShowSnagAssigneeDropdown] = useState(false);
    const [snagAssignees, setSnagAssignees] = useState<any[]>([]);

    const [rfiTitle, setRfiTitle] = useState('');
    const [rfiDesc, setRfiDesc] = useState('');
    const [rfiAssignedToId, setRfiAssignedToId] = useState<number | null>(null);
    const [showRfiAssigneeDropdown, setShowRfiAssigneeDropdown] = useState(false);
    const [rfiAssignees, setRfiAssignees] = useState<any[]>([]);
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

    const handleStartCreateSnag = (photo: any) => {
        setActiveActionFile(photo);
        setSnagTitle('');
        setSnagDesc('');
        setSnagAssignedToId(null);
        if (viewerOpen) {
            openSubModalFromViewer(() => setShowCreateSnagModal(true));
        } else {
            setShowCreateSnagModal(true);
        }
    };

    const handleStartCreateRfi = (photo: any) => {
        setActiveActionFile(photo);
        setRfiTitle('');
        setRfiDesc('');
        setRfiAssignedToId(null);
        setRfiExpiryDate(null);
        if (viewerOpen) {
            openSubModalFromViewer(() => setShowCreateRfiModal(true));
        } else {
            setShowCreateRfiModal(true);
        }
    };

    const handleCreateSnagFromPhoto = async () => {
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
            setShowCreateSnagModal(false);
            checkAndRestoreViewer();
        } catch (error: any) {
            console.error("Create Snag from photo error", error);
            const errMsg = error.response?.data?.error || "Failed to create snag";
            Alert.alert("Error", errMsg);
        } finally {
            setSubmittingEntity(false);
        }
    };

    const handleCreateRfiFromPhoto = async () => {
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
            setShowCreateRfiModal(false);
            checkAndRestoreViewer();
        } catch (error: any) {
            console.error("Create RFI from photo error", error);
            const errMsg = error.response?.data?.error || "Failed to create RFI";
            Alert.alert("Error", errMsg);
        } finally {
            setSubmittingEntity(false);
        }
    };

    const loadFiles = async (isRefetch = false) => {
        if (!project?.id) return;
        if (viewerOpenRef.current) return;
        if (!isRefetch && folders.length === 0 && photos.length === 0) setLoading(true);
        try {
            const data = await getProjectFiles(project.id, 'photo', searchQuery);
            if (viewerOpenRef.current) return;
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
        }, [project?.id, searchQuery])
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            loadFiles(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
            setLinkedRFIs([]); // Reset immediately
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



    useEffect(() => {
        // Only auto-open viewer when it is NOT already open — prevents "1/0" black screen
        // caused by this effect firing mid-session and switching selectedFolder unexpectedly
        if (!viewerOpen && initialFileId && photos.length > 0) {
            const folderToUse = initialFolderId || selectedFolder;
            const currentFolderPhotosForInit = photos.filter((p) => String(p.folder_id ?? 'null') === String(folderToUse ?? 'null'));
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
                        router.setParams({ fileId: '', photoId: '', viewerTab: '' });
                    }, 500);
                } else {
                    router.setParams({ fileId: '', photoId: '', viewerTab: '' });
                }
            }
        }
    }, [initialFileId, photos, selectedFolder, initialFolderId, sortBy, user.role, router, viewerOpen]);


    const currentFolders = useMemo(() => folders.filter((f) => String(f.parent_id ?? 'null') === String(selectedFolder ?? 'null')), [folders, selectedFolder]);
    const currentFolderPhotos = useMemo(() => photos.filter((p) => String(p.folder_id ?? 'null') === String(selectedFolder ?? 'null')), [photos, selectedFolder]);
    const visiblePhotos = useMemo(() => user.role === 'client'
        ? currentFolderPhotos.filter((p) => p.client_visible !== false)
        : currentFolderPhotos, [currentFolderPhotos, user.role]);

    const sortItems = useCallback((items: any[], type: 'folder' | 'file') => {
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
    }, [sortBy]);

    const sortedFolders = useMemo(() => sortItems(currentFolders, 'folder'), [currentFolders, sortItems]);
    const sortedPhotos = useMemo(() => sortItems(visiblePhotos, 'file'), [visiblePhotos, sortItems]);

    const sortedPhotosRef = useRef(sortedPhotos);
    useEffect(() => {
        sortedPhotosRef.current = sortedPhotos;
    }, [sortedPhotos]);

    const activePhotoIdRef = useRef<number | null>(null);

    useEffect(() => {
        const photosList = sortedPhotosRef.current;
        if (viewerOpen && viewerIndex >= 0 && photosList[viewerIndex]) {
            activePhotoIdRef.current = photosList[viewerIndex].id;
        } else if (!viewerOpen) {
            activePhotoIdRef.current = null;
        }
    }, [viewerIndex, viewerOpen]);

    useEffect(() => {
        if (viewerOpen && activePhotoIdRef.current !== null) {
            const newIndex = sortedPhotos.findIndex(p => p.id === activePhotoIdRef.current);
            if (newIndex !== -1 && newIndex !== viewerIndex) {
                setViewerIndex(newIndex);
            }
        }
    }, [sortedPhotos, viewerOpen]);

    const groups = useMemo(() => {
        if (sortBy === 'newest' || sortBy === 'oldest') {
            return groupItemsByMonth(sortedPhotos, t);
        }
        return [];
    }, [sortedPhotos, sortBy, t]);

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

    const currentFolder = folders.find((f) => String(f.id) === String(selectedFolder));

    const goBack = () => {
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

        router.setParams({ folderId: '' });
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
    }, [viewerOpen, viewerIndex]);

    const fetchLinkedItems = useCallback(async () => {
        if (viewerOpen && sortedPhotos[viewerIndex]?.id) {
            try {
                const data = await getLinkedItems(sortedPhotos[viewerIndex].id);
                setLinkedItems(data.links || []);
            } catch (err) {
                console.error(err);
            }
        }
    }, [viewerOpen, viewerIndex, sortedPhotos]);

    useEffect(() => {
        fetchLinkedItems();
    }, [fetchLinkedItems]);

    const handleLinkFile = async (targetId: number) => {
        if (!sortedPhotos[viewerIndex]?.id) return;
        try {
            await linkFiles(sortedPhotos[viewerIndex].id, targetId);
            setShowLinkModal(false);
            checkAndRestoreViewer();
            fetchLinkedItems();
            Alert.alert(t('projectPhotos.success'), 'File linked successfully.');
        } catch (e: any) {
            Alert.alert(t('projectPhotos.error'), e.response?.data?.error || 'Failed to link file.');
        }
    };

    const handleRemoveLink = async (targetType: string, targetId: number) => {
        if (!sortedPhotos[viewerIndex]?.id) return;
        try {
            await deleteLink(sortedPhotos[viewerIndex].id, targetType, targetId);
            fetchLinkedItems();
        } catch (e: any) {
            Alert.alert(t('projectPhotos.error'), e.response?.data?.error || 'Failed to remove link.');
        }
    };

    const handleLinkItemClick = async (item: any) => {
        setShowLinkModal(false);

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
            returnTab: 'photos',
            returnFolderId: selectedFolder ? String(selectedFolder) : '',
            returnFileId: sortedPhotos[viewerIndex]?.id ? String(sortedPhotos[viewerIndex].id) : '',
            // Tell the viewer to reopen on the links tab when returning
            returnViewerTab: 'links',
        };

        const executeClick = () => {
            if (itemType === 'file') {
                const fileName = (item.title || item.file_name || item.name || '').toLowerCase();
                const isPhoto = item.file_type?.startsWith('image/') ||
                    fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.webp');

                if (isPhoto) {
                    const idx = sortedPhotos.findIndex(p => String(p.id) === String(itemId));
                    if (idx !== -1 && String(targetFolderId || '') === String(selectedFolder || '')) {
                        setViewerIndex(idx);
                    } else {
                        setViewerOpen(false);
                        setViewerIndex(-1);
                        setIsViewerZoomed(false);
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
                    }
                } else {
                    setViewerOpen(false);
                    setViewerIndex(-1);
                    setIsViewerZoomed(false);
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
            } else {
                setViewerOpen(false);
                setViewerIndex(-1);
                setIsViewerZoomed(false);
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
    const renderCommentBubble = (c: CommentThread, isReply = false) => {
        const isEditing = editingCommentId === c.id;
        const editable = canEditOrDeleteComment(c);

        return (
            <View key={c.id} style={{ backgroundColor: isReply ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 8, marginLeft: isReply ? 12 : 0, marginTop: isReply ? 4 : 0, marginBottom: isReply ? 0 : 8 }}>
                {/* Name, time and actions row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>{c.user?.name || t('projectPhotos.user')}</Text>
                        <Text style={{ color: '#888', fontSize: 8 }}>{formatCommentTime(c.createdAt)}</Text>
                        {c.is_edited && <Text style={{ color: colors.primary, fontSize: 8, opacity: 0.7 }}>({t('projectPhotos.edited', 'Edited')})</Text>}
                    </View>
                    
                    {/* Buttons / Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {!isReply && !c.is_deleted && (
                            <TouchableOpacity onPress={() => setReplyTo(c.id)}>
                                <Text style={{ color: '#888', fontSize: 9 }}>↩ {t('projectPhotos.reply')}</Text>
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
                            style={{ flex: 1, height: 32, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, color: '#fff', fontSize: 12 }}
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

    const handleAddComment = async () => {
        const photo = sortedPhotos[viewerIndex];
        if (!photo?.id || !commentText.trim() || addingComment) return;
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
        setShowViewerUI(true);
        setViewerOpen(true);
        setShowInfoModal(false);
        loadMembers();
    };

    const closeViewer = () => {
        setViewerOpen(false);
        setIsViewerZoomed(false);
        setViewerIndex(-1);
        setShowInfoModal(false);
        const returnTab = searchParams?.returnTab as string;
        if (returnTab) {
            const rParams: any = { tab: returnTab };
            if (searchParams.returnRfiId) rParams.rfiId = String(searchParams.returnRfiId);
            if (searchParams.returnSnagId) rParams.snagId = String(searchParams.returnSnagId);
            if (searchParams.returnFolderId) rParams.folderId = String(searchParams.returnFolderId);
            if (searchParams.returnFileId) rParams.fileId = String(searchParams.returnFileId);
            if (searchParams.returnViewerTab) rParams.viewerTab = String(searchParams.returnViewerTab);

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
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                Alert.alert(t('projectPhotos.galleryAccess'), t('projectPhotos.galleryAccessMessage'));
                return;
            }
            const ext = photo.file_name?.split('.').pop() || 'jpg';
            const localUri = (FileSystem as any).cacheDirectory + `apexis_${Date.now()}.${ext}`;
            const { uri } = await (FileSystem as any).downloadAsync(photo.downloadUrl, localUri);
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert(t('projectPhotos.saved'), t('projectPhotos.photoSavedMessage'));
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToSavePhoto'));
        } finally {
            setDownloading(false);
        }
    };


    const confirmDeletePhoto = (photo: any) => {
        if (!photo?.id) return;
        Alert.alert(t('projectPhotos.delete'), t('projectPhotos.removePhotoConfirm', { name: photo.file_name }), [
            { text: t('projectPhotos.cancel'), style: 'cancel' },
            {
                text: t('projectPhotos.moveToTrash'), style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteFile(photo.id);
                        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                        if (viewerOpen) closeViewer();
                    } catch { Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToDelete')); }
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
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUpdateVisibility'));
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
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUpdateVisibility'));
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
            t('projectPhotos.deletePhoto'),
            t('projectPhotos.deletePhotoConfirm'),
            [
                { text: t('projectPhotos.cancel'), style: "cancel" },
                {
                    text: t('projectPhotos.delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setProcessing('delete');
                            await deleteFile(file.id);
                            await loadFiles(true);
                            setActionMenuVisible(false);
                            if (viewerOpen) closeViewer();
                        } catch (e) {
                            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToDeletePhoto'));
                        } finally {
                            setProcessing(null);
                        }
                    }
                }
            ]
        );
    };

    const handleArchiveFile = async (file: any) => {
        if (!file?.id) return;
        Alert.alert(t('projectPhotos.archive'), t('projectPhotos.archivePhotoConfirm', { name: file.file_name }), [
            { text: t('projectPhotos.cancel'), style: 'cancel' },
            {
                text: t('projectPhotos.archive'), style: 'default',
                onPress: async () => {
                    try {
                        setProcessing('archive');
                        await archiveFile(file.id);
                        await loadFiles(true);
                        setActionMenuVisible(false);
                        if (viewerOpen) closeViewer();
                    } catch { Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToArchive')); }
                    finally { setProcessing(null); }
                }
            }
        ]);
    };

    const handleUnarchivePhoto = async (file: any) => {
        if (!file?.id) return;
        Alert.alert(t('projectPhotos.unarchive'), t('projectPhotos.unarchivePhotoConfirm', { name: file.file_name }), [
            { text: t('projectPhotos.cancel'), style: 'cancel' },
            {
                text: t('projectPhotos.unarchive'), style: 'default',
                onPress: async () => {
                    try {
                        setProcessing('unarchive');
                        await unarchiveFile(file.id, null);
                        await loadFiles(true);
                        setActionMenuVisible(false);
                        if (viewerOpen) closeViewer();
                    } catch { Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUnarchive')); }
                    finally { setProcessing(null); }
                }
            }
        ]);
    };

    const handleRenameFileAction = (file: any) => {
        setRenamingFileId(file.id);
        setRenamingFileName(file.file_name);
        if (viewerOpen) {
            openSubModalFromViewer(() => setShowRenameFile(true));
        } else {
            setShowRenameFile(true);
        }
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
            checkAndRestoreViewer();
        } catch (e) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUpdateFile'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const lname = newFolderName.trim().toLowerCase();
        if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
            Alert.alert("Error", "The name '" + newFolderName.trim() + "' is reserved for system use");
            return;
        }
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
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToCreateFolder'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateFolder = async () => {
        if (!editFolderName.trim() || !editingFolderId) return;
        const lname = editFolderName.trim().toLowerCase();
        if (lname === 'archive' || lname === 'confirmation' || lname === 'confirmations') {
            Alert.alert("Error", "The name '" + editFolderName.trim() + "' is reserved for system use");
            return;
        }
        setSubmitting(true);
        try {
            await updateFolder(editingFolderId, { name: editFolderName.trim() });
            await loadFiles(true);
            setShowEditFolder(false);
            setEditingFolderId(null);
            setEditFolderName('');
        } catch (e) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUpdateFolder'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (folder: any, force = false) => {
        try {
            setProcessing('delete_folder');
            const data = await deleteFolder(folder.id, force);
            setFolders(folders.filter((f) => f.id !== folder.id));
            setFolderMenuVisible(false);
            Alert.alert(
                t('projectPhotos.success'),
                data?.message || t('projectPhotos.folderDeletedSuccess'),
                [
                    {
                        text: t('projectPhotos.ok'),
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
                    t('projectPhotos.folderNotEmpty'),
                    t('projectPhotos.folderNotEmptyMessage', { name: folder.name }),
                    [
                        { text: t('projectPhotos.cancel'), style: 'cancel' },
                        {
                            text: t('projectPhotos.moveContents'),
                            onPress: () => {
                                const childFolders = folders.filter(f => String(f.parent_id) === String(folder.id));
                                const childFiles = photos.filter(p => String(p.folder_id) === String(folder.id));

                                if (childFolders.length === 0 && childFiles.length === 0) {
                                    Alert.alert(t('projectPhotos.info'), t('projectPhotos.folderAlreadyEmpty'));
                                    return;
                                }

                                setMovingContentsOf(folder);
                                setMovingItem(null);
                                setShowMoveDialog(true);
                            }
                        },
                        {
                            text: t('projectPhotos.deleteEverything'),
                            style: 'destructive',
                            onPress: () => handleDelete(folder, true)
                        }
                    ]
                );
            } else {
                const msg = data?.error || t('projectPhotos.failedToDeleteFolder');
                Alert.alert(t('projectPhotos.error'), msg);
            }
        } finally {
            setProcessing(null);
        }
    };

    const confirmDeleteFolder = (folder: any) => {
        Alert.alert(
            t('projectPhotos.deleteFolder'),
            t('projectPhotos.deleteFolderConfirm', { name: folder.name }),
            [
                { text: t('projectPhotos.cancel'), style: 'cancel' },
                {
                    text: t('projectPhotos.moveToTrash'),
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
            Alert.alert(t('projectPhotos.success'), t('projectPhotos.visibilityUpdated'));
            // Refresh
            await loadFiles(true);
            clearSelection();
        } catch (e) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToUpdateVisibility'));
        } finally {
            setProcessing(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedFiles.size === 0) {
            Alert.alert(t('projectPhotos.info'), t('projectPhotos.selectAtLeastOne') || 'Please select at least one photo');
            return;
        }

        const filesArray = Array.from(selectedFiles).map(id => photos.find(p => String(p.id) === String(id))).filter(Boolean);
        const inProtectedFolder = filesArray.some(file => {
            if (file.folder_id) {
                const folder = folders.find(f => String(f.id) === String(file.folder_id));
                if (folder) {
                    const folderNameLower = folder.name.toLowerCase();
                    return (
                        (folder.folder_type === 'photo' && (folderNameLower === 'confirmation' || folderNameLower === 'confirmations' || folderNameLower === 'archive')) ||
                        (folder.folder_type === 'document' && folderNameLower === 'archive')
                    );
                }
            }
            return false;
        });

        if (inProtectedFolder) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.protectedFolderDeleteError') || "Files in system folders (Archive/Confirmations) cannot be deleted.");
            return;
        }

        const unauthorized = filesArray.some(file => {
            return String(file.created_by) !== String(user.id);
        });

        if (unauthorized) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.unauthorizedDeleteError') || "You can only delete photos that you originally uploaded.");
            return;
        }

        const confirmMsg = selectedFiles.size === 1
            ? t('projectPhotos.deletePhotoConfirm')
            : (t('projectPhotos.removePhotosConfirm', { count: selectedFiles.size }) || `Move these ${selectedFiles.size} photos to Trash? They can be recovered later from Settings for 30 days.`);

        const alertTitle = selectedFiles.size === 1
            ? (t('projectPhotos.deletePhoto') || 'Delete Photo')
            : (t('projectPhotos.deletePhotos') || 'Delete Photos');

        Alert.alert(
            alertTitle,
            confirmMsg,
            [
                { text: t('projectPhotos.cancel'), style: 'cancel' },
                {
                    text: t('projectPhotos.moveToTrash') || 'Move to Trash', style: 'destructive',
                    onPress: async () => {
                        try {
                            setProcessing('delete');
                            await bulkDeleteFiles(Array.from(selectedFiles));
                            setPhotos((prev) => prev.filter((p) => !selectedFiles.has(p.id)));
                            clearSelection();
                        } catch (e: any) {
                            const errorMsg = e.response?.data?.error || t('projectPhotos.failedToDeletePhoto');
                            Alert.alert(t('projectPhotos.error'), errorMsg);
                        } finally {
                            setProcessing(null);
                        }
                    }
                }
            ]
        );
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
                            message: Platform.OS === 'android' ? `${firstPhoto.file_name}\n${firstPhoto.downloadUrl}` : firstPhoto.file_name,
                            url: firstPhoto.downloadUrl,
                        });
                    }
                } catch (e) {
                    console.error('Bulk share error:', e);
                    Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToSharePhoto'));
                } finally {
                    setDownloading(false);
                }
            }
        } else {
            Alert.alert(t('projectPhotos.info'), t('projectPhotos.selectAtLeastOne'));
        }
    };

    const handleShareProject = async () => {
        try {
            const { getProjectShareLinks } = require('@/services/projectService');
            const links = await getProjectShareLinks(project.id, user.role);
            const link = user.role === 'client' ? links.clientLink : links.contributorLink;
            if (link) {
                await RNShare.share({
                    message: t('projectPhotos.joinProjectMessage', { projectName: project.name, link }),
                });
            } else {
                Alert.alert(t('projectPhotos.info'), t('projectPhotos.shareLinkNotAvailable'));
            }
        } catch (error) {
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToGetShareLink'));
        }
    };


    const handleSharePhoto = async (photo?: any) => {
        const photoToShare = photo || (selectedFiles.size > 0 ? photos.find(p => String(p.id) === String(Array.from(selectedFiles)[0])) : null);
        if (!photoToShare) return;

        try {
            setSharing(true);
            const ext = photoToShare.file_name?.split('.').pop() || 'jpg';
            const localUri = `${(FileSystem as any).cacheDirectory}${photoToShare.file_name || `photo_${Date.now()}.${ext}`}`;

            const { uri } = await (FileSystem as any).downloadAsync(photoToShare.downloadUrl, localUri);

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
            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToSharePhoto'));
        } finally {
            setSharing(false);
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

    const goBackRef = useRef(goBack);
    const clearSelectionRef = useRef(clearSelection);
    const selectedFolderRef = useRef(selectedFolder);
    const isSelectionModeRef = useRef(isSelectionMode);
    const isViewerOpenRef = useRef(viewerOpen);

    useEffect(() => {
        goBackRef.current = goBack;
        clearSelectionRef.current = clearSelection;
        selectedFolderRef.current = selectedFolder;
        isSelectionModeRef.current = isSelectionMode;
        isViewerOpenRef.current = viewerOpen;
    }, [goBack, clearSelection, selectedFolder, isSelectionMode, viewerOpen]);

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

    // ── Unified Layout ───────────────────────────────────────────────────────────

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
                            onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder || ''}`)}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>{t('projectPhotos.uploadPhoto')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>{t('projectPhotos.newFolder')}</Text>
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
                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{t(`projectPhotos.sortBy.${sortBy}`)}</Text>
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
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'files' ? colors.primary : colors.textMuted }}>{t('projectPhotos.photosCount', { count: sortedFolders.length + sortedPhotos.length })}</Text>
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
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: activeFolderTab === 'rfis' ? colors.primary : colors.textMuted }}>{t('projectPhotos.linkedItemsCount', { count: linkedRFIs.length + linkedSnags.length }) || `Linked RFIs & Snags (${linkedRFIs.length + linkedSnags.length})`}</Text>
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
                                                                    returnTab: 'photos',
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
                                                                        }}>{t(`projectRfi.statusLabel.${rfi.status}`)}</Text>
                                                                    </View>
                                                                </View>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                        <Feather name="calendar" size={10} color={colors.textMuted} />
                                                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(rfi.createdAt).toLocaleDateString()}</Text>
                                                                    </View>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                        <Feather name="user" size={10} color={colors.textMuted} />
                                                                        <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{rfi.assignee?.name || t('projectPhotos.unassigned')}</Text>
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
                                                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t('projectPhotos.noRfisLinked')}</Text>
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
                                                                    returnTab: 'photos',
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
                                                                        <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{snag.assignee?.name || t('projectPhotos.unassigned')}</Text>
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
                                        const count = photos.filter((p) => p.folder_id === folder.id).length;
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
                                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: isArchiveFolder ? '#64748b' : (isConfirmationFolder ? '#f97316' : (isConfidentialFolder ? '#e11d48' : colors.text)), textAlign: 'center' }}>{isConfirmationFolder ? "Confirmations" : folder.name}</Text>
                                                <Text style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>
                                                    {subcount > 0
                                                        ? t('projectPhotos.photosFoldersCount', { photoCount: count, folderCount: subcount })
                                                        : t('projectPhotos.photosOnlyCount', { count })
                                                    }
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

                                {!loading && currentFolders.length === 0 && visiblePhotos.length === 0 && (
                                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                                        <Feather name="camera" size={32} color={colors.border} />
                                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>{t('projectPhotos.noFoldersPhotos')}</Text>
                                    </View>
                                )}

                                <View style={{ marginTop: sortedFolders.length > 0 ? 12 : 0 }}>
                                    {(() => {
                                        const renderPhotoItem = (photo: any, index: number, groupTitle?: string) => {
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
                                                        {!isSelectionMode && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && !isSelected && (
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
                                                                gap: viewMode === 'grid' ? 4 : 8
                                                            }}>
                                                                {group.data.map((p, i) => renderPhotoItem(p, i))}
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
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Platform.OS === 'android' ? 20 : 10 }}>
                                                                    <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                                                                        <Text style={{ fontSize: 16, color: colors.primary }}>{t('projectPhotos.cancel')}</Text>
                                                                    </TouchableOpacity>
                                                                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('projectPhotos.selectMonth')}</Text>
                                                                    <TouchableOpacity
                                                                        onPress={() => {
                                                                            const title = `${tempMonth} ${tempYear}`;
                                                                            scrollToMonth(title);
                                                                        }}
                                                                    >
                                                                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{t('projectPhotos.ok')}</Text>
                                                                    </TouchableOpacity>
                                                                </View>

                                                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 20 : 0 }}>
                                                                    <Picker
                                                                        selectedValue={tempMonth}
                                                                        style={{ flex: 1.2, height: Platform.OS === 'ios' ? 200 : 50 }}
                                                                        itemStyle={{ fontSize: 18, color: colors.text }}
                                                                        onValueChange={(itemValue) => setTempMonth(itemValue)}
                                                                        dropdownIconColor={colors.text}
                                                                        mode="dialog"
                                                                    >
                                                                        {allMonths.map(m => {
                                                                            const isAvailable = availableMonthsByYear[tempYear]?.has(m);
                                                                            if (!isAvailable) return null;
                                                                            return (
                                                                                <Picker.Item
                                                                                    key={m}
                                                                                    label={m}
                                                                                    value={m}
                                                                                    color={Platform.OS === 'android' ? '#000000' : colors.text}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </Picker>
                                                                    <Picker
                                                                        selectedValue={tempYear}
                                                                        style={{ flex: 0.8, height: Platform.OS === 'ios' ? 200 : 50 }}
                                                                        itemStyle={{ fontSize: 18, color: colors.text }}
                                                                        onValueChange={(itemValue) => setTempYear(itemValue)}
                                                                        dropdownIconColor={colors.text}
                                                                        mode="dialog"
                                                                    >
                                                                        {availableYears.map(y => (
                                                                            <Picker.Item key={y} label={y} value={y} color={Platform.OS === 'android' ? '#000000' : colors.text} />
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
                                                {sortedPhotos.map((photo, index) => renderPhotoItem(photo, index))}
                                            </View>
                                        );
                                    })()}
                                </View>
                            </>
                        )}
                    </View>
                )}

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
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectPhotos.newFolder')}</Text>
                        <TextInput
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            placeholder={t('projectPhotos.folderNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectPhotos.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectPhotos.creating') : t('projectPhotos.create')}</Text>
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
                                            const isConfirmation = folder?.name.toLowerCase() === 'confirmation' || folder?.name.toLowerCase() === 'confirmations';
                                            if (folder && !isConfirmation) {
                                                setEditingFolderId(folder.id);
                                                setEditFolderName(folder.name);
                                                setShowEditFolder(true);
                                            }
                                        }}
                                        style={{ padding: 4, opacity: Array.from(selectedFolders).some(id => folders.find(f => f.id === id)?.name.toLowerCase() === 'confirmation') ? 0.5 : 1 }}
                                        disabled={processing !== null || Array.from(selectedFolders).some(id => {
                                            const f = folders.find(f => f.id === id);
                                            return f?.name.toLowerCase() === 'confirmation' || f?.name.toLowerCase() === 'confirmations';
                                        })}
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
                                                        const isConfirmation = folder?.name.toLowerCase() === 'confirmation';
                                                        if (folder && !isConfirmation) confirmDeleteFolder(folder);
                                                    }}
                                                    style={{ padding: 4, opacity: Array.from(selectedFolders).some(id => folders.find(f => f.id === id)?.name.toLowerCase() === 'confirmation') ? 0.5 : 1 }}
                                                    disabled={processing !== null || Array.from(selectedFolders).some(id => folders.find(f => f.id === id)?.name.toLowerCase() === 'confirmation')}
                                                >
                                                    {processing === 'delete_folder' ? (
                                                        <ActivityIndicator size="small" color="#ef4444" />
                                                    ) : (
                                                        <Feather name="trash-2" size={18} color="#ef4444" />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        }
                                    } else if (selectedFiles.size > 0 && selectedFolders.size === 0) {
                                        // File delete option (single or multiple) - only show if all selected files were uploaded by the current user
                                        const filesArray = Array.from(selectedFiles).map(id => photos.find(p => String(p.id) === String(id))).filter(Boolean);
                                        const allOwned = filesArray.every(file => String(file.created_by) === String(user.id));
                                        if (allOwned) {
                                            return (
                                                <TouchableOpacity
                                                    onPress={handleBulkDelete}
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
                            Alert.alert(t('projectPhotos.success'), t('projectPhotos.folderDeletedMovingContents', { name: movingContentsOf.name }));
                        } catch (err) {
                            Alert.alert(t('projectPhotos.error'), t('projectPhotos.failedToDeleteEmptyFolder'));
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
                                    <TouchableOpacity onPress={() => setShowInfoModal(true)} style={{ padding: 8 }}>
                                        <Feather name="info" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openSubModalFromViewer(() => setShowLinkModal(true))} style={{ padding: 8 }}>
                                        <Feather name="link" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    {/* <TouchableOpacity onPress={() => handleSharePhoto(sortedPhotos[viewerIndex])} style={{ padding: 8 }} disabled={sharing || downloading}>
                                        {sharing
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <Feather name="share-2" size={20} color="#fff" />
                                        }
                                    </TouchableOpacity> */}
                                    <TouchableOpacity onPress={downloadToGallery} style={{ padding: 8 }} disabled={downloading || sharing}>
                                        {downloading
                                            ? <ActivityIndicator size="small" color={colors.primary} />
                                            : <Feather name="download" size={20} color={colors.primary} />
                                        }
                                    </TouchableOpacity>
                                    {(String(sortedPhotos[viewerIndex]?.created_by) === String(user?.id) || String(sortedPhotos[viewerIndex]?.creator?.id) === String(user?.id)) && (
                                        <>
                                            {currentFolder?.name.toLowerCase().includes('archive') ? (
                                                <TouchableOpacity onPress={() => handleUnarchivePhoto(sortedPhotos[viewerIndex])} style={{ padding: 8 }}>
                                                    <Feather name="archive" size={20} color="#3b82f6" />
                                                </TouchableOpacity>
                                            ) : currentFolder?.name.toLowerCase().includes('confirmation') ? (
                                                <TouchableOpacity onPress={() => handleArchiveFile(sortedPhotos[viewerIndex])} style={{ padding: 8 }}>
                                                    <Feather name="archive" size={20} color="#f59e0b" />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity onPress={handleDeletePhoto} style={{ padding: 8 }}>
                                                    <Feather name="trash-2" size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    )}
                                    {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'contributor') && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setActiveActionFile(sortedPhotos[viewerIndex]);
                                                setActionMenuVisible(true);
                                            }}
                                            style={{ padding: 8 }}
                                        >
                                            <Feather name="more-vertical" size={20} color="#fff" />
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
                            scrollEnabled={!isViewerZoomed && keyboardHeight === 0}
                            showsHorizontalScrollIndicator={false}
                            removeClippedSubviews={Platform.OS === 'android'}
                            keyboardShouldPersistTaps="handled"
                            windowSize={3}
                            initialNumToRender={1}
                            maxToRenderPerBatch={1}
                            keyExtractor={(item) => item.id.toString()}
                            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
                            onScrollBeginDrag={() => {
                                isUserScrollingRef.current = true;
                            }}
                            onMomentumScrollEnd={(e) => {
                                if (isUserScrollingRef.current) {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                    if (idx !== viewerIndex) setViewerIndex(idx);
                                    isUserScrollingRef.current = false;
                                }
                            }}
                            onScrollEndDrag={(e) => {
                                const velocity = e.nativeEvent.velocity;
                                if (!velocity || (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1)) {
                                    if (isUserScrollingRef.current) {
                                        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                                        if (idx !== viewerIndex) setViewerIndex(idx);
                                        isUserScrollingRef.current = false;
                                    }
                                }
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
                                                gesturesEnabled={keyboardHeight === 0}
                                            />
                                        </View>
                                    </View>
                                );
                            }}
                        />

                        {/* Bottom panel: info + comments */}
                        {showViewerUI && (
                            <View
                                style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? keyboardHeight : 0, left: 0, right: 0, zIndex: 9999 }}
                            >
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: 10 }}>
                                    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                            {sortedPhotos[viewerIndex]?.file_name || t('projectPhotos.photo')}
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
                                        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                                💬 {t('projectPhotos.comments')} ({photoComments.length})
                                            </Text>
                                        </View>
                                        {commentLoading ? (
                                            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 8 }} />
                                        ) : (
                                            <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                                                {photoComments.length === 0 && (
                                                    <Text style={{ color: '#666', fontSize: 10, marginBottom: 8 }}>{t('projectPhotos.noComments')}</Text>
                                                )}
                                                {photoComments.map((c: any) => (
                                                    <View key={c.id} style={{ marginBottom: 8 }}>
                                                        {renderCommentBubble(c, false)}
                                                        {c.replies?.map((r: any) => renderCommentBubble(r, true))}
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        )}
                                        {replyTo && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <Text style={{ color: colors.primary, fontSize: 9 }}>{t('projectPhotos.replyingTo')}</Text>
                                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                                    <Text style={{ color: '#888', fontSize: 9 }}>✕ {t('projectPhotos.cancel')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {showMentions && (
                                            <View style={{ position: 'absolute', bottom: 50, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 1000 }}>
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
                                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 8, marginTop: 6 }}>
                                                <TextInput
                                                    ref={commentInputRef}
                                                    value={commentText}
                                                    onChangeText={handleInputChange}
                                                    placeholder={t('projectPhotos.addCommentPlaceholder')}
                                                    placeholderTextColor="#555"
                                                    style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, color: '#fff', fontSize: 12 }}
                                                />
                                                <GestureTouchableOpacity
                                                    onPress={handleAddComment}
                                                    disabled={addingComment || !commentText.trim()}

                                                >
                                                    <View style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: (!commentText.trim() || addingComment) ? 0.5 : 1 }}>
                                                        {addingComment
                                                            ? <ActivityIndicator size="small" color="#fff" />
                                                            : <Feather name="send" size={14} color="#fff" style={{ transform: [{ translateY: 1 }, { translateX: -1 }] }} />
                                                        }
                                                    </View>
                                                </GestureTouchableOpacity>
                                            </View>
                                        </ScrollView>
                                    </View>
                                    {/* Safe-area spacer: covers Android nav bar (gesture or 3-button) and iOS home indicator */}
                                    <View style={{ height: Math.max(insets.bottom, 0) }} />
                                </View>
                            </View>
                        )}
                    </View>
                </GestureHandlerRootView>
                {/* File Action Menu for Viewer */}
                <FileActionMenu
                    isVisible={actionMenuVisible}
                    onClose={() => setActionMenuVisible(false)}
                    onHideUnhide={() => handleToggleVisibility(activeActionFile)}
                    onDoNotFollow={() => { }}
                    onDelete={() => handleDeleteFile(activeActionFile)}
                    onShare={() => handleSharePhoto(activeActionFile)}
                    showDoNotFollow={false}
                    isAdmin={user.role === 'admin' || user.role === 'superadmin'}
                    isContributor={user.role === 'contributor'}
                    isUploader={activeActionFile && String(activeActionFile.created_by) === String(user.id)}
                    clientVisible={activeActionFile?.client_visible !== false}
                    doNotFollow={false}
                    canDelete={false}
                    canRename={['admin', 'superadmin', 'contributor'].includes(user.role) && !currentFolder?.name.toLowerCase().includes('confirmation') && !currentFolder?.name.toLowerCase().includes('archive')}
                    onRename={() => handleRenameFileAction(activeActionFile)}
                    onArchive={() => handleArchiveFile(activeActionFile)}
                    onUnarchive={() => handleUnarchivePhoto(activeActionFile)}
                    onCreateRfi={() => handleStartCreateRfi(activeActionFile)}
                    onCreateSnag={() => handleStartCreateSnag(activeActionFile)}
                    showArchive={currentFolder?.name.toLowerCase().includes('confirmation')}
                    isArchived={currentFolder?.name.toLowerCase().includes('archive')}
                    fileName={activeActionFile?.file_name || ''}
                    useView={Platform.OS === 'ios'}
                />
                <FileInformationModal
                    visible={showInfoModal}
                    onClose={() => setShowInfoModal(false)}
                    file={sortedPhotos[viewerIndex]}
                    folders={folders}
                    projectName={project?.name || ''}
                />
            </Modal>

            {showLinkModal && sortedPhotos[viewerIndex]?.id && (
                <LinkFileModal
                    visible={showLinkModal}
                    onClose={() => {
                        setShowLinkModal(false);
                        checkAndRestoreViewer();
                    }}
                    onLink={handleLinkFile}
                    projectId={project?.id}
                    currentFileId={sortedPhotos[viewerIndex]?.id}
                    handleLinkItemClick={handleLinkItemClick}
                />
            )}

            {/* Rename Folder Modal */}
            <Modal visible={showEditFolder} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectPhotos.renameFolder')}</Text>
                        <TextInput
                            value={editFolderName}
                            onChangeText={setEditFolderName}
                            placeholder={t('projectPhotos.folderNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowEditFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectPhotos.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectPhotos.updating') : t('projectPhotos.update')}</Text>
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
                isContributor={user.role === 'contributor'}
                isUploader={activeActionFile && String(activeActionFile.created_by) === String(user.id)}
                clientVisible={activeActionFile?.client_visible !== false}
                doNotFollow={false}
                canDelete={activeActionFile && String(activeActionFile.created_by) === String(user.id) && !currentFolder?.name.toLowerCase().includes('confirmation') && !currentFolder?.name.toLowerCase().includes('archive')}
                canRename={['admin', 'superadmin', 'contributor'].includes(user.role) && !currentFolder?.name.toLowerCase().includes('confirmation') && !currentFolder?.name.toLowerCase().includes('archive')}
                onRename={() => handleRenameFileAction(activeActionFile)}
                onArchive={() => handleArchiveFile(activeActionFile)}
                onUnarchive={() => handleUnarchivePhoto(activeActionFile)}
                onCreateRfi={() => handleStartCreateRfi(activeActionFile)}
                onCreateSnag={() => handleStartCreateSnag(activeActionFile)}
                showArchive={currentFolder?.name.toLowerCase().includes('confirmation')}
                isArchived={currentFolder?.name.toLowerCase().includes('archive')}
                fileName={activeActionFile?.file_name || ''}
                processingAction={processing}
            />

            {/* Rename File Modal */}
            <Modal visible={showRenameFile} transparent animationType="fade" onRequestClose={closeRenameFileModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>{t('projectPhotos.renamePhoto')}</Text>
                        <TextInput
                            value={renamingFileName}
                            onChangeText={setRenamingFileName}
                            placeholder={t('projectPhotos.photoNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={closeRenameFileModal} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectPhotos.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUpdateFile} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? t('projectPhotos.updating') : t('projectPhotos.update')}</Text>
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

            {/* Create Snag Modal */}
            <Modal visible={showCreateSnagModal} transparent animationType="slide" onRequestClose={closeCreateSnagModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Create Snag from Photo</Text>
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
                                    onPress={handleCreateSnagFromPhoto}
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

            {/* Create RFI Modal */}
            <Modal visible={showCreateRfiModal} transparent animationType="slide" onRequestClose={closeCreateRfiModal}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Create RFI from Photo</Text>
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
                                    onPress={handleCreateRfiFromPhoto}
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

        </View>
    );
}
