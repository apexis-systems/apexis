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
import { Image } from "expo-image";
import { Text } from "@/components/ui/AppText";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
} from "@/services/snagService";
import * as ImagePicker from 'expo-image-picker';
import FullScreenImageModal from "@/components/shared/FullScreenImageModal";
import ImageAnnotator from "../common/ImageAnnotator";
import { KeyboardAvoidingView } from "react-native";

interface Props {
    project: Project;
    initialSnagId?: string;
}

const STATUS_CONFIG: Record<
    SnagStatus,
    { icon: keyof typeof Feather.glyphMap; bg: string; label: string }
> = {
    amber: { icon: "minus", bg: "#f59e0b", label: "Waiting for Clearance" },
    green: { icon: "check", bg: "#22c55e", label: "Completed" },
    red: { icon: "x", bg: "#ef4444", label: "No Action Required" },
};
const STATUS_CYCLE: SnagStatus[] = ["amber", "green", "red"];

export default function ProjectSnagList({ project, initialSnagId }: Props) {
    const { colors } = useTheme();
    const { user } = useAuth();

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const projectId = project.id;

    const SCREEN_W = Dimensions.get('window').width;
    const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    // Photo viewer
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);

    const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editAssignedTo, setEditAssignedTo] = useState<number | null>(null);
    const [editPhoto, setEditPhoto] = useState<string | null>(null);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    const [responseComment, setResponseComment] = useState("");
    const [responsePhotos, setResponsePhotos] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [cameraVisible, setCameraVisible] = useState(false);
    const [cameraMode, setCameraMode] = useState<'edit' | 'response'>('response');
    const [annotatingImageIndex, setAnnotatingImageIndex] = useState<number | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraSessionKey, setCameraSessionKey] = useState(0);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [isCapturing, setIsCapturing] = useState(false);
    const cameraRef = React.useRef<CameraView>(null);

    // Physical Orientation Tracking
    const [physicalOrientation, setPhysicalOrientation] = useState<number>(0);

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

    // ── Status cycle ───────────────────────────────────────────────────────────

    const handleUpdateStatus = async (snag: Snag, nextStatus?: SnagStatus, comment?: string, files?: string[]) => {
        const idx = STATUS_CYCLE.indexOf(snag.status);
        const next = nextStatus || STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('status', next);
            formData.append('response', comment || "");
            if (files) {
                files.forEach((uri, i) => {
                    const filename = uri.split('/').pop() || `resp_${i}.jpg`;
                    const match = /\.(\w+)$/.exec(filename);
                    const type = match ? `image/${match[1]}` : `image/jpeg`;
                    formData.append('photos', { uri, name: filename, type } as any);
                });
            }

            

            const updated = await updateSnagStatus(snag.id, formData);
            setSnags(prev => prev.map(s => s.id === snag.id ? updated : s));
            if (selectedSnag?.id === snag.id) setSelectedSnag(updated);

            setResponseComment("");
            setResponsePhotos([]);

            if (next === snag.status) {
                Alert.alert("Success", "Response updated successfully");
            } else {
                Alert.alert("Success", `Status updated to ${STATUS_CONFIG[next].label}`);
            }
        } catch (error) {
            console.error("handleUpdateStatus error", error);
            Alert.alert("Error", "Failed to update status");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSnag = async (snagId: number, snagTitle: string) => {
        Alert.alert("Delete", `Remove "${snagTitle}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteSnagApi(snagId);
                        setSnags((prev) => prev.filter((s) => s.id !== snagId));
                        setSelectedSnag(null);
                    } catch {
                        Alert.alert("Error", "Failed to delete");
                    }
                },
            },
        ]);
    };

    const handleUpdateSnag = async () => {
        if (!selectedSnag || !editTitle.trim()) {
            Alert.alert("Error", "Title is required");
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

            const updated = await updateSnag(selectedSnag.id, formData);
            setSnags(prev => prev.map(s => s.id === selectedSnag.id ? updated : s));
            setSelectedSnag(updated);
            setIsEditing(false);
            Alert.alert("Success", "Snag updated successfully");
        } catch (error) {
            console.error("handleUpdateSnag error", error);
            Alert.alert("Error", "Failed to update snag");
        } finally {
            setSubmitting(false);
        }
    };

    const startEditing = (snag: Snag) => {
        setEditTitle(snag.title);
        setEditDesc(snag.description || "");
        setEditAssignedTo(snag.assigned_to || null);
        setEditPhoto(snag.photoDownloadUrl || snag.photo_url || null);
        setIsEditing(true);
    };

    const openCamera = async (mode: 'edit' | 'response') => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) {
                Alert.alert("Permission Required", "Camera permission is needed to take photos.");
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
                setResponsePhotos([uri]);
                setAnnotatingImageIndex(0);
            }
        } catch (error) {
            console.error('pickImageFiles error', error);
            Alert.alert('Error', 'Failed to pick image from gallery.');
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
                // Single photo for response: replace existing
                setResponsePhotos([manipulated.uri]);
                setAnnotatingImageIndex(0);
            }
        } catch (e) {
            console.error("capturePhoto error", e);
            Alert.alert("Camera Error", "Failed to capture photo");
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
                    Add Snag
                </Text>
            </TouchableOpacity>

            {/* Snag list */}
            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : (
                <View style={{ gap: 8 }}>
                    {snags.map((snag) => {
                        const cfg = STATUS_CONFIG[snag.status];
                        const isTarget =
                            initialSnagId && String(snag.id) === String(initialSnagId);
                        return (
                            <TouchableOpacity
                                key={snag.id}
                                onPress={() => {
                                    setResponseComment("");
                                    setResponsePhotos([]);
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
                                            Alert.alert("Permission Denied", "Only the assigned person can update the status");
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
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                            To: <Text style={{ color: colors.text, fontWeight: '600' }}>{snag.assignee?.name || "Unassigned"}</Text>
                                        </Text>
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
                                                <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>+{snag.responsePhotoUrls.length} photos</Text>
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
                    {snags.length === 0 && (
                        <View style={{ marginTop: 30, alignItems: "center" }}>
                            <Feather name="check-square" size={32} color={colors.border} />
                            <Text
                                style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                                No snags yet
                            </Text>
                        </View>
                    )}
                </View>
            )}
            </ScrollView>

            {/* Snag Detail Modal */}
            <Modal 
                visible={!!selectedSnag} 
                animationType="slide" 
                transparent 
                presentationStyle="overFullScreen"
                onRequestClose={() => { setSelectedSnag(null); setIsEditing(false); setResponseComment(""); setResponsePhotos([]); }}
            >
                <KeyboardAvoidingView
                          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          style={{ flex: 1 }}
                        >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%', padding: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{isEditing ? 'Edit Snag' : 'Snag Details'}</Text>
                            <TouchableOpacity onPress={() => { setSelectedSnag(null); setIsEditing(false); setResponseComment(""); setResponsePhotos([]); }}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedSnag && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {isEditing ? (
                                    <View style={{ gap: 15, paddingBottom: 40 }}>
                                        <View>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>Title</Text>
                                            <TextInput
                                                value={editTitle}
                                                onChangeText={setEditTitle}
                                                placeholder="Snag Title"
                                                style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                                            />
                                        </View>

                                        <View>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>Description</Text>
                                            <TextInput
                                                value={editDesc}
                                                onChangeText={setEditDesc}
                                                placeholder="Description"
                                                multiline
                                                style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: 'top' }}
                                            />
                                        </View>

                                        <View>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 5 }}>Assigned To</Text>
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
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Photo</Text>
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

                                        <TouchableOpacity
                                            onPress={handleUpdateSnag}
                                            disabled={submitting}
                                            style={{ backgroundColor: colors.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, opacity: submitting ? 0.7 : 1 }}
                                        >
                                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save Changes</Text>}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setIsEditing(false)}
                                            style={{ height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
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

                                        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{selectedSnag.title}</Text>
                                        <Text style={{ fontSize: 13, color: colors.textMuted }}>{selectedSnag.description}</Text>

                                        {(selectedSnag.photoDownloadUrl || selectedSnag.photo_url) && (
                                            <TouchableOpacity onPress={() => setViewPhoto(selectedSnag.photoDownloadUrl || selectedSnag.photo_url!)}>
                                                <Image
                                                    source={selectedSnag.photoDownloadUrl || selectedSnag.photo_url}
                                                    style={{ width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                                />
                                            </TouchableOpacity>
                                        )}

                                        <View style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 12, gap: 8 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 12, color: colors.textMuted }}>Assigned To</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{selectedSnag.assignee?.name || 'Unassigned'}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 12, color: colors.textMuted }}>Created By</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{selectedSnag.creator?.name || '—'}</Text>
                                            </View>
                                        </View>

                                        {(selectedSnag.response || (selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0)) && (
                                            <View style={{ padding: 12, backgroundColor: colors.primary + '08', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, marginBottom: 4, textTransform: 'uppercase' }}>Response</Text>
                                                {selectedSnag.response ? <Text style={{ fontSize: 13, color: colors.text }}>{selectedSnag.response}</Text> : null}
                                                {selectedSnag.responsePhotoUrls && selectedSnag.responsePhotoUrls.length > 0 && (
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                                            {selectedSnag.responsePhotoUrls.map((url, i) => (
                                                                <TouchableOpacity key={i} onPress={() => setViewPhoto(url)}>
                                                                    <Image source={url} style={{ width: 80, height: 80, borderRadius: 8 }} />
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>
                                                )}
                                            </View>
                                        )}

                                        {/* Response Section */}
                                        {String(selectedSnag.assigned_to) === String(user?.id) && (
                                            <View style={{ gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{selectedSnag.response ? 'Update Response' : 'Provide Response'}</Text>
                                                
                                                {selectedSnag.status !== 'green' ? (
                                                    <>
                                                        <TextInput
                                                            value={responseComment}
                                                            onChangeText={setResponseComment}
                                                            placeholder="Type your response here..."
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
                                                                    <Image source={{ uri }} style={{ width: 70, height: 70, borderRadius: 10, borderWidth: 1, borderColor: colors.border }} />
                                                                    <TouchableOpacity
                                                                        onPress={() => setResponsePhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, padding: 2 }}
                                                                    >
                                                                        <Feather name="x" size={12} color="#fff" />
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity
                                                                        onPress={() => setAnnotatingImageIndex(i)}
                                                                        style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 8 }}
                                                                    >
                                                                        <Feather name="edit-2" size={10} color="#fff" />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            ))}
                                                            <TouchableOpacity 
                                                                onPress={pickResponsePhotos} 
                                                                style={{ 
                                                                    width: 70, height: 70, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border, 
                                                                    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface 
                                                                }}
                                                            >
                                                                <Feather name="camera" size={20} color={colors.textMuted} />
                                                            </TouchableOpacity>
                                                        </View>

                                                        <TouchableOpacity
                                                            onPress={() => handleUpdateStatus(selectedSnag, selectedSnag.status, responseComment, responsePhotos)}
                                                            disabled={submitting || (!responseComment.trim() && responsePhotos.length === 0)}
                                                            style={{
                                                                backgroundColor: colors.primary,
                                                                height: 42,
                                                                borderRadius: 10,
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: (submitting || (!responseComment.trim() && responsePhotos.length === 0)) ? 0.6 : 1
                                                            }}
                                                        >
                                                            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Submit Response</Text>}
                                                        </TouchableOpacity>
                                                    </>
                                                ) : (
                                                    <View style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 8, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>Completed snags cannot be updated</Text>
                                                    </View>
                                                )}

                                                <View style={{ marginTop: 5, gap: 8 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Update Status</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        {STATUS_CYCLE.map(s => (
                                                            <TouchableOpacity
                                                                key={s}
                                                                onPress={() => handleUpdateStatus(selectedSnag, s)}
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
                                                <CameraView
                                                    key={cameraSessionKey}
                                                    style={StyleSheet.absoluteFill}
                                                    facing="back"
                                                    ref={cameraRef}
                                                    ratio="4:3"
                                                />
                                            </View>

                                            <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                                                <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                                                    <Feather name="x" size={24} color="#fff" />
                                                </TouchableOpacity>
                                                <Text style={cameraStyles.headerTitle}>Snag Photo</Text>
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
                                                        <Text style={cameraStyles.btnLabel}>Gallery</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                                                        <View style={cameraStyles.shutterOuter}>
                                                            <View style={cameraStyles.shutterInner} />
                                                        </View>
                                                        <Text style={cameraStyles.btnLabel}>Photo</Text>
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
                                                    <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                                                    <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                                                        <Text style={{ color: '#fff', fontWeight: '700' }}>Grant Permission</Text>
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
