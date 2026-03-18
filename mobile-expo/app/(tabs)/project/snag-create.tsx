import { useState, useRef } from 'react';
import {
    View, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSnag, getAssignees, Assignee } from '@/services/snagService';
import { useEffect, useCallback, useLayoutEffect } from 'react';
import { Modal, BackHandler } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

type Step = 'camera' | 'details';

export default function SnagCreateScreen() {
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
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (!photo?.uri) return;
            setCapturedPhoto({ uri: photo.uri, mime: 'image/jpeg', name: `snag_${Date.now()}.jpg` });
            setStep('details');
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
            quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;
        const a = result.assets[0] as any;
        setCapturedPhoto({ uri: a.uri, mime: a.mimeType || 'image/jpeg', name: a.fileName || `snag_${Date.now()}.jpg` });
        setStep('details');
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
        } catch {
            Alert.alert('Error', 'Failed to create snag. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAssignee = assignees.find(a => a.id === assigneeId);

    // ── CAMERA STEP ───────────────────────────────────────────────────────────
    if (step === 'camera') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
                {/* Header */}
                <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 20, paddingVertical: 16,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}>
                    <TouchableOpacity onPress={handleBack}>
                        <Feather name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Take Snag Photo</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Camera */}
                {cameraPermission === null ? (
                    <View style={{ flex: 1, backgroundColor: '#000' }} />
                ) : (cameraPermission.granted && isFocused) ? (
                    <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef}>
                        {/* Bottom Controls */}
                        <View style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            paddingBottom: Math.max(insets.bottom, 16),
                            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 15
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 16 }}>
                                {/* Gallery */}
                                <TouchableOpacity onPress={pickFromGallery} style={{ alignItems: 'center', width: 70 }}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="image" size={22} color="#fff" />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Gallery</Text>
                                </TouchableOpacity>

                                {/* Shutter */}
                                <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={{ alignItems: 'center' }}>
                                    <View style={{
                                        width: 76, height: 76, borderRadius: 38,
                                        borderWidth: 4, borderColor: '#fff',
                                        backgroundColor: '#ea8c0a',
                                        alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <View style={{
                                            width: 52, height: 52, borderRadius: 26,
                                            backgroundColor: '#fff',
                                        }} />
                                    </View>
                                    <Text style={{ color: '#ccc', fontSize: 10, marginTop: 5 }}>Photo</Text>
                                </TouchableOpacity>

                                {/* Spacer / Right Button */}
                                <View style={{ width: 70 }} />
                            </View>
                        </View>
                    </CameraView>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                        <TouchableOpacity onPress={requestCameraPermission} style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
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

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                {/* Photo preview */}
                {capturedPhoto && (
                    <View style={{ marginBottom: 28, alignItems: 'center' }}>
                        <Image
                            source={{ uri: capturedPhoto.uri }}
                            style={{ width: 140, height: 180, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                            resizeMode="cover"
                        />
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
