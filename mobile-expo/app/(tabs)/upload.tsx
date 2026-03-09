import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Animated,
    Image,
    Modal
} from 'react-native';
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
import { getFolders } from '@/services/folderService';
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

type Mode = 'capture' | 'destination' | 'uploading' | 'done';

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
    const [mode, setMode] = useState<Mode>('capture');
    const [fileQueue, setFileQueue] = useState<FileProgress[]>([]);

    // State: Destination Selection
    const [selectedProject, setSelectedProject] = useState<string | null>(params.projectId || null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(params.folderId || null);
    const [projects, setProjects] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');

    // State: Folder Browse (for nested selection in 'destination' view)
    const [folderBrowseId, setFolderBrowseId] = useState<string | null>(null);

    // State: Processing
    const [isProcessing, setIsProcessing] = useState(false);
    // State: Camera doc mode (when true, shutter takes a scan; Files button shown as active)
    const [isDocMode, setIsDocMode] = useState(false);

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
        setLoadingProjects(true);
        getProjects()
            .then((data) => { if (data.projects) setProjects(data.projects); })
            .catch((e) => console.error('fetchProjects', e))
            .finally(() => setLoadingProjects(false));
    }, [user]);

    useEffect(() => {
        if (!selectedProject) { setFolders([]); return; }
        setLoadingFolders(true);
        // Load folders for the chosen project. Assuming 'documents' logic for all files right now,
        // or passing null to get all folders. Let's pass 'documents' to safely pull standard project tree.
        getFolders(selectedProject, 'documents')
            .then((data) => {
                const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
                setFolders(rawFolders);
            })
            .catch((e) => console.error('fetchFolders', e))
            .finally(() => setLoadingFolders(false));
    }, [selectedProject]);

    // Role check
    if (!user || user.role === 'client') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Upload is not available for your role.</Text>
            </SafeAreaView>
        );
    }

    // Auto-expand folder tree to show selected folder on initial load
    useEffect(() => {
        if (selectedFolder && selectedFolder !== 'root' && folders.length > 0 && !folderBrowseId) {
            const target = folders.find(f => String(f.id) === String(selectedFolder));
            if (target && target.parent_id) {
                setFolderBrowseId(target.parent_id);
            }
        }
    }, [folders, selectedFolder]);

    // -- File Selection / Capturing Handlers --

    const addToQueue = (newItems: FileProgress[]) => {
        if (fileQueue.length + newItems.length > 20) {
            Alert.alert('Limit Reached', 'You can only select up to 20 files at once.');
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

    // -- Destination Logic --

    const getFolderChildren = (parentId: string | null) =>
        folders.filter((f) => String(f.parent_id ?? 'null') === String(parentId ?? 'null'));

    const getBreadcrumbFolders = (folderId: string | null): any[] => {
        if (!folderId) return [];
        const current = folders.find((f) => String(f.id) === String(folderId));
        if (!current) return [];
        return [...getBreadcrumbFolders(current.parent_id != null ? String(current.parent_id) : null), current];
    };

    const currentBrowseFolders = getFolderChildren(folderBrowseId);
    const browseBreadcrumbs = getBreadcrumbFolders(folderBrowseId);

    // -- Upload Logic --

    const handleUpload = async () => {
        if (fileQueue.length === 0) return;
        if (!selectedProject || selectedFolder === null) {
            Alert.alert('Error', 'Project and folder must be selected.');
            return;
        }

        setMode('uploading');
        const updatedQueue = [...fileQueue];

        for (let i = 0; i < updatedQueue.length; i++) {
            const item = updatedQueue[i];
            updatedQueue[i] = { ...item, status: 'uploading' };
            setFileQueue([...updatedQueue]);

            try {
                const formData = new FormData();
                formData.append('file', {
                    uri: item.asset.uri,
                    name: item.asset.fileName || `upload_${i}`,
                    type: item.asset.type || 'application/octet-stream',
                } as any);

                const finalFolder = selectedFolder === 'root' ? '' : (selectedFolder || '');
                const finalTag = isDocMode ? 'document' : 'photo';

                formData.append('project_id', String(selectedProject));
                formData.append('folder_id', finalFolder);
                formData.append('client_visible', String(true));
                formData.append('file_tag', finalTag);
                formData.append('skipActivity', 'true');
                // Attach metadata globally to all photos uploaded in this batch
                if (photoLocation) formData.append('location', photoLocation);
                if (photoTags) formData.append('tags', photoTags);

                await uploadFileWithProgress(formData, (pct) => {
                    updatedQueue[i] = { ...updatedQueue[i], progress: pct };
                    setFileQueue([...updatedQueue]);
                    Animated.timing(updatedQueue[i].anim, { toValue: pct / 100, duration: 100, useNativeDriver: false }).start();
                });

                updatedQueue[i] = { ...updatedQueue[i], progress: 100, status: 'done' };
                setFileQueue([...updatedQueue]);
            } catch (err) {
                updatedQueue[i] = { ...updatedQueue[i], status: 'error' };
                setFileQueue([...updatedQueue]);
            }
        }

        const successCount = updatedQueue.filter((f) => f.status === 'done').length;
        if (successCount > 0 && selectedProject) {
            try {
                await createActivity({
                    project_id: selectedProject,
                    type: 'upload',
                    description: `${successCount} new files uploaded`
                });
            } catch (err) { }
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

    const handleClose = () => {
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
    };

    // ── RENDER ──────────────────────────────────────────────────────────────

    // 1. Capture Mode
    if (mode === 'capture') {
        // DocumentScanProcessor is rendered invisibly here to enable B&W processing
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
                {/* Hidden B&W document enhancer */}
                <DocumentScanProcessor ref={processorRef} />

                <View style={{ flex: 1 }}>
                    {/* Header Overlay */}
                    <View style={{
                        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingHorizontal: 20, paddingVertical: 16,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                    }}>
                        <TouchableOpacity onPress={fileQueue.length > 0 ? () => Alert.alert('Discard?', 'Are you sure you want to discard your selections?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: handleClose }]) : handleClose}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Capture</Text>

                        {fileQueue.length > 0 ? (
                            <TouchableOpacity onPress={() => setMode('destination')} style={{ backgroundColor: '#f97316', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Next</Text>
                            </TouchableOpacity>
                        ) : <View style={{ width: 60 }} />}
                    </View>

                    {/* Camera */}
                    {(cameraPermission?.granted && isFocused) ? (
                        <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef} autofocus="on" />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                            <TouchableOpacity onPress={requestCameraPermission} style={{ padding: 12, backgroundColor: '#f97316', borderRadius: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Processing Overlay */}
                    {isProcessing && (
                        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Processing...</Text>
                        </View>
                    )}

                    {/* Bottom Controls Area */}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', paddingBottom: Math.max(insets.bottom, 16), zIndex: 15 }}>

                        {/* Inline Previews */}
                        {fileQueue.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                                {fileQueue.map((item, idx) => (
                                    <View key={idx} style={{ marginRight: 12, position: 'relative' }}>
                                        {item.source === 'document' ? (
                                            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="file-text" size={24} color="#f97316" />
                                            </View>
                                        ) : (
                                            <Image source={{ uri: item.asset.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                        )}
                                        <TouchableOpacity
                                            onPress={() => setFileQueue(prev => prev.filter((_, i) => i !== idx))}
                                            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Feather name="x" size={12} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* 3-button capture row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 16 }}>

                            {/* Left Button: Gallery (Photo Mode) OR Pick File (Doc Mode) */}
                            {isDocMode ? (
                                <TouchableOpacity onPress={pickDocument} style={{ alignItems: 'center', width: 70 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="file-text" size={22} color="#fff" />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Pick File</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={pickFromGallery} style={{ alignItems: 'center', width: 70 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="image" size={22} color="#fff" />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Gallery</Text>
                                </TouchableOpacity>
                            )}

                            {/* Center Button: Shutter (Photo or Scan) */}
                            <TouchableOpacity
                                onPress={isDocMode ? captureScan : capturePhoto}
                                disabled={isProcessing}
                                style={{ alignItems: 'center' }}
                            >
                                <View style={{
                                    width: 76, height: 76, borderRadius: 38,
                                    borderWidth: 4, borderColor: '#fff',
                                    backgroundColor: isDocMode ? '#f97316' : '#ea8c0a', // Space between is orange
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <View style={{
                                        width: 52, height: 52, borderRadius: 26,
                                        backgroundColor: '#fff', // Inner circle is white
                                    }} />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>
                                    {isDocMode ? 'Scan Doc' : 'Photo'}
                                </Text>
                            </TouchableOpacity>

                            {/* Right Button: Toggle Mode (Files or Photo) */}
                            {isDocMode ? (
                                <TouchableOpacity onPress={() => setIsDocMode(false)} style={{ alignItems: 'center', width: 70 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="camera" size={22} color="#fff" />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Photo</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => setIsDocMode(true)} style={{ alignItems: 'center', width: 70 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="file" size={22} color="#fff" />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Files</Text>
                                </TouchableOpacity>
                            )}

                        </View>

                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // 2. Destination Mode
    if (mode === 'destination') {
        const canUpload = selectedProject && selectedFolder !== null;

        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => {
                        // If we are strictly bound to a project and folder, and have no other choice,
                        // back button here could either go to capture mode or cancel upload. Let's go to capture.
                        setMode('capture');
                    }}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Upload Details</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

                    {/* Selected Files Preview */}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Selected Files ({fileQueue.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                        {fileQueue.map((item, idx) => (
                            <View key={idx} style={{ marginRight: 8, alignItems: 'center', width: 64 }}>
                                {item.source === 'document' ? (
                                    <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                                        <Feather name="file-text" size={24} color={colors.primary} />
                                    </View>
                                ) : (
                                    <Image source={{ uri: item.asset.uri }} style={{ width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} />
                                )}
                                <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textMuted, marginTop: 4, width: '100%', textAlign: 'center' }}>
                                    {item.asset.fileName}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Metadata fields for photos */}
                    {fileQueue.some(f => f.source === 'camera' || f.source === 'gallery') && (
                        <View style={{ gap: 12, marginBottom: 24 }}>
                            <View>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginBottom: 4 }}>Location (Optional)</Text>
                                <TextInput
                                    value={photoLocation} onChangeText={setPhotoLocation}
                                    placeholder="e.g., Block A, Level 2" placeholderTextColor={colors.textMuted}
                                    style={{ height: 44, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12 }}
                                />
                            </View>
                            <View>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginBottom: 4 }}>Tags (Optional)</Text>
                                <TextInput
                                    value={photoTags} onChangeText={setPhotoTags}
                                    placeholder="e.g., concrete, footing" placeholderTextColor={colors.textMuted}
                                    style={{ height: 44, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12 }}
                                />
                            </View>
                        </View>
                    )}

                    {/* Auto-selected destination notice */}
                    {(params.projectId || selectedProject) && (
                        <View style={{ backgroundColor: 'rgba(249,115,22,0.1)', padding: 12, borderRadius: 10, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#f97316', marginBottom: 4 }}>Current Destination</Text>
                            <Text style={{ fontSize: 13, color: colors.text }}>
                                {projects.find(p => p.id === selectedProject)?.name || 'Project'}
                                {selectedFolder ? ` / ${selectedFolder === 'root' ? 'Root Folder' : folders.find(f => String(f.id) === String(selectedFolder))?.name || 'Folder'}` : ' (Please choose a folder below)'}
                            </Text>
                        </View>
                    )}

                    {/* Step 1: Project Selection */}
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>1. Select Project</Text>
                    {loadingProjects ? <Text style={{ color: colors.textMuted, marginBottom: 20 }}>Loading...</Text> : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                            {projects.map((project) => (
                                <TouchableOpacity
                                    key={project.id}
                                    onPress={() => { setSelectedProject(project.id); setSelectedFolder(null); setFolderBrowseId(null); }}
                                    style={{
                                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                                        borderWidth: 1.5, borderColor: selectedProject === project.id ? '#f97316' : colors.border,
                                        backgroundColor: selectedProject === project.id ? 'rgba(249,115,22,0.1)' : colors.surface,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '500', color: selectedProject === project.id ? '#f97316' : colors.text }}>
                                        {project.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Step 2: Folder Selection */}
                    {selectedProject && (
                        <View>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>2. Select Destination Folder</Text>

                            {/* Breadcrumb navigator */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => setFolderBrowseId(null)}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: !folderBrowseId ? '#f97316' : colors.textMuted }}>
                                            {projects.find(p => String(p.id) === String(selectedProject))?.name || 'Root'}
                                        </Text>
                                    </TouchableOpacity>
                                    {browseBreadcrumbs.map((b) => (
                                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: colors.textMuted, marginHorizontal: 6 }}>/</Text>
                                            <TouchableOpacity onPress={() => setFolderBrowseId(b.id)}>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: folderBrowseId === b.id ? '#f97316' : colors.textMuted }}>
                                                    {b.name}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            {loadingFolders ? <Text style={{ color: colors.textMuted }}>Loading folders...</Text> : (
                                <View style={{ gap: 8, paddingBottom: 40 }}>
                                    {!folderBrowseId && (
                                        <TouchableOpacity
                                            onPress={() => setSelectedFolder('root')} // 'root' is visually distinct, gets turned to null on submit if we want root
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 12,
                                                borderRadius: 12, backgroundColor: colors.surface, padding: 14,
                                                borderWidth: 2, borderColor: selectedFolder === 'root' ? '#f97316' : colors.border,
                                            }}
                                        >
                                            <Feather name="folder" size={20} color="#f97316" />
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Root Folder</Text>
                                        </TouchableOpacity>
                                    )}

                                    {currentBrowseFolders.map((folder) => {
                                        const hasChildren = folders.some((f) => f.parent_id === folder.id);
                                        return (
                                            <View key={folder.id} style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity
                                                    onPress={() => setSelectedFolder(folder.id)}
                                                    style={{
                                                        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
                                                        borderRadius: 12, backgroundColor: colors.surface, padding: 14,
                                                        borderWidth: 2, borderColor: selectedFolder === folder.id ? '#f97316' : colors.border,
                                                    }}
                                                >
                                                    <Feather name="folder" size={20} color="#f97316" />
                                                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }} numberOfLines={1}>{folder.name}</Text>
                                                </TouchableOpacity>

                                                {hasChildren && (
                                                    <TouchableOpacity
                                                        onPress={() => setFolderBrowseId(folder.id)}
                                                        style={{ width: 50, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Feather name="chevron-right" size={20} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })}

                                    {currentBrowseFolders.length === 0 && folderBrowseId && (
                                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                            <Text style={{ color: colors.textMuted }}>No subfolders.</Text>
                                            <TouchableOpacity onPress={() => setSelectedFolder(folderBrowseId)} style={{ marginTop: 12, backgroundColor: colors.border, padding: 10, borderRadius: 6 }}>
                                                <Text style={{ color: colors.text, fontSize: 12 }}>Select '{browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name}'</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                </ScrollView>

                {/* Sticky Bottom Upload Bar */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity
                        onPress={handleUpload}
                        disabled={!canUpload}
                        style={{
                            height: 50, borderRadius: 25,
                            backgroundColor: canUpload ? '#f97316' : colors.border,
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                            Upload {fileQueue.length} files
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // 3. Uploading & Done Mode
    const doneCount = fileQueue.filter((f) => f.status === 'done').length;
    const errorCount = fileQueue.filter((f) => f.status === 'error').length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }}>
                {mode === 'done' && (
                    <View style={{ alignItems: 'center', marginBottom: 30 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Feather name="check" size={40} color="#f97316" />
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Done!</Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted }}>Uploaded {doneCount} of {fileQueue.length} files.</Text>
                    </View>
                )}

                {mode === 'uploading' && (
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 }}>
                        Uploading {doneCount}/{fileQueue.length}...
                    </Text>
                )}

                <View style={{ gap: 12, marginBottom: 40 }}>
                    {fileQueue.map((item, idx) => (
                        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Feather
                                    name={item.status === 'done' ? 'check-circle' : item.status === 'error' ? 'x-circle' : 'upload-cloud'}
                                    size={18}
                                    color={item.status === 'done' ? '#22c55e' : item.status === 'error' ? '#ef4444' : '#f97316'}
                                />
                                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.text }}>{item.asset.fileName || `file_${idx + 1}`}</Text>
                            </View>
                            <View style={{ height: 16, backgroundColor: colors.border, borderRadius: 8, overflow: 'hidden', justifyContent: 'center' }}>
                                <Animated.View
                                    style={{
                                        height: 16, borderRadius: 8,
                                        backgroundColor: item.status === 'error' ? '#ef4444' : item.status === 'done' ? '#22c55e' : '#f97316',
                                        width: item.status === 'done' ? '100%' : `${item.progress}%`,
                                    }}
                                />
                                <Text style={{ position: 'absolute', width: '100%', textAlign: 'center', fontSize: 10, color: '#fff', fontWeight: '700' }}>
                                    {item.status === 'error' ? 'Failed' : item.status === 'done' ? '100%' : `${Math.round(item.progress)}%`}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {mode === 'done' && (
                    <View style={{ flexDirection: 'column', gap: 12 }}>
                        <TouchableOpacity onPress={reset} style={{ height: 50, borderRadius: 25, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Upload More</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleClose}
                            style={{ height: 50, borderRadius: 25, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                                {(params.projectId || getActiveProjectContext().projectId) ? 'Return to Project' : 'Done'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
