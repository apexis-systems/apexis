import React, { useState, useEffect, useRef } from 'react';
import {
    View, TouchableOpacity, ScrollView, Alert, Animated, Image, Modal, BackHandler, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
    Dimensions
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
import { Accelerometer } from 'expo-sensors';
import Constants from 'expo-constants';
import { parseApiError } from '@/helpers/apiError';
import { useTranslation } from 'react-i18next';

let DocumentScanner: any;
try {
    DocumentScanner = require('react-native-document-scanner-plugin').default;
} catch (e) {
    console.warn('DocumentScanner native module not found. Falling back to camera.');
}



import { useAuth } from '@/contexts/AuthContext';

import { useTheme } from '@/contexts/ThemeContext';
import { uploadFileWithProgress, uploadScans } from '@/services/fileService';
import { getProjects } from '@/services/projectService';
import { getFolders, createFolder } from '@/services/folderService';
import { getProjectMembers } from '@/services/projectService';
import { createActivity } from '@/services/activityService';
import { getActiveProjectContext } from '@/utils/projectSelection';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
    useSharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';



const AnimatedCameraView = Reanimated.createAnimatedComponent(CameraView);




type Asset = any;

interface FileProgress {
    asset: Asset;
    progress: number; // 0–100
    status: 'pending' | 'uploading' | 'done' | 'error';
    anim: Animated.Value;
    source?: 'camera' | 'gallery' | 'document' | 'scan';
}

type Mode = 'capture' | 'selection' | 'uploading' | 'done' | 'folder_photo' | 'folder_doc';


const { width: SCREEN_W } = Dimensions.get('window');
const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

export default function UploadScreen() {
    const { t } = useTranslation();
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
    const [assignedTo, setAssignedTo] = useState<string | null>(null);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);

    // State: Folder Browse (for nested selection)
    const [folderBrowseId, setFolderBrowseId] = useState<string | null>(null);

    // State: Processing
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);
    const [memberPickerVisible, setMemberPickerVisible] = useState(false);

    // State: Environment warnings
    const [hasWarnedScanner, setHasWarnedScanner] = useState(false);
    // State: Camera doc mode

    const [isDocMode, setIsDocMode] = useState(params.type === 'documents');
    const [scanMode, setScanMode] = useState<'single' | 'separate'>('single');

    // Physical Orientation Tracking (to bypass iOS Orientation Lock)
    const [physicalOrientation, setPhysicalOrientation] = useState<number>(0);


    //zoom 
    const zoomShared = useSharedValue(0); // 0–1 for expo-camera
    const startZoom = useSharedValue(0);
    const [zoomDisplay, setZoomDisplay] = useState('1.0x'); // live label
    const zoomLabelOpacity = useSharedValue(0);
    let zoomHideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Max real-world zoom multiplier each platform supports
    const MAX_ZOOM_FACTOR = Platform.OS === 'ios' ? 10 : 10;

    // Converts 0-1 internal value → display string like "2.3x"
    const toDisplayZoom = (val: number) => {
        const factor = 1 + val * (MAX_ZOOM_FACTOR - 1);
        return `${factor.toFixed(1)}x`;
    };

    const showZoomLabel = (val: number) => {
        setZoomDisplay(toDisplayZoom(val));
        zoomLabelOpacity.value = withTiming(1, { duration: 80 });
        if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current);
        zoomHideTimer.current = setTimeout(() => {
            zoomLabelOpacity.value = withTiming(0, { duration: 400 });
        }, 1500);
    };

    const pinchGesture = React.useMemo(() =>
        Gesture.Pinch()
            .onStart(() => {
                startZoom.value = zoomShared.value;
            })
            .onUpdate((event) => {
                // Multiplicative zoom feels natural — same as native camera apps
                const raw = startZoom.value + (event.scale - 1) * (1 / MAX_ZOOM_FACTOR);
                const clamped = Math.max(0, Math.min(1, raw));
                zoomShared.value = clamped;
                runOnJS(showZoomLabel)(clamped);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [zoomShared, startZoom]);

    const animatedCameraProps = useAnimatedProps(() => ({
        zoom: zoomShared.value,
    }));

    const zoomLabelStyle = useAnimatedStyle(() => ({
        opacity: zoomLabelOpacity.value,
    }));

    // Keep for backwards compat (unused after button removal)
    const handleManualZoom = (z: number) => {
        zoomShared.value = withSpring(z, { damping: 20, stiffness: 100 });
        runOnJS(showZoomLabel)(z);
    };

    useEffect(() => {
        let subscription: any;
        const _subscribe = () => {
            subscription = Accelerometer.addListener(accelerometerData => {
                const { x, y } = accelerometerData;
                if (Math.abs(x) > Math.abs(y)) {
                    if (x > 0.5) setPhysicalOrientation(90); // Landscape Left (Home button right)
                    else if (x < -0.5) setPhysicalOrientation(270); // Landscape Right (Home button left)
                } else {
                    if (y > 0.5) setPhysicalOrientation(180); // Portrait Upside Down
                    else if (y < -0.5) setPhysicalOrientation(0); // Portrait
                }
            });
            Accelerometer.setUpdateInterval(500);
        };

        _subscribe();
        return () => subscription && subscription.remove();
    }, []);



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

    // Data Fetching
    const fetchProjects = useCallback(async () => {
        if (!user) return;
        try {
            const data = await getProjects();
            if (data.projects) setProjects(data.projects);
        } catch (e) {
            console.error('fetchProjects', e);
        }
    }, [user]);

    // Ensure state defaults from params if routing with prepopulated picks
    useFocusEffect(
        useCallback(() => {
            fetchProjects();

            // Priority 1: Direct link parameters
            if (params.projectId) {
                setSelectedProject(params.projectId as string);
                if (params.folderId) {
                    setSelectedFolder(params.folderId as string);
                }

                // Update doc mode based on type param
                const isDoc = params.type === 'documents' || params.type === 'document';
                setIsDocMode(isDoc);

                setMode('capture');

                // Auto trigger scanner if in doc mode
                if (isDoc) {
                    setTimeout(() => captureScan(), 300);
                }
            } else {
                // Priority 2: Nav Bar click while inside a project
                const { projectId, folderId, type } = getActiveProjectContext();
                if (projectId) {
                    console.log(`[UPLOAD] Context transition: Project=${projectId}, Type=${type}`);
                    setSelectedProject(projectId);
                    setSelectedFolder(folderId); // This ensures it's set even if null (root)

                    const isDoc = type === 'document' || type === 'documents';
                    setIsDocMode(isDoc);

                    setMode('capture');
                    if (isDoc) {
                        setTimeout(() => captureScan(true), 300);
                    }
                }
            }
        }, [params.projectId, params.folderId, params.type, fetchProjects])
    );

    // Dynamic Tab Bar Visibility
    useLayoutEffect(() => {
        navigation.setOptions({
            tabBarStyle: mode === 'capture' ? { display: 'none' } : undefined,
        });
    }, [mode, navigation]);

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
        fetchMembers();
    }, [selectedProject, isDocMode]);

    const fetchMembers = async () => {
        if (!selectedProject) { setProjectMembers([]); return; }
        try {
            const data = await getProjectMembers(selectedProject);
            setProjectMembers(data.members || []);
        } catch (err) { console.error("fetchMembers Error", err); }
    };

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
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('upload.roleNotAllowed')}</Text>
            </SafeAreaView>
        );
    }

    // -- File Selection / Capturing Handlers --

    const addToQueue = (newItems: FileProgress[]) => {
        if (fileQueue.length + newItems.length > 20) {
            Alert.alert(t('upload.limitReachedTitle'), t('upload.limitReachedMessage'));
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

            const queue: FileProgress[] = [];
            for (const asset of result.assets) {
                let uri = asset.uri;
                try {
                    // Capping the larger dimension to 1920px (matches Android feel)
                    const { width, height } = asset;
                    const resizeOptions = width > height ? { width: 1920 } : { height: 1920 };

                    const manipulated = await ImageManipulator.manipulateAsync(
                        uri,
                        [{ resize: resizeOptions }],
                        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                    );
                    uri = manipulated.uri;
                } catch (e) {
                    console.warn('Gallery ImageManipulator failed:', e);
                }

                queue.push({
                    asset: {
                        uri,
                        fileName: asset.fileName || uri.split('/').pop(),
                        type: 'image/jpeg',
                        size: asset.fileSize || 0
                    },
                    progress: 0,
                    status: 'pending',
                    anim: new Animated.Value(0),
                    source: isDocMode ? 'scan' : 'gallery',
                });
            }

            addToQueue(queue);
        } catch (error) {
            console.error('Gallery Error:', error);
            Alert.alert(t('upload.limitTitle'), t('upload.galleryError'));
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

            const queue: FileProgress[] = [];

            for (const a of result.assets) {
                let uri = a.uri;
                let mimeType = a.mimeType || 'application/octet-stream';

                // If it's an image picked from files, enforce the same 1920px resolution
                if (mimeType.startsWith('image/')) {
                    try {
                        const manipulated = await ImageManipulator.manipulateAsync(
                            uri,
                            [{ resize: { width: 1920 } }], // Note: Document picker doesn't always provide dimensions, width is fallback
                            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
                        );
                        uri = manipulated.uri;
                        mimeType = 'image/jpeg'; // Standardize to JPEG after manipulation
                    } catch (e) {
                        console.warn('Document picker image manipulation failed:', e);
                    }
                }

                queue.push({
                    asset: { uri, fileName: a.name, type: mimeType, size: a.size },
                    progress: 0,
                    status: 'pending',
                    anim: new Animated.Value(0),
                    source: 'document',
                });
            }
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
            t('upload.selectSource'),
            t('upload.selectSourceMessage'),
            [
                { text: t('upload.galleryAsScans'), onPress: pickFromGallery },
                { text: t('upload.filesDocs'), onPress: pickDocument },
                { text: t('upload.cancel'), style: "cancel" }
            ]
        );
    };


    const capturePhoto = async (forcedDocMode?: boolean) => {
        const effectiveDocMode = forcedDocMode ?? isDocMode;
        if (!cameraRef.current || isProcessing) return;
        if (fileQueue.length >= 20) {
            Alert.alert(t('upload.limitTitle'), t('upload.queueFull'));
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

            const { width, height } = photo;

            // 1. Fix orientation and apply resolution constraint
            const manipActions: any[] = [];

            // AUTOMATIC ROTATION CORRECTION
            // If physical orientation is landscape (90 or 270) but the photo is portrait (height > width)
            // or vice-versa, we apply the physical rotation.
            const isLandscapePhysically = physicalOrientation === 90 || physicalOrientation === 270;
            const isPortraitPhysically = physicalOrientation === 0 || physicalOrientation === 180;
            const isPhotoPortrait = height > width;

            if (isLandscapePhysically && isPhotoPortrait) {
                // Phone was sideways but photo is vertical -> Rotate to fix
                // We rotate based on which side the phone was tilted
                manipActions.push({ rotate: physicalOrientation });
            } else {
                // Otherwise just bake the standard EXIF rotation
                manipActions.push({ rotate: 0 });
            }

            // Apply resolution constraint (Capping longest side at 1920)
            const finalWidth = (isLandscapePhysically && isPhotoPortrait) ? height : width;
            const finalHeight = (isLandscapePhysically && isPhotoPortrait) ? width : height;
            const resizeOptions = finalWidth > finalHeight ? { width: 1920 } : { height: 1920 };
            manipActions.push({ resize: resizeOptions });

            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                manipActions,
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );

            if (effectiveDocMode) {
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
                addToQueue([{
                    asset: {
                        uri: manipulated.uri,
                        fileName: manipulated.uri.split('/').pop() || `capture_${Date.now()}.jpg`,
                        type: 'image/jpeg',
                        size: 0
                    },
                    progress: 0, status: 'pending', anim: new Animated.Value(0), source: 'camera',
                }]);
            }

        } catch (error: any) {
            console.error('Camera Error:', error);
            Alert.alert(t('upload.cameraError'), error?.message || t('upload.failedCapture'));
        } finally {
            setIsProcessing(false);
        }
    };


    const captureScan = async (forcedDocMode?: boolean) => {
        if (!DocumentScanner || Constants.appOwnership === 'expo') {
            if (!hasWarnedScanner) {
                setHasWarnedScanner(true);
                Alert.alert(
                    t('upload.scannerUnavailable'),
                    t('upload.scannerUnavailableMessage'),
                    [{ text: t('upload.ok'), onPress: () => capturePhoto(forcedDocMode) }]
                );
            } else {
                capturePhoto(forcedDocMode);
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

                    // Fix orientation/resolution and normalize URI for iOS
                    try {
                        // For scans, we generally want to target the height for vertical documents
                        // but 1920 width is usually safe for documents too.
                        const manipulated = await ImageManipulator.manipulateAsync(
                            uri,
                            [{ resize: { height: 1920 } }], // Targeting height for documents is often better
                            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
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
            Alert.alert(t('upload.scanError'), t('upload.failedScan'));
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
            Alert.alert(t('upload.limitTitle'), t('upload.failedCreateFolder'));
        } finally {
            setCreatingFolder(false);
        }
    };

    // -- Destination Logic --

    const handleUpload = async () => {
        if (!selectedProject || !selectedFolder || selectedFolder === 'root' || fileQueue.length === 0) {
            Alert.alert(t('upload.incompleteDestination'), t('upload.selectFolderMessage'));
            return;
        }

        const itemsToUpload = fileQueue.filter(f => f.status !== 'done');
        if (itemsToUpload.length === 0) {
            setMode('done');
            return;
        }
        setMode('uploading');


        try {
            let fileId = null;
            if (isDocMode) {
                // Document Upload Path (Scans or Docs)
                const formData = new FormData();
                formData.append('project_id', selectedProject!);
                formData.append('folder_id', (selectedFolder === 'root' ? '' : selectedFolder) || '');
                formData.append('mode', scanMode);
                formData.append('file_name', `Scan_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
                if (photoLocation) formData.append('location', photoLocation);
                if (photoTags) formData.append('tags', photoTags);
                if (assignedTo) formData.append('assigned_to', assignedTo);
                formData.append('is_doc_mode', String(isDocMode));
                formData.append('skipActivity', 'true');


                itemsToUpload.forEach((item, idx) => {

                    formData.append('files', {
                        uri: item.asset.uri,
                        name: item.asset.fileName || `file_${idx}.jpg`,
                        type: item.asset.type || 'image/jpeg',
                    } as any);
                });

                const res = await uploadScans(formData, (p) => {
                    setFileQueue(prev => prev.map(it => ({ ...it, progress: p, status: p === 100 ? 'done' : 'uploading' })));
                });

                if (res.success) {
                    setFileQueue(prev => prev.map(it => ({ ...it, status: 'done', progress: 100 })));
                    setMode('done');

                    const folderParam = selectedFolder === 'root' ? null : selectedFolder;
                    await createActivity({
                        project_id: selectedProject!,
                        type: 'upload',
                        description: t('upload.uploadedDocuments', { count: itemsToUpload.length }),
                        metadata: folderParam ? JSON.stringify({ folderId: folderParam, type: 'documents', fileId: res.file.id }) : undefined
                    });
                }
            } else {
                // Photo Upload Path
                for (let i = 0; i < itemsToUpload.length; i++) {
                    const item = itemsToUpload[i];

                    const formData = new FormData();
                    formData.append('project_id', selectedProject!);
                    formData.append('folder_id', (selectedFolder === 'root' ? '' : selectedFolder) || '');
                    formData.append('file_tag', 'photo');
                    formData.append('client_visible', String(true));
                    formData.append('skipActivity', 'true');
                    if (photoLocation) formData.append('location', photoLocation);
                    if (photoTags) formData.append('tags', photoTags);
                    if (assignedTo) formData.append('assigned_to', assignedTo);

                    formData.append('file', {
                        uri: item.asset.uri,
                        name: item.asset.fileName || `photo_${i}.jpg`,
                        type: item.asset.type || 'image/jpeg',
                    } as any);

                    const response = await uploadFileWithProgress(
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
                    if (fileId === null) {
                        fileId = response.file.id;
                    }

                    // Final explicit status update to ensure UI consistency after completion
                    setFileQueue(prev => {
                        const next = [...prev];
                        const targetIdx = next.findIndex(n => n.asset.uri === item.asset.uri);
                        if (targetIdx !== -1) {
                            next[targetIdx].progress = 100;
                            next[targetIdx].status = 'done';
                        }
                        return next;
                    });
                }
                setMode('done');




                const folderParam = selectedFolder === 'root' ? null : selectedFolder;
                await createActivity({
                    project_id: selectedProject!,
                    type: 'upload_photo',
                    description: t('upload.uploadedPhotos', { count: itemsToUpload.length }),
                    metadata: folderParam ? JSON.stringify({ folderId: folderParam, type: 'photos', fileId: fileId }) : undefined
                });
            }

        } catch (error: any) {
            console.error('Upload error:', error);
            setFileQueue(prev => prev.map(it => it.status === 'done' ? it : { ...it, status: 'error' }));
            const { message, code } = parseApiError(error, 'Some files could not be uploaded.');

            let buttons: any = undefined;
            if (code === 'LIMIT_REACHED') {
                buttons = [
                    { text: t('upload.cancel'), style: 'cancel' },
                    { text: t('upload.upgrade'), onPress: () => router.push('/subscription') }
                ];
            } else if (code === 'SUBSCRIPTION_LOCKED') {
                buttons = [
                    { text: t('upload.cancel'), style: 'cancel' },
                    { text: t('upload.billing'), onPress: () => router.push('/subscription') }
                ];
            }

            Alert.alert(
                code === 'LIMIT_REACHED' ? t('upload.limitReachedTitle') : (code === 'SUBSCRIPTION_LOCKED' ? t('upload.subscriptionLocked') : t('upload.uploadFailed')),
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
                        t('upload.discardTitle'),
                        t('upload.discardMessage'),
                        [
                            { text: t('upload.cancel'), style: 'cancel' },
                            { text: t('upload.discard'), style: 'destructive', onPress: close }
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

                        <TouchableOpacity onPress={fileQueue.length > 0 ? () => Alert.alert(t('upload.discardTitle'), t('upload.discardMessage'), [{ text: t('upload.cancel'), style: 'cancel' }, { text: t('upload.discard'), style: 'destructive', onPress: handleClose }]) : handleClose}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{isDocMode ? t('upload.scanDocuments') : t('upload.takePhotos')}</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {cameraPermission?.granted && isFocused ? (
                        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: "center", alignItems: "center" }}>
                            <View style={{ width: SCREEN_W, height: CAMERA_HEIGHT, backgroundColor: '#111', overflow: 'hidden' }}>
                                <GestureDetector gesture={pinchGesture}>
                                    <View collapsable={false} style={StyleSheet.absoluteFill}>
                                        <AnimatedCameraView
                                            style={StyleSheet.absoluteFill}
                                            facing="back"
                                            ref={cameraRef}
                                            ratio="4:3"
                                            animatedProps={animatedCameraProps}
                                        />
                                    </View>
                                </GestureDetector>
                                {/* Dynamic Zoom Indicator */}
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        zoomLabelStyle,
                                        {
                                            position: 'absolute',
                                            bottom: 16,
                                            alignSelf: 'center',
                                            backgroundColor: 'rgba(0,0,0,0.55)',
                                            paddingHorizontal: 14,
                                            paddingVertical: 6,
                                            borderRadius: 20,
                                            zIndex: 30,
                                        }
                                    ]}
                                >
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                                </Animated.View>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', marginBottom: 20 }}>{t('upload.cameraAccessNeeded')}</Text>
                            <TouchableOpacity onPress={requestCameraPermission} style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('upload.continue')}</Text>
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
                                            <Image source={{ uri: item.asset.uri }} style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }} />
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
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>{isDocMode ? t('upload.import') : t('upload.gallery')}</Text>
                            </TouchableOpacity>


                            <TouchableOpacity onPress={() => isDocMode ? captureScan() : capturePhoto()} disabled={isProcessing} style={{ alignItems: 'center' }}>
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
                                    const toggleMode = () => {
                                        const nextIsDoc = !isDocMode;
                                        setIsDocMode(nextIsDoc);
                                        if (nextIsDoc) {
                                            // Trigger scanner immediately when switching to Scan mode
                                            setTimeout(() => captureScan(), 300);
                                        }
                                    };

                                    if (fileQueue.length > 0) {
                                        Alert.alert(
                                            t('upload.clearQueueTitle'),
                                            t('upload.clearQueueMessage', { mode: !isDocMode ? t('upload.photo') : t('upload.scan') }),
                                            [
                                                { text: t('upload.cancel'), style: "cancel" },
                                                { text: t('upload.clearAndSwitch'), style: "destructive", onPress: () => { setFileQueue([]); toggleMode(); } }
                                            ]
                                        );
                                    } else {
                                        toggleMode();
                                    }
                                }}
                                style={{ alignItems: 'center', width: 70 }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={isDocMode ? "camera" : "file"} size={22} color="#fff" />
                                </View>
                                <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>{isDocMode ? t('upload.photo') : t('upload.scan')}</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'center', marginTop: 12 }}>Max size: 100 MB</Text>
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
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{t('upload.next', { count: fileQueue.length })}</Text>
                        <Feather name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
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
                            {isDocMode ? t('upload.reviewAndUpload') : t('upload.photoDestination')}
                        </Text>
                        <View style={{ width: 40 }} />
                    </View>


                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        {mode === 'selection' && (
                            <View style={{ marginBottom: 28 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('upload.selectedDocuments', { type: isDocMode ? t('upload.typeDocs') : t('upload.typePhotos') })}</Text>
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
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>{t('upload.scanGrouping')}</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setScanMode('single')}
                                        style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: scanMode === 'single' ? colors.primary + '15' : colors.background, borderWidth: 1, borderColor: scanMode === 'single' ? colors.primary : colors.border }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: scanMode === 'single' ? colors.primary : colors.text }}>{t('upload.singlePdf')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setScanMode('separate')}
                                        style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: scanMode === 'separate' ? colors.primary + '15' : colors.background, borderWidth: 1, borderColor: scanMode === 'separate' ? colors.primary : colors.border }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: scanMode === 'separate' ? colors.primary : colors.text }}>{t('upload.separatePdfs')}</Text>
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
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{t('upload.selectProject')}</Text>
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
                                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                                <Feather name="briefcase" size={20} color={colors.primary} />
                                            </View>
                                            <View style={{ gap: 2 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('upload.targetProject')}</Text>
                                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                                                    {projects.find(p => String(p.id) === String(selectedProject))?.name}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => setSelectedProject(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary + '10', borderRadius: 10 }}>
                                            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{t('upload.change')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}


                                <View style={{ gap: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                                            {isDocMode ? t('upload.selectDocsFolder') : t('upload.selectPhotoFolder')}
                                        </Text>
                                        <TouchableOpacity onPress={() => setShowCreateFolder(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.primary + '10', borderRadius: 20 }}>
                                            <Feather name="folder-plus" size={14} color={colors.primary} />
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{t('upload.new')}</Text>
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
                                                <Text style={{ marginTop: 12, color: colors.textMuted }}>{t('upload.fetchingFolders')}</Text>
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
                                                        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>{t('upload.noSubfolders')}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}

                                    </View>
                                </View>

                                {mode === 'selection' && selectedFolder && (
                                    <View style={{ gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{t('upload.addDetails')}</Text>
                                            <View style={{ gap: 16 }}>
                                                <View>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 }}>{t('upload.location')}</Text>
                                                    <TextInput
                                                        value={photoLocation} onChangeText={setPhotoLocation}
                                                        placeholder={t('upload.locationPlaceholder')} placeholderTextColor={colors.textMuted}
                                                        style={{ height: 50, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text }}
                                                    />
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 }}>{t('upload.tags')}</Text>
                                                    <TextInput
                                                        value={photoTags} onChangeText={setPhotoTags}
                                                        placeholder={t('upload.tagsPlaceholder')} placeholderTextColor={colors.textMuted}
                                                        style={{ height: 50, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text }}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {isDocMode && (
                                    <View style={{ marginTop: 20 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                <Feather name="user" size={12} color={colors.primary} />
                                            </View>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('upload.assignTo')}</Text>
                                            <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }}>{t('upload.optional')}</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => setMemberPickerVisible(true)}
                                            style={{
                                                height: 50,
                                                backgroundColor: colors.surface,
                                                borderRadius: 14,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                paddingHorizontal: 16,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Feather name="user" size={14} color={colors.primary} />
                                                </View>
                                                <Text style={{ fontSize: 14, color: assignedTo ? colors.text : colors.textMuted }}>
                                                    {assignedTo ? projectMembers.find(m => String(m.user.id) === String(assignedTo))?.user?.name : t('upload.selectAssignee')}
                                                </Text>
                                            </View>
                                            <Feather name="chevron-down" size={18} color={colors.textMuted} />
                                        </TouchableOpacity>
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
                                    {t('upload.confirmAndUpload', { count: fileQueue.length, type: isDocMode ? (fileQueue.length > 1 ? t('upload.typeDocs') : t('upload.typeDoc')) : (fileQueue.length > 1 ? t('upload.typePhotos') : t('upload.typePhoto')) })}
                                </Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>Max size: 100 MB</Text>
                        </View>
                    )}

                </KeyboardAvoidingView>

                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, elevation: 10 }}>

                            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>{t('upload.newFolder')}</Text>
                            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>{t('upload.creatingIn', { folder: folderBrowseId ? browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name : t('upload.root') })}</Text>
                            <TextInput
                                value={newFolderName} onChangeText={setNewFolderName} placeholder={t('upload.enterFolderName')} placeholderTextColor={colors.textMuted} autoFocus
                                style={{ height: 52, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text, marginBottom: 24 }}
                            />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{t('upload.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()} style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '800' }}>{creatingFolder ? t('upload.creating') : t('upload.create')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
                {/* Assignee Picker Modal */}
                <Modal
                    visible={memberPickerVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setMemberPickerVisible(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setMemberPickerVisible(false)}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                    >
                        <View style={{ backgroundColor: colors.background, borderRadius: 24, width: '100%', maxWidth: 360, padding: 24, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('upload.selectAssignee')}</Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t('upload.assigneeDescription') || 'Assign this document to a project member'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setMemberPickerVisible(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                                    <Feather name="x" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setAssignedTo(null);
                                        setMemberPickerVisible(false);
                                    }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
                                        backgroundColor: !assignedTo ? colors.primary + '10' : 'transparent',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: !assignedTo ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                                            <Feather name="user-x" size={20} color={!assignedTo ? '#fff' : colors.textMuted} />
                                        </View>
                                        <Text style={{ fontSize: 15, fontWeight: !assignedTo ? '700' : '600', color: !assignedTo ? colors.primary : colors.text }}>{t('upload.unassigned')}</Text>
                                    </View>
                                    {!assignedTo && <Feather name="check-circle" size={20} color={colors.primary} />}
                                </TouchableOpacity>

                                {projectMembers.map((m) => {
                                    const isSelected = String(assignedTo) === String(m.user.id);
                                    return (
                                        <TouchableOpacity
                                            key={m.user.id}
                                            onPress={() => {
                                                setAssignedTo(String(m.user.id));
                                                setMemberPickerVisible(false);
                                            }}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                                paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
                                                backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isSelected ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                                                    <Text style={{ fontSize: 16, fontWeight: '800', color: isSelected ? '#fff' : colors.primary }}>{m.user.name.charAt(0).toUpperCase()}</Text>
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '600', color: isSelected ? colors.primary : colors.text }}>{m.user.name}</Text>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{m.role || 'Member'}</Text>
                                                </View>
                                            </View>
                                            {isSelected && <Feather name="check-circle" size={20} color={colors.primary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </SafeAreaView>
        );
    }

    // 3. Uploading & Done Mode
    const doneCount = fileQueue.filter((f: FileProgress) => f.status === 'done').length;
    const totalProgress = fileQueue.length > 0
        ? Math.round(fileQueue.reduce((acc: number, f: FileProgress) => acc + f.progress, 0) / fileQueue.length)
        : 0;


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
                {mode === 'done' ? (
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#22c55e' + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Feather name="check" size={48} color="#22c55e" />
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 }}>{t('upload.uploadComplete')}</Text>
                        <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 24 }}>{t('upload.successfullyUploaded', { count: doneCount })}</Text>

                        {/* Moved Buttons to Top */}
                        <View style={{ gap: 12, width: '100%' }}>
                            <TouchableOpacity onPress={() => { setFileQueue([]); setMode('capture'); }} style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{t('upload.startNewUpload')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleClose} style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('upload.backToFolder')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12 }}>{t('upload.uploadingFiles', { count: fileQueue.length })}</Text>

                        <View style={{ gap: 12 }}>
                            {/* Total Progress Bar */}
                            <View style={{ height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' }}>
                                <View
                                    style={{
                                        height: '100%', backgroundColor: colors.primary,
                                        width: `${totalProgress}%`
                                    }}
                                />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{doneCount} of {fileQueue.length}</Text>
                                <Text style={{ flex: 1, fontSize: 14, color: colors.textMuted }}>
                                    {fileQueue.some(f => f.status === 'error')
                                        ? t('upload.failedRetryMessage')
                                        : t('upload.pleaseWait')}
                                </Text>
                            </View>
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
                                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.asset.fileName || t('upload.typeDoc')}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: item.status === 'error' ? '#ef4444' : colors.textMuted }}>
                                        {item.status === 'done' ? t('upload.successUploaded') : item.status === 'error' ? t('upload.uploadFailed') : t('upload.progressUploaded', { progress: Math.round(item.progress) })}
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
                    {fileQueue.some((f: FileProgress) => f.status === 'error') ? (
                        <>
                            <TouchableOpacity onPress={handleUpload} style={{ height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{t('upload.retryFailed')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setFileQueue([]); setMode('capture'); }} style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('upload.cancelAndClear')}</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
