import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    TextInput,
    Dimensions,
    Platform,
    StyleSheet,
    BackHandler
} from "react-native";
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { Image } from "expo-image";
import { Text } from "@/components/ui/AppText";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraView, useCameraPermissions } from 'expo-camera';
// Removed AnimatedCameraView for stability

// Removed AnimatedCameraView for stability
import * as ImageManipulator from 'expo-image-manipulator';
import { Accelerometer } from 'expo-sensors';
import { Project } from "@/types";
import {
    Snag,
    SnagStatus,
    getSnags,
    updateSnagStatus,
    deleteSnagApi,
    updateSnag,
    getAssignees,
    Assignee,
    markSnagSeen
} from "@/services/snagService";
import * as ImagePicker from 'expo-image-picker';
import FullScreenImageModal from "@/components/shared/FullScreenImageModal";
import ImageAnnotator from "../common/ImageAnnotator";
import { KeyboardAvoidingView } from "react-native";
import VoiceNoteRecorder from '@/components/chat/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/chat/VoiceNotePlayer';

const isAudio = (url: string) => {
    if (!url) return false;
    try {
        const urlWithoutQuery = url.split('?')[0];
        return !!urlWithoutQuery.match(/\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i);
    } catch {
        return false;
    }
};

interface Props {
    project: Project;
    initialSnagId?: string;
}

const STATUS_CYCLE: SnagStatus[] = ["amber", "green", "red"];


