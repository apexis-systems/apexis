import { useState, useRef } from 'react';
import {
    View, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, StyleSheet, Dimensions
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSnag, getAssignees, Assignee } from '@/services/snagService';
import { useEffect, useCallback, useLayoutEffect } from 'react';
import { Modal, BackHandler } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { parseApiError } from '@/helpers/apiError';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuth } from '@/contexts/AuthContext';

type Step = 'camera' | 'details';

const { width: SCREEN_W } = Dimensions.get('window');
const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

export default function SnagCreateScreen() {
    const { isScreenCaptureProtected } = useAuth();

    useFocusEffect(
        useCallback(() => {
            if (isScreenCaptureProtected) {
                ScreenCapture.preventScreenCaptureAsync('snag-create-screen');
            }
            return () => {
                ScreenCapture.allowScreenCaptureAsync('snag-create-screen');
            };
        }, [isScreenCaptureProtected])
    );

    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    const [step, setStep] = useState<Step>('camera');
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; mime: string; name: string } | null>(null);
    const [annotatingUri, setAnnotatingUri] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assigneeId, setAssigneeId] = useState<number | null>(null);
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        if (projectId) {
            getAssignees(projectId).then(setAssignees).catch(() => { });
        }
    }, [projectId]);


    useLayoutEffect(() => {
        navigation.setOptions({
            tabBarStyle: { display: 'none' },
        });
    }, [navigation]);

    useEffect(() => {
        if (!cameraPermission?.granted) requestCameraPermission();
        if (!mediaPermission?.granted) requestMediaPermission();
    }, [cameraPermission?.granted, mediaPermission?.granted]);

    const resetState = () => {
        setCapturedPhoto(null);
        setTitle('');
        setDescription('');
        setAssigneeId(null);
        setStep('camera');
    };

    const handleBack = useCallback(() => {
        const goBack = () => {
            resetState();
            if (projectId) {
                router.push(`/(tabs)/project/${projectId}?tab=snags`);
            } else {
                router.back();
            }
        };

        if (capturedPhoto || title.trim()) {
            Alert.alert(
                'Discard?',
                'Are you sure you want to discard this snag?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: goBack }
                ]
            );
        } else {
            goBack();
        }
    }, [capturedPhoto, title, projectId, router]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                handleBack();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [handleBack])
    );

    const capturePhoto = async () => {
        if (!cameraRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
            if (!photo?.uri) return;

            // Enforce 4:3 crop for iOS to match preview
            const { width, height } = photo;
            const manipActions: any[] = [];
            if (Platform.OS === 'ios') {
                const targetRatio = 3 / 4;
                const currentRatio = width / height;
                if (Math.abs(currentRatio - targetRatio) > 0.01) {
                    const newHeight = Math.min(height, Math.floor(width / targetRatio));
                    const originY = Math.max(0, Math.floor((height - newHeight) / 2));
                    manipActions.push({ crop: { originX: 0, originY, width, height: newHeight } });
                }
            }
            manipActions.push({ resize: { width: 1920 } });

            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                manipActions,
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );

            setCapturedPhoto({ uri: manipulated.uri, mime: 'image/jpeg', name: `snag_${Date.now()}.jpg` });
            // keep user in camera view so they can preview/edit or press Done
        } catch (e) {
            console.error('capturePhoto error:', e);
        } finally {
            setIsCapturing(false);
        }
    };

    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 0.9,
        });
        if (result.canceled || !result.assets?.length) return;
        const a = result.assets[0] as any;
        let uri = a.uri;
        try {
            const manipulated = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1920 } }],
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );
            uri = manipulated.uri;
        } catch (e) {}

        setCapturedPhoto({ uri, mime: 'image/jpeg', name: a.fileName || `snag_${Date.now()}.jpg` });
        // keep in camera view to match RFI UX
    };

    const handleSubmit = async () => {
        if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
        if (!capturedPhoto) { Alert.alert('Error', 'Photo is required'); return; }
        if (!assigneeId) { Alert.alert('Error', 'Assignee is required'); return; }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('project_id', String(projectId));
            form.append('title', title.trim());
            if (description.trim()) form.append('description', description.trim());
            if (assigneeId) form.append('assigned_to', String(assigneeId));
            form.append('photo', { uri: capturedPhoto.uri, type: capturedPhoto.mime, name: capturedPhoto.name } as any);
            await createSnag(form);
            resetState();
            if (projectId) {
                router.push(`/(tabs)/project/${projectId}?tab=snags`);
            } else {
                router.back();
            }
        } catch (error) {
            const { message, code } = parseApiError(error, 'Failed to create snag. Please try again.');
            Alert.alert(
                code === 'LIMIT_REACHED' ? 'Limit Reached' : 'Error', 
                message,
                code === 'LIMIT_REACHED' ? [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade', onPress: () => router.push('/subscription') }
                ] : undefined
            );
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAssignee = assignees.find(a => a.id === assigneeId);

    // ── CAMERA STEP ───────────────────────────────────────────────────────────
    if (step === 'camera') {
        return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                {/* Header removed — using overlay header inside CameraView for consistent RFI UX */}

                {/* Camera */}
                {cameraPermission === null ? (
                    <View style={{ flex: 1, backgroundColor: '#000' }} />
                ) : (cameraPermission.granted && isFocused) ? (
                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                        <View style={{
                            width: SCREEN_W,
                            height: CAMERA_HEIGHT,
                            overflow: 'hidden',
                            marginTop: Math.max(insets.top, 20) + 60, // Match RFI layout
                        }}>
                            <CameraView 
                                style={StyleSheet.absoluteFill} 
                                facing="back" 
                                ref={cameraRef} 
                                ratio="4:3"
                            />
                        </View>

                        {/* Header Overlay */}
                        <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                            <TouchableOpacity onPress={handleBack} style={cameraStyles.headerBtn}>
                                <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={cameraStyles.headerTitle}>Snag Photo</Text>
                            <View style={{ width: 60 }} />
                        </View>

                        {/* Bottom Controls Overlay */}
                        <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                            {/* Preview row */}
                            {capturedPhoto && (
                                <View style={cameraStyles.previewContainer}>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 10, paddingRight: 30 }}
                                    >
                                        <View style={cameraStyles.previewWrapper}>
                                            <Image source={{ uri: capturedPhoto.uri }} style={cameraStyles.previewThumb} />
                                            <TouchableOpacity
                                                onPress={() => setCapturedPhoto(null)}
                                                style={cameraStyles.removeBtn}
                                            >
                                                <Feather name="x" size={12} color="#fff" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setAnnotatingUri(capturedPhoto.uri)}
                                                style={{ position: 'absolute', bottom: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 10 }}
                                            >
                                                <Feather name="edit-2" size={12} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    </ScrollView>
                                </View>
                            )}

                            <View style={cameraStyles.shutterRow}>
                                <TouchableOpacity onPress={pickFromGallery} style={cameraStyles.sideBtn}>
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

                        {/* Floating Done Button */}
                        {capturedPhoto && (
                            <TouchableOpacity
                                onPress={() => setStep('details')}
                                style={{
                                    position: 'absolute',
                                    bottom: insets.bottom + 180,
                                    right: 20,
                                    backgroundColor: colors.primary,
                                    paddingHorizontal: 24,
                                    paddingVertical: 14,
                                    borderRadius: 30,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                    elevation: 8,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 5,
                                    zIndex: 20
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                                <Feather name="arrow-right" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                        <TouchableOpacity onPress={requestCameraPermission} style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    // ── DETAILS STEP ─────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface,
                borderBottomWidth: 1, borderBottomColor: colors.border,
            }}>
                <TouchableOpacity onPress={() => setStep('camera')}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Snag Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                {/* Photo preview */}
                {capturedPhoto && (
                    <View style={{ marginBottom: 28, alignItems: 'center' }}>
                        <View style={{ width: 140, height: 180 }}>
                            <Image
                                source={{ uri: capturedPhoto.uri }}
                                style={{ width: 140, height: 180, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                resizeMode="cover"
                            />
                            <TouchableOpacity
                                onPress={() => capturedPhoto && setAnnotatingUri(capturedPhoto.uri)}
                                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}
                            >
                                <Feather name="edit-2" size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={() => setStep('camera')}
                            style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
                        >
                            <Feather name="camera" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Retake</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Title */}
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Title *</Text>
                <TextInput
                    style={{ backgroundColor: colors.surface, color: colors.text, padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
                    placeholder="Brief title of the issue"
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                />

                {/* Description */}
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Description</Text>
                <TextInput
                    placeholder="Detailed description..."
                    placeholderTextColor={colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    maxLength={500}
                    style={{ minHeight: 90, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, textAlignVertical: 'top', marginBottom: 16 }}
                />

                {/* Assignee */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Assign To</Text>
                <TouchableOpacity
                    onPress={() => setDropdownOpen(true)}
                    style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 24 }}
                >
                    <Text style={{ fontSize: 14, color: selectedAssignee ? colors.text : colors.textMuted }}>
                        {selectedAssignee ? `${selectedAssignee.name} (${selectedAssignee.role.charAt(0).toUpperCase() + selectedAssignee.role.slice(1)})` : 'Select team member… *'}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Submit */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting || !title.trim() || !capturedPhoto || !assigneeId}
                    style={{
                        height: 52, borderRadius: 26, marginBottom: 50,
                        backgroundColor: (title.trim() && capturedPhoto && assigneeId) ? colors.primary : colors.border,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Create Snag</Text>
                    }
                </TouchableOpacity>
            </ScrollView>
            </KeyboardAvoidingView>

            {/* Image annotator for captured photo */}
            {annotatingUri && (
                <ImageAnnotator
                    uri={annotatingUri}
                    onSave={(newUri) => {
                        setCapturedPhoto(prev => prev ? { ...prev, uri: newUri } : prev);
                        setAnnotatingUri(null);
                    }}
                    onCancel={() => setAnnotatingUri(null)}
                />
            )}

            {/* Assignee picker modal */}
            <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 16 }}>
                        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Assign to</Text>
                        </View>
                        <ScrollView>
                            {assignees.map(a => (
                                <TouchableOpacity
                                    key={a.id}
                                    onPress={() => { setAssigneeId(a.id); setDropdownOpen(false); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                                            {a.name} <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '400' }}>({a.role.charAt(0).toUpperCase() + a.role.slice(1)})</Text>
                                        </Text>
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{a.email}</Text>
                                    </View>
                                    {assigneeId === a.id && <Feather name="check" size={16} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                            {assignees.length === 0 && (
                                <Text style={{ fontSize: 12, color: colors.textMuted, padding: 16, textAlign: 'center' }}>No team members found.</Text>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
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
