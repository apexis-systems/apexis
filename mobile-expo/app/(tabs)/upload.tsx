import { useState, useEffect, useRef } from 'react';
import {
    View, TouchableOpacity, ScrollView, Alert, Animated, Image, Modal, BackHandler, ActivityIndicator
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Paths, File as FSFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '@/contexts/AuthContext';
import DocumentScanProcessor, { DocumentScanProcessorRef } from '@/components/scan/DocumentScanProcessor';
import { useTheme } from '@/contexts/ThemeContext';
import { uploadFileWithProgress } from '@/services/fileService';
import { getProjects } from '@/services/projectService';
import { getFolders, createFolder } from '@/services/folderService';
import { createActivity } from '@/services/activityService';
import { getActiveProjectContext } from '@/utils/projectSelection';

type Asset = any;

interface FileProgress {
    asset: Asset;
    progress: number; // 0–100
    status: 'pending' | 'uploading' | 'done' | 'error';
    anim: Animated.Value;
    source?: 'camera' | 'gallery' | 'document' | 'scan';
}

type Mode = 'capture' | 'project' | 'folder' | 'review' | 'uploading' | 'done';

export default function UploadScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{ projectId?: string; folderId?: string }>();
    const isFocused = useIsFocused();

    // Permissions
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Refs for camera and document processor
    const cameraRef = useRef<CameraView>(null);
    const processorRef = useRef<DocumentScanProcessorRef>(null);

    // State: Flow Control
    const [mode, setMode] = useState<'capture' | 'selection' | 'uploading' | 'done'>('capture');
    const [fileQueue, setFileQueue] = useState<FileProgress[]>([]);

    // State: Destination Selection
    const [selectedProject, setSelectedProject] = useState<string | null>(params.projectId || null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(params.folderId || null);
    const [projects, setProjects] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');

    // State: Folder Browse (for nested selection)
    const [folderBrowseId, setFolderBrowseId] = useState<string | null>(null);

    // State: Processing
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    // State: Camera doc mode
    const [isDocMode, setIsDocMode] = useState(false);

    // Breadcrumbs for folder navigation
    const browseBreadcrumbs = (() => {
        if (!folderBrowseId || folders.length === 0) return [];
        const crumbs = [];
        let currId: string | null = folderBrowseId;
        while (currId) {
            const f = folders.find((it) => String(it.id) === String(currId));
            if (f) {
                crumbs.unshift({ id: String(f.id), name: f.name });
                currId = f.parent_id ? String(f.parent_id) : null;
            } else break;
        }
        return crumbs;
    })();

    const getFolderChildren = (parentId: string | null) => {
        return folders.filter((f) => {
            if (parentId === null) return !f.parent_id;
            return String(f.parent_id) === String(parentId);
        });
    };

    // Ensure state defaults from params if routing with prepopulated picks
    useFocusEffect(
        useCallback(() => {
            // Priority 1: Direct link parameters
            if (params.projectId) {
                setSelectedProject(params.projectId as string);
                if (params.folderId) {
                    setSelectedFolder(params.folderId as string);
                }
            } else {
                // Priority 2: Nav Bar click while inside a project
                const { projectId, folderId } = getActiveProjectContext();
                if (projectId) {
                    setSelectedProject(projectId);
                    if (folderId) {
                        setSelectedFolder(folderId);
                        // If both are present, we probably want to go to capture or review
                        setMode('capture');
                    } else {
                        setMode('capture');
                    }
                }
            }
        }, [params.projectId, params.folderId])
    );

    // Dynamic Tab Bar Visibility
    useLayoutEffect(() => {
        navigation.setOptions({
            tabBarStyle: mode === 'capture' ? { display: 'none' } : undefined,
        });
    }, [mode, navigation]);

    // Data Fetching
    useEffect(() => {
        if (!user) return;
        getProjects()
            .then((data) => { if (data.projects) setProjects(data.projects); })
            .catch((e) => console.error('fetchProjects', e));
    }, [user]);

    const fetchFolders = async () => {
        if (!selectedProject) { setFolders([]); return; }
        getFolders(selectedProject, isDocMode ? 'document' : 'photo')
            .then((data) => {
                const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
                setFolders(rawFolders);
            })
            .catch((e) => console.error('fetchFolders', e));
    };

    useEffect(() => {
        fetchFolders();
    }, [selectedProject, isDocMode]);

    // Auto-expand folder tree to show selected folder on initial load
    useEffect(() => {
        if (selectedFolder && selectedFolder !== 'root' && folders.length > 0 && !folderBrowseId) {
            const target = folders.find(f => String(f.id) === String(selectedFolder));
            if (target && target.parent_id) {
                setFolderBrowseId(target.parent_id);
            }
        }
    }, [folders, selectedFolder]);

    // Role check - moved here to satisfy Rules of Hooks
    if (!user || user.role === 'client') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Upload is not available for your role.</Text>
            </SafeAreaView>
        );
    }

    // -- File Selection / Capturing Handlers --

    const addToQueue = (newItems: FileProgress[]) => {
        if (fileQueue.length + newItems.length > 20) {
            Alert.alert('Limit Reached', 'You can only select up to 20 files at once.');
            return;
        }

        // Check for mixed types
        const hasImages = newItems.some(i => i.asset.type.startsWith('image/'));
        const hasDocs = newItems.some(i => !i.asset.type.startsWith('image/'));

        if (!isDocMode && hasDocs) {
            Alert.alert('Invalid Selection', 'Please switch to "Files" mode to upload documents.');
            return;
        }

        if (isDocMode && hasImages) {
            Alert.alert('Invalid Selection', 'Please switch to "Photos" mode to upload images.');
            return;
        }

        setFileQueue((prev) => [...prev, ...newItems]);
    };

    const pickFromGallery = async () => {
        try {
            const maxAllowed = 20 - fileQueue.length;
            if (maxAllowed <= 0) return;

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                selectionLimit: maxAllowed,
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;

            const queue: FileProgress[] = result.assets.map((a: any) => ({
                asset: { uri: a.uri, fileName: a.fileName || a.uri.split('/').pop(), type: a.mimeType || 'image/jpeg', size: a.fileSize || 0 },
                progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'gallery',
            }));
            addToQueue(queue);
        } catch (error) {
            console.error('Gallery Error:', error);
            Alert.alert('Error', 'Failed to pick image from gallery.');
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                multiple: true,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const queue: FileProgress[] = result.assets.map((a) => ({
                asset: { uri: a.uri, fileName: a.name, type: a.mimeType, size: a.size },
                progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'document',
            }));
            addToQueue(queue);
        } catch (err) {
            console.error('pickDocument error:', err);
        }
    };

    const capturePhoto = async () => {
        if (!cameraRef.current || isProcessing) return;
        if (fileQueue.length >= 20) {
            Alert.alert('Limit', 'Queue full');
            return;
        }

        setIsProcessing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                base64: false,
                exif: false,
            });

            if (!photo?.uri) return;

            addToQueue([{
                asset: {
                    uri: photo.uri,
                    fileName: photo.uri.split('/').pop() || `capture_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                    size: 0
                },
                progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'camera',
            }]);
        } catch (error) {
            console.error('Camera Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const captureScan = async () => {
        if (!cameraRef.current || isProcessing) return;
        if (fileQueue.length >= 20) {
            Alert.alert('Limit', 'Queue full');
            return;
        }
        setIsProcessing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false, exif: false });
            if (!photo?.uri) return;

            let finalUri = photo.uri;
            try {
                const processed = await processorRef.current?.process(photo.uri);
                if (processed && processed.startsWith('data:image')) {
                    const base64Data = processed.replace(/^data:image\/\w+;base64,/, '');
                    const outputFile = new FSFile(Paths.cache, `scan_${Date.now()}.jpg`);
                    outputFile.write(atob(base64Data));
                    finalUri = outputFile.uri;
                }
            } catch (e) {
                console.warn('Scan enhance failed, using original:', e);
            }

            addToQueue([{
                asset: { uri: finalUri, fileName: `scan_${Date.now()}.jpg`, type: 'image/jpeg', size: 0 },
                progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'document',
            }]);
        } catch (error) {
            console.error('Scan Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };


    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !selectedProject) return;
        setCreatingFolder(true);
        try {
            const data = await createFolder({
                project_id: selectedProject,
                name: newFolderName.trim(),
                folder_type: isDocMode ? 'document' : 'photo',
                parent_id: folderBrowseId
            });
            if (data.folder) {
                await fetchFolders();
                setSelectedFolder(String(data.folder.id));
                setShowCreateFolder(false);
                setNewFolderName('');
            }
        } catch (error) {
            console.error("Failed to create folder:", error);
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setCreatingFolder(false);
        }
    };

    // -- Destination Logic --

    const handleUpload = async () => {
        if (!selectedProject || !selectedFolder || fileQueue.length === 0) return;
        setMode('uploading');
        for (let i = 0; i < fileQueue.length; i++) {
            const item = fileQueue[i];
            if (item.status === 'done') continue;
            try {
                const formData = new FormData();
                formData.append('file', {
                    uri: item.asset.uri,
                    name: item.asset.fileName || `upload_${i}`,
                    type: item.asset.type || 'application/octet-stream',
                } as any);

                formData.append('project_id', String(selectedProject));
                formData.append('folder_id', selectedFolder === 'root' ? '' : selectedFolder);
                formData.append('client_visible', String(true));
                formData.append('file_tag', isDocMode ? 'document' : 'photo');
                formData.append('skipActivity', 'true');
                if (photoLocation) formData.append('location', photoLocation);
                if (photoTags) formData.append('tags', photoTags);

                await uploadFileWithProgress(formData, (p) => {
                    setFileQueue((prev) => {
                        const next = [...prev];
                        next[i].progress = p;
                        next[i].status = 'uploading';
                        return next;
                    });
                });

                setFileQueue((prev) => {
                    const next = [...prev];
                    next[i].status = 'done';
                    return next;
                });

                await createActivity({
                    project_id: selectedProject,
                    type: 'upload',
                    description: `Uploaded ${item.asset.fileName} to ${selectedFolder === 'root' ? 'Root' : (folders.find(f => String(f.id) === String(selectedFolder))?.name || 'folder')}${photoLocation ? ` at ${photoLocation}` : ''}${photoTags ? ` with tags: ${photoTags}` : ''}`,
                });
            } catch (err) {
                console.error('Upload Error', err);
                setFileQueue((prev) => {
                    const next = [...prev];
                    next[i].status = 'error';
                    return next;
                });
            }
        }
        setMode('done');
    };

    const reset = () => {
        setFileQueue([]);
        setMode('capture');
        setPhotoLocation('');
        setPhotoTags('');

        // If we came from a specific project via params, don't clear the selected project/folder
        if (!params.projectId) {
            setSelectedProject(null);
            setSelectedFolder(null);
            setFolderBrowseId(null);
        }
    };

    const handleClose = useCallback(() => {
        // Always reset file queue so stale photos don't persist when upload tab is re-visited
        const snapshotProject = selectedProject;
        const snapshotFolder = selectedFolder;
        const snapshotDocMode = isDocMode;
        const snapshotDone = mode === 'done';

        // Clear file queue immediately so if user re-opens the tab it's fresh
        setFileQueue([]);
        setMode('capture');
        setPhotoLocation('');
        setPhotoTags('');
        if (!params.projectId) {
            setSelectedProject(null);
            setSelectedFolder(null);
            setFolderBrowseId(null);
        }

        // If we just finished an upload, navigate to where we uploaded
        if (snapshotDone && snapshotProject) {
            router.push(`/(tabs)/project/${snapshotProject}?tab=${snapshotDocMode ? 'documents' : 'photos'}&folderId=${snapshotFolder && snapshotFolder !== 'root' ? snapshotFolder : ''}`);
            return;
        }

        // Otherwise find whichever context sent us here (cancel/discard scenario)
        const targetProjectId = params.projectId || getActiveProjectContext().projectId;
        const targetFolderId = params.folderId || getActiveProjectContext().folderId;

        if (targetProjectId) {
            router.push(`/(tabs)/project/${targetProjectId}?tab=${snapshotDocMode ? 'documents' : 'photos'}&folderId=${targetFolderId && targetFolderId !== 'root' ? targetFolderId : ''}`);
        } else {
            router.push('/');
        }
    }, [selectedProject, selectedFolder, isDocMode, mode, params.projectId, params.folderId, router]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                const close = () => handleClose();

                if (fileQueue.length > 0) {
                    Alert.alert(
                        'Discard?',
                        'Are you sure you want to discard your selections?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Discard', style: 'destructive', onPress: close }
                        ]
                    );
                } else {
                    close();
                }
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [handleClose, fileQueue.length])
    );

    // ── RENDER ──────────────────────────────────────────────────────────────

    // 1. Capture Mode
    if (mode === 'capture') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
                <DocumentScanProcessor ref={processorRef} />

                <View style={{ flex: 1 }}>
                    <View style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingHorizontal: 20, paddingVertical: 16,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                    }}>
                        <TouchableOpacity onPress={fileQueue.length > 0 ? () => Alert.alert('Discard?', 'Discard selections?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: handleClose }]) : handleClose}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{isDocMode ? 'Scan Documents' : 'Take Photos'}</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {cameraPermission?.granted && isFocused ? (
                        <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef} />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                            <TouchableOpacity onPress={requestCameraPermission} style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', paddingBottom: insets.bottom + 20, paddingTop: 10
                    }}>
                        {/* PREVIEW ROW ABOVE BUTTONS */}
                        {fileQueue.length > 0 && (
                            <View style={{ paddingBottom: 20, paddingHorizontal: 20 }}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                    {fileQueue.map((item, idx) => (
                                        <View key={idx} style={{ position: 'relative' }}>
                                            <Image source={{ uri: item.asset.uri }} style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }} />
                                            <TouchableOpacity
                                                onPress={() => setFileQueue(prev => prev.filter((_, i) => i !== idx))}
                                                style={{
                                                    position: 'absolute', top: -6, right: -6,
                                                    backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11,
                                                    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'
                                                }}
                                            >
                                                <Feather name="x" size={12} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30 }}>
                            <TouchableOpacity onPress={isDocMode ? pickDocument : pickFromGallery} style={{ alignItems: 'center', width: 70 }}>
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={isDocMode ? "file-text" : "image"} size={22} color="#fff" />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Pick</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={isDocMode ? captureScan : capturePhoto} disabled={isProcessing} style={{ alignItems: 'center' }}>
                                <View style={{
                                    width: 76, height: 76, borderRadius: 38,
                                    borderWidth: 4, borderColor: '#fff',
                                    backgroundColor: isDocMode ? colors.primary : '#ea8c0a',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' }} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setIsDocMode(!isDocMode)} style={{ alignItems: 'center', width: 70 }}>
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={isDocMode ? "camera" : "file"} size={22} color="#fff" />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>{isDocMode ? 'Photo' : 'Files'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {fileQueue.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setMode('selection')}
                        style={{
                            position: 'absolute', bottom: insets.bottom + 140, right: 20,
                            backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30,
                            flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Next ({fileQueue.length})</Text>
                        <Feather name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    // 2. Selection & Review Flow (Unified Step 2)
    if (mode === 'selection') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => setMode('capture')}>
                        <Feather name="arrow-left" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Destination & Details</Text>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
                    {/* Selected Items Summary */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Selected Files ({fileQueue.length})</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {fileQueue.map((item, idx) => (
                                <View key={idx}>
                                    <Image source={{ uri: item.asset.uri }} style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: colors.border }} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Project Selection */}
                    {!selectedProject ? (
                        <View style={{ gap: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Choose Project</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {projects.map((p) => (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => {
                                            setSelectedProject(p.id);
                                            setSelectedFolder(null);
                                            setFolderBrowseId(null);
                                        }}
                                        style={{ width: '22%', alignItems: 'center', gap: 8 }}
                                    >
                                        <View style={{
                                            width: 60, height: 60, borderRadius: 16,
                                            backgroundColor: p.color || colors.primary,
                                            alignItems: 'center', justifyContent: 'center',
                                            elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{p.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={{ gap: 24 }}>
                            {/* Selected Project Header */}
                            <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ gap: 4 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' }}>Project</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{projects.find(p => p.id === selectedProject)?.name}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedProject(null)} style={{ padding: 8, backgroundColor: colors.primary + '15', borderRadius: 8 }}>
                                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Change</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Folder Browsing/Selection */}
                            <View style={{ gap: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Select Folder</Text>
                                    <TouchableOpacity onPress={() => setShowCreateFolder(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.primary + '10', borderRadius: 20 }}>
                                        <Feather name="folder-plus" size={14} color={colors.primary} />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>New</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Breadcrumbs */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingBottom: 4 }}>
                                    <TouchableOpacity onPress={() => setFolderBrowseId(null)}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: !folderBrowseId ? colors.primary : colors.textMuted }}>Root</Text>
                                    </TouchableOpacity>
                                    {browseBreadcrumbs.map((b) => (
                                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Feather name="chevron-right" size={12} color={colors.textMuted} />
                                            <TouchableOpacity onPress={() => setFolderBrowseId(b.id)}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: b.id === folderBrowseId ? colors.primary : colors.textMuted }}>{b.name}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>

                                {/* Folders Grid */}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                    {/* Select CURRENT folder as destination */}
                                    <TouchableOpacity
                                        onPress={() => setSelectedFolder(folderBrowseId || 'root')}
                                        style={{
                                            width: '31%', aspectRatio: 1, borderRadius: 16,
                                            backgroundColor: selectedFolder === (folderBrowseId || 'root') ? colors.primary + '15' : colors.surface,
                                            borderWidth: 2, borderColor: selectedFolder === (folderBrowseId || 'root') ? colors.primary : colors.border,
                                            alignItems: 'center', justifyContent: 'center', padding: 10
                                        }}
                                    >
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selectedFolder === (folderBrowseId || 'root') ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                                            <Feather name="check" size={24} color="#fff" />
                                        </View>
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }}>Select This</Text>
                                    </TouchableOpacity>

                                    {getFolderChildren(folderBrowseId).map((f) => (
                                        <TouchableOpacity
                                            key={f.id}
                                            onPress={() => setFolderBrowseId(String(f.id))}
                                            style={{
                                                width: '31%', aspectRatio: 1, borderRadius: 16, backgroundColor: colors.surface,
                                                borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 10
                                            }}
                                        >
                                            <Feather name="folder" size={32} color={colors.primary} />
                                            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 8, textAlign: 'center' }}>{f.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Metadata Entry - ONLY IF FOLDER IS SELECTED */}
                            {selectedFolder && (
                                <View style={{ gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Add Details</Text>
                                        <View style={{ gap: 16 }}>
                                            <View>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 }}>LOCATION</Text>
                                                <TextInput
                                                    value={photoLocation} onChangeText={setPhotoLocation}
                                                    placeholder="e.g., Block A, Level 1" placeholderTextColor={colors.textMuted}
                                                    style={{ height: 50, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text }}
                                                />
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 }}>TAGS</Text>
                                                <TextInput
                                                    value={photoTags} onChangeText={setPhotoTags}
                                                    placeholder="foundation, concrete" placeholderTextColor={colors.textMuted}
                                                    style={{ height: 50, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text }}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Fixed Upload Button */}
                {selectedProject && selectedFolder && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <TouchableOpacity
                            onPress={handleUpload}
                            style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                        >
                            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Confirm & Upload {fileQueue.length} Files</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, elevation: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>New Folder</Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>Creating in: {folderBrowseId ? browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name : 'Root'}</Text>
                            <TextInput
                                value={newFolderName} onChangeText={setNewFolderName} placeholder="Enter folder name..." placeholderTextColor={colors.textMuted} autoFocus
                                style={{ height: 52, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text, marginBottom: 24 }}
                            />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()} style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '800' }}>{creatingFolder ? 'Creating...' : 'Create'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    // 3. Uploading & Done Mode
    const doneCount = fileQueue.filter((f: any) => f.status === 'done').length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
                {mode === 'done' ? (
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#22c55e' + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Feather name="check" size={48} color="#22c55e" />
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Upload Complete!</Text>
                        <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center' }}>Successfully uploaded {doneCount} files.</Text>
                    </View>
                ) : (
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 }}>Uploading {fileQueue.length} Files</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={{ fontSize: 14, color: colors.textMuted }}>Please wait while your files are being uploaded</Text>
                        </View>
                    </View>
                )}

                <View style={{ gap: 14, marginBottom: 40 }}>
                    {fileQueue.map((item, idx) => (
                        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {item.asset.type.startsWith('image/') ? (
                                        <Image source={{ uri: item.asset.uri }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Feather name="file" size={24} color={colors.textMuted} />
                                    )}
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.asset.fileName || `File ${idx + 1}`}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: item.status === 'error' ? '#ef4444' : colors.textMuted }}>
                                        {item.status === 'done' ? 'Successfully Uploaded' : item.status === 'error' ? 'Upload Failed' : `${Math.round(item.progress)}% Uploaded`}
                                    </Text>
                                </View>
                                {item.status === 'done' && <Feather name="check-circle" size={22} color="#22c55e" />}
                                {item.status === 'error' && <Feather name="alert-circle" size={22} color="#ef4444" />}
                            </View>

                            {item.status !== 'done' && item.status !== 'error' && (
                                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                                    <View
                                        style={{
                                            height: '100%', backgroundColor: colors.primary,
                                            width: `${item.progress}%`
                                        }}
                                    />
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {mode === 'done' && (
                    <View style={{ gap: 12 }}>
                        <TouchableOpacity onPress={() => { setFileQueue([]); setMode('capture'); }} style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Start New Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleClose} style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Back to Folder</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
