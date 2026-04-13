import { useState, useEffect, useRef } from 'react';
import {
    View, TouchableOpacity, ScrollView, Alert, Animated, Image, Modal, BackHandler, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { parseApiError } from '@/helpers/apiError';
import ImageAnnotator from '@/components/common/ImageAnnotator';

let DocumentScanner: any;
try {
    DocumentScanner = require('react-native-document-scanner-plugin').default;
} catch (e) {
    console.warn('DocumentScanner native module not found. Falling back to camera.');
}



import { useAuth } from '@/contexts/AuthContext';

import { useTheme } from '@/contexts/ThemeContext';
import { uploadFileWithProgress } from '@/services/fileService';
import { getProjects } from '@/services/projectService';
import { getFolders, createFolder } from '@/services/folderService';
import { createActivity } from '@/services/activityService';
import { getActiveProjectContext } from '@/utils/projectSelection';
import { PrivateAxios } from '../../helpers/PrivateAxios';




type Asset = any;

interface FileProgress {
    asset: Asset;
    progress: number; // 0–100
    status: 'pending' | 'uploading' | 'done' | 'error';
    anim: Animated.Value;
    source?: 'camera' | 'gallery' | 'document' | 'scan';
}

type Mode = 'capture' | 'selection' | 'uploading' | 'done' | 'folder_photo' | 'folder_doc';


export default function UploadScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{ projectId?: string; folderId?: string; type?: string }>();

    const isFocused = useIsFocused();

    // Permissions
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Refs for camera
    const cameraRef = useRef<CameraView>(null);


    // State: Flow Control
    const [mode, setMode] = useState<Mode>('capture');

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
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [pendingAnnotation, setPendingAnnotation] = useState<{ uri: string; fileName: string; type: string } | null>(null);
    const [annotatingQueueIdx, setAnnotatingQueueIdx] = useState<number | null>(null);

    // State: Environment warnings
    const [hasWarnedScanner, setHasWarnedScanner] = useState(false);
    // State: Camera doc mode

    const [isDocMode, setIsDocMode] = useState(params.type === 'documents');
    const [scanMode, setScanMode] = useState<'single' | 'separate'>('single');



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
                const { projectId, folderId, type } = getActiveProjectContext();
                if (projectId) {
                    setSelectedProject(projectId);
                    setSelectedFolder(folderId); // This ensures it's set even if null (root)
                    if (type === 'document') {
                        setIsDocMode(true);
                    } else if (type === 'photo') {
                        setIsDocMode(false);
                    }
                    setMode('capture');
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
        setIsLoadingFolders(true);
        getFolders(selectedProject, isDocMode ? 'document' : 'photo')
            .then((data) => {
                const rawFolders = Array.isArray(data) ? data : (data.folders ?? []);
                setFolders(rawFolders);
            })
            .catch((e) => console.error('fetchFolders', e))
            .finally(() => setIsLoadingFolders(false));
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
            <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
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
                progress: 0, status: 'pending', anim: new Animated.Value(0), source: isDocMode ? 'scan' : 'gallery',
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

    const handlePick = () => {
        if (!isDocMode) {
            pickFromGallery();
            return;
        }

        Alert.alert(
            "Select Source",
            "Choose where to pick your documents from:",
            [
                { text: "Gallery (Images as Scans)", onPress: pickFromGallery },
                { text: "Files (PDFs/Docs)", onPress: pickDocument },
                { text: "Cancel", style: "cancel" }
            ]
        );
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
                exif: true,
            });

            if (!photo?.uri) return;

            // Fix orientation for iOS items
            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                [],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );

            if (isDocMode) {
                addToQueue([{
                    asset: {
                        uri: manipulated.uri,
                        fileName: manipulated.uri.split('/').pop() || `capture_${Date.now()}.jpg`,
                        type: 'image/jpeg',
                        size: 0
                    },
                    progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'scan',
                }]);
            } else {
                setPendingAnnotation({
                    uri: manipulated.uri,
                    fileName: manipulated.uri.split('/').pop() || `capture_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                });
            }

        } catch (error: any) {
            console.error('Camera Error:', error);
            Alert.alert('Camera Error', error?.message || 'Failed to capture photo');
        } finally {
            setIsProcessing(false);
        }
    };


    const captureScan = async () => {
        if (!DocumentScanner || Constants.appOwnership === 'expo') {
            if (!hasWarnedScanner) {
                setHasWarnedScanner(true);
                Alert.alert(
                    "Native Scanner Unavailable",
                    "Advanced document scanning (auto-edge detection) requires a Development Build. We will use the standard camera instead.",
                    [{ text: "OK", onPress: () => capturePhoto() }]
                );
            } else {
                capturePhoto();
            }
            return;
        }

        try {
            const { scannedImages } = await DocumentScanner.scanDocument({
                maxNumDocuments: 20 - fileQueue.length,
            });

            if (scannedImages && scannedImages.length > 0) {
                const queue: FileProgress[] = [];
                
                for (let i = 0; i < scannedImages.length; i++) {
                    const originalUri = scannedImages[i];
                    // Normalize URI for iOS
                    let uri = originalUri;
                    if (Platform.OS === 'ios' && !uri.startsWith('file://')) {
                        uri = `file://${uri}`;
                    }

                    // Optional: Fix orientation/strip EXIF if ImageManipulator is available
                    try {
                        const manipulated = await ImageManipulator.manipulateAsync(
                            uri,
                            [],
                            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                        );
                        uri = manipulated.uri;
                    } catch (e) {
                        console.warn('Scanner ImageManipulator failed:', e);
                    }

                    queue.push({
                        asset: { 
                            uri, 
                            fileName: `scan_${Date.now()}_${i}.jpg`, 
                            type: 'image/jpeg', 
                            size: 0 
                        },
                        progress: 0, 
                        status: 'pending', 
                        anim: new Animated.Value(0), 
                        source: 'scan',
                    });
                }
                addToQueue(queue);
            }
        } catch (error) {
            console.error('Scan Error:', error);
            Alert.alert('Scan Error', 'Failed to scan document');
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
        if (!selectedProject || !selectedFolder || fileQueue.length === 0) {
            Alert.alert('Incomplete', 'Please select a project and destination folder.');
            return;
        }

        const itemsToUpload = fileQueue.filter(f => f.status !== 'done');
        if (itemsToUpload.length === 0) {
            setMode('done');
            return;
        }
        setMode('uploading');


        try {
            if (isDocMode) {
                // Document Upload Path (Scans or Docs)
                const formData = new FormData();
                formData.append('project_id', selectedProject!);
                formData.append('folder_id', (selectedFolder === 'root' ? '' : selectedFolder) || '');
                formData.append('mode', scanMode);
                formData.append('file_name', `Scan_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
                if (photoLocation) formData.append('location', photoLocation);
                if (photoTags) formData.append('tags', photoTags);
                formData.append('is_doc_mode', String(isDocMode));


                itemsToUpload.forEach((item, idx) => {

                    formData.append('files', {
                        uri: item.asset.uri,
                        name: item.asset.fileName || `file_${idx}.jpg`,
                        type: item.asset.type || 'image/jpeg',
                    } as any);
                });

                const res = await PrivateAxios.post('/files/upload-scans', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const total = progressEvent.total || 1;
                        const p = Math.min(Math.round((progressEvent.loaded / total) * 100), 100);
                        setFileQueue(prev => prev.map(it => ({ ...it, progress: p, status: p === 100 ? 'done' : 'uploading' })));
                    }

                });

                if (res.data.success) {
                    setFileQueue(prev => prev.map(it => ({ ...it, status: 'done', progress: 100 })));
                    setMode('done');
                    await createActivity({ project_id: selectedProject!, type: 'upload', description: `Uploaded ${itemsToUpload.length} documents` });

                }
            } else {
                // Photo Upload Path
                for (let i = 0; i < itemsToUpload.length; i++) {
                    const item = itemsToUpload[i];
                    
                    const formData = new FormData();
                    formData.append('file', {
                        uri: item.asset.uri,
                        name: item.asset.fileName || `photo_${i}.jpg`,
                        type: item.asset.type || 'image/jpeg',
                    } as any);
                    formData.append('project_id', selectedProject!);
                    formData.append('folder_id', (selectedFolder === 'root' ? '' : selectedFolder) || '');
                    formData.append('file_tag', 'photo');
                    formData.append('client_visible', String(true));
                    if (photoLocation) formData.append('location', photoLocation);
                    if (photoTags) formData.append('tags', photoTags);

                    await uploadFileWithProgress(
                        formData,
                        (p) => {
                            setFileQueue(prev => {
                                const next = [...prev];
                                const targetIdx = next.findIndex(n => n.asset.uri === item.asset.uri);
                                if (targetIdx !== -1) {
                                    next[targetIdx].progress = p;
                                    next[targetIdx].status = p === 100 ? 'done' : 'uploading';
                                }
                                return next;
                            });
                        }
                    );
                }
                setMode('done');
                await createActivity({ project_id: selectedProject!, type: 'upload', description: `Uploaded ${itemsToUpload.length} photos` });


            }

        } catch (error: any) {
            console.error('Upload error:', error);
            setFileQueue(prev => prev.map(it => it.status === 'done' ? it : { ...it, status: 'error' }));
            const { message, code } = parseApiError(error, 'Some files could not be uploaded.');
            
            let buttons: any = undefined;
            if (code === 'LIMIT_REACHED') {
                buttons = [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade', onPress: () => router.push('/subscription') }
                ];
            } else if (code === 'SUBSCRIPTION_LOCKED') {
                buttons = [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Billing', onPress: () => router.push('/subscription') }
                ];
            }

            Alert.alert(
                code === 'LIMIT_REACHED' ? 'Limit Reached' : (code === 'SUBSCRIPTION_LOCKED' ? 'Subscription Locked' : 'Upload Failed'), 
                message,
                buttons
            );
        }
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
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 8, paddingRight: 12 }}>
                                    {fileQueue.map((item, idx) => (
                                        <View key={idx} style={{ position: 'relative' }}>
                                            <TouchableOpacity onPress={() => setAnnotatingQueueIdx(idx)}>
                                                <Image source={{ uri: item.asset.uri }} style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }} />
                                                <View style={{ position: 'absolute', bottom: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 7, padding: 3 }}>
                                                    <Feather name="edit-2" size={10} color="#fff" />
                                                </View>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setFileQueue(prev => prev.filter((_, i) => i !== idx))}
                                                style={{
                                                    position: 'absolute', top: -8, right: -8, zIndex: 10, elevation: 4,
                                                    backgroundColor: '#ef4444', width: 24, height: 24, borderRadius: 12,
                                                    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000'
                                                }}
                                            >
                                                <Feather name="x" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30 }}>
                            <TouchableOpacity onPress={handlePick} style={{ alignItems: 'center', width: 70 }}>
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={isDocMode ? "file-plus" : "image"} size={22} color="#fff" />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>{isDocMode ? 'Import' : 'Gallery'}</Text>
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

                            <TouchableOpacity
                                onPress={() => {
                                    if (fileQueue.length > 0) {
                                        Alert.alert(
                                            "Clear Queue?",
                                            `Switching to ${!isDocMode ? 'Photo' : 'Scan'} mode will discard your current selections. Continue?`,
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                { text: "Clear & Switch", style: "destructive", onPress: () => { setFileQueue([]); setIsDocMode(!isDocMode); } }
                                            ]
                                        );
                                    } else {
                                        setIsDocMode(!isDocMode);
                                    }
                                }}
                                style={{ alignItems: 'center', width: 70 }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={isDocMode ? "camera" : "file"} size={22} color="#fff" />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>{isDocMode ? 'Photo' : 'Scan'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {fileQueue.length > 0 && (
                    <TouchableOpacity
                        onPress={() => setMode('selection')}
                        style={{
                            position: 'absolute', bottom: insets.bottom + 180, right: 20,
                            backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30,
                            flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Next ({fileQueue.length})</Text>
                        <Feather name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Annotator: after camera capture (auto-opens) */}
                {pendingAnnotation && (
                    <ImageAnnotator
                        uri={pendingAnnotation.uri}
                        onSave={(newUri) => {
                            addToQueue([{ asset: { uri: newUri, fileName: pendingAnnotation.fileName, type: pendingAnnotation.type, size: 0 }, progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'camera' }]);
                            setPendingAnnotation(null);
                        }}
                        onCancel={() => {
                            addToQueue([{ asset: { uri: pendingAnnotation.uri, fileName: pendingAnnotation.fileName, type: pendingAnnotation.type, size: 0 }, progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'camera' }]);
                            setPendingAnnotation(null);
                        }}
                    />
                )}

                {/* Annotator: tap-to-edit existing queue thumbnail */}
                {annotatingQueueIdx !== null && fileQueue[annotatingQueueIdx] && (
                    <ImageAnnotator
                        uri={fileQueue[annotatingQueueIdx].asset.uri}
                        onSave={(newUri) => {
                            setFileQueue(prev => { const next = [...prev]; next[annotatingQueueIdx] = { ...next[annotatingQueueIdx], asset: { ...next[annotatingQueueIdx].asset, uri: newUri } }; return next; });
                            setAnnotatingQueueIdx(null);
                        }}
                        onCancel={() => setAnnotatingQueueIdx(null)}
                    />
                )}
            </SafeAreaView>
        );
    }

    // 2. Selection & Review Flow (Unified Step 2)
    if (mode === 'selection') {
        return (
            <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
                >
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    paddingHorizontal: 20, 
                    paddingVertical: 16, 
                    backgroundColor: colors.background,
                    borderBottomWidth: 1, 
                    borderBottomColor: colors.border 
                }}>
                    <TouchableOpacity 
                        onPress={() => setMode('capture')}
                        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
                    >
                        <Feather name="arrow-left" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                        {isDocMode ? 'Review & Upload' : 'Photo Destination'}
                    </Text>
                    <View style={{ width: 40 }} /> 
                </View>


                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                    {mode === 'selection' && (
                        <View style={{ marginBottom: 28 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>Selected {isDocMode ? 'Documents' : 'Photos'}</Text>
                                <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>{fileQueue.length}</Text>
                                </View>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                {fileQueue.map((item, idx) => (
                                    <View key={idx}>
                                        <Image source={{ uri: item.asset.uri }} style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: colors.border }} />
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {isDocMode && mode === 'selection' && fileQueue.length > 1 && (

                        <View style={{ marginBottom: 24, backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>Scan Grouping</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setScanMode('single')}
                                    style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: scanMode === 'single' ? colors.primary : colors.border, backgroundColor: scanMode === 'single' ? colors.primary + '10' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: scanMode === 'single' ? colors.primary : colors.text }}>Single PDF</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setScanMode('separate')}
                                    style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: scanMode === 'separate' ? colors.primary : colors.border, backgroundColor: scanMode === 'separate' ? colors.primary + '10' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: scanMode === 'separate' ? colors.primary : colors.text }}>Separate PDFs</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}


                    {!selectedProject ? (
                        <View style={{ gap: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name="briefcase" size={16} color={colors.primary} />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Select Project</Text>
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {projects.map((p: any) => (
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
                                            width: 64, height: 64, borderRadius: 20,
                                            backgroundColor: p.color || colors.primary,
                                            alignItems: 'center', justifyContent: 'center',
                                            shadowColor: p.color || colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
                                            elevation: 4,
                                            borderWidth: 2,
                                            borderColor: 'rgba(255,255,255,0.2)'
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{p.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <Text numberOfLines={2} style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{p.name}</Text>

                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={{ gap: 24 }}>
                            {mode === 'selection' && (
                                <View style={{ 
                                    backgroundColor: colors.surface, 
                                    padding: 18, 
                                    borderRadius: 20, 
                                    borderWidth: 1, 
                                    borderColor: colors.border, 
                                    flexDirection: 'row', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 5,
                                    elevation: 2
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name="briefcase" size={20} color={colors.primary} />
                                        </View>
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Target Project</Text>
                                            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                                                {projects.find(p => String(p.id) === String(selectedProject))?.name}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedProject(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary + '10', borderRadius: 10 }}>
                                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>Change</Text>
                                    </TouchableOpacity>
                                </View>
                            )}


                            <View style={{ gap: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                                        {isDocMode ? 'Select Docs Folder' : 'Select Photo Folder'}
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowCreateFolder(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.primary + '10', borderRadius: 20 }}>
                                        <Feather name="folder-plus" size={14} color={colors.primary} />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>New</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingBottom: 8 }}>
                                    <TouchableOpacity 
                                        onPress={() => { setFolderBrowseId(null); setSelectedFolder('root'); }}
                                        style={{ height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: !folderBrowseId ? colors.primary : colors.surface, borderWidth: 1, borderColor: !folderBrowseId ? colors.primary : colors.border, justifyContent: 'center' }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: !folderBrowseId ? '#fff' : colors.textMuted }}>{projects.find((p: any) => String(p.id) === String(selectedProject))?.name}</Text>
                                    </TouchableOpacity>
                                    {browseBreadcrumbs.map((b: any) => (
                                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Feather name="chevron-right" size={14} color={colors.textMuted} />
                                            <TouchableOpacity 
                                                onPress={() => { setFolderBrowseId(b.id); setSelectedFolder(b.id); }}
                                                style={{ height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: b.id === folderBrowseId ? colors.primary : colors.surface, borderWidth: 1, borderColor: b.id === folderBrowseId ? colors.primary : colors.border, justifyContent: 'center' }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: b.id === folderBrowseId ? '#fff' : colors.textMuted }}>{b.name}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>


                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                    {isLoadingFolders ? (
                                        <View style={{ flex: 1, paddingVertical: 40, alignItems: 'center' }}>
                                            <ActivityIndicator size="large" color={colors.primary} />
                                            <Text style={{ marginTop: 12, color: colors.textMuted }}>Fetching folders...</Text>
                                        </View>
                                    ) : (
                                        <>
                                            {getFolderChildren(folderBrowseId).map((f: any) => (
                                                <TouchableOpacity
                                                    key={f.id}
                                                    onPress={() => {
                                                        const targetId = String(f.id);
                                                        setFolderBrowseId(targetId);
                                                        setSelectedFolder(targetId);
                                                    }}
                                                    style={{
                                                        width: '30%', aspectRatio: 0.9, borderRadius: 20, backgroundColor: String(selectedFolder) === String(f.id) ? colors.primary + '10' : colors.surface,
                                                        borderWidth: 2, borderColor: String(selectedFolder) === String(f.id) ? colors.primary : colors.border,
                                                        alignItems: 'center', justifyContent: 'center', padding: 10,
                                                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
                                                    }}
                                                >
                                                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: String(selectedFolder) === String(f.id) ? colors.primary : colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                                                        <Feather name="folder" size={24} color={String(selectedFolder) === String(f.id) ? '#fff' : colors.primary} />
                                                    </View>
                                                    <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{f.name}</Text>
                                                </TouchableOpacity>

                                            ))}
                                            {getFolderChildren(folderBrowseId).length === 0 && (
                                                <View style={{ flex: 1, alignItems: 'center', paddingVertical: 20 }}>
                                                    <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>No subfolders here.</Text>
                                                </View>
                                            )}
                                        </>
                                    )}

                                </View>
                            </View>

                            {mode === 'selection' && selectedFolder && (
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

                {mode === 'selection' && selectedProject && selectedFolder && (
                    <View style={{ 
                        padding: 20, 
                        paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 30, 
                        backgroundColor: colors.background, 
                        borderTopWidth: 1, 
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -10 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 20
                    }}>
                        <TouchableOpacity
                            onPress={handleUpload}
                            activeOpacity={0.8}
                            style={{ 
                                height: 58, 
                                borderRadius: 20, 
                                backgroundColor: colors.primary, 
                                flexDirection: 'row',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: 12,
                                shadowColor: colors.primary, 
                                shadowOffset: { width: 0, height: 8 }, 
                                shadowOpacity: 0.4, 
                                shadowRadius: 12,
                                elevation: 8
                            }}
                        >
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="upload-cloud" size={18} color="#fff" />
                            </View>
                            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 }}>
                                {`Confirm & Upload ${fileQueue.length} ${isDocMode ? 'Doc' : 'Photo'}${fileQueue.length > 1 ? 's' : ''}`}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                </KeyboardAvoidingView>

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
    const doneCount = fileQueue.filter((f: FileProgress) => f.status === 'done').length;


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
                            {!fileQueue.some(f => f.status === 'error') && (
                                <ActivityIndicator size="small" color={colors.primary} />
                            )}
                            <Text style={{ fontSize: 14, color: colors.textMuted }}>
                                {fileQueue.some(f => f.status === 'error') 
                                    ? 'Some uploads failed. Please retry or cancel.' 
                                    : 'Please wait while your files are being uploaded'}
                            </Text>
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

                <View style={{ gap: 12 }}>
                    {mode === 'done' ? (
                        <>
                            <TouchableOpacity onPress={() => { setFileQueue([]); setMode('capture'); }} style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Start New Upload</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleClose} style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Back to Folder</Text>
                            </TouchableOpacity>
                        </>
                    ) : fileQueue.some(f => f.status === 'error') ? (
                        <>
                            <TouchableOpacity onPress={handleUpload} style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Retry Failed Uploads</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setFileQueue([]); setMode('capture'); }} style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Cancel & Clear</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