export default function ProjectSnagList({ project, initialSnagId }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useTranslation();

    const STATUS_CONFIG: Record<
        SnagStatus,
        { icon: keyof typeof Feather.glyphMap; bg: string; label: string }
    > = {
        amber: { icon: "minus", bg: "#f59e0b", label: t('projectSnags.status.waiting') },
        green: { icon: "check", bg: "#22c55e", label: t('projectSnags.status.completed') },
        red: { icon: "x", bg: "#ef4444", label: t('projectSnags.status.noAction') },
    };


    const router = useRouter();
    const insets = useSafeAreaInsets();
    const projectId = project.id;

    const SCREEN_W = Dimensions.get('window').width;
    const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'amber' | 'green' | 'red'>('all');
    const [creatorFilter, setCreatorFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
    // Photo viewer
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);
    const [playingUri, setPlayingUri] = useState<string | null>(null);

    const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editAssignedTo, setEditAssignedTo] = useState<number | null>(null);
    const [editPhoto, setEditPhoto] = useState<string | null>(null);
    const [editAudio, setEditAudio] = useState<string | null>(null);
    const [removeEditAudio, setRemoveEditAudio] = useState(false);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    const [responseComment, setResponseComment] = useState("");
    const [responsePhotos, setResponsePhotos] = useState<string[]>([]);
    const [removedResponsePhotos, setRemovedResponsePhotos] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [cameraVisible, setCameraVisible] = useState(false);
    const [cameraMode, setCameraMode] = useState<'edit' | 'response'>('response');
    const [annotatingImageIndex, setAnnotatingImageIndex] = useState<number | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraSessionKey, setCameraSessionKey] = useState(0);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [isCapturing, setIsCapturing] = useState(false);
    const cameraRef = React.useRef<CameraView>(null);

    // Filter Modals
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [activeFilterType, setActiveFilterType] = useState<'status' | 'creator' | 'assignee' | null>(null);

    // Physical Orientation Tracking
    const [physicalOrientation, setPhysicalOrientation] = useState<number>(0);


    //zoom 
    const zoomShared = useSharedValue(0); // 0–1 for expo-camera
    const startZoom = useSharedValue(0);
    const MIN_ZOOM = Platform.OS === 'ios' ? 0.5 : 1.0;
    const [zoomDisplay, setZoomDisplay] = useState(Platform.OS === 'ios' ? '0.5x' : '1.0x'); // live label
    const [cameraZoom, setCameraZoom] = useState(0); // Standard React state for camera zoom prop
    const zoomLabelOpacity = useSharedValue(0);
    let zoomHideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Max real-world zoom multiplier each platform supports
    const MAX_ZOOM_FACTOR = Platform.OS === 'ios' ? 10 : 10;

    // Converts 0-1 internal value → display string like "2.3x"
    const toDisplayZoom = (val: number) => {
        const factor = MIN_ZOOM + val * (MAX_ZOOM_FACTOR - MIN_ZOOM);
        return `${factor.toFixed(1)}x`;
    };

    const showZoomLabel = (val: number) => {
        const rounded = Math.round(val * 1000) / 1000;
        setZoomDisplay(toDisplayZoom(rounded));
        setCameraZoom(rounded);
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
                const raw = startZoom.value + (event.scale - 1) * (1 / (MAX_ZOOM_FACTOR - MIN_ZOOM));
                const clamped = Math.max(0, Math.min(1, raw));
                zoomShared.value = clamped;
                runOnJS(showZoomLabel)(clamped);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [zoomShared, startZoom]);


    // Removed animatedCameraProps

    const zoomLabelStyle = useAnimatedStyle(() => ({
        opacity: zoomLabelOpacity.value,
    }));

    // Unified Manual Zoom Handler
    const handleManualZoom = (factor: number) => {
        const z = (factor - MIN_ZOOM) / (MAX_ZOOM_FACTOR - MIN_ZOOM);
        const clamped = Math.max(0, Math.min(1, z));
        
        // Sync everything immediately
        zoomShared.value = clamped; 
        showZoomLabel(clamped);
    };

    useEffect(() => {
        let subscription: any;
        const _subscribe = () => {
            subscription = Accelerometer.addListener(accelerometerData => {
                const { x, y } = accelerometerData;
                if (Math.abs(x) > Math.abs(y)) {
                    if (x > 0.5) setPhysicalOrientation(90); // Landscape Left
                    else if (x < -0.5) setPhysicalOrientation(270); // Landscape Right
                } else {
                    if (y > 0.5) setPhysicalOrientation(180); // Upside Down
                    else if (y < -0.5) setPhysicalOrientation(0); // Portrait
                }
            });
            Accelerometer.setUpdateInterval(500);
        };

        _subscribe();
        return () => subscription && subscription.remove();
    }, []);

    useEffect(() => {
        if (!cameraVisible) {
            setCameraReady(false);
            return;
        }
        setCameraReady(false);
        setCameraSessionKey(prev => prev + 1);
        const timer = setTimeout(() => {
            setCameraReady(true);
        }, 250);
        return () => clearTimeout(timer);
    }, [cameraVisible]);

    useEffect(() => {
        if (selectedSnag) {
            setResponseComment(selectedSnag.response || "");
            setRemovedResponsePhotos([]);
            setResponsePhotos([]);
        }
    }, [selectedSnag?.id]);

    const hasPendingResponseImage = responsePhotos.some(uri => !isAudio(uri));
    const hasPendingResponseAudio = responsePhotos.some(isAudio);
    const hasExistingResponseImage = !!selectedSnag?.responsePhotoUrls?.some(uri => !isAudio(uri));
    const hasExistingResponseAudio = !!selectedSnag?.responsePhotoUrls?.some(isAudio);

    // ── Fetch data ─────────────────────────────────────────────────────────────

    const [refreshing, setRefreshing] = useState(false);

    const loadSnags = async (isRefetch = false) => {
        if (!projectId) return;
        if (!isRefetch) setLoading(true);
        try {
            const [snagData, assigneeData] = await Promise.all([
                getSnags(projectId),
                getAssignees(projectId)
            ]);
            setSnags(snagData);
            setAssignees(assigneeData);
        } catch (e) {
            console.error("fetchSnags error", e);
        } finally {
            if (!isRefetch) setLoading(false);
        }
    };

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket || !projectId) return;

        socket.emit('join-project', projectId);

        const onSnagSeen = (data: { snagId: number, seen_at: string }) => {
            setSnags(prev => prev.map(s => s.id === data.snagId ? { ...s, seen_at: data.seen_at } : s));
            setSelectedSnag(prev => (prev && prev.id === data.snagId) ? { ...prev, seen_at: data.seen_at } : prev);
        };

        const onSnagUpdated = (data: { snag: Snag }) => {
            setSnags(prev => {
                const idx = prev.findIndex(s => s.id === data.snag.id);
                if (idx !== -1) {
                    const copy = [...prev];
                    copy[idx] = data.snag;
                    return copy;
                }
                return [data.snag, ...prev];
            });
            setSelectedSnag(prev => (prev && prev.id === data.snag.id) ? data.snag : prev);
        };

        socket.on('snag-seen', onSnagSeen);
        socket.on('snag-updated', onSnagUpdated);

        return () => {
            socket.off('snag-seen', onSnagSeen);
            socket.off('snag-updated', onSnagUpdated);
        };
    }, [socket, projectId]);

    useEffect(() => {
        if (selectedSnag && String(selectedSnag.assigned_to) === String(user?.id) && !selectedSnag.seen_at) {
            markSnagSeen(selectedSnag.id).then(data => {
                setSelectedSnag(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
                setSnags(prev => prev.map(s => s.id === selectedSnag.id ? { ...s, seen_at: data.seen_at } : s));
            }).catch(err => console.error("Failed to mark snag as seen:", err));
        }
    }, [selectedSnag?.id, user?.id]);

    useFocusEffect(
        useCallback(() => {
            loadSnags();

            const onBackPress = () => {
                if (viewPhoto) {
                    setViewPhoto(null);
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener(
                "hardwareBackPress",
                onBackPress,
            );
            return () => subscription.remove();
        }, [projectId, viewPhoto]),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSnags(true);
        setRefreshing(false);
    };

    useEffect(() => {
        if (initialSnagId && snags.length > 0) {
            const match = snags.find(s => String(s.id) === String(initialSnagId));
            if (match) {
                setResponseComment("");
                setResponsePhotos([]);
                setSelectedSnag(match);
                // Clear the param from router to prevent re-opening on focus
                router.setParams({ snagId: '' });
            }
        }
    }, [initialSnagId, snags, router]);

    // ── Status cycle ───────────────────────────────────────────────────────────

    const handleUpdateStatus = async (snag: Snag, nextStatus?: SnagStatus, comment?: string, files?: string[], removedPhotos?: string[]) => {
        const idx = STATUS_CYCLE.indexOf(snag.status);
        const next = nextStatus || STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('status', next);
            formData.append('response', comment || "");
            if (files) {
                files.forEach((uri, i) => {
                    let filename = uri.split('/').pop() || `resp_${i}.jpg`;
                    if (isAudio(uri) && !filename.includes('.')) filename += '.m4a';
                    const match = /\.(\w+)$/.exec(filename);
                    let type = `image/jpeg`;
                    if (match) {
                        type = isAudio(filename) ? `audio/${match[1]}` : `image/${match[1]}`;
                    }
                    formData.append('photos', { uri, name: filename, type } as any);
                });
            }

            if (removedPhotos && removedPhotos.length > 0) {
                formData.append('removedPhotos', JSON.stringify(removedPhotos));
            }

            const updated = await updateSnagStatus(snag.id, formData);
            setSnags(prev => prev.map(s => s.id === snag.id ? updated : s));
            if (selectedSnag?.id === snag.id) setSelectedSnag(updated);

            setResponseComment("");
            setResponsePhotos([]);
            setRemovedResponsePhotos([]);

            if (next === snag.status) {
                Alert.alert(t('projectSnags.successTitle') as string, t('projectSnags.successResponseUpdate') as string);
            } else {
                Alert.alert(t('projectSnags.successTitle') as string, t('projectSnags.successStatusUpdate', { status: STATUS_CONFIG[next].label }) as string);
            }
        } catch (error) {
            console.error("handleUpdateStatus error", error);
            Alert.alert(t('projectSnags.errorTitle') as string, t('projectSnags.errorStatusUpdate') as string);
        } finally {

            setSubmitting(false);
        }
    };

    const filteredSnags = snags.filter(s => {
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        const matchesCreator = creatorFilter === 'all' || String(s.created_by) === creatorFilter;
        const matchesAssignee = assigneeFilter === 'all' || String(s.assigned_to) === assigneeFilter;
        return matchesStatus && matchesCreator && matchesAssignee;
    });

    const handleDeleteSnag = async (snagId: number, snagTitle: string) => {
        Alert.alert(t('projectSnags.deleteConfirmTitle') as string, t('projectSnags.deleteConfirmDesc', { title: snagTitle }) as string, [
            { text: t('projectSnags.cancel') as string, style: "cancel" },
            {
                text: t('projectWorkspace.moveToTrash') as string,
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteSnagApi(snagId);
                        setSnags((prev) => prev.filter((s) => s.id !== snagId));
                        setSelectedSnag(null);
                    } catch {
                        Alert.alert(t('projectSnags.errorTitle') as string, t('projectSnags.errorDelete') as string);
                    }
                },
            },
        ]);
    };


    const handleUpdateSnag = async () => {
        if (!selectedSnag || !editTitle.trim()) {
            Alert.alert(t('projectSnags.errorTitle') as string, t('projectSnags.errorTitleRequired') as string);
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', editTitle.trim());
            formData.append('description', editDesc.trim());
            if (editAssignedTo) formData.append('assigned_to', String(editAssignedTo));

            if (editPhoto && !editPhoto.startsWith('http')) {
                const filename = editPhoto.split('/').pop() || `snag.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                formData.append('photo', { uri: editPhoto, name: filename, type } as any);
            }
            if (editAudio && !editAudio.startsWith('http')) {
                const filename = editAudio.split('/').pop() || `voice_${Date.now()}.m4a`;
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `audio/${match[1]}` : `audio/mp4`;
                formData.append('audio', { uri: editAudio, name: filename, type } as any);
            }
            if (removeEditAudio) {
                formData.append('remove_audio', 'true');
            }

            const updated = await updateSnag(selectedSnag.id, formData);
            setSnags(prev => prev.map(s => s.id === selectedSnag.id ? updated : s));
            setSelectedSnag(updated);
            setIsEditing(false);
            Alert.alert(t('projectSnags.successTitle') as string, t('projectSnags.successUpdate') as string);
        } catch (error) {
            console.error("handleUpdateSnag error", error);
            Alert.alert(t('projectSnags.errorTitle') as string, t('projectSnags.errorUpdate') as string);
        } finally {

            setSubmitting(false);
        }
    };

    const startEditing = (snag: Snag) => {
        setEditTitle(snag.title);
        setEditDesc(snag.description || "");
        setEditAssignedTo(snag.assigned_to || null);
        setEditPhoto(snag.photoDownloadUrl || snag.photo_url || null);
        setEditAudio(snag.audioDownloadUrl || snag.audio_url || null);
        setRemoveEditAudio(false);
        setIsEditing(true);
    };

    const openCamera = async (mode: 'edit' | 'response') => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) {
                Alert.alert(t('projectSnags.cameraAccess') as string, t('projectSnags.cameraAccessDesc') as string);
                return;
            }
        }

        setCameraMode(mode);
        setCameraVisible(true);
    };

    const pickImageFiles = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: false,
                quality: 0.8,
            });

            if (result.canceled || !result.assets) return;

            const asset = result.assets[0];
            let uri = asset.uri;
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 1920 } }],
                    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                );
                uri = manipulated.uri;
            } catch (e) {
                console.warn('Gallery image manipulation failed:', e);
            }

            if (cameraMode === 'edit') {
                setEditPhoto(uri);
                setAnnotatingImageIndex(-1);
            } else {
                setResponsePhotos(prev => {
                    const filtered = prev.filter(p => isAudio(p));
                    return [...filtered, uri];
                });
                setAnnotatingImageIndex(0);
            }
        } catch (error) {
            console.error('pickImageFiles error', error);
            Alert.alert(t('projectSnags.errorTitle') as string, t('projectSnags.failedPickGallery') as string);
        }
    };


    const capturePhoto = async () => {
        if (!cameraRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                base64: false,
                exif: true,
            });
            if (!photo?.uri) return;

            const { width, height } = photo;
            const manipActions: any[] = [];

            // Orientation Correction
            const isLandscapePhysically = physicalOrientation === 90 || physicalOrientation === 270;
            const isPhotoPortrait = height > width;

            if (isLandscapePhysically && isPhotoPortrait) {
                manipActions.push({ rotate: physicalOrientation });
            } else {
                manipActions.push({ rotate: 0 });
            }

            // Resize
            const finalWidth = (isLandscapePhysically && isPhotoPortrait) ? height : width;
            const finalHeight = (isLandscapePhysically && isPhotoPortrait) ? width : height;
            const resizeOptions = finalWidth > finalHeight ? { width: 1920 } : { height: 1920 };
            manipActions.push({ resize: resizeOptions });

            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                manipActions,
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );

            if (cameraMode === 'edit') {
                setEditPhoto(manipulated.uri);
                setAnnotatingImageIndex(-1);
            } else {
                // Single photo for response: replace existing image but keep audio
                setResponsePhotos(prev => {
                    const filtered = prev.filter(p => isAudio(p));
                    return [...filtered, manipulated.uri];
                });
                setAnnotatingImageIndex(0);
            }
        } catch (e) {
            console.error("capturePhoto error", e);
            Alert.alert(t('projectSnags.cameraError') as string, t('projectSnags.failedCapture') as string);
        } finally {

            setIsCapturing(false);
        }
    };

    const pickEditPhoto = async () => {
        await openCamera('edit');
    };

    const pickResponsePhotos = async () => {
        await openCamera('response');
    };

    // ── Open Add flow ──────────────────────────────────────────────────────────

    const openAddSnag = () => {
        router.push(`/(tabs)/project/snag-create?projectId=${projectId}`);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {/* Add Snag button */}
                <TouchableOpacity
                    onPress={openAddSnag}
                    style={{
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                        marginBottom: 12,
                    }}>
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "white" }}>
                        {t('projectSnags.addSnag')}
                    </Text>
                </TouchableOpacity>

                {/* Dropdown Filters */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={() => { setActiveFilterType('status'); setFilterModalVisible(true); }}
                        style={{
                            flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
                            backgroundColor: statusFilter !== 'all' ? colors.primary + '10' : colors.surface
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: statusFilter !== 'all' ? colors.primary : colors.textMuted }}>
                            {statusFilter === 'all' ? t('projectRfi.status') : STATUS_CONFIG[statusFilter].label.split(' ')[0]}
                        </Text>
                        <Feather name="chevron-down" size={12} color={statusFilter !== 'all' ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { setActiveFilterType('creator'); setFilterModalVisible(true); }}
                        style={{
                            flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
                            backgroundColor: creatorFilter !== 'all' ? colors.primary + '10' : colors.surface
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: creatorFilter !== 'all' ? colors.primary : colors.textMuted }} numberOfLines={1}>
                            {creatorFilter === 'all' ? t('projectRfi.creator') : (snags.find(s => String(s.created_by) === creatorFilter)?.creator?.name || t('projectRfi.creator')).toUpperCase()}
                        </Text>
                        <Feather name="chevron-down" size={12} color={creatorFilter !== 'all' ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { setActiveFilterType('assignee'); setFilterModalVisible(true); }}
                        style={{
                            flex: 1.2, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
                            backgroundColor: assigneeFilter !== 'all' ? colors.primary + '10' : colors.surface
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: assigneeFilter !== 'all' ? colors.primary : colors.textMuted }} numberOfLines={1}>
                            {assigneeFilter === 'all' ? t('projectRfi.assignee') : (snags.find(s => String(s.assigned_to) === assigneeFilter)?.assignee?.name || t('projectRfi.assignee')).toUpperCase()}
                        </Text>
                        <Feather name="chevron-down" size={14} color={assigneeFilter !== 'all' ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Snag list */}
                {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                ) : (
                    <View style={{ gap: 8 }}>
                        {filteredSnags.map((snag) => {
                            const cfg = STATUS_CONFIG[snag.status];
                            const isTarget =
                                initialSnagId && String(snag.id) === String(initialSnagId);
                            return (
                                <TouchableOpacity
                                    key={snag.id}
                                    onPress={() => {
                                        setSelectedSnag(snag);
                                    }}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "flex-start",
                                        gap: 10,
                                        borderRadius: 12,
                                        borderWidth: isTarget ? 2 : 1,
                                        borderColor: isTarget ? colors.primary : colors.border,
                                        backgroundColor: colors.background,
                                        padding: 12,
                                        // Soft shadow if targeted
                                        ...(isTarget
                                            ? {
                                                shadowColor: colors.primary,
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.2,
                                                shadowRadius: 4,
                                                elevation: 3,
                                            }
                                            : {}),
                                    }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (String(snag.assigned_to) === String(user?.id)) {
                                                handleUpdateStatus(snag);
                                            } else {
                                                Alert.alert(t('projectSnags.permissionDenied') as string, t('projectSnags.onlyAssignedUpdate') as string);
                                            }
                                        }}

                                        style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 13,
                                            backgroundColor: cfg.bg,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginTop: 1,
                                            opacity: String(snag.assigned_to) === String(user?.id) ? 1 : 0.6,
                                        }}>
                                        <Feather name={cfg.icon} size={13} color="#fff" />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: "700",
                                                color: colors.text,
                                            }}>
                                            {snag.title}
                                        </Text>
                                        {snag.description ? (
                                            <Text
                                                numberOfLines={2}
                                                style={{
                                                    fontSize: 10,
                                                    color: colors.textMuted,
                                                    marginTop: 2,
                                                }}>
                                                {snag.description}
                                            </Text>
                                        ) : null}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                                {t('projectSnags.to')}: <Text style={{ color: colors.text, fontWeight: '600' }}>{snag.assignee?.name || t('projectSnags.unassigned')}</Text>
                                            </Text>
                                            {snag.seen_at && (

                                                <Ionicons name="checkmark-done" size={14} color="#f97316" />
                                            )}
                                        </View>
                                        {snag.response ? (
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    marginTop: 4,
                                                }}>
                                                <Feather name="message-square" size={10} color={colors.primary} />
                                                <Text
                                                    numberOfLines={1}
                                                    style={{ fontSize: 9, color: colors.textMuted }}>
                                                    {snag.response}
                                                </Text>
                                                {snag.responsePhotoUrls && snag.responsePhotoUrls.length > 0 && (
                                                    <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>+{snag.responsePhotoUrls.length} {t('projectSnags.photos')}</Text>
                                                )}
                                            </View>

                                        ) : null}
                                    </View>

                                    {snag.photoDownloadUrl || snag.photo_url ? (
                                        <TouchableOpacity
                                            onPress={() =>
                                                setViewPhoto(snag.photoDownloadUrl || snag.photo_url!)
                                            }
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 8,
                                                overflow: "hidden",
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                            }}>
                                            <Image
                                                source={snag.photoDownloadUrl || snag.photo_url}
                                                style={{ width: "100%", height: "100%" }}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                        </TouchableOpacity>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                        {filteredSnags.length === 0 && (
                            <View style={{ marginTop: 30, alignItems: "center" }}>
                                <Feather name="check-square" size={32} color={colors.border} />
                                <Text
                                    style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                                    {t('projectSnags.noSnags')}
                                </Text>
                            </View>

                        )}
                    </View>
                )}
            </ScrollView>

            {/* Filter Picker Modal */}
            <Modal
                visible={filterModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setFilterModalVisible(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                >
                    <View style={{ backgroundColor: colors.background, borderRadius: 20, width: '100%', maxWidth: 340, padding: 20, maxHeight: '70%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                                {t('projectRfi.selectFilter', {
                                    filter: activeFilterType === 'status' ? t('projectRfi.status') : (activeFilterType === 'creator' ? t('projectRfi.creator') : t('projectRfi.assignee'))
                                })}
                            </Text>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                <Feather name="x" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (activeFilterType === 'status') setStatusFilter('all');
                                    else if (activeFilterType === 'creator') setCreatorFilter('all');
                                    else setAssigneeFilter('all');
                                    setFilterModalVisible(false);
                                }}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('All')}</Text>
                                {(activeFilterType === 'status' ? statusFilter === 'all' : activeFilterType === 'creator' ? creatorFilter === 'all' : assigneeFilter === 'all') && (
                                    <Feather name="check" size={16} color={colors.primary} />
                                )}
                            </TouchableOpacity>

                            {activeFilterType === 'status' && ['amber', 'green', 'red'].map((s: any) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={() => { setStatusFilter(s); setFilterModalVisible(false); }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_CONFIG[s as SnagStatus].bg }} />
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{STATUS_CONFIG[s as SnagStatus].label}</Text>
                                    </View>
                                    {statusFilter === s && <Feather name="check" size={16} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}

                            {activeFilterType === 'creator' && Array.from(new Set(snags.map(s => s.created_by))).map(id => {
                                const creator = snags.find(s => s.created_by === id)?.creator;
                                if (!creator) return null;
                                return (
                                    <TouchableOpacity
                                        key={String(id)}
                                        onPress={() => { setCreatorFilter(String(id)); setFilterModalVisible(false); }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                            paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                                        }}
                                    >
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{creator.name}</Text>
                                        {creatorFilter === String(id) && <Feather name="check" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}

                            {activeFilterType === 'assignee' && (
                                <>
                                    {Array.from(new Set(snags.map(s => s.assigned_to))).filter(Boolean).map(id => {
                                        const assignee = snags.find(s => s.assigned_to === id)?.assignee;
                                        if (!assignee) return null;
                                        return (
                                            <TouchableOpacity
                                                key={String(id)}
                                                onPress={() => { setAssigneeFilter(String(id)); setFilterModalVisible(false); }}
                                                style={{
                                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                                                }}
                                            >
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{assignee.name}</Text>
                                                {assigneeFilter === String(id) && <Feather name="check" size={16} color={colors.primary} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Snag Detail Modal */}
            <Modal
                visible={!!selectedSnag}
                animationType="slide"
                transparent
                presentationStyle="overFullScreen"
                onRequestClose={() => { setSelectedSnag(null); setIsEditing(false); setEditAudio(null); setRemoveEditAudio(false); setResponseComment(""); setResponsePhotos([]); }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%', padding: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{isEditing ? t('projectSnags.editSnag') : t('projectSnags.snagDetails')}</Text>
                                <TouchableOpacity onPress={() => { setSelectedSnag(null); setIsEditing(false); setEditAudio(null); setRemoveEditAudio(false); setResponseComment(""); setResponsePhotos([]); }}>

                                    <Feather name="x" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            {selectedSnag && (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {isEditing ? (
                                        <View style={{ gap: 15, paddingBottom: 40 }}>
                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>{t('projectSnags.titleLabel')}</Text>
                                                <TextInput
                                                    value={editTitle}
                                                    onChangeText={setEditTitle}
                                                    placeholder={t('projectSnags.titlePlaceholder') as string}
                                                    style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                                                />
                                            </View>


                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>{t('projectSnags.descriptionLabel')}</Text>
                                                <TextInput
                                                    value={editDesc}
                                                    onChangeText={setEditDesc}
                                                    placeholder={t('projectSnags.descriptionPlaceholder') as string}
                                                    multiline
                                                    style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: 'top' }}
                                                />
                                            </View>


                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>{t('projectSnags.assignedToLabel')}</Text>

                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        {assignees.map(a => (
                                                            <TouchableOpacity
                                                                key={a.id}
                                                                onPress={() => setEditAssignedTo(a.id)}
                                                                style={{
                                                                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                                                                    backgroundColor: editAssignedTo === a.id ? colors.primary : colors.surface,
                                                                    borderWidth: 1, borderColor: colors.border
                                                                }}
                                                            >
                                                                <Text style={{ fontSize: 11, color: editAssignedTo === a.id ? '#fff' : colors.text }}>{a.name}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </ScrollView>
                                            </View>

                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectSnags.photoLabel')}</Text>

                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                                    {editPhoto && (
                                                        <View style={{ position: 'relative' }}>
                                                            <Image source={{ uri: editPhoto }} style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} />
                                                            <TouchableOpacity
                                                                onPress={() => setEditPhoto(null)}
                                                                style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                                                            >
                                                                <Feather name="x" size={14} color="#fff" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => setAnnotatingImageIndex(-1)}
                                                                style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}
                                                            >
                                                                <Feather name="edit-2" size={12} color="#fff" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                    <TouchableOpacity
                                                        onPress={pickEditPhoto}
                                                        style={{
                                                            width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border,
                                                            alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface
                                                        }}
                                                    >
                                                        <Feather name="camera" size={24} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectSnags.voiceNoteLabel')}</Text>

                                                {editAudio ? (
                                                    <View style={{ position: 'relative', padding: 12, paddingRight: 32, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                                                            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>VOICE NOTE</Text>
                                                        </View>
                                                        <VoiceNotePlayer uri={editAudio} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                                        <TouchableOpacity
                                                            onPress={() => { setEditAudio(null); setRemoveEditAudio(true); }}
                                                            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                                                        >
                                                            <Feather name="x" size={14} color="#fff" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <VoiceNoteRecorder
                                                        colors={colors}
                                                        onRecordingStateChange={() => { }}
                                                        onSend={(uri) => { setEditAudio(uri); setRemoveEditAudio(false); }}
                                                    />
                                                )}
                                            </View>

                                            <TouchableOpacity
                                                onPress={handleUpdateSnag}
                                                disabled={submitting}
                                                style={{ backgroundColor: colors.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, opacity: submitting ? 0.7 : 1 }}
                                            >
                                                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('projectSnags.saveChanges')}</Text>}
                                            </TouchableOpacity>


                                            <TouchableOpacity
                                                onPress={() => setIsEditing(false)}
                                                style={{ height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
                                            >
                                                <Text style={{ color: colors.text, fontWeight: '600' }}>{t('projectSnags.cancel')}</Text>
                                            </TouchableOpacity>

                                        </View>
                                    ) : (
                                        <View style={{ gap: 15, paddingBottom: 40 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ backgroundColor: STATUS_CONFIG[selectedSnag.status].bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{STATUS_CONFIG[selectedSnag.status].label}</Text>
                                                </View>
                                                {(user?.role === 'admin' || String(selectedSnag.creator?.id || selectedSnag.created_by) === String(user?.id)) && !selectedSnag.response && !selectedSnag.response_photos && (
                                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                                        <TouchableOpacity onPress={() => startEditing(selectedSnag)}>
                                                            <Feather name="edit" size={18} color={colors.primary} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => handleDeleteSnag(selectedSnag.id, selectedSnag.title)}>
                                                            <Feather name="trash-2" size={18} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>{selectedSnag.title}</Text>
                                                {selectedSnag.seen_at && (
                                                    <Ionicons name="checkmark-done" size={18} color="#f97316" />
                                                )}
                                            </View>
                                            <Text style={{ fontSize: 13, color: colors.textMuted }}>{selectedSnag.description}</Text>

                                            {(selectedSnag.photoDownloadUrl || selectedSnag.photo_url) && (
                                                <TouchableOpacity onPress={() => setViewPhoto(selectedSnag.photoDownloadUrl || selectedSnag.photo_url!)}>
                                                    <Image
                                                        source={selectedSnag.photoDownloadUrl || selectedSnag.photo_url}
                                                        style={{ width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                                    />
                                                </TouchableOpacity>
                                            )}

                                            {(selectedSnag.audioDownloadUrl || selectedSnag.audio_url) && (
                                                <View style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                                                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{t('projectSnags.voiceNoteHeader').toUpperCase()}</Text>
                                                    </View>
                                                    <VoiceNotePlayer uri={selectedSnag.audioDownloadUrl || selectedSnag.audio_url!} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                                </View>
                                            )}

                                            <View style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 12, gap: 8 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('projectSnags.assignedToLabel')}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{selectedSnag.assignee?.name || t('projectSnags.unassigned')}</Text>
                                                </View>

                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('projectSnags.createdByLabel')}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{selectedSnag.creator?.name || '—'}</Text>
                                                </View>

                                            </View>

                                            {(selectedSnag.response || (selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0)) && (
                                                <View style={{ padding: 12, backgroundColor: colors.primary + '08', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, marginBottom: 4, textTransform: 'uppercase' }}>{t('projectSnags.responseLabel')}</Text>
                                                    {selectedSnag.response ? <Text style={{ fontSize: 13, color: colors.text }}>{selectedSnag.response}</Text> : null}

                                                    {selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0 && (
                                                        <View style={{ marginTop: 10, gap: 10 }}>
                                                            {/* Images Row */}
                                                            {selectedSnag.responsePhotoUrls.filter(url => !isAudio(url)).length > 0 && (
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                                        {selectedSnag.responsePhotoUrls.filter(url => !isAudio(url)).map((url, i) => (
                                                                            <TouchableOpacity key={i} onPress={() => setViewPhoto(url)} style={{ position: 'relative' }}>
                                                                                <Image source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                                                                                {String(selectedSnag.assigned_to) === String(user?.id) && (
                                                                                    <TouchableOpacity
                                                                                        onPress={() => {
                                                                                            const absoluteIdx = selectedSnag.responsePhotoUrls!.indexOf(url);
                                                                                            const key = selectedSnag.response_photos?.[absoluteIdx];
                                                                                            if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                                                                            const newUrls = [...selectedSnag.responsePhotoUrls!];
                                                                                            const newPhotos = [...(selectedSnag.response_photos || [])];
                                                                                            newUrls.splice(absoluteIdx, 1);
                                                                                            newPhotos.splice(absoluteIdx, 1);
                                                                                            setSelectedSnag({ ...selectedSnag, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                                                                        }}
                                                                                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 10, padding: 3, zIndex: 10 }}
                                                                                    >
                                                                                        <Feather name="x" size={10} color="#fff" />
                                                                                    </TouchableOpacity>
                                                                                )}
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                </ScrollView>
                                                            )}

                                                            {/* Audios Column */}
                                                            {selectedSnag.responsePhotoUrls.filter(url => isAudio(url)).map((url, i) => (
                                                                <View key={i} style={{
                                                                    padding: 10, borderWidth: 1, borderColor: colors.primary + '20', borderRadius: 12,
                                                                    backgroundColor: colors.background, width: '100%', position: 'relative'
                                                                }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                                                                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{t('projectSnags.voiceResponseHeader').toUpperCase()}</Text>
                                                                    </View>

                                                                    <VoiceNotePlayer uri={url} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                                                    {String(selectedSnag.assigned_to) === String(user?.id) && (
                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                const audioUrls = selectedSnag.responsePhotoUrls!.filter(url => isAudio(url));
                                                                                const indexInAll = selectedSnag.responsePhotoUrls!.indexOf(url);
                                                                                const key = selectedSnag.response_photos?.[indexInAll];
                                                                                if (key) setRemovedResponsePhotos(prev => [...prev, key]);
                                                                                const newUrls = [...selectedSnag.responsePhotoUrls!];
                                                                                newUrls.splice(indexInAll, 1);
                                                                                const newPhotos = [...(selectedSnag.response_photos || [])];
                                                                                newPhotos.splice(indexInAll, 1);
                                                                                setSelectedSnag({ ...selectedSnag, responsePhotoUrls: newUrls, response_photos: newPhotos });
                                                                            }}
                                                                            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3, zIndex: 10 }}
                                                                        >
                                                                            <Feather name="x" size={10} color="#fff" />
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            )}

                                            {/* Response Section */}
                                            {String(selectedSnag.assigned_to) === String(user?.id) && (
                                                <View style={{ gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{selectedSnag.response ? t('projectSnags.updateResponse') : t('projectSnags.provideResponse')}</Text>


                                                    {selectedSnag.status !== 'green' ? (
                                                        <>
                                                            <TextInput
                                                                value={responseComment}
                                                                onChangeText={setResponseComment}
                                                                placeholder={t('projectSnags.responsePlaceholder') as string}
                                                                placeholderTextColor={colors.textMuted}

                                                                multiline
                                                                style={{
                                                                    minHeight: 70,
                                                                    backgroundColor: colors.surface,
                                                                    borderRadius: 10,
                                                                    padding: 10,
                                                                    color: colors.text,
                                                                    borderWidth: 1,
                                                                    borderColor: colors.border,
                                                                    textAlignVertical: 'top',
                                                                    fontSize: 13
                                                                }}
                                                            />
                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                                {responsePhotos.map((uri, i) => (
                                                                    <View key={i} style={{ position: 'relative' }}>
                                                                        {isAudio(uri) ? (
                                                                            <View style={{
                                                                                padding: 10, paddingRight: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                                                                                backgroundColor: colors.surface, width: SCREEN_W - 80, minHeight: 64, justifyContent: 'center'
                                                                            }}>
                                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                                                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{t('projectSnags.voiceResponseHeader').toUpperCase()}</Text>
                                                                                </View>
                                                                                <VoiceNotePlayer uri={uri} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                                                            </View>
                                                                        ) : (
                                                                            <Image source={{ uri }} style={{ width: 70, height: 70, borderRadius: 10, borderWidth: 1, borderColor: colors.border }} />
                                                                        )}
                                                                        <TouchableOpacity
                                                                            onPress={() => setResponsePhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                                            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, padding: 2, zIndex: 10 }}
                                                                        >
                                                                            <Feather name="x" size={12} color="#fff" />
                                                                        </TouchableOpacity>
                                                                        {!isAudio(uri) && (
                                                                            <TouchableOpacity
                                                                                onPress={() => setAnnotatingImageIndex(i)}
                                                                                style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 8 }}
                                                                            >
                                                                                <Feather name="edit-2" size={10} color="#fff" />
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                ))}
                                                                {!hasPendingResponseImage && !hasExistingResponseImage && (
                                                                    <TouchableOpacity
                                                                        onPress={pickResponsePhotos}
                                                                        style={{
                                                                            width: 70, height: 70, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border,
                                                                            alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface
                                                                        }}
                                                                    >
                                                                        <Feather name="camera" size={20} color={colors.textMuted} />
                                                                    </TouchableOpacity>
                                                                )}
                                                            </View>

                                                            <View style={{ marginTop: 12, marginBottom: 8 }}>
                                                                {!hasPendingResponseAudio && !hasExistingResponseAudio && (
                                                                    <VoiceNoteRecorder
                                                                        colors={colors}
                                                                        onRecordingStateChange={() => { }}
                                                                        onSend={(uri) => {
                                                                            setResponsePhotos(prev => {
                                                                                const filtered = prev.filter(p => !isAudio(p));
                                                                                return [...filtered, uri];
                                                                            });
                                                                        }}
                                                                    />
                                                                )}
                                                            </View>

                                                            <TouchableOpacity
                                                                onPress={() => handleUpdateStatus(selectedSnag, selectedSnag.status, responseComment, responsePhotos, removedResponsePhotos)}
                                                                disabled={submitting || (responseComment === (selectedSnag.response || "") && responsePhotos.length === 0 && removedResponsePhotos.length === 0)}
                                                                style={{
                                                                    backgroundColor: colors.primary,
                                                                    height: 42,
                                                                    borderRadius: 10,
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: (submitting || (responseComment === (selectedSnag.response || "") && responsePhotos.length === 0 && removedResponsePhotos.length === 0)) ? 0.6 : 1
                                                                }}
                                                            >
                                                                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('projectSnags.submitResponse')}</Text>}
                                                            </TouchableOpacity>

                                                        </>
                                                    ) : (
                                                        <View style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 8, alignItems: 'center' }}>
                                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('projectSnags.completedSnagNoUpdate')}</Text>
                                                        </View>
                                                    )}


                                                    <View style={{ marginTop: 5, gap: 8 }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('projectSnags.updateStatusHeader')}</Text>
                                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                                            {STATUS_CYCLE.map(s => (
                                                                <TouchableOpacity
                                                                    key={s}
                                                                    onPress={() => handleUpdateStatus(selectedSnag, s, responseComment, responsePhotos, removedResponsePhotos)}
                                                                    style={{
                                                                        flex: 1, height: 34, borderRadius: 8,
                                                                        backgroundColor: selectedSnag.status === s ? STATUS_CONFIG[s].bg : colors.surface,
                                                                        alignItems: 'center', justifyContent: 'center',
                                                                        borderWidth: 1, borderColor: colors.border
                                                                    }}
                                                                >
                                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: selectedSnag.status === s ? '#fff' : colors.text }}>{STATUS_CONFIG[s].label.split(' ')[0]}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </ScrollView>
                            )}

                            {/* ── Secondary Modals (Nested for iOS compatibility) ──────────────── */}
                            <FullScreenImageModal
                                visible={!!viewPhoto}
                                onClose={() => setViewPhoto(null)}
                                uri={viewPhoto}
                            />

                            {/* Camera Modal */}
                            <Modal
                                visible={cameraVisible}
                                animationType="slide"
                                transparent={false}
                                presentationStyle="fullScreen"
                                statusBarTranslucent={true}
                                onRequestClose={() => setCameraVisible(false)}
                            >
                                <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                                        <View style={{ flex: 1 }}>
                                            {cameraPermission?.granted && cameraReady ? (
                                                <>
                                                    <View style={{
                                                        width: SCREEN_W,
                                                        height: CAMERA_HEIGHT,
                                                        overflow: 'hidden',
                                                        marginTop: Math.max(insets.top, 20) + 60,
                                                    }}>
                                                        <GestureDetector gesture={pinchGesture}>
                                                            <View collapsable={false} style={StyleSheet.absoluteFill}>
                                                                <CameraView
                                                                    style={StyleSheet.absoluteFill}
                                                                    facing="back"
                                                                    ref={cameraRef}
                                                                    ratio="4:3"
                                                                    zoom={cameraZoom}
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
                                                                    bottom: 64,
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
                                                        {/* Direct Zoom Buttons */}
                                                        <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 16, zIndex: 40 }}>
                                                            {(Platform.OS === 'ios' ? [0.5, 1, 2] : [1, 2, 3]).map(factor => (
                                                                <TouchableOpacity
                                                                    key={factor}
                                                                    onPress={() => handleManualZoom(factor)}
                                                                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                                                                >
                                                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{factor}x</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>

                                                    <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                                                        <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                                                            <Feather name="x" size={24} color="#fff" />
                                                        </TouchableOpacity>
                                                        <Text style={cameraStyles.headerTitle}>{t('projectSnags.photoLabel')}</Text>
                                                        <View style={{ width: 60 }} />
                                                    </View>

                                                    <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                                                        {cameraMode === 'response' && responsePhotos.length > 0 && (
                                                            <View style={cameraStyles.previewContainer}>
                                                                <View style={cameraStyles.previewWrapper}>
                                                                    <Image
                                                                        source={{ uri: responsePhotos[0] }}
                                                                        style={cameraStyles.previewThumb}
                                                                    />
                                                                    <TouchableOpacity
                                                                        onPress={() => setResponsePhotos([])}
                                                                        style={cameraStyles.removeBtn}
                                                                    >
                                                                        <Feather name="x" size={12} color="#fff" />
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity
                                                                        onPress={() => setAnnotatingImageIndex(0)}
                                                                        style={{ position: 'absolute', bottom: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 10 }}
                                                                    >
                                                                        <Feather name="edit-2" size={12} color="#fff" />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        )}

                                                        <View style={cameraStyles.shutterRow}>
                                                            <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                                                                <View style={cameraStyles.iconCircle}>
                                                                    <Feather name="image" size={24} color="#fff" />
                                                                </View>
                                                                <Text style={cameraStyles.btnLabel}>{t('projectSnags.gallery')}</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                                                                <View style={cameraStyles.shutterOuter}>
                                                                    <View style={cameraStyles.shutterInner} />
                                                                </View>
                                                                <Text style={cameraStyles.btnLabel}>{t('projectSnags.photo')}</Text>
                                                            </TouchableOpacity>
                                                            <View style={{ width: 70 }} />
                                                        </View>
                                                    </View>
                                                </>
                                            ) : (
                                                <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                                                    {cameraPermission?.granted ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <>
                                                            <Text style={{ color: '#fff', marginBottom: 20 }}>{t('projectSnags.cameraAccessDesc')}</Text>
                                                            <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                                                                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('linkedDevices.continue')}</Text>
                                                            </TouchableOpacity>
                                                        </>

                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Nested Image Annotator for immediate capture editing on iOS */}
                                    {annotatingImageIndex !== null && (
                                        <ImageAnnotator
                                            uri={annotatingImageIndex === -1 ? editPhoto! :
                                                annotatingImageIndex === -2 ? (selectedSnag?.photoDownloadUrl || selectedSnag?.photo_url)! :
                                                    responsePhotos[annotatingImageIndex]}
                                            onSave={(newUri) => {
                                                if (annotatingImageIndex === -1 || annotatingImageIndex === -2) {
                                                    setEditPhoto(newUri);
                                                } else {
                                                    const newImages = [...responsePhotos];
                                                    newImages[annotatingImageIndex] = newUri;
                                                    setResponsePhotos(newImages);
                                                }
                                                setAnnotatingImageIndex(null);
                                                setCameraVisible(false);
                                            }}
                                            onCancel={() => setAnnotatingImageIndex(null)}
                                        />
                                    )}
                                </GestureHandlerRootView>
                            </Modal>

                            {/* Image Annotator for editing from the response list (when camera is closed) */}
                            {!cameraVisible && annotatingImageIndex !== null && (
                                <ImageAnnotator
                                    uri={annotatingImageIndex === -1 ? editPhoto! :
                                        annotatingImageIndex === -2 ? (selectedSnag?.photoDownloadUrl || selectedSnag?.photo_url)! :
                                            responsePhotos[annotatingImageIndex]}
                                    onSave={(newUri) => {
                                        if (annotatingImageIndex === -1 || annotatingImageIndex === -2) {
                                            setEditPhoto(newUri);
                                        } else {
                                            const newImages = [...responsePhotos];
                                            newImages[annotatingImageIndex] = newUri;
                                            setResponsePhotos(newImages);
                                        }
                                        setAnnotatingImageIndex(null);
                                    }}
                                    onCancel={() => setAnnotatingImageIndex(null)}
                                />
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Root-level Photo Viewer (for list view clicks when detail modal is closed) */}
            {!selectedSnag && (
                <FullScreenImageModal
                    visible={!!viewPhoto}
                    onClose={() => setViewPhoto(null)}
                    uri={viewPhoto}
                />
            )}
        </View>
    );
}

const cameraStyles = StyleSheet.create({
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    headerBtn: {
        padding: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    controlsOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 10,
        paddingTop: 10
    },
    previewContainer: {
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    previewWrapper: {
        position: 'relative',
        marginRight: 5,
        alignSelf: 'flex-start',
    },
    previewThumb: {
        width: 56,
        height: 56,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    removeBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#ef4444',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#000',
        zIndex: 20,
    },
    shutterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    sideBtn: {
        alignItems: 'center',
        width: 70,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterBtn: {
        alignItems: 'center',
    },
    shutterOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: '#fff',
        backgroundColor: '#ea8c0a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fff',
    },
    btnLabel: {
        color: '#ccc',
        fontSize: 10,
        marginTop: 5,
    },
});
